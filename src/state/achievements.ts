// Definition des hauts faits (succes) et de leurs conditions.

export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-win',
    title: 'Première donne',
    description: 'Remporter sa toute première partie.',
  },
  {
    id: 'lightning',
    title: 'Éclair',
    description: 'Gagner une partie en moins de trois minutes.',
  },
  {
    id: 'strategist',
    title: 'Stratège',
    description: 'Gagner en Pioche 3 sans le moindre coup invalide ni annuler.',
  },
  {
    id: 'clear-mind',
    title: 'Tête froide',
    description: 'Gagner une partie sans demander le moindre indice.',
  },
  {
    id: 'faithful',
    title: 'Fidèle',
    description: 'Terminer dix défis du jour.',
  },
  {
    id: 'hot-streak',
    title: 'Série chaude',
    description: 'Enchaîner trois victoires de suite.',
  },
  {
    id: 'high-roller',
    title: 'Gros bras',
    description: 'Sécuriser un magot de 2000 points ou plus en une fois.',
  },
  {
    id: 'daredevil',
    title: 'Casse-cou',
    description: "Gagner trois manches d'affilée en quitte ou double.",
  },
  {
    id: 'treasure-hunter',
    title: 'Chasseur de trésor',
    description: 'Ouvrir le coffre-fort mystère.',
  },
  {
    id: 'collector',
    title: 'Client fidèle',
    description: 'Faire un premier achat à la boutique.',
  },
  {
    id: 'regular',
    title: 'Habitué du salon',
    description: 'Atteindre le rang VIP Or.',
  },
  {
    id: 'grail',
    title: 'Le Graal',
    description: 'S’offrir une pièce maîtresse de la boutique.',
  },
  {
    id: 'completionist',
    title: 'Collection complète',
    description: 'Posséder absolument tout ce que vend la boutique.',
  },
  {
    id: 'high-stakes',
    title: 'Carré VIP',
    description: 'Gagner une manche à la table Diamant.',
  },
] as const;

export interface AchievementContext {
  won: boolean;
  timeMs: number;
  drawCount: 1 | 3;
  invalidMoves: number;
  undoCount: number;
  usedHint: boolean;
  isDaily: boolean;
  dailyCompletedCount: number;
  currentWinStreak: number;
  securedAmount: number;
  gamblingStreak: number;
  vaultOpened: boolean;
}

/** Renvoie les identifiants des hauts faits satisfaits par cet evenement. */
export function satisfiedAchievements(ctx: AchievementContext): string[] {
  const ids: string[] = [];
  if (ctx.won) {
    ids.push('first-win');
    if (ctx.timeMs > 0 && ctx.timeMs < 3 * 60 * 1000) ids.push('lightning');
    if (ctx.drawCount === 3 && ctx.invalidMoves === 0 && ctx.undoCount === 0) {
      ids.push('strategist');
    }
    if (!ctx.usedHint) ids.push('clear-mind');
    if (ctx.currentWinStreak >= 3) ids.push('hot-streak');
  }
  if (ctx.isDaily && ctx.dailyCompletedCount >= 10) ids.push('faithful');
  if (ctx.securedAmount >= 2000) ids.push('high-roller');
  if (ctx.gamblingStreak >= 3) ids.push('daredevil');
  if (ctx.vaultOpened) ids.push('treasure-hunter');
  return ids;
}
