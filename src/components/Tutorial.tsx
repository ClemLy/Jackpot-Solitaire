import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from 'react';
import { useGameStore } from '../state/game';

interface Step {
  /** Element a mettre en lumiere (selecteur CSS), ou rien: bulle centree. */
  target?: string;
  title: string;
  text: string;
  /** Etape qui attend une action du joueur au lieu d'un bouton "Suivant". */
  waitFor?: 'move' | 'draw';
}

const STEPS: Step[] = [
  {
    target: '.pile--foundation',
    title: 'Le but du jeu',
    text: 'Range les 52 cartes sur ces quatre piles, une par enseigne, de l’As jusqu’au Roi.',
  },
  {
    target: '.pile--column [data-card-id]',
    title: 'Les colonnes',
    text: 'On y empile les cartes en descendant, en alternant rouge et noir. Chaque carte cachée retournée ouvre le jeu.',
  },
  {
    target: '.pile--column [data-card-id]',
    title: 'À toi de jouer',
    text: 'Touche une carte visible: elle part toute seule vers la meilleure place. Tu peux aussi la faire glisser.',
    waitFor: 'move',
  },
  {
    target: '.pile--stock',
    title: 'La pioche',
    text: 'Plus de coup ? Touche la pioche pour retourner de nouvelles cartes.',
    waitFor: 'draw',
  },
  {
    target: '.dock',
    title: 'Tes alliés',
    text: 'Indice montre un coup possible, Annuler revient en arrière, et les Jokers te sortent des mauvais pas.',
  },
  {
    title: 'Et le Jackpot ?',
    text: 'Chaque victoire au Jackpot grossit ton magot. Encaisse pour le mettre à l’abri… ou tente le quitte ou double. Bonne partie !',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Rectangle englobant tous les elements vises (ex. les quatre fondations). */
function measure(selector?: string): Rect | null {
  if (!selector) return null;
  const els = Array.from(document.querySelectorAll(selector));
  if (els.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  const pad = 8;
  return {
    top: top - pad,
    left: left - pad,
    width: right - left + pad * 2,
    height: bottom - top + pad * 2,
  };
}

/** Hauteur reservee a la bulle pour choisir ou la poser. */
const BUBBLE_ROOM = 210;

/**
 * Place la bulle la ou il y a de la place: sous la zone, sinon au-dessus,
 * sinon en bas de l'ecran, au-dessus du dock.
 */
function bubbleStyle(rect: Rect | null): {
  place: 'below' | 'above' | 'center' | 'bottom';
  style?: CSSProperties;
} {
  if (!rect) return { place: 'center' };
  const below = window.innerHeight - (rect.top + rect.height) - 14;
  if (below >= BUBBLE_ROOM) {
    return { place: 'below', style: { top: rect.top + rect.height + 14 } };
  }
  if (rect.top - 14 >= BUBBLE_ROOM) {
    return {
      place: 'above',
      style: { bottom: window.innerHeight - rect.top + 14 },
    };
  }
  return { place: 'bottom', style: { bottom: 100 } };
}

/**
 * Partie guidee: un projecteur sur la zone expliquee et une bulle de texte.
 * Le plateau reste jouable dessous, pour les etapes qui demandent d'agir.
 */
export function Tutorial() {
  const active = useGameStore((s) => s.tutorial);
  const moves = useGameStore((s) => s.moves);
  const waste = useGameStore((s) => s.board.waste.length);
  const endTutorial = useGameStore((s) => s.endTutorial);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [baseline, setBaseline] = useState({ moves: 0, waste: 0 });

  const step = STEPS[index];

  function next() {
    if (index >= STEPS.length - 1) {
      endTutorial();
      return;
    }
    setBaseline({
      moves: useGameStore.getState().moves,
      waste: useGameStore.getState().board.waste.length,
    });
    setIndex((i) => i + 1);
  }

  // Le projecteur suit la zone, meme quand la fenetre change de taille.
  useLayoutEffect(() => {
    if (!active) return;
    const update = () => setRect(measure(step.target));
    update();
    // La donne s'anime pendant un instant: on remesure ensuite.
    const late = setTimeout(update, 1300);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(late);
      window.removeEventListener('resize', update);
    };
  }, [active, step]);

  // Etapes d'action: on avance des que le joueur a fait ce qui est demande.
  useEffect(() => {
    if (!active || !step.waitFor) return;
    if (step.waitFor === 'move' && moves > baseline.moves) next();
    if (step.waitFor === 'draw' && waste > baseline.waste) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, waste, active, step]);

  useEffect(() => {
    if (active) {
      setIndex(0);
      setBaseline({ moves: 0, waste: 0 });
    }
  }, [active]);

  if (!active) return null;

  const bubble = bubbleStyle(rect);

  return (
    <div className="tuto" aria-live="polite">
      {rect ? (
        <div
          className="tuto__spot"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          data-wait={step.waitFor ? 'true' : undefined}
        />
      ) : (
        <div className="tuto__veil" />
      )}
      <div
        className="tuto__bubble"
        data-place={bubble.place}
        style={bubble.style}
        role="dialog"
        aria-label={step.title}
      >
        <span className="tuto__step">
          Étape {index + 1} sur {STEPS.length}
        </span>
        <strong className="tuto__title">{step.title}</strong>
        <p className="tuto__text">{step.text}</p>
        <div className="tuto__actions">
          <button className="btn btn--quiet" onClick={endTutorial}>
            Passer le tutoriel
          </button>
          {step.waitFor ? (
            <span className="tuto__waiting">
              {step.waitFor === 'move'
                ? 'Joue une carte…'
                : 'Touche la pioche…'}
            </span>
          ) : (
            <button className="btn btn--gold" onClick={next}>
              {index === STEPS.length - 1 ? 'C’est parti' : 'Suivant'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
