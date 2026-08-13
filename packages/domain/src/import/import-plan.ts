import { type IsoDate, isIsoDate, isoDate } from "../date/iso-date.js";
import type { Id, Site, Unit } from "../entities.js";
import { normalizeSearchText } from "../sites/site-search.js";
import {
  type ColumnMapping,
  duplicatedColumns,
  type ImportField,
  missingRequiredFields,
} from "./column-mapping.js";
import type { CsvRow, CsvTable } from "./csv.js";

/**
 * Construction du plan d'import (spec 004, R3 à R6).
 *
 * Fonction pure : elle ne décide pas des identifiants et n'écrit rien. Elle
 * répond à « qu'est-ce que cet import ferait, et qu'est-ce qui cloche ? », ce
 * qui permet à l'écran d'analyse et à l'exécution de partager exactement la
 * même vérité.
 */

/** Immeuble du plan : soit réutilisé (`existingId`), soit à créer. */
export interface PlannedSite {
  /** Clé d'adresse normalisée : le lien avec les appareils du plan. */
  readonly key: string;
  readonly existingId: Id | null;
  readonly name: string;
  readonly addressLine: string;
  readonly postalCode: string;
  readonly city: string;
}

export interface PlannedUnit {
  readonly siteKey: string;
  readonly reference: string;
  readonly commissionedOn: IsoDate | null;
  readonly lastStatutoryInspectionOn: IsoDate | null;
  /** Ligne du fichier d'où vient l'appareil, pour remonter à l'erreur. */
  readonly lineNumber: number;
}

export interface ImportIssue {
  /** Numéro de ligne dans le fichier ; `null` pour une erreur de fichier. */
  readonly lineNumber: number | null;
  readonly message: string;
}

export interface ImportPlan {
  readonly sites: readonly PlannedSite[];
  readonly units: readonly PlannedUnit[];
  /** Vide = le plan est exécutable. Sinon rien ne doit être écrit (R4.3). */
  readonly issues: readonly ImportIssue[];
  /** Immeubles qui seraient créés (les autres sont réutilisés). */
  readonly createdSiteCount: number;
  readonly reusedSiteCount: number;
}

/** Libellés français des champs, pour des messages d'erreur lisibles. */
const FIELD_LABELS: Readonly<Record<ImportField, string>> = {
  siteName: "nom de l'immeuble",
  addressLine: "adresse",
  postalCode: "code postal",
  city: "ville",
  reference: "repère de l'appareil",
  commissionedOn: "mise en service",
  lastStatutoryInspectionOn: "dernier contrôle technique",
};

const FRENCH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Clé de regroupement d'un immeuble : son adresse, normalisée (R3.1).
 *
 * Le nom n'en fait pas partie (R3.4) : deux bâtiments à la même adresse sous
 * deux appellations sont le même immeuble.
 */
export function siteKeyOf(addressLine: string, postalCode: string, city: string): string {
  return [addressLine, postalCode, city].map((part) => normalizeSearchText(part)).join(" | ");
}

/** Clé de doublon d'un appareil : son repère dans son immeuble (R5). */
function unitKeyOf(siteKey: string, reference: string): string {
  return `${siteKey} :: ${normalizeSearchText(reference)}`;
}

/**
 * Lit une date de cellule (R6).
 *
 * `undefined` signale une valeur invalide, à distinguer de `null` qui est une
 * date légitimement inconnue.
 */
function readDate(raw: string): IsoDate | null | undefined {
  if (raw === "") {
    return null;
  }
  const french = FRENCH_DATE.exec(raw);
  const candidate = french === null ? raw : `${french[3]}-${french[2]}-${french[1]}`;
  return isIsoDate(candidate) ? isoDate(candidate) : undefined;
}

function cellOf(row: CsvRow, column: number | null): string {
  return column === null ? "" : (row.cells[column] ?? "");
}

/**
 * Construit le plan à partir du fichier, de la correspondance confirmée et du
 * parc existant.
 *
 * `existingSites` et `existingUnits` doivent déjà être restreints au tenant de
 * l'appelant : le domaine ne connaît pas les tenants, il fait confiance à ce
 * qu'on lui donne (R7 est une responsabilité de l'appelant).
 */
export function buildImportPlan(
  table: CsvTable,
  mapping: ColumnMapping,
  existingSites: readonly Site[],
  existingUnits: readonly Unit[],
): ImportPlan {
  const issues: ImportIssue[] = [];

  for (const field of missingRequiredFields(mapping)) {
    issues.push({
      lineNumber: null,
      message: `Aucune colonne ne correspond au champ obligatoire « ${FIELD_LABELS[field]} »`,
    });
  }
  for (const column of duplicatedColumns(mapping)) {
    issues.push({
      lineNumber: null,
      message: `La colonne « ${table.headers[column] ?? column} » est affectée à plusieurs champs`,
    });
  }
  if (table.rows.length === 0) {
    issues.push({ lineNumber: null, message: "Le fichier ne contient aucune ligne de données" });
  }
  if (issues.length > 0) {
    // Sans correspondance exploitable, valider les lignes n'apprendrait rien
    // d'utile : on rendrait des centaines d'erreurs toutes dues à la même cause.
    return { sites: [], units: [], issues, createdSiteCount: 0, reusedSiteCount: 0 };
  }

  const sitesByKey = new Map<string, PlannedSite>();
  const units: PlannedUnit[] = [];

  const existingSiteByKey = new Map(
    existingSites.map((site) => [siteKeyOf(site.addressLine, site.postalCode, site.city), site]),
  );
  const existingSiteById = new Map(existingSites.map((site) => [site.id, site]));

  /** Repères déjà pris, dans le parc puis au fil du fichier (R5.1 et R5.2). */
  const takenUnitKeys = new Set<string>();
  for (const unit of existingUnits) {
    const site = existingSiteById.get(unit.siteId);
    if (site === undefined) {
      continue;
    }
    const key = siteKeyOf(site.addressLine, site.postalCode, site.city);
    takenUnitKeys.add(unitKeyOf(key, unit.reference));
  }
  const alreadyInPark = new Set(takenUnitKeys);

  for (const row of table.rows) {
    const name = cellOf(row, mapping.siteName);
    const addressLine = cellOf(row, mapping.addressLine);
    const postalCode = cellOf(row, mapping.postalCode);
    const city = cellOf(row, mapping.city);
    const reference = cellOf(row, mapping.reference);

    let rowIsValid = true;
    for (const [field, value] of [
      ["siteName", name],
      ["addressLine", addressLine],
      ["postalCode", postalCode],
      ["city", city],
      ["reference", reference],
    ] as const) {
      if (value === "") {
        issues.push({
          lineNumber: row.lineNumber,
          message: `Le champ « ${FIELD_LABELS[field]} » est vide`,
        });
        rowIsValid = false;
      }
    }

    const commissionedOn = readDate(cellOf(row, mapping.commissionedOn));
    if (commissionedOn === undefined) {
      issues.push({
        lineNumber: row.lineNumber,
        message: `Date de mise en service invalide : « ${cellOf(row, mapping.commissionedOn)} »`,
      });
      rowIsValid = false;
    }
    const lastStatutoryInspectionOn = readDate(cellOf(row, mapping.lastStatutoryInspectionOn));
    if (lastStatutoryInspectionOn === undefined) {
      issues.push({
        lineNumber: row.lineNumber,
        message: `Date de contrôle technique invalide : « ${cellOf(
          row,
          mapping.lastStatutoryInspectionOn,
        )} »`,
      });
      rowIsValid = false;
    }

    if (!rowIsValid) {
      continue;
    }

    const key = siteKeyOf(addressLine, postalCode, city);
    if (!sitesByKey.has(key)) {
      const existing = existingSiteByKey.get(key);
      sitesByKey.set(key, {
        key,
        existingId: existing?.id ?? null,
        // Un immeuble déjà au parc garde son nom : l'import ajoute des
        // appareils, il ne renomme pas ce que l'utilisateur a saisi.
        name: existing?.name ?? name,
        addressLine: existing?.addressLine ?? addressLine,
        postalCode: existing?.postalCode ?? postalCode,
        city: existing?.city ?? city,
      });
    }

    const unitKey = unitKeyOf(key, reference);
    if (takenUnitKeys.has(unitKey)) {
      issues.push({
        lineNumber: row.lineNumber,
        message: alreadyInPark.has(unitKey)
          ? `L'appareil « ${reference} » existe déjà dans cet immeuble`
          : `L'appareil « ${reference} » est en double dans le fichier pour cet immeuble`,
      });
      continue;
    }
    takenUnitKeys.add(unitKey);

    units.push({
      siteKey: key,
      reference,
      commissionedOn: commissionedOn ?? null,
      lastStatutoryInspectionOn: lastStatutoryInspectionOn ?? null,
      lineNumber: row.lineNumber,
    });
  }

  const sites = [...sitesByKey.values()];
  return {
    sites,
    units,
    issues,
    createdSiteCount: sites.filter((site) => site.existingId === null).length,
    reusedSiteCount: sites.filter((site) => site.existingId !== null).length,
  };
}
