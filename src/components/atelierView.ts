// Rendu des objets sur mesure (Atelier). Les dos, rectos, tapis et cartes de
// profil sont entierement pilotes par des variables CSS: pour en composer un,
// on lit les variables de chaque objet source (sur un element temoin cache)
// et on les reapplique, partie par partie.

import { useMemo, type CSSProperties } from 'react';
import { useMetaStore } from '../state/meta';
import {
  atelierConfig,
  decodeAtelier,
  resolveTitle,
  type AtelierConfig,
  type AtelierState,
} from '../state/atelier';

type StyledSlot = 'back' | 'face' | 'table' | 'card';

/** Variables CSS apportees par chaque partie. */
const VARS: Record<StyledSlot, Record<string, string[]>> = {
  back: {
    bg: ['--back-bg'],
    pattern: ['--back-pattern', '--back-size', '--back-rendering'],
    medal: ['--back-medal'],
    border: ['--back-border', '--back-line'],
  },
  face: {
    paper: [
      '--face-paper',
      '--face-paper-2',
      '--face-hi',
      '--face-texture',
      '--face-edge',
    ],
    ink: ['--face-red', '--face-black'],
    court: ['--face-court-red', '--face-court-black', '--face-frame'],
    sheen: ['--face-sheen'],
  },
  table: {
    felt: [
      '--felt-base',
      '--felt-edge',
      '--felt-spot',
      '--on-felt',
      '--on-felt-2',
      '--slot-line',
      '--slot-fill',
      '--slot-mark',
    ],
    pattern: ['--felt-pattern', '--felt-pattern-size'],
  },
  card: {
    bg: [
      '--pc-bg',
      '--pc-ink',
      '--pc-ink-2',
      '--pc-ink-3',
      '--pc-line',
      '--pc-cell',
      '--pc-edge',
    ],
  },
};

/** Attribut qui donne a un element temoin les variables d'un objet. */
const PROBE: Record<StyledSlot, { attr: string; className?: string }> = {
  back: { attr: 'data-back-preview' },
  face: { attr: 'data-face-preview' },
  table: { attr: 'data-table-preview', className: 'felt' },
  card: { attr: 'data-style', className: 'pcard' },
};

const cache = new Map<string, Record<string, string>>();

/** Variables CSS calculees d'un objet (lues une fois, puis gardees). */
function readVars(slot: StyledSlot, id: string): Record<string, string> {
  const key = `${slot}:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Record<string, string> = {};
  if (typeof document === 'undefined') return out;
  const probe = document.createElement('div');
  const { attr, className } = PROBE[slot];
  probe.setAttribute(attr, id);
  if (className) probe.className = className;
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:10px;height:10px;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe);
  for (const names of Object.values(VARS[slot])) {
    for (const name of names) {
      const value = computed.getPropertyValue(name).trim();
      if (value) out[name] = value;
    }
  }
  probe.remove();
  cache.set(key, out);
  return out;
}

/** Variables CSS d'une composition, a poser en style sur son conteneur. */
export function atelierVars(
  slot: StyledSlot,
  config: AtelierConfig,
): CSSProperties {
  const style: Record<string, string> = {};
  for (const [part, names] of Object.entries(VARS[slot])) {
    const source = config[part];
    if (!source) continue;
    const vars = readVars(slot, source);
    for (const name of names) {
      if (vars[name]) style[name] = vars[name];
    }
  }
  return style as CSSProperties;
}

/** Compositions enregistrees du joueur. */
export function useOwnAtelier(): AtelierState {
  return useMetaStore((s) => s.legend.atelier);
}

/**
 * Style a poser pour un objet de type dos/recto/tapis/carte: rien pour un
 * objet ordinaire, les variables composees pour un objet sur mesure.
 */
export function useAtelierStyle(
  slot: StyledSlot,
  id: string,
  draft?: AtelierConfig,
): CSSProperties | undefined {
  const own = useOwnAtelier();
  const custom = decodeAtelier(id, own);
  const config = custom
    ? (draft ?? (id.includes('|') ? custom.config : atelierConfig(own, slot)))
    : null;
  const key = config ? JSON.stringify(config) : '';
  return useMemo(
    () => (config ? atelierVars(slot, config) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot, key],
  );
}

/** Titre a afficher (plaque et texte), objet sur mesure compris. */
export function useTitleView(id: string) {
  const own = useOwnAtelier();
  return resolveTitle(id, own);
}
