import type { WorkOrderStatus } from "../entities.js";

/**
 * Cycle de vie d'un ordre de travail (spec 007, R3).
 *
 * Fonction pure : elle dit ce qui est permis, pas ce qui se passe. La
 * traduction en réponse HTTP est affaire de frontière.
 */

/**
 * Transitions **demandables par le client** depuis chaque statut.
 *
 * `done` et `cancelled` ne mènent nulle part : un OT clôturé est une trace de
 * ce qui s'est passé. Le rouvrir effacerait cette trace — on en crée un
 * nouveau.
 *
 * `assigned` n'est la cible d'aucune ligne, et c'est délibéré (spec 008,
 * R4.2) : on n'y entre pas en demandant un statut, mais en affectant l'OT au
 * planning. L'autoriser ici permettrait un OT `assigned` sans technicien ni
 * jour — exactement l'incohérence que l'invariant de `assignment.ts` interdit.
 * Un OT `new` peut en revanche démarrer sans être passé par le planning : un
 * technicien déjà sur place appelle, le dispatcher note que c'est commencé.
 */
const ALLOWED: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  new: ["in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
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

/**
 * Longueur du rang : 99 999 OT par an, très au-delà d'une PME — 1 500 appareils
 * à 9 visites produisent environ 13 500 OT annuels.
 */
const REFERENCE_DIGITS = 5;

/**
 * Numéro d'OT lisible (spec 007, R6) : `OT-2026-00042`.
 *
 * Année plus rang remis à zéro chaque année, comme un numéro de facture
 * française. On situe l'OT dans le temps sans rien ouvrir, on classe par année,
 * et le numéro reste court à dicter au téléphone — ce qu'un UUID n'est pas.
 */
export function formatWorkOrderReference(year: number, sequence: number): string {
  return `OT-${year}-${String(sequence).padStart(REFERENCE_DIGITS, "0")}`;
}
