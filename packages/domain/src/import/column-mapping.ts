import { normalizeSearchText } from "../sites/site-search.js";

/**
 * Correspondance assistée entre les colonnes d'un fichier et les champs du
 * parc (spec 004, R2).
 *
 * Les exports de parc nomment leurs colonnes comme ils veulent. Deviner évite
 * à l'utilisateur de tout réaffecter à la main, sans jamais lui retirer le
 * dernier mot : la suggestion est modifiable.
 */

/** Champs alimentables depuis le fichier. */
export const IMPORT_FIELDS = [
  "siteName",
  "addressLine",
  "postalCode",
  "city",
  "reference",
  "commissionedOn",
  "lastStatutoryInspectionOn",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Champs sans lesquels une ligne ne décrit ni un immeuble ni un appareil (R2.5). */
export const REQUIRED_IMPORT_FIELDS = [
  "siteName",
  "addressLine",
  "postalCode",
  "city",
  "reference",
] as const satisfies readonly ImportField[];

/**
 * Correspondance : pour chaque champ, l'index de la colonne du fichier qui
 * l'alimente, ou `null` si aucune.
 */
export type ColumnMapping = Readonly<Record<ImportField, number | null>>;

/**
 * Noms reconnus par champ (spec 004, R2.2), comparés après normalisation —
 * sans casse, sans accents, espaces réduits.
 *
 * L'ordre compte : le premier synonyme trouvé gagne, donc les intitulés les
 * plus spécifiques passent avant les plus vagues (`nom` en dernier recours).
 */
const SYNONYMS: Readonly<Record<ImportField, readonly string[]>> = {
  siteName: ["immeuble", "residence", "site", "batiment", "nom de l'immeuble", "nom"],
  addressLine: ["adresse", "voie", "rue", "numero et voie", "n° et voie"],
  postalCode: ["code postal", "cp", "codepostal", "code post"],
  city: ["ville", "commune", "localite"],
  reference: [
    "repere",
    "reference",
    "numero appareil",
    "n° appareil",
    "numero d'appareil",
    "appareil",
    "ascenseur",
  ],
  commissionedOn: ["date de mise en service", "mise en service", "miseenservice", "installation"],
  lastStatutoryInspectionOn: [
    "dernier controle technique",
    "controle technique",
    "quinquennal",
    "dernier controle",
  ],
};

/**
 * Devine la correspondance à partir des noms de colonnes.
 *
 * Une colonne ne peut alimenter qu'un seul champ (R2.4) : dès qu'elle est
 * prise, elle n'est plus proposée. Les champs sont traités dans l'ordre de
 * `IMPORT_FIELDS`, ce qui rend le résultat déterministe.
 */
export function suggestColumnMapping(headers: readonly string[]): ColumnMapping {
  const normalized = headers.map((header) => normalizeSearchText(header));
  const taken = new Set<number>();
  const mapping: Record<ImportField, number | null> = {
    siteName: null,
    addressLine: null,
    postalCode: null,
    city: null,
    reference: null,
    commissionedOn: null,
    lastStatutoryInspectionOn: null,
  };

  for (const field of IMPORT_FIELDS) {
    for (const synonym of SYNONYMS[field]) {
      const wanted = normalizeSearchText(synonym);
      const index = normalized.findIndex(
        (header, position) => !taken.has(position) && header === wanted,
      );
      if (index !== -1) {
        mapping[field] = index;
        taken.add(index);
        break;
      }
    }
  }
  return mapping;
}

/** Champs obligatoires laissés sans colonne (R2.5). */
export function missingRequiredFields(mapping: ColumnMapping): readonly ImportField[] {
  return REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === null);
}

/** Colonnes affectées à plus d'un champ (R2.4). */
export function duplicatedColumns(mapping: ColumnMapping): readonly number[] {
  const seen = new Set<number>();
  const duplicated = new Set<number>();

  for (const field of IMPORT_FIELDS) {
    const column = mapping[field];
    if (column === null) {
      continue;
    }
    if (seen.has(column)) {
      duplicated.add(column);
    }
    seen.add(column);
  }
  return [...duplicated].sort((left, right) => left - right);
}
