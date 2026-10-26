import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowRightLeft,
  CalendarHeart,
  Check,
  Crown,
  DoorOpen,
  Gift,
  Infinity as InfinityIcon,
  Lock,
  Play,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Vault,
  Zap,
} from 'lucide-react';
import { Modal } from './Modal';
import { Preview } from './ShopModal';
import { RankBadge, RankEmblem } from './Rank';
import { BlackBalance, BlackChip, Chip } from './ui';
import { VictoryLayer } from './VictoryLayer';
import { useMetaStore } from '../state/meta';
import { useGameStore } from '../state/game';
import { economy, reportFailure } from '../state/economy';
import { playSound } from '../audio/sfx';
import {
  LEGEND_COLLECTIBLES,
  LEGEND_COSMETICS,
  SLOT_OF,
  STAKE_TABLES,
  canUnlock,
  meetsTier,
  ownsCosmetic,
  type Cosmetic,
} from '../state/catalog';
import {
  BLACK_CASH_SLICE,
  BLACK_DAILY,
  BLACK_PER_TABLE,
  BLACK_PER_WIN,
  BLACK_PROGRESSIVE,
  BLACK_VAULT_JACKPOT,
  BLACK_WHEEL,
  EXCHANGE_PACKS,
  EXCHANGE_RATE,
  LEGEND_PERKS,
  LEGEND_THRESHOLD,
  blackFor,
  blackRate,
  hasPerk,
  legendLabel,
  legendProgress,
  levelReward,
  roman,
  weeklyBlack,
  type LegendPerkId,
} from '../state/legend';
import { formatMultiplier, formatNumber } from '../utils/format';

type Tab = 'shop' | 'path' | 'black';

const PERK_ICON: Record<LegendPerkId, ReactNode> = {
  black: <BlackChip size={16} />,
  shop: <ShoppingBag size={15} />,
  exchange: <ArrowRightLeft size={15} />,
  gift: <Gift size={15} />,
  table: <DoorOpen size={15} />,
  wheel: <Sparkles size={15} />,
};

const CATEGORY_LABEL: Record<Cosmetic['category'], string> = {
  back: 'Dos de cartes',
  face: 'Recto',
  table: 'Tapis',
  fx: 'Effet de victoire',
  title: 'Titre',
  avatar: 'Avatar',
  frame: 'Cadre',
  card: 'Carte de profil',
};

/** Les niveaux montres sur la voie: au moins jusqu'au XV, et un peu au-dela. */
function pathLevels(level: number): number[] {
  const last = Math.max(15, level + 4);
  return Array.from({ length: last }, (_, i) => i + 1);
}

// ---------------------------------------------------------------------------
// Avant le rang: le sceau, ses deux epreuves et ce qu'il y a derriere.
// ---------------------------------------------------------------------------

function Seal() {
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const tableWins = useMetaStore((s) => s.legend.tableWins);
  const openModal = useGameStore((s) => s.openModal);
  const chipsDone = lifetime >= LEGEND_THRESHOLD;
  const tableDone = tableWins > 0;
  const diamond = meetsTier(lifetime, 'diamond');
  const legendTable = STAKE_TABLES.find((t) => t.id === 'legend')!;

  return (
    <div className="lg-seal">
      <section className="lg-seal__hero">
        <span className="lg-seal__emblem" aria-hidden="true">
          <RankEmblem tier="legend" size={96} />
          <span className="lg-seal__lock">
            <Lock size={18} />
          </span>
        </span>
        <div className="lg-seal__copy">
          <span className="lg-eyebrow">Au-delà du Diamant</span>
          <h3 className="lg-seal__title">Rang Légendaire</h3>
          <p>
            Le Diamant n&rsquo;est pas le sommet. Deux épreuves ouvrent la porte
            du Salon, et derrière, le vrai jeu commence.
          </p>
        </div>
      </section>

      <ol className="lg-trials" aria-label="Conditions d'accès">
        <li className="lg-trial" data-done={chipsDone}>
          <span className="lg-trial__mark" aria-hidden="true">
            {chipsDone ? <Check size={16} /> : <Chip size={18} />}
          </span>
          <div className="lg-trial__body">
            <strong>{formatNumber(LEGEND_THRESHOLD)} jetons gagnés</strong>
            <span>
              {chipsDone
                ? 'Épreuve réussie.'
                : `Encore ${formatNumber(LEGEND_THRESHOLD - lifetime)} jetons à gagner.`}
            </span>
            <span
              className="lg-trial__meter"
              role="progressbar"
              aria-label="Jetons gagnés"
              aria-valuemin={0}
              aria-valuemax={LEGEND_THRESHOLD}
              aria-valuenow={Math.min(lifetime, LEGEND_THRESHOLD)}
              style={
                {
                  '--p': Math.min(1, lifetime / LEGEND_THRESHOLD),
                } as CSSProperties
              }
            >
              <span />
            </span>
          </div>
        </li>
        <li className="lg-trial" data-done={tableDone}>
          <span className="lg-trial__mark" aria-hidden="true">
            {tableDone ? <Check size={16} /> : <Crown size={16} />}
          </span>
          <div className="lg-trial__body">
            <strong>Vaincre la Table Légende</strong>
            <span>
              {tableDone
                ? 'Épreuve réussie.'
                : diamond
                  ? `Gagne une manche à la Table Légende (mise ${formatNumber(legendTable.stake)}).`
                  : 'Gagne une manche à la Table Légende, ouverte au rang Diamant.'}
            </span>
          </div>
          {!tableDone && diamond && (
            <button
              className="btn btn--gold lg-trial__cta"
              onClick={() => openModal('tables')}
            >
              S&rsquo;asseoir
            </button>
          )}
        </li>
      </ol>

      <h3 className="lg-section">Ce qui t&rsquo;attend derrière la porte</h3>
      <ul className="lg-teasers">
        <li>
          <BlackChip size={34} />
          <strong>Les jetons noirs</strong>
          <span>Une seconde monnaie, gagnée à chaque victoire.</span>
        </li>
        <li>
          <span className="lg-teasers__icon">
            <ShoppingBag size={24} />
          </span>
          <strong>La Boutique Légendaire</strong>
          <span>{LEGEND_COSMETICS.length} objets introuvables ailleurs.</span>
        </li>
        <li>
          <span className="lg-teasers__icon">
            <InfinityIcon size={26} />
          </span>
          <strong>Des niveaux sans fin</strong>
          <span>Légendaire I, II, III… et plus on monte, plus ça paie.</span>
        </li>
      </ul>
      <ul className="lg-silhouettes" aria-hidden="true">
        {LEGEND_COSMETICS.filter((c) => c.price > 0)
          .slice(0, 6)
          .map((c) => (
            <li key={c.id}>
              <Preview item={c} avatar="ombre" frame="cadre-legende" />
              <span className="lg-silhouettes__q">?</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Une fois Legendaire
// ---------------------------------------------------------------------------

function Hero() {
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const legend = useMetaStore((s) => s.legend);
  const { into, step, progress } = legendProgress(lifetime, legend);
  const next = legend.level + 1;
  return (
    <section className="lg-hero">
      <RankEmblem
        tier="legend"
        level={legend.level}
        size={92}
        className="lg-hero__emblem"
      />
      <div className="lg-hero__body">
        <span className="lg-eyebrow">Ton rang</span>
        <RankBadge
          tier="legend"
          level={legend.level}
          emblem={false}
          className="lg-hero__rank"
        />
        <div
          className="lg-meter"
          role="progressbar"
          aria-label={`Progression vers ${legendLabel(next)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          style={{ '--p': progress } as CSSProperties}
        >
          <span className="lg-meter__fill" />
        </div>
        <div className="lg-hero__legend">
          <span>
            <strong>{formatNumber(into)}</strong> / {formatNumber(step)} de
            renom
          </span>
          <span>
            {legendLabel(next)} dans{' '}
            <strong>{formatNumber(step - into)}</strong> jetons gagnés
          </span>
        </div>
        <ul className="lg-hero__facts">
          <li>
            <BlackChip size={15} /> Jetons noirs{' '}
            <strong>×{formatMultiplier(blackRate(legend.level))}</strong>
          </li>
          <li>
            <Gift size={14} /> Prime du niveau {roman(next)}:{' '}
            <strong>+{levelReward(next)}</strong>
          </li>
        </ul>
      </div>
    </section>
  );
}

function LegendShop() {
  const [flash, setFlash] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [previewFx, setPreviewFx] = useState<string | null>(null);
  const equipped = useMetaStore((s) => s.equipped);
  const owned = useMetaStore((s) => s.inventory.owned);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const level = useMetaStore((s) => s.legend.level);
  const black = useMetaStore((s) => s.legend.black);
  const ownedSet = new Set(owned);
  const collected = LEGEND_COLLECTIBLES.filter((c) =>
    ownedSet.has(c.id),
  ).length;

  const act = async (item: Cosmetic) => {
    try {
      if (ownsCosmetic(item, owned, lifetime, level)) {
        await economy.equip(SLOT_OF[item.category], item.id);
        playSound('chip');
      } else {
        await economy.buyCosmetic(item.id);
        playSound('purchase');
        setFlash(item.id);
        setTimeout(() => setFlash((f) => (f === item.id ? null : f)), 900);
      }
    } catch (err) {
      playSound('invalid');
      setDenied(item.id);
      setTimeout(() => setDenied((d) => (d === item.id ? null : d)), 450);
      reportFailure(err);
    }
  };

  return (
    <>
      <div className="collection">
        <span>
          Collection légendaire{' '}
          <strong>
            {collected} / {LEGEND_COLLECTIBLES.length}
          </strong>
        </span>
        <span
          className="meter meter--thin lg-collection"
          style={
            { '--p': collected / LEGEND_COLLECTIBLES.length } as CSSProperties
          }
        >
          <span />
        </span>
      </div>
      <div className="shop-grid lg-shop">
        {LEGEND_COSMETICS.map((item) => {
          const isOwned = ownsCosmetic(item, owned, lifetime, level);
          const isEquipped = equipped[SLOT_OF[item.category]] === item.id;
          const locked = !isOwned && !canUnlock(item, lifetime, level);
          const poor = !isOwned && !locked && black < item.price;
          return (
            <article
              key={item.id}
              className="item item--legend"
              data-locked={locked}
              data-grail={item.grail ? 'true' : undefined}
              data-equipped={isEquipped}
              data-flash={flash === item.id}
              data-denied={denied === item.id}
            >
              <Preview
                item={item}
                avatar={equipped.avatar}
                frame={equipped.frame}
              />
              <span className="item__badges">
                <span className="lg-level-tag">
                  {legendLabel(item.minLevel ?? 1)}
                </span>
                {item.grail && <span className="grail-tag">Graal</span>}
              </span>
              {locked && (
                <span className="item__lock" aria-hidden="true">
                  <Lock size={18} />
                </span>
              )}
              {item.category === 'fx' && (
                <button
                  className="item__peek"
                  onClick={() => setPreviewFx(item.id)}
                  aria-label={`Aperçu de l'effet ${item.label}`}
                >
                  <Play size={14} /> Aperçu
                </button>
              )}
              <div className="item__body">
                <span className="lg-kind">{CATEGORY_LABEL[item.category]}</span>
                <h3 className="item__name">{item.label}</h3>
                <p className="item__hint">{item.hint}</p>
              </div>
              <button
                className={`item__action${isEquipped ? ' is-equipped' : isOwned ? ' is-owned' : ''}`}
                onClick={() => act(item)}
                disabled={isEquipped || locked}
                aria-label={
                  isEquipped
                    ? `${item.label}, équipé`
                    : isOwned
                      ? `Équiper ${item.label}`
                      : locked
                        ? `${item.label}, au niveau ${legendLabel(item.minLevel ?? 1)}`
                        : `Acheter ${item.label} pour ${item.price} jetons noirs`
                }
              >
                {isEquipped ? (
                  <>
                    <Check size={16} /> Équipé
                  </>
                ) : isOwned ? (
                  item.price === 0 ? (
                    'Offert · Équiper'
                  ) : (
                    'Équiper'
                  )
                ) : locked ? (
                  <>
                    <Lock size={14} /> Niveau {roman(item.minLevel ?? 1)}
                  </>
                ) : (
                  <>
                    <span className="price">
                      <BlackChip size={16} />
                      {formatNumber(item.price)}
                    </span>
                    {poor && (
                      <span className="item__poor">
                        il manque {item.price - black}
                      </span>
                    )}
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
      {previewFx && (
        <VictoryLayer
          fx={previewFx}
          preview
          onDone={() => setPreviewFx(null)}
        />
      )}
    </>
  );
}

type StepState = 'done' | 'current' | 'next' | 'locked';

function LegendPath() {
  const level = useMetaStore((s) => s.legend.level);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const legend = useMetaStore((s) => s.legend);
  const { progress } = legendProgress(lifetime, legend);
  const stateOf = (n: number): StepState =>
    n < level
      ? 'done'
      : n === level
        ? 'current'
        : n === level + 1
          ? 'next'
          : 'locked';

  return (
    <>
      <p className="lg-lead">
        Chaque jeton gagné compte comme du <strong>renom</strong>. Chaque niveau
        en demande 100 000 de plus que le précédent, verse sa prime en jetons
        noirs et augmente tous tes gains de jetons noirs de 10 %.
      </p>
      <ol className="lg-path" aria-label="Voie légendaire">
        {pathLevels(level).map((n) => {
          const state = stateOf(n);
          const perks = LEGEND_PERKS.filter((p) => p.level === n);
          const items = LEGEND_COSMETICS.filter((c) => (c.minLevel ?? 1) === n);
          return (
            <li
              key={n}
              className="lg-step"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="lg-step__node" aria-hidden="true">
                {roman(n)}
              </span>
              <div className="lg-step__card">
                <div className="lg-step__head">
                  <strong>{legendLabel(n)}</strong>
                  {n > 1 && (
                    <span className="lg-step__prize">
                      <BlackChip size={14} /> +{levelReward(n)}
                    </span>
                  )}
                  <span className="lg-step__status">
                    {state === 'done' && (
                      <>
                        <Check size={13} /> Atteint
                      </>
                    )}
                    {state === 'current' && 'Ton niveau'}
                    {state === 'next' && `${Math.round(progress * 100)} %`}
                    {state === 'locked' && <Lock size={12} />}
                  </span>
                </div>
                {state === 'next' && (
                  <span
                    className="lg-step__meter"
                    style={{ '--p': progress } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                )}
                {(perks.length > 0 || items.length > 0) && (
                  <ul className="lg-step__unlocks">
                    {perks.map((p) => (
                      <li key={p.id}>
                        <span className="lg-step__icon">{PERK_ICON[p.id]}</span>
                        <span>
                          <strong>{p.label}</strong> · {p.detail}
                        </span>
                      </li>
                    ))}
                    {items.map((c) => (
                      <li key={c.id}>
                        <span className="lg-step__icon">
                          <ShoppingBag size={14} />
                        </span>
                        <span>
                          <strong>{c.label}</strong> ·{' '}
                          {CATEGORY_LABEL[c.category].toLowerCase()}
                          {c.price === 0 ? ', offert' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
        <li className="lg-step lg-step--beyond" data-state="locked">
          <span className="lg-step__node" aria-hidden="true">
            <InfinityIcon size={18} />
          </span>
          <div className="lg-step__card">
            <strong>Et ainsi de suite, sans fin</strong>
            <span>
              Chaque niveau suivant verse sa prime et ajoute 10 % à tes gains de
              jetons noirs.
            </span>
          </div>
        </li>
      </ol>
    </>
  );
}

function Source({
  icon,
  label,
  base,
  level,
  unit,
  note,
}: {
  icon: ReactNode;
  label: string;
  base: number;
  level: number;
  unit?: string;
  note?: string;
}) {
  return (
    <li className="lg-source">
      <span className="lg-source__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="lg-source__label">
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className="lg-source__value">
        <BlackChip size={15} />+{blackFor(base, level)}
        {unit && <small>{unit}</small>}
      </span>
    </li>
  );
}

function BlackChips() {
  const level = useMetaStore((s) => s.legend.level);
  const balance = useMetaStore((s) => s.wallet.balance);
  const [busy, setBusy] = useState(false);

  const exchange = async (amount: number) => {
    setBusy(true);
    try {
      await economy.exchange(amount);
      playSound('coins');
    } catch (err) {
      reportFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="lg-lead">
        Les montants tiennent compte de ton niveau: tes gains de jetons noirs
        sont multipliés par{' '}
        <strong>×{formatMultiplier(blackRate(level))}</strong>.
      </p>
      <ul className="lg-sources">
        <Source
          icon={<Trophy size={16} />}
          label="Victoire en Normal"
          base={BLACK_PER_WIN.normal}
          level={level}
          note="Rien en Facile"
        />
        <Source
          icon={<Trophy size={16} />}
          label="Victoire en Difficile"
          base={BLACK_PER_WIN.hard}
          level={level}
        />
        <Source
          icon={<Target size={16} />}
          label="Victoire en Expert"
          base={BLACK_PER_WIN.expert}
          level={level}
        />
        <Source
          icon={<Crown size={16} />}
          label="Bonus de la Table Légende"
          base={BLACK_PER_TABLE.legend ?? 0}
          level={level}
          note="par manche gagnée"
        />
        <Source
          icon={<DoorOpen size={16} />}
          label="Bonus de la Table Noire"
          base={BLACK_PER_TABLE.noire ?? 0}
          level={level}
          note={
            hasPerk(level, 'table') ? 'par manche gagnée' : 'Légendaire III'
          }
        />
        <Source
          icon={<Vault size={16} />}
          label="Magot encaissé"
          base={1}
          level={level}
          unit={`/ ${formatNumber(BLACK_CASH_SLICE)}`}
        />
        <Source
          icon={<CalendarHeart size={16} />}
          label="Défi du jour réussi"
          base={BLACK_DAILY}
          level={level}
        />
        <Source
          icon={<Zap size={16} />}
          label="Gros lot ×10 au coffre-fort"
          base={BLACK_VAULT_JACKPOT}
          level={level}
        />
        <Source
          icon={<Sparkles size={16} />}
          label="Jackpot progressif"
          base={BLACK_PROGRESSIVE}
          level={level}
        />
        <Source
          icon={<Sparkles size={16} />}
          label="Roue noire, chaque jour"
          base={BLACK_WHEEL}
          level={level}
          note={hasPerk(level, 'wheel') ? undefined : 'Légendaire V'}
        />
        <li className="lg-source">
          <span className="lg-source__icon" aria-hidden="true">
            <Gift size={16} />
          </span>
          <span className="lg-source__label">
            Coffret noir, chaque semaine
            {level < 2 && <small>Légendaire II</small>}
          </span>
          <span className="lg-source__value">
            <BlackChip size={15} />+{weeklyBlack(Math.max(2, level))}
          </span>
        </li>
      </ul>

      <section className="lg-exchange" aria-label="Bureau de change">
        <div className="lg-exchange__head">
          <span className="lg-exchange__icon" aria-hidden="true">
            <ArrowRightLeft size={20} />
          </span>
          <div>
            <h3>Bureau de change</h3>
            <p>
              Trop de jetons dans ta banque ? Le croupier les échange au cours
              fixe de <strong>{formatNumber(EXCHANGE_RATE)}</strong> pour un
              jeton noir.
            </p>
          </div>
        </div>
        <div className="lg-exchange__packs">
          {EXCHANGE_PACKS.map((n) => {
            const cost = n * EXCHANGE_RATE;
            const poor = balance < cost;
            return (
              <button
                key={n}
                className="lg-pack"
                disabled={busy || poor}
                onClick={() => exchange(n)}
                aria-label={`Échanger ${formatNumber(cost)} jetons contre ${n} jeton${n > 1 ? 's' : ''} noir${n > 1 ? 's' : ''}`}
              >
                <span className="lg-pack__get">
                  <BlackChip size={22} /> {n}
                </span>
                <span className="lg-pack__cost">
                  <Chip size={13} /> {formatNumber(cost)}
                </span>
                {poor && <span className="lg-pack__poor">trop cher</span>}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Le Salon Legendaire: boutique, voie des niveaux et jetons noirs. */
export function LegendModal({ onClose }: { onClose: () => void }) {
  const level = useMetaStore((s) => s.legend.level);
  const [tab, setTab] = useState<Tab>('shop');

  if (level < 1) {
    return (
      <Modal title="Salon Légendaire" onClose={onClose} size="lg">
        <div className="lg">
          <Seal />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Salon Légendaire"
      onClose={onClose}
      size="xl"
      aside={<BlackBalance className="balance--lg" />}
    >
      <div className="lg">
        <Hero />
        <div className="tabs lg-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'shop'}
            onClick={() => setTab('shop')}
          >
            <ShoppingBag size={15} /> Boutique
          </button>
          <button
            role="tab"
            aria-selected={tab === 'path'}
            onClick={() => setTab('path')}
          >
            <Crown size={15} /> Voie légendaire
          </button>
          <button
            role="tab"
            aria-selected={tab === 'black'}
            onClick={() => setTab('black')}
          >
            <BlackChip size={16} /> Jetons noirs
          </button>
        </div>
        <div role="tabpanel">
          {tab === 'shop' && <LegendShop />}
          {tab === 'path' && <LegendPath />}
          {tab === 'black' && <BlackChips />}
        </div>
      </div>
    </Modal>
  );
}
