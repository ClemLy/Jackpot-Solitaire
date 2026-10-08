// Parties aleatoires: on joue des milliers de coups legaux tires au hasard et
// on verifie apres chacun que le plateau reste coherent. C'est ce qui attrape
// les bugs que les tests d'exemples ne pensent pas a couvrir.

import { describe, expect, it } from 'vitest';
import {
  applyMove,
  type ApplyResult,
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

/**
 * Tous les coups imaginables, legaux ou non. Les deplacements entre colonnes
 * ne partent que d'une carte visible: les autres sont forcement illegaux et
 * ne feraient que ralentir le test.
 */
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
    const visible = board.tableau[c].filter((card) => card.faceUp).length;
    for (let to = 0; to < 7; to++) {
      if (to === c) continue;
      for (let count = 1; count <= visible; count++) {
        moves.push({ type: 'tableauToTableau', from: c, to, count });
      }
    }
  }
  return moves;
}

/** Coups legaux avec leur resultat, calcule une seule fois. */
function legalMoves(board: Board): { move: Move; result: ApplyResult }[] {
  const legal: { move: Move; result: ApplyResult }[] = [];
  for (const move of candidateMoves(board)) {
    const result = applyMove(board, move);
    if (result) legal.push({ move, result });
  }
  return legal;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * Liste les regles de structure violees par un plateau (vide si tout va
 * bien). Un seul expect par plateau: des milliers d'appels a expect par
 * partie ralentissaient fortement le test sur les machines de la CI.
 */
function problemsOf(board: Board): string[] {
  const problems: string[] = [];
  const all = [
    ...board.stock,
    ...board.waste,
    ...board.foundations.flat(),
    ...board.tableau.flat(),
  ];
  if (all.length !== 52) problems.push(`${all.length} cartes au lieu de 52`);
  if (new Set(all.map((c) => c.id)).size !== all.length)
    problems.push('carte en double');
  if (board.stock.some((c) => c.faceUp)) problems.push('pioche visible');
  if (board.waste.some((c) => !c.faceUp)) problems.push('talon cache');

  board.foundations.forEach((pile, f) => {
    pile.forEach((card, i) => {
      if (!card.faceUp || card.rank !== i + 1 || card.suit !== pile[0].suit)
        problems.push(`fondation ${f} invalide`);
    });
  });
  const suits = board.foundations.filter((p) => p.length).map((p) => p[0].suit);
  if (new Set(suits).size !== suits.length)
    problems.push('deux fondations de meme couleur');

  board.tableau.forEach((column, c) => {
    if (column.length === 0) return;
    const firstUp = column.findIndex((card) => card.faceUp);
    // Carte du dessus visible, cartes cachees au fond sans trou, et partie
    // visible toujours en sequence valide.
    if (firstUp < 0) problems.push(`colonne ${c} sans carte visible`);
    else if (!isValidRun(column.slice(firstUp)))
      problems.push(`colonne ${c} mal ordonnee`);
  });
  return problems;
}

function assertConsistent(board: Board): void {
  const problems = problemsOf(board);
  if (problems.length > 0) expect(problems).toEqual([]);
}

function playRandomGame(
  seed: string,
  drawCount: 1 | 3,
  gentle: boolean,
  rng: Rng,
  maxMoves: number,
  /** Renvoie vrai pour arreter la partie ici. */
  onBoard: (board: Board, step: number) => boolean | void,
): Board {
  let board = deal(seed, drawCount, { gentle });
  assertConsistent(board);
  for (let step = 0; step < maxMoves && !isWon(board); step++) {
    // Plateau gele: le moindre coup qui le modifierait leverait une erreur.
    const moves = legalMoves(deepFreeze(board));
    if (moves.length === 0) break;
    // On favorise les coups qui font avancer (fondation, carte revelee),
    // pour explorer des fins de partie et pas seulement des pioches en
    // boucle. Le reste du temps, n'importe quel coup legal.
    const progress = moves.filter(
      ({ result }) =>
        result.outcome.toFoundation > 0 || result.outcome.revealed > 0,
    );
    const pool = progress.length > 0 && rng.next() < 0.85 ? progress : moves;
    board = pool[rng.int(pool.length)].result.board;
    assertConsistent(board);
    if (onBoard(board, step)) break;
  }
  return board;
}

// Marge large: les machines de la CI sont nettement plus lentes qu'un poste
// de developpement.
describe('parties aleatoires', { timeout: 30_000 }, () => {
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
        if (!canAutoComplete(board)) return false;
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
        // La suite de cette partie n'apprendrait rien de plus.
        return true;
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
