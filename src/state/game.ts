import { create } from 'zustand';
import {
  applyMove,
  canAutoComplete,
  canRecycle,
  createRng,
  deal,
  endGameBonuses,
  findHint,
  isDeadlock,
  isWon,
  nextAutoCompleteMove,
  reshuffleStock,
  scoreForOutcome,
  autoMoveFromTableau,
  autoMoveFromWaste,
  SCORE,
  type ApplyOptions,
  type Board,
  type DealConfig,
  type EndBonuses,
  type Move,
} from '../engine';
import { comboMultiplier, drawVaultOutcome, vaultUnlocked } from './gambling';
import { useMetaStore } from './meta';
import {
  CHRONO_LIMIT_MS,
  CHRONO_POINTS_PER_SECOND,
  DAILY_BONUS,
  DEFAULT_DIFFICULTY,
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
  type JokerId,
  type SideBetId,
  type StakeTableId,
} from './catalog';
import { prepareWinnableDeal, takeWinnableDeal } from './dealer';
import { playSound } from '../audio/sfx';
import { dailySeed, randomSeed, sanitizeSeed, todayISO } from '../utils/seed';
import { formatNumber } from '../utils/format';

export type GameMode =
  'classic' | 'gambling' | 'zen' | 'chrono' | 'daily' | 'vegas';

export const MODE_LABEL: Record<GameMode, string> = {
  classic: 'Classique',
  gambling: 'Jackpot',
  daily: 'Défi du jour',
  chrono: 'Chrono',
  zen: 'Zen',
  vegas: 'Vegas',
};
export type Route = 'home' | 'game';
export type Modal =
  | 'none'
  | 'rules'
  | 'stats'
  | 'settings'
  | 'newgame'
  | 'shop'
  | 'tables'
  | 'wheel'
  | 'missions'
  | 'confirmLeave';
export type Overlay = 'none' | 'win' | 'vault' | 'lost';

interface Snapshot {
  board: Board;
  score: number;
  moves: number;
}

/** Resultat d'un pari annexe, a la fin de la manche. */
export interface BetResult {
  id: SideBetId;
  stake: number;
  won: boolean;
  /** Jetons rendus a la banque (mise comprise), 0 si perdu. */
  payout: number;
}

/** Bilan d'une partie de Vegas. */
export interface VegasSummary {
  stake: number;
  cards: number;
  cardValue: number;
  earned: number;
  net: number;
}

export interface WinSummary {
  roundScore: number;
  bonuses: EndBonuses;
  baseScore: number;
  /** Multiplicateur de serie (quitte ou double). */
  multiplier: number;
  /** Multiplicateur de la table a mise. */
  tableMultiplier: number;
  /** Multiplicateur du niveau de difficulte. */
  difficultyMultiplier: number;
  /** Multiplicateur de la donne garantie (1 si donne au hasard). */
  guaranteedMultiplier: number;
  gain: number;
  potBefore: number;
  potAfter: number;
  vaultEligible: boolean;
  /** Jetons verses directement a la banque (hors Jackpot). */
  tip: number;
  dailyBonus: number;
  moves: number;
  bets: BetResult[];
  /** Jackpot progressif remporte sur cette manche (0 sinon). */
  progressive: number;
  vegas: VegasSummary | null;
}

export interface LostSummary {
  reason: 'deadlock' | 'time';
  finalScore: number;
  timeMs: number;
  wasGambling: boolean;
  potLost: number;
  /** Jetons rendus par l'assurance si la perte est confirmee. */
  refund: number;
  /** Mises des paris annexes perdues avec la manche. */
  betsLost: number;
  vegas: VegasSummary | null;
}

export interface NewGameOptions {
  mode?: GameMode;
  difficulty?: DifficultyId;
  seed?: string;
  table?: StakeTableId;
}

export type Phase = 'idle' | 'playing' | 'won' | 'lost';

interface GameStore {
  route: Route;
  modal: Modal;
  overlay: Overlay;

  mode: GameMode;
  difficulty: DifficultyId;
  drawCount: 1 | 3;
  seed: string;
  /** Donne prouvee gagnable (option des reglages). */
  guaranteed: boolean;
  /** Vrai pendant que le croupier cherche une donne gagnable. */
  preparing: boolean;
  /** Partie guidee du tutoriel. */
  tutorial: boolean;

  board: Board;
  phase: Phase;
  score: number;
  moves: number;
  invalidMoves: number;
  undoCount: number;
  hintCount: number;
  usedHint: boolean;
  usedJoker: boolean;
  startedAt: number | null;
  finalTimeMs: number;
  history: Snapshot[];
  autoAvailable: boolean;
  autoCompleting: boolean;

  pot: number;
  combo: number;
  stakeTable: StakeTableId;
  insured: boolean;
  /** Paris annexes poses sur la manche en cours. */
  sideBets: SideBetId[];
  sideBetStake: number;
  /** Mise payee pour la donne de Vegas en cours (0 une fois soldee). */
  vegasStake: number;

  /** Joker arme: le prochain glisser peut aller sur n'importe quelle colonne. */
  jokerArmed: boolean;
  /** Coup d'oeil en attente: le joueur doit toucher une carte cachee. */
  peekMode: boolean;
  /** Carte cachee actuellement devoilee par un coup d'oeil. */
  peekCard: string | null;

  /** Incremente a chaque distribution: declenche l'animation de donne. */
  dealId: number;
  /** Vrai si le dernier indice a ete offert par un Oeil du croupier. */
  freeHint: boolean;
  win: WinSummary | null;
  lost: LostSummary | null;
  vaultResult: {
    multiplier: number;
    trapped: boolean;
    potAfter: number;
  } | null;
  bust: number | null;

  hint: Move | null;
  hintNonce: number;
  shake: { id: string; nonce: number } | null;

  // Action differee, en attente de confirmation (voir requestLeave).
  pendingAction: (() => void) | null;

  // Navigation et fenetres.
  openModal: (modal: Modal) => void;
  closeModal: () => void;
  goHome: () => void;

  // Cycle de vie de la partie.
  newGame: (options?: NewGameOptions) => void;
  restartSameSeed: () => void;
  startTutorial: () => void;
  endTutorial: () => void;

  // Demande une action qui quitterait ou relancerait la partie: si un magot
  // est en jeu en mode Jackpot, on demande confirmation avant de l'executer,
  // sinon elle part directement.
  requestLeave: (action: () => void) => void;
  confirmPendingAction: () => void;
  cancelPendingAction: () => void;

  // Coups.
  clickStock: () => void;
  autoFromWaste: () => void;
  autoFromTableau: (column: number, index: number) => void;
  applyDragMove: (move: Move) => boolean;
  reportInvalid: (cardId: string) => void;
  undo: () => void;
  requestHint: () => void;
  clearHint: () => void;
  startAutoComplete: () => void;

  // Jokers.
  playJoker: (id: JokerId) => boolean;
  cancelJoker: () => void;
  peekAt: (cardId: string) => boolean;

  // Jackpot.
  toggleSideBet: (id: SideBetId) => boolean;
  cashOut: () => void;
  cashOutHalf: (insure?: boolean) => void;
  doubleOrNothing: (insure?: boolean) => void;
  secondChance: () => void;
  gambleFromScore: () => void;
  enterVault: () => void;
  openVault: () => void;
  dismissWin: () => void;
  dismissLost: () => void;
}

let autoTimer: ReturnType<typeof setTimeout> | null = null;
let shakeTimer: ReturnType<typeof setTimeout> | null = null;
let chronoTimer: ReturnType<typeof setTimeout> | null = null;
let peekTimer: ReturnType<typeof setTimeout> | null = null;
/** Jeton de la derniere demande de donne garantie: ignore les reponses perimees. */
let prepToken = 0;

/** Duree pendant laquelle un coup d'oeil montre la carte. */
export const PEEK_MS = 2600;

/** Graine de la partie guidee: une donne douce ou les premiers coups sont evidents. */
export const TUTORIAL_SEED = 'tutoriel-croupier';

function stopAutoTimer(): void {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function stopChrono(): void {
  if (chronoTimer) {
    clearTimeout(chronoTimer);
    chronoTimer = null;
  }
}

function stopTimers(): void {
  stopAutoTimer();
  stopChrono();
  if (peekTimer) {
    clearTimeout(peekTimer);
    peekTimer = null;
  }
}

/** Le mode compte-t-il des points (et donc des penalites) ? */
export function isScoring(mode: GameMode): boolean {
  return mode !== 'zen' && mode !== 'vegas';
}

/** Annuler est interdit a Vegas: on pourrait sinon espionner la pioche. */
export function canUndoIn(mode: GameMode): boolean {
  return mode !== 'vegas';
}

function isRiskingPot(state: GameStore): boolean {
  return state.mode === 'gambling' && state.pot > 0;
}

/**
 * Vrai quand le joueur a gagne une manche Jackpot et doit choisir entre
 * encaisser et doubler (bordereau de victoire ou coffre-fort ouvert). Les
 * actions d'argent verifient cet etat: un appel hors contexte (double clic,
 * bouton reste a l'ecran, console) ne doit jamais crediter ou relancer.
 */
function awaitingDecision(state: GameStore): boolean {
  return (
    state.mode === 'gambling' &&
    state.phase === 'won' &&
    (state.overlay === 'win' || state.overlay === 'vault')
  );
}

function insuranceRefund(state: GameStore): number {
  return state.insured ? Math.round(state.pot * INSURANCE_REFUND) : 0;
}

/** Les paris annexes ne se posent qu'avant le premier coup de la manche. */
export function betsOpen(state: {
  mode: GameMode;
  phase: Phase;
  moves: number;
  preparing: boolean;
}): boolean {
  return (
    state.mode === 'gambling' &&
    state.phase === 'playing' &&
    state.moves === 0 &&
    !state.preparing
  );
}

/** Multiplicateur total des gains: difficulte et donne garantie. */
function payoutOf(state: { difficulty: DifficultyId; guaranteed: boolean }) {
  return (
    findDifficulty(state.difficulty).payout *
    (state.guaranteed ? GUARANTEED_PAYOUT : 1)
  );
}

/** Valeur d'une carte rangee a Vegas pour la partie en cours. */
export function vegasValueOf(state: {
  difficulty: DifficultyId;
  guaranteed: boolean;
}): number {
  const base = vegasCardValue(state.difficulty);
  return state.guaranteed
    ? Math.max(1, Math.round(base * GUARANTEED_PAYOUT))
    : base;
}

export function foundationCount(board: Board): number {
  return board.foundations.reduce((n, pile) => n + pile.length, 0);
}

function dealConfig(mode: GameMode, difficulty: DifficultyId): DealConfig {
  const { drawCount, gentle } = findDifficulty(difficulty);
  return {
    drawCount,
    gentle,
    recycles: mode === 'vegas' ? vegasRecycles(drawCount) : undefined,
  };
}

export function computeElapsed(state: {
  phase: string;
  startedAt: number | null;
  finalTimeMs: number;
}): number {
  if (state.phase === 'won' || state.phase === 'lost') return state.finalTimeMs;
  if (state.startedAt === null) return 0;
  return Date.now() - state.startedAt;
}

/** Temps restant en Chrono (le compte a rebours demarre au premier coup). */
export function chronoRemaining(state: {
  phase: string;
  startedAt: number | null;
  finalTimeMs: number;
}): number {
  return Math.max(0, CHRONO_LIMIT_MS - computeElapsed(state));
}

const firstBoard = deal(
  'bienvenue',
  findDifficulty(DEFAULT_DIFFICULTY).drawCount,
);

export const useGameStore = create<GameStore>()((set, get) => {
  /**
   * Enregistre la perte du magot en cours (abandon d'une serie gambling, ou
   * defaite confirmee). L'assurance eventuelle rend sa part a la banque.
   */
  function settleBust(): void {
    const state = get();
    if (isRiskingPot(state)) {
      const meta = useMetaStore.getState();
      meta.secureBank(0, state.combo);
      const refund = insuranceRefund(state);
      if (refund > 0) {
        meta.credit(refund);
        meta.notify({
          kind: 'reward',
          title: 'L’assurance a payé',
          text: `${formatNumber(refund)} jetons sauvés du naufrage.`,
        });
        playSound('coins');
      } else {
        playSound('bust');
      }
      set({ pot: 0, combo: 0, insured: false });
    }
  }

  /** Paie les cartes rangees d'une donne de Vegas, une seule fois. */
  function settleVegas(): VegasSummary | null {
    const state = get();
    if (state.mode !== 'vegas' || state.vegasStake <= 0) return null;
    const cards = foundationCount(state.board);
    const cardValue = vegasValueOf(state);
    const earned = cards * cardValue;
    useMetaStore.getState().credit(earned);
    set({ vegasStake: 0 });
    return {
      stake: state.vegasStake,
      cards,
      cardValue,
      earned,
      net: earned - state.vegasStake,
    };
  }

  /** Les paris annexes d'une manche perdue: une part nourrit la cagnotte. */
  function loseSideBets(): number {
    const state = get();
    const lost = state.sideBets.length * state.sideBetStake;
    if (lost > 0) {
      useMetaStore.getState().feedProgressive(lost * PROGRESSIVE_BET_SHARE);
    }
    set({ sideBets: [] });
    return lost;
  }

  /**
   * Quitter une manche encore en cours: Vegas paie les cartes deja rangees,
   * les paris annexes sont perdus et les missions comptent les cartes posees.
   */
  function closeRound(): void {
    const state = get();
    if (state.phase !== 'playing') return;
    const vegas = settleVegas();
    if (vegas && vegas.earned > 0) {
      useMetaStore.getState().notify({
        kind: 'reward',
        title: 'Vegas: cartes payées',
        text: `${vegas.cards} cartes rangées, ${formatNumber(vegas.earned)} jetons pour ta banque.`,
      });
    }
    loseSideBets();
    if (state.moves > 0) {
      useMetaStore.getState().recordMission({
        kind: 'game',
        won: false,
        mode: state.mode,
        difficulty: state.difficulty,
        timeMs: computeElapsed(state),
        undoCount: state.undoCount,
        usedHint: state.usedHint,
        foundationCards: foundationCount(state.board),
        vegasNet: vegas?.net,
      });
    }
  }

  /** Distribue une nouvelle donne et remet a zero l'etat vivant de la partie. */
  function dealRound(
    mode: GameMode,
    difficulty: DifficultyId,
    seed: string,
    keepPot: boolean,
    extra: Partial<GameStore> = {},
  ): void {
    stopTimers();
    const config = dealConfig(mode, difficulty);
    const board = deal(seed, config.drawCount, {
      gentle: config.gentle,
      recycles: config.recycles,
    });
    useMetaStore.getState().recordDeal();
    playSound('shuffle');
    set((state) => ({
      route: 'game',
      overlay: 'none',
      modal: 'none',
      mode,
      difficulty,
      drawCount: config.drawCount,
      seed,
      guaranteed: false,
      preparing: false,
      tutorial: false,
      board,
      phase: 'playing',
      score: 0,
      moves: 0,
      invalidMoves: 0,
      undoCount: 0,
      hintCount: 0,
      usedHint: false,
      usedJoker: false,
      startedAt: null,
      finalTimeMs: 0,
      history: [],
      autoAvailable: false,
      autoCompleting: false,
      pot: keepPot ? state.pot : 0,
      combo: keepPot ? state.combo : 0,
      insured: keepPot ? state.insured : false,
      sideBets: [],
      sideBetStake: sideBetStake(extra.stakeTable ?? state.stakeTable),
      vegasStake: 0,
      jokerArmed: false,
      peekMode: false,
      peekCard: null,
      dealId: state.dealId + 1,
      freeHint: false,
      win: null,
      lost: null,
      vaultResult: null,
      bust: null,
      hint: null,
      shake: null,
      ...extra,
    }));
    if (mode === 'gambling') {
      useMetaStore
        .getState()
        .feedProgressive(progressiveContribution(get().stakeTable));
    }
    if (get().guaranteed) prepareWinnableDeal(config);
  }

  /**
   * Point d'entree de toute nouvelle donne. Avec l'option "donne garantie",
   * une graine tiree au hasard est remplacee par une donne prouvee gagnable,
   * cherchee en arriere-plan pendant que le croupier "prepare" la table.
   * Une graine imposee (defi du jour, lien partage, saisie) est respectee.
   */
  function startRound(
    mode: GameMode,
    difficulty: DifficultyId,
    seed: string | null,
    keepPot: boolean,
    extra: Partial<GameStore> = {},
    beforeDeal?: () => boolean,
  ): void {
    const wantsGuarantee =
      seed === null &&
      mode !== 'daily' &&
      useMetaStore.getState().settings.guaranteed;
    if (!wantsGuarantee) {
      if (beforeDeal && !beforeDeal()) return;
      dealRound(mode, difficulty, seed ?? randomSeed(), keepPot, extra);
      return;
    }
    const token = ++prepToken;
    set({ preparing: true, route: 'game', overlay: 'none', modal: 'none' });
    void takeWinnableDeal(dealConfig(mode, difficulty)).then((found) => {
      if (token !== prepToken) return;
      set({ preparing: false });
      if (beforeDeal && !beforeDeal()) {
        set({ route: 'home', phase: 'idle' });
        return;
      }
      dealRound(mode, difficulty, found ?? randomSeed(), keepPot, {
        ...extra,
        guaranteed: found !== null,
      });
    });
  }

  /** Fin de partie gagnee: bonus, score final, stats, et logique gambling. */
  function handleWin(): void {
    stopTimers();
    const state = get();
    const scoring = isScoring(state.mode);
    const timeMs = computeElapsed(state);
    let bonuses: EndBonuses = { speed: 0, precision: 0, total: 0 };
    if (scoring) {
      bonuses = endGameBonuses({
        elapsedSeconds: timeMs / 1000,
        invalidMoves: state.invalidMoves,
        undoCount: state.undoCount,
      });
      if (state.mode === 'chrono') {
        // Au Chrono, le bonus de vitesse est remplace par les secondes
        // restantes au compte a rebours.
        const speed =
          Math.floor(chronoRemaining(state) / 1000) * CHRONO_POINTS_PER_SECOND;
        bonuses = { ...bonuses, speed, total: speed + bonuses.precision };
      }
    }
    const baseScore = state.score;
    const roundScore = baseScore + bonuses.total;
    const meta = useMetaStore.getState();
    const today = todayISO();
    const firstDailyWin =
      state.mode === 'daily' && !meta.daily.completedDates.includes(today);

    meta.resolveGame({
      won: true,
      timeMs,
      moves: state.moves,
      score: roundScore,
      drawCount: state.drawCount,
      invalidMoves: state.invalidMoves,
      undoCount: state.undoCount,
      usedHint: state.usedHint,
      isDaily: state.mode === 'daily',
      dailyDate: state.mode === 'daily' ? todayISO() : undefined,
    });

    let pot = state.pot;
    let combo = state.combo;
    let multiplier = 1;
    const table = findStakeTable(state.stakeTable);
    const tableMultiplier = state.mode === 'gambling' ? table.multiplier : 1;
    const difficultyMultiplier = findDifficulty(state.difficulty).payout;
    const guaranteedMultiplier = state.guaranteed ? GUARANTEED_PAYOUT : 1;
    const payout = payoutOf(state);
    let gain = roundScore;
    const potBefore = pot;

    if (state.mode === 'gambling') {
      multiplier = comboMultiplier(combo);
      gain = Math.round(roundScore * multiplier * tableMultiplier * payout);
      // Le magot lui-meme ne descend jamais sous zero: un score negatif
      // rogne la mise mais ne rend jamais la banque debitrice.
      pot = Math.max(0, pot + gain);
      combo = combo + 1;
      if (table.id === 'diamond') meta.unlock('high-stakes');
    }

    // Paris annexes: payes directement a la banque si la condition tient.
    const bets: BetResult[] = state.sideBets.map((id) => {
      const ok =
        id === 'no-hint'
          ? !state.usedHint
          : id === 'no-undo'
            ? state.undoCount === 0
            : timeMs < FAST_BET_MS;
      const won = ok ? state.sideBetStake * (findSideBet(id).odds + 1) : 0;
      return { id, stake: state.sideBetStake, won: ok, payout: won };
    });
    const betPayout = bets.reduce((n, b) => n + b.payout, 0);
    const betsLost = bets.filter((b) => !b.won).length * state.sideBetStake;
    if (betPayout > 0) meta.credit(betPayout);
    if (betsLost > 0) meta.feedProgressive(betsLost * PROGRESSIVE_BET_SHARE);

    // Jackpot progressif: l'exploit, sans la moindre aide.
    const progressiveWon =
      state.mode === 'gambling' &&
      state.difficulty === 'expert' &&
      table.stake > 0 &&
      !state.guaranteed &&
      state.undoCount === 0 &&
      !state.usedHint &&
      !state.usedJoker;
    const progressive = progressiveWon ? meta.winProgressive() : 0;

    // Hors Jackpot et Vegas, une victoire verse un pourboire a la banque.
    const tip =
      state.mode === 'vegas' ? 0 : tipForWin(state.mode, roundScore, payout);
    const dailyBonus = firstDailyWin ? DAILY_BONUS : 0;
    meta.credit(tip + dailyBonus);

    const vegas = settleVegas();
    const vaultEligible = state.mode === 'gambling' && vaultUnlocked(combo);

    meta.recordMission({
      kind: 'game',
      won: true,
      mode: state.mode,
      difficulty: state.difficulty,
      timeMs,
      undoCount: state.undoCount,
      usedHint: state.usedHint,
      foundationCards: 52,
      vegasNet: vegas?.net,
    });
    if (state.mode === 'gambling') {
      meta.recordMission({ kind: 'streak', length: combo });
    }

    playSound(progressive > 0 ? 'jackpot' : 'win');
    set({
      phase: 'won',
      finalTimeMs: timeMs,
      score: roundScore,
      pot,
      combo,
      sideBets: [],
      overlay: 'win',
      autoAvailable: false,
      autoCompleting: false,
      jokerArmed: false,
      peekMode: false,
      hint: null,
      win: {
        roundScore,
        bonuses,
        baseScore,
        multiplier,
        tableMultiplier,
        difficultyMultiplier,
        guaranteedMultiplier,
        gain,
        potBefore,
        potAfter: pot,
        vaultEligible,
        tip,
        dailyBonus,
        moves: state.moves,
        bets,
        progressive,
        vegas,
      },
    });
  }

  /**
   * Partie perdue: donne mathematiquement bloquee, ou temps ecoule au
   * Chrono.
   */
  function handleLost(reason: LostSummary['reason'] = 'deadlock'): void {
    stopTimers();
    const state = get();
    const timeMs = reason === 'time' ? CHRONO_LIMIT_MS : computeElapsed(state);
    const meta = useMetaStore.getState();

    meta.resolveGame({
      won: false,
      timeMs,
      moves: state.moves,
      score: state.score,
      drawCount: state.drawCount,
      invalidMoves: state.invalidMoves,
      undoCount: state.undoCount,
      usedHint: state.usedHint,
      isDaily: state.mode === 'daily',
      dailyDate: state.mode === 'daily' ? todayISO() : undefined,
    });

    const vegas = settleVegas();
    const betsLost = loseSideBets();
    meta.recordMission({
      kind: 'game',
      won: false,
      mode: state.mode,
      difficulty: state.difficulty,
      timeMs,
      undoCount: state.undoCount,
      usedHint: state.usedHint,
      foundationCards: foundationCount(state.board),
      vegasNet: vegas?.net,
    });

    // Le magot reste en suspens tant que le joueur n'a pas choisi: une
    // seconde chance peut encore le sauver. Il n'est solde (et l'assurance
    // versee) qu'au moment de quitter ou de relancer, via settleBust.
    const wasGambling = isRiskingPot(state);
    const potLost = wasGambling ? state.pot : 0;

    playSound('lose');
    set({
      phase: 'lost',
      finalTimeMs: timeMs,
      overlay: 'lost',
      autoAvailable: false,
      autoCompleting: false,
      jokerArmed: false,
      peekMode: false,
      hint: null,
      lost: {
        reason,
        finalScore: state.score,
        timeMs,
        wasGambling,
        potLost,
        refund: wasGambling ? insuranceRefund(state) : 0,
        betsLost,
        vegas,
      },
    });
  }

  /** Lance le compte a rebours du Chrono, des le premier coup. */
  function armChrono(): void {
    const state = get();
    if (state.mode !== 'chrono' || state.startedAt === null || chronoTimer)
      return;
    const dealId = state.dealId;
    chronoTimer = setTimeout(() => {
      chronoTimer = null;
      const now = get();
      if (now.dealId === dealId && now.phase === 'playing') handleLost('time');
    }, chronoRemaining(state));
  }

  /** Applique un coup valide, met a jour score, sons et signaux. */
  function commitMove(move: Move, options: ApplyOptions = {}): boolean {
    const state = get();
    if (state.phase !== 'playing' || state.preparing) return false;
    const result = applyMove(state.board, move, options);
    if (!result) return false;

    const scoring = isScoring(state.mode);
    const delta = scoring
      ? scoreForOutcome(result.outcome, state.drawCount)
      : 0;
    const nextScore = state.score + delta;

    // Sons selon la nature du coup.
    if (result.outcome.toFoundation > 0) playSound('foundation');
    else if (move.type === 'draw') playSound('draw');
    else if (move.type === 'recycle') playSound('shuffle');
    else playSound('place');
    if (result.outcome.revealed > 0) playSound('flip');

    const startedAt = state.startedAt ?? Date.now();
    const autoAvailable = canAutoComplete(result.board);
    set({
      board: result.board,
      score: nextScore,
      moves: state.moves + 1,
      startedAt,
      history: [
        ...state.history,
        { board: state.board, score: state.score, moves: state.moves },
      ],
      hint: null,
      shake: null,
      autoAvailable,
      // Si un coup joue pendant le rangement casse la fin automatique, on
      // l'arrete au lieu de piocher en boucle.
      autoCompleting: state.autoCompleting && autoAvailable,
    });
    armChrono();

    if (isWon(result.board)) {
      handleWin();
      return true;
    }
    if (isDeadlock(result.board)) {
      handleLost();
      return true;
    }

    // Des que la partie ne tient plus qu'a empiler les cartes sur les
    // fondations, on lance tout seul l'animation de rangement: plus besoin de
    // deplacer les cartes une par une. On evite de re-declencher pendant que
    // l'autocompletion tourne deja (elle passe aussi par commitMove).
    const after = get();
    if (
      after.phase === 'playing' &&
      after.autoAvailable &&
      !after.autoCompleting
    ) {
      set({ autoCompleting: true });
      scheduleAutoStep();
    }
    return true;
  }

  function scheduleAutoStep(): void {
    autoTimer = setTimeout(() => {
      const state = get();
      if (!state.autoCompleting || state.phase !== 'playing') {
        stopAutoTimer();
        return;
      }
      const move = nextAutoCompleteMove(state.board);
      if (!move || !commitMove(move)) {
        set({ autoCompleting: false });
        stopAutoTimer();
        return;
      }
      if (get().phase === 'playing' && get().autoCompleting) {
        scheduleAutoStep();
      }
      // Cadence rapide mais lisible: l'animation de vol dure 0.32s, donc
      // plusieurs cartes sont en vol en meme temps, ce qui donne une jolie
      // cascade de rangement.
    }, 130);
  }

  /** Un coup a ete tente par glisser: normal d'abord, joker ensuite. */
  function tryDragMove(move: Move): boolean {
    if (commitMove(move)) return true;
    const state = get();
    const toTableau =
      move.type === 'wasteToTableau' ||
      move.type === 'tableauToTableau' ||
      move.type === 'foundationToTableau';
    if (!state.jokerArmed || !toTableau) return false;
    if ((useMetaStore.getState().inventory.consumables.joker ?? 0) <= 0) {
      set({ jokerArmed: false });
      return false;
    }
    if (!commitMove(move, { wild: true })) return false;
    useMetaStore.getState().useConsumable('joker');
    playSound('stamp');
    if (get().phase === 'playing') set({ jokerArmed: false, usedJoker: true });
    else set({ usedJoker: true });
    return true;
  }

  /** Mise de la donne de Vegas: debitee avant de distribuer. */
  function payVegasStake(): boolean {
    const meta = useMetaStore.getState();
    if (!meta.spend(VEGAS_STAKE)) {
      meta.notify({
        kind: 'error',
        title: 'Pas assez de jetons',
        text: `Une donne de Vegas coûte ${VEGAS_STAKE} jetons.`,
      });
      return false;
    }
    playSound('chip');
    return true;
  }

  return {
    route: 'home',
    modal: 'none',
    overlay: 'none',

    mode: 'classic',
    difficulty: DEFAULT_DIFFICULTY,
    drawCount: findDifficulty(DEFAULT_DIFFICULTY).drawCount,
    seed: 'bienvenue',
    guaranteed: false,
    preparing: false,
    tutorial: false,

    board: firstBoard,
    phase: 'idle',
    score: 0,
    moves: 0,
    invalidMoves: 0,
    undoCount: 0,
    hintCount: 0,
    usedHint: false,
    usedJoker: false,
    startedAt: null,
    finalTimeMs: 0,
    history: [],
    autoAvailable: false,
    autoCompleting: false,

    pot: 0,
    combo: 0,
    stakeTable: 'free',
    insured: false,
    sideBets: [],
    sideBetStake: sideBetStake('free'),
    vegasStake: 0,

    jokerArmed: false,
    peekMode: false,
    peekCard: null,

    dealId: 0,
    freeHint: false,
    win: null,
    lost: null,
    vaultResult: null,
    bust: null,

    hint: null,
    hintNonce: 0,
    shake: null,

    pendingAction: null,

    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: 'none' }),

    requestLeave: (action) => {
      const state = get();
      if (isRiskingPot(state)) {
        set({ modal: 'confirmLeave', pendingAction: action });
      } else {
        action();
      }
    },

    confirmPendingAction: () => {
      const action = get().pendingAction;
      set({ modal: 'none', pendingAction: null });
      action?.();
    },

    cancelPendingAction: () => {
      set({ modal: 'none', pendingAction: null });
    },

    goHome: () => {
      closeRound();
      settleBust();
      stopTimers();
      prepToken++;
      set({
        route: 'home',
        overlay: 'none',
        modal: 'none',
        // On sort completement de la partie: sans ca, une phase 'won' ou
        // 'lost' restee active continuerait de faire tourner l'animation de
        // victoire (ou l'ecran de defaite) par dessus l'accueil.
        phase: 'idle',
        preparing: false,
        tutorial: false,
        autoCompleting: false,
        jokerArmed: false,
        peekMode: false,
        peekCard: null,
        win: null,
        lost: null,
      });
    },

    newGame: (options) => {
      const meta = useMetaStore.getState();
      const state = get();
      const mode = options?.mode ?? state.mode;
      const difficulty = options?.difficulty ?? meta.settings.difficulty;
      let seed = sanitizeSeed(options?.seed);
      if (!seed && mode === 'daily') seed = dailySeed();

      if (mode === 'vegas') {
        // On verifie la mise avant de quitter quoi que ce soit.
        if (useMetaStore.getState().wallet.balance < VEGAS_STAKE) {
          payVegasStake();
          return;
        }
        closeRound();
        settleBust();
        startRound(
          mode,
          difficulty,
          seed,
          false,
          { vegasStake: VEGAS_STAKE },
          payVegasStake,
        );
        return;
      }

      closeRound();
      settleBust();
      if (mode !== 'gambling') {
        startRound(mode, difficulty, seed, false);
        return;
      }
      // Mode Jackpot: on s'assoit a une table. La mise quitte la banque et
      // entre dans le magot. Si la table n'est plus abordable (solde ou rang),
      // on se rabat sur la table libre plutot que de bloquer le joueur.
      let table = findStakeTable(options?.table ?? state.stakeTable);
      const wallet = useMetaStore.getState().wallet;
      if (
        table.stake > wallet.balance ||
        !meetsTier(wallet.lifetimeEarned, table.minTier)
      ) {
        table = findStakeTable('free');
      }
      if (table.stake > 0 && !useMetaStore.getState().spend(table.stake)) {
        table = findStakeTable('free');
      }
      if (table.stake > 0) playSound('chip');
      set({ stakeTable: table.id });
      startRound(mode, difficulty, seed, false, {
        stakeTable: table.id,
        pot: table.stake,
      });
    },

    restartSameSeed: () => {
      const state = get();
      get().newGame({
        mode: state.mode,
        difficulty: state.difficulty,
        seed: state.seed,
        table: state.stakeTable,
      });
    },

    startTutorial: () => {
      closeRound();
      settleBust();
      dealRound('classic', 'easy', TUTORIAL_SEED, false, { tutorial: true });
    },

    endTutorial: () => {
      useMetaStore.getState().completeTutorial();
      set({ tutorial: false });
    },

    clickStock: () => {
      const state = get();
      if (state.phase !== 'playing') return;
      if (state.board.stock.length > 0) {
        commitMove({ type: 'draw' });
      } else if (canRecycle(state.board)) {
        commitMove({ type: 'recycle' });
      } else if (state.board.waste.length > 0) {
        // Vegas: plus aucun passage permis dans la pioche.
        playSound('invalid');
      }
    },

    autoFromWaste: () => {
      const state = get();
      const move = autoMoveFromWaste(state.board);
      if (move) {
        commitMove(move);
      } else {
        const card = state.board.waste[state.board.waste.length - 1];
        if (card) get().reportInvalid(card.id);
      }
    },

    autoFromTableau: (column, index) => {
      const state = get();
      const move = autoMoveFromTableau(state.board, column, index);
      if (move) {
        commitMove(move);
      } else {
        const col = state.board.tableau[column];
        const card = col[index];
        if (card) get().reportInvalid(card.id);
      }
    },

    applyDragMove: (move) => tryDragMove(move),

    reportInvalid: (cardId) => {
      const state = get();
      const scoring = isScoring(state.mode);
      playSound('invalid');
      const nonce = Date.now();
      set({
        invalidMoves: state.invalidMoves + 1,
        score: scoring ? state.score + SCORE.invalidPenalty : state.score,
        shake: { id: cardId, nonce },
      });
      // On retire l'etat de secousse des la fin de l'animation. Sans ca, la
      // carte gardait son z-index eleve (necessaire pendant la secousse pour
      // etre bien visible) et restait donc au-dessus des cartes du dessous,
      // les masquant jusqu'au coup suivant.
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => {
        shakeTimer = null;
        if (get().shake?.nonce === nonce) set({ shake: null });
      }, 450);
    },

    undo: () => {
      const state = get();
      if (state.phase !== 'playing' || state.history.length === 0) return;
      if (!canUndoIn(state.mode)) return;
      const previous = state.history[state.history.length - 1];
      const scoring = isScoring(state.mode);
      playSound('whoosh');
      // Annuler reprend la main: on coupe un rangement automatique en cours.
      stopAutoTimer();
      set({
        board: previous.board,
        moves: previous.moves,
        score: scoring ? previous.score + SCORE.undoPenalty : previous.score,
        undoCount: state.undoCount + 1,
        history: state.history.slice(0, -1),
        hint: null,
        shake: null,
        autoAvailable: canAutoComplete(previous.board),
        autoCompleting: false,
      });
    },

    requestHint: () => {
      const state = get();
      if (state.phase !== 'playing') return;
      const move = findHint(state.board);
      if (!move) {
        // Aucun indice possible = partie bloquee. On declenche la defaite
        // (findHint ne renvoie null que si isDeadlock est vrai), c'est le
        // scenario exact "je clique indice, rien ne se passe".
        handleLost();
        return;
      }
      const scoring = isScoring(state.mode);
      // Un Oeil du croupier en reserve offre l'indice sans penalite.
      const free = scoring && useMetaStore.getState().useConsumable('hint');
      playSound('button');
      set({
        hint: move,
        hintNonce: state.hintNonce + 1,
        hintCount: state.hintCount + 1,
        usedHint: true,
        freeHint: free,
        score: scoring && !free ? state.score + SCORE.hintPenalty : state.score,
      });
    },

    clearHint: () => set({ hint: null }),

    startAutoComplete: () => {
      const state = get();
      if (state.phase !== 'playing' || !state.autoAvailable) return;
      if (state.autoCompleting) return; // deja en cours: pas de second timer
      set({ autoCompleting: true });
      scheduleAutoStep();
    },

    playJoker: (id) => {
      const state = get();
      if (state.phase !== 'playing' || state.preparing) return false;
      const meta = useMetaStore.getState();
      if ((meta.inventory.consumables[id] ?? 0) <= 0) return false;

      if (id === 'peek') {
        const hidden = state.board.tableau.some((col) =>
          col.some((c) => !c.faceUp),
        );
        if (!hidden) return false;
        set({ peekMode: true, jokerArmed: false, hint: null });
        playSound('button');
        return true;
      }

      if (id === 'joker') {
        set({ jokerArmed: true, peekMode: false, hint: null });
        playSound('chip');
        return true;
      }

      // Remelange.
      const shuffled = reshuffleStock(
        state.board,
        createRng(`${state.seed}-${state.moves}-${Date.now()}`),
      );
      if (!shuffled) return false;
      meta.useConsumable('reshuffle');
      playSound('shuffle');
      set({
        board: shuffled,
        usedJoker: true,
        jokerArmed: false,
        peekMode: false,
        hint: null,
        history: [
          ...state.history,
          { board: state.board, score: state.score, moves: state.moves },
        ],
        autoAvailable: canAutoComplete(shuffled),
      });
      return true;
    },

    cancelJoker: () => set({ jokerArmed: false, peekMode: false }),

    peekAt: (cardId) => {
      const state = get();
      if (!state.peekMode || state.phase !== 'playing') return false;
      const hidden = state.board.tableau.some((col) =>
        col.some((c) => c.id === cardId && !c.faceUp),
      );
      if (!hidden) return false;
      if (!useMetaStore.getState().useConsumable('peek')) {
        set({ peekMode: false });
        return false;
      }
      playSound('flip');
      set({ peekMode: false, peekCard: cardId, usedJoker: true });
      if (peekTimer) clearTimeout(peekTimer);
      peekTimer = setTimeout(() => {
        peekTimer = null;
        if (get().peekCard === cardId) {
          set({ peekCard: null });
          playSound('flip');
        }
      }, PEEK_MS);
      return true;
    },

    toggleSideBet: (id) => {
      const state = get();
      if (!betsOpen(state)) return false;
      const meta = useMetaStore.getState();
      if (state.sideBets.includes(id)) {
        meta.refund(state.sideBetStake);
        set({ sideBets: state.sideBets.filter((b) => b !== id) });
        playSound('chip');
        return true;
      }
      if (!meta.spend(state.sideBetStake)) {
        playSound('invalid');
        return false;
      }
      playSound('chip');
      set({ sideBets: [...state.sideBets, id] });
      return true;
    },

    cashOut: () => {
      const state = get();
      if (!awaitingDecision(state)) return;
      const amount = state.pot;
      useMetaStore.getState().secureBank(amount, state.combo);
      playSound('coins');
      set({
        pot: 0,
        combo: 0,
        insured: false,
        overlay: 'none',
        route: 'home',
        // Meme raison que dans goHome: sans cette remise a zero, la phase
        // 'won' restait active et l'animation de victoire continuait de
        // tourner par dessus l'accueil, donnant l'impression que le bouton
        // n'avait rien fait.
        phase: 'idle',
        win: null,
        bust: null,
      });
    },

    cashOutHalf: (insure = false) => {
      const state = get();
      if (!awaitingDecision(state)) return;
      const half = Math.floor(state.pot / 2);
      if (half <= 0) return;
      useMetaStore.getState().secureBank(half, state.combo);
      playSound('coins');
      const insured =
        insure && useMetaStore.getState().useConsumable('insurance');
      set({ pot: state.pot - half });
      startRound('gambling', state.difficulty, null, true, { insured });
    },

    doubleOrNothing: (insure = false) => {
      const state = get();
      if (!awaitingDecision(state)) return;
      // L'assurance couvre uniquement la manche qui s'ouvre.
      const insured =
        insure && useMetaStore.getState().useConsumable('insurance');
      startRound('gambling', state.difficulty, null, true, { insured });
    },

    secondChance: () => {
      const state = get();
      if (state.phase !== 'lost' || !isRiskingPot(state)) return;
      if (!useMetaStore.getState().useConsumable('redeal')) return;
      // Le magot et la serie sont conserves tels quels: la manche bloquee
      // est simplement effacee et remplacee par une donne neuve.
      startRound('gambling', state.difficulty, null, true);
    },

    gambleFromScore: () => {
      const state = get();
      // Seule une victoire notee hors Jackpot peut devenir une mise.
      if (state.phase !== 'won' || !isScoring(state.mode)) return;
      if (state.mode === 'gambling') return;
      // On transforme la victoire actuelle en premiere manche d'une serie.
      set({ mode: 'gambling', pot: state.score, combo: 1 });
      startRound('gambling', state.difficulty, null, true, {
        stakeTable: 'free',
        insured: false,
      });
    },

    enterVault: () => {
      const state = get();
      if (!awaitingDecision(state) || !state.win?.vaultEligible) return;
      set({ overlay: 'vault', vaultResult: null });
    },

    openVault: () => {
      const state = get();
      // Une seule ouverture par coffre.
      if (state.overlay !== 'vault' || state.vaultResult) return;
      const outcome = drawVaultOutcome();
      const potAfter = Math.max(0, Math.round(state.pot * outcome.multiplier));
      useMetaStore.getState().openVault();
      playSound('vault');
      set({
        pot: potAfter,
        overlay: 'vault',
        vaultResult: { ...outcome, potAfter },
        win: state.win ? { ...state.win, potAfter } : state.win,
      });
    },

    dismissWin: () => {
      // Fermer la fenetre d'une victoire hors gambling.
      set({ overlay: 'none' });
    },

    dismissLost: () => {
      set({ overlay: 'none' });
    },
  };
});
