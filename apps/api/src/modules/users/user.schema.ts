import { USER_ROLES } from "@asc/domain";
import { z } from "zod";
import type { PersistedUser } from "./user.repository.js";

/**
 * Schéma de persistance d'un utilisateur — le format sur disque, pas l'API.
 *
 * `name` et `active` arrivent au lot L1.7 sur une collection déjà écrite : ils
 * portent donc un défaut, sans quoi l'API ne redémarrerait plus sur le stock
 * existant (ADR-002, volume persistant). Le nom par défaut est **visiblement
 * provisoire** plutôt que plausible — mieux vaut un trou qu'on voit.
 */
export const persistedUserSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1).default("Sans nom"),
  role: z.enum(USER_ROLES),
  active: z.boolean().default(true),
  passwordHash: z.string().min(1),
}) satisfies z.ZodType<PersistedUser>;
