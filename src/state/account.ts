// Comptes joueurs: connexion par pseudo et mot de passe (Supabase Auth), et
// appels a la fonction serveur "api" qui fait foi pour tout ce qui touche
// aux jetons.
//
// Le compte est facultatif: sans configuration Supabase (variables
// VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY), le jeu reste en mode
// invite, comme avant.

import { create } from 'zustand';
import {
  createClient,
  FunctionsHttpError,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { PlayerState, PublicCard, MiniCard } from '../core';
import { useMetaStore } from './meta';

/** Domaine technique des identifiants: reserve, aucun mail n'y part jamais. */
const LOGIN_DOMAIN = 'joueurs.jackpot-solitaire.invalid';

export const PSEUDO_RULE = /^[A-Za-z0-9_-]{3,16}$/;
export const PASSWORD_MIN = 10;

export function pseudoToLogin(pseudo: string): string {
  return `${pseudo.trim().toLowerCase()}@${LOGIN_DOMAIN}`;
}

/** Ce qui ne va pas dans un pseudo, ou null s'il est valable. */
export function pseudoProblem(pseudo: string): string | null {
  const p = pseudo.trim();
  if (p.length < 3) return 'Au moins 3 caractères.';
  if (p.length > 16) return '16 caractères au maximum.';
  if (!PSEUDO_RULE.test(p)) {
    return 'Lettres sans accent, chiffres, tiret et tiret bas uniquement.';
  }
  return null;
}

/** Robustesse d'un mot de passe, de 0 (faible) a 4 (excellent). */
export function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

/** Ce qui manque a un mot de passe, ou null s'il est acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Au moins ${PASSWORD_MIN} caractères.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Mélange des lettres et des chiffres.';
  }
  return null;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Les comptes ne sont proposes que si le serveur est configure. */
export const accountsEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!accountsEnabled) throw new AccountError('Comptes indisponibles.');
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'jackpot-solitaire-session',
      },
    });
  }
  return client;
}

export class AccountError extends Error {
  constructor(
    message: string,
    public code = 'account',
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

/** Traduit une erreur d'authentification en message clair. */
function authMessage(error: {
  message?: string;
  code?: string;
  status?: number;
}): string {
  const m = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (m.includes('invalid_credentials') || m.includes('invalid login')) {
    return 'Pseudo ou mot de passe incorrect.';
  }
  if (m.includes('already registered') || m.includes('user_already_exists')) {
    return 'Ce pseudo est déjà pris.';
  }
  if (m.includes('pseudo_reserve')) return 'Ce pseudo est réservé à la maison.';
  if (m.includes('pseudo_invalide') || m.includes('pseudo_incoherent')) {
    return 'Ce pseudo n’est pas valable.';
  }
  if (m.includes('weak_password') || m.includes('password should')) {
    return `Mot de passe trop faible: au moins ${PASSWORD_MIN} caractères, lettres et chiffres.`;
  }
  if (m.includes('rate') || error.status === 429) {
    return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'Impossible de joindre le serveur. Vérifie ta connexion.';
  }
  return 'La connexion a échoué. Réessaie dans un instant.';
}

export type AccountStatus = 'disabled' | 'guest' | 'loading' | 'online';

interface AccountStore {
  status: AccountStatus;
  pseudo: string | null;
  createdAt: string | null;
  /** Vrai si la sauvegarde d'invite a ete reprise a la creation du compte. */
  imported: boolean;
  /** Demandes d'amis recues, en attente de reponse. */
  incoming: number;
}

export const useAccountStore = create<AccountStore>(() => ({
  status: accountsEnabled ? 'loading' : 'disabled',
  pseudo: null,
  createdAt: null,
  imported: false,
  incoming: 0,
}));

async function currentSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

/** Appel a la fonction serveur, avec la session en cours. */
export async function api<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('api', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let message = 'Le croupier a eu un souci, réessaie.';
      let code = 'server';
      try {
        const payload = await error.context.json();
        message = payload.message ?? message;
        code = payload.error ?? code;
      } catch {
        // Corps illisible: message generique.
      }
      if (code === 'auth') await forgetSession();
      throw new AccountError(message, code);
    }
    throw new AccountError(
      'Impossible de joindre le serveur. Vérifie ta connexion.',
      'network',
    );
  }
  return data as T;
}

interface Bootstrap {
  state: PlayerState;
  imported: boolean;
  profile: { pseudo: string; createdAt: string };
}

async function bootstrap(guest?: PlayerState): Promise<void> {
  const out = await api<Bootstrap>({ op: 'bootstrap', guest: guest ?? null });
  useMetaStore.getState().enterAccount(out.state);
  useAccountStore.setState({
    status: 'online',
    pseudo: out.profile.pseudo,
    createdAt: out.profile.createdAt,
    imported: out.imported,
  });
  // Les demandes d'amis en attente s'affichent sur l'accueil.
  void friendsApi
    .list()
    .then((lists) =>
      useAccountStore.setState({ incoming: lists.incoming.length }),
    )
    .catch(() => undefined);
}

async function forgetSession(): Promise<void> {
  try {
    await supabase().auth.signOut({ scope: 'local' });
  } catch {
    // Deja deconnecte.
  }
  useMetaStore.getState().leaveAccount();
  useAccountStore.setState({ status: 'guest', pseudo: null, createdAt: null });
}

/** Au demarrage: reprend la session enregistree, s'il y en a une. */
export async function restoreSession(): Promise<void> {
  if (!accountsEnabled) return;
  try {
    const session = await currentSession();
    if (!session) {
      useAccountStore.setState({ status: 'guest' });
      return;
    }
    await bootstrap();
  } catch {
    // Hors ligne ou session expiree: on joue en invite.
    useMetaStore.getState().leaveAccount();
    useAccountStore.setState({ status: 'guest' });
  }
}

/**
 * Cree un compte. La progression d'invite de cet appareil y est reprise
 * (une seule fois, a la creation).
 */
export async function signUp(pseudo: string, password: string): Promise<void> {
  const problem = pseudoProblem(pseudo) ?? passwordProblem(password);
  if (problem) throw new AccountError(problem);
  const { error } = await supabase().auth.signUp({
    email: pseudoToLogin(pseudo),
    password,
    options: { data: { pseudo: pseudo.trim() } },
  });
  if (error) throw new AccountError(authMessage(error));
  await bootstrap(useMetaStore.getState().player());
}

export async function signIn(pseudo: string, password: string): Promise<void> {
  if (pseudoProblem(pseudo)) {
    throw new AccountError('Pseudo ou mot de passe incorrect.');
  }
  const { error } = await supabase().auth.signInWithPassword({
    email: pseudoToLogin(pseudo),
    password,
  });
  if (error) throw new AccountError(authMessage(error));
  await bootstrap();
}

export async function signOut(): Promise<void> {
  try {
    await supabase().auth.signOut();
  } finally {
    useMetaStore.getState().leaveAccount();
    useAccountStore.setState({
      status: 'guest',
      pseudo: null,
      createdAt: null,
    });
  }
}

export async function changePassword(
  current: string,
  next: string,
): Promise<void> {
  const pseudo = useAccountStore.getState().pseudo;
  if (!pseudo) throw new AccountError('Connexion requise.');
  const problem = passwordProblem(next);
  if (problem) throw new AccountError(problem);
  // On redemande l'ancien mot de passe: une session laissee ouverte ne doit
  // pas suffire a changer d'identifiants.
  const check = await supabase().auth.signInWithPassword({
    email: pseudoToLogin(pseudo),
    password: current,
  });
  if (check.error) throw new AccountError('Mot de passe actuel incorrect.');
  const { error } = await supabase().auth.updateUser({ password: next });
  if (error) throw new AccountError(authMessage(error));
}

export async function deleteAccount(confirm: string): Promise<void> {
  await api({ op: 'deleteAccount', confirm });
  await forgetSession();
}

// ---------------------------------------------------------------------------
// Amis
// ---------------------------------------------------------------------------

export interface FriendLists {
  friends: MiniCard[];
  incoming: MiniCard[];
  outgoing: MiniCard[];
}

export interface FriendCardResponse {
  card: PublicCard | MiniCard;
  friend: boolean;
  self: boolean;
  pending?: 'incoming' | 'outgoing' | null;
}

export const friendsApi = {
  list: () => api<FriendLists>({ op: 'friends' }),
  request: (pseudo: string) =>
    api<{ status: 'pending' | 'friends' }>({ op: 'friendRequest', pseudo }),
  respond: (pseudo: string, accept: boolean) =>
    api<FriendLists>({ op: 'friendRespond', pseudo, accept }),
  remove: (pseudo: string) => api<FriendLists>({ op: 'friendRemove', pseudo }),
  card: (pseudo: string) =>
    api<FriendCardResponse>({ op: 'friendCard', pseudo }),
};

/** Vrai si la carte recue est la carte complete (ami ou soi-meme). */
export function isFullCard(card: PublicCard | MiniCard): card is PublicCard {
  return 'stats' in card;
}
