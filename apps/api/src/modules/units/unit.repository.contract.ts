import { isoDate, type Unit } from "@asc/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UnitRepository } from "./unit.repository.js";

/**
 * Suite de tests de **contrat** du port `UnitRepository` (ADR-001).
 *
 * Une seule suite, exécutée contre chaque implémentation : JSON aujourd'hui,
 * SQLite demain. C'est elle qui garantit qu'une migration de stockage ne change
 * aucun comportement observable — la promesse centrale de l'ADR-001.
 *
 * Elle ne teste que ce que le **port** promet. Tout ce qui est propre à une
 * implémentation (format de fichier, atomicité, verrous) est testé à côté.
 */

export interface UnitRepositoryHarness {
  readonly repository: UnitRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-1",
    tenantId: TENANT_A,
    siteId: "site-1",
    reference: "Ascenseur A",
    commissionedOn: isoDate("2015-06-01"),
    lastStatutoryInspectionOn: null,
    ...overrides,
  };
}

export function describeUnitRepositoryContract(
  implementation: string,
  createHarness: () => Promise<UnitRepositoryHarness>,
): void {
  describe(`contrat UnitRepository — ${implementation}`, () => {
    let harness: UnitRepositoryHarness;
    let repository: UnitRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    describe("findById", () => {
      it("rend null quand l'appareil n'existe pas", async () => {
        expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
      });

      it("rend l'appareil enregistré", async () => {
        const unit = makeUnit();
        await repository.save(unit);

        expect(await repository.findById(TENANT_A, unit.id)).toStrictEqual(unit);
      });

      it("conserve les dates et les champs nuls à l'identique", async () => {
        const unit = makeUnit({
          commissionedOn: isoDate("2024-02-29"),
          lastStatutoryInspectionOn: isoDate("2021-12-31"),
        });
        await repository.save(unit);

        expect(await repository.findById(TENANT_A, unit.id)).toStrictEqual(unit);

        const withoutDates = makeUnit({
          id: "unit-2",
          commissionedOn: null,
          lastStatutoryInspectionOn: null,
        });
        await repository.save(withoutDates);

        expect(await repository.findById(TENANT_A, "unit-2")).toStrictEqual(withoutDates);
      });
    });

    describe("save", () => {
      it("remplace l'appareil existant au lieu d'en créer un deuxième", async () => {
        await repository.save(makeUnit({ siteId: "site-1" }));
        await repository.save(makeUnit({ siteId: "site-2" }));

        const units = await repository.findAll(TENANT_A);

        expect(units).toHaveLength(1);
        expect(units[0]?.siteId).toBe("site-2");
      });

      it("garde les autres appareils intacts", async () => {
        await repository.save(makeUnit({ id: "unit-1" }));
        await repository.save(makeUnit({ id: "unit-2" }));
        await repository.save(makeUnit({ id: "unit-1", siteId: "site-9" }));

        expect(await repository.findById(TENANT_A, "unit-2")).toStrictEqual(
          makeUnit({ id: "unit-2" }),
        );
      });
    });

    describe("findAll", () => {
      it("rend une liste vide pour un tenant sans données", async () => {
        expect(await repository.findAll("tenant-vide")).toStrictEqual([]);
      });

      it("préserve l'ordre d'insertion", async () => {
        await repository.save(makeUnit({ id: "unit-3" }));
        await repository.save(makeUnit({ id: "unit-1" }));
        await repository.save(makeUnit({ id: "unit-2" }));

        const ids = (await repository.findAll(TENANT_A)).map((unit) => unit.id);

        expect(ids).toStrictEqual(["unit-3", "unit-1", "unit-2"]);
      });

      it("rend un instantané détaché du magasin", async () => {
        await repository.save(makeUnit({ id: "unit-1" }));
        const snapshot = await repository.findAll(TENANT_A);
        await repository.save(makeUnit({ id: "unit-2" }));

        expect(snapshot).toHaveLength(1);
      });
    });

    describe("deleteById", () => {
      it("supprime et rend true", async () => {
        await repository.save(makeUnit());

        expect(await repository.deleteById(TENANT_A, "unit-1")).toBe(true);
        expect(await repository.findById(TENANT_A, "unit-1")).toBeNull();
      });

      it("rend false quand l'appareil n'existe pas", async () => {
        expect(await repository.deleteById(TENANT_A, "inconnu")).toBe(false);
      });

      it("ne touche pas aux autres appareils", async () => {
        await repository.save(makeUnit({ id: "unit-1" }));
        await repository.save(makeUnit({ id: "unit-2" }));
        await repository.deleteById(TENANT_A, "unit-1");

        expect(await repository.findAll(TENANT_A)).toHaveLength(1);
      });
    });

    describe("isolation entre tenants", () => {
      it("ne rend pas par findById l'appareil d'un autre tenant", async () => {
        await repository.save(makeUnit({ id: "unit-1", tenantId: TENANT_A }));

        expect(await repository.findById(TENANT_B, "unit-1")).toBeNull();
      });

      it("ne mélange pas les listes de deux tenants", async () => {
        await repository.save(makeUnit({ id: "unit-1", tenantId: TENANT_A }));
        await repository.save(makeUnit({ id: "unit-2", tenantId: TENANT_B }));

        expect((await repository.findAll(TENANT_A)).map((unit) => unit.id)).toStrictEqual([
          "unit-1",
        ]);
        expect((await repository.findAll(TENANT_B)).map((unit) => unit.id)).toStrictEqual([
          "unit-2",
        ]);
      });

      it("laisse coexister le même identifiant dans deux tenants", async () => {
        await repository.save(makeUnit({ id: "unit-1", tenantId: TENANT_A, siteId: "site-a" }));
        await repository.save(makeUnit({ id: "unit-1", tenantId: TENANT_B, siteId: "site-b" }));

        expect((await repository.findById(TENANT_A, "unit-1"))?.siteId).toBe("site-a");
        expect((await repository.findById(TENANT_B, "unit-1"))?.siteId).toBe("site-b");
      });

      it("ne supprime pas l'homonyme d'un autre tenant", async () => {
        await repository.save(makeUnit({ id: "unit-1", tenantId: TENANT_A }));
        await repository.save(makeUnit({ id: "unit-1", tenantId: TENANT_B }));

        expect(await repository.deleteById(TENANT_A, "unit-1")).toBe(true);
        expect(await repository.findById(TENANT_B, "unit-1")).not.toBeNull();
      });
    });
  });
}
