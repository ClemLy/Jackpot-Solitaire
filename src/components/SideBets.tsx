import { useEffect, useRef, useState } from 'react';
import { Check, ChevronUp, Dices, X } from 'lucide-react';
import { betsOpen, useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { SIDE_BETS } from '../state/catalog';
import { formatNumber } from '../utils/format';
import { Chip } from './ui';

/**
 * Paris annexes d'une manche Jackpot. Avant le premier coup, une simple
 * pastille au-dessus du dock les rappelle sans cacher le jeu; on la touche
 * pour ouvrir le panneau. Des la partie commencee, les paris sont verrouilles
 * et rappeles dans le magot du bandeau.
 */
export function SideBetsPanel() {
  const open = useGameStore(betsOpen);
  const bets = useGameStore((s) => s.sideBets);
  const stake = useGameStore((s) => s.sideBetStake);
  const toggle = useGameStore((s) => s.toggleSideBet);
  const balance = useMetaStore((s) => s.wallet.balance);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Le panneau se ferme au clic a l'exterieur (le joueur retourne au jeu)
  // ou avec Echap.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  if (!open) return null;

  const total = bets.length * stake;

  return (
    <div className="bets-dock" ref={ref}>
      {expanded && (
        <section
          className="side-bets"
          id="side-bets-panel"
          aria-label="Paris annexes"
        >
          <header className="side-bets__head">
            <span className="side-bets__title">
              <strong>Paris annexes</strong>
              <span>
                <Chip size={13} /> {formatNumber(stake)} par pari · avant ton
                premier coup
              </span>
            </span>
            <button
              className="side-bets__close"
              onClick={() => setExpanded(false)}
              aria-label="Fermer les paris annexes"
            >
              <X size={16} />
            </button>
          </header>
          <div className="side-bets__list" role="group">
            {SIDE_BETS.map((bet) => {
              const on = bets.includes(bet.id);
              const tooPoor = !on && balance < stake;
              return (
                <button
                  key={bet.id}
                  className="side-bet"
                  role="switch"
                  aria-checked={on}
                  disabled={tooPoor}
                  title={bet.rule}
                  onClick={() => toggle(bet.id)}
                >
                  <span className="side-bet__check" aria-hidden="true">
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="side-bet__label">{bet.label}</span>
                  <span className="side-bet__odds">
                    paie {formatNumber(stake * (bet.odds + 1))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <button
        className="bets-pill"
        data-active={bets.length > 0 ? 'true' : undefined}
        aria-expanded={expanded}
        aria-controls="side-bets-panel"
        onClick={() => setExpanded((v) => !v)}
      >
        {bets.length > 0 ? <Check size={15} /> : <Dices size={15} />}
        <span>
          {bets.length > 0
            ? `${bets.length} pari${bets.length > 1 ? 's' : ''} · ${formatNumber(total)}`
            : 'Paris annexes'}
        </span>
        <ChevronUp size={15} className="bets-pill__chevron" />
      </button>
    </div>
  );
}
