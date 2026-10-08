// Validation d'un etat de joueur venu de l'exterieur: sauvegarde locale,
// ou sauvegarde d'invite importee a la creation d'un compte. Chaque champ
// absent, mal type ou hors bornes reprend la valeur de repli.

import {
  CONSUMABLES,
  COSMETICS,
  SLOT_OF,
  findCosmetic,
  isValidDifficulty,
  ownsCosmetic,
} from '../state/catalog';
import { ACHIEVEMENTS } from '../state/achievements';
import { MISSIONS } from '../state/missions';
import type {
  ConsumableId,
  DifficultyId,
  SideBetId,
  StakeTableId,
} from '../state/catalog';
import type { PlayerState, Round, Session } from './types';

type Rec = Record<string, unknown>;

export function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Entier positif ou nul, borne, sinon la valeur de repli. */
export function count(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_KEY = /^\d{4}-(\d{2}-\d{2}|S\d{2})$/;
const COSMETIC_IDS = new Set(COSMETICS.map((c) => c.id));
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const MISSION_IDS = new Set(MISSIONS.map((m) => m.id));
const TABLE_IDS = new Set<StakeTableId>([
  'free',
  'silver',
  'gold',
  'diamond',
  'platinum',
  'legend',
]);
const MODES = new Set([
  'classic',
  'gambling',
  'zen',
  'chrono',
  'daily',
  'vegas',
]);
const SEED_SOURCES = new Set([
  'random',
  'daily',
  'custom',
  'guaranteed',
  'tutorial',
]);

function period(
  value: unknown,
  fallback: PlayerState['missions']['daily'],
): PlayerState['missions']['daily'] {
  if (!isRecord(value) || typeof value.key !== 'string') return fallback;
  if (!PERIOD_KEY.test(value.key)) return fallback;
  const progress: Record<string, number> = {};
  if (isRecord(value.progress)) {
    for (const [id, n] of Object.entries(value.progress)) {
      if (MISSION_IDS.has(id)) progress[id] = count(n, 0);
    }
  }
  const claimed = Array.isArray(value.claimed)
    ? [
        ...new Set(
          value.claimed.filter(
            (x): x is string => typeof x === 'string' && MISSION_IDS.has(x),
          ),
        ),
      ]
    : [];
  return { key: value.key, progress, claimed };
}

function round(value: unknown): Round | null {
  if (!isRecord(value)) return null;
  const v = value;
  if (
    typeof v.id !== 'string' ||
    typeof v.seed !== 'string' ||
    !MODES.has(v.mode as string) ||
    !isValidDifficulty(v.difficulty) ||
    !SEED_SOURCES.has(v.seedSource as string) ||
    (v.drawCount !== 1 && v.drawCount !== 3) ||
    !TABLE_IDS.has(v.table as StakeTableId)
  ) {
    return null;
  }
  return {
    id: v.id.slice(0, 64),
    mode: v.mode as Round['mode'],
    difficulty: v.difficulty as DifficultyId,
    seed: v.seed.slice(0, 64),
    seedSource: v.seedSource as Round['seedSource'],
    drawCount: v.drawCount,
    gentle: v.gentle === true,
    ...(typeof v.recycles === 'number'
      ? { recycles: count(v.recycles, 0) }
      : {}),
    table: v.table as StakeTableId,
    startedAt: count(v.startedAt, 0),
    vegasStake: count(v.vegasStake, 0),
    sideBetStake: count(v.sideBetStake, 50),
  };
}

function session(value: unknown, fallback: Session): Session {
  if (!isRecord(value)) return fallback;
  const v = value;
  const lsw = isRecord(v.lastScoredWin) ? v.lastScoredWin : null;
  const vault = isRecord(v.vaultResult) ? v.vaultResult : null;
  return {
    round: round(v.round),
    pot: count(v.pot, 0),
    combo: count(v.combo, 0),
    table: TABLE_IDS.has(v.table as StakeTableId)
      ? (v.table as StakeTableId)
      : 'free',
    insured: v.insured === true,
    awaiting:
      v.awaiting === 'decision' || v.awaiting === 'lost' ? v.awaiting : 'none',
    vaultEligible: v.vaultEligible === true,
    vaultResult:
      vault && typeof vault.multiplier === 'number'
        ? { multiplier: vault.multiplier, trapped: vault.trapped === true }
        : null,
    lastScoredWin:
      lsw && isValidDifficulty(lsw.difficulty)
        ? { score: count(lsw.score, 0), difficulty: lsw.difficulty }
        : null,
    nonce:
      typeof v.nonce === 'string' && /^[0-9a-f]{8,32}$/.test(v.nonce)
        ? v.nonce
        : fallback.nonce,
  };
}

/** Valide un etat de joueur champ par champ, avec `fallback` en repli. */
export function sanitizePlayer(
  raw: unknown,
  fallback: PlayerState,
): PlayerState {
  if (!isRecord(raw)) return fallback;
  const p = raw;

  const st = isRecord(p.stats) ? p.stats : {};
  const fs = fallback.stats;
  const gamesPlayed = count(st.gamesPlayed, fs.gamesPlayed);
  const bestTimeMs =
    st.bestTimeMs === null
      ? null
      : typeof st.bestTimeMs === 'number' && st.bestTimeMs > 0
        ? count(st.bestTimeMs, 0)
        : fs.bestTimeMs;
  const stats = {
    gamesPlayed,
    gamesWon: Math.min(gamesPlayed, count(st.gamesWon, fs.gamesWon)),
    currentWinStreak: count(st.currentWinStreak, fs.currentWinStreak),
    bestWinStreak: count(st.bestWinStreak, fs.bestWinStreak),
    bestTimeMs,
    bestScore: count(st.bestScore, fs.bestScore),
    sumWinTimeMs: count(st.sumWinTimeMs, fs.sumWinTimeMs),
    sumWinMoves: count(st.sumWinMoves, fs.sumWinMoves),
  };

  const g = isRecord(p.gambling) ? p.gambling : {};
  const fg = fallback.gambling;
  const gambling = {
    secured: count(g.secured, fg.secured),
    bestSecuredRun: count(g.bestSecuredRun, fg.bestSecuredRun),
    longestStreak: count(g.longestStreak, fg.longestStreak),
    vaultsOpened: count(g.vaultsOpened, fg.vaultsOpened),
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
      : fallback.daily.completedDates,
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
  const fw = fallback.wallet;
  const wallet = {
    balance: count(w.balance, fw.balance),
    lifetimeEarned: count(w.lifetimeEarned, fw.lifetimeEarned),
    spent: count(w.spent, fw.spent),
  };

  const inv = isRecord(p.inventory) ? p.inventory : {};
  const rawConsumables = isRecord(inv.consumables) ? inv.consumables : {};
  const consumables = Object.fromEntries(
    CONSUMABLES.map((c) => [
      c.id,
      count(rawConsumables[c.id], fallback.inventory.consumables[c.id] ?? 0),
    ]),
  ) as Record<ConsumableId, number>;
  const owned = Array.isArray(inv.owned)
    ? [
        ...new Set(
          inv.owned.filter(
            (x): x is string => typeof x === 'string' && COSMETIC_IDS.has(x),
          ),
        ),
      ]
    : fallback.inventory.owned;

  // Objets equipes: seulement ce qui est possede, et dans le bon emplacement.
  const eq = isRecord(p.equipped) ? p.equipped : {};
  const equipped = { ...fallback.equipped };
  for (const slot of Object.keys(equipped) as (keyof typeof equipped)[]) {
    const id = eq[slot];
    const item = typeof id === 'string' ? findCosmetic(id) : undefined;
    if (
      item &&
      SLOT_OF[item.category] === slot &&
      ownsCosmetic(item, owned, wallet.lifetimeEarned)
    ) {
      equipped[slot] = item.id;
    }
  }

  const wh = isRecord(p.wheel) ? p.wheel : {};
  const pr = isRecord(p.progressive) ? p.progressive : {};
  const ms = isRecord(p.missions) ? p.missions : {};
  const pk = isRecord(p.perks) ? p.perks : {};

  return {
    wallet,
    inventory: { owned, consumables },
    stats,
    gambling,
    daily,
    achievements,
    wheel: {
      lastSpin:
        typeof wh.lastSpin === 'string' && ISO_DATE.test(wh.lastSpin)
          ? wh.lastSpin
          : null,
    },
    progressive: {
      pot: Math.max(
        fallback.progressive.pot,
        count(pr.pot, fallback.progressive.pot),
      ),
      wins: count(pr.wins, fallback.progressive.wins),
    },
    missions: {
      daily: period(ms.daily, fallback.missions.daily),
      weekly: period(ms.weekly, fallback.missions.weekly),
    },
    perks: {
      lastGift:
        typeof pk.lastGift === 'string' && PERIOD_KEY.test(pk.lastGift)
          ? pk.lastGift
          : null,
    },
    equipped,
    session: session(p.session, fallback.session),
  };
}

/** Plafonds appliques a une sauvegarde d'invite importee dans un compte. */
export const IMPORT_CAPS = {
  lifetimeEarned: 2_000_000,
  progressive: 200_000,
};

/**
 * Sauvegarde d'invite reprise a la creation d'un compte. Elle vient d'un
 * navigateur, donc rien n'en est garanti: on la valide, on plafonne ce qui
 * compte pour l'economie, et on repart d'une session vierge.
 */
export function importGuest(raw: unknown, fresh: PlayerState): PlayerState {
  const s = sanitizePlayer(raw, fresh);
  const lifetime = Math.min(
    s.wallet.lifetimeEarned,
    IMPORT_CAPS.lifetimeEarned,
  );
  return {
    ...s,
    wallet: {
      lifetimeEarned: lifetime,
      // Une banque ne depasse jamais ce qui a ete gagne, cadeau de bienvenue
      // compris.
      balance: Math.min(s.wallet.balance, lifetime + fresh.wallet.balance),
      spent: s.wallet.spent,
    },
    progressive: {
      pot: Math.min(s.progressive.pot, IMPORT_CAPS.progressive),
      wins: s.progressive.wins,
    },
    // La session vient de l'etat neuf du compte (nonce tire par le serveur).
    session: fresh.session,
  };
}

export type { SideBetId };
