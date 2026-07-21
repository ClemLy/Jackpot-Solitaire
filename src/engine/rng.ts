// Generateur pseudo-aleatoire deterministe a partir d'une graine (seed).
// Deux seeds identiques produisent exactement la meme partie: indispensable
// pour le defi du jour et le partage de parties via une URL.

/** Hash de chaine facon xmur3: transforme un texte en graine 32 bits. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Generateur mulberry32: rapide, deterministe, suffisant pour un jeu de cartes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Nombre flottant dans [0, 1). */
  next(): number;
  /** Entier dans [0, max). */
  int(max: number): number;
}

/** Cree un generateur deterministe depuis une graine (texte ou nombre). */
export function createRng(seed: string | number): Rng {
  const seedText = String(seed);
  const gen = mulberry32(xmur3(seedText)());
  return {
    next: gen,
    int: (max: number) => Math.floor(gen() * max),
  };
}

/** Melange une copie du tableau via Fisher-Yates pilote par le RNG. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
