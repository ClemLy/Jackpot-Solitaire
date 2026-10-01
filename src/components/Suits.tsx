// Enseignes dessinees en SVG. Les glyphes Unicode (♠ ♥ ♦ ♣) changent de
// forme d'un systeme a l'autre et deviennent parfois des emojis sur mobile:
// on les remplace par des traces vectoriels identiques partout. Les memes
// traces servent au rendu canvas des effets de victoire (Path2D).

import type { CSSProperties } from 'react';
import type { Suit } from '../engine';
import { SUIT_PATHS } from '../utils/suitPaths';

/** Sprite a monter une seule fois: chaque carte y fait reference via <use>. */
export function SuitSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {(Object.keys(SUIT_PATHS) as Suit[]).map((suit) => (
          <symbol key={suit} id={`suit-${suit}`} viewBox="0 0 100 100">
            {SUIT_PATHS[suit].map((d, i) => (
              <path key={i} d={d} fill="currentColor" />
            ))}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

export function SuitIcon({
  suit,
  className,
  style,
}: {
  suit: Suit;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#suit-${suit}`} />
    </svg>
  );
}
