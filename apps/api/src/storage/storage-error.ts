/**
 * Erreur d'infrastructure de stockage : fichier illisible, schéma inconnu,
 * identifiant de tenant invalide.
 *
 * Distincte de `DomainError` (@asc/domain) : celle-ci ne dit rien du métier,
 * elle signale que la couche de persistance ne peut pas répondre.
 */
export class StorageError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
  }
}
