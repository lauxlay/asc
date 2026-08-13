import { randomUUID } from "node:crypto";
import { isoDate, type Site, type Unit } from "@asc/domain";
import { DEFAULT_TENANT_ID } from "./auth/auth.service.js";
import { hashPassword } from "./auth/password.js";
import { loadConfig } from "./config/env.js";
import { JsonSiteRepository } from "./modules/sites/json-site.repository.js";
import { JsonUnitRepository } from "./modules/units/json-unit.repository.js";
import { JsonUserRepository } from "./modules/users/json-user.repository.js";
import { JsonCollectionStore } from "./storage/json-collection-store.js";

/**
 * Jeu de données de démonstration (`docs/03-application/09-decoupage-execution-opus.md`,
 * garde-fou n°3) : les e2e et les démos design partners tournent dessus.
 *
 * Idempotent sur l'utilisateur (identifiant fixe), donc rejouable sans
 * dupliquer le compte de démonstration.
 */

const DEMO_EMAIL = "dispatcher@ascenseur.test";
const DEMO_PASSWORD = "ascenseur-demo-2026";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Identifiants fixes : les tests e2e s'appuient sur ces deux immeubles, et un
 * UUID tiré au hasard à chaque exécution les rendrait impossibles à cibler.
 */
const DEMO_SITE_1_ID = "00000000-0000-4000-8000-000000000011";
const DEMO_SITE_2_ID = "00000000-0000-4000-8000-000000000012";

const DEMO_SITES: readonly Site[] = [
  {
    id: DEMO_SITE_1_ID,
    tenantId: DEFAULT_TENANT_ID,
    name: "Résidence Les Tilleuls",
    addressLine: "12 rue des Lilas",
    postalCode: "69003",
    city: "Lyon",
  },
  {
    id: DEMO_SITE_2_ID,
    tenantId: DEFAULT_TENANT_ID,
    name: "Le Clos Fleuri",
    addressLine: "8 avenue de la Gare",
    postalCode: "69100",
    city: "Villeurbanne",
  },
];

export async function seed(dataDir: string): Promise<void> {
  const store = new JsonCollectionStore(dataDir);
  const users = new JsonUserRepository(store);
  const sites = new JsonSiteRepository(store);
  const units = new JsonUnitRepository(store);

  await users.save({
    id: DEMO_USER_ID,
    tenantId: DEFAULT_TENANT_ID,
    email: DEMO_EMAIL,
    role: "dispatcher",
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });

  // Idempotent : identifiants fixes, `save` remplace au lieu de dupliquer.
  for (const site of DEMO_SITES) {
    await sites.save(site);
  }

  const existing = await units.findAll(DEFAULT_TENANT_ID);
  if (existing.length === 0) {
    const demoUnits: readonly Unit[] = [
      {
        id: randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        siteId: DEMO_SITE_1_ID,
        reference: "Ascenseur A",
        commissionedOn: isoDate("2015-06-01"),
        lastStatutoryInspectionOn: isoDate("2021-06-15"),
      },
      {
        id: randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        siteId: DEMO_SITE_2_ID,
        reference: "Ascenseur unique",
        commissionedOn: isoDate("2022-11-20"),
        lastStatutoryInspectionOn: null,
      },
    ];
    for (const unit of demoUnits) {
      await units.save(unit);
    }
  }

  process.stdout.write(
    `Seed terminé dans ${dataDir}\n  utilisateur : ${DEMO_EMAIL}\n  mot de passe : ${DEMO_PASSWORD}\n`,
  );
}

await seed(loadConfig().DATA_DIR);
