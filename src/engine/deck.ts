import type { Board, Card, Color, Rank, Suit } from './types';
import { createRng, shuffle } from './rng';

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const RANKS: readonly Rank[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
];

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['hearts', 'diamonds']);

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RANK_LABEL: Record<Rank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export function color(suit: Suit): Color {
  return RED_SUITS.has(suit) ? 'red' : 'black';
}

export function cardColor(card: Card): Color {
  return color(card.suit);
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank];
}

export function cardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`;
}

/** Construit un jeu de 52 cartes face cachee, dans l'ordre canonique. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: cardId(suit, rank), suit, rank, faceUp: false });
    }
  }
  return deck;
}

/**
 * Distribue une partie de Klondike deterministe.
 * Colonne i recoit i+1 cartes, seule la derniere est face visible.
 * Les 24 cartes restantes forment la pioche, toutes face cachee.
 */
export function deal(seed: string | number, drawCount: 1 | 3): Board {
  const rng = createRng(seed);
  const shuffled = shuffle(createDeck(), rng);

  const tableau: Card[][] = [[], [], [], [], [], [], []];
  let cursor = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const source = shuffled[cursor++];
      const faceUp = row === col;
      tableau[col].push({ ...source, faceUp });
    }
  }

  const stock: Card[] = shuffled
    .slice(cursor)
    .map((card) => ({ ...card, faceUp: false }));

  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
  };
}
