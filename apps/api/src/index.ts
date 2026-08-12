/**
 * apps/api — API du SaaS. Seule app autorisée à toucher au stockage,
 * exclusivement derrière les repositories (ADR-001).
 *
 * Point d'entrée du serveur : `main.ts`. Ce fichier n'expose que ce dont les
 * tests et les outils ont besoin.
 */

export { AppModule } from "./app.module.js";
export { DEFAULT_TENANT_ID } from "./auth/auth.service.js";
export { hashPassword, verifyPassword } from "./auth/password.js";
export { UNIT_REPOSITORY, USER_REPOSITORY } from "./common/tokens.js";
export { API_CONFIG, type ApiConfig, loadConfig } from "./config/env.js";
export { InMemoryUnitRepository } from "./modules/units/in-memory-unit.repository.js";
export { JsonUnitRepository } from "./modules/units/json-unit.repository.js";
export type { UnitRepository } from "./modules/units/unit.repository.js";
export { InMemoryUserRepository } from "./modules/users/in-memory-user.repository.js";
export { JsonUserRepository } from "./modules/users/json-user.repository.js";
export type { PersistedUser, UserRepository } from "./modules/users/user.repository.js";
export { CURRENT_SCHEMA_VERSION, JsonCollectionStore } from "./storage/json-collection-store.js";
export { StorageError } from "./storage/storage-error.js";
