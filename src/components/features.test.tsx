import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { MissionsModal } from './MissionsModal';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { activeMissions, periodKey } from '../state/missions';

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
  it('invite au tutoriel a la premiere visite, et sait se taire', async () => {
    useMetaStore.setState({ tutorial: { done: false } });
    render(<App />);
    expect(screen.getByText('Première visite ?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByText('Première visite ?')).toBeNull();
    expect(useMetaStore.getState().tutorial.done).toBe(true);
  });

  it('signale les recompenses en attente sur le bouton Missions', async () => {
    useMetaStore.setState({
      wallet: { balance: 0, lifetimeEarned: 20_000, spent: 0 },
    });
    render(<App />);
    expect(
      screen.getByRole('button', { name: /missions, 1 récompense/i }),
    ).toBeTruthy();
  });

  it('propose Vegas et affiche le jackpot progressif', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /vegas/i })).toBeTruthy();
    expect(screen.getByText('Jackpot progressif')).toBeTruthy();
  });
});

describe('rangs', () => {
  it('montre le rang, ce qui manque et ce que chaque rang apporte', async () => {
    useMetaStore.setState({
      wallet: { balance: 0, lifetimeEarned: 120_000, spent: 0 },
    });
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /encore 60\s000 jetons à gagner/i }),
    );
    expect(screen.getByRole('progressbar', { name: /Platine/ })).toBeTruthy();
    const ladder = screen.getByRole('list', { name: 'Tous les rangs' });
    const steps = ladder.querySelectorAll(':scope > li');
    expect(steps).toHaveLength(6);
    expect(steps[2].getAttribute('aria-current')).toBe('step');
    expect(steps[2].textContent).toMatch(/Salon Platine/);
    expect(steps[3].textContent).toMatch(/Table Diamant/);
    expect(steps[4].textContent).toMatch(/Table Légende/);
    // Un dernier rang est annonce des le depart, scelle, avec ses epreuves.
    expect(steps[5].textContent).toMatch(/Rang scellé/);
    expect(steps[5].textContent).toMatch(/Amasser un million/);
    expect(steps[5].textContent).toMatch(/Vaincre la Table Légende/);
  });
});

describe('rang Legendaire', () => {
  it('montre le sceau et ses epreuves avant le rang', async () => {
    useMetaStore.setState({
      wallet: { balance: 0, lifetimeEarned: 600_000, spent: 0 },
    });
    render(<App />);
    // Aucun lien direct: le rang se decouvre depuis l'ecran des rangs.
    expect(
      screen.queryByRole('button', { name: /Salon légendaire/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /un rang scellé/ }));
    const ranks = screen.getByRole('dialog', { name: 'Rangs VIP' });
    // Le nom reste secret avant l'accession.
    expect(ranks.textContent).not.toMatch(/Légendaire/);
    expect(ranks.textContent).toMatch(/Rang scellé/);
    fireEvent.click(screen.getByRole('button', { name: /Examiner le sceau/ }));
    const dialog = screen.getByRole('dialog', { name: 'Le sceau' });
    expect(dialog.textContent).toMatch(/Amasser un million/);
    expect(dialog.textContent).toMatch(/Vaincre la Table Légende/);
    expect(dialog.textContent).toMatch(
      /600\s000 jetons gagnés sur 1\s000\s000/,
    );
    expect(dialog.textContent).not.toMatch(/Légendaire I/);
    expect(screen.getByRole('button', { name: /S.asseoir/ })).toBeTruthy();
  });

  it('ouvre le Salon, sa boutique et son bureau de change', async () => {
    useMetaStore.setState((s) => ({
      wallet: { balance: 300_000, lifetimeEarned: 1_400_000, spent: 0 },
      legend: {
        ...s.legend,
        tableWins: 1,
        level: 2,
        base: 1_000_000,
        ascendedAt: 1,
        black: 80,
        blackEarned: 80,
      },
    }));
    render(<App />);
    // Le solde de jetons noirs: dans la barre du haut (et pres du jackpot
    // progressif sur telephone).
    const pills = screen.getAllByRole('button', { name: /80 jetons noirs/ });
    expect(pills.length).toBeGreaterThan(0);
    fireEvent.click(pills[0]);
    expect(screen.getAllByText('Légendaire II').length).toBeGreaterThan(0);
    // Onyx (30 jetons noirs) s'achete et s'equipe aussitot.
    fireEvent.click(
      screen.getByRole('button', { name: /Acheter Onyx pour 30 jetons noirs/ }),
    );
    expect(useMetaStore.getState().legend.black).toBe(50);
    expect(useMetaStore.getState().equipped.cardBack).toBe('onyx');
    // L'Ombre attend le niveau III.
    expect(
      screen.getByRole('button', { name: /L.Ombre, au niveau Légendaire III/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Jetons noirs/ }));
    const before = useMetaStore.getState().wallet.balance;
    fireEvent.click(
      screen.getByRole('button', { name: /Échanger 250\s000 jetons contre 5/ }),
    );
    expect(useMetaStore.getState().legend.black).toBe(55);
    expect(useMetaStore.getState().wallet.balance).toBe(before - 250_000);
  });

  it('compose un titre sur mesure dans l Atelier au niveau L', async () => {
    useMetaStore.setState((s) => ({
      wallet: { balance: 0, lifetimeEarned: 900_000_000, spent: 0 },
      inventory: { ...s.inventory, owned: ['flambeur', 'baron'] },
      legend: {
        ...s.legend,
        tableWins: 1,
        level: 50,
        base: 900_000_000 - 1,
        ascendedAt: 1,
      },
    }));
    useGameStore.setState({ modal: 'legend' });
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Atelier/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Titre/ }));
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Plaque' })).getByRole(
        'radio',
        { name: 'Baron du tapis' },
      ),
    );
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Devise' })).getByRole(
        'radio',
        { name: 'Flambeur' },
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer et équiper' }),
    );
    const meta = useMetaStore.getState();
    expect(meta.legend.atelier.title).toEqual({
      plate: 'baron',
      text: 'flambeur',
    });
    expect(meta.equipped.title).toBe('atelier-title');
  });

  it('celebre l accession en plein ecran', async () => {
    useMetaStore.getState().notify({
      kind: 'legend',
      title: 'Légendaire I',
      text: 'Tout ce qui précède n’était que le tutoriel.',
    });
    render(<App />);
    const ceremony = screen.getByRole('dialog', { name: 'Légendaire' });
    expect(ceremony.textContent).toMatch(/que le tutoriel/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Entrer dans le Salon' }),
    );
    expect(useGameStore.getState().modal).toBe('legend');
    expect(screen.queryByRole('dialog', { name: 'Légendaire' })).toBeNull();
  });
});

describe('hauts faits', () => {
  it('montre les paliers, la progression et les exploits', async () => {
    useMetaStore.setState({
      stats: {
        ...useMetaStore.getState().stats,
        gamesPlayed: 40,
        gamesWon: 30,
      },
      achievements: { 'first-win': 1, 'wins-25': 2, 'clear-mind': 3 },
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Hauts faits/ }));
    expect(screen.getByRole('img', { name: /3 hauts faits sur/ })).toBeTruthy();
    expect(screen.getByText('Habitué du tapis')).toBeTruthy();
    expect(screen.getByText('30 / 100')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Exploits/ }));
    expect(screen.getByText('Tête froide')).toBeTruthy();
    expect(screen.queryByText('Victoires')).toBeNull();
  });
});

describe('missions', () => {
  it('recupere une mission terminee et le coffret de rang', async () => {
    const key = periodKey('daily');
    const def = activeMissions('daily', key)[0];
    useMetaStore.setState((s) => ({
      wallet: { balance: 0, lifetimeEarned: 20_000, spent: 0 },
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

  it('explique le coffret avant le rang Argent', async () => {
    render(<MissionsModal onClose={() => {}} />);
    expect(screen.getByText(/atteins le rang argent/i)).toBeTruthy();
  });
});

describe('en partie', () => {
  it('pose un pari annexe puis le verrouille au premier coup', async () => {
    render(<App />);
    await act(async () => {
      await useGameStore
        .getState()
        .newGame({ mode: 'gambling', table: 'gold' });
    });
    // Discrets par defaut: une pastille, qu'on ouvre pour parier.
    expect(screen.queryByRole('switch', { name: /sans indice/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /paris annexes/i }));
    const bet = screen.getByRole('switch', { name: /sans indice/i });
    fireEvent.click(bet);
    expect(bet.getAttribute('aria-checked')).toBe('true');
    // La mise du pari n'est debitee qu'a la fin de la manche.
    expect(useMetaStore.getState().wallet.balance).toBe(50_000 - 2500);
    expect(useGameStore.getState().sideBets).toEqual(['no-hint']);
    expect(screen.getByRole('button', { name: /1 pari · 250/ })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /fermer les paris annexes/i }),
    );
    expect(screen.queryByRole('switch', { name: /sans indice/i })).toBeNull();
    act(() => useGameStore.getState().clickStock());
    expect(screen.queryByRole('button', { name: /1 pari · 250/ })).toBeNull();
    expect(screen.getByText('1 pari')).toBeTruthy();
  });

  it('ouvre le plateau des jokers, achete puis arme un joker', async () => {
    render(<App />);
    await act(async () => {
      await useGameStore.getState().newGame({ mode: 'classic', seed: 'j' });
    });
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

  it('montre le compte a rebours au Chrono et les gains a Vegas', async () => {
    render(<App />);
    await act(async () => {
      await useGameStore.getState().newGame({ mode: 'chrono' });
    });
    expect(screen.getByText('Reste')).toBeTruthy();
    expect(screen.getByText('05:00')).toBeTruthy();
    await act(async () => {
      await useGameStore.getState().newGame({ mode: 'vegas' });
    });
    expect(screen.getByText('Gains')).toBeTruthy();
    expect(screen.getByText('Recharges')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /pas d’annulation à vegas/i }),
    ).toHaveProperty('disabled', true);
  });

  it('guide le tutoriel pas a pas et le laisse passer', async () => {
    render(<App />);
    await act(async () => {
      await useGameStore.getState().startTutorial();
    });
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
  it('active les donnes garanties', async () => {
    render(<App />);
    act(() => useGameStore.getState().openModal('settings'));
    const toggle = screen.getByRole('switch', { name: /donnes garanties/i });
    fireEvent.click(toggle);
    expect(useMetaStore.getState().settings.guaranteed).toBe(true);
  });
});
