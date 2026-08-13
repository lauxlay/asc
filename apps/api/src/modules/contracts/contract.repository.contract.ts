import { type Contract, isoDate } from "@asc/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContractRepository } from "./contract.repository.js";

/**
 * Suite de tests de **contrat** du port `ContractRepository` (ADR-001).
 *
 * Une seule suite, exécutée contre chaque implémentation : JSON aujourd'hui,
 * SQLite demain. C'est elle qui garantit qu'une migration de stockage ne change
 * aucun comportement observable — la promesse centrale de l'ADR-001.
 */

export interface ContractRepositoryHarness {
  readonly repository: ContractRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    tenantId: TENANT_A,
    reference: "CT-2026-001",
    type: "minimal",
    unitIds: ["unit-1"],
    startsOn: isoDate("2026-01-01"),
    endsOn: null,
    ...overrides,
  };
}

export function describeContractRepositoryContract(
  implementation: string,
  createHarness: () => Promise<ContractRepositoryHarness>,
): void {
  describe(`contrat ContractRepository — ${implementation}`, () => {
    let harness: ContractRepositoryHarness;
    let repository: ContractRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    describe("findById", () => {
      it("rend null quand le contrat n'existe pas", async () => {
        expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
      });

      it("rend le contrat enregistré", async () => {
        const contract = makeContract();
        await repository.save(contract);

        expect(await repository.findById(TENANT_A, contract.id)).toStrictEqual(contract);
      });

      it("conserve les deux types de contrat", async () => {
        await repository.save(makeContract({ id: "c-1", type: "minimal" }));
        await repository.save(makeContract({ id: "c-2", type: "extended" }));

        expect((await repository.findById(TENANT_A, "c-1"))?.type).toBe("minimal");
        expect((await repository.findById(TENANT_A, "c-2"))?.type).toBe("extended");
      });

      it("conserve la liste d'appareils et le terme, y compris vides ou nuls", async () => {
        const sansAppareil = makeContract({ id: "c-vide", unitIds: [], endsOn: null });
        await repository.save(sansAppareil);
        expect(await repository.findById(TENANT_A, "c-vide")).toStrictEqual(sansAppareil);

        const complet = makeContract({
          id: "c-plein",
          unitIds: ["unit-1", "unit-2", "unit-3"],
          endsOn: isoDate("2027-01-01"),
        });
        await repository.save(complet);
        expect(await repository.findById(TENANT_A, "c-plein")).toStrictEqual(complet);
      });

      it("rend une liste d'appareils détachée de celle qu'on lui a passée", async () => {
        const unitIds = ["unit-1"];
        await repository.save(makeContract({ unitIds }));
        unitIds.push("unit-ajouté-après-coup");

        expect((await repository.findById(TENANT_A, "contract-1"))?.unitIds).toStrictEqual([
          "unit-1",
        ]);
      });
    });

    describe("save", () => {
      it("remplace le contrat existant au lieu d'en créer un deuxième", async () => {
        await repository.save(makeContract({ reference: "CT-A" }));
        await repository.save(makeContract({ reference: "CT-B" }));

        const contracts = await repository.findAll(TENANT_A);

        expect(contracts).toHaveLength(1);
        expect(contracts[0]?.reference).toBe("CT-B");
      });

      it("garde les autres contrats intacts", async () => {
        await repository.save(makeContract({ id: "contract-1" }));
        await repository.save(makeContract({ id: "contract-2" }));
        await repository.save(makeContract({ id: "contract-1", reference: "CT-Z" }));

        expect(await repository.findById(TENANT_A, "contract-2")).toStrictEqual(
          makeContract({ id: "contract-2" }),
        );
      });
    });

    describe("findAll", () => {
      it("rend une liste vide pour un tenant sans données", async () => {
        expect(await repository.findAll("tenant-vide")).toStrictEqual([]);
      });

      it("préserve l'ordre d'insertion", async () => {
        await repository.save(makeContract({ id: "contract-3" }));
        await repository.save(makeContract({ id: "contract-1" }));
        await repository.save(makeContract({ id: "contract-2" }));

        const ids = (await repository.findAll(TENANT_A)).map((contract) => contract.id);

        expect(ids).toStrictEqual(["contract-3", "contract-1", "contract-2"]);
      });

      it("rend un instantané détaché du magasin", async () => {
        await repository.save(makeContract({ id: "contract-1" }));
        const snapshot = await repository.findAll(TENANT_A);
        await repository.save(makeContract({ id: "contract-2" }));

        expect(snapshot).toHaveLength(1);
      });
    });

    describe("deleteById", () => {
      it("supprime et rend true", async () => {
        await repository.save(makeContract());

        expect(await repository.deleteById(TENANT_A, "contract-1")).toBe(true);
        expect(await repository.findById(TENANT_A, "contract-1")).toBeNull();
      });

      it("rend false quand le contrat n'existe pas", async () => {
        expect(await repository.deleteById(TENANT_A, "inconnu")).toBe(false);
      });

      it("ne touche pas aux autres contrats", async () => {
        await repository.save(makeContract({ id: "contract-1" }));
        await repository.save(makeContract({ id: "contract-2" }));
        await repository.deleteById(TENANT_A, "contract-1");

        expect(await repository.findAll(TENANT_A)).toHaveLength(1);
      });
    });

    describe("isolation entre tenants", () => {
      it("ne rend pas par findById le contrat d'un autre tenant", async () => {
        await repository.save(makeContract({ id: "contract-1", tenantId: TENANT_A }));

        expect(await repository.findById(TENANT_B, "contract-1")).toBeNull();
      });

      it("ne mélange pas les listes de deux tenants", async () => {
        await repository.save(makeContract({ id: "contract-1", tenantId: TENANT_A }));
        await repository.save(makeContract({ id: "contract-2", tenantId: TENANT_B }));

        expect((await repository.findAll(TENANT_A)).map((c) => c.id)).toStrictEqual(["contract-1"]);
        expect((await repository.findAll(TENANT_B)).map((c) => c.id)).toStrictEqual(["contract-2"]);
      });

      it("laisse coexister le même identifiant dans deux tenants", async () => {
        await repository.save(
          makeContract({ id: "contract-1", tenantId: TENANT_A, reference: "CT-A" }),
        );
        await repository.save(
          makeContract({ id: "contract-1", tenantId: TENANT_B, reference: "CT-B" }),
        );

        expect((await repository.findById(TENANT_A, "contract-1"))?.reference).toBe("CT-A");
        expect((await repository.findById(TENANT_B, "contract-1"))?.reference).toBe("CT-B");
      });

      it("ne supprime pas l'homonyme d'un autre tenant", async () => {
        await repository.save(makeContract({ id: "contract-1", tenantId: TENANT_A }));
        await repository.save(makeContract({ id: "contract-1", tenantId: TENANT_B }));

        expect(await repository.deleteById(TENANT_A, "contract-1")).toBe(true);
        expect(await repository.findById(TENANT_B, "contract-1")).not.toBeNull();
      });
    });
  });
}
