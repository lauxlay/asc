import type { Site } from "@asc/domain";
import { z } from "zod";

/**
 * Contrats de l'API `sites` (immeubles).
 *
 * Ni `id` ni `tenantId` ne sont acceptés en entrée : l'identifiant est généré
 * par le serveur (UUID applicatif, ADR-001) et le tenant vient du jeton, jamais
 * du client.
 */

/** Champ d'adresse : non vide une fois les espaces de bord retirés. */
const addressField = z.string().trim().min(1);

export const siteResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  addressLine: z.string(),
  postalCode: z.string(),
  city: z.string(),
}) satisfies z.ZodType<Site>;

export const createSiteRequestSchema = z.object({
  name: addressField,
  addressLine: addressField,
  postalCode: addressField,
  city: addressField,
});

/** `PATCH` : seuls les champs fournis sont modifiés. */
export const updateSiteRequestSchema = createSiteRequestSchema.partial();

export const siteListResponseSchema = z.object({
  items: z.array(siteResponseSchema),
});

/**
 * Filtre de `GET /sites`.
 *
 * `q` absent ou blanc rend tout le parc (spec 002, R2.4) : un champ de
 * recherche vide ne doit pas vider la liste.
 */
export const siteListQuerySchema = z.object({
  q: z.string().optional(),
});

export type SiteResponse = z.infer<typeof siteResponseSchema>;
export type CreateSiteRequest = z.infer<typeof createSiteRequestSchema>;
export type UpdateSiteRequest = z.infer<typeof updateSiteRequestSchema>;
export type SiteListResponse = z.infer<typeof siteListResponseSchema>;
export type SiteListQuery = z.infer<typeof siteListQuerySchema>;
