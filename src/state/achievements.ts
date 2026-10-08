// Hauts faits. Deux sortes:
// - des paliers, calcules a partir de la progression du joueur (victoires,
//   series, records...): chaque famille a de un a quatre paliers, du bronze
//   au diamant, et se debloque toute seule des que le seuil est atteint;
// - des exploits, accordes sur le moment par une partie ou un achat.
// Les identifiants deja utilises par les anciennes versions sont conserves.

import type { PlayerState } from '../core/types';
import { COLLECTIBLES, tierIndex, vipTierFor } from './catalog';

export type Medal = 'bronze' | 'silver' | 'gold' | 'diamond';

export type AchievementCategory =
  'parties' | 'jackpot' | 'regularite' | 'collection' | 'exploits';

export const ACHIEVEMENT_CATEGORIES: {
  id: AchievementCategory;
  label: string;
}[] = [
  { id: 'parties', label: 'Parties' },
  { id: 'jackpot', label: 'Jackpot' },
  { id: 'regularite', label: 'Régularité' },
  { id: 'collection', label: 'Collection' },
  { id: 'exploits', label: 'Exploits' },
];

/** Icones disponibles (traduites en pictogrammes par l'interface). */
export type AchievementIcon =
  | 'trophy'
  | 'cards'
  | 'flame'
  | 'zap'
  | 'star'
  | 'gem'
  | 'dices'
  | 'vault'
  | 'coins'
  | 'calendar'
  | 'crown'
  | 'bag'
  | 'brain'
  | 'snowflake'
  | 'target'
  | 'timer'
  | 'chart'
  | 'hat'
  | 'diamond'
  | 'sparkles';

export interface AchievementTier {
  id: string;
  goal: number;
  title: string;
  medal: Medal;
}

export interface AchievementFamily {
  id: string;
  category: AchievementCategory;
  icon: AchievementIcon;
  label: string;
  /** Valeur actuelle du joueur (null: rien encore). */
  value: (s: PlayerState) => number | null;
  /** Vrai pour un record de temps: plus c'est bas, mieux c'est. */
  lowerIsBetter?: boolean;
  format?: 'number' | 'time' | 'rank';
  describe: (goal: number) => string;
  tiers: AchievementTier[];
}

export interface Exploit {
  id: string;
  icon: AchievementIcon;
  title: string;
  description: string;
  medal: Medal;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  medal: Medal;
  category: AchievementCategory;
  icon: AchievementIcon;
}

const MEDALS: Medal[] = ['bronze', 'silver', 'gold', 'diamond'];

/** Paliers d'une famille: un par objectif, medailles dans l'ordre. */
function tiers(
  entries: [id: string, goal: number, title: string][],
  medals: Medal[] = MEDALS.slice(-entries.length),
): AchievementTier[] {
  return entries.map(([id, goal, title], i) => ({
    id,
    goal,
    title,
    medal: medals[i],
  }));
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

function minutes(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s % 60 === 0) {
    const m = s / 60;
    return `${m} minute${m > 1 ? 's' : ''}`;
  }
  return `${s} secondes`;
}

const RANK_LABELS = ['Bronze', 'Argent', 'Or', 'Platine', 'Diamant'];

export const ACHIEVEMENT_FAMILIES: readonly AchievementFamily[] = [
  // ---- Parties ----
  {
    id: 'wins',
    category: 'parties',
    icon: 'trophy',
    label: 'Victoires',
    value: (s) => s.stats.gamesWon,
    describe: (n) =>
      n === 1 ? 'Gagner sa toute première partie.' : `Gagner ${n} parties.`,
    tiers: tiers([
      ['first-win', 1, 'Première donne'],
      ['wins-25', 25, 'Habitué du tapis'],
      ['wins-100', 100, 'Vieux briscard'],
      ['wins-500', 500, 'Légende du Klondike'],
    ]),
  },
  {
    id: 'played',
    category: 'parties',
    icon: 'cards',
    label: 'Parties jouées',
    value: (s) => s.stats.gamesPlayed,
    describe: (n) => `Jouer ${n} parties.`,
    tiers: tiers([
      ['played-10', 10, 'Premiers pas'],
      ['played-100', 100, 'Pilier de table'],
      ['played-500', 500, 'Insomniaque'],
      ['played-2000', 2000, 'Croupier honoraire'],
    ]),
  },
  {
    id: 'streak',
    category: 'parties',
    icon: 'flame',
    label: 'Séries',
    value: (s) => s.stats.bestWinStreak,
    describe: (n) => `Enchaîner ${n} victoires de suite.`,
    tiers: tiers([
      ['hot-streak', 3, 'Série chaude'],
      ['streak-5', 5, 'Main chaude'],
      ['streak-10', 10, 'Intouchable'],
      ['streak-20', 20, 'Invincible'],
    ]),
  },
  {
    id: 'speed',
    category: 'parties',
    icon: 'zap',
    label: 'Vitesse',
    value: (s) => s.stats.bestTimeMs,
    lowerIsBetter: true,
    format: 'time',
    describe: (ms) => `Gagner une partie en moins de ${minutes(ms)}.`,
    tiers: tiers([
      ['lightning', 180_000, 'Éclair'],
      ['speed-120', 120_000, 'Foudre'],
      ['speed-90', 90_000, 'Supersonique'],
      ['speed-60', 60_000, 'Vitesse lumière'],
    ]),
  },
  {
    id: 'score',
    category: 'parties',
    icon: 'star',
    label: 'Meilleur score',
    value: (s) => s.stats.bestScore,
    describe: (n) => `Marquer ${n} points sur une partie.`,
    tiers: tiers([
      ['score-1000', 1000, 'Joli coup'],
      ['score-1500', 1500, 'Belle main'],
      ['score-2000', 2000, 'Carton plein'],
      ['score-2500', 2500, 'Score de légende'],
    ]),
  },

  // ---- Jackpot ----
  {
    id: 'magot',
    category: 'jackpot',
    icon: 'gem',
    label: 'Magot encaissé',
    value: (s) => s.gambling.bestSecuredRun,
    describe: (n) =>
      `Encaisser un magot de ${n.toLocaleString('fr-FR')} jetons en une fois.`,
    tiers: tiers([
      ['high-roller', 2000, 'Gros bras'],
      ['magot-10k', 10_000, 'Coffre plein'],
      ['magot-50k', 50_000, 'Sac d’or'],
      ['magot-200k', 200_000, 'Casse du siècle'],
    ]),
  },
  {
    id: 'double',
    category: 'jackpot',
    icon: 'dices',
    label: 'Quitte ou double',
    value: (s) => s.gambling.longestStreak,
    describe: (n) => `Gagner ${n} manches d’affilée en quitte ou double.`,
    tiers: tiers([
      ['daredevil', 3, 'Casse-cou'],
      ['double-5', 5, 'Tête brûlée'],
      ['double-8', 8, 'Nerfs d’acier'],
      ['double-12', 12, 'Kamikaze'],
    ]),
  },
  {
    id: 'vault',
    category: 'jackpot',
    icon: 'vault',
    label: 'Coffre-fort',
    value: (s) => s.gambling.vaultsOpened,
    describe: (n) =>
      n === 1
        ? 'Ouvrir le coffre-fort mystère.'
        : `Ouvrir ${n} fois le coffre-fort mystère.`,
    tiers: tiers([
      ['treasure-hunter', 1, 'Chasseur de trésor'],
      ['vault-10', 10, 'Perceur de coffres'],
      ['vault-25', 25, 'Gentleman cambrioleur'],
    ]),
  },
  {
    id: 'progressive',
    category: 'jackpot',
    icon: 'coins',
    label: 'Jackpot progressif',
    value: (s) => s.progressive.wins,
    describe: (n) =>
      n === 1
        ? 'Remporter le jackpot progressif.'
        : `Remporter ${n} fois le jackpot progressif.`,
    tiers: tiers([
      ['progressive-1', 1, 'Jackpot !'],
      ['progressive-5', 5, 'Machine à sous'],
    ]),
  },

  // ---- Regularite ----
  {
    id: 'daily',
    category: 'regularite',
    icon: 'calendar',
    label: 'Défis du jour',
    value: (s) => s.daily.completedDates.length,
    describe: (n) =>
      `Réussir ${n} ${plural(n, 'défi du jour', 'défis du jour')}.`,
    tiers: tiers([
      ['daily-1', 1, 'Au rendez-vous'],
      ['faithful', 10, 'Fidèle'],
      ['daily-30', 30, 'Un mois de défis'],
      ['daily-100', 100, 'Centurion'],
    ]),
  },
  {
    id: 'rank',
    category: 'regularite',
    icon: 'crown',
    label: 'Rang VIP',
    value: (s) => tierIndex(vipTierFor(s.wallet.lifetimeEarned).id),
    format: 'rank',
    describe: (n) => `Atteindre le rang VIP ${RANK_LABELS[n]}.`,
    tiers: tiers([
      ['rank-silver', 1, 'Membre Argent'],
      ['regular', 2, 'Habitué du salon'],
      ['rank-platinum', 3, 'Membre Platine'],
      ['rank-diamond', 4, 'Membre Diamant'],
    ]),
  },

  // ---- Collection ----
  {
    id: 'collection',
    category: 'collection',
    icon: 'bag',
    label: 'Collection',
    value: (s) => {
      const owned = new Set(s.inventory.owned);
      return COLLECTIBLES.filter((c) => owned.has(c.id)).length;
    },
    describe: (n) =>
      n === 1
        ? 'Acheter un premier objet en boutique.'
        : n >= COLLECTIBLES.length
          ? 'Posséder absolument tout ce que vend la boutique.'
          : `Posséder ${n} objets de la boutique.`,
    tiers: tiers([
      ['collector', 1, 'Client fidèle'],
      ['collection-10', 10, 'Collectionneur'],
      ['collection-30', 30, 'Amateur éclairé'],
      ['completionist', COLLECTIBLES.length, 'Collection complète'],
    ]),
  },
];

export const EXPLOITS: readonly Exploit[] = [
  {
    id: 'clear-mind',
    icon: 'snowflake',
    title: 'Tête froide',
    description: 'Gagner une partie sans demander le moindre indice.',
    medal: 'bronze',
  },
  {
    id: 'expert-win',
    icon: 'target',
    title: 'Expert',
    description: 'Gagner une partie en difficulté Expert.',
    medal: 'silver',
  },
  {
    id: 'chrono-win',
    icon: 'timer',
    title: 'Contre la montre',
    description: 'Gagner une partie de Chrono.',
    medal: 'silver',
  },
  {
    id: 'vegas-profit',
    icon: 'chart',
    title: 'Rentable',
    description: 'Terminer une partie de Vegas avec un bénéfice.',
    medal: 'silver',
  },
  {
    id: 'strategist',
    icon: 'brain',
    title: 'Stratège',
    description: 'Gagner en pioche par 3 sans coup invalide ni annuler.',
    medal: 'gold',
  },
  {
    id: 'perfect',
    icon: 'sparkles',
    title: 'Partie parfaite',
    description:
      'Gagner sans indice, sans annuler, sans joker et sans coup invalide.',
    medal: 'gold',
  },
  {
    id: 'bets-hat-trick',
    icon: 'hat',
    title: 'Coup du chapeau',
    description: 'Gagner les trois paris annexes sur une même manche.',
    medal: 'gold',
  },
  {
    id: 'high-stakes',
    icon: 'diamond',
    title: 'Carré VIP',
    description: 'Gagner une manche à la table Diamant.',
    medal: 'gold',
  },
  {
    id: 'grail',
    icon: 'trophy',
    title: 'Le Graal',
    description: 'S’offrir une pièce maîtresse de la boutique.',
    medal: 'diamond',
  },
];

/** Tous les hauts faits, a plat: un par palier, plus les exploits. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  ...ACHIEVEMENT_FAMILIES.flatMap((f) =>
    f.tiers.map((t) => ({
      id: t.id,
      title: t.title,
      description: f.describe(t.goal),
      medal: t.medal,
      category: f.category,
      icon: f.icon,
    })),
  ),
  ...EXPLOITS.map((e) => ({ ...e, category: 'exploits' as const })),
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Vrai si la valeur atteint l'objectif du palier. */
export function reaches(
  family: AchievementFamily,
  value: number | null,
  goal: number,
): boolean {
  if (value === null) return false;
  return family.lowerIsBetter ? value > 0 && value < goal : value >= goal;
}

/** Paliers atteints par l'etat du joueur. */
export function progressAchievements(s: PlayerState): string[] {
  const ids: string[] = [];
  for (const family of ACHIEVEMENT_FAMILIES) {
    const value = family.value(s);
    for (const tier of family.tiers) {
      if (reaches(family, value, tier.goal)) ids.push(tier.id);
    }
  }
  return ids;
}

/** Ce qui s'est passe sur une partie gagnee, pour les exploits. */
export interface WinFacts {
  drawCount: 1 | 3;
  difficulty: string;
  mode: string;
  invalidMoves: number;
  undoCount: number;
  usedHint: boolean;
  usedJoker: boolean;
  betsWon: number;
  vegasNet: number | null;
}

/** Exploits obtenus par une partie gagnee. */
export function winExploits(f: WinFacts): string[] {
  const ids: string[] = [];
  const clean = f.invalidMoves === 0 && f.undoCount === 0;
  if (!f.usedHint) ids.push('clear-mind');
  if (f.drawCount === 3 && clean) ids.push('strategist');
  if (clean && !f.usedHint && !f.usedJoker) ids.push('perfect');
  if (f.difficulty === 'expert') ids.push('expert-win');
  if (f.mode === 'chrono') ids.push('chrono-win');
  if (f.vegasNet !== null && f.vegasNet > 0) ids.push('vegas-profit');
  if (f.betsWon >= 3) ids.push('bets-hat-trick');
  return ids;
}
