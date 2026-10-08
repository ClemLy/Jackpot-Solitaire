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
import {
  DAILY_BONUS,
  INSURANCE_REFUND,
  findDifficulty,
  findStakeTable,
  meetsTier,
  tipForWin,
  type DifficultyId,
  type StakeTableId,
} from './catalog';
import { playSound } from '../audio/sfx';
import { dailySeed, randomSeed, todayISO } from '../utils/seed';
import { formatNumber } from '../utils/format';

export type GameMode = 'classic' | 'gambling' | 'zen' | 'chrono' | 'daily';

export const MODE_LABEL: Record<GameMode, string> = {
  classic: 'Classique',
  gambling: 'Jackpot',
  daily: 'Défi du jour',
  chrono: 'Chrono',
  zen: 'Zen',
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
  /** Multiplicateur de serie (quitte ou double). */
  multiplier: number;
  /** Multiplicateur de la table a mise. */
  tableMultiplier: number;
  /** Multiplicateur du niveau de difficulte. */
  difficultyMultiplier: number;
  gain: number;
  potBefore: number;
  potAfter: number;
  vaultEligible: boolean;
  /** Jetons verses directement a la banque (hors Jackpot). */
  tip: number;
  dailyBonus: number;
  moves: number;
}

export interface LostSummary {
  finalScore: number;
  timeMs: number;
  wasGambling: boolean;
  potLost: number;
  /** Jetons rendus par l'assurance si la perte est confirmee. */
  refund: number;
}

export interface NewGameOptions {
  mode?: GameMode;
  difficulty?: DifficultyId;
  seed?: string;
  table?: StakeTableId;
}

interface GameStore {
  route: Route;
  modal: Modal;
  overlay: Overlay;

  mode: GameMode;
  difficulty: DifficultyId;
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
  stakeTable: StakeTableId;
  insured: boolean;
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

function stopAutoTimer(): void {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function isRiskingPot(state: GameStore): boolean {
  return state.mode === 'gambling' && state.pot > 0;
}

function insuranceRefund(state: GameStore): number {
  return state.insured ? Math.round(state.pot * INSURANCE_REFUND) : 0;
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
        playSound('whoosh');
      }
      set({ pot: 0, combo: 0, insured: false });
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
    stopAutoTimer();
    const { drawCount, gentle } = findDifficulty(difficulty);
    const board = deal(seed, drawCount, { gentle });
    useMetaStore.getState().recordDeal();
    playSound('shuffle');
    set((state) => ({
      route: 'game',
      overlay: 'none',
      modal: 'none',
      mode,
      difficulty,
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
      insured: keepPot ? state.insured : false,
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
    let gain = roundScore;
    const potBefore = pot;

    if (state.mode === 'gambling') {
      multiplier = comboMultiplier(combo);
      gain = Math.round(
        roundScore * multiplier * tableMultiplier * difficultyMultiplier,
      );
      // Le magot lui-meme ne descend jamais sous zero: un score negatif
      // rogne la mise mais ne rend jamais la banque debitrice.
      pot = Math.max(0, pot + gain);
      combo = combo + 1;
      if (table.id === 'diamond') meta.unlock('high-stakes');
    }

    // Hors Jackpot, une victoire verse un pourboire direct a la banque.
    const tip = tipForWin(state.mode, roundScore, difficultyMultiplier);
    const dailyBonus = firstDailyWin ? DAILY_BONUS : 0;
    meta.credit(tip + dailyBonus);

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
        tableMultiplier,
        difficultyMultiplier,
        gain,
        potBefore,
        potAfter: pot,
        vaultEligible,
        tip,
        dailyBonus,
        moves: state.moves,
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

    // Le magot reste en suspens tant que le joueur n'a pas choisi: une
    // seconde chance peut encore le sauver. Il n'est solde (et l'assurance
    // versee) qu'au moment de quitter ou de relancer, via settleBust.
    const wasGambling = isRiskingPot(state);
    const potLost = wasGambling ? state.pot : 0;

    playSound('penalty');
    set({
      phase: 'lost',
      finalTimeMs: timeMs,
      overlay: 'lost',
      autoAvailable: false,
      autoCompleting: false,
      hint: null,
      lost: {
        finalScore: state.score,
        timeMs,
        wasGambling,
        potLost,
        refund: wasGambling ? insuranceRefund(state) : 0,
      },
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
      if (!move) {
        set({ autoCompleting: false });
        stopAutoTimer();
        return;
      }
      commitMove(move);
      if (get().phase === 'playing' && get().autoCompleting) {
        scheduleAutoStep();
      }
      // Cadence rapide mais lisible: l'animation de vol dure 0.32s, donc
      // plusieurs cartes sont en vol en meme temps, ce qui donne une jolie
      // cascade de rangement.
    }, 130);
  }

  return {
    route: 'home',
    modal: 'none',
    overlay: 'none',

    mode: 'classic',
    difficulty: 'expert',
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
    stakeTable: 'free',
    insured: false,
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
      settleBust();
      stopAutoTimer();
      set({
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
      });
    },

    newGame: (options) => {
      const meta = useMetaStore.getState();
      const state = get();
      settleBust();
      const mode = options?.mode ?? state.mode;
      const difficulty = options?.difficulty ?? meta.settings.difficulty;
      let seed = options?.seed;
      if (!seed) {
        seed = mode === 'daily' ? dailySeed() : randomSeed();
      }
      if (mode !== 'gambling') {
        dealRound(mode, difficulty, seed, false);
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
      dealRound(mode, difficulty, seed, false, {
        stakeTable: table.id,
        pot: table.stake,
      });
    },

    restartSameSeed: () => {
      const state = get();
      settleBust();
      dealRound(state.mode, state.difficulty, state.seed, false);
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
      const previous = state.history[state.history.length - 1];
      const scoring = state.mode !== 'zen';
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
      const scoring = state.mode !== 'zen';
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

    cashOut: () => {
      const state = get();
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

    doubleOrNothing: (insure = false) => {
      const state = get();
      // L'assurance couvre uniquement la manche qui s'ouvre.
      const insured =
        insure && useMetaStore.getState().useConsumable('insurance');
      dealRound('gambling', state.difficulty, randomSeed(), true, {
        insured,
      });
    },

    secondChance: () => {
      const state = get();
      if (state.phase !== 'lost' || !isRiskingPot(state)) return;
      if (!useMetaStore.getState().useConsumable('redeal')) return;
      // Le magot et la serie sont conserves tels quels: la manche bloquee
      // est simplement effacee et remplacee par une donne neuve.
      dealRound('gambling', state.difficulty, randomSeed(), true);
    },

    gambleFromScore: () => {
      const state = get();
      const seed = randomSeed();
      // On transforme la victoire actuelle en premiere manche d'une serie.
      set({ mode: 'gambling', pot: state.score, combo: 1 });
      dealRound('gambling', state.difficulty, seed, true, {
        stakeTable: 'free',
        insured: false,
      });
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
