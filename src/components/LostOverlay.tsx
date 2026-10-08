import { Home as HomeIcon, LifeBuoy, ShieldCheck } from 'lucide-react';
import { useGameStore, isScoring, MODE_LABEL } from '../state/game';
import { useMetaStore } from '../state/meta';
import {
  discountedPrice,
  findConsumable,
  findCosmetic,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { tryBuy } from '../state/economy';
import { formatDuration, formatNumber } from '../utils/format';
import { Stage } from './Modal';
import { Chip } from './ui';

export function LostOverlay() {
  const lost = useGameStore((s) => s.lost);
  const mode = useGameStore((s) => s.mode);
  const titleId = useMetaStore((s) => s.equipped.title);
  const newGame = useGameStore((s) => s.newGame);
  const goHome = useGameStore((s) => s.goHome);
  const secondChance = useGameStore((s) => s.secondChance);
  const redeals = useMetaStore((s) => s.inventory.consumables.redeal);
  const balance = useMetaStore((s) => s.wallet.balance);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);

  const playerTitle = findCosmetic(titleId)?.label ?? 'Jackpot Solitaire';
  if (!lost) return null;
  const scoring = isScoring(mode);
  const timeUp = lost.reason === 'time';
  const redealPrice = discountedPrice(findConsumable('redeal').price, lifetime);
  const canBuyRedeal = redeals <= 0 && balance >= redealPrice;

  return (
    <Stage
      variant="ticket"
      label={timeUp ? 'Temps écoulé' : 'Donne bloquée'}
      tone="red"
    >
      <div className="ticket">
        <div className="ticket__head">
          <span className="ticket__house">{playerTitle}</span>
          <span>
            {MODE_LABEL[mode]} · {formatDuration(lost.timeMs)}
          </span>
        </div>
        <h2 className="ticket__title">
          {timeUp ? 'Temps écoulé' : 'Donne bloquée'}
        </h2>
        <span className="stamp stamp--big" aria-hidden="true">
          {timeUp ? '00:00' : 'Bloquée'}
        </span>
        <p className="ticket__text">
          {timeUp
            ? 'Les cinq minutes sont passées. Une prochaine donne, et cette fois le chrono ne te rattrapera pas.'
            : 'Plus aucune carte ne pourra jamais bouger, quoi que tu fasses. Même les meilleurs n’auraient pas pu la terminer.'}
        </p>

        {scoring && (
          <div className="tally">
            <div className="tally__line is-in">
              <span>Score final</span>
              <span className="tally__leader" aria-hidden="true" />
              <span className="tally__value">
                {formatNumber(lost.finalScore)}
              </span>
            </div>
            {lost.wasGambling && (
              <div className="tally__line tally__line--loss is-in">
                <span>Magot en péril</span>
                <span className="tally__leader" aria-hidden="true" />
                <span className="tally__value">
                  <Chip size={15} /> {formatNumber(lost.potLost)}
                </span>
              </div>
            )}
            {lost.betsLost > 0 && (
              <div className="tally__line tally__line--loss is-in">
                <span>Paris annexes perdus</span>
                <span className="tally__leader" aria-hidden="true" />
                <span className="tally__value">
                  −{formatNumber(lost.betsLost)}
                </span>
              </div>
            )}
            {lost.refund > 0 && (
              <div className="tally__line tally__line--gain is-in">
                <span>
                  <ShieldCheck size={15} /> Assurance
                </span>
                <span className="tally__leader" aria-hidden="true" />
                <span className="tally__value">
                  +{formatNumber(lost.refund)}
                </span>
              </div>
            )}
          </div>
        )}

        {lost.vegas && (
          <div className="tally">
            <div className="tally__line is-in">
              <span>Prix de la donne</span>
              <span className="tally__leader" aria-hidden="true" />
              <span className="tally__value">
                −{formatNumber(lost.vegas.stake)}
              </span>
            </div>
            <div className="tally__line tally__line--gain is-in">
              <span>
                {lost.vegas.cards} cartes × {lost.vegas.cardValue}
              </span>
              <span className="tally__leader" aria-hidden="true" />
              <span className="tally__value">
                +{formatNumber(lost.vegas.earned)}
              </span>
            </div>
            <div className="tally__line tally__line--total is-in">
              <span>Bilan de la donne</span>
              <span className="tally__leader" aria-hidden="true" />
              <span className="tally__value">
                {lost.vegas.net >= 0 ? '+' : '−'}
                {formatNumber(Math.abs(lost.vegas.net))}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="stage__actions is-in">
        {lost.wasGambling && (redeals > 0 || canBuyRedeal) && (
          <button
            className="btn btn--gold btn--lg btn--block"
            onClick={async () => {
              if (redeals <= 0) {
                if (!(await tryBuy('redeal'))) return;
                playSound('purchase');
              }
              await secondChance();
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
            Nouvelle donne
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
