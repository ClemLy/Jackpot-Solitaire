import type { CSSProperties, ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Crown,
  Leaf,
  Settings,
  ShoppingBag,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { useGameStore, type GameMode } from '../state/game';
import { useMetaStore } from '../state/meta';
import { nextVipTier, vipProgress, vipTierFor } from '../state/catalog';
import { formatDuration, formatNumber, percent } from '../utils/format';
import { dailySeed, todayISO } from '../utils/seed';
import type { Card } from '../engine';
import { CardView } from './CardView';
import { Balance, Chip } from './ui';
import { Logo } from './Logo';
import { SuitIcon } from './Suits';

interface ModeTile {
  mode: GameMode;
  title: string;
  desc: string;
  icon: ReactNode;
}

const TILES: ModeTile[] = [
  {
    mode: 'classic',
    title: 'Classique',
    desc: 'Le Klondike de toujours, indices et annuler illimité.',
    icon: <SuitIcon suit="spades" className="mode-tile__suit" />,
  },
  {
    mode: 'daily',
    title: 'Défi du jour',
    desc: 'La même donne pour tout le monde, une prime à la clé.',
    icon: <CalendarDays size={20} />,
  },
  {
    mode: 'chrono',
    title: 'Chrono',
    desc: 'Chaque seconde grignote ton bonus de vitesse.',
    icon: <Timer size={20} />,
  },
  {
    mode: 'zen',
    title: 'Zen',
    desc: 'Ni score, ni chrono. On pose, on savoure.',
    icon: <Leaf size={20} />,
  },
];

// Eventail de la vitrine: de vraies cartes du jeu, pas une image.
const HERO_CARDS: Card[] = [
  { id: 'hero-1', suit: 'diamonds', rank: 10, faceUp: true },
  { id: 'hero-2', suit: 'spades', rank: 11, faceUp: true },
  { id: 'hero-3', suit: 'hearts', rank: 12, faceUp: true },
  { id: 'hero-4', suit: 'clubs', rank: 13, faceUp: true },
  { id: 'hero-5', suit: 'spades', rank: 1, faceUp: true },
];

function HeroFan() {
  return (
    <div className="hero-fan" aria-hidden="true">
      <div className="hero-fan__glow" />
      {HERO_CARDS.map((card, i) => (
        <div
          key={card.id}
          className="hero-fan__slot"
          style={{ '--i': i - 2 } as CSSProperties}
        >
          <CardView
            card={card}
            expression={card.rank === 12 ? 'wink' : 'happy'}
            style={{ top: 0, left: 0 }}
          />
        </div>
      ))}
      <div className="hero-fan__chips">
        {(['black', 'red', 'gold', 'red', 'gold'] as const).map((tone, i) => (
          <Chip
            key={i}
            tone={tone}
            size="100%"
            className="hero-fan__chip"
            style={{ '--n': i } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

export function Home() {
  const newGame = useGameStore((s) => s.newGame);
  const openModal = useGameStore((s) => s.openModal);
  const stats = useMetaStore((s) => s.stats);
  const gambling = useMetaStore((s) => s.gambling);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const daily = useMetaStore((s) => s.daily);
  const canSpin = useMetaStore((s) => s.wheel.lastSpin !== todayISO());

  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);
  const dailyDone = daily.completedDates.includes(todayISO());

  const tileMeta = (mode: GameMode): ReactNode => {
    switch (mode) {
      case 'classic':
        return stats.gamesPlayed > 0
          ? `${percent(stats.gamesWon, stats.gamesPlayed)} % de victoires`
          : 'Pour se faire la main';
      case 'daily':
        return dailyDone ? (
          <span className="tile-done">
            <CalendarCheck2 size={14} /> Terminé aujourd&rsquo;hui
          </span>
        ) : (
          <span className="tile-prize">
            <Chip size={14} /> +500 à gagner
          </span>
        );
      case 'chrono':
        return stats.bestTimeMs
          ? `Record ${formatDuration(stats.bestTimeMs)}`
          : 'Contre la montre';
      default:
        return 'Sans pression';
    }
  };

  return (
    <div className="home scroll">
      <header className="topbar">
        <div className="topbar__brand">
          <Logo size={34} />
          <span className="topbar__name">Jackpot Solitaire</span>
        </div>
        <div className="topbar__right">
          <button
            className="vip-pill"
            data-tier={tier.id}
            onClick={() => openModal('shop')}
            aria-label={`Rang VIP ${tier.label}`}
            title={
              next
                ? `Encore ${formatNumber(next.threshold - lifetime)} jetons gagnés pour le rang ${next.label}`
                : 'Rang maximum atteint'
            }
          >
            <Crown size={15} />
            <span>{tier.label}</span>
            <span
              className="vip-pill__bar"
              style={{ '--p': vipProgress(lifetime) } as CSSProperties}
            />
          </button>
          <button
            className="wallet-pill"
            onClick={() => openModal('shop')}
            aria-label="Ouvrir la boutique"
          >
            <Balance />
            <span className="wallet-pill__plus" aria-hidden="true">
              <ShoppingBag size={14} />
            </span>
          </button>
        </div>
      </header>

      <main className="home__main">
        <section className="hero">
          <div className="hero__copy">
            <h1 className="hero__title">
              <span className="hero__title-gold">Jackpot</span>
              <span className="hero__title-rest">Solitaire</span>
            </h1>
            <p className="hero__tag">
              Le solitaire où l&rsquo;on mise son sang-froid. Gagne, encaisse,
              ou tente le quitte ou double.
            </p>
            <div className="hero__stats">
              <div>
                <span className="k">Record de magot</span>
                <span className="v">
                  {formatNumber(gambling.bestSecuredRun)}
                </span>
              </div>
              <div>
                <span className="k">Plus longue série</span>
                <span className="v">{gambling.longestStreak}</span>
              </div>
              <div>
                <span className="k">Coffres ouverts</span>
                <span className="v">{gambling.vaultsOpened}</span>
              </div>
            </div>
            <div className="hero__cta">
              <button
                className="btn btn--gold btn--lg"
                onClick={() => openModal('tables')}
              >
                Jouer au Jackpot
                <ArrowRight size={18} />
              </button>
              <button
                className={`btn btn--ghost btn--lg wheel-btn${canSpin ? ' is-ready' : ''}`}
                onClick={() => openModal('wheel')}
              >
                <WheelGlyph />
                {canSpin ? 'Roue du jour' : 'Roue demain'}
              </button>
            </div>
          </div>
          <HeroFan />
        </section>

        <section className="modes" aria-label="Autres modes de jeu">
          {TILES.map((tile) => (
            <button
              key={tile.mode}
              className="mode-tile"
              data-mode={tile.mode}
              onClick={() =>
                newGame({
                  mode: tile.mode,
                  seed: tile.mode === 'daily' ? dailySeed() : undefined,
                })
              }
            >
              <span className="mode-tile__icon">{tile.icon}</span>
              <span className="mode-tile__title">{tile.title}</span>
              <span className="mode-tile__desc">{tile.desc}</span>
              <span className="mode-tile__meta">{tileMeta(tile.mode)}</span>
            </button>
          ))}
        </section>

        <nav className="home__links" aria-label="Menu">
          <button className="link-btn" onClick={() => openModal('shop')}>
            <ShoppingBag size={18} /> Boutique
          </button>
          <button className="link-btn" onClick={() => openModal('stats')}>
            <BarChart3 size={18} /> Statistiques
          </button>
          <button className="link-btn" onClick={() => openModal('rules')}>
            <BookOpen size={18} /> Règles
          </button>
          <button className="link-btn" onClick={() => openModal('settings')}>
            <Settings size={18} /> Réglages
          </button>
        </nav>
      </main>
    </div>
  );
}

function WheelGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 3v6.8M12 14.2V21M3 12h6.8M14.2 12H21M5.6 5.6l4.8 4.8M13.6 13.6l4.8 4.8M18.4 5.6l-4.8 4.8M10.4 13.6l-4.8 4.8" />
    </svg>
  );
}
