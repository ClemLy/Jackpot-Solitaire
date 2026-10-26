// Avatars de la Boutique Legendaire. Ils se paient en jetons noirs apres des
// heures de jeu: ce sont des illustrations completes (decor en profondeur,
// volumes en degrades, lumiere de contour, orfevrerie, animations), et non
// des pictogrammes. Plus le niveau requis est haut, plus elles sont riches.
// Chaque portrait tient dans un disque de 100 x 100.

import type { CSSProperties, ReactNode } from 'react';

const anim = (i: number) => ({ '--i': i }) as CSSProperties;

/** Etoile a quatre branches. */
function star4(x: number, y: number, s: number) {
  const k = s * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}

function Twinkles({
  points,
  fill = '#FFFFFF',
}: {
  points: [number, number, number][];
  fill?: string;
}) {
  return (
    <>
      {points.map(([x, y, s], i) => (
        <path
          key={i}
          className="av-twinkle"
          style={anim(i)}
          d={star4(x, y, s)}
          fill={fill}
        />
      ))}
    </>
  );
}

/** Pierre taillee: losange a facettes avec un eclat. */
function Gem({
  x,
  y,
  r,
  fill,
  edge = '#FFF1BF',
}: {
  x: number;
  y: number;
  r: number;
  fill: string;
  edge?: string;
}) {
  return (
    <g>
      <path
        d={`M${x} ${y - r} L${x + r * 0.8} ${y} L${x} ${y + r} L${x - r * 0.8} ${y} Z`}
        fill={fill}
        stroke={edge}
        strokeWidth={r * 0.22}
        strokeLinejoin="round"
      />
      <path
        d={`M${x} ${y - r} L${x + r * 0.35} ${y - r * 0.1} L${x} ${y + r * 0.15} L${x - r * 0.35} ${y - r * 0.1} Z`}
        fill="#FFFFFF"
        opacity="0.55"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// L'Ombre (niveau III): une silhouette encapuchonnee dans la brume violette,
// des cartes qui flottent, un jeton noir sur la poitrine.
// ---------------------------------------------------------------------------

function OmbreDefs() {
  return (
    <defs>
      <radialGradient id="lav-omb-bg" cx="50%" cy="40%" r="70%">
        <stop offset="0" stopColor="#5A3596" />
        <stop offset="0.45" stopColor="#1E1036" />
        <stop offset="1" stopColor="#050308" />
      </radialGradient>
      <linearGradient id="lav-omb-cloak" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3A2660" />
        <stop offset="0.5" stopColor="#170F26" />
        <stop offset="1" stopColor="#07050C" />
      </linearGradient>
      <linearGradient id="lav-omb-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFF1BF" />
        <stop offset="0.5" stopColor="#E3B95A" />
        <stop offset="1" stopColor="#7A5517" />
      </linearGradient>
    </defs>
  );
}

function OmbreScene() {
  return (
    <>
      <rect width="100" height="100" fill="url(#lav-omb-bg)" />
      <ellipse cx="50" cy="96" rx="60" ry="16" fill="#7B4FC8" opacity="0.18" />
      {[
        [14, 40, -16, 0],
        [86, 46, 14, 1],
        [22, 72, 8, 2],
      ].map(([x, y, r, i]) => (
        <g key={i} className="av-float" style={anim(i)}>
          <g transform={`rotate(${r} ${x} ${y})`}>
            <rect
              x={x - 6}
              y={y - 8.5}
              width="12"
              height="17"
              rx="1.6"
              fill="#0B0910"
              stroke="url(#lav-omb-gold)"
              strokeWidth="0.8"
            />
            <path
              d={`M${x} ${y - 4} C${x - 3} ${y - 1} ${x - 4} ${y + 1} ${x - 2} ${y + 2.5} C${x - 1} ${y + 3} ${x - 0.4} ${y + 2} ${x} ${y + 1.6} L${x - 0.8} ${y + 4.4} H${x + 0.8} L${x} ${y + 1.6} C${x + 0.4} ${y + 2} ${x + 1} ${y + 3} ${x + 2} ${y + 2.5} C${x + 4} ${y + 1} ${x + 3} ${y - 1} ${x} ${y - 4} Z`}
              fill="#C9A0FF"
            />
          </g>
        </g>
      ))}
      <Twinkles
        points={[
          [30, 14, 1.6],
          [72, 18, 1.3],
          [88, 70, 1.4],
        ]}
        fill="#C9A0FF"
      />
    </>
  );
}

function OmbreFigure() {
  return (
    <>
      <path
        d="M6 104 C10 80 27 69 50 69 C73 69 90 80 94 104 Z"
        fill="url(#lav-omb-cloak)"
      />
      <path
        d="M18 84 C24 74 36 70 46 70 M82 84 C76 74 64 70 54 70"
        fill="none"
        stroke="#B07CFF"
        strokeWidth="0.9"
        opacity="0.75"
      />
      <path d="M41 71 L50 104 L59 71 Z" fill="#050307" />
      <path
        d="M23 67 C20 40 31 15 50 13 C69 15 80 40 77 67 C70 74 30 74 23 67 Z"
        fill="url(#lav-omb-cloak)"
      />
      <path
        d="M24 62 C23 40 33 18 50 14"
        fill="none"
        stroke="#C9A0FF"
        strokeWidth="1"
        opacity="0.55"
      />
      <path
        d="M29 64 C28 44 37 25 50 24 C63 25 72 44 71 64"
        fill="none"
        stroke="url(#lav-omb-gold)"
        strokeWidth="1.1"
      />
      <path
        d="M31 62 C30 46 39 29 50 29 C61 29 70 46 69 62 C62 67 38 67 31 62 Z"
        fill="#030205"
      />
      <path
        d="M40 72 Q50 82 60 72"
        fill="none"
        stroke="url(#lav-omb-gold)"
        strokeWidth="1"
      />
      <circle
        cx="50"
        cy="85"
        r="7.4"
        fill="#0B0910"
        stroke="url(#lav-omb-gold)"
        strokeWidth="1.4"
      />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={i}
          x="49"
          y="78"
          width="2"
          height="2.2"
          rx="0.4"
          fill="#E3B95A"
          transform={`rotate(${i * 45} 50 85)`}
        />
      ))}
      <circle cx="50" cy="85" r="4" fill="#3A2260" />
      <path d="M50 82.4 L51.8 85 L50 87.6 L48.2 85 Z" fill="#F3D27C" />
    </>
  );
}

function OmbreFx() {
  return (
    <>
      <g className="av-pulse">
        <ellipse cx="43" cy="47" rx="7" ry="4" fill="#F3D27C" opacity="0.32" />
        <ellipse cx="57" cy="47" rx="7" ry="4" fill="#F3D27C" opacity="0.32" />
      </g>
      <path
        d="M39.2 47 Q43 44.2 46.8 47 Q43 49.2 39.2 47 Z M53.2 47 Q57 44.2 60.8 47 Q57 49.2 53.2 47 Z"
        fill="#FFE6A0"
      />
      <circle cx="43" cy="46.6" r="0.9" fill="#FFFFFF" />
      <circle cx="57" cy="46.6" r="0.9" fill="#FFFFFF" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Le Phenix (niveau VII): un oiseau de feu aux ailes deployees, plume par
// plume, devant un soleil couchant; aigrette de flammes et braises.
// ---------------------------------------------------------------------------

/** Une aile: trois rangs de plumes (remiges, secondaires, couvertures). */
/**
 * Plume-flamme: une tige qui s'incurve (bend, en degres sur toute la
 * longueur), large pres de la racine et effilee a la pointe.
 */
function flameFeather(
  x: number,
  y: number,
  angle: number,
  len: number,
  w: number,
  bend: number,
) {
  const steps = 14;
  const spine: [number, number, number][] = [];
  let px = x;
  let py = y;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const a = ((angle + bend * t * t) * Math.PI) / 180;
    spine.push([px, py, a]);
    px += (Math.cos(a) * len) / steps;
    py += (Math.sin(a) * len) / steps;
  }
  const left: string[] = [];
  const right: string[] = [];
  spine.forEach(([sx, sy, a], k) => {
    const t = k / steps;
    const half = w * Math.min(1, t * 5) * Math.pow(1 - t, 0.9);
    const nx = -Math.sin(a) * half;
    const ny = Math.cos(a) * half;
    left.push(`${(sx + nx).toFixed(2)} ${(sy + ny).toFixed(2)}`);
    right.unshift(`${(sx - nx).toFixed(2)} ${(sy - ny).toFixed(2)}`);
  });
  return `M${left.join(' L')} L${right.join(' L')} Z`;
}

/** Une aile relevee en V: trois rangs de plumes-flammes. */
function PhoenixWing({ side }: { side: 1 | -1 }) {
  const rx = side === 1 ? 45 : 55;
  const ry = 55;
  const ang = (a: number) => (side === 1 ? a : 180 - a);
  const bend = (b: number) => b * side;
  const layers = [
    {
      n: 7,
      from: 262,
      to: 200,
      len: [50, 44],
      w: 4.6,
      bend: -34,
      fill: 'url(#lav-phx-wing)',
    },
    {
      n: 6,
      from: 258,
      to: 210,
      len: [34, 30],
      w: 4.2,
      bend: -30,
      fill: 'url(#lav-phx-wing2)',
    },
    {
      n: 5,
      from: 252,
      to: 218,
      len: [19, 17],
      w: 3.6,
      bend: -24,
      fill: 'url(#lav-phx-cover)',
    },
  ];
  return (
    <g>
      {layers.map((l, r) =>
        Array.from({ length: l.n }, (_, i) => {
          const t = i / (l.n - 1);
          const a = l.from + (l.to - l.from) * t;
          const len = l.len[0] + (l.len[1] - l.len[0]) * t;
          return (
            <path
              key={`${r}-${i}`}
              d={flameFeather(rx, ry, ang(a), len, l.w, bend(l.bend))}
              fill={l.fill}
              stroke={r === 2 ? '#8F5A10' : '#5A0E1A'}
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
          );
        }),
      )}
    </g>
  );
}

function PhenixDefs() {
  return (
    <defs>
      <radialGradient id="lav-phx-sky" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="#FFE9A8" />
        <stop offset="0.22" stopColor="#FF9A3A" />
        <stop offset="0.5" stopColor="#C8382A" />
        <stop offset="0.8" stopColor="#4E0A1A" />
        <stop offset="1" stopColor="#1A030A" />
      </radialGradient>
      <radialGradient id="lav-phx-sun" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#FFFBEA" />
        <stop offset="0.45" stopColor="#FFE08A" stopOpacity="0.85" />
        <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
      </radialGradient>
      <radialGradient
        id="lav-phx-wing"
        cx="50"
        cy="56"
        r="56"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#FFE08A" />
        <stop offset="0.35" stopColor="#FF8A2A" />
        <stop offset="0.65" stopColor="#D2302F" />
        <stop offset="1" stopColor="#5E0A1E" />
      </radialGradient>
      <radialGradient
        id="lav-phx-wing2"
        cx="50"
        cy="56"
        r="36"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#FFF6D0" />
        <stop offset="0.5" stopColor="#FFB347" />
        <stop offset="1" stopColor="#F0502A" />
      </radialGradient>
      <linearGradient id="lav-phx-cover" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#C97A20" />
        <stop offset="0.5" stopColor="#F3C45A" />
        <stop offset="1" stopColor="#FFF1BF" />
      </linearGradient>
      <linearGradient id="lav-phx-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFC46B" />
        <stop offset="0.5" stopColor="#F2702A" />
        <stop offset="1" stopColor="#A82020" />
      </linearGradient>
      <radialGradient id="lav-phx-head" cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor="#FFC46B" />
        <stop offset="0.6" stopColor="#E8492A" />
        <stop offset="1" stopColor="#9A1C1C" />
      </radialGradient>
      <linearGradient id="lav-phx-flame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#E8492A" />
        <stop offset="0.5" stopColor="#FFB347" />
        <stop offset="1" stopColor="#FFF3C4" />
      </linearGradient>
      <linearGradient id="lav-phx-tail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF3C4" />
        <stop offset="0.4" stopColor="#FFB347" />
        <stop offset="1" stopColor="#C42A3D" />
      </linearGradient>
      <linearGradient id="lav-phx-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFF1BF" />
        <stop offset="0.5" stopColor="#E3B95A" />
        <stop offset="1" stopColor="#8F6418" />
      </linearGradient>
    </defs>
  );
}

function PhenixScene() {
  return (
    <>
      <rect width="100" height="100" fill="url(#lav-phx-sky)" />
      <g className="av-spin" opacity="0.2">
        {Array.from({ length: 18 }, (_, i) => (
          <path
            key={i}
            d="M50 50 L48.6 -12 H51.4 Z"
            fill="#FFF6D8"
            transform={`rotate(${i * 20} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="40" r="30" fill="url(#lav-phx-sun)" />
      <circle
        cx="50"
        cy="40"
        r="22"
        fill="none"
        stroke="#FFF1BF"
        strokeWidth="0.6"
        opacity="0.6"
      />
    </>
  );
}

function PhenixFigure() {
  return (
    <>
      {/* Traine: trois plumes-flammes qui retombent et s'enroulent. */}
      {[
        [48, 78, 112, 34, 4.2, 70],
        [52, 78, 68, 34, 4.2, -70],
        [50, 80, 92, 28, 3.6, 30],
      ].map(([x, y, a, l, w, b], i) => (
        <path
          key={i}
          d={flameFeather(x, y, a, l, w, b)}
          fill="url(#lav-phx-tail)"
          stroke="#7A1A10"
          strokeWidth="0.4"
        />
      ))}
      <PhoenixWing side={1} />
      <PhoenixWing side={-1} />
      {/* Buste effile et ecailles de plumes en chevrons. */}
      <path
        d="M50 43 C56.5 45 58.6 55 57.6 65 C56.8 73 53.6 79 50 83 C46.4 79 43.2 73 42.4 65 C41.4 55 43.5 45 50 43 Z"
        fill="url(#lav-phx-body)"
        stroke="#7A1A10"
        strokeWidth="0.4"
      />
      <g fill="none" stroke="#FFE08A" strokeWidth="0.5" opacity="0.55">
        {[56, 61, 66, 71, 76].map((y, r) =>
          [-1, 0, 1].map((k) => {
            const x = 50 + k * 4.4 + (r % 2 ? 2.2 : 0);
            if (Math.abs(x - 50) > 6 - r * 0.4) return null;
            return (
              <path
                key={`${y}-${k}`}
                d={`M${x - 2} ${y} L${x} ${y + 2.2} L${x + 2} ${y}`}
              />
            );
          }),
        )}
      </g>
      {/* Aigrette: trois longues plumes qui partent vers l'arriere. */}
      <g className="av-flicker">
        {[
          [51, 26, 232, 20, 2.8, -40],
          [52.4, 25.6, 252, 22, 3, -50],
          [50, 27.4, 214, 16, 2.4, -30],
        ].map(([x, y, a, l, w, b], i) => (
          <g key={i}>
            <path
              d={flameFeather(x, y, a, l, w, b)}
              fill="url(#lav-phx-flame)"
            />
          </g>
        ))}
      </g>
      {/* Cou et tete de profil. */}
      <path
        d="M46 46 C45 40 47 34 51 30 L58 32 C55 36 54 41 54.6 46 Z"
        fill="url(#lav-phx-body)"
      />
      <circle cx="54" cy="29.4" r="7.6" fill="url(#lav-phx-head)" />
      <path
        d="M60.4 26.6 C66 26.2 69.4 29 68.4 33.2 C66.6 31.4 63.8 31.2 61.2 32.2 Z"
        fill="url(#lav-phx-gold)"
        stroke="#7A5517"
        strokeWidth="0.4"
      />
      <path
        d="M61.2 32.2 C63.6 32 65.4 32.6 65.6 33.8 C63.8 34.8 61.8 34.2 61 33.2 Z"
        fill="#B98A2A"
      />
      <circle cx="56.4" cy="28.2" r="2.4" fill="#FFF1BF" />
      <circle cx="56.6" cy="28.2" r="1.6" fill="#FF8A00" />
      <circle cx="56.7" cy="28.2" r="0.8" fill="#1A0505" />
      <circle cx="57.1" cy="27.7" r="0.45" fill="#FFFFFF" />
      <path
        d="M54 28.4 Q50.6 29 48.4 31.6"
        fill="none"
        stroke="#6B0F1F"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M54.4 25.4 Q57.6 24.4 60.2 26"
        fill="none"
        stroke="#FFE08A"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      {/* Collier d'or et rubis. */}
      <path
        d="M44.6 47.4 Q50 52.4 55.4 47.4"
        fill="none"
        stroke="url(#lav-phx-gold)"
        strokeWidth="1.3"
      />
      <Gem x={50} y={51.6} r={2.2} fill="#C42A3D" />
    </>
  );
}

function PhenixFx() {
  return (
    <>
      {[
        [24, 86],
        [76, 84],
        [14, 64],
        [86, 60],
        [62, 94],
        [36, 96],
        [30, 50],
        [70, 48],
      ].map(([x, y], i) => (
        <circle
          key={i}
          className="av-rise"
          style={anim(i)}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 1.4 : 1}
          fill="#FFE7A0"
        />
      ))}
      <Twinkles
        points={[
          [50, 53.2, 2.6],
          [72, 20, 1.8],
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// L'Oracle (niveau XVII): une voyante en robe brodee d'or, cheveux d'argent,
// troisieme oeil serti au front, mains autour d'une boule de cristal ou
// tourne une galaxie. Ciel de nuit, cercle de runes, cartes de tarot.
// ---------------------------------------------------------------------------

const RUNES = [
  'M-1.6 -2 V2 M-1.6 -2 L1.6 0',
  'M0 -2 V2 M-1.6 -0.6 H1.6',
  'M-1.6 2 L0 -2 L1.6 2',
  'M-1.4 -2 L1.4 2 M1.4 -2 L-1.4 2',
  'M0 -2 V2 M0 -2 L1.6 -0.6 M0 0 L1.6 1.4',
  'M-1.6 -2 L1.6 -2 L-1.6 2 L1.6 2',
];

function OracleDefs() {
  return (
    <defs>
      <radialGradient id="lav-orc-sky" cx="50%" cy="32%" r="75%">
        <stop offset="0" stopColor="#4058B8" />
        <stop offset="0.45" stopColor="#18236A" />
        <stop offset="1" stopColor="#05081E" />
      </radialGradient>
      <linearGradient id="lav-orc-robe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3D63C4" />
        <stop offset="1" stopColor="#142559" />
      </linearGradient>
      <linearGradient id="lav-orc-hood" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4C73D6" />
        <stop offset="0.6" stopColor="#25408F" />
        <stop offset="1" stopColor="#121F4E" />
      </linearGradient>
      <linearGradient id="lav-orc-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFF1BF" />
        <stop offset="0.5" stopColor="#E3B95A" />
        <stop offset="1" stopColor="#8F6418" />
      </linearGradient>
      <linearGradient id="lav-orc-hair" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F4F7FF" />
        <stop offset="1" stopColor="#9AA7C7" />
      </linearGradient>
      <radialGradient id="lav-orc-skin" cx="45%" cy="40%" r="65%">
        <stop offset="0" stopColor="#F6D3AE" />
        <stop offset="1" stopColor="#D49A74" />
      </radialGradient>
      <radialGradient id="lav-orc-ball" cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor="#D6FBFF" />
        <stop offset="0.3" stopColor="#62C6F0" />
        <stop offset="0.7" stopColor="#3A3FB0" />
        <stop offset="1" stopColor="#1C1250" />
      </radialGradient>
      <radialGradient id="lav-orc-gem" cx="40%" cy="35%" r="65%">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.45" stopColor="#7FE3FF" />
        <stop offset="1" stopColor="#1F7AB8" />
      </radialGradient>
    </defs>
  );
}

function OracleScene() {
  return (
    <>
      <rect width="100" height="100" fill="url(#lav-orc-sky)" />
      {[
        [8, 22],
        [18, 10],
        [30, 6],
        [64, 8],
        [92, 34],
        [6, 44],
        [94, 60],
        [12, 64],
        [40, 4],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 ? 0.5 : 0.8}
          fill="#FFFFFF"
          opacity="0.8"
        />
      ))}
      {/* Lune et son halo. */}
      <circle cx="80" cy="18" r="13" fill="#BFD6FF" opacity="0.14" />
      <path d="M84 10 A9 9 0 1 0 86 25 A7 7 0 1 1 84 10 Z" fill="#F2F6FF" />
      {/* Cercle de runes qui tourne lentement derriere elle. */}
      <g className="av-spin" style={{ animationDuration: '60s' }} opacity="0.5">
        <circle
          cx="50"
          cy="44"
          r="37"
          fill="none"
          stroke="#E3B95A"
          strokeWidth="0.6"
        />
        <circle
          cx="50"
          cy="44"
          r="33"
          fill="none"
          stroke="#E3B95A"
          strokeWidth="0.4"
          strokeDasharray="1 2"
        />
        {Array.from({ length: 12 }, (_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const x = 50 + Math.cos(a) * 35;
          const y = 44 + Math.sin(a) * 35;
          return (
            <path
              key={i}
              d={RUNES[i % RUNES.length]}
              transform={`translate(${x} ${y}) rotate(${i * 30})`}
              fill="none"
              stroke="#FFE08A"
              strokeWidth="0.6"
              strokeLinecap="round"
            />
          );
        })}
      </g>
      {/* Cartes de tarot qui flottent. */}
      {[
        [12, 52, -14, 0, 'sun'],
        [88, 50, 12, 1, 'moon'],
      ].map(([x, y, r, i, kind]) => (
        <g key={i as number} className="av-float" style={anim(i as number)}>
          <g transform={`rotate(${r} ${x} ${y})`}>
            <rect
              x={(x as number) - 6.5}
              y={(y as number) - 10}
              width="13"
              height="20"
              rx="1.4"
              fill="#141A46"
              stroke="url(#lav-orc-gold)"
              strokeWidth="0.8"
            />
            <rect
              x={(x as number) - 5}
              y={(y as number) - 8.5}
              width="10"
              height="17"
              rx="0.8"
              fill="none"
              stroke="#E3B95A"
              strokeWidth="0.35"
              opacity="0.7"
            />
            {kind === 'sun' ? (
              <g>
                <circle
                  cx={x as number}
                  cy={y as number}
                  r="2.4"
                  fill="#F3D27C"
                />
                {Array.from({ length: 8 }, (_, k) => (
                  <path
                    key={k}
                    d={`M${x} ${(y as number) - 3.4} V${(y as number) - 4.8}`}
                    stroke="#F3D27C"
                    strokeWidth="0.6"
                    transform={`rotate(${k * 45} ${x} ${y})`}
                  />
                ))}
              </g>
            ) : (
              <path
                d={`M${(x as number) + 1} ${(y as number) - 3.4} A3.4 3.4 0 1 0 ${(x as number) + 1.6} ${(y as number) + 2.8} A2.6 2.6 0 1 1 ${(x as number) + 1} ${(y as number) - 3.4} Z`}
                fill="#E9EEFF"
              />
            )}
          </g>
        </g>
      ))}
    </>
  );
}

function OracleFigure() {
  return (
    <>
      {/* Robe brodee. */}
      <path
        d="M8 104 C12 82 28 71 50 71 C72 71 88 82 92 104 Z"
        fill="url(#lav-orc-robe)"
      />
      <path d="M41 72 L50 104 L59 72 Z" fill="#0C1638" />
      <path
        d="M41 72 L50 104 L59 72"
        fill="none"
        stroke="url(#lav-orc-gold)"
        strokeWidth="1.2"
      />
      <path
        d="M38.6 72.6 L48.2 104 M61.4 72.6 L51.8 104"
        fill="none"
        stroke="#E3B95A"
        strokeWidth="0.5"
        strokeDasharray="0.8 1.2"
        opacity="0.8"
      />
      {[
        [26, 88],
        [74, 88],
        [18, 98],
        [82, 98],
      ].map(([x, y], i) => (
        <path key={i} d={star4(x, y, 1.6)} fill="#E3B95A" opacity="0.8" />
      ))}
      {/* Capuche: exterieur, ombre interieure, liseres d'or. */}
      <path
        d="M21 74 C17 44 29 15 50 13 C71 15 83 44 79 74 C70 70 30 70 21 74 Z"
        fill="url(#lav-orc-hood)"
      />
      <path d="M29 70 C27 46 37 25 50 24 C63 25 73 46 71 70 Z" fill="#0B1538" />
      <path
        d="M29 70 C27 46 37 25 50 24 C63 25 73 46 71 70"
        fill="none"
        stroke="url(#lav-orc-gold)"
        strokeWidth="1.3"
      />
      <path
        d="M31.6 68 C30 47 39 28 50 27.4 C61 28 70 47 68.4 68"
        fill="none"
        stroke="#E3B95A"
        strokeWidth="0.45"
        strokeDasharray="0.9 1.3"
        opacity="0.8"
      />
      {/* Cheveux d'argent, puis le visage. */}
      <path
        d="M37 34 C31 44 31 60 34 72 L41 72 C38.6 60 38.6 46 43 37 Z"
        fill="url(#lav-orc-hair)"
      />
      <path
        d="M63 34 C69 44 69 60 66 72 L59 72 C61.4 60 61.4 46 57 37 Z"
        fill="url(#lav-orc-hair)"
      />
      <rect x="45" y="56" width="10" height="13" rx="3" fill="#C98E62" />
      <ellipse cx="50" cy="46" rx="12.4" ry="14" fill="url(#lav-orc-skin)" />
      <path
        d="M38 40 C40 32 46 30 50 30 C54 30 60 32 62 40 C58 35 54 34 50 34 C46 34 42 35 38 40 Z"
        fill="url(#lav-orc-hair)"
      />
      <path
        d="M41.6 47.6 Q44.4 50 47.2 47.6 M52.8 47.6 Q55.6 50 58.4 47.6"
        fill="none"
        stroke="#3A2418"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M42 49.4 L41.2 50.6 M44.4 50.2 L44.4 51.4 M46.8 49.4 L47.6 50.6 M53.2 49.4 L52.4 50.6 M55.6 50.2 L55.6 51.4 M58 49.4 L58.8 50.6"
        stroke="#3A2418"
        strokeWidth="0.45"
        strokeLinecap="round"
      />
      <path
        d="M41.6 44 Q44.4 42.6 47.2 43.6 M52.8 43.6 Q55.6 42.6 58.4 44"
        fill="none"
        stroke="#B9C3DE"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <ellipse
        cx="41.4"
        cy="53"
        rx="2.6"
        ry="1.6"
        fill="#EC8C82"
        opacity="0.35"
      />
      <ellipse
        cx="58.6"
        cy="53"
        rx="2.6"
        ry="1.6"
        fill="#EC8C82"
        opacity="0.35"
      />
      <path
        d="M50 50 L49 54 Q50 54.6 51 54"
        fill="none"
        stroke="#B8805A"
        strokeWidth="0.6"
      />
      <path d="M46.6 57 Q50 59.2 53.4 57 Q50 58.2 46.6 57 Z" fill="#B85A62" />
      {/* Diademe et troisieme oeil. */}
      <path
        d="M38.2 39 Q50 33.4 61.8 39"
        fill="none"
        stroke="url(#lav-orc-gold)"
        strokeWidth="1.6"
      />
      <Gem x={42} y={37.6} r={1.2} fill="#7FE3FF" />
      <Gem x={58} y={37.6} r={1.2} fill="#7FE3FF" />
      {/* Mains autour de la boule de cristal. */}
      <path
        d="M30 92 C30 84 34 78 39 77 C41 77 41.6 79 40 80.4 C37.6 82.6 36.6 86 37.4 90 Z"
        fill="url(#lav-orc-skin)"
      />
      <path
        d="M70 92 C70 84 66 78 61 77 C59 77 58.4 79 60 80.4 C62.4 82.6 63.4 86 62.6 90 Z"
        fill="url(#lav-orc-skin)"
      />
      <path d="M38 97 L62 97 L59.6 101 H40.4 Z" fill="url(#lav-orc-gold)" />
      <path
        d="M40 97 C38 95 38 93 40 92.4 M60 97 C62 95 62 93 60 92.4"
        fill="none"
        stroke="url(#lav-orc-gold)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  );
}

function OracleFx() {
  return (
    <>
      <circle
        className="av-pulse"
        cx="50"
        cy="35.6"
        r="6.4"
        fill="#7FE3FF"
        opacity="0.45"
      />
      <path
        d="M50 31.6 L53 35.6 L50 39.6 L47 35.6 Z"
        fill="url(#lav-orc-gem)"
        stroke="#FFF1BF"
        strokeWidth="0.7"
      />
      <circle
        className="av-pulse"
        style={anim(1)}
        cx="50"
        cy="85"
        r="19"
        fill="#7FE3FF"
        opacity="0.3"
      />
      <circle
        cx="50"
        cy="85"
        r="13.6"
        fill="url(#lav-orc-ball)"
        stroke="#DFF8FF"
        strokeWidth="0.7"
      />
      <g className="av-spin" style={{ animationDuration: '9s' }}>
        <path
          d="M40 86 C40 78 50 75 55 80 C60 85 54 92 47 90 C42 88.6 44 83 49 83.6"
          fill="none"
          stroke="#E9DDFF"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M60 84 C60 92 50 95 45 90 C40 85 46 78 53 80"
          fill="none"
          stroke="#7FE3FF"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.8"
        />
        {[
          [44, 80],
          [57, 89],
          [52, 78],
          [45, 91],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.6" fill="#FFFFFF" />
        ))}
      </g>
      <ellipse
        cx="45"
        cy="79"
        rx="4"
        ry="2.4"
        fill="#FFFFFF"
        opacity="0.55"
        transform="rotate(-30 45 79)"
      />
      <Twinkles
        points={[
          [33, 74, 1.8],
          [67, 76, 1.6],
          [50, 66, 1.3],
          [26, 30, 1.4],
        ]}
        fill="#BFEFFF"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Le Sphinx (niveau XXIV): un pharaon d'or et de lapis devant le disque de
// Ra, pyramides au crepuscule; nemes raye, cobra royal, large collier
// ousekh de gemmes, regard de khol aux iris turquoise.
// ---------------------------------------------------------------------------

const NEMES =
  'M23 31 C25 16 37 9 50 9 C63 9 75 16 77 31 L83 84 L66 79 L64 41 L36 41 L34 79 L17 84 Z';

function SphinxDefs() {
  return (
    <defs>
      <linearGradient id="lav-sph-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#120C2E" />
        <stop offset="0.35" stopColor="#3A1E5A" />
        <stop offset="0.62" stopColor="#B3526A" />
        <stop offset="0.8" stopColor="#F2A65A" />
        <stop offset="1" stopColor="#F7D08A" />
      </linearGradient>
      <radialGradient id="lav-sph-sun" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#FFF8DA" />
        <stop offset="0.55" stopColor="#FFD86A" />
        <stop offset="0.85" stopColor="#F3A93A" stopOpacity="0.6" />
        <stop offset="1" stopColor="#F3A93A" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="lav-sph-gold" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7A5517" />
        <stop offset="0.3" stopColor="#F3D27C" />
        <stop offset="0.5" stopColor="#FFF1BF" />
        <stop offset="0.7" stopColor="#E3B95A" />
        <stop offset="1" stopColor="#6B4410" />
      </linearGradient>
      <linearGradient id="lav-sph-goldv" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF1BF" />
        <stop offset="0.5" stopColor="#E3B95A" />
        <stop offset="1" stopColor="#8F6418" />
      </linearGradient>
      <linearGradient id="lav-sph-skin" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#E0A868" />
        <stop offset="0.55" stopColor="#C88A50" />
        <stop offset="1" stopColor="#8E5A2E" />
      </linearGradient>
      <clipPath id="lav-sph-nemes">
        <path d={NEMES} />
      </clipPath>
    </defs>
  );
}

function SphinxScene() {
  return (
    <>
      <rect width="100" height="100" fill="url(#lav-sph-sky)" />
      {[
        [10, 8],
        [24, 14],
        [76, 6],
        [90, 16],
        [62, 12],
        [6, 26],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.6" fill="#FFF6DA" opacity="0.85" />
      ))}
      {/* Disque de Ra et ses rayons. */}
      <g
        className="av-spin"
        style={{ animationDuration: '50s' }}
        opacity="0.35"
      >
        {Array.from({ length: 28 }, (_, i) => (
          <path
            key={i}
            d="M50 40 L49 2 H51 Z"
            fill="#FFE08A"
            transform={`rotate(${i * (360 / 28)} 50 40)`}
          />
        ))}
      </g>
      <circle cx="50" cy="40" r="31" fill="url(#lav-sph-sun)" />
      <circle
        cx="50"
        cy="40"
        r="27"
        fill="none"
        stroke="#FFE08A"
        strokeWidth="0.8"
        opacity="0.8"
      />
      {/* Pyramides au couchant, face eclairee et face d'ombre. */}
      <path d="M-6 92 L20 58 L46 92 Z" fill="#9A5A2A" />
      <path d="M20 58 L46 92 L28 92 Z" fill="#E7A65A" />
      <path d="M58 92 L84 54 L110 92 Z" fill="#8A4E22" />
      <path d="M84 54 L110 92 L92 92 Z" fill="#DE9A50" />
      <path d="M52 92 L62 76 L72 92 Z" fill="#A86A30" opacity="0.8" />
      <path
        d="M-4 96 C20 88 40 92 54 90 C70 88 86 90 104 94 V104 H-4 Z"
        fill="#C98A45"
      />
    </>
  );
}

function SphinxFigure() {
  return (
    <>
      {/* Epaules et collier ousekh. */}
      <path
        d="M10 104 C13 82 28 72 50 72 C72 72 87 82 90 104 Z"
        fill="url(#lav-sph-skin)"
      />
      {[
        [34, '#B8323A', 2.4],
        [31, '#E3B95A', 2],
        [28, '#3FB8A8', 2.4],
        [25, '#E3B95A', 1.6],
        [22, '#1F4E9A', 2.6],
        [19, '#E3B95A', 2],
      ].map(([r, color, w], i) => (
        <path
          key={i}
          d={`M${50 - (r as number)} 70 A${r} ${r} 0 0 0 ${50 + (r as number)} 70`}
          fill="none"
          stroke={color as string}
          strokeWidth={w as number}
        />
      ))}
      {Array.from({ length: 13 }, (_, i) => {
        const a = (Math.PI * (i + 0.5)) / 13;
        const x = 50 - Math.cos(a) * 36.2;
        const y = 70 + Math.sin(a) * 36.2;
        return (
          <path
            key={i}
            d={`M${x} ${y - 1.6} L${x + 1.2} ${y} L${x} ${y + 1.6} L${x - 1.2} ${y} Z`}
            fill={i % 2 ? '#3FB8A8' : '#B8323A'}
            stroke="#FFE08A"
            strokeWidth="0.4"
          />
        );
      })}
      {/* Nemes: or et lapis, raye, avec ses retombees. */}
      <path d={NEMES} fill="url(#lav-sph-gold)" />
      <g clipPath="url(#lav-sph-nemes)">
        {Array.from({ length: 21 }, (_, i) => {
          const y = 13 + i * 3.6;
          return (
            <path
              key={i}
              d={`M10 ${y} Q50 ${y - 4} 90 ${y}`}
              fill="none"
              stroke="#1F4E9A"
              strokeWidth="1.7"
            />
          );
        })}
        <path
          d="M23 31 C25 16 37 9 50 9 C63 9 75 16 77 31"
          fill="none"
          stroke="#FFF6DA"
          strokeWidth="1"
          opacity="0.6"
        />
      </g>
      <path d={NEMES} fill="none" stroke="#5A3A0A" strokeWidth="0.6" />
      {/* Visage. */}
      <path
        d="M37 39 L63 39 C64 51 62 59 57 64 C54 67 46 67 43 64 C38 59 36 51 37 39 Z"
        fill="url(#lav-sph-skin)"
      />
      <rect
        x="35.4"
        y="36.6"
        width="29.2"
        height="4"
        fill="url(#lav-sph-gold)"
      />
      <rect x="35.4" y="38" width="29.2" height="1.1" fill="#1F4E9A" />
      <path
        d="M40.6 44.6 Q44 42.4 47.4 44.2 M52.6 44.2 Q56 42.4 59.4 44.6"
        fill="none"
        stroke="#1A1230"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M40.4 48 Q44 45.4 47.4 48 Q44 50 40.4 48 Z M52.6 48 Q56 45.4 59.6 48 Q56 50 52.6 48 Z"
        fill="#FFF6E6"
      />
      <circle cx="44" cy="47.8" r="1.5" fill="#2EC4B6" />
      <circle cx="56" cy="47.8" r="1.5" fill="#2EC4B6" />
      <circle cx="44" cy="47.8" r="0.7" fill="#0A1A1A" />
      <circle cx="56" cy="47.8" r="0.7" fill="#0A1A1A" />
      <path
        d="M40.4 48 Q44 45.4 47.4 48 Q44 50 40.4 48 Z M52.6 48 Q56 45.4 59.6 48 Q56 50 52.6 48 Z M40.4 48 L37.4 49.6 M59.6 48 L62.6 49.6"
        fill="none"
        stroke="#0F0A1E"
        strokeWidth="0.9"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M50 48 L48.6 55.4 Q50 56.4 51.4 55.4"
        fill="none"
        stroke="#7A4A22"
        strokeWidth="0.7"
      />
      <path
        d="M55 41 C57 50 57 58 54 64 C58 60 61 52 60 41 Z"
        fill="#6B3E1A"
        opacity="0.35"
      />
      <path d="M46.4 59 Q50 57.8 53.6 59 Q50 61.6 46.4 59 Z" fill="#8A3A2A" />
      {/* Barbe postiche tressee. */}
      <path
        d="M47.4 65 H52.6 L52 78 Q50 80 48 78 Z"
        fill="url(#lav-sph-goldv)"
      />
      {[67.6, 70.6, 73.6, 76.4].map((y) => (
        <path
          key={y}
          d={`M47.6 ${y} H52.4`}
          stroke="#1F4E9A"
          strokeWidth="1.2"
        />
      ))}
      {/* Cobra royal (uraeus) au front. */}
      <path
        d="M50 37 C47.6 35 47.6 32 49 30.4 C47 29.6 46.4 26.6 48.4 25 C49.4 24.2 50.6 24.2 51.6 25 C53.6 26.6 53 29.6 51 30.4 C52.4 32 52.4 35 50 37 Z"
        fill="url(#lav-sph-goldv)"
        stroke="#5A3A0A"
        strokeWidth="0.4"
      />
      <path d="M50 27 C49 28 49 30 50 31 C51 30 51 28 50 27 Z" fill="#1F4E9A" />
      <circle cx="50" cy="26.4" r="0.7" fill="#C42A3D" />
    </>
  );
}

function SphinxFx() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle
          key={i}
          className="av-fall"
          style={anim(i)}
          cx={[12, 28, 40, 64, 78, 90][i]}
          cy="6"
          r="0.8"
          fill="#FFF1BF"
        />
      ))}
      <Twinkles
        points={[
          [44, 47.6, 2.2],
          [56, 47.6, 2.2],
          [50, 25.6, 2.4],
          [74, 72, 1.6],
        ]}
        fill="#BFFFF6"
      />
    </>
  );
}

/** Couches d'un avatar: decor, personnage, effets (et leurs degrades). */
export type AvatarLayer = 'scene' | 'figure' | 'fx';

const LAYERS: Record<
  string,
  { defs: () => ReactNode } & Record<AvatarLayer, () => ReactNode>
> = {
  ombre: {
    defs: OmbreDefs,
    scene: OmbreScene,
    figure: OmbreFigure,
    fx: OmbreFx,
  },
  phenix: {
    defs: PhenixDefs,
    scene: PhenixScene,
    figure: PhenixFigure,
    fx: PhenixFx,
  },
  oracle: {
    defs: OracleDefs,
    scene: OracleScene,
    figure: OracleFigure,
    fx: OracleFx,
  },
  sphinx: {
    defs: SphinxDefs,
    scene: SphinxScene,
    figure: SphinxFigure,
    fx: SphinxFx,
  },
};

/**
 * Une couche d'un avatar de la Boutique Legendaire. Les degrades sont
 * redeclares avec chaque couche: une couche peut etre posee seule, sur le
 * decor d'un autre avatar (Atelier).
 */
export function LegendAvatarLayer({
  id,
  layer,
}: {
  id: string;
  layer: AvatarLayer;
}) {
  const art = LAYERS[id];
  if (!art) return null;
  return (
    <>
      {art.defs()}
      {art[layer]()}
    </>
  );
}

/** Portrait complet d'un avatar de la Boutique Legendaire. */
export function LegendAvatarArt({ id }: { id: string }) {
  return (
    <>
      <LegendAvatarLayer id={id} layer="scene" />
      <LegendAvatarLayer id={id} layer="figure" />
      <LegendAvatarLayer id={id} layer="fx" />
    </>
  );
}
