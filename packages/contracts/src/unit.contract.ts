import type { Unit } from "@asc/domain";
import { z } from "zod";
import { isoDateSchema } from "./iso-date.schema.js";

/**
 * Contrats de l'API `units` (appareils).
 *
 * Ni `id` ni `tenantId` ne sont acceptés en entrée : l'identifiant est généré
 * par le serveur (UUID applicatif, ADR-001) et le tenant vient du jeton, jamais
 * du client.
 */

export const unitResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  reference: z.string(),
  commissionedOn: isoDateSchema.nullable(),
  lastStatutoryInspectionOn: isoDateSchema.nullable(),
}) satisfies z.ZodType<Unit>;

export const createUnitRequestSchema = z.object({
  siteId: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  commissionedOn: isoDateSchema.nullable().default(null),
  lastStatutoryInspectionOn: isoDateSchema.nullable().default(null),
});

/** `PATCH` : seuls les champs fournis sont modifiés. */
export const updateUnitRequestSchema = z
  .object({
    siteId: z.string().trim().min(1),
    reference: z.string().trim().min(1),
    commissionedOn: isoDateSchema.nullable(),
    lastStatutoryInspectionOn: isoDateSchema.nullable(),
  })
  .partial();

export const unitListResponseSchema = z.object({
  items: z.array(unitResponseSchema),
});

/** Filtre de `GET /units` : restreint la liste aux appareils d'un site. */
export const unitListQuerySchema = z.object({
  siteId: z.string().trim().min(1).optional(),
});

export type UnitResponse = z.infer<typeof unitResponseSchema>;
export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;
export type UpdateUnitRequest = z.infer<typeof updateUnitRequestSchema>;
export type UnitListResponse = z.infer<typeof unitListResponseSchema>;
export type UnitListQuery = z.infer<typeof unitListQuerySchema>;
