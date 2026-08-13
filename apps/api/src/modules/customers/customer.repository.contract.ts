import type { Customer } from "@asc/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CustomerRepository } from "./customer.repository.js";

/**
 * Suite de tests de **contrat** du port `CustomerRepository` (ADR-001).
 *
 * Une seule suite, exécutée contre chaque implémentation : JSON aujourd'hui,
 * SQLite demain. C'est elle qui garantit qu'une migration de stockage ne change
 * aucun comportement observable — la promesse centrale de l'ADR-001.
 */

export interface CustomerRepositoryHarness {
  readonly repository: CustomerRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "customer-1",
    tenantId: TENANT_A,
    name: "Cabinet Dupont",
    type: "managing_agent",
    ...overrides,
  };
}

export function describeCustomerRepositoryContract(
  implementation: string,
  createHarness: () => Promise<CustomerRepositoryHarness>,
): void {
  describe(`contrat CustomerRepository — ${implementation}`, () => {
    let harness: CustomerRepositoryHarness;
    let repository: CustomerRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    describe("findById", () => {
      it("rend null quand le client n'existe pas", async () => {
        expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
      });

      it("rend le client enregistré", async () => {
        const customer = makeCustomer();
        await repository.save(customer);

        expect(await repository.findById(TENANT_A, customer.id)).toStrictEqual(customer);
      });

      it("conserve chaque type de client à l'identique", async () => {
        await repository.save(makeCustomer({ id: "c-1", type: "managing_agent" }));
        await repository.save(makeCustomer({ id: "c-2", type: "condominium" }));
        await repository.save(makeCustomer({ id: "c-3", type: "business" }));
        await repository.save(makeCustomer({ id: "c-4", type: "individual" }));

        expect((await repository.findById(TENANT_A, "c-1"))?.type).toBe("managing_agent");
        expect((await repository.findById(TENANT_A, "c-2"))?.type).toBe("condominium");
        expect((await repository.findById(TENANT_A, "c-3"))?.type).toBe("business");
        expect((await repository.findById(TENANT_A, "c-4"))?.type).toBe("individual");
      });
    });

    describe("save", () => {
      it("remplace le client existant au lieu d'en créer un deuxième", async () => {
        await repository.save(makeCustomer({ name: "Cabinet Dupont" }));
        await repository.save(makeCustomer({ name: "Cabinet Durand" }));

        const customers = await repository.findAll(TENANT_A);

        expect(customers).toHaveLength(1);
        expect(customers[0]?.name).toBe("Cabinet Durand");
      });

      it("garde les autres clients intacts", async () => {
        await repository.save(makeCustomer({ id: "customer-1" }));
        await repository.save(makeCustomer({ id: "customer-2" }));
        await repository.save(makeCustomer({ id: "customer-1", name: "Cabinet Durand" }));

        expect(await repository.findById(TENANT_A, "customer-2")).toStrictEqual(
          makeCustomer({ id: "customer-2" }),
        );
      });
    });

    describe("findAll", () => {
      it("rend une liste vide pour un tenant sans données", async () => {
        expect(await repository.findAll("tenant-vide")).toStrictEqual([]);
      });

      it("préserve l'ordre d'insertion", async () => {
        await repository.save(makeCustomer({ id: "customer-3" }));
        await repository.save(makeCustomer({ id: "customer-1" }));
        await repository.save(makeCustomer({ id: "customer-2" }));

        const ids = (await repository.findAll(TENANT_A)).map((customer) => customer.id);

        expect(ids).toStrictEqual(["customer-3", "customer-1", "customer-2"]);
      });

      it("rend un instantané détaché du magasin", async () => {
        await repository.save(makeCustomer({ id: "customer-1" }));
        const snapshot = await repository.findAll(TENANT_A);
        await repository.save(makeCustomer({ id: "customer-2" }));

        expect(snapshot).toHaveLength(1);
      });
    });

    describe("deleteById", () => {
      it("supprime et rend true", async () => {
        await repository.save(makeCustomer());

        expect(await repository.deleteById(TENANT_A, "customer-1")).toBe(true);
        expect(await repository.findById(TENANT_A, "customer-1")).toBeNull();
      });

      it("rend false quand le client n'existe pas", async () => {
        expect(await repository.deleteById(TENANT_A, "inconnu")).toBe(false);
      });

      it("ne touche pas aux autres clients", async () => {
        await repository.save(makeCustomer({ id: "customer-1" }));
        await repository.save(makeCustomer({ id: "customer-2" }));
        await repository.deleteById(TENANT_A, "customer-1");

        expect(await repository.findAll(TENANT_A)).toHaveLength(1);
      });
    });

    describe("isolation entre tenants", () => {
      it("ne rend pas par findById le client d'un autre tenant", async () => {
        await repository.save(makeCustomer({ id: "customer-1", tenantId: TENANT_A }));

        expect(await repository.findById(TENANT_B, "customer-1")).toBeNull();
      });

      it("ne mélange pas les listes de deux tenants", async () => {
        await repository.save(makeCustomer({ id: "customer-1", tenantId: TENANT_A }));
        await repository.save(makeCustomer({ id: "customer-2", tenantId: TENANT_B }));

        expect((await repository.findAll(TENANT_A)).map((customer) => customer.id)).toStrictEqual([
          "customer-1",
        ]);
        expect((await repository.findAll(TENANT_B)).map((customer) => customer.id)).toStrictEqual([
          "customer-2",
        ]);
      });

      it("laisse coexister le même identifiant dans deux tenants", async () => {
        await repository.save(
          makeCustomer({ id: "customer-1", tenantId: TENANT_A, name: "Dupont" }),
        );
        await repository.save(
          makeCustomer({ id: "customer-1", tenantId: TENANT_B, name: "Durand" }),
        );

        expect((await repository.findById(TENANT_A, "customer-1"))?.name).toBe("Dupont");
        expect((await repository.findById(TENANT_B, "customer-1"))?.name).toBe("Durand");
      });

      it("ne supprime pas l'homonyme d'un autre tenant", async () => {
        await repository.save(makeCustomer({ id: "customer-1", tenantId: TENANT_A }));
        await repository.save(makeCustomer({ id: "customer-1", tenantId: TENANT_B }));

        expect(await repository.deleteById(TENANT_A, "customer-1")).toBe(true);
        expect(await repository.findById(TENANT_B, "customer-1")).not.toBeNull();
      });
    });
  });
}
