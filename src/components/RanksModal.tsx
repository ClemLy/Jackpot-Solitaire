import type { CSSProperties, ReactNode } from 'react';
import {
  Check,
  CircleUserRound,
  Gift,
  Lock,
  Percent,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Vault,
} from 'lucide-react';
import { Modal } from './Modal';
import { RankBadge, RankEmblem } from './Rank';
import { Chip } from './ui';
import { useMetaStore } from '../state/meta';
import { useGameStore } from '../state/game';
import {
  VIP_TIERS,
  findConsumable,
  nextVipTier,
  tierIndex,
  tierUnlocks,
  vipProgress,
  vipTierFor,
  type VipTier,
} from '../state/catalog';
import { formatMultiplier, formatNumber } from '../utils/format';

type StepState = 'done' | 'current' | 'next' | 'locked';

/** Les sources de jetons qui font monter le rang. */
const SOURCES: { icon: ReactNode; label: string }[] = [
  { icon: <Vault size={14} />, label: 'Encaisser un magot' },
  { icon: <Chip size={14} />, label: 'Pourboires des victoires' },
  { icon: <Trophy size={14} />, label: 'Hauts faits' },
  { icon: <Target size={14} />, label: 'Missions' },
  { icon: <Sparkles size={14} />, label: 'Roue du jour' },
];

function Perk({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="rk-perk">
      <span className="rk-perk__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Ce que le rang apporte, en une liste courte et concrete. */
function Perks({ tier }: { tier: VipTier }) {
  const u = tierUnlocks(tier.id);
  const names = u.exclusives.slice(0, 3).map((c) => c.label);
  const more = u.exclusives.length - names.length;
  return (
    <ul className="rk-perks">
      {tier.discount > 0 && (
        <Perk icon={<Percent size={14} />}>
          <strong>−{Math.round(tier.discount * 100)} %</strong> sur toute la
          boutique
        </Perk>
      )}
      {tier.wheelBoost > 1 && (
        <Perk icon={<Sparkles size={14} />}>
          Roue du jour <strong>×{formatMultiplier(tier.wheelBoost)}</strong>
        </Perk>
      )}
      {u.gift && (
        <Perk icon={<Gift size={14} />}>
          Coffret de la semaine:{' '}
          <strong>+ {findConsumable(u.gift).label}</strong>
        </Perk>
      )}
      {u.missionBonus > 0 && (
        <Perk icon={<Target size={14} />}>
          Missions <strong>+{Math.round(u.missionBonus * 100)} %</strong>
        </Perk>
      )}
      {u.tables.map((t) => (
        <Perk key={t.id} icon={<Chip size={14} />}>
          <strong>{t.label}</strong>
          {t.multiplier > 1 && <> · gains ×{formatMultiplier(t.multiplier)}</>}
        </Perk>
      ))}
      {u.gifts.map((c) => (
        <Perk key={c.id} icon={<CircleUserRound size={14} />}>
          Cadre offert: <strong>{c.label}</strong>
        </Perk>
      ))}
      {u.exclusives.length > 0 && (
        <Perk icon={<ShoppingBag size={14} />}>
          <strong>
            {u.exclusives.length} objet{u.exclusives.length > 1 ? 's' : ''}
          </strong>{' '}
          {tier.id === 'bronze' ? 'en boutique' : 'réservés'}:{' '}
          {names.join(', ')}
          {more > 0 ? `, et ${more} autre${more > 1 ? 's' : ''}` : ''}
        </Perk>
      )}
    </ul>
  );
}

/** Ecran des rangs VIP: ou j'en suis, comment monter, ce que ca rapporte. */
export function RanksModal({ onClose }: { onClose: () => void }) {
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const openModal = useGameStore((s) => s.openModal);
  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);
  const progress = vipProgress(lifetime);
  const current = tierIndex(tier.id);

  const stateOf = (i: number): StepState =>
    i < current
      ? 'done'
      : i === current
        ? 'current'
        : i === current + 1
          ? 'next'
          : 'locked';

  return (
    <Modal title="Rangs VIP" onClose={onClose} size="lg">
      <section className="rk-hero" data-tier={tier.id}>
        <RankEmblem tier={tier.id} size={84} className="rk-hero__emblem" />
        <div className="rk-hero__body">
          <span className="rk-hero__eyebrow">Ton rang</span>
          <RankBadge tier={tier.id} emblem={false} className="rk-hero__rank" />
          {next ? (
            <>
              <div
                className="rk-meter"
                role="progressbar"
                aria-label={`Progression vers le rang ${next.label}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                style={{ '--p': progress } as CSSProperties}
              >
                <span className="rk-meter__fill" />
                <span className="rk-meter__pct">
                  {Math.round(progress * 100)} %
                </span>
              </div>
              <div className="rk-hero__legend">
                <span>
                  <strong>{formatNumber(lifetime)}</strong> jetons gagnés
                </span>
                <span>
                  {next.label} à {formatNumber(next.threshold)}
                </span>
              </div>
              <p className="rk-hero__next">
                Encore{' '}
                <strong>{formatNumber(next.threshold - lifetime)}</strong>{' '}
                jetons à gagner pour passer{' '}
                <RankBadge tier={next.id} size={16} />
              </p>
            </>
          ) : (
            <p className="rk-hero__next">
              <strong>{formatNumber(lifetime)}</strong> jetons gagnés. Tu as
              atteint le rang le plus haut.
            </p>
          )}
        </div>
      </section>

      <section className="rk-how" aria-label="Comment monter de rang">
        <p>
          <TrendingUp size={16} aria-hidden="true" />
          <span>
            Ton rang suit le <strong>total de jetons gagnés</strong> depuis le
            début. Dépenser en boutique ou perdre une mise ne le fait{' '}
            <strong>jamais baisser</strong>.
          </span>
        </p>
        <ul className="rk-sources">
          {SOURCES.map((s) => (
            <li key={s.label}>
              {s.icon}
              {s.label}
            </li>
          ))}
        </ul>
      </section>

      <ol className="rk-ladder" aria-label="Tous les rangs">
        {VIP_TIERS.map((t, i) => {
          const state = stateOf(i);
          const missing = t.threshold - lifetime;
          return (
            <li
              key={t.id}
              className="rk-step"
              data-tier={t.id}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="rk-step__node" aria-hidden="true">
                <RankEmblem tier={t.id} size={36} compact />
              </span>
              <div className="rk-step__card">
                <div className="rk-step__head">
                  <RankBadge tier={t.id} emblem={false} />
                  <span className="rk-step__threshold">
                    {t.threshold === 0
                      ? 'Dès la première partie'
                      : `Dès ${formatNumber(t.threshold)} jetons gagnés`}
                  </span>
                  <span className="rk-step__status">
                    {state === 'done' && (
                      <>
                        <Check size={13} /> Atteint
                      </>
                    )}
                    {state === 'current' && 'Ton rang'}
                    {(state === 'next' || state === 'locked') && (
                      <>
                        <Lock size={12} /> Encore {formatNumber(missing)}
                      </>
                    )}
                  </span>
                </div>
                {state === 'next' && (
                  <div
                    className="rk-step__meter"
                    style={{ '--p': progress } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span />
                  </div>
                )}
                <Perks tier={t} />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rk-foot">
        <button className="btn btn--gold" onClick={() => openModal('shop')}>
          <ShoppingBag size={16} /> Voir la boutique
        </button>
        <button className="btn btn--ghost" onClick={() => openModal('tables')}>
          Jouer au Jackpot
        </button>
      </div>
    </Modal>
  );
}
