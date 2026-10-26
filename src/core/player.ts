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
import {
  ACHIEVEMENT_BY_ID,
  achievementReward,
  progressAchievements,
} from '../state/achievements';
import {
  activeMissions,
  advance,
  findMission,
  isClaimable,
  type MissionEvent,
  type MissionScope,
  type PeriodProgress,
} from '../state/missions';
import {
  ASCENSION_GIFT,
  blackFor,
  canAscend,
  emptyLegend,
  legendLabel,
  legendLevelFor,
  levelReward,
} from '../state/legend';
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
    perks: { lastGift: null, paidAchievements: [] },
    legend: emptyLegend(),
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

/** Modifications successives d'un etat de joueur, sur une copie. */
export class Tx {
  readonly s: PlayerState;
  readonly notices: Notice[] = [];
  /** Hauts faits debloques pendant cette transaction. */
  private unlocked: string[] = [];
  /** Jetons noirs gagnes pendant cette transaction. */
  blackGained = 0;

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
    this.updateLegend();
  }

  /**
   * Rang Legendaire: accession des que les deux conditions sont reunies,
   * puis un niveau de plus a chaque palier de renom (avec sa prime).
   */
  updateLegend(): void {
    const legend = this.s.legend;
    const lifetime = this.s.wallet.lifetimeEarned;
    if (legend.level === 0) {
      if (!canAscend(lifetime, legend.tableWins)) return;
      legend.level = 1;
      legend.base = lifetime;
      legend.ascendedAt = this.ctx.now;
      this.addBlackPrize(ASCENSION_GIFT);
      this.notify({
        kind: 'legend',
        title: legendLabel(1),
        text: `Tout ce qui précède n’était que le tutoriel. ${ASCENSION_GIFT} jetons noirs pour commencer.`,
      });
      return;
    }
    const target = legendLevelFor(lifetime - legend.base);
    if (!Number.isFinite(target) || target <= legend.level) return;
    let prize = 0;
    while (legend.level < target) {
      legend.level += 1;
      prize += levelReward(legend.level);
    }
    this.addBlackPrize(prize);
    this.notify({
      kind: 'level',
      title: legendLabel(legend.level),
      text: `Nouveau niveau Légendaire. +${formatNumber(prize)} jetons noirs.`,
    });
  }

  /** Verse des jetons noirs tels quels (primes fixes, change). */
  addBlackPrize(amount: number): void {
    if (!(amount > 0)) return;
    const legend = this.s.legend;
    legend.black += amount;
    legend.blackEarned += amount;
    this.blackGained += amount;
  }

  /**
   * Gain de jetons noirs: la base est multipliee par le taux du niveau.
   * Rien tant que le joueur n'est pas Legendaire.
   */
  earnBlack(base: number): number {
    const amount = blackFor(base, this.s.legend.level);
    this.addBlackPrize(amount);
    return amount;
  }

  /** Depense des jetons noirs; refuse (faux) si le solde ne suffit pas. */
  spendBlack(amount: number): boolean {
    const legend = this.s.legend;
    if (amount < 0 || legend.black < amount) return false;
    legend.black -= amount;
    legend.blackSpent += amount;
    return true;
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

  /**
   * Accorde des hauts faits (annonces a la fin de la transaction) et verse
   * aussitot leur recompense en jetons.
   */
  grant(ids: string[]): void {
    for (const id of new Set(ids)) {
      if (this.s.achievements[id] || !ACHIEVEMENT_BY_ID.has(id)) continue;
      this.s.achievements[id] = this.ctx.now;
      this.unlocked.push(id);
      this.pay(id);
    }
  }

  /** Verse la recompense d'un haut fait, une seule fois. */
  pay(id: string): number {
    const paid = this.s.perks.paidAchievements;
    if (paid.includes(id)) return 0;
    paid.push(id);
    const amount = achievementReward(id);
    this.credit(amount);
    return amount;
  }

  /**
   * Annonce les hauts faits debloques. Au-dela de deux d'un coup (par
   * exemple les paliers rattrapes d'une ancienne progression), un seul
   * message les resume.
   */
  private announce(): void {
    const list = this.unlocked.flatMap((id) => {
      const a = ACHIEVEMENT_BY_ID.get(id);
      return a ? [a] : [];
    });
    this.unlocked = [];
    if (list.length <= 2) {
      for (const a of list) {
        this.notify({
          kind: 'achievement',
          title: a.title,
          text: `${a.description} +${formatNumber(achievementReward(a.id))} jetons.`,
        });
      }
      return;
    }
    const names = list.slice(0, 3).map((a) => a.title);
    const total = list.reduce((sum, a) => sum + achievementReward(a.id), 0);
    this.notify({
      kind: 'achievement',
      title: `${list.length} hauts faits débloqués`,
      text: `${names.join(', ')}${list.length > 3 ? '…' : '.'} +${formatNumber(total)} jetons.`,
    });
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
    // Les paliers suivent la progression: on les verifie a chaque fois. Une
    // recompense peut elle-meme faire monter de rang, d'ou la boucle.
    for (let i = 0; i < 4; i++) {
      const before = this.unlocked.length;
      this.grant(progressAchievements(this.s));
      if (this.unlocked.length === before) break;
    }
    this.announce();
    return { state: this.s, notices: this.notices, result };
  }
}

export type { MissionScope };
export { findMission };
