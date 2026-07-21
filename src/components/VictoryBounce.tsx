import { useEffect, useRef } from 'react';
import { useMetaStore } from '../state/meta';
import { rankLabel, suitSymbol, SUITS, RANKS, color } from '../engine';

interface Flyer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rank: number;
  suit: number;
}

// L'animation legendaire: les cartes cascadent depuis les fondations et
// rebondissent sur le bas de l'ecran en laissant une trainee coloree.
export function VictoryBounce() {
  const reduced = useMetaStore((s) => s.settings.reducedMotion);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const cw = Math.min(72, width / 9);
    const ch = cw * 1.4;
    const flyers: Flyer[] = [];
    const gravity = 0.38;
    let launched = 0;
    const maxCards = 48;
    let lastLaunch = 0;
    let raf = 0;
    const start = performance.now();

    const launch = () => {
      const foundationX = width / 2 + (Math.random() - 0.5) * width * 0.5;
      flyers.push({
        x: foundationX,
        y: 90 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 4,
        rank: RANKS[launched % RANKS.length],
        suit: launched % SUITS.length,
      });
      launched += 1;
    };

    const drawCard = (f: Flyer) => {
      const suit = SUITS[f.suit];
      const isRed = color(suit) === 'red';
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = '#f6efdc';
      ctx.strokeStyle = isRed ? '#c0392b' : '#241f1c';
      ctx.lineWidth = 2;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(cw, 0, cw, ch, r);
      ctx.arcTo(cw, ch, 0, ch, r);
      ctx.arcTo(0, ch, 0, 0, r);
      ctx.arcTo(0, 0, cw, 0, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isRed ? '#c0392b' : '#241f1c';
      ctx.font = `700 ${cw * 0.34}px "Bradley Hand", "Comic Sans MS", cursive`;
      ctx.textBaseline = 'top';
      ctx.fillText(rankLabel(f.rank as (typeof RANKS)[number]), 5, 4);
      ctx.font = `${cw * 0.5}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(suitSymbol(suit), cw / 2, ch * 0.32);
      ctx.restore();
    };

    const frame = (now: number) => {
      if (launched < maxCards && now - lastLaunch > 160) {
        launch();
        lastLaunch = now;
      }
      // Trainee: on assombrit tres legerement plutot que d'effacer.
      ctx.fillStyle = 'rgba(18, 40, 30, 0.06)';
      ctx.fillRect(0, 0, width, height);

      for (const f of flyers) {
        f.vy += gravity;
        f.x += f.vx;
        f.y += f.vy;
        if (f.y + ch > height) {
          f.y = height - ch;
          f.vy = -f.vy * 0.78;
          if (Math.abs(f.vy) < 1) f.vy = -(4 + Math.random() * 4);
        }
        drawCard(f);
      }

      // On garde le mouvement quelques secondes, puis on fige les trainees.
      if (now - start < 9000) {
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  if (reduced) return null;
  return (
    <canvas className="victory-layer" ref={canvasRef} aria-hidden="true" />
  );
}
