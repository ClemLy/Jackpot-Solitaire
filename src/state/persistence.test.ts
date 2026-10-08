import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSafeStorage, sanitizePersistedMeta } from './persistence';
import { useMetaStore } from './meta';

const KEY = 'jackpot-solitaire-meta-v1';

/** Etat courant du store, tel qu'il sert de valeur de repli. */
function defaults() {
  return useMetaStore.getState();
}

describe('stockage fiable', () => {
  beforeEach(() => localStorage.clear());

  it('lit et ecrit une sauvegarde normale', () => {
    const report = vi.fn();
    const storage = createSafeStorage<{ a: number }>(report);
    storage.setItem('k', { state: { a: 1 }, version: 3 });
    expect(storage.getItem('k')).toEqual({ state: { a: 1 }, version: 3 });
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });

  it('met de cote une sauvegarde illisible au lieu de planter', () => {
    const report = vi.fn();
    localStorage.setItem('k', '{pas du json');
    const storage = createSafeStorage(report);
    expect(storage.getItem('k')).toBeNull();
    expect(localStorage.getItem('k-illisible')).toBe('{pas du json');
    expect(report).toHaveBeenCalledWith('corrupt');
  });

  it('refuse un JSON valide mais sans etat', () => {
    const report = vi.fn();
    localStorage.setItem('k', '[1,2,3]');
    expect(createSafeStorage(report).getItem('k')).toBeNull();
    localStorage.setItem('k', '"texte"');
    expect(createSafeStorage(report).getItem('k')).toBeNull();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('survit a un stockage inaccessible ou plein', () => {
    const report = vi.fn();
    const broken = {
      getItem: () => {
        throw new DOMException('refuse', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('plein', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('non');
      },
    } as unknown as Storage;
    const storage = createSafeStorage(report, () => broken);
    expect(storage.getItem('k')).toBeNull();
    expect(() => storage.setItem('k', { state: {} })).not.toThrow();
    expect(() => storage.setItem('k', { state: {} })).not.toThrow();
    expect(() => storage.removeItem('k')).not.toThrow();
    // Un seul avertissement par type de souci.
    expect(report.mock.calls).toEqual([['read'], ['write']]);
  });
});

describe('validation de la sauvegarde', () => {
  it('ignore une sauvegarde qui n est pas un objet', () => {
    const current = defaults();
    expect(sanitizePersistedMeta(null, current)).toBe(current);
    expect(sanitizePersistedMeta('x', current)).toBe(current);
    expect(sanitizePersistedMeta([1], current)).toBe(current);
  });

  it('borne les soldes et compteurs bricoles', () => {
    const out = sanitizePersistedMeta(
      {
        wallet: { balance: -500, lifetimeEarned: 'beaucoup', spent: Infinity },
        stats: {
          gamesPlayed: 10,
          gamesWon: 99,
          bestTimeMs: -3,
          bestScore: NaN,
        },
        gambling: { secured: Number.POSITIVE_INFINITY, vaultsOpened: 2.7 },
      },
      defaults(),
    );
    expect(out.wallet.balance).toBe(0);
    expect(out.wallet.lifetimeEarned).toBe(defaults().wallet.lifetimeEarned);
    expect(out.wallet.spent).toBe(defaults().wallet.spent);
    expect(out.stats.gamesWon).toBe(10);
    expect(out.stats.bestTimeMs).toBe(defaults().stats.bestTimeMs);
    expect(out.stats.bestScore).toBe(defaults().stats.bestScore);
    expect(out.gambling.secured).toBe(defaults().gambling.secured);
    expect(out.gambling.vaultsOpened).toBe(2);
  });

  it('remplace les reglages inconnus par les valeurs courantes', () => {
    const out = sanitizePersistedMeta(
      {
        settings: {
          cardBack: 'inexistant',
          table: 42,
          difficulty: 'impossible',
          volume: 7,
          soundEnabled: 'oui',
          title: 'rookie',
        },
      },
      defaults(),
    );
    const d = defaults().settings;
    expect(out.settings.cardBack).toBe(d.cardBack);
    expect(out.settings.table).toBe(d.table);
    expect(out.settings.difficulty).toBe(d.difficulty);
    expect(out.settings.volume).toBe(1);
    expect(out.settings.soundEnabled).toBe(d.soundEnabled);
    expect(out.settings.title).toBe('rookie');
  });

  it('filtre inventaire, hauts faits et dates', () => {
    const out = sanitizePersistedMeta(
      {
        inventory: {
          owned: ['foil', 'foil', 'objet-pirate', 12, '__proto__'],
          consumables: { hint: 3, insurance: -2, redeal: 'x', bombe: 9 },
        },
        achievements: {
          'first-win': 1700000000000,
          'faux-succes': 1,
          __proto__: 5,
        },
        daily: { completedDates: ['2026-10-01', 'hier', 3], lastPlayed: '<b>' },
        wheel: { lastSpin: { evil: true } },
      },
      defaults(),
    );
    expect(out.inventory.owned).toEqual(['foil']);
    expect(out.inventory.consumables).toEqual({
      insurance: 0,
      hint: 3,
      redeal: 0,
    });
    expect(Object.keys(out.achievements)).toEqual(['first-win']);
    expect(out.daily).toEqual({
      completedDates: ['2026-10-01'],
      lastPlayed: null,
    });
    expect(out.wheel.lastSpin).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('rechargement du store', () => {
  afterEach(() => localStorage.clear());

  it('recharge une sauvegarde corrompue sans planter et previent le joueur', async () => {
    // Vider les notifications reecrit la sauvegarde: on la corrompt apres.
    useMetaStore.setState({ notices: [] });
    localStorage.setItem(KEY, '{"state": {"wallet": ');
    await useMetaStore.persist.rehydrate();
    // L'avertissement est differe d'un tour de boucle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const notices = useMetaStore.getState().notices;
    expect(notices.some((n) => n.kind === 'error')).toBe(true);
    expect(localStorage.getItem(`${KEY}-illisible`)).toContain('wallet');
  });

  it('recharge une sauvegarde piegee avec des valeurs saines', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: {
          wallet: {
            balance: -1,
            lifetimeEarned: Number.MAX_VALUE * 10,
            spent: 0,
          },
          inventory: null,
          settings: { difficulty: 'easy', volume: -4 },
        },
        version: 3,
      }),
    );
    await useMetaStore.persist.rehydrate();
    const state = useMetaStore.getState();
    expect(state.wallet.balance).toBe(0);
    expect(Number.isFinite(state.wallet.lifetimeEarned)).toBe(true);
    expect(Array.isArray(state.inventory.owned)).toBe(true);
    expect(state.inventory.consumables.hint).toBeGreaterThanOrEqual(0);
    expect(state.settings.difficulty).toBe('easy');
    expect(state.settings.volume).toBe(0);
  });
});
