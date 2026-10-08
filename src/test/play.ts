// Outils des tests de parcours: donnes gagnables imposees et vraies parties
// jouees jusqu'a la victoire (le coeur rejoue chaque manche, une victoire
// ne se simule pas).

import { vi } from 'vitest';
import { applyMove, findSolution, isDeadlock, type Move } from '../engine';
import { boardOf, type Round } from '../core';
import {
  findDifficulty,
  vegasRecycles,
  type DifficultyId,
} from '../state/catalog';
import { setRandomSource } from '../state/meta';
import { useGameStore } from '../state/game';

const queue: number[] = [];
setRandomSource(() => (queue.length ? queue.shift()! : Math.random()));

const cache = new Map<string, number>();

/**
 * Impose la prochaine graine tiree: une donne gagnable pour ce reglage.
 * La premiere valeur aleatoire d'une donne est celle de la graine.
 */
export function nextDealWinnable(
  difficulty: DifficultyId = 'normal',
  vegas = false,
): void {
  const { drawCount, gentle } = findDifficulty(difficulty);
  const recycles = vegas ? vegasRecycles(drawCount) : undefined;
  const key = `${difficulty}-${recycles}`;
  let draw = cache.get(key);
  if (draw === undefined) {
    for (let seed = 100000; seed < 100600; seed++) {
      const round = {
        seed: String(seed),
        drawCount,
        gentle,
        recycles,
      } as Round;
      if (Array.isArray(findSolution(boardOf(round), 20_000))) {
        draw = (seed - 100000 + 0.5) / 900000;
        break;
      }
    }
    if (draw === undefined) throw new Error('aucune donne gagnable');
    cache.set(key, draw);
  }
  queue.push(draw);
}

/** Joue la solution de la donne en cours, coup par coup, jusqu'au bout. */
export function playSolution(limit = Infinity): Move[] {
  const solution = findSolution(useGameStore.getState().board, 30_000);
  if (!Array.isArray(solution)) throw new Error('donne non gagnable');
  const moves = solution.slice(0, limit);
  for (const move of moves) {
    if (!useGameStore.getState().applyDragMove(move)) {
      throw new Error(`coup refuse: ${JSON.stringify(move)}`);
    }
  }
  return moves;
}

/** Gagne la manche en cours et attend le bordereau de l'economie. */
export async function winRound(): Promise<void> {
  playSolution();
  await vi.waitFor(() => {
    if (!useGameStore.getState().win) throw new Error('pas encore');
  });
}

/** Attend que les actions asynchrones en cours soient terminees. */
export async function settle(): Promise<void> {
  await vi.waitFor(() => {
    const s = useGameStore.getState();
    if (s.busy || s.settling || s.preparing) throw new Error('occupe');
  });
}

/** Une graine gagnable en clair (pour les parties sur graine imposee). */
export function winnableSeed(difficulty: DifficultyId = 'normal'): string {
  const { drawCount, gentle } = findDifficulty(difficulty);
  for (let seed = 100000; seed < 100600; seed++) {
    const round = { seed: String(seed), drawCount, gentle } as Round;
    if (Array.isArray(findSolution(boardOf(round), 20_000)))
      return String(seed);
  }
  throw new Error('aucune graine gagnable');
}

/**
 * Impose une donne de Vegas (pioche 1, un seul passage) qui se bloque des
 * qu'on a tire toute la pioche sans jouer: de quoi tester une defaite.
 */
export function nextVegasDeadEnd(): void {
  for (let seed = 100000; seed < 103000; seed++) {
    const round = {
      seed: String(seed),
      drawCount: 1,
      gentle: false,
      recycles: 0,
    } as Round;
    let board = boardOf(round);
    for (let i = 0; i < 24; i++) {
      board = applyMove(board, { type: 'draw' })!.board;
      if (i < 23 && isDeadlock(board)) break;
    }
    if (board.stock.length === 0 && isDeadlock(board)) {
      queue.push((seed - 100000 + 0.5) / 900000);
      return;
    }
  }
  throw new Error('aucune impasse trouvee');
}
