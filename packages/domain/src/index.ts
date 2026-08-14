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
export { activeContractFor, worstDeadlineStatus } from "./compliance/parc-compliance.js";
export {
  type CoveragePeriod,
  conflictingUnitIds,
  duplicatedUnitIds,
  hasLegalDuration,
  isActiveOn,
  MINIMUM_CONTRACT_YEARS,
  periodsOverlap,
} from "./contracts/contract-rules.js";
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
  DAYS_PER_WEEK,
  dayOfWeek,
  isSameWeek,
  startOfWeek,
  weekDays,
} from "./date/week.js";
export {
  CONTRACT_TYPES,
  type Contact,
  type Contract,
  type ContractType,
  CUSTOMER_TYPES,
  type Customer,
  type CustomerType,
  type EntrapmentDetails,
  type Id,
  type MaintenanceVisit,
  type Site,
  type Unit,
  USER_ROLES,
  type User,
  type UserRole,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type WorkOrder,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderType,
} from "./entities.js";
export { DomainError } from "./errors.js";
export {
  type ColumnMapping,
  duplicatedColumns,
  IMPORT_FIELDS,
  type ImportField,
  missingRequiredFields,
  REQUIRED_IMPORT_FIELDS,
  suggestColumnMapping,
} from "./import/column-mapping.js";
export { type CsvRow, type CsvSeparator, type CsvTable, parseCsv } from "./import/csv.js";
export {
  buildImportPlan,
  type ImportIssue,
  type ImportPlan,
  type PlannedSite,
  type PlannedUnit,
  siteKeyOf,
} from "./import/import-plan.js";
export { normalizeSearchText, siteMatchesQuery } from "./sites/site-search.js";
export {
  type AssignmentRefusal,
  assignmentRefusal,
  isCoherentAssignment,
  isConsistentAssignment,
  isPlanned,
  isUnplanned,
  statusAfterAssignment,
  type WorkOrderAssignment,
} from "./work-orders/assignment.js";
export {
  compareByUrgency,
  type DispatchOrdered,
  sortByUrgency,
} from "./work-orders/dispatch-order.js";
export {
  followedUpBy,
  followUpChainOf,
  wouldCreateFollowUpCycle,
} from "./work-orders/follow-up.js";
export {
  allowedTransitionsFrom,
  canTransition,
  formatWorkOrderReference,
  isTerminalStatus,
} from "./work-orders/status-transitions.js";
