import type { Page } from "@playwright/test";

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
