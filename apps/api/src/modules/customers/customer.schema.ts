import { CUSTOMER_TYPES, type Customer } from "@asc/domain";
import { z } from "zod";

/**
 * Schéma de **persistance** d'un client.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md). Ce schéma décrit
 * le format sur disque, distinct des schémas d'API de `packages/contracts`.
 */
export const customerSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(CUSTOMER_TYPES),
}) satisfies z.ZodType<Customer>;

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedCustomer = z.infer<typeof customerSchema>;
