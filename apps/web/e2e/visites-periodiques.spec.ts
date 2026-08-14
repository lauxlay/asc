import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { openParc, signInToApp } from "./support/session";

/**
 * Visites périodiques générées (lot L1.8, spec 009).
 *
 * Le parcours du découpage : « un contrat créé génère ses visites
 * plannifiables sur 12 mois ». C'est la promesse d'onboarding — signer un
 * client et voir son planning se remplir le jour même.
 *
 * Chaque test crée son immeuble et son contrat : la suite tourne en parallèle,
 * et un appareil ne peut être couvert que par un seul contrat à la fois.
 */

/** Douze mois à 35 jours d'intervalle. */
const VISITS_PER_YEAR = 10;

/** Suffixe unique par test — les workers sont des processus distincts. */
function unique(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

/** Crée un immeuble et un appareil, et rend le repère de l'appareil. */
async function createSiteWithUnit(page: Page, siteName: string, street: string): Promise<void> {
  await openParc(page);
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Nom de l'immeuble").fill(siteName);
  await page.getByLabel("Adresse", { exact: true }).fill(street);
  await page.getByLabel("Code postal").fill("33000");
  await page.getByLabel("Ville").fill("Bordeaux");
  await page.getByRole("button", { name: "Créer le site" }).click();

  await page.getByText(siteName, { exact: true }).click();
  await expect(page.getByTestId("site-name")).toHaveText(siteName);
  await page.getByRole("button", { name: "Ajouter un appareil" }).click();
  await page.getByLabel("Repère").fill("Ascenseur A");
  await page.getByRole("button", { name: "Ajouter l'appareil" }).click();
  await expect(page.getByTestId("units-list").getByText("Ascenseur A")).toBeVisible();
}

/** Crée un contrat prenant effet aujourd'hui et ouvre sa fiche. */
async function createContract(page: Page, reference: string): Promise<void> {
  await page.getByRole("link", { name: "Contrats", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contrats" })).toBeVisible();

  await page.getByRole("button", { name: "Nouveau contrat" }).click();
  await page.getByLabel("Numéro de contrat").fill(reference);
  await page.getByLabel("Type de contrat").selectOption("minimal");
  await page.getByLabel("Prise d'effet").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Créer le contrat" }).click();

  await page.getByText(reference, { exact: true }).click();
  await expect(page.getByTestId("contract-reference")).toHaveText(reference);
}

/** Lie l'appareil de l'immeuble au contrat ouvert. */
async function linkUnit(page: Page, siteName: string): Promise<void> {
  await page.getByLabel("Lier un appareil").selectOption({ label: `${siteName} — Ascenseur A` });
  await page.getByRole("button", { name: "Lier" }).click();
  await expect(page.getByTestId("contract-units-list").getByText("Ascenseur A")).toBeVisible();
}

test("un contrat crée ses visites plannifiables sur douze mois", async ({ page }) => {
  const siteName = unique("Résidence Gironde ");
  const reference = unique("CT-");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, unique("quai des Chartrons "));
  await createContract(page, reference);

  // Lier l'appareil suffit : les visites suivent, sans clic de plus (R4.2).
  await linkUnit(page, siteName);

  await expect(page.getByText(`${VISITS_PER_YEAR} visites au planning`)).toBeVisible();
});

test("les visites générées attendent au backlog, échéance en tête", async ({ page }) => {
  const siteName = unique("Résidence Garonne ");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, unique("cours Victor Hugo "));
  await createContract(page, unique("CT-"));
  await linkUnit(page, siteName);

  await page.getByRole("link", { name: "Planning" }).click();
  const backlog = page.getByTestId("planning-backlog");

  // Les cartes de cet immeuble, dans l'ordre où le dispatcher les voit.
  const cards = backlog.locator('[data-testid="planning-card"]', { hasText: siteName });
  await expect(cards).toHaveCount(VISITS_PER_YEAR);
  await expect(cards.first()).toContainText("Visite");
  await expect(cards.first()).toContainText("à faire avant le");

  // Trié par échéance croissante : la plus proche d'abord (R6.2).
  const deadlines = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.match(/à faire avant le (.+)$/)?.[1] ?? ""),
  );
  expect(deadlines.filter((deadline) => deadline !== "")).toHaveLength(VISITS_PER_YEAR);
});

test("une visite générée se planifie comme un OT ordinaire", async ({ page }) => {
  const siteName = unique("Résidence Dordogne ");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, unique("rue Sainte-Catherine "));
  await createContract(page, unique("CT-"));
  await linkUnit(page, siteName);

  await page.getByRole("link", { name: "Planning" }).click();
  const card = page
    .getByTestId("planning-backlog")
    .locator('[data-testid="planning-card"]', { hasText: siteName })
    .first();
  const reference = await card.locator("span").first().innerText();

  // Même geste qu'au lot L1.7 : prendre, entrer dans la grille, déposer.
  const live = page.locator('[id^="DndLiveRegion"]');
  await card.focus();
  await card.press(" ");
  await expect(live).toContainText("Sur la liste à planifier");
  await card.press("ArrowRight");
  await expect(live).not.toHaveText("Sur la liste à planifier.");
  await card.press(" ");
  await expect(live).toContainText("Déposé sur");

  // L'affectation a été écrite, et le statut suit (spec 008, R4.2).
  await page.getByRole("link", { name: "OT", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toContainText("Planifié");
});

test("regénérer ne crée aucun doublon", async ({ page }) => {
  const siteName = unique("Résidence Médoc ");

  await signInToApp(page);
  await createSiteWithUnit(page, siteName, unique("avenue du Médoc "));
  await createContract(page, unique("CT-"));
  await linkUnit(page, siteName);
  await expect(page.getByText(`${VISITS_PER_YEAR} visites au planning`)).toBeVisible();

  await page.getByRole("button", { name: "Générer sur 12 mois" }).click();

  // Le message distingue « rien à faire » d'une vraie création : sans lui, un
  // clic idempotent ne dirait rien à l'utilisateur (R3.4).
  await expect(page.getByTestId("generation-result")).toHaveText("Tout était déjà planifié.");
  await expect(page.getByText(`${VISITS_PER_YEAR} visites au planning`)).toBeVisible();
});
