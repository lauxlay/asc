import type { Customer, Id } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { CustomerRepository } from "./customer.repository.js";
import { customerSchema } from "./customer.schema.js";

const COLLECTION = "customers";

/**
 * Adaptateur JSON du port `CustomerRepository` — implémentation Phase 0 (ADR-001).
 *
 * Sera remplacé par `SqliteCustomerRepository` en Phase 1 : la suite de tests
 * de contrat (`customer.repository.contract.ts`) valide alors l'équivalence.
 */
export class JsonCustomerRepository implements CustomerRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async findById(tenantId: Id, id: Id): Promise<Customer | null> {
    const customers = await this.findAll(tenantId);
    return customers.find((customer) => customer.id === id) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Customer[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, customerSchema);
  }

  async save(customer: Customer): Promise<void> {
    await this.#store.update(
      { tenantId: customer.tenantId, collection: COLLECTION },
      customerSchema,
      (customers) => {
        const index = customers.findIndex((candidate) => candidate.id === customer.id);
        if (index === -1) {
          return [...customers, customer];
        }
        return customers.map((candidate, position) => (position === index ? customer : candidate));
      },
    );
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    let deleted = false;
    await this.#store.update({ tenantId, collection: COLLECTION }, customerSchema, (customers) => {
      const remaining = customers.filter((customer) => customer.id !== id);
      deleted = remaining.length !== customers.length;
      return remaining;
    });
    return deleted;
  }
}
