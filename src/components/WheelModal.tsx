import { useEffect, useRef, useState } from 'react';
import { Eye, Shield } from 'lucide-react';
import { Modal } from './Modal';
import { describeReward, useMetaStore, type SpinResult } from '../state/meta';
import { WHEEL_SEGMENTS, drawWheelSegment } from '../state/catalog';
import { playSound } from '../audio/sfx';

const SEG = 360 / WHEEL_SEGMENTS.length;
const R = 100;

const FILLS = ['#A61F33', '#16191E', '#155C45', '#16191E'];

function polar(angleDeg: number, radius: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [R + Math.cos(a) * radius, R + Math.sin(a) * radius];
}

function segmentPath(i: number): string {
  const [x1, y1] = polar(i * SEG, 96);
  const [x2, y2] = polar((i + 1) * SEG, 96);
  return `M${R} ${R} L${x1} ${y1} A96 96 0 0 1 ${x2} ${y2} Z`;
}

function timeUntilMidnight(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.max(
    0,
    Math.round((next.getTime() - now.getTime()) / 60000),
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export function WheelModal({ onClose }: { onClose: () => void }) {
  const canSpin = useMetaStore((s) => s.canSpinWheel());
  const spinWheel = useMetaStore((s) => s.spinWheel);
  const reduced = useMetaStore((s) => s.settings.reducedMotion);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const rotation = useRef(0);
  const wheelRef = useRef<SVGGElement | null>(null);
  const pointerRef = useRef<SVGGElement | null>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const spin = () => {
    if (spinning || !canSpin) return;
    const roll = Math.random();
    const index = drawWheelSegment(roll);
    // Le tirage est enregistre des le lancer: fermer la fenetre en pleine
    // rotation ne permet pas de relancer la roue.
    const outcome = spinWheel(roll);
    if (!outcome) return;
    setSpinning(true);
    playSound('button');

    const start = rotation.current;
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const target = 360 - (index * SEG + SEG / 2) + jitter;
    const base = Math.ceil(start / 360) * 360;
    const end = base + 360 * 6 + target;
    const duration = reduced ? 1 : 5200;
    const t0 = performance.now();
    let lastSeg = Math.floor(start / SEG);

    const finish = () => {
      setSpinning(false);
      setResult(outcome);
      playSound(
        outcome.reward.kind === 'chips' && outcome.reward.amount >= 1000
          ? 'jackpot'
          : 'coins',
      );
    };

    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const r = start + (end - start) * easeOutQuart(t);
      rotation.current = r;
      wheelRef.current?.setAttribute('transform', `rotate(${r} ${R} ${R})`);
      const seg = Math.floor(r / SEG);
      if (seg !== lastSeg) {
        lastSeg = seg;
        playSound('ratchet');
        pointerRef.current?.animate(
          [{ transform: 'rotate(-16deg)' }, { transform: 'rotate(0deg)' }],
          { duration: 140, easing: 'ease-out' },
        );
      }
      if (t < 1) raf.current = requestAnimationFrame(frame);
      else finish();
    };
    raf.current = requestAnimationFrame(frame);
  };

  return (
    <Modal title="Roue du jour" onClose={onClose} size="md">
      <div className="wheel">
        <svg
          className="wheel__svg"
          viewBox="0 0 200 212"
          role="img"
          aria-label="Roue de la fortune"
        >
          <defs>
            <linearGradient id="wheel-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFF1BF" />
              <stop offset="0.5" stopColor="#E3B95A" />
              <stop offset="1" stopColor="#8F6418" />
            </linearGradient>
          </defs>
          <g transform="translate(0 12)">
            <circle cx={R} cy={R} r="100" fill="url(#wheel-gold)" />
            <circle cx={R} cy={R} r="97" fill="#0E1110" />
            <g ref={wheelRef}>
              {WHEEL_SEGMENTS.map((seg, i) => {
                const mid = i * SEG + SEG / 2;
                const jackpot =
                  seg.reward.kind === 'chips' && seg.reward.amount >= 2500;
                const [lx, ly] = polar(mid, 64);
                return (
                  <g key={i}>
                    <path
                      d={segmentPath(i)}
                      fill={
                        jackpot ? 'url(#wheel-gold)' : FILLS[i % FILLS.length]
                      }
                      stroke="#E3B95A"
                      strokeOpacity="0.55"
                      strokeWidth="0.8"
                    />
                    <g
                      transform={`rotate(${mid > 90 && mid < 270 ? mid + 180 : mid} ${lx} ${ly})`}
                    >
                      {seg.reward.kind === 'chips' ? (
                        <text
                          x={lx}
                          y={ly}
                          className="wheel__label"
                          data-dark={jackpot}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {seg.label}
                        </text>
                      ) : seg.reward.item === 'hint' ? (
                        <Eye
                          x={lx - 9}
                          y={ly - 9}
                          width={18}
                          height={18}
                          color="#F6F0E2"
                        />
                      ) : (
                        <Shield
                          x={lx - 9}
                          y={ly - 9}
                          width={18}
                          height={18}
                          color="#F6F0E2"
                        />
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
            {Array.from({ length: 24 }, (_, i) => {
              const [x, y] = polar(i * 15, 98.5);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="1.9"
                  className="wheel__bulb"
                  data-odd={i % 2 === 1}
                  data-spin={spinning}
                />
              );
            })}
            <circle
              cx={R}
              cy={R}
              r="17"
              fill="url(#wheel-gold)"
              stroke="#7A5517"
              strokeWidth="1.2"
            />
            <circle cx={R} cy={R} r="7" fill="#16191E" />
          </g>
          <g ref={pointerRef} style={{ transformOrigin: '100px 6px' }}>
            <path
              d="M100 30 L90 6 Q100 -2 110 6 Z"
              fill="url(#wheel-gold)"
              stroke="#7A5517"
              strokeWidth="1.2"
            />
          </g>
        </svg>

        {result ? (
          <div className="wheel__result">
            <span className="wheel__result-k">Tu remportes</span>
            <span className="wheel__result-v">
              {describeReward(result.reward)}
            </span>
            {result.boost > 1 && (
              <span className="wheel__boost">
                Bonus VIP ×{String(result.boost).replace('.', ',')} compris
              </span>
            )}
            <button className="btn btn--gold btn--lg" onClick={onClose}>
              Merci la chance
            </button>
          </div>
        ) : canSpin || spinning ? (
          <div className="wheel__cta">
            <p className="lead">
              Un tour gratuit par jour: des jetons, une assurance ou un œil du
              croupier.
            </p>
            <button
              className="btn btn--gold btn--lg"
              onClick={spin}
              disabled={spinning}
            >
              {spinning ? 'Ça tourne…' : 'Lancer la roue'}
            </button>
          </div>
        ) : (
          <div className="wheel__cta">
            <p className="lead">
              Tu as déjà tenté ta chance aujourd&rsquo;hui. Prochain tour dans{' '}
              <strong>{timeUntilMidnight()}</strong>.
            </p>
            <button className="btn btn--ghost btn--lg" onClick={onClose}>
              À demain
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
