import { useGameStore } from '../state/game';
import { formatNumber } from '../utils/format';

export function VaultOverlay() {
  const vaultResult = useGameStore((s) => s.vaultResult);
  const pot = useGameStore((s) => s.pot);
  const openVault = useGameStore((s) => s.openVault);
  const cashOut = useGameStore((s) => s.cashOut);
  const doubleOrNothing = useGameStore((s) => s.doubleOrNothing);

  return (
    <div className="modal" style={{ zIndex: 320 }}>
      <div className="casino">
        <div className="casino__title">Le coffre-fort mystère</div>
        <div className="vault">
          {!vaultResult ? (
            <>
              <p className="muted">
                Trois victoires de suite ! Touche le coffre pour tenter ta
                chance. Gros gain probable, mais gare au piège.
              </p>
              <button
                className="vault__chest"
                onClick={openVault}
                aria-label="Ouvrir le coffre"
              >
                <span className="lock" />
              </button>
            </>
          ) : (
            <>
              <div
                className={`vault__result ${vaultResult.trapped ? 'trap' : 'win'}`}
              >
                {vaultResult.trapped ? 'Coffre piégé !' : 'Jackpot !'} x
                {vaultResult.multiplier}
              </div>
              <div className="casino__pot">{formatNumber(pot)}</div>
              <div className="muted">
                {vaultResult.trapped
                  ? 'Aïe, le magot a fondu. On se refait ?'
                  : 'Le magot a pris de l’ampleur.'}
              </div>
              <div className="casino__actions">
                <button className="btn btn--green btn--lg" onClick={cashOut}>
                  Encaisser {formatNumber(pot)} points
                </button>
                <button
                  className="btn btn--red btn--lg"
                  onClick={doubleOrNothing}
                >
                  Quitte ou double
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
