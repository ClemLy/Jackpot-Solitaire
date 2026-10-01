import { useState, type ReactNode } from 'react';
import {
  Brain,
  CalendarHeart,
  Crown,
  Diamond,
  Dices,
  Flag,
  Flame,
  Gem,
  ShoppingBag,
  Snowflake,
  Vault,
  Zap,
} from 'lucide-react';
import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { ACHIEVEMENTS } from '../state/achievements';
import { vipTierFor } from '../state/catalog';
import { formatDuration, formatNumber, percent } from '../utils/format';
import { todayISO } from '../utils/seed';
import { Chip } from './ui';

const ACH_ICON: Record<string, ReactNode> = {
  'first-win': <Flag size={20} />,
  lightning: <Zap size={20} />,
  strategist: <Brain size={20} />,
  'clear-mind': <Snowflake size={20} />,
  faithful: <CalendarHeart size={20} />,
  'hot-streak': <Flame size={20} />,
  'high-roller': <Gem size={20} />,
  daredevil: <Dices size={20} />,
  'treasure-hunter': <Vault size={20} />,
  collector: <ShoppingBag size={20} />,
  regular: <Crown size={20} />,
  'high-stakes': <Diamond size={20} />,
};

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

        <h3 className="section-title">
          Hauts faits{' '}
          <span className="section-title__count">
            {unlocked} / {ACHIEVEMENTS.length}
          </span>
        </h3>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const on = Boolean(achievements[a.id]);
            return (
              <div key={a.id} className="ach" data-on={on}>
                <span className="ach__medal">{ACH_ICON[a.id]}</span>
                <span className="ach__body">
                  <span className="ach__t">{a.title}</span>
                  <span className="ach__d">{a.description}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
