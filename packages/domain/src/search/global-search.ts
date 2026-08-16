import { normalizeSearchText } from "../sites/site-search.js";

/**
 * Recherche transverse (spec 010) — correspondance et classement purs.
 *
 * La règle de correspondance est celle de la recherche d'immeubles (spec 002,
 * R2), réutilisée telle quelle : ce qui se trouve depuis le parc doit se
 * trouver depuis la palette. Ce fichier n'ajoute que ce qui manquait — la
 * **qualité** d'une correspondance, et l'ordre des résultats.
 */

/**
 * Familles cherchables, **dans leur ordre de priorité** à qualité égale.
 *
 * Le dispatcher cherche un lieu d'intervention bien plus souvent qu'une entité
 * administrative : l'appareil et l'immeuble passent donc devant.
 */
export const SEARCH_KINDS = ["unit", "site", "work_order", "customer", "contract"] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** En dessous, tout correspond : le classement n'aurait plus rien à classer. */
export const MIN_SEARCH_LENGTH = 2;

/** Une palette se parcourt aux flèches ; au-delà on ne lit plus, on défile. */
export const MAX_SEARCH_RESULTS = 20;

/**
 * Qualité d'une correspondance, du meilleur au moins bon.
 *
 * Taper un numéro d'OT complet doit placer cet OT en tête, pas les quarante OT
 * dont l'objet contient l'année.
 */
export const MATCH_QUALITIES = ["exact", "prefix", "substring"] as const;

export type MatchQuality = (typeof MATCH_QUALITIES)[number];

/**
 * Meilleure qualité de correspondance entre la requête et l'un des champs.
 *
 * `null` quand aucun champ ne correspond. Les champs vides sont ignorés : un
 * `null` en base ne doit pas se comporter comme une chaîne vide qui matcherait.
 */
export function matchQualityOf(
  fields: readonly (string | null | undefined)[],
  query: string,
): MatchQuality | null {
  const needle = normalizeSearchText(query);
  if (needle.length < MIN_SEARCH_LENGTH) {
    return null;
  }

  let best: MatchQuality | null = null;
  for (const field of fields) {
    if (field === null || field === undefined || field === "") {
      continue;
    }
    const haystack = normalizeSearchText(field);
    if (haystack === needle) {
      // Rien ne bat une égalité : inutile de regarder les champs suivants.
      return "exact";
    }
    if (haystack.startsWith(needle)) {
      best = "prefix";
    } else if (best === null && haystack.includes(needle)) {
      best = "substring";
    }
  }
  return best;
}

/** Un résultat classable — le comparateur ne lit rien d'autre. */
export interface RankedResult {
  readonly kind: SearchKind;
  readonly quality: MatchQuality;
  /** Ce qui est affiché en tête de ligne, et qui départage à égalité parfaite. */
  readonly label: string;
}

function qualityRank(quality: MatchQuality): number {
  return MATCH_QUALITIES.indexOf(quality);
}

function kindRank(kind: SearchKind): number {
  return SEARCH_KINDS.indexOf(kind);
}

/**
 * Comparateur : négatif si `a` passe avant `b`.
 *
 * Trois clés — qualité, famille, libellé. La troisième n'est pas cosmétique :
 * sans elle, deux appels identiques pourraient rendre deux ordres différents,
 * et une liste qu'on parcourt aux flèches ne peut pas bouger sous les doigts.
 */
export function compareSearchResults(a: RankedResult, b: RankedResult): number {
  const byQuality = qualityRank(a.quality) - qualityRank(b.quality);
  if (byQuality !== 0) {
    return byQuality;
  }
  const byKind = kindRank(a.kind) - kindRank(b.kind);
  if (byKind !== 0) {
    return byKind;
  }
  return normalizeSearchText(a.label).localeCompare(normalizeSearchText(b.label));
}

/**
 * Les `MAX_SEARCH_RESULTS` meilleurs résultats, classés.
 *
 * Le plafond s'applique **après** le tri : on garde les vingt meilleurs, pas
 * les vingt premiers trouvés (spec 010, R3.2).
 */
export function rankSearchResults<T extends RankedResult>(results: readonly T[]): readonly T[] {
  return [...results].sort(compareSearchResults).slice(0, MAX_SEARCH_RESULTS);
}
