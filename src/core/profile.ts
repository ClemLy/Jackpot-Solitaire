// Carte de profil publique: ce que les amis voient d'un joueur. Calculee a
// partir de la sauvegarde, sans jamais exposer la banque ni l'inventaire.

import {
  COLLECTIBLES,
  findCosmetic,
  vipTierFor,
  type VipTierId,
} from '../state/catalog';
import { ACHIEVEMENTS } from '../state/achievements';
import type { PlayerState } from './types';

export interface PublicCard {
  pseudo: string;
  avatar: string;
  frame: string;
  profileCard: string;
  title: string;
  tier: VipTierId;
  /** Jetons gagnes depuis le debut: la progression vers le rang suivant. */
  lifetimeEarned: number;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    bestWinStreak: number;
    bestScore: number;
    bestTimeMs: number | null;
  };
  jackpot: {
    bestSecuredRun: number;
    longestStreak: number;
    vaultsOpened: number;
    progressiveWins: number;
  };
  achievements: { unlocked: number; total: number };
  collection: { owned: number; total: number };
  dailyDone: number;
  memberSince: string | null;
}

/** Ce que voit quelqu'un qui n'est pas (encore) ami: le strict minimum. */
export type MiniCard = Pick<
  PublicCard,
  'pseudo' | 'avatar' | 'frame' | 'tier' | 'title'
>;

export function publicCard(
  pseudo: string,
  s: PlayerState,
  memberSince: string | null = null,
): PublicCard {
  const owned = new Set(s.inventory.owned);
  return {
    pseudo,
    avatar: s.equipped.avatar,
    frame: s.equipped.frame,
    profileCard: s.equipped.profileCard,
    title: s.equipped.title,
    tier: vipTierFor(s.wallet.lifetimeEarned).id,
    lifetimeEarned: s.wallet.lifetimeEarned,
    stats: {
      gamesPlayed: s.stats.gamesPlayed,
      gamesWon: s.stats.gamesWon,
      bestWinStreak: s.stats.bestWinStreak,
      bestScore: s.stats.bestScore,
      bestTimeMs: s.stats.bestTimeMs,
    },
    jackpot: {
      bestSecuredRun: s.gambling.bestSecuredRun,
      longestStreak: s.gambling.longestStreak,
      vaultsOpened: s.gambling.vaultsOpened,
      progressiveWins: s.progressive.wins,
    },
    achievements: {
      unlocked: Object.keys(s.achievements).length,
      total: ACHIEVEMENTS.length,
    },
    collection: {
      owned: COLLECTIBLES.filter((c) => owned.has(c.id)).length,
      total: COLLECTIBLES.length,
    },
    dailyDone: s.daily.completedDates.length,
    memberSince,
  };
}

export function miniCard(card: PublicCard): MiniCard {
  return {
    pseudo: card.pseudo,
    avatar: card.avatar,
    frame: card.frame,
    tier: card.tier,
    title: card.title,
  };
}

/** Libelle lisible d'un objet equipe (titre, avatar...). */
export function cosmeticLabel(id: string): string {
  return findCosmetic(id)?.label ?? '';
}
