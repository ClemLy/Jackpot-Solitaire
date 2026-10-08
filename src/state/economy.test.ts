import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COSMETICS,
  WELCOME_GIFT,
  WHEEL_SEGMENTS,
  discountedPrice,
  drawWheelSegment,
  meetsTier,
  nextVipTier,
  tipForWin,
  vipProgress,
  vipTierFor,
} from './catalog';
import { mergePersisted, migrateMeta, pickPlayer, useMetaStore } from './meta';
import { economy, perform } from './economy';
import { useAccountStore } from './account';
import * as account from './account';

const meta = () => useMetaStore.getState();

function resetStores(balance = 0, lifetimeEarned = 0): void {
  meta().leaveAccount();
  meta().resetProgress();
  useMetaStore.setState({
    wallet: { balance, lifetimeEarned, spent: 0 },
    notices: [],
  });
  meta().updateSettings({ soundEnabled: false });
}

describe('rangs VIP', () => {
  it('attribue le bon rang selon le cumul gagne', () => {
    expect(vipTierFor(0).id).toBe('bronze');
    expect(vipTierFor(4999).id).toBe('bronze');
    expect(vipTierFor(5000).id).toBe('silver');
    expect(vipTierFor(20000).id).toBe('gold');
    expect(vipTierFor(1_000_000).id).toBe('diamond');
  });

  it('calcule la progression et le rang suivant', () => {
    expect(nextVipTier(0)?.id).toBe('silver');
    expect(nextVipTier(200000)).toBeNull();
    expect(vipProgress(2500)).toBeCloseTo(0.5);
    expect(vipProgress(200000)).toBe(1);
  });

  it('verifie les rangs requis', () => {
    expect(meetsTier(0)).toBe(true);
    expect(meetsTier(0, 'silver')).toBe(false);
    expect(meetsTier(25000, 'silver')).toBe(true);
  });

  it('applique la remise du rang, arrondie a la dizaine', () => {
    expect(discountedPrice(3000, 0)).toBe(3000);
    expect(discountedPrice(3000, 5000)).toBe(2850);
    expect(discountedPrice(1500, 20000)).toBe(1350);
    expect(discountedPrice(0, 200000)).toBe(0);
  });
});

describe('recompenses', () => {
  it('verse un pourboire hors Jackpot uniquement', () => {
    expect(tipForWin('classic', 1300)).toBe(130);
    expect(tipForWin('gambling', 1300)).toBe(0);
    expect(tipForWin('zen', 0)).toBe(50);
    expect(tipForWin('chrono', -40)).toBe(0);
  });

  it('pondere le pourboire par la difficulte', () => {
    expect(tipForWin('classic', 1300, 0.5)).toBe(65);
    expect(tipForWin('classic', 1300, 3)).toBe(390);
    expect(tipForWin('zen', 0, 1.5)).toBe(75);
  });

  it('tire la roue selon les poids, bornes comprises', () => {
    expect(drawWheelSegment(0)).toBe(0);
    expect(drawWheelSegment(0.999999)).toBe(WHEEL_SEGMENTS.length - 1);
    const counts = new Array(WHEEL_SEGMENTS.length).fill(0);
    for (let i = 0; i < 1000; i++) counts[drawWheelSegment(i / 1000)] += 1;
    const total = WHEEL_SEGMENTS.reduce((s, x) => s + x.weight, 0);
    WHEEL_SEGMENTS.forEach((seg, i) => {
      expect(counts[i] / 1000).toBeCloseTo(seg.weight / total, 1);
    });
  });
});

describe('migration des sauvegardes', () => {
  it('transforme une vieille banque securisee en solde, plus le cadeau', () => {
    const v0 = migrateMeta(
      {
        settings: { cardBack: 'modern', table: 'neon' },
        gambling: { secured: 12480 },
      },
      0,
    ) as { player: Record<string, unknown>; settings: Record<string, unknown> };
    expect(v0.player.wallet).toEqual({
      balance: 12480 + WELCOME_GIFT,
      lifetimeEarned: 12480,
      spent: 0,
    });
    expect(v0.player.equipped).toMatchObject({
      cardBack: 'modern',
      table: 'neon',
      victoryFx: 'bounce',
      avatar: 'croupier',
    });
    expect(v0.settings).not.toHaveProperty('cardBack');
  });

  it('regroupe une sauvegarde v4 en un etat de joueur', () => {
    const v4 = {
      settings: {
        soundEnabled: false,
        difficulty: 'hard',
        cardBack: 'foil',
        title: 'rookie',
      },
      wallet: { balance: 4321, lifetimeEarned: 9000, spent: 10 },
      stats: { gamesPlayed: 12, gamesWon: 5 },
      inventory: { owned: ['foil'], consumables: { hint: 2 } },
      tutorial: { done: true },
    };
    const out = migrateMeta(structuredClone(v4), 4) as Record<string, unknown>;
    const merged = mergePersisted(out, meta());
    expect(merged.wallet.balance).toBe(4321);
    expect(merged.stats.gamesWon).toBe(5);
    expect(merged.equipped.cardBack).toBe('foil');
    expect(merged.inventory.consumables.hint).toBe(2);
    expect(merged.settings.difficulty).toBe('hard');
    expect(merged.settings.soundEnabled).toBe(false);
    expect(merged.tutorial.done).toBe(true);
  });

  it('ignore une sauvegarde v5 bricolee', () => {
    const merged = mergePersisted(
      {
        player: {
          wallet: { balance: -50, lifetimeEarned: 'x', spent: 0 },
          equipped: { avatar: 'nabab', frame: 'cadre-rang-diamond' },
        },
        settings: { volume: 9, difficulty: 'triche' },
      },
      meta(),
    );
    expect(merged.wallet.balance).toBe(0);
    expect(merged.equipped.avatar).toBe('croupier');
    expect(merged.equipped.frame).toBe('cadre-simple');
    expect(merged.settings.volume).toBe(1);
    expect(merged.settings.difficulty).toBe('normal');
  });
});

describe('passerelle de l economie', () => {
  beforeEach(() => resetStores(5000));

  it('execute le coeur sur place pour un invite', async () => {
    await perform({ type: 'buyConsumable', id: 'joker' });
    expect(meta().inventory.consumables.joker).toBe(1);
    expect(meta().wallet.balance).toBe(5000 - 900);
  });

  it('rend un refus lisible', async () => {
    resetStores(0);
    await expect(economy.buyConsumable('joker')).rejects.toThrow(
      'Pas assez de jetons.',
    );
  });

  it('envoie l action au serveur pour un compte, qui fait foi', async () => {
    const serverState = {
      ...pickPlayer(meta()),
      wallet: { balance: 777, lifetimeEarned: 0, spent: 0 },
    };
    const api = vi.spyOn(account, 'api').mockResolvedValue({
      state: serverState,
      notices: [{ kind: 'reward', title: 'Serveur', text: 'ok' }],
      result: { id: 'joker' },
    });
    meta().enterAccount(pickPlayer(meta()));
    useAccountStore.setState({ status: 'online', pseudo: 'Testeur' });
    await economy.buyConsumable('joker');
    expect(api).toHaveBeenCalledWith({
      op: 'act',
      action: { type: 'buyConsumable', id: 'joker' },
    });
    expect(meta().wallet.balance).toBe(777);
    expect(meta().notices[meta().notices.length - 1]?.title).toBe('Serveur');
    api.mockRestore();
    useAccountStore.setState({ status: 'guest', pseudo: null });
  });

  it('met la sauvegarde d invite de cote pendant un compte', () => {
    resetStores(1234);
    meta().enterAccount({
      ...pickPlayer(meta()),
      wallet: { balance: 99, lifetimeEarned: 0, spent: 0 },
    });
    expect(meta().wallet.balance).toBe(99);
    // Le stockage local ne recoit jamais l'etat du compte.
    meta().updateSettings({ volume: 0.3 });
    const saved = JSON.parse(
      localStorage.getItem('jackpot-solitaire-meta-v1') ?? '{}',
    );
    expect(saved.state.player.wallet.balance).toBe(1234);
    meta().leaveAccount();
    expect(meta().wallet.balance).toBe(1234);
  });
});

describe('boutique', () => {
  beforeEach(() => resetStores(0));

  it('donne a chaque objet un identifiant unique, toutes categories confondues', () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuse un achat sans fonds puis l accepte et l equipe', async () => {
    await expect(economy.buyCosmetic('emerald')).rejects.toThrow();
    resetStores(5000);
    await economy.buyCosmetic('emerald');
    expect(meta().inventory.owned).toContain('emerald');
    expect(meta().equipped.cardBack).toBe('emerald');
  });

  it('bloque un objet reserve a un rang superieur', async () => {
    resetStores(1_000_000, 0);
    await expect(economy.buyCosmetic('nabab')).rejects.toThrow(/rang/);
  });

  it('offre les cadres de rang une fois le rang atteint', async () => {
    await expect(economy.equip('frame', 'cadre-rang-gold')).rejects.toThrow();
    resetStores(0, 25_000);
    await economy.equip('frame', 'cadre-rang-gold');
    expect(meta().equipped.frame).toBe('cadre-rang-gold');
  });

  it('decerne le Graal a l achat d une piece maitresse', async () => {
    resetStores(2_000_000, 200_000);
    await economy.buyCosmetic('nabab');
    expect(meta().achievements.grail).toBeGreaterThan(0);
  });

  it('multiplie les jetons de la roue selon le rang', async () => {
    resetStores(0, 200_000);
    const spin = await economy.spin();
    if (spin.reward.kind === 'chips') expect(spin.boost).toBe(3);
    await expect(economy.spin()).rejects.toThrow(/aujourd/);
  });
});
