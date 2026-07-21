import { useState } from 'react';
import { Modal } from './Modal';
import { useGameStore, type GameMode } from '../state/game';
import { useMetaStore } from '../state/meta';
import { dailySeed, randomSeed, shareUrl } from '../utils/seed';

const MODES: { id: GameMode; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'gambling', label: 'Jackpot' },
  { id: 'daily', label: 'Defi du jour' },
  { id: 'chrono', label: 'Chrono' },
  { id: 'zen', label: 'Zen' },
];

export function NewGameModal({ onClose }: { onClose: () => void }) {
  const current = useGameStore((s) => ({
    mode: s.mode,
    drawCount: s.drawCount,
    seed: s.seed,
  }));
  const newGame = useGameStore((s) => s.newGame);
  const defaultDraw = useMetaStore((s) => s.settings.defaultDraw);

  const [mode, setMode] = useState<GameMode>(current.mode);
  const [drawCount, setDrawCount] = useState<1 | 3>(
    current.drawCount ?? defaultDraw,
  );
  const [seed, setSeed] = useState(current.seed);
  const [copied, setCopied] = useState(false);

  const isDaily = mode === 'daily';
  const effectiveSeed = isDaily ? dailySeed() : seed;

  const start = () => {
    newGame({ mode, drawCount, seed: effectiveSeed });
    onClose();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(effectiveSeed));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      title="Options de partie"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn--green" onClick={start}>
            Lancer la partie
          </button>
        </>
      }
    >
      <div className="stack">
        <div>
          <strong>Mode</strong>
          <div className="rules-nav" style={{ marginTop: '0.4rem' }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                aria-selected={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Difficulte de pioche</strong>
          <div className="segmented" role="group" aria-label="Pioche">
            <button
              aria-pressed={drawCount === 1}
              onClick={() => setDrawCount(1)}
            >
              Pioche 1
            </button>
            <button
              aria-pressed={drawCount === 3}
              onClick={() => setDrawCount(3)}
            >
              Pioche 3
            </button>
          </div>
        </div>

        <div>
          <strong>Graine de partie</strong>
          <div className="muted">
            {isDaily
              ? 'Le defi du jour utilise une graine imposee, la meme pour tout le monde.'
              : 'Note ou colle une graine pour rejouer une donne precise.'}
          </div>
          <div className="field" style={{ marginTop: '0.4rem' }}>
            <input
              value={effectiveSeed}
              disabled={isDaily}
              onChange={(e) => setSeed(e.target.value)}
              aria-label="Graine de partie"
            />
            {!isDaily && (
              <button className="btn" onClick={() => setSeed(randomSeed())}>
                Au hasard
              </button>
            )}
          </div>
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <button className="btn btn--ghost" onClick={copyLink}>
              {copied ? 'Lien copie' : 'Copier le lien a partager'}
            </button>
          </div>
        </div>

        <div className="callout">
          Le mode Jackpot demarre une nouvelle serie: ton magot repart de zero,
          a toi de le faire gonfler.
        </div>
      </div>
    </Modal>
  );
}
