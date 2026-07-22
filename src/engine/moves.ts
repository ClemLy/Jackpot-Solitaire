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

/** Applique un coup et renvoie le nouveau plateau, ou null si le coup est illegal. */
export function applyMove(board: Board, move: Move): ApplyResult | null {
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
 * L'autocompletion n'est proposee que si la partie peut vraiment se terminer
 * en n'envoyant que des cartes vers les fondations (en piochant si besoin).
 * On le verifie par simulation bornee: c'est la seule garantie fiable, car
 * une carte utile peut rester coincee sous une carte plus forte meme sans
 * aucune carte face cachee.
 */
export function canAutoComplete(board: Board): boolean {
  if (isWon(board)) return false;
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
 * Renvoie un coup utile a suggerer (indice), ou null si rien d'evident.
 * On evite les coups qui tournent en rond.
 */
export function findHint(board: Board): Move | null {
  // 1. Envoyer une carte sur une fondation.
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

  // 2. Un deplacement de tableau qui revele une carte cachee.
  for (let from = 0; from < board.tableau.length; from++) {
    const source = board.tableau[from];
    for (let start = 0; start < source.length; start++) {
      if (!source[start].faceUp) continue;
      const run = movableRun(source, start);
      if (!run) continue;
      const revealsHidden = start > 0 && !source[start - 1].faceUp;
      const freesColumn = start === 0 && source[0].rank === 13;
      if (!revealsHidden) {
        // Deplacer un Roi deja seul dans sa colonne ne sert a rien.
        if (freesColumn) continue;
      }
      for (let to = 0; to < board.tableau.length; to++) {
        if (to === from) continue;
        if (board.tableau[to].length === 0) continue;
        if (canPlaceOnTableau(run[0], top(board.tableau[to]))) {
          if (revealsHidden)
            return { type: 'tableauToTableau', from, to, count: run.length };
        }
      }
    }
  }

  // 3. Poser la carte du talon sur le tableau.
  if (wasteCard) {
    for (let col = 0; col < board.tableau.length; col++) {
      if (canPlaceOnTableau(wasteCard, top(board.tableau[col]))) {
        return { type: 'wasteToTableau', column: col };
      }
    }
  }

  // 4. Piocher, ou recycler le talon.
  if (board.stock.length > 0) return { type: 'draw' };
  if (board.waste.length > 0) return { type: 'recycle' };

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

function canGoToAnyFoundation(board: Board, card: Card): boolean {
  return board.foundations.some((pile) =>
    canPlaceOnFoundation(card, top(pile)),
  );
}

/**
 * Vrai s'il existe, des maintenant, un coup qui fait reellement progresser
 * la partie: une carte qui rejoint une fondation, ou un deplacement qui
 * devoile une carte cachee. Deplacer un Roi seul vers une colonne vide, ou
 * rearranger deux colonnes deja occupees sans rien devoiler, ne compte pas:
 * ce sont des brassages sans effet garanti, seule la recherche bornee de
 * isDeadlock sait dire s'ils menent quelque part.
 */
function hasImmediateProgress(board: Board): boolean {
  for (let col = 0; col < board.tableau.length; col++) {
    const column = board.tableau[col];
    for (let start = 0; start < column.length; start++) {
      if (!column[start].faceUp) continue;
      const run = movableRun(column, start);
      if (!run) continue;
      if (run.length === 1 && canGoToAnyFoundation(board, run[0])) return true;

      const revealsHidden = start > 0 && !column[start - 1].faceUp;
      if (!revealsHidden) continue;
      for (let to = 0; to < board.tableau.length; to++) {
        if (to === col) continue;
        if (canPlaceOnTableau(run[0], top(board.tableau[to]))) return true;
      }
    }
  }

  // Poser une carte du talon sur le tableau n'est pas retenu ici: comme le
  // brassage de Rois, ca "ressemble" a un coup utile mais ne garantit rien
  // (c'etait precisement le bug qui laissait le jeu suggerer de piocher a
  // l'infini sans jamais verifier que ca menait quelque part). Seule une
  // fondation compte comme progres immediat verifie; le reste passe par la
  // recherche bornee.
  const wasteTop = top(board.waste);
  const candidates = wasteTop
    ? [wasteTop, ...simulateReachableWasteTops(board)]
    : simulateReachableWasteTops(board);
  for (const card of candidates) {
    if (canGoToAnyFoundation(board, card)) return true;
  }
  return false;
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

  for (let f = 0; f < board.foundations.length; f++) {
    const card = top(board.foundations[f]);
    if (!card) continue;
    for (let c = 0; c < board.tableau.length; c++) {
      if (canPlaceOnTableau(card, top(board.tableau[c]))) {
        moves.push({ type: 'foundationToTableau', foundation: f, column: c });
      }
    }
  }

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

/** Nombre d'etats explores au maximum par la recherche de solvabilite. */
const DEADLOCK_SEARCH_BUDGET = 20000;

/**
 * Cherche, par une recherche en largeur bornee, un enchainement de coups
 * (y compris des brassages a priori inutiles) qui menerait a un vrai progres
 * ou a la victoire. Renvoie true des qu'un tel chemin est trouve.
 */
function canEventuallyProgress(board: Board): boolean {
  const visited = new Set<string>([boardKey(board)]);
  let frontier = [board];
  let explored = 0;

  while (frontier.length > 0 && explored < DEADLOCK_SEARCH_BUDGET) {
    const next: Board[] = [];
    for (const current of frontier) {
      for (const move of enumerateMoves(current)) {
        if (explored >= DEADLOCK_SEARCH_BUDGET) break;
        const result = applyMove(current, move);
        if (!result) continue;
        explored++;
        if (isWon(result.board) || hasImmediateProgress(result.board)) {
          return true;
        }
        const key = boardKey(result.board);
        if (visited.has(key)) continue;
        visited.add(key);
        next.push(result.board);
      }
      if (explored >= DEADLOCK_SEARCH_BUDGET) break;
    }
    frontier = next;
  }
  return false;
}

/**
 * Simule, sans modifier le plateau reel, toutes les cartes qui deviendront
 * un jour sommet du talon si on ne fait que piocher/recycler. Le tirage est
 * entierement deterministe: un premier passage epuise la pioche courante,
 * puis un recyclage suivi d'un cycle complet suffit a couvrir le regime
 * stable qui se repetera ensuite indefiniment a l'identique.
 */
function simulateReachableWasteTops(board: Board): Card[] {
  const tops: Card[] = [];
  let current = board;
  let guard = 0;

  const drain = () => {
    while (current.stock.length > 0 && guard++ < 60) {
      const res = applyMove(current, { type: 'draw' });
      if (!res) break;
      current = res.board;
      const t = top(current.waste);
      if (t) tops.push(t);
    }
  };

  drain();
  if (current.waste.length > 0) {
    const recycled = applyMove(current, { type: 'recycle' });
    if (recycled) {
      current = recycled.board;
      guard = 0;
      drain();
    }
  }
  return tops;
}

/**
 * Detecte une partie mathematiquement bloquee. Deux niveaux:
 * un controle rapide (y a-t-il un progres immediat ?) qui suffit dans la
 * grande majorite des tours de jeu, et si ce n'est pas le cas, une recherche
 * bornee qui essaie aussi les brassages a priori inutiles (Rois qui
 * tournent, allers-retours entre colonnes occupees) pour verifier s'ils
 * menent malgre tout quelque part avant de declarer la partie perdue.
 */
export function isDeadlock(board: Board): boolean {
  if (isWon(board)) return false;
  if (hasImmediateProgress(board)) return false;
  return !canEventuallyProgress(board);
}
