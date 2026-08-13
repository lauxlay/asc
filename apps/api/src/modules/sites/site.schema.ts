import type { Site } from "@asc/domain";
import { z } from "zod";

/**
 * Schéma de **persistance** d'un site.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md). Ce schéma décrit
 * le format sur disque, distinct des schémas d'API de `packages/contracts`.
 */
/**
 * Lecture tolérante d'un champ ajouté après coup.
 *
 * Le volume `data/` survit aux déploiements (ADR-002) : un fichier écrit par
 * une version antérieure ne porte pas les champs des versions suivantes. Sans
 * valeur par défaut, l'API refuserait de lire son propre stock et ne
 * démarrerait plus. On lit donc large et on écrit strict — l'équivalent d'une
 * colonne ajoutée avec un défaut.
 */
export const siteSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  /** Ajouté au lot L1.2 : absent des fichiers écrits avant. */
  customerId: z.string().min(1).nullable().default(null),
  name: z.string().min(1),
  addressLine: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
}) satisfies z.ZodType<Site>;

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedSite = z.infer<typeof siteSchema>;
