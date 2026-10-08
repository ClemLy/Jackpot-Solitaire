// Catalogue de l'economie du jeu: tout ce que les jetons de la banque
// permettent d'acheter, les rangs VIP, les tables a mise du mode Jackpot et la
// roue quotidienne. Module pur (aucun etat), pour rester facilement testable.

export type CosmeticCategory = 'back' | 'face' | 'table' | 'fx' | 'title';

export type VipTierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Cosmetic {
  id: string;
  category: CosmeticCategory;
  label: string;
  hint: string;
  /** Prix en jetons. 0 = offert d'office. */
  price: number;
  /** Rang VIP minimum pour pouvoir l'acheter. */
  minTier?: VipTierId;
  /** Piece maitresse de la boutique: mise en avant comme le graal. */
  grail?: boolean;
}

export const CARD_BACKS: readonly Cosmetic[] = [
  {
    id: 'retro',
    category: 'back',
    label: 'Bordeaux',
    hint: 'Treillis doré sur velours rouge',
    price: 0,
  },
  {
    id: 'modern',
    category: 'back',
    label: 'Minuit',
    hint: 'Éventails Art déco sur bleu nuit',
    price: 0,
  },
  {
    id: 'minimal',
    category: 'back',
    label: 'Ébène',
    hint: 'Noir profond et double filet d’or',
    price: 0,
  },
  {
    id: 'pixel',
    category: 'back',
    label: 'Arcade',
    hint: 'Damier violet de salle de jeux',
    price: 0,
  },
  {
    id: 'emerald',
    category: 'back',
    label: 'Émeraude',
    hint: 'Filigrane d’or sur vert impérial',
    price: 2500,
  },
  {
    id: 'sunburst',
    category: 'back',
    label: 'Soleil',
    hint: 'Rayons dorés, pur Art déco',
    price: 4000,
  },
  {
    id: 'chips',
    category: 'back',
    label: 'Jetons',
    hint: 'Une pluie de jetons de casino',
    price: 6000,
  },
  {
    id: 'foil',
    category: 'back',
    label: 'Holographique',
    hint: 'Reflets irisés qui glissent sous la lumière',
    price: 12000,
    minTier: 'silver',
  },
  {
    id: 'crest',
    category: 'back',
    label: 'Blason royal',
    hint: 'Armoiries dorées sur velours bleu nuit',
    price: 18000,
    minTier: 'gold',
  },
  {
    id: 'obsidian',
    category: 'back',
    label: 'Obsidienne',
    hint: 'Verre volcanique veiné d’or, reflet mouvant',
    price: 40000,
    minTier: 'platinum',
  },
  {
    id: 'aurora',
    category: 'back',
    label: 'Aurore boréale',
    hint: 'Des voiles de lumière qui ondulent sans fin',
    price: 65000,
    minTier: 'platinum',
  },
  {
    id: 'prism',
    category: 'back',
    label: 'Diamant taillé',
    hint: 'Mille facettes qui accrochent la lumière',
    price: 120000,
    minTier: 'diamond',
  },
  {
    id: 'triple7',
    category: 'back',
    label: 'Triple sept',
    hint: 'Le dos des légendes: 777 en or, qui scintille',
    price: 250000,
    minTier: 'diamond',
    grail: true,
  },
] as const;

// Le recto des cartes: papier, encres et finition, visibles a chaque coup.
export const CARD_FACES: readonly Cosmetic[] = [
  {
    id: 'ivory',
    category: 'face',
    label: 'Ivoire',
    hint: 'Le papier ivoire classique, encres franches',
    price: 0,
  },
  {
    id: 'parchment',
    category: 'face',
    label: 'Parchemin',
    hint: 'Papier vieilli et encres sépia, façon salon d’antan',
    price: 8000,
    minTier: 'silver',
  },
  {
    id: 'noir',
    category: 'face',
    label: 'Noir & or',
    hint: 'Cartes d’encre noire, enseignes dorées et rubis',
    price: 75000,
    minTier: 'platinum',
  },
  {
    id: 'gilded',
    category: 'face',
    label: 'Or massif',
    hint: 'Cartes plaquées or, gravées à la main, reflet vivant',
    price: 300000,
    minTier: 'diamond',
    grail: true,
  },
] as const;

export const TABLES: readonly Cosmetic[] = [
  {
    id: 'felt',
    category: 'table',
    label: 'Feutrine',
    hint: 'Le vert profond des grandes salles',
    price: 0,
  },
  {
    id: 'dark',
    category: 'table',
    label: 'Nuit',
    hint: 'Sombre et reposant pour les yeux',
    price: 0,
  },
  {
    id: 'cream',
    category: 'table',
    label: 'Crème',
    hint: 'Clair et doux, tout en douceur',
    price: 0,
  },
  {
    id: 'wood',
    category: 'table',
    label: 'Acajou',
    hint: 'Une vieille table de club ciré',
    price: 0,
  },
  {
    id: 'neon',
    category: 'table',
    label: 'Néon',
    hint: 'Ambiance salle d’arcade',
    price: 0,
  },
  {
    id: 'burgundy',
    category: 'table',
    label: 'Velours',
    hint: 'Velours bordeaux de salon privé',
    price: 3000,
  },
  {
    id: 'royal',
    category: 'table',
    label: 'Monte-Carlo',
    hint: 'Le bleu royal des tables de la Riviera',
    price: 5000,
  },
  {
    id: 'marble',
    category: 'table',
    label: 'Marbre noir',
    hint: 'Pierre veinée, froide et luxueuse',
    price: 9000,
    minTier: 'silver',
  },
  {
    id: 'salon',
    category: 'table',
    label: 'Salon doré',
    hint: 'Réservé aux habitués du carré VIP',
    price: 20000,
    minTier: 'gold',
  },
  {
    id: 'vegas',
    category: 'table',
    label: 'Las Vegas',
    hint: 'Rouge Strip et rampes de lumière dorées',
    price: 45000,
    minTier: 'platinum',
  },
  {
    id: 'starlight',
    category: 'table',
    label: 'Ciel étoilé',
    hint: 'On joue à la belle étoile, et les étoiles scintillent',
    price: 110000,
    minTier: 'diamond',
  },
  {
    id: 'goldleaf',
    category: 'table',
    label: 'Feuille d’or',
    hint: 'Laque noire incrustée d’or fin qui miroite',
    price: 220000,
    minTier: 'diamond',
    grail: true,
  },
] as const;

export const VICTORY_FX: readonly Cosmetic[] = [
  {
    id: 'bounce',
    category: 'fx',
    label: 'Cascade',
    hint: 'Les cartes rebondissent, à l’ancienne',
    price: 0,
  },
  {
    id: 'confetti',
    category: 'fx',
    label: 'Confettis dorés',
    hint: 'Une averse de paillettes d’or',
    price: 2000,
  },
  {
    id: 'coins',
    category: 'fx',
    label: 'Pluie de jetons',
    hint: 'Le jackpot tombe du plafond',
    price: 4000,
  },
  {
    id: 'fireworks',
    category: 'fx',
    label: 'Feu d’artifice',
    hint: 'Un bouquet final digne de la Riviera',
    price: 7000,
    minTier: 'silver',
  },
  {
    id: 'champagne',
    category: 'fx',
    label: 'Champagne',
    hint: 'Le bouchon saute, les bulles montent',
    price: 15000,
    minTier: 'gold',
  },
  {
    id: 'goldbars',
    category: 'fx',
    label: 'Pluie de lingots',
    hint: 'Des lingots d’or qui s’empilent au sol',
    price: 50000,
    minTier: 'platinum',
  },
  {
    id: 'supernova',
    category: 'fx',
    label: 'Supernova',
    hint: 'Une explosion d’étoiles qui embrase tout l’écran',
    price: 160000,
    minTier: 'diamond',
    grail: true,
  },
] as const;

// Titres honorifiques: affiches sur l'accueil et sur les bordereaux de gain.
export const TITLES: readonly Cosmetic[] = [
  {
    id: 'rookie',
    category: 'title',
    label: 'Joueur du dimanche',
    hint: 'Tout le monde commence quelque part',
    price: 0,
  },
  {
    id: 'flambeur',
    category: 'title',
    label: 'Flambeur',
    hint: 'Tu ne repars jamais les poches pleines',
    price: 10000,
    minTier: 'silver',
  },
  {
    id: 'baron',
    category: 'title',
    label: 'Baron du tapis',
    hint: 'Ta place est réservée à la table',
    price: 40000,
    minTier: 'gold',
  },
  {
    id: 'magnat',
    category: 'title',
    label: 'Magnat du casino',
    hint: 'Le croupier t’appelle par ton prénom',
    price: 120000,
    minTier: 'platinum',
  },
  {
    id: 'legende',
    category: 'title',
    label: 'Légende de Monte-Carlo',
    hint: 'On raconte encore tes séries au bar',
    price: 500000,
    minTier: 'diamond',
  },
  {
    id: 'roi',
    category: 'title',
    label: 'Roi du Jackpot',
    hint: 'Le titre ultime. Un seul trône, il est à toi.',
    price: 1000000,
    minTier: 'diamond',
    grail: true,
  },
] as const;

export const COSMETICS: readonly Cosmetic[] = [
  ...CARD_BACKS,
  ...CARD_FACES,
  ...TABLES,
  ...VICTORY_FX,
  ...TITLES,
];

const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function findCosmetic(id: string): Cosmetic | undefined {
  return COSMETIC_BY_ID.get(id);
}

export const DEFAULT_CARD_BACK = 'retro';
export const DEFAULT_TABLE = 'felt';
export const DEFAULT_VICTORY_FX = 'bounce';
export const DEFAULT_CARD_FACE = 'ivory';
export const DEFAULT_TITLE = 'rookie';

export function isValidCardBack(id: string): boolean {
  return CARD_BACKS.some((t) => t.id === id);
}

export function isValidTable(id: string): boolean {
  return TABLES.some((t) => t.id === id);
}

export function isValidVictoryFx(id: string): boolean {
  return VICTORY_FX.some((t) => t.id === id);
}

export function isValidCardFace(id: string): boolean {
  return CARD_FACES.some((t) => t.id === id);
}

export function isValidTitle(id: string): boolean {
  return TITLES.some((t) => t.id === id);
}

/** Objets achetables (hors objets offerts), pour le compteur de collection. */
export const COLLECTIBLES: readonly Cosmetic[] = COSMETICS.filter(
  (c) => c.price > 0,
);

// ---------------------------------------------------------------------------
// Bonus consommables, achetes en boutique et utilises en partie.
// ---------------------------------------------------------------------------

export type ConsumableId = 'insurance' | 'hint' | 'redeal';

export interface Consumable {
  id: ConsumableId;
  label: string;
  hint: string;
  price: number;
}

export const CONSUMABLES: readonly Consumable[] = [
  {
    id: 'hint',
    label: 'Œil du croupier',
    hint: 'Un indice offert, sans la moindre pénalité de score. Utilisé automatiquement.',
    price: 400,
  },
  {
    id: 'insurance',
    label: 'Assurance',
    hint: 'À activer avant un quitte ou double: si la manche est perdue, tu récupères la moitié du magot.',
    price: 1500,
  },
  {
    id: 'redeal',
    label: 'Seconde chance',
    hint: 'Donne bloquée en Jackpot ? Redistribue une nouvelle manche sans perdre ton magot.',
    price: 2500,
  },
] as const;

export function findConsumable(id: ConsumableId): Consumable {
  const found = CONSUMABLES.find((c) => c.id === id);
  if (!found) throw new Error(`Bonus inconnu: ${id}`);
  return found;
}

/** Part du magot rendue par une assurance quand la manche est perdue. */
export const INSURANCE_REFUND = 0.5;

// ---------------------------------------------------------------------------
// Rangs VIP: calcules sur le total de jetons gagnes depuis le debut. Chaque
// rang accorde une remise en boutique et ouvre des tables plus hautes.
// ---------------------------------------------------------------------------

export interface VipTier {
  id: VipTierId;
  label: string;
  threshold: number;
  discount: number;
  /** Multiplicateur applique aux jetons gagnes a la roue du jour. */
  wheelBoost: number;
}

export const VIP_TIERS: readonly VipTier[] = [
  { id: 'bronze', label: 'Bronze', threshold: 0, discount: 0, wheelBoost: 1 },
  {
    id: 'silver',
    label: 'Argent',
    threshold: 5000,
    discount: 0.05,
    wheelBoost: 1.25,
  },
  { id: 'gold', label: 'Or', threshold: 20000, discount: 0.1, wheelBoost: 1.5 },
  {
    id: 'platinum',
    label: 'Platine',
    threshold: 60000,
    discount: 0.15,
    wheelBoost: 2,
  },
  {
    id: 'diamond',
    label: 'Diamant',
    threshold: 150000,
    discount: 0.2,
    wheelBoost: 3,
  },
] as const;

export function tierIndex(id: VipTierId): number {
  return VIP_TIERS.findIndex((t) => t.id === id);
}

export function vipTierFor(lifetimeEarned: number): VipTier {
  let current = VIP_TIERS[0];
  for (const tier of VIP_TIERS) {
    if (lifetimeEarned >= tier.threshold) current = tier;
  }
  return current;
}

export function nextVipTier(lifetimeEarned: number): VipTier | null {
  return VIP_TIERS.find((t) => t.threshold > lifetimeEarned) ?? null;
}

/** Progression (0 a 1) vers le rang suivant. 1 si le rang maximum est atteint. */
export function vipProgress(lifetimeEarned: number): number {
  const current = vipTierFor(lifetimeEarned);
  const next = nextVipTier(lifetimeEarned);
  if (!next) return 1;
  const span = next.threshold - current.threshold;
  return Math.min(1, (lifetimeEarned - current.threshold) / span);
}

export function meetsTier(
  lifetimeEarned: number,
  required?: VipTierId,
): boolean {
  if (!required) return true;
  return tierIndex(vipTierFor(lifetimeEarned).id) >= tierIndex(required);
}

/** Prix reel apres la remise du rang VIP, arrondi a la dizaine. */
export function discountedPrice(price: number, lifetimeEarned: number): number {
  const { discount } = vipTierFor(lifetimeEarned);
  if (discount === 0 || price === 0) return price;
  return Math.round((price * (1 - discount)) / 10) * 10;
}

// ---------------------------------------------------------------------------
// Tables a mise du mode Jackpot: on mise des jetons de la banque pour
// s'asseoir, et les gains de chaque manche sont multiplies.
// ---------------------------------------------------------------------------

export type StakeTableId =
  'free' | 'silver' | 'gold' | 'diamond' | 'platinum' | 'legend';

export interface StakeTable {
  id: StakeTableId;
  label: string;
  stake: number;
  multiplier: number;
  minTier?: VipTierId;
  pitch: string;
}

export const STAKE_TABLES: readonly StakeTable[] = [
  {
    id: 'free',
    label: 'Table libre',
    stake: 0,
    multiplier: 1,
    pitch: 'Aucune mise. Le magot part de zéro.',
  },
  {
    id: 'silver',
    label: 'Table Argent',
    stake: 500,
    multiplier: 1.5,
    pitch: 'Une petite mise pour des gains qui décollent.',
  },
  {
    id: 'gold',
    label: 'Table Or',
    stake: 2500,
    multiplier: 2,
    pitch: 'Chaque victoire rapporte le double.',
  },
  {
    id: 'diamond',
    label: 'Table Diamant',
    stake: 10000,
    multiplier: 3,
    minTier: 'gold',
    pitch: 'Le carré des gros joueurs. Gains triplés.',
  },
  {
    id: 'platinum',
    label: 'Salon Platine',
    stake: 25000,
    multiplier: 4,
    minTier: 'platinum',
    pitch: 'Porte capitonnée, mises lourdes, gains ×4.',
  },
  {
    id: 'legend',
    label: 'Table Légende',
    stake: 75000,
    multiplier: 6,
    minTier: 'diamond',
    pitch: 'Une seule table, tout en haut. Gains ×6.',
  },
] as const;

export function findStakeTable(id: StakeTableId): StakeTable {
  return STAKE_TABLES.find((t) => t.id === id) ?? STAKE_TABLES[0];
}

// ---------------------------------------------------------------------------
// Recompenses hors Jackpot et roue quotidienne.
// ---------------------------------------------------------------------------

/** Cadeau de bienvenue verse une fois, pour que la boutique ait du sens tout de suite. */
export const WELCOME_GIFT = 1000;

/** Pourboire verse a la banque pour une victoire hors Jackpot. */
export function tipForWin(
  mode: string,
  roundScore: number,
  payout = 1,
): number {
  if (mode === 'gambling') return 0;
  if (mode === 'zen') return Math.round(50 * payout);
  return Math.max(0, Math.round(roundScore * 0.1 * payout));
}

// ---------------------------------------------------------------------------
// Niveaux de difficulte: ils reglent la pioche et la donne, et ponderent les
// jetons gagnes (pourboire hors Jackpot, gains du magot en Jackpot).
// ---------------------------------------------------------------------------

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'expert';

export interface Difficulty {
  id: DifficultyId;
  label: string;
  drawCount: 1 | 3;
  /** Donne adoucie: les cartes basses sont moins souvent enterrees. */
  gentle: boolean;
  /** Multiplicateur des jetons gagnes. */
  payout: number;
  pitch: string;
}

// Taux de victoire d'un joueur glouton simule (3000 donnes par niveau):
// Facile 76 %, Normal 34 %, Difficile 21 %, Expert 9 %. Un humain fait
// nettement mieux, mais l'ordre et les ecarts restent les memes. Les
// multiplicateurs gardent un gain moyen par partie a peu pres equivalent.
export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    label: 'Facile',
    drawCount: 1,
    gentle: true,
    payout: 0.5,
    pitch: 'Pioche 1, donne adoucie: les As sortent vite.',
  },
  {
    id: 'normal',
    label: 'Normal',
    drawCount: 1,
    gentle: false,
    payout: 1,
    pitch: 'Pioche 1, donne au hasard.',
  },
  {
    id: 'hard',
    label: 'Difficile',
    drawCount: 3,
    gentle: true,
    payout: 1.5,
    pitch: 'Pioche 3, donne adoucie.',
  },
  {
    id: 'expert',
    label: 'Expert',
    drawCount: 3,
    gentle: false,
    payout: 3,
    pitch: 'Pioche 3, donne au hasard. Le Klondike pur et dur.',
  },
] as const;

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

export function findDifficulty(id: DifficultyId): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

export function isValidDifficulty(id: unknown): id is DifficultyId {
  return DIFFICULTIES.some((d) => d.id === id);
}

/** Prime pour la premiere victoire du defi du jour. */
export const DAILY_BONUS = 500;

export type WheelReward =
  { kind: 'chips'; amount: number } | { kind: 'item'; item: ConsumableId };

export interface WheelSegment {
  reward: WheelReward;
  weight: number;
  label: string;
}

export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  { reward: { kind: 'chips', amount: 100 }, weight: 20, label: '100' },
  { reward: { kind: 'chips', amount: 250 }, weight: 18, label: '250' },
  { reward: { kind: 'item', item: 'hint' }, weight: 14, label: 'Œil' },
  { reward: { kind: 'chips', amount: 500 }, weight: 12, label: '500' },
  { reward: { kind: 'chips', amount: 150 }, weight: 18, label: '150' },
  {
    reward: { kind: 'item', item: 'insurance' },
    weight: 6,
    label: 'Assurance',
  },
  { reward: { kind: 'chips', amount: 1000 }, weight: 9, label: '1 000' },
  { reward: { kind: 'chips', amount: 2500 }, weight: 3, label: '2 500' },
] as const;

/** Tire un segment de roue selon les poids. `roll` est dans [0, 1). */
export function drawWheelSegment(roll = Math.random()): number {
  const total = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let cursor = roll * total;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    cursor -= WHEEL_SEGMENTS[i].weight;
    if (cursor < 0) return i;
  }
  return WHEEL_SEGMENTS.length - 1;
}
