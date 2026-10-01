import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { playSound } from '../audio/sfx';
import { formatMultiplier, formatNumber } from '../utils/format';
import { Stage } from './Modal';
import { Chip, RollingNumber } from './ui';
import { InsuranceToggle } from './Insurance';

type Phase = 'closed' | 'spinning' | 'open';

function VaultDoor({ phase }: { phase: Phase }) {
  return (
    <svg className="vault-door" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="vault-steel" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#8C939C" />
          <stop offset="0.55" stopColor="#4B5159" />
          <stop offset="1" stopColor="#23272D" />
        </radialGradient>
        <linearGradient id="vault-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1BF" />
          <stop offset="0.5" stopColor="#E3B95A" />
          <stop offset="1" stopColor="#8F6418" />
        </linearGradient>
        <radialGradient id="vault-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFE7A0" />
          <stop offset="0.6" stopColor="#E3B95A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#E3B95A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="#15181C" />
      <circle
        cx="100"
        cy="100"
        r="74"
        fill="url(#vault-glow)"
        className="vault-door__glow"
      />
      <g className="vault-door__frame">
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          stroke="url(#vault-gold)"
          strokeWidth="4"
        />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={100 + Math.cos(a) * 85}
              cy={100 + Math.sin(a) * 85}
              r="3.2"
              fill="#A9AFB7"
              stroke="#2A2E33"
              strokeWidth="1"
            />
          );
        })}
      </g>
      <g className="vault-door__door" data-phase={phase}>
        <circle cx="100" cy="100" r="75" fill="url(#vault-steel)" />
        <circle
          cx="100"
          cy="100"
          r="66"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="2"
        />
        <circle
          cx="100"
          cy="100"
          r="58"
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1.5"
        />
        <g className="vault-door__dial" data-phase={phase}>
          {Array.from({ length: 40 }, (_, i) => (
            <line
              key={i}
              x1="100"
              y1="64"
              x2="100"
              y2={i % 5 === 0 ? 71 : 68}
              stroke="#E8DCC0"
              strokeOpacity={i % 5 === 0 ? 0.9 : 0.45}
              strokeWidth={i % 5 === 0 ? 1.8 : 1}
              transform={`rotate(${i * 9} 100 100)`}
            />
          ))}
          {[0, 120, 240].map((r) => (
            <g key={r} transform={`rotate(${r} 100 100)`}>
              <rect
                x="97"
                y="40"
                width="6"
                height="40"
                rx="3"
                fill="url(#vault-gold)"
              />
              <circle
                cx="100"
                cy="40"
                r="7"
                fill="url(#vault-gold)"
                stroke="#7A5517"
                strokeWidth="1"
              />
            </g>
          ))}
          <circle
            cx="100"
            cy="100"
            r="22"
            fill="url(#vault-gold)"
            stroke="#7A5517"
            strokeWidth="1.4"
          />
          <circle cx="100" cy="100" r="9" fill="#2A2E33" />
        </g>
      </g>
    </svg>
  );
}

export function VaultOverlay() {
  const vaultResult = useGameStore((s) => s.vaultResult);
  const pot = useGameStore((s) => s.pot);
  const openVault = useGameStore((s) => s.openVault);
  const cashOut = useGameStore((s) => s.cashOut);
  const doubleOrNothing = useGameStore((s) => s.doubleOrNothing);
  const reduced = useMetaStore((s) => s.settings.reducedMotion);

  const [phase, setPhase] = useState<Phase>(vaultResult ? 'open' : 'closed');
  const [insure, setInsure] = useState(false);
  const potBefore = useRef(pot);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const spin = () => {
    if (phase !== 'closed') return;
    potBefore.current = pot;
    setPhase('spinning');
    const total = reduced ? 0 : 1400;
    if (!reduced) {
      for (let t = 0; t < total; t += 90) {
        timers.current.push(setTimeout(() => playSound('ratchet'), t));
      }
    }
    timers.current.push(
      setTimeout(() => {
        openVault();
        const result = useGameStore.getState().vaultResult;
        playSound(result?.trapped ? 'penalty' : 'jackpot');
        setPhase('open');
      }, total),
    );
  };

  const trapped = vaultResult?.trapped ?? false;

  return (
    <Stage label="Coffre-fort mystère" tone={trapped ? 'red' : 'gold'}>
      <div
        className="stage__rays"
        aria-hidden="true"
        data-on={phase === 'open' && !trapped}
      />
      <p className="stage__eyebrow">Trois victoires d&rsquo;affilée</p>
      <h2 className="stage__title">Le coffre-fort</h2>

      <button
        className="vault"
        data-phase={phase}
        onClick={spin}
        disabled={phase !== 'closed'}
        aria-label="Tourner la molette du coffre"
      >
        <VaultDoor phase={phase} />
        {phase === 'open' && vaultResult && (
          <span className={`vault__mult${trapped ? ' is-trap' : ''}`}>
            ×{formatMultiplier(vaultResult.multiplier)}
          </span>
        )}
      </button>

      {phase !== 'open' || !vaultResult ? (
        <p className="stage__text">
          {phase === 'closed'
            ? 'Tourne la molette: un multiplicateur surprise s’applique à tout ton magot. Souvent juteux, parfois piégé.'
            : 'Les engrenages tournent…'}
        </p>
      ) : (
        <>
          <p className="stage__text">
            {trapped
              ? 'Piégé ! Le magot fond de moitié. On se refait ?'
              : 'Jackpot ! Le magot prend de l’ampleur.'}
          </p>
          <div className="jackpot-pot is-in">
            <span className="jackpot-pot__label">Magot en jeu</span>
            <span className="jackpot-pot__value">
              <Chip size="0.8em" />
              <RollingNumber
                from={potBefore.current}
                value={pot}
                duration={1100}
                onTick={() => playSound('tick')}
              />
            </span>
          </div>
          <div className="stage__actions is-in">
            <InsuranceToggle value={insure} onChange={setInsure} pot={pot} />
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
                  <Chip size={16} /> {formatNumber(pot)}
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </Stage>
  );
}
