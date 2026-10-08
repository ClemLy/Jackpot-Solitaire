// Fournisseur de donnes garanties gagnables.
//
// La recherche tourne dans un Web Worker pour ne jamais bloquer l'ecran, et
// la donne suivante est preparee a l'avance: en general, elle est prete
// avant meme que le joueur en ait besoin.

import { findWinnableSeed, type DealConfig } from '../engine';

type Pending = Promise<string | null>;

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const waiting = new Map<number, (seed: string | null) => void>();
const prepared = new Map<string, Pending>();

function keyOf(config: DealConfig): string {
  return `${config.drawCount}-${config.gentle}-${config.recycles ?? 'inf'}`;
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./dealer.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (
        event: MessageEvent<{ id: number; seed: string | null }>,
      ) => {
        waiting.get(event.data.id)?.(event.data.seed);
        waiting.delete(event.data.id);
      };
      worker.onerror = () => {
        // Travailleur indisponible: on bascule sur la recherche directe.
        workerBroken = true;
        worker = null;
        for (const resolve of waiting.values()) resolve(null);
        waiting.clear();
      };
    } catch {
      workerBroken = true;
      return null;
    }
  }
  return worker;
}

function search(config: DealConfig): Pending {
  const w = getWorker();
  if (w) {
    return new Promise((resolve) => {
      const id = nextId++;
      waiting.set(id, (seed) =>
        // Le travailleur a echoue en route: on cherche ici meme.
        resolve(seed ?? (workerBroken ? findWinnableSeed(config) : null)),
      );
      w.postMessage({ id, config });
    });
  }
  // Sans travailleur (tests, vieux navigateurs): recherche differee d'un
  // tour de boucle, pour laisser l'ecran afficher l'attente.
  return new Promise((resolve) =>
    setTimeout(() => resolve(findWinnableSeed(config)), 0),
  );
}

/** Lance la preparation d'une donne si aucune n'est deja en route. */
export function prepareWinnableDeal(config: DealConfig): void {
  const key = keyOf(config);
  if (!prepared.has(key)) prepared.set(key, search(config));
}

/**
 * Renvoie la graine d'une donne gagnable (ou null en cas d'echec), et
 * prepare aussitot la suivante.
 */
export async function takeWinnableDeal(
  config: DealConfig,
): Promise<string | null> {
  const key = keyOf(config);
  const pending = prepared.get(key) ?? search(config);
  prepared.delete(key);
  const seed = await pending;
  prepareWinnableDeal(config);
  return seed;
}

/** Oublie les donnes preparees (utile aux tests). */
export function resetDealer(): void {
  prepared.clear();
}
