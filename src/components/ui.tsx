// Petites briques d'interface partagees: jeton de casino, compteur roulant.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMetaStore } from '../state/meta';
import {
  DIFFICULTIES,
  findDifficulty,
  type DifficultyId,
} from '../state/catalog';
import { formatMultiplier, formatNumber } from '../utils/format';

type ChipTone = 'gold' | 'red' | 'black' | 'blue' | 'violet';

const CHIP_COLORS: Record<
  ChipTone,
  { base: string; spot: string; inner: string; ink: string }
> = {
  gold: { base: '#C99532', spot: '#FFF3CF', inner: '#EFC766', ink: '#6B4A10' },
  red: { base: '#A61F33', spot: '#F8EEE2', inner: '#C3364B', ink: '#F8EEE2' },
  black: { base: '#1D2024', spot: '#E9E2D2', inner: '#2E3238', ink: '#E3B95A' },
  blue: { base: '#1F4E9A', spot: '#EEF2FA', inner: '#2E62B8', ink: '#EEF2FA' },
  violet: {
    base: '#5B2C8A',
    spot: '#F2EAFA',
    inner: '#7140A4',
    ink: '#F2EAFA',
  },
};

/** Jeton de casino, l'unite de la banque. */
export function Chip({
  size = 18,
  tone = 'gold',
  className,
  style,
}: {
  size?: number | string;
  tone?: ChipTone;
  className?: string;
  style?: CSSProperties;
}) {
  const c = CHIP_COLORS[tone];
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r="19.5" fill={c.base} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x="17"
          y="0.8"
          width="6"
          height="6.2"
          rx="1.2"
          fill={c.spot}
          transform={`rotate(${i * 60} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="13" fill={c.inner} />
      <circle
        cx="20"
        cy="20"
        r="10.6"
        fill="none"
        stroke={c.spot}
        strokeWidth="1.1"
        strokeDasharray="2.1 2.1"
        opacity="0.85"
      />
      <path
        d="M20 13.2 L21.9 18.1 L27 18.3 L23 21.4 L24.4 26.4 L20 23.5 L15.6 26.4 L17 21.4 L13 18.3 L18.1 18.1 Z"
        fill={c.ink}
      />
      <circle
        cx="20"
        cy="20"
        r="19.5"
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1"
      />
    </svg>
  );
}

function reducedMotion(): boolean {
  return (
    useMetaStore.getState().settings.reducedMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Nombre qui roule jusqu'a sa nouvelle valeur au lieu de sauter. Repart de la
 * valeur affichee si on l'interrompt en pleine course.
 */
export function RollingNumber({
  value,
  from,
  duration = 650,
  className,
  format = formatNumber,
  onTick,
}: {
  value: number;
  /** Valeur de depart au montage (sinon on part directement de `value`). */
  from?: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
  onTick?: () => void;
}) {
  const [display, setDisplay] = useState(from ?? value);
  const shown = useRef(from ?? value);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    const from = shown.current;
    if (from === value) return;
    if (reducedMotion()) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    let lastTick = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = Math.round(from + (value - from) * easeOutCubic(t));
      shown.current = v;
      setDisplay(v);
      if (tickRef.current && now - lastTick > 55 && t < 1) {
        lastTick = now;
        tickRef.current();
      }
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

/** Solde de la banque: jeton + montant qui roule a chaque gain ou achat. */
export function Balance({ className }: { className?: string }) {
  const balance = useMetaStore((s) => s.wallet.balance);
  return (
    <span className={`balance ${className ?? ''}`}>
      <Chip size="1.25em" />
      <RollingNumber value={balance} className="balance__value" />
    </span>
  );
}

/** Choix du niveau de difficulte, avec le multiplicateur de gains de chacun. */
export function DifficultyPicker({
  value,
  onChange,
}: {
  value: DifficultyId;
  onChange: (id: DifficultyId) => void;
}) {
  return (
    <>
      <div className="pills" role="radiogroup" aria-label="Difficulté">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            role="radio"
            aria-checked={value === d.id}
            onClick={() => onChange(d.id)}
          >
            {d.label} <small>×{formatMultiplier(d.payout)}</small>
          </button>
        ))}
      </div>
      <span className="field-hint">
        {findDifficulty(value).pitch} Gains ×
        {formatMultiplier(findDifficulty(value).payout)}.
      </span>
    </>
  );
}
