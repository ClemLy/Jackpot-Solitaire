// @vitest-environment node
//
// Tests d'integration de la fonction "api" contre le Supabase local
// (`npx supabase start`): vraie base, vraie authentification, vrais comptes.
// Ignores si le Supabase local ne repond pas.

import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHandler } from './api';
import { boardOf, type Round } from '../src/core';
import { findSolution, type Move } from '../src/engine';
import { findDifficulty } from '../src/state/catalog';

interface Local {
  url: string;
  anon: string;
  service: string;
}

function localSupabase(): Local | null {
  try {
    const out = execSync('npx supabase status -o json', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20_000,
    }).toString();
    const s = JSON.parse(out.slice(out.indexOf('{')));
    return { url: s.API_URL, anon: s.ANON_KEY, service: s.SERVICE_ROLE_KEY };
  } catch {
    return null;
  }
}

const local = localSupabase();
const ORIGIN = 'http://localhost:5173';
const RUN = `t${Date.now().toString(36).slice(-6)}`;

/** File de valeurs aleatoires: la prochaine graine peut etre imposee. */
const queue: number[] = [];
const random = () => (queue.length ? queue.shift()! : Math.random());

let admin: SupabaseClient;
let handler: ReturnType<typeof createHandler>;
const created: string[] = [];

async function account(pseudo: string) {
  const email = `${pseudo.toLowerCase()}@joueurs.jackpot-solitaire.invalid`;
  const password = 'MotDePasse123';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { pseudo },
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(local!.url, local!.anon, {
    auth: { persistSession: false },
  });
  const { data: session, error: e2 } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (e2) throw e2;
  return { id: data.user.id, token: session.session!.access_token, pseudo };
}

async function call(
  token: string | null,
  body: unknown,
  init: { origin?: string; raw?: string } = {},
) {
  const res = await handler(
    new Request('http://local/api', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: init.origin ?? ORIGIN,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init.raw ?? JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body: text ? JSON.parse(text) : null,
  };
}

/** Graine gagnable pour ce reglage, et la valeur aleatoire qui la tire. */
function solvable(difficulty: 'normal' | 'expert') {
  const { drawCount, gentle } = findDifficulty(difficulty);
  for (let seed = 100000; seed < 100400; seed++) {
    const round = { seed: String(seed), drawCount, gentle } as Round;
    const solution = findSolution(boardOf(round), 20_000);
    if (Array.isArray(solution)) {
      return {
        draw: (seed - 100000 + 0.5) / 900000,
        moves: solution as Move[],
      };
    }
  }
  throw new Error('aucune donne gagnable');
}

const winLog = (round: Round) => {
  const solution = findSolution(boardOf(round), 20_000) as Move[];
  return solution.map((move) => ({ t: 'move', move }));
};

const suite = local ? describe : describe.skip;

suite('fonction api (Supabase local)', () => {
  beforeAll(() => {
    admin = createClient(local!.url, local!.service, {
      auth: { persistSession: false },
    });
    handler = createHandler({
      url: local!.url,
      serviceKey: local!.service,
      allowedOrigins: [ORIGIN],
      random,
    });
  });

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it('exige une session valide', async () => {
    expect((await call(null, { op: 'bootstrap' })).status).toBe(401);
    expect((await call('jeton.bidon.xyz', { op: 'bootstrap' })).status).toBe(
      401,
    );
  });

  it('refuse les requetes mal formees', async () => {
    const a = await account(`${RUN}a`);
    expect((await call(a.token, null, { raw: '{pas du json' })).status).toBe(
      400,
    );
    expect((await call(a.token, { op: 'sudo' })).status).toBe(400);
    expect(
      (await call(a.token, { op: 'act', action: { type: 'pirate' } })).status,
    ).toBe(422);
    const huge = 'x'.repeat(600 * 1024);
    expect(
      (await call(a.token, null, { raw: JSON.stringify({ op: 'act', huge }) }))
        .status,
    ).toBe(413);
  });

  it('cree la sauvegarde et reprend celle de l invite une seule fois', async () => {
    const p = await account(`${RUN}b`);
    const first = await call(p.token, {
      op: 'bootstrap',
      guest: {
        wallet: { balance: 9e9, lifetimeEarned: 30_000, spent: 0 },
        inventory: { owned: ['magicien'] },
      },
    });
    expect(first.status).toBe(200);
    expect(first.body.imported).toBe(true);
    expect(first.body.state.wallet.lifetimeEarned).toBe(30_000);
    expect(first.body.state.wallet.balance).toBe(31_000);
    expect(first.body.profile.pseudo).toBe(`${RUN}b`);
    const again = await call(p.token, {
      op: 'bootstrap',
      guest: { wallet: { balance: 5, lifetimeEarned: 5, spent: 0 } },
    });
    expect(again.body.imported).toBe(false);
    expect(again.body.state.wallet.balance).toBe(31_000);
  });

  it('credite une vraie victoire et refuse une victoire inventee', async () => {
    const p = await account(`${RUN}c`);
    await call(p.token, { op: 'bootstrap' });
    queue.push(solvable('normal').draw);
    const start = await call(p.token, {
      op: 'act',
      action: {
        type: 'start',
        req: { kind: 'new', mode: 'classic', difficulty: 'normal' },
      },
    });
    expect(start.status).toBe(200);
    const round: Round = start.body.result.round;

    const cheat = await call(p.token, {
      op: 'act',
      action: {
        type: 'finish',
        roundId: round.id,
        reason: 'win',
        log: winLog(round).slice(0, 5),
      },
    });
    expect(cheat.body.result.outcome).toBe('abandon');
    expect(cheat.body.state.wallet.balance).toBe(1000);

    queue.push(solvable('normal').draw);
    const start2 = await call(p.token, {
      op: 'act',
      action: {
        type: 'start',
        req: { kind: 'new', mode: 'classic', difficulty: 'normal' },
      },
    });
    const round2: Round = start2.body.result.round;
    const win = await call(p.token, {
      op: 'act',
      action: {
        type: 'finish',
        roundId: round2.id,
        reason: 'win',
        log: winLog(round2),
      },
    });
    expect(win.body.result.outcome).toBe('win');
    const tip = win.body.result.win.tip;
    expect(tip).toBeGreaterThan(0);
    expect(win.body.state.wallet.balance).toBe(1000 + tip);

    // La sauvegarde est bien sur le serveur.
    const reload = await call(p.token, { op: 'bootstrap' });
    expect(reload.body.state.wallet.balance).toBe(1000 + tip);
    expect(reload.body.state.stats.gamesWon).toBe(1);
  });

  it('garde la banque juste sous des achats simultanes', async () => {
    const p = await account(`${RUN}d`);
    await call(p.token, { op: 'bootstrap' });
    // 1 000 jetons: deux Coups d'oeil (300) passent, le quatrieme non.
    const buys = await Promise.all(
      Array.from({ length: 4 }, () =>
        call(p.token, {
          op: 'act',
          action: { type: 'buyConsumable', id: 'peek' },
        }),
      ),
    );
    const ok = buys.filter((b) => b.status === 200).length;
    const { body } = await call(p.token, { op: 'bootstrap' });
    expect(body.state.inventory.consumables.peek).toBe(ok);
    expect(body.state.wallet.balance).toBe(1000 - 300 * ok);
    expect(ok).toBeLessThanOrEqual(3);
  });

  it('limite le nombre d actions par minute', async () => {
    const p = await account(`${RUN}e`);
    const strict = createHandler({
      url: local!.url,
      serviceKey: local!.service,
      allowedOrigins: [ORIGIN],
      rateLimit: 3,
    });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await strict(
        new Request('http://local/api', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${p.token}`,
          },
          body: JSON.stringify({ op: 'friends' }),
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[4]).toBe(429);
  });

  it('gere les demandes d amis et protege les profils', async () => {
    const a = await account(`${RUN}f`);
    const b = await account(`${RUN}g`);
    const c = await account(`${RUN}h`);
    for (const p of [a, b, c]) await call(p.token, { op: 'bootstrap' });

    expect(
      (await call(a.token, { op: 'friendRequest', pseudo: a.pseudo })).status,
    ).toBe(400);
    expect(
      (await call(a.token, { op: 'friendRequest', pseudo: 'inconnu99' }))
        .status,
    ).toBe(404);

    const req = await call(a.token, {
      op: 'friendRequest',
      pseudo: b.pseudo.toUpperCase(),
    });
    expect(req.body.status).toBe('pending');
    const incoming = await call(b.token, { op: 'friends' });
    expect(
      incoming.body.incoming.map((f: { pseudo: string }) => f.pseudo),
    ).toEqual([a.pseudo]);

    // Avant acceptation: seulement la mini-carte.
    const before = await call(a.token, { op: 'friendCard', pseudo: b.pseudo });
    expect(before.body.friend).toBe(false);
    expect(before.body.card.stats).toBeUndefined();

    await call(b.token, {
      op: 'friendRespond',
      pseudo: a.pseudo,
      accept: true,
    });
    const after = await call(a.token, { op: 'friendCard', pseudo: b.pseudo });
    expect(after.body.friend).toBe(true);
    expect(after.body.card.stats.gamesPlayed).toBe(0);
    // Jamais la banque ni l'inventaire d'un ami.
    expect(JSON.stringify(after.body)).not.toMatch(
      /"balance"|"consumables"|"inventory"|"session"/,
    );

    const stranger = await call(c.token, {
      op: 'friendCard',
      pseudo: b.pseudo,
    });
    expect(stranger.body.card.stats).toBeUndefined();

    const removed = await call(a.token, {
      op: 'friendRemove',
      pseudo: b.pseudo,
    });
    expect(removed.body.friends).toEqual([]);
  });

  it('ne repond qu au site du jeu (CORS)', async () => {
    const p = await account(`${RUN}i`);
    const ok = await call(p.token, { op: 'friends' });
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const evil = await call(
      p.token,
      { op: 'friends' },
      { origin: 'https://evil.example' },
    );
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('supprime un compte seulement avec confirmation, et tout avec', async () => {
    const p = await account(`${RUN}j`);
    await call(p.token, { op: 'bootstrap' });
    expect(
      (await call(p.token, { op: 'deleteAccount', confirm: 'non' })).status,
    ).toBe(400);
    const del = await call(p.token, { op: 'deleteAccount', confirm: p.pseudo });
    expect(del.body.deleted).toBe(true);
    const { data } = await admin
      .from('player_states')
      .select('user_id')
      .eq('user_id', p.id);
    expect(data).toEqual([]);
  });
});
