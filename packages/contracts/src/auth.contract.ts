import { USER_ROLES } from "@asc/domain";
import { z } from "zod";

/** Rôles applicatifs — dérivés du domaine pour qu'ils ne puissent pas diverger. */
export const userRoleSchema = z.enum(USER_ROLES);

export const authenticatedUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  role: userRoleSchema,
});

/** `POST /auth/login` — email et mot de passe, mono-tenant en Phase 0. */
export const loginRequestSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  /** Durée de validité du jeton, en secondes. */
  expiresIn: z.number().int().positive(),
  user: authenticatedUserSchema,
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
