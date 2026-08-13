import { CONTRACT_TYPES, type Contract, type IsoDate, isIsoDate } from "@asc/domain";
import { z } from "zod";

/**
 * Schéma de **persistance** d'un contrat d'entretien.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md). Ce schéma décrit
 * le format sur disque, distinct des schémas d'API de `packages/contracts`.
 */

const isoDateSchema = z.custom<IsoDate>((value) => typeof value === "string" && isIsoDate(value), {
  message: "Date ISO invalide (attendu YYYY-MM-DD)",
});

export const contractSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  reference: z.string().min(1),
  type: z.enum(CONTRACT_TYPES),
  unitIds: z.array(z.string().min(1)).readonly(),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable(),
}) satisfies z.ZodType<Contract>;

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedContract = z.infer<typeof contractSchema>;
