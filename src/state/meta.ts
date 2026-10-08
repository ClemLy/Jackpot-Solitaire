import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_CARD_BACK,
  DEFAULT_CARD_FACE,
  DEFAULT_DIFFICULTY,
  DEFAULT_TABLE,
  DEFAULT_TITLE,
  DEFAULT_VICTORY_FX,
  WELCOME_GIFT,
  findConsumable,
  isValidDifficulty,
  weeklyGiftFor,
  type DifficultyId,
  type WheelReward,
} from './catalog';
import {
  activeMissions,
  isClaimable,
  type MissionScope,
  type PeriodProgress,
} from './missions';
import {
  DEFAULT_AVATAR,
  DEFAULT_FRAME,
  DEFAULT_PROFILE_CARD,
  currentPeriod as periodFor,
  emptyConsumables,
  initialPlayer,
  makeCtx,
  sanitizePlayer,
  type Ctx,
  type Notice as CoreNotice,
  type PlayerState,
} from '../core';
import { createSafeStorage, type StorageProblem } from './persistence';
import { setSoundEnabled, setSoundVolume } from '../audio/sfx';
import { setHapticsEnabled } from '../audio/haptics';
import { formatNumber } from '../utils/format';

export type {
  DailyProgress,
  Equipped,
  GamblingRecords,
  Inventory,
  MissionsState,
  PerksState,
  ProgressiveState,
  Stats,
  Wallet,
  WheelState,
} from '../core';

/** Preferences propres a cet appareil (jamais envoyees au serveur). */
export interface Settings {
  soundEnabled: boolean;
  volume: number;
  /** Difficulte des nouvelles donnes (pioche, donne et gains). */
  difficulty: DifficultyId;
  reducedMotion: boolean;
  /** Vibrations sur mobile, quand l'appareil le permet. */
  haptics: boolean;
  /** Ne servir que des donnes dont on a prouve qu'elles sont gagnables. */
  guaranteed: boolean;
}

export interface TutorialState {
  done: boolean;
}

export type NoticeKind = CoreNotice['kind'];

export interface Notice extends CoreNotice {
  id: number;
}

let randomSource: () => number = () => cryptoRandom();

/** Remplace la source de hasard locale (tests: donnes imposees). */
export function setRandomSource(source: () => number): void {
  randomSource = source;
}

/** Contexte local (joueur invite): heure et calendrier de l'appareil. */
export function localCtx(now = Date.now()): Ctx {
  return makeCtx(now, () => randomSource());
}

/** Hasard cryptographique quand il existe, sinon celui de Math. */
export function cryptoRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x1_0000_0000;
  }
  return Math.random();
}

interface MetaState extends PlayerState {
  settings: Settings;
  tutorial: TutorialState;
  notices: Notice[];
  /**
   * Sauvegarde de l'invite, mise de cote pendant qu'un compte est connecte:
   * elle revient a la deconnexion, intacte.
   */
  guestPlayer: PlayerState | null;
  /** Vrai quand l'etat affiche est celui d'un compte (le serveur fait foi). */
  accountActive: boolean;

  updateSettings: (patch: Partial<Settings>) => void;
  /** Remplace l'etat du joueur (resultat d'une action), et affiche ses messages. */
  applyPlayer: (state: PlayerState, notices?: CoreNotice[]) => void;
  /** Bascule sur l'etat d'un compte, en mettant de cote celui de l'invite. */
  enterAccount: (state: PlayerState) => void;
  /** Revient a la sauvegarde de l'invite. */
  leaveAccount: () => void;
  /** Etat courant du joueur, sans les champs de l'interface. */
  player: () => PlayerState;

  canSpinWheel: () => boolean;
  canClaimWeeklyGift: () => boolean;
  completeTutorial: () => void;

  notify: (notice: CoreNotice) => void;
  consumeNotice: () => void;
  resetProgress: () => void;
}

const initialSettings: Settings = {
  soundEnabled: true,
  volume: 0.6,
  difficulty: DEFAULT_DIFFICULTY,
  reducedMotion: false,
  haptics: true,
  guaranteed: false,
};

const PLAYER_KEYS = [
  'wallet',
  'inventory',
  'stats',
  'gambling',
  'daily',
  'achievements',
  'wheel',
  'progressive',
  'missions',
  'perks',
  'equipped',
  'session',
] as const satisfies readonly (keyof PlayerState)[];

export function pickPlayer(s: PlayerState): PlayerState {
  return Object.fromEntries(
    PLAYER_KEYS.map((k) => [k, s[k]]),
  ) as unknown as PlayerState;
}

/**
 * Recompenses en attente: missions terminees non recuperees et coffret de
 * rang disponible. Sert aux pastilles de l'accueil.
 */
export function pendingRewards(state: PlayerState): number {
  const ctx = localCtx();
  let count = 0;
  for (const scope of ['daily', 'weekly'] as const) {
    const period = periodFor(
      state.missions[scope],
      scope === 'daily' ? ctx.today : ctx.week,
    );
    for (const def of activeMissions(scope, period.key)) {
      if (isClaimable(period, def)) count++;
    }
  }
  if (
    weeklyGiftFor(state.wallet.lifetimeEarned).length > 0 &&
    state.perks.lastGift !== ctx.week
  ) {
    count++;
  }
  return count;
}

/** Periode de missions a jour, d'apres le calendrier de l'appareil. */
export function currentPeriod(
  period: PeriodProgress | undefined,
  scope: MissionScope,
  date = new Date(),
): PeriodProgress {
  const ctx = localCtx(date.getTime());
  return periodFor(period, scope === 'daily' ? ctx.today : ctx.week);
}

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

let noticeSeq = 1;

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      ...initialPlayer(localCtx()),
      settings: initialSettings,
      tutorial: { done: false },
      notices: [],
      guestPlayer: null,
      accountActive: false,

      updateSettings: (patch) => {
        set((state) => {
          const next = { ...state.settings, ...patch };
          if (!isValidDifficulty(next.difficulty)) {
            next.difficulty = state.settings.difficulty;
          }
          setSoundEnabled(next.soundEnabled);
          setSoundVolume(next.volume);
          setHapticsEnabled(next.haptics);
          return { settings: next };
        });
      },

      applyPlayer: (state, notices = []) => {
        set(pickPlayer(state));
        for (const n of notices) get().notify(n);
      },

      enterAccount: (state) => {
        const current = get();
        set({
          ...pickPlayer(state),
          guestPlayer: current.accountActive
            ? current.guestPlayer
            : pickPlayer(current),
          accountActive: true,
        });
      },

      leaveAccount: () => {
        const current = get();
        if (!current.accountActive) return;
        set({
          ...(current.guestPlayer ?? initialPlayer(localCtx())),
          guestPlayer: null,
          accountActive: false,
        });
      },

      player: () => pickPlayer(get()),

      canSpinWheel: () => get().wheel.lastSpin !== localCtx().today,

      canClaimWeeklyGift: () => {
        const s = get();
        return (
          weeklyGiftFor(s.wallet.lifetimeEarned).length > 0 &&
          s.perks.lastGift !== localCtx().week
        );
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

      // Remise a zero de la progression d'invite (un compte, lui, se supprime).
      resetProgress: () => {
        if (get().accountActive) return;
        set({ ...initialPlayer(localCtx()), notices: [] });
      },
    }),
    {
      name: 'jackpot-solitaire-meta-v1',
      version: 5,
      storage: createSafeStorage(reportStorageProblem),
      // On ne sauvegarde jamais l'etat d'un compte en local: seule la
      // progression d'invite vit dans le navigateur.
      partialize: (state) => ({
        player: state.accountActive ? state.guestPlayer : pickPlayer(state),
        settings: state.settings,
        tutorial: state.tutorial,
      }),
      migrate: (persisted, version) => migrateMeta(persisted, version),
      // Une sauvegarde modifiee a la main ou abimee ne doit jamais faire
      // planter le jeu: chaque champ est valide avant d'etre repris.
      merge: (persisted, current) => mergePersisted(persisted, current),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reprend une sauvegarde locale validee dans l'etat courant. */
export function mergePersisted(
  persisted: unknown,
  current: MetaState,
): MetaState {
  if (!isRecord(persisted)) return current;
  const player = sanitizePlayer(persisted.player, pickPlayer(current));
  // Une manche restee ouverte a la fermeture de l'onglet ne se reprend pas:
  // elle sera comptee comme abandonnee a la prochaine donne.
  const s = isRecord(persisted.settings) ? persisted.settings : {};
  const cs = current.settings;
  const volume =
    typeof s.volume === 'number' && Number.isFinite(s.volume)
      ? Math.min(1, Math.max(0, s.volume))
      : cs.volume;
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === 'boolean' ? v : fallback;
  const settings: Settings = {
    soundEnabled: bool(s.soundEnabled, cs.soundEnabled),
    volume,
    difficulty: isValidDifficulty(s.difficulty) ? s.difficulty : cs.difficulty,
    reducedMotion: bool(s.reducedMotion, cs.reducedMotion),
    haptics: bool(s.haptics, cs.haptics),
    guaranteed: bool(s.guaranteed, cs.guaranteed),
  };
  const t = isRecord(persisted.tutorial) ? persisted.tutorial : {};
  return {
    ...current,
    ...player,
    settings,
    tutorial: { done: bool(t.done, current.tutorial.done) },
  };
}

/**
 * Migration des sauvegardes.
 * - v1: la banque securisee devient le solde, plus le cadeau de bienvenue.
 * - v2: recto des cartes et titres.
 * - v3: la pioche par defaut devient une difficulte.
 * - v4: tout le monde demarre en Normal.
 * - v5: l'etat du joueur forme un seul bloc (celui que garde le serveur
 *   pour un compte); les objets equipes quittent les reglages de l'appareil.
 */
export function migrateMeta(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted;
  const data = persisted as Record<string, unknown>;
  if (version < 1) {
    const gambling = data.gambling as { secured?: number } | undefined;
    const secured = Math.max(0, gambling?.secured ?? 0);
    const settings = (data.settings ?? {}) as Record<string, unknown>;
    data.wallet = {
      balance: secured + WELCOME_GIFT,
      lifetimeEarned: secured,
      spent: 0,
    };
    data.inventory = { owned: [], consumables: emptyConsumables() };
    data.wheel = { lastSpin: null };
    data.settings = {
      ...settings,
      victoryFx: settings.victoryFx ?? DEFAULT_VICTORY_FX,
    };
  }
  if (version < 2) {
    const settings = (data.settings ?? {}) as Record<string, unknown>;
    data.settings = {
      ...settings,
      cardFace: settings.cardFace ?? DEFAULT_CARD_FACE,
      title: settings.title ?? DEFAULT_TITLE,
    };
  }
  if (version < 3) {
    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const { defaultDraw: _defaultDraw, ...rest } = settings;
    data.settings = rest;
  }
  if (version < 4) {
    const settings = (data.settings ?? {}) as Record<string, unknown>;
    data.settings = { ...settings, difficulty: DEFAULT_DIFFICULTY };
  }
  if (version < 5) {
    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const pick = (key: string, fallback: string) =>
      typeof settings[key] === 'string' ? (settings[key] as string) : fallback;
    data.player = {
      wallet: data.wallet,
      inventory: data.inventory,
      stats: data.stats,
      gambling: data.gambling,
      daily: data.daily,
      achievements: data.achievements,
      wheel: data.wheel,
      progressive: data.progressive,
      missions: data.missions,
      perks: data.perks,
      equipped: {
        cardBack: pick('cardBack', DEFAULT_CARD_BACK),
        cardFace: pick('cardFace', DEFAULT_CARD_FACE),
        table: pick('table', DEFAULT_TABLE),
        victoryFx: pick('victoryFx', DEFAULT_VICTORY_FX),
        title: pick('title', DEFAULT_TITLE),
        avatar: DEFAULT_AVATAR,
        frame: DEFAULT_FRAME,
        profileCard: DEFAULT_PROFILE_CARD,
      },
    };
    for (const key of [
      'wallet',
      'inventory',
      'stats',
      'gambling',
      'daily',
      'achievements',
      'wheel',
      'progressive',
      'missions',
      'perks',
    ]) {
      delete data[key];
    }
    for (const key of ['cardBack', 'cardFace', 'table', 'victoryFx', 'title']) {
      delete settings[key];
    }
    data.settings = settings;
  }
  return data;
}

/** Libelle court d'une recompense de roue, pour les toasts et l'ecran de gain. */
export function describeReward(reward: WheelReward): string {
  if (reward.kind === 'chips') return `${formatNumber(reward.amount)} jetons`;
  return findConsumable(reward.item).label;
}
