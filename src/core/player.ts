// Etat initial du joueur et transaction: une copie de l'etat qu'on modifie
// pas a pas (crediter, depenser, accorder un haut fait...), en notant les
// messages a montrer au joueur.

import {
  CONSUMABLES,
  DEFAULT_CARD_BACK,
  DEFAULT_CARD_FACE,
  DEFAULT_TABLE,
  DEFAULT_TITLE,
  DEFAULT_VICTORY_FX,
  INSURANCE_REFUND,
  PROGRESSIVE_SEED,
  WELCOME_GIFT,
  tierIndex,
  vipTierFor,
  type ConsumableId,
} from '../state/catalog';
import { ACHIEVEMENTS, satisfiedAchievements } from '../state/achievements';
import {
  activeMissions,
  advance,
  findMission,
  isClaimable,
  type MissionEvent,
  type MissionScope,
  type PeriodProgress,
} from '../state/missions';
import { formatNumber } from '../utils/format';
import type { Ctx, Notice, PlayerState, Session } from './types';

export const DEFAULT_AVATAR = 'croupier';
export const DEFAULT_FRAME = 'cadre-simple';
export const DEFAULT_PROFILE_CARD = 'carte-felt';

export function emptyConsumables(): Record<ConsumableId, number> {
  return Object.fromEntries(CONSUMABLES.map((c) => [c.id, 0])) as Record<
    ConsumableId,
    number
  >;
}

function randomToken(random: () => number): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += Math.floor(random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  }
  return out;
}

export function emptySession(random: () => number = Math.random): Session {
  return {
    round: null,
    pot: 0,
    combo: 0,
    table: 'free',
    insured: false,
    awaiting: 'none',
    vaultEligible: false,
    vaultResult: null,
    lastScoredWin: null,
    nonce: randomToken(random),
  };
}

export function initialPlayer(
  ctx: Pick<Ctx, 'today' | 'week' | 'random'>,
): PlayerState {
  return {
    wallet: { balance: WELCOME_GIFT, lifetimeEarned: 0, spent: 0 },
    inventory: { owned: [], consumables: emptyConsumables() },
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      bestTimeMs: null,
      bestScore: 0,
      sumWinTimeMs: 0,
      sumWinMoves: 0,
    },
    gambling: {
      secured: 0,
      bestSecuredRun: 0,
      longestStreak: 0,
      vaultsOpened: 0,
    },
    daily: { completedDates: [], lastPlayed: null },
    achievements: {},
    wheel: { lastSpin: null },
    progressive: { pot: PROGRESSIVE_SEED, wins: 0 },
    missions: {
      daily: { key: ctx.today, progress: {}, claimed: [] },
      weekly: { key: ctx.week, progress: {}, claimed: [] },
    },
    perks: { lastGift: null },
    equipped: {
      cardBack: DEFAULT_CARD_BACK,
      cardFace: DEFAULT_CARD_FACE,
      table: DEFAULT_TABLE,
      victoryFx: DEFAULT_VICTORY_FX,
      title: DEFAULT_TITLE,
      avatar: DEFAULT_AVATAR,
      frame: DEFAULT_FRAME,
      profileCard: DEFAULT_PROFILE_CARD,
    },
    session: emptySession(ctx.random),
  };
}

/** Periode de missions a jour: une periode echue repart de zero. */
export function currentPeriod(
  period: PeriodProgress | undefined,
  key: string,
): PeriodProgress {
  return period && period.key === key
    ? period
    : { key, progress: {}, claimed: [] };
}

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Modifications successives d'un etat de joueur, sur une copie. */
export class Tx {
  readonly s: PlayerState;
  readonly notices: Notice[] = [];

  constructor(
    state: PlayerState,
    readonly ctx: Ctx,
  ) {
    this.s = structuredClone(state);
  }

  notify(notice: Notice): void {
    this.notices.push(notice);
  }

  /** Credite des jetons gagnes: ils comptent pour le rang VIP. */
  credit(amount: number): void {
    if (!(amount > 0)) return;
    const before = vipTierFor(this.s.wallet.lifetimeEarned);
    this.s.wallet.balance += amount;
    this.s.wallet.lifetimeEarned += amount;
    const after = vipTierFor(this.s.wallet.lifetimeEarned);
    if (after.id !== before.id) {
      this.notify({
        kind: 'vip',
        title: `Rang VIP ${after.label}`,
        text: `Bienvenue au rang ${after.label}: ${Math.round(after.discount * 100)} % de remise en boutique.`,
      });
      if (tierIndex(after.id) >= tierIndex('gold')) this.grant(['regular']);
    }
  }

  /** Depense des jetons; refuse (faux) si la banque ne suffit pas. */
  spend(amount: number): boolean {
    if (amount < 0 || this.s.wallet.balance < amount) return false;
    this.s.wallet.balance -= amount;
    this.s.wallet.spent += amount;
    return true;
  }

  useConsumable(id: ConsumableId): boolean {
    const count = this.s.inventory.consumables[id] ?? 0;
    if (count <= 0) return false;
    this.s.inventory.consumables[id] = count - 1;
    return true;
  }

  addConsumable(id: ConsumableId, n = 1): void {
    this.s.inventory.consumables[id] =
      (this.s.inventory.consumables[id] ?? 0) + n;
  }

  /** Accorde des hauts faits, avec un message pour chaque nouveau. */
  grant(ids: string[]): void {
    for (const id of new Set(ids)) {
      if (this.s.achievements[id]) continue;
      this.s.achievements[id] = this.ctx.now;
      const a = ACHIEVEMENT_BY_ID.get(id);
      if (a) {
        this.notify({
          kind: 'achievement',
          title: a.title,
          text: a.description,
        });
      }
    }
  }

  recordMission(event: MissionEvent): void {
    const keys = { daily: this.ctx.today, weekly: this.ctx.week } as const;
    for (const scope of ['daily', 'weekly'] as const) {
      const period = currentPeriod(this.s.missions[scope], keys[scope]);
      const after = advance(period, scope, event);
      this.s.missions[scope] = after;
      for (const def of activeMissions(scope, after.key)) {
        if (
          isClaimable(after, def) &&
          (period.progress[def.id] ?? 0) < def.target
        ) {
          this.notify({
            kind: 'reward',
            title: 'Mission accomplie',
            text: `${def.label}. Récupère ta récompense dans Missions.`,
          });
        }
      }
    }
  }

  /** Magot encaisse (ou perdu, montant nul): records, banque et missions. */
  secureBank(amount: number, runStreak: number): void {
    const g = this.s.gambling;
    g.secured += amount;
    g.bestSecuredRun = Math.max(g.bestSecuredRun, amount);
    g.longestStreak = Math.max(g.longestStreak, runStreak);
    if (amount > 0) {
      this.credit(amount);
      this.recordMission({ kind: 'secure', amount });
    }
    this.grant(
      satisfiedAchievements({
        won: false,
        timeMs: 0,
        drawCount: 1,
        invalidMoves: 0,
        undoCount: 0,
        usedHint: false,
        isDaily: false,
        dailyCompletedCount: this.s.daily.completedDates.length,
        currentWinStreak: this.s.stats.currentWinStreak,
        securedAmount: amount,
        gamblingStreak: runStreak,
        vaultOpened: false,
      }),
    );
  }

  feedProgressive(amount: number): void {
    if (!(amount > 0)) return;
    this.s.progressive.pot += Math.round(amount);
  }

  winProgressive(): number {
    const amount = this.s.progressive.pot;
    this.s.progressive = {
      pot: PROGRESSIVE_SEED,
      wins: this.s.progressive.wins + 1,
    };
    this.credit(amount);
    return amount;
  }

  /**
   * Le magot en jeu est perdu (abandon, ou depart apres une defaite).
   * L'assurance eventuelle en rend une part.
   */
  settleBust(): number {
    const session = this.s.session;
    let refund = 0;
    if (session.pot > 0) {
      this.secureBank(0, session.combo);
      if (session.insured) {
        refund = Math.round(session.pot * INSURANCE_REFUND);
        this.credit(refund);
        this.notify({
          kind: 'reward',
          title: 'L’assurance a payé',
          text: `${formatNumber(refund)} jetons sauvés du naufrage.`,
        });
      }
    }
    session.pot = 0;
    session.combo = 0;
    session.insured = false;
    session.awaiting = 'none';
    session.vaultEligible = false;
    session.vaultResult = null;
    return refund;
  }

  done<T>(result: T) {
    return { state: this.s, notices: this.notices, result };
  }
}

export type { MissionScope };
export { findMission };
