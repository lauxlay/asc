import type { User } from "@asc/domain";
import { z } from "zod";
import { userRoleSchema } from "./auth.contract.js";

/**
 * Contrats de l'API `users` (spec 008, R1) — gestion minimale : lister, créer,
 * désactiver.
 *
 * Le mot de passe ne figure sur **aucune** réponse, ni en clair ni haché : il
 * entre à la création et n'en ressort jamais.
 */

/**
 * Longueur minimale du mot de passe initial.
 *
 * Douze caractères et aucune contrainte de composition : c'est la
 * recommandation ANSSI, et les règles de symboles obligatoires produisent des
 * mots de passe plus courts et plus prévisibles.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const userResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  active: z.boolean(),
}) satisfies z.ZodType<User>;

/**
 * Création : le mot de passe initial est **choisi par l'administrateur et
 * transmis hors de l'outil** (R1.4). Ni invitation par e-mail, ni lien de
 * réinitialisation — la Phase 0 n'a pas de service d'e-mail.
 */
export const createUserRequestSchema = z.object({
  email: z.string().trim().min(1).email(),
  name: z.string().trim().min(1),
  role: userRoleSchema,
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

/**
 * `PATCH` : désactiver, réactiver, corriger un nom.
 *
 * L'email n'est pas modifiable — c'est l'identité de connexion. Le rôle non
 * plus : il ne gouverne aucune permission aujourd'hui (registre des décisions,
 * A2), le laisser changer donnerait une illusion de contrôle.
 */
export const updateUserRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    active: z.boolean(),
  })
  .partial();

export const userListResponseSchema = z.object({
  items: z.array(userResponseSchema),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
