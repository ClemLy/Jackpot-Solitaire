// Cycle d'une manche: donne, rejeu du journal, resultat et decisions du
// Jackpot. C'est ici que se calculent tous les jetons gagnes ou perdus.

import {
  SCORE,
  applyMove,
  createRng,
  deal,
  endGameBonuses,
  isDeadlock,
  isWon,
  reshuffleStock,
  scoreForOutcome,
  type Board,
  type EndBonuses,
} from '../engine';
import {
  CHRONO_LIMIT_MS,
  CHRONO_POINTS_PER_SECOND,
  DAILY_BONUS,
  FAST_BET_MS,
  GUARANTEED_PAYOUT,
  INSURANCE_REFUND,
  PROGRESSIVE_BET_SHARE,
  VEGAS_STAKE,
  findDifficulty,
  findSideBet,
  findStakeTable,
  meetsTier,
  progressiveContribution,
  sideBetStake,
  tipForWin,
  vegasCardValue,
  vegasRecycles,
  type DifficultyId,
  type SideBetId,
  type StakeTableId,
} from '../state/catalog';
import { satisfiedAchievements } from '../state/achievements';
import {
  comboMultiplier,
  drawVaultOutcome,
  vaultUnlocked,
} from '../state/gambling';
import { formatNumber } from '../utils/format';
import { emptySession, Tx } from './player';
import {
  CoreError,
  type BetResult,
  type Ctx,
  type EndReason,
  type GameMode,
  type LogEntry,
  type LostSummary,
  type Outcome,
  type PlayerState,
  type Round,
  type VegasSummary,
  type WinSummary,
} from './types';

/** Graine de la partie guidee: une donne douce ou les premiers coups sont evidents. */
export const TUTORIAL_SEED = 'tutoriel-croupier';

/** Tolerance sur le chrono: latence du reseau et animation de la donne. */
const CHRONO_GRACE_MS = 10_000;

/** Longueur maximale d'un journal de manche (garde-fou contre les abus). */
export const MAX_LOG = 5000;

export function isScoring(mode: GameMode): boolean {
  return mode !== 'zen' && mode !== 'vegas';
}

/** Annuler est interdit a Vegas: on pourrait sinon espionner la pioche. */
export function canUndoIn(mode: GameMode): boolean {
  return mode !== 'vegas';
}

export function dailySeedFor(today: string): string {
  return `defi-${today}`;
}

/** Graine d'une donne garantie: prefixe impose par la session, puis un rang. */
export function guaranteedSeedOk(seed: string, nonce: string): boolean {
  return new RegExp(`^${nonce}-\\d{1,3}$`).test(seed);
}

function randomSeed(random: () => number): string {
  return String(Math.floor(random() * 900000) + 100000);
}

function newRoundId(random: () => number): string {
  return Array.from({ length: 4 }, () =>
    Math.floor(random() * 0x10000)
      .toString(16)
      .padStart(4, '0'),
  ).join('');
}

/** Ce qu'une donne garantie rapporte en moins, et la valeur d'une carte a Vegas. */
export function payoutOf(round: Pick<Round, 'difficulty' | 'seedSource'>) {
  return (
    findDifficulty(round.difficulty).payout *
    (round.seedSource === 'guaranteed' ? GUARANTEED_PAYOUT : 1)
  );
}

export function vegasValueOf(
  round: Pick<Round, 'difficulty' | 'seedSource'>,
): number {
  const base = vegasCardValue(round.difficulty);
  return round.seedSource === 'guaranteed'
    ? Math.max(1, Math.round(base * GUARANTEED_PAYOUT))
    : base;
}

export function foundationCount(board: Board): number {
  return board.foundations.reduce((n, pile) => n + pile.length, 0);
}

/** La donne d'une manche, telle que le serveur et le joueur la voient. */
export function boardOf(round: Round): Board {
  return deal(round.seed, round.drawCount, {
    gentle: round.gentle,
    recycles: round.recycles,
  });
}

/** Graine du remelange: deterministe, pour que le serveur le rejoue. */
export function reshuffleSeed(round: Round, moves: number, n: number): string {
  return `${round.seed}-remelange-${moves}-${n}`;
}

export type StartRequest =
  | {
      kind: 'new';
      mode: GameMode;
      difficulty: DifficultyId;
      table?: StakeTableId;
      /** Graine imposee (partage, saisie): la partie ne rapporte rien. */
      seed?: string;
      /** Graine d'une donne garantie, cherchee par le joueur. */
      guaranteedSeed?: string;
      tutorial?: boolean;
    }
  | {
      kind: 'double' | 'half';
      difficulty: DifficultyId;
      insure: boolean;
      guaranteedSeed?: string;
    }
  | {
      kind: 'second' | 'fromScore';
      difficulty: DifficultyId;
      guaranteedSeed?: string;
    };

/**
 * Donne une nouvelle manche. Selon la demande: nouvelle partie, quitte ou
 * double, moitie a l'abri, seconde chance, ou mise d'une victoire.
 */
export function startRound(
  state: PlayerState,
  req: StartRequest,
  ctx: Ctx,
): Outcome<{ round: Round }> {
  const tx = new Tx(state, ctx);
  const session = tx.s.session;

  // Une manche restee ouverte (onglet ferme, coupure) compte comme un abandon.
  if (session.round) abandon(tx, session.round, []);

  let mode: GameMode = 'gambling';
  let difficulty = req.difficulty;
  let seed: string | null = null;
  let seedSource: Round['seedSource'] = 'random';
  let vegasStake = 0;

  if (req.kind === 'new') {
    mode = req.mode;
    // Partir en laissant un magot en suspens, c'est l'abandonner.
    if (session.awaiting !== 'none' || session.pot > 0) tx.settleBust();
    session.lastScoredWin = null;

    if (mode === 'vegas') {
      if (!tx.spend(VEGAS_STAKE)) {
        throw new CoreError(
          'funds',
          `Une donne de Vegas coûte ${VEGAS_STAKE} jetons.`,
        );
      }
      vegasStake = VEGAS_STAKE;
    }

    if (mode === 'gambling') {
      // On s'assoit a une table: la mise quitte la banque pour le magot. Une
      // table hors de portee (solde ou rang) ramene a la table libre.
      let table = findStakeTable(req.table ?? 'free');
      if (
        table.stake > tx.s.wallet.balance ||
        !meetsTier(tx.s.wallet.lifetimeEarned, table.minTier) ||
        !tx.spend(table.stake)
      ) {
        table = findStakeTable('free');
      }
      session.table = table.id;
      session.pot = table.stake;
      session.combo = 0;
      session.insured = false;
    } else {
      session.pot = 0;
      session.combo = 0;
      session.insured = false;
    }

    if (req.tutorial) {
      mode = 'classic';
      difficulty = 'easy';
      seed = TUTORIAL_SEED;
      seedSource = 'tutorial';
    } else if (mode === 'daily') {
      seed = dailySeedFor(ctx.today);
      seedSource = 'daily';
    } else if (req.seed && mode !== 'gambling' && mode !== 'vegas') {
      seed = req.seed.slice(0, 48);
      seedSource = 'custom';
    }
  } else if (req.kind === 'double' || req.kind === 'half') {
    if (session.awaiting !== 'decision') {
      throw new CoreError('state', 'Aucune manche gagnée à rejouer.');
    }
    if (req.kind === 'half') {
      const half = Math.floor(session.pot / 2);
      if (half <= 0) throw new CoreError('state', 'Le magot est vide.');
      tx.secureBank(half, session.combo);
      session.pot -= half;
    }
    // L'assurance couvre uniquement la manche qui s'ouvre.
    session.insured = req.insure && tx.useConsumable('insurance');
  } else if (req.kind === 'second') {
    if (session.awaiting !== 'lost' || session.pot <= 0) {
      throw new CoreError('state', 'Aucun magot à sauver.');
    }
    if (!tx.useConsumable('redeal')) {
      throw new CoreError('funds', 'Il te faut une seconde chance.');
    }
  } else {
    if (!session.lastScoredWin) {
      throw new CoreError('state', 'Aucune victoire à miser.');
    }
    session.pot = session.lastScoredWin.score;
    session.combo = 1;
    session.table = 'free';
    session.insured = false;
  }

  if (req.kind !== 'new') session.lastScoredWin = null;
  session.awaiting = 'none';
  session.vaultEligible = false;
  session.vaultResult = null;

  if (seed === null) {
    if (
      req.guaranteedSeed &&
      guaranteedSeedOk(req.guaranteedSeed, session.nonce)
    ) {
      seed = req.guaranteedSeed;
      seedSource = 'guaranteed';
    } else {
      seed = randomSeed(ctx.random);
    }
  }

  const { drawCount, gentle } = findDifficulty(difficulty);
  const round: Round = {
    id: newRoundId(ctx.random),
    mode,
    difficulty,
    seed,
    seedSource,
    drawCount,
    gentle,
    ...(mode === 'vegas' ? { recycles: vegasRecycles(drawCount) } : {}),
    table: mode === 'gambling' ? session.table : 'free',
    startedAt: ctx.now,
    vegasStake,
    sideBetStake: sideBetStake(mode === 'gambling' ? session.table : 'free'),
  };

  if (seedSource !== 'custom') tx.s.stats.gamesPlayed += 1;
  if (mode === 'gambling') {
    tx.feedProgressive(progressiveContribution(round.table));
  }
  session.round = round;
  session.nonce = emptySession(ctx.random).nonce;
  return tx.done({ round });
}

/** Ce que le rejeu d'un journal a produit. */
export interface Replay {
  board: Board;
  score: number;
  moves: number;
  undoCount: number;
  invalidMoves: number;
  usedHint: boolean;
  usedJoker: boolean;
  bets: SideBetId[];
  /** Faux si le journal contient un coup impossible ou un bonus absent. */
  valid: boolean;
}

/**
 * Rejoue un journal de manche depuis la donne, en consommant au passage les
 * bonus utilises (indices offerts, jokers). Un coup illegal ou un bonus
 * absent invalide tout le journal.
 */
export function replay(tx: Tx, round: Round, log: LogEntry[]): Replay {
  const scoring = isScoring(round.mode);
  let board = boardOf(round);
  let score = 0;
  let moves = 0;
  let reshuffles = 0;
  // Vrai des la premiere action autre qu'un pari (coup, indice, joker...).
  let acted = false;
  const history: { board: Board; score: number; moves: number }[] = [];
  const out: Replay = {
    board,
    score,
    moves,
    undoCount: 0,
    invalidMoves: 0,
    usedHint: false,
    usedJoker: false,
    bets: [],
    valid: log.length <= MAX_LOG,
  };
  if (!out.valid) return out;

  const fail = (): Replay => ({ ...out, board, score, moves, valid: false });

  for (const entry of log) {
    // Un coup refuse ne revele rien de la donne: il laisse les paris ouverts.
    if (entry.t !== 'bet' && entry.t !== 'invalid') acted = true;
    switch (entry.t) {
      case 'move': {
        let result = applyMove(board, entry.move);
        if (!result && entry.wild) {
          result = applyMove(board, entry.move, { wild: true });
          if (!result || !tx.useConsumable('joker')) return fail();
          out.usedJoker = true;
        }
        if (!result) return fail();
        history.push({ board, score, moves });
        board = result.board;
        score += scoring ? scoreForOutcome(result.outcome, round.drawCount) : 0;
        moves += 1;
        break;
      }
      case 'undo': {
        const previous = history.pop();
        if (!previous || !canUndoIn(round.mode)) return fail();
        board = previous.board;
        moves = previous.moves;
        score = scoring ? previous.score + SCORE.undoPenalty : previous.score;
        out.undoCount += 1;
        break;
      }
      case 'hint': {
        out.usedHint = true;
        // Un Oeil du croupier en reserve offre l'indice sans penalite.
        const free = scoring && tx.useConsumable('hint');
        if (scoring && !free) score += SCORE.hintPenalty;
        break;
      }
      case 'invalid':
        out.invalidMoves += 1;
        if (scoring) score += SCORE.invalidPenalty;
        break;
      case 'peek': {
        const hidden = board.tableau.some((col) =>
          col.some((c) => c.id === entry.card && !c.faceUp),
        );
        if (!hidden || !tx.useConsumable('peek')) return fail();
        out.usedJoker = true;
        break;
      }
      case 'reshuffle': {
        const shuffled = reshuffleStock(
          board,
          createRng(reshuffleSeed(round, moves, reshuffles)),
        );
        if (!shuffled || !tx.useConsumable('reshuffle')) return fail();
        reshuffles += 1;
        history.push({ board, score, moves });
        board = shuffled;
        out.usedJoker = true;
        break;
      }
      case 'bet': {
        // Les paris se posent avant le premier coup, au Jackpot seulement.
        if (round.mode !== 'gambling' || acted) return fail();
        out.bets = out.bets.includes(entry.id)
          ? out.bets.filter((b) => b !== entry.id)
          : [...out.bets, entry.id];
        break;
      }
      default:
        return fail();
    }
  }
  return { ...out, board, score, moves };
}

/** Paie les cartes rangees d'une donne de Vegas. */
function settleVegas(tx: Tx, round: Round, board: Board): VegasSummary | null {
  if (round.mode !== 'vegas' || round.vegasStake <= 0) return null;
  const cards = foundationCount(board);
  const cardValue = vegasValueOf(round);
  const earned = cards * cardValue;
  tx.credit(earned);
  return {
    stake: round.vegasStake,
    cards,
    cardValue,
    earned,
    net: earned - round.vegasStake,
  };
}

/** Debite les paris annexes poses (autant que la banque le permet). */
function chargeBets(tx: Tx, round: Round, bets: SideBetId[]): SideBetId[] {
  const kept: SideBetId[] = [];
  for (const id of bets) {
    if (tx.spend(round.sideBetStake)) kept.push(id);
  }
  return kept;
}

/** Les paris d'une manche perdue: une part nourrit la cagnotte. */
function loseBets(tx: Tx, round: Round, bets: SideBetId[]): number {
  const lost = bets.length * round.sideBetStake;
  tx.feedProgressive(lost * PROGRESSIVE_BET_SHARE);
  return lost;
}

function resolveGame(
  tx: Tx,
  round: Round,
  won: boolean,
  r: { timeMs: number; moves: number; score: number; replay: Replay },
): void {
  const stats = tx.s.stats;
  const daily = tx.s.daily;
  const isDaily = round.mode === 'daily';
  if (isDaily) daily.lastPlayed = tx.ctx.today;
  if (won) {
    stats.gamesWon += 1;
    stats.currentWinStreak += 1;
    stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentWinStreak);
    stats.bestScore = Math.max(stats.bestScore, r.score);
    stats.sumWinTimeMs += r.timeMs;
    stats.sumWinMoves += r.moves;
    if (stats.bestTimeMs === null || r.timeMs < stats.bestTimeMs) {
      stats.bestTimeMs = r.timeMs;
    }
    if (isDaily && !daily.completedDates.includes(tx.ctx.today)) {
      daily.completedDates.push(tx.ctx.today);
    }
  } else {
    stats.currentWinStreak = 0;
  }
  tx.grant(
    satisfiedAchievements({
      won,
      timeMs: r.timeMs,
      drawCount: round.drawCount,
      invalidMoves: r.replay.invalidMoves,
      undoCount: r.replay.undoCount,
      usedHint: r.replay.usedHint,
      isDaily,
      dailyCompletedCount: daily.completedDates.length,
      currentWinStreak: stats.currentWinStreak,
      securedAmount: 0,
      gamblingStreak: 0,
      vaultOpened: false,
    }),
  );
}

/**
 * Quitter une manche en cours: Vegas paie les cartes deja rangees, les paris
 * sont perdus, les missions comptent les cartes posees, et un magot en jeu
 * part avec la manche (l'assurance en rend une part).
 */
function abandon(
  tx: Tx,
  round: Round,
  log: LogEntry[],
): { vegas: VegasSummary | null; refund: number } {
  const r = replay(tx, round, log);
  const vegas = settleVegas(tx, round, r.board);
  if (vegas && vegas.earned > 0) {
    tx.notify({
      kind: 'reward',
      title: 'Vegas: cartes payées',
      text: `${vegas.cards} cartes rangées, ${formatNumber(vegas.earned)} jetons pour ta banque.`,
    });
  }
  loseBets(tx, round, chargeBets(tx, round, r.bets));
  if (r.moves > 0 && round.seedSource !== 'custom') {
    tx.recordMission({
      kind: 'game',
      won: false,
      mode: round.mode,
      difficulty: round.difficulty,
      timeMs: tx.ctx.now - round.startedAt,
      undoCount: r.undoCount,
      usedHint: r.usedHint,
      foundationCards: foundationCount(r.board),
      vegasNet: vegas?.net,
    });
  }
  tx.s.session.round = null;
  const refund = round.mode === 'gambling' ? tx.settleBust() : 0;
  return { vegas, refund };
}

export type FinishResult =
  | { outcome: 'win'; win: WinSummary }
  | { outcome: 'lost'; lost: LostSummary }
  | { outcome: 'abandon'; vegas: VegasSummary | null; refund: number };

/**
 * Termine la manche en cours: le journal est rejoue depuis la donne, et
 * l'issue est etablie par le rejeu lui-meme, pas par ce qu'annonce le
 * joueur. Une victoire doit etre une vraie victoire, un blocage un vrai
 * blocage, un temps ecoule un vrai temps ecoule.
 */
export function finishRound(
  state: PlayerState,
  req: { roundId: string; log: LogEntry[]; reason: EndReason },
  ctx: Ctx,
): Outcome<FinishResult> {
  const tx = new Tx(state, ctx);
  const round = tx.s.session.round;
  if (!round || round.id !== req.roundId) {
    throw new CoreError('stale', 'Cette manche est déjà terminée.');
  }
  const elapsed = Math.max(0, ctx.now - round.startedAt);
  const r = replay(tx, round, req.log);

  if (!r.valid) {
    // Journal impossible: bug ou triche. La manche est perdue comme un abandon.
    const fresh = new Tx(state, ctx);
    const res = abandon(fresh, round, []);
    fresh.notify({
      kind: 'error',
      title: 'Partie non reconnue',
      text: 'Le croupier n’a pas pu valider cette manche: elle compte comme abandonnée.',
    });
    return fresh.done<FinishResult>({ outcome: 'abandon', ...res });
  }

  const chrono = round.mode === 'chrono';
  const timeUp = chrono && elapsed >= CHRONO_LIMIT_MS - 3000;
  const won =
    isWon(r.board) && !(chrono && elapsed > CHRONO_LIMIT_MS + CHRONO_GRACE_MS);

  if (won)
    return tx.done<FinishResult>({
      outcome: 'win',
      win: win(tx, round, r, elapsed),
    });

  const lostBy: LostSummary['reason'] | null =
    (req.reason === 'time' || isWon(r.board)) && timeUp
      ? 'time'
      : req.reason === 'deadlock' && isDeadlock(r.board)
        ? 'deadlock'
        : null;
  if (lostBy) {
    return tx.done<FinishResult>({
      outcome: 'lost',
      lost: lost(tx, round, r, lostBy, elapsed),
    });
  }

  // On rejoue a nouveau dans une transaction neuve: le premier rejeu a deja
  // consomme les bonus.
  const fresh = new Tx(state, ctx);
  const res = abandon(fresh, round, req.log);
  return fresh.done<FinishResult>({ outcome: 'abandon', ...res });
}

function win(tx: Tx, round: Round, r: Replay, timeMs: number): WinSummary {
  const s = tx.s;
  const session = s.session;
  const scoring = isScoring(round.mode);
  const unpaid = round.seedSource === 'custom';
  let bonuses: EndBonuses = { speed: 0, precision: 0, total: 0 };
  if (scoring) {
    bonuses = endGameBonuses({
      elapsedSeconds: timeMs / 1000,
      invalidMoves: r.invalidMoves,
      undoCount: r.undoCount,
    });
    if (round.mode === 'chrono') {
      // Au Chrono, le bonus de vitesse est remplace par les secondes
      // restantes au compte a rebours.
      const left = Math.max(0, CHRONO_LIMIT_MS - timeMs);
      const speed = Math.floor(left / 1000) * CHRONO_POINTS_PER_SECOND;
      bonuses = { ...bonuses, speed, total: speed + bonuses.precision };
    }
  }
  const baseScore = r.score;
  const roundScore = baseScore + bonuses.total;
  const firstDailyWin =
    round.mode === 'daily' && !s.daily.completedDates.includes(tx.ctx.today);

  if (!unpaid) {
    resolveGame(tx, round, true, {
      timeMs,
      moves: r.moves,
      score: roundScore,
      replay: r,
    });
  }

  const table = findStakeTable(round.table);
  const gambling = round.mode === 'gambling';
  const tableMultiplier = gambling ? table.multiplier : 1;
  const difficultyMultiplier = findDifficulty(round.difficulty).payout;
  const guaranteedMultiplier =
    round.seedSource === 'guaranteed' ? GUARANTEED_PAYOUT : 1;
  const payout = payoutOf(round);
  let multiplier = 1;
  let gain = roundScore;
  const potBefore = session.pot;

  if (gambling) {
    multiplier = comboMultiplier(session.combo);
    gain = Math.round(roundScore * multiplier * tableMultiplier * payout);
    // Le magot lui-meme ne descend jamais sous zero.
    session.pot = Math.max(0, session.pot + gain);
    session.combo += 1;
    if (table.id === 'diamond') tx.grant(['high-stakes']);
  }

  // Paris annexes: payes directement a la banque si la condition tient.
  const placed = chargeBets(tx, round, r.bets);
  const bets: BetResult[] = placed.map((id) => {
    const ok =
      id === 'no-hint'
        ? !r.usedHint
        : id === 'no-undo'
          ? r.undoCount === 0
          : timeMs < FAST_BET_MS;
    return {
      id,
      stake: round.sideBetStake,
      won: ok,
      payout: ok ? round.sideBetStake * (findSideBet(id).odds + 1) : 0,
    };
  });
  tx.credit(bets.reduce((n, b) => n + b.payout, 0));
  tx.feedProgressive(
    bets.filter((b) => !b.won).length *
      round.sideBetStake *
      PROGRESSIVE_BET_SHARE,
  );

  // Jackpot progressif: l'exploit, sans la moindre aide.
  const progressive =
    gambling &&
    round.difficulty === 'expert' &&
    table.stake > 0 &&
    round.seedSource === 'random' &&
    r.undoCount === 0 &&
    !r.usedHint &&
    !r.usedJoker
      ? tx.winProgressive()
      : 0;

  // Hors Jackpot et Vegas, une victoire verse un pourboire a la banque.
  const tip =
    unpaid || round.mode === 'vegas'
      ? 0
      : tipForWin(round.mode, roundScore, payout);
  const dailyBonus = firstDailyWin ? DAILY_BONUS : 0;
  tx.credit(tip + dailyBonus);

  const vegas = settleVegas(tx, round, r.board);

  if (!unpaid) {
    tx.recordMission({
      kind: 'game',
      won: true,
      mode: round.mode,
      difficulty: round.difficulty,
      timeMs,
      undoCount: r.undoCount,
      usedHint: r.usedHint,
      foundationCards: 52,
      vegasNet: vegas?.net,
    });
    if (gambling) tx.recordMission({ kind: 'streak', length: session.combo });
  }

  session.round = null;
  if (gambling) {
    session.awaiting = 'decision';
    session.vaultEligible = vaultUnlocked(session.combo);
  } else {
    session.lastScoredWin =
      scoring && !unpaid
        ? { score: roundScore, difficulty: round.difficulty }
        : null;
  }

  return {
    roundScore,
    bonuses,
    baseScore,
    multiplier,
    tableMultiplier,
    difficultyMultiplier,
    guaranteedMultiplier,
    gain,
    potBefore,
    potAfter: session.pot,
    vaultEligible: session.vaultEligible,
    tip,
    dailyBonus,
    moves: r.moves,
    timeMs,
    bets,
    progressive,
    vegas,
    unpaid,
  };
}

function lost(
  tx: Tx,
  round: Round,
  r: Replay,
  reason: LostSummary['reason'],
  elapsed: number,
): LostSummary {
  const session = tx.s.session;
  const timeMs = reason === 'time' ? CHRONO_LIMIT_MS : elapsed;
  if (round.seedSource !== 'custom') {
    resolveGame(tx, round, false, {
      timeMs,
      moves: r.moves,
      score: r.score,
      replay: r,
    });
  }
  const vegas = settleVegas(tx, round, r.board);
  const betsLost = loseBets(tx, round, chargeBets(tx, round, r.bets));
  if (round.seedSource !== 'custom') {
    tx.recordMission({
      kind: 'game',
      won: false,
      mode: round.mode,
      difficulty: round.difficulty,
      timeMs,
      undoCount: r.undoCount,
      usedHint: r.usedHint,
      foundationCards: foundationCount(r.board),
      vegasNet: vegas?.net,
    });
  }
  session.round = null;
  // Le magot reste en suspens tant que le joueur n'a pas choisi: une seconde
  // chance peut encore le sauver.
  const wasGambling = round.mode === 'gambling' && session.pot > 0;
  session.awaiting = wasGambling ? 'lost' : 'none';
  return {
    reason,
    finalScore: r.score,
    timeMs,
    wasGambling,
    potLost: wasGambling ? session.pot : 0,
    refund:
      wasGambling && session.insured
        ? Math.round(session.pot * INSURANCE_REFUND)
        : 0,
    betsLost,
    vegas,
  };
}

export type Decision = 'cash' | 'vault' | 'leave';

/**
 * Decisions entre deux manches: encaisser le magot, ouvrir le coffre, ou
 * quitter la table (le magot en suspens est alors perdu).
 */
export function decide(
  state: PlayerState,
  decision: Decision,
  ctx: Ctx,
): Outcome<{ pot: number; vault?: { multiplier: number; trapped: boolean } }> {
  const tx = new Tx(state, ctx);
  const session = tx.s.session;

  if (decision === 'cash') {
    if (session.awaiting !== 'decision') {
      throw new CoreError('state', 'Rien à encaisser.');
    }
    const amount = session.pot;
    tx.secureBank(amount, session.combo);
    session.pot = 0;
    session.combo = 0;
    session.insured = false;
    session.awaiting = 'none';
    session.vaultEligible = false;
    session.vaultResult = null;
    return tx.done({ pot: amount });
  }

  if (decision === 'vault') {
    if (
      session.awaiting !== 'decision' ||
      !session.vaultEligible ||
      session.vaultResult
    ) {
      throw new CoreError('state', 'Le coffre est fermé.');
    }
    const vault = drawVaultOutcome(ctx.random());
    session.pot = Math.max(0, Math.round(session.pot * vault.multiplier));
    session.vaultResult = vault;
    tx.s.gambling.vaultsOpened += 1;
    tx.recordMission({ kind: 'vault' });
    tx.grant(['treasure-hunter']);
    return tx.done({ pot: session.pot, vault });
  }

  // Quitter: un magot en suspens (manche perdue, ou gagnee non encaissee)
  // est perdu; l'assurance eventuelle en rend une part.
  if (session.round) abandon(tx, session.round, []);
  if (session.pot > 0 || session.awaiting !== 'none') tx.settleBust();
  session.lastScoredWin = null;
  return tx.done({ pot: 0 });
}
