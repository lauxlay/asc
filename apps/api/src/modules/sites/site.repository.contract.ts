import type { Site } from "@asc/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SiteRepository } from "./site.repository.js";

/**
 * Suite de tests de **contrat** du port `SiteRepository` (ADR-001).
 *
 * Une seule suite, exécutée contre chaque implémentation : JSON aujourd'hui,
 * SQLite demain. C'est elle qui garantit qu'une migration de stockage ne change
 * aucun comportement observable — la promesse centrale de l'ADR-001.
 *
 * Elle ne teste que ce que le **port** promet. Tout ce qui est propre à une
 * implémentation (format de fichier, atomicité, verrous) est testé à côté.
 */

export interface SiteRepositoryHarness {
  readonly repository: SiteRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: "site-1",
    tenantId: TENANT_A,
    customerId: null,
    name: "Résidence Les Tilleuls",
    addressLine: "12 rue des Lilas",
    postalCode: "69003",
    city: "Lyon",
    ...overrides,
  };
}

export function describeSiteRepositoryContract(
  implementation: string,
  createHarness: () => Promise<SiteRepositoryHarness>,
): void {
  describe(`contrat SiteRepository — ${implementation}`, () => {
    let harness: SiteRepositoryHarness;
    let repository: SiteRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    describe("findById", () => {
      it("rend null quand le site n'existe pas", async () => {
        expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
      });

      it("rend le site enregistré", async () => {
        const site = makeSite();
        await repository.save(site);

        expect(await repository.findById(TENANT_A, site.id)).toStrictEqual(site);
      });

      it("conserve les accents et la ponctuation de l'adresse à l'identique", async () => {
        const site = makeSite({
          name: "Résidence de l'Église",
          addressLine: "3 bis, allée Saint-Étienne",
          city: "Saint-Étienne",
        });
        await repository.save(site);

        expect(await repository.findById(TENANT_A, site.id)).toStrictEqual(site);
      });
    });

    describe("save", () => {
      it("remplace le site existant au lieu d'en créer un deuxième", async () => {
        await repository.save(makeSite({ city: "Lyon" }));
        await repository.save(makeSite({ city: "Villeurbanne" }));

        const sites = await repository.findAll(TENANT_A);

        expect(sites).toHaveLength(1);
        expect(sites[0]?.city).toBe("Villeurbanne");
      });

      it("garde les autres sites intacts", async () => {
        await repository.save(makeSite({ id: "site-1" }));
        await repository.save(makeSite({ id: "site-2" }));
        await repository.save(makeSite({ id: "site-1", city: "Villeurbanne" }));

        expect(await repository.findById(TENANT_A, "site-2")).toStrictEqual(
          makeSite({ id: "site-2" }),
        );
      });
    });

    describe("findAll", () => {
      it("rend une liste vide pour un tenant sans données", async () => {
        expect(await repository.findAll("tenant-vide")).toStrictEqual([]);
      });

      it("préserve l'ordre d'insertion", async () => {
        await repository.save(makeSite({ id: "site-3" }));
        await repository.save(makeSite({ id: "site-1" }));
        await repository.save(makeSite({ id: "site-2" }));

        const ids = (await repository.findAll(TENANT_A)).map((site) => site.id);

        expect(ids).toStrictEqual(["site-3", "site-1", "site-2"]);
      });

      it("rend un instantané détaché du magasin", async () => {
        await repository.save(makeSite({ id: "site-1" }));
        const snapshot = await repository.findAll(TENANT_A);
        await repository.save(makeSite({ id: "site-2" }));

        expect(snapshot).toHaveLength(1);
      });
    });

    describe("deleteById", () => {
      it("supprime et rend true", async () => {
        await repository.save(makeSite());

        expect(await repository.deleteById(TENANT_A, "site-1")).toBe(true);
        expect(await repository.findById(TENANT_A, "site-1")).toBeNull();
      });

      it("rend false quand le site n'existe pas", async () => {
        expect(await repository.deleteById(TENANT_A, "inconnu")).toBe(false);
      });

      it("ne touche pas aux autres sites", async () => {
        await repository.save(makeSite({ id: "site-1" }));
        await repository.save(makeSite({ id: "site-2" }));
        await repository.deleteById(TENANT_A, "site-1");

        expect(await repository.findAll(TENANT_A)).toHaveLength(1);
      });
    });

    describe("isolation entre tenants", () => {
      it("ne rend pas par findById le site d'un autre tenant", async () => {
        await repository.save(makeSite({ id: "site-1", tenantId: TENANT_A }));

        expect(await repository.findById(TENANT_B, "site-1")).toBeNull();
      });

      it("ne mélange pas les listes de deux tenants", async () => {
        await repository.save(makeSite({ id: "site-1", tenantId: TENANT_A }));
        await repository.save(makeSite({ id: "site-2", tenantId: TENANT_B }));

        expect((await repository.findAll(TENANT_A)).map((site) => site.id)).toStrictEqual([
          "site-1",
        ]);
        expect((await repository.findAll(TENANT_B)).map((site) => site.id)).toStrictEqual([
          "site-2",
        ]);
      });

      it("laisse coexister le même identifiant dans deux tenants", async () => {
        await repository.save(makeSite({ id: "site-1", tenantId: TENANT_A, city: "Lyon" }));
        await repository.save(makeSite({ id: "site-1", tenantId: TENANT_B, city: "Marseille" }));

        expect((await repository.findById(TENANT_A, "site-1"))?.city).toBe("Lyon");
        expect((await repository.findById(TENANT_B, "site-1"))?.city).toBe("Marseille");
      });

      it("ne supprime pas l'homonyme d'un autre tenant", async () => {
        await repository.save(makeSite({ id: "site-1", tenantId: TENANT_A }));
        await repository.save(makeSite({ id: "site-1", tenantId: TENANT_B }));

        expect(await repository.deleteById(TENANT_A, "site-1")).toBe(true);
        expect(await repository.findById(TENANT_B, "site-1")).not.toBeNull();
      });
    });
  });
}
