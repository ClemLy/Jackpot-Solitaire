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

/** Points repartis sur un cercle (0 degre a droite). */
function around(n: number, r: number, offset = 0): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i / n) * 360 + offset) * (Math.PI / 180);
    return [60 + Math.cos(a) * r, 60 + Math.sin(a) * r, (i / n) * 360 + offset];
  });
}

/** Point du cercle, 0 degre en haut, sens horaire. */
function polar(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [60 + Math.cos(a) * r, 60 + Math.sin(a) * r];
}

/** Etoile a quatre branches. */
function sparkle(x: number, y: number, s: number) {
  const k = s * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}

/** Anneau plein entre deux rayons (pour les decoupes et les reflets). */
function annulus(inner: number, outer: number) {
  return `M60 ${60 - outer} a${outer} ${outer} 0 1 0 0.01 0 Z M60 ${60 - inner} a${inner} ${inner} 0 1 0 0.01 0 Z`;
}

/** Reflet qui traverse l'anneau, de temps en temps. */
function Shine({
  id,
  inner,
  outer,
}: {
  id: string;
  inner: number;
  outer: number;
}) {
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={annulus(inner, outer)} clipRule="evenodd" />
        </clipPath>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <g transform="rotate(25 60 60)">
          <rect
            className="frame-shine"
            x="-30"
            y="-30"
            width="22"
            height="180"
            fill={`url(#${id}-grad)`}
          />
        </g>
      </g>
    </>
  );
}

/** Pierre taillee: losange facette avec un eclat. */
function Gem({
  x,
  y,
  r,
  color,
  edge = '#FFF1BF',
}: {
  x: number;
  y: number;
  r: number;
  color: string;
  edge?: string;
}) {
  return (
    <g>
      <path
        d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`}
        fill={color}
        stroke={edge}
        strokeWidth={r * 0.28}
        strokeLinejoin="round"
      />
      <path
        d={`M${x} ${y - r} L${x + r * 0.45} ${y} L${x} ${y + r * 0.2} L${x - r * 0.45} ${y} Z`}
        fill="#fff"
        opacity="0.45"
      />
    </g>
  );
}

/** Feuilles de laurier le long d'un arc (degres, 0 en haut). */
function LaurelArc({
  from,
  to,
  r,
  count,
  fill,
  alt,
  stroke,
  size = 1,
}: {
  from: number;
  to: number;
  r: number;
  count: number;
  fill: string;
  alt: string;
  stroke: string;
  size?: number;
}) {
  const dir = Math.sign(to - from);
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const deg = from + ((to - from) * i) / (count - 1);
    for (const out of [-1, 1]) {
      const [x, y] = polar(deg, r + out * 2.8 * size);
      // Feuille le long de la tige, ecartee de part et d'autre en epi.
      const rot = deg + 90 - out * dir * 32;
      leaves.push(
        <ellipse
          key={`${i}-${out}`}
          cx={x}
          cy={y}
          rx={2.1 * size}
          ry={5 * size}
          fill={out > 0 ? fill : alt}
          stroke={stroke}
          strokeWidth="0.5"
          transform={`rotate(${rot} ${x} ${y})`}
        />,
      );
    }
  }
  const [x0, y0] = polar(from, r);
  const [x1, y1] = polar(to, r);
  return (
    <g>
      <path
        d={`M${x0} ${y0} A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${x1} ${y1}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        strokeLinecap="round"
      />
      {leaves}
    </g>
  );
}

/** Rayons tournants derriere le cadre. */
function Rays({
  count,
  inner,
  outer,
  fill,
  width = 2.2,
  opacity = 0.5,
}: {
  count: number;
  inner: number;
  outer: number;
  fill: string;
  width?: number;
  opacity?: number;
}) {
  return (
    <g className="frame-rays" opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i;
        const [ax, ay] = polar(deg - width, inner);
        const [bx, by] = polar(deg + width, inner);
        const [cx, cy] = polar(deg, outer);
        return (
          <path
            key={i}
            d={`M${ax} ${ay} L${cx} ${cy} L${bx} ${by} Z`}
            fill={fill}
          />
        );
      })}
    </g>
  );
}

const SILVER = ['#FFFFFF', '#AEB4BC', '#E8ECF0', '#7D848D'];
const GOLD_STOPS = ['#FFF1BF', '#E3B95A', '#F3D27C', '#8F6418'];
const PLATINUM = ['#F4FEFF', '#A9DDE3', '#E6F8FA', '#5F97A1'];
const PRISM = ['#9DFFD8', '#8FD3FF', '#C7A6FF', '#FF9AD5'];

/**
 * Cadres. Le niveau de detail suit le rang ou le prix: un simple filet pour
 * le cadre de base, jusqu'aux pieces maitresses chargees d'ornements animes.
 */
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

  // Argent: metal poli, double filet et graduations gravees.
  'cadre-rang-silver': () => (
    <>
      <Ring id="frame-silver" stops={SILVER} width={5} />
      <circle
        cx="60"
        cy="60"
        r="55.4"
        fill="none"
        stroke="#5E666F"
        strokeWidth="1"
      />
      <circle
        cx="60"
        cy="60"
        r="50.3"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="0.8"
      />
      {Array.from({ length: 36 }, (_, i) => {
        const [x1, y1] = polar(i * 10, 51.4);
        const [x2, y2] = polar(i * 10, 53.8);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#7D848D"
            strokeWidth="0.7"
          />
        );
      })}
    </>
  ),

  // Or: anneau perle, fleuron, rubis et reflet.
  'cadre-rang-gold': () => (
    <>
      <Ring id="frame-gold" stops={GOLD_STOPS} width={8} />
      <circle
        cx="60"
        cy="60"
        r="58.3"
        fill="none"
        stroke="#7A5517"
        strokeWidth="1.1"
      />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="#7A5517"
        strokeWidth="1"
      />
      {around(40, 54).map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="1.1"
          fill="#FFF6DA"
          stroke="#A4761F"
          strokeWidth="0.3"
        />
      ))}
      {[45, 135, 225, 315].map((deg) => {
        const [x, y] = polar(deg, 54);
        return <Gem key={deg} x={x} y={y} r={3.2} color="#C42A3D" />;
      })}
      <g>
        <path
          d="M60 -7 C64 -2 64 2 60 6 C56 2 56 -2 60 -7 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="0.9"
        />
        <path
          d="M59 5 C54 -1 47 1 48 6 C51 3 55 4 59 7 Z M61 5 C66 -1 73 1 72 6 C69 3 65 4 61 7 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="0.8"
        />
        <circle cx="60" cy="1" r="1.5" fill="#C42A3D" />
      </g>
      <Shine id="frame-gold-shine" inner={50} outer={58.5} />
    </>
  ),

  // Platine: bord dentele, gemmes bleues, lauriers et cimier couronne.
  'cadre-rang-platinum': () => {
    // Bord dentele evide au centre: l'avatar reste visible.
    const teeth = `M${Array.from({ length: 64 }, (_, i) =>
      polar(i * 5.625, i % 2 ? 57.4 : 60.6).join(' '),
    ).join(' L')} Z M60 10 a50 50 0 1 0 0.01 0 Z`;
    return (
      <>
        <defs>
          <linearGradient id="frame-platinum-edge" x1="0" y1="0" x2="1" y2="1">
            {PLATINUM.map((c, i) => (
              <stop key={i} offset={i / (PLATINUM.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <LaurelArc
          from={198}
          to={262}
          r={63.5}
          count={6}
          fill="#C9EEF1"
          alt="#8CC3CA"
          stroke="#4F8590"
          size={0.8}
        />
        <LaurelArc
          from={162}
          to={98}
          r={63.5}
          count={6}
          fill="#C9EEF1"
          alt="#8CC3CA"
          stroke="#4F8590"
          size={0.8}
        />
        <path
          d={teeth}
          fillRule="evenodd"
          fill="url(#frame-platinum-edge)"
          stroke="#4F8590"
          strokeWidth="0.6"
        />
        <Ring id="frame-platinum" stops={PLATINUM} width={7} />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="#123A42"
          strokeWidth="1.6"
        />
        <circle
          cx="60"
          cy="60"
          r="56.8"
          fill="none"
          stroke="#F4FEFF"
          strokeOpacity="0.8"
          strokeWidth="0.6"
        />
        {Array.from({ length: 8 }, (_, i) => {
          const [x, y] = polar(i * 45 + 22.5, 53.5);
          return (
            <Gem key={i} x={x} y={y} r={2.7} color="#4FA8F0" edge="#F4FEFF" />
          );
        })}
        <g>
          <path
            d="M48 5 L45 -5 L52 -1 L60 -11 L68 -1 L75 -5 L72 5 Z"
            fill="url(#frame-platinum-edge)"
            stroke="#4F8590"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <rect x="48" y="3" width="24" height="4" rx="1" fill="#5F97A1" />
          <circle cx="60" cy="-11" r="1.6" fill="#F4FEFF" />
          <circle cx="45" cy="-5" r="1.3" fill="#F4FEFF" />
          <circle cx="75" cy="-5" r="1.3" fill="#F4FEFF" />
          <Gem x={60} y={2} r={2.4} color="#4FA8F0" edge="#F4FEFF" />
        </g>
        <Shine id="frame-platinum-shine" inner={50} outer={60.5} />
      </>
    );
  },

  // Diamant: anneau de cristal a facettes, gros diamant, rayons, etincelles.
  'cadre-rang-diamond': () => (
    <g className="frame-glow-diamond">
      <defs>
        <linearGradient id="frame-prism" x1="0" y1="0" x2="1" y2="1">
          {PRISM.map((c, i) => (
            <stop key={i} offset={i / (PRISM.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <Rays
        count={18}
        inner={57}
        outer={68}
        fill="url(#frame-prism)"
        opacity={0.55}
      />
      {Array.from({ length: 24 }, (_, i) => {
        const a = i * 15;
        const p = [
          polar(a, 50),
          polar(a + 15, 50),
          polar(a + 15, 58.5),
          polar(a, 58.5),
        ];
        const [hx, hy] = polar(a + 7.5, 50.5);
        return (
          <g key={i}>
            <path
              d={`M${p.map((q) => q.join(' ')).join(' L')} Z`}
              fill={PRISM[i % 4]}
              stroke="#FFFFFF"
              strokeWidth="0.5"
            />
            <path
              d={`M${p[3].join(' ')} L${hx} ${hy} L${p[2].join(' ')} Z`}
              fill="#FFFFFF"
              opacity="0.32"
            />
          </g>
        );
      })}
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      <circle
        cx="60"
        cy="60"
        r="58.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1"
      />
      <g>
        <path
          d="M48 -1 L53 -8 H67 L72 -1 L60 13 Z"
          fill="url(#frame-prism)"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path
          d="M48 -1 H72 M53 -8 L57 -1 L60 -8 L63 -1 L67 -8 M57 -1 L60 13 L63 -1"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.75"
          strokeWidth="0.6"
        />
        <path d="M53 -8 L48 -1 L57 -1 Z" fill="#FFFFFF" opacity="0.45" />
      </g>
      {Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(i * 45 + 22.5, 63);
        return (
          <path
            key={i}
            className="frame-sparkle"
            style={{ '--i': i } as CSSProperties}
            d={sparkle(x, y, 3.4)}
            fill="#FFFFFF"
          />
        );
      })}
    </g>
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
      <circle
        cx="60"
        cy="60"
        r="49.8"
        fill="none"
        stroke="#C42A3D"
        strokeWidth="1"
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
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke={GOLD}
        strokeWidth="0.9"
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

  // Neon: deux tubes et une couronne d'ampoules qui clignotent.
  'cadre-neon': () => (
    <>
      <g className="frame-neon">
        <circle
          cx="60"
          cy="60"
          r="52.5"
          fill="none"
          stroke="#FF5FA8"
          strokeWidth="7"
          opacity="0.35"
        />
        <circle
          cx="60"
          cy="60"
          r="52.5"
          fill="none"
          stroke="#FFD1E8"
          strokeWidth="2.6"
        />
        <circle
          cx="60"
          cy="60"
          r="57.5"
          fill="none"
          stroke="#5FF3FF"
          strokeWidth="5"
          opacity="0.3"
        />
        <circle
          cx="60"
          cy="60"
          r="57.5"
          fill="none"
          stroke="#D8FDFF"
          strokeWidth="1.3"
        />
      </g>
      {Array.from({ length: 20 }, (_, i) => {
        const [x, y] = polar(i * 18, 61.5);
        return (
          <circle
            key={i}
            className="frame-bulb"
            style={{ '--i': i % 2 } as CSSProperties}
            cx={x}
            cy={y}
            r="1.7"
            fill="#FFE7A0"
          />
        );
      })}
    </>
  ),

  // Lauriers: vraie couronne, baies et noeud de ruban.
  'cadre-laurel': () => (
    <>
      <Ring id="frame-laurel" stops={['#FFF1BF', '#C99532']} width={3} />
      <LaurelArc
        from={190}
        to={335}
        r={56.5}
        count={10}
        fill="#F3D27C"
        alt={GOLD}
        stroke={GOLD_DEEP}
      />
      <LaurelArc
        from={170}
        to={25}
        r={56.5}
        count={10}
        fill="#F3D27C"
        alt={GOLD}
        stroke={GOLD_DEEP}
      />
      {[215, 255, 295, 145, 105, 65].map((deg) => {
        const [x, y] = polar(deg, 61);
        return (
          <circle
            key={deg}
            cx={x}
            cy={y}
            r="1.5"
            fill="#C42A3D"
            stroke="#7A1020"
            strokeWidth="0.4"
          />
        );
      })}
      <g>
        <path
          d="M60 113 C51 104 44 110 51 117 Z M60 113 C69 104 76 110 69 117 Z"
          fill="#C42A3D"
          stroke="#7A1020"
          strokeWidth="0.8"
        />
        <path
          d="M58 115 L51 125 L55 123.5 L57 127 Z M62 115 L69 125 L65 123.5 L63 127 Z"
          fill="#A81F31"
        />
        <circle
          cx="60"
          cy="114"
          r="2.8"
          fill="#8E1A2B"
          stroke="#7A1020"
          strokeWidth="0.6"
        />
      </g>
    </>
  ),

  // Flammes: trois couches qui dansent et des braises qui montent.
  'cadre-flames': () => {
    const flame = (
      n: number,
      r: number,
      height: number,
      width: number,
      fill: string,
      offset: number,
      layer: number,
    ) =>
      around(n, r, offset).map(([x, y, a], i) => {
        // Hauteurs et largeurs irregulieres: un feu, pas une scie.
        const k = [1, 0.7, 1.15, 0.8, 0.95, 0.65][(i + layer) % 6];
        const h = height * k;
        const w = width * (0.8 + k * 0.3);
        return (
          <g key={`${layer}-${i}`} transform={`rotate(${a + 90} ${x} ${y})`}>
            <path
              d={`M${x - w} ${y} C${x - w} ${y - h * 0.45} ${x - w * 0.2} ${y - h * 0.55} ${x + w * 0.15} ${y - h} C${x + w * 0.3} ${y - h * 0.6} ${x + w} ${y - h * 0.4} ${x + w} ${y} Z`}
              fill={fill}
              style={{ '--i': i + layer } as CSSProperties}
              className="frame-flame"
            />
          </g>
        );
      });
    return (
      <g className="frame-flames">
        {flame(14, 52, 19, 5.5, '#C42A3D', 0, 0)}
        {flame(14, 52, 14, 4.2, '#FF8A2A', 13, 1)}
        {flame(14, 52, 9, 2.8, '#FFD25A', 6, 2)}
        <circle
          cx="60"
          cy="60"
          r="51.5"
          fill="none"
          stroke="#2A0A05"
          strokeWidth="4.5"
        />
        <circle
          cx="60"
          cy="60"
          r="51.5"
          fill="none"
          stroke="#FF6A2A"
          strokeWidth="1.2"
          opacity="0.85"
        />
        {[300, 330, 0, 30, 60, 280, 80].map((deg, i) => {
          const [x, y] = polar(deg, 62);
          return (
            <circle
              key={deg}
              className="frame-ember"
              style={{ '--i': i } as CSSProperties}
              cx={x}
              cy={y}
              r="1.2"
              fill="#FFD25A"
            />
          );
        })}
      </g>
    );
  },

  // Couronne royale: anneau de velours clout d'or, hermine, couronne ornee.
  'cadre-crown': () => (
    <>
      <Ring id="frame-crown" stops={['#D8344A', '#8E1A2B']} width={7} />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke={GOLD}
        strokeWidth="1.2"
      />
      <circle
        cx="60"
        cy="60"
        r="57"
        fill="none"
        stroke={GOLD}
        strokeWidth="1.2"
      />
      {around(24, 53.5).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill="#FFE7A0" />
      ))}
      <path
        d={`M${polar(140, 53.5).join(' ')} A53.5 53.5 0 0 1 ${polar(220, 53.5).join(' ')}`}
        fill="none"
        stroke="#FBF6EA"
        strokeWidth="9"
      />
      {[150, 165, 180, 195, 210].map((deg) => {
        const [x, y] = polar(deg, 53.5);
        return (
          <path
            key={deg}
            d={`M${x} ${y - 2.2} L${x + 1.3} ${y + 1.6} L${x - 1.3} ${y + 1.6} Z`}
            fill="#17191F"
          />
        );
      })}
      <g>
        <path
          d="M37 12 L34 -3 L43 4 L48.5 -7 L54.5 3 L60 -12 L65.5 3 L71.5 -7 L77 4 L86 -3 L83 12 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <rect x="37" y="8" width="46" height="6" rx="1.5" fill={GOLD_DEEP} />
        {[
          [34, -3],
          [48.5, -7],
          [71.5, -7],
          [86, -3],
        ].map(([x, y]) => (
          <circle
            key={x}
            cx={x}
            cy={y}
            r="1.9"
            fill="#FBF6EA"
            stroke="#C9BFA8"
            strokeWidth="0.4"
          />
        ))}
        <circle
          cx="60"
          cy="-12"
          r="2.4"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="0.8"
        />
        <path
          d="M60 -17 V-14 M58.5 -15.6 H61.5"
          stroke={GOLD_DEEP}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <Gem x={60} y={11} r={3} color="#C42A3D" />
        <Gem x={48} y={11} r={2.2} color="#2F6BD6" />
        <Gem x={72} y={11} r={2.2} color="#2F6BD6" />
        <path
          className="frame-sparkle"
          style={{ '--i': 0 } as CSSProperties}
          d={sparkle(64, 6, 3)}
          fill="#FFFFFF"
        />
      </g>
    </>
  ),

  // Ecrin imperial: la piece maitresse, chargee de tout.
  'cadre-royal': () => (
    <g className="frame-glow-royal">
      <Rays
        count={24}
        inner={58}
        outer={70}
        fill="#F3D27C"
        width={1.6}
        opacity={0.45}
      />
      <Ring
        id="frame-royal-a"
        stops={['#FFF6DA', '#E3B95A', '#8F6418', '#F3D27C', '#7A5517']}
        width={9}
      />
      <circle
        cx="60"
        cy="60"
        r="59.4"
        fill="none"
        stroke="#7A5517"
        strokeWidth="1.2"
      />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="#FFF1BF"
        strokeWidth="0.8"
      />
      <circle
        cx="60"
        cy="60"
        r="51.6"
        fill="none"
        stroke="#7A5517"
        strokeWidth="0.7"
        strokeDasharray="1.6 1.2"
      />
      {Array.from({ length: 8 }, (_, i) => {
        const deg = i * 45 + 22.5;
        const [x, y] = polar(deg, 55);
        return (
          <g key={i} transform={`rotate(${deg} ${x} ${y})`}>
            <path
              d={`M${x - 5} ${y} C${x - 5} ${y - 3} ${x - 1.5} ${y - 3} ${x} ${y} C${x + 1.5} ${y + 3} ${x + 5} ${y + 3} ${x + 5} ${y}`}
              fill="none"
              stroke="#7A5517"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(i * 45, 54.5);
        return i === 0 ? null : (
          <Gem
            key={i}
            x={x}
            y={y}
            r={3.3}
            color={i % 2 ? '#C42A3D' : '#2F6BD6'}
          />
        );
      })}
      <path
        d="M27 106 L93 106 L88 112 L93 118 L27 118 L32 112 Z"
        fill="#8E1A2B"
        stroke={GOLD}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M33 108.6 H87 M33 115.4 H87"
        stroke={GOLD}
        strokeWidth="0.6"
        opacity="0.8"
      />
      <Gem x={60} y={112} r={3.4} color="#2F6BD6" />
      <g>
        <path
          d="M36 12 L33 -4 L42.5 3.5 L48 -8 L54.5 2.5 L60 -14 L65.5 2.5 L72 -8 L77.5 3.5 L87 -4 L84 12 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <rect x="36" y="8" width="48" height="6" rx="1.5" fill={GOLD_DEEP} />
        {[
          [33, -4],
          [48, -8],
          [72, -8],
          [87, -4],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="2" fill="#FBF6EA" />
        ))}
        <circle
          cx="60"
          cy="-14"
          r="2.6"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="0.8"
        />
        <Gem x={60} y={11} r={3.2} color="#C42A3D" />
        <Gem x={46} y={11} r={2.3} color="#1FA36F" />
        <Gem x={74} y={11} r={2.3} color="#1FA36F" />
        <Gem x={60} y={-1} r={2.6} color="#2F6BD6" />
      </g>
      {Array.from({ length: 10 }, (_, i) => {
        const [x, y] = polar(i * 36 + 18, 65);
        return (
          <path
            key={i}
            className="frame-sparkle"
            style={{ '--i': i } as CSSProperties}
            d={sparkle(x, y, 3.6)}
            fill="#FFFFFF"
          />
        );
      })}
      <Shine id="frame-royal-shine" inner={50} outer={59.5} />
    </g>
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
