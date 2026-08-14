import { WORK_ORDER_PRIORITIES, type WorkOrderPriority } from "../entities.js";

/**
 * Ordre d'affichage des OT pour le dispatcher (spec 008, R5.4 et R6.1).
 *
 * Le plus critique d'abord, puis le plus ancien : une désincarcération est en
 * tête, toujours, et à criticité égale c'est celui qui attend depuis le plus
 * longtemps qui passe devant.
 */

/** Le strict nécessaire pour ordonner — le comparateur ne lit rien d'autre. */
export interface DispatchOrdered {
  readonly priority: WorkOrderPriority;
  /** Horodatage ISO du premier signalement. */
  readonly reportedAt: string;
}

/**
 * Rang de criticité : `WORK_ORDER_PRIORITIES` est déjà déclaré du plus grave
 * au moins grave, l'ordre d'affichage ne peut donc pas diverger de lui.
 */
function urgencyRank(priority: WorkOrderPriority): number {
  return WORK_ORDER_PRIORITIES.indexOf(priority);
}

/** Comparateur : négatif si `a` passe avant `b`. */
export function compareByUrgency(a: DispatchOrdered, b: DispatchOrdered): number {
  const byPriority = urgencyRank(a.priority) - urgencyRank(b.priority);
  if (byPriority !== 0) {
    return byPriority;
  }
  return a.reportedAt < b.reportedAt ? -1 : a.reportedAt > b.reportedAt ? 1 : 0;
}

/**
 * Copie triée. À signalement simultané et criticité égale, l'ordre d'entrée est
 * conservé — le tri de JavaScript est stable depuis ES2019.
 */
export function sortByUrgency<T extends DispatchOrdered>(workOrders: readonly T[]): readonly T[] {
  return [...workOrders].sort(compareByUrgency);
}
