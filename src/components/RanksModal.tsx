import type { CSSProperties, ReactNode } from 'react';
import {
  Check,
  CircleUserRound,
  Crown,
  Infinity as InfinityIcon,
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
import { BlackChip, Chip } from './ui';
import { LEGEND_THRESHOLD, legendLabel, legendProgress } from '../state/legend';
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
  const legend = useMetaStore((s) => s.legend);
  const openModal = useGameStore((s) => s.openModal);
  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);
  const progress = vipProgress(lifetime);
  const legendary = legend.level >= 1;
  // Une fois Legendaire, le Diamant lui-meme est un rang depasse.
  const current = legendary ? VIP_TIERS.length : tierIndex(tier.id);
  const legendState: StepState = legendary
    ? 'current'
    : current === VIP_TIERS.length - 1
      ? 'next'
      : 'locked';

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
      {legendary ? (
        <LegendHero />
      ) : (
        <section className="rk-hero" data-tier={tier.id}>
          <RankEmblem tier={tier.id} size={84} className="rk-hero__emblem" />
          <div className="rk-hero__body">
            <span className="rk-hero__eyebrow">Ton rang</span>
            <RankBadge
              tier={tier.id}
              emblem={false}
              className="rk-hero__rank"
            />
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
                <strong>{formatNumber(lifetime)}</strong> jetons gagnés. Le
                Diamant n&rsquo;est pas le sommet: un rang Légendaire attend
                plus haut.
              </p>
            )}
          </div>
        </section>
      )}

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
        <LegendStep state={legendState} />
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

/** En tete de l'ecran une fois Legendaire: le niveau et la suite. */
function LegendHero() {
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const legend = useMetaStore((s) => s.legend);
  const openModal = useGameStore((s) => s.openModal);
  const lp = legendProgress(lifetime, legend);
  return (
    <section className="rk-hero" data-tier="legend">
      <RankEmblem
        tier="legend"
        level={legend.level}
        size={84}
        className="rk-hero__emblem"
      />
      <div className="rk-hero__body">
        <span className="rk-hero__eyebrow">Ton rang</span>
        <RankBadge
          tier="legend"
          level={legend.level}
          emblem={false}
          className="rk-hero__rank"
        />
        <div
          className="rk-meter"
          role="progressbar"
          aria-label={`Progression vers ${legendLabel(legend.level + 1)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(lp.progress * 100)}
          style={{ '--p': lp.progress } as CSSProperties}
        >
          <span className="rk-meter__fill" />
          <span className="rk-meter__pct">
            {Math.round(lp.progress * 100)} %
          </span>
        </div>
        <p className="rk-hero__next">
          Encore <strong>{formatNumber(lp.step - lp.into)}</strong> jetons à
          gagner pour{' '}
          <RankBadge tier="legend" level={legend.level + 1} size={16} />
          <button
            className="vip-banner__more rk-hero__salon"
            onClick={() => openModal('legend')}
          >
            Salon légendaire →
          </button>
        </p>
      </div>
    </section>
  );
}

/**
 * Derniere marche de l'echelle: le rang Legendaire. Ses deux epreuves sont
 * affichees des le depart, pour qu'on sache qu'il existe et comment y aller.
 */
function LegendStep({ state }: { state: StepState }) {
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const legend = useMetaStore((s) => s.legend);
  const openModal = useGameStore((s) => s.openModal);
  const chipsDone = lifetime >= LEGEND_THRESHOLD;
  const tableDone = legend.tableWins > 0;
  const legendary = legend.level >= 1;
  return (
    <li
      className="rk-step rk-step--legend"
      data-tier="legend"
      data-state={state}
      aria-current={state === 'current' ? 'step' : undefined}
    >
      <span className="rk-step__node" aria-hidden="true">
        <RankEmblem tier="legend" level={legend.level || 1} size={36} compact />
      </span>
      <div className="rk-step__card">
        <div className="rk-step__head">
          <RankBadge tier="legend" level={legend.level || 1} emblem={false} />
          <span className="rk-step__threshold">
            {legendary
              ? 'Puis des niveaux sans fin'
              : 'Le rang au-delà du Diamant'}
          </span>
          <span className="rk-step__status">
            {legendary ? (
              'Ton rang'
            ) : (
              <>
                <Lock size={12} /> {Number(chipsDone) + Number(tableDone)} / 2
                épreuves
              </>
            )}
          </span>
        </div>
        {!legendary && (
          <ul className="rk-trials">
            <li data-done={chipsDone}>
              {chipsDone ? <Check size={14} /> : <Chip size={14} />}
              <span>
                <strong>{formatNumber(LEGEND_THRESHOLD)} jetons gagnés</strong>
                {!chipsDone &&
                  ` · encore ${formatNumber(LEGEND_THRESHOLD - lifetime)}`}
              </span>
            </li>
            <li data-done={tableDone}>
              {tableDone ? <Check size={14} /> : <Crown size={14} />}
              <span>
                <strong>Gagner une manche à la Table Légende</strong>
                {!tableDone && ' · ouverte au rang Diamant'}
              </span>
            </li>
          </ul>
        )}
        <ul className="rk-perks">
          <Perk icon={<BlackChip size={14} />}>
            <strong>Jetons noirs</strong>, une seconde monnaie
          </Perk>
          <Perk icon={<ShoppingBag size={14} />}>
            <strong>Boutique Légendaire</strong> et bureau de change
          </Perk>
          <Perk icon={<InfinityIcon size={14} />}>
            Légendaire I, II, III… <strong>sans fin</strong>
          </Perk>
        </ul>
        <button
          className="vip-banner__more rk-step__salon"
          onClick={() => openModal('legend')}
        >
          {legendary ? 'Entrer dans le Salon →' : 'Découvrir le Salon →'}
        </button>
      </div>
    </li>
  );
}
