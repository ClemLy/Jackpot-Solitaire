import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useGameStore } from '../state/game';
import { INSURANCE_REFUND } from '../state/catalog';
import { formatNumber } from '../utils/format';
import { Stage } from './Modal';
import { Chip } from './ui';

export function ConfirmLeaveModal() {
  const pot = useGameStore((s) => s.pot);
  const insured = useGameStore((s) => s.insured);
  const confirmPendingAction = useGameStore((s) => s.confirmPendingAction);
  const cancelPendingAction = useGameStore((s) => s.cancelPendingAction);

  return (
    <Stage label="Attention au magot" tone="red" onEscape={cancelPendingAction}>
      <span className="stage__icon" aria-hidden="true">
        <AlertTriangle size={26} />
      </span>
      <h2 className="stage__title stage__title--red">Attention au magot</h2>
      <p className="stage__text">
        Tu as <strong>{formatNumber(pot)} jetons</strong> en jeu. Partir ou
        relancer maintenant compte comme un abandon: le magot retombe à zéro.
      </p>
      {insured && (
        <p className="stage__note">
          <ShieldCheck size={16} /> Manche assurée:{' '}
          {formatNumber(Math.round(pot * INSURANCE_REFUND))} jetons te seront
          rendus.
        </p>
      )}
      <div className="stage__actions is-in">
        <button
          className="btn btn--emerald btn--lg btn--block"
          onClick={cancelPendingAction}
          autoFocus
        >
          Continuer la partie
        </button>
        <button
          className="btn btn--ghost btn--lg btn--block"
          onClick={confirmPendingAction}
        >
          Abandonner
          <span className="btn__amount btn__amount--loss">
            <Chip size={16} tone="red" /> -{formatNumber(pot)}
          </span>
        </button>
      </div>
    </Stage>
  );
}
