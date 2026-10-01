import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { playSound, unlockAudio } from '../audio/sfx';

function Switch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="setting"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span className="setting__text">
        <span className="setting__label">{label}</span>
        {hint && <span className="setting__hint">{hint}</span>}
      </span>
      <span className="switch" data-on={value} aria-hidden="true" />
    </button>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useMetaStore((s) => s.settings);
  const update = useMetaStore((s) => s.updateSettings);

  return (
    <Modal title="Réglages" onClose={onClose}>
      <div className="settings">
        <Switch
          label="Sons du jeu"
          hint="Bruitages synthétisés à la volée, sans aucun fichier audio."
          value={settings.soundEnabled}
          onChange={(v) => {
            update({ soundEnabled: v });
            if (v) {
              unlockAudio();
              playSound('chip');
            }
          }}
        />

        <label className="setting setting--static">
          <span className="setting__text">
            <span className="setting__label">Volume</span>
            <span className="setting__hint">
              {Math.round(settings.volume * 100)} %
            </span>
          </span>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            disabled={!settings.soundEnabled}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => settings.soundEnabled && playSound('coins')}
            aria-label="Volume des sons"
          />
        </label>

        <Switch
          label="Animations réduites"
          hint="Coupe les vols de cartes et les effets, pour un rendu plus calme."
          value={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />

        <div className="setting setting--static">
          <span className="setting__text">
            <span className="setting__label">Pioche par défaut</span>
            <span className="setting__hint">
              Pioche 1 est plus facile, Pioche 3 plus corsée.
            </span>
          </span>
          <div
            className="segmented"
            role="group"
            aria-label="Pioche par défaut"
          >
            <button
              aria-pressed={settings.defaultDraw === 1}
              onClick={() => update({ defaultDraw: 1 })}
            >
              1 carte
            </button>
            <button
              aria-pressed={settings.defaultDraw === 3}
              onClick={() => update({ defaultDraw: 3 })}
            >
              3 cartes
            </button>
          </div>
        </div>

        <p className="fineprint">
          Réglages, statistiques, banque et achats restent stockés uniquement
          dans ce navigateur. Rien ne quitte ton appareil.
        </p>
      </div>
    </Modal>
  );
}
