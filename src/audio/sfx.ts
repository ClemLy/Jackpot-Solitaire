// Moteur de sons entierement procedural via la Web Audio API.
// Aucun fichier audio externe: tout est synthetise a la volee, ce qui garde
// l'application legere, 100% hors ligne, et lui donne un grain bien a elle.
//
// Chaine de sortie:  voix -> sec  ----------------> volume -> limiteur -> HP
//                         -> envoi -> reverberation -/
// - Le limiteur evite toute saturation quand plusieurs sons se superposent
//   (cascade de rangement, pluie de jetons).
// - Une reverberation legere donne de l'air aux sons musicaux.
// - Toutes les enveloppes partent de zero et y reviennent: aucun clic.
// - Les notes restent dans la gamme de do majeur pentatonique, pour que les
//   sons qui se chevauchent sonnent toujours juste ensemble.

import { haptic } from './haptics';

export const SOUND_NAMES = [
  'flip',
  'place',
  'draw',
  'foundation',
  'invalid',
  'penalty',
  'shuffle',
  'coins',
  'win',
  'lose',
  'bust',
  'button',
  'whoosh',
  'vault',
  'chip',
  'tick',
  'stamp',
  'purchase',
  'jackpot',
  'ratchet',
  'deal',
  'complete',
] as const;

type SoundName = (typeof SOUND_NAMES)[number];

interface Chain {
  /** Entree seche (sans reverberation). */
  dry: AudioNode;
  /** Entree de la reverberation. */
  wet: AudioNode;
  /** Volume general, avant le limiteur. */
  master: GainNode;
}

let ctx: AudioContext | null = null;
let chain: Chain | null = null;
let enabled = true;
let volume = 0.6;

// ---------------------------------------------------------------------------
// Chaine de sortie
// ---------------------------------------------------------------------------

/** Reponse impulsionnelle synthetique: un souffle stereo qui s'eteint. */
function impulse(context: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 3.2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

function createChain(
  context: BaseAudioContext,
  destination: AudioNode,
  level: number,
): Chain {
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 8;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.18;
  limiter.connect(destination);

  const master = context.createGain();
  master.gain.value = level;
  master.connect(limiter);

  const dry = context.createGain();
  dry.connect(master);

  const reverb = context.createConvolver();
  reverb.buffer = impulse(context, 1.6);
  const wet = context.createGain();
  wet.gain.value = 0.32;
  wet.connect(reverb).connect(master);

  return { dry, wet, master };
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    // Certains navigateurs refusent de creer un contexte audio (trop de
    // contextes ouverts, politique d'autoplay stricte): le jeu doit continuer
    // en silence plutot que planter. Voir playSound.
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    const created = new Ctor();
    chain = createChain(created, created.destination, volume);
    ctx = created;
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function setSoundVolume(value: number): void {
  volume = Math.max(0, Math.min(1, value));
  if (chain) chain.master.gain.value = volume;
}

/** A appeler sur la premiere interaction pour debloquer l'audio mobile. */
export function unlockAudio(): void {
  if (!enabled) return;
  try {
    ensureContext();
  } catch {
    enabled = false;
  }
}

// ---------------------------------------------------------------------------
// Briques de synthese
// ---------------------------------------------------------------------------

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Une seconde de bruit blanc, generee une fois par contexte. */
function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(context, buffer);
  }
  return buffer;
}

/**
 * Enveloppe sans clic: montee lineaire depuis zero, puis decroissance
 * exponentielle jusqu'au silence. Renvoie l'instant de fin.
 */
function envelope(
  param: AudioParam,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): number {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  param.linearRampToValueAtTime(0, t + attack + decay + 0.01);
  return t + attack + decay + 0.02;
}

interface Out {
  context: BaseAudioContext;
  chain: Chain;
}

/** Relie une voix a la sortie, avec une part eventuelle de reverberation. */
function send(out: Out, node: AudioNode, reverb = 0): void {
  node.connect(out.chain.dry);
  if (reverb > 0) {
    const amount = out.context.createGain();
    amount.gain.value = reverb;
    node.connect(amount).connect(out.chain.wet);
  }
}

/** Note simple, avec glissando et filtre passe-bas optionnels. */
function note(
  out: Out,
  t: number,
  opts: {
    freq: number;
    to?: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    attack?: number;
    lowpass?: number;
    reverb?: number;
    vibrato?: number;
  },
): void {
  const c = out.context;
  const osc = c.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t);
  if (opts.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  }
  let head: AudioNode = osc;
  if (opts.lowpass) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = opts.lowpass;
    filter.Q.value = 0.5;
    head = head.connect(filter);
  }
  if (opts.vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = opts.vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + opts.dur + 0.05);
  }
  const amp = c.createGain();
  const end = envelope(amp.gain, t, opts.gain, opts.attack ?? 0.006, opts.dur);
  send(out, head.connect(amp), opts.reverb);
  osc.start(t);
  osc.stop(end);
}

/** Cloche douce: une fondamentale et quelques harmoniques qui s'eteignent vite. */
function bell(
  out: Out,
  t: number,
  freq: number,
  dur: number,
  gain: number,
  reverb = 0.35,
): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2, 0.32, 0.6],
    [3, 0.12, 0.4],
    [4.2, 0.05, 0.25],
  ];
  for (const [ratio, level, length] of partials) {
    note(out, t, {
      freq: freq * ratio,
      dur: dur * length,
      gain: gain * level,
      attack: 0.004,
      reverb,
    });
  }
}

/** Tintement metallique (piece, jeton): partiels inharmoniques tres courts. */
function clink(out: Out, t: number, freq: number, gain: number): void {
  const partials: [number, number, number][] = [
    [1, 1, 0.14],
    [2.76, 0.5, 0.09],
    [5.4, 0.25, 0.06],
    [8.93, 0.12, 0.04],
  ];
  for (const [ratio, level, dur] of partials) {
    note(out, t, {
      freq: freq * ratio,
      dur,
      gain: gain * level,
      attack: 0.001,
      reverb: 0.15,
    });
  }
}

/** Souffle filtre: frottement de carte, glissement, feutre. */
function noise(
  out: Out,
  t: number,
  opts: {
    dur: number;
    gain: number;
    freq: number;
    to?: number;
    q?: number;
    type?: BiquadFilterType;
    attack?: number;
    reverb?: number;
  },
): void {
  const c = out.context;
  const src = c.createBufferSource();
  const buffer = noiseBuffer(c);
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.freq, t);
  if (opts.to !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  }
  filter.Q.value = opts.q ?? 1;
  const amp = c.createGain();
  const end = envelope(amp.gain, t, opts.gain, opts.attack ?? 0.004, opts.dur);
  send(out, src.connect(filter).connect(amp), opts.reverb);
  // Depart a un endroit au hasard du bruit: deux frottements ne sont
  // jamais identiques.
  src.start(t, Math.random() * Math.max(0, buffer.duration - opts.dur - 0.1));
  src.stop(end);
}

/** Coup sourd: une sinusoide grave qui chute (carte posee, tampon, porte). */
function thump(
  out: Out,
  t: number,
  freq: number,
  to: number,
  dur: number,
  gain: number,
): void {
  note(out, t, { freq, to, dur, gain, attack: 0.003, lowpass: 900 });
}

// Do majeur pentatonique, de sol4 a do8.
const SCALE = [
  392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349,
  2637, 3136, 3520, 4186,
];

// Les cartes posees en rafale sur les fondations (rangement automatique)
// montent la gamme note apres note, comme une cascade.
let lastFoundation = -Infinity;
let foundationStep = 0;

// ---------------------------------------------------------------------------
// Catalogue des sons
// ---------------------------------------------------------------------------

function render(name: SoundName, out: Out, t: number): void {
  switch (name) {
    case 'flip':
      // Carte retournee: un "fwip" bref qui monte.
      noise(out, t, { dur: 0.07, gain: 0.6, freq: 1800, to: 4800, q: 1.2 });
      break;

    case 'draw':
      noise(out, t, { dur: 0.09, gain: 0.5, freq: 1300, to: 3200, q: 0.9 });
      break;

    case 'deal':
      noise(out, t, {
        dur: 0.04,
        gain: 0.22,
        freq: 3200 + Math.random() * 900,
        q: 0.8,
        type: 'bandpass',
      });
      break;

    case 'place':
      // Carte posee sur le feutre: un petit choc mat et un froissement.
      thump(out, t, 190, 95, 0.06, 0.2);
      noise(out, t, { dur: 0.045, gain: 0.2, freq: 1100, type: 'lowpass' });
      break;

    case 'foundation': {
      const now = out.context.currentTime;
      foundationStep = now - lastFoundation < 0.6 ? foundationStep + 1 : 0;
      lastFoundation = now;
      const freq = SCALE[Math.min(6 + foundationStep, SCALE.length - 1)];
      bell(out, t, freq, 0.5, 0.15, 0.3);
      thump(out, t, 220, 110, 0.04, 0.07);
      break;
    }

    case 'complete':
      // Une pile complete, ou une bonne nouvelle: arpege de clochettes.
      [784, 988, 1175, 1568].forEach((f, i) =>
        bell(out, t + i * 0.07, f, 0.7, 0.11, 0.45),
      );
      break;

    case 'invalid':
      // "Non" feutre: deux petits coups graves et ronds.
      note(out, t, { freq: 270, to: 210, dur: 0.09, gain: 0.16, lowpass: 900 });
      note(out, t + 0.09, {
        freq: 230,
        to: 170,
        dur: 0.11,
        gain: 0.14,
        lowpass: 800,
      });
      break;

    case 'penalty':
      // Coffre piege: un petit trombone triste, sans agressivite.
      [233, 220, 208].forEach((f, i) =>
        note(out, t + i * 0.2, {
          freq: f,
          dur: 0.18,
          gain: 0.12,
          type: 'triangle',
          lowpass: 1200,
          reverb: 0.2,
        }),
      );
      note(out, t + 0.6, {
        freq: 196,
        to: 185,
        dur: 0.7,
        gain: 0.13,
        type: 'triangle',
        lowpass: 1000,
        vibrato: 4,
        attack: 0.02,
        reverb: 0.3,
      });
      break;

    case 'lose': {
      // Donne bloquee: arpege descendant en la mineur, puis accord grave
      // tenu. Melancolique mais doux.
      [659, 523, 440].forEach((f, i) =>
        note(out, t + i * 0.2, {
          freq: f,
          dur: 0.5,
          gain: 0.09,
          type: 'triangle',
          lowpass: 2200,
          reverb: 0.45,
        }),
      );
      [220, 262, 330].forEach((f) =>
        note(out, t + 0.66, {
          freq: f,
          dur: 1.5,
          gain: 0.065,
          type: 'triangle',
          lowpass: 1100,
          attack: 0.04,
          reverb: 0.55,
        }),
      );
      note(out, t + 0.66, {
        freq: 110,
        dur: 1.4,
        gain: 0.08,
        attack: 0.03,
        reverb: 0.3,
      });
      break;
    }

    case 'bust': {
      // Magot perdu: les jetons degringolent puis tout se degonfle.
      for (let i = 0; i < 9; i++) {
        const at = t + i * (0.07 - i * 0.004);
        clink(out, at, 3200 - i * 220 + Math.random() * 150, 0.07);
      }
      thump(out, t + 0.45, 150, 55, 0.3, 0.26);
      note(out, t + 0.5, {
        freq: 300,
        to: 90,
        dur: 0.6,
        gain: 0.08,
        type: 'triangle',
        lowpass: 700,
        reverb: 0.3,
      });
      break;
    }

    case 'win': {
      // Victoire: arpege montant en cloches, accord majeur qui s'epanouit,
      // et quelques etincelles aigues.
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        bell(out, t + i * 0.085, f, 0.6, 0.15, 0.4),
      );
      const chordAt = t + 0.48;
      [262, 523, 659, 784].forEach((f, i) =>
        note(out, chordAt, {
          freq: f,
          dur: 1.6,
          gain: i === 0 ? 0.09 : 0.06,
          type: 'triangle',
          lowpass: 2600,
          attack: 0.03,
          reverb: 0.5,
        }),
      );
      for (let i = 0; i < 7; i++) {
        const f = SCALE[12 + Math.floor(Math.random() * 5)];
        bell(out, chordAt + 0.1 + i * 0.13, f, 0.4, 0.035, 0.6);
      }
      break;
    }

    case 'jackpot': {
      // Gros gain: arpege sur deux octaves, pluie de jetons, accord final.
      [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) =>
        bell(out, t + i * 0.065, f, 0.55, 0.12, 0.4),
      );
      for (let i = 0; i < 16; i++) {
        clink(
          out,
          t + 0.3 + i * 0.055 + Math.random() * 0.03,
          2600 + Math.random() * 1800,
          0.05,
        );
      }
      [523, 659, 784, 1047].forEach((f) =>
        note(out, t + 0.5, {
          freq: f,
          dur: 1.4,
          gain: 0.06,
          type: 'triangle',
          lowpass: 3000,
          attack: 0.02,
          reverb: 0.5,
        }),
      );
      break;
    }

    case 'coins':
      for (let i = 0; i < 7; i++) {
        clink(
          out,
          t + i * 0.045 + Math.random() * 0.02,
          2400 + Math.random() * 1800,
          0.06 + Math.random() * 0.03,
        );
      }
      break;

    case 'chip':
      // Deux jetons d'argile qui s'entrechoquent.
      noise(out, t, { dur: 0.025, gain: 0.7, freq: 3600, q: 5 });
      clink(out, t, 2300, 0.05);
      noise(out, t + 0.05, { dur: 0.02, gain: 0.5, freq: 3200, q: 5 });
      break;

    case 'purchase':
      // "Ka-ching": jeton, puis deux clochettes claires.
      noise(out, t, { dur: 0.025, gain: 0.6, freq: 3600, q: 5 });
      bell(out, t + 0.06, 1319, 0.6, 0.12, 0.4);
      bell(out, t + 0.14, 1760, 0.8, 0.1, 0.45);
      clink(out, t + 0.2, 3800, 0.035);
      break;

    case 'button':
      note(out, t, { freq: 1100, to: 1300, dur: 0.035, gain: 0.12 });
      noise(out, t, { dur: 0.015, gain: 0.12, freq: 5000, type: 'highpass' });
      break;

    case 'tick':
      note(out, t, {
        freq: 2500 + Math.random() * 200,
        dur: 0.018,
        gain: 0.08,
        attack: 0.001,
      });
      break;

    case 'ratchet':
      noise(out, t, {
        dur: 0.014,
        gain: 0.5,
        freq: 2800,
        q: 7,
        attack: 0.001,
      });
      thump(out, t, 650, 420, 0.015, 0.04);
      break;

    case 'stamp':
      // Tampon encreur: choc mat sur le papier.
      thump(out, t, 160, 50, 0.16, 0.34);
      noise(out, t, { dur: 0.08, gain: 0.14, freq: 900, type: 'lowpass' });
      break;

    case 'whoosh':
      noise(out, t, {
        dur: 0.22,
        gain: 0.3,
        freq: 450,
        to: 1800,
        q: 0.7,
        attack: 0.06,
      });
      break;

    case 'vault':
      // Porte blindee: coup grave, grondement et un "clang" metallique.
      thump(out, t, 95, 45, 0.4, 0.34);
      noise(out, t, { dur: 0.3, gain: 0.12, freq: 380, type: 'lowpass' });
      clink(out, t + 0.06, 340, 0.06);
      break;

    case 'shuffle':
      // Battage en queue d'aronde: une rafale de petits frottements.
      for (let i = 0; i < 10; i++) {
        const swell = Math.sin(((i + 0.5) / 10) * Math.PI);
        noise(out, t + i * 0.028, {
          dur: 0.03,
          gain: 0.14 + swell * 0.18,
          freq: 2200 + Math.random() * 1300,
          q: 1.1,
        });
      }
      thump(out, t + 0.3, 170, 90, 0.07, 0.12);
      break;

    default:
      break;
  }
}

export function playSound(name: SoundName): void {
  // Les vibrations accompagnent les sons qui comptent, meme son coupe.
  haptic(name);
  if (!enabled) return;
  // Le son n'est jamais critique: une erreur audio (contexte refuse, noeud
  // non supporte) ne doit surtout pas interrompre le coup en cours, qui
  // appelle playSound au milieu de sa mise a jour.
  try {
    const context = ensureContext();
    if (!context || !chain) return;
    // Un leger delai laisse au moteur audio le temps de programmer toutes
    // les voix: sans lui, la toute premiere attaque pouvait etre tronquee.
    render(name, { context, chain }, context.currentTime + 0.005);
  } catch {
    enabled = false;
  }
}

/**
 * Synthetise un son dans n'importe quel contexte audio (y compris hors
 * ligne), avec sa propre chaine de sortie. Sert a verifier les sons: niveau,
 * absence de saturation et de clics.
 */
export function renderSound(
  name: SoundName,
  context: BaseAudioContext,
  destination: AudioNode = context.destination,
  at = 0,
  level = 0.6,
): void {
  render(
    name,
    { context, chain: createChain(context, destination, level) },
    at,
  );
}

export const sfx = { play: playSound, unlock: unlockAudio };
export type { SoundName };
