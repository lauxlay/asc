import type { ContractType } from "@asc/domain";

/**
 * Libellés français des contrats et des échéances.
 *
 * Le code est en anglais, l'écran est en français : la traduction vit ici, à
 * la frontière de l'affichage, et nulle part ailleurs.
 */

export const CONTRACT_TYPE_LABELS: Readonly<Record<ContractType, string>> = {
  minimal: "Minimal",
  extended: "Étendu",
};

export const DEADLINE_KIND_LABELS: Readonly<Record<string, string>> = {
  visit_6w: "Visite périodique",
  inspection_5y: "Contrôle quinquennal",
};

export const DEADLINE_STATUS_LABELS: Readonly<Record<string, string>> = {
  ok: "À jour",
  due_soon: "Bientôt due",
  overdue: "En retard",
};

/**
 * Couleur du statut.
 *
 * Le rouge du retard est la seule couleur métier du produit : c'est l'alerte
 * réglementaire, elle ne doit pas se confondre avec le reste de l'interface.
 */
export const DEADLINE_STATUS_CLASS: Readonly<Record<string, string>> = {
  ok: "text-[var(--color-muted-foreground)]",
  due_soon: "font-medium",
  overdue: "font-medium text-[var(--color-destructive)]",
};
