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
import { MissionsModal } from './components/MissionsModal';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { FriendsModal } from './components/FriendsModal';
import { restoreSession } from './state/account';
import { JokerBanner } from './components/Jokers';
import { SideBetsPanel } from './components/SideBets';
import { Tutorial } from './components/Tutorial';
import { Stage } from './components/Modal';
import { Chip } from './components/ui';
import { findDifficulty } from './state/catalog';
import { prepareWinnableDeal } from './state/dealer';

function GameScreen() {
  return (
    <div className="game">
      <Hud />
      <JokerBanner />
      <Board />
      <SideBetsPanel />
      <Dock />
    </div>
  );
}

/** Attente pendant que le croupier cherche une donne prouvee gagnable. */
function PreparingOverlay() {
  return (
    <Stage label="Préparation de la donne">
      <span className="preparing__chip" aria-hidden="true">
        <Chip size="100%" />
      </span>
      <p className="stage__eyebrow">Donne garantie</p>
      <h2 className="stage__title">Le croupier vérifie la donne</h2>
      <p className="stage__text">
        Il ne sert que des parties dont il a prouvé qu&rsquo;elles se gagnent.
      </p>
    </Stage>
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
  const preparing = useGameStore((s) => s.preparing);
  const guaranteed = useMetaStore((s) => s.settings.guaranteed);
  const difficulty = useMetaStore((s) => s.settings.difficulty);

  const nonce = useMetaStore((s) => s.session.nonce);
  const table = useMetaStore((s) => s.equipped.table);
  const cardBack = useMetaStore((s) => s.equipped.cardBack);
  const cardFace = useMetaStore((s) => s.equipped.cardFace);
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

  // Recharger ou fermer l'onglet en pleine serie Jackpot ferait perdre le
  // magot sans le moindre avertissement: le navigateur demande confirmation.
  const potAtRisk = useGameStore((s) => s.mode === 'gambling' && s.pot > 0);
  useEffect(() => {
    if (!potAtRisk) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Requis par les navigateurs plus anciens pour afficher la question.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [potAtRisk]);

  // Donnes garanties: la prochaine est preparee a l'avance, en arriere-plan.
  useEffect(() => {
    if (!guaranteed) return;
    const { drawCount, gentle } = findDifficulty(difficulty);
    prepareWinnableDeal({ drawCount, gentle }, nonce);
  }, [guaranteed, difficulty, nonce]);

  // Un compte deja connecte sur cet appareil reprend sa sauvegarde serveur.
  useEffect(() => {
    void restoreSession();
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
      data-face={cardFace}
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
      {modal === 'missions' && <MissionsModal onClose={closeModal} />}
      {modal === 'account' && <AuthModal onClose={closeModal} />}
      {modal === 'profile' && <ProfileModal onClose={closeModal} />}
      {modal === 'friends' && <FriendsModal onClose={closeModal} />}
      {modal === 'confirmLeave' && <ConfirmLeaveModal />}
      {preparing && <PreparingOverlay />}
      {route === 'game' && <Tutorial />}

      <Toaster />
    </div>
  );
}
