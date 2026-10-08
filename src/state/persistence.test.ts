import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSafeStorage } from './persistence';
import { pickPlayer, useMetaStore } from './meta';
import { sanitizePlayer } from '../core';

const KEY = 'jackpot-solitaire-meta-v1';

/** Etat courant du store, tel qu'il sert de valeur de repli. */
function defaults() {
  return pickPlayer(useMetaStore.getState());
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

describe('validation de l etat du joueur', () => {
  it('ignore un etat qui n est pas un objet', () => {
    const current = defaults();
    expect(sanitizePlayer(null, current)).toBe(current);
    expect(sanitizePlayer('x', current)).toBe(current);
    expect(sanitizePlayer([1], current)).toBe(current);
  });

  it('borne les soldes et compteurs bricoles', () => {
    const out = sanitizePlayer(
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

  it('n equipe que des objets possedes, dans le bon emplacement', () => {
    const out = sanitizePlayer(
      {
        inventory: { owned: ['foil'] },
        equipped: {
          cardBack: 'foil',
          table: 'inexistant',
          avatar: 'nabab',
          title: 'foil',
        },
      },
      defaults(),
    );
    expect(out.equipped.cardBack).toBe('foil');
    expect(out.equipped.table).toBe(defaults().equipped.table);
    expect(out.equipped.avatar).toBe(defaults().equipped.avatar);
    expect(out.equipped.title).toBe(defaults().equipped.title);
  });

  it('filtre inventaire, hauts faits et dates', () => {
    const out = sanitizePlayer(
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
      peek: 0,
      reshuffle: 0,
      joker: 0,
    });
    expect(Object.keys(out.achievements)).toEqual(['first-win']);
    expect(out.daily).toEqual({
      completedDates: ['2026-10-01'],
      lastPlayed: null,
    });
    expect(out.wheel.lastSpin).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('assainit cagnotte, missions, coffret et session', () => {
    const out = sanitizePlayer(
      {
        progressive: { pot: -50, wins: 'beaucoup' },
        missions: {
          daily: {
            key: '2026-10-08',
            progress: { 'd-win-2': 1, 'mission-pirate': 99, 'd-cards': -4 },
            claimed: ['d-win-2', 'd-win-2', 'faux'],
          },
          weekly: { key: '<script>', progress: {}, claimed: [] },
        },
        perks: { lastGift: 'demain' },
        session: {
          pot: -9,
          awaiting: 'jackpot',
          nonce: '<img>',
          round: { id: 'x', mode: 'sudo' },
        },
      },
      defaults(),
    );
    expect(out.progressive.pot).toBeGreaterThanOrEqual(
      defaults().progressive.pot,
    );
    expect(out.missions.daily).toEqual({
      key: '2026-10-08',
      progress: { 'd-win-2': 1, 'd-cards': 0 },
      claimed: ['d-win-2'],
    });
    expect(out.missions.weekly).toEqual(defaults().missions.weekly);
    expect(out.perks.lastGift).toBeNull();
    expect(out.session.pot).toBe(0);
    expect(out.session.awaiting).toBe('none');
    expect(out.session.nonce).toBe(defaults().session.nonce);
    expect(out.session.round).toBeNull();
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
        version: 4,
        // Version 4: la migration regroupe d'abord l'etat du joueur.
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
