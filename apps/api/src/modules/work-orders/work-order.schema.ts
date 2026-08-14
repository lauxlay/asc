import {
  type IsoDate,
  isIsoDate,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type WorkOrder,
} from "@asc/domain";
import { z } from "zod";

/**
 * Schémas de **persistance** des ordres de travail et de leur numérotation.
 *
 * Un fichier lu depuis le disque est une donnée entrante : elle est parsée
 * comme n'importe quelle frontière (07-phase0-fondations.md).
 */

/** Horodatage ISO complet — un instant, pas un jour (spec 007, note du modèle). */
const timestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Horodatage ISO invalide" });

/** Jour calendaire, pas instant — l'affectation se fait à la journée. */
const isoDateSchema = z.custom<IsoDate>((value) => typeof value === "string" && isIsoDate(value), {
  message: "Date invalide (attendu YYYY-MM-DD)",
});

export const entrapmentDetailsSchema = z.object({
  medicalEmergency: z.boolean().nullable(),
  peopleCount: z.number().int().nonnegative().nullable(),
  betweenFloors: z.boolean().nullable(),
});

export const workOrderSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  reference: z.string().min(1),
  type: z.enum(WORK_ORDER_TYPES),
  status: z.enum(WORK_ORDER_STATUSES),
  priority: z.enum(WORK_ORDER_PRIORITIES),
  unitId: z.string().min(1),
  summary: z.string().min(1),
  onSiteContact: z.string().min(1).nullable(),
  followUpOf: z.string().min(1).nullable(),
  reportCount: z.number().int().positive(),
  reportedAt: timestampSchema,
  lastReportedAt: timestampSchema,
  entrapment: entrapmentDetailsSchema.nullable(),
  // Ajoutés au lot L1.7 sur une collection déjà écrite : un OT existant est
  // simplement non planifié, ce qui est exactement son état (ADR-002).
  assignee: z.string().min(1).nullable().default(null),
  scheduledOn: isoDateSchema.nullable().default(null),
}) satisfies z.ZodType<WorkOrder>;

/**
 * Compteur de numérotation, une ligne par année.
 *
 * Persisté plutôt que recalculé : un « plus grand rang + 1 » réattribuerait le
 * numéro d'un OT supprimé, et un numéro qui désigne deux OT différents rend
 * tout rapport ambigu (spec 007, R6.3). Des trous sont acceptables, un doublon
 * ne l'est pas.
 */
export const workOrderSequenceSchema = z.object({
  /** L'année, en chaîne : « 2026 ». */
  id: z.string().regex(/^\d{4}$/),
  tenantId: z.string().min(1),
  /** Prochain rang à attribuer pour cette année. */
  next: z.number().int().positive(),
});

/** Le schéma et l'entité du domaine ne peuvent pas diverger sans casser le typecheck. */
export type PersistedWorkOrder = z.infer<typeof workOrderSchema>;
