import { USER_ROLES } from "@asc/domain";
import { z } from "zod";
import type { PersistedUser } from "./user.repository.js";

/** Schéma de persistance d'un utilisateur — le format sur disque, pas l'API. */
export const persistedUserSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  email: z.string().min(1),
  role: z.enum(USER_ROLES),
  passwordHash: z.string().min(1),
}) satisfies z.ZodType<PersistedUser>;
