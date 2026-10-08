// Modele de donnees du moteur de Solitaire (Klondike).
// Tout est immuable: chaque coup renvoie un nouveau plateau, jamais mute.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Color = 'black' | 'red';

/** 1 = As, 11 = Valet, 12 = Dame, 13 = Roi. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  /** Identifiant stable et unique par carte (suit + rank), utile pour les cles React et les animations. */
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly faceUp: boolean;
}

/**
 * Plateau de jeu.
 * Pour chaque pile, le dernier element du tableau est la carte "du dessus"
 * (la plus accessible). Le premier element est tout au fond de la pile.
 */
export interface Board {
  /** Pioche face cachee. On tire depuis la fin. */
  readonly stock: Card[];
  /** Talon (cartes retournees). Seule la carte du dessus est jouable. */
  readonly waste: Card[];
  /** 4 fondations, construites par couleur de l'As au Roi. */
  readonly foundations: Card[][];
  /** 7 colonnes du tableau. */
  readonly tableau: Card[][];
  /** Nombre de cartes tirees a chaque pioche (1 ou 3). */
  readonly drawCount: 1 | 3;
  /**
   * Rechargements de la pioche encore permis (mode Vegas). Absent: illimite.
   */
  readonly recyclesLeft?: number;
}

/** Emplacements possibles pour cibler un coup. */
export type PileKind = 'stock' | 'waste' | 'foundation' | 'tableau';

export interface PileRef {
  kind: PileKind;
  index: number;
}

/** Un coup applicable au plateau. */
export type Move =
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'wasteToFoundation'; foundation: number }
  | { type: 'wasteToTableau'; column: number }
  | { type: 'tableauToFoundation'; column: number; foundation: number }
  | { type: 'foundationToTableau'; foundation: number; column: number }
  | { type: 'tableauToTableau'; from: number; to: number; count: number };

/** Ce que le coup a produit, pour que la couche de score sache quoi compter. */
export interface MoveOutcome {
  /** Cartes deposees sur une fondation par ce coup. */
  toFoundation: number;
  /** Cartes retirees d'une fondation par ce coup (score a reprendre). */
  fromFoundation: number;
  /** Cartes du tableau nouvellement retournees face visible. */
  revealed: number;
  /** Vrai si le talon a ete remis en pioche (recyclage). */
  recycled: boolean;
}

export interface ApplyResult {
  board: Board;
  outcome: MoveOutcome;
}
