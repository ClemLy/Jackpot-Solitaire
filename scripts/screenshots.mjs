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

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__jackpot), null, { timeout: 15000 });

    // Reglages stables et donnees riches.
    await driveStore(page, (meta) => {
      window.__jackpot.meta.getState().updateSettings({ reducedMotion: true, soundEnabled: false });
      window.__jackpot.meta.setState(meta);
    }, richMeta);

    // Accueil (on laisse les animations d'entree se terminer).
    await driveStore(page, () => window.__jackpot.game.getState().goHome());
    await sleep(1400);
    await page.screenshot({ path: resolve(shotsDir, 'accueil.png') });

    // Partie classique en cours (avec quelques cartes au talon).
    await driveStore(page, () => {
      const g = window.__jackpot.game.getState();
      g.newGame({ mode: 'classic', drawCount: 3, seed: 'demo-jackpot' });
    });
    await sleep(1800);
    await driveStore(page, () => {
      window.__jackpot.game.getState().clickStock();
    });
    await page.screenshot({ path: resolve(shotsDir, 'partie.png') });

    // Fenetre des regles.
    await driveStore(page, () => window.__jackpot.game.getState().openModal('rules'));
    await page.screenshot({ path: resolve(shotsDir, 'regles.png') });

    // Statistiques.
    await driveStore(page, () => window.__jackpot.game.getState().openModal('stats'));
    await page.screenshot({ path: resolve(shotsDir, 'stats.png') });

    // Boutique (dos de cartes), puis choix de la table a mise.
    await driveStore(page, () => window.__jackpot.game.getState().openModal('shop'));
    await page.screenshot({ path: resolve(shotsDir, 'boutique.png') });
    await driveStore(page, () => window.__jackpot.game.getState().openModal('tables'));
    await page.screenshot({ path: resolve(shotsDir, 'tables.png') });
    await driveStore(page, () => window.__jackpot.game.getState().openModal('wheel'));
    await page.screenshot({ path: resolve(shotsDir, 'roue.png') });
    await driveStore(page, () => window.__jackpot.game.getState().closeModal());

    // Fin de partie facon casino (mode Jackpot).
    await driveStore(page, () => {
      window.__jackpot.game.setState({
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
      });
    });
    await sleep(600);
    await page.screenshot({ path: resolve(shotsDir, 'jackpot.png') });

    // Vue mobile de l'accueil.
    await context.close();
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
    });
    const mpage = await mobile.newPage();
    await mpage.goto(BASE, { waitUntil: 'networkidle' });
    await mpage.waitForFunction(() => Boolean(window.__jackpot), null, { timeout: 15000 });
    await mpage.evaluate((meta) => {
      window.__jackpot.meta.getState().updateSettings({ reducedMotion: true, soundEnabled: false });
      window.__jackpot.meta.setState(meta);
      window.__jackpot.game.getState().goHome();
    }, richMeta);
    await sleep(500);
    await mpage.screenshot({ path: resolve(shotsDir, 'mobile.png') });

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
