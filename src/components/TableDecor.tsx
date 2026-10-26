// Decors des tapis de la Boutique Legendaire: une scene dessinee sous le
// plateau, en plus de la texture du tapis. Les details se concentrent sur
// les bords (le centre est couvert par les cartes), et seules l'opacite et
// la position s'animent, pour rester fluide.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/** Cadre de reference des dessins (ecran 16:10). */
const W = 1600;
const H = 1000;

/**
 * Taille reelle du decor, en unites de dessin: elle suit la forme de
 * l'ecran (plus haut que large sur telephone). Les elements s'ancrent a
 * gauche, au centre ou a droite, en haut, au milieu ou en bas.
 */
interface Box {
  w: number;
  h: number;
}
type AnchorX = 'l' | 'c' | 'r';
type AnchorY = 't' | 'm' | 'b';

function shift(box: Box, ax: AnchorX, ay: AnchorY): string {
  const dx = ax === 'l' ? 0 : ax === 'c' ? (box.w - W) / 2 : box.w - W;
  const dy = ay === 't' ? 0 : ay === 'm' ? (box.h - H) / 2 : box.h - H;
  return `translate(${dx} ${dy})`;
}

/** Un point du dessin de reference, ancre selon sa position. */
function place(box: Box, x: number, y: number): [number, number] {
  const dx = x > W * 0.6 ? box.w - W : x > W * 0.4 ? (box.w - W) / 2 : 0;
  const dy = y > H * 0.6 ? box.h - H : y > H * 0.4 ? (box.h - H) / 2 : 0;
  return [x + dx, y + dy];
}

/** Les ornements des bords retrecissent sur un ecran etroit. */
const edgeScale = (box: Box) => Math.min(1, box.w / W);

const anim = (i: number) => ({ '--i': i }) as CSSProperties;

// ---------------------------------------------------------------------------
// Salon noir (niveau II): velours noir et or, medaillon soleil Art deco.
// ---------------------------------------------------------------------------

/** Coin Art deco a gradins, dessine en haut a gauche. */
function DecoCorner() {
  return (
    <g fill="none" stroke="#E3B95A" strokeWidth="2">
      <path d="M40 260 V80 L80 40 H260" />
      <path d="M58 260 V92 L92 58 H260" strokeOpacity="0.55" />
      <path d="M40 120 H70 V70 H120 V40" strokeOpacity="0.8" />
      <path
        d="M90 90 L150 150 M90 120 L130 150 M120 90 L150 130"
        strokeOpacity="0.6"
      />
      <circle cx="160" cy="160" r="7" fill="#E3B95A" fillOpacity="0.7" />
      <path d="M176 176 L210 210" strokeOpacity="0.5" />
    </g>
  );
}

function corners(node: ReactNode, box: Box) {
  const k = edgeScale(box);
  const at: Record<string, string> = {
    tl: `scale(${k})`,
    tr: `translate(${box.w} 0) scale(${-k} ${k})`,
    bl: `translate(0 ${box.h}) scale(${k} ${-k})`,
    br: `translate(${box.w} ${box.h}) scale(${-k} ${-k})`,
  };
  return Object.entries(at).map(([c, t]) => (
    <g key={c} transform={t}>
      {node}
    </g>
  ));
}

/** Eventail Art deco, pose sur le bord haut (y = 0). */
function DecoFan() {
  return (
    <g fill="none" stroke="#E3B95A" strokeWidth="1.6">
      {[60, 90, 120].map((r) => (
        <path key={r} d={`M${800 - r} 0 A${r} ${r} 0 0 0 ${800 + r} 0`} />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (Math.PI * (i + 1)) / 10;
        return (
          <path
            key={i}
            d={`M800 0 L${800 - Math.cos(a) * 120} ${Math.sin(a) * 120}`}
            strokeOpacity="0.7"
          />
        );
      })}
    </g>
  );
}

function SalonNoir({ box }: { box: Box }) {
  const rays = Array.from({ length: 48 }, (_, i) => i * 7.5);
  return (
    <>
      <defs>
        <radialGradient id="td-sn-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#B07CFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#B07CFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={shift(box, 'c', 'm')}>
        <ellipse cx="800" cy="520" rx="620" ry="420" fill="url(#td-sn-glow)" />
        <g opacity="0.16" stroke="#E3B95A" fill="none">
          {rays.map((a) => (
            <path
              key={a}
              d={`M800 520 L800 ${520 - (a % 15 === 0 ? 470 : 400)}`}
              strokeWidth={a % 15 === 0 ? 2.4 : 1.2}
              transform={`rotate(${a} 800 520)`}
            />
          ))}
          <circle cx="800" cy="520" r="120" strokeWidth="3" />
          <circle cx="800" cy="520" r="138" strokeWidth="1.2" />
          <circle cx="800" cy="520" r="250" strokeWidth="2" />
          <circle
            cx="800"
            cy="520"
            r="262"
            strokeWidth="1"
            strokeDasharray="4 10"
          />
          <circle cx="800" cy="520" r="380" strokeWidth="1.4" />
        </g>
      </g>
      <g opacity="0.55">{corners(<DecoCorner />, box)}</g>
      <g opacity="0.4" transform={shift(box, 'c', 't')}>
        <DecoFan />
      </g>
      <g
        opacity="0.4"
        transform={`translate(${(box.w - W) / 2} ${box.h}) scale(1 -1)`}
      >
        <DecoFan />
      </g>
      <rect
        x="40"
        y="40"
        width={box.w - 80}
        height={box.h - 80}
        rx="6"
        fill="none"
        stroke="#E3B95A"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <rect
        className="td-sheen"
        x="-400"
        y="-300"
        width="260"
        height={box.h + 700}
        fill="url(#td-sheen)"
        transform="rotate(20)"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Nebuleuse (niveau VIII): nuages de gaz, etoiles a eclat, galaxie lointaine.
// ---------------------------------------------------------------------------

const NEBULA_CLOUDS: [number, number, number, number, string][] = [
  [260, 260, 420, 240, 'a'],
  [1320, 760, 460, 260, 'b'],
  [1300, 200, 300, 200, 'c'],
  [300, 820, 360, 200, 'c'],
  [800, 520, 340, 260, 'a'],
];

const NEBULA_STARS: [number, number, number][] = [
  [140, 120, 1.2],
  [520, 70, 0.8],
  [1060, 110, 1],
  [1520, 420, 1.3],
  [90, 520, 0.9],
  [1480, 900, 1],
  [640, 940, 0.8],
  [220, 940, 1.1],
];

function Nebuleuse({ box }: { box: Box }) {
  return (
    <>
      <defs>
        <radialGradient id="td-nb-a" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#C9A0FF" stopOpacity="0.32" />
          <stop offset="1" stopColor="#C9A0FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="td-nb-b" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FF9AD5" stopOpacity="0.26" />
          <stop offset="1" stopColor="#FF9AD5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="td-nb-c" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#8FD3FF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#8FD3FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="td-nb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFF6DA" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#FFD9A8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#C9A0FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="td-drift">
        {NEBULA_CLOUDS.map(([x0, y0, rx, ry, g], i) => {
          const [x, y] = place(box, x0, y0);
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx={rx}
              ry={ry}
              fill={`url(#td-nb-${g})`}
            />
          );
        })}
      </g>
      <g transform={shift(box, 'r', 't')}>
        <g
          className="td-spin"
          style={{ transformOrigin: '1380px 150px' }}
          opacity="0.7"
        >
          <ellipse cx="1380" cy="150" rx="90" ry="30" fill="url(#td-nb-core)" />
          <path
            d="M1380 150 C1420 120 1470 140 1460 170 M1380 150 C1340 180 1290 160 1300 130"
            fill="none"
            stroke="#E9DDFF"
            strokeWidth="3"
            strokeOpacity="0.5"
          />
        </g>
      </g>
      {NEBULA_STARS.map(([x0, y0, s], i) => {
        const [x, y] = place(box, x0, y0);
        return (
          <g key={i} className="td-twinkle" style={anim(i)}>
            <circle cx={x} cy={y} r={3 * s} fill="#FFFFFF" />
            <path
              d={`M${x - 16 * s} ${y} H${x + 16 * s} M${x} ${y - 16 * s} V${y + 16 * s}`}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeOpacity="0.7"
            />
          </g>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Abysse (niveau XVI): rais de lumiere, meduses, algues et bulles.
// ---------------------------------------------------------------------------

/** Une meduse bioluminescente: ombrelle, frange et tentacules. */
function Jellyfish({
  x,
  y,
  s,
  hue,
  i,
}: {
  x: number;
  y: number;
  s: number;
  hue: string;
  i: number;
}) {
  return (
    <g className="td-bob" style={anim(i)}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="0" cy="-6" rx="70" ry="60" fill={hue} opacity="0.12" />
        <path
          d="M-40 0 C-40 -42 40 -42 40 0 C30 6 20 2 10 6 C0 2 -10 6 -20 2 C-30 6 -36 4 -40 0 Z"
          fill={hue}
          fillOpacity="0.38"
          stroke={hue}
          strokeOpacity="0.8"
          strokeWidth="1.5"
        />
        <path
          d="M-26 -10 C-24 -28 24 -28 26 -10"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        <g
          className="td-sway"
          fill="none"
          stroke={hue}
          strokeOpacity="0.55"
          strokeWidth="1.4"
        >
          {[-30, -16, -4, 8, 20, 32].map((tx, k) => (
            <path
              key={k}
              d={`M${tx} 4 C${tx + 10} 40 ${tx - 12} 70 ${tx + 4} ${110 + (k % 3) * 20}`}
            />
          ))}
          <path
            d="M-8 4 C-14 50 6 80 -2 150"
            strokeWidth="4"
            strokeOpacity="0.3"
          />
          <path
            d="M8 4 C14 50 -6 80 4 140"
            strokeWidth="4"
            strokeOpacity="0.3"
          />
        </g>
      </g>
    </g>
  );
}

const JELLIES: [number, number, number, string][] = [
  [150, 300, 1.1, '#9DFFEE'],
  [1460, 420, 0.9, '#C9A0FF'],
  [1340, 150, 0.55, '#7FE3FF'],
  [260, 720, 0.5, '#FF9AD5'],
];

/** Une algue qui ondule, pointe lumineuse; dessinee au pied du decor. */
function Kelp({ x, s, i }: { x: number; s: number; i: number }) {
  return (
    <g className="td-sway td-sway--root" style={anim(i)}>
      <path
        d={`M${x} ${H} C${x - 40 * s} ${H - 120 * s} ${x + 40 * s} ${H - 220 * s} ${x - 10 * s} ${H - 340 * s} C${x + 20 * s} ${H - 220 * s} ${x - 10 * s} ${H - 120 * s} ${x + 24 * s} ${H}`}
        fill="#03222E"
        stroke="#1E7A8A"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
      <circle
        cx={x - 10 * s}
        cy={H - 340 * s}
        r={6 * s}
        fill="#9DFFEE"
        opacity="0.8"
      />
    </g>
  );
}

function Bubbles({ x, i }: { x: number; i: number }) {
  return (
    <g className="td-bubbles" style={anim(i)}>
      {Array.from({ length: 6 }, (_, k) => (
        <circle
          key={k}
          cx={x + Math.sin(k * 1.7) * 10}
          cy={H - 40 - k * 70}
          r={3 + (k % 3) * 2}
          fill="none"
          stroke="#BFF6FF"
          strokeOpacity="0.55"
          strokeWidth="1.4"
        />
      ))}
    </g>
  );
}

function Abysse({ box }: { box: Box }) {
  const k = edgeScale(box);
  return (
    <>
      <defs>
        <linearGradient id="td-ab-ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A6F0FF" stopOpacity="0.32" />
          <stop offset="1" stopColor="#A6F0FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="td-ab-deep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#00060C" stopOpacity="0.65" />
        </linearGradient>
        <radialGradient id="td-ab-surface" cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#7FE3FF" stopOpacity="0.3" />
          <stop offset="1" stopColor="#7FE3FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={box.w} height={box.h} fill="url(#td-ab-surface)" />
      <g transform={`scale(${box.w / W} ${box.h / H})`}>
        <g className="td-rays">
          {[
            [300, 140, 18],
            [620, 110, -6],
            [980, 160, 8],
            [1300, 120, -14],
          ].map(([x, w, r], i) => (
            <path
              key={i}
              d={`M${x - w / 2} -20 L${x + w / 2} -20 L${x + w * 1.8} ${H} L${x - w * 1.8} ${H} Z`}
              fill="url(#td-ab-ray)"
              transform={`rotate(${r} ${x} -20)`}
            />
          ))}
        </g>
      </g>
      {/* Reflets mouvants de la surface. */}
      <g
        className="td-caustic"
        fill="none"
        stroke="#BFF6FF"
        strokeOpacity="0.22"
        strokeWidth="2"
        transform={`scale(${box.w / W} 1)`}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <path
            key={i}
            d={`M-100 ${30 + i * 26} C200 ${10 + i * 26} 400 ${50 + i * 26} 700 ${30 + i * 26} S1200 ${10 + i * 26} 1700 ${40 + i * 26}`}
          />
        ))}
      </g>
      <rect width={box.w} height={box.h} fill="url(#td-ab-deep)" />
      {JELLIES.map(([x0, y0, sc, hue], i) => {
        const [, y] = place(box, x0, y0);
        const x = x0 < W / 2 ? x0 * k : box.w - (W - x0) * k;
        return (
          <Jellyfish
            key={i}
            x={x}
            y={y}
            s={sc * Math.max(0.8, k)}
            hue={hue}
            i={i}
          />
        );
      })}
      {/* Fond: algues et rochers dans les coins, bulles qui montent. */}
      <g transform={`translate(0 ${box.h}) scale(${k}) translate(0 ${-H})`}>
        <Kelp x={40} s={1} i={0} />
        <Kelp x={110} s={0.8} i={1} />
        <path
          d={`M0 ${H} C80 ${H - 70} 160 ${H - 40} 220 ${H - 90} C260 ${H - 60} 300 ${H - 30} 360 ${H} Z`}
          fill="#021821"
        />
        <Bubbles x={80} i={0} />
        <Bubbles x={210} i={1} />
      </g>
      <g
        transform={`translate(${box.w} ${box.h}) scale(${-k} ${k}) translate(0 ${-H})`}
      >
        <Kelp x={40} s={1.1} i={2} />
        <Kelp x={100} s={0.75} i={3} />
        <path
          d={`M0 ${H} C90 ${H - 80} 170 ${H - 40} 240 ${H - 100} C280 ${H - 60} 330 ${H - 30} 380 ${H} Z`}
          fill="#021821"
        />
        <Bubbles x={200} i={2} />
        <Bubbles x={70} i={3} />
      </g>
      <g transform={shift(box, 'c', 'b')}>
        <Bubbles x={720} i={4} />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Salle du trone (niveau XXVI): draperies, candelabres, blason, tapis d'or.
// ---------------------------------------------------------------------------

/** Une draperie de velours pourpre a franges d'or (cote gauche). */
function Drape() {
  return (
    <g>
      <path
        d="M0 0 H210 C190 160 150 300 160 460 C170 600 120 760 140 1000 H0 Z"
        fill="url(#td-tr-velvet)"
      />
      {[40, 90, 140].map((x, i) => (
        <path
          key={i}
          d={`M${x} 0 C${x - 10} 260 ${x + 14} 600 ${x - 6 + i * 4} 1000`}
          stroke="#1A0418"
          strokeOpacity="0.45"
          strokeWidth="14"
          fill="none"
        />
      ))}
      <path
        d="M210 0 C190 160 150 300 160 460 C170 600 120 760 140 1000"
        fill="none"
        stroke="#E3B95A"
        strokeWidth="5"
      />
      <path
        d="M0 0 H260 V70 C200 100 120 90 0 60 Z"
        fill="url(#td-tr-velvet)"
        stroke="#E3B95A"
        strokeWidth="3"
      />
      {Array.from({ length: 13 }, (_, i) => (
        <path
          key={i}
          d={`M${i * 20} ${62 + Math.sin(i / 2) * 8} v18`}
          stroke="#E3B95A"
          strokeWidth="3"
        />
      ))}
      <path
        d="M150 440 C190 430 210 470 200 500 C180 520 150 500 150 470 Z"
        fill="#E3B95A"
      />
      <path
        d="M190 500 L185 560 M200 500 L205 560 M195 500 V566"
        stroke="#E3B95A"
        strokeWidth="3"
      />
    </g>
  );
}

/** Candelabre a trois bougies, et sa lueur qui vacille. */
function Candelabra({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g>
      <circle
        className="td-flicker"
        style={anim(i)}
        cx={x}
        cy={y}
        r="150"
        fill="url(#td-tr-candle)"
      />
      <path
        d={`M${x - 30} ${y + 40} H${x + 30} M${x} ${y + 40} V${y + 90}`}
        stroke="#E3B95A"
        strokeOpacity="0.6"
        strokeWidth="4"
      />
      {[-24, 0, 24].map((dx, k) => (
        <g key={dx}>
          <rect
            x={x + dx - 4}
            y={y + 6}
            width="8"
            height="34"
            fill="#F6E8D0"
            opacity="0.8"
          />
          <path
            className="td-flame"
            style={anim(i * 3 + k)}
            d={`M${x + dx} ${y - 14} C${x + dx + 6} ${y - 4} ${x + dx + 4} ${y + 6} ${x + dx} ${y + 6} C${x + dx - 4} ${y + 6} ${x + dx - 6} ${y - 4} ${x + dx} ${y - 14} Z`}
            fill="#FFD98A"
          />
        </g>
      ))}
    </g>
  );
}

function Trone({ box }: { box: Box }) {
  const k = edgeScale(box);
  return (
    <>
      <defs>
        <linearGradient id="td-tr-velvet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2A0420" />
          <stop offset="0.6" stopColor="#6A1446" />
          <stop offset="1" stopColor="#3A0828" />
        </linearGradient>
        <radialGradient id="td-tr-candle" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFD98A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Blason royal au centre, tres discret. */}
      <g
        transform={shift(box, 'c', 'm')}
        opacity="0.12"
        fill="none"
        stroke="#F3D27C"
        strokeWidth="3"
      >
        <path d="M800 300 L940 350 V520 C940 620 870 680 800 710 C730 680 660 620 660 520 V350 Z" />
        <path
          d="M740 300 L760 230 L790 270 L800 210 L810 270 L840 230 L860 300 Z"
          fill="#F3D27C"
          fillOpacity="0.6"
        />
        <path d="M600 560 C560 460 590 360 660 320 M1000 560 C1040 460 1010 360 940 320" />
      </g>
      {/* Tapis d'or: bordure ornee tout autour. */}
      <rect
        x={250 * k}
        y="34"
        width={box.w - 500 * k}
        height={box.h - 68}
        fill="none"
        stroke="#E3B95A"
        strokeOpacity="0.35"
        strokeWidth="3"
      />
      <rect
        x={264 * k}
        y="48"
        width={box.w - 528 * k}
        height={box.h - 96}
        fill="none"
        stroke="#E3B95A"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        strokeDasharray="6 8"
      />
      {[
        [330, 260],
        [1270, 260],
        [330, 800],
        [1270, 800],
      ].map(([x0, y0], i) => {
        const [x, y] = place(box, x0, y0);
        return <Candelabra key={i} x={x} y={y} i={i} />;
      })}
      <g transform={`scale(${k} ${box.h / H})`}>
        <Drape />
      </g>
      <g transform={`translate(${box.w} 0) scale(${-k} ${box.h / H})`}>
        <Drape />
      </g>
    </>
  );
}

const SCENES: Record<string, (props: { box: Box }) => ReactNode> = {
  'salon-noir': SalonNoir,
  nebuleuse: Nebuleuse,
  abysse: Abysse,
  trone: Trone,
};

/** Taille du decor en unites de dessin, d'apres la forme de la fenetre. */
function useBox(): Box {
  const measure = (): Box => {
    const ratio =
      typeof window === 'undefined'
        ? W / H
        : Math.max(0.3, window.innerWidth / Math.max(1, window.innerHeight));
    const w = Math.max(1000, H * ratio);
    return { w, h: w / ratio };
  };
  const [box, setBox] = useState(measure);
  useEffect(() => {
    const onResize = () => setBox(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return box;
}

/** Cadre fixe des apercus de la boutique. */
const PREVIEW_BOX: Box = { w: W, h: H };

/** Decor du tapis equipe (ou de l'apercu en boutique), s'il en a un. */
export function TableDecor({
  table,
  preview = false,
}: {
  table: string;
  preview?: boolean;
}) {
  const screen = useBox();
  const box = preview ? PREVIEW_BOX : screen;
  const scene = SCENES[table];
  if (!scene) return null;
  return (
    <svg
      className="table-decor"
      data-table-decor={table}
      viewBox={`0 0 ${box.w} ${box.h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="td-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF1BF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFF1BF" stopOpacity="0.07" />
          <stop offset="1" stopColor="#FFF1BF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {scene({ box })}
    </svg>
  );
}
