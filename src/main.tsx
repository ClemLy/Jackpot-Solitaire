import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary, NotFoundScreen } from './components/SystemScreen';
import { useGameStore } from './state/game';
import { useMetaStore } from './state/meta';
import { BUILD_TAG } from './utils/build';
import {
  createErrorReporter,
  installGlobalErrorHandlers,
} from './utils/errors';
import { isAppPath } from './utils/routes';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/manrope';
import './styles/global.css';
import './styles/cards.css';
import './styles/board.css';
import './styles/ui.css';

console.info(`Jackpot Solitaire: ${BUILD_TAG}`);

// Toute erreur imprevue hors affichage (minuteur, promesse...) est signalee
// au joueur par une notification, sans interrompre la partie.
installGlobalErrorHandlers(
  createErrorReporter((title, text) =>
    useMetaStore.getState().notify({ kind: 'error', title, text }),
  ),
);

// En developpement uniquement: on expose les stores pour piloter les captures
// d'ecran automatisees (voir scripts/screenshots.mjs).
if (import.meta.env.DEV) {
  void Promise.all([
    import('./state/game'),
    import('./state/meta'),
    import('./engine'),
  ]).then(([game, meta, engine]) => {
    (window as unknown as { __jackpot?: unknown }).__jackpot = {
      game: game.useGameStore,
      meta: meta.useMetaStore,
      engine,
    };
  });
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Element racine introuvable.');
}

/** Apres un plantage: retour a l'accueil dans un etat propre. */
function resetToHome(): void {
  try {
    useGameStore.getState().goHome();
  } catch {
    useGameStore.setState({
      route: 'home',
      modal: 'none',
      overlay: 'none',
      phase: 'idle',
      pendingAction: null,
    });
  }
}

const base = import.meta.env.BASE_URL;
const root = createRoot(rootEl);

if (!isAppPath(window.location.pathname, base)) {
  root.render(
    <NotFoundScreen path={window.location.pathname} homeHref={base} />,
  );
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary
        onReset={resetToHome}
        onError={(error) => console.error('[Jackpot Solitaire]', error)}
      >
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
