// Parcours complets du store de partie: victoire, Jackpot, coffre, defaite,
// assurance, seconde chance, et les garde-fous des actions d'argent.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardId, type Board, type Card, type Rank, type Suit } from '../engine';
import { useGameStore } from './game';
import { useMetaStore } from './meta';
import { findDifficulty, type DifficultyId } from './catalog';
import { comboMultiplier } from './gambling';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: cardId(suit, rank as Rank), suit, rank: rank as Rank, faceUp };
}

function upTo(suit: Suit, rank: number): Card[] {
  return Array.from({ length: rank }, (_, i) => card(suit, i + 1));
}

/** Plateau a un coup de la victoire: il ne reste que le Roi de pique. */
function oneMoveFromWin(drawCount: 1 | 3 = 3): Board {
  return {
    stock: [],
    waste: [],
    drawCount,
    foundations: [
      upTo('spades', 12),
      upTo('hearts', 13),
      upTo('diamonds', 13),
      upTo('clubs', 13),
    ],
    tableau: [[card('spades', 13)], [], [], [], [], [], []],
  };
}

/** Plateau definitivement bloque: sept cartes noires, aucune place libre. */
function deadlockedBoard(): Board {
  const tops: [Suit, number][] = [
    ['spades', 13],
    ['clubs', 13],
    ['spades', 12],
    ['clubs', 12],
    ['spades', 11],
    ['clubs', 11],
    ['spades', 10],
  ];
  return {
    stock: [],
    waste: [],
    drawCount: 3,
    foundations: [[], [], [], []],
    tableau: tops.map(([suit, rank], i) => [
      card(SUITS[1 + (i % 2)], 2 + i, false),
      card(suit, rank),
    ]),
  };
}

function resetAll(balance = 0): void {
  localStorage.clear();
  useMetaStore.getState().resetProgress();
  useMetaStore.setState({
    wallet: { balance, lifetimeEarned: 0, spent: 0 },
    notices: [],
  });
  useMetaStore.getState().updateSettings({ soundEnabled: false });
  useGameStore.setState({
    pot: 0,
    combo: 0,
    insured: false,
    mode: 'classic',
    modal: 'none',
    pendingAction: null,
  });
}

/** Lance une partie puis remplace la donne par un plateau choisi. */
function startOn(
  board: Board,
  opts: {
    mode?: 'classic' | 'gambling' | 'zen';
    difficulty?: DifficultyId;
  } = {},
): void {
  useGameStore
    .getState()
    .newGame({ mode: opts.mode ?? 'classic', difficulty: opts.difficulty });
  useGameStore.setState({
    board,
    score: 500,
    startedAt: Date.now() - 60_000,
  });
}

function winNow(): void {
  const ok = useGameStore
    .getState()
    .applyDragMove({ type: 'tableauToFoundation', column: 0, foundation: 0 });
  expect(ok).toBe(true);
  expect(useGameStore.getState().phase).toBe('won');
}

beforeEach(() => resetAll(5000));
afterEach(() => vi.useRealTimers());

describe('victoire hors Jackpot', () => {
  it.each<DifficultyId>(['easy', 'normal', 'hard', 'expert'])(
    'verse un pourboire pondere par la difficulte (%s)',
    (difficulty) => {
      startOn(oneMoveFromWin(), { difficulty });
      const before = useMetaStore.getState().wallet.balance;
      winNow();
      const { win, overlay } = useGameStore.getState();
      expect(overlay).toBe('win');
      const payout = findDifficulty(difficulty).payout;
      expect(win?.difficultyMultiplier).toBe(payout);
      expect(win?.tip).toBe(Math.round(win!.roundScore * 0.1 * payout));
      expect(useMetaStore.getState().wallet.balance).toBe(before + win!.tip);
      expect(useMetaStore.getState().stats.gamesWon).toBe(1);
    },
  );

  it('peut transformer la victoire en mise Jackpot, une seule fois', () => {
    startOn(oneMoveFromWin());
    winNow();
    const score = useGameStore.getState().score;
    useGameStore.getState().gambleFromScore();
    expect(useGameStore.getState().mode).toBe('gambling');
    expect(useGameStore.getState().pot).toBe(score);
    expect(useGameStore.getState().phase).toBe('playing');
    // Deuxieme appel (double clic): la partie est en cours, rien ne bouge.
    useGameStore.getState().gambleFromScore();
    expect(useGameStore.getState().pot).toBe(score);
  });

  it('ne laisse pas miser une partie Zen ni une partie en cours', () => {
    startOn(oneMoveFromWin(), { mode: 'zen' });
    useGameStore.getState().gambleFromScore();
    expect(useGameStore.getState().mode).toBe('zen');
    winNow();
    useGameStore.getState().gambleFromScore();
    expect(useGameStore.getState().mode).toBe('zen');
  });
});

describe('mode Jackpot', () => {
  it('multiplie le gain par la serie, la table et la difficulte', () => {
    startOn(oneMoveFromWin(), { mode: 'gambling', difficulty: 'hard' });
    useGameStore.setState({ combo: 2, pot: 1000 });
    winNow();
    const { win, pot, combo } = useGameStore.getState();
    const expected = Math.round(win!.roundScore * comboMultiplier(2) * 1 * 1.5);
    expect(win?.gain).toBe(expected);
    expect(pot).toBe(1000 + expected);
    expect(combo).toBe(3);
    expect(win?.vaultEligible).toBe(true);
    expect(win?.tip).toBe(0);
  });

  it('encaisse le magot une seule fois et seulement apres une victoire', () => {
    startOn(oneMoveFromWin(), { mode: 'gambling' });
    useGameStore.setState({ pot: 800 });
    const start = useMetaStore.getState().wallet.balance;

    // En pleine partie, encaisser ne fait rien.
    useGameStore.getState().cashOut();
    expect(useGameStore.getState().pot).toBe(800);
    expect(useMetaStore.getState().wallet.balance).toBe(start);

    winNow();
    const pot = useGameStore.getState().pot;
    useGameStore.getState().cashOut();
    useGameStore.getState().cashOut();
    expect(useMetaStore.getState().wallet.balance).toBe(start + pot);
    expect(useGameStore.getState()).toMatchObject({
      pot: 0,
      route: 'home',
      phase: 'idle',
    });
  });

  it('quitte ou double: garde le magot, consomme une seule assurance', () => {
    useMetaStore.setState((s) => ({
      inventory: {
        ...s.inventory,
        consumables: { ...s.inventory.consumables, insurance: 2 },
      },
    }));
    startOn(oneMoveFromWin(), { mode: 'gambling' });
    // Pas de quitte ou double tant que la manche n'est pas gagnee.
    useGameStore.getState().doubleOrNothing(true);
    expect(useMetaStore.getState().inventory.consumables.insurance).toBe(2);

    winNow();
    const pot = useGameStore.getState().pot;
    useGameStore.getState().doubleOrNothing(true);
    useGameStore.getState().doubleOrNothing(true);
    const state = useGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.pot).toBe(pot);
    expect(state.insured).toBe(true);
    expect(useMetaStore.getState().inventory.consumables.insurance).toBe(1);
  });

  it('n ouvre le coffre qu apres trois victoires, et une seule fois', () => {
    startOn(oneMoveFromWin(), { mode: 'gambling' });
    useGameStore.setState({ combo: 0, pot: 100 });
    winNow();
    useGameStore.getState().enterVault();
    expect(useGameStore.getState().overlay).toBe('win');

    startOn(oneMoveFromWin(), { mode: 'gambling' });
    useGameStore.setState({ combo: 2, pot: 1000 });
    winNow();
    useGameStore.getState().enterVault();
    expect(useGameStore.getState().overlay).toBe('vault');
    const potBefore = useGameStore.getState().pot;
    useGameStore.getState().openVault();
    const after = useGameStore.getState();
    expect(after.vaultResult).not.toBeNull();
    expect(after.pot).toBe(
      Math.max(0, Math.round(potBefore * after.vaultResult!.multiplier)),
    );
    useGameStore.getState().openVault();
    expect(useGameStore.getState().pot).toBe(after.pot);
    expect(useMetaStore.getState().gambling.vaultsOpened).toBe(1);
  });
});

describe('donne bloquee', () => {
  it('declare la defaite quand l indice ne trouve plus rien', () => {
    startOn(deadlockedBoard());
    useGameStore.getState().requestHint();
    const state = useGameStore.getState();
    expect(state.phase).toBe('lost');
    expect(state.overlay).toBe('lost');
    expect(useMetaStore.getState().stats.currentWinStreak).toBe(0);
  });

  it('l assurance rend la moitie du magot en quittant', () => {
    startOn(deadlockedBoard(), { mode: 'gambling' });
    useGameStore.setState({ pot: 3000, combo: 2, insured: true });
    const start = useMetaStore.getState().wallet.balance;
    useGameStore.getState().requestHint();
    expect(useGameStore.getState().lost).toMatchObject({
      wasGambling: true,
      potLost: 3000,
      refund: 1500,
    });
    useGameStore.getState().goHome();
    expect(useMetaStore.getState().wallet.balance).toBe(start + 1500);
    expect(useGameStore.getState().pot).toBe(0);
  });

  it('la seconde chance redistribue en gardant le magot', () => {
    startOn(deadlockedBoard(), { mode: 'gambling' });
    useGameStore.setState({ pot: 3000, combo: 2 });
    useGameStore.getState().requestHint();

    // Sans jeton de seconde chance: refuse.
    useGameStore.getState().secondChance();
    expect(useGameStore.getState().phase).toBe('lost');

    useMetaStore.setState((s) => ({
      inventory: {
        ...s.inventory,
        consumables: { ...s.inventory.consumables, redeal: 1 },
      },
    }));
    useGameStore.getState().secondChance();
    const state = useGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.pot).toBe(3000);
    expect(state.combo).toBe(2);
    expect(useMetaStore.getState().inventory.consumables.redeal).toBe(0);
  });
});

describe('coups et penalites', () => {
  it('annuler restaure le plateau avec une penalite', () => {
    useGameStore.getState().newGame({ mode: 'classic', seed: 'annuler' });
    const before = useGameStore.getState().board;
    useGameStore.getState().clickStock();
    expect(useGameStore.getState().board).not.toEqual(before);
    useGameStore.getState().undo();
    const state = useGameStore.getState();
    expect(state.board).toEqual(before);
    expect(state.score).toBe(-15);
    expect(state.undoCount).toBe(1);
  });

  it('annuler interrompt un rangement automatique', () => {
    vi.useFakeTimers();
    const board: Board = {
      ...oneMoveFromWin(),
      foundations: [
        upTo('spades', 11),
        upTo('hearts', 13),
        upTo('diamonds', 13),
        upTo('clubs', 13),
      ],
      tableau: [[card('spades', 13)], [card('spades', 12)], [], [], [], [], []],
    };
    startOn(board);
    useGameStore
      .getState()
      .applyDragMove({ type: 'tableauToTableau', from: 0, to: 2, count: 1 });
    expect(useGameStore.getState().autoCompleting).toBe(true);
    useGameStore.getState().undo();
    expect(useGameStore.getState().autoCompleting).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(useGameStore.getState().phase).toBe('playing');
  });

  it('ne range pas tout seul tant qu il reste une carte cachee', () => {
    vi.useFakeTimers();
    const board: Board = {
      ...oneMoveFromWin(),
      foundations: [
        upTo('spades', 10),
        upTo('hearts', 13),
        upTo('diamonds', 13),
        upTo('clubs', 13),
      ],
      tableau: [
        [
          card('spades', 13, false),
          card('spades', 12, false),
          card('spades', 11),
        ],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
    };
    startOn(board);
    useGameStore
      .getState()
      .applyDragMove({ type: 'tableauToFoundation', column: 0, foundation: 0 });
    // La Dame vient d'etre revelee, mais le Roi est encore cache.
    expect(useGameStore.getState().autoCompleting).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(useGameStore.getState().phase).toBe('playing');
  });

  it('penalise un coup impossible, sauf en Zen', () => {
    startOn(oneMoveFromWin());
    useGameStore.getState().reportInvalid('spades-13');
    expect(useGameStore.getState().score).toBe(495);
    startOn(oneMoveFromWin(), { mode: 'zen' });
    useGameStore.getState().reportInvalid('spades-13');
    expect(useGameStore.getState().score).toBe(500);
  });

  it('l oeil du croupier offre l indice sans penalite', () => {
    startOn(oneMoveFromWin());
    useGameStore.getState().requestHint();
    expect(useGameStore.getState().score).toBe(475);
    useMetaStore.setState((s) => ({
      inventory: {
        ...s.inventory,
        consumables: { ...s.inventory.consumables, hint: 1 },
      },
    }));
    useGameStore.getState().requestHint();
    expect(useGameStore.getState().score).toBe(475);
    expect(useGameStore.getState().freeHint).toBe(true);
    expect(useMetaStore.getState().inventory.consumables.hint).toBe(0);
  });
});

describe('nouvelle partie', () => {
  it('nettoie la graine fournie', () => {
    useGameStore.getState().newGame({ seed: '  ab\u0000c  ' });
    expect(useGameStore.getState().seed).toBe('abc');
    useGameStore.getState().newGame({ seed: '\u0000\u0001' });
    expect(useGameStore.getState().seed).toMatch(/^\d{6}$/);
  });

  it('impose la graine du jour au defi', () => {
    useGameStore.getState().newGame({ mode: 'daily' });
    expect(useGameStore.getState().seed).toMatch(/^defi-\d{4}-\d{2}-\d{2}$/);
  });

  it('demande confirmation avant d abandonner un magot', () => {
    startOn(oneMoveFromWin(), { mode: 'gambling' });
    useGameStore.setState({ pot: 1200 });
    const action = vi.fn();
    useGameStore.getState().requestLeave(action);
    expect(action).not.toHaveBeenCalled();
    expect(useGameStore.getState().modal).toBe('confirmLeave');
    useGameStore.getState().cancelPendingAction();
    expect(action).not.toHaveBeenCalled();

    useGameStore.getState().requestLeave(action);
    useGameStore.getState().confirmPendingAction();
    expect(action).toHaveBeenCalledTimes(1);

    useGameStore.setState({ pot: 0 });
    const direct = vi.fn();
    useGameStore.getState().requestLeave(direct);
    expect(direct).toHaveBeenCalledTimes(1);
  });

  it('se rabat sur la table libre quand le rang manque', () => {
    useMetaStore.setState({
      wallet: { balance: 1e6, lifetimeEarned: 0, spent: 0 },
    });
    useGameStore.getState().newGame({ mode: 'gambling', table: 'platinum' });
    expect(useGameStore.getState().stakeTable).toBe('free');
    expect(useMetaStore.getState().wallet.balance).toBe(1e6);
  });
});
