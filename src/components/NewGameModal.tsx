import { useState } from 'react';
import { Check, Dice5, Link as LinkIcon } from 'lucide-react';
import { Modal } from './Modal';
import { useGameStore, MODE_LABEL, type GameMode } from '../state/game';
import { useMetaStore } from '../state/meta';
import {
  CHRONO_LIMIT_MS,
  STAKE_TABLES,
  VEGAS_STAKE,
  findDifficulty,
  meetsTier,
  vegasCardValue,
  vegasRecycles,
  type DifficultyId,
  type StakeTableId,
} from '../state/catalog';
import {
  SEED_MAX_LENGTH,
  dailySeed,
  randomSeed,
  shareUrl,
} from '../utils/seed';
import { formatNumber } from '../utils/format';
import { Chip, DifficultyPicker } from './ui';

const MODES: GameMode[] = [
  'classic',
  'gambling',
  'daily',
  'chrono',
  'vegas',
  'zen',
];

export function NewGameModal({ onClose }: { onClose: () => void }) {
  const current = useGameStore((s) => ({
    mode: s.mode,
    difficulty: s.difficulty,
    seed: s.seed,
    table: s.stakeTable,
  }));
  const newGame = useGameStore((s) => s.newGame);
  const requestLeave = useGameStore((s) => s.requestLeave);
  const balance = useMetaStore((s) => s.wallet.balance);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);

  const [mode, setMode] = useState<GameMode>(current.mode);
  const [difficulty, setDifficulty] = useState<DifficultyId>(
    current.difficulty,
  );
  const [table, setTable] = useState<StakeTableId>(current.table);
  const [seed, setSeed] = useState(current.seed);
  const [copied, setCopied] = useState(false);

  const isDaily = mode === 'daily';
  const effectiveSeed = isDaily ? dailySeed() : seed;

  const start = () => {
    requestLeave(() => {
      newGame({ mode, difficulty, seed: effectiveSeed, table });
      onClose();
    });
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
          <button
            className="btn btn--gold"
            onClick={start}
            disabled={mode === 'vegas' && balance < VEGAS_STAKE}
          >
            Lancer la partie
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field-block">
          <span className="field-label">Mode</span>
          <div className="pills" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {mode === 'gambling' && (
          <div className="field-block">
            <span className="field-label">Table</span>
            <div className="pills" role="radiogroup" aria-label="Table">
              {STAKE_TABLES.map((t) => {
                const off =
                  t.stake > balance || !meetsTier(lifetime, t.minTier);
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={table === t.id}
                    disabled={off}
                    onClick={() => setTable(t.id)}
                  >
                    {t.label}
                    {t.stake > 0 && <small> · {formatNumber(t.stake)}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'vegas' && (
          <p className="mode-note">
            <Chip size={14} /> La donne coûte {VEGAS_STAKE} jetons, chaque carte
            rangée en rapporte {vegasCardValue(difficulty)}.{' '}
            {vegasRecycles(findDifficulty(difficulty).drawCount) === 0
              ? 'Un seul passage dans la pioche'
              : `${vegasRecycles(findDifficulty(difficulty).drawCount) + 1} passages dans la pioche`}
            , pas d&rsquo;annulation.
            {balance < VEGAS_STAKE && (
              <strong> Il te manque {VEGAS_STAKE - balance} jetons.</strong>
            )}
          </p>
        )}
        {mode === 'chrono' && (
          <p className="mode-note">
            {CHRONO_LIMIT_MS / 60000} minutes pour tout ranger, à partir du
            premier coup. Chaque seconde restante rapporte des points.
          </p>
        )}

        <div className="field-block">
          <span className="field-label">Difficulté</span>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        </div>

        <div className="field-block">
          <span className="field-label">Graine de partie</span>
          <span className="field-hint">
            {isDaily
              ? 'Le défi du jour utilise une graine imposée, la même pour tout le monde.'
              : 'Note ou colle une graine pour rejouer une donne précise.'}
          </span>
          <div className="field">
            <input
              value={effectiveSeed}
              disabled={isDaily}
              onChange={(e) => setSeed(e.target.value)}
              maxLength={SEED_MAX_LENGTH}
              aria-label="Graine de partie"
              spellCheck={false}
              autoComplete="off"
            />
            {!isDaily && (
              <button
                className="btn btn--ghost btn--icon"
                onClick={() => setSeed(randomSeed())}
                aria-label="Graine au hasard"
                title="Au hasard"
              >
                <Dice5 size={18} />
              </button>
            )}
            <button
              className="btn btn--ghost btn--icon"
              onClick={copyLink}
              aria-label="Copier le lien à partager"
              title="Copier le lien"
            >
              {copied ? <Check size={18} /> : <LinkIcon size={18} />}
            </button>
          </div>
          {copied && <span className="field-hint">Lien copié.</span>}
        </div>
      </div>
    </Modal>
  );
}
