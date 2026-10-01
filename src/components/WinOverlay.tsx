import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Vault, Home as HomeIcon } from 'lucide-react';
import { useGameStore, MODE_LABEL } from '../state/game';
import { findStakeTable } from '../state/catalog';
import { useMetaStore } from '../state/meta';
import { playSound } from '../audio/sfx';
import {
  formatDuration,
  formatMultiplier,
  formatNumber,
} from '../utils/format';
import { Stage } from './Modal';
import { Chip } from './ui';
import { InsuranceToggle } from './Insurance';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Valeur qui compte de `from` a `to` des que `active` passe a vrai. */
function Count({
  from = 0,
  to,
  active,
  instant,
  duration = 520,
  prefix = '',
  tick = true,
}: {
  from?: number;
  to: number;
  active: boolean;
  instant: boolean;
  duration?: number;
  prefix?: string;
  tick?: boolean;
}) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (!active) return;
    if (instant) {
      setV(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setV(Math.round(from + (to - from) * easeOutCubic(t)));
      if (tick && now - last > 60 && t < 1) {
        last = now;
        playSound('tick');
      }
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, instant, from, to, duration, tick]);
  return (
    <>
      {prefix}
      {formatNumber(v)}
    </>
  );
}

interface Step {
  key: string;
  delay: number;
  sound?: Parameters<typeof playSound>[0];
}

export function WinOverlay() {
  const win = useGameStore((s) => s.win);
  const mode = useGameStore((s) => s.mode);
  const combo = useGameStore((s) => s.combo);
  const stakeTable = useGameStore((s) => s.stakeTable);
  const finalTimeMs = useGameStore((s) => s.finalTimeMs);
  const cashOut = useGameStore((s) => s.cashOut);
  const doubleOrNothing = useGameStore((s) => s.doubleOrNothing);
  const gambleFromScore = useGameStore((s) => s.gambleFromScore);
  const enterVault = useGameStore((s) => s.enterVault);
  const newGame = useGameStore((s) => s.newGame);
  const goHome = useGameStore((s) => s.goHome);
  const reduced = useMetaStore((s) => s.settings.reducedMotion);

  const [insure, setInsure] = useState(false);
  const [stage, setStage] = useState(0);
  const [skipped, setSkipped] = useState(reduced);

  const scoring = mode !== 'zen';
  const gambling = mode === 'gambling';
  const table = findStakeTable(stakeTable);

  // Sequence du decompte, une ligne apres l'autre, facon machine a sous.
  const steps = useMemo<Step[]>(() => {
    if (!win) return [];
    const list: Step[] = [{ key: 'title', delay: 350 }];
    if (scoring) {
      list.push({ key: 'base', delay: 650 });
      list.push({ key: 'speed', delay: 650 });
      if (win.bonuses.precision > 0)
        list.push({ key: 'precision', delay: 600 });
      list.push({ key: 'total', delay: 700, sound: 'stamp' });
      if (gambling) {
        if (win.multiplier !== 1)
          list.push({ key: 'combo', delay: 650, sound: 'stamp' });
        if (win.tableMultiplier !== 1)
          list.push({ key: 'table', delay: 650, sound: 'stamp' });
        list.push({ key: 'pot', delay: 1100, sound: 'coins' });
      }
    }
    if (!gambling && win.tip + win.dailyBonus > 0)
      list.push({ key: 'reward', delay: 900, sound: 'coins' });
    list.push({ key: 'actions', delay: 200 });
    return list;
  }, [win, scoring, gambling]);

  const done = skipped || stage >= steps.length - 1;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipped || stage >= steps.length - 1) return;
    timer.current = setTimeout(() => {
      const next = steps[stage + 1];
      if (next?.sound) playSound(next.sound);
      setStage((s) => s + 1);
    }, steps[stage].delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [stage, steps, skipped]);

  if (!win) return null;

  const reached = (key: string) =>
    skipped || steps.findIndex((s) => s.key === key) <= stage;
  const instant = skipped;
  const reward = win.tip + win.dailyBonus;

  return (
    <Stage
      variant="ticket"
      label="Victoire"
      onPointerDown={() => {
        if (!done) setSkipped(true);
      }}
    >
      <div className="ticket">
        <div className="ticket__head">
          <span className="ticket__house">Jackpot Solitaire</span>
          <span>
            {MODE_LABEL[mode]} · {formatDuration(finalTimeMs)} · {win.moves}{' '}
            coups
          </span>
        </div>
        <h2 className="ticket__title">Victoire</h2>

        {scoring ? (
          <div className="tally">
            <TallyLine
              show={reached('base')}
              label="Points de la manche"
              value={
                <Count
                  to={win.baseScore}
                  active={reached('base')}
                  instant={instant}
                />
              }
            />
            <TallyLine
              show={reached('speed')}
              label="Bonus de vitesse"
              value={
                <Count
                  to={win.bonuses.speed}
                  prefix="+"
                  active={reached('speed')}
                  instant={instant}
                />
              }
            />
            {win.bonuses.precision > 0 && (
              <TallyLine
                show={reached('precision')}
                label="Sans faute"
                value={
                  <Count
                    to={win.bonuses.precision}
                    prefix="+"
                    active={reached('precision')}
                    instant={instant}
                  />
                }
              />
            )}
            <TallyLine
              show={reached('total')}
              total
              label="Score de la manche"
              value={formatNumber(win.roundScore)}
            />
            {gambling && (
              <div className="tally__mults">
                {win.multiplier !== 1 && reached('combo') && (
                  <span className="stamp">
                    ×{formatMultiplier(win.multiplier)} <small>série</small>
                  </span>
                )}
                {win.tableMultiplier !== 1 && reached('table') && (
                  <span className="stamp stamp--blue">
                    ×{formatMultiplier(win.tableMultiplier)}{' '}
                    <small>{table.label}</small>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="ticket__text">
            Une partie tout en douceur. Rien à compter, juste le plaisir.
          </p>
        )}

        {gambling && scoring && (
          <div className={`ticket__pot${reached('pot') ? ' is-in' : ''}`}>
            <span className="ticket__pot-label">
              Magot en jeu
              {combo > 1 && <span className="combo-badge">série {combo}</span>}
            </span>
            <span className="ticket__pot-value">
              <Chip size="0.72em" />
              <Count
                from={win.potBefore}
                to={win.potAfter}
                active={reached('pot')}
                instant={instant}
                duration={1000}
              />
            </span>
            <span className="ticket__pot-gain">
              {reached('pot')
                ? `+${formatNumber(win.gain)} sur cette manche`
                : '\u00a0'}
            </span>
          </div>
        )}

        {!gambling && reward > 0 && (
          <div className={`ticket__reward${reached('reward') ? ' is-in' : ''}`}>
            <Chip size={18} />
            <span>
              <Count
                to={reward}
                prefix="+"
                active={reached('reward')}
                instant={instant}
              />{' '}
              jetons pour ta banque
              {win.dailyBonus > 0 && <small>, prime du défi comprise</small>}
            </span>
          </div>
        )}
      </div>

      <div
        className={`stage__actions${done ? ' is-in' : ''}`}
        aria-hidden={!done}
      >
        {gambling ? (
          <>
            {win.vaultEligible && (
              <button
                className="btn btn--gold btn--lg btn--block"
                onClick={enterVault}
              >
                <Vault size={20} /> Ouvrir le coffre-fort
              </button>
            )}
            <InsuranceToggle
              value={insure}
              onChange={setInsure}
              pot={win.potAfter}
            />
            <div className="stage__duo">
              <button
                className="btn btn--red btn--lg"
                onClick={() => doubleOrNothing(insure)}
              >
                Quitte ou double
              </button>
              <button className="btn btn--emerald btn--lg" onClick={cashOut}>
                Encaisser
                <span className="btn__amount">
                  <Chip size={16} /> {formatNumber(win.potAfter)}
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="stage__duo">
              <button
                className="btn btn--emerald btn--lg"
                onClick={() => newGame({ mode })}
              >
                Nouvelle donne
              </button>
              {scoring && (
                <button
                  className="btn btn--gold btn--lg"
                  onClick={gambleFromScore}
                >
                  Miser au Jackpot
                </button>
              )}
            </div>
            <button className="btn btn--ghost" onClick={goHome}>
              <HomeIcon size={16} /> Accueil
            </button>
          </>
        )}
      </div>
      {!done && <p className="stage__skip">Touchez pour passer</p>}
    </Stage>
  );
}

function TallyLine({
  show,
  label,
  value,
  total,
}: {
  show: boolean;
  label: string;
  value: ReactNode;
  total?: boolean;
}) {
  return (
    <div
      className={`tally__line${total ? ' tally__line--total' : ''}${show ? ' is-in' : ''}`}
    >
      <span>{label}</span>
      <span className="tally__leader" aria-hidden="true" />
      <span className="tally__value">{show ? value : '\u00a0'}</span>
    </div>
  );
}
