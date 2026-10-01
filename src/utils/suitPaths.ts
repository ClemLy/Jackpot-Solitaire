// Traces vectoriels des enseignes, dans une boite 100 x 100. Partages entre
// le sprite SVG des cartes et le rendu canvas des effets de victoire.

import type { Suit } from '../engine';

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

/** Traces de chaque enseigne dans une boite 100 x 100. */
export const SUIT_PATHS: Record<Suit, string[]> = {
  hearts: [
    'M50 91 C46.5 86.5 6 61 6 33.5 C6 18 17 7 31 7 C40 7 46.6 12 50 20 C53.4 12 60 7 69 7 C83 7 94 18 94 33.5 C94 61 53.5 86.5 50 91 Z',
  ],
  diamonds: [
    'M50 3 C58.5 20 70.5 35.5 87 50 C70.5 64.5 58.5 80 50 97 C41.5 80 29.5 64.5 13 50 C29.5 35.5 41.5 20 50 3 Z',
  ],
  spades: [
    'M50 4 C55 15 92 37 92 62 C92 76 82 84.5 70.5 84.5 C62 84.5 56 80.5 52.6 74.5 C53.2 84.5 57.5 91.5 67 96 L33 96 C42.5 91.5 46.8 84.5 47.4 74.5 C44 80.5 38 84.5 29.5 84.5 C18 84.5 8 76 8 62 C8 37 45 15 50 4 Z',
  ],
  clubs: [
    circle(50, 28.5, 19.5),
    circle(27, 58, 19.5),
    circle(73, 58, 19.5),
    circle(50, 51, 12),
    'M46.6 58 C46.6 76 42 88 32 96 L68 96 C58 88 53.4 76 53.4 58 Z',
  ],
};

const PATH_CACHE = new Map<Suit, Path2D[]>();

/** Version canvas des enseignes (effets de victoire). */
export function suitPath2D(suit: Suit): Path2D[] {
  let cached = PATH_CACHE.get(suit);
  if (!cached) {
    cached = SUIT_PATHS[suit].map((d) => new Path2D(d));
    PATH_CACHE.set(suit, cached);
  }
  return cached;
}
