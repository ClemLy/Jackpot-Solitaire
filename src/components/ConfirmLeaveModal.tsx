import { useGameStore } from '../state/game';
import { formatNumber } from '../utils/format';

export function ConfirmLeaveModal() {
  const pot = useGameStore((s) => s.pot);
  const confirmPendingAction = useGameStore((s) => s.confirmPendingAction);
  const cancelPendingAction = useGameStore((s) => s.cancelPendingAction);

  return (
    <div className="modal" style={{ zIndex: 340 }}>
      <div className="casino">
        <div className="casino__title is-lose">Attention au magot !</div>
        <p className="muted" style={{ margin: '0.6rem 0' }}>
          Tu as {formatNumber(pot)} points en jeu dans cette série de quitte ou
          double. Partir ou relancer maintenant fait retomber le magot à zéro,
          comme un abandon.
        </p>
        <div className="casino__actions">
          <button
            className="btn btn--green btn--lg"
            onClick={cancelPendingAction}
          >
            Continuer la partie
          </button>
          <button
            className="btn btn--red btn--lg"
            onClick={confirmPendingAction}
          >
            Abandonner et perdre {formatNumber(pot)} points
          </button>
        </div>
      </div>
    </div>
  );
}
