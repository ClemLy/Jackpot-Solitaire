import { useEffect } from 'react';
import { useGameStore } from './state/game';
import { useMetaStore } from './state/meta';
import { unlockAudio } from './audio/sfx';
import { clearSeedFromUrl, readSeedFromUrl } from './utils/seed';
import { Home } from './components/Home';
import { Board } from './components/Board';
import { Hud, Dock } from './components/Hud';
import { WinOverlay } from './components/WinOverlay';
import { VaultOverlay } from './components/VaultOverlay';
import { LostOverlay } from './components/LostOverlay';
import { VictoryLayer } from './components/VictoryLayer';
import { Toaster } from './components/Toaster';
import { RulesModal } from './components/RulesModal';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopModal } from './components/ShopModal';
import { TablesModal } from './components/TablesModal';
import { WheelModal } from './components/WheelModal';
import { NewGameModal } from './components/NewGameModal';
import { ConfirmLeaveModal } from './components/ConfirmLeaveModal';
import { SuitSprite } from './components/Suits';

function GameScreen() {
  return (
    <div className="game">
      <Hud />
      <Board />
      <Dock />
    </div>
  );
}

export default function App() {
  const route = useGameStore((s) => s.route);
  const modal = useGameStore((s) => s.modal);
  const overlay = useGameStore((s) => s.overlay);
  const phase = useGameStore((s) => s.phase);
  const dealId = useGameStore((s) => s.dealId);
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
      className="app felt"
      data-table={table}
      data-back={cardBack}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-route={route}
    >
      <SuitSprite />
      {route === 'home' ? <Home /> : <GameScreen />}

      {phase === 'won' && <VictoryLayer key={dealId} />}
      {overlay === 'win' && <WinOverlay />}
      {overlay === 'vault' && <VaultOverlay />}
      {overlay === 'lost' && <LostOverlay />}

      {modal === 'rules' && <RulesModal onClose={closeModal} />}
      {modal === 'stats' && <StatsModal onClose={closeModal} />}
      {modal === 'settings' && <SettingsModal onClose={closeModal} />}
      {modal === 'shop' && <ShopModal onClose={closeModal} />}
      {modal === 'tables' && <TablesModal onClose={closeModal} />}
      {modal === 'wheel' && <WheelModal onClose={closeModal} />}
      {modal === 'newgame' && <NewGameModal onClose={closeModal} />}
      {modal === 'confirmLeave' && <ConfirmLeaveModal />}

      <Toaster />
    </div>
  );
}
