import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canAutoComplete,
  canRecycle,
  cardId,
  createRng,
  deal,
  findSolution,
  findWinnableSeed,
  isDeadlock,
  isWon,
  nextAutoCompleteMove,
  reshuffleStock,
  solve,
  type Board,
  type Card,
  type Rank,
  type Suit,
} from './index';

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: cardId(suit, rank as Rank), suit, rank: rank as Rank, faceUp };
}

function replay(board: Board, moves: ReturnType<typeof findSolution>): Board {
  if (!Array.isArray(moves)) throw new Error('pas de solution');
  let current = board;
  for (const move of moves) {
    const result = applyMove(current, move);
    if (!result) throw new Error(`coup illegal: ${JSON.stringify(move)}`);
    current = result.board;
  }
  return current;
}

describe('pioche limitee (Vegas)', () => {
  it('compte les passages et refuse le recyclage de trop', () => {
    let board = deal('vegas', 3, { recycles: 1 });
    expect(board.recyclesLeft).toBe(1);
    while (board.stock.length > 0)
      board = applyMove(board, { type: 'draw' })!.board;
    expect(canRecycle(board)).toBe(true);
    board = applyMove(board, { type: 'recycle' })!.board;
    expect(board.recyclesLeft).toBe(0);
    while (board.stock.length > 0)
      board = applyMove(board, { type: 'draw' })!.board;
    expect(canRecycle(board)).toBe(false);
    expect(applyMove(board, { type: 'recycle' })).toBeNull();
    // L'autocompletion ne propose jamais un recyclage interdit.
    expect(nextAutoCompleteMove(board)?.type).not.toBe('recycle');
  });

  it('reste illimitee hors Vegas', () => {
    let board = deal('libre', 1);
    expect(board.recyclesLeft).toBeUndefined();
    for (let pass = 0; pass < 4; pass++) {
      while (board.stock.length > 0)
        board = applyMove(board, { type: 'draw' })!.board;
      board = applyMove(board, { type: 'recycle' })!.board;
    }
    expect(board.stock).toHaveLength(24);
  });

  it('declare bloquee une donne dont la pioche est epuisee', () => {
    const board: Board = {
      stock: [],
      waste: [card('hearts', 9)],
      foundations: [[], [], [], []],
      tableau: [
        [card('spades', 2, false), card('clubs', 13)],
        [card('spades', 3, false), card('spades', 13)],
        [card('spades', 4, false), card('clubs', 12)],
        [card('spades', 5, false), card('spades', 12)],
        [card('spades', 6, false), card('clubs', 11)],
        [card('spades', 7, false), card('spades', 11)],
        [card('spades', 8, false), card('clubs', 3)],
      ],
      drawCount: 1,
      recyclesLeft: 0,
    };
    expect(isDeadlock(board)).toBe(true);
    expect(isDeadlock({ ...board, recyclesLeft: undefined })).toBe(true);
  });
});

describe('joker', () => {
  const board: Board = {
    stock: [],
    waste: [card('hearts', 5)],
    foundations: [[], [], [], []],
    tableau: [[card('spades', 9)], [], [], [], [], [], [card('clubs', 2)]],
    drawCount: 1,
  };

  it('pose une carte sur n importe quelle colonne', () => {
    expect(applyMove(board, { type: 'wasteToTableau', column: 0 })).toBeNull();
    const wild = applyMove(
      board,
      { type: 'wasteToTableau', column: 0 },
      { wild: true },
    );
    expect(wild?.board.tableau[0].map((c) => c.id)).toEqual([
      'spades-9',
      'hearts-5',
    ]);
    // Meme une colonne vide accepte autre chose qu'un Roi.
    expect(
      applyMove(board, { type: 'wasteToTableau', column: 3 }, { wild: true }),
    ).not.toBeNull();
  });

  it('ne triche jamais avec les fondations', () => {
    expect(
      applyMove(
        board,
        { type: 'tableauToFoundation', column: 6, foundation: 0 },
        { wild: true },
      ),
    ).toBeNull();
  });
});

describe('remelange', () => {
  it('rebat pioche et talon sans perdre de carte', () => {
    let board = deal('remelange', 1);
    for (let i = 0; i < 10; i++)
      board = applyMove(board, { type: 'draw' })!.board;
    const before = [...board.stock, ...board.waste].map((c) => c.id).sort();
    const shuffled = reshuffleStock(board, createRng('x'))!;
    expect(shuffled.waste).toHaveLength(0);
    expect(shuffled.stock.every((c) => !c.faceUp)).toBe(true);
    expect(shuffled.stock.map((c) => c.id).sort()).toEqual(before);
    expect(shuffled.tableau).toBe(board.tableau);
  });

  it('refuse quand il n y a rien a melanger', () => {
    const board = deal('vide', 1);
    expect(
      reshuffleStock({ ...board, stock: [], waste: [] }, createRng('y')),
    ).toBeNull();
  });
});

describe('solveur', () => {
  it('ne prouve jamais une victoire impossible: chaque solution se rejoue', () => {
    let solved = 0;
    for (let i = 0; i < 25; i++) {
      for (const [draw, gentle] of [
        [1, true],
        [3, false],
      ] as const) {
        const board = deal(`sol${i}`, draw, { gentle });
        const solution = findSolution(board, 8000);
        if (!Array.isArray(solution)) continue;
        solved++;
        expect(isWon(replay(board, solution))).toBe(true);
      }
    }
    expect(solved).toBeGreaterThan(10);
  });

  it('reconnait une fin de partie gagnee et une donne bloquee', () => {
    const almost: Board = {
      stock: [],
      waste: [],
      drawCount: 1,
      foundations: (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).map(
        (s) => Array.from({ length: 12 }, (_, i) => card(s, i + 1)),
      ),
      tableau: [
        [card('spades', 13)],
        [card('hearts', 13)],
        [card('diamonds', 13)],
        [card('clubs', 13)],
        [],
        [],
        [],
      ],
    };
    expect(solve(almost)).toBe('solved');
    expect(canAutoComplete(almost)).toBe(true);
  });

  it('trouve une donne gagnable, et sa graine la redonne', () => {
    let n = 0;
    const seed = findWinnableSeed(
      { drawCount: 1, gentle: true },
      20,
      () => `gagnable-${n++}`,
    );
    expect(seed).not.toBeNull();
    const board = deal(seed!, 1, { gentle: true });
    expect(isWon(replay(board, findSolution(board, 20_000)))).toBe(true);
  });
});
