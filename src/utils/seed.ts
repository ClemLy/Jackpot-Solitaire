// Gestion des graines de partie: aleatoire, defi du jour, lecture et partage via URL.

/** Date du jour au format AAAA-MM-JJ selon l'heure locale. */
export function todayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Graine deterministe du defi du jour. */
export function dailySeed(dateISO = todayISO()): string {
  return `defi-${dateISO}`;
}

/** Graine aleatoire courte et lisible, facile a noter ou partager. */
export function randomSeed(): string {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

/** Longueur maximale d'une graine: largement assez pour noter une donne. */
export const SEED_MAX_LENGTH = 48;

/**
 * Nettoie une graine venue de l'exterieur (URL, champ de saisie): on retire
 * les caracteres de controle et les espaces superflus, et on borne la
 * longueur. Une graine vide apres nettoyage est refusee (null).
 */
export function sanitizeSeed(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // Les blancs (retours a la ligne, tabulations) deviennent des espaces
  // avant de retirer les autres caracteres de controle.
  const cleaned = Array.from(raw.normalize('NFC').replace(/\s+/g, ' '))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && !(code >= 0x7f && code <= 0x9f);
    })
    .join('')
    .trim();
  if (cleaned.length === 0) return null;
  return Array.from(cleaned).slice(0, SEED_MAX_LENGTH).join('');
}

/** Lit une graine passee dans l'URL (?seed=...), si presente et valide. */
export function readSeedFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return sanitizeSeed(params.get('seed'));
}

/** Construit un lien partageable qui rejoue exactement la meme donne. */
export function shareUrl(seed: string): string {
  if (typeof window === 'undefined') return `?seed=${encodeURIComponent(seed)}`;
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  return url.toString();
}

/** Nettoie l'URL de la graine (apres consommation), sans recharger la page. */
export function clearSeedFromUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('seed')) {
    url.searchParams.delete('seed');
    window.history.replaceState({}, '', url.toString());
  }
}
