// Missions quotidiennes et hebdomadaires.
//
// Chaque periode tire ses missions de facon deterministe a partir de la date:
// tout le monde a les memes le meme jour, et recharger la page ne les change
// pas. La progression avance sur des evenements de jeu (partie terminee,
// magot encaisse, coffre ouvert...) et la recompense se recupere a la main.

import { createRng, shuffle } from '../engine';
import type { DifficultyId } from './catalog';
import { findDifficulty } from './catalog';

export type MissionScope = 'daily' | 'weekly';

/** Ce qui fait avancer les missions. */
export type MissionEvent =
  | {
      kind: 'game';
      won: boolean;
      mode: string;
      difficulty: DifficultyId;
      timeMs: number;
      undoCount: number;
      usedHint: boolean;
      /** Cartes posees sur les fondations a la fin de la partie. */
      foundationCards: number;
      /** Bilan en jetons d'une partie de Vegas (gains moins la mise). */
      vegasNet?: number;
    }
  | { kind: 'secure'; amount: number }
  | { kind: 'streak'; length: number }
  | { kind: 'vault' }
  | { kind: 'wheel' };

type GameEvent = Extract<MissionEvent, { kind: 'game' }>;

export interface MissionDef {
  id: string;
  scope: MissionScope;
  label: string;
  target: number;
  reward: number;
  /**
   * 'sum': chaque evenement ajoute sa valeur. 'max': on garde le meilleur
   * (pour les series).
   */
  mode?: 'sum' | 'max';
  measure: (event: MissionEvent) => number;
}

const won = (e: MissionEvent): e is GameEvent => e.kind === 'game' && e.won;
const isHard = (d: DifficultyId) => findDifficulty(d).drawCount === 3;

export const MISSIONS: readonly MissionDef[] = [
  // Quotidiennes.
  {
    id: 'd-win-2',
    scope: 'daily',
    label: 'Gagne 2 parties',
    target: 2,
    reward: 200,
    measure: (e) => (won(e) ? 1 : 0),
  },
  {
    id: 'd-classic',
    scope: 'daily',
    label: 'Gagne une partie en Classique',
    target: 1,
    reward: 150,
    measure: (e) => (won(e) && e.mode === 'classic' ? 1 : 0),
  },
  {
    id: 'd-chrono',
    scope: 'daily',
    label: 'Gagne une partie en Chrono',
    target: 1,
    reward: 250,
    measure: (e) => (won(e) && e.mode === 'chrono' ? 1 : 0),
  },
  {
    id: 'd-hard',
    scope: 'daily',
    label: 'Gagne une partie en Difficile ou Expert',
    target: 1,
    reward: 300,
    measure: (e) => (won(e) && isHard(e.difficulty) ? 1 : 0),
  },
  {
    id: 'd-cards',
    scope: 'daily',
    label: 'Range 80 cartes sur les fondations',
    target: 80,
    reward: 200,
    measure: (e) => (e.kind === 'game' ? e.foundationCards : 0),
  },
  {
    id: 'd-no-undo',
    scope: 'daily',
    label: 'Gagne une partie sans annuler',
    target: 1,
    reward: 200,
    measure: (e) => (won(e) && e.undoCount === 0 ? 1 : 0),
  },
  {
    id: 'd-no-hint',
    scope: 'daily',
    label: 'Gagne une partie sans indice',
    target: 1,
    reward: 200,
    measure: (e) => (won(e) && !e.usedHint ? 1 : 0),
  },
  {
    id: 'd-secure',
    scope: 'daily',
    label: 'Encaisse 1 000 jetons au Jackpot',
    target: 1000,
    reward: 250,
    measure: (e) => (e.kind === 'secure' ? e.amount : 0),
  },
  {
    id: 'd-vegas',
    scope: 'daily',
    label: 'Range 30 cartes à Vegas',
    target: 30,
    reward: 200,
    measure: (e) =>
      e.kind === 'game' && e.mode === 'vegas' ? e.foundationCards : 0,
  },
  {
    id: 'd-daily',
    scope: 'daily',
    label: 'Termine le défi du jour',
    target: 1,
    reward: 250,
    measure: (e) => (won(e) && e.mode === 'daily' ? 1 : 0),
  },
  {
    id: 'd-wheel',
    scope: 'daily',
    label: 'Tourne la roue du jour',
    target: 1,
    reward: 100,
    measure: (e) => (e.kind === 'wheel' ? 1 : 0),
  },

  // Hebdomadaires.
  {
    id: 'w-win-12',
    scope: 'weekly',
    label: 'Gagne 12 parties',
    target: 12,
    reward: 1500,
    measure: (e) => (won(e) ? 1 : 0),
  },
  {
    id: 'w-streak',
    scope: 'weekly',
    label: 'Enchaîne 3 victoires dans une série Jackpot',
    target: 3,
    reward: 2000,
    mode: 'max',
    measure: (e) => (e.kind === 'streak' ? e.length : 0),
  },
  {
    id: 'w-secure',
    scope: 'weekly',
    label: 'Encaisse 10 000 jetons au Jackpot',
    target: 10_000,
    reward: 2000,
    measure: (e) => (e.kind === 'secure' ? e.amount : 0),
  },
  {
    id: 'w-cards',
    scope: 'weekly',
    label: 'Range 500 cartes sur les fondations',
    target: 500,
    reward: 1500,
    measure: (e) => (e.kind === 'game' ? e.foundationCards : 0),
  },
  {
    id: 'w-expert',
    scope: 'weekly',
    label: 'Gagne 2 parties en Expert',
    target: 2,
    reward: 2500,
    measure: (e) => (won(e) && e.difficulty === 'expert' ? 1 : 0),
  },
  {
    id: 'w-vault',
    scope: 'weekly',
    label: 'Ouvre le coffre-fort',
    target: 1,
    reward: 1500,
    measure: (e) => (e.kind === 'vault' ? 1 : 0),
  },
  {
    id: 'w-chrono',
    scope: 'weekly',
    label: 'Gagne 3 parties en Chrono',
    target: 3,
    reward: 1500,
    measure: (e) => (won(e) && e.mode === 'chrono' ? 1 : 0),
  },
  {
    id: 'w-vegas',
    scope: 'weekly',
    label: 'Termine 3 parties de Vegas avec un bilan positif',
    target: 3,
    reward: 1500,
    measure: (e) =>
      e.kind === 'game' && e.mode === 'vegas' && (e.vegasNet ?? 0) > 0 ? 1 : 0,
  },
  {
    id: 'w-daily',
    scope: 'weekly',
    label: 'Réussis 4 défis du jour',
    target: 4,
    reward: 2000,
    measure: (e) => (won(e) && e.mode === 'daily' ? 1 : 0),
  },
];

/** Nombre de missions actives par periode. */
export const MISSIONS_PER_PERIOD = 3;

const BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

export function findMission(id: string): MissionDef | undefined {
  return BY_ID.get(id);
}

/** Cle de la periode courante: AAAA-MM-JJ, ou l'annee et la semaine ISO. */
export function periodKey(scope: MissionScope, date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (scope === 'daily') {
    const m = String(local.getMonth() + 1).padStart(2, '0');
    const d = String(local.getDate()).padStart(2, '0');
    return `${local.getFullYear()}-${m}-${d}`;
  }
  // Semaine ISO: le jeudi de la semaine donne l'annee de reference.
  const thursday = new Date(local);
  thursday.setDate(local.getDate() + 3 - ((local.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${thursday.getFullYear()}-S${String(week).padStart(2, '0')}`;
}

/** Instant du prochain renouvellement de la periode. */
export function nextReset(scope: MissionScope, date = new Date()): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (scope === 'daily') {
    next.setDate(next.getDate() + 1);
  } else {
    const daysToMonday = (8 - next.getDay()) % 7 || 7;
    next.setDate(next.getDate() + daysToMonday);
  }
  return next;
}

/** Les missions actives d'une periode, toujours les memes pour une cle. */
export function activeMissions(scope: MissionScope, key: string): MissionDef[] {
  const pool = MISSIONS.filter((m) => m.scope === scope);
  return shuffle(pool, createRng(`missions-${key}`)).slice(
    0,
    MISSIONS_PER_PERIOD,
  );
}

/** Recompense finale, bonus de rang compris, arrondie a la dizaine. */
export function missionReward(def: MissionDef, bonus: number): number {
  return Math.round((def.reward * (1 + bonus)) / 10) * 10;
}

export interface PeriodProgress {
  key: string;
  progress: Record<string, number>;
  claimed: string[];
}

export function emptyPeriod(
  scope: MissionScope,
  date = new Date(),
): PeriodProgress {
  return { key: periodKey(scope, date), progress: {}, claimed: [] };
}

/** Fait avancer les missions d'une periode avec un evenement. */
export function advance(
  period: PeriodProgress,
  scope: MissionScope,
  event: MissionEvent,
): PeriodProgress {
  let changed = false;
  const progress = { ...period.progress };
  for (const def of activeMissions(scope, period.key)) {
    const value = def.measure(event);
    if (value <= 0) continue;
    const before = progress[def.id] ?? 0;
    const after =
      def.mode === 'max'
        ? Math.max(before, value)
        : Math.min(def.target, before + value);
    if (after !== before) {
      progress[def.id] = Math.min(def.target, after);
      changed = true;
    }
  }
  return changed ? { ...period, progress } : period;
}

/** Vrai si la mission est terminee et pas encore recuperee. */
export function isClaimable(period: PeriodProgress, def: MissionDef): boolean {
  return (
    (period.progress[def.id] ?? 0) >= def.target &&
    !period.claimed.includes(def.id)
  );
}
