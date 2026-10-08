import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { GameMode } from '../state/game';
import { useMetaStore } from '../state/meta';
import { playSound } from '../audio/sfx';
import type { Suit } from '../engine';
import { SuitIcon } from './Suits';
import { Chip } from './ui';

interface Spring {
  base: number;
  /** Valeurs courantes: rotX, rotY, soulevement, rotation de base, reflet x, y. */
  cur: number[];
  vel: number[];
  target: number[];
  raf: number;
  last: number;
}

export interface ModeCardData {
  mode: GameMode;
  title: string;
  desc: string;
  suit: Suit;
  /** Ce qui s'affiche dans le coin, a la place du rang. */
  index: string;
  meta: ReactNode;
}

/** Petit embleme anime propre a chaque mode, dans le coin de la carte. */
function Emblem({ mode, suit }: { mode: GameMode; suit: Suit }) {
  if (mode === 'chrono') {
    return (
      <svg
        className="emblem emblem--chrono"
        viewBox="0 0 32 32"
        aria-hidden="true"
      >
        <rect x="13" y="2" width="6" height="3" rx="1" fill="currentColor" />
        <path
          d="M24 7.5l2-2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="16"
          cy="18"
          r="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="16"
            y1="8.6"
            x2="16"
            y2={i % 3 === 0 ? 10.8 : 9.8}
            stroke="currentColor"
            strokeWidth="1.2"
            opacity="0.6"
            transform={`rotate(${i * 30} 16 18)`}
          />
        ))}
        <line
          className="emblem__hand"
          x1="16"
          y1="18"
          x2="16"
          y2="10.5"
          stroke="var(--crimson)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="16" cy="18" r="1.6" fill="currentColor" />
      </svg>
    );
  }
  if (mode === 'vegas') {
    return (
      <span className="emblem emblem--vegas" aria-hidden="true">
        <Chip size="100%" tone="red" />
      </span>
    );
  }
  return (
    <span className={`emblem emblem--${mode}`} aria-hidden="true">
      <SuitIcon suit={suit} />
      {mode === 'daily' && <i className="emblem__spark" />}
    </span>
  );
}

function reducedMotion(): boolean {
  return (
    useMetaStore.getState().settings.reducedMotion ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Les modes de jeu, presentes comme des cartes distribuees sur la table.
 * Elles arrivent face cachee et se retournent, respirent au repos, suivent
 * le curseur au survol et s'envolent en se retournant quand on les choisit.
 */
export function ModeDeck({
  cards,
  onPick,
}: {
  cards: ModeCardData[];
  onPick: (mode: GameMode) => void;
}) {
  const [launching, setLaunching] = useState<GameMode | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pick = (mode: GameMode) => {
    if (launching) return;
    if (reducedMotion()) {
      onPick(mode);
      return;
    }
    setLaunching(mode);
    playSound('flip');
    timer.current = setTimeout(() => onPick(mode), 460);
  };

  // Inclinaison 3D qui suit le curseur. Plutot que de recaler la carte a
  // chaque mouvement de souris (ce qui donne un rendu saccade), on fixe une
  // cible et un ressort amorti la rejoint image par image: la carte se
  // soulève, s'incline et revient avec de l'inertie.
  const springs = useRef(new WeakMap<HTMLElement, Spring>());
  const getSpring = (el: HTMLElement): Spring => {
    let sp = springs.current.get(el);
    if (!sp) {
      const base =
        parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0;
      sp = {
        base,
        cur: [0, 0, 0, base, 50, 0],
        vel: [0, 0, 0, 0, 0, 0],
        target: [0, 0, 0, base, 50, 0],
        raf: 0,
        last: 0,
      };
      springs.current.set(el, sp);
    }
    return sp;
  };

  const aim = (el: HTMLElement, target: number[]) => {
    const sp = getSpring(el);
    sp.target = target;
    if (sp.raf) return;
    sp.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.04, (now - sp.last) / 1000);
      sp.last = now;
      let moving = false;
      for (let i = 0; i < sp.cur.length; i++) {
        const k = i >= 4 ? 120 : 170; // raideur
        const c = i >= 4 ? 18 : 15; // amortissement
        const f = (sp.target[i] - sp.cur[i]) * k - sp.vel[i] * c;
        sp.vel[i] += f * dt;
        sp.cur[i] += sp.vel[i] * dt;
        if (
          Math.abs(sp.vel[i]) > 0.08 ||
          Math.abs(sp.target[i] - sp.cur[i]) > 0.05
        )
          moving = true;
      }
      const [rx, ry, ly, rz, mx, my] = sp.cur;
      el.style.transform = `perspective(800px) translateY(${ly.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${rz.toFixed(2)}deg)`;
      el.style.setProperty('--mx', `${mx.toFixed(1)}%`);
      el.style.setProperty('--my', `${my.toFixed(1)}%`);
      if (moving) {
        sp.raf = requestAnimationFrame(step);
      } else {
        sp.raf = 0;
        sp.cur = [...sp.target];
        sp.vel = [0, 0, 0, 0, 0, 0];
        // Retour au repos: on rend la main au CSS (inclinaison de base).
        if (sp.target[2] === 0 && sp.target[0] === 0)
          el.style.removeProperty('transform');
      }
    };
    sp.raf = requestAnimationFrame(step);
  };

  const tilt = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || launching || reducedMotion()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    aim(el, [(0.5 - py) * 9, (px - 0.5) * 12, -9, 0, px * 100, py * 100]);
  };
  const untilt = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    aim(el, [0, 0, 0, getSpring(el).base, 50, 0]);
  };

  return (
    <section
      className="mode-deck"
      aria-label="Autres modes de jeu"
      data-launching={launching ? 'true' : undefined}
    >
      {cards.map((m, i) => (
        <button
          key={m.mode}
          className="mode-card"
          data-mode={m.mode}
          data-color={
            m.suit === 'hearts' || m.suit === 'diamonds' ? 'red' : 'black'
          }
          data-launch={launching === m.mode ? 'true' : undefined}
          style={{ '--k': i } as CSSProperties}
          onClick={() => pick(m.mode)}
          onPointerMove={tilt}
          onPointerLeave={untilt}
        >
          <span className="mode-card__inner">
            <span className="mode-card__face">
              <span className="mode-card__index" aria-hidden="true">
                <span>{m.index}</span>
                <SuitIcon suit={m.suit} />
              </span>
              <Emblem mode={m.mode} suit={m.suit} />
              <span className="mode-card__title">{m.title}</span>
              <span className="mode-card__desc">{m.desc}</span>
              <span className="mode-card__meta">{m.meta}</span>
              <span
                className="mode-card__index mode-card__index--flip"
                aria-hidden="true"
              >
                <span>{m.index}</span>
                <SuitIcon suit={m.suit} />
              </span>
              <SuitIcon suit={m.suit} className="mode-card__watermark" />
            </span>
            <span className="mode-card__back" aria-hidden="true" />
          </span>
        </button>
      ))}
    </section>
  );
}
