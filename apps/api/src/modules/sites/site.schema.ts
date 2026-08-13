import type { Site } from "@asc/domain";
import { z } from "zod";

/**
 * Schéma de **persistance** d'un site.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md). Ce schéma décrit
 * le format sur disque, distinct des schémas d'API de `packages/contracts`.
 */
export const siteSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  addressLine: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
}) satisfies z.ZodType<Site>;

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedSite = z.infer<typeof siteSchema>;
