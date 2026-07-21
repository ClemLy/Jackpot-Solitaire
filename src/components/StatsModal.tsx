import { useState } from 'react';
import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { ACHIEVEMENTS } from '../state/achievements';
import { formatDuration, formatNumber, percent } from '../utils/format';

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

export function StatsModal({ onClose }: { onClose: () => void }) {
  const stats = useMetaStore((s) => s.stats);
  const gambling = useMetaStore((s) => s.gambling);
  const daily = useMetaStore((s) => s.daily);
  const achievements = useMetaStore((s) => s.achievements);
  const resetProgress = useMetaStore((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);

  const avgTime =
    stats.gamesWon > 0
      ? formatDuration(stats.sumWinTimeMs / stats.gamesWon)
      : '--:--';
  const avgMoves =
    stats.gamesWon > 0 ? Math.round(stats.sumWinMoves / stats.gamesWon) : 0;

  return (
    <Modal
      title="Statistiques"
      onClose={onClose}
      footer={
        confirm ? (
          <>
            <span className="muted">Tout effacer, sans retour possible ?</span>
            <button className="btn" onClick={() => setConfirm(false)}>
              Annuler
            </button>
            <button
              className="btn btn--red"
              onClick={() => {
                resetProgress();
                setConfirm(false);
              }}
            >
              Effacer
            </button>
          </>
        ) : (
          <button className="btn btn--ghost" onClick={() => setConfirm(true)}>
            Réinitialiser ma progression
          </button>
        )
      }
    >
      <div className="stack">
        <div className="stat-grid">
          <Stat
            k="Taux de victoire"
            v={`${percent(stats.gamesWon, stats.gamesPlayed)} %`}
          />
          <Stat k="Parties gagnées" v={formatNumber(stats.gamesWon)} />
          <Stat k="Parties jouées" v={formatNumber(stats.gamesPlayed)} />
          <Stat k="Série en cours" v={stats.currentWinStreak} />
          <Stat k="Meilleure série" v={stats.bestWinStreak} />
          <Stat
            k="Meilleur temps"
            v={stats.bestTimeMs ? formatDuration(stats.bestTimeMs) : '--:--'}
          />
          <Stat k="Temps moyen" v={avgTime} />
          <Stat k="Coups moyens" v={avgMoves} />
          <Stat k="Meilleur score" v={formatNumber(stats.bestScore)} />
        </div>

        <h3
          className="title"
          style={{ fontSize: '1.5rem', marginTop: '0.4rem' }}
        >
          Jackpot
        </h3>
        <div className="stat-grid">
          <Stat k="Banque sécurisée" v={formatNumber(gambling.secured)} />
          <Stat k="Record de magot" v={formatNumber(gambling.bestSecuredRun)} />
          <Stat k="Plus longue série" v={gambling.longestStreak} />
          <Stat k="Coffres ouverts" v={gambling.vaultsOpened} />
          <Stat k="Défis du jour" v={daily.completedDates.length} />
        </div>

        <h3
          className="title"
          style={{ fontSize: '1.5rem', marginTop: '0.4rem' }}
        >
          Hauts faits
        </h3>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = Boolean(achievements[a.id]);
            return (
              <div key={a.id} className={`ach${unlocked ? '' : ' is-locked'}`}>
                <span className="medal">{unlocked ? 'OK' : '?'}</span>
                <span>
                  <span className="t">{a.title}</span>
                  <br />
                  <span className="d">{a.description}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
