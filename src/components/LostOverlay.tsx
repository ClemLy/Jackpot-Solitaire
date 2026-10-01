import {
  ArrowRight,
  Home as HomeIcon,
  LifeBuoy,
  ShieldCheck,
} from 'lucide-react';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { discountedPrice, findConsumable } from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatDuration, formatNumber } from '../utils/format';
import { Stage } from './Modal';
import { Chip } from './ui';

export function LostOverlay() {
  const lost = useGameStore((s) => s.lost);
  const mode = useGameStore((s) => s.mode);
  const newGame = useGameStore((s) => s.newGame);
  const goHome = useGameStore((s) => s.goHome);
  const secondChance = useGameStore((s) => s.secondChance);
  const redeals = useMetaStore((s) => s.inventory.consumables.redeal);
  const balance = useMetaStore((s) => s.wallet.balance);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const buy = useMetaStore((s) => s.buyConsumable);

  if (!lost) return null;
  const scoring = mode !== 'zen';
  const redealPrice = discountedPrice(findConsumable('redeal').price, lifetime);
  const canBuyRedeal = redeals <= 0 && balance >= redealPrice;

  return (
    <Stage label="Donne bloquée" tone="red">
      <p className="stage__eyebrow">{formatDuration(lost.timeMs)} de jeu</p>
      <h2 className="stage__title stage__title--red">Donne bloquée</h2>
      <p className="stage__text">
        Plus aucune carte ne pourra jamais bouger, quoi que tu fasses. Même les
        meilleurs n&rsquo;auraient pas pu la terminer.
      </p>

      {scoring && (
        <div className="tally">
          <div className="tally__line is-in">
            <span>Score final</span>
            <span className="tally__value">
              {formatNumber(lost.finalScore)}
            </span>
          </div>
          {lost.wasGambling && (
            <div className="tally__line tally__line--loss is-in">
              <span>Magot en péril</span>
              <span className="tally__value">
                <Chip size={16} /> {formatNumber(lost.potLost)}
              </span>
            </div>
          )}
          {lost.refund > 0 && (
            <div className="tally__line tally__line--gain is-in">
              <span>
                <ShieldCheck size={15} /> Remboursé par l&rsquo;assurance
              </span>
              <span className="tally__value">+{formatNumber(lost.refund)}</span>
            </div>
          )}
        </div>
      )}

      <div className="stage__actions is-in">
        {lost.wasGambling && (redeals > 0 || canBuyRedeal) && (
          <button
            className="btn btn--gold btn--lg btn--block"
            onClick={() => {
              if (redeals <= 0 && buy('redeal') !== 'ok') return;
              playSound('purchase');
              secondChance();
            }}
          >
            <LifeBuoy size={20} />
            Seconde chance
            <span className="btn__amount">
              {redeals > 0 ? (
                `×${redeals}`
              ) : (
                <>
                  <Chip size={16} /> {formatNumber(redealPrice)}
                </>
              )}
            </span>
          </button>
        )}
        <div className="stage__duo">
          <button
            className="btn btn--emerald btn--lg"
            onClick={() => newGame({ mode })}
          >
            Nouvelle donne <ArrowRight size={18} />
          </button>
          <button className="btn btn--ghost btn--lg" onClick={goHome}>
            <HomeIcon size={16} /> Accueil
          </button>
        </div>
        {lost.wasGambling && (
          <p className="stage__fine">
            {lost.refund > 0
              ? 'En quittant, le magot est perdu mais l’assurance te rend sa part.'
              : 'En quittant, le magot est perdu.'}
          </p>
        )}
      </div>
    </Stage>
  );
}
