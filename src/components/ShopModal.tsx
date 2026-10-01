import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Check,
  Crown,
  Eye,
  Layers,
  LifeBuoy,
  Lock,
  Play,
  Rocket,
  Shield,
  Sparkles,
  Coins,
} from 'lucide-react';
import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import {
  CARD_BACKS,
  CONSUMABLES,
  TABLES,
  VICTORY_FX,
  VIP_TIERS,
  discountedPrice,
  meetsTier,
  nextVipTier,
  vipProgress,
  vipTierFor,
  type Consumable,
  type ConsumableId,
  type Cosmetic,
  type CosmeticCategory,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatNumber } from '../utils/format';
import type { Card } from '../engine';
import { CardView } from './CardView';
import { Balance, Chip } from './ui';
import { VictoryLayer } from './VictoryLayer';

type Tab = CosmeticCategory | 'bonus';

const TABS: { id: Tab; label: string }[] = [
  { id: 'back', label: 'Dos de cartes' },
  { id: 'table', label: 'Tapis' },
  { id: 'fx', label: 'Effets de victoire' },
  { id: 'bonus', label: 'Bonus' },
];

const SETTING_KEY: Record<
  CosmeticCategory,
  'cardBack' | 'table' | 'victoryFx'
> = {
  back: 'cardBack',
  table: 'table',
  fx: 'victoryFx',
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

const FX_ICON: Record<string, ReactNode> = {
  bounce: <Layers size={30} />,
  confetti: <Sparkles size={30} />,
  coins: <Coins size={30} />,
  fireworks: <Rocket size={30} />,
};

const BONUS_ICON: Record<ConsumableId, ReactNode> = {
  hint: <Eye size={30} />,
  insurance: <Shield size={30} />,
  redeal: <LifeBuoy size={30} />,
};

function Preview({ item }: { item: Cosmetic }) {
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
        <div className="preview__card preview__card--a">
          <CardView card={BACK_CARD} style={{ top: 0, left: 0 }} />
        </div>
        <div className="preview__card preview__card--b">
          <CardView card={FRONT_CARD} style={{ top: 0, left: 0 }} />
        </div>
      </div>
    );
  }
  return (
    <div className="preview preview--fx" data-fx={item.id}>
      <span className="preview__medal">{FX_ICON[item.id]}</span>
    </div>
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

  const settings = useMetaStore((s) => s.settings);
  const wallet = useMetaStore((s) => s.wallet);
  const owned = useMetaStore((s) => s.inventory.owned);
  const consumables = useMetaStore((s) => s.inventory.consumables);
  const buyCosmetic = useMetaStore((s) => s.buyCosmetic);
  const buyConsumable = useMetaStore((s) => s.buyConsumable);
  const updateSettings = useMetaStore((s) => s.updateSettings);

  const lifetime = wallet.lifetimeEarned;
  const tier = vipTierFor(lifetime);
  const next = nextVipTier(lifetime);

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

  const equip = (item: Cosmetic) => {
    updateSettings({ [SETTING_KEY[item.category]]: item.id });
    playSound(item.category === 'back' ? 'flip' : 'chip');
  };

  const onCosmetic = (item: Cosmetic) => {
    const isOwned = item.price === 0 || owned.includes(item.id);
    if (isOwned) {
      equip(item);
      return;
    }
    const result = buyCosmetic(item.id);
    if (result === 'ok') {
      celebrate(item.id);
      updateSettings({ [SETTING_KEY[item.category]]: item.id });
    } else {
      refuse(item.id);
    }
  };

  const onConsumable = (item: Consumable) => {
    if (buyConsumable(item.id) === 'ok') celebrate(item.id);
    else refuse(item.id);
  };

  const list: readonly Cosmetic[] =
    tab === 'back' ? CARD_BACKS : tab === 'table' ? TABLES : VICTORY_FX;

  return (
    <Modal
      title="Boutique"
      onClose={onClose}
      size="xl"
      aside={<Balance className="balance--lg" />}
    >
      <div className="vip-banner" data-tier={tier.id}>
        <span className="vip-banner__badge">
          <Crown size={18} />
        </span>
        <div className="vip-banner__body">
          <div className="vip-banner__line">
            <strong>Rang {tier.label}</strong>
            {tier.discount > 0 ? (
              <span className="vip-banner__perk">
                −{Math.round(tier.discount * 100)} % sur toute la boutique
              </span>
            ) : (
              <span className="vip-banner__perk">
                Gagne des jetons pour monter en grade
              </span>
            )}
          </div>
          <div
            className="meter"
            style={{ '--p': vipProgress(lifetime) } as CSSProperties}
          >
            <span />
          </div>
          <div className="vip-banner__next">
            {next
              ? `Encore ${formatNumber(next.threshold - lifetime)} jetons gagnés pour le rang ${next.label} (−${Math.round(next.discount * 100)} %)`
              : 'Rang maximum atteint. Respect.'}
          </div>
        </div>
        <ol className="vip-ladder" aria-label="Rangs VIP">
          {VIP_TIERS.map((t) => (
            <li key={t.id} data-tier={t.id} data-on={meetsTier(lifetime, t.id)}>
              {t.label}
            </li>
          ))}
        </ol>
      </div>

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
              const isOwned = item.price === 0 || owned.includes(item.id);
              const equipped = settings[SETTING_KEY[item.category]] === item.id;
              const locked = !isOwned && !meetsTier(lifetime, item.minTier);
              const price = discountedPrice(item.price, lifetime);
              const poor = !isOwned && !locked && wallet.balance < price;
              const lockTier = VIP_TIERS.find((t) => t.id === item.minTier);
              return (
                <article
                  key={item.id}
                  className="item"
                  data-equipped={equipped}
                  data-flash={flash === item.id}
                  data-denied={denied === item.id}
                >
                  <Preview item={item} />
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
                    className={`item__action${equipped ? ' is-equipped' : isOwned ? ' is-owned' : ''}`}
                    onClick={() => onCosmetic(item)}
                    disabled={equipped || locked}
                    aria-label={
                      equipped
                        ? `${item.label}, équipé`
                        : isOwned
                          ? `Équiper ${item.label}`
                          : `Acheter ${item.label} pour ${price} jetons`
                    }
                  >
                    {equipped ? (
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
                      {BONUS_ICON[item.id]}
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
