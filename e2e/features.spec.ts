import { test, expect, quietSave, seedSave } from './fixtures';

test.describe('nouveautes', () => {
  test('le tutoriel accueille un nouveau joueur', async ({ page }) => {
    await seedSave(
      page,
      JSON.stringify({
        state: { settings: { soundEnabled: false, reducedMotion: true } },
        version: 4,
      }),
    );
    await page.goto('./');
    await page.getByRole('button', { name: /suivre le tutoriel/i }).click();
    await expect(page.getByText('Le but du jeu')).toBeVisible();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Les colonnes')).toBeVisible();
    await page.getByRole('button', { name: /passer le tutoriel/i }).click();
    await expect(page.getByText('Les colonnes')).toBeHidden();
  });

  test('Vegas fait payer la donne et affiche les gains', async ({ page }) => {
    await quietSave(page);
    await page.goto('./');
    const wallet = page.getByRole('button', { name: /ouvrir la boutique/i });
    await expect(wallet.locator('.balance__value')).toHaveText('1 000');
    await page.locator('.mode-card[data-mode="vegas"]').click();
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.getByText('Gains')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /pas d’annulation à vegas/i }),
    ).toBeDisabled();
  });

  test('les missions s ouvrent depuis l accueil', async ({ page }) => {
    await quietSave(page);
    await page.goto('./');
    await page.locator('.missions-pill').click();
    await expect(page.getByRole('heading', { name: 'Du jour' })).toBeVisible();
    await expect(page.locator('.mission')).toHaveCount(6);
  });

  test('les paris annexes se posent sur une manche Jackpot', async ({
    page,
  }) => {
    await quietSave(page);
    await page.goto('./');
    await page.getByRole('button', { name: /jouer au jackpot/i }).click();
    await page.getByRole('button', { name: /table libre/i }).click();
    const bet = page.getByRole('switch', { name: /sans annuler/i });
    await bet.click();
    await expect(bet).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: /piocher une carte/i }).click();
    await expect(bet).toBeHidden();
    await expect(page.getByText('1 pari')).toBeVisible();
  });

  test('une donne garantie est preparee en arriere-plan, sous CSP', async ({
    page,
  }) => {
    await quietSave(page, { guaranteed: true, difficulty: 'expert' });
    await page.goto('./');
    await page.locator('.mode-card[data-mode="classic"]').click();
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.getByText('Le croupier vérifie la donne')).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText('Donne garantie').first()).toBeAttached();
  });
});
