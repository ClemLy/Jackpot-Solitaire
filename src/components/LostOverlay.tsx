import { useGameStore } from '../state/game';
import { formatDuration, formatNumber } from '../utils/format';

export function LostOverlay() {
  const lost = useGameStore((s) => s.lost);
  const mode = useGameStore((s) => s.mode);
  const newGame = useGameStore((s) => s.newGame);
  const goHome = useGameStore((s) => s.goHome);

  if (!lost) return null;
  const scoring = mode !== 'zen';

  return (
    <div className="modal" style={{ zIndex: 320 }}>
      <div className="casino">
        <div className="casino__title is-lose">Plus aucun coup possible</div>
        <p className="muted" style={{ margin: '0.6rem 0' }}>
          Cette donne est désormais bloquée: aucune carte ne peut plus jamais
          bouger, quoi que tu fasses. Même les plus grands stratèges
          n&rsquo;auraient pas pu la terminer.
        </p>

        {scoring && (
          <div className="casino__break">
            <div className="line">
              <span>Temps écoulé</span>
              <span>{formatDuration(lost.timeMs)}</span>
            </div>
            <div className="line total">
              <span>Score final</span>
              <span>{formatNumber(lost.finalScore)}</span>
            </div>
            {lost.wasGambling && (
              <div className="line">
                <span>Magot perdu</span>
                <span>{formatNumber(lost.potLost)}</span>
              </div>
            )}
          </div>
        )}

        <div className="casino__actions">
          <button
            className="btn btn--green btn--lg"
            onClick={() => newGame({ mode })}
          >
            Nouvelle donne
          </button>
          <button className="btn" onClick={goHome}>
            Retour à l&rsquo;accueil
          </button>
        </div>
      </div>
    </div>
  );
}
