import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { playSound, unlockAudio } from '../audio/sfx';

function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div>
        <strong>{label}</strong>
        {hint && <div className="muted">{hint}</div>}
      </div>
      <div className="segmented" role="group" aria-label={label}>
        <button aria-pressed={value} onClick={() => onChange(true)}>
          Oui
        </button>
        <button aria-pressed={!value} onClick={() => onChange(false)}>
          Non
        </button>
      </div>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useMetaStore((s) => s.settings);
  const update = useMetaStore((s) => s.updateSettings);

  return (
    <Modal title="Reglages" onClose={onClose}>
      <div className="stack">
        <Toggle
          label="Sons du jeu"
          value={settings.soundEnabled}
          hint="Bruitages faits main, synthetises a la volee."
          onChange={(v) => {
            update({ soundEnabled: v });
            if (v) {
              unlockAudio();
              playSound('button');
            }
          }}
        />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Volume</strong>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => settings.soundEnabled && playSound('coins')}
            style={{ width: '55%' }}
            aria-label="Volume des sons"
          />
        </div>

        <Toggle
          label="Animations reduites"
          value={settings.reducedMotion}
          hint="Pour un rendu plus calme, ou si le mouvement te gene."
          onChange={(v) => update({ reducedMotion: v })}
        />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Pioche par defaut</strong>
            <div className="muted">
              Pioche 1 est plus facile, Pioche 3 plus corsee.
            </div>
          </div>
          <div
            className="segmented"
            role="group"
            aria-label="Pioche par defaut"
          >
            <button
              aria-pressed={settings.defaultDraw === 1}
              onClick={() => update({ defaultDraw: 1 })}
            >
              Pioche 1
            </button>
            <button
              aria-pressed={settings.defaultDraw === 3}
              onClick={() => update({ defaultDraw: 3 })}
            >
              Pioche 3
            </button>
          </div>
        </div>

        <div className="callout">
          Tes reglages, tes statistiques et ta banque restent stockes uniquement
          dans ce navigateur.
        </div>
      </div>
    </Modal>
  );
}
