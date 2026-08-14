import { expect, type Page, test } from "@playwright/test";
import { openParc, signInToApp } from "./support/session";

/**
 * Parcours contrat du dispatcher (lot L1.4, spec 005).
 *
 * Le contrat d'entretien est obligatoire par la loi et déclenche tout le
 * reste : c'est lui qui rend une visite due. Ce parcours est aussi le premier
 * où le moteur d'échéances du lot L0.2 devient visible à l'écran.
 *
 * Chaque test crée ses propres immeubles et appareils : la suite tourne en
 * parallèle sur une API partagée, et un appareil ne peut être couvert que par
 * un seul contrat à la fois (R3.3) — deux tests qui se partageraient un
 * appareil se bloqueraient mutuellement.
 */

/** Prise d'effet fixe : l'échéance de visite en découle, donc elle est prévisible. */
const STARTS_ON = "2026-01-01";
/** 2026-01-01 + 6 semaines (spec 001, R1.3). */
const FIRST_VISIT_DUE_ON = "2026-02-12";

async function openApp(page: Page): Promise<void> {
  await signInToApp(page);
  await openParc(page);
}

/** Crée un immeuble et `references.length` appareils, via l'écran de parc. */
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
  await page.getByLabel("Code postal").fill("31000");
  await page.getByLabel("Ville").fill("Toulouse");
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

async function createContract(page: Page, reference: string): Promise<void> {
  // `exact` : sans lui, « Contrats » désignerait aussi le retour « ← Contrats »
  // de la fiche contrat, et Playwright refuserait de choisir.
  await page.getByRole("link", { name: "Contrats", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contrats" })).toBeVisible();

  await page.getByRole("button", { name: "Nouveau contrat" }).click();
  await page.getByLabel("Numéro de contrat").fill(reference);
  await page.getByLabel("Type de contrat").selectOption("minimal");
  await page.getByLabel("Prise d'effet").fill(STARTS_ON);
  await page.getByRole("button", { name: "Créer le contrat" }).click();

  await expect(page.getByText(reference, { exact: true })).toBeVisible();
}

test("le dispatcher crée un contrat, y lie trois appareils et voit les échéances générées", async ({
  page,
}) => {
  const siteName = "Résidence Garonne";
  const references = ["Ascenseur A", "Ascenseur B", "Monte-charge"];

  await openApp(page);
  await createSiteWithUnits(page, siteName, "10 allée Garonne", references);
  await createContract(page, "CT-2026-100");

  await page.getByText("CT-2026-100", { exact: true }).click();
  await expect(page.getByTestId("contract-reference")).toHaveText("CT-2026-100");
  await expect(page.getByTestId("contract-units-empty")).toBeVisible();
  await expect(page.getByTestId("deadlines-empty")).toBeVisible();

  for (const reference of references) {
    await page.getByLabel("Lier un appareil").selectOption({ label: `${siteName} — ${reference}` });
    await page.getByRole("button", { name: "Lier" }).click();
    await expect(page.getByTestId("contract-units-list").getByText(reference)).toBeVisible();
  }

  await expect(page.getByTestId("contract-units-list").getByRole("listitem")).toHaveCount(3);

  // Le moteur d'échéances du lot L0.2 produit une visite due par appareil.
  const rows = page.getByTestId("deadlines-list").getByRole("row");
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId("deadlines-list")).toContainText("Visite périodique");
  await expect(page.getByTestId("deadlines-list")).toContainText(FIRST_VISIT_DUE_ON);
  await expect(page.getByTestId("deadlines-list")).toContainText("Monte-charge");
});

test("un contrat de moins d'un an est refusé", async ({ page }) => {
  await openApp(page);
  // `exact` : sans lui, « Contrats » désignerait aussi le retour « ← Contrats »
  // de la fiche contrat, et Playwright refuserait de choisir.
  await page.getByRole("link", { name: "Contrats", exact: true }).click();

  await page.getByRole("button", { name: "Nouveau contrat" }).click();
  await page.getByLabel("Numéro de contrat").fill("CT-2026-TROP-COURT");
  await page.getByLabel("Prise d'effet").fill("2026-01-01");
  await page.getByLabel("Terme (facultatif)").fill("2026-06-30");
  await page.getByRole("button", { name: "Créer le contrat" }).click();

  // Durée minimale légale d'un an (loi SAE 2003).
  await expect(page.getByRole("alert")).toContainText("minimum");
  await expect(page.getByText("CT-2026-TROP-COURT", { exact: true })).toHaveCount(0);
});

test("un appareil déjà couvert ne peut pas être lié à un second contrat", async ({ page }) => {
  const siteName = "Résidence Capitole";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "20 place Capitole", ["Ascenseur unique"]);
  await createContract(page, "CT-2026-200");

  await page.getByText("CT-2026-200", { exact: true }).click();
  await page
    .getByLabel("Lier un appareil")
    .selectOption({ label: `${siteName} — Ascenseur unique` });
  await page.getByRole("button", { name: "Lier" }).click();
  await expect(page.getByTestId("contract-units-list").getByText("Ascenseur unique")).toBeVisible();

  // Second contrat sur la même période : l'appareil n'est plus disponible.
  await createContract(page, "CT-2026-201");
  await page.getByText("CT-2026-201", { exact: true }).click();
  await page
    .getByLabel("Lier un appareil")
    .selectOption({ label: `${siteName} — Ascenseur unique` });
  await page.getByRole("button", { name: "Lier" }).click();

  await expect(page.getByRole("alert")).toContainText("déjà couvert");
  await expect(page.getByTestId("contract-units-empty")).toBeVisible();
});

test("retirer un appareil du contrat retire son échéance", async ({ page }) => {
  const siteName = "Résidence Matabiau";

  await openApp(page);
  await createSiteWithUnits(page, siteName, "30 boulevard Matabiau", ["Ascenseur A"]);
  await createContract(page, "CT-2026-300");

  await page.getByText("CT-2026-300", { exact: true }).click();
  await page.getByLabel("Lier un appareil").selectOption({ label: `${siteName} — Ascenseur A` });
  await page.getByRole("button", { name: "Lier" }).click();
  await expect(page.getByTestId("deadlines-list").getByRole("row")).toHaveCount(1);

  await page.getByRole("button", { name: "Retirer" }).click();

  await expect(page.getByTestId("contract-units-empty")).toBeVisible();
  await expect(page.getByTestId("deadlines-empty")).toBeVisible();
});
