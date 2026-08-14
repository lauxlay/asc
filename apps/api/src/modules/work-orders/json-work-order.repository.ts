import { formatWorkOrderReference, type Id, type WorkOrder } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { WorkOrderDraft, WorkOrderRepository } from "./work-order.repository.js";
import { workOrderSchema, workOrderSequenceSchema } from "./work-order.schema.js";

const COLLECTION = "work_orders";
const SEQUENCES = "work_order_sequences";

/**
 * Adaptateur JSON du port `WorkOrderRepository` — implémentation Phase 0 (ADR-001).
 *
 * Sera remplacé par `SqliteWorkOrderRepository` en Phase 1 : la suite de tests
 * de contrat (`work-order.repository.contract.ts`) valide alors l'équivalence,
 * numérotation comprise.
 */
export class JsonWorkOrderRepository implements WorkOrderRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async create(draft: WorkOrderDraft): Promise<WorkOrder> {
    const year = yearOf(draft.reportedAt);
    const sequence = await this.#claimSequence(draft.tenantId, year);
    const workOrder: WorkOrder = {
      ...draft,
      reference: formatWorkOrderReference(year, sequence),
    };
    await this.save(workOrder);
    return workOrder;
  }

  /**
   * Un seul rang réservé pour tout le lot, une seule écriture de la collection.
   *
   * Tous les OT d'un lot portent la même année de signalement — ils sont créés
   * dans la même seconde — d'où un unique appel à la séquence.
   */
  async createMany(drafts: readonly WorkOrderDraft[]): Promise<readonly WorkOrder[]> {
    const [first] = drafts;
    if (first === undefined) {
      return [];
    }

    const year = yearOf(first.reportedAt);
    const from = await this.#claimSequenceRange(first.tenantId, year, drafts.length);
    const created = drafts.map((draft, index) => ({
      ...draft,
      reference: formatWorkOrderReference(year, from + index),
    }));

    await this.#store.update(
      { tenantId: first.tenantId, collection: COLLECTION },
      workOrderSchema,
      (workOrders) => [...workOrders, ...created],
    );
    return created;
  }

  async findById(tenantId: Id, id: Id): Promise<WorkOrder | null> {
    const workOrders = await this.#insertionOrder(tenantId);
    return workOrders.find((workOrder) => workOrder.id === id) ?? null;
  }

  /** Du plus récent au plus ancien : l'inverse de l'ordre d'insertion (R9.1). */
  async findAll(tenantId: Id): Promise<readonly WorkOrder[]> {
    return [...(await this.#insertionOrder(tenantId))].reverse();
  }

  async save(workOrder: WorkOrder): Promise<void> {
    await this.#store.update(
      { tenantId: workOrder.tenantId, collection: COLLECTION },
      workOrderSchema,
      (workOrders) => {
        const index = workOrders.findIndex((candidate) => candidate.id === workOrder.id);
        if (index === -1) {
          return [...workOrders, workOrder];
        }
        return workOrders.map((candidate, position) =>
          position === index ? workOrder : candidate,
        );
      },
    );
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    let deleted = false;
    await this.#store.update(
      { tenantId, collection: COLLECTION },
      workOrderSchema,
      (workOrders) => {
        const remaining = workOrders.filter((workOrder) => workOrder.id !== id);
        deleted = remaining.length !== workOrders.length;
        return remaining;
      },
    );
    return deleted;
  }

  /** Ordre du fichier, c'est-à-dire l'ordre de création. */
  async #insertionOrder(tenantId: Id): Promise<readonly WorkOrder[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, workOrderSchema);
  }

  /**
   * Réserve le prochain rang de l'année, sous le verrou du magasin.
   *
   * Le compteur est incrémenté **avant** l'écriture de l'OT : si celle-ci
   * échoue, le rang est perdu. Un trou dans la numérotation est sans
   * conséquence ; un numéro attribué deux fois ne l'est pas.
   */
  async #claimSequence(tenantId: Id, year: number): Promise<number> {
    return this.#claimSequenceRange(tenantId, year, 1);
  }

  /**
   * Réserve `count` rangs consécutifs, en une seule prise du verrou.
   *
   * Réserver un par un laisserait une autre requête s'intercaler au milieu du
   * lot : les références d'une même génération ne seraient plus contiguës, et
   * on perdrait la seule chose qui les rend lisibles à l'écran.
   */
  async #claimSequenceRange(tenantId: Id, year: number, count: number): Promise<number> {
    const id = String(year);
    let claimed = 1;

    await this.#store.update(
      { tenantId, collection: SEQUENCES },
      workOrderSequenceSchema,
      (rows) => {
        const current = rows.find((row) => row.id === id);
        claimed = current?.next ?? 1;
        const updated = { id, tenantId, next: claimed + count };
        return current === undefined
          ? [...rows, updated]
          : rows.map((row) => (row.id === id ? updated : row));
      },
    );

    return claimed;
  }
}

/** Année du signalement : c'est elle qui numérote, pas celle de la clôture (R6.4). */
export function yearOf(timestamp: string): number {
  return new Date(timestamp).getUTCFullYear();
}
