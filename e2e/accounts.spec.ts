import type { Browser, Page } from '@playwright/test';
import { test, expect, seedSave } from './fixtures';

// Comptes de bout en bout, contre un Supabase reel (local: `supabase start`
// puis `supabase functions serve api`). Sans configuration, la suite est
// sautee: le jeu tourne alors en invite seul.
test.skip(
  !process.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_URL absent: comptes desactives',
);
// Les inscriptions sont limitees par adresse: une suite a la fois suffit.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'motdepasse42';

function freshPseudo(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

async function openAuth(page: Page, tab: 'Connexion' | 'Créer un compte') {
  await page.locator('.profile-plate').click();
  await page.getByRole('tab', { name: tab }).click();
}

async function signUp(page: Page, pseudo: string) {
  await openAuth(page, 'Créer un compte');
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirme le mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.locator('.auth')).toHaveCount(0);
  await expect(page.locator('.profile-plate')).toContainText(pseudo);
}

async function newPlayer(browser: Browser, pseudo: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto('./');
  await signUp(page, pseudo);
  return page;
}

test('inscription: la progression d’invite est reprise puis suit le compte', async ({
  page,
}) => {
  await seedSave(
    page,
    JSON.stringify({
      state: {
        settings: { soundEnabled: false, reducedMotion: true },
        wallet: { balance: 4321, lifetimeEarned: 4321, spent: 0 },
        tutorial: { done: true },
      },
      version: 4,
    }),
  );
  await page.goto('./');
  const pseudo = freshPseudo('Invite');
  await signUp(page, pseudo);
  await expect(page.locator('.topbar .balance')).toContainText('4 321');

  // Le compte survit au rechargement: la session est restauree.
  await page.reload();
  await expect(page.locator('.profile-plate')).toContainText(pseudo);

  // Deconnexion: on retrouve la sauvegarde d'invite de l'appareil.
  await page.locator('.profile-plate').click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.locator('.profile-plate')).toContainText('Se connecter');

  // Reconnexion: l'etat vient du serveur.
  await openAuth(page, 'Connexion');
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Se connecter' })
    .click();
  await expect(page.locator('.profile-plate')).toContainText(pseudo);
  await expect(page.locator('.topbar .balance')).toContainText('4 321');
});

test('connexion: un mauvais mot de passe est refuse proprement', async ({
  page,
  problems,
}) => {
  await page.goto('./');
  await openAuth(page, 'Connexion');
  await page.getByLabel('Pseudo').fill(freshPseudo('Fantome'));
  await page.getByLabel('Mot de passe', { exact: true }).fill('pasleboncode1');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Se connecter' })
    .click();
  await expect(page.getByRole('alert')).toContainText(/incorrect/i);
  // Le navigateur journalise le refus (400) du serveur d'authentification:
  // c'est le comportement attendu, pas une erreur du jeu.
  const expected = (p: string) => /status of 400/.test(p);
  problems.splice(0, problems.length, ...problems.filter((p) => !expected(p)));
});

test('amis: demande, acceptation et carte de profil', async ({ browser }) => {
  const alice = freshPseudo('Alice');
  const bob = freshPseudo('Bob');
  const a = await newPlayer(browser, alice);
  const b = await newPlayer(browser, bob);

  await b.getByRole('button', { name: /^Amis/ }).click();
  await b.getByLabel("Pseudo d'un ami").fill(alice);
  await b.getByRole('button', { name: 'Ajouter' }).click();
  await expect(b.getByRole('status')).toContainText(`Demande envoyée`);

  await a.reload();
  await expect(a.locator('.link-btn__badge')).toHaveText('1');
  await a.getByRole('button', { name: /^Amis/ }).click();
  await a.getByRole('button', { name: `Accepter ${bob}` }).click();
  await a.getByRole('button', { name: `Voir la carte de ${bob}` }).click();
  await expect(
    a.getByRole('article', { name: `Carte de profil de ${bob}` }),
  ).toBeVisible();

  await a.close();
  await b.close();
});
