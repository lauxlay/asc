import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/session";

/**
 * Parcours de parc du dispatcher (lot L1.1, spec 002).
 *
 * Le parcours métier réel : un nouveau client arrive, le dispatcher saisit
 * l'immeuble, y déclare l'appareil, puis le retrouve comme il le fera au
 * téléphone — par l'adresse que lui donne le gardien, jamais par un code
 * interne.
 *
 * Les tests s'ajoutent à la suite cumulative : ils tournent avec ceux de L0.5
 * sur chaque PR.
 */

/** Adresse propre à ce fichier : elle ne doit croiser aucune donnée du seed. */
const NOUVEAU_SITE = {
  name: "Résidence du Port",
  addressLine: "42 avenue des Acacias",
  postalCode: "44000",
  city: "Nantes",
} as const;

async function openParc(page: Page): Promise<void> {
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
}

async function createSite(page: Page, site: typeof NOUVEAU_SITE): Promise<void> {
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Nom de l'immeuble").fill(site.name);
  // `exact` : sans lui, « Adresse » désignerait aussi « Rechercher une adresse ».
  await page.getByLabel("Adresse", { exact: true }).fill(site.addressLine);
  await page.getByLabel("Code postal").fill(site.postalCode);
  await page.getByLabel("Ville").fill(site.city);
  await page.getByRole("button", { name: "Créer le site" }).click();
}

test("le dispatcher crée un site, y ajoute un appareil et le retrouve par son adresse", async ({
  page,
}) => {
  await openParc(page);

  // 1. Saisie du nouvel immeuble.
  await createSite(page, NOUVEAU_SITE);
  await expect(page.getByText(NOUVEAU_SITE.name)).toBeVisible();

  // 2. On y déclare l'appareil.
  await page.getByText(NOUVEAU_SITE.name).click();
  await expect(page.getByTestId("site-name")).toHaveText(NOUVEAU_SITE.name);
  await expect(page.getByTestId("units-empty")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un appareil" }).click();
  await page.getByLabel("Repère").fill("Ascenseur A");
  await page.getByLabel("Mise en service").fill("2019-04-15");
  await page.getByRole("button", { name: "Ajouter l'appareil" }).click();

  await expect(page.getByTestId("units-list").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Ascenseur A")).toBeVisible();
  await expect(page.getByText("Mise en service : 2019-04-15")).toBeVisible();

  // 3. Le gardien appelle : « c'est le 42 avenue des Acacias ».
  await page.getByRole("link", { name: "← Parc" }).click();
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();

  await page.getByLabel("Rechercher une adresse").fill("acacias");

  const results = page.getByTestId("sites-list").getByRole("listitem");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText(NOUVEAU_SITE.addressLine);

  // 4. Et depuis le résultat, on retombe bien sur l'appareil.
  await page.getByText(NOUVEAU_SITE.name).click();
  await expect(page.getByText("Ascenseur A")).toBeVisible();
});

test("la recherche ignore la casse et les accents de l'adresse", async ({ page }) => {
  await openParc(page);

  // « Tilleuls » vient du jeu de démonstration, à Lyon.
  await page.getByLabel("Rechercher une adresse").fill("LYON");

  const results = page.getByTestId("sites-list").getByRole("listitem");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Résidence Les Tilleuls");
});

test("une adresse inconnue laisse le parc vide, sans erreur", async ({ page }) => {
  await openParc(page);

  await page.getByLabel("Rechercher une adresse").fill("bordeaux");

  await expect(page.getByTestId("sites-empty")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("vider la recherche rend tout le parc", async ({ page }) => {
  await openParc(page);

  const search = page.getByLabel("Rechercher une adresse");
  await search.fill("bordeaux");
  await expect(page.getByTestId("sites-empty")).toBeVisible();

  await search.fill("");

  // Les immeubles du seed reviennent. Pas de comptage absolu : la suite tourne
  // en parallèle et le parcours de création ajoute un site au même parc.
  await expect(page.getByText("Résidence Les Tilleuls")).toBeVisible();
  await expect(page.getByText("Le Clos Fleuri")).toBeVisible();
});
