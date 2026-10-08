import { ShieldCheck, Shield } from 'lucide-react';
import { useMetaStore } from '../state/meta';
import {
  INSURANCE_REFUND,
  discountedPrice,
  findConsumable,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatNumber } from '../utils/format';
import { Chip } from './ui';

/**
 * Interrupteur "assurer la prochaine manche", affiche avant un quitte ou
 * double. Si le joueur n'a pas d'assurance en reserve mais assez de jetons,
 * il peut en acheter une sur place.
 */
export function InsuranceToggle({
  value,
  onChange,
  pot,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  pot: number;
}) {
  const owned = useMetaStore((s) => s.inventory.consumables.insurance);
  const balance = useMetaStore((s) => s.wallet.balance);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const buy = useMetaStore((s) => s.buyConsumable);
  const price = discountedPrice(findConsumable('insurance').price, lifetime);
  const refund = Math.round(pot * INSURANCE_REFUND);

  if (owned <= 0) {
    if (balance < price) return null;
    return (
      <button
        className="insure insure--buy"
        onClick={(e) => {
          e.stopPropagation();
          if (buy('insurance') === 'ok') {
            playSound('purchase');
            onChange(true);
          }
        }}
      >
        <Shield size={18} />
        <span className="insure__text">
          <strong>Assurer la manche</strong>
          <small>Récupère {formatNumber(refund)} si tu perds</small>
        </span>
        <span className="insure__price">
          <Chip size={14} /> {formatNumber(price)}
        </span>
      </button>
    );
  }

  return (
    <button
      className="insure"
      role="switch"
      aria-checked={value}
      onClick={(e) => {
        e.stopPropagation();
        playSound('chip');
        onChange(!value);
      }}
    >
      {value ? <ShieldCheck size={18} /> : <Shield size={18} />}
      <span className="insure__text">
        <strong>{value ? 'Manche assurée' : 'Assurer la manche'}</strong>
        <small>
          {value
            ? `${formatNumber(refund)} sauvés en cas de perte`
            : `${owned} assurance${owned > 1 ? 's' : ''} en réserve`}
        </small>
      </span>
      <span className="switch" aria-hidden="true" data-on={value} />
    </button>
  );
}
