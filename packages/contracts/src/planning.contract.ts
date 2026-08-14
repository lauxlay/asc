import { z } from "zod";
import { isoDateSchema } from "./iso-date.schema.js";
import { userResponseSchema } from "./user.contract.js";
import { workOrderResponseSchema } from "./work-order.contract.js";

/**
 * Contrats du planning de la semaine (spec 008, R5 et R6).
 *
 * Une réponse = un écran : les sept jours, une ligne par technicien, et le
 * backlog. Le backlog ne dépend pas de la semaine affichée — un OT non
 * planifié n'a pas de date — mais il voyage avec le reste pour qu'un
 * changement de semaine reste un seul aller-retour.
 */

/**
 * Carte déplaçable dans la grille.
 *
 * Elle porte l'OT entier plus de quoi le lire sans ouvrir sa fiche : un
 * dispatcher reconnaît un immeuble, pas un UUID d'appareil.
 */
export const planningCardSchema = z.object({
  workOrder: workOrderResponseSchema,
  unitReference: z.string(),
  siteId: z.string(),
  siteName: z.string(),
});

/**
 * Une ligne du planning.
 *
 * Un utilisateur **désactivé** y figure quand il porte des OT dans la semaine
 * affichée (R5.3) : rien ne disparaît en silence, ses interventions doivent
 * être vues pour être redistribuées. Son état se lit dans `user.active`.
 */
export const planningRowSchema = z.object({
  user: userResponseSchema,
  /** Cartes de la semaine, ordonnées par criticité puis ancienneté. */
  cards: z.array(planningCardSchema),
});

export const planningResponseSchema = z.object({
  /** Lundi de la semaine affichée. */
  weekStartsOn: isoDateSchema,
  /** Les sept jours, du lundi au dimanche. */
  days: z.array(isoDateSchema),
  rows: z.array(planningRowSchema),
  /** OT ouverts et non planifiés, du plus critique au plus ancien. */
  backlog: z.array(planningCardSchema),
});

/**
 * `GET /planning?week=YYYY-MM-DD`.
 *
 * N'importe quel jour de la semaine voulue est accepté : le serveur ramène au
 * lundi. Le paramètre absent vaut « la semaine en cours », résolue par le
 * serveur — le domaine ne lit jamais l'horloge.
 */
export const planningQuerySchema = z.object({
  week: isoDateSchema.optional(),
});

export type PlanningCard = z.infer<typeof planningCardSchema>;
export type PlanningRow = z.infer<typeof planningRowSchema>;
export type PlanningResponse = z.infer<typeof planningResponseSchema>;
export type PlanningQuery = z.infer<typeof planningQuerySchema>;
