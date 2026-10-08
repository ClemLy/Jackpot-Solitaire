import type { CSSProperties, ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Settings,
  ShoppingBag,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import { accountsEnabled, useAccountStore } from '../state/account';
import type { VipTierId } from '../state/catalog';
import { Portrait } from './Portrait';
import { RankBadge, RankEmblem } from './Rank';
import { useGameStore, type GameMode } from '../state/game';
import { pendingRewards, useMetaStore } from '../state/meta';
import {
  CHRONO_LIMIT_MS,
  VEGAS_STAKE,
  findCosmetic,
  nextVipTier,
  vipProgress,
  vipTierFor,
} from '../state/catalog';
import { formatDuration, formatNumber, percent } from '../utils/format';
import { dailySeed, todayISO } from '../utils/seed';
import type { Card } from '../engine';
import { CardView } from './CardView';
import { Balance, Chip, RollingNumber } from './ui';
import { ModeDeck, type ModeCardData } from './ModeDeck';

type ModeCard = Omit<ModeCardData, 'meta'>;

// Les modes sont presentes comme des cartes posees sur le tapis. Le coin de
// chaque carte porte un petit clin d'oeil: le jour du mois pour le defi,
// cinq minutes pour le chrono, zero pression pour le zen, le sept porte-
// bonheur pour Vegas.
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
      desc: `${CHRONO_LIMIT_MS / 60000} minutes pour tout ranger. Chaque seconde restante rapporte.`,
      suit: 'clubs',
      index: String(CHRONO_LIMIT_MS / 60000),
    },
    {
      mode: 'vegas',
      title: 'Vegas',
      desc: `La donne coûte ${VEGAS_STAKE} jetons, chaque carte rangée en rapporte.`,
      suit: 'diamonds',
      index: '7',
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
  const titleId = useMetaStore((s) => s.equipped.title);
  const balance = useMetaStore((s) => s.wallet.balance);
  const progressive = useMetaStore((s) => s.progressive.pot);
  const pending = useMetaStore(pendingRewards);
  const tutorialDone = useMetaStore((s) => s.tutorial.done);
  const completeTutorial = useMetaStore((s) => s.completeTutorial);
  const startTutorial = useGameStore((s) => s.startTutorial);
  const avatar = useMetaStore((s) => s.equipped.avatar);
  const frame = useMetaStore((s) => s.equipped.frame);
  const account = useAccountStore();
  const title = findCosmetic(titleId);

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
      case 'vegas':
        return balance >= VEGAS_STAKE ? (
          <span className="with-chip">
            <Chip size={13} /> {VEGAS_STAKE} la donne
          </span>
        ) : (
          <span data-tone="warn">{VEGAS_STAKE} jetons requis</span>
        );
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
        <ProfilePlate
          avatar={avatar}
          frame={frame}
          tierId={tier.id}
          tierLabel={tier.label}
        />
        <div className="topbar__right">
          <button
            className="missions-pill"
            onClick={() => openModal('missions')}
            aria-label={
              pending > 0
                ? `Missions, ${pending} récompense${pending > 1 ? 's' : ''} à récupérer`
                : 'Missions'
            }
          >
            <Target size={15} />
            <span className="missions-pill__label">Missions</span>
            {pending > 0 && (
              <span className="missions-pill__badge">{pending}</span>
            )}
          </button>
          <button
            className="vip-pill rank-pill"
            data-tier={tier.id}
            onClick={() => openModal('shop')}
            aria-label={`Rang VIP ${tier.label}`}
            title={
              next
                ? `Encore ${formatNumber(next.threshold - lifetime)} jetons gagnés pour le rang ${next.label}`
                : 'Rang maximum atteint'
            }
          >
            <RankBadge tier={tier.id} size={20} />
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
        {!tutorialDone && stats.gamesPlayed === 0 && (
          <section className="welcome" aria-label="Bienvenue">
            <span className="welcome__icon" aria-hidden="true">
              <GraduationCap size={22} />
            </span>
            <div className="welcome__text">
              <strong>Première visite ?</strong>
              <span>
                Le croupier te montre les bases en une minute, sur une vraie
                donne.
              </span>
            </div>
            <div className="welcome__actions">
              <button className="btn btn--gold" onClick={startTutorial}>
                Suivre le tutoriel
              </button>
              <button className="btn btn--quiet" onClick={completeTutorial}>
                Plus tard
              </button>
            </div>
          </section>
        )}
        <section className="hero">
          <div className="hero__copy">
            <h1 className="brand">
              <span className="brand__jackpot">Jackpot</span>
              <span className="brand__solitaire">Solitaire</span>
            </h1>
            {title && (
              <button
                className="plaque plaque--hero"
                data-title={title.id}
                onClick={() => openModal('shop')}
                title="Changer de titre en boutique"
              >
                {title.label}
              </button>
            )}
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
            <button
              className="progressive"
              onClick={() => openModal('tables')}
              title="Gagne une manche Jackpot en Expert, à une table avec mise, sans aucune aide"
            >
              <span className="progressive__label">Jackpot progressif</span>
              <span className="progressive__value">
                <Chip size={18} />
                <RollingNumber value={progressive} />
              </span>
            </button>
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
          <button className="link-btn" onClick={() => openModal('profile')}>
            <UserRound size={18} /> Profil
          </button>
          {accountsEnabled && (
            <button className="link-btn" onClick={() => openModal('friends')}>
              <Users size={18} /> Amis
              {account.incoming > 0 && (
                <span className="link-btn__badge">{account.incoming}</span>
              )}
            </button>
          )}
          <button className="link-btn" onClick={() => openModal('missions')}>
            <Target size={18} /> Missions
          </button>
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

/**
 * Plaque de profil de l'accueil: portrait encadre, pseudo et rang. En invite
 * (comptes actives), elle invite a se connecter.
 */
function ProfilePlate({
  avatar,
  frame,
  tierId,
  tierLabel,
}: {
  avatar: string;
  frame: string;
  tierId: VipTierId;
  tierLabel: string;
}) {
  const account = useAccountStore();
  const openModal = useGameStore((s) => s.openModal);
  const online = account.status === 'online';
  const guest = accountsEnabled && !online;

  return (
    <button
      className="profile-plate"
      data-state={guest ? 'guest' : 'online'}
      data-tier={tierId}
      onClick={() => openModal(guest ? 'account' : 'profile')}
      aria-label={
        online
          ? `Mon profil: ${account.pseudo}, rang ${tierLabel}`
          : guest
            ? 'Se connecter ou créer un compte'
            : `Mon profil, rang ${tierLabel}`
      }
    >
      <span className="profile-plate__portrait">
        <Portrait avatar={avatar} frame={frame} size="100%" />
        {guest && (
          <RankEmblem
            tier={tierId}
            size={20}
            compact
            className="profile-plate__medal"
          />
        )}
        {online && account.incoming > 0 && (
          <span className="profile-plate__badge" aria-hidden="true">
            {account.incoming}
          </span>
        )}
      </span>
      <span className="profile-plate__text">
        <strong className="profile-plate__name">
          {online ? account.pseudo : 'Invité'}
        </strong>
        {account.status === 'loading' ? (
          <span className="profile-plate__sub">Connexion…</span>
        ) : guest ? (
          <span className="profile-plate__sub profile-plate__cta">
            Se connecter
          </span>
        ) : (
          <RankBadge
            tier={tierId}
            size={15}
            className="profile-plate__sub profile-plate__tier"
          />
        )}
      </span>
      <ChevronRight
        className="profile-plate__chev"
        size={16}
        aria-hidden="true"
      />
    </button>
  );
}
