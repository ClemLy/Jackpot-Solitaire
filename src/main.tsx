import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/manrope';
import './styles/global.css';
import './styles/cards.css';
import './styles/board.css';
import './styles/ui.css';

// Marqueur de version, affiche dans la console au demarrage. Sert a verifier
// d'un coup d'oeil qu'on tourne bien sur le dernier code (et pas un ancien
// bundle servi par un serveur de dev ou un service worker perimes).
const BUILD_TAG =
  'jackpot-2026-10-build5 (refonte premium, banque et boutique)';
console.info(`Jackpot Solitaire: ${BUILD_TAG}`);

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

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
