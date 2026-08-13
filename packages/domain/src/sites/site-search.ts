import type { Site } from "../entities.js";

/**
 * Recherche d'un site par adresse (spec 002, R2).
 *
 * Le dispatcher au téléphone tape ce que le gardien lui dit — « les lilas »,
 * « 12 rue » — sans savoir dans quel champ ça tombe, sans composer d'accents et
 * sans soigner ses espaces. La correspondance est donc volontairement large :
 * sous-chaîne, insensible à la casse et aux diacritiques.
 *
 * Fonction pure, sans I/O : c'est la règle de correspondance, pas son exécution
 * sur un stockage. Le jour où le stockage sait filtrer, cette règle reste la
 * référence de comportement.
 */

/** Champs balayés, réunis : une requête peut tomber dans n'importe lequel. */
const SEARCHABLE_FIELDS = [
  "name",
  "addressLine",
  "postalCode",
  "city",
] as const satisfies readonly (keyof Site)[];

/**
 * Forme comparable d'un texte : sans accent, en minuscules, espaces normalisés.
 *
 * `Église` et `eglise` doivent se rencontrer ; `12   rue` et `12 rue` aussi.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `true` si le site correspond à la requête.
 *
 * Une requête vide correspond à **tout** : un champ de recherche qu'on n'a pas
 * encore rempli ne doit pas vider la liste (R2.4).
 */
export function siteMatchesQuery(site: Site, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (needle === "") {
    return true;
  }
  return SEARCHABLE_FIELDS.some((field) => normalizeSearchText(site[field]).includes(needle));
}
