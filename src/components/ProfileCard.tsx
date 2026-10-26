import type { CSSProperties } from 'react';
import type { MiniCard, PublicCard } from '../core';
import {
  VIP_TIERS,
  findCosmetic,
  nextVipTier,
  vipProgress,
} from '../state/catalog';
import { formatDuration, formatNumber, percent } from '../utils/format';
import { Portrait } from './Portrait';
import { RankBadge } from './Rank';
import { CardDecor } from './CardDecor';
import { legendLabel } from '../state/legend';

function memberSince(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * Carte de profil, facon carte a jouer: portrait encadre, rang, et
 * statistiques choisies. Son fond depend de la carte equipee.
 */
export function ProfileCard({
  card,
  className,
}: {
  card: PublicCard;
  className?: string;
}) {
  const tier = VIP_TIERS.find((t) => t.id === card.tier) ?? VIP_TIERS[0];
  const next = nextVipTier(card.lifetimeEarned);
  const level = card.legend ?? 0;
  const rankId = level > 0 ? 'legend' : tier.id;
  const title = findCosmetic(card.title);
  const since = memberSince(card.memberSince);
  const stats = [
    { label: 'Victoires', value: formatNumber(card.stats.gamesWon) },
    {
      label: 'Réussite',
      value: `${percent(card.stats.gamesWon, card.stats.gamesPlayed)} %`,
    },
    { label: 'Meilleure série', value: formatNumber(card.stats.bestWinStreak) },
    { label: 'Meilleur score', value: formatNumber(card.stats.bestScore) },
    {
      label: 'Record Jackpot',
      value: formatNumber(card.jackpot.bestSecuredRun),
    },
    {
      label: 'Record de temps',
      value: card.stats.bestTimeMs
        ? formatDuration(card.stats.bestTimeMs)
        : '—',
    },
  ];

  return (
    <article
      className={`pcard${className ? ` ${className}` : ''}`}
      data-style={card.profileCard}
      aria-label={`Carte de profil de ${card.pseudo}`}
    >
      <div className="pcard__shine" aria-hidden="true" />
      <CardDecor style={card.profileCard} />
      <header className="pcard__top">
        <span className="pcard__tier rank-pill" data-tier={rankId}>
          <RankBadge tier={rankId} level={level} size={18} />
        </span>
        {since && <span className="pcard__since">Depuis {since}</span>}
      </header>

      <Portrait
        avatar={card.avatar}
        frame={card.frame}
        size="44%"
        className="pcard__portrait"
      />

      <h3 className="pcard__name">{card.pseudo}</h3>
      {title && (
        <span className="plaque pcard__title" data-title={title.id}>
          {title.label}
        </span>
      )}

      <div className="pcard__progress" data-tier={rankId}>
        <span
          className="meter meter--thin"
          style={
            {
              '--p':
                level > 0
                  ? (card.legendProgress ?? 0)
                  : vipProgress(card.lifetimeEarned),
            } as CSSProperties
          }
        >
          <span />
        </span>
        <small>
          {level > 0
            ? `En route vers ${legendLabel(level + 1)}`
            : next
              ? `${formatNumber(next.threshold - card.lifetimeEarned)} jetons avant ${next.label}`
              : 'Face au sceau'}
        </small>
      </div>

      <dl className="pcard__stats">
        {stats.map((s) => (
          <div key={s.label} className="pcard__stat">
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="pcard__foot">
        <span>
          Collection {card.collection.owned}/{card.collection.total}
        </span>
        <span>
          Hauts faits {card.achievements.unlocked}/{card.achievements.total}
        </span>
        <span>{card.dailyDone} défis</span>
      </footer>
    </article>
  );
}

/** Ligne compacte d'un joueur (liste d'amis, demandes). */
export function PlayerRow({
  card,
  children,
  onOpen,
}: {
  card: MiniCard;
  children?: React.ReactNode;
  onOpen?: () => void;
}) {
  const tier = VIP_TIERS.find((t) => t.id === card.tier) ?? VIP_TIERS[0];
  const level = card.legend ?? 0;
  const title = findCosmetic(card.title);
  const body = (
    <>
      <Portrait avatar={card.avatar} frame={card.frame} size={46} />
      <span className="player-row__text">
        <strong>{card.pseudo}</strong>
        <span>
          <RankBadge
            tier={level > 0 ? 'legend' : tier.id}
            level={level}
            size={13}
            className="player-row__tier"
          />
          {title ? ` · ${title.label}` : ''}
        </span>
      </span>
    </>
  );
  return (
    <li className="player-row">
      {onOpen ? (
        <button
          className="player-row__main"
          onClick={onOpen}
          aria-label={`Voir la carte de ${card.pseudo}`}
        >
          {body}
        </button>
      ) : (
        <span className="player-row__main">{body}</span>
      )}
      {children && <span className="player-row__actions">{children}</span>}
    </li>
  );
}
