// Moteur de sons entierement procedural via la Web Audio API.
// Aucun fichier audio externe: tout est synthetise a la volee, ce qui garde
// l'application legere, 100% hors ligne, et lui donne un grain bien a elle.

type SoundName =
  | 'flip'
  | 'place'
  | 'draw'
  | 'foundation'
  | 'invalid'
  | 'penalty'
  | 'shuffle'
  | 'coins'
  | 'win'
  | 'button'
  | 'whoosh'
  | 'vault'
  | 'chip'
  | 'tick'
  | 'stamp'
  | 'purchase'
  | 'jackpot'
  | 'ratchet'
  | 'deal'
  | 'complete';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.6;

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
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
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
  if (master) master.gain.value = volume;
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

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function tone(
  context: AudioContext,
  bus: GainNode,
  opts: {
    freq: number;
    to?: number;
    type?: OscillatorType;
    start?: number;
    duration: number;
    gain?: number;
  },
): void {
  const t0 = context.currentTime + (opts.start ?? 0);
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.to),
      t0 + opts.duration,
    );
  }
  const peak = opts.gain ?? 0.3;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(gain).connect(bus);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.02);
}

function burst(
  context: AudioContext,
  bus: GainNode,
  opts: {
    duration: number;
    filter: number;
    q?: number;
    start?: number;
    gain?: number;
    type?: BiquadFilterType;
  },
): void {
  const t0 = context.currentTime + (opts.start ?? 0);
  const src = context.createBufferSource();
  src.buffer = noiseBuffer(context, opts.duration + 0.05);
  const filter = context.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.value = opts.filter;
  filter.Q.value = opts.q ?? 1;
  const gain = context.createGain();
  const peak = opts.gain ?? 0.3;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  src.connect(filter).connect(gain).connect(bus);
  src.start(t0);
  src.stop(t0 + opts.duration + 0.05);
}

function render(name: SoundName, context: AudioContext, bus: GainNode): void {
  switch (name) {
    case 'flip':
      burst(context, bus, { duration: 0.09, filter: 2600, q: 0.8, gain: 0.35 });
      break;
    case 'place':
      burst(context, bus, { duration: 0.06, filter: 1400, q: 0.7, gain: 0.3 });
      tone(context, bus, { freq: 320, to: 180, duration: 0.08, gain: 0.12 });
      break;
    case 'draw':
      burst(context, bus, { duration: 0.12, filter: 3200, q: 0.6, gain: 0.28 });
      break;
    case 'foundation':
      tone(context, bus, {
        freq: 660,
        duration: 0.16,
        gain: 0.24,
        type: 'triangle',
      });
      tone(context, bus, {
        freq: 990,
        duration: 0.22,
        start: 0.04,
        gain: 0.18,
      });
      break;
    case 'invalid':
      tone(context, bus, {
        freq: 150,
        to: 90,
        duration: 0.16,
        gain: 0.28,
        type: 'sawtooth',
      });
      break;
    case 'penalty':
      // Elastique qui claque: chute rapide de hauteur.
      tone(context, bus, {
        freq: 420,
        to: 70,
        duration: 0.18,
        gain: 0.3,
        type: 'square',
      });
      break;
    case 'shuffle':
      for (let i = 0; i < 6; i++) {
        burst(context, bus, {
          duration: 0.05,
          filter: 2200 + Math.random() * 1200,
          gain: 0.16,
          start: i * 0.045,
        });
      }
      break;
    case 'coins':
      for (let i = 0; i < 7; i++) {
        tone(context, bus, {
          freq: 900 + Math.random() * 700,
          to: 500,
          duration: 0.1,
          gain: 0.12,
          start: i * 0.04,
          type: 'triangle',
        });
      }
      break;
    case 'win': {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => {
        tone(context, bus, {
          freq: f,
          duration: 0.35,
          gain: 0.22,
          start: i * 0.12,
          type: 'triangle',
        });
      });
      break;
    }
    case 'button':
      tone(context, bus, { freq: 520, to: 640, duration: 0.06, gain: 0.16 });
      break;
    case 'whoosh':
      burst(context, bus, { duration: 0.18, filter: 900, q: 0.5, gain: 0.22 });
      break;
    case 'vault':
      tone(context, bus, {
        freq: 120,
        to: 60,
        duration: 0.4,
        gain: 0.3,
        type: 'sawtooth',
      });
      burst(context, bus, {
        duration: 0.2,
        filter: 500,
        gain: 0.25,
        start: 0.12,
      });
      break;
    case 'chip':
      // Deux jetons d'argile qui s'entrechoquent.
      burst(context, bus, { duration: 0.04, filter: 4200, q: 3, gain: 0.3 });
      tone(context, bus, { freq: 2100, to: 1700, duration: 0.05, gain: 0.08 });
      burst(context, bus, {
        duration: 0.035,
        filter: 3600,
        q: 3,
        gain: 0.22,
        start: 0.055,
      });
      break;
    case 'tick':
      tone(context, bus, {
        freq: 1800 + Math.random() * 300,
        duration: 0.03,
        gain: 0.07,
        type: 'square',
      });
      break;
    case 'stamp':
      tone(context, bus, { freq: 180, to: 60, duration: 0.22, gain: 0.35 });
      burst(context, bus, { duration: 0.12, filter: 700, q: 0.7, gain: 0.3 });
      tone(context, bus, {
        freq: 1320,
        duration: 0.25,
        start: 0.04,
        gain: 0.1,
        type: 'sine',
      });
      break;
    case 'purchase':
      [988, 1319, 1976].forEach((f, i) => {
        tone(context, bus, {
          freq: f,
          duration: 0.28,
          start: i * 0.07,
          gain: 0.16,
          type: 'sine',
        });
      });
      for (let i = 0; i < 4; i++) {
        tone(context, bus, {
          freq: 1200 + Math.random() * 800,
          to: 700,
          duration: 0.08,
          gain: 0.07,
          start: 0.18 + i * 0.05,
        });
      }
      break;
    case 'jackpot': {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      notes.forEach((f, i) => {
        tone(context, bus, {
          freq: f,
          duration: 0.22,
          gain: 0.17,
          start: i * 0.085,
          type: 'square',
        });
      });
      for (let i = 0; i < 12; i++) {
        tone(context, bus, {
          freq: 1400 + Math.random() * 1200,
          to: 800,
          duration: 0.09,
          gain: 0.06,
          start: 0.35 + i * 0.045,
        });
      }
      break;
    }
    case 'ratchet':
      burst(context, bus, { duration: 0.025, filter: 3000, q: 4, gain: 0.25 });
      break;
    case 'deal':
      burst(context, bus, {
        duration: 0.05,
        filter: 3800 + Math.random() * 800,
        q: 0.9,
        gain: 0.12,
      });
      break;
    case 'complete':
      [784, 988, 1175, 1568].forEach((f, i) => {
        tone(context, bus, {
          freq: f,
          duration: 0.3,
          start: i * 0.06,
          gain: 0.14,
          type: 'sine',
        });
      });
      break;
    default:
      break;
  }
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  // Le son n'est jamais critique: une erreur audio (contexte refuse, noeud
  // non supporte) ne doit surtout pas interrompre le coup en cours, qui
  // appelle playSound au milieu de sa mise a jour.
  try {
    const context = ensureContext();
    if (!context || !master) return;
    render(name, context, master);
  } catch {
    enabled = false;
  }
}

export const sfx = { play: playSound, unlock: unlockAudio };
export type { SoundName };
