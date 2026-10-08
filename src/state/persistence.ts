// Lecture et ecriture fiables de la sauvegarde locale.
//
// La sauvegarde vit dans le localStorage du navigateur: n'importe qui peut la
// modifier a la main, une extension peut la corrompre, et l'ecriture peut
// echouer (navigation privee, quota plein). Rien de tout cela ne doit faire
// planter le jeu: on lit prudemment, on valide champ par champ, et on
// previent le joueur une seule fois quand quelque chose cloche.

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import {
  CONSUMABLES,
  COSMETICS,
  isValidCardBack,
  isValidCardFace,
  isValidDifficulty,
  isValidTable,
  isValidTitle,
  isValidVictoryFx,
  type ConsumableId,
} from './catalog';
import { ACHIEVEMENTS } from './achievements';

export type StorageProblem = 'read' | 'corrupt' | 'write';

/**
 * Stockage JSON qui ne leve jamais d'exception. Une sauvegarde illisible est
 * mise de cote (cle `<nom>-illisible`) plutot que perdue, pour pouvoir la
 * recuperer a la main si besoin.
 */
export function createSafeStorage<S>(
  report: (problem: StorageProblem) => void,
  getStorage: () => Storage = () => window.localStorage,
): PersistStorage<S> {
  const reported = new Set<StorageProblem>();
  const once = (problem: StorageProblem) => {
    if (reported.has(problem)) return;
    reported.add(problem);
    report(problem);
  };

  return {
    getItem: (name) => {
      let raw: string | null;
      try {
        raw = getStorage().getItem(name);
      } catch {
        once('read');
        return null;
      }
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !('state' in parsed)) throw new Error();
        return parsed as StorageValue<S>;
      } catch {
        try {
          getStorage().setItem(`${name}-illisible`, raw);
        } catch {
          // Pas de place pour la copie: tant pis, on repart a neuf.
        }
        once('corrupt');
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        getStorage().setItem(name, JSON.stringify(value));
      } catch {
        once('write');
      }
    },
    removeItem: (name) => {
      try {
        getStorage().removeItem(name);
      } catch {
        // Rien a faire: la cle n'existe sans doute pas.
      }
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Entier positif ou nul, borne, sinon la valeur de repli. */
function count(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pick<T>(
  value: unknown,
  valid: (v: string) => boolean,
  fallback: T,
): T | string {
  return typeof value === 'string' && valid(value) ? value : fallback;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COSMETIC_IDS = new Set(COSMETICS.map((c) => c.id));
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

/** Forme minimale de l'etat persiste, telle que la decrit meta.ts. */
export interface PersistedMetaShape {
  settings: {
    soundEnabled: boolean;
    volume: number;
    cardBack: string;
    table: string;
    victoryFx: string;
    cardFace: string;
    title: string;
    difficulty: string;
    reducedMotion: boolean;
  };
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    currentWinStreak: number;
    bestWinStreak: number;
    bestTimeMs: number | null;
    bestScore: number;
    sumWinTimeMs: number;
    sumWinMoves: number;
  };
  gambling: {
    secured: number;
    bestSecuredRun: number;
    longestStreak: number;
    vaultsOpened: number;
  };
  daily: { completedDates: string[]; lastPlayed: string | null };
  achievements: Record<string, number>;
  wallet: { balance: number; lifetimeEarned: number; spent: number };
  inventory: { owned: string[]; consumables: Record<ConsumableId, number> };
  wheel: { lastSpin: string | null };
}

/**
 * Valide une sauvegarde champ par champ. Tout champ absent, du mauvais type
 * ou hors bornes reprend la valeur courante (celle par defaut au demarrage):
 * une sauvegarde bricolee ne peut ni planter le jeu ni produire de soldes
 * negatifs ou infinis.
 */
export function sanitizePersistedMeta<T extends PersistedMetaShape>(
  persisted: unknown,
  current: T,
): T {
  if (!isRecord(persisted)) return current;
  const p = persisted;

  const s = isRecord(p.settings) ? p.settings : {};
  const cs = current.settings;
  const volume =
    typeof s.volume === 'number' && Number.isFinite(s.volume)
      ? Math.min(1, Math.max(0, s.volume))
      : cs.volume;
  const settings = {
    ...cs,
    soundEnabled: bool(s.soundEnabled, cs.soundEnabled),
    volume,
    cardBack: pick(s.cardBack, isValidCardBack, cs.cardBack),
    table: pick(s.table, isValidTable, cs.table),
    victoryFx: pick(s.victoryFx, isValidVictoryFx, cs.victoryFx),
    cardFace: pick(s.cardFace, isValidCardFace, cs.cardFace),
    title: pick(s.title, isValidTitle, cs.title),
    difficulty: pick(s.difficulty, isValidDifficulty, cs.difficulty),
    reducedMotion: bool(s.reducedMotion, cs.reducedMotion),
  };

  const st = isRecord(p.stats) ? p.stats : {};
  const cst = current.stats;
  const gamesPlayed = count(st.gamesPlayed, cst.gamesPlayed);
  const gamesWon = Math.min(gamesPlayed, count(st.gamesWon, cst.gamesWon));
  const bestTimeMs =
    st.bestTimeMs === null
      ? null
      : typeof st.bestTimeMs === 'number' && st.bestTimeMs > 0
        ? count(st.bestTimeMs, 0)
        : cst.bestTimeMs;
  const stats = {
    ...cst,
    gamesPlayed,
    gamesWon,
    currentWinStreak: count(st.currentWinStreak, cst.currentWinStreak),
    bestWinStreak: count(st.bestWinStreak, cst.bestWinStreak),
    bestTimeMs,
    bestScore: count(st.bestScore, cst.bestScore),
    sumWinTimeMs: count(st.sumWinTimeMs, cst.sumWinTimeMs),
    sumWinMoves: count(st.sumWinMoves, cst.sumWinMoves),
  };

  const g = isRecord(p.gambling) ? p.gambling : {};
  const cg = current.gambling;
  const gambling = {
    ...cg,
    secured: count(g.secured, cg.secured),
    bestSecuredRun: count(g.bestSecuredRun, cg.bestSecuredRun),
    longestStreak: count(g.longestStreak, cg.longestStreak),
    vaultsOpened: count(g.vaultsOpened, cg.vaultsOpened),
  };

  const d = isRecord(p.daily) ? p.daily : {};
  const daily = {
    completedDates: Array.isArray(d.completedDates)
      ? [
          ...new Set(
            d.completedDates.filter(
              (x): x is string => typeof x === 'string' && ISO_DATE.test(x),
            ),
          ),
        ]
      : current.daily.completedDates,
    lastPlayed:
      typeof d.lastPlayed === 'string' && ISO_DATE.test(d.lastPlayed)
        ? d.lastPlayed
        : null,
  };

  const achievements: Record<string, number> = {};
  if (isRecord(p.achievements)) {
    for (const [id, at] of Object.entries(p.achievements)) {
      if (ACHIEVEMENT_IDS.has(id) && typeof at === 'number' && at > 0) {
        achievements[id] = at;
      }
    }
  }

  const w = isRecord(p.wallet) ? p.wallet : {};
  const cw = current.wallet;
  const wallet = {
    ...cw,
    balance: count(w.balance, cw.balance),
    lifetimeEarned: count(w.lifetimeEarned, cw.lifetimeEarned),
    spent: count(w.spent, cw.spent),
  };

  const inv = isRecord(p.inventory) ? p.inventory : {};
  const rawConsumables = isRecord(inv.consumables) ? inv.consumables : {};
  const consumables = Object.fromEntries(
    CONSUMABLES.map((c) => [
      c.id,
      count(rawConsumables[c.id], current.inventory.consumables[c.id] ?? 0),
    ]),
  ) as Record<ConsumableId, number>;
  const inventory = {
    owned: Array.isArray(inv.owned)
      ? [
          ...new Set(
            inv.owned.filter(
              (x): x is string => typeof x === 'string' && COSMETIC_IDS.has(x),
            ),
          ),
        ]
      : current.inventory.owned,
    consumables,
  };

  const wh = isRecord(p.wheel) ? p.wheel : {};
  const wheel = {
    lastSpin:
      typeof wh.lastSpin === 'string' && ISO_DATE.test(wh.lastSpin)
        ? wh.lastSpin
        : null,
  };

  return {
    ...current,
    settings,
    stats,
    gambling,
    daily,
    achievements,
    wallet,
    inventory,
    wheel,
  } as T;
}
