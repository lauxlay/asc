import { type IsoDate, isIsoDate, type Unit } from "@asc/domain";
import { z } from "zod";

/**
 * Schéma de **persistance** d'un appareil.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md). Ce schéma décrit
 * le format sur disque, distinct des schémas d'API de `packages/contracts`.
 */

const isoDateSchema = z.custom<IsoDate>((value) => typeof value === "string" && isIsoDate(value), {
  message: "Date ISO invalide (attendu YYYY-MM-DD)",
});

export const unitSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  siteId: z.string().min(1),
  commissionedOn: isoDateSchema.nullable(),
  lastStatutoryInspectionOn: isoDateSchema.nullable(),
}) satisfies z.ZodType<Unit>;

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedUnit = z.infer<typeof unitSchema>;
