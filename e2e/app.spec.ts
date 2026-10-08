import { test, expect, quietSave, seedSave, SAVE_KEY } from './fixtures';

test.describe('securite', () => {
  test('la page de production porte une CSP stricte', async ({ page }) => {
    await page.goto('./');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  test('une graine piegee dans l URL reste du texte', async ({ page }) => {
    await quietSave(page);
    const evil = '<img src=x onerror="window.__pwned=1">';
    await page.goto(`./?seed=${encodeURIComponent(evil)}`);
    await expect(page.locator('.board')).toBeVisible();
    // La graine est consommee puis retiree de l'adresse.
    await expect(page).not.toHaveURL(/seed=/);
    expect(
      await page.evaluate(
        () => (window as unknown as { __pwned?: number }).__pwned,
      ),
    ).toBeUndefined();
  });
});

test.describe('page introuvable', () => {
  test('une adresse inconnue affiche la 404 du jeu', async ({ page }) => {
    await quietSave(page);
    await page.goto('./ce-lien-n-existe-pas');
    await expect(
      page.getByRole('heading', { name: /cette table n’existe pas/i }),
    ).toBeVisible();
    await expect(
      page.getByText('/Jackpot-Solitaire/ce-lien-n-existe-pas'),
    ).toBeVisible();
    await page.getByRole('link', { name: /retour au casino/i }).click();
    await expect(page).toHaveURL(/\/Jackpot-Solitaire\/$/);
    await expect(
      page.getByRole('button', { name: /jouer au jackpot/i }),
    ).toBeVisible();
  });
});

test.describe('partie', () => {
  test('lance une partie classique et pioche', async ({ page }) => {
    await quietSave(page);
    await page.goto('./');
    await page.locator('.mode-card[data-mode="classic"]').click();
    const board = page.locator('.board');
    await expect(board).toBeVisible();
    await expect(board.locator('.pile--column [data-card-id]')).toHaveCount(28);
    await page.getByRole('button', { name: /piocher une carte/i }).click();
    await expect(
      page.locator('.pile--waste [data-card-id]').first(),
    ).toBeVisible();
    await expect(page.getByText('Coups').locator('..')).toContainText('1');
  });

  test('la difficulte choisie survit au rechargement', async ({ page }) => {
    await quietSave(page);
    await page.goto('./');
    await page.getByRole('button', { name: /réglages/i }).click();
    await page.getByRole('radio', { name: /expert/i }).click();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: /réglages/i }).click();
    await expect(page.getByRole('radio', { name: /expert/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('ne deborde jamais horizontalement', async ({ page }) => {
    await quietSave(page);
    await page.goto('./');
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.locator('.mode-card[data-mode="classic"]').click();
    await expect(page.locator('.board')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});

test.describe('sauvegarde', () => {
  test('une sauvegarde corrompue previent le joueur sans casser le jeu', async ({
    page,
  }) => {
    await seedSave(page, '{"state": {"wallet": ');
    await page.goto('./');
    await expect(page.getByRole('alert')).toContainText('Sauvegarde illisible');
    // Sauvegarde perdue = reglages par defaut, animations comprises: la
    // carte de mode ondule en continu, on ne l'attend pas.
    await page
      .locator('.mode-card[data-mode="classic"]')
      .click({ force: true });
    await expect(page.locator('.board')).toBeVisible();
    const backup = await page.evaluate(
      (key) => localStorage.getItem(`${key}-illisible`),
      SAVE_KEY,
    );
    expect(backup).toContain('wallet');
  });

  test('une sauvegarde bricolee est assainie', async ({ page }) => {
    await seedSave(
      page,
      JSON.stringify({
        state: {
          wallet: { balance: -999999, lifetimeEarned: 'x', spent: null },
          inventory: { owned: 'tout', consumables: { hint: -5 } },
          settings: { soundEnabled: false, reducedMotion: true, table: 999 },
        },
        version: 3,
      }),
    );
    await page.goto('./');
    await expect(
      page.getByRole('button', { name: /jouer au jackpot/i }),
    ).toBeVisible();
    // Le solde negatif bricole est ramene a zero a l'affichage.
    await expect(
      page
        .getByRole('button', { name: /ouvrir la boutique/i })
        .locator('.balance__value'),
    ).toHaveText('0');
  });
});
