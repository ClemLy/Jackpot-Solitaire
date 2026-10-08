import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CONSUMABLES,
  DEFAULT_CARD_BACK,
  DEFAULT_TABLE,
  DEFAULT_VICTORY_FX,
  DEFAULT_CARD_FACE,
  DEFAULT_DIFFICULTY,
  DEFAULT_TITLE,
  COLLECTIBLES,
  WELCOME_GIFT,
  WHEEL_SEGMENTS,
  PROGRESSIVE_SEED,
  discountedPrice,
  drawWheelSegment,
  missionBonusFor,
  weeklyGiftFor,
  findConsumable,
  findCosmetic,
  findDifficulty,
  isValidCardBack,
  isValidTable,
  isValidVictoryFx,
  isValidCardFace,
  isValidDifficulty,
  isValidTitle,
  meetsTier,
  tierIndex,
  vipTierFor,
  type ConsumableId,
  type DifficultyId,
  type WheelReward,
} from './catalog';
import { ACHIEVEMENTS, satisfiedAchievements } from './achievements';
import {
  activeMissions,
  advance,
  emptyPeriod,
  findMission,
  isClaimable,
  missionReward,
  periodKey,
  type MissionEvent,
  type MissionScope,
  type PeriodProgress,
} from './missions';
import {
  createSafeStorage,
  sanitizePersistedMeta,
  type StorageProblem,
} from './persistence';
import { setSoundEnabled, setSoundVolume } from '../audio/sfx';
import { setHapticsEnabled } from '../audio/haptics';
import { todayISO } from '../utils/seed';
import { formatNumber } from '../utils/format';

export interface Settings {
  soundEnabled: boolean;
  volume: number;
  cardBack: string;
  table: string;
  victoryFx: string;
  /** Recto des cartes. */
  cardFace: string;
  /** Titre honorifique affiche sur l'accueil et les bordereaux. */
  title: string;
  /** Difficulte des nouvelles donnes (pioche, donne et gains). */
  difficulty: DifficultyId;
  reducedMotion: boolean;
  /** Vibrations sur mobile, quand l'appareil le permet. */
  haptics: boolean;
  /** Ne servir que des donnes dont on a prouve qu'elles sont gagnables. */
  guaranteed: boolean;
}

/** Cagnotte du jackpot progressif, partagee par toutes les tables. */
export interface ProgressiveState {
  pot: number;
  wins: number;
}

export interface MissionsState {
  daily: PeriodProgress;
  weekly: PeriodProgress;
}

export interface PerksState {
  /** Semaine (cle ISO) du dernier coffret de rang recupere. */
  lastGift: string | null;
}

export interface TutorialState {
  done: boolean;
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

/** La banque de jetons: ce qu'on peut depenser, et le cumul gagne (rang VIP). */
export interface Wallet {
  balance: number;
  lifetimeEarned: number;
  spent: number;
}

export interface Inventory {
  /** Cosmetiques achetes (les objets gratuits ne sont pas listes). */
  owned: string[];
  consumables: Record<ConsumableId, number>;
}

export interface WheelState {
  lastSpin: string | null;
}

export type NoticeKind = 'achievement' | 'vip' | 'reward' | 'error';

export interface Notice {
  id: number;
  kind: NoticeKind;
  title: string;
  text: string;
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

export type PurchaseResult = 'ok' | 'owned' | 'funds' | 'locked' | 'unknown';

export interface SpinResult {
  index: number;
  /** Recompense reellement versee (jetons multiplies par le rang VIP). */
  reward: WheelReward;
  /** Multiplicateur VIP applique aux jetons (1 si aucun). */
  boost: number;
}

interface MetaState {
  settings: Settings;
  stats: Stats;
  gambling: GamblingRecords;
  daily: DailyProgress;
  achievements: Record<string, number>;
  wallet: Wallet;
  inventory: Inventory;
  wheel: WheelState;
  progressive: ProgressiveState;
  missions: MissionsState;
  perks: PerksState;
  tutorial: TutorialState;
  notices: Notice[];

  updateSettings: (patch: Partial<Settings>) => void;
  recordDeal: () => void;
  resolveGame: (input: GameEndInput) => string[];
  secureBank: (amount: number, runStreak: number) => string[];
  openVault: () => string[];
  unlock: (id: string) => void;

  // Banque et boutique.
  credit: (amount: number) => void;
  spend: (amount: number) => boolean;
  /** Rend une somme depensee (pari retire): ni gain, ni effet sur le rang. */
  refund: (amount: number) => void;
  isOwned: (id: string) => boolean;
  buyCosmetic: (id: string) => PurchaseResult;
  buyConsumable: (id: ConsumableId) => PurchaseResult;
  useConsumable: (id: ConsumableId) => boolean;
  canSpinWheel: () => boolean;
  spinWheel: (roll?: number) => SpinResult | null;

  // Jackpot progressif.
  feedProgressive: (amount: number) => void;
  winProgressive: () => number;

  // Missions et avantages de rang.
  recordMission: (event: MissionEvent) => void;
  claimMission: (scope: MissionScope, id: string) => number;
  canClaimWeeklyGift: () => boolean;
  claimWeeklyGift: () => ConsumableId[];

  completeTutorial: () => void;

  notify: (notice: Omit<Notice, 'id'>) => void;
  consumeNotice: () => void;
  resetProgress: () => void;
}

/**
 * Recompenses en attente: missions terminees non recuperees et coffret de
 * rang disponible. Sert aux pastilles de l'accueil.
 */
export function pendingRewards(state: {
  missions: MissionsState;
  perks: PerksState;
  wallet: Wallet;
}): number {
  let count = 0;
  for (const scope of ['daily', 'weekly'] as const) {
    const period = currentPeriod(state.missions[scope], scope);
    for (const def of activeMissions(scope, period.key)) {
      if (isClaimable(period, def)) count++;
    }
  }
  if (
    weeklyGiftFor(state.wallet.lifetimeEarned).length > 0 &&
    state.perks.lastGift !== periodKey('weekly')
  ) {
    count++;
  }
  return count;
}

/** Periode a jour: une periode echue repart de zero. */
export function currentPeriod(
  period: PeriodProgress | undefined,
  scope: MissionScope,
  date = new Date(),
): PeriodProgress {
  const key = periodKey(scope, date);
  return period && period.key === key ? period : emptyPeriod(scope, date);
}

const initialSettings: Settings = {
  soundEnabled: true,
  volume: 0.6,
  cardBack: DEFAULT_CARD_BACK,
  table: DEFAULT_TABLE,
  victoryFx: DEFAULT_VICTORY_FX,
  cardFace: DEFAULT_CARD_FACE,
  title: DEFAULT_TITLE,
  difficulty: DEFAULT_DIFFICULTY,
  reducedMotion: false,
  haptics: true,
  guaranteed: false,
};

const initialProgressive: ProgressiveState = {
  pot: PROGRESSIVE_SEED,
  wins: 0,
};

function initialMissions(): MissionsState {
  return { daily: emptyPeriod('daily'), weekly: emptyPeriod('weekly') };
}

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

const initialWallet: Wallet = {
  balance: WELCOME_GIFT,
  lifetimeEarned: 0,
  spent: 0,
};

function emptyConsumables(): Record<ConsumableId, number> {
  return Object.fromEntries(CONSUMABLES.map((c) => [c.id, 0])) as Record<
    ConsumableId,
    number
  >;
}

const initialInventory: Inventory = {
  owned: [],
  consumables: emptyConsumables(),
};

const STORAGE_MESSAGES: Record<
  StorageProblem,
  { title: string; text: string }
> = {
  read: {
    title: 'Sauvegarde inaccessible',
    text: 'Le navigateur bloque le stockage local (navigation privée ?). Ta progression ne sera pas conservée.',
  },
  corrupt: {
    title: 'Sauvegarde illisible',
    text: 'Ta sauvegarde était abîmée. Une copie a été mise de côté et le jeu repart d’une progression neuve.',
  },
  write: {
    title: 'Sauvegarde impossible',
    text: 'Le stockage du navigateur est plein ou bloqué: la progression de cette session risque d’être perdue.',
  },
};

/**
 * Previent le joueur d'un souci de sauvegarde. Differe d'un tour de boucle:
 * la lecture a lieu pendant la creation meme du store, avant qu'il existe.
 */
function reportStorageProblem(problem: StorageProblem): void {
  setTimeout(() => {
    useMetaStore
      .getState()
      .notify({ kind: 'error', ...STORAGE_MESSAGES[problem] });
  }, 0);
}

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

let noticeSeq = 1;

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => {
      /** Enregistre des hauts faits et publie un toast pour chaque nouveau. */
      function grant(ids: string[]): string[] {
        const prev = get().achievements;
        const now = Date.now();
        const added = ids.filter((id, i) => !prev[id] && ids.indexOf(id) === i);
        if (added.length === 0) return [];
        const map = { ...prev };
        for (const id of added) map[id] = now;
        set({ achievements: map });
        for (const id of added) {
          const a = ACHIEVEMENT_BY_ID.get(id);
          if (a) {
            get().notify({
              kind: 'achievement',
              title: a.title,
              text: a.description,
            });
          }
        }
        return added;
      }

      return {
        settings: initialSettings,
        stats: initialStats,
        gambling: initialGambling,
        daily: initialDaily,
        achievements: {},
        wallet: initialWallet,
        inventory: initialInventory,
        wheel: { lastSpin: null },
        progressive: initialProgressive,
        missions: initialMissions(),
        perks: { lastGift: null },
        tutorial: { done: false },
        notices: [],

        updateSettings: (patch) => {
          set((state) => {
            const next = { ...state.settings, ...patch };
            const owns = (id: string) => get().isOwned(id);
            if (!isValidCardBack(next.cardBack) || !owns(next.cardBack))
              next.cardBack = state.settings.cardBack;
            if (!isValidTable(next.table) || !owns(next.table))
              next.table = state.settings.table;
            if (!isValidVictoryFx(next.victoryFx) || !owns(next.victoryFx))
              next.victoryFx = state.settings.victoryFx;
            if (!isValidCardFace(next.cardFace) || !owns(next.cardFace))
              next.cardFace = state.settings.cardFace ?? DEFAULT_CARD_FACE;
            if (!isValidTitle(next.title) || !owns(next.title))
              next.title = state.settings.title ?? DEFAULT_TITLE;
            if (!isValidDifficulty(next.difficulty))
              next.difficulty = state.settings.difficulty;
            setSoundEnabled(next.soundEnabled);
            setSoundVolume(next.volume);
            setHapticsEnabled(next.haptics);
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

          set({ stats, daily });
          return grant(
            satisfiedAchievements({
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
            }),
          );
        },

        secureBank: (amount, runStreak) => {
          const prev = get();
          set({
            gambling: {
              ...prev.gambling,
              secured: prev.gambling.secured + amount,
              bestSecuredRun: Math.max(prev.gambling.bestSecuredRun, amount),
              longestStreak: Math.max(prev.gambling.longestStreak, runStreak),
            },
          });
          if (amount > 0) {
            get().credit(amount);
            get().recordMission({ kind: 'secure', amount });
          }
          return grant(
            satisfiedAchievements({
              won: false,
              timeMs: 0,
              drawCount: findDifficulty(prev.settings.difficulty).drawCount,
              invalidMoves: 0,
              undoCount: 0,
              usedHint: false,
              isDaily: false,
              dailyCompletedCount: prev.daily.completedDates.length,
              currentWinStreak: prev.stats.currentWinStreak,
              securedAmount: amount,
              gamblingStreak: runStreak,
              vaultOpened: false,
            }),
          );
        },

        openVault: () => {
          const prev = get();
          set({
            gambling: {
              ...prev.gambling,
              vaultsOpened: prev.gambling.vaultsOpened + 1,
            },
          });
          get().recordMission({ kind: 'vault' });
          return grant(['treasure-hunter']);
        },

        unlock: (id) => {
          grant([id]);
        },

        credit: (amount) => {
          if (amount <= 0) return;
          const prev = get().wallet;
          const before = vipTierFor(prev.lifetimeEarned);
          const wallet = {
            ...prev,
            balance: prev.balance + amount,
            lifetimeEarned: prev.lifetimeEarned + amount,
          };
          set({ wallet });
          const after = vipTierFor(wallet.lifetimeEarned);
          if (after.id !== before.id) {
            get().notify({
              kind: 'vip',
              title: `Rang VIP ${after.label}`,
              text: `Bienvenue au rang ${after.label}: ${Math.round(after.discount * 100)} % de remise en boutique.`,
            });
            if (tierIndex(after.id) >= tierIndex('gold')) grant(['regular']);
          }
        },

        spend: (amount) => {
          const prev = get().wallet;
          if (amount < 0 || prev.balance < amount) return false;
          set({
            wallet: {
              ...prev,
              balance: prev.balance - amount,
              spent: prev.spent + amount,
            },
          });
          return true;
        },

        refund: (amount) => {
          if (!(amount > 0)) return;
          const prev = get().wallet;
          set({
            wallet: {
              ...prev,
              balance: prev.balance + amount,
              spent: Math.max(0, prev.spent - amount),
            },
          });
        },

        isOwned: (id) => {
          const item = findCosmetic(id);
          if (!item) return false;
          return item.price === 0 || get().inventory.owned.includes(id);
        },

        buyCosmetic: (id) => {
          const item = findCosmetic(id);
          if (!item) return 'unknown';
          const state = get();
          if (state.isOwned(id)) return 'owned';
          if (!meetsTier(state.wallet.lifetimeEarned, item.minTier))
            return 'locked';
          const price = discountedPrice(
            item.price,
            state.wallet.lifetimeEarned,
          );
          if (!state.spend(price)) return 'funds';
          set((s) => ({
            inventory: { ...s.inventory, owned: [...s.inventory.owned, id] },
          }));
          const owned = new Set(get().inventory.owned);
          const unlocked = ['collector'];
          if (item.grail) unlocked.push('grail');
          if (COLLECTIBLES.every((c) => owned.has(c.id)))
            unlocked.push('completionist');
          grant(unlocked);
          return 'ok';
        },

        buyConsumable: (id) => {
          const item = findConsumable(id);
          const state = get();
          const price = discountedPrice(
            item.price,
            state.wallet.lifetimeEarned,
          );
          if (!state.spend(price)) return 'funds';
          set((s) => ({
            inventory: {
              ...s.inventory,
              consumables: {
                ...s.inventory.consumables,
                [id]: (s.inventory.consumables[id] ?? 0) + 1,
              },
            },
          }));
          grant(['collector']);
          return 'ok';
        },

        useConsumable: (id) => {
          const count = get().inventory.consumables[id] ?? 0;
          if (count <= 0) return false;
          set((s) => ({
            inventory: {
              ...s.inventory,
              consumables: { ...s.inventory.consumables, [id]: count - 1 },
            },
          }));
          return true;
        },

        canSpinWheel: () => get().wheel.lastSpin !== todayISO(),

        spinWheel: (roll) => {
          if (!get().canSpinWheel()) return null;
          const index = drawWheelSegment(roll);
          const base = WHEEL_SEGMENTS[index].reward;
          // Plus le rang est haut, plus la roue est genereuse en jetons.
          const boost = vipTierFor(get().wallet.lifetimeEarned).wheelBoost;
          const reward: WheelReward =
            base.kind === 'chips'
              ? { kind: 'chips', amount: Math.round(base.amount * boost) }
              : base;
          set({ wheel: { lastSpin: todayISO() } });
          get().recordMission({ kind: 'wheel' });
          if (reward.kind === 'chips') {
            get().credit(reward.amount);
          } else {
            set((s) => ({
              inventory: {
                ...s.inventory,
                consumables: {
                  ...s.inventory.consumables,
                  [reward.item]:
                    (s.inventory.consumables[reward.item] ?? 0) + 1,
                },
              },
            }));
          }
          return { index, reward, boost: reward.kind === 'chips' ? boost : 1 };
        },

        feedProgressive: (amount) => {
          if (!(amount > 0)) return;
          set((s) => ({
            progressive: {
              ...s.progressive,
              pot: s.progressive.pot + Math.round(amount),
            },
          }));
        },

        winProgressive: () => {
          const amount = get().progressive.pot;
          set((s) => ({
            progressive: {
              pot: PROGRESSIVE_SEED,
              wins: s.progressive.wins + 1,
            },
          }));
          get().credit(amount);
          return amount;
        },

        recordMission: (event) => {
          const before = get().missions;
          const next: MissionsState = { ...before };
          const done: string[] = [];
          for (const scope of ['daily', 'weekly'] as const) {
            const period = currentPeriod(before[scope], scope);
            const after = advance(period, scope, event);
            next[scope] = after;
            for (const id of Object.keys(after.progress)) {
              const def = findMission(id);
              if (
                def &&
                isClaimable(after, def) &&
                (period.progress[id] ?? 0) < def.target
              ) {
                done.push(def.label);
              }
            }
          }
          set({ missions: next });
          for (const label of done) {
            get().notify({
              kind: 'reward',
              title: 'Mission accomplie',
              text: `${label}. Récupère ta récompense dans Missions.`,
            });
          }
        },

        claimMission: (scope, id) => {
          const period = currentPeriod(get().missions[scope], scope);
          const def = findMission(id);
          if (!def || def.scope !== scope || !isClaimable(period, def))
            return 0;
          const amount = missionReward(
            def,
            missionBonusFor(get().wallet.lifetimeEarned),
          );
          set((s) => ({
            missions: {
              ...s.missions,
              [scope]: { ...period, claimed: [...period.claimed, id] },
            },
          }));
          get().credit(amount);
          return amount;
        },

        canClaimWeeklyGift: () => {
          const state = get();
          return (
            weeklyGiftFor(state.wallet.lifetimeEarned).length > 0 &&
            state.perks.lastGift !== periodKey('weekly')
          );
        },

        claimWeeklyGift: () => {
          if (!get().canClaimWeeklyGift()) return [];
          const gift = weeklyGiftFor(get().wallet.lifetimeEarned);
          set((s) => {
            const consumables = { ...s.inventory.consumables };
            for (const id of gift) consumables[id] = (consumables[id] ?? 0) + 1;
            return {
              inventory: { ...s.inventory, consumables },
              perks: { lastGift: periodKey('weekly') },
            };
          });
          return gift;
        },

        completeTutorial: () => set({ tutorial: { done: true } }),

        notify: (notice) => {
          set((s) => ({
            notices: [...s.notices, { ...notice, id: noticeSeq++ }],
          }));
        },

        consumeNotice: () => {
          set((state) => ({ notices: state.notices.slice(1) }));
        },

        resetProgress: () => {
          set({
            stats: initialStats,
            gambling: initialGambling,
            daily: initialDaily,
            achievements: {},
            wallet: initialWallet,
            inventory: initialInventory,
            wheel: { lastSpin: null },
            progressive: initialProgressive,
            missions: initialMissions(),
            perks: { lastGift: null },
            notices: [],
            settings: {
              ...get().settings,
              cardBack: DEFAULT_CARD_BACK,
              table: DEFAULT_TABLE,
              victoryFx: DEFAULT_VICTORY_FX,
              cardFace: DEFAULT_CARD_FACE,
              title: DEFAULT_TITLE,
            },
          });
        },
      };
    },
    {
      name: 'jackpot-solitaire-meta-v1',
      version: 4,
      storage: createSafeStorage(reportStorageProblem),
      partialize: (state) => ({
        settings: state.settings,
        stats: state.stats,
        gambling: state.gambling,
        daily: state.daily,
        achievements: state.achievements,
        wallet: state.wallet,
        inventory: state.inventory,
        wheel: state.wheel,
        progressive: state.progressive,
        missions: state.missions,
        perks: state.perks,
        tutorial: state.tutorial,
      }),
      migrate: (persisted, version) => migrateMeta(persisted, version),
      // Une sauvegarde modifiee a la main ou abimee ne doit jamais faire
      // planter le jeu: chaque champ est valide avant d'etre repris.
      merge: (persisted, current) => sanitizePersistedMeta(persisted, current),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setSoundEnabled(state.settings.soundEnabled);
          setSoundVolume(state.settings.volume);
          setHapticsEnabled(state.settings.haptics);
        }
      },
    },
  ),
);

/**
 * Migration des sauvegardes. Version 0 (avant la boutique): la banque
 * securisee n'etait qu'un compteur. Elle devient le solde du portefeuille,
 * augmente du cadeau de bienvenue, et compte pour le rang VIP.
 */
export function migrateMeta(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted;
  const data = persisted as Record<string, unknown>;
  if (version < 1) {
    const gambling = data.gambling as Partial<GamblingRecords> | undefined;
    const secured = Math.max(0, gambling?.secured ?? 0);
    const settings = (data.settings ?? {}) as Partial<Settings>;
    data.wallet = {
      balance: secured + WELCOME_GIFT,
      lifetimeEarned: secured,
      spent: 0,
    } satisfies Wallet;
    data.inventory = {
      owned: [],
      consumables: emptyConsumables(),
    } satisfies Inventory;
    data.wheel = { lastSpin: null } satisfies WheelState;
    data.settings = {
      ...settings,
      victoryFx: settings.victoryFx ?? DEFAULT_VICTORY_FX,
    };
  }
  if (version < 2) {
    // Version 2: recto des cartes et titres honorifiques.
    const settings = (data.settings ?? {}) as Partial<Settings>;
    data.settings = {
      ...settings,
      cardFace: settings.cardFace ?? DEFAULT_CARD_FACE,
      title: settings.title ?? DEFAULT_TITLE,
    };
  }
  if (version < 3) {
    // Version 3: la pioche par defaut devient un niveau de difficulte.
    const settings = (data.settings ?? {}) as Partial<Settings> & {
      defaultDraw?: 1 | 3;
    };
    const { defaultDraw: _defaultDraw, ...rest } = settings;
    data.settings = rest;
  }
  if (version < 4) {
    // Version 4: tout le monde demarre en Normal. La version 3 convertissait
    // l'ancienne pioche 3 en Expert, ce qui laissait les joueurs historiques
    // sur le niveau le plus dur sans l'avoir choisi.
    const settings = (data.settings ?? {}) as Partial<Settings>;
    data.settings = { ...settings, difficulty: DEFAULT_DIFFICULTY };
  }
  return data;
}

/** Libelle court d'une recompense de roue, pour les toasts et l'ecran de gain. */
export function describeReward(reward: WheelReward): string {
  if (reward.kind === 'chips') return `${formatNumber(reward.amount)} jetons`;
  return findConsumable(reward.item).label;
}
