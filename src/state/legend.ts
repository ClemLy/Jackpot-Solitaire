// Rang Legendaire: ce qui vient apres le Diamant. On y accede avec un million
// de jetons gagnes ET une manche remportee a la Table Legende. La, tout
// recommence: des niveaux sans fin (Legendaire I, II, III...), une seconde
// monnaie (les jetons noirs) et une boutique a part. Module pur, partage par
// le navigateur et le serveur.

import {
  vipTierFor,
  type DifficultyId,
  type StakeTableId,
  type VipTierId,
} from './catalog';
import { formatNumber } from '../utils/format';

/** Jetons gagnes depuis le debut pour pretendre au rang Legendaire. */
export const LEGEND_THRESHOLD = 1_000_000;

/** La table qu'il faut avoir vaincue au moins une fois. */
export const LEGEND_TABLE: StakeTableId = 'legend';

/** Jetons noirs offerts le jour de l'accession. */
export const ASCENSION_GIFT = 25;

/** Prix d'un jeton noir au bureau de change, en jetons de la banque. */
export const EXCHANGE_RATE = 50_000;

/** Lots proposes au bureau de change. */
export const EXCHANGE_PACKS = [1, 5, 20] as const;

/** Etat Legendaire du joueur (niveau 0: pas encore Legendaire). */
export interface LegendState {
  /** Manches gagnees a la Table Legende (la condition d'acces). */
  tableWins: number;
  level: number;
  /** Jetons gagnes au moment de l'accession: le renom se compte a partir de la. */
  base: number;
  ascendedAt: number | null;
  /** Jetons noirs: solde, cumul gagne et depense. */
  black: number;
  blackEarned: number;
  blackSpent: number;
}

export function emptyLegend(): LegendState {
  return {
    tableWins: 0,
    level: 0,
    base: 0,
    ascendedAt: null,
    black: 0,
    blackEarned: 0,
    blackSpent: 0,
  };
}

/** Vrai si les deux conditions d'acces sont reunies. */
export function canAscend(lifetimeEarned: number, tableWins: number): boolean {
  return lifetimeEarned >= LEGEND_THRESHOLD && tableWins > 0;
}

// ---------------------------------------------------------------------------
// Niveaux: le renom (jetons gagnes depuis l'accession) fait monter le niveau.
// Chaque niveau demande 100 000 jetons de plus que le precedent.
// ---------------------------------------------------------------------------

/** Renom a gagner pour passer du niveau `level` au suivant. */
export function legendStep(level: number): number {
  return 200_000 + 100_000 * (level - 1);
}

/** Renom cumule pour atteindre le niveau `level` (0 pour le niveau I). */
export function legendFloor(level: number): number {
  const n = Math.max(0, level - 1);
  return 200_000 * n + 50_000 * n * (n - 1);
}

/** Niveau atteint pour un renom donne (au moins I). */
export function legendLevelFor(renown: number): number {
  // Inverse de legendFloor, puis ajustement contre les arrondis.
  const r = Math.max(0, renown);
  const n = Math.floor(
    (-150_000 + Math.sqrt(150_000 ** 2 + 200_000 * r)) / 100_000,
  );
  let level = Math.max(1, n + 1);
  while (legendFloor(level + 1) <= renown) level += 1;
  while (level > 1 && legendFloor(level) > renown) level -= 1;
  return level;
}

/** Renom accumule, et progression (0 a 1) vers le niveau suivant. */
export function legendProgress(
  lifetimeEarned: number,
  legend: Pick<LegendState, 'level' | 'base'>,
): { renown: number; into: number; step: number; progress: number } {
  const renown = Math.max(0, lifetimeEarned - legend.base);
  const level = Math.max(1, legend.level);
  const into = Math.max(0, renown - legendFloor(level));
  const step = legendStep(level);
  return { renown, into, step, progress: Math.min(1, into / step) };
}

/** Remet un etat Legendaire d'aplomb (sauvegarde abimee ou plafonnee). */
export function normalizeLegend(
  legend: LegendState,
  lifetimeEarned: number,
): LegendState {
  if (legend.level <= 0 || !canAscend(lifetimeEarned, legend.tableWins)) {
    return { ...legend, level: 0, base: 0, ascendedAt: null };
  }
  const base = Math.min(legend.base, lifetimeEarned);
  const level = Math.min(legend.level, legendLevelFor(lifetimeEarned - base));
  return { ...legend, base, level: Math.max(1, level) };
}

// ---------------------------------------------------------------------------
// Jetons noirs: chaque gain est multiplie par le taux du niveau (+10 % par
// niveau, sans plafond).
// ---------------------------------------------------------------------------

export function blackRate(level: number): number {
  return 1 + 0.1 * Math.max(0, level - 1);
}

/** Jetons noirs reellement verses pour un gain de base, au niveau donne. */
export function blackFor(base: number, level: number): number {
  if (level < 1 || !(base > 0)) return 0;
  return Math.round(base * blackRate(level));
}

/** Jetons noirs de base pour une victoire, selon la difficulte. */
export const BLACK_PER_WIN: Record<DifficultyId, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
  expert: 5,
};

/** Bonus de base pour une victoire a une table haute. */
export const BLACK_PER_TABLE: Partial<Record<StakeTableId, number>> = {
  legend: 2,
  noire: 5,
};

/** Bonus de base: premiere victoire du defi du jour. */
export const BLACK_DAILY = 5;
/** Bonus de base: jackpot progressif remporte. */
export const BLACK_PROGRESSIVE = 40;
/** Bonus de base: gros lot x10 au coffre-fort. */
export const BLACK_VAULT_JACKPOT = 10;
/** Un jeton noir de base par tranche de magot encaisse. */
export const BLACK_CASH_SLICE = 50_000;
/** Jetons noirs de base a chaque tour de roue (a partir du niveau V). */
export const BLACK_WHEEL = 3;

/** Prime versee en atteignant un niveau (a partir du niveau II). */
export function levelReward(level: number): number {
  return 10 + 5 * level;
}

/** Jetons noirs du coffret de la semaine (a partir du niveau II). */
export function weeklyBlack(level: number): number {
  return level >= 2 ? 10 + 5 * (level - 1) : 0;
}

// ---------------------------------------------------------------------------
// Avantages debloques sur la voie Legendaire (hors objets de la boutique).
// ---------------------------------------------------------------------------

export type LegendPerkId =
  'black' | 'shop' | 'exchange' | 'gift' | 'table' | 'wheel';

export interface LegendPerk {
  id: LegendPerkId;
  level: number;
  label: string;
  detail: string;
}

export const LEGEND_PERKS: readonly LegendPerk[] = [
  {
    id: 'black',
    level: 1,
    label: 'Jetons noirs',
    detail: 'Chaque victoire, chaque magot encaissé en rapporte.',
  },
  {
    id: 'shop',
    level: 1,
    label: 'Boutique Légendaire',
    detail: 'Des objets introuvables ailleurs, payés en jetons noirs.',
  },
  {
    id: 'exchange',
    level: 1,
    label: 'Bureau de change',
    detail: `Un jeton noir pour ${formatNumber(EXCHANGE_RATE)} jetons de la banque.`,
  },
  {
    id: 'gift',
    level: 2,
    label: 'Coffret noir',
    detail: 'Le coffret de la semaine contient des jetons noirs.',
  },
  {
    id: 'table',
    level: 3,
    label: 'Table Noire',
    detail: 'Mise de 200 000, gains ×8 et jetons noirs en prime.',
  },
  {
    id: 'wheel',
    level: 5,
    label: 'Roue noire',
    detail: 'Chaque tour de roue rapporte aussi des jetons noirs.',
  },
];

export function hasPerk(level: number, id: LegendPerkId): boolean {
  const perk = LEGEND_PERKS.find((p) => p.id === id);
  return !!perk && level >= perk.level;
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Chiffres romains (au-dela de 3999, on garde les chiffres arabes). */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  let out = '';
  let rest = n;
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

export function legendLabel(level: number): string {
  return `Légendaire ${roman(Math.max(1, level))}`;
}

/**
 * Eclat de l'embleme selon le niveau: plus on monte, plus il s'orne.
 * 1: niveaux I a IV, 2: V a IX, 3: X a XXIV, 4: XXV et au-dela.
 */
export function legendAura(level: number): 1 | 2 | 3 | 4 {
  if (level >= 25) return 4;
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

/** Rang affiche: un rang VIP, ou Legendaire avec son niveau. */
export type RankId = VipTierId | 'legend';

export interface DisplayRank {
  id: RankId;
  label: string;
  /** Niveau Legendaire (0 pour un rang VIP). */
  level: number;
}

export function displayRank(
  lifetimeEarned: number,
  legendLevel: number,
): DisplayRank {
  if (legendLevel >= 1) {
    return {
      id: 'legend',
      label: legendLabel(legendLevel),
      level: legendLevel,
    };
  }
  const tier = vipTierFor(lifetimeEarned);
  return { id: tier.id, label: tier.label, level: 0 };
}
