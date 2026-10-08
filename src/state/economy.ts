// Passerelle de l'economie: toute action qui touche aux jetons passe par
// `perform`. Pour un invite, le coeur du jeu s'execute ici meme; pour un
// compte, la meme action part au serveur, qui la rejoue et fait foi. Le
// reste du jeu ne voit pas la difference.

import {
  CoreError,
  dispatch,
  type Action,
  type EquipSlot,
  type FinishResult,
  type Round,
  type SpinResult,
  type StartRequest,
  type Decision,
  type EndReason,
  type LogEntry,
  type Notice,
  type PlayerState,
} from '../core';
import type { ConsumableId } from './catalog';
import type { MissionScope } from './missions';
import { localCtx, useMetaStore } from './meta';
import { AccountError, api, useAccountStore } from './account';

/** Refus d'une action, avec un message montrable au joueur. */
export class EconomyError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'EconomyError';
  }
}

interface ActResponse<T> {
  state: PlayerState;
  notices: Notice[];
  result: T;
}

/** Vrai quand le serveur fait foi (compte connecte). */
export function isOnline(): boolean {
  return (
    useAccountStore.getState().status === 'online' &&
    useMetaStore.getState().accountActive
  );
}

export async function perform<T>(action: Action): Promise<T> {
  const meta = useMetaStore.getState();
  if (isOnline()) {
    try {
      const out = await api<ActResponse<T>>({ op: 'act', action });
      useMetaStore.getState().applyPlayer(out.state, out.notices);
      return out.result;
    } catch (err) {
      if (err instanceof AccountError) {
        throw new EconomyError(err.message, err.code);
      }
      throw err;
    }
  }
  try {
    const out = dispatch(meta.player(), action, localCtx());
    meta.applyPlayer(out.state, out.notices);
    return out.result as T;
  } catch (err) {
    if (err instanceof CoreError) throw new EconomyError(err.message, err.code);
    throw err;
  }
}

/** Montre une action refusee au joueur, sans planter l'interface. */
export function reportFailure(err: unknown): void {
  const message =
    err instanceof EconomyError
      ? err.message
      : 'Le croupier a eu un souci, réessaie.';
  useMetaStore
    .getState()
    .notify({ kind: 'error', title: 'Action refusée', text: message });
}

/** Achete un bonus; en cas de refus, le joueur voit pourquoi. */
export async function tryBuy(id: ConsumableId): Promise<boolean> {
  try {
    await economy.buyConsumable(id);
    return true;
  } catch (err) {
    reportFailure(err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Raccourcis types
// ---------------------------------------------------------------------------

export const economy = {
  start: (req: StartRequest) =>
    perform<{ round: Round }>({ type: 'start', req }),
  finish: (roundId: string, log: LogEntry[], reason: EndReason) =>
    perform<FinishResult>({ type: 'finish', roundId, log, reason }),
  decide: (decision: Decision) =>
    perform<{ pot: number; vault?: { multiplier: number; trapped: boolean } }>({
      type: 'decide',
      decision,
    }),
  buyCosmetic: (id: string) =>
    perform<{ id: string }>({ type: 'buyCosmetic', id }),
  buyConsumable: (id: ConsumableId) =>
    perform<{ id: ConsumableId }>({ type: 'buyConsumable', id }),
  equip: (slot: EquipSlot, id: string) =>
    perform<{ slot: EquipSlot; id: string }>({ type: 'equip', slot, id }),
  spin: () => perform<SpinResult>({ type: 'spin' }),
  claimMission: (scope: MissionScope, id: string) =>
    perform<{ amount: number }>({ type: 'claimMission', scope, id }),
  claimGift: () => perform<{ gift: ConsumableId[] }>({ type: 'claimGift' }),
};
