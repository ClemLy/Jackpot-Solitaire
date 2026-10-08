// Portrait d'un joueur: son avatar dans son cadre. Le cadre deborde un peu du
// disque (lauriers, couronne, flammes), d'ou la boite de 120 x 120.

import type { CSSProperties, ReactNode } from 'react';
import { AvatarArt } from './Avatar';

const GOLD = '#E2B24F';
const GOLD_DEEP = '#A4761F';

function Ring({
  id,
  stops,
  width = 6,
}: {
  id: string;
  stops: string[];
  width?: number;
}) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {stops.map((c, i) => (
            <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <circle
        cx="60"
        cy="60"
        r={50 + width / 2}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={width}
      />
    </>
  );
}

/** Points repartis sur un cercle. */
function around(n: number, r: number, offset = 0): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i / n) * 360 + offset) * (Math.PI / 180);
    return [60 + Math.cos(a) * r, 60 + Math.sin(a) * r, (i / n) * 360 + offset];
  });
}

const FRAMES: Record<string, () => ReactNode> = {
  'cadre-simple': () => (
    <circle
      cx="60"
      cy="60"
      r="52"
      fill="none"
      stroke="#FBF6EA"
      strokeWidth="3"
    />
  ),
  'cadre-rang-silver': () => (
    <Ring
      id="frame-silver"
      stops={['#FFFFFF', '#AEB4BC', '#E8ECF0', '#7D848D']}
    />
  ),
  'cadre-rang-gold': () => (
    <Ring
      id="frame-gold"
      stops={['#FFF1BF', '#E3B95A', '#F3D27C', '#8F6418']}
    />
  ),
  'cadre-rang-platinum': () => (
    <>
      <Ring
        id="frame-platinum"
        stops={['#F4FBFF', '#A9C6D6', '#E6F2F8', '#6E8EA0']}
        width={7}
      />
      {around(12, 53.5).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.3" fill="#FFFFFF" opacity="0.9" />
      ))}
    </>
  ),
  'cadre-rang-diamond': () => (
    <>
      <Ring
        id="frame-diamond"
        stops={['#E8F7FF', '#8FD3FF', '#FFFFFF', '#5AA7E0']}
        width={6}
      />
      {around(16, 55).map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a + 90} ${x} ${y})`}>
          <path
            className="frame-sparkle"
            style={{ '--i': i } as CSSProperties}
            d={`M${x} ${y - 3.4} L${x + 2.4} ${y} L${x} ${y + 3.4} L${x - 2.4} ${y} Z`}
            fill="#FFFFFF"
            stroke="#8FD3FF"
            strokeWidth="0.6"
          />
        </g>
      ))}
    </>
  ),
  'cadre-cards': () => (
    <>
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke="#FBF6EA"
        strokeWidth="2.5"
      />
      {[-42, -14, 14, 42].map((r, i) => (
        <g key={r} transform={`rotate(${r} 60 60)`}>
          <rect
            x="52"
            y="-2"
            width="16"
            height="22"
            rx="2.5"
            fill="#FBF6EA"
            stroke="#C9BFA8"
            strokeWidth="0.8"
          />
          <svg x="55" y="4" width="10" height="10" viewBox="0 0 100 100">
            <use
              href={`#suit-${['spades', 'hearts', 'diamonds', 'clubs'][i]}`}
              style={{ color: i === 1 || i === 2 ? '#C42A3D' : '#17191F' }}
            />
          </svg>
        </g>
      ))}
    </>
  ),
  'cadre-chips': () => (
    <>
      <circle
        cx="60"
        cy="60"
        r="53"
        fill="none"
        stroke="#17191F"
        strokeWidth="5"
      />
      {around(14, 53).map(([x, y], i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r="5.6"
            fill={['#C42A3D', '#1F4E9A', '#C99532', '#17191F'][i % 4]}
          />
          <circle
            cx={x}
            cy={y}
            r="3.4"
            fill="none"
            stroke="#FBF6EA"
            strokeWidth="1.2"
            strokeDasharray="1.6 1.4"
          />
        </g>
      ))}
    </>
  ),
  'cadre-neon': () => (
    <g className="frame-neon">
      <circle
        cx="60"
        cy="60"
        r="53"
        fill="none"
        stroke="#FF5FA8"
        strokeWidth="7"
        opacity="0.35"
      />
      <circle
        cx="60"
        cy="60"
        r="53"
        fill="none"
        stroke="#FFD1E8"
        strokeWidth="2.6"
      />
    </g>
  ),
  'cadre-laurel': () => (
    <>
      <Ring id="frame-laurel" stops={['#FFF1BF', '#C99532']} width={3} />
      {[-1, 1].map((side) =>
        Array.from({ length: 7 }, (_, i) => {
          const a = (110 + i * 18) * (Math.PI / 180);
          const x = 60 + side * Math.cos(a) * 55;
          const y = 60 + Math.sin(a) * 55 - 4;
          return (
            <ellipse
              key={`${side}-${i}`}
              cx={x}
              cy={y}
              rx="3"
              ry="7"
              fill={i % 2 ? GOLD : '#F3D27C'}
              stroke={GOLD_DEEP}
              strokeWidth="0.6"
              transform={`rotate(${side * (i * 18 - 20)} ${x} ${y})`}
            />
          );
        }),
      )}
    </>
  ),
  'cadre-flames': () => (
    <g className="frame-flames">
      {around(16, 52).map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a + 90} ${x} ${y})`}>
          <path
            d={`M${x} ${y} q-3 -6 0 -12 q3 6 0 12 Z`}
            fill={i % 2 ? '#FF8A2A' : '#FFD25A'}
            style={{ '--i': i } as CSSProperties}
            className="frame-flame"
          />
        </g>
      ))}
      <circle
        cx="60"
        cy="60"
        r="51.5"
        fill="none"
        stroke="#C42A3D"
        strokeWidth="3.5"
      />
    </g>
  ),
  'cadre-crown': () => (
    <>
      <Ring id="frame-crown" stops={['#C42A3D', '#8E1A2B']} width={5} />
      <g transform="translate(0 -2)">
        <path
          d="M38 14 L41 -4 L50 6 L60 -8 L70 6 L79 -4 L82 14 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="60" cy="9" r="2.6" fill="#C42A3D" />
        <circle cx="48" cy="10" r="1.8" fill="#2F6BD6" />
        <circle cx="72" cy="10" r="1.8" fill="#2F6BD6" />
      </g>
    </>
  ),
  'cadre-royal': () => (
    <>
      <Ring
        id="frame-royal-a"
        stops={['#FFF6DA', '#E3B95A', '#8F6418', '#F3D27C', '#7A5517']}
        width={8}
      />
      <circle
        cx="60"
        cy="60"
        r="58"
        fill="none"
        stroke="#7A5517"
        strokeWidth="1"
      />
      {around(8, 54).map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="2.6"
          fill={i % 2 ? '#C42A3D' : '#2F6BD6'}
          stroke="#FFF1BF"
          strokeWidth="0.8"
        />
      ))}
      {around(8, 54, 22.5).map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y})`}>
          <path
            className="frame-sparkle"
            style={{ '--i': i } as CSSProperties}
            d={`M${x} ${y - 4} L${x + 1.2} ${y} L${x} ${y + 4} L${x - 1.2} ${y} Z M${x - 4} ${y} L${x} ${y - 1.2} L${x + 4} ${y} L${x} ${y + 1.2} Z`}
            fill="#FFFFFF"
          />
        </g>
      ))}
    </>
  ),
};

export const FRAME_IDS = Object.keys(FRAMES);

/** Avatar dans son cadre, a la taille voulue. */
export function Portrait({
  avatar,
  frame,
  size = 64,
  className,
  label,
}: {
  avatar: string;
  frame: string;
  size?: number | string;
  className?: string;
  /** Texte alternatif (sinon le portrait est decoratif). */
  label?: string;
}) {
  const drawFrame = FRAMES[frame] ?? FRAMES['cadre-simple'];
  return (
    <svg
      className={`portrait${className ? ` ${className}` : ''}`}
      viewBox="-4 -12 128 136"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-frame={frame}
    >
      <g transform="translate(10 10)">
        <AvatarArt id={avatar} />
      </g>
      {drawFrame()}
    </svg>
  );
}
