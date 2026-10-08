import { test as base, expect, type Page } from '@playwright/test';

/**
 * Chaque page de test collecte ses erreurs console, exceptions et violations
 * de la politique de securite (CSP). Un test echoue s'il en reste a la fin.
 */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      await use(problems);
      expect(problems, problems.join('\n')).toEqual([]);
    },
    // Actif pour tous les tests, sans avoir a le demander.
    { auto: true },
  ],
});

export { expect };

export const SAVE_KEY = 'jackpot-solitaire-meta-v1';

/** Demarre sur une sauvegarde precise (ou corrompue) avant le chargement. */
export async function seedSave(page: Page, raw: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [SAVE_KEY, raw],
  );
}

/** Coupe les animations pour des tests rapides et stables. */
export async function quietSave(page: Page, extra: object = {}): Promise<void> {
  await seedSave(
    page,
    JSON.stringify({
      state: {
        settings: {
          soundEnabled: false,
          volume: 0,
          reducedMotion: true,
          difficulty: 'normal',
          ...extra,
        },
      },
      version: 3,
    }),
  );
}
