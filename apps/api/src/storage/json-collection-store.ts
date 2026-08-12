import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { ZodType } from "zod";
import { FileLock } from "./file-lock.js";
import { StorageError } from "./storage-error.js";

/**
 * Magasin de collections JSON — implémentation de stockage Phase 0 (ADR-001).
 *
 * Organisation disque, une collection par fichier, un dossier par tenant :
 *
 * ```
 * data/{tenant_id}/units.json
 * ```
 *
 * Aucun code métier n'utilise cette classe directement : elle est la brique
 * commune des repositories, et seuls eux y accèdent.
 */

/** Version du format d'enveloppe écrite sur disque. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Les identifiants de tenant deviennent des noms de dossier : on n'accepte que
 * des UUID / slugs sûrs, jamais de séparateur ni de `..` qui ferait sortir de
 * `data/`.
 */
const SAFE_TENANT_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const SAFE_COLLECTION_NAME = /^[a-z][a-z0-9_]{0,63}$/;

export interface CollectionRef {
  readonly tenantId: string;
  readonly collection: string;
}

interface Envelope {
  readonly schemaVersion: number;
  readonly items: readonly unknown[];
}

function assertSafeRef({ tenantId, collection }: CollectionRef): void {
  if (!SAFE_TENANT_ID.test(tenantId)) {
    throw new StorageError(`Identifiant de tenant invalide : "${tenantId}"`);
  }
  if (!SAFE_COLLECTION_NAME.test(collection)) {
    throw new StorageError(`Nom de collection invalide : "${collection}"`);
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT"
  );
}

export class JsonCollectionStore {
  readonly #rootDir: string;
  readonly #lock = new FileLock();

  /** @param rootDir racine du volume persistant (`data/` — ADR-002). */
  constructor(rootDir: string) {
    this.#rootDir = rootDir;
  }

  #fileOf(ref: CollectionRef): string {
    assertSafeRef(ref);
    return join(this.#rootDir, ref.tenantId, `${ref.collection}.json`);
  }

  /**
   * Lit une collection et valide chaque enregistrement.
   *
   * Un fichier absent est une collection vide — pas une erreur : le premier
   * `save` d'un tenant crée son dossier.
   */
  async read<T>(ref: CollectionRef, schema: ZodType<T>): Promise<readonly T[]> {
    const file = this.#fileOf(ref);
    return this.#lock.withLock(file, () => this.#readUnlocked(file, schema));
  }

  /**
   * Applique `mutate` à la collection puis l'écrit, **sous verrou** : le cycle
   * lecture-modification-écriture est atomique vis-à-vis des autres appels.
   */
  async update<T>(
    ref: CollectionRef,
    schema: ZodType<T>,
    mutate: (items: readonly T[]) => readonly T[],
  ): Promise<readonly T[]> {
    const file = this.#fileOf(ref);
    return this.#lock.withLock(file, async () => {
      const next = mutate(await this.#readUnlocked(file, schema));
      await this.#writeUnlocked(file, next);
      return next;
    });
  }

  async #readUnlocked<T>(file: string, schema: ZodType<T>): Promise<readonly T[]> {
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }
      throw new StorageError(`Lecture impossible de ${file}`, { cause: error });
    }

    let envelope: Envelope;
    try {
      envelope = JSON.parse(raw) as Envelope;
    } catch (error) {
      throw new StorageError(`JSON illisible dans ${file}`, { cause: error });
    }

    if (envelope?.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      // Le jour où une v2 existera, c'est ici que sa fonction de migration
      // s'insérera (ADR-001) — tant qu'il n'y a qu'une version, on refuse
      // bruyamment plutôt que d'interpréter des données inconnues.
      throw new StorageError(
        `Version de schéma ${String(envelope?.schemaVersion)} non gérée dans ${file} (attendu ${CURRENT_SCHEMA_VERSION}) : migration manquante`,
      );
    }

    if (!Array.isArray(envelope.items)) {
      throw new StorageError(`Enveloppe sans tableau "items" dans ${file}`);
    }

    return envelope.items.map((item, index) => {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        throw new StorageError(
          `Enregistrement ${index} invalide dans ${file} : ${parsed.error.message}`,
        );
      }
      return parsed.data;
    });
  }

  /**
   * Écriture atomique : fichier temporaire, `fsync`, puis `rename`.
   *
   * `rename` est atomique sur POSIX — un lecteur voit soit l'ancien fichier
   * complet, soit le nouveau, jamais un fichier tronqué. Une coupure de
   * courant en cours d'écriture ne laisse qu'un `.tmp` orphelin.
   */
  async #writeUnlocked(file: string, items: readonly unknown[]): Promise<void> {
    const envelope: Envelope = { schemaVersion: CURRENT_SCHEMA_VERSION, items };
    const payload = `${JSON.stringify(envelope, null, 2)}\n`;
    const temporaryFile = `${file}.${randomUUID()}.tmp`;

    await mkdir(join(file, ".."), { recursive: true });

    try {
      const handle = await open(temporaryFile, "w");
      try {
        await handle.writeFile(payload, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporaryFile, file);
    } catch (error) {
      await unlink(temporaryFile).catch(() => undefined);
      throw new StorageError(`Écriture impossible de ${file}`, { cause: error });
    }
  }
}
