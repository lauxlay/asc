import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/session";

/**
 * Parcours client du dispatcher (lot L1.2, spec 003).
 *
 * Le parcours métier réel : un syndic signe, le dispatcher le saisit et lui
 * rattache les immeubles de son portefeuille. C'est la sortie vérifiable du
 * lot — « créer un client, rattacher 2 sites ».
 *
 * Chaque test crée ses propres immeubles : la suite tourne en parallèle sur une
 * API partagée, et se disputer les immeubles du seed la rendrait instable.
 */

async function openClients(page: Page): Promise<void> {
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();
  await page.getByRole("link", { name: "Clients" }).click();
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
}

const ADDRESS_LINE = "1 place du Marché";

/**
 * Libellé exact de l'option de rattachement, tel que la fiche client le rend
 * (`nom — voie, ville`). `selectOption` n'accepte qu'un libellé littéral.
 */
function attachOption(name: string, city: string): string {
  return `${name} — ${ADDRESS_LINE}, ${city}`;
}

/** Crée un immeuble sans client depuis l'écran de parc. */
async function createUnattachedSite(page: Page, name: string, city: string): Promise<void> {
  await page.getByRole("link", { name: "Parc", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();

  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Nom de l'immeuble").fill(name);
  await page.getByLabel("Adresse", { exact: true }).fill(ADDRESS_LINE);
  await page.getByLabel("Code postal").fill("44000");
  await page.getByLabel("Ville").fill(city);
  await page.getByRole("button", { name: "Créer le site" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function createCustomer(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Nom du client").fill(name);
  await page.getByLabel("Type de client").selectOption("managing_agent");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test("le dispatcher crée un client et lui rattache deux immeubles", async ({ page }) => {
  const client = "Cabinet Bertrand";
  const premier = "Résidence du Canal";
  const second = "Villa Marguerite";

  await openClients(page);

  // Deux immeubles encore sans syndic.
  await createUnattachedSite(page, premier, "Nantes");
  await createUnattachedSite(page, second, "Nantes");

  await page.getByRole("link", { name: "Clients" }).click();
  await createCustomer(page, client);

  await page.getByText(client).click();
  await expect(page.getByTestId("customer-name")).toHaveText(client);
  await expect(page.getByTestId("customer-sites-empty")).toBeVisible();

  // Rattachement des deux immeubles, l'un après l'autre.
  for (const immeuble of [premier, second]) {
    await page
      .getByLabel("Rattacher un immeuble")
      .selectOption({ label: attachOption(immeuble, "Nantes") });
    await page.getByRole("button", { name: "Rattacher" }).click();
    await expect(page.getByTestId("customer-sites-list").getByText(immeuble)).toBeVisible();
  }

  await expect(page.getByTestId("customer-sites-list").getByRole("listitem")).toHaveCount(2);

  // Et l'immeuble connaît son client.
  await page.getByTestId("customer-sites-list").getByText(premier).click();
  await expect(page.getByTestId("site-customer")).toContainText(client);
});

test("le dispatcher déclare le gardien d'un immeuble rattaché", async ({ page }) => {
  const client = "Cabinet Lemoine";
  const immeuble = "Les Terrasses";

  await openClients(page);
  await createUnattachedSite(page, immeuble, "Rennes");
  await page.getByRole("link", { name: "Clients" }).click();
  await createCustomer(page, client);

  await page.getByText(client).click();
  await page
    .getByLabel("Rattacher un immeuble")
    .selectOption({ label: attachOption(immeuble, "Rennes") });
  await page.getByRole("button", { name: "Rattacher" }).click();
  await expect(page.getByTestId("customer-sites-list").getByText(immeuble)).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un contact" }).click();
  await page.getByLabel("Nom du contact").fill("Martine Ferrand");
  await page.getByLabel("Rôle").fill("Gardienne");
  await page.getByLabel("Téléphone").fill("0400000000");
  await page.getByLabel("Immeuble concerné").selectOption({ label: immeuble });
  await page.getByRole("button", { name: "Ajouter le contact" }).click();

  await expect(page.getByTestId("contacts-list").getByText("Martine Ferrand")).toBeVisible();
  await expect(page.getByTestId("contacts-list").getByText("Gardienne")).toBeVisible();
});

test("un immeuble détaché redevient disponible pour un autre client", async ({ page }) => {
  const client = "Cabinet Rivière";
  const immeuble = "Le Belvédère";

  await openClients(page);
  await createUnattachedSite(page, immeuble, "Angers");
  await page.getByRole("link", { name: "Clients" }).click();
  await createCustomer(page, client);

  await page.getByText(client).click();
  await page
    .getByLabel("Rattacher un immeuble")
    .selectOption({ label: attachOption(immeuble, "Angers") });
  await page.getByRole("button", { name: "Rattacher" }).click();
  await expect(page.getByTestId("customer-sites-list").getByText(immeuble)).toBeVisible();

  await page.getByRole("button", { name: "Détacher" }).click();

  await expect(page.getByTestId("customer-sites-empty")).toBeVisible();
  // Il réapparaît dans les immeubles rattachables.
  await expect(page.getByLabel("Rattacher un immeuble")).toContainText(immeuble);
});

test("le parc affiche un immeuble sans client sans se casser", async ({ page }) => {
  // Régression L1.1 : `customerId` est nullable, l'écran doit rester lisible.
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Parc" })).toBeVisible();

  await page.getByLabel("Rechercher une adresse").fill("avenue de la Gare");
  await page.getByText("Le Clos Fleuri").click();

  await expect(page.getByTestId("site-customer")).toHaveText("Aucun client rattaché");
});
