import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_CARD_BACK,
  DEFAULT_TABLE,
  isValidCardBack,
  isValidTable,
} from './themes';
import { satisfiedAchievements } from './achievements';
import { setSoundEnabled, setSoundVolume } from '../audio/sfx';

export interface Settings {
  soundEnabled: boolean;
  volume: number;
  cardBack: string;
  table: string;
  defaultDraw: 1 | 3;
  reducedMotion: boolean;
}

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentWinStreak: number;
  bestWinStreak: number;
  bestTimeMs: number | null;
  bestScore: number;
  sumWinTimeMs: number;
  sumWinMoves: number;
}

export interface GamblingRecords {
  secured: number;
  bestSecuredRun: number;
  longestStreak: number;
  vaultsOpened: number;
}

export interface DailyProgress {
  completedDates: string[];
  lastPlayed: string | null;
}

export interface GameEndInput {
  won: boolean;
  timeMs: number;
  moves: number;
  score: number;
  drawCount: 1 | 3;
  invalidMoves: number;
  undoCount: number;
  usedHint: boolean;
  isDaily: boolean;
  dailyDate?: string;
}

interface MetaState {
  settings: Settings;
  stats: Stats;
  gambling: GamblingRecords;
  daily: DailyProgress;
  achievements: Record<string, number>;
  recentUnlocks: string[];

  updateSettings: (patch: Partial<Settings>) => void;
  recordDeal: () => void;
  resolveGame: (input: GameEndInput) => string[];
  secureBank: (amount: number, runStreak: number) => string[];
  openVault: () => string[];
  consumeUnlock: () => void;
  resetProgress: () => void;
}

const initialSettings: Settings = {
  soundEnabled: true,
  volume: 0.6,
  cardBack: DEFAULT_CARD_BACK,
  table: DEFAULT_TABLE,
  defaultDraw: 3,
  reducedMotion: false,
};

const initialStats: Stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  bestTimeMs: null,
  bestScore: 0,
  sumWinTimeMs: 0,
  sumWinMoves: 0,
};

const initialGambling: GamblingRecords = {
  secured: 0,
  bestSecuredRun: 0,
  longestStreak: 0,
  vaultsOpened: 0,
};

const initialDaily: DailyProgress = {
  completedDates: [],
  lastPlayed: null,
};

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      stats: initialStats,
      gambling: initialGambling,
      daily: initialDaily,
      achievements: {},
      recentUnlocks: [],

      updateSettings: (patch) => {
        set((state) => {
          const next = { ...state.settings, ...patch };
          if (!isValidCardBack(next.cardBack))
            next.cardBack = DEFAULT_CARD_BACK;
          if (!isValidTable(next.table)) next.table = DEFAULT_TABLE;
          setSoundEnabled(next.soundEnabled);
          setSoundVolume(next.volume);
          return { settings: next };
        });
      },

      recordDeal: () => {
        set((state) => ({
          stats: { ...state.stats, gamesPlayed: state.stats.gamesPlayed + 1 },
        }));
      },

      resolveGame: (input) => {
        const prev = get();
        const stats = { ...prev.stats };
        const daily = {
          completedDates: [...prev.daily.completedDates],
          lastPlayed: input.isDaily
            ? (input.dailyDate ?? prev.daily.lastPlayed)
            : prev.daily.lastPlayed,
        };

        if (input.won) {
          stats.gamesWon += 1;
          stats.currentWinStreak += 1;
          stats.bestWinStreak = Math.max(
            stats.bestWinStreak,
            stats.currentWinStreak,
          );
          stats.bestScore = Math.max(stats.bestScore, input.score);
          stats.sumWinTimeMs += input.timeMs;
          stats.sumWinMoves += input.moves;
          if (stats.bestTimeMs === null || input.timeMs < stats.bestTimeMs) {
            stats.bestTimeMs = input.timeMs;
          }
          if (
            input.isDaily &&
            input.dailyDate &&
            !daily.completedDates.includes(input.dailyDate)
          ) {
            daily.completedDates.push(input.dailyDate);
          }
        } else {
          stats.currentWinStreak = 0;
        }

        const ids = satisfiedAchievements({
          won: input.won,
          timeMs: input.timeMs,
          drawCount: input.drawCount,
          invalidMoves: input.invalidMoves,
          undoCount: input.undoCount,
          usedHint: input.usedHint,
          isDaily: input.isDaily,
          dailyCompletedCount: daily.completedDates.length,
          currentWinStreak: stats.currentWinStreak,
          securedAmount: 0,
          gamblingStreak: 0,
          vaultOpened: false,
        });

        const newly = mergeAchievements(prev.achievements, ids);
        set({
          stats,
          daily,
          achievements: { ...prev.achievements, ...newly.map },
          recentUnlocks: [...prev.recentUnlocks, ...newly.added],
        });
        return newly.added;
      },

      secureBank: (amount, runStreak) => {
        const prev = get();
        const gambling: GamblingRecords = {
          ...prev.gambling,
          secured: prev.gambling.secured + amount,
          bestSecuredRun: Math.max(prev.gambling.bestSecuredRun, amount),
          longestStreak: Math.max(prev.gambling.longestStreak, runStreak),
        };
        const ids = satisfiedAchievements({
          won: false,
          timeMs: 0,
          drawCount: prev.settings.defaultDraw,
          invalidMoves: 0,
          undoCount: 0,
          usedHint: false,
          isDaily: false,
          dailyCompletedCount: prev.daily.completedDates.length,
          currentWinStreak: prev.stats.currentWinStreak,
          securedAmount: amount,
          gamblingStreak: runStreak,
          vaultOpened: false,
        });
        const newly = mergeAchievements(prev.achievements, ids);
        set({
          gambling,
          achievements: { ...prev.achievements, ...newly.map },
          recentUnlocks: [...prev.recentUnlocks, ...newly.added],
        });
        return newly.added;
      },

      openVault: () => {
        const prev = get();
        const gambling = {
          ...prev.gambling,
          vaultsOpened: prev.gambling.vaultsOpened + 1,
        };
        const newly = mergeAchievements(prev.achievements, ['treasure-hunter']);
        set({
          gambling,
          achievements: { ...prev.achievements, ...newly.map },
          recentUnlocks: [...prev.recentUnlocks, ...newly.added],
        });
        return newly.added;
      },

      consumeUnlock: () => {
        set((state) => ({ recentUnlocks: state.recentUnlocks.slice(1) }));
      },

      resetProgress: () => {
        set({
          stats: initialStats,
          gambling: initialGambling,
          daily: initialDaily,
          achievements: {},
          recentUnlocks: [],
        });
      },
    }),
    {
      name: 'jackpot-solitaire-meta-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        stats: state.stats,
        gambling: state.gambling,
        daily: state.daily,
        achievements: state.achievements,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setSoundEnabled(state.settings.soundEnabled);
          setSoundVolume(state.settings.volume);
        }
      },
    },
  ),
);

function mergeAchievements(
  existing: Record<string, number>,
  ids: string[],
): { map: Record<string, number>; added: string[] } {
  const map: Record<string, number> = {};
  const added: string[] = [];
  const now = Date.now();
  for (const id of ids) {
    if (!existing[id] && !map[id]) {
      map[id] = now;
      added.push(id);
    }
  }
  return { map, added };
}
