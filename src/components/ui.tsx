// Petites briques d'interface partagees: jeton de casino, compteur roulant.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMetaStore } from '../state/meta';
import {
  DIFFICULTIES,
  findDifficulty,
  type DifficultyId,
} from '../state/catalog';
import { formatCompact, formatMultiplier, formatNumber } from '../utils/format';

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

/**
 * Jeton noir, la monnaie du rang Legendaire: laque noire, tranche d'or,
 * coeur violet et couronne. Volontairement different du jeton noir de la
 * banque (etoile doree), pour qu'on ne les confonde jamais.
 */
export function BlackChip({
  size = 18,
  className,
  style,
}: {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`black-chip${className ? ` ${className}` : ''}`}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r="19.5" fill="#0B0910" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={i}
          x="17.6"
          y="0.9"
          width="4.8"
          height="5"
          rx="1"
          fill="#E3B95A"
          transform={`rotate(${i * 45} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="13.2" fill="#24143C" />
      <circle
        cx="20"
        cy="20"
        r="11"
        fill="none"
        stroke="#E3B95A"
        strokeWidth="1"
        strokeDasharray="2 1.7"
        opacity="0.9"
      />
      <path
        d="M13.6 24.6 L12.6 15.8 L16.6 19 L20 13 L23.4 19 L27.4 15.8 L26.4 24.6 Z"
        fill="#F3D27C"
      />
      <path d="M13.6 25.6 H26.4 V27.4 H13.6 Z" fill="#F3D27C" />
      <circle cx="20" cy="21.4" r="1.5" fill="#C9A0FF" />
      <circle
        cx="20"
        cy="20"
        r="19.5"
        fill="none"
        stroke="#F3D27C"
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
    </svg>
  );
}

/** Solde de jetons noirs, qui roule comme celui de la banque. */
export function BlackBalance({ className }: { className?: string }) {
  const black = useMetaStore((s) => s.legend.black);
  return (
    <span
      className={`balance balance--black ${className ?? ''}`}
      title={`${formatNumber(black)} jetons noirs`}
    >
      <BlackChip size="1.25em" />
      <span className="sr-only">{formatNumber(black)} jetons noirs</span>
      <RollingNumber
        value={black}
        className="balance__value"
        format={formatCompact}
        aria-hidden
      />
    </span>
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
  title,
  'aria-hidden': ariaHidden,
}: {
  value: number;
  /** Valeur de depart au montage (sinon on part directement de `value`). */
  from?: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
  onTick?: () => void;
  /** Infobulle (le montant exact, quand l'affichage est abrege). */
  title?: string;
  /** Masque aux lecteurs d'ecran (le montant exact est dit a cote). */
  'aria-hidden'?: boolean;
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

  return (
    <span className={className} title={title} aria-hidden={ariaHidden}>
      {format(display)}
    </span>
  );
}

/**
 * Solde de la banque: jeton + montant qui roule a chaque gain ou achat.
 * Abrege au-dela du million (98,7 M): ces pastilles ont une place comptee.
 */
export function Balance({ className }: { className?: string }) {
  const balance = useMetaStore((s) => s.wallet.balance);
  return (
    <span
      className={`balance ${className ?? ''}`}
      title={`${formatNumber(balance)} jetons`}
    >
      <Chip size="1.25em" />
      <span className="sr-only">{formatNumber(balance)} jetons</span>
      <RollingNumber
        value={balance}
        className="balance__value"
        format={formatCompact}
        aria-hidden
      />
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
