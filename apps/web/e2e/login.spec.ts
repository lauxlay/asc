import { expect, test } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD, signIn } from "./support/session";

/**
 * Parcours de connexion du dispatcher — premier test de la suite de régression
 * cumulative (lot L0.5).
 *
 * Il teste le **métier**, pas la technique : « le dispatcher se connecte et
 * voit son parc », jamais « POST /auth/login renvoie 200 ».
 */

test("le dispatcher se connecte et voit le parc de sa société", async ({ page }) => {
  await page.goto("/");

  // Non connecté : on atterrit sur la connexion, pas sur le parc.
  await expect(page).toHaveURL(/\/login/);

  await signIn(page);

  await expect(page).toHaveURL("http://127.0.0.1:4173/");
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
  await expect(page.getByTestId("session-email")).toHaveText(DEMO_EMAIL);

  // Les deux immeubles du jeu de démonstration. Pas de comptage absolu : la
  // suite tourne en parallèle et d'autres parcours créent des sites.
  await expect(page.getByText("Résidence Les Tilleuls")).toBeVisible();
  await expect(page.getByText("Le Clos Fleuri")).toBeVisible();
});

test("un mot de passe faux laisse le dispatcher sur la page de connexion", async ({ page }) => {
  await page.goto("/login");

  await signIn(page, "mauvais-mot-de-passe");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("la session survit à un rechargement", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, DEMO_PASSWORD);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();

  // L'application est installée et le dispatcher y passe la journée : un
  // rechargement ne doit pas le déconnecter (ADR-003).
  await page.reload();

  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
  await expect(page.getByTestId("session-email")).toHaveText(DEMO_EMAIL);
});

test("la déconnexion ramène à la page de connexion et coupe l'accès", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, DEMO_PASSWORD);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await expect(page).toHaveURL(/\/login/);

  // Retourner à la racine ne redonne pas accès au parc.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
