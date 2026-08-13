import type { Contract, Id } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { ContractRepository } from "./contract.repository.js";
import { contractSchema } from "./contract.schema.js";

const COLLECTION = "contracts";

/**
 * Adaptateur JSON du port `ContractRepository` — implémentation Phase 0 (ADR-001).
 *
 * Sera remplacé par `SqliteContractRepository` en Phase 1 : la suite de tests
 * de contrat (`contract.repository.contract.ts`) valide alors l'équivalence.
 */
export class JsonContractRepository implements ContractRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async findById(tenantId: Id, id: Id): Promise<Contract | null> {
    const contracts = await this.findAll(tenantId);
    return contracts.find((contract) => contract.id === id) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Contract[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, contractSchema);
  }

  async save(contract: Contract): Promise<void> {
    await this.#store.update(
      { tenantId: contract.tenantId, collection: COLLECTION },
      contractSchema,
      (contracts) => {
        const index = contracts.findIndex((candidate) => candidate.id === contract.id);
        if (index === -1) {
          return [...contracts, contract];
        }
        return contracts.map((candidate, position) => (position === index ? contract : candidate));
      },
    );
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    let deleted = false;
    await this.#store.update({ tenantId, collection: COLLECTION }, contractSchema, (contracts) => {
      const remaining = contracts.filter((contract) => contract.id !== id);
      deleted = remaining.length !== contracts.length;
      return remaining;
    });
    return deleted;
  }
}
