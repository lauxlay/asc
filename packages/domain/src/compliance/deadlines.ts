import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareIsoDate,
  type IsoDate,
  isAfter,
  isBefore,
} from "../date/iso-date.js";
import type { Contract, Id, MaintenanceVisit, Unit } from "../entities.js";
import { DomainError } from "../errors.js";

/**
 * Moteur d'échéances de conformité — spec `docs/specs/001-moteur-echeances.md`.
 *
 * Logique 100 % pure : le « aujourd'hui » est un paramètre, jamais une horloge.
 */

/** Visite périodique : au moins une toutes les 6 semaines (loi SAE 2003). */
export const VISIT_INTERVAL_WEEKS = 6;

/** Contrôle technique quinquennal : tous les 5 ans par un organisme agréé. */
export const INSPECTION_INTERVAL_YEARS = 5;

/** Fenêtre d'alerte des visites : une semaine, l'horizon de planification d'une tournée. */
export const VISIT_ALERT_DAYS = 7;

/** Fenêtre d'alerte du quinquennal : 6 mois (`docs/02-produit/05-conformite-reglementaire.md`). */
export const INSPECTION_ALERT_MONTHS = 6;

export type DeadlineKind = "inspection_5y" | "visit_6w";

export type DeadlineStatus = "due_soon" | "ok" | "overdue";

export interface ComplianceDeadline {
  readonly tenantId: Id;
  readonly unitId: Id;
  readonly kind: DeadlineKind;
  readonly dueOn: IsoDate;
  readonly status: DeadlineStatus;
}

function assertInvariants(
  unit: Unit,
  contract: Contract | null,
  visits: readonly MaintenanceVisit[],
): void {
  if (contract !== null && contract.tenantId !== unit.tenantId) {
    throw new DomainError(
      `Contrat ${contract.id} (tenant ${contract.tenantId}) et appareil ${unit.id} (tenant ${unit.tenantId}) appartiennent à des tenants différents`,
    );
  }
  for (const visit of visits) {
    if (visit.tenantId !== unit.tenantId) {
      throw new DomainError(
        `Visite ${visit.id} (tenant ${visit.tenantId}) et appareil ${unit.id} (tenant ${unit.tenantId}) appartiennent à des tenants différents`,
      );
    }
    if (visit.unitId !== unit.id) {
      throw new DomainError(
        `Visite ${visit.id} concerne l'appareil ${visit.unitId}, pas ${unit.id}`,
      );
    }
  }
}

/** R1.1 — un contrat couvre l'appareil s'il le liste et qu'il est en vigueur ce jour-là (bornes incluses). */
function coversUnit(contract: Contract, unit: Unit, referenceOn: IsoDate): boolean {
  if (!contract.unitIds.includes(unit.id)) {
    return false;
  }
  if (isBefore(referenceOn, contract.startsOn)) {
    return false;
  }
  return contract.endsOn === null || !isAfter(referenceOn, contract.endsOn);
}

/**
 * R1.4/R1.5/R1.6 — dernière visite réellement réalisée à la date de référence.
 * Les visites planifiées et celles datées dans le futur ne comptent pas.
 */
function lastCompletedVisitOn(
  visits: readonly MaintenanceVisit[],
  referenceOn: IsoDate,
): IsoDate | null {
  let latest: IsoDate | null = null;
  for (const visit of visits) {
    const { completedOn } = visit;
    if (completedOn === null || isAfter(completedOn, referenceOn)) {
      continue;
    }
    if (latest === null || isAfter(completedOn, latest)) {
      latest = completedOn;
    }
  }
  return latest;
}

/** R3 — le jour de l'échéance n'est pas encore un retard. */
function statusOf(dueOn: IsoDate, referenceOn: IsoDate, alertFrom: IsoDate): DeadlineStatus {
  if (isAfter(referenceOn, dueOn)) {
    return "overdue";
  }
  return isBefore(referenceOn, alertFrom) ? "ok" : "due_soon";
}

/** R1 — échéance de visite : elle n'existe que sous un contrat actif couvrant l'appareil. */
function visitDeadline(
  unit: Unit,
  contract: Contract | null,
  visits: readonly MaintenanceVisit[],
  referenceOn: IsoDate,
): ComplianceDeadline | null {
  if (contract === null || !coversUnit(contract, unit, referenceOn)) {
    return null;
  }
  const startedOn = lastCompletedVisitOn(visits, referenceOn) ?? contract.startsOn;
  const dueOn = addWeeks(startedOn, VISIT_INTERVAL_WEEKS);
  return {
    tenantId: unit.tenantId,
    unitId: unit.id,
    kind: "visit_6w",
    dueOn,
    status: statusOf(dueOn, referenceOn, addDays(dueOn, -VISIT_ALERT_DAYS)),
  };
}

/** R2 — échéance quinquennale : obligation du propriétaire, indépendante du contrat. */
function inspectionDeadline(unit: Unit, referenceOn: IsoDate): ComplianceDeadline | null {
  const startedOn = unit.lastStatutoryInspectionOn ?? unit.commissionedOn;
  if (startedOn === null) {
    return null;
  }
  const dueOn = addYears(startedOn, INSPECTION_INTERVAL_YEARS);
  return {
    tenantId: unit.tenantId,
    unitId: unit.id,
    kind: "inspection_5y",
    dueOn,
    status: statusOf(dueOn, referenceOn, addMonths(dueOn, -INSPECTION_ALERT_MONTHS)),
  };
}

/**
 * Calcule les échéances de conformité d'un appareil à une date donnée.
 *
 * @param unit appareil concerné
 * @param contract contrat d'entretien, ou `null` si l'appareil n'en a pas
 * @param visits visites de **cet** appareil (réalisées ou planifiées)
 * @param referenceOn jour d'évaluation — le « aujourd'hui » du calcul
 * @throws {DomainError} si un tenant diverge ou si une visite concerne un autre appareil
 * @returns les échéances, triées par `dueOn` croissant puis par `kind` (R5)
 */
export function computeDeadlines(
  unit: Unit,
  contract: Contract | null,
  visits: readonly MaintenanceVisit[],
  referenceOn: IsoDate,
): ComplianceDeadline[] {
  assertInvariants(unit, contract, visits);

  const deadlines = [
    visitDeadline(unit, contract, visits, referenceOn),
    inspectionDeadline(unit, referenceOn),
  ].filter((deadline): deadline is ComplianceDeadline => deadline !== null);

  return deadlines.sort((a, b) => compareIsoDate(a.dueOn, b.dueOn) || a.kind.localeCompare(b.kind));
}
