import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canAutoComplete,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  cardId,
  createDeck,
  createRng,
  deal,
  endGameBonuses,
  findHint,
  isDeadlock,
  isValidRun,
  isWon,
  movableRun,
  nextAutoCompleteMove,
  scoreForOutcome,
  shuffle,
} from './index';
import type { Board, Card, Rank, Suit } from './types';

function card(suit: Suit, rank: Rank, faceUp = true): Card {
  return { id: cardId(suit, rank), suit, rank, faceUp };
}

function emptyBoard(drawCount: 1 | 3 = 3): Board {
  return {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    drawCount,
  };
}

function foundationUpTo(suit: Suit, upto: Rank): Card[] {
  const pile: Card[] = [];
  for (let r = 1 as number; r <= upto; r++) {
    pile.push(card(suit, r as Rank));
  }
  return pile;
}

describe('rng', () => {
  it('est deterministe pour une meme graine', () => {
    const a = createRng('jackpot');
    const b = createRng('jackpot');
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('diverge entre deux graines differentes', () => {
    const a = createRng('4082');
    const b = createRng('4083');
    expect(a.next()).not.toEqual(b.next());
  });

  it('melange sans perdre ni dupliquer de cartes', () => {
    const rng = createRng('mix');
    const deck = createDeck();
    const shuffled = shuffle(deck, rng);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(52);
  });
});

describe('deal', () => {
  it('cree 52 cartes reparties correctement', () => {
    const board = deal('seed-1', 3);
    const total =
      board.stock.length +
      board.waste.length +
      board.tableau.reduce((n, col) => n + col.length, 0) +
      board.foundations.reduce((n, p) => n + p.length, 0);
    expect(total).toBe(52);
    expect(board.stock).toHaveLength(24);
    expect(board.waste).toHaveLength(0);
    board.tableau.forEach((col, i) => {
      expect(col).toHaveLength(i + 1);
      expect(col[col.length - 1].faceUp).toBe(true);
      col.slice(0, -1).forEach((c) => expect(c.faceUp).toBe(false));
    });
  });

  it('est reproductible pour une meme graine', () => {
    expect(deal('abc', 1)).toEqual(deal('abc', 1));
  });

  it('donne des distributions differentes selon la graine', () => {
    expect(deal('abc', 1)).not.toEqual(deal('xyz', 1));
  });
});

describe('regles de placement', () => {
  it('fondation: As sur pile vide puis meme enseigne croissante', () => {
    expect(canPlaceOnFoundation(card('hearts', 1), undefined)).toBe(true);
    expect(canPlaceOnFoundation(card('hearts', 2), undefined)).toBe(false);
    expect(canPlaceOnFoundation(card('hearts', 2), card('hearts', 1))).toBe(
      true,
    );
    expect(canPlaceOnFoundation(card('spades', 2), card('hearts', 1))).toBe(
      false,
    );
  });

  it('tableau: Roi sur colonne vide puis couleur alternee decroissante', () => {
    expect(canPlaceOnTableau(card('spades', 13), undefined)).toBe(true);
    expect(canPlaceOnTableau(card('spades', 12), undefined)).toBe(false);
    expect(canPlaceOnTableau(card('hearts', 6), card('spades', 7))).toBe(true);
    expect(canPlaceOnTableau(card('clubs', 6), card('spades', 7))).toBe(false);
  });

  it('valide une sequence deplacable et rejette une invalide', () => {
    expect(
      isValidRun([card('spades', 7), card('hearts', 6), card('spades', 5)]),
    ).toBe(true);
    expect(isValidRun([card('spades', 7), card('clubs', 6)])).toBe(false);
    expect(isValidRun([card('spades', 7, false)])).toBe(false);
    const col = [
      card('diamonds', 9, false),
      card('spades', 8),
      card('hearts', 7),
    ];
    expect(movableRun(col, 1)).toHaveLength(2);
    expect(movableRun(col, 0)).toBeNull();
  });
});

describe('application des coups', () => {
  it('pioche puis recyclage font un aller-retour fidele', () => {
    const board: Board = {
      ...emptyBoard(3),
      stock: [
        card('spades', 5, false),
        card('hearts', 4, false),
        card('clubs', 3, false),
      ],
    };
    const drawn = applyMove(board, { type: 'draw' });
    expect(drawn).not.toBeNull();
    expect(drawn!.board.waste).toHaveLength(3);
    expect(drawn!.board.stock).toHaveLength(0);
    // La derniere carte de la pioche est desormais la plus accessible du talon.
    expect(drawn!.board.waste[2].faceUp).toBe(true);

    const recycled = applyMove(drawn!.board, { type: 'recycle' });
    expect(recycled).not.toBeNull();
    expect(recycled!.outcome.recycled).toBe(true);
    expect(recycled!.board.stock.map((c) => c.id)).toEqual(
      board.stock.map((c) => c.id),
    );
  });

  it('ne mute jamais le plateau d entree', () => {
    const board: Board = {
      ...emptyBoard(1),
      stock: [card('spades', 5, false)],
    };
    const snapshot = JSON.stringify(board);
    applyMove(board, { type: 'draw' });
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it('deplace le talon vers une fondation et compte les points', () => {
    const board: Board = { ...emptyBoard(1), waste: [card('spades', 1)] };
    const res = applyMove(board, { type: 'wasteToFoundation', foundation: 0 });
    expect(res).not.toBeNull();
    expect(res!.board.foundations[0]).toHaveLength(1);
    expect(res!.outcome.toFoundation).toBe(1);
    expect(scoreForOutcome(res!.outcome, 1)).toBe(10);
  });

  it('revele la carte cachee dessous en vidant le sommet vers une fondation', () => {
    const board = emptyBoard(1);
    board.foundations[0] = foundationUpTo('spades', 4);
    board.tableau[0] = [card('hearts', 9, false), card('spades', 5)];
    const res = applyMove(board, {
      type: 'tableauToFoundation',
      column: 0,
      foundation: 0,
    });
    expect(res).not.toBeNull();
    expect(res!.board.tableau[0]).toHaveLength(1);
    expect(res!.board.tableau[0][0].faceUp).toBe(true);
    expect(res!.outcome.revealed).toBe(1);
    expect(scoreForOutcome(res!.outcome, 1)).toBe(15);
  });

  it('deplace une sequence entiere entre deux colonnes', () => {
    const board = emptyBoard(1);
    board.tableau[0] = [
      card('clubs', 10, false),
      card('spades', 8),
      card('hearts', 7),
    ];
    board.tableau[1] = [card('diamonds', 9)];
    const res = applyMove(board, {
      type: 'tableauToTableau',
      from: 0,
      to: 1,
      count: 2,
    });
    expect(res).not.toBeNull();
    expect(res!.board.tableau[1].map((c) => c.rank)).toEqual([9, 8, 7]);
    expect(res!.board.tableau[0]).toHaveLength(1);
    expect(res!.board.tableau[0][0].faceUp).toBe(true);
    expect(res!.outcome.revealed).toBe(1);
  });

  it('refuse un coup illegal', () => {
    const board: Board = { ...emptyBoard(1), waste: [card('spades', 5)] };
    expect(
      applyMove(board, { type: 'wasteToFoundation', foundation: 0 }),
    ).toBeNull();
    expect(applyMove(emptyBoard(1), { type: 'draw' })).toBeNull();
    expect(applyMove(emptyBoard(1), { type: 'recycle' })).toBeNull();
  });
});

describe('etats de fin', () => {
  it('detecte une partie gagnee', () => {
    const board: Board = {
      ...emptyBoard(1),
      foundations: [
        foundationUpTo('spades', 13),
        foundationUpTo('hearts', 13),
        foundationUpTo('diamonds', 13),
        foundationUpTo('clubs', 13),
      ],
    };
    expect(isWon(board)).toBe(true);
    expect(canAutoComplete(board)).toBe(false);
  });

  it('autorise l autocompletion seulement si la fin est reellement resoluble', () => {
    const solvable: Board = {
      ...emptyBoard(1),
      foundations: [
        foundationUpTo('spades', 12),
        foundationUpTo('hearts', 12),
        foundationUpTo('diamonds', 12),
        foundationUpTo('clubs', 12),
      ],
    };
    solvable.tableau[0] = [card('spades', 13)];
    solvable.tableau[1] = [card('hearts', 13)];
    solvable.tableau[2] = [card('diamonds', 13)];
    solvable.tableau[3] = [card('clubs', 13)];
    expect(canAutoComplete(solvable)).toBe(true);

    // Une carte cachee empeche toute garantie.
    const hidden: Board = {
      ...emptyBoard(1),
      foundations: solvable.foundations.map((p) => p.slice()),
    };
    hidden.tableau[0] = [card('spades', 13, false)];
    expect(canAutoComplete(hidden)).toBe(false);

    // Meme toutes faces visibles, un As coince sous une carte plus forte bloque.
    const buried = emptyBoard(1);
    buried.tableau[0] = [card('spades', 1), card('hearts', 13)];
    expect(canAutoComplete(buried)).toBe(false);
  });

  it('resout entierement une fin de partie via l autocompletion', () => {
    let board: Board = {
      ...emptyBoard(3),
      foundations: [
        foundationUpTo('spades', 12),
        foundationUpTo('hearts', 12),
        foundationUpTo('diamonds', 12),
        foundationUpTo('clubs', 12),
      ],
      waste: [card('diamonds', 13)],
      stock: [card('clubs', 13, false)],
    };
    board.tableau[0] = [card('spades', 13)];
    board.tableau[1] = [card('hearts', 13)];

    let guard = 0;
    let move = nextAutoCompleteMove(board);
    while (move && guard++ < 100) {
      const res = applyMove(board, move);
      expect(res).not.toBeNull();
      board = res!.board;
      move = nextAutoCompleteMove(board);
    }
    expect(isWon(board)).toBe(true);
  });
});

describe('indices', () => {
  it('suggere d envoyer un As sur la fondation', () => {
    const board: Board = { ...emptyBoard(1), waste: [card('clubs', 1)] };
    expect(findHint(board)).toEqual({
      type: 'wasteToFoundation',
      foundation: 0,
    });
  });

  it('suggere de piocher quand rien d autre n est possible', () => {
    const board: Board = {
      ...emptyBoard(1),
      stock: [card('spades', 9, false)],
    };
    expect(findHint(board)).toEqual({ type: 'draw' });
  });
});

describe('blocage', () => {
  it('detecte une partie sans aucun coup possible, meme apres avoir tout pioche', () => {
    // Deux colonnes de rois seuls (rien a deplacer), un talon et une pioche
    // dont aucune carte ne peut jamais rejoindre une fondation ou le tableau.
    const board: Board = {
      ...emptyBoard(1),
      tableau: [[card('spades', 13)], [card('hearts', 13)], [], [], [], [], []],
      waste: [card('clubs', 11)],
      stock: [card('diamonds', 9, false), card('clubs', 9, false)],
    };
    expect(isDeadlock(board)).toBe(true);
  });

  it('ne signale pas de blocage tant qu un coup reste possible', () => {
    const board: Board = {
      ...emptyBoard(1),
      waste: [card('clubs', 1)],
    };
    expect(isDeadlock(board)).toBe(false);
  });

  it('ne signale jamais de blocage sur une partie gagnee', () => {
    const board: Board = {
      ...emptyBoard(1),
      foundations: [
        foundationUpTo('spades', 13),
        foundationUpTo('hearts', 13),
        foundationUpTo('diamonds', 13),
        foundationUpTo('clubs', 13),
      ],
    };
    expect(isDeadlock(board)).toBe(false);
  });

  it('detecte un blocage meme quand un brassage vers une colonne occupee reste possible', () => {
    // Un 6 noir peut se poser sur un 7 rouge, mais ce coup ne mene nulle
    // part (aucun As sur le plateau, rien a devoiler derriere). Une
    // heuristique naive qui s'arrete au premier coup "disponible" dirait a
    // tort que la partie continue indefiniment.
    const board: Board = {
      ...emptyBoard(1),
      tableau: [[card('spades', 6)], [card('hearts', 7)], [], [], [], [], []],
    };
    expect(isDeadlock(board)).toBe(true);
  });

  it('detecte un blocage meme quand le talon peut encore se poser sur le tableau', () => {
    // Le talon peut poser son 6 noir sur le 7 rouge du tableau, mais ca ne
    // menera jamais nulle part (aucun As sur le plateau). Traiter "le talon
    // a une case ou se poser" comme une preuve de progres etait exactement
    // le bug qui laissait le jeu suggerer de piocher indefiniment sans
    // jamais declarer la partie perdue.
    const board: Board = {
      ...emptyBoard(1),
      waste: [card('spades', 6)],
      tableau: [[card('hearts', 7)], [], [], [], [], [], []],
    };
    expect(isDeadlock(board)).toBe(true);
  });
});

describe('scoring', () => {
  it('penalise le recyclage seulement en pioche 3', () => {
    const outcome = {
      toFoundation: 0,
      fromFoundation: 0,
      revealed: 0,
      recycled: true,
    };
    expect(scoreForOutcome(outcome, 3)).toBe(-20);
    expect(scoreForOutcome(outcome, 1)).toBe(0);
  });

  it('calcule les bonus de fin de partie', () => {
    expect(
      endGameBonuses({ elapsedSeconds: 120, invalidMoves: 0, undoCount: 0 }),
    ).toEqual({
      speed: 760,
      precision: 100,
      total: 860,
    });
    expect(
      endGameBonuses({ elapsedSeconds: 600, invalidMoves: 2, undoCount: 1 }),
    ).toEqual({
      speed: 0,
      precision: 0,
      total: 0,
    });
  });
});
