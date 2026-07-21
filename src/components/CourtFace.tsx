// Petits portraits dessines pour les figures (Valet, Dame, Roi).
// Ils changent d'expression selon la situation: grognon sur un coup interdit,
// clin d'oeil quand ils sont montres par un indice, ravis pres de la victoire.

import type { Rank } from '../engine';

export type Expression = 'neutral' | 'grumpy' | 'wink' | 'happy';

interface Props {
  rank: Rank;
  expression?: Expression;
}

function Eyes({ expression }: { expression: Expression }) {
  if (expression === 'wink') {
    return (
      <>
        <circle cx="40" cy="50" r="3.4" fill="currentColor" />
        <path
          d="M54 50 q4 -3 8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </>
    );
  }
  return (
    <>
      <circle cx="40" cy="50" r="3.4" fill="currentColor" />
      <circle cx="58" cy="50" r="3.4" fill="currentColor" />
    </>
  );
}

function Brows({ expression }: { expression: Expression }) {
  if (expression === 'grumpy') {
    return (
      <>
        <path
          d="M34 42 l10 4"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M64 42 l-10 4"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </>
    );
  }
  return (
    <>
      <path
        d="M34 44 q5 -3 10 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M54 44 q5 -3 10 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  );
}

function Mouth({ expression }: { expression: Expression }) {
  if (expression === 'grumpy') {
    return (
      <path
        d="M40 68 q9 -7 18 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    );
  }
  if (expression === 'happy' || expression === 'wink') {
    return (
      <path
        d="M39 64 q10 10 20 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    );
  }
  return (
    <path
      d="M41 66 h16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  );
}

function Headwear({ rank }: { rank: Rank }) {
  if (rank === 13) {
    // Roi: couronne en zigzag.
    return (
      <path
        d="M28 30 L34 16 L42 26 L49 12 L56 26 L64 16 L70 30 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
    );
  }
  if (rank === 12) {
    // Dame: diademe arrondi avec une perle.
    return (
      <>
        <path
          d="M30 30 q19 -20 38 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="49" cy="15" r="3.4" fill="currentColor" />
      </>
    );
  }
  // Valet: bonnet a plume.
  return (
    <>
      <path
        d="M30 30 q10 -16 30 -12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M60 18 q10 -6 12 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </>
  );
}

export function CourtFace({ rank, expression = 'neutral' }: Props) {
  return (
    <svg viewBox="0 0 98 98" aria-hidden="true">
      <Headwear rank={rank} />
      <circle
        cx="49"
        cy="56"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
      />
      <Brows expression={expression} />
      <Eyes expression={expression} />
      <Mouth expression={expression} />
      {/* Petite fossette pour le charme. */}
      <circle cx="34" cy="60" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="64" cy="60" r="2" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
