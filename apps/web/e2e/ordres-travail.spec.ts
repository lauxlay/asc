import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/session";

/**
 * Saisie d'un ordre de travail (lot L1.6, spec 007).
 *
 * Le parcours de référence des principes UX : téléphone à l'oreille, recherche
 * de l'immeuble par adresse, criticité, description. Et surtout le raccourci du
 * benchmark — sur un incident déjà signalé, on rattache au lieu de ressaisir.
 *
 * **Pas de chronomètre** : Playwright remplit un formulaire en une seconde, un
 * tel chiffre mesurerait la machine et pas l'humain au téléphone. Ce qui est
 * vérifié ici, c'est le **nombre de champs** — contrainte structurelle qui ne
 * peut pas dériver sans faire échouer le test — et le raccourci du doublon, qui
 * est ce qui fait vraiment tomber le temps de saisie en usage réel.
 *
 * Chaque test crée ses propres immeubles : la suite tourne en parallèle sur une
 * API partagée.
 */

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
  await page.getByLabel("Code postal").fill("59000");
  await page.getByLabel("Ville").fill("Lille");
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

/** Ouvre la saisie et sélectionne l'appareil par recherche d'adresse. */
async function selectUnit(page: Page, street: string, unitReference: string): Promise<void> {
  await page.getByRole("link", { name: "OT", exact: true }).click();
  await page.getByRole("link", { name: "Nouvel OT" }).click();
  await expect(page.getByRole("heading", { name: "Nouvel OT" })).toBeVisible();

  await page.getByLabel("Immeuble ou adresse").fill(street);
  await page
    .getByTestId("unit-choices")
    .getByRole("button", { name: unitReference, exact: true })
    .click();
  await expect(page.getByTestId("selected-unit")).toContainText(unitReference);
}

test("le dispatcher saisit une panne en cherchant l'immeuble par son adresse", async ({ page }) => {
  const siteName = "Résidence Vauban";
  const street = "1 rue Vauban";

  await openApp(page);
  await createSiteWithUnits(page, siteName, street, ["Ascenseur A"]);
  await selectUnit(page, street, "Ascenseur A");

  // Aucun OT ouvert : on va droit au formulaire.
  await expect(page.getByTestId("duplicate-list")).toHaveCount(0);

  await page.getByLabel("Description").fill("Cabine bloquée au 3e");
  await page.getByRole("button", { name: "Créer l'OT" }).click();

  await expect(page.getByTestId("work-order-reference")).toHaveText(/^OT-\d{4}-\d{5}$/);
  await expect(page.getByText("Cabine bloquée au 3e")).toBeVisible();
  await expect(page.getByTestId("report-count")).toContainText("1");
});

test("la saisie ne demande jamais plus de quatre champs", async ({ page }) => {
  const siteName = "Résidence Solférino";
  const street = "2 rue Solférino";

  await openApp(page);
  await createSiteWithUnits(page, siteName, street, ["Ascenseur A"]);
  await selectUnit(page, street, "Ascenseur A");

  // Cible chiffrée de 07-principes-ux.md : « jamais plus de 4 champs ». On
  // compte les contrôles du formulaire — criticité, description, contact — plus
  // la recherche d'appareil déjà utilisée pour arriver ici.
  const controls = page.getByTestId("work-order-form").locator("input, select, textarea");
  await expect(controls).toHaveCount(3);

  // Et un seul est obligatoire : le reste a une valeur par défaut ou est
  // facultatif. « L'utilisateur corrige l'exception, il ne saisit pas la règle. »
  await expect(page.getByTestId("work-order-form").locator("[required]")).toHaveCount(1);
});

test("un second signalement se rattache à l'OT ouvert au lieu d'en créer un autre", async ({
  page,
}) => {
  const siteName = "Résidence Gambetta";
  const street = "3 rue Gambetta";

  await openApp(page);
  await createSiteWithUnits(page, siteName, street, ["Ascenseur A"]);

  // Premier appel : le gardien signale la panne.
  await selectUnit(page, street, "Ascenseur A");
  await page.getByLabel("Description").fill("Ascenseur à l'arrêt");
  await page.getByRole("button", { name: "Créer l'OT" }).click();

  // Attendre que la référence soit réellement chargée avant de la lire : le
  // titre existe dès le rendu, avec « Chargement… » tant que la requête est en
  // vol. Sans cette garde, on capture le libellé d'attente sur une machine
  // lente.
  const referenceHeading = page.getByTestId("work-order-reference");
  await expect(referenceHeading).toHaveText(/^OT-\d{4}-\d{5}$/);
  const reference = await referenceHeading.innerText();

  // Second appel, vingt minutes plus tard : un résident signale la même chose.
  await selectUnit(page, street, "Ascenseur A");

  // L'écran montre l'incident connu avant de proposer un formulaire.
  await expect(page.getByTestId("duplicate-list")).toContainText(reference);
  await expect(page.getByTestId("duplicate-list")).toContainText("Ascenseur à l'arrêt");

  await page.getByRole("button", { name: "Rattacher ce signalement" }).click();

  // On retombe sur le même OT, avec deux signalements — et pas un second OT.
  await expect(page.getByTestId("work-order-reference")).toHaveText(reference);
  await expect(page.getByTestId("report-count")).toContainText("2");

  await page.getByRole("link", { name: "OT", exact: true }).click();
  await expect(
    page.getByTestId("work-orders-rows").getByRole("row").filter({ hasText: reference }),
  ).toHaveCount(1);
});

test("une personne bloquée ouvre le script de désincarcération", async ({ page }) => {
  const siteName = "Résidence Jeanne d'Arc";
  const street = "4 place Jeanne d'Arc";

  await openApp(page);
  await createSiteWithUnits(page, siteName, street, ["Ascenseur A"]);
  await selectUnit(page, street, "Ascenseur A");

  await page.getByLabel("Criticité").selectOption("entrapment");
  await page.getByLabel("Description").fill("Deux personnes bloquées entre le 2e et le 3e");
  await page.getByRole("button", { name: "Créer l'OT" }).click();

  // Les trois questions fermées des protocoles de désincarcération.
  const script = page.getByTestId("entrapment-script");
  await expect(script).toContainText("Urgence médicale");
  await expect(script).toContainText("Personnes en cabine");
  await expect(script).toContainText("Entre deux étages");

  // Aucune n'a encore été posée : « non demandé » n'est pas « non ».
  await expect(script).toContainText("non demandé");
});

test("un OT clôturé ne se rouvre pas et l'écran le dit", async ({ page }) => {
  const siteName = "Résidence Barbieux";
  const street = "5 avenue Barbieux";

  await openApp(page);
  await createSiteWithUnits(page, siteName, street, ["Ascenseur A"]);
  await selectUnit(page, street, "Ascenseur A");
  await page.getByLabel("Description").fill("Porte qui frotte");
  await page.getByRole("button", { name: "Créer l'OT" }).click();

  // Le cycle de vie : à traiter → en cours → clôturé.
  await page.getByTestId("status-actions").getByRole("button", { name: "En cours" }).click();
  await expect(page.getByTestId("status-actions")).toBeVisible();
  await page.getByTestId("status-actions").getByRole("button", { name: "Clôturé" }).click();

  await expect(page.getByTestId("terminal-status")).toBeVisible();
  await expect(page.getByTestId("status-actions")).toHaveCount(0);
});

test("le contact de l'immeuble pré-remplit le contact sur place", async ({ page }) => {
  const siteName = "Résidence Wazemmes";
  const street = "6 rue Wazemmes";
  const client = "Cabinet Wazemmes";

  await openApp(page);
  await createSiteWithUnits(page, siteName, street, ["Ascenseur A"]);

  // Rattacher l'immeuble à un client, puis y déclarer sa gardienne.
  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Nom du client").fill(client);
  await page.getByLabel("Type de client").selectOption("managing_agent");
  await page.getByRole("button", { name: "Créer le client" }).click();

  await page.getByText(client, { exact: true }).click();
  await page
    .getByLabel("Rattacher un immeuble")
    .selectOption({ label: `${siteName} — ${street}, Lille` });
  await page.getByRole("button", { name: "Rattacher" }).click();
  await expect(page.getByTestId("customer-sites-list").getByText(siteName)).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un contact" }).click();
  await page.getByLabel("Nom du contact").fill("Martine Ferrand");
  await page.getByLabel("Rôle").fill("Gardienne");
  await page.getByLabel("Téléphone").fill("0320000000");
  await page.getByLabel("Immeuble concerné").selectOption({ label: siteName });
  await page.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(page.getByTestId("contacts-list").getByText("Martine Ferrand")).toBeVisible();

  // La saisie d'un OT sur cet immeuble propose la gardienne sans rien demander.
  await selectUnit(page, street, "Ascenseur A");

  await expect(page.getByLabel("Contact sur place")).toHaveValue(/Martine Ferrand/);
  await expect(page.getByLabel("Contact sur place")).toHaveValue(/Gardienne/);
});
