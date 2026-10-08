import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { CrashScreen, ErrorBoundary, NotFoundScreen } from './SystemScreen';
import { Toaster } from './Toaster';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';

function resetStores(): void {
  localStorage.clear();
  useMetaStore.getState().resetProgress();
  useMetaStore.setState({ notices: [] });
  useMetaStore.getState().updateSettings({ soundEnabled: false });
  useGameStore.setState({
    route: 'home',
    modal: 'none',
    overlay: 'none',
    phase: 'idle',
    mode: 'classic',
    pot: 0,
    combo: 0,
    pendingAction: null,
  });
}

beforeEach(resetStores);

function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('Carte introuvable dans le sabot');
  return <p>Partie en cours</p>;
}

describe('ecran de plantage', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  // jsdom signale aussi l'erreur relancee par React en developpement.
  const silence = (event: ErrorEvent) => event.preventDefault();
  beforeEach(() => {
    // React journalise toute erreur rattrapee: on garde la sortie propre.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', silence);
  });
  afterEach(() => {
    consoleError.mockRestore();
    window.removeEventListener('error', silence);
  });

  it('rattrape une erreur d affichage et permet de repartir', () => {
    function Harness() {
      const [armed, setArmed] = useState(true);
      return (
        <ErrorBoundary onReset={() => setArmed(false)}>
          <Bomb armed={armed} />
        </ErrorBoundary>
      );
    }
    render(<Harness />);
    expect(
      screen.getByRole('heading', { name: /renversé le paquet/i }),
    ).toBeTruthy();
    expect(screen.getByText('Carte introuvable dans le sabot')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /accueil/i }));
    expect(screen.getByText('Partie en cours')).toBeTruthy();
  });

  it('signale l erreur au rapporteur', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb armed />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toMatch(/sabot/);
  });

  it('copie un rapport et demande confirmation avant d effacer', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<CrashScreen error={new Error('boum')} onRetry={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copier/i }));
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('boum'));
    expect(screen.getByRole('button', { name: /rapport copié/i })).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /effacer ma sauvegarde/i }),
    );
    expect(screen.getByRole('button', { name: /tout effacer/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByRole('button', { name: /tout effacer/i })).toBeNull();
  });
});

describe('page introuvable', () => {
  it('affiche l adresse demandee comme simple texte et un lien de retour', () => {
    const path = '/<img src=x onerror=alert(1)>';
    const { container } = render(
      <NotFoundScreen path={path} homeHref="/jeu/" />,
    );
    expect(screen.getByRole('heading', { name: /n’existe pas/i })).toBeTruthy();
    expect(screen.getByText(path)).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    const link = screen.getByRole('link', { name: /retour au casino/i });
    expect(link.getAttribute('href')).toBe('/jeu/');
  });
});

describe('notifications d erreur', () => {
  it('s annoncent aux lecteurs d ecran et se ferment au toucher', () => {
    render(<Toaster />);
    act(() => {
      useMetaStore
        .getState()
        .notify({ kind: 'error', title: 'Sauvegarde impossible', text: 'x' });
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Sauvegarde impossible');
    fireEvent.click(alert);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('application', () => {
  it('affiche l accueil sans planter', () => {
    render(<App />);
    expect(screen.getAllByText(/jackpot/i).length).toBeGreaterThan(0);
  });

  it('change la difficulte depuis les reglages', () => {
    render(<App />);
    act(() => useGameStore.getState().openModal('settings'));
    fireEvent.click(screen.getByRole('radio', { name: /facile/i }));
    expect(useMetaStore.getState().settings.difficulty).toBe('easy');
    expect(
      screen
        .getByRole('radio', { name: /facile/i })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('borne la longueur de la graine saisie', () => {
    render(<App />);
    act(() => useGameStore.getState().openModal('newgame'));
    const input = screen.getByLabelText('Graine de partie') as HTMLInputElement;
    expect(input.maxLength).toBeGreaterThan(0);
  });

  it('laisse piocher au clavier', () => {
    render(<App />);
    act(() =>
      useGameStore.getState().newGame({ mode: 'classic', seed: 'clavier' }),
    );
    const stock = screen.getByRole('button', { name: /piocher/i });
    expect(stock.tabIndex).toBe(0);
    fireEvent.keyDown(stock, { key: 'Enter' });
    expect(useGameStore.getState().board.waste.length).toBeGreaterThan(0);
    const waste = useGameStore.getState().board.waste.length;
    fireEvent.keyDown(stock, { key: 'a' });
    expect(useGameStore.getState().board.waste.length).toBe(waste);
  });

  it('demande confirmation avant de fermer l onglet avec un magot en jeu', () => {
    render(<App />);
    act(() => {
      useGameStore.getState().newGame({ mode: 'gambling', table: 'free' });
      useGameStore.setState({ pot: 900 });
    });
    const risky = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(risky);
    expect(risky.defaultPrevented).toBe(true);

    act(() => useGameStore.setState({ pot: 0 }));
    const safe = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(safe);
    expect(safe.defaultPrevented).toBe(false);
  });
});
