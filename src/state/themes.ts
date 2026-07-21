// Thèmes de personnalisation: dos de cartes et tapis de jeu.
// Chaque identifiant correspond à une classe CSS qui dessine le rendu.

export interface ThemeOption {
  id: string;
  label: string;
  hint: string;
}

export const CARD_BACKS: readonly ThemeOption[] = [
  { id: 'retro', label: 'Rétro', hint: "Losanges griffonnés à l'ancienne" },
  { id: 'modern', label: 'Moderne', hint: 'Aplats francs et bordure nette' },
  { id: 'minimal', label: 'Minimal', hint: 'Un seul trait, tout en sobriété' },
  { id: 'pixel', label: 'Pixel', hint: 'Petit damier façon vieux jeu' },
] as const;

export const TABLES: readonly ThemeOption[] = [
  { id: 'felt', label: 'Feutrine', hint: 'Le vert usé du bistrot du coin' },
  { id: 'cream', label: 'Crème', hint: 'Doux et clair, tout en douceur' },
  { id: 'dark', label: 'Nuit', hint: 'Sombre et reposant pour les yeux' },
  { id: 'wood', label: 'Bois', hint: 'Une vieille table griffonnée' },
  { id: 'neon', label: 'Néon', hint: "Ambiance salle d'arcade" },
] as const;

export const DEFAULT_CARD_BACK = 'retro';
export const DEFAULT_TABLE = 'felt';

export function isValidCardBack(id: string): boolean {
  return CARD_BACKS.some((t) => t.id === id);
}

export function isValidTable(id: string): boolean {
  return TABLES.some((t) => t.id === id);
}
