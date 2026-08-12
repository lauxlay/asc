/**
 * apps/api — API du SaaS. Seule app autorisée à toucher au stockage,
 * exclusivement derrière les repositories (ADR-001).
 *
 * Contenu à venir : squelette NestJS + auth JWT + endpoint units (lot L0.4).
 * Le stockage Phase 0 (lot L0.3) est en place et prêt à être injecté.
 */

export { InMemoryUnitRepository } from "./modules/units/in-memory-unit.repository.js";
export { JsonUnitRepository } from "./modules/units/json-unit.repository.js";
export type { UnitRepository } from "./modules/units/unit.repository.js";
export { CURRENT_SCHEMA_VERSION, JsonCollectionStore } from "./storage/json-collection-store.js";
export { StorageError } from "./storage/storage-error.js";
