import { useEffect, useRef } from 'react';
import { useMetaStore } from '../state/meta';
import {
  rankLabel,
  SUITS,
  RANKS,
  color,
  type Rank,
  type Suit,
} from '../engine';
import { suitPath2D } from '../utils/suitPaths';

// Effets de victoire, dessines sur canvas. Chaque effet est une petite
// simulation: on l'appelle a chaque image avec le contexte et le temps ecoule.

interface Scene {
  frame: (ctx: CanvasRenderingContext2D, t: number, dt: number) => boolean;
  /** Vrai si l'effet laisse une trainee (on estompe au lieu d'effacer). */
  trails: boolean;
}

const FESTIVE = ['#E3B95A', '#F3D27C', '#C42A3D', '#FBF6EA', '#2F8A63'];

function roundRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
}

function drawSuit(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  x: number,
  y: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  for (const p of suitPath2D(suit)) ctx.fill(p);
  ctx.restore();
}

/** La cascade a l'ancienne: les cartes rebondissent en laissant une trainee. */
function bounceScene(width: number, height: number, preview: boolean): Scene {
  const cw = Math.min(78, width / 9);
  const ch = cw * 1.4;
  const flyers: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rank: Rank;
    suit: Suit;
  }[] = [];
  let launched = 0;
  let sinceLaunch = 0;
  const max = preview ? 14 : 52;

  const drawCard = (f: (typeof flyers)[number]) => {
    const ink = color(f.suit) === 'red' ? '#C42A3D' : '#17191F';
    ctx2.save();
    ctx2.translate(f.x, f.y);
    ctx2.fillStyle = '#FBF6EA';
    ctx2.strokeStyle = 'rgba(23,25,31,0.35)';
    ctx2.lineWidth = 1;
    roundRect(ctx2, cw, ch, cw * 0.09);
    ctx2.fill();
    ctx2.stroke();
    ctx2.fillStyle = ink;
    ctx2.font = `600 ${cw * 0.3}px "Fraunces Variable", Georgia, serif`;
    ctx2.textBaseline = 'top';
    ctx2.fillText(rankLabel(f.rank), cw * 0.08, cw * 0.07);
    drawSuit(ctx2, f.suit, cw * 0.3, ch * 0.36, cw * 0.42);
    ctx2.restore();
  };

  let ctx2: CanvasRenderingContext2D;
  return {
    trails: true,
    frame: (ctx, t, dt) => {
      ctx2 = ctx;
      sinceLaunch += dt;
      if (launched < max && sinceLaunch > 150) {
        sinceLaunch = 0;
        flyers.push({
          x: width / 2 + (Math.random() - 0.5) * width * 0.55,
          y: 70 + Math.random() * 50,
          vx: (Math.random() - 0.5) * 9,
          vy: -Math.random() * 4,
          rank: RANKS[(12 - (launched % 13)) as number] as Rank,
          suit: SUITS[launched % 4],
        });
        launched += 1;
      }
      const k = dt / 16.67;
      for (const f of flyers) {
        f.vy += 0.38 * k;
        f.x += f.vx * k;
        f.y += f.vy * k;
        if (f.y + ch > height) {
          f.y = height - ch;
          f.vy = -f.vy * 0.78;
          if (Math.abs(f.vy) < 1) f.vy = -(4 + Math.random() * 4);
        }
        drawCard(f);
      }
      return t < (preview ? 3200 : 9000);
    },
  };
}

/** Confettis dores qui virevoltent. */
function confettiScene(width: number, height: number, preview: boolean): Scene {
  const pieces = Array.from({ length: preview ? 120 : 220 }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.8,
    vy: 1.4 + Math.random() * 2.2,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.02 + Math.random() * 0.03,
    rot: Math.random() * Math.PI,
    rotSpeed: (Math.random() - 0.5) * 0.2,
    flip: Math.random() * Math.PI,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    c: FESTIVE[Math.floor(Math.random() * FESTIVE.length)],
  }));
  return {
    trails: false,
    frame: (ctx, t, dt) => {
      const k = dt / 16.67;
      let alive = false;
      for (const p of pieces) {
        p.sway += p.swaySpeed * k;
        p.flip += 0.08 * k;
        p.rot += p.rotSpeed * k;
        p.y += p.vy * k;
        p.x += Math.sin(p.sway) * 1.2 * k;
        if (p.y < height + 30) alive = true;
        else if (t < (preview ? 1800 : 5000)) {
          p.y = -20;
          p.x = Math.random() * width;
          alive = true;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      return alive;
    },
  };
}

/** Pluie de jetons de casino qui tournoient et rebondissent. */
function coinsScene(width: number, height: number, preview: boolean): Scene {
  const tones = [
    { base: '#C99532', spot: '#FFF3CF', inner: '#EFC766' },
    { base: '#A61F33', spot: '#F8EEE2', inner: '#C3364B' },
    { base: '#1D2024', spot: '#E9E2D2', inner: '#2E3238' },
  ];
  const coins = Array.from({ length: preview ? 50 : 110 }, (_, i) => ({
    x: Math.random() * width,
    y: -40 - Math.random() * height * (preview ? 0.6 : 1.4),
    vx: (Math.random() - 0.5) * 2,
    vy: Math.random() * 2,
    spin: Math.random() * Math.PI * 2,
    spinSpeed: 0.08 + Math.random() * 0.12,
    r: 11 + Math.random() * 9,
    tone: tones[i % 3],
    bounces: 0,
  }));
  return {
    trails: false,
    frame: (ctx, _t, dt) => {
      const k = dt / 16.67;
      let alive = false;
      for (const c of coins) {
        c.vy += 0.32 * k;
        c.x += c.vx * k;
        c.y += c.vy * k;
        c.spin += c.spinSpeed * k;
        if (c.y + c.r > height && c.bounces < 2) {
          c.y = height - c.r;
          c.vy = -c.vy * 0.45;
          c.bounces += 1;
        }
        if (c.y - c.r < height) alive = true;
        const sx = Math.max(0.12, Math.abs(Math.cos(c.spin)));
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(sx, 1);
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.fillStyle = c.tone.base;
        ctx.fill();
        ctx.fillStyle = c.tone.spot;
        for (let s = 0; s < 6; s++) {
          ctx.save();
          ctx.rotate((s * Math.PI) / 3);
          ctx.fillRect(-c.r * 0.14, -c.r, c.r * 0.28, c.r * 0.3);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, c.r * 0.64, 0, Math.PI * 2);
        ctx.fillStyle = c.tone.inner;
        ctx.fill();
        ctx.restore();
      }
      return alive;
    },
  };
}

/** Bouquet final: fusees et gerbes d'etincelles. */
function fireworksScene(
  width: number,
  height: number,
  preview: boolean,
): Scene {
  type Spark = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    c: string;
  };
  type Rocket = { x: number; y: number; vy: number; peak: number; c: string };
  const sparks: Spark[] = [];
  const rockets: Rocket[] = [];
  let since = 0;
  const palette = [
    '#F3D27C',
    '#E3B95A',
    '#FF6B7D',
    '#7FE0B0',
    '#FBF6EA',
    '#8FB8FF',
  ];
  const burst = (x: number, y: number, c: string) => {
    const n = 70;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = 2.2 + Math.random() * 3.2;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        c: Math.random() < 0.25 ? '#FFF6DA' : c,
      });
    }
  };
  return {
    trails: true,
    frame: (ctx, t, dt) => {
      const k = dt / 16.67;
      since += dt;
      const emitting = t < (preview ? 2400 : 7000);
      if (emitting && since > (preview ? 330 : 420)) {
        since = 0;
        rockets.push({
          x: width * (0.15 + Math.random() * 0.7),
          y: height,
          vy: -(9 + Math.random() * 4),
          peak: height * (0.15 + Math.random() * 0.3),
          c: palette[Math.floor(Math.random() * palette.length)],
        });
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy * k;
        r.vy += 0.12 * k;
        ctx.fillStyle = '#FFF1BF';
        ctx.fillRect(r.x - 1.5, r.y, 3, 8);
        if (r.y <= r.peak || r.vy >= -1) {
          burst(r.x, r.y, r.c);
          rockets.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + 0.06 * k;
        s.x += s.vx * k;
        s.y += s.vy * k;
        s.life -= 0.012 * k;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x - 1.4, s.y - 1.4, 2.8, 2.8);
      }
      ctx.globalAlpha = 1;
      return emitting || rockets.length > 0 || sparks.length > 0;
    },
  };
}

/** Champagne: le bouchon saute, une gerbe de mousse puis des bulles qui montent. */
function champagneScene(
  width: number,
  height: number,
  preview: boolean,
): Scene {
  type Bubble = {
    x: number;
    y: number;
    r: number;
    vy: number;
    wob: number;
    life: number;
  };
  const bubbles: Bubble[] = [];
  const corks: { x: number; y: number; vx: number; vy: number; rot: number }[] =
    [];
  let since = 0;
  const pop = (x: number) => {
    corks.push({
      x,
      y: height,
      vx: (Math.random() - 0.5) * 4,
      vy: -(14 + Math.random() * 5),
      rot: 0,
    });
    for (let i = 0; i < 70; i++) {
      bubbles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: height - Math.random() * 20,
        r: 2 + Math.random() * 5,
        vy: -(4 + Math.random() * 9),
        wob: Math.random() * Math.PI * 2,
        life: 1,
      });
    }
  };
  return {
    trails: false,
    frame: (ctx, t, dt) => {
      const k = dt / 16.67;
      since += dt;
      const emitting = t < (preview ? 2200 : 6000);
      if (emitting && since > (preview ? 700 : 900)) {
        since = 0;
        pop(width * (0.15 + Math.random() * 0.7));
      }
      if (emitting && Math.random() < 0.6 * k) {
        bubbles.push({
          x: Math.random() * width,
          y: height + 10,
          r: 1.5 + Math.random() * 3,
          vy: -(1.5 + Math.random() * 2.5),
          wob: Math.random() * 6,
          life: 1,
        });
      }
      for (let i = corks.length - 1; i >= 0; i--) {
        const c = corks[i];
        c.vy += 0.35 * k;
        c.x += c.vx * k;
        c.y += c.vy * k;
        c.rot += 0.3 * k;
        if (c.y > height + 40) {
          corks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = '#C8A06A';
        ctx.fillRect(-7, -9, 14, 18);
        ctx.fillStyle = '#E3B95A';
        ctx.fillRect(-8, -11, 16, 5);
        ctx.restore();
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.wob += 0.08 * k;
        b.vy *= 0.995;
        b.y += b.vy * k;
        b.x += Math.sin(b.wob) * 0.6 * k;
        if (b.vy > -1.2) b.life -= 0.01 * k;
        if (b.y < -20 || b.life <= 0) {
          bubbles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, b.life));
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 241, 191, 0.9)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(243, 210, 124, 0.18)';
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      return emitting || bubbles.length > 0 || corks.length > 0;
    },
  };
}

/** Pluie de lingots: ils tombent en tournant et s'empilent au sol. */
function goldbarsScene(width: number, height: number, preview: boolean): Scene {
  const bw = Math.min(56, width / 10);
  const bh = bw * 0.42;
  const cols = Math.max(1, Math.floor(width / bw));
  const heights = new Array(cols).fill(0);
  type Bar = {
    col: number;
    x: number;
    y: number;
    vy: number;
    rot: number;
    vr: number;
    landed: boolean;
  };
  const bars: Bar[] = [];
  let since = 0;
  let dropped = 0;
  const max = preview ? 26 : 90;
  const drawBar = (b: Bar) => {
    ctx2.save();
    ctx2.translate(b.x + bw / 2, b.y + bh / 2);
    ctx2.rotate(b.rot);
    const g = ctx2.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
    g.addColorStop(0, '#FFF1BF');
    g.addColorStop(0.45, '#E3B95A');
    g.addColorStop(1, '#8F6418');
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.moveTo(-bw / 2 + bw * 0.12, -bh / 2);
    ctx2.lineTo(bw / 2 - bw * 0.12, -bh / 2);
    ctx2.lineTo(bw / 2, bh / 2);
    ctx2.lineTo(-bw / 2, bh / 2);
    ctx2.closePath();
    ctx2.fill();
    ctx2.strokeStyle = 'rgba(122, 85, 23, 0.8)';
    ctx2.lineWidth = 1;
    ctx2.stroke();
    ctx2.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx2.fillRect(-bw / 2 + bw * 0.16, -bh / 2 + 2, bw * 0.68, 2);
    ctx2.restore();
  };
  let ctx2: CanvasRenderingContext2D;
  return {
    trails: false,
    frame: (ctx, t, dt) => {
      ctx2 = ctx;
      const k = dt / 16.67;
      since += dt;
      if (dropped < max && since > (preview ? 60 : 55)) {
        since = 0;
        const col = Math.floor(Math.random() * cols);
        bars.push({
          col,
          x: col * bw + (width - cols * bw) / 2,
          y: -bh - Math.random() * 60,
          vy: 2 + Math.random() * 3,
          rot: (Math.random() - 0.5) * 1.2,
          vr: (Math.random() - 0.5) * 0.08,
          landed: false,
        });
        dropped += 1;
      }
      let falling = false;
      for (const b of bars) {
        if (!b.landed) {
          b.vy += 0.5 * k;
          b.y += b.vy * k;
          b.rot += b.vr * k;
          const floor = height - (heights[b.col] + 1) * bh;
          if (b.y >= floor) {
            b.y = floor;
            b.rot = 0;
            b.landed = true;
            heights[b.col] += 1;
          } else falling = true;
        }
        drawBar(b);
      }
      return dropped < max || falling || t < (preview ? 2600 : 7000);
    },
  };
}

/** Supernova: un eclair blanc, une onde de choc doree et une pluie d'etoiles. */
function supernovaScene(
  width: number,
  height: number,
  preview: boolean,
): Scene {
  type Star = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    c: string;
  };
  const stars: Star[] = [];
  const cx = width / 2;
  const cy = height * 0.42;
  const waves: { t0: number }[] = [];
  const palette = ['#FFF1BF', '#F3D27C', '#FFFFFF', '#9FC2FF', '#FF9AB0'];
  const explode = (t: number, n: number) => {
    waves.push({ t0: t });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * (preview ? 9 : 13);
      stars.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        size: 1 + Math.random() * 2.6,
        c: palette[Math.floor(Math.random() * palette.length)],
      });
    }
  };
  const bursts = preview ? [0, 900] : [0, 1300, 2600, 3900];
  let next = 0;
  const maxR = Math.hypot(width, height);
  return {
    trails: true,
    frame: (ctx, t, dt) => {
      const k = dt / 16.67;
      while (next < bursts.length && t >= bursts[next]) {
        explode(t, next === 0 ? 260 : 160);
        next += 1;
      }
      for (let i = waves.length - 1; i >= 0; i--) {
        const age = (t - waves[i].t0) / 1100;
        if (age > 1) {
          waves.splice(i, 1);
          continue;
        }
        if (age < 0.25) {
          // Lueur limitee au coeur de l'explosion: un flash plein ecran
          // s'accumulerait avec les trainees et delaverait tout l'ecran.
          const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
          glow.addColorStop(
            0,
            `rgba(255, 248, 225, ${0.5 * (1 - age / 0.25)})`,
          );
          glow.addColorStop(1, 'rgba(255, 248, 225, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(cx - 220, cy - 220, 440, 440);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, age * maxR * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(243, 210, 124, ${0.7 * (1 - age)})`;
        ctx.lineWidth = 6 * (1 - age) + 1;
        ctx.stroke();
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + 0.03 * k;
        s.x += s.vx * k;
        s.y += s.vy * k;
        s.life -= 0.008 * k;
        if (s.life <= 0) {
          stars.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.c;
        const r = s.size * (0.6 + s.life * 0.6);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - r * 2);
        ctx.lineTo(s.x + r * 0.5, s.y);
        ctx.lineTo(s.x, s.y + r * 2);
        ctx.lineTo(s.x - r * 0.5, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(s.x - r * 2, s.y - r * 0.25, r * 4, r * 0.5);
      }
      ctx.globalAlpha = 1;
      return next < bursts.length || stars.length > 0 || waves.length > 0;
    },
  };
}

const SCENES: Record<
  string,
  (w: number, h: number, preview: boolean) => Scene
> = {
  bounce: bounceScene,
  confetti: confettiScene,
  coins: coinsScene,
  fireworks: fireworksScene,
  champagne: champagneScene,
  goldbars: goldbarsScene,
  supernova: supernovaScene,
};

export function VictoryLayer({
  fx,
  preview = false,
  onDone,
}: {
  fx?: string;
  preview?: boolean;
  onDone?: () => void;
}) {
  const reduced = useMetaStore((s) => s.settings.reducedMotion);
  const chosen = useMetaStore((s) => s.settings.victoryFx);
  const effect = fx ?? chosen;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduced) {
      doneRef.current?.();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scene = (SCENES[effect] ?? bounceScene)(width, height, preview);
    let raf = 0;
    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      if (scene.trails) {
        // Estompe les images precedentes vers la transparence: la trainee
        // reste lisible sur n'importe quel tapis.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.clearRect(0, 0, width, height);
      }
      const alive = scene.frame(ctx, now - start, dt);
      if (alive) {
        raf = requestAnimationFrame(frame);
      } else {
        if (preview || !scene.trails) ctx.clearRect(0, 0, width, height);
        doneRef.current?.();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced, effect, preview]);

  if (reduced) return null;
  return (
    <canvas
      className={`victory-layer${preview ? ' victory-layer--preview' : ''}`}
      ref={canvasRef}
      aria-hidden="true"
    />
  );
}
