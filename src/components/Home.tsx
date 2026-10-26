import type { CSSProperties, ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Settings,
  ShoppingBag,
  Target,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { accountsEnabled, useAccountStore } from '../state/account';
import {
  LEGEND_THRESHOLD,
  legendLabel,
  legendProgress,
  type RankId,
} from '../state/legend';
import { Portrait } from './Portrait';
import { useTitleView } from './atelierView';
import { RankBadge, RankEmblem } from './Rank';
import { useGameStore, type GameMode } from '../state/game';
import { pendingRewards, useMetaStore, useRank } from '../state/meta';
import { ACHIEVEMENTS, unpaidAchievements } from '../state/achievements';
import {
  CHRONO_LIMIT_MS,
  COLLECTIBLES,
  VEGAS_STAKE,
  meetsTier,
  nextVipTier,
  vipProgress,
  vipTierFor,
} from '../state/catalog';
import { formatDuration, formatNumber, percent } from '../utils/format';
import { dailySeed, todayISO } from '../utils/seed';
import type { Card } from '../engine';
import { CardView } from './CardView';
import { Balance, BlackBalance, BlackChip, Chip, RollingNumber } from './ui';
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
  const unpaid = useMetaStore((s) => unpaidAchievements(s).length);
  const tutorialDone = useMetaStore((s) => s.tutorial.done);
  const completeTutorial = useMetaStore((s) => s.completeTutorial);
  const startTutorial = useGameStore((s) => s.startTutorial);
  const avatar = useMetaStore((s) => s.equipped.avatar);
  const frame = useMetaStore((s) => s.equipped.frame);
  const account = useAccountStore();
  const title = useTitleView(titleId);
  const legend = useMetaStore((s) => s.legend);
  const owned = useMetaStore((s) => s.inventory.owned);
  const achievementsDone = useMetaStore(
    (s) => Object.keys(s.achievements).length,
  );
  const rank = useRank();
  const ownedSet = new Set(owned);
  const collected = COLLECTIBLES.filter((c) => ownedSet.has(c.id)).length;
  // Le menu se cale sur son nombre de tuiles: jamais de tuile orpheline.
  const hubCount = 3 + Number(accountsEnabled) + Number(legend.level >= 1);

  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);
  const legendary = legend.level >= 1;
  const lp = legendProgress(lifetime, legend);
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
          rankId={rank.id}
          level={rank.level}
          rankLabel={rank.label}
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
          {legendary ? (
            <button
              className="vip-pill rank-pill"
              data-tier="legend"
              onClick={() => openModal('ranks')}
              aria-label={`Rang ${rank.label}`}
              title={`Encore ${formatNumber(lp.step - lp.into)} jetons gagnés pour ${legendLabel(legend.level + 1)}`}
            >
              <RankBadge tier="legend" level={legend.level} size={20} />
              <span
                className="vip-pill__bar"
                style={{ '--p': lp.progress } as CSSProperties}
              />
            </button>
          ) : (
            <button
              className="vip-pill rank-pill"
              data-tier={tier.id}
              onClick={() => openModal('ranks')}
              aria-label={`Rang VIP ${tier.label}`}
              title={
                next
                  ? `Encore ${formatNumber(next.threshold - lifetime)} jetons gagnés pour le rang ${next.label}`
                  : 'Un rang existe au-delà du Diamant'
              }
            >
              <RankBadge tier={tier.id} size={20} />
              <span
                className="vip-pill__bar"
                style={{ '--p': vipProgress(lifetime) } as CSSProperties}
              />
            </button>
          )}
          {legendary && (
            <button
              className="wallet-pill black-pill black-pill--top"
              onClick={() => openModal('legend')}
              aria-label={`${formatNumber(legend.black)} jetons noirs, Salon Légendaire`}
            >
              <BlackBalance />
            </button>
          )}
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
                data-title={title.style}
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
            {legendary && (
              // Sur telephone, la barre du haut n'a pas la place: le solde de
              // jetons noirs se range a cote du jackpot progressif.
              <button
                className="wallet-pill black-pill black-pill--hero"
                onClick={() => openModal('legend')}
                aria-label={`${formatNumber(legend.black)} jetons noirs, Salon Légendaire`}
              >
                <BlackBalance />
              </button>
            )}
            <RankTrack />
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

        <nav className="hub" aria-label="Menu">
          <div
            className="hub__tiles"
            data-count={hubCount}
            style={{ '--n': hubCount } as CSSProperties}
          >
            {legendary && (
              <HubTile
                tone="legend"
                icon={<BlackChip size={24} />}
                label="Salon légendaire"
                shortLabel="Le Salon"
                meta={`${formatNumber(legend.black)} jetons noirs`}
                onClick={() => openModal('legend')}
              />
            )}
            <HubTile
              icon={<ShoppingBag size={20} />}
              label="Boutique"
              meta={`${collected} / ${COLLECTIBLES.length} objets`}
              onClick={() => openModal('shop')}
            />
            <HubTile
              icon={<Trophy size={20} />}
              label="Hauts faits"
              meta={`${achievementsDone} / ${ACHIEVEMENTS.length}`}
              badge={unpaid}
              badgeLabel={`${unpaid} prime${unpaid > 1 ? 's' : ''} à toucher`}
              onClick={() => openModal('achievements')}
            />
            <HubTile
              icon={<BarChart3 size={20} />}
              label="Statistiques"
              meta={
                stats.gamesWon > 0
                  ? `${formatNumber(stats.gamesWon)} victoire${stats.gamesWon > 1 ? 's' : ''}`
                  : 'Aucune victoire'
              }
              onClick={() => openModal('stats')}
            />
            {accountsEnabled && (
              <HubTile
                icon={<Users size={20} />}
                label="Amis"
                meta={
                  account.status !== 'online'
                    ? 'Avec un compte'
                    : account.incoming > 0
                      ? `${account.incoming} demande${account.incoming > 1 ? 's' : ''}`
                      : 'Cartes et records'
                }
                badge={account.incoming}
                badgeLabel={`${account.incoming} demande${account.incoming > 1 ? 's' : ''} d’ami`}
                onClick={() => openModal('friends')}
              />
            )}
          </div>
          <div className="hub__more">
            <button className="hub__link" onClick={() => openModal('profile')}>
              <UserRound size={16} /> Profil
            </button>
            <button className="hub__link" onClick={() => openModal('rules')}>
              <BookOpen size={16} /> Règles
            </button>
            <button className="hub__link" onClick={() => openModal('settings')}>
              <Settings size={16} /> Réglages
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}

/** Raccourci du menu de l'accueil: icone, nom et etat en un coup d'oeil. */
function HubTile({
  icon,
  label,
  shortLabel,
  meta,
  badge = 0,
  badgeLabel,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  /** Nom abrege, sur telephone. */
  shortLabel?: string;
  meta: string;
  badge?: number;
  badgeLabel?: string;
  tone?: 'legend';
  onClick: () => void;
}) {
  return (
    <button
      className="hub-tile"
      data-tone={tone}
      onClick={onClick}
      aria-label={`${label}, ${meta}${badge > 0 && badgeLabel ? `, ${badgeLabel}` : ''}`}
    >
      <span className="hub-tile__icon" aria-hidden="true">
        {icon}
        {badge > 0 && <span className="hub-tile__badge">{badge}</span>}
      </span>
      <span className="hub-tile__text">
        <strong>
          {shortLabel ? (
            <>
              <span className="hub-tile__long">{label}</span>
              <span className="hub-tile__short">{shortLabel}</span>
            </>
          ) : (
            label
          )}
        </strong>
        <span>{meta}</span>
      </span>
      <ChevronRight className="hub-tile__chev" size={16} aria-hidden="true" />
    </button>
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
  rankId,
  level,
  rankLabel,
}: {
  avatar: string;
  frame: string;
  rankId: RankId;
  level: number;
  rankLabel: string;
}) {
  const account = useAccountStore();
  const openModal = useGameStore((s) => s.openModal);
  const online = account.status === 'online';
  const guest = accountsEnabled && !online;

  return (
    <button
      className="profile-plate"
      data-state={guest ? 'guest' : 'online'}
      data-tier={rankId}
      data-legend={rankId === 'legend' ? 'true' : undefined}
      onClick={() => openModal(guest ? 'account' : 'profile')}
      aria-label={
        online
          ? `Mon profil: ${account.pseudo}, rang ${rankLabel}`
          : guest
            ? 'Se connecter ou créer un compte'
            : `Mon profil, rang ${rankLabel}`
      }
    >
      <span className="profile-plate__portrait">
        <Portrait avatar={avatar} frame={frame} size="100%" />
        {guest && (
          <RankEmblem
            tier={rankId}
            level={level}
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
          <>
            <RankBadge
              tier={rankId}
              level={level}
              size={15}
              className="profile-plate__sub profile-plate__tier"
            />
            {rankId === 'legend' && (
              // Sur telephone, la plaque est etroite: "Lég. IV".
              <RankBadge
                tier="legend"
                level={level}
                size={15}
                short
                className="profile-plate__sub profile-plate__tier profile-plate__tier--short"
              />
            )}
          </>
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

/**
 * Raccourci de progression de l'accueil. Il suit le rang VIP, puis montre le
 * chemin vers le rang Legendaire une fois Diamant, puis le niveau suivant.
 */
function RankTrack() {
  const openModal = useGameStore((s) => s.openModal);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const legend = useMetaStore((s) => s.legend);
  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);

  if (legend.level >= 1) {
    const lp = legendProgress(lifetime, legend);
    const left = lp.step - lp.into;
    return (
      <button
        className="rank-track"
        data-tier="legend"
        onClick={() => openModal('ranks')}
        aria-label={`${legendLabel(legend.level)}: encore ${formatNumber(left)} jetons à gagner pour ${legendLabel(legend.level + 1)}. Voir les rangs.`}
      >
        <RankEmblem
          tier="legend"
          level={legend.level}
          size={34}
          compact
          className="rank-track__emblem"
        />
        <span className="rank-track__line">
          <RankBadge tier="legend" level={legend.level} emblem={false} />
          <span className="rank-track__next">
            <span className="rank-track__arrow" aria-hidden="true">
              →
            </span>
            <RankBadge tier="legend" level={legend.level + 1} emblem={false} />
          </span>
          <span className="rank-track__left">
            encore <strong>{formatNumber(left)}</strong>
          </span>
        </span>
        <span
          className="rank-track__meter"
          style={{ '--p': lp.progress } as CSSProperties}
          aria-hidden="true"
        >
          <span />
        </span>
      </button>
    );
  }

  // Diamant: le prochain pas, c'est le rang Legendaire et ses deux epreuves.
  if (!next && meetsTier(lifetime, 'diamond')) {
    const chipsLeft = Math.max(0, LEGEND_THRESHOLD - lifetime);
    const span = LEGEND_THRESHOLD - tier.threshold;
    const progress = Math.min(1, (lifetime - tier.threshold) / span);
    const needTable = legend.tableWins === 0;
    return (
      <button
        className="rank-track rank-track--sealed"
        data-tier={tier.id}
        onClick={() => openModal('ranks')}
        aria-label={`Rang ${tier.label}. Prochain: un rang scellé. ${chipsLeft > 0 ? `Encore ${formatNumber(chipsLeft)} jetons à gagner` : 'Million atteint'}${needTable ? ', et une victoire à la Table Légende' : ''}. Voir les rangs.`}
      >
        <RankEmblem
          tier={tier.id}
          size={34}
          compact
          className="rank-track__emblem"
        />
        <span className="rank-track__line">
          <RankBadge tier={tier.id} emblem={false} />
          <span className="rank-track__arrow" aria-hidden="true">
            →
          </span>
          <RankBadge tier="legend" level={0} emblem={false} />
          <span className="rank-track__left">
            {chipsLeft > 0 ? (
              <>
                encore <strong>{formatNumber(chipsLeft)}</strong>
              </>
            ) : needTable ? (
              <strong>Vaincre la Table Légende</strong>
            ) : null}
          </span>
        </span>
        <span
          className="rank-track__meter"
          style={{ '--p': progress } as CSSProperties}
          aria-hidden="true"
        >
          <span />
        </span>
      </button>
    );
  }

  return (
    <button
      className="rank-track"
      data-tier={tier.id}
      onClick={() => openModal('ranks')}
      aria-label={
        next
          ? `Rang ${tier.label}: encore ${formatNumber(next.threshold - lifetime)} jetons à gagner pour le rang ${next.label}. Voir les rangs.`
          : `Rang ${tier.label}. Voir les rangs.`
      }
    >
      <RankEmblem
        tier={tier.id}
        size={34}
        compact
        className="rank-track__emblem"
      />
      <span className="rank-track__line">
        <RankBadge tier={tier.id} emblem={false} />
        {next && (
          <>
            <span className="rank-track__arrow" aria-hidden="true">
              →
            </span>
            <RankBadge tier={next.id} emblem={false} />
            <span className="rank-track__left">
              encore <strong>{formatNumber(next.threshold - lifetime)}</strong>
            </span>
          </>
        )}
      </span>
      <span
        className="rank-track__meter"
        style={{ '--p': vipProgress(lifetime) } as CSSProperties}
        aria-hidden="true"
      >
        <span />
      </span>
    </button>
  );
}
