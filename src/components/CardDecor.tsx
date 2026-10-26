// Ornements des cartes de profil, poses par-dessus le fond. Le niveau de
// detail suit le prix: rien sur le feutre offert, puis une surpiqure, des
// coins ouvrages, des ampoules, des filigranes, jusqu'a la carte Legende.

import type { CSSProperties, ReactNode } from 'react';

type CornerKind = 'deco' | 'marble' | 'gilded' | 'legend';

/** Coin ornemental (dessine en haut a gauche, retourne pour les autres). */
function CornerArt({ kind }: { kind: CornerKind }) {
  switch (kind) {
    case 'deco':
      return (
        <g fill="none" stroke="#E3B95A" strokeWidth="1.2">
          <path d="M3 38 V12 L12 3 H38" />
          <path d="M8 38 V15 L15 8 H38" strokeOpacity="0.6" />
          <path d="M3 3 L13 13 M3 9 L10 13 M9 3 L13 10" strokeOpacity="0.8" />
          <circle cx="17" cy="17" r="2" fill="#E3B95A" />
        </g>
      );
    case 'marble':
      return (
        <g fill="none" stroke="#B4842A" strokeWidth="1.4">
          <path d="M4 34 V8 Q4 4 8 4 H34" />
          <path d="M9 9 L13 13" />
          <path d="M11 6 L14 9 L11 12 L8 9 Z" fill="#C99532" stroke="none" />
        </g>
      );
    case 'gilded':
    case 'legend':
      return (
        <g fill="none" stroke="#E3B95A" strokeWidth="1.1" strokeLinecap="round">
          <path d="M3 40 C3 18 18 3 40 3" />
          <path d="M8 28 C8 16 14 11 20 14 C24 16 22 21 18 20 C15 19 16 16 18 16.5" />
          <path d="M28 8 C16 8 11 14 14 20" />
          <path d="M4 22 C9 21 12 24 11 28" strokeOpacity="0.7" />
          <path d="M22 4 C21 9 24 12 28 11" strokeOpacity="0.7" />
          <path
            d="M10 6 C12 2 17 2 16 7 C14 9 11 9 10 6 Z"
            fill="#E3B95A"
            stroke="none"
            opacity="0.85"
          />
          {kind === 'legend' && (
            <>
              <circle
                cx="7"
                cy="7"
                r="3.2"
                fill="url(#pcard-prism)"
                stroke="#FFF1BF"
                strokeWidth="0.8"
              />
              <circle cx="6" cy="6" r="1" fill="#FFFFFF" stroke="none" />
            </>
          )}
        </g>
      );
  }
}

function Corners({ kind }: { kind: CornerKind }) {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
        <svg
          key={pos}
          className={`pcard__corner pcard__corner--${pos}`}
          viewBox="0 0 40 40"
          aria-hidden="true"
        >
          {kind === 'legend' && (
            <defs>
              <linearGradient id="pcard-prism" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#9DFFD8" />
                <stop offset="0.5" stopColor="#C7A6FF" />
                <stop offset="1" stopColor="#FF9AD5" />
              </linearGradient>
            </defs>
          )}
          <CornerArt kind={kind} />
        </svg>
      ))}
    </>
  );
}

/** Petites taches lumineuses posees en pourcentage de la carte. */
function Dots({
  className,
  points,
}: {
  className: string;
  points: [x: number, y: number, size: number][];
}) {
  return (
    <>
      {points.map(([x, y, size], i) => (
        <span
          key={i}
          className={className}
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              '--s': size,
              '--i': i,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

const STARS: [number, number, number][] = [
  [14, 12, 1],
  [80, 30, 0.8],
  [22, 44, 0.7],
  [86, 56, 1.1],
  [10, 70, 0.8],
  [64, 8, 0.7],
];

const FLAKES: [number, number, number][] = [
  [16, 24, 1],
  [82, 18, 0.8],
  [10, 58, 0.7],
  [90, 48, 1],
  [24, 86, 0.8],
  [76, 80, 0.9],
];

const PARTICLES: [number, number, number][] = [
  [12, 90, 1],
  [26, 96, 0.7],
  [44, 92, 0.9],
  [58, 98, 0.6],
  [72, 94, 1],
  [88, 90, 0.8],
  [36, 100, 0.7],
  [64, 102, 0.9],
];

const VOID_STARS: [number, number, number][] = [
  [10, 10, 0.8],
  [26, 22, 0.6],
  [84, 12, 1],
  [70, 30, 0.6],
  [14, 48, 0.7],
  [90, 44, 0.8],
  [8, 80, 1],
  [30, 92, 0.6],
  [78, 88, 0.9],
  [92, 70, 0.6],
];

/** Jeton noir en filigrane, au centre de la carte Onyx. */
function Watermark() {
  return (
    <svg className="pcard__watermark" viewBox="0 0 40 40" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="18.5"
        fill="none"
        stroke="#E3B95A"
        strokeWidth="1"
      />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={i}
          x="17.8"
          y="1.6"
          width="4.4"
          height="4.6"
          rx="1"
          fill="#E3B95A"
          transform={`rotate(${i * 45} 20 20)`}
        />
      ))}
      <circle
        cx="20"
        cy="20"
        r="11"
        fill="none"
        stroke="#E3B95A"
        strokeWidth="0.8"
        strokeDasharray="2 1.7"
      />
      <path
        d="M13.6 24.6 L12.6 15.8 L16.6 19 L20 13 L23.4 19 L27.4 15.8 L26.4 24.6 Z"
        fill="#E3B95A"
      />
    </svg>
  );
}

/** Le signe de l'infini, trace par une lumiere qui le parcourt sans fin. */
function InfinitySign() {
  const d =
    'M50 25 C40 6 4 6 4 25 C4 44 40 44 50 25 C60 6 96 6 96 25 C96 44 60 44 50 25 Z';
  return (
    <svg className="pcard__infinity" viewBox="0 0 100 50" aria-hidden="true">
      <defs>
        <linearGradient id="pcard-void" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F3D27C" />
          <stop offset="0.5" stopColor="#C9A0FF" />
          <stop offset="1" stopColor="#F3D27C" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke="#C9A0FF"
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
      <path
        className="pcard__infinity-run"
        d={d}
        fill="none"
        stroke="url(#pcard-void)"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={100}
      />
    </svg>
  );
}

/** Decor d'une carte de profil, selon son style. */
export function CardDecor({ style }: { style: string }) {
  let decor: ReactNode = null;
  switch (style) {
    case 'carte-velvet':
      decor = <span className="pcard__inlay pcard__inlay--stitch" />;
      break;
    case 'carte-midnight':
      decor = (
        <>
          <svg className="pcard__moon" viewBox="0 0 40 40" aria-hidden="true">
            <path
              d="M26 4 A16 16 0 1 0 36 30 A13 13 0 1 1 26 4 Z"
              fill="#FFF1BF"
            />
          </svg>
          <Dots className="pcard__star" points={STARS} />
          <span className="pcard__comet" />
        </>
      );
      break;
    case 'carte-deco':
      decor = (
        <>
          <span className="pcard__inlay pcard__inlay--double" />
          <Corners kind="deco" />
        </>
      );
      break;
    case 'carte-marble':
      decor = (
        <>
          <span className="pcard__inlay pcard__inlay--gold" />
          <Corners kind="marble" />
          <span className="pcard__sheen" />
        </>
      );
      break;
    case 'carte-vegas':
      decor = (
        <>
          <span className="pcard__neon" />
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <span key={side} className={`pcard__bulbs pcard__bulbs--${side}`} />
          ))}
        </>
      );
      break;
    case 'carte-gilded':
      decor = (
        <>
          <Corners kind="gilded" />
          <Dots className="pcard__flake" points={FLAKES} />
          <span className="pcard__sheen" />
        </>
      );
      break;
    case 'carte-holo':
      decor = (
        <>
          <span className="pcard__foil" />
          <span className="pcard__rainbow" />
          <Dots className="pcard__sparkle" points={STARS} />
        </>
      );
      break;
    case 'carte-legend':
      decor = (
        <>
          <span className="pcard__aurora" />
          <span className="pcard__rainbow pcard__rainbow--legend" />
          <Corners kind="legend" />
          <Dots className="pcard__particle" points={PARTICLES} />
          <Dots className="pcard__sparkle" points={FLAKES} />
        </>
      );
      break;
    case 'carte-onyx':
      decor = (
        <>
          <span className="pcard__inlay pcard__inlay--double" />
          <Watermark />
          <Corners kind="gilded" />
          <span className="pcard__sheen" />
        </>
      );
      break;
    case 'carte-infini':
      decor = (
        <>
          <span className="pcard__nebula" />
          <Dots className="pcard__star" points={VOID_STARS} />
          <InfinitySign />
          <span className="pcard__rainbow pcard__rainbow--void" />
          <Dots
            className="pcard__particle pcard__particle--violet"
            points={PARTICLES}
          />
        </>
      );
      break;
  }
  if (!decor) return null;
  return (
    <span className="pcard__decor" aria-hidden="true">
      {decor}
    </span>
  );
}
