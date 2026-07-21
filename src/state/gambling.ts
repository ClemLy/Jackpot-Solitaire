// Regles chiffrees du mode Jackpot (banque de points, quitte ou double, coffre).

/**
 * Multiplicateur applique au score d'une manche selon le nombre de victoires
 * deja enchainees dans la serie en cours.
 */
export function comboMultiplier(consecutiveWins: number): number {
  const table = [1, 1.5, 2, 3, 5];
  const index = Math.min(consecutiveWins, table.length - 1);
  return table[index];
}

/** Le coffre mystere devient disponible tous les trois succes consecutifs. */
export function vaultUnlocked(consecutiveWins: number): boolean {
  return consecutiveWins > 0 && consecutiveWins % 3 === 0;
}

export interface VaultOutcome {
  multiplier: number;
  trapped: boolean;
}

/**
 * Tire au sort le sort du coffre. La plupart du temps c'est un gain, mais le
 * coffre peut etre piege (x0.5): c'est le sel du gambling.
 */
export function drawVaultOutcome(roll = Math.random()): VaultOutcome {
  // Pondere: piege 15%, x1.5 40%, x2 30%, x5 15%.
  if (roll < 0.15) return { multiplier: 0.5, trapped: true };
  if (roll < 0.55) return { multiplier: 1.5, trapped: false };
  if (roll < 0.85) return { multiplier: 2, trapped: false };
  return { multiplier: 5, trapped: false };
}
