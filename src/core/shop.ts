// Boutique, equipement, roue du jour, missions et coffret de rang.

import {
  COLLECTIBLES,
  SLOT_OF,
  WHEEL_SEGMENTS,
  canUnlock,
  discountedPrice,
  drawWheelSegment,
  findConsumable,
  findCosmetic,
  isLegendItem,
  missionBonusFor,
  ownsCosmetic,
  vipTierFor,
  weeklyGiftFor,
  type ConsumableId,
  type WheelReward,
} from '../state/catalog';
import { unpaidAchievements } from '../state/achievements';
import {
  ATELIER_LEVEL,
  atelierSlot,
  validAtelier,
  type AtelierConfig,
  type AtelierSlot,
} from '../state/atelier';
import {
  BLACK_WHEEL,
  EXCHANGE_PACKS,
  EXCHANGE_RATE,
  hasPerk,
  weeklyBlack,
} from '../state/legend';
import { formatNumber } from '../utils/format';
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
  const level = tx.s.legend.level;
  const legendary = isLegendItem(item);
  if (ownsCosmetic(item, owned, lifetime, level)) {
    throw new CoreError('owned', 'Tu possèdes déjà cet objet.');
  }
  if (!canUnlock(item, lifetime, level)) {
    throw new CoreError(
      'locked',
      legendary
        ? 'Ton niveau Légendaire ne permet pas encore cet achat.'
        : 'Ton rang ne permet pas encore cet achat.',
    );
  }
  if (item.price === 0) {
    throw new CoreError(
      'locked',
      legendary
        ? 'Objet offert au niveau requis.'
        : 'Objet offert au rang requis.',
    );
  }
  if (legendary) {
    if (!tx.spendBlack(item.price)) {
      throw new CoreError('funds', 'Pas assez de jetons noirs.');
    }
  } else if (!tx.spend(discountedPrice(item.price, lifetime))) {
    throw new CoreError('funds', 'Pas assez de jetons.');
  }
  owned.push(id);
  // Un objet achete s'equipe aussitot.
  tx.s.equipped[SLOT_OF[item.category]] = id;
  const set = new Set(owned);
  const unlocked = legendary ? [] : ['collector'];
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
  if (
    !ownsCosmetic(
      item,
      tx.s.inventory.owned,
      tx.s.wallet.lifetimeEarned,
      tx.s.legend.level,
    )
  ) {
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
  /** Jetons noirs gagnes en plus (Roue noire, rang Legendaire). */
  black: number;
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
  const black = hasPerk(tx.s.legend.level, 'wheel')
    ? tx.earnBlack(BLACK_WHEEL)
    : 0;
  return tx.done({
    index,
    reward,
    boost: reward.kind === 'chips' ? boost : 1,
    black,
  });
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
): Outcome<{ gift: ConsumableId[]; black: number }> {
  const tx = new Tx(state, ctx);
  if (!canClaimWeeklyGift(tx.s, ctx)) {
    throw new CoreError('state', 'Le coffret de la semaine est déjà ouvert.');
  }
  const gift = weeklyGiftFor(tx.s.wallet.lifetimeEarned);
  for (const id of gift) tx.addConsumable(id);
  // Coffret noir: des jetons noirs en plus, a partir du niveau II.
  const black = weeklyBlack(tx.s.legend.level);
  if (black > 0) tx.addBlackPrize(black);
  tx.s.perks.lastGift = ctx.week;
  return tx.done({ gift, black });
}

/** Bureau de change: des jetons de la banque contre des jetons noirs. */
export function exchangeBlack(
  state: PlayerState,
  amount: number,
  ctx: Ctx,
): Outcome<{ amount: number; cost: number }> {
  const tx = new Tx(state, ctx);
  if (!hasPerk(tx.s.legend.level, 'exchange')) {
    throw new CoreError(
      'locked',
      'Le bureau de change est réservé aux Légendaires.',
    );
  }
  if (!(EXCHANGE_PACKS as readonly number[]).includes(amount)) {
    throw new CoreError('invalid', 'Lot inconnu.');
  }
  const cost = amount * EXCHANGE_RATE;
  if (!tx.spend(cost)) throw new CoreError('funds', 'Pas assez de jetons.');
  tx.addBlackPrize(amount);
  return tx.done({ amount, cost });
}

/** Verse en une fois les recompenses des hauts faits obtenus auparavant. */
export function claimAchievements(
  state: PlayerState,
  ctx: Ctx,
): Outcome<{ amount: number; count: number }> {
  const tx = new Tx(state, ctx);
  const ids = unpaidAchievements(tx.s);
  if (ids.length === 0) {
    throw new CoreError('state', 'Aucune récompense de haut fait en attente.');
  }
  let amount = 0;
  for (const id of ids) amount += tx.pay(id);
  tx.notify({
    kind: 'reward',
    title: 'Hauts faits récompensés',
    text: `+${formatNumber(amount)} jetons pour ${ids.length} hauts faits.`,
  });
  return tx.done({ amount, count: ids.length });
}

/**
 * Atelier (niveau L): enregistre une composition et equipe l'objet sur
 * mesure correspondant. Chaque piece doit venir de la collection du joueur.
 */
export function saveAtelier(
  state: PlayerState,
  slot: AtelierSlot,
  config: AtelierConfig,
  ctx: Ctx,
): Outcome<{ slot: AtelierSlot; config: AtelierConfig }> {
  const tx = new Tx(state, ctx);
  const level = tx.s.legend.level;
  if (level < ATELIER_LEVEL) {
    throw new CoreError('locked', 'L’Atelier s’ouvre au niveau Légendaire L.');
  }
  const { owned } = tx.s.inventory;
  const lifetime = tx.s.wallet.lifetimeEarned;
  const clean = validAtelier(slot, config, (item) =>
    ownsCosmetic(item, owned, lifetime, level),
  );
  if (!clean) {
    throw new CoreError(
      'locked',
      'Chaque pièce doit venir d’un objet de ta collection.',
    );
  }
  const def = atelierSlot(slot);
  tx.s.legend.atelier = { ...tx.s.legend.atelier, [slot]: clean };
  tx.s.equipped[SLOT_OF[def.category]] = def.itemId;
  return tx.done({ slot, config: clean });
}
