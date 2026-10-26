// L'Atelier (niveau Legendaire L): la recompense ultime. Le joueur ne choisit
// plus un objet, il le compose a partir des pieces de sa collection: le fond
// d'un dos de cartes, le motif d'un deuxieme, le medaillon d'un troisieme;
// le decor d'un avatar avec le personnage d'un autre; etc. Module pur,
// partage par le navigateur et le serveur.

import {
  COSMETICS,
  DEFAULT_CARD_BACK,
  DEFAULT_CARD_FACE,
  DEFAULT_TABLE,
  DEFAULT_TITLE,
  DEFAULT_VICTORY_FX,
  findCosmetic,
  ownsCosmetic,
  type Cosmetic,
  type CosmeticCategory,
} from './catalog';

/** Niveau Legendaire qui ouvre l'Atelier. */
export const ATELIER_LEVEL = 50;

export type AtelierSlot =
  'back' | 'face' | 'table' | 'fx' | 'title' | 'avatar' | 'frame' | 'card';

export interface AtelierPart {
  key: string;
  label: string;
  /** Ce que la piece apporte, en une ligne. */
  hint: string;
}

export interface AtelierSlotDef {
  slot: AtelierSlot;
  category: CosmeticCategory;
  /** L'objet "sur mesure" qu'on equipe dans cet emplacement. */
  itemId: string;
  label: string;
  parts: AtelierPart[];
  /** Composition par defaut (objets offerts a tous). */
  defaults: Record<string, string>;
}

export const ATELIER_SLOTS: readonly AtelierSlotDef[] = [
  {
    slot: 'back',
    category: 'back',
    itemId: 'atelier-back',
    label: 'Dos de cartes',
    parts: [
      { key: 'bg', label: 'Fond', hint: 'La couleur et la matière.' },
      { key: 'pattern', label: 'Motif', hint: 'La trame posée dessus.' },
      { key: 'medal', label: 'Médaillon', hint: 'L’emblème au centre.' },
      { key: 'border', label: 'Liseré', hint: 'Le cadre et ses filets.' },
    ],
    defaults: {
      bg: DEFAULT_CARD_BACK,
      pattern: DEFAULT_CARD_BACK,
      medal: DEFAULT_CARD_BACK,
      border: DEFAULT_CARD_BACK,
    },
  },
  {
    slot: 'face',
    category: 'face',
    itemId: 'atelier-face',
    label: 'Recto des cartes',
    parts: [
      { key: 'paper', label: 'Papier', hint: 'Le fond des cartes.' },
      { key: 'ink', label: 'Encres', hint: 'Les couleurs des enseignes.' },
      { key: 'court', label: 'Figures', hint: 'Le cadre des rois et dames.' },
      { key: 'sheen', label: 'Reflet', hint: 'L’éclat qui balaie la carte.' },
    ],
    defaults: {
      paper: DEFAULT_CARD_FACE,
      ink: DEFAULT_CARD_FACE,
      court: DEFAULT_CARD_FACE,
      sheen: DEFAULT_CARD_FACE,
    },
  },
  {
    slot: 'table',
    category: 'table',
    itemId: 'atelier-table',
    label: 'Tapis',
    parts: [
      { key: 'felt', label: 'Couleur', hint: 'Le tapis et sa lumière.' },
      { key: 'pattern', label: 'Motif', hint: 'La trame du tapis.' },
      { key: 'scene', label: 'Décor', hint: 'La scène autour du plateau.' },
    ],
    defaults: {
      felt: DEFAULT_TABLE,
      pattern: DEFAULT_TABLE,
      scene: DEFAULT_TABLE,
    },
  },
  {
    slot: 'fx',
    category: 'fx',
    itemId: 'atelier-fx',
    label: 'Célébration',
    parts: [
      { key: 'first', label: 'Premier effet', hint: 'Il ouvre la fête.' },
      { key: 'second', label: 'Second effet', hint: 'Joué en même temps.' },
    ],
    defaults: { first: DEFAULT_VICTORY_FX, second: DEFAULT_VICTORY_FX },
  },
  {
    slot: 'title',
    category: 'title',
    itemId: 'atelier-title',
    label: 'Titre',
    parts: [
      { key: 'plate', label: 'Plaque', hint: 'La matière de la plaque.' },
      { key: 'text', label: 'Devise', hint: 'Les mots gravés dessus.' },
    ],
    defaults: { plate: DEFAULT_TITLE, text: DEFAULT_TITLE },
  },
  {
    slot: 'avatar',
    category: 'avatar',
    itemId: 'atelier-avatar',
    label: 'Avatar',
    parts: [
      { key: 'scene', label: 'Décor', hint: 'Le fond et la scène.' },
      { key: 'figure', label: 'Personnage', hint: 'Qui pose devant.' },
      { key: 'fx', label: 'Effets', hint: 'Ce qui brille et s’anime.' },
    ],
    defaults: { scene: 'croupier', figure: 'croupier', fx: 'croupier' },
  },
  {
    slot: 'frame',
    category: 'frame',
    itemId: 'atelier-frame',
    label: 'Cadre',
    parts: [
      { key: 'ring', label: 'Anneau', hint: 'Le cercle autour du portrait.' },
      { key: 'crest', label: 'Parure', hint: 'Ce qui déborde du cercle.' },
    ],
    defaults: { ring: 'cadre-simple', crest: 'cadre-simple' },
  },
  {
    slot: 'card',
    category: 'card',
    itemId: 'atelier-card',
    label: 'Carte de profil',
    parts: [
      { key: 'bg', label: 'Fond', hint: 'La matière et ses encres.' },
      { key: 'decor', label: 'Ornements', hint: 'Coins, scène et éclats.' },
    ],
    defaults: { bg: 'carte-felt', decor: 'carte-felt' },
  },
];

export type AtelierConfig = Record<string, string>;
export type AtelierState = Partial<Record<AtelierSlot, AtelierConfig>>;

const BY_SLOT = new Map(ATELIER_SLOTS.map((d) => [d.slot, d]));
const BY_ITEM = new Map(ATELIER_SLOTS.map((d) => [d.itemId, d]));

export function atelierSlot(slot: AtelierSlot): AtelierSlotDef {
  return BY_SLOT.get(slot)!;
}

export function isAtelierId(id: string): boolean {
  return id.startsWith('atelier-');
}

/**
 * Pieces disponibles pour un emplacement: les objets possedes de la
 * categorie (offerts compris), hors objets sur mesure.
 */
export function atelierSources(
  slot: AtelierSlot,
  owned: readonly string[],
  lifetimeEarned: number,
  legendLevel: number,
): Cosmetic[] {
  const { category } = atelierSlot(slot);
  return COSMETICS.filter(
    (c) =>
      c.category === category &&
      !isAtelierId(c.id) &&
      ownsCosmetic(c, owned, lifetimeEarned, legendLevel),
  );
}

/**
 * Composition valide pour cet emplacement, ou null. Chaque piece doit etre
 * un objet de la bonne categorie que le joueur possede.
 */
export function validAtelier(
  slot: AtelierSlot,
  config: unknown,
  canUse: (item: Cosmetic) => boolean,
): AtelierConfig | null {
  const def = BY_SLOT.get(slot);
  if (!def || typeof config !== 'object' || config === null) return null;
  const raw = config as Record<string, unknown>;
  const out: AtelierConfig = {};
  for (const part of def.parts) {
    const id = raw[part.key];
    if (typeof id !== 'string') return null;
    const item = findCosmetic(id);
    if (!item || item.category !== def.category || isAtelierId(id)) return null;
    if (!canUse(item)) return null;
    out[part.key] = id;
  }
  return out;
}

/** Composition a utiliser pour un emplacement (enregistree, sinon defaut). */
export function atelierConfig(
  state: AtelierState | undefined,
  slot: AtelierSlot,
): AtelierConfig {
  return state?.[slot] ?? atelierSlot(slot).defaults;
}

/**
 * Identifiant compose, transmis aux amis (carte publique): l'objet sur
 * mesure suivi de ses pieces, par exemple "atelier-avatar|phenix|oracle|ombre".
 */
export function encodeAtelier(
  slot: AtelierSlot,
  config: AtelierConfig,
): string {
  const def = atelierSlot(slot);
  return [def.itemId, ...def.parts.map((p) => config[p.key])].join('|');
}

/**
 * Lit un identifiant d'objet sur mesure. Un identifiant nu ("atelier-avatar")
 * prend la composition fournie (celle du joueur); un identifiant compose
 * porte la sienne. Null pour un objet ordinaire.
 */
export function decodeAtelier(
  id: string,
  own?: AtelierState,
): { slot: AtelierSlot; config: AtelierConfig } | null {
  if (!isAtelierId(id)) return null;
  const [itemId, ...ids] = id.split('|');
  const def = BY_ITEM.get(itemId);
  if (!def) return null;
  if (ids.length === 0) {
    return { slot: def.slot, config: atelierConfig(own, def.slot) };
  }
  const config: AtelierConfig = {};
  def.parts.forEach((p, i) => {
    const part = ids[i];
    const item = part ? findCosmetic(part) : undefined;
    config[p.key] =
      item && item.category === def.category && !isAtelierId(part)
        ? part
        : def.defaults[p.key];
  });
  return { slot: def.slot, config };
}

/** Le titre a afficher: style de la plaque et texte grave. */
export function resolveTitle(
  id: string,
  own?: AtelierState,
): { style: string; label: string } | null {
  const custom = decodeAtelier(id, own);
  if (custom) {
    return {
      style: custom.config.plate,
      label: findCosmetic(custom.config.text)?.label ?? '',
    };
  }
  const item = findCosmetic(id);
  return item ? { style: item.id, label: item.label } : null;
}
