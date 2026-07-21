import { useEffect, useRef, useState } from 'react';
import { useGameStore, computeElapsed } from '../state/game';
import { formatDuration, formatNumber } from '../utils/format';

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

/** Petit nombre flottant affiche au dessus du score quand il change. */
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
      <span className="value">{formatNumber(score)}</span>
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
  const score = useGameStore((s) => s.score);
  const moves = useGameStore((s) => s.moves);
  const pot = useGameStore((s) => s.pot);
  const combo = useGameStore((s) => s.combo);
  const phase = useGameStore((s) => s.phase);
  const autoAvailable = useGameStore((s) => s.autoAvailable);
  const canUndo = useGameStore((s) => s.history.length > 0);

  const goHome = useGameStore((s) => s.goHome);
  const requestHint = useGameStore((s) => s.requestHint);
  const undo = useGameStore((s) => s.undo);
  const startAutoComplete = useGameStore((s) => s.startAutoComplete);
  const newGame = useGameStore((s) => s.newGame);
  const openModal = useGameStore((s) => s.openModal);

  const elapsed = useElapsed();
  const scoring = mode !== 'zen';
  const showTime = mode !== 'zen';
  const playing = phase === 'playing';

  return (
    <header className="hud">
      <div className="hud__group">
        <button
          className="iconbtn"
          onClick={goHome}
          aria-label="Retour a l accueil"
        >
          Menu
        </button>
        {scoring && (
          <div className="hud__stat">
            <span className="label">Score</span>
            <ScoreValue score={score} />
          </div>
        )}
        {showTime && (
          <div className="hud__stat">
            <span className="label">Temps</span>
            <span className="value" data-chrono={mode === 'chrono'}>
              {formatDuration(elapsed)}
            </span>
          </div>
        )}
        <div className="hud__stat">
          <span className="label">Coups</span>
          <span className="value">{moves}</span>
        </div>
      </div>

      {mode === 'gambling' && (
        <div className="hud__group">
          <div className={`pot${pot > 0 ? ' is-risk' : ''}`}>
            <span className="coin">J</span>
            <span>Magot {formatNumber(pot)}</span>
            {combo > 1 && <span className="chip">serie x{combo}</span>}
          </div>
        </div>
      )}

      <div className="hud__group hud__group--right">
        <button
          className="iconbtn"
          onClick={requestHint}
          disabled={!playing}
          aria-label="Demander un indice"
        >
          Indice
          {scoring && <small>-25</small>}
        </button>
        <button
          className="iconbtn"
          onClick={undo}
          disabled={!playing || !canUndo}
          aria-label="Annuler le dernier coup"
        >
          Annuler
          {scoring && <small>-15</small>}
        </button>
        {autoAvailable && (
          <button
            className="iconbtn"
            onClick={startAutoComplete}
            aria-label="Terminer automatiquement"
          >
            Auto
          </button>
        )}
        <button
          className="iconbtn"
          onClick={() => newGame({ mode })}
          aria-label="Nouvelle donne"
        >
          Rejouer
        </button>
        <button
          className="iconbtn"
          onClick={() => openModal('newgame')}
          aria-label="Options de partie"
        >
          Options
        </button>
      </div>
    </header>
  );
}
