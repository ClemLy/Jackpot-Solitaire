// Vibrations sur mobile (Vibration API). Discretes et reservees aux moments
// qui comptent: un coup refuse, une pile completee, une victoire, une perte.
// Les appareils qui ne vibrent pas (iPhone, ordinateurs) sont simplement
// ignores.

const PATTERNS: Partial<Record<string, number | number[]>> = {
  invalid: 30,
  complete: [20, 40, 20],
  stamp: 15,
  purchase: [15, 40, 30],
  win: [40, 60, 40, 60, 140],
  jackpot: [50, 40, 50, 40, 50, 40, 220],
  lose: [160],
  bust: [70, 50, 180],
  penalty: [60, 40, 60],
  vault: 90,
};

let enabled = true;

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/** Fait vibrer l'appareil pour un evenement, s'il a un motif associe. */
export function haptic(event: string): void {
  if (!enabled || !hapticsSupported()) return;
  const pattern = PATTERNS[event];
  if (pattern === undefined) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Certains navigateurs refusent sans geste recent: sans importance.
  }
}
