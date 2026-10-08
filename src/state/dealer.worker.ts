// Travailleur en arriere-plan: cherche une donne gagnable sans figer
// l'interface pendant que le solveur tourne.

import { findWinnableSeed, type DealConfig } from '../engine';

self.onmessage = (event: MessageEvent<{ id: number; config: DealConfig }>) => {
  const { id, config } = event.data;
  const seed = findWinnableSeed(config);
  self.postMessage({ id, seed });
};
