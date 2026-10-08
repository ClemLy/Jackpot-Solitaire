import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import {
  JOKER_IDS,
  discountedPrice,
  findConsumable,
  type JokerId,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatNumber } from '../utils/format';
import { ConsumableIcon } from './icons';
import { Chip } from './ui';

/** Pourquoi un joker ne peut pas servir maintenant (ou null s'il le peut). */
function unavailable(
  id: JokerId,
  board: ReturnType<typeof useGameStore.getState>['board'],
): string | null {
  if (id === 'peek') {
    const hidden = board.tableau.some((col) => col.some((c) => !c.faceUp));
    return hidden ? null : 'Plus aucune carte cachée';
  }
  if (id === 'reshuffle') {
    return board.stock.length + board.waste.length >= 2
      ? null
      : 'Pioche presque vide';
  }
  return null;
}

/**
 * Plateau des jokers, ouvert depuis le dock: chaque joker avec sa reserve,
 * et un achat sur place quand la reserve est vide.
 */
export function JokerTray({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const board = useGameStore((s) => s.board);
  const playJoker = useGameStore((s) => s.playJoker);
  const consumables = useMetaStore((s) => s.inventory.consumables);
  const balance = useMetaStore((s) => s.wallet.balance);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const buy = useMetaStore((s) => s.buyConsumable);

  // Fermeture au clic a l'exterieur ou avec Echap.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.('[data-joker-toggle]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="joker-tray" ref={ref} role="dialog" aria-label="Jokers">
      <p className="joker-tray__title">Jokers</p>
      <ul className="joker-tray__list">
        {JOKER_IDS.map((id) => {
          const item = findConsumable(id);
          const count = consumables[id] ?? 0;
          const price = discountedPrice(item.price, lifetime);
          const blocked = unavailable(id, board);
          return (
            <li key={id} className="joker" data-empty={count === 0}>
              <span className="joker__icon" aria-hidden="true">
                <ConsumableIcon id={id} size={20} />
                {count > 0 && <span className="joker__count">{count}</span>}
              </span>
              <span className="joker__body">
                <span className="joker__name">{item.label}</span>
                <span className="joker__hint">
                  {blocked ?? item.hint.replace(/^Joker: /, '')}
                </span>
              </span>
              {count > 0 ? (
                <button
                  className="btn btn--gold joker__action"
                  disabled={blocked !== null}
                  onClick={() => {
                    if (playJoker(id)) onClose();
                  }}
                >
                  Utiliser
                </button>
              ) : (
                <button
                  className="btn btn--ghost joker__action"
                  disabled={balance < price}
                  onClick={() => {
                    if (buy(id) === 'ok') playSound('purchase');
                  }}
                  aria-label={`Acheter ${item.label} pour ${price} jetons`}
                >
                  <Chip size={14} /> {formatNumber(price)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bandeau d'instruction quand un joker attend une action du joueur. */
export function JokerBanner() {
  const jokerArmed = useGameStore((s) => s.jokerArmed);
  const peekMode = useGameStore((s) => s.peekMode);
  const cancel = useGameStore((s) => s.cancelJoker);
  if (!jokerArmed && !peekMode) return null;
  return (
    <div className="joker-banner" role="status">
      <ConsumableIcon id={jokerArmed ? 'joker' : 'peek'} size={18} />
      <span>
        {jokerArmed
          ? 'Joker prêt: fais glisser une carte sur n’importe quelle colonne.'
          : 'Coup d’œil: touche une carte cachée pour la regarder.'}
      </span>
      <button
        className="joker-banner__close"
        onClick={cancel}
        aria-label="Annuler le joker"
      >
        <X size={16} />
      </button>
    </div>
  );
}
