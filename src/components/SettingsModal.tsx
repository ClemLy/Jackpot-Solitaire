import { Modal } from './Modal';
import { useMetaStore } from '../state/meta';
import { playSound, unlockAudio } from '../audio/sfx';
import { DifficultyPicker } from './ui';
import { haptic, hapticsSupported } from '../audio/haptics';
import { GUARANTEED_PAYOUT } from '../state/catalog';
import { formatMultiplier } from '../utils/format';

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

        {hapticsSupported() && (
          <Switch
            label="Vibrations"
            hint="Un petit retour sous les doigts: coup refusé, pile complète, victoire."
            value={settings.haptics}
            onChange={(v) => {
              update({ haptics: v });
              if (v) haptic('complete');
            }}
          />
        )}

        <Switch
          label="Animations réduites"
          hint="Coupe les vols de cartes et les effets, pour un rendu plus calme."
          value={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />

        <div className="setting setting--static setting--stack">
          <span className="setting__text">
            <span className="setting__label">Difficulté</span>
            <span className="setting__hint">
              S&rsquo;applique aux prochaines donnes. Plus c&rsquo;est dur, plus
              les victoires rapportent de jetons.
            </span>
          </span>
          <DifficultyPicker
            value={settings.difficulty}
            onChange={(difficulty) => update({ difficulty })}
          />
        </div>

        <Switch
          label="Donnes garanties gagnables"
          hint={`Le croupier ne sert que des donnes dont il a prouvé la victoire. Plus confortable, donc gains ×${formatMultiplier(GUARANTEED_PAYOUT)}. Hors défi du jour.`}
          value={settings.guaranteed}
          onChange={(v) => update({ guaranteed: v })}
        />

        <p className="fineprint">
          Réglages, statistiques, banque et achats restent stockés uniquement
          dans ce navigateur. Rien ne quitte ton appareil.
        </p>
      </div>
    </Modal>
  );
}
