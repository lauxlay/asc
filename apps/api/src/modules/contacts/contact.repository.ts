import type { Contact, Id } from "@asc/domain";

/**
 * Port de persistance des contacts (ADR-001).
 *
 * Volontairement sans méthode de recherche par client ou par immeuble : les
 * filtres de `GET /contacts` s'appliquent au-dessus de `findAll`, comme la
 * recherche d'adresse de la spec 002. Le port reste le plus petit possible
 * (règle 7 de `07-phase0-fondations.md`).
 */
export interface ContactRepository {
  /** `null` si le contact n'existe pas **ou** appartient à un autre tenant. */
  findById(tenantId: Id, id: Id): Promise<Contact | null>;

  /** Tous les contacts du tenant, dans leur ordre d'insertion. */
  findAll(tenantId: Id): Promise<readonly Contact[]>;

  /** Insère ou remplace le contact, selon son `id`. */
  save(contact: Contact): Promise<void>;

  /** `true` si un contact a bien été supprimé, `false` s'il n'existait pas. */
  deleteById(tenantId: Id, id: Id): Promise<boolean>;
}
