// Avatars des joueurs: des personnages en illustration plate, dans l'esprit
// des figures du paquet. Chaque portrait tient dans un disque de 100 x 100.

import type { CSSProperties, ReactNode } from 'react';

const INK = '#2A1D19';
const GOLD = '#E2B24F';
const GOLD_DEEP = '#A4761F';
const CHEEK = '#EC8C82';

type Mood = 'neutral' | 'happy' | 'smirk';

function Eyes({
  y = 47,
  spread = 7,
  color = INK,
}: {
  y?: number;
  spread?: number;
  color?: string;
}) {
  return (
    <>
      <ellipse cx={50 - spread} cy={y} rx="2.1" ry="2.5" fill={color} />
      <ellipse cx={50 + spread} cy={y} rx="2.1" ry="2.5" fill={color} />
    </>
  );
}

function Mouth({ mood, y = 55 }: { mood: Mood; y?: number }) {
  if (mood === 'happy') {
    return (
      <path d={`M45 ${y - 0.8} Q50 ${y + 6} 55 ${y - 0.8} Z`} fill="#8E2A2A" />
    );
  }
  if (mood === 'smirk') {
    return (
      <path
        d={`M45.5 ${y + 0.5} Q51 ${y + 3} 55 ${y - 1.5}`}
        fill="none"
        stroke={INK}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    );
  }
  return (
    <path
      d={`M46 ${y} Q50 ${y + 3} 54 ${y}`}
      fill="none"
      stroke={INK}
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  );
}

function Cheeks({ y = 53 }: { y?: number }) {
  return (
    <>
      <ellipse cx="38.6" cy={y} rx="3.6" ry="2.2" fill={CHEEK} opacity="0.5" />
      <ellipse cx="61.4" cy={y} rx="3.6" ry="2.2" fill={CHEEK} opacity="0.5" />
    </>
  );
}

/** Visage humain: tete, yeux, joues et bouche. */
function Head({ skin, mood = 'neutral' }: { skin: string; mood?: Mood }) {
  return (
    <>
      <rect x="44" y="58" width="12" height="13" rx="3" fill={shade(skin)} />
      <circle cx="50" cy="46" r="17" fill={skin} />
      <Eyes />
      <Cheeks />
      <Mouth mood={mood} />
    </>
  );
}

/** Buste: epaules d'une couleur, col optionnel. */
function Body({
  color,
  deep,
  children,
}: {
  color: string;
  deep?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <path d="M12 104 C14 82 29 71 50 71 C71 71 86 82 88 104 Z" fill={color} />
      {deep && (
        <path
          d="M50 71 C40 71 31 74 24 80 L50 104 L76 80 C69 74 60 71 50 71 Z"
          fill={deep}
          opacity="0.35"
        />
      )}
      {children}
    </g>
  );
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.86));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const SKINS = {
  light: '#F4D2B1',
  warm: '#E9B98F',
  tan: '#C98E62',
  deep: '#8D5A3B',
};

interface AvatarDef {
  bg: [string, string];
  draw: () => ReactNode;
}

const AVATARS: Record<string, AvatarDef> = {
  croupier: {
    bg: ['#2C8A63', '#0E4A33'],
    draw: () => (
      <>
        <Body color="#17191F">
          <path d="M40 71 L50 92 L60 71 Z" fill="#FBF6EA" />
          <path
            d="M43 77 L50 80.5 L43 84 Z M57 77 L50 80.5 L57 84 Z"
            fill="#C42A3D"
          />
          <circle cx="50" cy="80.5" r="1.8" fill="#8E1A2B" />
        </Body>
        <Head skin={SKINS.light} mood="smirk" />
        <path
          d="M33 44 C32 30 41 26 50 26 C59 26 68 30 67 44 C62 36 56 35 50 35 C44 35 38 36 33 44 Z"
          fill="#2B211D"
        />
        {/* Visiere verte de croupier. */}
        <path
          d="M29 37 C36 30 64 30 71 37 L66 41 C60 37.5 40 37.5 34 41 Z"
          fill="#2FA36F"
          opacity="0.88"
        />
        <path
          d="M31 36 C40 31.5 60 31.5 69 36"
          fill="none"
          stroke="#1B6B47"
          strokeWidth="1.6"
        />
      </>
    ),
  },
  joueuse: {
    bg: ['#B23A4E', '#5E1424'],
    draw: () => (
      <>
        <Body color="#C42A3D" deep="#8E1A2B">
          <path
            d="M38 72 Q50 84 62 72"
            fill="none"
            stroke={GOLD}
            strokeWidth="2"
          />
        </Body>
        <circle cx="50" cy="22" r="9" fill="#3A241B" />
        <Head skin={SKINS.warm} mood="smirk" />
        <path
          d="M33 46 C31 29 42 25 50 25 C58 25 69 29 67 46 C64 37 57 33.5 50 33.5 C43 33.5 36 37 33 46 Z"
          fill="#3A241B"
        />
        <circle
          cx="33.2"
          cy="53"
          r="2.4"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.4"
        />
        <circle
          cx="66.8"
          cy="53"
          r="2.4"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.4"
        />
        <circle cx="57.5" cy="58.5" r="0.9" fill={INK} />
      </>
    ),
  },
  cowboy: {
    bg: ['#D98A3D', '#7A3E14'],
    draw: () => (
      <>
        <Body color="#7A4A26" deep="#4A2A12">
          <path
            d="M37 71 L50 82 L63 71 L58 70 L50 76 L42 70 Z"
            fill="#C42A3D"
          />
        </Body>
        <Head skin={SKINS.tan} />
        <path
          d="M42 55.5 C45 53 50 54.5 50 54.5 C50 54.5 55 53 58 55.5 C55 57.5 50 56.5 50 56.5 C50 56.5 45 57.5 42 55.5 Z"
          fill="#5A3519"
        />
        <ellipse cx="50" cy="33" rx="31" ry="6" fill="#8A5A2E" />
        <path
          d="M36 33 C36 20 42 16 50 16 C58 16 64 20 64 33 Z"
          fill="#9E6A38"
        />
        <rect x="36" y="27.5" width="28" height="4" fill="#4A2A12" />
      </>
    ),
  },
  chat: {
    bg: ['#F3D27C', '#C99532'],
    draw: () => (
      <>
        <Body color="#FBF6EA">
          <path
            d="M30 76 Q50 84 70 76"
            fill="none"
            stroke="#C42A3D"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="83"
            r="4.2"
            fill={GOLD}
            stroke={GOLD_DEEP}
            strokeWidth="1"
          />
        </Body>
        {/* Patte levee, porte-bonheur. */}
        <ellipse
          cx="80"
          cy="66"
          rx="7"
          ry="11"
          fill="#FBF6EA"
          stroke="#E6DCC6"
          strokeWidth="1"
        />
        <path
          d="M30 34 L33 18 L44 29 Z M70 34 L67 18 L56 29 Z"
          fill="#FBF6EA"
        />
        <path
          d="M33 30 L34.5 22 L40 28 Z M67 30 L65.5 22 L60 28 Z"
          fill="#F2A7A0"
        />
        <circle cx="50" cy="47" r="19" fill="#FBF6EA" />
        <ellipse cx="60" cy="38" rx="6" ry="4" fill="#E2933F" opacity="0.8" />
        <path
          d="M42.5 46 Q44 43.5 45.5 46 M54.5 46 Q56 43.5 57.5 46"
          fill="none"
          stroke={INK}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M48.5 51 L51.5 51 L50 53 Z" fill="#E77C8C" />
        <path
          d="M50 53 Q47.5 56 45.5 54.5 M50 53 Q52.5 56 54.5 54.5"
          fill="none"
          stroke={INK}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M32 50 L41 51 M32 54 L41 53 M68 50 L59 51 M68 54 L59 53"
          stroke="#CFC6B2"
          strokeWidth="1"
        />
        <Cheeks y={52} />
      </>
    ),
  },
  magicien: {
    bg: ['#5B2C8A', '#2A1142'],
    draw: () => (
      <>
        <Body color="#17191F">
          <path
            d="M18 104 C22 86 32 77 41 74 L50 104 Z M82 104 C78 86 68 77 59 74 L50 104 Z"
            fill="#8E1A2B"
          />
        </Body>
        <Head skin={SKINS.light} mood="smirk" />
        <path d="M46 58 Q50 66 54 58 Q50 61 46 58 Z" fill="#2B211D" />
        <rect x="35" y="11" width="30" height="21" rx="2" fill="#17191F" />
        <ellipse cx="50" cy="32" rx="22" ry="4.5" fill="#17191F" />
        <rect x="35" y="24" width="30" height="4.5" fill="#7140A4" />
        <path
          d="M50 14 l1.6 3.4 3.7 .4 -2.8 2.5 .8 3.7 -3.3 -1.9 -3.3 1.9 .8 -3.7 -2.8 -2.5 3.7 -.4 Z"
          fill={GOLD}
        />
      </>
    ),
  },
  pirate: {
    bg: ['#22407A', '#0E1D3D'],
    draw: () => (
      <>
        <Body color="#1F4E9A" deep="#0E1D3D">
          <path
            d="M40 72 L50 80 L60 72"
            fill="none"
            stroke={GOLD}
            strokeWidth="2.4"
          />
        </Body>
        <Head skin={SKINS.warm} mood="smirk" />
        <path d="M33 34 Q50 26 67 34 L67 39 Q50 33 33 39 Z" fill="#C42A3D" />
        <path
          d="M30 31 Q50 4 70 31 Q60 25 50 25 Q40 25 30 31 Z"
          fill="#17191F"
        />
        <path
          d="M46.5 20 L53.5 24 M53.5 20 L46.5 24"
          stroke="#FBF6EA"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <ellipse cx="57" cy="47" rx="5" ry="4.3" fill="#17191F" />
        <path d="M34 41 L67 46" stroke="#17191F" strokeWidth="1.4" />
        <circle
          cx="33.4"
          cy="54"
          r="2.2"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.3"
        />
      </>
    ),
  },
  detective: {
    bg: ['#2E6B6B', '#123636'],
    draw: () => (
      <>
        <Body color="#8A6A45" deep="#4F3A22">
          <path
            d="M40 71 L50 86 L60 71"
            fill="none"
            stroke="#4F3A22"
            strokeWidth="2"
          />
        </Body>
        <Head skin={SKINS.light} />
        <path
          d="M31 40 C31 25 41 21 50 21 C59 21 69 25 69 40 Z"
          fill="#9A7650"
        />
        <path
          d="M31 40 C31 25 41 21 50 21 C59 21 69 25 69 40"
          fill="none"
          stroke="#6B4F31"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <path d="M24 41 Q50 34 76 41 L74 43 Q50 37 26 43 Z" fill="#7A5A38" />
        <circle
          cx="57"
          cy="47"
          r="5"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.5"
        />
        <path d="M62 49 L66 62" stroke={GOLD} strokeWidth="1" />
        <path d="M54 57 L64 60 L64 64 Q66 66 69 64 L69 59 Z" fill="#5A3519" />
      </>
    ),
  },
  diva: {
    bg: ['#E77C9E', '#8E2A55'],
    draw: () => (
      <>
        <Body color="#2B1630">
          <path
            d="M14 92 Q24 72 38 76 Q30 86 26 100 Z M86 92 Q76 72 62 76 Q70 86 74 100 Z"
            fill="#F7A8C4"
          />
          <path
            d="M38 73 Q50 82 62 73"
            fill="none"
            stroke="#FBF6EA"
            strokeWidth="2.6"
            strokeDasharray="0.1 4.2"
            strokeLinecap="round"
          />
        </Body>
        <path
          d="M27 52 C22 28 38 18 50 18 C62 18 78 28 73 52 C70 62 64 64 60 60 L40 60 C36 64 30 62 27 52 Z"
          fill="#F3D27C"
        />
        <Head skin={SKINS.light} mood="happy" />
        <path
          d="M33 44 C34 30 44 26 52 28 C60 26 67 32 67 42 C60 35 52 36 46 38 C40 39 36 41 33 44 Z"
          fill="#E9BF5C"
        />
        <circle cx="42" cy="58.6" r="0.9" fill={INK} />
        <path d="M60 22 Q70 12 76 18 Q70 20 64 26 Z" fill="#F7A8C4" />
      </>
    ),
  },
  robot: {
    bg: ['#5D7FA6', '#23384F'],
    draw: () => (
      <>
        <Body color="#8C96A3" deep="#4B5560">
          <rect x="42" y="80" width="16" height="10" rx="2" fill="#4B5560" />
          <circle cx="46" cy="85" r="1.6" fill="#7FE0B0" />
          <circle cx="54" cy="85" r="1.6" fill="#FF6B7D" />
        </Body>
        <line
          x1="50"
          y1="26"
          x2="50"
          y2="16"
          stroke="#8C96A3"
          strokeWidth="2"
        />
        <circle cx="50" cy="14" r="3.4" fill="#FF6B7D" />
        <rect
          x="31"
          y="26"
          width="38"
          height="38"
          rx="9"
          fill="#B9C2CC"
          stroke="#6E7884"
          strokeWidth="1.4"
        />
        <rect x="36" y="38" width="28" height="11" rx="5.5" fill="#1D2530" />
        <circle cx="43.5" cy="43.5" r="2.8" fill="#8FE6FF" />
        <circle cx="56.5" cy="43.5" r="2.8" fill="#8FE6FF" />
        <path
          d="M42 56 H58"
          stroke="#6E7884"
          strokeWidth="2.4"
          strokeDasharray="2 1.6"
        />
        <rect x="27" y="40" width="4" height="10" rx="2" fill="#6E7884" />
        <rect x="69" y="40" width="4" height="10" rx="2" fill="#6E7884" />
      </>
    ),
  },
  renard: {
    bg: ['#3F7A4A', '#173B20'],
    draw: () => (
      <>
        <Body color="#D9692B" deep="#9E4314">
          <path d="M28 78 Q50 70 72 78 L70 86 Q50 78 30 86 Z" fill="#2F8A63" />
        </Body>
        <path
          d="M29 38 L34 14 L46 30 Z M71 38 L66 14 L54 30 Z"
          fill="#D9692B"
        />
        <path
          d="M33 33 L35 20 L42 29 Z M67 33 L65 20 L58 29 Z"
          fill="#2A1D19"
          opacity="0.7"
        />
        <path
          d="M30 42 C30 28 40 25 50 25 C60 25 70 28 70 42 C70 54 60 64 50 66 C40 64 30 54 30 42 Z"
          fill="#E2793A"
        />
        <path
          d="M36 48 C40 54 46 58 50 66 C54 58 60 54 64 48 C58 50 54 52 50 52 C46 52 42 50 36 48 Z"
          fill="#FBF6EA"
        />
        <path
          d="M41 43 Q43.5 40.5 46 43 M54 43 Q56.5 40.5 59 43"
          fill="none"
          stroke={INK}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <ellipse cx="50" cy="60" rx="3" ry="2.2" fill={INK} />
      </>
    ),
  },
  astronaute: {
    bg: ['#1E2A55', '#060A1E'],
    draw: () => (
      <>
        {[
          [18, 20],
          [80, 28],
          [24, 70],
          [84, 66],
          [70, 12],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#FFF6DA" />
        ))}
        <Body color="#EEF2FA" deep="#AEB8C8">
          <rect x="58" y="80" width="10" height="7" rx="1" fill="#2F6BD6" />
          <rect x="58" y="80" width="10" height="2.3" fill="#C42A3D" />
        </Body>
        <circle
          cx="50"
          cy="46"
          r="24"
          fill="#EEF2FA"
          stroke="#AEB8C8"
          strokeWidth="1.5"
        />
        <circle cx="50" cy="47" r="18" fill={SKINS.warm} />
        <Eyes y={47} />
        <Mouth mood="happy" y={55} />
        <path
          d="M33 40 C35 29 46 26 54 27 C46 29 40 33 37 42 Z"
          fill="#FFFFFF"
          opacity="0.55"
        />
        <circle
          cx="50"
          cy="46"
          r="20"
          fill="none"
          stroke="#8FB8FF"
          strokeWidth="2"
          opacity="0.6"
        />
      </>
    ),
  },
  'reine-coeur': {
    bg: ['#C42A3D', '#5E1424'],
    draw: () => (
      <>
        <path
          d="M29 46 C28 27 39 21 50 21 C61 21 72 27 71 46 L74 72 C66 70 61 64 60.5 57 L39.5 57 C39 64 34 70 26 72 Z"
          fill="#7A3B1E"
        />
        <Body color="#C42A3D" deep="#8E1A2B">
          <path
            d="M34 72.5 L50 86 L66 72.5"
            fill="none"
            stroke={GOLD}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <svg x="43.5" y="88" width="13" height="13" viewBox="0 0 100 100">
            <use href="#suit-hearts" style={{ color: GOLD }} />
          </svg>
        </Body>
        <Head skin={SKINS.light} mood="happy" />
        <path
          d="M32.6 43 C34.5 31 43 28 50 30.4 C57 28 65.5 31 67.4 43 C61 37 55 36 50 37.4 C45 36 39 37 32.6 43 Z"
          fill="#7A3B1E"
        />
        <path
          d="M35 31 C39 24.5 45 22 50 22 C55 22 61 24.5 65 31 L61 30.5 L55.5 24.8 L50 29 L44.5 24.8 L39 30.5 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <circle
          cx="50"
          cy="19"
          r="3.2"
          fill="#FBF5E6"
          stroke={GOLD_DEEP}
          strokeWidth="0.8"
        />
      </>
    ),
  },
  'roi-pique': {
    bg: ['#22305A', '#0B1230'],
    draw: () => (
      <>
        <path
          d="M31.5 48 C31 34 39 28 50 28 C61 28 69 34 68.5 48 L70 58 L30 58 Z"
          fill="#E9E3D7"
        />
        <Body color="#22305A" deep="#141D3A">
          <path
            d="M21 85 C29 75 39 71.5 50 71.5 C61 71.5 71 75 79 85 L74.5 89.5 C67 81.5 59 78 50 78 C41 78 33 81.5 25.5 89.5 Z"
            fill="#F8F3E8"
          />
        </Body>
        <Head skin={SKINS.light} />
        <path
          d="M33.5 49 C33 66 41 75.5 50 75.5 C59 75.5 67 66 66.5 49 C63 57.5 57 60.5 50 60.5 C43 60.5 37 57.5 33.5 49 Z"
          fill="#EEE8DC"
        />
        <path
          d="M41.5 56.6 C45 53.4 50 55.4 50 55.4 C50 55.4 55 53.4 58.5 56.6 C55 58.8 50 57.6 50 57.6 C50 57.6 45 58.8 41.5 56.6 Z"
          fill="#D6CCBB"
        />
        <path
          d="M31.5 33 L33 13 L41.5 23.5 L50 9 L58.5 23.5 L67 13 L68.5 33 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <rect x="31" y="29" width="38" height="5.5" rx="1.5" fill={GOLD_DEEP} />
        <circle cx="50" cy="31.8" r="2.1" fill="#2F6BD6" />
      </>
    ),
  },
  joker: {
    bg: ['#7A3FB0', '#2E8A6A'],
    draw: () => (
      <>
        <Body color="#5B2C8A">
          <path
            d="M50 71 L50 104 L88 104 C86 82 71 71 50 71 Z"
            fill="#C42A3D"
          />
          <path
            d="M30 74 L36 82 L42 74 L48 82 L54 74 L60 82 L66 74 L70 80"
            fill="none"
            stroke="#FBF6EA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </Body>
        <circle cx="50" cy="46" r="17" fill="#FBF6EA" />
        <path
          d="M37 41 L46 44 M63 41 L54 44"
          stroke={INK}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <Eyes />
        <path
          d="M43 39 L43 35 M57 39 L57 35"
          stroke="#2E8A6A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M41 54 Q50 64 59 54 Q50 58 41 54 Z" fill="#C42A3D" />
        <circle cx="50" cy="51" r="2.6" fill="#C42A3D" />
        <path
          d="M33 38 C30 24 22 18 12 22 C20 24 26 30 31 40 Z"
          fill="#C42A3D"
        />
        <path
          d="M67 38 C70 24 78 18 88 22 C80 24 74 30 69 40 Z"
          fill="#2E8A6A"
        />
        <path
          d="M33 38 C36 26 44 22 50 22 C56 22 64 26 67 38 C62 33 56 31 50 31 C44 31 38 33 33 38 Z"
          fill="#5B2C8A"
        />
        <circle cx="12" cy="22" r="3" fill={GOLD} />
        <circle cx="88" cy="22" r="3" fill={GOLD} />
      </>
    ),
  },
  dragon: {
    bg: ['#C8552B', '#4A1206'],
    draw: () => (
      <>
        <Body color="#2F8A4A" deep="#145226">
          <path
            d="M40 74 L44 80 L48 74 L52 80 L56 74 L60 80"
            fill="none"
            stroke="#F3D27C"
            strokeWidth="2"
          />
        </Body>
        <path
          d="M33 30 L26 10 L40 26 Z M67 30 L74 10 L60 26 Z"
          fill="#E9DFC6"
        />
        <path
          d="M28 44 C28 28 39 24 50 24 C61 24 72 28 72 44 C72 56 66 66 50 66 C34 66 28 56 28 44 Z"
          fill="#3FA35E"
        />
        <path
          d="M34 52 C36 62 44 66 50 66 C56 66 64 62 66 52 C60 56 40 56 34 52 Z"
          fill="#A8D98A"
        />
        <ellipse cx="42" cy="42" rx="3.4" ry="4" fill="#F3D27C" />
        <ellipse cx="58" cy="42" rx="3.4" ry="4" fill="#F3D27C" />
        <ellipse cx="42" cy="42.5" rx="1.1" ry="3" fill={INK} />
        <ellipse cx="58" cy="42.5" rx="1.1" ry="3" fill={INK} />
        <circle cx="45" cy="56" r="1.3" fill="#145226" />
        <circle cx="55" cy="56" r="1.3" fill="#145226" />
        <circle cx="76" cy="54" r="5" fill="#D8D2C4" opacity="0.7" />
        <circle cx="84" cy="48" r="3.6" fill="#D8D2C4" opacity="0.5" />
      </>
    ),
  },
  nabab: {
    bg: ['#F3D27C', '#8F6418'],
    draw: () => (
      <>
        <Body color="#17191F">
          <path d="M40 71 L50 92 L60 71 Z" fill="#FBF6EA" />
          <path
            d="M44 76 L50 79 L56 76 L56 82 L50 79 L44 82 Z"
            fill="#17191F"
          />
          <path
            d="M60 86 Q66 92 72 86"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.6"
          />
        </Body>
        <Head skin={SKINS.light} mood="smirk" />
        <path
          d="M40 55 C43 51 48 53 50 54 C52 53 57 51 60 55 C62 57 64 56 65 54 C64 59 59 59 56 57 C54 56 52 56 50 56.5 C48 56 46 56 44 57 C41 59 36 59 35 54 C36 56 38 57 40 55 Z"
          fill="#6B6E75"
        />
        <circle
          cx="57"
          cy="47"
          r="5"
          fill="#FFFFFF"
          fillOpacity="0.25"
          stroke={GOLD}
          strokeWidth="1.6"
        />
        <path
          d="M62 49 Q66 58 63 66"
          fill="none"
          stroke={GOLD}
          strokeWidth="0.9"
        />
        <rect
          x="35"
          y="7"
          width="30"
          height="24"
          rx="2"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1"
        />
        <ellipse
          cx="50"
          cy="31"
          rx="22"
          ry="4.5"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1"
        />
        <rect x="35" y="23" width="30" height="4.5" fill="#17191F" />
        <path
          d="M44 15 L56 15 M44 18 L56 18"
          stroke="#FFF1BF"
          strokeWidth="1"
          opacity="0.8"
        />
      </>
    ),
  },
};

/** Etoile a quatre branches. */
function star4(x: number, y: number, s: number) {
  const k = s * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}

function heart(x: number, y: number, s: number) {
  return `M${x} ${y + s * 0.9} C${x - s * 1.4} ${y} ${x - s * 0.8} ${y - s} ${x} ${y - s * 0.35} C${x + s * 0.8} ${y - s} ${x + s * 1.4} ${y} ${x} ${y + s * 0.9} Z`;
}

function spade(x: number, y: number, s: number) {
  return `M${x} ${y - s * 0.9} C${x - s * 1.4} ${y} ${x - s * 0.8} ${y + s} ${x} ${y + s * 0.35} C${x + s * 0.8} ${y + s} ${x + s * 1.4} ${y} ${x} ${y - s * 0.9} Z M${x} ${y + s * 0.2} L${x - s * 0.4} ${y + s * 1.15} H${x + s * 0.4} Z`;
}

/** Element anime: --i decale chaque occurrence. */
const anim = (i: number) => ({ '--i': i }) as CSSProperties;

/** Etincelles qui scintillent. */
function Twinkles({
  points,
  fill = '#FFFFFF',
}: {
  points: [number, number, number][];
  fill?: string;
}) {
  return (
    <>
      {points.map(([x, y, sz], i) => (
        <path
          key={i}
          className="av-twinkle"
          style={anim(i)}
          d={star4(x, y, sz)}
          fill={fill}
        />
      ))}
    </>
  );
}

/**
 * Decors et effets des avatars payants. Les avatars offerts restent sobres;
 * plus un avatar est cher, plus sa scene est riche et animee.
 */
const EXTRAS: Record<
  string,
  { scene?: () => ReactNode; fx?: () => ReactNode }
> = {
  // 800: une baguette qui scintille.
  magicien: {
    scene: () => (
      <Twinkles
        points={[
          [16, 22, 2.4],
          [84, 30, 1.8],
          [22, 62, 1.6],
        ]}
        fill="#E9D6FF"
      />
    ),
    fx: () => (
      <>
        <path
          d="M70 99 L86 72"
          stroke="#17191F"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M83.5 76.2 L86 72"
          stroke="#FBF6EA"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <Twinkles
          points={[
            [89, 67, 4],
            [80, 64, 2.2],
          ]}
          fill="#FFE7A0"
        />
      </>
    ),
  },

  // 800: la barre du navire derriere lui.
  pirate: {
    scene: () => (
      <g opacity="0.28" stroke="#E3B95A" fill="none">
        <circle cx="50" cy="44" r="27" strokeWidth="3" />
        <circle cx="50" cy="44" r="6" strokeWidth="2.4" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <g key={i}>
              <line
                x1={50 + Math.cos(a) * 6}
                y1={44 + Math.sin(a) * 6}
                x2={50 + Math.cos(a) * 34}
                y2={44 + Math.sin(a) * 34}
                strokeWidth="2.4"
              />
              <circle
                cx={50 + Math.cos(a) * 36}
                cy={44 + Math.sin(a) * 36}
                r="2.6"
                fill="#E3B95A"
              />
            </g>
          );
        })}
      </g>
    ),
  },

  // 1500: la ville la nuit et la fumee de la pipe.
  detective: {
    scene: () => (
      <>
        <circle cx="20" cy="20" r="7" fill="#FFF1BF" opacity="0.7" />
        <path
          d="M0 100 V74 H7 V64 H14 V70 H20 V58 H27 V100 Z M73 100 V62 H80 V54 H86 V66 H93 V72 H100 V100 Z"
          fill="#0A2424"
        />
        {[
          [3, 78],
          [10, 68],
          [22, 63],
          [22, 72],
          [76, 66],
          [82, 58],
          [88, 70],
          [95, 76],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="2"
            height="2.4"
            fill="#F3D27C"
            opacity="0.85"
          />
        ))}
        <path
          d="M0 52 Q25 47 50 52 T100 50"
          stroke="#FFFFFF"
          strokeOpacity="0.08"
          strokeWidth="6"
          fill="none"
        />
      </>
    ),
    fx: () => (
      <>
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            className="av-smoke"
            style={anim(i)}
            cx="68"
            cy="58"
            r="2.6"
            fill="#E8E4DA"
          />
        ))}
      </>
    ),
  },

  // 1500: projecteur de scene et paillettes.
  diva: {
    scene: () => (
      <>
        <path d="M38 0 H62 L92 100 H8 Z" fill="#FFFFFF" opacity="0.13" />
        <Twinkles
          points={[
            [14, 24, 2],
            [86, 20, 2.4],
            [20, 46, 1.4],
            [82, 50, 1.6],
            [10, 70, 1.4],
          ]}
          fill="#FFE1EE"
        />
      </>
    ),
  },

  // 2500: circuits lumineux, regard qui balaie, antenne qui pulse.
  robot: {
    scene: () => (
      <g stroke="#8FE6FF" strokeWidth="1.2" fill="none" opacity="0.4">
        <path d="M0 22 H14 V34 H24 M100 18 H86 V30 H78 M0 60 H10 V52 M100 62 H90 V54" />
        {[
          [24, 34],
          [78, 30],
          [10, 52],
          [90, 54],
        ].map(([x, y], i) => (
          <circle
            key={i}
            className="av-pulse"
            style={anim(i)}
            cx={x}
            cy={y}
            r="2"
            fill="#8FE6FF"
          />
        ))}
      </g>
    ),
    fx: () => (
      <>
        <rect
          className="av-scan"
          x="37"
          y="39"
          width="4"
          height="9"
          rx="2"
          fill="#E9FBFF"
          opacity="0.8"
        />
        <circle
          className="av-pulse"
          style={anim(1)}
          cx="50"
          cy="14"
          r="6"
          fill="#FF6B7D"
          opacity="0.45"
        />
      </>
    ),
  },

  // 2500: pleine lune, sapins et feuilles qui tombent.
  renard: {
    scene: () => (
      <>
        <circle cx="78" cy="20" r="12" fill="#FFF1BF" opacity="0.9" />
        <circle cx="74" cy="17" r="2.4" fill="#E9D9A0" />
        <circle cx="82" cy="24" r="1.6" fill="#E9D9A0" />
        <path
          d="M2 90 L10 66 L18 90 Z M10 80 L16 60 L22 80 Z M82 92 L90 70 L98 92 Z"
          fill="#0F2E17"
        />
      </>
    ),
    fx: () => (
      <>
        {[
          [24, 0],
          [70, 1],
          [44, 2],
        ].map(([x, i]) => (
          <path
            key={i}
            className="av-fall"
            style={anim(i)}
            d={`M${x} 6 q4 -3 7 1 q-4 3 -7 -1 Z`}
            fill={['#E2793A', '#C99532', '#C42A3D'][i]}
          />
        ))}
      </>
    ),
  },

  // 5000: nebuleuse, planete a anneau, etoiles et etoile filante.
  astronaute: {
    scene: () => (
      <>
        <ellipse
          cx="22"
          cy="30"
          rx="26"
          ry="16"
          fill="#8E4FD8"
          opacity="0.28"
        />
        <ellipse cx="80" cy="64" rx="22" ry="14" fill="#E25C9E" opacity="0.2" />
        <circle cx="82" cy="20" r="8" fill="#E9A65A" />
        <path d="M82 13 A8 8 0 0 1 82 27" fill="#B8742F" opacity="0.6" />
        <ellipse
          cx="82"
          cy="20"
          rx="14"
          ry="3.6"
          fill="none"
          stroke="#FFE1B0"
          strokeWidth="1.4"
          transform="rotate(-18 82 20)"
        />
        <Twinkles
          points={[
            [12, 14, 2],
            [30, 6, 1.4],
            [64, 8, 1.6],
            [92, 44, 1.6],
            [8, 50, 1.4],
          ]}
          fill="#FFF6DA"
        />
        <path
          className="av-shoot"
          d="M8 8 L22 16"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </>
    ),
  },

  // 8000: coeurs en motif, rayons, sceptre et eclat de la couronne.
  'reine-coeur': {
    scene: () => (
      <>
        <g className="av-spin" opacity="0.14">
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M50 50 L46 -6 H54 Z"
              fill="#FFE7A0"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
        </g>
        {[
          [12, 14],
          [88, 14],
          [8, 46],
          [92, 46],
          [26, 6],
          [74, 6],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={heart(x, y, 3.4)}
            fill="#FFB3BF"
            opacity="0.3"
          />
        ))}
      </>
    ),
    fx: () => (
      <>
        <path
          d="M84 100 L88 66"
          stroke={GOLD}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d={heart(88.4, 62, 4.4)}
          fill="#E2384D"
          stroke={GOLD_DEEP}
          strokeWidth="0.8"
        />
        <Twinkles points={[[54, 16, 3.4]]} />
      </>
    ),
  },

  // 8000: piques en motif, draperies royales et epee.
  'roi-pique': {
    scene: () => (
      <>
        <path
          d="M0 0 H30 Q20 18 0 26 Z M100 0 H70 Q80 18 100 26 Z"
          fill="#8E1A2B"
        />
        <path
          d="M0 26 Q20 18 30 0 M100 26 Q80 18 70 0"
          stroke={GOLD}
          strokeWidth="1.4"
          fill="none"
        />
        {[
          [12, 46],
          [88, 46],
          [16, 66],
          [84, 66],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={spade(x, y, 3.4)}
            fill="#B4C3F0"
            opacity="0.28"
          />
        ))}
      </>
    ),
    fx: () => (
      <>
        <path
          d="M18 100 L13 60"
          stroke="#DDE3EA"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M7 64 L20 62.4"
          stroke={GOLD}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle
          cx="12.6"
          cy="56.5"
          r="2.4"
          fill="#2F6BD6"
          stroke={GOLD}
          strokeWidth="1"
        />
        <Twinkles points={[[56, 28, 3.4]]} />
      </>
    ),
  },

  // 40000: eventail de cartes, confettis et grelots qui tintent.
  joker: {
    scene: () => (
      <>
        {[-28, -10, 10, 28].map((r, i) => (
          <g key={r} transform={`rotate(${r} 50 92)`}>
            <rect
              x="42"
              y="2"
              width="16"
              height="22"
              rx="2"
              fill="#FBF6EA"
              stroke="#C9BFA8"
              strokeWidth="0.6"
            />
            <path
              d={i % 2 ? heart(50, 13, 3.2) : spade(50, 12, 3.2)}
              fill={i % 2 ? '#C42A3D' : '#17191F'}
            />
          </g>
        ))}
      </>
    ),
    fx: () => (
      <>
        {[
          [16, 0, '#F3D27C'],
          [80, 1, '#2E8A6A'],
          [36, 2, '#C42A3D'],
          [64, 3, '#8FD3FF'],
          [8, 4, '#FF9AD5'],
          [92, 5, '#F3D27C'],
        ].map(([x, i, c]) => (
          <rect
            key={i as number}
            className="av-fall"
            style={anim(i as number)}
            x={x as number}
            y="2"
            width="3"
            height="4.4"
            rx="0.6"
            fill={c as string}
          />
        ))}
        <g className="av-jingle">
          <circle
            cx="12"
            cy="22"
            r="3.6"
            fill={GOLD}
            stroke={GOLD_DEEP}
            strokeWidth="0.8"
          />
        </g>
        <g className="av-jingle" style={anim(1)}>
          <circle
            cx="88"
            cy="22"
            r="3.6"
            fill={GOLD}
            stroke={GOLD_DEEP}
            strokeWidth="0.8"
          />
        </g>
      </>
    ),
  },

  // 60000: ailes, lave, ecailles, souffle de feu et braises.
  dragon: {
    scene: () => (
      <>
        <ellipse
          cx="50"
          cy="104"
          rx="60"
          ry="22"
          fill="#FF6A2A"
          opacity="0.35"
        />
        <path d="M30 70 L2 30 L8 52 L0 56 L12 66 L4 74 Z" fill="#1E6B36" />
        <path d="M70 70 L98 30 L92 52 L100 56 L88 66 L96 74 Z" fill="#1E6B36" />
        <path
          d="M30 70 L2 30 M30 70 L8 52 M30 70 L12 66 M70 70 L98 30 M70 70 L92 52 M70 70 L88 66"
          stroke="#0E3D1E"
          strokeWidth="1"
        />
      </>
    ),
    fx: () => (
      <>
        <g stroke="#145226" strokeWidth="1" fill="none" opacity="0.6">
          <path d="M24 92 q4 -4 8 0 q4 -4 8 0 M60 92 q4 -4 8 0 q4 -4 8 0 M30 84 q4 -4 8 0 M62 84 q4 -4 8 0" />
        </g>
        <g className="av-flicker">
          <path
            d="M66 58 C76 50 90 50 104 44 C96 56 92 62 104 70 C90 68 78 66 66 60 Z"
            fill="#FF8A2A"
          />
          <path
            d="M66 58.6 C74 54 84 54 96 50 C90 57 90 61 98 66 C86 64 76 62 66 59.6 Z"
            fill="#FFD25A"
          />
        </g>
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            className="av-rise"
            style={anim(i)}
            cx={[74, 84, 92, 80][i]}
            cy={[52, 48, 58, 64][i]}
            r="1.2"
            fill="#FFE7A0"
          />
        ))}
      </>
    ),
  },

  // 250000: le nabab. Rayons d'or, piles de jetons, pluie de pieces, eclat.
  nabab: {
    scene: () => (
      <>
        <g className="av-spin" opacity="0.3">
          {Array.from({ length: 16 }, (_, i) => (
            <path
              key={i}
              d="M50 50 L47 -8 H53 Z"
              fill="#FFF1BF"
              transform={`rotate(${i * 22.5} 50 50)`}
            />
          ))}
        </g>
        {[
          [11, 0],
          [89, 1],
        ].map(([x, side]) =>
          Array.from({ length: 5 }, (_, i) => (
            <g key={`${side}-${i}`}>
              <ellipse
                cx={x}
                cy={92 - i * 4}
                rx="8"
                ry="2.6"
                fill={i % 2 ? '#C99532' : GOLD}
                stroke={GOLD_DEEP}
                strokeWidth="0.6"
              />
            </g>
          )),
        )}
      </>
    ),
    fx: () => (
      <>
        {[18, 34, 66, 82, 50].map((x, i) => (
          <g key={x} className="av-fall" style={anim(i)}>
            <ellipse
              cx={x}
              cy="4"
              rx="3.6"
              ry="3.6"
              fill={GOLD}
              stroke={GOLD_DEEP}
              strokeWidth="0.8"
            />
            <path d={`M${x} 2 V6`} stroke={GOLD_DEEP} strokeWidth="0.8" />
          </g>
        ))}
        <path
          d="M60 86 L76 82"
          stroke="#5A3519"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="76.6" cy="81.8" r="1.4" fill="#FF6A2A" />
        {[0, 1].map((i) => (
          <circle
            key={i}
            className="av-smoke"
            style={anim(i)}
            cx="78"
            cy="79"
            r="2"
            fill="#E8E4DA"
          />
        ))}
        <Twinkles
          points={[
            [60, 43, 3.6],
            [36, 12, 2.6],
          ]}
        />
      </>
    ),
  },
};

export const AVATAR_IDS = Object.keys(AVATARS);

/** Portrait seul, dans un disque. */
export function AvatarArt({ id }: { id: string }) {
  const def = AVATARS[id] ?? AVATARS.croupier;
  const extra = AVATARS[id] ? EXTRAS[id] : undefined;
  const gid = `avatar-bg-${id}`;
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor={def.bg[0]} />
          <stop offset="1" stopColor={def.bg[1]} />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        {extra?.scene?.()}
        {def.draw()}
        {extra?.fx?.()}
      </g>
    </g>
  );
}
