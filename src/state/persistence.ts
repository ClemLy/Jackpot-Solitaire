// Lecture et ecriture fiables de la sauvegarde locale.
//
// La sauvegarde vit dans le localStorage du navigateur: n'importe qui peut la
// modifier a la main, une extension peut la corrompre, et l'ecriture peut
// echouer (navigation privee, quota plein). Rien de tout cela ne doit faire
// planter le jeu: on lit prudemment, on valide champ par champ, et on
// previent le joueur une seule fois quand quelque chose cloche.

import type { PersistStorage, StorageValue } from 'zustand/middleware';

export type StorageProblem = 'read' | 'corrupt' | 'write';

/**
 * Stockage JSON qui ne leve jamais d'exception. Une sauvegarde illisible est
 * mise de cote (cle `<nom>-illisible`) plutot que perdue, pour pouvoir la
 * recuperer a la main si besoin.
 */
export function createSafeStorage<S>(
  report: (problem: StorageProblem) => void,
  getStorage: () => Storage = () => window.localStorage,
): PersistStorage<S> {
  const reported = new Set<StorageProblem>();
  const once = (problem: StorageProblem) => {
    if (reported.has(problem)) return;
    reported.add(problem);
    report(problem);
  };

  return {
    getItem: (name) => {
      let raw: string | null;
      try {
        raw = getStorage().getItem(name);
      } catch {
        once('read');
        return null;
      }
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !('state' in parsed)) throw new Error();
        return parsed as StorageValue<S>;
      } catch {
        try {
          getStorage().setItem(`${name}-illisible`, raw);
        } catch {
          // Pas de place pour la copie: tant pis, on repart a neuf.
        }
        once('corrupt');
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        getStorage().setItem(name, JSON.stringify(value));
      } catch {
        once('write');
      }
    },
    removeItem: (name) => {
      try {
        getStorage().removeItem(name);
      } catch {
        // Rien a faire: la cle n'existe sans doute pas.
      }
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
