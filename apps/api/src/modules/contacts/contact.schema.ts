import type { Contact } from "@asc/domain";
import { z } from "zod";

/**
 * Schéma de **persistance** d'un contact.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md). Ce schéma décrit
 * le format sur disque, distinct des schémas d'API de `packages/contracts`.
 */
export const contactSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  siteId: z.string().min(1).nullable(),
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().min(1).nullable(),
  phone: z.string().min(1).nullable(),
}) satisfies z.ZodType<Contact>;

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedContact = z.infer<typeof contactSchema>;
