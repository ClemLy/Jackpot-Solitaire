import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { CARD_BACKS, TABLES } from '../state/themes';
import { playSound } from '../audio/sfx';

const TABLE_PREVIEW: Record<string, string> = {
  felt: 'linear-gradient(160deg, #1f6b3b, #185831)',
  dark: 'linear-gradient(160deg, #23272e, #171a1f)',
  wood: 'linear-gradient(160deg, #7a4d2b, #5c3a20)',
  neon: 'linear-gradient(160deg, #241542, #150c29)',
};

export function ThemesModal({ onClose }: { onClose: () => void }) {
  const settings = useMetaStore((s) => s.settings);
  const update = useMetaStore((s) => s.updateSettings);

  return (
    <Modal title="Personnaliser" onClose={onClose}>
      <div className="stack">
        <h3 className="title" style={{ fontSize: '1.4rem' }}>
          Dos de cartes
        </h3>
        <div className="theme-grid">
          {CARD_BACKS.map((opt) => (
            <button
              key={opt.id}
              className="theme-opt"
              aria-pressed={settings.cardBack === opt.id}
              onClick={() => {
                update({ cardBack: opt.id });
                playSound('flip');
              }}
            >
              <span className="theme-swatch" data-back={opt.id}>
                <span className="card__back" />
              </span>
              <span className="t">{opt.label}</span>
              <span className="d">{opt.hint}</span>
            </button>
          ))}
        </div>

        <h3
          className="title"
          style={{ fontSize: '1.4rem', marginTop: '0.4rem' }}
        >
          Tapis de jeu
        </h3>
        <div className="theme-grid">
          {TABLES.map((opt) => (
            <button
              key={opt.id}
              className="theme-opt"
              aria-pressed={settings.table === opt.id}
              onClick={() => {
                update({ table: opt.id });
                playSound('button');
              }}
            >
              <span
                className="table-swatch"
                style={{ background: TABLE_PREVIEW[opt.id] }}
              />
              <span className="t">{opt.label}</span>
              <span className="d">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
