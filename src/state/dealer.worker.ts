// Travailleur en arriere-plan: cherche une donne gagnable sans figer
// l'interface pendant que le solveur tourne.

import { findWinnableSeed, type DealConfig } from '../engine';

self.onmessage = (
  event: MessageEvent<{ id: number; config: DealConfig; prefix: string }>,
) => {
  const { id, config, prefix } = event.data;
  let k = 0;
  const seed = findWinnableSeed(config, undefined, () => `${prefix}-${k++}`);
  self.postMessage({ id, seed });
};
