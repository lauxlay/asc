import type { IsoDate } from "../date/iso-date.js";
import type { Id, WorkOrderStatus } from "../entities.js";

/**
 * Affectation d'un ordre de travail au planning (spec 008, R2 et R4).
 *
 * Fonctions pures : elles disent ce qui est permis et quel statut en découle,
 * jamais ce qui se passe. La traduction en réponse HTTP est affaire de
 * frontière, comme pour `status-transitions.ts`.
 */

/** Le couple technicien / jour, indissociable. */
export interface WorkOrderAssignment {
  readonly assignee: Id | null;
  readonly scheduledOn: IsoDate | null;
}

/** Un OT planifié : un technicien **et** un jour. */
export function isPlanned({ assignee, scheduledOn }: WorkOrderAssignment): boolean {
  return assignee !== null && scheduledOn !== null;
}

/** Un OT au backlog : ni technicien ni jour. */
export function isUnplanned({ assignee, scheduledOn }: WorkOrderAssignment): boolean {
  return assignee === null && scheduledOn === null;
}

/**
 * `false` sur les combinaisons mixtes — un seul des deux champs renseigné.
 *
 * C'est la règle qui empêche un OT de se perdre entre deux cases : un
 * technicien sans date est du travail sans échéance, une date sans technicien
 * du travail que personne ne voit. Ni l'un ni l'autre n'apparaît au planning.
 */
export function isCoherentAssignment(assignment: WorkOrderAssignment): boolean {
  return isPlanned(assignment) || isUnplanned(assignment);
}

/**
 * Motifs de refus d'un changement d'affectation. Chacun correspond à une règle
 * de la spec 008 ; la frontière HTTP les traduit en `422`.
 */
export type AssignmentRefusal =
  /** R2.3 — un seul des deux champs renseigné. */
  | "mixed"
  /** R4.5 — un OT clôturé ou annulé garde l'affectation qu'il avait. */
  | "terminal"
  /** R4.4 — le travail a commencé : retirer le technicien effacerait qui l'a fait. */
  | "started_unassign";

/**
 * Motif de refus, ou `null` si le changement est permis.
 *
 * Un OT `in_progress` peut être **réaffecté** — un technicien tombe malade en
 * cours de journée — mais pas **désaffecté**.
 */
export function assignmentRefusal(
  status: WorkOrderStatus,
  assignment: WorkOrderAssignment,
): AssignmentRefusal | null {
  if (!isCoherentAssignment(assignment)) {
    return "mixed";
  }
  if (status === "done" || status === "cancelled") {
    return "terminal";
  }
  if (status === "in_progress" && isUnplanned(assignment)) {
    return "started_unassign";
  }
  return null;
}

/**
 * Statut résultant d'un changement d'affectation accepté.
 *
 * Affecter un OT `new` le fait passer `assigned` ; le renvoyer au backlog le
 * fait repasser `new`. Un OT déjà commencé garde son statut : l'affectation
 * suit le travail, elle ne le pilote pas.
 *
 * À n'appeler qu'après un `assignmentRefusal` rendant `null`.
 */
export function statusAfterAssignment(
  status: WorkOrderStatus,
  assignment: WorkOrderAssignment,
): WorkOrderStatus {
  if (status !== "new" && status !== "assigned") {
    return status;
  }
  return isPlanned(assignment) ? "assigned" : "new";
}

/**
 * L'invariant de R4.3, vérifiable sur n'importe quel OT stocké.
 *
 * `assigned` vaut exactement « planifié et pas encore commencé ». Les statuts
 * de travail et terminaux acceptent les deux états — un OT peut démarrer sans
 * être passé par le planning, et un OT clôturé garde son affectation — mais
 * jamais une combinaison mixte.
 */
export function isConsistentAssignment(
  status: WorkOrderStatus,
  assignment: WorkOrderAssignment,
): boolean {
  if (status === "new") {
    return isUnplanned(assignment);
  }
  if (status === "assigned") {
    return isPlanned(assignment);
  }
  return isCoherentAssignment(assignment);
}
