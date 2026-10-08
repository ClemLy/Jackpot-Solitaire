// Complements a jsdom pour les tests d'interface: quelques API du navigateur
// que le jeu utilise (animations, mesure de taille) n'y existent pas.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Les tests d'integration du serveur tournent sous Node, sans navigateur.
const browser = typeof window !== 'undefined';

afterEach(() => {
  if (browser) cleanup();
});

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
}

if (browser && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (browser && !Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    return {
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      finish: () => {},
    } as unknown as Animation;
  };
}

if (browser && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
