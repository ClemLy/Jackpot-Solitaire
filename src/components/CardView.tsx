import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { memo } from 'react';
import type { Card } from '../engine';
import { cardColor, rankLabel, suitSymbol } from '../engine';
import { CourtFace, type Expression } from './CourtFace';

type Point = [number, number];

// Dispositions classiques des pips pour les cartes 2 a 10.
const PIP_LAYOUT: Record<number, Point[]> = {
  2: [
    [50, 6],
    [50, 94],
  ],
  3: [
    [50, 6],
    [50, 50],
    [50, 94],
  ],
  4: [
    [20, 6],
    [80, 6],
    [20, 94],
    [80, 94],
  ],
  5: [
    [20, 6],
    [80, 6],
    [50, 50],
    [20, 94],
    [80, 94],
  ],
  6: [
    [20, 6],
    [80, 6],
    [20, 50],
    [80, 50],
    [20, 94],
    [80, 94],
  ],
  7: [
    [20, 6],
    [80, 6],
    [50, 28],
    [20, 50],
    [80, 50],
    [20, 94],
    [80, 94],
  ],
  8: [
    [20, 6],
    [80, 6],
    [50, 28],
    [20, 50],
    [80, 50],
    [50, 72],
    [20, 94],
    [80, 94],
  ],
  9: [
    [20, 6],
    [80, 6],
    [20, 37],
    [80, 37],
    [50, 50],
    [20, 63],
    [80, 63],
    [20, 94],
    [80, 94],
  ],
  10: [
    [20, 6],
    [80, 6],
    [50, 20],
    [20, 37],
    [80, 37],
    [20, 63],
    [80, 63],
    [50, 80],
    [20, 94],
    [80, 94],
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
  dealing?: boolean;
  dealDelay?: number;
  undoing?: boolean;
  expression?: Expression;
  floatText?: string;
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

function Face({ card, expression }: { card: Card; expression: Expression }) {
  const symbol = suitSymbol(card.suit);
  if (card.rank === 1) {
    return <div className="card__ace">{symbol}</div>;
  }
  if (card.rank >= 11) {
    return (
      <div className="card__court">
        <CourtFace rank={card.rank} expression={expression} />
      </div>
    );
  }
  const pips = PIP_LAYOUT[card.rank] ?? [];
  return (
    <div className="card__pips">
      {pips.map(([x, y], i) => (
        <span
          key={i}
          className="card__pip"
          data-flip={y > 50 ? 'true' : 'false'}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {symbol}
        </span>
      ))}
    </div>
  );
}

function CardViewBase(props: CardViewProps) {
  const { card } = props;
  const symbol = suitSymbol(card.suit);
  const label = rankLabel(card.rank);
  const expression = resolveExpression(props);

  const classes = ['card'];
  if (props.playable) classes.push('is-playable');
  if (props.dragging) classes.push('is-dragging');
  if (props.hint) classes.push('is-hint');
  if (props.hintTarget) classes.push('is-hint-target');
  if (props.shaking) classes.push('is-shake');
  if (props.dealing) classes.push('is-dealing');
  if (props.undoing) classes.push('is-undo');

  return (
    <div
      className={classes.join(' ')}
      data-card-id={card.id}
      data-suit={card.suit}
      data-color={cardColor(card)}
      data-rank={card.rank}
      data-face-up={card.faceUp ? 'true' : 'false'}
      style={props.style}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
    >
      <div
        className="card__inner"
        style={
          props.dealing && props.dealDelay
            ? { animationDelay: `${props.dealDelay}ms` }
            : undefined
        }
      >
        <div className="card__front">
          <div className="card__corner card__corner--tl">
            <span className="rank">{label}</span>
            <span className="suit">{symbol}</span>
          </div>
          <Face card={card} expression={expression} />
          <div className="card__corner card__corner--br">
            <span className="rank">{label}</span>
            <span className="suit">{symbol}</span>
          </div>
        </div>
        <div className="card__back" />
      </div>
      {props.floatText && (
        <span
          className="float-score"
          data-kind="loss"
          style={{ left: 0, right: 0, top: '-6px', textAlign: 'center' }}
        >
          {props.floatText}
        </span>
      )}
    </div>
  );
}

export const CardView = memo(CardViewBase);
