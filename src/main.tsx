import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/global.css';
import './styles/cards.css';
import './styles/board.css';
import './styles/ui.css';

// En developpement uniquement: on expose les stores pour piloter les captures
// d'ecran automatisees (voir scripts/screenshots.mjs).
if (import.meta.env.DEV) {
  void Promise.all([import('./state/game'), import('./state/meta')]).then(
    ([game, meta]) => {
      (window as unknown as { __jackpot?: unknown }).__jackpot = {
        game: game.useGameStore,
        meta: meta.useMetaStore,
      };
    },
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Element racine introuvable.');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
