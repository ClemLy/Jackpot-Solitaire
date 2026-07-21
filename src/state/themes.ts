// Themes de personnalisation: dos de cartes et tapis de jeu.
// Chaque identifiant correspond a une classe CSS qui dessine le rendu.

export interface ThemeOption {
  id: string;
  label: string;
  hint: string;
}

export const CARD_BACKS: readonly ThemeOption[] = [
  { id: 'retro', label: 'Retro', hint: 'Losanges griffonnes a l ancienne' },
  { id: 'modern', label: 'Moderne', hint: 'Aplats francs et bordure nette' },
  { id: 'minimal', label: 'Minimal', hint: 'Un seul trait, tout en sobriete' },
  { id: 'pixel', label: 'Pixel', hint: 'Petit damier facon vieux jeu' },
] as const;

export const TABLES: readonly ThemeOption[] = [
  { id: 'felt', label: 'Feutrine', hint: 'Le vert use du bistrot du coin' },
  { id: 'dark', label: 'Nuit', hint: 'Sombre et reposant pour les yeux' },
  { id: 'wood', label: 'Bois', hint: 'Une vieille table griffonnee' },
  { id: 'neon', label: 'Neon', hint: 'Ambiance salle d arcade' },
] as const;

export const DEFAULT_CARD_BACK = 'retro';
export const DEFAULT_TABLE = 'felt';

export function isValidCardBack(id: string): boolean {
  return CARD_BACKS.some((t) => t.id === id);
}

export function isValidTable(id: string): boolean {
  return TABLES.some((t) => t.id === id);
}
