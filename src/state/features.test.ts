// Parcours complets des nouveautes: Vegas, Chrono, moitie a l'abri, paris
// annexes, jackpot progressif, jokers, missions, coffret de rang, donnes
// garanties et tutoriel.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyMove,
  cardId,
  findSolution,
  isWon,
  type Board,
  type Card,
  type Rank,
  type Suit,
} from '../engine';
import { TUTORIAL_SEED, foundationCount, useGameStore } from './game';
import { pendingRewards, useMetaStore } from './meta';
import {
  CHRONO_LIMIT_MS,
  CHRONO_POINTS_PER_SECOND,
  GUARANTEED_PAYOUT,
  PROGRESSIVE_SEED,
  VEGAS_STAKE,
  progressiveContribution,
  sideBetStake,
  vegasCardValue,
  type ConsumableId,
} from './catalog';
import {
  activeMissions,
  advance,
  emptyPeriod,
  missionReward,
  nextReset,
  periodKey,
} from './missions';
import { resetDealer } from './dealer';

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: cardId(suit, rank as Rank), suit, rank: rank as Rank, faceUp };
}

function upTo(suit: Suit, rank: number): Card[] {
  return Array.from({ length: rank }, (_, i) => card(suit, i + 1));
}

/** Plateau a un coup de la victoire: il ne reste que le Roi de pique. */
function oneMoveFromWin(extra: Partial<Board> = {}): Board {
  return {
    stock: [],
    waste: [],
    drawCount: 1,
    foundations: [
      upTo('spades', 12),
      upTo('hearts', 13),
      upTo('diamonds', 13),
      upTo('clubs', 13),
    ],
    tableau: [[card('spades', 13)], [], [], [], [], [], []],
    ...extra,
  };
}

function give(id: ConsumableId, count: number): void {
  useMetaStore.setState((s) => ({
    inventory: {
      ...s.inventory,
      consumables: { ...s.inventory.consumables, [id]: count },
    },
  }));
}

function setBoard(board: Board, extra: object = {}): void {
  useGameStore.setState({
    board,
    score: 400,
    startedAt: Date.now() - 60_000,
    ...extra,
  });
}

function winNow(): void {
  expect(
    useGameStore
      .getState()
      .applyDragMove({ type: 'tableauToFoundation', column: 0, foundation: 0 }),
  ).toBe(true);
  expect(useGameStore.getState().phase).toBe('won');
}

const balance = () => useMetaStore.getState().wallet.balance;

beforeEach(() => {
  localStorage.clear();
  resetDealer();
  useMetaStore.getState().resetProgress();
  useMetaStore.setState({
    wallet: { balance: 100_000, lifetimeEarned: 0, spent: 0 },
    notices: [],
    tutorial: { done: false },
  });
  useMetaStore
    .getState()
    .updateSettings({ soundEnabled: false, guaranteed: false });
  useGameStore.setState({
    route: 'home',
    phase: 'idle',
    mode: 'classic',
    pot: 0,
    combo: 0,
    modal: 'none',
    overlay: 'none',
    preparing: false,
  });
});

afterEach(() => vi.useRealTimers());

describe('Vegas', () => {
  it('fait payer la donne et limite les passages selon la pioche', () => {
    useGameStore.getState().newGame({ mode: 'vegas', difficulty: 'normal' });
    expect(balance()).toBe(100_000 - VEGAS_STAKE);
    expect(useGameStore.getState().board.recyclesLeft).toBe(0);
    useGameStore.getState().newGame({ mode: 'vegas', difficulty: 'expert' });
    expect(useGameStore.getState().board.recyclesLeft).toBe(2);
  });

  it('refuse de distribuer sans les 52 jetons, sans rien quitter', () => {
    useGameStore.getState().newGame({ mode: 'classic', seed: 'avant' });
    useMetaStore.setState({
      wallet: { balance: 10, lifetimeEarned: 0, spent: 0 },
    });
    useGameStore.getState().newGame({ mode: 'vegas' });
    expect(useGameStore.getState().mode).toBe('classic');
    expect(useGameStore.getState().seed).toBe('avant');
    expect(balance()).toBe(10);
    expect(
      useMetaStore.getState().notices.some((n) => n.kind === 'error'),
    ).toBe(true);
  });

  it('paie chaque carte rangee a la victoire', () => {
    useGameStore.getState().newGame({ mode: 'vegas', difficulty: 'hard' });
    setBoard(oneMoveFromWin());
    const before = balance();
    winNow();
    const vegas = useGameStore.getState().win!.vegas!;
    expect(vegas.cards).toBe(52);
    expect(vegas.cardValue).toBe(vegasCardValue('hard'));
    expect(vegas.net).toBe(52 * vegasCardValue('hard') - VEGAS_STAKE);
    expect(balance()).toBe(before + vegas.earned);
    expect(useGameStore.getState().win!.tip).toBe(0);
  });

  it('paie les cartes deja rangees quand on quitte, une seule fois', () => {
    useGameStore.getState().newGame({ mode: 'vegas', difficulty: 'normal' });
    const board = oneMoveFromWin();
    setBoard(board, { moves: 3 });
    const before = balance();
    useGameStore.getState().goHome();
    expect(balance()).toBe(before + 51 * vegasCardValue('normal'));
    useGameStore.getState().goHome();
    expect(balance()).toBe(before + 51 * vegasCardValue('normal'));
  });

  it('interdit d annuler et ne compte aucun point', () => {
    useGameStore.getState().newGame({ mode: 'vegas', seed: 'v' });
    useGameStore.getState().clickStock();
    const board = useGameStore.getState().board;
    useGameStore.getState().undo();
    expect(useGameStore.getState().board).toBe(board);
    useGameStore.getState().reportInvalid('spades-1');
    expect(useGameStore.getState().score).toBe(0);
  });
});

describe('Chrono', () => {
  it('perd la partie quand le compte a rebours tombe a zero', () => {
    vi.useFakeTimers();
    useGameStore.getState().newGame({ mode: 'chrono', seed: 'chrono' });
    useGameStore.getState().clickStock();
    expect(useGameStore.getState().startedAt).not.toBeNull();
    vi.advanceTimersByTime(CHRONO_LIMIT_MS - 1000);
    expect(useGameStore.getState().phase).toBe('playing');
    vi.advanceTimersByTime(2000);
    const state = useGameStore.getState();
    expect(state.phase).toBe('lost');
    expect(state.lost?.reason).toBe('time');
  });

  it('paie les secondes restantes a la victoire', () => {
    useGameStore.getState().newGame({ mode: 'chrono' });
    setBoard(oneMoveFromWin(), { startedAt: Date.now() - 100_000 });
    winNow();
    const speed = useGameStore.getState().win!.bonuses.speed;
    const expected =
      Math.floor((CHRONO_LIMIT_MS - 100_000) / 1000) * CHRONO_POINTS_PER_SECOND;
    expect(Math.abs(speed - expected)).toBeLessThanOrEqual(
      CHRONO_POINTS_PER_SECOND,
    );
  });

  it('ne declenche pas de defaite apres une nouvelle donne', () => {
    vi.useFakeTimers();
    useGameStore.getState().newGame({ mode: 'chrono', seed: 'a' });
    useGameStore.getState().clickStock();
    useGameStore.getState().newGame({ mode: 'classic', seed: 'b' });
    vi.advanceTimersByTime(CHRONO_LIMIT_MS + 1000);
    expect(useGameStore.getState().phase).toBe('playing');
  });
});

describe('moitie a l abri', () => {
  it('verse la moitie a la banque et rejoue avec l autre', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'free' });
    setBoard(oneMoveFromWin(), { pot: 1000, combo: 1 });
    winNow();
    const pot = useGameStore.getState().pot;
    const before = balance();
    useGameStore.getState().cashOutHalf();
    const state = useGameStore.getState();
    expect(balance()).toBe(before + Math.floor(pot / 2));
    expect(state.pot).toBe(pot - Math.floor(pot / 2));
    expect(state.phase).toBe('playing');
    expect(state.combo).toBe(2);
    // Plus de decision en attente: un second clic ne fait rien.
    useGameStore.getState().cashOutHalf();
    expect(balance()).toBe(before + Math.floor(pot / 2));
  });
});

describe('paris annexes', () => {
  it('se posent avant le premier coup et se retirent sans effet sur le rang', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'gold' });
    const stake = sideBetStake('gold');
    const start = balance();
    expect(useGameStore.getState().toggleSideBet('fast')).toBe(true);
    expect(balance()).toBe(start - stake);
    useGameStore.getState().toggleSideBet('fast');
    expect(balance()).toBe(start);
    expect(useMetaStore.getState().wallet.lifetimeEarned).toBe(0);

    useGameStore.getState().toggleSideBet('no-hint');
    useGameStore.getState().clickStock();
    expect(useGameStore.getState().toggleSideBet('no-undo')).toBe(false);
    expect(useGameStore.getState().sideBets).toEqual(['no-hint']);
  });

  it('sont payes si la condition tient, perdus sinon', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'gold' });
    const stake = sideBetStake('gold');
    useGameStore.getState().toggleSideBet('no-hint');
    useGameStore.getState().toggleSideBet('no-undo');
    setBoard(oneMoveFromWin(), { undoCount: 1 });
    const before = balance();
    winNow();
    const bets = useGameStore.getState().win!.bets;
    expect(bets.find((b) => b.id === 'no-hint')).toMatchObject({
      won: true,
      payout: stake * 2,
    });
    expect(bets.find((b) => b.id === 'no-undo')).toMatchObject({
      won: false,
      payout: 0,
    });
    expect(balance()).toBe(before + stake * 2);
  });

  it('sont perdus avec la manche et nourrissent la cagnotte', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'gold' });
    useGameStore.getState().toggleSideBet('fast');
    const pot = useMetaStore.getState().progressive.pot;
    useGameStore.getState().goHome();
    expect(useMetaStore.getState().progressive.pot).toBe(
      pot + Math.round(sideBetStake('gold') * 0.25),
    );
  });

  it('n existent qu au Jackpot', () => {
    useGameStore.getState().newGame({ mode: 'classic' });
    expect(useGameStore.getState().toggleSideBet('fast')).toBe(false);
  });
});

describe('jackpot progressif', () => {
  it('grossit a chaque manche distribuee', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'silver' });
    expect(useMetaStore.getState().progressive.pot).toBe(
      PROGRESSIVE_SEED + progressiveContribution('silver'),
    );
  });

  it('revient a l exploit en Expert, sans aide, a une table avec mise', () => {
    useGameStore
      .getState()
      .newGame({ mode: 'gambling', table: 'silver', difficulty: 'expert' });
    setBoard(oneMoveFromWin());
    const jackpot = useMetaStore.getState().progressive.pot;
    const before = balance();
    winNow();
    expect(useGameStore.getState().win!.progressive).toBe(jackpot);
    expect(balance()).toBe(before + jackpot);
    expect(useMetaStore.getState().progressive.pot).toBe(PROGRESSIVE_SEED);
  });

  it.each([
    ['un indice', { usedHint: true }],
    ['un annuler', { undoCount: 1 }],
    ['un joker', { usedJoker: true }],
    ['une donne garantie', { guaranteed: true }],
  ])('echappe au joueur qui a utilise %s', (_label, extra) => {
    useGameStore
      .getState()
      .newGame({ mode: 'gambling', table: 'silver', difficulty: 'expert' });
    setBoard(oneMoveFromWin(), extra);
    winNow();
    expect(useGameStore.getState().win!.progressive).toBe(0);
  });

  it('echappe a la table libre et aux autres difficultes', () => {
    useGameStore
      .getState()
      .newGame({ mode: 'gambling', table: 'free', difficulty: 'expert' });
    setBoard(oneMoveFromWin());
    winNow();
    expect(useGameStore.getState().win!.progressive).toBe(0);
    useGameStore
      .getState()
      .newGame({ mode: 'gambling', table: 'silver', difficulty: 'hard' });
    setBoard(oneMoveFromWin());
    winNow();
    expect(useGameStore.getState().win!.progressive).toBe(0);
  });
});

describe('jokers', () => {
  it('coup d oeil: consomme a la carte choisie, puis la recache', () => {
    vi.useFakeTimers();
    give('peek', 1);
    useGameStore.getState().newGame({ mode: 'classic', seed: 'oeil' });
    expect(useGameStore.getState().playJoker('peek')).toBe(true);
    expect(useMetaStore.getState().inventory.consumables.peek).toBe(1);
    const hidden = useGameStore.getState().board.tableau[6][0];
    // Une carte visible ne compte pas.
    const visible = useGameStore.getState().board.tableau[0][0];
    expect(useGameStore.getState().peekAt(visible.id)).toBe(false);
    expect(useGameStore.getState().peekAt(hidden.id)).toBe(true);
    expect(useGameStore.getState().peekCard).toBe(hidden.id);
    expect(useMetaStore.getState().inventory.consumables.peek).toBe(0);
    expect(useGameStore.getState().usedJoker).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(useGameStore.getState().peekCard).toBeNull();
  });

  it('remelange: rebat la pioche et consomme le joker', () => {
    give('reshuffle', 1);
    useGameStore.getState().newGame({ mode: 'classic', seed: 'mel' });
    const stock = useGameStore.getState().board.stock.map((c) => c.id);
    expect(useGameStore.getState().playJoker('reshuffle')).toBe(true);
    const after = useGameStore.getState().board.stock.map((c) => c.id);
    expect(after.slice().sort()).toEqual(stock.slice().sort());
    expect(after).not.toEqual(stock);
    expect(useMetaStore.getState().inventory.consumables.reshuffle).toBe(0);
    expect(useGameStore.getState().playJoker('reshuffle')).toBe(false);
  });

  it('joker: un coup normalement interdit passe une seule fois', () => {
    give('joker', 1);
    useGameStore.getState().newGame({ mode: 'classic', seed: 'jok' });
    setBoard({
      stock: [],
      waste: [card('hearts', 5)],
      foundations: [[], [], [], []],
      tableau: [
        [card('spades', 9)],
        [card('clubs', 1, false), card('clubs', 13)],
        [card('clubs', 2)],
        [card('clubs', 3)],
        [card('clubs', 4)],
        [card('diamonds', 4)],
        [card('diamonds', 3)],
      ],
      drawCount: 1,
    });
    const move = { type: 'wasteToTableau', column: 0 } as const;
    expect(useGameStore.getState().applyDragMove(move)).toBe(false);
    useGameStore.getState().playJoker('joker');
    expect(useGameStore.getState().jokerArmed).toBe(true);
    expect(useGameStore.getState().applyDragMove(move)).toBe(true);
    expect(useGameStore.getState().jokerArmed).toBe(false);
    expect(useMetaStore.getState().inventory.consumables.joker).toBe(0);
    expect(useGameStore.getState().board.tableau[0]).toHaveLength(2);
  });

  it('joker arme: un coup deja legal ne le consomme pas', () => {
    give('joker', 1);
    useGameStore.getState().newGame({ mode: 'classic', seed: 'legal' });
    setBoard(
      oneMoveFromWin({
        waste: [card('hearts', 8)],
        tableau: [
          [card('spades', 9)],
          [card('spades', 13)],
          [],
          [],
          [],
          [],
          [],
        ],
      }),
    );
    useGameStore.getState().playJoker('joker');
    useGameStore
      .getState()
      .applyDragMove({ type: 'wasteToTableau', column: 0 });
    expect(useMetaStore.getState().inventory.consumables.joker).toBe(1);
    expect(useGameStore.getState().jokerArmed).toBe(true);
  });

  it('refuse un joker absent de la reserve', () => {
    useGameStore.getState().newGame({ mode: 'classic' });
    expect(useGameStore.getState().playJoker('joker')).toBe(false);
    expect(useGameStore.getState().playJoker('peek')).toBe(false);
  });
});

describe('missions', () => {
  it('sont les memes pour une periode donnee', () => {
    const day = new Date(2026, 9, 8, 15);
    const key = periodKey('daily', day);
    expect(key).toBe('2026-10-08');
    expect(activeMissions('daily', key)).toEqual(activeMissions('daily', key));
    expect(activeMissions('daily', key)).toHaveLength(3);
    expect(periodKey('weekly', day)).toBe('2026-S41');
    expect(periodKey('weekly', new Date(2027, 0, 1))).toBe('2026-S53');
  });

  it('se renouvellent a minuit et le lundi', () => {
    const thursday = new Date(2026, 9, 8, 15);
    expect(nextReset('daily', thursday)).toEqual(new Date(2026, 9, 9));
    expect(nextReset('weekly', thursday)).toEqual(new Date(2026, 9, 12));
    const monday = new Date(2026, 9, 12, 9);
    expect(nextReset('weekly', monday)).toEqual(new Date(2026, 9, 19));
  });

  it('avancent, plafonnent et gardent le meilleur pour les series', () => {
    let period = emptyPeriod('weekly', new Date(2026, 9, 8));
    const defs = activeMissions('weekly', period.key);
    for (let i = 0; i < 30; i++) {
      period = advance(period, 'weekly', {
        kind: 'game',
        won: true,
        mode: 'chrono',
        difficulty: 'expert',
        timeMs: 60_000,
        undoCount: 0,
        usedHint: false,
        foundationCards: 52,
        vegasNet: 10,
      });
      period = advance(period, 'weekly', { kind: 'streak', length: i % 4 });
    }
    for (const def of defs) {
      expect(period.progress[def.id] ?? 0).toBeLessThanOrEqual(def.target);
    }
  });

  it('se recuperent une fois, bonus de rang compris', () => {
    const meta = useMetaStore.getState();
    const key = periodKey('daily');
    const def = activeMissions('daily', key)[0];
    // On complete la mission a la main.
    useMetaStore.setState({
      missions: {
        ...meta.missions,
        daily: { key, progress: { [def.id]: def.target }, claimed: [] },
      },
      wallet: { balance: 0, lifetimeEarned: 60_000, spent: 0 },
    });
    expect(pendingRewards(useMetaStore.getState())).toBeGreaterThanOrEqual(1);
    const amount = useMetaStore.getState().claimMission('daily', def.id);
    expect(amount).toBe(missionReward(def, 0.25));
    expect(useMetaStore.getState().claimMission('daily', def.id)).toBe(0);
  });

  it('suivent les parties jouees', () => {
    useGameStore.getState().newGame({ mode: 'classic', difficulty: 'expert' });
    setBoard(oneMoveFromWin());
    winNow();
    const daily = useMetaStore.getState().missions.daily;
    const tracked = activeMissions('daily', daily.key).filter((d) =>
      [
        'd-win-2',
        'd-classic',
        'd-hard',
        'd-cards',
        'd-no-undo',
        'd-no-hint',
      ].includes(d.id),
    );
    for (const def of tracked) {
      expect(daily.progress[def.id] ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('coffret de rang', () => {
  it('est vide au rang Bronze', () => {
    expect(useMetaStore.getState().canClaimWeeklyGift()).toBe(false);
    expect(useMetaStore.getState().claimWeeklyGift()).toEqual([]);
  });

  it('cumule les cadeaux des rangs et ne se recupere qu une fois par semaine', () => {
    useMetaStore.setState({
      wallet: { balance: 0, lifetimeEarned: 70_000, spent: 0 },
    });
    expect(useMetaStore.getState().claimWeeklyGift()).toEqual([
      'hint',
      'insurance',
      'joker',
    ]);
    const c = useMetaStore.getState().inventory.consumables;
    expect([c.hint, c.insurance, c.joker]).toEqual([1, 1, 1]);
    expect(useMetaStore.getState().canClaimWeeklyGift()).toBe(false);
    expect(useMetaStore.getState().claimWeeklyGift()).toEqual([]);
  });
});

describe('donnes garanties', () => {
  it('distribue une donne prouvee gagnable, un peu moins payee', async () => {
    useMetaStore.getState().updateSettings({ guaranteed: true });
    useGameStore.getState().newGame({ mode: 'classic', difficulty: 'normal' });
    expect(useGameStore.getState().preparing).toBe(true);
    await vi.waitFor(
      () => expect(useGameStore.getState().preparing).toBe(false),
      { timeout: 10_000 },
    );
    const state = useGameStore.getState();
    expect(state.guaranteed).toBe(true);
    expect(state.phase).toBe('playing');
    const solution = findSolution(state.board, 20_000);
    expect(Array.isArray(solution)).toBe(true);
    let board = state.board;
    for (const move of solution as never[])
      board = applyMove(board, move)!.board;
    expect(isWon(board)).toBe(true);

    setBoard(oneMoveFromWin(), { guaranteed: true });
    winNow();
    expect(useGameStore.getState().win!.guaranteedMultiplier).toBe(
      GUARANTEED_PAYOUT,
    );
  });

  it('respecte une graine imposee et le defi du jour', () => {
    useMetaStore.getState().updateSettings({ guaranteed: true });
    useGameStore.getState().newGame({ mode: 'classic', seed: 'imposee' });
    expect(useGameStore.getState().preparing).toBe(false);
    expect(useGameStore.getState().seed).toBe('imposee');
    useGameStore.getState().newGame({ mode: 'daily' });
    expect(useGameStore.getState().preparing).toBe(false);
    expect(useGameStore.getState().guaranteed).toBe(false);
  });
});

describe('tutoriel', () => {
  it('lance une donne douce ou un premier coup existe', () => {
    useGameStore.getState().startTutorial();
    const state = useGameStore.getState();
    expect(state.tutorial).toBe(true);
    expect(state.seed).toBe(TUTORIAL_SEED);
    expect(state.difficulty).toBe('easy');
    const tops = state.board.tableau.map((col) => col[col.length - 1]);
    expect(tops.some((c) => c.rank === 1)).toBe(true);
  });

  it('se termine une fois pour toutes', () => {
    useGameStore.getState().startTutorial();
    useGameStore.getState().endTutorial();
    expect(useGameStore.getState().tutorial).toBe(false);
    expect(useMetaStore.getState().tutorial.done).toBe(true);
  });
});

describe('cartes rangees', () => {
  it('se comptent sur les fondations', () => {
    expect(foundationCount(oneMoveFromWin())).toBe(51);
  });
});
