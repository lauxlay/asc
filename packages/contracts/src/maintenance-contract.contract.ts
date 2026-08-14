import { CONTRACT_TYPES, type Contract } from "@asc/domain";
import { z } from "zod";
import { isoDateSchema } from "./iso-date.schema.js";

/**
 * Contrats de l'API `contracts` (contrats d'entretien — spec 005).
 *
 * Le fichier s'appelle `maintenance-contract` et non `contract` : dans ce
 * paquet, « contract » désigne déjà un schéma d'API. Le type métier, lui,
 * reste `Contract` conformément au glossaire.
 *
 * Ni `id` ni `tenantId` ne sont acceptés en entrée : l'identifiant est généré
 * par le serveur (UUID applicatif, ADR-001) et le tenant vient du jeton.
 */

export const contractTypeSchema = z.enum(CONTRACT_TYPES);

export const contractResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  reference: z.string(),
  type: contractTypeSchema,
  // `readonly` : l'entité du domaine expose `readonly Id[]`, et le schéma ne
  // peut pas en diverger sans casser le `satisfies` ci-dessous.
  unitIds: z.array(z.string()).readonly(),
  startsOn: isoDateSchema,
  /** `null` = tacite reconduction (spec 005, R2.3). */
  endsOn: isoDateSchema.nullable(),
}) satisfies z.ZodType<Contract>;

export const createContractRequestSchema = z.object({
  reference: z.string().trim().min(1),
  type: contractTypeSchema,
  /** Un contrat sans appareil est valide : les appareils suivent (R3.5). */
  unitIds: z.array(z.string().trim().min(1)).default([]),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().default(null),
});

/**
 * `POST /contracts/:id/visits` — génération des visites périodiques (spec 009).
 *
 * Les deux compteurs comptent : sans le nombre d'existantes, l'utilisateur qui
 * regénère ne saurait pas si son clic a fait quelque chose ou si tout était
 * déjà là.
 */
export const generateVisitsResponseSchema = z.object({
  /** OT de visite réellement créés par cet appel. */
  created: z.number().int().nonnegative(),
  /** Échéances qui portaient déjà une visite, laissées intactes (R3.2). */
  alreadyPlanned: z.number().int().nonnegative(),
  /** Dernier jour couvert par le calendrier, `null` si rien n'est dû. */
  coveredUntil: isoDateSchema.nullable(),
});

/** `PATCH` : seuls les champs fournis sont modifiés. */
export const updateContractRequestSchema = z
  .object({
    reference: z.string().trim().min(1),
    type: contractTypeSchema,
    unitIds: z.array(z.string().trim().min(1)),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema.nullable(),
  })
  .partial();

export const contractListResponseSchema = z.object({
  items: z.array(contractResponseSchema),
});

/** Filtre de `GET /contracts` : contrats couvrant un appareil donné. */
export const contractListQuerySchema = z.object({
  unitId: z.string().trim().min(1).optional(),
});

export const deadlineKindSchema = z.enum(["inspection_5y", "visit_6w"]);
export const deadlineStatusSchema = z.enum(["due_soon", "ok", "overdue"]);

/**
 * Échéance calculée, enrichie de quoi l'afficher sans requête supplémentaire.
 *
 * Elle n'est jamais stockée : `computeDeadlines` est pur et déterministe
 * (spec 005, R4.1).
 */
export const complianceDeadlineResponseSchema = z.object({
  unitId: z.string(),
  unitReference: z.string(),
  siteName: z.string(),
  kind: deadlineKindSchema,
  dueOn: isoDateSchema,
  status: deadlineStatusSchema,
});

export const complianceDeadlineListResponseSchema = z.object({
  /** Jour d'évaluation retenu par le serveur, pour un affichage sans ambiguïté. */
  evaluatedOn: isoDateSchema,
  items: z.array(complianceDeadlineResponseSchema),
});

export type ContractResponse = z.infer<typeof contractResponseSchema>;
export type CreateContractRequest = z.infer<typeof createContractRequestSchema>;
export type UpdateContractRequest = z.infer<typeof updateContractRequestSchema>;
export type ContractListResponse = z.infer<typeof contractListResponseSchema>;
export type ContractListQuery = z.infer<typeof contractListQuerySchema>;
export type ComplianceDeadlineResponse = z.infer<typeof complianceDeadlineResponseSchema>;
export type ComplianceDeadlineListResponse = z.infer<typeof complianceDeadlineListResponseSchema>;
export type GenerateVisitsResponse = z.infer<typeof generateVisitsResponseSchema>;
