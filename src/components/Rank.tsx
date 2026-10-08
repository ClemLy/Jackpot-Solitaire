import { useId, type CSSProperties } from 'react';
import { VIP_TIERS, type VipTierId } from '../state/catalog';

/**
 * Teintes de chaque rang: clair, moyen, sombre. L'emblème et l'étiquette en
 * tirent leurs dégradés.
 */
const METAL: Record<VipTierId, [string, string, string]> = {
  bronze: ['#F2B587', '#C97A45', '#7A3F1D'],
  silver: ['#FFFFFF', '#C3CCD6', '#6E7885'],
  gold: ['#FFF1BF', '#E3B95A', '#8F6418'],
  platinum: ['#F4FEFF', '#A9DDE3', '#4F8590'],
  diamond: ['#FFFFFF', '#B4CDFF', '#5468C9'],
};

const CROWN = 'M14 31 L12 19 L19 24 L24 15 L29 24 L36 19 L34 31 Z';
const BAND = 'M14 31.5 H34 V35 H14 Z';

const R_LAUREL = 14.2;

function polar(angle: number, radius: number) {
  const r = (angle * Math.PI) / 180;
  return [24 + radius * Math.cos(r), 24 + radius * Math.sin(r)] as const;
}

/**
 * Couronne de lauriers: deux tiges qui remontent de part et d'autre depuis
 * le bas de l'insigne, avec des feuilles en épi.
 */
function Laurel({ color }: { color: string }) {
  const leaves: { x: number; y: number; rot: number }[] = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < 5; i++) {
      // Cote gauche: de 100 a 190 degres; cote droit en miroir.
      const a = side === 1 ? 104 + i * 21 : 76 - i * 21;
      const tangent = a + 90 * side;
      for (const out of [-1, 1]) {
        const [x, y] = polar(a, R_LAUREL + out * 1.7);
        leaves.push({ x, y, rot: tangent + out * side * 38 });
      }
    }
  }
  const [lx0, ly0] = polar(98, R_LAUREL);
  const [lx1, ly1] = polar(196, R_LAUREL);
  const [rx0, ry0] = polar(82, R_LAUREL);
  const [rx1, ry1] = polar(-16, R_LAUREL);
  return (
    <g>
      <path
        d={`M${lx0} ${ly0} A${R_LAUREL} ${R_LAUREL} 0 0 1 ${lx1} ${ly1} M${rx0} ${ry0} A${R_LAUREL} ${R_LAUREL} 0 0 0 ${rx1} ${ry1}`}
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={l.x}
          cy={l.y}
          rx="0.95"
          ry="2.2"
          fill={color}
          transform={`rotate(${l.rot} ${l.x} ${l.y})`}
        />
      ))}
    </g>
  );
}

/** Points autour d'un cercle: [x, y, angle en degrés]. */
function ring(count: number, radius: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = (360 / count) * i + offset;
    const r = ((a - 90) * Math.PI) / 180;
    return [24 + radius * Math.cos(r), 24 + radius * Math.sin(r), a] as const;
  });
}

/** Étoile à quatre branches (étincelle). */
function sparkle(x: number, y: number, s: number) {
  const k = s * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}

function Crown({
  fill,
  stroke,
  gems,
}: {
  fill: string;
  stroke?: string;
  gems?: { tips: string; center: string };
}) {
  return (
    <g>
      <path d={CROWN} fill={fill} stroke={stroke} strokeWidth="0.9" />
      <path d={BAND} fill={fill} stroke={stroke} strokeWidth="0.9" />
      {gems && (
        <>
          {[
            [12, 19],
            [24, 15],
            [36, 19],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="1.9" fill={gems.tips} />
          ))}
          <path d="M24 30.2 L26 33.2 L24 36.2 L22 33.2 Z" fill={gems.center} />
        </>
      )}
    </g>
  );
}

/**
 * Emblème d'un rang VIP. Plus le rang est haut, plus il est travaillé:
 * médaille plate en bronze, métal poli en argent, perles et joyaux en or,
 * insigne étoilé et lauriers en platine, cristal prismatique en diamant.
 * `compact` retire les ornements trop fins pour les petites tailles.
 */
export function RankEmblem({
  tier,
  size = 24,
  compact = false,
  className,
}: {
  tier: VipTierId;
  size?: number | string;
  compact?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [light, mid, dark] = METAL[tier];
  const metal = `rk-metal-${uid}`;
  const shine = `rk-shine-${uid}`;
  const clip = `rk-clip-${uid}`;

  const defs = (
    <defs>
      <linearGradient id={metal} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor={light} />
        <stop offset="0.5" stopColor={mid} />
        <stop offset="1" stopColor={dark} />
      </linearGradient>
      <linearGradient id={shine} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={clip}>
        <circle cx="24" cy="24" r="22" />
      </clipPath>
    </defs>
  );

  // Reflet qui traverse la médaille (or et platine).
  const sweep = !compact && (
    <g clipPath={`url(#${clip})`}>
      <g transform="rotate(25 24 24)">
        <rect
          className="rank-emblem__shine"
          x="-10"
          y="-10"
          width="12"
          height="68"
          fill={`url(#${shine})`}
        />
      </g>
    </g>
  );

  let body;
  switch (tier) {
    case 'bronze':
      body = (
        <>
          <circle cx="24" cy="24" r="21" fill={mid} />
          <circle
            cx="24"
            cy="24"
            r="21"
            fill="none"
            stroke={dark}
            strokeWidth="2"
          />
          <g opacity="0.75">
            <Crown fill={dark} />
          </g>
        </>
      );
      break;
    case 'silver':
      body = (
        <>
          <circle cx="24" cy="24" r="22" fill={`url(#${metal})`} />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke={dark}
            strokeWidth="1.4"
          />
          <circle
            cx="24"
            cy="24"
            r="18.5"
            fill="none"
            stroke={light}
            strokeOpacity="0.8"
            strokeWidth="1"
          />
          <Crown fill={light} stroke={dark} />
          <ellipse
            cx="17"
            cy="12"
            rx="7"
            ry="3.2"
            fill="#fff"
            opacity="0.35"
            transform="rotate(-30 17 12)"
          />
        </>
      );
      break;
    case 'gold':
      body = (
        <>
          <circle cx="24" cy="24" r="22.5" fill={dark} />
          <circle cx="24" cy="24" r="21" fill={`url(#${metal})`} />
          {!compact &&
            ring(24, 19.6).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.05" fill={light} />
            ))}
          <circle
            cx="24"
            cy="24"
            r="17"
            fill={dark}
            opacity="0.35"
            stroke={light}
            strokeOpacity="0.6"
            strokeWidth="0.8"
          />
          <Crown
            fill={`url(#${metal})`}
            stroke={light}
            gems={{ tips: '#E2384D', center: '#E2384D' }}
          />
          {sweep}
        </>
      );
      break;
    case 'platinum': {
      // Insigne à seize pointes, lauriers et gemmes bleues.
      const star = Array.from({ length: 32 }, (_, i) => i)
        .map((i) => {
          const a = ((360 / 32) * i - 90) * (Math.PI / 180);
          const r = i % 2 ? 19.5 : 23;
          return `${24 + r * Math.cos(a)},${24 + r * Math.sin(a)}`;
        })
        .join(' ');
      body = (
        <>
          <polygon
            points={star}
            fill={`url(#${metal})`}
            stroke={dark}
            strokeWidth="0.8"
          />
          <circle
            cx="24"
            cy="24"
            r="17.5"
            fill="#123a42"
            stroke={light}
            strokeWidth="1"
          />
          {!compact && <Laurel color={mid} />}
          <g transform="translate(24 24) scale(0.7) translate(-24 -22)">
            <Crown
              fill={`url(#${metal})`}
              stroke={light}
              gems={{ tips: '#5FB9FF', center: '#FFFFFF' }}
            />
          </g>
          {sweep}
        </>
      );
      break;
    }
    case 'diamond': {
      // Cristal à facettes sous une petite couronne, rayons et étincelles.
      const prism = `rk-prism-${uid}`;
      body = (
        <>
          <defs>
            <linearGradient id={prism} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9DFFD8" />
              <stop offset="0.35" stopColor="#8FD3FF" />
              <stop offset="0.65" stopColor="#C7A6FF" />
              <stop offset="1" stopColor="#FF9AD5" />
            </linearGradient>
          </defs>
          {!compact && (
            <g className="rank-emblem__rays">
              {ring(12, 0).map(([, , a]) => (
                <path
                  key={a}
                  d="M24 24 L22.6 1.5 L25.4 1.5 Z"
                  fill={`url(#${prism})`}
                  opacity="0.55"
                  transform={`rotate(${a} 24 24)`}
                />
              ))}
            </g>
          )}
          <path
            d="M10 20 L17 11 H31 L38 20 L24 41 Z"
            fill={`url(#${prism})`}
            stroke="#fff"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M10 20 H38"
            stroke="#fff"
            strokeOpacity="0.85"
            strokeWidth="0.8"
          />
          <path
            d="M17 11 L20.5 20 L24 11 L27.5 20 L31 11 M20.5 20 L24 41 L27.5 20"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="0.7"
          />
          <path d="M17 11 L10 20 L20.5 20 Z" fill="#fff" opacity="0.35" />
          <path d="M27.5 20 L38 20 L24 41 Z" fill={dark} opacity="0.3" />
          <g transform="translate(24 6.5) scale(0.42) translate(-24 -25)">
            <Crown
              fill="#FFF1BF"
              stroke="#8F6418"
              gems={{ tips: '#FF9AD5', center: '#8FD3FF' }}
            />
          </g>
          {(compact
            ? [[39, 32, 3.4]]
            : [
                [40, 33, 3.6],
                [8, 31, 2.6],
                [37, 9, 2.4],
              ]
          ).map(([x, y, s], i) => (
            <path
              key={i}
              className="rank-emblem__sparkle"
              style={{ '--i': i } as CSSProperties}
              d={sparkle(x, y, s)}
              fill="#fff"
            />
          ))}
        </>
      );
      break;
    }
  }

  return (
    <svg
      className={`rank-emblem${className ? ` ${className}` : ''}`}
      data-tier={tier}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {defs}
      {body}
    </svg>
  );
}

/** Rang avec son emblème et son nom, stylé selon le rang. */
export function RankBadge({
  tier,
  emblem = true,
  size = 16,
  className,
}: {
  tier: VipTierId;
  emblem?: boolean;
  size?: number;
  className?: string;
}) {
  const label = VIP_TIERS.find((t) => t.id === tier)?.label ?? tier;
  return (
    <span
      className={`rank${className ? ` ${className}` : ''}`}
      data-tier={tier}
    >
      {emblem && <RankEmblem tier={tier} size={size} compact={size < 28} />}
      <span className="rank__label">{label}</span>
    </span>
  );
}
