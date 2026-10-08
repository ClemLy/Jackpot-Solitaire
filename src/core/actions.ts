// Point d'entree unique des actions du joueur. Le navigateur d'un invite et
// le serveur passent tous deux par ici: une seule definition des regles, et
// une validation stricte de chaque demande (sur le serveur, tout ce qui
// arrive du reseau est suppose hostile).

import {
  CONSUMABLES,
  SIDE_BETS,
  isValidDifficulty,
  type ConsumableId,
  type DifficultyId,
  type SideBetId,
  type StakeTableId,
} from '../state/catalog';
import type { Move } from '../engine';
import { sanitizeSeed } from '../utils/seed';
import {
  decide,
  finishRound,
  MAX_LOG,
  startRound,
  type Decision,
  type StartRequest,
} from './rounds';
import {
  buyConsumable,
  buyCosmetic,
  claimMission,
  claimWeeklyGift,
  equip,
  spinWheel,
} from './shop';
import { isRecord } from './sanitize';
import {
  CoreError,
  type Ctx,
  type EndReason,
  type EquipSlot,
  type GameMode,
  type LogEntry,
  type Outcome,
  type PlayerState,
} from './types';

export type Action =
  | { type: 'start'; req: StartRequest }
  | { type: 'finish'; roundId: string; log: LogEntry[]; reason: EndReason }
  | { type: 'decide'; decision: Decision }
  | { type: 'buyCosmetic'; id: string }
  | { type: 'buyConsumable'; id: ConsumableId }
  | { type: 'equip'; slot: EquipSlot; id: string }
  | { type: 'spin' }
  | { type: 'claimMission'; scope: 'daily' | 'weekly'; id: string }
  | { type: 'claimGift' };

const MODES: GameMode[] = [
  'classic',
  'gambling',
  'zen',
  'chrono',
  'daily',
  'vegas',
];
const TABLES: StakeTableId[] = [
  'free',
  'silver',
  'gold',
  'diamond',
  'platinum',
  'legend',
];
const SLOTS: EquipSlot[] = [
  'cardBack',
  'cardFace',
  'table',
  'victoryFx',
  'title',
  'avatar',
  'frame',
  'profileCard',
];
const BET_IDS = new Set<string>(SIDE_BETS.map((b) => b.id));
const CONSUMABLE_IDS = new Set<string>(CONSUMABLES.map((c) => c.id));
const REASONS: EndReason[] = ['win', 'deadlock', 'time', 'abandon'];
const DECISIONS: Decision[] = ['cash', 'vault', 'leave'];
const ID = /^[a-z0-9-]{1,40}$/;

function bad(): never {
  throw new CoreError('invalid', 'Demande invalide.');
}

function str(v: unknown, max = 64): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) bad();
  return v;
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): T {
  if (typeof v !== 'string' || !list.includes(v as T)) bad();
  return v as T;
}

function int(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    bad();
  return v;
}

function difficulty(v: unknown): DifficultyId {
  if (!isValidDifficulty(v)) bad();
  return v;
}

function move(v: unknown): Move {
  if (!isRecord(v)) bad();
  switch (v.type) {
    case 'draw':
    case 'recycle':
      return { type: v.type };
    case 'wasteToFoundation':
      return { type: v.type, foundation: int(v.foundation, 0, 3) };
    case 'wasteToTableau':
      return { type: v.type, column: int(v.column, 0, 6) };
    case 'tableauToFoundation':
      return {
        type: v.type,
        column: int(v.column, 0, 6),
        foundation: int(v.foundation, 0, 3),
      };
    case 'foundationToTableau':
      return {
        type: v.type,
        foundation: int(v.foundation, 0, 3),
        column: int(v.column, 0, 6),
      };
    case 'tableauToTableau':
      return {
        type: v.type,
        from: int(v.from, 0, 6),
        to: int(v.to, 0, 6),
        count: int(v.count, 1, 13),
      };
    default:
      bad();
  }
}

function logEntry(v: unknown): LogEntry {
  if (!isRecord(v)) bad();
  switch (v.t) {
    case 'move':
      return v.wild === true
        ? { t: 'move', move: move(v.move), wild: true }
        : { t: 'move', move: move(v.move) };
    case 'undo':
    case 'hint':
    case 'invalid':
    case 'reshuffle':
      return { t: v.t };
    case 'peek':
      return { t: 'peek', card: str(v.card, 16) };
    case 'bet':
      if (!BET_IDS.has(v.id as string)) bad();
      return { t: 'bet', id: v.id as SideBetId };
    default:
      bad();
  }
}

function startRequest(v: unknown): StartRequest {
  if (!isRecord(v)) bad();
  const guaranteedSeed =
    v.guaranteedSeed === undefined ? undefined : str(v.guaranteedSeed, 40);
  const diff = difficulty(v.difficulty);
  switch (v.kind) {
    case 'new': {
      const seed =
        v.seed === undefined ? undefined : (sanitizeSeed(v.seed) ?? undefined);
      return {
        kind: 'new',
        mode: oneOf(v.mode, MODES),
        difficulty: diff,
        ...(v.table !== undefined ? { table: oneOf(v.table, TABLES) } : {}),
        ...(seed ? { seed } : {}),
        ...(guaranteedSeed ? { guaranteedSeed } : {}),
        ...(v.tutorial === true ? { tutorial: true } : {}),
      };
    }
    case 'double':
    case 'half':
      return {
        kind: v.kind,
        difficulty: diff,
        insure: v.insure === true,
        ...(guaranteedSeed ? { guaranteedSeed } : {}),
      };
    case 'second':
    case 'fromScore':
      return {
        kind: v.kind,
        difficulty: diff,
        ...(guaranteedSeed ? { guaranteedSeed } : {}),
      };
    default:
      bad();
  }
}

/** Valide une action brute (JSON venu du reseau) et la rend typee. */
export function parseAction(raw: unknown): Action {
  if (!isRecord(raw)) bad();
  switch (raw.type) {
    case 'start':
      return { type: 'start', req: startRequest(raw.req) };
    case 'finish': {
      if (!Array.isArray(raw.log) || raw.log.length > MAX_LOG) bad();
      return {
        type: 'finish',
        roundId: str(raw.roundId, 64),
        log: raw.log.map(logEntry),
        reason: oneOf(raw.reason, REASONS),
      };
    }
    case 'decide':
      return { type: 'decide', decision: oneOf(raw.decision, DECISIONS) };
    case 'buyCosmetic':
      if (typeof raw.id !== 'string' || !ID.test(raw.id)) bad();
      return { type: 'buyCosmetic', id: raw.id };
    case 'buyConsumable':
      if (!CONSUMABLE_IDS.has(raw.id as string)) bad();
      return { type: 'buyConsumable', id: raw.id as ConsumableId };
    case 'equip':
      if (typeof raw.id !== 'string' || !ID.test(raw.id)) bad();
      return { type: 'equip', slot: oneOf(raw.slot, SLOTS), id: raw.id };
    case 'spin':
      return { type: 'spin' };
    case 'claimMission':
      if (typeof raw.id !== 'string' || !ID.test(raw.id)) bad();
      return {
        type: 'claimMission',
        scope: oneOf(raw.scope, ['daily', 'weekly'] as const),
        id: raw.id,
      };
    case 'claimGift':
      return { type: 'claimGift' };
    default:
      bad();
  }
}

/** Applique une action validee a l'etat d'un joueur. */
export function dispatch(
  state: PlayerState,
  action: Action,
  ctx: Ctx,
): Outcome {
  switch (action.type) {
    case 'start':
      return startRound(state, action.req, ctx);
    case 'finish':
      return finishRound(state, action, ctx);
    case 'decide':
      return decide(state, action.decision, ctx);
    case 'buyCosmetic':
      return buyCosmetic(state, action.id, ctx);
    case 'buyConsumable':
      return buyConsumable(state, action.id, ctx);
    case 'equip':
      return equip(state, action.slot, action.id, ctx);
    case 'spin':
      return spinWheel(state, ctx);
    case 'claimMission':
      return claimMission(state, action.scope, action.id, ctx);
    case 'claimGift':
      return claimWeeklyGift(state, ctx);
  }
}
