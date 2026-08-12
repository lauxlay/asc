import type { Id, Unit } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { UnitRepository } from "./unit.repository.js";
import { unitSchema } from "./unit.schema.js";

const COLLECTION = "units";

/**
 * Adaptateur JSON du port `UnitRepository` — implémentation Phase 0 (ADR-001).
 *
 * Sera remplacé par `SqliteUnitRepository` en Phase 1 : la suite de tests de
 * contrat (`unit.repository.contract.ts`) valide alors l'équivalence.
 */
export class JsonUnitRepository implements UnitRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async findById(tenantId: Id, id: Id): Promise<Unit | null> {
    const units = await this.findAll(tenantId);
    return units.find((unit) => unit.id === id) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Unit[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, unitSchema);
  }

  async save(unit: Unit): Promise<void> {
    await this.#store.update(
      { tenantId: unit.tenantId, collection: COLLECTION },
      unitSchema,
      (units) => {
        const index = units.findIndex((candidate) => candidate.id === unit.id);
        if (index === -1) {
          return [...units, unit];
        }
        return units.map((candidate, position) => (position === index ? unit : candidate));
      },
    );
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    let deleted = false;
    await this.#store.update({ tenantId, collection: COLLECTION }, unitSchema, (units) => {
      const remaining = units.filter((unit) => unit.id !== id);
      deleted = remaining.length !== units.length;
      return remaining;
    });
    return deleted;
  }
}
