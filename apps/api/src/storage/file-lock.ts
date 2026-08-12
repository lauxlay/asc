/**
 * Verrou coopératif par fichier, à l'échelle du process.
 *
 * ADR-001 assume le **mono-process** en Phase 0 : il suffit donc de sérialiser
 * les sections critiques d'un même fichier au sein du process pour qu'un cycle
 * lecture-modification-écriture ne soit jamais entrelacé avec un autre. Le
 * passage à SQLite/PostgreSQL rendra ce verrou inutile.
 */
export class FileLock {
  /** Dernière tâche en file pour chaque clé, neutralisée pour ne jamais rejeter. */
  readonly #tails = new Map<string, Promise<void>>();

  /** Exécute `task` en exclusion mutuelle sur `key`, dans l'ordre d'arrivée. */
  async withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    // On enchaîne que la précédente ait réussi ou échoué : un échec ne bloque
    // pas la file.
    const run = previous.then(task, task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.#tails.set(key, tail);

    try {
      return await run;
    } finally {
      // Dernier de la file : on libère l'entrée pour ne pas fuir en mémoire.
      if (this.#tails.get(key) === tail) {
        this.#tails.delete(key);
      }
    }
  }
}
