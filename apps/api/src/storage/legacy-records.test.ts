import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonSiteRepository } from "../modules/sites/json-site.repository.js";
import { JsonUnitRepository } from "../modules/units/json-unit.repository.js";
import { CURRENT_SCHEMA_VERSION, JsonCollectionStore } from "./json-collection-store.js";

/**
 * Lecture des fichiers écrits par une version antérieure.
 *
 * Le volume `data/` survit aux déploiements (ADR-002) : chaque champ ajouté à
 * une entité doit rester lisible sur le stock existant, sinon l'API ne
 * redémarre plus après la mise à jour. Ces tests figent cette garantie — ils
 * échoueraient au premier champ obligatoire ajouté sans valeur par défaut.
 */

const TENANT = "default";

let rootDir: string;
let store: JsonCollectionStore;

async function writeLegacyCollection(collection: string, items: unknown[]): Promise<void> {
  const tenantDir = join(rootDir, TENANT);
  await mkdir(tenantDir, { recursive: true });
  await writeFile(
    join(tenantDir, `${collection}.json`),
    JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, items }),
    "utf8",
  );
}

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "asc-legacy-"));
  store = new JsonCollectionStore(rootDir);
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("sites écrits avant le lot L1.2", () => {
  it("se lisent sans customerId, rattachés à personne", async () => {
    await writeLegacyCollection("sites", [
      {
        id: "site-1",
        tenantId: TENANT,
        name: "Résidence Les Tilleuls",
        addressLine: "12 rue des Lilas",
        postalCode: "69003",
        city: "Lyon",
      },
    ]);

    const site = await new JsonSiteRepository(store).findById(TENANT, "site-1");

    expect(site?.customerId).toBeNull();
    expect(site?.name).toBe("Résidence Les Tilleuls");
  });
});

describe("appareils écrits avant le lot L1.1", () => {
  it("se lisent sans reference, avec un repère visiblement provisoire", async () => {
    await writeLegacyCollection("units", [
      {
        id: "unit-1",
        tenantId: TENANT,
        siteId: "site-1",
        commissionedOn: "2015-06-01",
        lastStatutoryInspectionOn: null,
      },
    ]);

    const unit = await new JsonUnitRepository(store).findById(TENANT, "unit-1");

    expect(unit?.reference).toBe("Sans repère");
    expect(unit?.commissionedOn).toBe("2015-06-01");
  });

  it("réécrit le champ manquant dès la première sauvegarde", async () => {
    await writeLegacyCollection("units", [
      {
        id: "unit-1",
        tenantId: TENANT,
        siteId: "site-1",
        commissionedOn: null,
        lastStatutoryInspectionOn: null,
      },
    ]);
    const units = new JsonUnitRepository(store);

    const legacy = await units.findById(TENANT, "unit-1");
    expect(legacy).not.toBeNull();
    if (legacy !== null) {
      await units.save({ ...legacy, reference: "Ascenseur A" });
    }

    expect((await units.findById(TENANT, "unit-1"))?.reference).toBe("Ascenseur A");
  });
});
