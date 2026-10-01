// Genere les icones PWA et les captures d'ecran a partir du vrai rendu du jeu.
// Usage: npm run screenshots
// Le script lance un serveur Vite de developpement (pour acceder aux stores
// exposes sur window en mode dev), pilote l'application avec Playwright, puis
// enregistre les images dans screenshots/ et les icones dans public/.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
const shotsDir = resolve(root, 'screenshots');
const publicDir = resolve(root, 'public');
mkdirSync(shotsDir, { recursive: true });

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // pas encore pret
    }
    await sleep(500);
  }
  throw new Error('Le serveur de developpement ne repond pas.');
}

async function driveStore(page, fn, arg) {
  await page.waitForFunction(() => Boolean(window.__jackpot), null, { timeout: 15000 });
  await page.evaluate(fn, arg);
  await sleep(450);
}

const richMeta = {
  stats: {
    gamesPlayed: 128,
    gamesWon: 84,
    currentWinStreak: 5,
    bestWinStreak: 11,
    bestTimeMs: 143000,
    bestScore: 2210,
    sumWinTimeMs: 84 * 205000,
    sumWinMoves: 84 * 148,
  },
  gambling: { secured: 24480, bestSecuredRun: 6120, longestStreak: 6, vaultsOpened: 3 },
  wallet: { balance: 8640, lifetimeEarned: 24480, spent: 16840 },
  inventory: { owned: ['emerald', 'burgundy', 'confetti'], consumables: { insurance: 1, hint: 2, redeal: 0 } },
  daily: {
    completedDates: Array.from({ length: 12 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`),
    lastPlayed: null,
  },
  achievements: {
    'first-win': 1,
    lightning: 1,
    'clear-mind': 1,
    'hot-streak': 1,
    'high-roller': 1,
    daredevil: 1,
    collector: 1,
    regular: 1,
  },
};

async function generateIcons(browser) {
  const raw = readFileSync(resolve(publicDir, 'favicon.svg'), 'utf8')
    .replace('width="64" height="64"', 'width="100%" height="100%"');

  const page = await browser.newPage();

  const shoot = async (size, path, { bg = null, pad = 0 } = {}) => {
    await page.setViewportSize({ width: size, height: size });
    const inner = size - pad * 2;
    await page.setContent(
      `<html><body style="margin:0;padding:0">
        <div id="i" style="width:${size}px;height:${size}px;display:grid;place-items:center;${bg ? `background:${bg}` : ''}">
          <div style="width:${inner}px;height:${inner}px">${raw}</div>
        </div>
      </body></html>`,
    );
    const el = await page.$('#i');
    await el.screenshot({ path: resolve(publicDir, path), omitBackground: !bg });
  };

  await shoot(192, 'icon-192.png');
  await shoot(512, 'icon-512.png');
  // Maskable: fond plein vert et marge de securite.
  await shoot(512, 'icon-512-maskable.png', { bg: '#0b2a1e', pad: 64 });
  await shoot(180, 'apple-touch-icon.png', { bg: '#0b2a1e', pad: 22 });
  await page.close();
  console.log('Icones generees dans public/.');
}

// Joue de vrais coups (ceux que proposerait l'indice) pour obtenir une
// partie entamee credible, plutot qu'une donne toute fraiche.
async function playMoves(page, count) {
  await page.evaluate((n) => {
    const { game, engine } = window.__jackpot;
    for (let i = 0; i < n; i++) {
      const st = game.getState();
      if (st.phase !== 'playing') break;
      const move = engine.findHint(st.board);
      if (!move) break;
      if (move.type === 'draw' || move.type === 'recycle') st.clickStock();
      else st.applyDragMove(move);
    }
    // Un chrono a 00:00 apres 34 coups trahirait la mise en scene.
    game.setState({ startedAt: Date.now() - 263000 });
  }, count);
  await sleep(500);
}

const JACKPOT_WIN = {
  route: 'game',
  mode: 'gambling',
  phase: 'won',
  overlay: 'win',
  pot: 9860,
  combo: 2,
  stakeTable: 'gold',
  finalTimeMs: 168000,
  win: {
    roundScore: 1300,
    bonuses: { speed: 660, precision: 100, total: 760 },
    baseScore: 540,
    multiplier: 1.5,
    tableMultiplier: 2,
    gain: 3900,
    potBefore: 5960,
    potAfter: 9860,
    vaultEligible: false,
    tip: 0,
    dailyBonus: 0,
    moves: 131,
  },
};

async function openPage(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__jackpot), null, { timeout: 15000 });
  // Reglages stables (pas d'animation, pas de son) et donnees riches.
  await driveStore(page, (meta) => {
    window.__jackpot.meta.getState().updateSettings({ reducedMotion: true, soundEnabled: false });
    window.__jackpot.meta.setState(meta);
    window.__jackpot.game.getState().goHome();
  }, richMeta);
  return { context, page };
}

async function main() {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env },
  });

  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();

    await generateIcons(browser);

    // ---- Ordinateur ----
    const desk = await openPage(browser, {
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    let page = desk.page;
    await sleep(800);
    await page.screenshot({ path: resolve(shotsDir, 'accueil.png') });

    await driveStore(page, () =>
      window.__jackpot.game.getState().newGame({ mode: 'gambling', table: 'gold', drawCount: 3, seed: 'demo-jackpot' }),
    );
    await playMoves(page, 34);
    await page.screenshot({ path: resolve(shotsDir, 'partie.png') });

    await driveStore(page, (s) => window.__jackpot.game.setState(s), JACKPOT_WIN);
    await page.screenshot({ path: resolve(shotsDir, 'jackpot.png') });
    await driveStore(page, () => window.__jackpot.game.getState().goHome());

    for (const [modal, file] of [
      ['shop', 'boutique'],
      ['tables', 'tables'],
      ['wheel', 'roue'],
      ['stats', 'stats'],
      ['rules', 'regles'],
    ]) {
      await driveStore(page, (m) => window.__jackpot.game.getState().openModal(m), modal);
      await page.screenshot({ path: resolve(shotsDir, `${file}.png`) });
    }
    await desk.context.close();

    // ---- Telephone en portrait ----
    const phone = await openPage(browser, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    page = phone.page;
    await sleep(800);
    await page.screenshot({ path: resolve(shotsDir, 'mobile-accueil.png') });
    await driveStore(page, () =>
      window.__jackpot.game.getState().newGame({ mode: 'gambling', table: 'silver', drawCount: 3, seed: 'demo-jackpot' }),
    );
    await playMoves(page, 34);
    await page.screenshot({ path: resolve(shotsDir, 'mobile-partie.png') });
    await driveStore(page, (s) => window.__jackpot.game.setState(s), JACKPOT_WIN);
    await page.screenshot({ path: resolve(shotsDir, 'mobile-victoire.png') });
    await phone.context.close();

    // ---- Telephone en paysage ----
    const land = await openPage(browser, {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    page = land.page;
    await driveStore(page, () =>
      window.__jackpot.game.getState().newGame({ mode: 'classic', drawCount: 3, seed: 'demo-jackpot' }),
    );
    await playMoves(page, 34);
    await page.screenshot({ path: resolve(shotsDir, 'mobile-paysage.png') });
    await land.context.close();

    await browser.close();
    console.log('Captures enregistrees dans screenshots/.');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
