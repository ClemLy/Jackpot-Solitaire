import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Lightbulb,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  ShieldCheck,
} from 'lucide-react';
import { useGameStore, computeElapsed, MODE_LABEL } from '../state/game';
import { useMetaStore } from '../state/meta';
import { findStakeTable } from '../state/catalog';
import { formatDuration, formatMultiplier } from '../utils/format';
import { Chip, RollingNumber } from './ui';

/** Rafraichit l'affichage regulierement tant que la partie est en cours. */
function useElapsed(): number {
  const phase = useGameStore((s) => s.phase);
  const startedAt = useGameStore((s) => s.startedAt);
  const finalTimeMs = useGameStore((s) => s.finalTimeMs);
  const [, force] = useState(0);
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [phase]);
  return computeElapsed({ phase, startedAt, finalTimeMs });
}

/** Score qui roule, avec un petit gain ou malus flottant a chaque variation. */
function ScoreValue({ score }: { score: number }) {
  const prev = useRef(score);
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
  useEffect(() => {
    const delta = score - prev.current;
    prev.current = score;
    if (delta !== 0) {
      const id = Date.now() + Math.random();
      setFloats((f) => [...f, { id, amount: delta }]);
      const timer = setTimeout(() => {
        setFloats((f) => f.filter((x) => x.id !== id));
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [score]);
  return (
    <>
      <RollingNumber value={score} duration={420} className="value" />
      {floats.map((f) => (
        <span
          key={f.id}
          className="float-score"
          data-kind={f.amount >= 0 ? 'gain' : 'loss'}
        >
          {f.amount >= 0 ? '+' : ''}
          {f.amount}
        </span>
      ))}
    </>
  );
}

export function Hud() {
  const mode = useGameStore((s) => s.mode);
  const drawCount = useGameStore((s) => s.drawCount);
  const score = useGameStore((s) => s.score);
  const moves = useGameStore((s) => s.moves);
  const pot = useGameStore((s) => s.pot);
  const combo = useGameStore((s) => s.combo);
  const stakeTable = useGameStore((s) => s.stakeTable);
  const insured = useGameStore((s) => s.insured);
  const goHome = useGameStore((s) => s.goHome);
  const requestLeave = useGameStore((s) => s.requestLeave);

  const elapsed = useElapsed();
  const scoring = mode !== 'zen';
  const table = findStakeTable(stakeTable);
  const gambling = mode === 'gambling';

  const sub = [`Pioche ${drawCount}`];
  if (gambling && table.id !== 'free') sub.push(table.label);

  return (
    <header className="hud">
      <div className="hud__left">
        <button
          className="hud-btn hud-btn--icon"
          onClick={() => requestLeave(goHome)}
          aria-label="Retour à l'accueil"
          title="Accueil"
        >
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <div className="hud__mode">
          <span className="hud__mode-name">{MODE_LABEL[mode]}</span>
          <span className="hud__mode-sub">{sub.join(' · ')}</span>
        </div>
      </div>

      <div className="hud__center">
        <div className="hud__stats">
          {scoring && (
            <div className="hud__stat">
              <span className="label">Score</span>
              <ScoreValue score={score} />
            </div>
          )}
          {scoring && (
            <div className="hud__stat" data-chrono={mode === 'chrono'}>
              <span className="label">Temps</span>
              <span className="value">{formatDuration(elapsed)}</span>
            </div>
          )}
          <div className="hud__stat">
            <span className="label">Coups</span>
            <span className="value">{moves}</span>
          </div>
        </div>

        {gambling && (
          <div
            className={`pot${pot > 0 ? ' is-risk' : ''}`}
            title="Magot en jeu"
          >
            <Chip size={22} />
            <span className="pot__body">
              <span className="pot__label">Magot</span>
              <RollingNumber value={pot} className="pot__value" />
            </span>
            {combo > 0 && <span className="pot__combo">série {combo}</span>}
            {table.multiplier > 1 && (
              <span className="pot__mult">
                ×{formatMultiplier(table.multiplier)}
              </span>
            )}
            {insured && (
              <ShieldCheck
                className="pot__shield"
                size={18}
                aria-label="Manche assurée"
              />
            )}
          </div>
        )}
      </div>

      <div className="hud__right" />
    </header>
  );
}

/** Barre d'actions flottante en bas de l'ecran, a portee de pouce. */
export function Dock() {
  const mode = useGameStore((s) => s.mode);
  const phase = useGameStore((s) => s.phase);
  const autoAvailable = useGameStore((s) => s.autoAvailable);
  const autoCompleting = useGameStore((s) => s.autoCompleting);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const requestHint = useGameStore((s) => s.requestHint);
  const undo = useGameStore((s) => s.undo);
  const startAutoComplete = useGameStore((s) => s.startAutoComplete);
  const newGame = useGameStore((s) => s.newGame);
  const openModal = useGameStore((s) => s.openModal);
  const requestLeave = useGameStore((s) => s.requestLeave);
  const freeHints = useMetaStore((s) => s.inventory.consumables.hint);

  const scoring = mode !== 'zen';
  const playing = phase === 'playing';

  return (
    <nav className="dock" aria-label="Actions de partie">
      <button
        className="dock__btn"
        onClick={requestHint}
        disabled={!playing}
        aria-label={
          freeHints > 0
            ? `Demander un indice (${freeHints} offert${freeHints > 1 ? 's' : ''})`
            : 'Demander un indice'
        }
        title={freeHints > 0 ? 'Œil du croupier: indice offert' : undefined}
      >
        <Lightbulb size={20} />
        <span className="dock__label">Indice</span>
        {scoring && (
          <span
            className="dock__cost"
            data-free={freeHints > 0 ? 'true' : undefined}
          >
            {freeHints > 0 ? freeHints : '-25'}
          </span>
        )}
      </button>
      <button
        className="dock__btn"
        onClick={undo}
        disabled={!playing || !canUndo}
        aria-label="Annuler le dernier coup"
      >
        <Undo2 size={20} />
        <span className="dock__label">Annuler</span>
        {scoring && <span className="dock__cost">-15</span>}
      </button>
      {autoAvailable && !autoCompleting && playing && (
        <button
          className="dock__btn dock__btn--gold"
          onClick={startAutoComplete}
          aria-label="Terminer automatiquement"
        >
          <Sparkles size={20} />
          <span className="dock__label">Terminer</span>
        </button>
      )}
      <span className="dock__sep" aria-hidden="true" />
      <button
        className="dock__btn"
        onClick={() => requestLeave(() => newGame({ mode }))}
        aria-label="Nouvelle donne"
      >
        <Shuffle size={20} />
        <span className="dock__label">Nouvelle</span>
      </button>
      <button
        className="dock__btn"
        onClick={() => openModal('newgame')}
        aria-label="Options de partie"
      >
        <SlidersHorizontal size={20} />
        <span className="dock__label">Options</span>
      </button>
    </nav>
  );
}
