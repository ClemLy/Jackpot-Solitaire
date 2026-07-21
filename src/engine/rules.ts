import type { Card } from './types';
import { color } from './deck';

/** Renvoie la carte du dessus d'une pile, ou undefined si la pile est vide. */
export function top(pile: readonly Card[]): Card | undefined {
  return pile.length > 0 ? pile[pile.length - 1] : undefined;
}

/**
 * Une carte peut aller sur une fondation si:
 * - la fondation est vide et la carte est un As, ou
 * - la carte est de la meme couleur (enseigne) et juste au dessus du sommet.
 */
export function canPlaceOnFoundation(
  card: Card,
  foundationTop: Card | undefined,
): boolean {
  if (!foundationTop) {
    return card.rank === 1;
  }
  return (
    card.suit === foundationTop.suit && card.rank === foundationTop.rank + 1
  );
}

/**
 * Une carte (ou le haut d'une sequence) peut se poser sur une colonne du tableau si:
 * - la colonne est vide et la carte est un Roi, ou
 * - la carte est juste en dessous et de couleur opposee au sommet.
 */
export function canPlaceOnTableau(
  card: Card,
  tableauTop: Card | undefined,
): boolean {
  if (!tableauTop) {
    return card.rank === 13;
  }
  return (
    color(card.suit) !== color(tableauTop.suit) &&
    card.rank === tableauTop.rank - 1
  );
}

/**
 * Verifie qu'une suite de cartes forme une sequence deplacable:
 * toutes face visible, decroissantes une a une et de couleurs alternees.
 */
export function isValidRun(cards: readonly Card[]): boolean {
  if (cards.length === 0) {
    return false;
  }
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) {
      return false;
    }
    if (i > 0) {
      const prev = cards[i - 1];
      const curr = cards[i];
      if (
        curr.rank !== prev.rank - 1 ||
        color(curr.suit) === color(prev.suit)
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Renvoie la sequence deplacable d'une colonne a partir de startIndex
 * (jusqu'au sommet), ou null si elle n'est pas valide.
 */
export function movableRun(
  column: readonly Card[],
  startIndex: number,
): Card[] | null {
  if (startIndex < 0 || startIndex >= column.length) {
    return null;
  }
  const run = column.slice(startIndex);
  return isValidRun(run) ? run : null;
}
