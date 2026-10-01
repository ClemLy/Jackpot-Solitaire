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

const SCENES: Record<
  string,
  (w: number, h: number, preview: boolean) => Scene
> = {
  bounce: bounceScene,
  confetti: confettiScene,
  coins: coinsScene,
  fireworks: fireworksScene,
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
