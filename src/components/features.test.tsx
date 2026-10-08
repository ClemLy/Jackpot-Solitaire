import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { MissionsModal } from './MissionsModal';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { activeMissions, periodKey } from '../state/missions';
import { sideBetStake } from '../state/catalog';

function reset(): void {
  localStorage.clear();
  useMetaStore.getState().resetProgress();
  useMetaStore.setState({
    notices: [],
    wallet: { balance: 50_000, lifetimeEarned: 0, spent: 0 },
    tutorial: { done: true },
  });
  useMetaStore
    .getState()
    .updateSettings({ soundEnabled: false, reducedMotion: true });
  useGameStore.setState({
    route: 'home',
    modal: 'none',
    overlay: 'none',
    phase: 'idle',
    mode: 'classic',
    pot: 0,
    combo: 0,
    tutorial: false,
    preparing: false,
  });
}

beforeEach(reset);

describe('accueil', () => {
  it('invite au tutoriel a la premiere visite, et sait se taire', () => {
    useMetaStore.setState({ tutorial: { done: false } });
    render(<App />);
    expect(screen.getByText('Première visite ?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByText('Première visite ?')).toBeNull();
    expect(useMetaStore.getState().tutorial.done).toBe(true);
  });

  it('signale les recompenses en attente sur le bouton Missions', () => {
    useMetaStore.setState({
      wallet: { balance: 0, lifetimeEarned: 6000, spent: 0 },
    });
    render(<App />);
    expect(
      screen.getByRole('button', { name: /missions, 1 récompense/i }),
    ).toBeTruthy();
  });

  it('propose Vegas et affiche le jackpot progressif', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /vegas/i })).toBeTruthy();
    expect(screen.getByText('Jackpot progressif')).toBeTruthy();
  });
});

describe('missions', () => {
  it('recupere une mission terminee et le coffret de rang', () => {
    const key = periodKey('daily');
    const def = activeMissions('daily', key)[0];
    useMetaStore.setState((s) => ({
      wallet: { balance: 0, lifetimeEarned: 6000, spent: 0 },
      missions: {
        ...s.missions,
        daily: { key, progress: { [def.id]: def.target }, claimed: [] },
      },
    }));
    render(<MissionsModal onClose={() => {}} />);
    const claim = screen.getByRole('button', { name: /^\+/ });
    fireEvent.click(claim);
    expect(screen.getByText('Récupérée')).toBeTruthy();
    expect(useMetaStore.getState().wallet.balance).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(screen.getByText('Récupéré')).toBeTruthy();
    expect(useMetaStore.getState().inventory.consumables.hint).toBe(1);
  });

  it('explique le coffret avant le rang Argent', () => {
    render(<MissionsModal onClose={() => {}} />);
    expect(screen.getByText(/atteins le rang argent/i)).toBeTruthy();
  });
});

describe('en partie', () => {
  it('pose un pari annexe puis le verrouille au premier coup', () => {
    render(<App />);
    act(() =>
      useGameStore.getState().newGame({ mode: 'gambling', table: 'gold' }),
    );
    // Discrets par defaut: une pastille, qu'on ouvre pour parier.
    expect(screen.queryByRole('switch', { name: /sans indice/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /paris annexes/i }));
    const bet = screen.getByRole('switch', { name: /sans indice/i });
    fireEvent.click(bet);
    expect(bet.getAttribute('aria-checked')).toBe('true');
    expect(useMetaStore.getState().wallet.balance).toBe(
      50_000 - 2500 - sideBetStake('gold'),
    );
    expect(screen.getByRole('button', { name: /1 pari · 250/ })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /fermer les paris annexes/i }),
    );
    expect(screen.queryByRole('switch', { name: /sans indice/i })).toBeNull();
    act(() => useGameStore.getState().clickStock());
    expect(screen.queryByRole('button', { name: /1 pari · 250/ })).toBeNull();
    expect(screen.getByText('1 pari')).toBeTruthy();
  });

  it('ouvre le plateau des jokers, achete puis arme un joker', () => {
    render(<App />);
    act(() => useGameStore.getState().newGame({ mode: 'classic', seed: 'j' }));
    fireEvent.click(screen.getByRole('button', { name: /jokers/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /acheter joker pour/i }),
    );
    expect(useMetaStore.getState().inventory.consumables.joker).toBe(1);
    const use = screen.getAllByRole('button', { name: 'Utiliser' });
    fireEvent.click(use[use.length - 1]);
    expect(useGameStore.getState().jokerArmed).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/joker prêt/i);
    fireEvent.click(screen.getByRole('button', { name: /annuler le joker/i }));
    expect(useGameStore.getState().jokerArmed).toBe(false);
  });

  it('montre le compte a rebours au Chrono et les gains a Vegas', () => {
    render(<App />);
    act(() => useGameStore.getState().newGame({ mode: 'chrono' }));
    expect(screen.getByText('Reste')).toBeTruthy();
    expect(screen.getByText('05:00')).toBeTruthy();
    act(() => useGameStore.getState().newGame({ mode: 'vegas' }));
    expect(screen.getByText('Gains')).toBeTruthy();
    expect(screen.getByText('Recharges')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /pas d’annulation à vegas/i }),
    ).toHaveProperty('disabled', true);
  });

  it('guide le tutoriel pas a pas et le laisse passer', () => {
    render(<App />);
    act(() => useGameStore.getState().startTutorial());
    expect(screen.getByText('Le but du jeu')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('Les colonnes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('À toi de jouer')).toBeTruthy();
    // Etape d'action: elle avance des que le joueur joue.
    act(() => {
      const board = useGameStore.getState().board;
      const col = board.tableau.findIndex((c) => c[c.length - 1].rank === 1);
      useGameStore
        .getState()
        .autoFromTableau(col, board.tableau[col].length - 1);
    });
    expect(screen.getByText('La pioche')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /passer le tutoriel/i }),
    );
    expect(screen.queryByText('La pioche')).toBeNull();
    expect(useMetaStore.getState().tutorial.done).toBe(true);
  });
});

describe('reglages', () => {
  it('active les donnes garanties', () => {
    render(<App />);
    act(() => useGameStore.getState().openModal('settings'));
    const toggle = screen.getByRole('switch', { name: /donnes garanties/i });
    fireEvent.click(toggle);
    expect(useMetaStore.getState().settings.guaranteed).toBe(true);
  });
});
