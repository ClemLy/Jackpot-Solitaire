// Repos: apres un moment sans la moindre activite, toutes les animations
// decoratives qui tournent en boucle (decors, reflets, effets de victoire)
// se mettent en pause. Un ecran fige ne coute plus rien a la carte
// graphique; au premier geste, tout repart la ou il s'etait arrete.

/** Delai d'inactivite avant le repos. */
export const IDLE_MS = 15_000;

const EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];

let idle = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let paused: Animation[] = [];
const listeners = new Set<(idle: boolean) => void>();

export function isIdle(): boolean {
  return idle;
}

/** Previent du passage au repos et du reveil. */
export function onIdleChange(cb: (idle: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function rest(): void {
  if (idle) return;
  idle = true;
  paused = document.getAnimations().filter((a) => {
    const timing = a.effect?.getTiming();
    return a.playState === 'running' && timing?.iterations === Infinity;
  });
  for (const a of paused) a.pause();
  document.documentElement.dataset.idle = 'true';
  for (const cb of listeners) cb(true);
}

function wake(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(rest, IDLE_MS);
  if (!idle) return;
  idle = false;
  for (const a of paused) {
    try {
      a.play();
    } catch {
      // Animation retiree du document entre-temps.
    }
  }
  paused = [];
  delete document.documentElement.dataset.idle;
  for (const cb of listeners) cb(false);
}

export function installIdlePause(): void {
  if (typeof window === 'undefined' || !document.getAnimations) return;
  for (const name of EVENTS) {
    window.addEventListener(name, wake, { passive: true, capture: true });
  }
  wake();
}
