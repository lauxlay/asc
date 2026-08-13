import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/session";

/**
 * Parcours d'import de parc (lot L1.3, spec 004).
 *
 * C'est le premier écran d'un prospect qui arrive avec son Excel : sans lui,
 * pas d'onboarding. La sortie vérifiable du lot est « importer 50 appareils
 * depuis un CSV, vérifier le parc ».
 *
 * Chaque test importe **ses** adresses : la suite tourne en parallèle sur une
 * API partagée, et deux imports qui se disputent un immeuble se gêneraient.
 */

/** En-têtes tels qu'un export de parc les nomme, séparateur français. */
const HEADER = "Immeuble;Adresse;CP;Ville;N° appareil;Mise en service";

/**
 * Un parc de `count` appareils, deux par immeuble, sur une voie propre au test.
 *
 * Ville volontairement distincte de celles du jeu de démonstration et des
 * autres parcours : la suite tourne en parallèle sur une API partagée, et un
 * import massif ferait déborder toute recherche par ville d'un autre test.
 */
const IMPORT_CITY = "Chambéry";

function parcCsv(street: string, count: number): string {
  const rows = Array.from({ length: count }, (_value, index) => {
    const building = Math.floor(index / 2) + 1;
    const reference = index % 2 === 0 ? "Ascenseur A" : "Ascenseur B";
    return `Résidence ${building} ${street};${building} rue ${street};73000;${IMPORT_CITY};${reference};2015-06-01`;
  });
  return [HEADER, ...rows].join("\n");
}

async function openImport(page: Page): Promise<void> {
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
  await page.getByRole("link", { name: "Import" }).click();
  await expect(page.getByRole("heading", { name: "Importer un parc" })).toBeVisible();
}

/** Dépose un CSV dans le champ fichier, sans passer par le disque. */
async function chooseCsv(page: Page, name: string, csv: string): Promise<void> {
  await page.getByLabel("Fichier CSV").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
}

test("le dispatcher importe 50 appareils depuis un CSV et les retrouve dans le parc", async ({
  page,
}) => {
  await openImport(page);
  await chooseCsv(page, "parc.csv", parcCsv("des Peupliers", 50));

  // La correspondance est devinée, l'aperçu montre ce qui sera créé.
  await expect(page.getByTestId("import-summary")).toContainText("50 ligne(s)");
  await expect(page.getByTestId("import-summary")).toContainText("25 immeuble(s) créé(s)");
  await expect(page.getByTestId("import-summary")).toContainText("50 appareil(s)");
  await expect(page.getByTestId("import-preview").getByRole("row")).toHaveCount(5);
  await expect(page.getByTestId("import-issues")).toHaveCount(0);

  await page.getByRole("button", { name: "Importer 50 appareil(s)" }).click();

  await expect(page.getByTestId("import-result")).toContainText("50 appareil(s) importé(s)");

  // Le parc contient bien les immeubles importés.
  await page.getByRole("link", { name: "Voir le parc" }).click();
  await page.getByLabel("Rechercher une adresse").fill("rue des Peupliers");
  await expect(page.getByTestId("sites-list").getByRole("listitem")).toHaveCount(25);

  // Et l'un d'eux porte ses deux appareils.
  await page.getByText("Résidence 1 des Peupliers", { exact: true }).click();
  await expect(page.getByTestId("units-list").getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Ascenseur A")).toBeVisible();
  await expect(page.getByText("Ascenseur B")).toBeVisible();
});

test("un fichier fautif est refusé en bloc, avec le numéro de ligne", async ({ page }) => {
  await openImport(page);
  await chooseCsv(
    page,
    "parc-fautif.csv",
    [
      HEADER,
      "Résidence A;1 rue des Bleuets;73000;Chambéry;Ascenseur A;2015-06-01",
      "Résidence B;;73000;Chambéry;Ascenseur A;2015-06-01",
      "Résidence C;3 rue des Bleuets;73000;Chambéry;Ascenseur A;32/13/2015",
    ].join("\n"),
  );

  await expect(page.getByTestId("import-issues-title")).toContainText("2 problème(s)");
  await expect(page.getByTestId("import-issues")).toContainText("Ligne 3");
  await expect(page.getByTestId("import-issues")).toContainText("Ligne 4");

  // Le bouton d'import reste hors d'atteinte tant que le fichier est fautif.
  await expect(page.getByRole("button", { name: /Importer/ })).toBeDisabled();
});

test("le dispatcher corrige à la main une colonne mal devinée", async ({ page }) => {
  await openImport(page);
  // En-têtes qu'aucun synonyme ne couvre : rien n'est deviné.
  await chooseCsv(
    page,
    "parc-anonyme.csv",
    ["Col1;Col2;Col3;Col4;Col5", "Le Belvédère;9 rue des Muguets;44000;Nantes;Ascenseur A"].join(
      "\n",
    ),
  );

  await expect(page.getByTestId("import-issues-title")).toBeVisible();

  await page.getByLabel("Nom de l'immeuble *").selectOption({ label: "Col1" });
  await page.getByLabel("Adresse *").selectOption({ label: "Col2" });
  await page.getByLabel("Code postal *").selectOption({ label: "Col3" });
  await page.getByLabel("Ville *").selectOption({ label: "Col4" });
  await page.getByLabel("Repère de l'appareil *").selectOption({ label: "Col5" });

  await expect(page.getByTestId("import-issues")).toHaveCount(0);
  await expect(page.getByTestId("import-summary")).toContainText("1 appareil(s)");

  await page.getByRole("button", { name: "Importer 1 appareil(s)" }).click();
  await expect(page.getByTestId("import-result")).toContainText("1 appareil(s) importé(s)");
});

test("réimporter le même fichier ne duplique pas le parc", async ({ page }) => {
  const csv = parcCsv("des Cerisiers", 4);

  await openImport(page);
  await chooseCsv(page, "parc.csv", csv);
  await page.getByRole("button", { name: "Importer 4 appareil(s)" }).click();
  await expect(page.getByTestId("import-result")).toContainText("4 appareil(s) importé(s)");

  // Deuxième dépôt du même fichier : tout est déjà là.
  await chooseCsv(page, "parc.csv", csv);

  await expect(page.getByTestId("import-issues-title")).toContainText("4 problème(s)");
  await expect(page.getByTestId("import-issues")).toContainText("existe déjà");
  await expect(page.getByRole("button", { name: /Importer/ })).toBeDisabled();
});

test("un immeuble importé se rattache à un client", async ({ page }) => {
  // Imbrication L1.2 : l'import laisse `customerId` à null, le rattachement
  // manuel doit continuer de fonctionner sur ces immeubles.
  const client = "Cabinet Import";

  await openImport(page);
  await chooseCsv(
    page,
    "parc.csv",
    [HEADER, "Le Chêne;5 rue des Ormes;35000;Rennes;Ascenseur A;"].join("\n"),
  );
  await page.getByRole("button", { name: "Importer 1 appareil(s)" }).click();
  await expect(page.getByTestId("import-result")).toBeVisible();

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Nom du client").fill(client);
  await page.getByLabel("Type de client").selectOption("managing_agent");
  await page.getByRole("button", { name: "Créer le client" }).click();

  await page.getByText(client).click();
  await page
    .getByLabel("Rattacher un immeuble")
    .selectOption({ label: "Le Chêne — 5 rue des Ormes, Rennes" });
  await page.getByRole("button", { name: "Rattacher" }).click();

  await expect(page.getByTestId("customer-sites-list").getByText("Le Chêne")).toBeVisible();
});
