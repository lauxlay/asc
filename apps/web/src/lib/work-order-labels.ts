import type { WorkOrderPriority, WorkOrderStatus, WorkOrderType } from "@asc/domain";

/**
 * Libellés français des ordres de travail.
 *
 * Le code est en anglais, l'écran est en français : la traduction vit ici, à la
 * frontière de l'affichage. Le vocabulaire est celui du glossaire — on dit
 * « OT » partout, jamais « intervention » ici et « ticket » là
 * (`docs/02-produit/07-principes-ux.md`).
 */

export const WORK_ORDER_TYPE_LABELS: Readonly<Record<WorkOrderType, string>> = {
  visit: "Visite",
  breakdown: "Panne",
  repair: "Réparation",
};

export const WORK_ORDER_STATUS_LABELS: Readonly<Record<WorkOrderStatus, string>> = {
  new: "À traiter",
  in_progress: "En cours",
  done: "Clôturé",
  cancelled: "Annulé",
};

export const WORK_ORDER_PRIORITY_LABELS: Readonly<Record<WorkOrderPriority, string>> = {
  entrapment: "Personne bloquée",
  urgent: "Urgent",
  normal: "Normal",
};

/**
 * Couleur de la criticité.
 *
 * Le rouge est réservé au réglementaire et au P0 (`07-principes-ux.md`,
 * règle 4). Une personne bloquée en cabine est la seule criticité qui le porte :
 * peindre aussi « urgent » en rouge tuerait le signal.
 */
export const WORK_ORDER_PRIORITY_CLASS: Readonly<Record<WorkOrderPriority, string>> = {
  entrapment: "font-medium text-[var(--color-destructive)]",
  urgent: "font-medium",
  normal: "text-[var(--color-muted-foreground)]",
};

/** Ancienneté lisible d'un horodatage : « il y a 25 min ». */
export function timeAgo(timestamp: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(timestamp)) / 60_000);
  if (minutes < 1) {
    return "à l'instant";
  }
  if (minutes < 60) {
    return `il y a ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `il y a ${hours} h`;
  }
  return `il y a ${Math.floor(hours / 24)} j`;
}
