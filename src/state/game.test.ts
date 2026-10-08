// Parcours complets du store de partie, en mode invite. Chaque victoire est
// une vraie partie: le solveur joue la donne coup par coup, et le coeur du
// jeu rejoue le journal avant de payer quoi que ce soit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findSolution } from '../engine';
import {
  CHRONO_LIMIT_MS,
  VEGAS_STAKE,
  sideBetStake,
  vegasCardValue,
} from './catalog';
import { useGameStore } from './game';
import { useMetaStore } from './meta';
import { resetDealer } from './dealer';
import { TUTORIAL_SEED } from '../core';
import {
  nextDealWinnable,
  nextVegasDeadEnd,
  playSolution,
  settle,
  winRound,
  winnableSeed,
} from '../test/play';

const meta = () => useMetaStore.getState();
const game = () => useGameStore.getState();
const balance = () => meta().wallet.balance;

function give(
  id: 'hint' | 'peek' | 'reshuffle' | 'joker' | 'insurance' | 'redeal',
  n: number,
) {
  useMetaStore.setState((s) => ({
    inventory: {
      ...s.inventory,
      consumables: { ...s.inventory.consumables, [id]: n },
    },
  }));
}

const errors = () => meta().notices.filter((n) => n.kind === 'error');

beforeEach(() => {
  localStorage.clear();
  resetDealer();
  meta().leaveAccount();
  meta().resetProgress();
  useMetaStore.setState({
    wallet: { balance: 100_000, lifetimeEarned: 0, spent: 0 },
    notices: [],
  });
  meta().updateSettings({ soundEnabled: false, guaranteed: false });
  useGameStore.setState({
    route: 'home',
    phase: 'idle',
    mode: 'classic',
    round: null,
    modal: 'none',
    overlay: 'none',
    busy: false,
    preparing: false,
    settling: false,
    pendingAction: null,
  });
});

afterEach(() => vi.useRealTimers());

describe('partie classique', () => {
  it('paie une vraie victoire, rejouee par le coeur', async () => {
    nextDealWinnable('normal');
    await game().newGame({ mode: 'classic', difficulty: 'normal' });
    expect(game().phase).toBe('playing');
    expect(game().round?.seedSource).toBe('random');
    await winRound();
    const { win, overlay } = game();
    expect(overlay).toBe('win');
    expect(win!.tip).toBe(Math.round(win!.roundScore * 0.1));
    expect(balance()).toBe(100_000 + win!.tip);
    expect(meta().stats.gamesWon).toBe(1);
    expect(errors()).toEqual([]);
  });

  it('pondere le pourboire par la difficulte', async () => {
    nextDealWinnable('hard');
    await game().newGame({ mode: 'classic', difficulty: 'hard' });
    await winRound();
    const win = game().win!;
    expect(win.difficultyMultiplier).toBe(1.5);
    expect(win.tip).toBe(Math.round(win.roundScore * 0.1 * 1.5));
  });

  it('ne paie rien sur une graine imposee', async () => {
    await game().newGame({ mode: 'classic', seed: winnableSeed('normal') });
    expect(game().unpaid).toBe(true);
    await winRound();
    expect(game().win!.unpaid).toBe(true);
    expect(game().win!.tip).toBe(0);
    expect(balance()).toBe(100_000);
  });

  it('impose la graine du jour au defi', async () => {
    await game().newGame({ mode: 'daily', seed: 'triche' });
    expect(game().seed).toMatch(/^defi-\d{4}-\d{2}-\d{2}$/);
  });

  it('annuler restaure le plateau, et le journal reste valide', async () => {
    await game().newGame({ mode: 'classic', seed: 'annuler' });
    const before = game().board;
    game().clickStock();
    game().undo();
    expect(game().board).toEqual(before);
    expect(game().score).toBe(-15);
    await game().goHome();
    expect(errors()).toEqual([]);
  });

  it('l oeil du croupier offre l indice, sinon il coute 25 points', async () => {
    give('hint', 1);
    await game().newGame({ mode: 'classic', seed: 'indice' });
    game().requestHint();
    expect(game().freeHint).toBe(true);
    expect(game().score).toBe(0);
    game().requestHint();
    expect(game().score).toBe(-25);
    await game().goHome();
    expect(meta().inventory.consumables.hint).toBe(0);
    expect(errors()).toEqual([]);
  });

  it('demande confirmation avant d abandonner un magot', async () => {
    await game().newGame({ mode: 'gambling', table: 'silver' });
    const action = vi.fn();
    game().requestLeave(action);
    expect(action).not.toHaveBeenCalled();
    expect(game().modal).toBe('confirmLeave');
    game().cancelPendingAction();
    game().requestLeave(action);
    game().confirmPendingAction();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('Vegas', () => {
  it('fait payer la donne et paie les cartes rangees en quittant', async () => {
    nextDealWinnable('normal', true);
    await game().newGame({ mode: 'vegas', difficulty: 'normal' });
    expect(balance()).toBe(100_000 - VEGAS_STAKE);
    playSolution(40);
    const cards = game().board.foundations.reduce((n, p) => n + p.length, 0);
    await game().goHome();
    expect(balance()).toBe(
      100_000 - VEGAS_STAKE + cards * vegasCardValue('normal'),
    );
  });

  it('refuse de distribuer sans les 52 jetons, sans rien quitter', async () => {
    await game().newGame({ mode: 'classic', seed: 'avant' });
    useMetaStore.setState({
      wallet: { balance: 10, lifetimeEarned: 0, spent: 0 },
    });
    await game().newGame({ mode: 'vegas' });
    expect(game().mode).toBe('classic');
    expect(game().seed).toBe('avant');
    expect(errors()).toHaveLength(1);
  });

  it('se perd quand la pioche est epuisee sans issue', async () => {
    nextVegasDeadEnd();
    await game().newGame({ mode: 'vegas', difficulty: 'normal' });
    for (let i = 0; i < 24; i++) game().clickStock();
    await settle();
    expect(game().phase).toBe('lost');
    expect(game().lost?.reason).toBe('deadlock');
    expect(game().lost?.vegas?.stake).toBe(VEGAS_STAKE);
  });

  it('interdit d annuler', async () => {
    await game().newGame({ mode: 'vegas' });
    game().clickStock();
    const board = game().board;
    game().undo();
    expect(game().board).toBe(board);
  });
});

describe('Chrono', () => {
  it('perd la partie a la fin du compte a rebours', async () => {
    vi.useFakeTimers({
      toFake: [
        'Date',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
      ],
    });
    await game().newGame({ mode: 'chrono', seed: 'chrono' });
    vi.setSystemTime(Date.now() + CHRONO_LIMIT_MS + 1000);
    vi.advanceTimersByTime(CHRONO_LIMIT_MS + 1000);
    await vi.waitFor(() => expect(game().lost?.reason).toBe('time'));
  });
});

describe('Jackpot', () => {
  it('table, victoire, quitte ou double, moitie a l abri puis encaissement', async () => {
    nextDealWinnable('normal');
    await game().newGame({
      mode: 'gambling',
      table: 'gold',
      difficulty: 'normal',
    });
    expect(balance()).toBe(100_000 - 2500);
    expect(game().pot).toBe(2500);
    await winRound();
    expect(meta().session.awaiting).toBe('decision');
    const pot1 = game().pot;
    expect(pot1).toBeGreaterThan(2500);

    nextDealWinnable('normal');
    await game().doubleOrNothing();
    expect(game().phase).toBe('playing');
    expect(game().pot).toBe(pot1);
    await winRound();
    expect(game().combo).toBe(2);
    const pot2 = game().pot;

    const before = balance();
    nextDealWinnable('normal');
    await game().cashOutHalf();
    expect(balance()).toBe(before + Math.floor(pot2 / 2));
    expect(game().pot).toBe(pot2 - Math.floor(pot2 / 2));
    await winRound();
    const pot3 = game().pot;
    const beforeCash = balance();
    await game().cashOut();
    expect(balance()).toBe(beforeCash + pot3);
    expect(game().route).toBe('home');
    expect(meta().session.pot).toBe(0);
  });

  it('paie les paris tenus et les verrouille au premier coup', async () => {
    nextDealWinnable('normal');
    await game().newGame({
      mode: 'gambling',
      table: 'gold',
      difficulty: 'normal',
    });
    expect(game().toggleSideBet('no-undo')).toBe(true);
    expect(game().toggleSideBet('no-hint')).toBe(true);
    game().requestHint();
    game().clickStock();
    expect(game().toggleSideBet('fast')).toBe(false);
    game().undo();
    // Meme revenu au depart, on a vu la pioche: les paris restent fermes.
    expect(game().toggleSideBet('fast')).toBe(false);
    // On revient sur la pioche: on rejoue la donne depuis le debut.
    await winRound();
    const bets = game().win!.bets;
    const stake = sideBetStake('gold');
    expect(bets.find((b) => b.id === 'no-undo')?.won).toBe(false);
    expect(bets.find((b) => b.id === 'no-hint')?.won).toBe(false);
    expect(bets.every((b) => b.stake === stake)).toBe(true);
  });

  it('paie un pari tenu', async () => {
    nextDealWinnable('normal');
    await game().newGame({
      mode: 'gambling',
      table: 'gold',
      difficulty: 'normal',
    });
    game().toggleSideBet('no-undo');
    const before = balance();
    await winRound();
    const stake = sideBetStake('gold');
    expect(game().win!.bets[0]).toMatchObject({
      won: true,
      payout: stake * 3,
    });
    expect(balance()).toBe(before - stake + stake * 3);
  });

  it('remet le jackpot progressif a l exploit en Expert', async () => {
    nextDealWinnable('expert');
    await game().newGame({
      mode: 'gambling',
      table: 'silver',
      difficulty: 'expert',
    });
    const pot = meta().progressive.pot;
    await winRound();
    expect(game().win!.progressive).toBe(pot);
    expect(meta().progressive.pot).toBe(5000);
  });

  it('ouvre le coffre une seule fois apres trois victoires', async () => {
    nextDealWinnable('normal');
    await game().newGame({
      mode: 'gambling',
      table: 'free',
      difficulty: 'normal',
    });
    await winRound();
    for (let i = 0; i < 2; i++) {
      nextDealWinnable('normal');
      await game().doubleOrNothing();
      await winRound();
    }
    expect(game().win!.vaultEligible).toBe(true);
    game().enterVault();
    expect(game().overlay).toBe('vault');
    await game().openVault();
    const pot = game().pot;
    await game().openVault();
    expect(game().pot).toBe(pot);
    expect(meta().gambling.vaultsOpened).toBe(1);
  });

  it('mise une victoire classique au Jackpot', async () => {
    nextDealWinnable('normal');
    await game().newGame({ mode: 'classic', difficulty: 'normal' });
    await winRound();
    const score = game().win!.roundScore;
    nextDealWinnable('normal');
    await game().gambleFromScore();
    expect(game().mode).toBe('gambling');
    expect(game().pot).toBe(score);
  });

  it('perd le magot en quittant la table apres une victoire', async () => {
    nextDealWinnable('normal');
    await game().newGame({
      mode: 'gambling',
      table: 'free',
      difficulty: 'normal',
    });
    await winRound();
    await game().goHome();
    expect(meta().session.pot).toBe(0);
    expect(game().pot).toBe(0);
  });
});

describe('jokers', () => {
  it('coup d oeil: consomme a la carte choisie et valide a la fin', async () => {
    give('peek', 1);
    await game().newGame({ mode: 'classic', seed: 'oeil' });
    expect(game().playJoker('peek')).toBe(true);
    const hidden = game().board.tableau[6][0];
    expect(game().peekAt(hidden.id)).toBe(true);
    expect(game().peekCard).toBe(hidden.id);
    expect(game().playJoker('peek')).toBe(false);
    await game().goHome();
    expect(meta().inventory.consumables.peek).toBe(0);
    expect(errors()).toEqual([]);
  });

  it('remelange: ordre de pioche rejouable par le coeur', async () => {
    give('reshuffle', 1);
    await game().newGame({ mode: 'classic', seed: 'remelange' });
    const stock = game().board.stock.map((c) => c.id);
    expect(game().playJoker('reshuffle')).toBe(true);
    expect(game().board.stock.map((c) => c.id)).not.toEqual(stock);
    game().clickStock();
    await game().goHome();
    expect(meta().inventory.consumables.reshuffle).toBe(0);
    expect(errors()).toEqual([]);
  });

  it('joker: un coup interdit passe une fois, et le coeur l accepte', async () => {
    give('joker', 1);
    await game().newGame({ mode: 'classic', seed: 'joker' });
    game().clickStock();
    const board = game().board;
    // Une colonne ou la carte du talon ne peut pas aller normalement.
    const column = board.tableau.findIndex(
      (col, c) =>
        col.length > 0 &&
        !game().applyDragMove({ type: 'wasteToTableau', column: c }),
    );
    expect(column).toBeGreaterThanOrEqual(0);
    game().playJoker('joker');
    expect(game().applyDragMove({ type: 'wasteToTableau', column })).toBe(true);
    expect(game().jokerArmed).toBe(false);
    await game().goHome();
    expect(meta().inventory.consumables.joker).toBe(0);
    expect(errors()).toEqual([]);
  });
});

describe('donnes garanties et tutoriel', () => {
  it('sert une donne prouvee gagnable, sur le prefixe impose', async () => {
    meta().updateSettings({ guaranteed: true });
    const nonce = meta().session.nonce;
    await game().newGame({ mode: 'classic', difficulty: 'normal' });
    expect(game().round?.seedSource).toBe('guaranteed');
    expect(game().seed.startsWith(`${nonce}-`)).toBe(true);
    expect(Array.isArray(findSolution(game().board, 20_000))).toBe(true);
    await winRound();
    expect(game().win!.guaranteedMultiplier).toBe(0.75);
  });

  it('respecte le defi du jour', async () => {
    meta().updateSettings({ guaranteed: true });
    await game().newGame({ mode: 'daily' });
    expect(game().guaranteed).toBe(false);
  });

  it('lance une donne douce ou un premier coup existe', async () => {
    await game().startTutorial();
    expect(game().tutorial).toBe(true);
    expect(game().seed).toBe(TUTORIAL_SEED);
    expect(game().difficulty).toBe('easy');
    const tops = game().board.tableau.map((c) => c[c.length - 1]);
    expect(tops.some((c) => c.rank === 1)).toBe(true);
    game().endTutorial();
    expect(meta().tutorial.done).toBe(true);
  });
});
