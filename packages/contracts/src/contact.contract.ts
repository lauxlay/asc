import type { Contact } from "@asc/domain";
import { z } from "zod";

/**
 * Contrats de l'API `contacts` (interlocuteurs chez un client).
 *
 * Ni `id` ni `tenantId` ne sont acceptés en entrée : l'identifiant est généré
 * par le serveur (UUID applicatif, ADR-001) et le tenant vient du jeton, jamais
 * du client.
 */

/** Coordonnée facultative : absente ou vide vaut `null`, jamais `""`. */
const optionalText = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((value) => (value === "" ? null : value));

export const contactResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  siteId: z.string().nullable(),
  name: z.string(),
  role: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
}) satisfies z.ZodType<Contact>;

export const createContactRequestSchema = z.object({
  customerId: z.string().trim().min(1),
  /** `null` = interlocuteur du client en général, pas d'un immeuble précis. */
  siteId: z.string().trim().min(1).nullable().default(null),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  email: optionalText,
  phone: optionalText,
});

/** `PATCH` : seuls les champs fournis sont modifiés. */
export const updateContactRequestSchema = z
  .object({
    customerId: z.string().trim().min(1),
    siteId: z.string().trim().min(1).nullable(),
    name: z.string().trim().min(1),
    role: z.string().trim().min(1),
    email: optionalText,
    phone: optionalText,
  })
  .partial();

export const contactListResponseSchema = z.object({
  items: z.array(contactResponseSchema),
});

/** Filtres de `GET /contacts`. */
export const contactListQuerySchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  siteId: z.string().trim().min(1).optional(),
});

export type ContactResponse = z.infer<typeof contactResponseSchema>;
export type CreateContactRequest = z.infer<typeof createContactRequestSchema>;
export type UpdateContactRequest = z.infer<typeof updateContactRequestSchema>;
export type ContactListResponse = z.infer<typeof contactListResponseSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
