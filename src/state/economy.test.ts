import { beforeEach, describe, expect, it } from 'vitest';
import {
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
import { migrateMeta, useMetaStore } from './meta';
import { useGameStore } from './game';

function resetStores(balance = 0): void {
  useMetaStore.getState().resetProgress();
  useMetaStore.setState({
    wallet: { balance, lifetimeEarned: 0, spent: 0 },
    notices: [],
  });
  useMetaStore.getState().updateSettings({ soundEnabled: false });
  useGameStore.setState({ pot: 0, combo: 0, insured: false, mode: 'classic' });
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
  it('transforme la banque securisee en solde, plus le cadeau', () => {
    const out = migrateMeta(
      {
        settings: { cardBack: 'modern', table: 'neon' },
        gambling: { secured: 12480 },
      },
      0,
    ) as Record<string, unknown>;
    expect(out.wallet).toEqual({
      balance: 12480 + WELCOME_GIFT,
      lifetimeEarned: 12480,
      spent: 0,
    });
    expect(out.settings).toMatchObject({
      cardBack: 'modern',
      table: 'neon',
      victoryFx: 'bounce',
    });
    expect(out.inventory).toMatchObject({ owned: [] });
  });

  it('ne touche pas une sauvegarde deja a jour', () => {
    const data = { wallet: { balance: 5, lifetimeEarned: 5, spent: 0 } };
    expect(migrateMeta(data, 1)).toEqual(data);
  });
});

describe('boutique', () => {
  beforeEach(() => resetStores());

  it('refuse un achat sans fonds puis l accepte une fois credite', () => {
    const meta = useMetaStore.getState();
    expect(meta.buyCosmetic('burgundy')).toBe('funds');
    meta.credit(3000);
    expect(useMetaStore.getState().buyCosmetic('burgundy')).toBe('ok');
    expect(useMetaStore.getState().wallet.balance).toBe(0);
    expect(useMetaStore.getState().isOwned('burgundy')).toBe(true);
    expect(useMetaStore.getState().buyCosmetic('burgundy')).toBe('owned');
  });

  it('bloque un objet reserve a un rang superieur', () => {
    useMetaStore.setState({
      wallet: { balance: 50000, lifetimeEarned: 0, spent: 0 },
    });
    expect(useMetaStore.getState().buyCosmetic('salon')).toBe('locked');
  });

  it('refuse d equiper un objet non possede', () => {
    useMetaStore.getState().updateSettings({ table: 'marble' });
    expect(useMetaStore.getState().settings.table).not.toBe('marble');
    useMetaStore.getState().updateSettings({ table: 'neon' });
    expect(useMetaStore.getState().settings.table).toBe('neon');
  });

  it('annonce la montee de rang', () => {
    useMetaStore.getState().credit(5000);
    const notices = useMetaStore.getState().notices;
    expect(notices.some((n) => n.kind === 'vip')).toBe(true);
  });
});

describe('mode Jackpot et banque', () => {
  beforeEach(() => resetStores(1000));

  it('preleve la mise de la table et la place dans le magot', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'silver' });
    expect(useGameStore.getState().pot).toBe(500);
    expect(useGameStore.getState().stakeTable).toBe('silver');
    expect(useMetaStore.getState().wallet.balance).toBe(500);
  });

  it('se rabat sur la table libre si la mise est trop chere', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'gold' });
    expect(useGameStore.getState().stakeTable).toBe('free');
    expect(useGameStore.getState().pot).toBe(0);
    expect(useMetaStore.getState().wallet.balance).toBe(1000);
  });

  it('rend la moitie du magot assure en cas d abandon', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'free' });
    useGameStore.setState({ pot: 4000, combo: 2, insured: true });
    useGameStore.getState().goHome();
    expect(useGameStore.getState().pot).toBe(0);
    expect(useMetaStore.getState().wallet.balance).toBe(1000 + 2000);
  });

  it('verse le magot encaisse dans la banque', () => {
    useGameStore.getState().newGame({ mode: 'gambling', table: 'free' });
    useGameStore.setState({ pot: 2500, combo: 1 });
    useGameStore.getState().cashOut();
    const wallet = useMetaStore.getState().wallet;
    expect(wallet.balance).toBe(3500);
    expect(wallet.lifetimeEarned).toBe(2500);
  });
});
