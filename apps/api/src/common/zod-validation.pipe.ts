import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Valide une entrée HTTP contre un schéma de `@asc/contracts`.
 *
 * Zod aux frontières : au-delà de ce pipe, les types sont sûrs et le code
 * métier n'a plus à se défendre contre des données douteuses.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  readonly #schema: ZodType<T>;

  constructor(schema: ZodType<T>) {
    this.#schema = schema;
  }

  transform(value: unknown): T {
    const parsed = this.#schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Requête invalide",
        // Chemin + raison pour chaque champ fautif : un client doit pouvoir
        // afficher l'erreur sur le bon champ.
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return parsed.data;
  }
}
