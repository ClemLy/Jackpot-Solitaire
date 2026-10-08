// Parties aleatoires: on joue des milliers de coups legaux tires au hasard et
// on verifie apres chacun que le plateau reste coherent. C'est ce qui attrape
// les bugs que les tests d'exemples ne pensent pas a couvrir.

import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canAutoComplete,
  createRng,
  deal,
  findHint,
  isDeadlock,
  isValidRun,
  isWon,
  nextAutoCompleteMove,
  type Board,
  type Move,
  type Rng,
} from './index';

/** Tous les coups imaginables, legaux ou non. */
function candidateMoves(board: Board): Move[] {
  const moves: Move[] = [{ type: 'draw' }, { type: 'recycle' }];
  for (let f = 0; f < 4; f++) {
    moves.push({ type: 'wasteToFoundation', foundation: f });
    for (let c = 0; c < 7; c++) {
      moves.push({ type: 'tableauToFoundation', column: c, foundation: f });
      moves.push({ type: 'foundationToTableau', foundation: f, column: c });
    }
  }
  for (let c = 0; c < 7; c++) {
    moves.push({ type: 'wasteToTableau', column: c });
    for (let to = 0; to < 7; to++) {
      for (let count = 1; count <= board.tableau[c].length; count++) {
        moves.push({ type: 'tableauToTableau', from: c, to, count });
      }
    }
  }
  return moves;
}

function legalMoves(board: Board): Move[] {
  return candidateMoves(board).filter((m) => applyMove(board, m) !== null);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Verifie toutes les regles de structure d'un plateau de Klondike. */
function assertConsistent(board: Board): void {
  const all = [
    ...board.stock,
    ...board.waste,
    ...board.foundations.flat(),
    ...board.tableau.flat(),
  ];
  expect(all).toHaveLength(52);
  expect(new Set(all.map((c) => c.id)).size).toBe(52);

  expect(board.stock.every((c) => !c.faceUp)).toBe(true);
  expect(board.waste.every((c) => c.faceUp)).toBe(true);

  board.foundations.forEach((pile) => {
    pile.forEach((card, i) => {
      expect(card.faceUp).toBe(true);
      expect(card.rank).toBe(i + 1);
      expect(card.suit).toBe(pile[0].suit);
    });
  });
  const suits = board.foundations.filter((p) => p.length).map((p) => p[0].suit);
  expect(new Set(suits).size).toBe(suits.length);

  board.tableau.forEach((column) => {
    const firstUp = column.findIndex((c) => c.faceUp);
    if (column.length === 0) return;
    // Une colonne non vide a toujours sa carte du dessus visible...
    expect(firstUp).toBeGreaterThanOrEqual(0);
    // ...les cartes cachees forment le fond, sans trou...
    expect(column.slice(firstUp).every((c) => c.faceUp)).toBe(true);
    // ...et la partie visible est toujours une sequence valide.
    expect(isValidRun(column.slice(firstUp))).toBe(true);
  });
}

function playRandomGame(
  seed: string,
  drawCount: 1 | 3,
  gentle: boolean,
  rng: Rng,
  maxMoves: number,
  onBoard: (board: Board, step: number) => void,
): Board {
  let board = deal(seed, drawCount, { gentle });
  assertConsistent(board);
  for (let step = 0; step < maxMoves && !isWon(board); step++) {
    const moves = legalMoves(board);
    if (moves.length === 0) break;
    // On favorise les coups qui font avancer (fondation, carte revelee),
    // pour explorer des fins de partie et pas seulement des pioches en
    // boucle. Le reste du temps, n'importe quel coup legal.
    const progress = moves.filter((m) => {
      const outcome = applyMove(board, m)!.outcome;
      return outcome.toFoundation > 0 || outcome.revealed > 0;
    });
    const pool = progress.length > 0 && rng.next() < 0.85 ? progress : moves;
    const move = pool[rng.int(pool.length)];
    const frozen = deepFreeze(board);
    const result = applyMove(frozen, move);
    expect(result).not.toBeNull();
    board = result!.board;
    assertConsistent(board);
    onBoard(board, step);
  }
  return board;
}

describe('parties aleatoires', () => {
  const configs: [1 | 3, boolean][] = [
    [1, true],
    [1, false],
    [3, true],
    [3, false],
  ];

  it.each(configs)(
    'garde un plateau coherent (pioche %i, adoucie %s)',
    (drawCount, gentle) => {
      const rng = createRng(`fuzz-${drawCount}-${gentle}`);
      for (let g = 0; g < 12; g++) {
        playRandomGame(`fz${g}`, drawCount, gentle, rng, 250, () => {});
      }
    },
  );

  it('ne modifie jamais le plateau d origine, meme pour un coup illegal', () => {
    const board = deepFreeze(deal('immuable', 3));
    for (const move of candidateMoves(board)) {
      expect(() => applyMove(board, move)).not.toThrow();
    }
  });

  it('refuse les coups aux index absurdes', () => {
    const board = deal('index', 1);
    const absurd: Move[] = [
      { type: 'wasteToFoundation', foundation: 9 },
      { type: 'tableauToFoundation', column: -1, foundation: 0 },
      { type: 'tableauToTableau', from: 0, to: 0, count: 1 },
      { type: 'tableauToTableau', from: 6, to: 0, count: 0 },
      { type: 'tableauToTableau', from: 6, to: 0, count: 99 },
      { type: 'foundationToTableau', foundation: 0, column: 0 },
      { type: 'recycle' },
      { type: 'wasteToTableau', column: 7 },
      { type: 'foundationToTableau', foundation: 1.5, column: 0 },
      { type: 'tableauToTableau', from: Number.NaN, to: 1, count: 1 },
      { type: 'tableauToTableau', from: 6, to: 1, count: 0.5 },
      { type: 'inconnu' } as unknown as Move,
    ];
    for (const move of absurd) {
      expect(applyMove(board, move)).toBeNull();
    }
  });

  it('ne range automatiquement que des tables entierement retournees', () => {
    const rng = createRng('auto');
    let checked = 0;
    for (let g = 0; g < 30; g++) {
      playRandomGame(`auto${g}`, 1, true, rng, 400, (board) => {
        if (!canAutoComplete(board)) return;
        checked++;
        expect(board.tableau.every((col) => col.every((c) => c.faceUp))).toBe(
          true,
        );
        // Et le rangement va vraiment jusqu'au bout.
        let current = board;
        for (let i = 0; i < 500 && !isWon(current); i++) {
          const move = nextAutoCompleteMove(current);
          expect(move).not.toBeNull();
          current = applyMove(current, move!)!.board;
        }
        expect(isWon(current)).toBe(true);
      });
    }
    // Le test n'a de sens que s'il a croise des fins de partie.
    expect(checked).toBeGreaterThan(0);
  });

  it('indice et blocage restent d accord', () => {
    const rng = createRng('hint');
    for (let g = 0; g < 6; g++) {
      playRandomGame(`h${g}`, 3, false, rng, 120, (board, step) => {
        if (step % 20 !== 0) return;
        const hint = findHint(board);
        expect(hint === null).toBe(isDeadlock(board));
        if (hint) expect(applyMove(board, hint)).not.toBeNull();
      });
    }
  });
});

describe('donnes par difficulte', () => {
  it('est deterministe et valide pour chaque reglage', () => {
    for (const drawCount of [1, 3] as const) {
      for (const gentle of [false, true]) {
        for (let i = 0; i < 50; i++) {
          const a = deal(`d${i}`, drawCount, { gentle });
          expect(a).toEqual(deal(`d${i}`, drawCount, { gentle }));
          expect(a.drawCount).toBe(drawCount);
          assertConsistent(a);
        }
      }
    }
  });

  it('ne change pas les donnes historiques sans adoucissement', () => {
    // Une graine partagee avant l'arrivee des difficultes doit redonner
    // exactement la meme partie.
    const before = deal('bienvenue', 3);
    expect(before.tableau[6][6].id).toBe(
      deal('bienvenue', 3, {}).tableau[6][6].id,
    );
    expect(deal('bienvenue', 3, { gentle: false })).toEqual(before);
  });
});
