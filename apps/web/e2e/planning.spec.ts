import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { openParc, signInToApp } from "./support/session";

/**
 * Planning de la semaine (lot L1.7, spec 008).
 *
 * Le parcours du découpage : « déplacer un OT, vérifier l'affectation
 * persistée ». Le déplacement se fait **au clavier**, et pas seulement parce
 * que c'est plus déterministe qu'un glisser-déposer simulé : c'est la règle 5
 * des principes UX, et rien d'autre ne la vérifierait.
 *
 * Chaque test crée son technicien et son immeuble : la suite tourne en
 * parallèle sur une API partagée, aucun comptage global n'est fiable.
 */

/** Une semaine fixe, loin de « aujourd'hui » : le test ne dépend pas du jour. */
const WEEK = "2027-03-15";
const MONDAY = "2027-03-15";
const TUESDAY = "2027-03-16";

/** Semaine où personne ne planifie rien : le seul endroit où « aucun OT » tient. */
const EMPTY_WEEK = "2027-09-06";

/** Mot de passe initial conforme au minimum de douze caractères (R1.5). */
const INITIAL_PASSWORD = "mot-de-passe-initial-2027";

/**
 * Suffixe unique par test.
 *
 * Tiré au hasard et non incrémenté : les workers Playwright sont des processus
 * distincts qui démarrent à la même milliseconde, un compteur de module et une
 * horloge produisent le même nom dans chacun.
 */
function unique(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

async function createTechnician(page: Page, name: string): Promise<void> {
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await expect(page.getByRole("heading", { name: "Utilisateurs" })).toBeVisible();

  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase()}@ascenseur.test`);
  await page.getByLabel("Mot de passe initial").fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Créer l'utilisateur" }).click();

  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
}

/** Crée un immeuble et un appareil, puis un OT dessus. Rend sa référence. */
async function createWorkOrder(page: Page, siteName: string, street: string): Promise<string> {
  await openParc(page);
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Nom de l'immeuble").fill(siteName);
  await page.getByLabel("Adresse", { exact: true }).fill(street);
  await page.getByLabel("Code postal").fill("31000");
  await page.getByLabel("Ville").fill("Toulouse");
  await page.getByRole("button", { name: "Créer le site" }).click();

  await page.getByText(siteName, { exact: true }).click();
  await expect(page.getByTestId("site-name")).toHaveText(siteName);
  await page.getByRole("button", { name: "Ajouter un appareil" }).click();
  await page.getByLabel("Repère").fill("Ascenseur A");
  await page.getByRole("button", { name: "Ajouter l'appareil" }).click();
  await expect(page.getByTestId("units-list").getByText("Ascenseur A")).toBeVisible();

  await page.getByRole("link", { name: "OT", exact: true }).click();
  await page.getByRole("link", { name: "Nouvel OT" }).click();
  await page.getByLabel("Immeuble ou adresse").fill(street);
  await page
    .getByTestId("unit-choices")
    .getByRole("button", { name: "Ascenseur A", exact: true })
    .click();
  // Criticité maximale, pour une raison de **test** et non de scénario : le
  // backlog est trié par criticité (R6.1) et il est partagé avec tous les
  // autres parcours, qui y laissent des OT normaux. Une désincarcération est en
  // tête de liste, donc à une position connue, quel que soit l'ordre
  // d'exécution de la suite.
  await page.getByLabel("Criticité").selectOption("entrapment");
  await page.getByLabel("Description").fill("Personne bloquée, porte ne s'ouvre plus");
  await page.getByRole("button", { name: "Créer l'OT" }).click();

  // Garde d'attente avant toute lecture : l'élément existe avant sa donnée.
  const reference = page.getByTestId("work-order-reference");
  await expect(reference).toHaveText(/^OT-\d{4}-\d{5}$/);
  return reference.innerText();
}

function card(page: Page, reference: string): Locator {
  return page.locator(`[data-testid="planning-card"][data-reference="${reference}"]`);
}

/**
 * Prend la carte au clavier, rejoint la ligne du technicien, dépose.
 *
 * Le nombre de flèches n'est pas calculé à l'avance : la suite tourne en
 * parallèle et l'ordre des lignes bouge. On presse jusqu'à **entendre** la
 * bonne ligne — ce qui vérifie du même coup que les annonces existent et
 * disent vrai (R7.3), seule chose qu'un lecteur d'écran perçoit du
 * déplacement. Arrivé en bord de grille sans l'avoir trouvée, on repart dans
 * l'autre sens : une lecture prise trop tôt coûte une flèche de trop, jamais
 * un test rouge.
 *
 * Le test vise **son propre** technicien : n'importe quelle ligne ferait
 * dépendre le résultat de ce que les autres parcours font de la leur — dont
 * celui qui en désactive une.
 */
async function planWithKeyboard(page: Page, target: Locator, technician: string): Promise<void> {
  const live = liveRegion(page);
  const announcement = async () => (await live.textContent()) ?? "";

  await target.focus();
  await target.press(" ");
  await expect(live).toContainText("Sur la liste à planifier");
  await target.press("ArrowRight");

  for (const key of ["ArrowDown", "ArrowUp"]) {
    for (let step = 0; step < 40; step += 1) {
      const before = await announcement();
      if (before.includes(technician)) {
        break;
      }
      await target.press(key);
      if ((await announcement()) === before) {
        // Bord de la grille : plus rien dans ce sens.
        break;
      }
    }
    if ((await announcement()).includes(technician)) {
      break;
    }
  }

  await expect(live).toContainText(technician);
  await target.press(" ");
  await expect(live).toContainText(`Déposé sur ${technician}`);
}

/** Renvoie la carte au backlog : des flèches à gauche jusqu'à en sortir. */
async function unplanWithKeyboard(page: Page, target: Locator): Promise<void> {
  const live = liveRegion(page);

  await target.focus();
  await target.press(" ");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (((await live.textContent()) ?? "").includes("liste à planifier")) {
      break;
    }
    await target.press("ArrowLeft");
  }

  await expect(live).toContainText("Sur la liste à planifier");
  await target.press(" ");
  await expect(live).toContainText("Déposé sur la liste à planifier");
}

/** Région d'annonces de dnd-kit — ce que lit un lecteur d'écran. */
function liveRegion(page: Page): Locator {
  return page.locator('[id^="DndLiveRegion"]');
}

/** La ligne du planning d'un technicien, ciblée par son nom exact. */
function rowOf(page: Page, technician: string): Locator {
  return page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: technician }) });
}

test("le dispatcher planifie un OT au clavier et l'affectation survit au rechargement", async ({
  page,
}) => {
  const technician = unique("Tech");
  const siteName = unique("Résidence Garonne");
  const street = unique("rue de la Garonne ");

  await signInToApp(page);
  await createTechnician(page, technician);
  const reference = await createWorkOrder(page, siteName, street);

  // Le nouvel OT arrive au backlog sans qu'on ait rien fait (R6.3).
  await page.goto(`/?semaine=${WEEK}`);
  await expect(page.getByTestId("planning-backlog").getByText(reference)).toBeVisible();

  await planWithKeyboard(page, card(page, reference), technician);

  // La carte est passée du backlog à la ligne du technicien.
  await expect(rowOf(page, technician).getByText(reference)).toBeVisible();
  await expect(page.getByTestId("planning-backlog").getByText(reference)).toHaveCount(0);

  // L'affectation a été écrite, pas seulement affichée.
  await page.reload();
  await expect(rowOf(page, technician).getByText(reference)).toBeVisible();

  // Et le statut suit l'affectation, sans que personne ne l'ait demandé (R4.2).
  await page.getByRole("link", { name: "OT", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toContainText("Planifié");
});

test("un technicien créé apparaît comme ligne du planning", async ({ page }) => {
  const technician = unique("Tech");

  await signInToApp(page);
  await createTechnician(page, technician);

  await page.goto(`/?semaine=${WEEK}`);

  await expect(rowOf(page, technician)).toBeVisible();
});

test("un OT planifié revient au backlog et redevient à traiter", async ({ page }) => {
  const technician = unique("Tech");
  const siteName = unique("Résidence Capitole");
  const street = unique("place du Capitole ");

  await signInToApp(page);
  await createTechnician(page, technician);
  const reference = await createWorkOrder(page, siteName, street);

  await page.goto(`/?semaine=${WEEK}`);

  await planWithKeyboard(page, card(page, reference), technician);
  await expect(rowOf(page, technician).getByText(reference)).toBeVisible();

  // Retour au backlog : la même opération, sans technicien ni jour (R2.5).
  await unplanWithKeyboard(page, card(page, reference));

  await expect(page.getByTestId("planning-backlog").getByText(reference)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("planning-backlog").getByText(reference)).toBeVisible();
});

test("la semaine affichée vit dans l'URL et se navigue", async ({ page }) => {
  await signInToApp(page);

  // N'importe quel jour de la semaine ramène au même lundi.
  await page.goto(`/?semaine=${TUESDAY}`);
  await expect(page.getByRole("columnheader", { name: /lun\. 15 mars/ })).toBeVisible();

  await page.getByRole("button", { name: "Semaine suivante" }).click();
  await expect(page).toHaveURL(/semaine=2027-03-22/);
  await expect(page.getByRole("columnheader", { name: /lun\. 22 mars/ })).toBeVisible();

  await page.getByRole("button", { name: "Semaine précédente" }).click();
  await expect(page).toHaveURL(new RegExp(`semaine=${MONDAY}`));

  // Le lien se partage : un rechargement rend la même semaine.
  await page.reload();
  await expect(page.getByRole("columnheader", { name: /lun\. 15 mars/ })).toBeVisible();
});

test("un technicien désactivé quitte le planning et ne peut plus se connecter", async ({
  page,
}) => {
  const technician = unique("Tech");

  await signInToApp(page);
  await createTechnician(page, technician);

  await page.goto(`/?semaine=${EMPTY_WEEK}`);
  await expect(rowOf(page, technician)).toBeVisible();

  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page
    .getByRole("row", { name: new RegExp(technician) })
    .getByRole("button", { name: "Désactiver" })
    .click();
  await expect(page.getByRole("row", { name: new RegExp(technician) })).toContainText("Désactivé");

  // Il ne porte aucun OT cette semaine-là : sa ligne disparaît (R5.3, a
  // contrario). D'où la semaine réservée : sur la semaine commune, un autre
  // parcours pourrait lui avoir posé un OT, et sa ligne devrait alors rester.
  await page.goto(`/?semaine=${EMPTY_WEEK}`);
  await expect(rowOf(page, technician)).toHaveCount(0);

  // Et son compte est fermé, sans que l'écran de connexion le dise (R1.9).
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByLabel("Email").fill(`${technician.toLowerCase()}@ascenseur.test`);
  await page.getByLabel("Mot de passe").fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByRole("alert")).toHaveText("Identifiants invalides");
});
