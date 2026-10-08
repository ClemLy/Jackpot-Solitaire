// Boutique, equipement, roue du jour, missions et coffret de rang.

import {
  COLLECTIBLES,
  SLOT_OF,
  WHEEL_SEGMENTS,
  discountedPrice,
  drawWheelSegment,
  findConsumable,
  findCosmetic,
  meetsTier,
  missionBonusFor,
  ownsCosmetic,
  vipTierFor,
  weeklyGiftFor,
  type ConsumableId,
  type WheelReward,
} from '../state/catalog';
import {
  findMission,
  isClaimable,
  missionReward,
  type MissionScope,
} from '../state/missions';
import { currentPeriod, Tx } from './player';
import {
  CoreError,
  type Ctx,
  type EquipSlot,
  type Outcome,
  type PlayerState,
} from './types';

export function buyCosmetic(
  state: PlayerState,
  id: string,
  ctx: Ctx,
): Outcome<{ id: string }> {
  const tx = new Tx(state, ctx);
  const item = findCosmetic(id);
  if (!item) throw new CoreError('unknown', 'Objet inconnu.');
  const { owned } = tx.s.inventory;
  const lifetime = tx.s.wallet.lifetimeEarned;
  if (ownsCosmetic(item, owned, lifetime)) {
    throw new CoreError('owned', 'Tu possèdes déjà cet objet.');
  }
  if (!meetsTier(lifetime, item.minTier)) {
    throw new CoreError('locked', 'Ton rang ne permet pas encore cet achat.');
  }
  if (item.price === 0)
    throw new CoreError('locked', 'Objet offert au rang requis.');
  if (!tx.spend(discountedPrice(item.price, lifetime))) {
    throw new CoreError('funds', 'Pas assez de jetons.');
  }
  owned.push(id);
  // Un objet achete s'equipe aussitot.
  tx.s.equipped[SLOT_OF[item.category]] = id;
  const set = new Set(owned);
  const unlocked = ['collector'];
  if (item.grail) unlocked.push('grail');
  if (COLLECTIBLES.every((c) => set.has(c.id))) unlocked.push('completionist');
  tx.grant(unlocked);
  return tx.done({ id });
}

export function buyConsumable(
  state: PlayerState,
  id: ConsumableId,
  ctx: Ctx,
): Outcome<{ id: ConsumableId }> {
  const tx = new Tx(state, ctx);
  const item = findConsumable(id);
  if (!tx.spend(discountedPrice(item.price, tx.s.wallet.lifetimeEarned))) {
    throw new CoreError('funds', 'Pas assez de jetons.');
  }
  tx.addConsumable(id);
  tx.grant(['collector']);
  return tx.done({ id });
}

/** Equipe un objet possede dans l'emplacement qui lui correspond. */
export function equip(
  state: PlayerState,
  slot: EquipSlot,
  id: string,
  ctx: Ctx,
): Outcome<{ slot: EquipSlot; id: string }> {
  const tx = new Tx(state, ctx);
  const item = findCosmetic(id);
  if (!item || SLOT_OF[item.category] !== slot) {
    throw new CoreError('unknown', 'Objet inconnu.');
  }
  if (!ownsCosmetic(item, tx.s.inventory.owned, tx.s.wallet.lifetimeEarned)) {
    throw new CoreError('locked', 'Tu ne possèdes pas cet objet.');
  }
  tx.s.equipped[slot] = id;
  return tx.done({ slot, id });
}

export interface SpinResult {
  index: number;
  /** Recompense reellement versee (jetons multiplies par le rang VIP). */
  reward: WheelReward;
  /** Multiplicateur VIP applique aux jetons (1 si aucun). */
  boost: number;
}

export function canSpin(state: PlayerState, ctx: Pick<Ctx, 'today'>): boolean {
  return state.wheel.lastSpin !== ctx.today;
}

export function spinWheel(state: PlayerState, ctx: Ctx): Outcome<SpinResult> {
  const tx = new Tx(state, ctx);
  if (!canSpin(tx.s, ctx)) {
    throw new CoreError('used', 'La roue a déjà tourné aujourd’hui.');
  }
  const index = drawWheelSegment(ctx.random());
  const base = WHEEL_SEGMENTS[index].reward;
  // Plus le rang est haut, plus la roue est genereuse en jetons.
  const boost = vipTierFor(tx.s.wallet.lifetimeEarned).wheelBoost;
  const reward: WheelReward =
    base.kind === 'chips'
      ? { kind: 'chips', amount: Math.round(base.amount * boost) }
      : base;
  tx.s.wheel.lastSpin = ctx.today;
  tx.recordMission({ kind: 'wheel' });
  if (reward.kind === 'chips') tx.credit(reward.amount);
  else tx.addConsumable(reward.item);
  return tx.done({ index, reward, boost: reward.kind === 'chips' ? boost : 1 });
}

export function claimMission(
  state: PlayerState,
  scope: MissionScope,
  id: string,
  ctx: Ctx,
): Outcome<{ amount: number }> {
  const tx = new Tx(state, ctx);
  const key = scope === 'daily' ? ctx.today : ctx.week;
  const period = currentPeriod(tx.s.missions[scope], key);
  const def = findMission(id);
  if (!def || def.scope !== scope || !isClaimable(period, def)) {
    throw new CoreError('state', 'Cette mission n’est pas terminée.');
  }
  const amount = missionReward(
    def,
    missionBonusFor(tx.s.wallet.lifetimeEarned),
  );
  tx.s.missions[scope] = { ...period, claimed: [...period.claimed, id] };
  tx.credit(amount);
  return tx.done({ amount });
}

export function canClaimWeeklyGift(
  state: PlayerState,
  ctx: Pick<Ctx, 'week'>,
): boolean {
  return (
    weeklyGiftFor(state.wallet.lifetimeEarned).length > 0 &&
    state.perks.lastGift !== ctx.week
  );
}

export function claimWeeklyGift(
  state: PlayerState,
  ctx: Ctx,
): Outcome<{ gift: ConsumableId[] }> {
  const tx = new Tx(state, ctx);
  if (!canClaimWeeklyGift(tx.s, ctx)) {
    throw new CoreError('state', 'Le coffret de la semaine est déjà ouvert.');
  }
  const gift = weeklyGiftFor(tx.s.wallet.lifetimeEarned);
  for (const id of gift) tx.addConsumable(id);
  tx.s.perks.lastGift = ctx.week;
  return tx.done({ gift });
}
