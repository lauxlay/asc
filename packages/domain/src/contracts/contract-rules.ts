import { addYears, type IsoDate, isAfter, isBefore } from "../date/iso-date.js";
import type { Contract, Id } from "../entities.js";

/**
 * Règles de validité d'un contrat d'entretien (spec 005, R2 et R3).
 *
 * Fonctions pures : elles répondent « ce contrat est-il légal, et entre-t-il en
 * conflit avec ceux qui existent ? » sans rien lire ni écrire.
 */

/**
 * Durée minimale légale d'un contrat d'entretien : un an
 * (loi SAE 2003, `docs/02-produit/05-conformite-reglementaire.md`).
 */
export const MINIMUM_CONTRACT_YEARS = 1;

/** Période couverte, `endsOn` à `null` valant « sans terme » (tacite reconduction). */
export interface CoveragePeriod {
  readonly startsOn: IsoDate;
  readonly endsOn: IsoDate | null;
}

/**
 * `true` si la période respecte la durée minimale légale (R2).
 *
 * Une période sans terme la respecte toujours : elle est ouverte, donc au moins
 * aussi longue qu'un an. La borne est **incluse** — du 1er janvier au 1er
 * janvier suivant fait exactement un an et convient.
 */
export function hasLegalDuration({ startsOn, endsOn }: CoveragePeriod): boolean {
  if (endsOn === null) {
    return true;
  }
  return !isBefore(endsOn, addYears(startsOn, MINIMUM_CONTRACT_YEARS));
}

/**
 * `true` si les deux périodes se recouvrent, ne serait-ce que d'un jour (R3.3).
 *
 * Deux contrats successifs ne se chevauchent pas : celui qui finit le 1er
 * janvier et celui qui commence le 2 sont disjoints. En revanche, deux
 * périodes ouvertes se chevauchent forcément.
 */
export function periodsOverlap(left: CoveragePeriod, right: CoveragePeriod): boolean {
  const leftEndsBeforeRight = left.endsOn !== null && isBefore(left.endsOn, right.startsOn);
  const rightEndsBeforeLeft = right.endsOn !== null && isBefore(right.endsOn, left.startsOn);
  return !(leftEndsBeforeRight || rightEndsBeforeLeft);
}

/**
 * Appareils du contrat déjà couverts par un contrat existant sur une période
 * qui se chevauche (R3.3).
 *
 * `existing` doit déjà être restreint au tenant de l'appelant et exclure le
 * contrat en cours de modification — le domaine ne connaît ni tenants ni
 * identité de requête.
 *
 * @returns les appareils en conflit, sans doublon, dans l'ordre de `unitIds`
 */
export function conflictingUnitIds(
  candidate: CoveragePeriod & { readonly unitIds: readonly Id[] },
  existing: readonly Contract[],
): readonly Id[] {
  const covered = new Set<Id>();
  for (const contract of existing) {
    if (!periodsOverlap(candidate, contract)) {
      continue;
    }
    for (const unitId of contract.unitIds) {
      covered.add(unitId);
    }
  }
  return [...new Set(candidate.unitIds)].filter((unitId) => covered.has(unitId));
}

/** Appareils cités plus d'une fois dans le même contrat (R3.6). */
export function duplicatedUnitIds(unitIds: readonly Id[]): readonly Id[] {
  const seen = new Set<Id>();
  const duplicated = new Set<Id>();
  for (const unitId of unitIds) {
    if (seen.has(unitId)) {
      duplicated.add(unitId);
    }
    seen.add(unitId);
  }
  return [...duplicated];
}

/** `true` si le contrat est en vigueur ce jour-là, bornes incluses. */
export function isActiveOn({ startsOn, endsOn }: CoveragePeriod, on: IsoDate): boolean {
  if (isBefore(on, startsOn)) {
    return false;
  }
  return endsOn === null || !isAfter(on, endsOn);
}
