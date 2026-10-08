import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Lightbulb,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  ShieldCheck,
  WandSparkles,
} from 'lucide-react';
import {
  useGameStore,
  betsOpen,
  canUndoIn,
  chronoRemaining,
  computeElapsed,
  foundationCount,
  isScoring,
  vegasValueOf,
  MODE_LABEL,
} from '../state/game';
import { useMetaStore } from '../state/meta';
import {
  JOKER_IDS,
  findDifficulty,
  findStakeTable,
  vegasRecycles,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatDuration, formatMultiplier } from '../utils/format';
import { Chip, RollingNumber } from './ui';
import { JokerTray } from './Jokers';

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

/** Compte a rebours du Chrono: couleur d'alerte et tic-tac a la fin. */
function ChronoValue({ remaining }: { remaining: number }) {
  const seconds = Math.ceil(remaining / 1000);
  const state = seconds <= 10 ? 'danger' : seconds <= 30 ? 'warn' : 'calm';
  const last = useRef(seconds);
  useEffect(() => {
    if (seconds !== last.current && seconds <= 10 && seconds > 0) {
      playSound('tick');
    }
    last.current = seconds;
  }, [seconds]);
  return (
    <span className="value" data-state={state}>
      {formatDuration(seconds * 1000)}
    </span>
  );
}

export function Hud() {
  const mode = useGameStore((s) => s.mode);
  const difficulty = useGameStore((s) => s.difficulty);
  const guaranteed = useGameStore((s) => s.guaranteed);
  const score = useGameStore((s) => s.score);
  const moves = useGameStore((s) => s.moves);
  const pot = useGameStore((s) => s.pot);
  const combo = useGameStore((s) => s.combo);
  const stakeTable = useGameStore((s) => s.stakeTable);
  const insured = useGameStore((s) => s.insured);
  const bets = useGameStore((s) => s.sideBets.length);
  const betsPending = useGameStore(betsOpen);
  const vegasEarned = useGameStore((s) =>
    s.mode === 'vegas' ? foundationCount(s.board) * vegasValueOf(s) : 0,
  );
  const recyclesLeft = useGameStore((s) => s.board.recyclesLeft);
  const phase = useGameStore((s) => s.phase);
  const startedAt = useGameStore((s) => s.startedAt);
  const finalTimeMs = useGameStore((s) => s.finalTimeMs);
  const goHome = useGameStore((s) => s.goHome);
  const requestLeave = useGameStore((s) => s.requestLeave);

  const elapsed = useElapsed();
  const scoring = isScoring(mode);
  const table = findStakeTable(stakeTable);
  const gambling = mode === 'gambling';
  const vegas = mode === 'vegas';
  const chrono = mode === 'chrono';

  const level = findDifficulty(difficulty);
  const sub = [level.label, `Pioche ${level.drawCount}`];
  if (vegas) {
    const passes = vegasRecycles(level.drawCount) + 1;
    sub.push(passes === 1 ? '1 passage' : `${passes} passages`);
  }
  if (gambling && table.id !== 'free') sub.push(table.label);
  if (guaranteed) sub.push('Donne garantie');

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
          {vegas && (
            <div className="hud__stat hud__stat--vegas">
              <span className="label">Gains</span>
              <span className="value">
                <Chip size={13} />{' '}
                <RollingNumber value={vegasEarned} duration={320} />
              </span>
            </div>
          )}
          {(scoring || vegas) && (
            <div className="hud__stat" data-chrono={chrono}>
              <span className="label">{chrono ? 'Reste' : 'Temps'}</span>
              {chrono ? (
                <ChronoValue
                  remaining={chronoRemaining({ phase, startedAt, finalTimeMs })}
                />
              ) : (
                <span className="value">{formatDuration(elapsed)}</span>
              )}
            </div>
          )}
          <div className="hud__stat">
            <span className="label">Coups</span>
            <span className="value">{moves}</span>
          </div>
          {vegas && recyclesLeft !== undefined && (
            <div className="hud__stat">
              <span className="label">Recharges</span>
              <span className="value" data-empty={recyclesLeft === 0}>
                {recyclesLeft}
              </span>
            </div>
          )}
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
            {bets > 0 && !betsPending && (
              <span
                className="pot__bets"
                title="Paris annexes en jeu sur cette manche"
              >
                {bets} pari{bets > 1 ? 's' : ''}
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
  const jokers = useMetaStore((s) =>
    JOKER_IDS.reduce((n, id) => n + (s.inventory.consumables[id] ?? 0), 0),
  );
  const jokerActive = useGameStore((s) => s.jokerArmed || s.peekMode);
  const [tray, setTray] = useState(false);

  const scoring = isScoring(mode);
  const playing = phase === 'playing';
  const undoAllowed = canUndoIn(mode);

  return (
    <nav className="dock" aria-label="Actions de partie">
      {tray && playing && <JokerTray onClose={() => setTray(false)} />}
      <button
        className="dock__btn"
        onClick={requestHint}
        disabled={!playing}
        aria-label={
          freeHints > 0 && scoring
            ? `Demander un indice (${freeHints} offert${freeHints > 1 ? 's' : ''})`
            : 'Demander un indice'
        }
        title={
          freeHints > 0 && scoring
            ? 'Œil du croupier: indice offert'
            : undefined
        }
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
        disabled={!playing || !canUndo || !undoAllowed}
        aria-label={
          undoAllowed ? 'Annuler le dernier coup' : 'Pas d’annulation à Vegas'
        }
        title={undoAllowed ? undefined : 'Pas d’annulation à Vegas'}
      >
        <Undo2 size={20} />
        <span className="dock__label">Annuler</span>
        {scoring && <span className="dock__cost">-15</span>}
      </button>
      <button
        className="dock__btn"
        data-joker-toggle
        data-active={tray || jokerActive ? 'true' : undefined}
        onClick={() => setTray((t) => !t)}
        disabled={!playing}
        aria-expanded={tray}
        aria-label={`Jokers (${jokers} en réserve)`}
      >
        <WandSparkles size={20} />
        <span className="dock__label">Jokers</span>
        {jokers > 0 && (
          <span className="dock__cost" data-free="true">
            {jokers}
          </span>
        )}
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
