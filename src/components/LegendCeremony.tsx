import { useEffect, useRef } from 'react';
import { RankEmblem } from './Rank';
import { BlackChip } from './ui';
import { useGameStore } from '../state/game';
import { playSound } from '../audio/sfx';
import { ASCENSION_GIFT } from '../state/legend';

/**
 * Ceremonie d'accession au rang Legendaire: un plein ecran, une fois dans la
 * vie du joueur. Elle annonce que tout recommence, et mene au Salon.
 */
export function LegendCeremony({ onClose }: { onClose: () => void }) {
  const openModal = useGameStore((s) => s.openModal);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    playSound('jackpot');
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="ascension"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ascension-title"
      tabIndex={-1}
      ref={ref}
    >
      <span className="ascension__rays" aria-hidden="true" />
      <span className="ascension__glow" aria-hidden="true" />
      <div className="ascension__body">
        <span className="ascension__emblem" aria-hidden="true">
          <RankEmblem tier="legend" level={1} size="100%" />
        </span>
        <p className="ascension__eyebrow">Rang débloqué</p>
        <h2 className="ascension__title" id="ascension-title">
          Légendaire
        </h2>
        <p className="ascension__line">
          Tout ce qui précède n&rsquo;était que le tutoriel.
        </p>
        <p className="ascension__text">
          Le Salon Légendaire t&rsquo;ouvre ses portes: des jetons noirs à
          chaque victoire, une boutique qui n&rsquo;existe nulle part ailleurs,
          et des niveaux sans fin. Légendaire I n&rsquo;est que le début.
        </p>
        <span className="ascension__gift">
          <BlackChip size={22} /> +{ASCENSION_GIFT} jetons noirs offerts
        </span>
        <div className="ascension__actions">
          <button
            className="btn btn--gold btn--lg"
            onClick={() => {
              onClose();
              openModal('legend');
            }}
          >
            Entrer dans le Salon
          </button>
          <button className="btn btn--quiet" onClick={onClose}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
