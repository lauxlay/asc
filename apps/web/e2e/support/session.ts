import { expect, type Page } from "@playwright/test";

/**
 * Connexion partagée par la suite e2e.
 *
 * Les identifiants sont ceux du jeu de démonstration (`apps/api/src/seed.ts`,
 * garde-fou n°3 du découpage) : les tests et les démos design partners
 * tournent sur les mêmes données.
 */

export const DEMO_EMAIL = "dispatcher@ascenseur.test";
export const DEMO_PASSWORD = "ascenseur-demo-2026";

/** Remplit et valide le formulaire de connexion, sans rien présumer de la suite. */
export async function signIn(page: Page, password: string = DEMO_PASSWORD): Promise<void> {
  await page.getByLabel("Email").fill(DEMO_EMAIL);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/**
 * Connexion complète, jusqu'à l'écran d'accueil.
 *
 * Depuis le lot L1.7 c'est le **planning**, plus le parc : « le planning est la
 * page d'accueil, pas un module » (`07-principes-ux.md`, règle 1).
 */
export async function signInToApp(page: Page): Promise<void> {
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Planning" })).toBeVisible();
}

/** Ouvre le parc, qui n'est plus l'écran d'accueil. */
export async function openParc(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Parc", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
}
