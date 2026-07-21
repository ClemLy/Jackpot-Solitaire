import type { MoveOutcome } from './types';

/** Points gagnes ou perdus par type d'evenement, regle du Risk / Reward. */
export const SCORE = {
  toFoundation: 10,
  fromFoundation: -10,
  revealCard: 5,
  undoPenalty: -15,
  invalidPenalty: -5,
  hintPenalty: -25,
  recyclePenaltyDraw3: -20,
  precisionBonus: 100,
} as const;

/** Points issus d'un coup valide (fondations, cartes revelees, recyclage). */
export function scoreForOutcome(
  outcome: MoveOutcome,
  drawCount: 1 | 3,
): number {
  let delta = 0;
  delta += outcome.toFoundation * SCORE.toFoundation;
  delta += outcome.fromFoundation * SCORE.fromFoundation;
  delta += outcome.revealed * SCORE.revealCard;
  if (outcome.recycled && drawCount === 3) {
    delta += SCORE.recyclePenaltyDraw3;
  }
  return delta;
}

export interface EndBonuses {
  speed: number;
  precision: number;
  total: number;
}

/**
 * Bonus de fin de partie.
 * Vitesse: max(0, 1000 - secondes * 2).
 * Precision: +100 si aucun coup invalide et aucun annuler.
 */
export function endGameBonuses(params: {
  elapsedSeconds: number;
  invalidMoves: number;
  undoCount: number;
}): EndBonuses {
  const speed = Math.max(0, Math.round(1000 - params.elapsedSeconds * 2));
  const precision =
    params.invalidMoves === 0 && params.undoCount === 0
      ? SCORE.precisionBonus
      : 0;
  return { speed, precision, total: speed + precision };
}
