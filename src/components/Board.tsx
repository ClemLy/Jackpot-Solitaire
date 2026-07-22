import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  movableRun,
  top,
  type Card,
  type Move,
} from '../engine';
import { useGameStore } from '../state/game';
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
}

const TAP_THRESHOLD = 7;

function parseDrop(el: Element | null): DropTarget | null {
  const holder = el?.closest('[data-drop]') as HTMLElement | null;
  if (!holder) return null;
  const raw = holder.dataset.drop;
  if (!raw) return null;
  const [kind, index] = raw.split(':');
  if (kind !== 'foundation' && kind !== 'tableau') return null;
  return { kind, index: Number(index) };
}

function RecycleIcon() {
  return (
    <svg className="stock-empty-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M12 20 A13 13 0 1 1 11 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M12 12 L12 21 L21 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Board() {
  const board = useGameStore((s) => s.board);
  const hint = useGameStore((s) => s.hint);
  const hintNonce = useGameStore((s) => s.hintNonce);
  const shake = useGameStore((s) => s.shake);
  const scoring = useGameStore((s) => s.mode !== 'zen');
  const phase = useGameStore((s) => s.phase);
  const autoCompleting = useGameStore((s) => s.autoCompleting);

  const clickStock = useGameStore((s) => s.clickStock);
  const autoFromWaste = useGameStore((s) => s.autoFromWaste);
  const autoFromTableau = useGameStore((s) => s.autoFromTableau);
  const applyDragMove = useGameStore((s) => s.applyDragMove);
  const reportInvalid = useGameStore((s) => s.reportInvalid);

  const [dragCards, setDragCards] = useState<Card[] | null>(null);
  const [drop, setDrop] = useState<{ target: DropTarget; ok: boolean } | null>(
    null,
  );
  const meta = useRef<DragMeta | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const positionGhost = useCallback((x: number, y: number) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${x}px, ${y}px) rotate(2deg)`;
    }
  }, []);

  // Anime les cartes qui volent vers leur fondation pendant l'autocompletion
  // (technique FLIP): on mesure la position de chaque carte avant et apres le
  // rendu, et on rejoue la difference sous forme de transition CSS. Sans ca,
  // une carte qui change de pile "teleporte" instantanement d'un container a
  // l'autre, ce qui rendait la fin de partie franchement peu satisfaisante.
  useLayoutEffect(() => {
    const root = boardRootRef.current;
    if (!root) return;
    const cardEls = root.querySelectorAll<HTMLElement>('[data-card-id]');
    const nextRects = new Map<string, DOMRect>();
    cardEls.forEach((el) => {
      const id = el.dataset.cardId;
      if (!id) return;
      const rect = el.getBoundingClientRect();
      nextRects.set(id, rect);
      if (!autoCompleting) return;
      const prev = prevRectsRef.current.get(id);
      if (!prev) return;
      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.32s ease';
        el.style.transform = '';
        // On retire la transition une fois jouee: sinon elle resterait
        // collee a l'element et animerait aussi les prochains changements
        // de transform hors autocompletion (pioche, glisser-deposer...).
        setTimeout(() => {
          el.style.transition = '';
        }, 340);
      });
    });
    prevRectsRef.current = nextRects;
  }, [board, autoCompleting]);

  const setGhostNode = useCallback(
    (node: HTMLDivElement | null) => {
      ghostRef.current = node;
      if (node && meta.current) {
        const m = meta.current;
        positionGhost(m.lastX - m.offX, m.lastY - m.offY);
      }
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
      return canPlaceOnTableau(head, top(board.tableau[target.index]));
    },
    [board],
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
      m.lastX = event.clientX;
      m.lastY = event.clientY;
      const dist = Math.hypot(
        event.clientX - m.startX,
        event.clientY - m.startY,
      );
      if (!m.moved && dist > TAP_THRESHOLD) m.moved = true;
      if (!m.moved || !m.draggable) return;
      if (!dragCards) setDragCards(m.cards);
      positionGhost(event.clientX - m.offX, event.clientY - m.offY);
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

  const finishDrag = useCallback(
    (event: ReactPointerEvent) => {
      const m = meta.current;
      meta.current = null;
      setDragCards(null);
      setDrop(null);
      if (!m) return;
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(m.pointerId);
      } catch {
        // ignore
      }
      if (!m.moved || !m.draggable) {
        handleTap(m.source);
        return;
      }
      const target = parseDrop(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      if (target) {
        const move = buildMove(m.source, m.cards, target);
        if (move && applyDragMove(move)) return;
      }
      reportInvalid(m.cards[0].id);
    },
    [applyDragMove, buildMove, handleTap, reportInvalid],
  );

  const onPointerCancel = useCallback(() => {
    meta.current = null;
    setDragCards(null);
    setDrop(null);
  }, []);

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
    const key = isShaking ? `${card.id}:${shake?.nonce}` : card.id;
    return (
      <CardView
        key={key}
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

  return (
    <div className="board" ref={boardRootRef}>
      <div className="board__row">
        {/* Pioche */}
        <div
          className={`pile${hintInfo?.stock ? ' is-hint' : ''}`}
          onClick={() => phase === 'playing' && clickStock()}
        >
          <div className="pile__slot">
            {board.stock.length === 0 && <RecycleIcon />}
          </div>
          {(() => {
            // On ne rend que les 3 dernieres cartes: au dela, l'empilement des
            // ombres de chaque carte finissait par deborder sur le talon voisin.
            const visibleCount = Math.min(3, board.stock.length);
            const start = board.stock.length - visibleCount;
            return board.stock.slice(start).map((card, i) => (
              <CardView
                key={card.id}
                card={card}
                style={{
                  top: 0,
                  zIndex: i,
                  transform: `translate(${i * 0.4}px, ${i * 0.4}px)`,
                }}
              />
            ));
          })()}
        </div>

        {/* Talon */}
        <div className="pile">
          <div className="pile__slot" />
          {(() => {
            const start = Math.max(0, board.waste.length - 3);
            const visible = board.waste.slice(start);
            return visible.map((card, i) => {
              const isTop = start + i === board.waste.length - 1;
              const style: CSSProperties = {
                top: 0,
                zIndex: i,
                transform: `translateX(calc(var(--card-w) * 0.24 * ${i}))`,
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
        {board.foundations.map((pile, f) => {
          const isTarget =
            hintInfo?.target?.kind === 'foundation' &&
            hintInfo.target.index === f;
          const dropHere =
            drop?.target.kind === 'foundation' && drop.target.index === f;
          return (
            <div
              key={`foundation-${f}`}
              className={`pile${isTarget && pile.length === 0 ? ' is-target' : ''}${dropHere ? (drop!.ok ? ' is-drop-ok' : '') : ''}`}
              data-drop={`foundation:${f}`}
            >
              <div className="pile__slot">
                {pile.length === 0 && (
                  <span
                    style={{ opacity: 0.5, fontFamily: 'var(--font-hand)' }}
                  >
                    A
                  </span>
                )}
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
          );
        })}
      </div>

      <div className="board__row board__tableau">
        {board.tableau.map((column, c) => {
          let downBefore = 0;
          let upBefore = 0;
          const positions = column.map((card, i) => {
            const style: CSSProperties = {
              top: `calc(var(--fan-down) * ${downBefore} + var(--fan-up) * ${upBefore})`,
              zIndex: i,
            };
            if (card.faceUp) upBefore += 1;
            else downBefore += 1;
            return style;
          });
          // Hauteur = offset de la derniere carte + une hauteur de carte, pour
          // que la zone de depot couvre toute la colonne deployee.
          const lastIsUp = column.length
            ? column[column.length - 1].faceUp
            : false;
          const dPrefix = Math.max(0, downBefore - (lastIsUp ? 0 : 1));
          const uPrefix = Math.max(0, upBefore - (lastIsUp ? 1 : 0));
          const height = `calc(var(--card-h) + var(--fan-down) * ${dPrefix} + var(--fan-up) * ${uPrefix})`;
          const isTarget =
            hintInfo?.target?.kind === 'tableau' && hintInfo.target.index === c;
          const dropHere =
            drop?.target.kind === 'tableau' && drop.target.index === c;
          return (
            <div
              key={`tableau-${c}`}
              className={`pile pile--column${isTarget && column.length === 0 ? ' is-target' : ''}${dropHere ? (drop!.ok ? ' is-drop-ok' : '') : ''}`}
              data-drop={`tableau:${c}`}
              style={{ height: column.length > 1 ? height : undefined }}
            >
              <div className="pile__slot" />
              {column.map((card, i) => {
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
