import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout sur le build de production, servi sous le meme
// sous-chemin que GitHub Pages: ce qui passe ici passera en ligne (CSP,
// page 404, service worker mis a part).
const BASE_PATH = '/Jackpot-Solitaire/';
const PORT = 4179;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    // Le service worker mettrait des pages en cache entre deux tests.
    serviceWorkers: 'block',
    // En local, PW_CHANNEL=chrome reutilise le Chrome installe.
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'bureau', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    env: { VITE_BASE: BASE_PATH },
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
