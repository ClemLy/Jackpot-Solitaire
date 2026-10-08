// Fonction serveur "api": toutes les ecritures des comptes passent par ici.
//
// - Authentification: jeton de session Supabase verifie a chaque appel.
// - Limitation: un nombre maximal d'actions par minute et par joueur.
// - Validation: chaque action est analysee (parseAction) puis rejouee par le
//   coeur du jeu, le meme que dans le navigateur. Le serveur fait foi.
// - Concurrence: verrou optimiste sur la version de la sauvegarde.
//
// Le module est independant de Deno: il recoit et rend des Request/Response
// standard, ce qui le rend testable sous Node.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  CoreError,
  GAME_TIME_ZONE,
  dispatch,
  importGuest,
  initialPlayer,
  makeCtx,
  miniCard,
  parseAction,
  publicCard,
  sanitizePlayer,
  type PlayerState,
  type PublicCard,
} from '../src/core';
import { isRecord } from '../src/core/sanitize';

export interface ApiConfig {
  url: string;
  serviceKey: string;
  /** Origines autorisees a appeler l'API (le site du jeu). */
  allowedOrigins: string[];
  now?: () => number;
  random?: () => number;
  /** Actions par minute et par joueur. */
  rateLimit?: number;
}

const MAX_BODY = 512 * 1024;
const MAX_FRIENDS = 200;
const MAX_PENDING = 50;
const PSEUDO = /^[A-Za-z0-9_-]{3,16}$/;

/** Hasard cryptographique: graines, coffre et roue tires par le serveur. */
function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x1_0000_0000;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createHandler(config: ApiConfig) {
  const admin: SupabaseClient = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = config.now ?? Date.now;
  const random = config.random ?? cryptoRandom;
  const ctx = () => makeCtx(now(), random, GAME_TIME_ZONE);

  function cors(origin: string | null): Record<string, string> {
    const allowed =
      origin && config.allowedOrigins.includes(origin) ? origin : null;
    return {
      ...(allowed ? { 'Access-Control-Allow-Origin': allowed } : {}),
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-client-info',
      'Access-Control-Max-Age': '86400',
    };
  }

  function json(
    body: unknown,
    status: number,
    origin: string | null,
  ): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...cors(origin),
      },
    });
  }

  async function userFrom(req: Request): Promise<{ id: string }> {
    const header = req.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'auth', 'Connexion requise.');
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      throw new HttpError(401, 'auth', 'Session expirée, reconnecte-toi.');
    }
    return { id: data.user.id };
  }

  async function limit(uid: string): Promise<void> {
    const { data, error } = await admin.rpc('api_hit', {
      uid,
      max_hits: config.rateLimit ?? 120,
    });
    if (error) throw error;
    if (data !== true) {
      throw new HttpError(
        429,
        'rate',
        'Doucement ! Trop d’actions d’un coup, réessaie dans un instant.',
      );
    }
  }

  async function profileOf(uid: string) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, pseudo, created_at, public_card')
      .eq('id', uid)
      .single();
    if (error || !data)
      throw new HttpError(404, 'profile', 'Profil introuvable.');
    return data as {
      id: string;
      pseudo: string;
      created_at: string;
      public_card: PublicCard;
    };
  }

  async function loadState(
    uid: string,
  ): Promise<{ state: PlayerState; version: number } | null> {
    const { data, error } = await admin
      .from('player_states')
      .select('state, version')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // Etat de repli pour la validation: il ne doit pas consommer le hasard
    // du jeu (graines, coffre, roue).
    const fresh = initialPlayer(makeCtx(now(), cryptoRandom, GAME_TIME_ZONE));
    return {
      state: sanitizePlayer(data.state, fresh),
      version: Number(data.version),
    };
  }

  async function refreshCard(
    uid: string,
    state: PlayerState,
  ): Promise<PublicCard> {
    const profile = await profileOf(uid);
    const card = publicCard(profile.pseudo, state, profile.created_at);
    await admin.from('profiles').update({ public_card: card }).eq('id', uid);
    return card;
  }

  /** Cree la sauvegarde du compte, en reprenant au besoin celle de l'invite. */
  async function bootstrap(uid: string, guest: unknown) {
    const existing = await loadState(uid);
    if (existing) return { state: existing.state, imported: false };
    const profile = await profileOf(uid);
    const fresh = initialPlayer(ctx());
    // L'import n'est permis qu'a la creation du compte, une seule fois.
    const recent = now() - Date.parse(profile.created_at) < 15 * 60 * 1000;
    const state =
      guest !== undefined && guest !== null && recent
        ? importGuest(guest, fresh)
        : fresh;
    const { error } = await admin.from('player_states').insert({
      user_id: uid,
      state,
      version: 0,
      imported: state !== fresh,
    });
    if (error) {
      // Deux appels simultanes: l'autre a gagne, on relit.
      const again = await loadState(uid);
      if (again) return { state: again.state, imported: false };
      throw error;
    }
    await refreshCard(uid, state);
    return { state, imported: state !== fresh };
  }

  /** Applique une action au joueur, avec verrou optimiste. */
  async function act(uid: string, raw: unknown) {
    const action = parseAction(raw);
    for (let attempt = 0; attempt < 3; attempt++) {
      const loaded =
        (await loadState(uid)) ??
        (await bootstrap(uid, undefined).then(() => loadState(uid)));
      if (!loaded) throw new HttpError(500, 'state', 'Sauvegarde introuvable.');
      const out = dispatch(loaded.state, action, ctx());
      const { data, error } = await admin
        .from('player_states')
        .update({
          state: out.state,
          version: loaded.version + 1,
          updated_at: new Date(now()).toISOString(),
        })
        .eq('user_id', uid)
        .eq('version', loaded.version)
        .select('version');
      if (error) throw error;
      if (data && data.length === 1) {
        await refreshCard(uid, out.state);
        return out;
      }
      // Version changee entre lecture et ecriture: on recommence.
    }
    throw new HttpError(409, 'busy', 'Action simultanée, réessaie.');
  }

  // -------------------------------------------------------------------------
  // Amis
  // -------------------------------------------------------------------------

  async function findByPseudo(pseudo: unknown) {
    if (typeof pseudo !== 'string' || !PSEUDO.test(pseudo)) {
      throw new HttpError(400, 'pseudo', 'Pseudo invalide.');
    }
    const { data } = await admin
      .from('profiles')
      .select('id, pseudo, public_card')
      .eq('pseudo_key', pseudo.toLowerCase())
      .maybeSingle();
    if (!data) throw new HttpError(404, 'unknown', 'Aucun joueur à ce nom.');
    return data as { id: string; pseudo: string; public_card: PublicCard };
  }

  async function relation(a: string, b: string) {
    const { data } = await admin
      .from('friendships')
      .select('requester, addressee, status')
      .or(
        `and(requester.eq.${a},addressee.eq.${b}),and(requester.eq.${b},addressee.eq.${a})`,
      );
    return (data ?? [])[0] as
      { requester: string; addressee: string; status: string } | undefined;
  }

  async function friends(uid: string) {
    const { data, error } = await admin
      .from('friendships')
      .select('requester, addressee, status, created_at')
      .or(`requester.eq.${uid},addressee.eq.${uid}`);
    if (error) throw error;
    const rows = data ?? [];
    const others = [
      ...new Set(
        rows.map((r) => (r.requester === uid ? r.addressee : r.requester)),
      ),
    ];
    const { data: profiles } = others.length
      ? await admin
          .from('profiles')
          .select('id, pseudo, public_card')
          .in('id', others)
      : { data: [] };
    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        p as { pseudo: string; public_card: PublicCard },
      ]),
    );
    const card = (id: string) => {
      const p = byId.get(id);
      if (!p) return null;
      return { ...miniCard(p.public_card), pseudo: p.pseudo };
    };
    const out = {
      friends: [] as ReturnType<typeof card>[],
      incoming: [] as ReturnType<typeof card>[],
      outgoing: [] as ReturnType<typeof card>[],
    };
    for (const r of rows) {
      const other = r.requester === uid ? r.addressee : r.requester;
      const c = card(other);
      if (!c) continue;
      if (r.status === 'accepted') out.friends.push(c);
      else if (r.addressee === uid) out.incoming.push(c);
      else out.outgoing.push(c);
    }
    return out;
  }

  async function friendRequest(uid: string, pseudo: unknown) {
    const target = await findByPseudo(pseudo);
    if (target.id === uid) {
      throw new HttpError(400, 'self', 'Tu ne peux pas t’ajouter toi-même.');
    }
    const existing = await relation(uid, target.id);
    if (existing?.status === 'accepted') return { status: 'friends' };
    if (existing && existing.requester === target.id) {
      // Il nous avait deja demande: on accepte.
      await admin
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester', target.id)
        .eq('addressee', uid);
      return { status: 'friends' };
    }
    if (existing) return { status: 'pending' };
    const { count: pending } = await admin
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('requester', uid)
      .eq('status', 'pending');
    if ((pending ?? 0) >= MAX_PENDING) {
      throw new HttpError(429, 'pending', 'Trop de demandes en attente.');
    }
    const { count: total } = await admin
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester.eq.${uid},addressee.eq.${uid}`)
      .eq('status', 'accepted');
    if ((total ?? 0) >= MAX_FRIENDS) {
      throw new HttpError(400, 'full', 'Ta liste d’amis est pleine.');
    }
    const { error } = await admin
      .from('friendships')
      .insert({ requester: uid, addressee: target.id });
    if (error) throw error;
    return { status: 'pending' };
  }

  async function friendRespond(uid: string, pseudo: unknown, accept: unknown) {
    const other = await findByPseudo(pseudo);
    if (accept === true) {
      await admin
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester', other.id)
        .eq('addressee', uid)
        .eq('status', 'pending');
    } else {
      await admin
        .from('friendships')
        .delete()
        .eq('requester', other.id)
        .eq('addressee', uid)
        .eq('status', 'pending');
    }
    return friends(uid);
  }

  async function friendRemove(uid: string, pseudo: unknown) {
    const other = await findByPseudo(pseudo);
    await admin
      .from('friendships')
      .delete()
      .or(
        `and(requester.eq.${uid},addressee.eq.${other.id}),and(requester.eq.${other.id},addressee.eq.${uid})`,
      );
    return friends(uid);
  }

  /** Carte complete d'un ami (ou de soi), mini-carte pour un inconnu. */
  async function friendCard(uid: string, pseudo: unknown) {
    const target = await findByPseudo(pseudo);
    if (target.id === uid)
      return { card: target.public_card, friend: false, self: true };
    const rel = await relation(uid, target.id);
    if (rel?.status === 'accepted') {
      return { card: target.public_card, friend: true, self: false };
    }
    return {
      card: miniCard(target.public_card),
      friend: false,
      self: false,
      pending: rel ? (rel.requester === uid ? 'outgoing' : 'incoming') : null,
    };
  }

  async function deleteAccount(uid: string, confirm: unknown) {
    const profile = await profileOf(uid);
    if (typeof confirm !== 'string' || confirm !== profile.pseudo) {
      throw new HttpError(400, 'confirm', 'Recopie ton pseudo pour confirmer.');
    }
    // La suppression de l'utilisateur emporte profil, sauvegarde et amis.
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;
    return { deleted: true };
  }

  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (req.method !== 'POST') {
      return json(
        { error: 'method', message: 'Méthode refusée.' },
        405,
        origin,
      );
    }
    try {
      const length = Number(req.headers.get('content-length') ?? 0);
      if (length > MAX_BODY) {
        throw new HttpError(413, 'size', 'Requête trop volumineuse.');
      }
      const text = await req.text();
      if (text.length > MAX_BODY) {
        throw new HttpError(413, 'size', 'Requête trop volumineuse.');
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new HttpError(400, 'json', 'Requête illisible.');
      }
      if (!isRecord(body))
        throw new HttpError(400, 'json', 'Requête illisible.');

      const user = await userFrom(req);
      await limit(user.id);
      const uid = user.id;

      switch (body.op) {
        case 'bootstrap': {
          const out = await bootstrap(uid, body.guest);
          const profile = await profileOf(uid);
          return json(
            {
              state: out.state,
              imported: out.imported,
              profile: {
                pseudo: profile.pseudo,
                createdAt: profile.created_at,
              },
            },
            200,
            origin,
          );
        }
        case 'act': {
          const out = await act(uid, body.action);
          return json(
            { state: out.state, notices: out.notices, result: out.result },
            200,
            origin,
          );
        }
        case 'friends':
          return json(await friends(uid), 200, origin);
        case 'friendRequest':
          return json(await friendRequest(uid, body.pseudo), 200, origin);
        case 'friendRespond':
          return json(
            await friendRespond(uid, body.pseudo, body.accept),
            200,
            origin,
          );
        case 'friendRemove':
          return json(await friendRemove(uid, body.pseudo), 200, origin);
        case 'friendCard':
          return json(await friendCard(uid, body.pseudo), 200, origin);
        case 'deleteAccount':
          return json(await deleteAccount(uid, body.confirm), 200, origin);
        default:
          throw new HttpError(400, 'op', 'Action inconnue.');
      }
    } catch (err) {
      if (err instanceof HttpError) {
        return json(
          { error: err.code, message: err.message },
          err.status,
          origin,
        );
      }
      if (err instanceof CoreError) {
        return json({ error: err.code, message: err.message }, 422, origin);
      }
      // Erreur inattendue: rien de technique ne sort vers le navigateur.
      console.error('[api]', err);
      return json(
        { error: 'server', message: 'Le croupier a eu un souci, réessaie.' },
        500,
        origin,
      );
    }
  };
}
