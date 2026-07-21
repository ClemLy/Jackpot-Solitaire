import { useEffect } from 'react';
import { useGameStore } from './state/game';
import { useMetaStore } from './state/meta';
import { unlockAudio } from './audio/sfx';
import { clearSeedFromUrl, readSeedFromUrl } from './utils/seed';
import { Home } from './components/Home';
import { Board } from './components/Board';
import { Hud } from './components/Hud';
import { WinOverlay } from './components/WinOverlay';
import { VaultOverlay } from './components/VaultOverlay';
import { VictoryBounce } from './components/VictoryBounce';
import { Toaster } from './components/Toaster';
import { RulesModal } from './components/RulesModal';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { ThemesModal } from './components/ThemesModal';
import { NewGameModal } from './components/NewGameModal';

function GameScreen() {
  return (
    <div className="game">
      <Hud />
      <Board />
    </div>
  );
}

export default function App() {
  const route = useGameStore((s) => s.route);
  const modal = useGameStore((s) => s.modal);
  const overlay = useGameStore((s) => s.overlay);
  const phase = useGameStore((s) => s.phase);
  const closeModal = useGameStore((s) => s.closeModal);
  const newGame = useGameStore((s) => s.newGame);

  const table = useMetaStore((s) => s.settings.table);
  const cardBack = useMetaStore((s) => s.settings.cardBack);
  const reducedMotion = useMetaStore((s) => s.settings.reducedMotion);

  // Deblocage de l'audio a la premiere interaction (contrainte des navigateurs mobiles).
  useEffect(() => {
    const handler = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handler);
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  // Une graine passee dans l'URL lance directement la donne correspondante.
  useEffect(() => {
    const seed = readSeedFromUrl();
    if (seed) {
      newGame({ mode: 'classic', seed });
      clearSeedFromUrl();
    }
    // On ne veut executer ceci qu'une seule fois au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="app"
      data-table={table}
      data-back={cardBack}
      data-motion={reducedMotion ? 'reduced' : 'full'}
    >
      {route === 'home' ? <Home /> : <GameScreen />}

      {phase === 'won' && <VictoryBounce />}
      {overlay === 'win' && <WinOverlay />}
      {overlay === 'vault' && <VaultOverlay />}

      {modal === 'rules' && <RulesModal onClose={closeModal} />}
      {modal === 'stats' && <StatsModal onClose={closeModal} />}
      {modal === 'settings' && <SettingsModal onClose={closeModal} />}
      {modal === 'themes' && <ThemesModal onClose={closeModal} />}
      {modal === 'newgame' && <NewGameModal onClose={closeModal} />}

      <Toaster />
    </div>
  );
}
