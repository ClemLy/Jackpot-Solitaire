import { useState, type CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from './Modal';
import { useGameStore } from '../state/game';
import { useMetaStore } from '../state/meta';
import { STAKE_TABLES, VIP_TIERS, meetsTier } from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatMultiplier, formatNumber } from '../utils/format';
import { Balance, Chip } from './ui';

const STACK_TONES = [
  ['black'],
  ['blue', 'blue'],
  ['red', 'red', 'gold'],
  ['black', 'violet', 'gold', 'gold'],
  ['violet', 'violet', 'black', 'gold', 'gold'],
  ['black', 'black', 'red', 'gold', 'gold', 'gold'],
] as const;

/** Choix de la table a mise avant une serie Jackpot. */
export function TablesModal({ onClose }: { onClose: () => void }) {
  const newGame = useGameStore((s) => s.newGame);
  const current = useGameStore((s) => s.stakeTable);
  const balance = useMetaStore((s) => s.wallet.balance);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const defaultDraw = useMetaStore((s) => s.settings.defaultDraw);
  const [draw, setDraw] = useState<1 | 3>(defaultDraw);

  return (
    <Modal
      title="Choisis ta table"
      onClose={onClose}
      size="lg"
      aside={<Balance className="balance--lg" />}
    >
      <p className="lead">
        Ta mise quitte la banque et entre dans le magot. Encaisse pour la
        récupérer avec tes gains, perds la série et elle s&rsquo;envole.
      </p>
      <div className="stake-grid">
        {STAKE_TABLES.map((t, i) => {
          const locked = !meetsTier(lifetime, t.minTier);
          const poor = !locked && t.stake > balance;
          const tierLabel = VIP_TIERS.find((v) => v.id === t.minTier)?.label;
          return (
            <button
              key={t.id}
              className="stake"
              data-table={t.id}
              data-last={current === t.id}
              disabled={locked || poor}
              onClick={() => {
                playSound('chip');
                newGame({ mode: 'gambling', table: t.id, drawCount: draw });
              }}
            >
              <span className="stake__stack" aria-hidden="true">
                {STACK_TONES[i].map((tone, n) => (
                  <Chip
                    key={n}
                    tone={tone}
                    size="100%"
                    className="stake__chip"
                    style={{ '--n': n } as CSSProperties}
                  />
                ))}
              </span>
              <span className="stake__name">{t.label}</span>
              <span className="stake__mult">
                Gains ×{formatMultiplier(t.multiplier)}
              </span>
              <span className="stake__pitch">{t.pitch}</span>
              <span className="stake__foot">
                {locked ? (
                  <>
                    <Lock size={14} /> Rang {tierLabel} requis
                  </>
                ) : t.stake === 0 ? (
                  'Sans mise'
                ) : (
                  <>
                    <Chip size={15} /> Mise {formatNumber(t.stake)}
                    {poor && (
                      <span className="stake__poor">
                        il manque {formatNumber(t.stake - balance)}
                      </span>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="row row--between">
        <span className="field-label">Difficulté de pioche</span>
        <div className="segmented" role="group" aria-label="Pioche">
          <button aria-pressed={draw === 1} onClick={() => setDraw(1)}>
            Pioche 1
          </button>
          <button aria-pressed={draw === 3} onClick={() => setDraw(3)}>
            Pioche 3
          </button>
        </div>
      </div>
    </Modal>
  );
}
