// Complements a jsdom pour les tests d'interface: quelques API du navigateur
// que le jeu utilise (animations, mesure de taille) n'y existent pas.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
}

if (!window.matchMedia) {
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

if (!Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    return {
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      finish: () => {},
    } as unknown as Animation;
  };
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
