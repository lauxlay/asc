/**
 * Jetons d'injection des ports.
 *
 * Une interface TypeScript n'existe pas à l'exécution : elle ne peut pas servir
 * de clé d'injection. Ces symboles sont le point de branchement entre un
 * service et l'adaptateur de stockage choisi — c'est là, et nulle part ailleurs,
 * que se décide « JSON aujourd'hui, SQLite demain » (ADR-001).
 */
export const SITE_REPOSITORY = Symbol("SITE_REPOSITORY");
export const UNIT_REPOSITORY = Symbol("UNIT_REPOSITORY");
export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
