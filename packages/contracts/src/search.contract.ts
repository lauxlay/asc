import { MIN_SEARCH_LENGTH, SEARCH_KINDS } from "@asc/domain";
import { z } from "zod";

/**
 * Contrats de la recherche globale (spec 010).
 *
 * Le serveur rend des résultats **prêts à afficher et à ouvrir** : le client ne
 * refait aucun calcul de libellé ni aucune règle de navigation.
 */

export const searchKindSchema = z.enum(SEARCH_KINDS);

export const searchResultSchema = z.object({
  kind: searchKindSchema,
  /** Identifiant de l'entité trouvée. */
  id: z.string(),
  /** Ce qui est cherché et reconnu : « Ascenseur A », « OT-2026-00042 ». */
  label: z.string(),
  /** Ce qui situe : l'immeuble, la ville, l'objet de l'OT. */
  sublabel: z.string(),
  /**
   * Identifiant de la **page à ouvrir**, qui n'est pas toujours celui du
   * résultat (spec 010, R4).
   *
   * Un appareil n'a pas de page à lui : le chercher mène à la fiche de son
   * immeuble. Cette règle de navigation est une décision produit — elle
   * appartient au serveur, pas à une convention côté client.
   */
  targetId: z.string(),
});

export const searchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  /**
   * `true` quand des correspondances ont été écartées par le plafond.
   *
   * Sans ce drapeau, l'utilisateur croirait avoir tout vu au lieu de préciser
   * sa recherche (R3.3).
   */
  truncated: z.boolean(),
});

/** `GET /search?q=...`. En dessous de deux caractères, la réponse est vide. */
export const searchQuerySchema = z.object({
  q: z.string().default(""),
});

export { MIN_SEARCH_LENGTH };

export type SearchKind = z.infer<typeof searchKindSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
