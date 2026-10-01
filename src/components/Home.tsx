import type { CSSProperties, ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  Crown,
  Settings,
  ShoppingBag,
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
import { ModeDeck, type ModeCardData } from './ModeDeck';

type ModeCard = Omit<ModeCardData, 'meta'>;

// Les modes sont presentes comme des cartes posees sur le tapis. Le coin de
// chaque carte porte un petit clin d'oeil: le jour du mois pour le defi,
// trois minutes pour le chrono, zero pression pour le zen.
function modeCards(today: Date): ModeCard[] {
  return [
    {
      mode: 'classic',
      title: 'Classique',
      desc: 'Le Klondike de toujours, avec indices et annuler illimité.',
      suit: 'spades',
      index: 'A',
    },
    {
      mode: 'daily',
      title: 'Défi du jour',
      desc: 'La même donne pour tout le monde aujourd’hui.',
      suit: 'diamonds',
      index: String(today.getDate()),
    },
    {
      mode: 'chrono',
      title: 'Chrono',
      desc: 'Chaque seconde grignote ton bonus de vitesse.',
      suit: 'clubs',
      index: '3',
    },
    {
      mode: 'zen',
      title: 'Zen',
      desc: 'Ni score, ni chrono. On pose, on savoure.',
      suit: 'hearts',
      index: '0',
    },
  ];
}

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

/**
 * Inscription imprimee sur le tapis, comme la ligne courbe des tables de
 * blackjack ("Insurance pays 2 to 1"). Elle separe la vitrine des modes.
 */
function FeltPrint() {
  return (
    <svg className="felt-print" viewBox="0 0 1000 110" aria-hidden="true">
      <defs>
        <path id="felt-arc" d="M90 30 Q500 136 910 30" />
      </defs>
      <path
        d="M20 6 Q500 134 980 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M70 52 Q500 160 930 52"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <text className="felt-print__text">
        <textPath href="#felt-arc" startOffset="50%" textAnchor="middle">
          Le magot paie double · La banque ne pardonne pas
        </textPath>
      </text>
    </svg>
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
  const today = new Date();

  const meta = (mode: GameMode): ReactNode => {
    switch (mode) {
      case 'classic':
        return stats.gamesPlayed > 0
          ? `${percent(stats.gamesWon, stats.gamesPlayed)} % de victoires`
          : 'Pour se faire la main';
      case 'daily':
        return dailyDone ? (
          <span data-tone="done">Réussi aujourd&rsquo;hui</span>
        ) : (
          <span className="with-chip">
            <Chip size={13} /> 500 jetons à gagner
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

  const records: string[] = [];
  if (gambling.bestSecuredRun > 0)
    records.push(`record ${formatNumber(gambling.bestSecuredRun)} jetons`);
  if (gambling.longestStreak > 0)
    records.push(`série de ${gambling.longestStreak}`);
  if (gambling.vaultsOpened > 0)
    records.push(
      `${gambling.vaultsOpened} coffre${gambling.vaultsOpened > 1 ? 's' : ''} ouvert${gambling.vaultsOpened > 1 ? 's' : ''}`,
    );

  return (
    <div className="home scroll">
      <header className="topbar">
        <div className="topbar__brand">
          <Logo size={32} />
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
            <h1 className="brand">
              <span className="brand__jackpot">Jackpot</span>
              <span className="brand__solitaire">Solitaire</span>
            </h1>
            <p className="hero__tag">
              Gagne une manche, puis choisis: encaisser tes jetons, ou tout
              remettre en jeu sur la suivante.
            </p>
            <div className="hero__cta">
              <button
                className="btn btn--gold btn--lg"
                onClick={() => openModal('tables')}
              >
                Jouer au Jackpot
              </button>
              <button
                className={`btn btn--ghost btn--lg wheel-btn${canSpin ? ' is-ready' : ''}`}
                onClick={() => openModal('wheel')}
              >
                <WheelGlyph />
                {canSpin ? 'Roue du jour' : 'Roue demain'}
              </button>
            </div>
            {records.length > 0 && (
              <p className="hero__records">
                Ton meilleur: {records.join(', ')}.
              </p>
            )}
          </div>
          <HeroFan />
        </section>

        <FeltPrint />

        <ModeDeck
          cards={modeCards(today).map((m) => ({ ...m, meta: meta(m.mode) }))}
          onPick={(mode) =>
            newGame({
              mode,
              seed: mode === 'daily' ? dailySeed() : undefined,
            })
          }
        />

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
