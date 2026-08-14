import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { openParc, signInToApp } from "./support/session";

/**
 * Recherche globale au clavier (lot L1.9, spec 010).
 *
 * Le parcours du découpage : « trouver un appareil par nom d'immeuble **au
 * clavier uniquement** ». Aucun clic dans le test principal — c'est la règle
 * UX 5, et un test qui cliquerait ne prouverait rien.
 *
 * Chaque test crée son immeuble : la suite tourne en parallèle sur une API
 * partagée, et les résultats de recherche sont plafonnés à vingt.
 */

function unique(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

/** Crée un immeuble et son appareil depuis l'écran de parc. */
async function createSiteWithUnit(
  page: Page,
  siteName: string,
  street: string,
  unitReference: string,
): Promise<void> {
  await openParc(page);
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Nom de l'immeuble").fill(siteName);
  await page.getByLabel("Adresse", { exact: true }).fill(street);
  await page.getByLabel("Code postal").fill("35000");
  await page.getByLabel("Ville").fill("Rennes");
  await page.getByRole("button", { name: "Créer le site" }).click();

  await page.getByText(siteName, { exact: true }).click();
  await expect(page.getByTestId("site-name")).toHaveText(siteName);
  await page.getByRole("button", { name: "Ajouter un appareil" }).click();
  await page.getByLabel("Repère").fill(unitReference);
  await page.getByRole("button", { name: "Ajouter l'appareil" }).click();
  await expect(page.getByTestId("units-list").getByText(unitReference)).toBeVisible();
}

/** Ouvre la palette au clavier et attend qu'elle ait le focus. */
async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Rechercher" })).toBeFocused();
}

/** La ligne actuellement sélectionnée, telle qu'un lecteur d'écran l'entend. */
function selectedResult(page: Page) {
  return page.locator('[data-testid="palette-result"][aria-selected="true"]');
}

test("le dispatcher trouve un appareil par le nom de son immeuble, au clavier", async ({
  page,
}) => {
  const siteName = unique("Résidence Vilaine ");
  const unitReference = unique("Ascenseur ");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, unique("quai de la Vilaine "), unitReference);

  // À partir d'ici, plus une seule souris.
  await page.goto("/");
  await openPalette(page);

  // Le nom de l'immeuble, pas le repère de l'appareil : c'est ce que dit le
  // gardien au téléphone.
  await page.keyboard.type(siteName);

  const appareil = page.locator('[data-testid="palette-result"]', { hasText: unitReference });
  await expect(appareil).toBeVisible();
  // L'appareil est présélectionné : taper puis Entrée doit suffire.
  await expect(selectedResult(page)).toContainText(unitReference);

  await page.keyboard.press("Enter");

  // Un appareil n'a pas de page à lui : on arrive sur la fiche de son immeuble.
  await expect(page.getByTestId("site-name")).toHaveText(siteName);
  await expect(page.getByTestId("units-list").getByText(unitReference)).toBeVisible();
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
});

test("les flèches parcourent les résultats et bouclent", async ({ page }) => {
  const siteName = unique("Résidence Rance ");
  const unitReference = unique("Ascenseur ");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, unique("rue de la Rance "), unitReference);

  await page.goto("/");
  await openPalette(page);
  await page.keyboard.type(siteName);

  // Deux résultats au moins : l'appareil et son immeuble.
  await expect(page.getByTestId("palette-result")).toHaveCount(2);
  await expect(selectedResult(page)).toContainText(unitReference);

  await page.keyboard.press("ArrowDown");
  await expect(selectedResult(page)).toContainText(siteName);

  // Depuis la dernière ligne, la flèche du bas revient à la première.
  await page.keyboard.press("ArrowDown");
  await expect(selectedResult(page)).toContainText(unitReference);

  // Et la flèche du haut repart à la dernière.
  await page.keyboard.press("ArrowUp");
  await expect(selectedResult(page)).toContainText(siteName);
});

test("Échap ferme la palette et rend le focus", async ({ page }) => {
  await signInToApp(page);

  // Le focus part d'un endroit précis, pour vérifier qu'il y revient.
  const opener = page.getByRole("link", { name: "Conformité" });
  await opener.focus();
  await openPalette(page);

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("command-palette")).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("la palette trouve un OT par son numéro et mène à sa fiche", async ({ page }) => {
  const siteName = unique("Résidence Ille ");
  const street = unique("boulevard de l'Ille ");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, street, "Ascenseur A");

  await page.getByRole("link", { name: "OT", exact: true }).click();
  await page.getByRole("link", { name: "Nouvel OT" }).click();
  await page.getByLabel("Immeuble ou adresse").fill(street);
  await page
    .getByTestId("unit-choices")
    .getByRole("button", { name: "Ascenseur A", exact: true })
    .click();
  await page.getByLabel("Description").fill("Bruit anormal en machinerie");
  await page.getByRole("button", { name: "Créer l'OT" }).click();

  const heading = page.getByTestId("work-order-reference");
  await expect(heading).toHaveText(/^OT-\d{4}-\d{5}$/);
  const reference = await heading.innerText();

  await page.goto("/");
  await openPalette(page);
  await page.keyboard.type(reference);

  // Numéro complet : l'égalité exacte passe devant tout le reste.
  await expect(selectedResult(page)).toContainText(reference);
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("work-order-reference")).toHaveText(reference);
});

test("une requête trop courte ne cherche rien", async ({ page }) => {
  await signInToApp(page);
  await openPalette(page);

  await page.keyboard.type("a");

  await expect(page.getByTestId("palette-empty")).toContainText("au moins 2 caractères");
  await expect(page.getByTestId("palette-result")).toHaveCount(0);
});

test("une recherche sans correspondance le dit", async ({ page }) => {
  await signInToApp(page);
  await openPalette(page);

  await page.keyboard.type(unique("introuvable-"));

  await expect(page.getByTestId("palette-empty")).toHaveText("Aucun résultat.");
});
