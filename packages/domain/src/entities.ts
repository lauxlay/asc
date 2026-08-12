import type { IsoDate } from "./date/iso-date.js";

/**
 * Entités du domaine — glossaire FR→EN figé
 * (`docs/03-application/03-modele-donnees.md`).
 *
 * Types purs, sans dépendance framework. `tenantId` est présent dès le jour 1
 * sur chaque enregistrement (ADR-001), même avec un seul tenant.
 */

/** Identifiant applicatif (UUID généré par l'app, jamais un auto-increment — ADR-001). */
export type Id = string;

/** Appareil (ascenseur). */
export interface Unit {
  readonly id: Id;
  readonly tenantId: Id;
  readonly siteId: Id;
  /** Mise en service. Point de départ du quinquennal à défaut de contrôle connu. */
  readonly commissionedOn: IsoDate | null;
  /** Dernier contrôle technique quinquennal réalisé. */
  readonly lastStatutoryInspectionOn: IsoDate | null;
}

/**
 * Contrat d'entretien.
 *
 * `minimal` / `extended` : contrats types de l'arrêté du 7 novembre 2012
 * (`docs/02-produit/05-conformite-reglementaire.md`). Le type ne joue que sur
 * les pièces incluses, jamais sur les échéances.
 */
export interface Contract {
  readonly id: Id;
  readonly tenantId: Id;
  readonly type: "minimal" | "extended";
  readonly unitIds: readonly Id[];
  readonly startsOn: IsoDate;
  /** `null` = en cours (tacite reconduction). */
  readonly endsOn: IsoDate | null;
}

/** Visite périodique. `completedOn` à `null` = planifiée, pas encore réalisée. */
export interface MaintenanceVisit {
  readonly id: Id;
  readonly tenantId: Id;
  readonly unitId: Id;
  readonly completedOn: IsoDate | null;
}
