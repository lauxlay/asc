import type { WorkOrderStatus } from "../entities.js";

/**
 * Cycle de vie d'un ordre de travail (spec 007, R3).
 *
 * Fonction pure : elle dit ce qui est permis, pas ce qui se passe. La
 * traduction en réponse HTTP est affaire de frontière.
 */

/**
 * Transitions autorisées depuis chaque statut.
 *
 * `done` et `cancelled` ne mènent nulle part : un OT clôturé est une trace de
 * ce qui s'est passé. Le rouvrir effacerait cette trace — on en crée un
 * nouveau.
 */
const ALLOWED: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  new: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

/** Statuts atteignables depuis `status`, dans un ordre stable. */
export function allowedTransitionsFrom(status: WorkOrderStatus): readonly WorkOrderStatus[] {
  return ALLOWED[status];
}

/**
 * `true` si le passage est permis.
 *
 * Rester sur place n'est pas une transition : réenregistrer le même statut est
 * refusé, pour que l'appelant ne croie pas avoir changé quelque chose.
 */
export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** `true` si aucune transition ne sort de ce statut. */
export function isTerminalStatus(status: WorkOrderStatus): boolean {
  return ALLOWED[status].length === 0;
}

/** Longueur du numéro : 999 999 OT couvrent largement la vie du produit chez une PME. */
const REFERENCE_DIGITS = 6;

/**
 * Numéro d'OT lisible à partir d'un rang de séquence (spec 007, R6).
 *
 * `OT-000042` se cite au téléphone et se lit dans un rapport ; un UUID, non.
 */
export function formatWorkOrderReference(sequence: number): string {
  return `OT-${String(sequence).padStart(REFERENCE_DIGITS, "0")}`;
}
