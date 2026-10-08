// Recherche d'une donne gagnable, pour l'option "donne garantie".

import { deal } from './deck';
import { solve } from './solver';

export interface DealConfig {
  drawCount: 1 | 3;
  gentle: boolean;
  recycles?: number;
}

/** Positions explorees au plus par donne essayee: ~10 a 120 ms chacune. */
const SOLVE_BUDGET = 15_000;

/** Nombre de donnes essayees avant d'abandonner (cas extremement rare). */
export const MAX_TRIES = 80;

function randomSeed(): string {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

/**
 * Tire des donnes au hasard jusqu'a en trouver une dont le solveur prouve
 * qu'elle se gagne. Renvoie sa graine, ou null si aucune n'a ete trouvee.
 */
export function findWinnableSeed(
  config: DealConfig,
  maxTries = MAX_TRIES,
  nextSeed: () => string = randomSeed,
): string | null {
  for (let i = 0; i < maxTries; i++) {
    const seed = nextSeed();
    const board = deal(seed, config.drawCount, {
      gentle: config.gentle,
      recycles: config.recycles,
    });
    if (solve(board, SOLVE_BUDGET) === 'solved') return seed;
  }
  return null;
}
