/** Formate une duree en millisecondes en mm:ss (ou h:mm:ss au dela d'une heure). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Ajoute des espaces fines comme separateurs de milliers, sans signe monetaire. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  return rounded.toLocaleString('fr-FR');
}

/**
 * Montant court, pour les emplacements etroits (pastilles, boutons): exact
 * jusqu'a 999 999, puis en millions ou milliards avec trois chiffres
 * significatifs, a la maniere des casinos: 1,23 M, 45,7 M, 987 M, 1,23 Md.
 * Le montant exact reste disponible en infobulle et pour les lecteurs
 * d'ecran (voir formatNumber).
 */
export function formatCompact(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs < 1_000_000) return formatNumber(n);
  const [unit, div] = abs >= 1e9 ? ['Md', 1e9] : ['M', 1e6];
  const scaled = n / div;
  const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  // Tronque (sans arrondir vers le haut): 999 999 999 ne devient pas 1 000 M.
  const factor = 10 ** digits;
  const cut = Math.trunc(scaled * factor) / factor;
  return `${cut.toLocaleString('fr-FR', { maximumFractionDigits: digits })}\u00a0${unit}`;
}

/** Pourcentage entier borne entre 0 et 100. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/** Multiplicateur lisible a la francaise: 1,5 et non 2 (pas d'arrondi entier). */
export function formatMultiplier(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
