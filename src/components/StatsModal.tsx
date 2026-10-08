import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { useGameStore } from '../state/game';
import { ACHIEVEMENTS } from '../state/achievements';
import { vipTierFor } from '../state/catalog';
import { formatDuration, formatNumber, percent } from '../utils/format';
import { todayISO } from '../utils/seed';
import { Chip } from './ui';

function Stat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat__v">{v}</div>
      <div className="stat__k">{k}</div>
    </div>
  );
}

function WinRing({ rate }: { rate: number }) {
  return (
    <div className="ring">
      <svg viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="17" className="ring__track" />
        <circle
          cx="21"
          cy="21"
          r="17"
          className="ring__fill"
          pathLength="100"
          style={{ strokeDasharray: `${rate} 100` }}
        />
      </svg>
      <span className="ring__label">
        <strong>{rate} %</strong>
        <small>victoires</small>
      </span>
    </div>
  );
}

/** Calendrier du mois en cours, les defis reussis y sont marques d'or. */
function DailyCalendar({ done }: { done: string[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // semaine qui commence lundi
  const iso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const doneSet = new Set(done);
  const count = Array.from({ length: days }, (_, i) => iso(i + 1)).filter((d) =>
    doneSet.has(d),
  ).length;
  const monthName = first.toLocaleDateString('fr-FR', { month: 'long' });
  const todayIso = todayISO();

  return (
    <div className="calendar">
      <div className="calendar__head">
        <strong>Défis de {monthName}</strong>
        <span>
          {count} / {days}
        </span>
      </div>
      <div className="calendar__grid">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="calendar__dow">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`o${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = iso(i + 1);
          return (
            <span
              key={d}
              className="calendar__day"
              data-done={doneSet.has(d)}
              data-today={d === todayIso}
              aria-label={doneSet.has(d) ? `${i + 1}, réussi` : `${i + 1}`}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function StatsModal({ onClose }: { onClose: () => void }) {
  const stats = useMetaStore((s) => s.stats);
  const gambling = useMetaStore((s) => s.gambling);
  const daily = useMetaStore((s) => s.daily);
  const wallet = useMetaStore((s) => s.wallet);
  const achievements = useMetaStore((s) => s.achievements);
  const resetProgress = useMetaStore((s) => s.resetProgress);
  const openModal = useGameStore((s) => s.openModal);
  const [confirm, setConfirm] = useState(false);

  const avgTime =
    stats.gamesWon > 0
      ? formatDuration(stats.sumWinTimeMs / stats.gamesWon)
      : '--:--';
  const avgMoves =
    stats.gamesWon > 0 ? Math.round(stats.sumWinMoves / stats.gamesWon) : 0;
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;

  return (
    <Modal
      title="Statistiques"
      onClose={onClose}
      size="lg"
      footer={
        confirm ? (
          <>
            <span className="muted">Tout effacer, sans retour possible ?</span>
            <button
              className="btn btn--ghost"
              onClick={() => setConfirm(false)}
            >
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
          <button className="btn btn--quiet" onClick={() => setConfirm(true)}>
            Réinitialiser ma progression
          </button>
        )
      }
    >
      <div className="stack">
        <div className="stats-hero">
          <WinRing rate={percent(stats.gamesWon, stats.gamesPlayed)} />
          <div className="stat-grid">
            <Stat k="Parties gagnées" v={formatNumber(stats.gamesWon)} />
            <Stat k="Parties jouées" v={formatNumber(stats.gamesPlayed)} />
            <Stat k="Série en cours" v={stats.currentWinStreak} />
            <Stat k="Meilleure série" v={stats.bestWinStreak} />
          </div>
        </div>

        <h3 className="section-title">Partie</h3>
        <div className="stat-grid stat-grid--4">
          <Stat
            k="Meilleur temps"
            v={stats.bestTimeMs ? formatDuration(stats.bestTimeMs) : '--:--'}
          />
          <Stat k="Temps moyen" v={avgTime} />
          <Stat k="Coups moyens" v={avgMoves} />
          <Stat k="Meilleur score" v={formatNumber(stats.bestScore)} />
        </div>

        <h3 className="section-title">Banque et Jackpot</h3>
        <div className="stat-grid stat-grid--4">
          <Stat
            k="Solde actuel"
            v={
              <span className="with-chip">
                <Chip size={18} /> {formatNumber(wallet.balance)}
              </span>
            }
          />
          <Stat k="Gagné au total" v={formatNumber(wallet.lifetimeEarned)} />
          <Stat k="Record de magot" v={formatNumber(gambling.bestSecuredRun)} />
          <Stat k="Rang VIP" v={vipTierFor(wallet.lifetimeEarned).label} />
          <Stat k="Plus longue série" v={gambling.longestStreak} />
          <Stat k="Coffres ouverts" v={gambling.vaultsOpened} />
          <Stat k="Dépensé en boutique" v={formatNumber(wallet.spent)} />
          <Stat k="Défis réussis" v={daily.completedDates.length} />
        </div>

        <DailyCalendar done={daily.completedDates} />

        <button className="achs-cta" onClick={() => openModal('achievements')}>
          <span className="achs-cta__icon">
            <Trophy size={22} />
          </span>
          <span className="achs-cta__body">
            <strong>Hauts faits</strong>
            <span>
              {unlocked} / {ACHIEVEMENTS.length} débloqués
            </span>
            <span
              className="meter meter--thin"
              style={{ '--p': unlocked / ACHIEVEMENTS.length } as CSSProperties}
            >
              <span />
            </span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </Modal>
  );
}
