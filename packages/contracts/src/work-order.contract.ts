import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type WorkOrder,
} from "@asc/domain";
import { z } from "zod";
import { isoDateSchema } from "./iso-date.schema.js";

/**
 * Contrats de l'API `work-orders` (spec 007).
 *
 * Ni `id`, ni `tenantId`, ni `reference` ne sont acceptés en entrée :
 * l'identifiant est un UUID généré par le serveur, le tenant vient du jeton, et
 * la référence est attribuée par une séquence annuelle que le client ne choisit
 * jamais (R6.5).
 */

export const workOrderTypeSchema = z.enum(WORK_ORDER_TYPES);
export const workOrderStatusSchema = z.enum(WORK_ORDER_STATUSES);
export const workOrderPrioritySchema = z.enum(WORK_ORDER_PRIORITIES);

/** Horodatage ISO complet — un instant, pas un jour calendaire. */
const timestampSchema = z.string();

/**
 * Réponses au script de désincarcération.
 *
 * `null` = pas encore demandé, et se distingue de `false` = demandé, réponse
 * négative (spec 007, R3).
 */
export const entrapmentDetailsResponseSchema = z.object({
  medicalEmergency: z.boolean().nullable(),
  peopleCount: z.number().int().nonnegative().nullable(),
  betweenFloors: z.boolean().nullable(),
});

/** En entrée, chaque réponse est indépendamment facultative. */
export const entrapmentDetailsRequestSchema = z.object({
  medicalEmergency: z.boolean().nullable().default(null),
  peopleCount: z.number().int().nonnegative().nullable().default(null),
  betweenFloors: z.boolean().nullable().default(null),
});

/** Texte facultatif : absent ou blanc vaut `null`, jamais `""`. */
const optionalText = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((value) => (value === "" ? null : value));

export const workOrderResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  reference: z.string(),
  type: workOrderTypeSchema,
  status: workOrderStatusSchema,
  priority: workOrderPrioritySchema,
  unitId: z.string(),
  summary: z.string(),
  onSiteContact: z.string().nullable(),
  followUpOf: z.string().nullable(),
  reportCount: z.number().int().positive(),
  reportedAt: timestampSchema,
  lastReportedAt: timestampSchema,
  entrapment: entrapmentDetailsResponseSchema.nullable(),
  assignee: z.string().nullable(),
  scheduledOn: isoDateSchema.nullable(),
}) satisfies z.ZodType<WorkOrder>;

/**
 * Création : trois champs obligatoires, le reste a une valeur par défaut.
 *
 * C'est la traduction de la cible « ≤ 4 champs » (spec 007, R1) : le type et la
 * criticité ne sont pas saisis dans le cas courant, ils sont corrigés à
 * l'exception.
 */
export const createWorkOrderRequestSchema = z.object({
  unitId: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  type: workOrderTypeSchema.default("breakdown"),
  priority: workOrderPrioritySchema.default("normal"),
  onSiteContact: optionalText,
  /** OT dont celui-ci prend la suite (R5). */
  followUpOf: z.string().trim().min(1).nullable().default(null),
  entrapment: entrapmentDetailsRequestSchema.nullable().default(null),
});

/**
 * Statuts qu'un client peut demander.
 *
 * `assigned` en est exclu (spec 008, R4.2) : on y entre en affectant l'OT au
 * planning, jamais en demandant un statut. L'accepter ici permettrait un OT
 * « affecté » sans technicien ni jour.
 */
export const REQUESTABLE_WORK_ORDER_STATUSES = [
  "new",
  "in_progress",
  "done",
  "cancelled",
] as const satisfies readonly Exclude<WorkOrder["status"], "assigned">[];

export const requestableWorkOrderStatusSchema = z.enum(REQUESTABLE_WORK_ORDER_STATUSES);

/**
 * `PATCH /work-orders/:id/assignment` — le geste du glisser-déposer.
 *
 * Les deux champs sont **obligatoirement fournis ensemble** : soit les deux
 * renseignés (l'OT est planifié), soit les deux à `null` (il retourne au
 * backlog). Une combinaison mixte est refusée par le domaine (spec 008, R2).
 */
export const assignWorkOrderRequestSchema = z.object({
  assignee: z.string().trim().min(1).nullable(),
  scheduledOn: isoDateSchema.nullable(),
});

/**
 * `PATCH` : seuls les champs fournis sont modifiés.
 *
 * `status` passe par ici et déclenche la validation de transition (R4.3). La
 * référence, le compteur de signalements, les horodatages et l'affectation ne
 * sont jamais modifiables par ici.
 */
export const updateWorkOrderRequestSchema = z
  .object({
    status: requestableWorkOrderStatusSchema,
    summary: z.string().trim().min(1),
    priority: workOrderPrioritySchema,
    onSiteContact: optionalText,
    entrapment: entrapmentDetailsRequestSchema.nullable(),
  })
  .partial();

export const workOrderListResponseSchema = z.object({
  items: z.array(workOrderResponseSchema),
});

/**
 * Filtres de `GET /work-orders`.
 *
 * `open=true` rend les OT `new` ou `in_progress` : c'est ce dont l'écran de
 * saisie a besoin pour détecter un doublon avant de proposer un formulaire
 * (R2.1).
 */
export const workOrderListQuerySchema = z.object({
  status: workOrderStatusSchema.optional(),
  type: workOrderTypeSchema.optional(),
  unitId: z.string().trim().min(1).optional(),
  assignee: z.string().trim().min(1).optional(),
  // Énumération plutôt que booléen coercé : `z.coerce.boolean()` rendrait
  // `true` pour la chaîne « false », ce qui inverserait silencieusement le
  // filtre.
  open: z.enum(["true", "false"]).optional(),
});

/** Chaîne d'un OT, dans les deux sens (R5.5). */
export const workOrderChainResponseSchema = z.object({
  /** Du parent direct jusqu'à l'OT d'origine. */
  followUpChain: z.array(workOrderResponseSchema),
  /** OT qui déclarent prendre la suite de celui-ci. */
  followedUpBy: z.array(workOrderResponseSchema),
});

export type RequestableWorkOrderStatus = z.infer<typeof requestableWorkOrderStatusSchema>;
export type WorkOrderResponse = z.infer<typeof workOrderResponseSchema>;
export type AssignWorkOrderRequest = z.infer<typeof assignWorkOrderRequestSchema>;
export type CreateWorkOrderRequest = z.infer<typeof createWorkOrderRequestSchema>;
export type UpdateWorkOrderRequest = z.infer<typeof updateWorkOrderRequestSchema>;
export type WorkOrderListResponse = z.infer<typeof workOrderListResponseSchema>;
export type WorkOrderListQuery = z.infer<typeof workOrderListQuerySchema>;
export type WorkOrderChainResponse = z.infer<typeof workOrderChainResponseSchema>;
