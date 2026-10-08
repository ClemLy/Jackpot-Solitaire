import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  canRecycle,
  movableRun,
  top,
  type Card,
  type Move,
} from '../engine';
import { useGameStore } from '../state/game';
import type { Board as BoardState } from '../engine';
import { useMetaStore } from '../state/meta';
import { playSound } from '../audio/sfx';
import { CardView } from './CardView';

type Source =
  | { kind: 'waste' }
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; column: number; index: number };

interface DropTarget {
  kind: 'foundation' | 'tableau';
  index: number;
}

interface DragMeta {
  source: Source;
  cards: Card[];
  draggable: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  moved: boolean;
  lastX: number;
  lastY: number;
  lastT: number;
  tilt: number;
}

const TAP_THRESHOLD = 7;

// Ecarts de l'eventail, en fraction de largeur de carte. Doivent rester
// alignes sur --fan-down et --fan-up dans board.css.
const FAN_DOWN = 0.17;
const FAN_UP = 0.34;
// Sur un ecran tres haut (telephone en portrait), l'eventail s'ouvre davantage.
const FAN_UP_TALL = 0.42;
// En dessous de ces ecarts, une carte ne se lit plus du tout.
const FAN_DOWN_MIN = 0.04;
const FAN_UP_MIN = 0.13;

/**
 * Ecarts d'une colonne (en fraction de largeur de carte) pour qu'elle tienne
 * dans la hauteur disponible. On tasse d'abord les cartes cachees, dont on ne
 * lit rien, et seulement ensuite les cartes visibles.
 */
function columnFan(
  down: number,
  up: number,
  area: { h: number; w: number } | null,
): { kd: number; ku: number; fits: boolean } {
  if (!area || area.w <= 0) return { kd: FAN_DOWN, ku: FAN_UP, fits: true };
  const baseUp = area.h > area.w * 8 ? FAN_UP_TALL : FAN_UP;
  const room = (area.h - area.w * 1.4 - 6) / area.w;
  if (down * FAN_DOWN + up * baseUp <= room) {
    return { kd: FAN_DOWN, ku: baseUp, fits: true };
  }
  if (down > 0 && down * FAN_DOWN_MIN + up * baseUp <= room) {
    return { kd: (room - up * baseUp) / down, ku: baseUp, fits: true };
  }
  const ideal = up > 0 ? (room - down * FAN_DOWN_MIN) / up : baseUp;
  const ku = Math.max(FAN_UP_MIN, Math.min(baseUp, ideal));
  return { kd: FAN_DOWN_MIN, ku, fits: ku <= ideal + 1e-6 };
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_LAND = 'cubic-bezier(0.25, 1.15, 0.5, 1)';

function parseDrop(el: Element | null): DropTarget | null {
  const holder = el?.closest('[data-drop]') as HTMLElement | null;
  if (!holder) return null;
  const raw = holder.dataset.drop;
  if (!raw) return null;
  const [kind, index] = raw.split(':');
  if (kind !== 'foundation' && kind !== 'tableau') return null;
  return { kind, index: Number(index) };
}

/** Vrai si la cible du lacher est la pile d'ou viennent les cartes. */
function isSamePile(source: Source, target: DropTarget): boolean {
  if (source.kind === 'tableau')
    return target.kind === 'tableau' && target.index === source.column;
  if (source.kind === 'foundation')
    return target.kind === 'foundation' && target.index === source.index;
  return false;
}

function prefersReducedMotion(): boolean {
  return (
    useMetaStore.getState().settings.reducedMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}

interface Pos {
  left: number;
  top: number;
}

/**
 * Position de mise en page d'une carte, sans tenir compte des animations en
 * cours (contrairement a getBoundingClientRect). Indispensable: sinon une
 * mesure prise en plein vol fausserait l'animation suivante.
 */
function layoutPos(el: HTMLElement, cache: Map<Element, DOMRect>): Pos {
  const parent = el.offsetParent;
  let base: DOMRect | undefined;
  if (parent) {
    base = cache.get(parent);
    if (!base) {
      base = parent.getBoundingClientRect();
      cache.set(parent, base);
    }
  }
  return {
    left: (base?.left ?? 0) + el.offsetLeft,
    top: (base?.top ?? 0) + el.offsetTop,
  };
}

/** Eleve une carte au premier plan le temps d'une animation, puis la repose. */
function liftDuring(el: HTMLElement, anim: Animation, z: number): void {
  const previous = el.style.zIndex;
  el.style.zIndex = String(z);
  const restore = () => {
    el.style.zIndex = previous;
  };
  anim.addEventListener('finish', restore);
  anim.addEventListener('cancel', restore);
}

/** Petit eclat dore pose sur une fondation qui vient de recevoir une carte. */
function spawnBurst(pile: Element, big: boolean): void {
  const burst = document.createElement('span');
  burst.className = big ? 'burst burst--big' : 'burst';
  for (let i = 0; i < (big ? 12 : 8); i++) {
    const spark = document.createElement('i');
    spark.style.setProperty('--a', `${(360 / (big ? 12 : 8)) * i}deg`);
    burst.appendChild(spark);
  }
  pile.appendChild(burst);
  setTimeout(() => burst.remove(), big ? 1100 : 760);
}

/** Distribution animee: chaque carte part de la pioche vers sa colonne. */
function animateDeal(
  root: HTMLElement,
  board: BoardState,
  stockEl: HTMLElement | null,
  cardEls: NodeListOf<HTMLElement>,
  positions: Map<string, Pos>,
): void {
  const stock = stockEl?.getBoundingClientRect();
  if (!stock) return;
  // Ordre de donne reel: rangee par rangee, de gauche a droite.
  const order = new Map<string, number>();
  let n = 0;
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) {
      const card = board.tableau[col][row];
      if (card) order.set(card.id, n++);
    }
  }
  const step = 34;
  cardEls.forEach((el) => {
    const id = el.dataset.cardId;
    if (!id) return;
    const idx = order.get(id);
    const pos = positions.get(id);
    if (idx === undefined || !pos) {
      // Cartes de la pioche: simple apparition.
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 260,
        easing: EASE_OUT,
      });
      return;
    }
    const dx = stock.left - pos.left;
    const dy = stock.top - pos.top;
    const delay = 120 + idx * step;
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(-4deg)` },
        { transform: 'none' },
      ],
      { duration: 420, delay, easing: EASE_OUT, fill: 'backwards' },
    );
    liftDuring(el, anim, 600 + idx);
    if (el.dataset.faceUp === 'true') {
      el.querySelector('.card__inner')?.animate(
        [
          { transform: 'rotateY(180deg)' },
          { transform: 'rotateY(180deg)', offset: 0.55 },
          { transform: 'rotateY(0deg)' },
        ],
        { duration: 640, delay, easing: EASE_OUT, fill: 'backwards' },
      );
    }
  });
  // Quelques froissements de cartes pendant la donne (pas un par carte:
  // ce serait une mitraillette).
  for (let i = 0; i < 28; i += 3) {
    setTimeout(() => playSound('deal'), 120 + i * step);
  }
  root.dataset.dealing = 'true';
  setTimeout(() => delete root.dataset.dealing, 120 + 28 * step + 420);
}

export function Board() {
  const board = useGameStore((s) => s.board);
  const hint = useGameStore((s) => s.hint);
  const hintNonce = useGameStore((s) => s.hintNonce);
  const shake = useGameStore((s) => s.shake);
  const scoring = useGameStore((s) => s.mode !== 'zen');
  const phase = useGameStore((s) => s.phase);
  const dealId = useGameStore((s) => s.dealId);

  const clickStock = useGameStore((s) => s.clickStock);
  const autoFromWaste = useGameStore((s) => s.autoFromWaste);
  const autoFromTableau = useGameStore((s) => s.autoFromTableau);
  const applyDragMove = useGameStore((s) => s.applyDragMove);
  const reportInvalid = useGameStore((s) => s.reportInvalid);
  const jokerArmed = useGameStore((s) => s.jokerArmed);
  const peekMode = useGameStore((s) => s.peekMode);
  const peekCard = useGameStore((s) => s.peekCard);
  const peekAt = useGameStore((s) => s.peekAt);

  const [dragCards, setDragCards] = useState<Card[] | null>(null);
  const [drop, setDrop] = useState<{ target: DropTarget; ok: boolean } | null>(
    null,
  );
  const [area, setArea] = useState<{ h: number; w: number } | null>(null);

  const meta = useRef<DragMeta | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tableauRef = useRef<HTMLDivElement | null>(null);
  const stockRef = useRef<HTMLDivElement | null>(null);

  // Memoire de la derniere mise en page, pour animer les ecarts (FLIP).
  const prevRects = useRef<Map<string, Pos>>(new Map());
  const prevFaceUp = useRef<Map<string, boolean>>(new Map());
  const overrideRects = useRef<Map<string, Pos>>(new Map());
  const seenNodes = useRef<WeakSet<Element>>(new WeakSet());
  const lastDealId = useRef<number>(-1);
  const prevFoundations = useRef<number[]>([0, 0, 0, 0]);

  // Mesure de la zone du tableau: sert a resserrer les colonnes trop longues
  // pour qu'elles tiennent toujours a l'ecran, sans barre de defilement.
  useEffect(() => {
    const el = tableauRef.current;
    if (!el) return;
    const measure = () => {
      const pile = el.querySelector('.pile');
      setArea({
        h: el.clientHeight,
        w: pile ? (pile as HTMLElement).offsetWidth : 0,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    const cardEls = root.querySelectorAll<HTMLElement>(
      '.board__piles [data-card-id]',
    );
    const dealing = lastDealId.current !== dealId;
    lastDealId.current = dealId;

    const nextRects = new Map<string, Pos>();
    const parentCache = new Map<Element, DOMRect>();
    const nextFace = new Map<string, boolean>();
    cardEls.forEach((el) => {
      const id = el.dataset.cardId;
      if (!id) return;
      nextRects.set(id, layoutPos(el, parentCache));
      nextFace.set(id, el.dataset.faceUp === 'true');
    });

    if (!reduced && dealing) {
      animateDeal(root, board, stockRef.current, cardEls, nextRects);
    } else if (!reduced) {
      cardEls.forEach((el) => {
        const id = el.dataset.cardId;
        if (!id) return;
        const rect = nextRects.get(id);
        const prev = overrideRects.current.get(id) ?? prevRects.current.get(id);
        const isNew = !seenNodes.current.has(el);
        const wasUp = prevFaceUp.current.get(id);
        const isUp = nextFace.get(id);
        if (rect && prev) {
          const dx = prev.left - rect.left;
          const dy = prev.top - rect.top;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            const distance = Math.hypot(dx, dy);
            const anim = el.animate(
              [
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: 'none' },
              ],
              {
                duration: Math.min(420, 200 + distance * 0.25),
                easing: overrideRects.current.has(id) ? EASE_LAND : EASE_OUT,
              },
            );
            liftDuring(el, anim, 500 + Number(el.style.zIndex || 0));
          }
        }
        // Une carte remontee ailleurs (pioche vers talon, talon vers pioche)
        // perd sa transition CSS de retournement: on la rejoue a la main.
        if (isNew && wasUp !== undefined && wasUp !== isUp) {
          const inner = el.querySelector('.card__inner');
          inner?.animate(
            [
              { transform: `rotateY(${isUp ? 180 : 0}deg)` },
              { transform: `rotateY(${isUp ? 0 : 180}deg)` },
            ],
            { duration: 300, easing: EASE_OUT },
          );
        }
      });
    }

    // Eclats dores sur les fondations qui viennent de grandir.
    board.foundations.forEach((pile, f) => {
      if (pile.length > prevFoundations.current[f] && !dealing && !reduced) {
        const el = root.querySelector(`[data-drop="foundation:${f}"]`);
        const big = pile.length === 13;
        // L'eclat attend que la carte ait atterri.
        setTimeout(() => {
          if (el) spawnBurst(el, big);
          if (big) playSound('complete');
        }, 230);
      }
    });
    prevFoundations.current = board.foundations.map((p) => p.length);

    cardEls.forEach((el) => seenNodes.current.add(el));
    prevRects.current = nextRects;
    prevFaceUp.current = nextFace;
    overrideRects.current.clear();
  }, [board, dragCards, dealId, area]);

  const positionGhost = useCallback((m: DragMeta) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${m.lastX - m.offX}px, ${m.lastY - m.offY}px) rotate(${m.tilt}deg) scale(1.05)`;
    }
  }, []);

  const setGhostNode = useCallback(
    (node: HTMLDivElement | null) => {
      ghostRef.current = node;
      if (node && meta.current) positionGhost(meta.current);
    },
    [positionGhost],
  );

  const validTarget = useCallback(
    (source: Source, cards: Card[], target: DropTarget): boolean => {
      const head = cards[0];
      if (target.kind === 'foundation') {
        if (cards.length !== 1) return false;
        return canPlaceOnFoundation(head, top(board.foundations[target.index]));
      }
      if (source.kind === 'tableau' && source.column === target.index)
        return false;
      // Joker arme: toutes les colonnes acceptent la carte.
      if (jokerArmed) return true;
      return canPlaceOnTableau(head, top(board.tableau[target.index]));
    },
    [board, jokerArmed],
  );

  const buildMove = useCallback(
    (source: Source, cards: Card[], target: DropTarget): Move | null => {
      if (target.kind === 'foundation') {
        if (source.kind === 'waste') {
          return { type: 'wasteToFoundation', foundation: target.index };
        }
        if (source.kind === 'tableau') {
          return {
            type: 'tableauToFoundation',
            column: source.column,
            foundation: target.index,
          };
        }
        return null;
      }
      if (source.kind === 'waste') {
        return { type: 'wasteToTableau', column: target.index };
      }
      if (source.kind === 'foundation') {
        return {
          type: 'foundationToTableau',
          foundation: source.index,
          column: target.index,
        };
      }
      return {
        type: 'tableauToTableau',
        from: source.column,
        to: target.index,
        count: cards.length,
      };
    },
    [],
  );

  const handleTap = useCallback(
    (source: Source) => {
      if (source.kind === 'waste') autoFromWaste();
      else if (source.kind === 'tableau')
        autoFromTableau(source.column, source.index);
    },
    [autoFromWaste, autoFromTableau],
  );

  const onPointerDown = useCallback(
    (
      event: ReactPointerEvent,
      source: Source,
      cards: Card[],
      draggable: boolean,
    ) => {
      if (phase !== 'playing') return;
      event.preventDefault();
      const el = event.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      meta.current = {
        source,
        cards,
        draggable,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offX: event.clientX - rect.left,
        offY: event.clientY - rect.top,
        moved: false,
        lastX: event.clientX,
        lastY: event.clientY,
        lastT: performance.now(),
        tilt: 0,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // Capture non supportee: on continue quand meme.
      }
    },
    [phase],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const m = meta.current;
      if (!m) return;
      const now = performance.now();
      const dt = Math.max(1, now - m.lastT);
      const vx = (event.clientX - m.lastX) / dt;
      m.lastX = event.clientX;
      m.lastY = event.clientY;
      m.lastT = now;
      // La pile penche dans le sens du mouvement, comme tenue en main.
      const targetTilt = Math.max(-9, Math.min(9, vx * 6));
      m.tilt = m.tilt * 0.75 + targetTilt * 0.25;
      const dist = Math.hypot(
        event.clientX - m.startX,
        event.clientY - m.startY,
      );
      if (!m.moved && dist > TAP_THRESHOLD) {
        m.moved = true;
        if (m.draggable) playSound('flip');
      }
      if (!m.moved || !m.draggable) return;
      if (!dragCards) setDragCards(m.cards);
      positionGhost(m);
      const target = parseDrop(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      if (!target) {
        if (drop) setDrop(null);
        return;
      }
      const ok = validTarget(m.source, m.cards, target);
      if (
        !drop ||
        drop.target.kind !== target.kind ||
        drop.target.index !== target.index ||
        drop.ok !== ok
      ) {
        setDrop({ target, ok });
      }
    },
    [dragCards, drop, positionGhost, validTarget],
  );

  /** Memorise la position de la pile fantome pour que les cartes en repartent. */
  const captureGhost = useCallback(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      const id = el.dataset.cardId;
      if (!id) return;
      const r = el.getBoundingClientRect();
      overrideRects.current.set(id, { left: r.left, top: r.top });
    });
  }, []);

  const finishDrag = useCallback(
    (event: ReactPointerEvent) => {
      const m = meta.current;
      meta.current = null;
      if (!m) {
        setDragCards(null);
        setDrop(null);
        return;
      }
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(m.pointerId);
      } catch {
        // ignore
      }
      if (!m.moved || !m.draggable) {
        setDragCards(null);
        setDrop(null);
        handleTap(m.source);
        return;
      }
      captureGhost();
      setDragCards(null);
      setDrop(null);
      const target = parseDrop(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      // Reposer les cartes la ou on les a prises n'est pas un coup rate:
      // on annule simplement le glisser, sans penalite.
      if (target && isSamePile(m.source, target)) return;
      if (target) {
        const move = buildMove(m.source, m.cards, target);
        if (move && applyDragMove(move)) return;
      }
      reportInvalid(m.cards[0].id);
    },
    [applyDragMove, buildMove, captureGhost, handleTap, reportInvalid],
  );

  const onPointerCancel = useCallback(() => {
    if (meta.current?.moved) captureGhost();
    meta.current = null;
    setDragCards(null);
    setDrop(null);
  }, [captureGhost]);

  const dragHandlers = {
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel,
  };

  // Description de l'indice: carte source a mettre en avant, pile cible.
  const hintInfo = useMemo(() => {
    if (!hint) return null;
    const info: {
      sourceId?: string;
      target?: DropTarget;
      targetCardId?: string;
      stock?: boolean;
    } = {};
    switch (hint.type) {
      case 'draw':
      case 'recycle':
        info.stock = true;
        break;
      case 'wasteToFoundation':
        info.sourceId = top(board.waste)?.id;
        info.target = { kind: 'foundation', index: hint.foundation };
        break;
      case 'wasteToTableau':
        info.sourceId = top(board.waste)?.id;
        info.target = { kind: 'tableau', index: hint.column };
        info.targetCardId = top(board.tableau[hint.column])?.id;
        break;
      case 'tableauToFoundation':
        info.sourceId = top(board.tableau[hint.column])?.id;
        info.target = { kind: 'foundation', index: hint.foundation };
        break;
      case 'foundationToTableau':
        info.sourceId = top(board.foundations[hint.foundation])?.id;
        info.target = { kind: 'tableau', index: hint.column };
        info.targetCardId = top(board.tableau[hint.column])?.id;
        break;
      case 'tableauToTableau': {
        const col = board.tableau[hint.from];
        info.sourceId = col[col.length - hint.count]?.id;
        info.target = { kind: 'tableau', index: hint.to };
        info.targetCardId = top(board.tableau[hint.to])?.id;
        break;
      }
    }
    return info;
    // hintNonce force le recalcul si le meme indice est redemande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint, hintNonce, board]);

  const shakeId = shake?.id ?? null;
  const penaltyText = scoring ? '-5' : undefined;

  const renderCard = (
    card: Card,
    source: Source,
    style: CSSProperties,
    opts: { draggable: boolean; playable: boolean; dragCards?: Card[] },
  ) => {
    const isShaking = shakeId === card.id;
    const isHidden = dragCards?.some((c) => c.id === card.id) ?? false;
    return (
      <CardView
        key={card.id}
        card={card}
        style={style}
        playable={opts.playable}
        dragging={isHidden}
        hint={hintInfo?.sourceId === card.id}
        hintTarget={hintInfo?.targetCardId === card.id}
        shaking={isShaking}
        floatText={isShaking ? penaltyText : undefined}
        {...dragHandlers}
        onPointerDown={
          opts.playable || opts.draggable
            ? (e) =>
                onPointerDown(
                  e,
                  source,
                  opts.dragCards ?? [card],
                  opts.draggable,
                )
            : undefined
        }
      />
    );
  };

  const pileClass = (base: string, target: DropTarget, empty: boolean) => {
    const isTarget =
      hintInfo?.target?.kind === target.kind &&
      hintInfo.target.index === target.index;
    const dropHere =
      drop?.target.kind === target.kind && drop.target.index === target.index;
    let cls = base;
    if (isTarget && empty) cls += ' is-target';
    if (dropHere) cls += drop!.ok ? ' is-drop-ok' : ' is-drop-bad';
    return cls;
  };

  const stockEmpty = board.stock.length === 0;
  // Vegas: une fois les passages epuises, la pioche ne se recharge plus.
  const stockSpent = stockEmpty && board.waste.length > 0 && !canRecycle(board);

  /** Ecarts d'une colonne selon le nombre de cartes cachees et visibles. */
  const fanFor = (column: Card[]) => {
    let dPrefix = 0;
    let uPrefix = 0;
    column.forEach((card, i) => {
      if (i === column.length - 1) return;
      if (card.faceUp) uPrefix += 1;
      else dPrefix += 1;
    });
    return { ...columnFan(dPrefix, uPrefix, area), dPrefix, uPrefix };
  };

  return (
    <div className="board" ref={rootRef} data-shake-nonce={shake?.nonce}>
      <div className="board__piles">
        <div className="board__row board__top">
          {/* Pioche */}
          <div
            ref={stockRef}
            className={`pile pile--stock${hintInfo?.stock ? ' is-hint' : ''}`}
            onClick={() => phase === 'playing' && clickStock()}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (phase === 'playing') clickStock();
            }}
            role="button"
            tabIndex={0}
            aria-label={
              stockSpent
                ? 'Pioche épuisée'
                : stockEmpty
                  ? 'Recharger la pioche'
                  : 'Piocher une carte'
            }
            data-spent={stockSpent ? 'true' : undefined}
          >
            <div className="pile__slot">
              {stockSpent ? (
                <Ban className="pile__mark-icon" strokeWidth={2.2} />
              ) : (
                stockEmpty &&
                board.waste.length > 0 && (
                  <RotateCcw className="pile__mark-icon" strokeWidth={2.2} />
                )
              )}
            </div>
            {(() => {
              // On ne rend que les 3 dernieres cartes: au dela, l'empilement
              // des ombres finissait par deborder sur le talon voisin.
              const visibleCount = Math.min(3, board.stock.length);
              const start = board.stock.length - visibleCount;
              return board.stock.slice(start).map((card, i) => (
                <CardView
                  key={card.id}
                  card={card}
                  style={{
                    top: -i * 0.8,
                    left: -i * 0.6,
                    zIndex: i,
                  }}
                />
              ));
            })()}
            {board.stock.length > 0 && (
              <span className="pile__count" aria-hidden="true">
                {board.stock.length}
              </span>
            )}
          </div>

          {/* Talon */}
          <div className="pile pile--waste">
            <div className="pile__slot pile__slot--quiet" />
            {(() => {
              const start = Math.max(0, board.waste.length - 3);
              const visible = board.waste.slice(start);
              return visible.map((card, i) => {
                const isTop = start + i === board.waste.length - 1;
                const style: CSSProperties = {
                  top: 0,
                  left: `calc(var(--card-w) * 0.26 * ${i})`,
                  zIndex: i,
                };
                return renderCard(card, { kind: 'waste' }, style, {
                  draggable: isTop,
                  playable: isTop,
                });
              });
            })()}
          </div>

          <div aria-hidden="true" />

          {/* Fondations */}
          {board.foundations.map((pile, f) => (
            <div
              key={`foundation-${f}`}
              className={pileClass(
                'pile pile--foundation',
                { kind: 'foundation', index: f },
                pile.length === 0,
              )}
              data-drop={`foundation:${f}`}
            >
              <div className="pile__slot">
                <span className="pile__mark">A</span>
              </div>
              {pile.map((card, i) =>
                renderCard(
                  card,
                  { kind: 'foundation', index: f },
                  { top: 0, zIndex: i },
                  { draggable: i === pile.length - 1, playable: false },
                ),
              )}
            </div>
          ))}
        </div>

        <div
          className={`board__row board__tableau${
            board.tableau.some((col) => !fanFor(col).fits)
              ? ' is-overflowing'
              : ''
          }`}
          ref={tableauRef}
        >
          {board.tableau.map((column, c) => {
            // Hauteur naturelle de la colonne, puis resserrement eventuel
            // pour tenir dans la zone visible.
            const { kd, ku, dPrefix, uPrefix } = fanFor(column);
            let downBefore = 0;
            let upBefore = 0;
            const positions = column.map((card, i) => {
              const style: CSSProperties = {
                top: `calc(var(--card-w) * ${(downBefore * kd + upBefore * ku).toFixed(4)})`,
                zIndex: i,
              };
              if (card.faceUp) upBefore += 1;
              else downBefore += 1;
              return style;
            });
            const height = `calc(var(--card-h) + var(--card-w) * ${(dPrefix * kd + uPrefix * ku).toFixed(4)})`;
            return (
              <div
                key={`tableau-${c}`}
                className={pileClass(
                  'pile pile--column',
                  { kind: 'tableau', index: c },
                  column.length === 0,
                )}
                data-drop={`tableau:${c}`}
                style={{ height: column.length > 1 ? height : undefined }}
              >
                <div className="pile__slot">
                  <span className="pile__mark">K</span>
                </div>
                {column.map((card, i) => {
                  if (!card.faceUp && (peekMode || peekCard === card.id)) {
                    // Coup d'oeil: les cartes cachees se touchent, et celle
                    // choisie se montre quelques secondes.
                    const peeking = peekCard === card.id;
                    return (
                      <CardView
                        key={card.id}
                        card={peeking ? { ...card, faceUp: true } : card}
                        style={positions[i]}
                        peekable={peekMode}
                        peeking={peeking}
                        onPointerDown={
                          peekMode
                            ? (e) => {
                                e.preventDefault();
                                peekAt(card.id);
                              }
                            : undefined
                        }
                      />
                    );
                  }
                  const run = card.faceUp ? movableRun(column, i) : null;
                  const draggable = run !== null;
                  return renderCard(
                    card,
                    { kind: 'tableau', column: c, index: i },
                    positions[i],
                    {
                      // Seule une carte qui demarre une sequence deplacable
                      // reagit au clic: une carte "cassee" au milieu d'une
                      // colonne ne doit jamais repondre au pointeur.
                      draggable,
                      playable: draggable,
                      dragCards: run ?? [card],
                    },
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {dragCards && (
        <div className="drag-layer">
          <div className="drag-ghost" ref={setGhostNode}>
            {dragCards.map((card, i) => (
              <CardView
                key={card.id}
                card={card}
                style={{ top: `calc(var(--fan-up) * ${i})`, zIndex: i }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
