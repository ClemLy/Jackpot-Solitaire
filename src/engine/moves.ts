import type { ApplyResult, Board, Card, Move, MoveOutcome } from './types';
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  movableRun,
  top,
} from './rules';

function noOutcome(): MoveOutcome {
  return { toFoundation: 0, fromFoundation: 0, revealed: 0, recycled: false };
}

/** Copie superficielle du plateau: les piles sont recreees a la demande. */
function withBoard(board: Board, patch: Partial<Board>): Board {
  return { ...board, ...patch };
}

/** Retourne la carte du dessus face visible si elle etait cachee. */
function flipTopIfNeeded(column: Card[]): { column: Card[]; revealed: number } {
  if (column.length === 0) {
    return { column, revealed: 0 };
  }
  const last = column[column.length - 1];
  if (last.faceUp) {
    return { column, revealed: 0 };
  }
  const next = column.slice();
  next[next.length - 1] = { ...last, faceUp: true };
  return { column: next, revealed: 1 };
}

function replaceTableau(board: Board, index: number, column: Card[]): Card[][] {
  const tableau = board.tableau.slice();
  tableau[index] = column;
  return tableau;
}

function replaceFoundation(
  board: Board,
  index: number,
  pile: Card[],
): Card[][] {
  const foundations = board.foundations.slice();
  foundations[index] = pile;
  return foundations;
}

function isIndex(value: number, length: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < length;
}

/**
 * Verifie que les index d'un coup designent bien des piles existantes. Un
 * coup peut venir de l'interface (attribut data-drop lu dans le DOM): un index
 * absurde doit donner un coup illegal, jamais une exception.
 */
function hasValidIndexes(board: Board, move: Move): boolean {
  const f = board.foundations.length;
  const t = board.tableau.length;
  switch (move.type) {
    case 'draw':
    case 'recycle':
      return true;
    case 'wasteToFoundation':
      return isIndex(move.foundation, f);
    case 'wasteToTableau':
      return isIndex(move.column, t);
    case 'tableauToFoundation':
      return isIndex(move.column, t) && isIndex(move.foundation, f);
    case 'foundationToTableau':
      return isIndex(move.foundation, f) && isIndex(move.column, t);
    case 'tableauToTableau':
      return (
        isIndex(move.from, t) &&
        isIndex(move.to, t) &&
        Number.isInteger(move.count)
      );
    default:
      return false;
  }
}

/** Applique un coup et renvoie le nouveau plateau, ou null si le coup est illegal. */
export function applyMove(board: Board, move: Move): ApplyResult | null {
  if (!hasValidIndexes(board, move)) return null;
  switch (move.type) {
    case 'draw': {
      if (board.stock.length === 0) {
        return null;
      }
      const count = Math.min(board.drawCount, board.stock.length);
      const stock = board.stock.slice(0, board.stock.length - count);
      const drawn = board.stock
        .slice(board.stock.length - count)
        .reverse()
        .map((card) => ({ ...card, faceUp: true }));
      const waste = [...board.waste, ...drawn];
      return {
        board: withBoard(board, { stock, waste }),
        outcome: noOutcome(),
      };
    }

    case 'recycle': {
      if (board.stock.length > 0 || board.waste.length === 0) {
        return null;
      }
      const stock = board.waste
        .slice()
        .reverse()
        .map((card) => ({ ...card, faceUp: false }));
      return {
        board: withBoard(board, { stock, waste: [] }),
        outcome: { ...noOutcome(), recycled: true },
      };
    }

    case 'wasteToFoundation': {
      const card = top(board.waste);
      if (!card) return null;
      if (
        !canPlaceOnFoundation(card, top(board.foundations[move.foundation]))
      ) {
        return null;
      }
      const waste = board.waste.slice(0, -1);
      const pile = [...board.foundations[move.foundation], card];
      return {
        board: withBoard(board, {
          waste,
          foundations: replaceFoundation(board, move.foundation, pile),
        }),
        outcome: { ...noOutcome(), toFoundation: 1 },
      };
    }

    case 'wasteToTableau': {
      const card = top(board.waste);
      if (!card) return null;
      if (!canPlaceOnTableau(card, top(board.tableau[move.column]))) {
        return null;
      }
      const waste = board.waste.slice(0, -1);
      const column = [...board.tableau[move.column], card];
      return {
        board: withBoard(board, {
          waste,
          tableau: replaceTableau(board, move.column, column),
        }),
        outcome: noOutcome(),
      };
    }

    case 'tableauToFoundation': {
      const source = board.tableau[move.column];
      const card = top(source);
      if (!card) return null;
      if (
        !canPlaceOnFoundation(card, top(board.foundations[move.foundation]))
      ) {
        return null;
      }
      const { column, revealed } = flipTopIfNeeded(source.slice(0, -1));
      const pile = [...board.foundations[move.foundation], card];
      let tableau = replaceTableau(board, move.column, column);
      const foundations = replaceFoundation(board, move.foundation, pile);
      tableau = tableau.slice();
      return {
        board: withBoard(board, { tableau, foundations }),
        outcome: { ...noOutcome(), toFoundation: 1, revealed },
      };
    }

    case 'foundationToTableau': {
      const card = top(board.foundations[move.foundation]);
      if (!card) return null;
      if (!canPlaceOnTableau(card, top(board.tableau[move.column]))) {
        return null;
      }
      const pile = board.foundations[move.foundation].slice(0, -1);
      const column = [...board.tableau[move.column], card];
      return {
        board: withBoard(board, {
          foundations: replaceFoundation(board, move.foundation, pile),
          tableau: replaceTableau(board, move.column, column),
        }),
        outcome: { ...noOutcome(), fromFoundation: 1 },
      };
    }

    case 'tableauToTableau': {
      const source = board.tableau[move.from];
      if (move.count < 1 || move.count > source.length) {
        return null;
      }
      const startIndex = source.length - move.count;
      const run = movableRun(source, startIndex);
      if (!run) return null;
      if (move.from === move.to) return null;
      if (!canPlaceOnTableau(run[0], top(board.tableau[move.to]))) {
        return null;
      }
      const { column: fromColumn, revealed } = flipTopIfNeeded(
        source.slice(0, startIndex),
      );
      const toColumn = [...board.tableau[move.to], ...run];
      const tableau = board.tableau.slice();
      tableau[move.from] = fromColumn;
      tableau[move.to] = toColumn;
      return {
        board: withBoard(board, { tableau }),
        outcome: { ...noOutcome(), revealed },
      };
    }

    default:
      return null;
  }
}

/** Partie gagnee: les quatre fondations sont completes (Roi au sommet). */
export function isWon(board: Board): boolean {
  return board.foundations.every((pile) => top(pile)?.rank === 13);
}

/**
 * L'autocompletion n'est proposee qu'une fois toutes les cartes du tableau
 * retournees, et seulement si la partie peut vraiment se terminer en
 * n'envoyant que des cartes vers les fondations (en piochant si besoin).
 *
 * La premiere condition est indispensable: la simulation connait les cartes
 * cachees, elle pouvait donc "voir" qu'elles tombaient dans le bon ordre et
 * finir la partie a la place du joueur alors qu'il restait des cartes face
 * cachee sur la table.
 *
 * La seconde se verifie par simulation bornee: une carte utile peut rester
 * coincee sous une carte plus forte meme sans aucune carte face cachee.
 */
export function canAutoComplete(board: Board): boolean {
  if (isWon(board)) return false;
  if (board.tableau.some((column) => column.some((card) => !card.faceUp))) {
    return false;
  }
  let current = board;
  let guard = 0;
  while (guard++ < 2000) {
    const move = nextAutoCompleteMove(current);
    if (!move) return false;
    const result = applyMove(current, move);
    if (!result) return false;
    current = result.board;
    if (isWon(current)) return true;
  }
  return false;
}

function firstFoundationFor(board: Board, card: Card): number | null {
  for (let i = 0; i < board.foundations.length; i++) {
    if (canPlaceOnFoundation(card, top(board.foundations[i]))) {
      return i;
    }
  }
  return null;
}

/**
 * Cherche automatiquement la meilleure destination pour la carte du talon.
 * Priorite: fondation, puis une colonne du tableau (une occupee de preference).
 */
export function autoMoveFromWaste(board: Board): Move | null {
  const card = top(board.waste);
  if (!card) return null;
  const foundation = firstFoundationFor(board, card);
  if (foundation !== null) {
    return { type: 'wasteToFoundation', foundation };
  }
  const emptyTargets: number[] = [];
  for (let col = 0; col < board.tableau.length; col++) {
    if (canPlaceOnTableau(card, top(board.tableau[col]))) {
      if (board.tableau[col].length === 0) {
        emptyTargets.push(col);
      } else {
        return { type: 'wasteToTableau', column: col };
      }
    }
  }
  if (emptyTargets.length > 0) {
    return { type: 'wasteToTableau', column: emptyTargets[0] };
  }
  return null;
}

/**
 * Cherche la meilleure destination pour la carte cliquee dans une colonne.
 * Priorite: fondation (si carte seule), puis une colonne qui revele une carte
 * cachee, puis une colonne occupee, puis une colonne vide.
 */
export function autoMoveFromTableau(
  board: Board,
  column: number,
  startIndex: number,
): Move | null {
  const source = board.tableau[column];
  const run = movableRun(source, startIndex);
  if (!run) return null;

  if (run.length === 1) {
    const foundation = firstFoundationFor(board, run[0]);
    if (foundation !== null) {
      return { type: 'tableauToFoundation', column, foundation };
    }
  }

  const revealsHidden = startIndex > 0 && !source[startIndex - 1].faceUp;

  let revealTarget: number | null = null;
  let occupiedTarget: number | null = null;
  let emptyTarget: number | null = null;

  for (let to = 0; to < board.tableau.length; to++) {
    if (to === column) continue;
    if (!canPlaceOnTableau(run[0], top(board.tableau[to]))) continue;
    if (board.tableau[to].length === 0) {
      if (emptyTarget === null) emptyTarget = to;
    } else {
      if (revealsHidden && revealTarget === null) revealTarget = to;
      if (occupiedTarget === null) occupiedTarget = to;
    }
  }

  const to = revealTarget ?? occupiedTarget ?? emptyTarget;
  if (to === null) return null;
  return { type: 'tableauToTableau', from: column, to, count: run.length };
}

/**
 * Renvoie un coup utile a suggerer (indice), ou null si la partie est bloquee.
 *
 * On prefere d'abord les coups immediats les plus parlants (une carte vers une
 * fondation, puis un deplacement qui devoile une carte cachee). Faute de quoi,
 * on delegue a la recherche bornee: elle renvoie le premier coup d'un chemin
 * menant a un vrai progres, y compris via des deplacements qui ne revelent
 * rien ou plusieurs pioches d'affilee. C'est ce qui evite le fameux bug ou
 * l'indice conseillait de piocher indefiniment alors qu'un vrai coup existait
 * ailleurs. Si aucun progres n'est atteignable, findHint et isDeadlock
 * renvoient de facon coherente "rien" et "bloque".
 */
export function findHint(board: Board): Move | null {
  const wasteCard = top(board.waste);
  if (wasteCard) {
    const f = firstFoundationFor(board, wasteCard);
    if (f !== null) return { type: 'wasteToFoundation', foundation: f };
  }
  for (let col = 0; col < board.tableau.length; col++) {
    const card = top(board.tableau[col]);
    if (card) {
      const f = firstFoundationFor(board, card);
      if (f !== null)
        return { type: 'tableauToFoundation', column: col, foundation: f };
    }
  }

  for (let from = 0; from < board.tableau.length; from++) {
    const source = board.tableau[from];
    for (let start = 0; start < source.length; start++) {
      if (!source[start].faceUp) continue;
      const revealsHidden = start > 0 && !source[start - 1].faceUp;
      if (!revealsHidden) continue;
      const run = movableRun(source, start);
      if (!run) continue;
      for (let to = 0; to < board.tableau.length; to++) {
        if (to === from) continue;
        if (canPlaceOnTableau(run[0], top(board.tableau[to]))) {
          return { type: 'tableauToTableau', from, to, count: run.length };
        }
      }
    }
  }

  const result = searchProgress(board);
  if (result.move) return result.move;
  // Verdict incertain (budget epuise): on propose un repli plutot que rien,
  // pour ne jamais renvoyer null alors que la partie n'est pas declaree
  // bloquee (findHint null doit rester equivalent a isDeadlock vrai).
  if (result.exhausted) {
    return fallbackMove(board) ?? enumerateMoves(board)[0] ?? null;
  }
  return null;
}

/**
 * Cherche un coup vers une fondation, en balayant talon puis colonnes.
 * Sert au moteur d'autocompletion.
 */
function anyFoundationMove(board: Board): Move | null {
  const wasteCard = top(board.waste);
  if (wasteCard) {
    const f = firstFoundationFor(board, wasteCard);
    if (f !== null) return { type: 'wasteToFoundation', foundation: f };
  }
  for (let col = 0; col < board.tableau.length; col++) {
    const card = top(board.tableau[col]);
    if (card) {
      const f = firstFoundationFor(board, card);
      if (f !== null)
        return { type: 'tableauToFoundation', column: col, foundation: f };
    }
  }
  return null;
}

/**
 * Coup suivant de l'autocompletion: envoie une carte sur une fondation,
 * en piochant ou recyclant si besoin. Null quand tout est termine ou bloque.
 */
export function nextAutoCompleteMove(board: Board): Move | null {
  const direct = anyFoundationMove(board);
  if (direct) return direct;
  if (board.stock.length > 0) return { type: 'draw' };
  if (board.waste.length > 0) return { type: 'recycle' };
  return null;
}

/**
 * Un coup constitue un "progres" verifiable s'il pose une carte sur une
 * fondation, revele une carte cachee, ou gagne la partie. C'est le seul
 * critere fiable: tout le reste (brassages, pioches) n'est qu'un moyen
 * d'atteindre un de ces trois objectifs.
 */
function isProgressResult(result: ApplyResult): boolean {
  return (
    result.outcome.toFoundation > 0 ||
    result.outcome.revealed > 0 ||
    isWon(result.board)
  );
}

/** Cle compacte et unique d'un plateau, pour deduplication dans la recherche. */
function boardKey(board: Board): string {
  const enc = (c: Card) => c.id + (c.faceUp ? 'u' : 'd');
  const stock = board.stock.map((c) => c.id).join(',');
  const waste = board.waste.map((c) => c.id).join(',');
  const foundations = board.foundations
    .map((p) => (p.length > 0 ? p[p.length - 1].id : '-'))
    .join(',');
  const tableau = board.tableau.map((col) => col.map(enc).join(',')).join('|');
  return `${stock}#${waste}#${foundations}#${tableau}`;
}

/**
 * Enumere tous les coups legaux, y compris ceux sans effet garanti
 * (brassage de Rois, va-et-vient entre colonnes occupees): la recherche
 * bornee doit pouvoir les essayer pour verifier s'ils menent quelque part.
 */
function enumerateMoves(board: Board): Move[] {
  const moves: Move[] = [];

  if (board.stock.length > 0) {
    moves.push({ type: 'draw' });
  } else if (board.waste.length > 0) {
    moves.push({ type: 'recycle' });
  }

  const wasteCard = top(board.waste);
  if (wasteCard) {
    for (let f = 0; f < board.foundations.length; f++) {
      if (canPlaceOnFoundation(wasteCard, top(board.foundations[f]))) {
        moves.push({ type: 'wasteToFoundation', foundation: f });
      }
    }
    for (let c = 0; c < board.tableau.length; c++) {
      if (canPlaceOnTableau(wasteCard, top(board.tableau[c]))) {
        moves.push({ type: 'wasteToTableau', column: c });
      }
    }
  }

  // On n'enumere volontairement PAS les retours fondation -> tableau: ils ne
  // servent quasiment jamais a debloquer une partie, alourdissent la recherche
  // et surtout produiraient des indices absurdes ("retire une carte de ta
  // fondation"). Le joueur reste libre de le faire a la main.

  for (let col = 0; col < board.tableau.length; col++) {
    const column = board.tableau[col];
    for (let start = 0; start < column.length; start++) {
      if (!column[start].faceUp) continue;
      const run = movableRun(column, start);
      if (!run) continue;
      if (run.length === 1) {
        for (let f = 0; f < board.foundations.length; f++) {
          if (canPlaceOnFoundation(run[0], top(board.foundations[f]))) {
            moves.push({
              type: 'tableauToFoundation',
              column: col,
              foundation: f,
            });
          }
        }
      }
      for (let to = 0; to < board.tableau.length; to++) {
        if (to === col) continue;
        if (canPlaceOnTableau(run[0], top(board.tableau[to]))) {
          moves.push({
            type: 'tableauToTableau',
            from: col,
            to,
            count: run.length,
          });
        }
      }
    }
  }

  return moves;
}

/** Nombre d'etats explores au maximum par la recherche. */
const PROGRESS_SEARCH_BUDGET = 20000;

interface ProgressSearch {
  /** Premier coup d'un chemin menant a un progres, si trouve. */
  move: Move | null;
  /** Vrai si la recherche a ete coupee par le budget (verdict incertain). */
  exhausted: boolean;
}

/**
 * Coeur commun a l'indice et a la detection de blocage. Recherche en largeur
 * bornee: on part du plateau courant et on essaie tous les coups legaux (y
 * compris pioche, recyclage et brassages qui ne revelent rien) jusqu'a
 * atteindre un coup qui constitue un vrai progres (isProgressResult).
 *
 * - move non nul: le premier coup du plus court chemin vers un progres.
 * - move nul, exhausted faux: l'espace atteignable a ete explore entierement
 *   sans le moindre progres possible -> la partie est reellement bloquee.
 * - move nul, exhausted vrai: le budget a ete atteint avant de conclure ->
 *   verdict incertain, on choisit prudemment de considerer la partie NON
 *   bloquee (jamais de fausse defaite). En pratique les vraies impasses ont
 *   tres peu de coups et sont donc explorees en entier bien avant le budget;
 *   seules les positions a large eventail (donc quasi jamais mortes) epuisent
 *   le budget.
 */
function searchProgress(board: Board): ProgressSearch {
  const visited = new Set<string>([boardKey(board)]);
  let frontier: { board: Board; first: Move }[] = [];
  let explored = 0;
  let exhausted = false;

  const expand = (from: Board, first: Move | null): Move | null => {
    for (const move of enumerateMoves(from)) {
      if (explored >= PROGRESS_SEARCH_BUDGET) {
        exhausted = true;
        return null;
      }
      const result = applyMove(from, move);
      if (!result) continue;
      explored++;
      const rootMove = first ?? move;
      if (isProgressResult(result)) return rootMove;
      const key = boardKey(result.board);
      if (visited.has(key)) continue;
      visited.add(key);
      frontier.push({ board: result.board, first: rootMove });
    }
    return null;
  };

  const direct = expand(board, null);
  if (direct) return { move: direct, exhausted: false };

  while (frontier.length > 0 && !exhausted) {
    const level = frontier;
    frontier = [];
    for (const node of level) {
      const found = expand(node.board, node.first);
      if (found) return { move: found, exhausted: false };
      if (exhausted) break;
    }
  }
  return { move: null, exhausted };
}

/** Coup de repli quand le verdict est incertain: piocher, recycler, ou rien. */
function fallbackMove(board: Board): Move | null {
  if (board.stock.length > 0) return { type: 'draw' };
  if (board.waste.length > 0) return { type: 'recycle' };
  return null;
}

/**
 * Detecte une partie mathematiquement bloquee: l'espace de jeu atteignable a
 * ete explore en entier sans qu'aucun enchainement ne puisse plus poser sur
 * une fondation, reveler une carte ou gagner. Un budget epuise ne declenche
 * jamais de defaite (voir searchProgress).
 */
export function isDeadlock(board: Board): boolean {
  if (isWon(board)) return false;
  const result = searchProgress(board);
  return result.move === null && !result.exhausted;
}
