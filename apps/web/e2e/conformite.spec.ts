import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/session";

/**
 * Tableau de conformité du parc (lot L1.5, spec 006).
 *
 * C'est l'écran que le dispatcher ouvre le lundi matin. La sortie vérifiable du
 * lot est nette : « un appareil sans visite depuis 7 semaines apparaît en
 * rouge ».
 *
 * Chaque test crée ses propres immeubles et appareils : la suite tourne en
 * parallèle sur une API partagée, et le tableau montre **tout** le parc — donc
 * aussi ce que les autres parcours viennent d'y créer. Les assertions ciblent
 * la ligne du test, jamais un décompte global.
 */

/** Date décalée de `offset` jours par rapport à aujourd'hui, au format ISO. */
function daysFromToday(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function openApp(page: Page): Promise<void> {
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
}

/** Crée un immeuble et ses appareils depuis l'écran de parc. */
async function createSiteWithUnits(
  page: Page,
  siteName: string,
  street: string,
  references: readonly string[],
): Promise<void> {
  await page.getByRole("link", { name: "Parc", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Nom de l'immeuble").fill(siteName);
  await page.getByLabel("Adresse", { exact: true }).fill(street);
  await page.getByLabel("Code postal").fill("67000");
  await page.getByLabel("Ville").fill("Strasbourg");
  await page.getByRole("button", { name: "Créer le site" }).click();

  await page.getByText(siteName, { exact: true }).click();
  await expect(page.getByTestId("site-name")).toHaveText(siteName);

  for (const reference of references) {
    await page.getByRole("button", { name: "Ajouter un appareil" }).click();
    await page.getByLabel("Repère").fill(reference);
    await page.getByRole("button", { name: "Ajouter l'appareil" }).click();
    await expect(page.getByTestId("units-list").getByText(reference)).toBeVisible();
  }
}

/** Crée un contrat prenant effet il y a `startedDaysAgo` jours et y lie un appareil. */
async function coverUnit(
  page: Page,
  reference: string,
  siteName: string,
  unitReference: string,
  startedDaysAgo: number,
): Promise<void> {
  await page.getByRole("link", { name: "Contrats", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau contrat" }).click();
  await page.getByLabel("Numéro de contrat").fill(reference);
  await page.getByLabel("Prise d'effet").fill(daysFromToday(-startedDaysAgo));
  await page.getByRole("button", { name: "Créer le contrat" }).click();

  await page.getByText(reference, { exact: true }).click();
  await page
    .getByLabel("Lier un appareil")
    .selectOption({ label: `${siteName} — ${unitReference}` });
  await page.getByRole("button", { name: "Lier" }).click();
  await expect(page.getByTestId("contract-units-list").getByText(unitReference)).toBeVisible();
}

/** Ligne du tableau de conformité portant ce repère d'appareil. */
function rowOf(page: Page, unitReference: string) {
  return page.getByTestId("compliance-rows").getByRole("row").filter({ hasText: unitReference });
}

/**
 * Couleur d'alerte du thème, telle que le navigateur la calcule.
 *
 * On interroge le jeton plutôt que d'écrire une valeur en dur : le thème est en
 * `oklch`, et figer sa conversion rendrait le test faux au premier ajustement
 * de couleur — alors que ce qu'on veut vérifier, c'est que le retard porte bien
 * la couleur d'alerte, quelle qu'elle soit.
 */
async function alertColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-destructive)";
    document.body.append(probe);
    const { color } = getComputedStyle(probe);
    probe.remove();
    return color;
  });
}

test("un appareil sans visite depuis 7 semaines apparaît en rouge", async ({ page }) => {
  const siteName = "Résidence Orangerie";
  const unitReference = "Ascenseur Orangerie A";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "1 rue de l'Orangerie", [unitReference]);
  // Contrat pris il y a 49 jours : l'échéance des 6 semaines est tombée il y a
  // 7 jours.
  await coverUnit(page, "CT-2026-RETARD", siteName, unitReference, 49);

  await page.getByRole("link", { name: "Conformité" }).click();
  await expect(page.getByRole("heading", { name: "Conformité" })).toBeVisible();

  const row = rowOf(page, unitReference);
  await expect(row).toContainText("En retard");
  await expect(row).toContainText(daysFromToday(-7));

  // Rouge : c'est l'alerte réglementaire, pas une nuance de gris. On vise la
  // cellule de statut, pas n'importe quel texte de la ligne.
  const statusCell = row.getByRole("cell", { name: "En retard", exact: true });
  await expect(statusCell).toHaveCSS("color", await alertColor(page));
});

test("un appareil dont l'échéance approche est signalé sans être en retard", async ({ page }) => {
  const siteName = "Résidence Krutenau";
  const unitReference = "Ascenseur Krutenau A";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "2 rue de la Krutenau", [unitReference]);
  // Échéance dans 2 jours, fenêtre d'alerte de 7.
  await coverUnit(page, "CT-2026-BIENTOT", siteName, unitReference, 40);

  await page.getByRole("link", { name: "Conformité" }).click();

  await expect(rowOf(page, unitReference)).toContainText("Bientôt due");
});

test("un appareil sans contrat ni date connue reste visible et marqué inconnu", async ({
  page,
}) => {
  // Le piège du lot : cet appareil ne produit aucune échéance. S'il
  // disparaissait, le plus problématique du parc passerait pour conforme.
  const siteName = "Résidence Neudorf";
  const unitReference = "Ascenseur orphelin";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "3 route de Neudorf", [unitReference]);

  await page.getByRole("link", { name: "Conformité" }).click();

  const row = rowOf(page, unitReference);
  await expect(row).toContainText("Inconnu");
  await expect(row).toContainText("Aucun");
});

test("le filtre par statut réduit le tableau sans changer les compteurs", async ({ page }) => {
  const siteName = "Résidence Robertsau";
  const enRetard = "Ascenseur Robertsau A";
  const inconnu = "Ascenseur Robertsau B";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "4 rue de la Robertsau", [enRetard, inconnu]);
  await coverUnit(page, "CT-2026-FILTRE", siteName, enRetard, 49);

  await page.getByRole("link", { name: "Conformité" }).click();
  await expect(rowOf(page, enRetard)).toBeVisible();
  await expect(rowOf(page, inconnu)).toBeVisible();

  await page.getByRole("button", { name: /^En retard \(/ }).click();

  await expect(rowOf(page, enRetard)).toBeVisible();
  await expect(rowOf(page, inconnu)).toHaveCount(0);

  // Les compteurs décrivent le parc entier, pas la vue filtrée : « Inconnu »
  // reste non nul alors que ces lignes ne sont plus affichées.
  await expect(page.getByRole("button", { name: /^Inconnu \([1-9]/ })).toBeVisible();
});

test("le filtre sans contrat croise les statuts", async ({ page }) => {
  const siteName = "Résidence Cronenbourg";
  const sansContrat = "Ascenseur Cronenbourg seul";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "5 rue de Cronenbourg", [sansContrat]);

  await page.getByRole("link", { name: "Conformité" }).click();
  await page.getByRole("button", { name: /^Sans contrat \(/ }).click();

  await expect(rowOf(page, sansContrat)).toContainText("Aucun");
});
