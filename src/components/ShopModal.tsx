import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Check,
  Layers,
  Lock,
  Play,
  Rocket,
  Sparkles,
  Coins,
  Wine,
  Sun,
  Award,
  Moon,
  Orbit,
} from 'lucide-react';
import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { useGameStore } from '../state/game';
import {
  CARD_BACKS,
  CARD_FACES,
  COLLECTIBLES,
  TITLES,
  CONSUMABLES,
  TABLES,
  VICTORY_FX,
  VIP_TIERS,
  discountedPrice,
  meetsTier,
  nextVipTier,
  vipProgress,
  vipTierFor,
  AVATARS,
  FRAMES,
  PROFILE_CARDS,
  SLOT_OF,
  ownsCosmetic,
  type Consumable,
  type Cosmetic,
  type CosmeticCategory,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatMultiplier, formatNumber } from '../utils/format';
import type { Card } from '../engine';
import { CardView } from './CardView';
import { Balance, BlackChip, Chip } from './ui';
import { VictoryLayer } from './VictoryLayer';
import { ConsumableIcon } from './icons';
import { Portrait } from './Portrait';
import { CardDecor } from './CardDecor';
import { TableDecor } from './TableDecor';
import { RankBadge, RankEmblem } from './Rank';
import { ChevronRight, Lock as LockIcon } from 'lucide-react';
import {
  LEGEND_THRESHOLD,
  blackRate,
  legendLabel,
  legendProgress,
} from '../state/legend';
import { economy, reportFailure } from '../state/economy';

type Tab = CosmeticCategory | 'bonus';

const TABS: { id: Tab; label: string }[] = [
  { id: 'back', label: 'Dos de cartes' },
  { id: 'face', label: 'Recto des cartes' },
  { id: 'table', label: 'Tapis' },
  { id: 'fx', label: 'Effets de victoire' },
  { id: 'title', label: 'Titres' },
  { id: 'avatar', label: 'Avatars' },
  { id: 'frame', label: 'Cadres' },
  { id: 'card', label: 'Cartes de profil' },
  { id: 'bonus', label: 'Bonus' },
];

const LISTS: Record<CosmeticCategory, readonly Cosmetic[]> = {
  back: CARD_BACKS,
  face: CARD_FACES,
  table: TABLES,
  fx: VICTORY_FX,
  title: TITLES,
  avatar: AVATARS,
  frame: FRAMES,
  card: PROFILE_CARDS,
};

const BACK_CARD: Card = {
  id: 'preview-back',
  suit: 'spades',
  rank: 13,
  faceUp: false,
};
const FRONT_CARD: Card = {
  id: 'preview-front',
  suit: 'hearts',
  rank: 1,
  faceUp: true,
};
const FACE_KING: Card = {
  id: 'preview-king',
  suit: 'spades',
  rank: 13,
  faceUp: true,
};
const FACE_TEN: Card = {
  id: 'preview-ten',
  suit: 'hearts',
  rank: 10,
  faceUp: true,
};

const FX_ICON: Record<string, ReactNode> = {
  bounce: <Layers size={30} />,
  confetti: <Sparkles size={30} />,
  coins: <Coins size={30} />,
  fireworks: <Rocket size={30} />,
  champagne: <Wine size={30} />,
  goldbars: <Award size={30} />,
  supernova: <Sun size={30} />,
  'pluie-noire': <BlackChip size={34} />,
  'eclipse-totale': <Moon size={30} />,
  'trou-noir': <Orbit size={30} />,
};

export function Preview({
  item,
  avatar,
  frame,
}: {
  item: Cosmetic;
  avatar: string;
  frame: string;
}) {
  if (item.category === 'back') {
    return (
      <div className="preview preview--back" data-back-preview={item.id}>
        <div className="preview__card preview__card--a">
          <CardView card={BACK_CARD} style={{ top: 0, left: 0 }} />
        </div>
        <div className="preview__card preview__card--b">
          <CardView card={BACK_CARD} style={{ top: 0, left: 0 }} />
        </div>
      </div>
    );
  }
  if (item.category === 'table') {
    return (
      <div className="preview preview--table felt" data-table-preview={item.id}>
        <TableDecor table={item.id} preview />
        <div className="preview__card preview__card--a">
          <CardView card={BACK_CARD} style={{ top: 0, left: 0 }} />
        </div>
        <div className="preview__card preview__card--b">
          <CardView card={FRONT_CARD} style={{ top: 0, left: 0 }} />
        </div>
      </div>
    );
  }
  if (item.category === 'face') {
    return (
      <div className="preview preview--face" data-face-preview={item.id}>
        <div className="preview__card preview__card--a">
          <CardView card={FACE_KING} style={{ top: 0, left: 0 }} />
        </div>
        <div className="preview__card preview__card--b">
          <CardView card={FACE_TEN} style={{ top: 0, left: 0 }} />
        </div>
      </div>
    );
  }
  if (item.category === 'avatar') {
    return (
      <div className="preview preview--portrait">
        <Portrait avatar={item.id} frame="cadre-simple" size="62%" />
      </div>
    );
  }
  if (item.category === 'frame') {
    return (
      <div className="preview preview--portrait">
        <Portrait avatar={avatar} frame={item.id} size="62%" />
      </div>
    );
  }
  if (item.category === 'card') {
    return (
      <div className="preview preview--pcard">
        <div className="pcard-swatch" data-style={item.id}>
          <CardDecor style={item.id} />
          <Portrait avatar={avatar} frame={frame} size="46%" />
          <span className="pcard-swatch__line" />
          <span className="pcard-swatch__line pcard-swatch__line--short" />
        </div>
      </div>
    );
  }
  if (item.category === 'title') {
    return (
      <div className="preview preview--title">
        <span className="plaque" data-title={item.id}>
          {item.label}
        </span>
      </div>
    );
  }
  return (
    <div className="preview preview--fx" data-fx={item.id}>
      <span className="preview__medal">{FX_ICON[item.id]}</span>
    </div>
  );
}

/** Pastilles posees sur l'apercu: rang exclusif et piece maitresse. */
function Badges({ item }: { item: Cosmetic }) {
  const exclusive = item.minTier === 'platinum' || item.minTier === 'diamond';
  if (!exclusive && !item.grail) return null;
  return (
    <span className="item__badges">
      {exclusive && (
        <span className="tier-tag rank-pill" data-tier={item.minTier}>
          <RankBadge tier={item.minTier!} size={13} />
        </span>
      )}
      {item.grail && <span className="grail-tag">Graal</span>}
    </span>
  );
}

function Price({ price, base }: { price: number; base: number }) {
  return (
    <span className="price">
      <Chip size={15} />
      {formatNumber(price)}
      {price < base && <s className="price__was">{formatNumber(base)}</s>}
    </span>
  );
}

export function ShopModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('back');
  const [flash, setFlash] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [previewFx, setPreviewFx] = useState<string | null>(null);

  const equipped = useMetaStore((s) => s.equipped);
  const wallet = useMetaStore((s) => s.wallet);
  const owned = useMetaStore((s) => s.inventory.owned);
  const consumables = useMetaStore((s) => s.inventory.consumables);

  const openModal = useGameStore((s) => s.openModal);
  const lifetime = wallet.lifetimeEarned;
  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);
  const legend = useMetaStore((s) => s.legend);
  const legendary = legend.level >= 1;

  const celebrate = (id: string) => {
    playSound('purchase');
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 900);
  };
  const refuse = (id: string) => {
    playSound('invalid');
    setDenied(id);
    setTimeout(() => setDenied((d) => (d === id ? null : d)), 450);
  };

  const onCosmetic = async (item: Cosmetic) => {
    try {
      if (ownsCosmetic(item, owned, wallet.lifetimeEarned)) {
        await economy.equip(SLOT_OF[item.category], item.id);
        playSound(item.category === 'back' ? 'flip' : 'chip');
      } else {
        // Un objet achete s'equipe aussitot.
        await economy.buyCosmetic(item.id);
        celebrate(item.id);
      }
    } catch (err) {
      refuse(item.id);
      reportFailure(err);
    }
  };

  const onConsumable = async (item: Consumable) => {
    try {
      await economy.buyConsumable(item.id);
      celebrate(item.id);
    } catch (err) {
      refuse(item.id);
      reportFailure(err);
    }
  };

  const list: readonly Cosmetic[] = tab === 'bonus' ? [] : LISTS[tab];
  const ownedSet = new Set(owned);
  const collected = COLLECTIBLES.filter((c) => ownedSet.has(c.id)).length;
  const nextUnlocks = next
    ? COLLECTIBLES.filter((c) => c.minTier === next.id).length
    : 0;

  return (
    <Modal
      title="Boutique"
      onClose={onClose}
      size="xl"
      aside={<Balance className="balance--lg" />}
    >
      {legendary ? (
        <div className="vip-banner" data-tier="legend">
          <span className="vip-banner__badge">
            <RankEmblem tier="legend" level={legend.level} size="100%" />
          </span>
          <div className="vip-banner__body">
            <div className="vip-banner__line">
              <strong>
                Rang{' '}
                <RankBadge
                  tier="legend"
                  level={legend.level}
                  emblem={false}
                  className="vip-banner__rank"
                />
              </strong>
              <span className="vip-banner__perk">
                −{Math.round(tier.discount * 100)} % en boutique · jetons noirs
                ×{formatMultiplier(blackRate(legend.level))}
              </span>
            </div>
            <div
              className="meter"
              style={
                {
                  '--p': legendProgress(lifetime, legend).progress,
                } as CSSProperties
              }
            >
              <span />
            </div>
            <div className="vip-banner__next">
              Chaque jeton gagné te rapproche de {legendLabel(legend.level + 1)}
              .
            </div>
            <button
              className="vip-banner__more"
              onClick={() => openModal('legend')}
            >
              Ouvrir le Salon légendaire →
            </button>
          </div>
        </div>
      ) : (
        <div className="vip-banner" data-tier={tier.id}>
          <span className="vip-banner__badge">
            <RankEmblem tier={tier.id} size="100%" />
          </span>
          <div className="vip-banner__body">
            <div className="vip-banner__line">
              <strong>
                Rang{' '}
                <RankBadge
                  tier={tier.id}
                  emblem={false}
                  className="vip-banner__rank"
                />
              </strong>
              {tier.discount > 0 ? (
                <span className="vip-banner__perk">
                  −{Math.round(tier.discount * 100)} % en boutique · roue du
                  jour ×{formatMultiplier(tier.wheelBoost)}
                </span>
              ) : (
                <span className="vip-banner__perk">
                  Gagne des jetons pour monter en grade
                </span>
              )}
            </div>
            <div
              className="meter"
              style={
                {
                  '--p': next
                    ? vipProgress(lifetime)
                    : Math.min(1, lifetime / LEGEND_THRESHOLD),
                } as CSSProperties
              }
            >
              <span />
            </div>
            <div className="vip-banner__next">
              {next ? (
                <>
                  <strong>
                    {formatNumber(lifetime)} / {formatNumber(next.threshold)}
                  </strong>{' '}
                  · encore {formatNumber(next.threshold - lifetime)} pour{' '}
                  {next.label}: −{Math.round(next.discount * 100)} %, roue ×
                  {formatMultiplier(next.wheelBoost)} et {nextUnlocks} objets
                  exclusifs.
                </>
              ) : (
                <>
                  <strong>
                    {formatNumber(lifetime)} / {formatNumber(LEGEND_THRESHOLD)}
                  </strong>{' '}
                  · un dernier rang reste scellé.
                </>
              )}
            </div>
            <button
              className="vip-banner__more"
              onClick={() => openModal(next ? 'ranks' : 'legend')}
            >
              {next
                ? 'Voir tous les rangs et leurs avantages →'
                : 'Examiner le sceau →'}
            </button>
          </div>
          <ol className="vip-ladder" aria-label="Rangs VIP">
            {VIP_TIERS.map((t) => (
              <li
                key={t.id}
                data-tier={t.id}
                data-on={meetsTier(lifetime, t.id)}
              >
                <RankEmblem tier={t.id} size={14} compact />
                {t.label}
              </li>
            ))}
            <li data-tier="legend" data-on="false">
              <RankEmblem tier="legend" level={0} size={14} compact />
              ???
            </li>
          </ol>
        </div>
      )}

      <div className="collection">
        <span>
          Collection{' '}
          <strong>
            {collected} / {COLLECTIBLES.length}
          </strong>
        </span>
        <span
          className="meter meter--thin"
          style={{ '--p': collected / COLLECTIBLES.length } as CSSProperties}
        >
          <span />
        </span>
      </div>

      <button
        className="lg-entry"
        data-unlocked={legendary}
        onClick={() => openModal('legend')}
      >
        {legendary ? (
          <BlackChip size={34} className="lg-entry__chip" />
        ) : (
          <RankEmblem tier="legend" level={0} size={34} />
        )}
        <span className="lg-entry__text">
          <strong>
            {legendary ? 'Boutique Légendaire' : 'Vitrine scellée'}
          </strong>
          <span>
            {legendary
              ? `Des objets introuvables ailleurs, en jetons noirs. Solde: ${formatNumber(legend.black)}.`
              : 'Ses rideaux ne se lèvent que pour ceux qui ont brisé le sceau.'}
          </span>
        </span>
        {legendary ? (
          <ChevronRight size={18} aria-hidden="true" />
        ) : (
          <LockIcon size={16} aria-hidden="true" />
        )}
      </button>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="shop-grid" role="tabpanel">
        {tab !== 'bonus'
          ? list.map((item) => {
              const isOwned = ownsCosmetic(item, owned, lifetime);
              const isEquipped = equipped[SLOT_OF[item.category]] === item.id;
              const locked = !isOwned && !meetsTier(lifetime, item.minTier);
              const price = discountedPrice(item.price, lifetime);
              const poor = !isOwned && !locked && wallet.balance < price;
              const lockTier = VIP_TIERS.find((t) => t.id === item.minTier);
              return (
                <article
                  key={item.id}
                  className="item"
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
                  <Badges item={item} />
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
                    <h3 className="item__name">{item.label}</h3>
                    <p className="item__hint">{item.hint}</p>
                  </div>
                  <button
                    className={`item__action${isEquipped ? ' is-equipped' : isOwned ? ' is-owned' : ''}`}
                    onClick={() => onCosmetic(item)}
                    disabled={isEquipped || locked}
                    aria-label={
                      isEquipped
                        ? `${item.label}, équipé`
                        : isOwned
                          ? `Équiper ${item.label}`
                          : `Acheter ${item.label} pour ${price} jetons`
                    }
                  >
                    {isEquipped ? (
                      <>
                        <Check size={16} /> Équipé
                      </>
                    ) : isOwned ? (
                      'Équiper'
                    ) : locked ? (
                      <>
                        <Lock size={14} /> Rang {lockTier?.label}
                      </>
                    ) : (
                      <>
                        <Price price={price} base={item.price} />
                        {poor && <span className="item__poor">trop cher</span>}
                      </>
                    )}
                  </button>
                </article>
              );
            })
          : CONSUMABLES.map((item) => {
              const price = discountedPrice(item.price, lifetime);
              const count = consumables[item.id] ?? 0;
              return (
                <article
                  key={item.id}
                  className="item item--bonus"
                  data-flash={flash === item.id}
                  data-denied={denied === item.id}
                >
                  <div className="preview preview--fx">
                    <span className="preview__medal">
                      <ConsumableIcon id={item.id} size={30} />
                    </span>
                    {count > 0 && (
                      <span className="preview__count">×{count}</span>
                    )}
                  </div>
                  <div className="item__body">
                    <h3 className="item__name">{item.label}</h3>
                    <p className="item__hint">{item.hint}</p>
                  </div>
                  <button
                    className="item__action"
                    onClick={() => onConsumable(item)}
                    aria-label={`Acheter ${item.label} pour ${price} jetons`}
                  >
                    <Price price={price} base={item.price} />
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
    </Modal>
  );
}
