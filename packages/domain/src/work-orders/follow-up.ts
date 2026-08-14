import type { Id, WorkOrder } from "../entities.js";

/**
 * Chaînage des ordres de travail (spec 007, R5).
 *
 * Un OT clôturé ne se rouvre pas : on en crée un nouveau qui déclare prendre sa
 * suite. Deux cas réels — une panne qui revient après une intervention
 * clôturée, et une réparation qui fait suite au diagnostic d'un dépannage.
 *
 * Fonctions pures : elles valident la forme de la chaîne, sans rien lire ni
 * écrire.
 */

/**
 * `true` si déclarer `followUpOf` sur `id` fermerait la chaîne sur elle-même.
 *
 * Une chaîne cyclique rendrait `followUpChainOf` infinie et, surtout, ne
 * voudrait rien dire : un OT ne peut pas être sa propre origine.
 *
 * `existing` doit déjà être restreint au tenant de l'appelant — le domaine ne
 * connaît pas les tenants.
 */
export function wouldCreateFollowUpCycle(
  id: Id,
  followUpOf: Id | null,
  existing: readonly WorkOrder[],
): boolean {
  if (followUpOf === null) {
    return false;
  }
  if (followUpOf === id) {
    return true;
  }

  const byId = new Map(existing.map((workOrder) => [workOrder.id, workOrder]));
  const seen = new Set<Id>([id]);
  let current: Id | null = followUpOf;

  while (current !== null) {
    if (seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = byId.get(current)?.followUpOf ?? null;
  }
  return false;
}

/**
 * Chaîne remontée depuis un OT jusqu'à son origine, celui-ci **exclu**.
 *
 * Rend `[]` pour un OT qui n'est la suite de rien. S'arrête sur un maillon
 * introuvable plutôt que d'échouer : une donnée incomplète ne doit pas rendre
 * une fiche illisible.
 */
export function followUpChainOf(
  workOrder: WorkOrder,
  existing: readonly WorkOrder[],
): readonly WorkOrder[] {
  const byId = new Map(existing.map((candidate) => [candidate.id, candidate]));
  const chain: WorkOrder[] = [];
  const seen = new Set<Id>([workOrder.id]);
  let current = workOrder.followUpOf;

  while (current !== null && !seen.has(current)) {
    const parent = byId.get(current);
    if (parent === undefined) {
      break;
    }
    chain.push(parent);
    seen.add(parent.id);
    current = parent.followUpOf;
  }
  return chain;
}

/** OT déclarant prendre la suite de celui-ci, dans l'ordre de la collection. */
export function followedUpBy(
  workOrder: WorkOrder,
  existing: readonly WorkOrder[],
): readonly WorkOrder[] {
  return existing.filter((candidate) => candidate.followUpOf === workOrder.id);
}
