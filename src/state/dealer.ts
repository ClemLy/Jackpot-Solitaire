// Fournisseur de donnes garanties gagnables.
//
// Les graines candidates sont imposees par la session (`${nonce}-0`,
// `${nonce}-1`...): le joueur ne peut pas ressortir une donne qu'il connait.
// La recherche tourne dans un Web Worker pour ne jamais bloquer l'ecran, et
// la donne suivante est preparee a l'avance des que le prefixe est connu.

import { findWinnableSeed, type DealConfig } from '../engine';

type Pending = Promise<string | null>;

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const waiting = new Map<number, (seed: string | null) => void>();
const prepared = new Map<string, Pending>();

function keyOf(config: DealConfig, prefix: string): string {
  return `${prefix}:${config.drawCount}-${config.gentle}-${config.recycles ?? 'inf'}`;
}

function searchHere(config: DealConfig, prefix: string): string | null {
  let k = 0;
  return findWinnableSeed(config, undefined, () => `${prefix}-${k++}`);
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

function search(config: DealConfig, prefix: string): Pending {
  const w = getWorker();
  if (w) {
    return new Promise((resolve) => {
      const id = nextId++;
      waiting.set(id, (seed) =>
        // Le travailleur a echoue en route: on cherche ici meme.
        resolve(seed ?? (workerBroken ? searchHere(config, prefix) : null)),
      );
      w.postMessage({ id, config, prefix });
    });
  }
  // Sans travailleur (tests, vieux navigateurs): recherche differee d'un
  // tour de boucle, pour laisser l'ecran afficher l'attente.
  return new Promise((resolve) =>
    setTimeout(() => resolve(searchHere(config, prefix)), 0),
  );
}

/** Lance la preparation d'une donne pour ce prefixe, si besoin. */
export function prepareWinnableDeal(config: DealConfig, prefix: string): void {
  const key = keyOf(config, prefix);
  if (!prepared.has(key)) prepared.set(key, search(config, prefix));
}

/** Graine d'une donne gagnable pour ce prefixe (null si introuvable). */
export async function takeWinnableDeal(
  config: DealConfig,
  prefix: string,
): Promise<string | null> {
  const key = keyOf(config, prefix);
  const pending = prepared.get(key) ?? search(config, prefix);
  prepared.delete(key);
  return pending;
}

/** Oublie les donnes preparees (utile aux tests). */
export function resetDealer(): void {
  prepared.clear();
}
