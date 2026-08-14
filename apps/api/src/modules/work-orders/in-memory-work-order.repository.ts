import { formatWorkOrderReference, type Id, type WorkOrder } from "@asc/domain";
import { yearOf } from "./json-work-order.repository.js";
import type { WorkOrderDraft, WorkOrderRepository } from "./work-order.repository.js";

/**
 * Adaptateur mémoire du port `WorkOrderRepository`.
 *
 * Il existe pour deux raisons :
 * 1. prouver que la suite de tests de contrat est réellement indépendante de
 *    l'implémentation — validée contre une seule, elle ne prouverait rien ;
 * 2. donner aux tests des couches supérieures un stockage sans disque.
 *
 * Ce n'est pas un mode de fonctionnement de l'application : rien ne survit au
 * redémarrage. Le compteur de numérotation non plus, ce qui est cohérent —
 * il repart de 1 comme un tenant neuf.
 */
export class InMemoryWorkOrderRepository implements WorkOrderRepository {
  /** Ordre d'insertion préservé, comme le fichier JSON. */
  readonly #workOrders = new Map<string, WorkOrder>();
  /** Prochain rang par couple (tenant, année). */
  readonly #sequences = new Map<string, number>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  async create(draft: WorkOrderDraft): Promise<WorkOrder> {
    const [created] = await this.createMany([draft]);
    // `createMany` d'un seul brouillon rend toujours un OT.
    return created as WorkOrder;
  }

  /** Rangs consécutifs réservés d'un coup, comme l'adaptateur JSON. */
  async createMany(drafts: readonly WorkOrderDraft[]): Promise<readonly WorkOrder[]> {
    const [first] = drafts;
    if (first === undefined) {
      return [];
    }

    const year = yearOf(first.reportedAt);
    const sequenceKey = `${first.tenantId} ${year}`;
    const from = this.#sequences.get(sequenceKey) ?? 1;
    this.#sequences.set(sequenceKey, from + drafts.length);

    const created = drafts.map((draft, index) => ({
      ...draft,
      reference: formatWorkOrderReference(year, from + index),
    }));
    for (const workOrder of created) {
      await this.save(workOrder);
    }
    return created;
  }

  async findById(tenantId: Id, id: Id): Promise<WorkOrder | null> {
    return this.#workOrders.get(InMemoryWorkOrderRepository.#keyOf(tenantId, id)) ?? null;
  }

  /** Du plus récent au plus ancien : l'inverse de l'ordre d'insertion (R9.1). */
  async findAll(tenantId: Id): Promise<readonly WorkOrder[]> {
    return [...this.#workOrders.values()]
      .filter((workOrder) => workOrder.tenantId === tenantId)
      .reverse();
  }

  async save(workOrder: WorkOrder): Promise<void> {
    this.#workOrders.set(InMemoryWorkOrderRepository.#keyOf(workOrder.tenantId, workOrder.id), {
      ...workOrder,
      entrapment: workOrder.entrapment === null ? null : { ...workOrder.entrapment },
    });
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    return this.#workOrders.delete(InMemoryWorkOrderRepository.#keyOf(tenantId, id));
  }
}
