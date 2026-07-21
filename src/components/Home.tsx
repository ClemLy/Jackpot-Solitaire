import { useGameStore, type GameMode } from '../state/game';
import { useMetaStore } from '../state/meta';
import { formatNumber } from '../utils/format';
import { dailySeed, todayISO } from '../utils/seed';

interface ModeTile {
  mode: GameMode;
  title: string;
  badge: string;
  desc: string;
  accent?: 'gold';
}

const TILES: ModeTile[] = [
  {
    mode: 'classic',
    title: 'Classique',
    badge: 'Detente',
    desc: 'Le Klondike de toujours. Score, indices, annuler illimite. Le bon endroit pour se faire la main.',
  },
  {
    mode: 'gambling',
    title: 'Jackpot',
    badge: 'Quitte ou double',
    desc: 'Empile ton magot, puis ose le quitte ou double. Encaisse ou risque tout sur la manche suivante.',
    accent: 'gold',
  },
  {
    mode: 'daily',
    title: 'Defi du jour',
    badge: 'Une donne par jour',
    desc: 'La meme donne pour tout le monde aujourd hui. Reviens chaque jour pour gonfler ta collection.',
  },
  {
    mode: 'chrono',
    title: 'Chrono',
    badge: 'Contre la montre',
    desc: 'Memes regles, mais le temps te colle aux talons. Chaque seconde grignote ton bonus de vitesse.',
  },
  {
    mode: 'zen',
    title: 'Zen',
    badge: 'Sans pression',
    desc: 'Ni score, ni chrono. Juste les cartes et toi. On respire, on pose, on savoure.',
  },
];

export function Home() {
  const newGame = useGameStore((s) => s.newGame);
  const openModal = useGameStore((s) => s.openModal);
  const secured = useMetaStore((s) => s.gambling.secured);
  const bestRun = useMetaStore((s) => s.gambling.bestSecuredRun);
  const longest = useMetaStore((s) => s.gambling.longestStreak);
  const dailyDone = useMetaStore((s) =>
    s.daily.completedDates.includes(todayISO()),
  );

  return (
    <div className="home scroll">
      <div className="home__brand">
        <h1 className="title">
          <span className="gold">Jackpot</span> Solitaire
        </h1>
        <p className="home__tag">
          Le solitaire dessine a la main ou l on mise son sang froid.
        </p>
      </div>

      <div className="bankline">
        <span className="chip">Banque securisee {formatNumber(secured)}</span>
        <span className="chip">Record de magot {formatNumber(bestRun)}</span>
        <span className="chip">Plus longue serie {longest}</span>
      </div>

      <div className="modes">
        {TILES.map((tile) => (
          <button
            key={tile.mode}
            className="mode-card"
            data-accent={tile.accent}
            onClick={() =>
              newGame({
                mode: tile.mode,
                seed: tile.mode === 'daily' ? dailySeed() : undefined,
              })
            }
          >
            <span className="mode-card__head">
              <span className="mode-card__title">{tile.title}</span>
              <span className="mode-card__badge">
                {tile.mode === 'daily' && dailyDone ? 'Termine' : tile.badge}
              </span>
            </span>
            <span className="mode-card__desc">{tile.desc}</span>
          </button>
        ))}
      </div>

      <div className="home__actions">
        <button className="btn" onClick={() => openModal('rules')}>
          Regles du jeu
        </button>
        <button className="btn" onClick={() => openModal('stats')}>
          Statistiques
        </button>
        <button className="btn" onClick={() => openModal('themes')}>
          Personnaliser
        </button>
        <button className="btn" onClick={() => openModal('settings')}>
          Reglages
        </button>
      </div>
    </div>
  );
}
