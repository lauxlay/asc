import { DomainError } from "../errors.js";

/**
 * Jour calendaire UTC au format ISO 8601 `YYYY-MM-DD`.
 *
 * Le domaine raisonne en jours, jamais en instants (spec 001, R6) : la règle
 * des 6 semaines est une règle de calendrier. Convertir un horodatage en jour
 * calendaire est une affaire de frontière, pas de domaine.
 *
 * Type marqué : une chaîne quelconque ne peut pas être passée pour une date.
 */
declare const isoDateBrand: unique symbol;
export type IsoDate = string & { readonly [isoDateBrand]: true };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 86_400_000;

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Règle grégorienne complète : divisible par 4, sauf les siècles non divisibles par 400. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Nombre de jours du mois (`month` de 1 à 12). */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return DAYS_PER_MONTH[month - 1] ?? 0;
}

/** `true` si la chaîne est un jour calendaire réel (`2026-02-29` ne l'est pas). */
export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return false;
  }
  const day = Number(match[3]);
  return day >= 1 && day <= daysInMonth(Number(match[1]), month);
}

/** Construit une `IsoDate`. Lève `DomainError` si la date n'existe pas. */
export function isoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new DomainError(`Date ISO invalide : "${value}" (attendu YYYY-MM-DD)`);
  }
  return value;
}

function toParts(value: IsoDate): DateParts {
  // Le format a été validé à la construction : la découpe ne peut pas échouer.
  const match = ISO_DATE_PATTERN.exec(value) as RegExpExecArray;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function format({ year, month, day }: DateParts): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate;
}

/**
 * `Date.UTC` mappe les années 0–99 sur 1900–1999 : on rétablit l'année réelle.
 * Sans horaire ni fuseau, un jour fait toujours exactement 86 400 000 ms.
 */
function toEpochDay({ year, month, day }: DateParts): number {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year >= 0 && year < 100) {
    date.setUTCFullYear(year);
  }
  return date.getTime() / MS_PER_DAY;
}

function fromEpochDay(epochDay: number): DateParts {
  const date = new Date(epochDay * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Décale de `days` jours (négatif accepté). */
export function addDays(value: IsoDate, days: number): IsoDate {
  return format(fromEpochDay(toEpochDay(toParts(value)) + days));
}

/** Décale de `weeks` semaines (négatif accepté). */
export function addWeeks(value: IsoDate, weeks: number): IsoDate {
  return addDays(value, weeks * 7);
}

/**
 * Décale de `months` mois, en **écrêtant** à la fin du mois d'arrivée :
 * `2026-01-31 + 1 mois` donne `2026-02-28`, jamais `2026-03-03`.
 * L'échéance tombe donc plus tôt — le sens strict pour de la conformité.
 */
export function addMonths(value: IsoDate, months: number): IsoDate {
  const { year, month, day } = toParts(value);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12 + 1;
  return format({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/** Décale de `years` années, avec le même écrêtage : `2024-02-29 + 5 ans` donne `2029-02-28`. */
export function addYears(value: IsoDate, years: number): IsoDate {
  return addMonths(value, years * 12);
}

/** `-1` si `a` précède `b`, `0` si identiques, `1` sinon. */
export function compareIsoDate(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b;
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return a > b;
}

/** Nombre de jours de `from` à `to` : négatif si `to` précède `from`. */
export function differenceInDays(from: IsoDate, to: IsoDate): number {
  return toEpochDay(toParts(to)) - toEpochDay(toParts(from));
}
