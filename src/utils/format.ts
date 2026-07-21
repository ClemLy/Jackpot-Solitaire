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

/** Pourcentage entier borne entre 0 et 100. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
