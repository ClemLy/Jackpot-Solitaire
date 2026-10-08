// Coeur du jeu: tout ce qui touche aux jetons, a la progression et aux
// recompenses. Ces fonctions sont pures: le meme code tourne dans le
// navigateur (joueur invite) et sur le serveur (joueur connecte), ou il fait
// foi. Le serveur rejoue chaque manche a partir de sa graine et du journal
// des actions: impossible d'y gonfler une victoire ou une banque.

import type { EndBonuses, Move } from '../engine';
import type {
  ConsumableId,
  DifficultyId,
  SideBetId,
  StakeTableId,
} from '../state/catalog';
import type { PeriodProgress } from '../state/missions';

export type GameMode =
  'classic' | 'gambling' | 'zen' | 'chrono' | 'daily' | 'vegas';

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentWinStreak: number;
  bestWinStreak: number;
  bestTimeMs: number | null;
  bestScore: number;
  sumWinTimeMs: number;
  sumWinMoves: number;
}

export interface GamblingRecords {
  secured: number;
  bestSecuredRun: number;
  longestStreak: number;
  vaultsOpened: number;
}

export interface DailyProgress {
  completedDates: string[];
  lastPlayed: string | null;
}

/** La banque de jetons: ce qu'on peut depenser, et le cumul gagne (rang VIP). */
export interface Wallet {
  balance: number;
  lifetimeEarned: number;
  spent: number;
}

export interface Inventory {
  /** Cosmetiques achetes (les objets gratuits ne sont pas listes). */
  owned: string[];
  consumables: Record<ConsumableId, number>;
}

export interface WheelState {
  lastSpin: string | null;
}

/** Cagnotte du jackpot progressif. */
export interface ProgressiveState {
  pot: number;
  wins: number;
}

export interface MissionsState {
  daily: PeriodProgress;
  weekly: PeriodProgress;
}

export interface PerksState {
  /** Semaine (cle ISO) du dernier coffret de rang recupere. */
  lastGift: string | null;
}

/** Objets equipes: dos, recto, tapis, effet, titre et profil. */
export interface Equipped {
  cardBack: string;
  cardFace: string;
  table: string;
  victoryFx: string;
  title: string;
  avatar: string;
  frame: string;
  profileCard: string;
}

export type EquipSlot = keyof Equipped;

/** Une manche distribuee et pas encore terminee. */
export interface Round {
  id: string;
  mode: GameMode;
  difficulty: DifficultyId;
  seed: string;
  /** D'ou vient la graine: une graine imposee ne rapporte rien. */
  seedSource: 'random' | 'daily' | 'custom' | 'guaranteed' | 'tutorial';
  drawCount: 1 | 3;
  gentle: boolean;
  recycles?: number;
  table: StakeTableId;
  /** Instant de la donne (ms): le temps de jeu se mesure a partir de la. */
  startedAt: number;
  /** Mise de Vegas payee pour cette donne. */
  vegasStake: number;
  /** Mise d'un pari annexe pour cette manche. */
  sideBetStake: number;
}

/** Ce qui se passe entre deux manches, cote Jackpot. */
export interface Session {
  round: Round | null;
  pot: number;
  combo: number;
  table: StakeTableId;
  insured: boolean;
  /**
   * 'decision': manche Jackpot gagnee, encaisser ou rejouer.
   * 'lost': manche Jackpot perdue, magot en suspens (seconde chance).
   */
  awaiting: 'none' | 'decision' | 'lost';
  vaultEligible: boolean;
  vaultResult: { multiplier: number; trapped: boolean } | null;
  /** Derniere victoire notee hors Jackpot: peut devenir une mise. */
  lastScoredWin: { score: number; difficulty: DifficultyId } | null;
  /**
   * Prefixe impose aux graines des donnes garanties: le joueur cherche
   * `${nonce}-k` gagnable, sans pouvoir rejouer une donne qu'il connait.
   */
  nonce: string;
}

export interface PlayerState {
  wallet: Wallet;
  inventory: Inventory;
  stats: Stats;
  gambling: GamblingRecords;
  daily: DailyProgress;
  achievements: Record<string, number>;
  wheel: WheelState;
  progressive: ProgressiveState;
  missions: MissionsState;
  perks: PerksState;
  equipped: Equipped;
  session: Session;
}

/** Une action du joueur pendant la manche, rejouee par le serveur. */
export type LogEntry =
  | { t: 'move'; move: Move; wild?: boolean }
  | { t: 'undo' }
  | { t: 'hint' }
  | { t: 'invalid' }
  | { t: 'peek'; card: string }
  | { t: 'reshuffle' }
  | { t: 'bet'; id: SideBetId };

export type EndReason = 'win' | 'deadlock' | 'time' | 'abandon';

/** Resultat d'un pari annexe, a la fin de la manche. */
export interface BetResult {
  id: SideBetId;
  stake: number;
  won: boolean;
  /** Jetons rendus a la banque (mise comprise), 0 si perdu. */
  payout: number;
}

/** Bilan d'une partie de Vegas. */
export interface VegasSummary {
  stake: number;
  cards: number;
  cardValue: number;
  earned: number;
  net: number;
}

export interface WinSummary {
  roundScore: number;
  bonuses: EndBonuses;
  baseScore: number;
  /** Multiplicateur de serie (quitte ou double). */
  multiplier: number;
  /** Multiplicateur de la table a mise. */
  tableMultiplier: number;
  /** Multiplicateur du niveau de difficulte. */
  difficultyMultiplier: number;
  /** Multiplicateur de la donne garantie (1 si donne au hasard). */
  guaranteedMultiplier: number;
  gain: number;
  potBefore: number;
  potAfter: number;
  vaultEligible: boolean;
  /** Jetons verses directement a la banque (hors Jackpot). */
  tip: number;
  dailyBonus: number;
  moves: number;
  timeMs: number;
  bets: BetResult[];
  /** Jackpot progressif remporte sur cette manche (0 sinon). */
  progressive: number;
  vegas: VegasSummary | null;
  /** Partie sur graine imposee: rien n'est verse. */
  unpaid: boolean;
}

export interface LostSummary {
  reason: 'deadlock' | 'time';
  finalScore: number;
  timeMs: number;
  wasGambling: boolean;
  potLost: number;
  /** Jetons rendus par l'assurance si la perte est confirmee. */
  refund: number;
  /** Mises des paris annexes perdues avec la manche. */
  betsLost: number;
  vegas: VegasSummary | null;
}

/** Message a montrer au joueur apres une action (haut fait, promotion...). */
export interface Notice {
  kind: 'achievement' | 'vip' | 'reward' | 'error';
  title: string;
  text: string;
}

/** Contexte fourni par l'appelant: horloge, calendrier et hasard. */
export interface Ctx {
  now: number;
  /** Jour courant (AAAA-MM-JJ) dans le fuseau du jeu. */
  today: string;
  /** Semaine ISO courante (AAAA-Snn). */
  week: string;
  random: () => number;
}

/** Refus d'une action: le message est montrable au joueur. */
export class CoreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CoreError';
  }
}

export interface Outcome<T = unknown> {
  state: PlayerState;
  notices: Notice[];
  result: T;
}
