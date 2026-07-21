import { useGameStore } from '../state/game';
import { formatDuration, formatNumber } from '../utils/format';

export function WinOverlay() {
  const win = useGameStore((s) => s.win);
  const mode = useGameStore((s) => s.mode);
  const combo = useGameStore((s) => s.combo);
  const finalTimeMs = useGameStore((s) => s.finalTimeMs);
  const cashOut = useGameStore((s) => s.cashOut);
  const doubleOrNothing = useGameStore((s) => s.doubleOrNothing);
  const gambleFromScore = useGameStore((s) => s.gambleFromScore);
  const enterVault = useGameStore((s) => s.enterVault);
  const newGame = useGameStore((s) => s.newGame);
  const goHome = useGameStore((s) => s.goHome);

  if (!win) return null;
  const scoring = mode !== 'zen';
  const gambling = mode === 'gambling';

  return (
    <div className="modal" style={{ zIndex: 320 }}>
      <div className="casino">
        <div className="casino__title">C est gagne !</div>

        {scoring ? (
          <>
            {gambling ? (
              <>
                <div className="casino__pot">{formatNumber(win.potAfter)}</div>
                <div className="muted">Ton magot en jeu</div>
                {combo > 1 && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <span className="combo-badge">Serie x{combo} en cours</span>
                  </div>
                )}
              </>
            ) : (
              <div className="casino__pot">{formatNumber(win.roundScore)}</div>
            )}

            <div className="casino__break">
              <div className="line">
                <span>Points de la manche</span>
                <span>{formatNumber(win.baseScore)}</span>
              </div>
              <div className="line">
                <span>Bonus de vitesse ({formatDuration(finalTimeMs)})</span>
                <span>+{formatNumber(win.bonuses.speed)}</span>
              </div>
              {win.bonuses.precision > 0 && (
                <div className="line">
                  <span>Bonus de precision</span>
                  <span>+{formatNumber(win.bonuses.precision)}</span>
                </div>
              )}
              <div className="line total">
                <span>Score de la manche</span>
                <span>{formatNumber(win.roundScore)}</span>
              </div>
              {gambling && win.multiplier !== 1 && (
                <div className="line">
                  <span>Multiplicateur de serie</span>
                  <span>x{win.multiplier}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: '0.8rem 0' }}>
            Une partie tout en douceur. Rien a compter, juste le plaisir.
          </p>
        )}

        <div className="casino__actions">
          {gambling ? (
            <>
              {win.vaultEligible && (
                <button className="btn btn--gold btn--lg" onClick={enterVault}>
                  Ouvrir le coffre mystere
                </button>
              )}
              <button className="btn btn--green btn--lg" onClick={cashOut}>
                Encaisser {formatNumber(win.potAfter)} points
              </button>
              <button
                className="btn btn--red btn--lg"
                onClick={doubleOrNothing}
              >
                Quitte ou double
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn--green btn--lg"
                onClick={() => newGame({ mode })}
              >
                Nouvelle donne
              </button>
              {scoring && (
                <button
                  className="btn btn--gold btn--lg"
                  onClick={gambleFromScore}
                >
                  Miser ce score au Jackpot
                </button>
              )}
              <button className="btn" onClick={goHome}>
                Retour a l accueil
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
