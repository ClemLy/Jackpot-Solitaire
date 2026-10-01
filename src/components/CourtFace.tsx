// Portraits des figures (Valet, Dame, Roi), en illustration plate.
// Ils gardent leur caractere: grognons sur un coup interdit, clin d'oeil
// quand un indice les montre, ravis pres de la victoire.

import type { Rank, Suit } from '../engine';

export type Expression = 'neutral' | 'grumpy' | 'wink' | 'happy';

interface Props {
  rank: Rank;
  suit: Suit;
  expression?: Expression;
}

const ROBE: Record<Suit, { main: string; deep: string }> = {
  hearts: { main: '#C42A3D', deep: '#8E1A2B' },
  diamonds: { main: '#C8552B', deep: '#8F3516' },
  spades: { main: '#22305A', deep: '#141D3A' },
  clubs: { main: '#1E5B45', deep: '#123A2C' },
};

const HAIR: Record<Suit, string> = {
  hearts: '#7A3B1E',
  diamonds: '#B5772E',
  spades: '#2B211D',
  clubs: '#4A2E1C',
};

const SKIN = '#F4D2B1';
const SKIN_SHADE = '#E7B994';
const INK = '#2A1D19';
const GOLD = '#E2B24F';
const GOLD_DEEP = '#A4761F';

function Face({ expression }: { expression: Expression }) {
  const eyeL =
    expression === 'wink' ? null : (
      <ellipse cx="43" cy="47" rx="2.1" ry="2.5" fill={INK} />
    );
  return (
    <g>
      {eyeL}
      {expression === 'wink' ? (
        <>
          <ellipse cx="43" cy="47" rx="2.1" ry="2.5" fill={INK} />
          <path
            d="M54.4 47.6 Q57 44.6 59.6 47.6"
            fill="none"
            stroke={INK}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : (
        <ellipse cx="57" cy="47" rx="2.1" ry="2.5" fill={INK} />
      )}
      {expression === 'grumpy' && (
        <>
          <path
            d="M38.6 41.6 L46.4 44"
            stroke={INK}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M61.4 41.6 L53.6 44"
            stroke={INK}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
      <ellipse
        cx="38.6"
        cy="53"
        rx="3.6"
        ry="2.2"
        fill="#EC8C82"
        opacity="0.5"
      />
      <ellipse
        cx="61.4"
        cy="53"
        rx="3.6"
        ry="2.2"
        fill="#EC8C82"
        opacity="0.5"
      />
      {expression === 'grumpy' ? (
        <path
          d="M45.6 57.4 Q50 53.8 54.4 57.4"
          fill="none"
          stroke={INK}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : expression === 'happy' || expression === 'wink' ? (
        <path d="M45 54.2 Q50 61 55 54.2 Z" fill="#8E2A2A" />
      ) : (
        <path
          d="M46 55.2 Q50 58.2 54 55.2"
          fill="none"
          stroke={INK}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function Robe({ suit, rank }: { suit: Suit; rank: Rank }) {
  const robe = ROBE[suit];
  return (
    <g>
      <path
        d="M12 100 C14 80 29 70 50 70 C71 70 86 80 88 100 Z"
        fill={robe.main}
      />
      <path
        d="M50 70 C40 70 31 73 24 79 L50 100 L76 79 C69 73 60 70 50 70 Z"
        fill={robe.deep}
        opacity="0.35"
      />
      {rank === 13 ? (
        // Col d'hermine du Roi.
        <>
          <path
            d="M21 85 C29 75 39 71.5 50 71.5 C61 71.5 71 75 79 85 L74.5 89.5 C67 81.5 59 78 50 78 C41 78 33 81.5 25.5 89.5 Z"
            fill="#F8F3E8"
          />
          {[30, 40, 50, 60, 70].map((x) => (
            <path
              key={x}
              d={`M${x} ${x === 50 ? 74.6 : x === 40 || x === 60 ? 75.6 : 78.4} l1.4 3 l-1.4 -0.8 l-1.4 0.8 Z`}
              fill={INK}
            />
          ))}
        </>
      ) : (
        <path
          d="M34 72.5 L50 86 L66 72.5"
          fill="none"
          stroke={GOLD}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      <svg x="43.5" y="88" width="13" height="13" viewBox="0 0 100 100">
        <use href={`#suit-${suit}`} style={{ color: GOLD }} />
      </svg>
    </g>
  );
}

function HairBack({ rank, suit }: { rank: Rank; suit: Suit }) {
  if (rank === 12) {
    return (
      <path
        d="M29 46 C28 27 39 21 50 21 C61 21 72 27 71 46 L74 72 C66 70 61 64 60.5 57 L39.5 57 C39 64 34 70 26 72 Z"
        fill={HAIR[suit]}
      />
    );
  }
  if (rank === 13) {
    return (
      <path
        d="M31.5 48 C31 34 39 28 50 28 C61 28 69 34 68.5 48 L70 58 L30 58 Z"
        fill="#E9E3D7"
      />
    );
  }
  return null;
}

function HairFront({ rank, suit }: { rank: Rank; suit: Suit }) {
  if (rank === 13) {
    // Barbe et moustache du Roi.
    return (
      <>
        <path
          d="M33.5 49 C33 66 41 75.5 50 75.5 C59 75.5 67 66 66.5 49 C63 57.5 57 60.5 50 60.5 C43 60.5 37 57.5 33.5 49 Z"
          fill="#EEE8DC"
        />
        <path
          d="M41.5 56.6 C45 53.4 50 55.4 50 55.4 C50 55.4 55 53.4 58.5 56.6 C55 58.8 50 57.6 50 57.6 C50 57.6 45 58.8 41.5 56.6 Z"
          fill="#D6CCBB"
        />
      </>
    );
  }
  if (rank === 12) {
    return (
      <path
        d="M32.6 43 C34.5 31 43 28 50 30.4 C57 28 65.5 31 67.4 43 C61 37 55 36 50 37.4 C45 36 39 37 32.6 43 Z"
        fill={HAIR[suit]}
      />
    );
  }
  return (
    <path
      d="M33 45 C33 32 41 27.5 50 27.5 C59 27.5 67 32 67 45 C62 38.5 56 36.5 50 36.5 C44 36.5 38 38.5 33 45 Z"
      fill={HAIR[suit]}
    />
  );
}

function Headwear({ rank, suit }: { rank: Rank; suit: Suit }) {
  if (rank === 13) {
    return (
      <g>
        <path
          d="M31.5 33 L33 13 L41.5 23.5 L50 9 L58.5 23.5 L67 13 L68.5 33 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <rect x="31" y="29" width="38" height="5.5" rx="1.5" fill={GOLD_DEEP} />
        <circle cx="50" cy="31.8" r="2.1" fill="#C42A3D" />
        <circle cx="40" cy="31.8" r="1.6" fill="#2F6BD6" />
        <circle cx="60" cy="31.8" r="1.6" fill="#2F6BD6" />
        <circle cx="33" cy="13" r="1.8" fill="#FFF3C8" />
        <circle cx="50" cy="9" r="1.8" fill="#FFF3C8" />
        <circle cx="67" cy="13" r="1.8" fill="#FFF3C8" />
      </g>
    );
  }
  if (rank === 12) {
    return (
      <g>
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
      </g>
    );
  }
  // Valet: beret de la couleur de l'enseigne, plume doree.
  return (
    <g>
      <path
        d="M63 27 C70 18 77 12 84 10 C80 16 74 22 66 29 Z"
        fill="#FBF5E6"
        stroke={GOLD_DEEP}
        strokeWidth="0.8"
      />
      <ellipse
        cx="47"
        cy="29"
        rx="21"
        ry="8.5"
        transform="rotate(-8 47 29)"
        fill={ROBE[suit].main}
      />
      <path
        d="M27 33 C38 30 56 29 67 27.5"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  );
}

export function CourtFace({ rank, suit, expression = 'neutral' }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <HairBack rank={rank} suit={suit} />
      <rect x="44" y="58" width="12" height="14" rx="3" fill={SKIN_SHADE} />
      <Robe suit={suit} rank={rank} />
      <circle cx="50" cy="46" r="17" fill={SKIN} />
      <HairFront rank={rank} suit={suit} />
      <Face expression={expression} />
      <Headwear rank={rank} suit={suit} />
    </svg>
  );
}
