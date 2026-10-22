// Regles chiffrees du mode Jackpot (banque de points, quitte ou double, coffre).

/**
 * Multiplicateur applique au score d'une manche selon le nombre de victoires
 * deja enchainees dans la serie en cours. Sans plafond: x1, x1.5, x2, x3, x5,
 * puis +1 par victoire (x6, x7...). Une montee lineaire, et non doublee, pour
 * que le magot reste a l'echelle des prix de la boutique.
 */
export function comboMultiplier(consecutiveWins: number): number {
  const table = [1, 1.5, 2, 3, 5];
  const n = Math.max(0, Math.floor(consecutiveWins));
  if (n < table.length) return table[n];
  return table[table.length - 1] + (n - (table.length - 1));
}

/** Le coffre mystere devient disponible tous les trois succes consecutifs. */
export function vaultUnlocked(consecutiveWins: number): boolean {
  return consecutiveWins > 0 && consecutiveWins % 3 === 0;
}

export interface VaultOutcome {
  multiplier: number;
  trapped: boolean;
}

/** Contenu possible du coffre, avec sa chance de sortir. */
export const VAULT_ODDS: readonly { multiplier: number; chance: number }[] = [
  { multiplier: 0.5, chance: 0.05 },
  { multiplier: 1.5, chance: 0.4 },
  { multiplier: 2, chance: 0.32 },
  { multiplier: 3, chance: 0.15 },
  { multiplier: 5, chance: 0.06 },
  { multiplier: 10, chance: 0.02 },
];

/**
 * Tire au sort le sort du coffre. La plupart du temps c'est un gain, rarement
 * un piege (x0.5), et tres rarement le gros lot (x10).
 */
export function drawVaultOutcome(roll = Math.random()): VaultOutcome {
  let acc = 0;
  for (const o of VAULT_ODDS) {
    acc += o.chance;
    if (roll < acc)
      return { multiplier: o.multiplier, trapped: o.multiplier < 1 };
  }
  const last = VAULT_ODDS[VAULT_ODDS.length - 1];
  return { multiplier: last.multiplier, trapped: false };
}
