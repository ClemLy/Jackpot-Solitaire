import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { memo } from 'react';
import type { Card } from '../engine';
import { cardColor, rankLabel } from '../engine';
import { CourtFace, type Expression } from './CourtFace';
import { SuitIcon } from './Suits';

type Point = [number, number];

const SUIT_NAME: Record<Card['suit'], string> = {
  spades: 'pique',
  hearts: 'cœur',
  diamonds: 'carreau',
  clubs: 'trèfle',
};

// Dispositions classiques des pips pour les cartes 2 a 10 (en % de la zone
// centrale de la carte).
const PIP_LAYOUT: Record<number, Point[]> = {
  2: [
    [50, 0],
    [50, 100],
  ],
  3: [
    [50, 0],
    [50, 50],
    [50, 100],
  ],
  4: [
    [18, 0],
    [82, 0],
    [18, 100],
    [82, 100],
  ],
  5: [
    [18, 0],
    [82, 0],
    [50, 50],
    [18, 100],
    [82, 100],
  ],
  6: [
    [18, 0],
    [82, 0],
    [18, 50],
    [82, 50],
    [18, 100],
    [82, 100],
  ],
  7: [
    [18, 0],
    [82, 0],
    [50, 25],
    [18, 50],
    [82, 50],
    [18, 100],
    [82, 100],
  ],
  8: [
    [18, 0],
    [82, 0],
    [50, 25],
    [18, 50],
    [82, 50],
    [50, 75],
    [18, 100],
    [82, 100],
  ],
  9: [
    [18, 0],
    [82, 0],
    [18, 33.3],
    [82, 33.3],
    [50, 50],
    [18, 66.7],
    [82, 66.7],
    [18, 100],
    [82, 100],
  ],
  10: [
    [18, 0],
    [82, 0],
    [50, 16.7],
    [18, 33.3],
    [82, 33.3],
    [18, 66.7],
    [82, 66.7],
    [50, 83.3],
    [18, 100],
    [82, 100],
  ],
};

export interface CardViewProps {
  card: Card;
  style?: CSSProperties;
  playable?: boolean;
  dragging?: boolean;
  hint?: boolean;
  hintTarget?: boolean;
  shaking?: boolean;
  expression?: Expression;
  floatText?: string;
  /** Carte cachee qu'on peut toucher pour un coup d'oeil. */
  peekable?: boolean;
  /** Carte cachee montree le temps d'un coup d'oeil. */
  peeking?: boolean;
  onPointerDown?: (event: ReactPointerEvent) => void;
  onPointerMove?: (event: ReactPointerEvent) => void;
  onPointerUp?: (event: ReactPointerEvent) => void;
  onPointerCancel?: (event: ReactPointerEvent) => void;
}

function resolveExpression(props: CardViewProps): Expression {
  if (props.expression) return props.expression;
  if (props.shaking) return 'grumpy';
  if (props.hint || props.hintTarget) return 'wink';
  return 'neutral';
}

function Center({ card, expression }: { card: Card; expression: Expression }) {
  if (card.rank === 1) {
    return (
      <div className="card__ace" data-ornate={card.suit === 'spades'}>
        <SuitIcon suit={card.suit} />
      </div>
    );
  }
  if (card.rank >= 11) {
    return (
      <div className="card__court">
        <CourtFace rank={card.rank} suit={card.suit} expression={expression} />
      </div>
    );
  }
  const pips = PIP_LAYOUT[card.rank] ?? [];
  return (
    <div className="card__pips">
      {pips.map(([x, y], i) => (
        <SuitIcon
          key={i}
          suit={card.suit}
          className="card__pip"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%)${y > 50 ? ' rotate(180deg)' : ''}`,
          }}
        />
      ))}
    </div>
  );
}

function Index({ card, position }: { card: Card; position: 'top' | 'bottom' }) {
  const label = rankLabel(card.rank);
  return (
    <div className={`card__index card__index--${position}`}>
      <span className="card__rank" data-wide={label.length > 1}>
        {label}
      </span>
      <SuitIcon suit={card.suit} className="card__corner-suit" />
    </div>
  );
}

function CardViewBase(props: CardViewProps) {
  const { card } = props;
  const expression = resolveExpression(props);

  const classes = ['card'];
  if (props.playable) classes.push('is-playable');
  if (props.dragging) classes.push('is-dragging');
  if (props.hint) classes.push('is-hint');
  if (props.hintTarget) classes.push('is-hint-target');
  if (props.shaking) classes.push('is-shake');
  if (props.peekable) classes.push('is-peekable');
  if (props.peeking) classes.push('is-peeking');

  return (
    <div
      className={classes.join(' ')}
      data-card-id={card.id}
      data-suit={card.suit}
      data-color={cardColor(card)}
      data-rank={card.rank}
      data-face-up={card.faceUp ? 'true' : 'false'}
      aria-label={
        card.faceUp
          ? `${rankLabel(card.rank)} de ${SUIT_NAME[card.suit]}`
          : undefined
      }
      style={props.style}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
    >
      <div className="card__inner">
        <div className="card__front">
          {/* Une carte cachee n'a pas besoin de son recto: on allege le DOM.
              Il apparait au moment du retournement, cache par la face arriere
              pendant la premiere moitie de la rotation. */}
          {card.faceUp && (
            <>
              <Index card={card} position="top" />
              <Center card={card} expression={expression} />
              <Index card={card} position="bottom" />
            </>
          )}
        </div>
        <div className="card__back" />
      </div>
      {props.floatText && (
        <span className="float-score" data-kind="loss">
          {props.floatText}
        </span>
      )}
    </div>
  );
}

export const CardView = memo(CardViewBase);
