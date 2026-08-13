/**
 * @asc/domain — entités, types et règles métier PURES.
 *
 * Zéro dépendance framework, zéro I/O, aucune lecture d'horloge
 * (`docs/03-application/07-phase0-fondations.md`).
 */
export {
  type ComplianceDeadline,
  computeDeadlines,
  type DeadlineKind,
  type DeadlineStatus,
  INSPECTION_ALERT_MONTHS,
  INSPECTION_INTERVAL_YEARS,
  VISIT_ALERT_DAYS,
  VISIT_INTERVAL_WEEKS,
} from "./compliance/deadlines.js";
export {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareIsoDate,
  daysInMonth,
  differenceInDays,
  type IsoDate,
  isAfter,
  isBefore,
  isIsoDate,
  isLeapYear,
  isoDate,
} from "./date/iso-date.js";
export {
  type Contact,
  type Contract,
  CUSTOMER_TYPES,
  type Customer,
  type CustomerType,
  type Id,
  type MaintenanceVisit,
  type Site,
  type Unit,
  USER_ROLES,
  type User,
  type UserRole,
} from "./entities.js";
export { DomainError } from "./errors.js";
export { normalizeSearchText, siteMatchesQuery } from "./sites/site-search.js";
