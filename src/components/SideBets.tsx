import { Check } from 'lucide-react';
import { betsOpen, useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { SIDE_BETS, type SideBetId } from '../state/catalog';
import { formatNumber } from '../utils/format';
import { Chip } from './ui';

/**
 * Paris annexes, poses sur le tapis avant le premier coup d'une manche
 * Jackpot. Le panneau disparait des que la partie commence: les paris sont
 * alors verrouilles et rappeles dans le magot du bandeau.
 */
export function SideBetsPanel() {
  const open = useGameStore(betsOpen);
  const bets = useGameStore((s) => s.sideBets);
  const stake = useGameStore((s) => s.sideBetStake);
  const toggle = useGameStore((s) => s.toggleSideBet);
  const balance = useMetaStore((s) => s.wallet.balance);

  if (!open) return null;

  return (
    <section className="side-bets" aria-label="Paris annexes">
      <header className="side-bets__head">
        <strong>Paris annexes</strong>
        <span>
          <Chip size={13} /> {formatNumber(stake)} par pari · avant ton premier
          coup
        </span>
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
              onClick={() => toggle(bet.id as SideBetId)}
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
  );
}
