import { addDays, differenceInDays, type IsoDate } from "./iso-date.js";

/**
 * Semaine du planning (spec 008, R5) : du lundi au dimanche.
 *
 * Tout se calcule en **jours calendaires**, jamais en instants. Les
 * changements d'heure n'ont donc aucune prise sur ces fonctions : une semaine
 * fait sept jours, y compris celle où l'on passe à l'heure d'été.
 */

export const DAYS_PER_WEEK = 7;

/** Un lundi de référence — 1970-01-01 était un jeudi. */
const REFERENCE_MONDAY = "1970-01-05" as IsoDate;

/** Rang du jour dans la semaine ISO : 1 = lundi … 7 = dimanche. */
export function dayOfWeek(value: IsoDate): number {
  const offset = differenceInDays(REFERENCE_MONDAY, value);
  return (((offset % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK) + 1;
}

/** Lundi de la semaine contenant `value` — `value` lui-même s'il est un lundi. */
export function startOfWeek(value: IsoDate): IsoDate {
  return addDays(value, 1 - dayOfWeek(value));
}

/**
 * Les sept jours de la semaine contenant `value`, du lundi au dimanche.
 *
 * La normalisation est interne : un appelant qui passe un jeudi obtient la
 * semaine de ce jeudi, pas sept jours à partir de jeudi.
 */
export function weekDays(value: IsoDate): readonly IsoDate[] {
  const monday = startOfWeek(value);
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDays(monday, index));
}

/** `true` si les deux jours tombent dans la même semaine. */
export function isSameWeek(a: IsoDate, b: IsoDate): boolean {
  return startOfWeek(a) === startOfWeek(b);
}
