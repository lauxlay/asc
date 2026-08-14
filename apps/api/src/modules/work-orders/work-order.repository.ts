import type { Id, WorkOrder } from "@asc/domain";

/**
 * Port de persistance des ordres de travail (ADR-001).
 *
 * Deux particularités par rapport aux autres ports, toutes deux voulues :
 *
 * 1. **`create` attribue la référence**, au lieu de laisser le service la
 *    composer. L'attribution du rang annuel doit être atomique pour ne jamais
 *    produire deux fois le même numéro (spec 007, R6.3) : elle appartient donc
 *    à l'adaptateur, seul à savoir rendre son écriture atomique. En SQL, ce
 *    sera une séquence ; en JSON, un compteur sous verrou de fichier.
 * 2. **`findAll` rend du plus récent au plus ancien**, à l'inverse de tous les
 *    autres ports. Ce n'est pas un oubli : un dispatcher veut voir ce qui vient
 *    d'arriver, pas ce qu'il a saisi il y a six mois (spec 007, R9.1). Ne pas
 *    « corriger » cet ordre par réflexe de régularité.
 */
export interface WorkOrderRepository {
  /**
   * Insère l'OT en lui attribuant sa référence annuelle.
   *
   * Le service fournit tout le reste, identifiant compris — la génération
   * d'UUID reste là où elle est partout ailleurs.
   */
  create(draft: WorkOrderDraft): Promise<WorkOrder>;

  /** `null` si l'OT n'existe pas **ou** appartient à un autre tenant. */
  findById(tenantId: Id, id: Id): Promise<WorkOrder | null>;

  /** Tous les OT du tenant, **du plus récent au plus ancien**. */
  findAll(tenantId: Id): Promise<readonly WorkOrder[]>;

  /** Remplace un OT existant, référence comprise. Ne renumérote jamais. */
  save(workOrder: WorkOrder): Promise<void>;

  /** `true` si un OT a bien été supprimé, `false` s'il n'existait pas. */
  deleteById(tenantId: Id, id: Id): Promise<boolean>;
}

/** OT à créer : tout sauf la référence, que l'adaptateur attribue. */
export type WorkOrderDraft = Omit<WorkOrder, "reference">;
