// Solveur de Klondike, pour l'option "donne garantie gagnable".
//
// Il ne sert qu'a prouver qu'une donne PEUT etre gagnee: on ne retient une
// donne que si une suite de coups legaux menant a la victoire a ete trouvee.
// Les elagages (coups juges inutiles) peuvent faire rater des solutions,
// jamais en inventer: le verdict "gagnable" est toujours sur.

import type { Board, Card, Move } from './types';
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  isValidRun,
  top,
} from './rules';
import { applyMove, boardKey, canRecycle, isWon } from './moves';
import { color } from './deck';

export type SolveVerdict = 'solved' | 'unsolvable' | 'unknown';

function foundationFor(board: Board, card: Card): number {
  for (let f = 0; f < board.foundations.length; f++) {
    if (canPlaceOnFoundation(card, top(board.foundations[f]))) return f;
  }
  return -1;
}

/** Plus petit rang deja pose sur les fondations d'une couleur donnee. */
function lowestOfColor(board: Board, red: boolean): number {
  let low = 13;
  let seen = 0;
  for (const pile of board.foundations) {
    const head = top(pile);
    if (head && (color(head.suit) === 'red') === red) {
      low = Math.min(low, head.rank);
      seen++;
    }
  }
  return seen < 2 ? 0 : low;
}

/**
 * Coup vers une fondation qu'on peut jouer sans jamais le regretter: un As,
 * un 2, ou une carte dont les deux enseignes de l'autre couleur sont deja
 * assez hautes pour ne plus avoir besoin d'elle comme support.
 */
function isSafeToFoundation(board: Board, card: Card): boolean {
  if (card.rank <= 2) return true;
  const otherRed = color(card.suit) !== 'red';
  return lowestOfColor(board, otherRed) >= card.rank - 1;
}

/**
 * Joue tous les coups surs vers les fondations, d'affilee. Les coups joues
 * sont ajoutes a `path` quand il est fourni.
 */
function playSafeMoves(board: Board, path?: Move[]): Board {
  let current = board;
  for (;;) {
    let moved = false;
    const waste = top(current.waste);
    if (waste && isSafeToFoundation(current, waste)) {
      const f = foundationFor(current, waste);
      if (f >= 0) {
        const move: Move = { type: 'wasteToFoundation', foundation: f };
        current = applyMove(current, move)!.board;
        path?.push(move);
        moved = true;
      }
    }
    for (let c = 0; c < current.tableau.length; c++) {
      const card = top(current.tableau[c]);
      if (card && isSafeToFoundation(current, card)) {
        const f = foundationFor(current, card);
        if (f >= 0) {
          const move: Move = {
            type: 'tableauToFoundation',
            column: c,
            foundation: f,
          };
          current = applyMove(current, move)!.board;
          path?.push(move);
          moved = true;
        }
      }
    }
    if (!moved) return current;
  }
}

/** Coups candidats, du plus prometteur au moins prometteur. */
function candidateMoves(board: Board): Move[] {
  const reveal: Move[] = [];
  const toFoundation: Move[] = [];
  const fromWaste: Move[] = [];
  const freeing: Move[] = [];

  board.tableau.forEach((column, from) => {
    const firstUp = column.findIndex((c) => c.faceUp);
    if (firstUp < 0) return;
    const head = column[column.length - 1];
    const f = foundationFor(board, head);
    if (f >= 0)
      toFoundation.push({
        type: 'tableauToFoundation',
        column: from,
        foundation: f,
      });

    // Deplacer toute la partie visible: utile seulement si cela revele une
    // carte cachee, ou libere une colonne sans deplacer un Roi deja au fond.
    const run = column.slice(firstUp);
    if (isValidRun(run)) {
      const kingAtBottom = firstUp === 0 && run[0].rank === 13;
      if (!kingAtBottom) {
        for (let to = 0; to < board.tableau.length; to++) {
          if (to === from) continue;
          const target = board.tableau[to];
          if (target.length === 0 && run[0].rank !== 13) continue;
          if (canPlaceOnTableau(run[0], top(target))) {
            reveal.push({
              type: 'tableauToTableau',
              from,
              to,
              count: run.length,
            });
            break;
          }
        }
      }
    }

    // Deplacer une partie de la sequence pour liberer la carte du dessous
    // vers une fondation.
    for (let start = firstUp + 1; start < column.length; start++) {
      const under = column[start - 1];
      if (foundationFor(board, under) < 0) continue;
      const part = column.slice(start);
      if (!isValidRun(part)) continue;
      for (let to = 0; to < board.tableau.length; to++) {
        if (to === from) continue;
        if (
          canPlaceOnTableau(part[0], top(board.tableau[to])) &&
          board.tableau[to].length > 0
        ) {
          freeing.push({
            type: 'tableauToTableau',
            from,
            to,
            count: part.length,
          });
          break;
        }
      }
    }
  });

  const waste = top(board.waste);
  if (waste) {
    const f = foundationFor(board, waste);
    if (f >= 0) toFoundation.push({ type: 'wasteToFoundation', foundation: f });
    let emptyDone = false;
    for (let to = 0; to < board.tableau.length; to++) {
      const target = board.tableau[to];
      if (!canPlaceOnTableau(waste, top(target))) continue;
      if (target.length === 0) {
        if (emptyDone) continue;
        emptyDone = true;
      }
      fromWaste.push({ type: 'wasteToTableau', column: to });
    }
  }

  const stock: Move[] = [];
  if (board.stock.length > 0) stock.push({ type: 'draw' });
  else if (canRecycle(board)) stock.push({ type: 'recycle' });

  return [...reveal, ...toFoundation, ...freeing, ...fromWaste, ...stock];
}

interface Node {
  board: Board;
  /** Coups joues depuis le depart, partages avec le parent (liste chainee). */
  trail: Trail | null;
}

interface Trail {
  moves: Move[];
  parent: Trail | null;
}

function flatten(trail: Trail | null): Move[] {
  const chunks: Move[][] = [];
  for (let t = trail; t; t = t.parent) chunks.push(t.moves);
  return chunks.reverse().flat();
}

/**
 * Cherche une victoire par exploration en profondeur, dans la limite de
 * `budget` positions. Renvoie la suite de coups gagnante, ou le verdict
 * "unsolvable" (tout l'espace elague parcouru) ou "unknown" (budget epuise).
 */
export function findSolution(
  board: Board,
  budget = 40_000,
): Move[] | 'unsolvable' | 'unknown' {
  const opening: Move[] = [];
  const start = playSafeMoves(board, opening);
  const root: Trail = { moves: opening, parent: null };
  if (isWon(start)) return opening;
  const seen = new Set<string>([boardKey(start)]);
  const stack: Node[] = [{ board: start, trail: root }];
  let explored = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (++explored > budget) return 'unknown';
    const moves = candidateMoves(current.board);
    // Pile: on empile a l'envers pour explorer d'abord les meilleurs coups.
    for (let i = moves.length - 1; i >= 0; i--) {
      const result = applyMove(current.board, moves[i]);
      if (!result) continue;
      const step: Move[] = [moves[i]];
      const next = playSafeMoves(result.board, step);
      const trail: Trail = { moves: step, parent: current.trail };
      if (isWon(next)) return flatten(trail);
      const key = boardKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push({ board: next, trail });
    }
  }
  return 'unsolvable';
}

/** Verdict seul: gagnable (prouve), insoluble, ou inconnu. */
export function solve(board: Board, budget = 40_000): SolveVerdict {
  const result = findSolution(board, budget);
  return Array.isArray(result) ? 'solved' : result;
}
