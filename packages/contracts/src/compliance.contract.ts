import { z } from "zod";
import { isoDateSchema } from "./iso-date.schema.js";
import { deadlineKindSchema, deadlineStatusSchema } from "./maintenance-contract.contract.js";

/**
 * Contrats du tableau de conformité du parc (spec 006).
 *
 * Une ligne par **appareil**, jamais par échéance : un appareil sans contrat ni
 * date connue doit rester visible, sinon les plus problématiques disparaissent
 * du tableau et passent pour conformes.
 */

/**
 * Statut de synthèse d'une ligne.
 *
 * `unknown` n'est pas un statut du moteur d'échéances : c'est l'absence
 * d'échéance calculable, constatée à la lecture (spec 006, R3.2). Ne pas savoir
 * n'est pas être conforme.
 */
export const complianceRowStatusSchema = z.enum(["overdue", "due_soon", "ok", "unknown"]);

/** Échéance portée par une ligne, `null` quand elle n'est pas calculable. */
export const complianceDeadlineCellSchema = z
  .object({
    kind: deadlineKindSchema,
    dueOn: isoDateSchema,
    status: deadlineStatusSchema,
  })
  .nullable();

export const complianceRowSchema = z.object({
  unitId: z.string(),
  unitReference: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  /** Référence du contrat actif, `null` si l'appareil n'en a aucun (R4). */
  contractId: z.string().nullable(),
  contractReference: z.string().nullable(),
  status: complianceRowStatusSchema,
  visit: complianceDeadlineCellSchema,
  inspection: complianceDeadlineCellSchema,
});

/**
 * Compteurs du parc.
 *
 * Les quatre statuts partitionnent le parc — chaque appareil compte une fois et
 * une seule. `withoutContract` est un **axe différent** et les recoupe : un
 * appareil sans contrat dont le quinquennal est en retard compte dans les deux
 * (R5.3).
 */
export const complianceSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  dueSoon: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  withoutContract: z.number().int().nonnegative(),
});

export const complianceResponseSchema = z.object({
  /** Jour d'évaluation retenu par le serveur, fourni à la frontière (R7). */
  evaluatedOn: isoDateSchema,
  /** Toujours calculé sur le parc entier, jamais sur la vue filtrée. */
  summary: complianceSummarySchema,
  items: z.array(complianceRowSchema),
});

/** Filtre du tableau. `without_contract` croise les statuts (R5.3). */
export const complianceQuerySchema = z.object({
  status: z.enum(["overdue", "due_soon", "ok", "unknown", "without_contract"]).optional(),
});

export type ComplianceRowStatus = z.infer<typeof complianceRowStatusSchema>;
export type ComplianceRow = z.infer<typeof complianceRowSchema>;
export type ComplianceSummary = z.infer<typeof complianceSummarySchema>;
export type ComplianceResponse = z.infer<typeof complianceResponseSchema>;
export type ComplianceQuery = z.infer<typeof complianceQuerySchema>;
