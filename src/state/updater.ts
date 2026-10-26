// Mises a jour de l'application installee (PWA). Le service worker garde la
// version precedente en cache: sans ceci, une nouvelle version ne s'affiche
// qu'au rechargement suivant. Des qu'elle est prete, on l'applique, mais
// jamais en pleine manche ni fenetre ouverte: on attend l'accueil.

import { registerSW } from 'virtual:pwa-register';
import { useGameStore } from './game';
import { useMetaStore } from './meta';

/** Toutes les 30 minutes, on demande au serveur s'il y a du neuf. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

function safeToReload(): boolean {
  const game = useGameStore.getState();
  const { session } = useMetaStore.getState();
  return (
    game.route === 'home' &&
    game.modal === 'none' &&
    game.overlay === 'none' &&
    !session.round &&
    session.pot === 0 &&
    session.awaiting === 'none'
  );
}

export function installUpdater(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  let ready = false;
  let applying = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      apply();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update();
      setInterval(check, CHECK_EVERY_MS);
      // Revenir sur l'onglet (ou rouvrir l'appli) cherche aussi du neuf.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
  function apply(): void {
    if (!ready || applying || !safeToReload()) return;
    applying = true;
    void updateSW(true);
  }
  useGameStore.subscribe(apply);
  useMetaStore.subscribe(apply);
}
