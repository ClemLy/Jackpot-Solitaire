import { create } from 'zustand';
import {
  applyMove,
  canAutoComplete,
  deal,
  endGameBonuses,
  findHint,
  isDeadlock,
  isWon,
  nextAutoCompleteMove,
  scoreForOutcome,
  autoMoveFromTableau,
  autoMoveFromWaste,
  SCORE,
  type Board,
  type EndBonuses,
  type Move,
} from '../engine';
import { comboMultiplier, drawVaultOutcome, vaultUnlocked } from './gambling';
import { useMetaStore } from './meta';
import { playSound } from '../audio/sfx';
import { dailySeed, randomSeed, todayISO } from '../utils/seed';

export type GameMode = 'classic' | 'gambling' | 'zen' | 'chrono' | 'daily';
export type Route = 'home' | 'game';
export type Modal =
  | 'none'
  | 'rules'
  | 'stats'
  | 'settings'
  | 'newgame'
  | 'themes'
  | 'confirmLeave';
export type Overlay = 'none' | 'win' | 'vault' | 'lost';

interface Snapshot {
  board: Board;
  score: number;
  moves: number;
}

export interface WinSummary {
  roundScore: number;
  bonuses: EndBonuses;
  baseScore: number;
  multiplier: number;
  gain: number;
  potBefore: number;
  potAfter: number;
  vaultEligible: boolean;
}

export interface LostSummary {
  finalScore: number;
  timeMs: number;
  wasGambling: boolean;
  potLost: number;
}

export interface NewGameOptions {
  mode?: GameMode;
  drawCount?: 1 | 3;
  seed?: string;
}

interface GameStore {
  route: Route;
  modal: Modal;
  overlay: Overlay;

  mode: GameMode;
  drawCount: 1 | 3;
  seed: string;

  board: Board;
  phase: 'idle' | 'playing' | 'won' | 'lost';
  score: number;
  moves: number;
  invalidMoves: number;
  undoCount: number;
  hintCount: number;
  usedHint: boolean;
  startedAt: number | null;
  finalTimeMs: number;
  history: Snapshot[];
  autoAvailable: boolean;
  autoCompleting: boolean;

  pot: number;
  combo: number;
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

  // Gambling.
  cashOut: () => void;
  doubleOrNothing: () => void;
  gambleFromScore: () => void;
  enterVault: () => void;
  openVault: () => void;
  dismissWin: () => void;
  dismissLost: () => void;
}

let autoTimer: ReturnType<typeof setTimeout> | null = null;

function stopAutoTimer(): void {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function isRiskingPot(state: GameStore): boolean {
  return state.mode === 'gambling' && state.pot > 0;
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

const firstBoard = deal('bienvenue', 3);

export const useGameStore = create<GameStore>()((set, get) => {
  /** Enregistre la perte du magot en cours (abandon d'une serie gambling). */
  function settleBust(): void {
    const state = get();
    if (isRiskingPot(state)) {
      useMetaStore.getState().secureBank(0, state.combo);
      playSound('whoosh');
    }
  }

  /** Distribue une nouvelle donne et remet a zero l'etat vivant de la partie. */
  function dealRound(
    mode: GameMode,
    drawCount: 1 | 3,
    seed: string,
    keepPot: boolean,
  ): void {
    stopAutoTimer();
    const board = deal(seed, drawCount);
    useMetaStore.getState().recordDeal();
    playSound('shuffle');
    set((state) => ({
      route: 'game',
      overlay: 'none',
      modal: 'none',
      mode,
      drawCount,
      seed,
      board,
      phase: 'playing',
      score: 0,
      moves: 0,
      invalidMoves: 0,
      undoCount: 0,
      hintCount: 0,
      usedHint: false,
      startedAt: null,
      finalTimeMs: 0,
      history: [],
      autoAvailable: false,
      autoCompleting: false,
      pot: keepPot ? state.pot : 0,
      combo: keepPot ? state.combo : 0,
      win: null,
      lost: null,
      vaultResult: null,
      bust: null,
      hint: null,
      shake: null,
    }));
  }

  /** Fin de partie gagnee: bonus, score final, stats, et logique gambling. */
  function handleWin(): void {
    stopAutoTimer();
    const state = get();
    const scoring = state.mode !== 'zen';
    const timeMs = computeElapsed(state);
    const bonuses = scoring
      ? endGameBonuses({
          elapsedSeconds: timeMs / 1000,
          invalidMoves: state.invalidMoves,
          undoCount: state.undoCount,
        })
      : { speed: 0, precision: 0, total: 0 };
    const baseScore = state.score;
    const roundScore = baseScore + bonuses.total;

    useMetaStore.getState().resolveGame({
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
    let gain = roundScore;
    const potBefore = pot;

    if (state.mode === 'gambling') {
      multiplier = comboMultiplier(combo);
      gain = Math.round(roundScore * multiplier);
      // Le magot lui-meme ne descend jamais sous zero: un score negatif
      // rogne la mise mais ne rend jamais la banque debitrice.
      pot = Math.max(0, pot + gain);
      combo = combo + 1;
    }

    const vaultEligible = state.mode === 'gambling' && vaultUnlocked(combo);

    playSound('win');
    set({
      phase: 'won',
      finalTimeMs: timeMs,
      score: roundScore,
      pot,
      combo,
      overlay: 'win',
      autoAvailable: false,
      autoCompleting: false,
      hint: null,
      win: {
        roundScore,
        bonuses,
        baseScore,
        multiplier,
        gain,
        potBefore,
        potAfter: pot,
        vaultEligible,
      },
    });
  }

  /** Partie mathematiquement bloquee: plus aucun coup ne peut jamais aider. */
  function handleLost(): void {
    stopAutoTimer();
    const state = get();
    const timeMs = computeElapsed(state);

    useMetaStore.getState().resolveGame({
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

    const wasGambling = state.mode === 'gambling' && state.pot > 0;
    const potLost = wasGambling ? state.pot : 0;
    if (wasGambling) {
      useMetaStore.getState().secureBank(0, state.combo);
    }

    playSound('penalty');
    set({
      phase: 'lost',
      finalTimeMs: timeMs,
      overlay: 'lost',
      autoAvailable: false,
      autoCompleting: false,
      hint: null,
      pot: wasGambling ? 0 : state.pot,
      combo: wasGambling ? 0 : state.combo,
      lost: { finalScore: state.score, timeMs, wasGambling, potLost },
    });
  }

  /** Applique un coup valide, met a jour score, sons et signaux. */
  function commitMove(move: Move): boolean {
    const state = get();
    if (state.phase !== 'playing') return false;
    const result = applyMove(state.board, move);
    if (!result) return false;

    const scoring = state.mode !== 'zen';
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
      autoAvailable: canAutoComplete(result.board),
    });

    if (isWon(result.board)) {
      handleWin();
    } else if (isDeadlock(result.board)) {
      handleLost();
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
      if (!move) {
        set({ autoCompleting: false });
        stopAutoTimer();
        return;
      }
      commitMove(move);
      if (get().phase === 'playing' && get().autoCompleting) {
        scheduleAutoStep();
      }
      // Cadence pensee pour laisser le temps de voir chaque carte voler
      // vers sa fondation (l'animation dure 0.32s) avant le coup suivant.
    }, 220);
  }

  return {
    route: 'home',
    modal: 'none',
    overlay: 'none',

    mode: 'classic',
    drawCount: 3,
    seed: 'bienvenue',

    board: firstBoard,
    phase: 'idle',
    score: 0,
    moves: 0,
    invalidMoves: 0,
    undoCount: 0,
    hintCount: 0,
    usedHint: false,
    startedAt: null,
    finalTimeMs: 0,
    history: [],
    autoAvailable: false,
    autoCompleting: false,

    pot: 0,
    combo: 0,
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
      settleBust();
      stopAutoTimer();
      set((state) => ({
        route: 'home',
        overlay: 'none',
        modal: 'none',
        // On sort completement de la partie: sans ca, une phase 'won' ou
        // 'lost' restee active continuerait de faire tourner l'animation de
        // victoire (ou l'ecran de defaite) par dessus l'accueil.
        phase: 'idle',
        autoCompleting: false,
        win: null,
        lost: null,
        pot: isRiskingPot(state) ? 0 : state.pot,
        combo: isRiskingPot(state) ? 0 : state.combo,
      }));
    },

    newGame: (options) => {
      const meta = useMetaStore.getState();
      const state = get();
      settleBust();
      const mode = options?.mode ?? state.mode;
      const drawCount = options?.drawCount ?? meta.settings.defaultDraw;
      let seed = options?.seed;
      if (!seed) {
        seed = mode === 'daily' ? dailySeed() : randomSeed();
      }
      dealRound(mode, drawCount, seed, false);
    },

    restartSameSeed: () => {
      const state = get();
      settleBust();
      dealRound(state.mode, state.drawCount, state.seed, false);
    },

    clickStock: () => {
      const state = get();
      if (state.phase !== 'playing') return;
      if (state.board.stock.length > 0) {
        commitMove({ type: 'draw' });
      } else if (state.board.waste.length > 0) {
        commitMove({ type: 'recycle' });
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

    applyDragMove: (move) => commitMove(move),

    reportInvalid: (cardId) => {
      const state = get();
      const scoring = state.mode !== 'zen';
      playSound('invalid');
      set({
        invalidMoves: state.invalidMoves + 1,
        score: scoring ? state.score + SCORE.invalidPenalty : state.score,
        shake: { id: cardId, nonce: Date.now() },
      });
    },

    undo: () => {
      const state = get();
      if (state.phase !== 'playing' || state.history.length === 0) return;
      const previous = state.history[state.history.length - 1];
      const scoring = state.mode !== 'zen';
      playSound('whoosh');
      set({
        board: previous.board,
        moves: previous.moves,
        score: scoring ? previous.score + SCORE.undoPenalty : previous.score,
        undoCount: state.undoCount + 1,
        history: state.history.slice(0, -1),
        hint: null,
        shake: null,
        autoAvailable: canAutoComplete(previous.board),
      });
    },

    requestHint: () => {
      const state = get();
      if (state.phase !== 'playing') return;
      const move = findHint(state.board);
      if (!move) {
        playSound('invalid');
        return;
      }
      const scoring = state.mode !== 'zen';
      playSound('button');
      set({
        hint: move,
        hintNonce: state.hintNonce + 1,
        hintCount: state.hintCount + 1,
        usedHint: true,
        score: scoring ? state.score + SCORE.hintPenalty : state.score,
      });
    },

    clearHint: () => set({ hint: null }),

    startAutoComplete: () => {
      const state = get();
      if (state.phase !== 'playing' || !state.autoAvailable) return;
      set({ autoCompleting: true });
      scheduleAutoStep();
    },

    cashOut: () => {
      const state = get();
      const amount = state.pot;
      useMetaStore.getState().secureBank(amount, state.combo);
      playSound('coins');
      set({
        pot: 0,
        combo: 0,
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

    doubleOrNothing: () => {
      const state = get();
      dealRound('gambling', state.drawCount, randomSeed(), true);
    },

    gambleFromScore: () => {
      const state = get();
      const seed = randomSeed();
      // On transforme la victoire actuelle en premiere manche d'une serie.
      set({ mode: 'gambling', pot: state.score, combo: 1 });
      dealRound('gambling', state.drawCount, seed, true);
    },

    enterVault: () => {
      set({ overlay: 'vault', vaultResult: null });
    },

    openVault: () => {
      const state = get();
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
