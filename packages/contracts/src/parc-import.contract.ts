import type { ColumnMapping } from "@asc/domain";
import { z } from "zod";
import { isoDateSchema } from "./iso-date.schema.js";

/**
 * Contrats de l'import de parc (spec 004).
 *
 * Le fichier voyage en texte dans le corps JSON : pas de multipart à parser ni
 * de fichier temporaire à stocker et à nettoyer. L'analyse ne garde aucun état
 * — le navigateur renvoie le même CSV à la confirmation, avec la
 * correspondance validée.
 */

/**
 * Bornes du fichier accepté.
 *
 * 800 000 caractères tiennent sous la limite de corps par défaut de Fastify
 * (1 Mo) une fois encodés en JSON, et couvrent très largement le parc d'une
 * PME : 1 500 appareils pèsent environ 120 Ko.
 */
export const MAX_CSV_LENGTH = 800_000;
export const MAX_CSV_ROWS = 5_000;

const csvSchema = z
  .string()
  .min(1, "Le fichier est vide")
  .max(MAX_CSV_LENGTH, `Le fichier dépasse ${MAX_CSV_LENGTH} caractères`);

/** Index de colonne, ou `null` quand le champ n'est alimenté par aucune. */
const columnIndex = z.number().int().nonnegative().nullable();

export const columnMappingSchema = z.object({
  siteName: columnIndex,
  addressLine: columnIndex,
  postalCode: columnIndex,
  city: columnIndex,
  reference: columnIndex,
  commissionedOn: columnIndex,
  lastStatutoryInspectionOn: columnIndex,
}) satisfies z.ZodType<ColumnMapping>;

export const importIssueSchema = z.object({
  /** `null` pour une erreur portant sur le fichier entier. */
  lineNumber: z.number().int().positive().nullable(),
  message: z.string(),
});

/** Ligne d'aperçu : ce que l'import créerait, tel qu'il l'a compris. */
export const importPreviewRowSchema = z.object({
  lineNumber: z.number().int().positive(),
  siteName: z.string(),
  addressLine: z.string(),
  postalCode: z.string(),
  city: z.string(),
  reference: z.string(),
  commissionedOn: isoDateSchema.nullable(),
  lastStatutoryInspectionOn: isoDateSchema.nullable(),
  /** `false` = l'appareil rejoint un immeuble déjà au parc. */
  siteIsNew: z.boolean(),
});

/** `mapping` absent = laisser le serveur proposer sa correspondance. */
export const analyzeImportRequestSchema = z.object({
  csv: csvSchema,
  mapping: columnMappingSchema.nullable().default(null),
});

export const analyzeImportResponseSchema = z.object({
  separator: z.string(),
  headers: z.array(z.string()),
  /** Correspondance effectivement appliquée : celle fournie, ou la suggestion. */
  mapping: columnMappingSchema,
  /** Correspondance devinée, pour permettre de revenir à la proposition. */
  suggestedMapping: columnMappingSchema,
  rowCount: z.number().int().nonnegative(),
  createdSiteCount: z.number().int().nonnegative(),
  reusedSiteCount: z.number().int().nonnegative(),
  unitCount: z.number().int().nonnegative(),
  issues: z.array(importIssueSchema),
  preview: z.array(importPreviewRowSchema),
});

export const commitImportRequestSchema = z.object({
  csv: csvSchema,
  mapping: columnMappingSchema,
});

export const commitImportResponseSchema = z.object({
  createdSiteCount: z.number().int().nonnegative(),
  reusedSiteCount: z.number().int().nonnegative(),
  createdUnitCount: z.number().int().nonnegative(),
});

export type ImportIssue = z.infer<typeof importIssueSchema>;
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type AnalyzeImportRequest = z.infer<typeof analyzeImportRequestSchema>;
export type AnalyzeImportResponse = z.infer<typeof analyzeImportResponseSchema>;
export type CommitImportRequest = z.infer<typeof commitImportRequestSchema>;
export type CommitImportResponse = z.infer<typeof commitImportResponseSchema>;
