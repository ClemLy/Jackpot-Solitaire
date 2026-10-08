// Partie en cours: plateau, coups, animations et deroulement des manches.
//
// Ce store ne calcule aucun jeton. Il tient le journal des actions de la
// manche (coups, annuler, indices, jokers, paris) et le confie a l'economie
// (voir economy.ts): le coeur du jeu le rejoue, localement pour un invite,
// sur le serveur pour un compte, et rend le resultat qui fait foi.

import { create } from 'zustand';
import {
  applyMove,
  canAutoComplete,
  canRecycle,
  createRng,
  deal,
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
  type Move,
} from '../engine';
import {
  boardOf,
  canUndoIn as coreCanUndoIn,
  foundationCount as coreFoundationCount,
  isScoring as coreIsScoring,
  reshuffleSeed,
  vegasValueOf as coreVegasValueOf,
  type EndReason,
  type GameMode as CoreGameMode,
  type LogEntry,
  type LostSummary as CoreLostSummary,
  type Round,
  type StartRequest,
  type WinSummary as CoreWinSummary,
} from '../core';
import { useMetaStore } from './meta';
import {
  CHRONO_LIMIT_MS,
  DEFAULT_DIFFICULTY,
  VEGAS_STAKE,
  findDifficulty,
  sideBetStake,
  vegasRecycles,
  type ConsumableId,
  type DifficultyId,
  type JokerId,
  type SideBetId,
  type StakeTableId,
} from './catalog';
import { prepareWinnableDeal, takeWinnableDeal } from './dealer';
import { economy, reportFailure } from './economy';
import { playSound } from '../audio/sfx';
import { sanitizeSeed } from '../utils/seed';

export type GameMode = CoreGameMode;
export type WinSummary = CoreWinSummary;
export type LostSummary = CoreLostSummary;
export type { BetResult, VegasSummary } from '../core';

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
  | 'account'
  | 'profile'
  | 'friends'
  | 'confirmLeave';
export type Overlay = 'none' | 'win' | 'vault' | 'lost';

interface Snapshot {
  board: Board;
  score: number;
  moves: number;
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
  /** Partie sur graine imposee: elle ne rapporte rien. */
  unpaid: boolean;
  /** Vrai pendant que le croupier distribue (economie, donne garantie). */
  preparing: boolean;
  /** Vrai pendant que le croupier verifie une fin de manche. */
  settling: boolean;
  /** Une action d'argent est en cours: les boutons attendent. */
  busy: boolean;
  /** Partie guidee du tutoriel. */
  tutorial: boolean;

  /** Manche en cours, telle que l'economie l'a distribuee. */
  round: Round | null;
  /** Journal des actions de la manche, rejoue a la fin. */
  log: LogEntry[];
  /** Bonus consommes pendant la manche (debites a la fin). */
  used: Partial<Record<ConsumableId, number>>;

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

  /** Reflet de la session Jackpot du joueur (magot, serie, table). */
  pot: number;
  combo: number;
  stakeTable: StakeTableId;
  insured: boolean;
  /** Paris annexes poses sur la manche en cours. */
  sideBets: SideBetId[];
  sideBetStake: number;

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

  hint: Move | null;
  hintNonce: number;
  shake: { id: string; nonce: number } | null;

  // Action differee, en attente de confirmation (voir requestLeave).
  pendingAction: (() => void) | null;

  // Navigation et fenetres.
  openModal: (modal: Modal) => void;
  closeModal: () => void;
  goHome: () => Promise<void>;

  // Cycle de vie de la partie.
  newGame: (options?: NewGameOptions) => Promise<void>;
  restartSameSeed: () => Promise<void>;
  startTutorial: () => Promise<void>;
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
  cashOut: () => Promise<void>;
  cashOutHalf: (insure?: boolean) => Promise<void>;
  doubleOrNothing: (insure?: boolean) => Promise<void>;
  secondChance: () => Promise<void>;
  gambleFromScore: () => Promise<void>;
  enterVault: () => void;
  openVault: () => Promise<void>;
  dismissWin: () => void;
  dismissLost: () => void;
}

let autoTimer: ReturnType<typeof setTimeout> | null = null;
let shakeTimer: ReturnType<typeof setTimeout> | null = null;
let chronoTimer: ReturnType<typeof setTimeout> | null = null;
let peekTimer: ReturnType<typeof setTimeout> | null = null;

/** Duree pendant laquelle un coup d'oeil montre la carte. */
export const PEEK_MS = 2600;

function stopAutoTimer(): void {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function stopTimers(): void {
  stopAutoTimer();
  if (chronoTimer) {
    clearTimeout(chronoTimer);
    chronoTimer = null;
  }
  if (peekTimer) {
    clearTimeout(peekTimer);
    peekTimer = null;
  }
}

/** Le mode compte-t-il des points (et donc des penalites) ? */
export const isScoring = coreIsScoring;

/** Annuler est interdit a Vegas: on pourrait sinon espionner la pioche. */
export const canUndoIn = coreCanUndoIn;

export const foundationCount = coreFoundationCount;

/** Les paris annexes ne se posent qu'avant le premier coup de la manche. */
export function betsOpen(state: {
  mode: GameMode;
  phase: Phase;
  log: LogEntry[];
  preparing: boolean;
}): boolean {
  // Avant toute action: un seul coup d'oeil a la pioche (meme annule)
  // ferme les paris. Un coup refuse, lui, ne revele rien.
  return (
    state.mode === 'gambling' &&
    state.phase === 'playing' &&
    state.log.every((e) => e.t === 'bet' || e.t === 'invalid') &&
    !state.preparing
  );
}

/** Valeur d'une carte rangee a Vegas pour la partie en cours. */
export function vegasValueOf(state: {
  difficulty: DifficultyId;
  guaranteed: boolean;
}): number {
  return coreVegasValueOf({
    difficulty: state.difficulty,
    seedSource: state.guaranteed ? 'guaranteed' : 'random',
  });
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

/** Temps restant en Chrono (le compte a rebours demarre a la donne). */
export function chronoRemaining(state: {
  phase: string;
  startedAt: number | null;
  finalTimeMs: number;
}): number {
  return Math.max(0, CHRONO_LIMIT_MS - computeElapsed(state));
}

/** Nombre de bonus encore disponibles, ceux de la manche deduits. */
export function available(
  id: ConsumableId,
  used: Partial<Record<ConsumableId, number>> = useGameStore.getState().used,
): number {
  const owned = useMetaStore.getState().inventory.consumables[id] ?? 0;
  return Math.max(0, owned - (used[id] ?? 0));
}

function dealConfig(mode: GameMode, difficulty: DifficultyId): DealConfig {
  const { drawCount, gentle } = findDifficulty(difficulty);
  return {
    drawCount,
    gentle,
    recycles: mode === 'vegas' ? vegasRecycles(drawCount) : undefined,
  };
}

const firstBoard = deal(
  'bienvenue',
  findDifficulty(DEFAULT_DIFFICULTY).drawCount,
);

export const useGameStore = create<GameStore>()((set, get) => {
  /** Reflete la session Jackpot du joueur dans l'interface. */
  function syncSession(): void {
    const session = useMetaStore.getState().session;
    set({
      pot: session.pot,
      combo: session.combo,
      stakeTable: session.table,
      insured: session.insured,
      vaultResult: session.vaultResult
        ? { ...session.vaultResult, potAfter: session.pot }
        : null,
    });
  }

  /** Pose sur la table la donne d'une manche distribuee par l'economie. */
  function dealRound(round: Round): void {
    stopTimers();
    const board = boardOf(round);
    playSound('shuffle');
    syncSession();
    set((state) => ({
      route: 'game',
      overlay: 'none',
      modal: 'none',
      mode: round.mode,
      difficulty: round.difficulty,
      drawCount: round.drawCount,
      seed: round.seed,
      guaranteed: round.seedSource === 'guaranteed',
      unpaid: round.seedSource === 'custom',
      tutorial: round.seedSource === 'tutorial',
      preparing: false,
      settling: false,
      round,
      log: [],
      used: {},
      board,
      phase: 'playing',
      score: 0,
      moves: 0,
      invalidMoves: 0,
      undoCount: 0,
      hintCount: 0,
      usedHint: false,
      usedJoker: false,
      startedAt: Date.now(),
      finalTimeMs: 0,
      history: [],
      autoAvailable: false,
      autoCompleting: false,
      sideBets: [],
      sideBetStake: round.sideBetStake,
      jokerArmed: false,
      peekMode: false,
      peekCard: null,
      dealId: state.dealId + 1,
      freeHint: false,
      win: null,
      lost: null,
      hint: null,
      shake: null,
    }));
    armChrono();
    // Donne garantie suivante: preparee des maintenant, sur le nouveau prefixe.
    if (useMetaStore.getState().settings.guaranteed) {
      prepareWinnableDeal(
        dealConfig(round.mode, round.difficulty),
        useMetaStore.getState().session.nonce,
      );
    }
  }

  /**
   * Demande une donne a l'economie. Avec l'option "donne garantie", une
   * donne au hasard est remplacee par une donne prouvee gagnable, cherchee en
   * arriere-plan sur le prefixe impose par la session.
   */
  async function start(req: StartRequest, mode: GameMode): Promise<boolean> {
    if (get().busy) return false;
    set({ busy: true });
    try {
      const wantsGuarantee =
        useMetaStore.getState().settings.guaranteed &&
        mode !== 'daily' &&
        !(req.kind === 'new' && (req.seed || req.tutorial));
      let request = req;
      if (wantsGuarantee) {
        set({ preparing: true, route: 'game', overlay: 'none', modal: 'none' });
        const seed = await takeWinnableDeal(
          dealConfig(mode, req.difficulty),
          useMetaStore.getState().session.nonce,
        );
        if (seed) request = { ...req, guaranteedSeed: seed };
      } else if (useMetaStore.getState().accountActive) {
        set({ preparing: true });
      }
      const { round } = await economy.start(request);
      dealRound(round);
      return true;
    } catch (err) {
      reportFailure(err);
      syncSession();
      return false;
    } finally {
      set({ busy: false, preparing: false });
    }
  }

  /** Termine la manche en cours aupres de l'economie. */
  async function finish(reason: EndReason): Promise<void> {
    const state = get();
    const round = state.round;
    if (!round) return;
    stopTimers();
    const timeMs = computeElapsed(state);
    set({ round: null, settling: true, finalTimeMs: timeMs });
    try {
      const out = await economy.finish(round.id, state.log, reason);
      syncSession();
      if (out.outcome === 'win') {
        set({
          settling: false,
          overlay: 'win',
          win: out.win,
          score: out.win.roundScore,
          finalTimeMs: out.win.timeMs,
        });
      } else if (out.outcome === 'lost') {
        playSound('lose');
        set({
          settling: false,
          phase: 'lost',
          overlay: 'lost',
          lost: out.lost,
          finalTimeMs: out.lost.timeMs,
        });
      } else {
        // L'economie n'a pas reconnu la fin annoncee: retour a l'accueil.
        set({ settling: false, phase: 'idle', overlay: 'none', route: 'home' });
      }
    } catch (err) {
      reportFailure(err);
      set({ settling: false, phase: 'idle', overlay: 'none', route: 'home' });
      syncSession();
    }
  }

  /** Quitte la manche en cours: elle compte comme abandonnee. */
  async function closeCurrent(): Promise<void> {
    const state = get();
    if (!state.round || state.phase !== 'playing') return;
    const round = state.round;
    stopTimers();
    set({ round: null, phase: 'idle', autoCompleting: false });
    try {
      await economy.finish(round.id, state.log, 'abandon');
    } catch (err) {
      reportFailure(err);
    }
    syncSession();
  }

  function onWin(): void {
    stopTimers();
    playSound('win');
    set({
      phase: 'won',
      autoAvailable: false,
      autoCompleting: false,
      jokerArmed: false,
      peekMode: false,
      hint: null,
    });
    void finish('win');
  }

  function onLost(reason: 'deadlock' | 'time'): void {
    stopTimers();
    set({
      phase: 'lost',
      autoAvailable: false,
      autoCompleting: false,
      jokerArmed: false,
      peekMode: false,
      hint: null,
    });
    void finish(reason);
  }

  /** Lance le compte a rebours du Chrono, des la donne. */
  function armChrono(): void {
    const state = get();
    if (state.mode !== 'chrono' || state.startedAt === null) return;
    const dealId = state.dealId;
    chronoTimer = setTimeout(() => {
      chronoTimer = null;
      const now = get();
      if (now.dealId === dealId && now.phase === 'playing') onLost('time');
    }, chronoRemaining(state));
  }

  function pushLog(entry: LogEntry, extra: Partial<GameStore> = {}): void {
    set((s) => ({ log: [...s.log, entry], ...extra }));
  }

  /** Applique un coup valide, met a jour score, sons et signaux. */
  function commitMove(move: Move, options: ApplyOptions = {}): boolean {
    const state = get();
    if (state.phase !== 'playing' || state.preparing || !state.round) {
      return false;
    }
    const result = applyMove(state.board, move, options);
    if (!result) return false;

    const scoring = isScoring(state.mode);
    const delta = scoring
      ? scoreForOutcome(result.outcome, state.drawCount)
      : 0;

    // Sons selon la nature du coup.
    if (result.outcome.toFoundation > 0) playSound('foundation');
    else if (move.type === 'draw') playSound('draw');
    else if (move.type === 'recycle') playSound('shuffle');
    else playSound('place');
    if (result.outcome.revealed > 0) playSound('flip');

    const autoAvailable = canAutoComplete(result.board);
    const entry: LogEntry = options.wild
      ? { t: 'move', move, wild: true }
      : { t: 'move', move };
    set({
      board: result.board,
      score: state.score + delta,
      moves: state.moves + 1,
      log: [...state.log, entry],
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

    if (isWon(result.board)) {
      onWin();
      return true;
    }
    if (isDeadlock(result.board)) {
      onLost('deadlock');
      return true;
    }

    // Des que la partie ne tient plus qu'a empiler les cartes sur les
    // fondations, on lance tout seul l'animation de rangement.
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
    if (available('joker') <= 0) {
      set({ jokerArmed: false });
      return false;
    }
    if (!commitMove(move, { wild: true })) return false;
    playSound('stamp');
    set((s) => ({
      jokerArmed: false,
      usedJoker: true,
      used: { ...s.used, joker: (s.used.joker ?? 0) + 1 },
    }));
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
    unpaid: false,
    preparing: false,
    settling: false,
    busy: false,
    tutorial: false,

    round: null,
    log: [],
    used: {},

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

    jokerArmed: false,
    peekMode: false,
    peekCard: null,

    dealId: 0,
    freeHint: false,
    win: null,
    lost: null,
    vaultResult: null,

    hint: null,
    hintNonce: 0,
    shake: null,

    pendingAction: null,

    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: 'none' }),

    requestLeave: (action) => {
      const state = get();
      if (state.mode === 'gambling' && state.pot > 0) {
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

    goHome: async () => {
      await closeCurrent();
      // Un magot en suspens (manche perdue, ou gagnee sans encaisser) est
      // perdu en quittant la table; l'assurance en rend une part.
      if (useMetaStore.getState().session.awaiting !== 'none') {
        try {
          await economy.decide('leave');
          playSound('bust');
        } catch (err) {
          reportFailure(err);
        }
      }
      stopTimers();
      syncSession();
      set({
        route: 'home',
        overlay: 'none',
        modal: 'none',
        // Sans cette remise a zero, une phase 'won' ou 'lost' restee active
        // continuerait de faire tourner l'effet de victoire sur l'accueil.
        phase: 'idle',
        preparing: false,
        settling: false,
        tutorial: false,
        autoCompleting: false,
        jokerArmed: false,
        peekMode: false,
        peekCard: null,
        win: null,
        lost: null,
      });
    },

    newGame: async (options) => {
      if (get().busy) return;
      const meta = useMetaStore.getState();
      const state = get();
      const mode = options?.mode ?? state.mode;
      const difficulty = options?.difficulty ?? meta.settings.difficulty;
      // Vegas: on verifie la mise avant de quitter quoi que ce soit.
      if (mode === 'vegas' && meta.wallet.balance < VEGAS_STAKE) {
        meta.notify({
          kind: 'error',
          title: 'Pas assez de jetons',
          text: `Une donne de Vegas coûte ${VEGAS_STAKE} jetons.`,
        });
        return;
      }
      await closeCurrent();
      const seed = sanitizeSeed(options?.seed) ?? undefined;
      const req: StartRequest = {
        kind: 'new',
        mode,
        difficulty,
        ...(options?.table ? { table: options.table } : {}),
        ...(seed && mode !== 'daily' ? { seed } : {}),
      };
      if (mode === 'gambling') playSound('chip');
      await start(req, mode);
    },

    restartSameSeed: async () => {
      const state = get();
      await get().newGame({
        mode: state.mode,
        difficulty: state.difficulty,
        seed: state.seed,
        table: state.stakeTable,
      });
    },

    startTutorial: async () => {
      await closeCurrent();
      await start(
        { kind: 'new', mode: 'classic', difficulty: 'easy', tutorial: true },
        'classic',
      );
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
      if (state.phase !== 'playing') return;
      const scoring = isScoring(state.mode);
      playSound('invalid');
      const nonce = Date.now();
      pushLog(
        { t: 'invalid' },
        {
          invalidMoves: state.invalidMoves + 1,
          score: scoring ? state.score + SCORE.invalidPenalty : state.score,
          shake: { id: cardId, nonce },
        },
      );
      // On retire l'etat de secousse des la fin de l'animation, sans quoi la
      // carte gardait son z-index eleve et masquait les cartes du dessous.
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
      pushLog(
        { t: 'undo' },
        {
          board: previous.board,
          moves: previous.moves,
          score: scoring ? previous.score + SCORE.undoPenalty : previous.score,
          undoCount: state.undoCount + 1,
          history: state.history.slice(0, -1),
          hint: null,
          shake: null,
          autoAvailable: canAutoComplete(previous.board),
          autoCompleting: false,
        },
      );
    },

    requestHint: () => {
      const state = get();
      if (state.phase !== 'playing') return;
      const move = findHint(state.board);
      if (!move) {
        // Aucun indice possible = partie bloquee (findHint ne renvoie null
        // que si isDeadlock est vrai).
        onLost('deadlock');
        return;
      }
      const scoring = isScoring(state.mode);
      // Un Oeil du croupier en reserve offre l'indice sans penalite.
      const free = scoring && available('hint') > 0;
      playSound('button');
      pushLog(
        { t: 'hint' },
        {
          hint: move,
          hintNonce: state.hintNonce + 1,
          hintCount: state.hintCount + 1,
          usedHint: true,
          freeHint: free,
          used: free
            ? { ...state.used, hint: (state.used.hint ?? 0) + 1 }
            : state.used,
          score:
            scoring && !free ? state.score + SCORE.hintPenalty : state.score,
        },
      );
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
      if (state.phase !== 'playing' || state.preparing || !state.round) {
        return false;
      }
      if (available(id) <= 0) return false;

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

      // Remelange: un ordre de tirage deterministe, que l'economie rejoue.
      const n = state.log.filter((e) => e.t === 'reshuffle').length;
      const shuffled = reshuffleStock(
        state.board,
        createRng(reshuffleSeed(state.round, state.moves, n)),
      );
      if (!shuffled) return false;
      playSound('shuffle');
      pushLog(
        { t: 'reshuffle' },
        {
          board: shuffled,
          usedJoker: true,
          used: { ...state.used, reshuffle: (state.used.reshuffle ?? 0) + 1 },
          jokerArmed: false,
          peekMode: false,
          hint: null,
          history: [
            ...state.history,
            { board: state.board, score: state.score, moves: state.moves },
          ],
          autoAvailable: canAutoComplete(shuffled),
        },
      );
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
      if (available('peek') <= 0) {
        set({ peekMode: false });
        return false;
      }
      playSound('flip');
      pushLog(
        { t: 'peek', card: cardId },
        {
          peekMode: false,
          peekCard: cardId,
          usedJoker: true,
          used: { ...state.used, peek: (state.used.peek ?? 0) + 1 },
        },
      );
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
      const on = state.sideBets.includes(id);
      if (!on) {
        // Les mises sont debitees a la fin de la manche: on verifie ici que
        // la banque les couvre toutes.
        const committed = state.sideBets.length * state.sideBetStake;
        const balance = useMetaStore.getState().wallet.balance;
        if (balance - committed < state.sideBetStake) {
          playSound('invalid');
          return false;
        }
      }
      playSound('chip');
      pushLog(
        { t: 'bet', id },
        {
          sideBets: on
            ? state.sideBets.filter((b) => b !== id)
            : [...state.sideBets, id],
        },
      );
      return true;
    },

    cashOut: async () => {
      if (get().busy) return;
      set({ busy: true });
      try {
        await economy.decide('cash');
        playSound('coins');
        syncSession();
        set({
          overlay: 'none',
          route: 'home',
          // Meme raison que dans goHome: la phase 'won' restee active
          // laisserait tourner l'effet de victoire sur l'accueil.
          phase: 'idle',
          win: null,
        });
      } catch (err) {
        reportFailure(err);
      } finally {
        set({ busy: false });
      }
    },

    cashOutHalf: async (insure = false) => {
      const state = get();
      playSound('coins');
      await start(
        { kind: 'half', difficulty: state.difficulty, insure },
        'gambling',
      );
    },

    doubleOrNothing: async (insure = false) => {
      const state = get();
      await start(
        { kind: 'double', difficulty: state.difficulty, insure },
        'gambling',
      );
    },

    secondChance: async () => {
      const state = get();
      if (state.phase !== 'lost') return;
      await start({ kind: 'second', difficulty: state.difficulty }, 'gambling');
    },

    gambleFromScore: async () => {
      const state = get();
      if (state.phase !== 'won' || !isScoring(state.mode)) return;
      if (state.mode === 'gambling' || state.unpaid) return;
      await start(
        { kind: 'fromScore', difficulty: state.difficulty },
        'gambling',
      );
    },

    enterVault: () => {
      const state = get();
      if (state.phase !== 'won' || !state.win?.vaultEligible) return;
      set({ overlay: 'vault', vaultResult: null });
    },

    openVault: async () => {
      const state = get();
      // Une seule ouverture par coffre.
      if (state.overlay !== 'vault' || state.vaultResult || state.busy) return;
      set({ busy: true });
      try {
        await economy.decide('vault');
        playSound('vault');
        syncSession();
        const pot = useMetaStore.getState().session.pot;
        set((s) => ({ win: s.win ? { ...s.win, potAfter: pot } : s.win }));
      } catch (err) {
        reportFailure(err);
      } finally {
        set({ busy: false });
      }
    },

    dismissWin: () => {
      set({ overlay: 'none' });
    },

    dismissLost: () => {
      set({ overlay: 'none' });
    },
  };
});

/** Mention affichee pour une graine imposee (pas de jetons). */
export const UNPAID_NOTE =
  'Graine imposée: partie d’entraînement, elle ne rapporte pas de jetons.';
