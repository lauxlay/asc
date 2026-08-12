import { describe, expect, it } from "vitest";
import { DomainError } from "../errors.js";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareIsoDate,
  daysInMonth,
  differenceInDays,
  isAfter,
  isBefore,
  isIsoDate,
  isLeapYear,
  isoDate,
} from "./iso-date.js";

describe("isLeapYear", () => {
  it.each([
    [2024, true],
    [2026, false],
    [2023, false],
    [1900, false],
    [2100, false],
    [2000, true],
    [2400, true],
  ])("année %i bissextile : %s", (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });
});

describe("daysInMonth", () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2024, 2, 29],
    [2000, 2, 29],
    [2100, 2, 28],
    [2026, 4, 30],
    [2026, 12, 31],
  ])("%i-%i compte %i jours", (year, month, expected) => {
    expect(daysInMonth(year, month)).toBe(expected);
  });
});

describe("isIsoDate", () => {
  it.each(["2026-01-01", "2026-12-31", "2024-02-29", "2000-02-29", "1970-01-01"])(
    "accepte %s",
    (value) => {
      expect(isIsoDate(value)).toBe(true);
    },
  );

  it.each([
    ["", "chaîne vide"],
    ["2026-1-1", "sans zéro de remplissage"],
    ["2026-01-1", "jour sur un chiffre"],
    ["20260101", "sans séparateur"],
    ["2026/01/01", "mauvais séparateur"],
    ["2026-01-01T00:00:00Z", "horodatage"],
    ["2026-01-01 ", "espace en fin"],
    ["26-01-01", "année sur deux chiffres"],
    ["2026-00-10", "mois 0"],
    ["2026-13-01", "mois 13"],
    ["2026-01-00", "jour 0"],
    ["2026-01-32", "jour 32"],
    ["2026-02-29", "29 février hors bissextile"],
    ["2100-02-29", "29 février d'un siècle non bissextile"],
    ["2026-04-31", "31 avril"],
    ["2026-06-31", "31 juin"],
    ["aaaa-bb-cc", "non numérique"],
  ])("rejette %s (%s)", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("isoDate", () => {
  it("rend la date quand elle est valide", () => {
    expect(isoDate("2026-08-12")).toBe("2026-08-12");
  });

  it("lève une DomainError quand la date n'existe pas", () => {
    expect(() => isoDate("2026-02-30")).toThrow(DomainError);
    expect(() => isoDate("2026-02-30")).toThrow(/Date ISO invalide/);
  });
});

describe("addDays", () => {
  it.each([
    ["2026-08-12", 0, "2026-08-12"],
    ["2026-08-12", 1, "2026-08-13"],
    ["2026-08-12", -1, "2026-08-11"],
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2024-02-29", 1, "2024-03-01"],
    ["2026-01-01", 365, "2027-01-01"],
    ["2024-01-01", 365, "2024-12-31"],
    ["2026-08-12", 42, "2026-09-23"],
    ["2026-08-12", -42, "2026-07-01"],
    ["2026-08-12", 3650, "2036-08-09"],
  ])("%s %+i jours donne %s", (from, days, expected) => {
    expect(addDays(isoDate(from), days)).toBe(expected);
  });
});

describe("addWeeks", () => {
  it("ajoute des semaines de 7 jours", () => {
    expect(addWeeks(isoDate("2026-08-12"), 6)).toBe("2026-09-23");
    expect(addWeeks(isoDate("2026-08-12"), 0)).toBe("2026-08-12");
    expect(addWeeks(isoDate("2026-08-12"), -6)).toBe("2026-07-01");
  });

  it("équivaut à addDays(weeks * 7)", () => {
    expect(addWeeks(isoDate("2024-02-01"), 6)).toBe(addDays(isoDate("2024-02-01"), 42));
  });
});

describe("addMonths", () => {
  it.each([
    ["2026-08-12", 0, "2026-08-12"],
    ["2026-08-12", 1, "2026-09-12"],
    ["2026-08-12", -1, "2026-07-12"],
    ["2026-12-15", 1, "2027-01-15"],
    ["2026-01-15", -1, "2025-12-15"],
    ["2026-08-12", 12, "2027-08-12"],
    ["2026-08-12", -6, "2026-02-12"],
    ["2026-08-12", 30, "2029-02-12"],
  ])("%s %+i mois donne %s", (from, months, expected) => {
    expect(addMonths(isoDate(from), months)).toBe(expected);
  });

  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2024-01-31", 1, "2024-02-29"],
    ["2026-03-31", -1, "2026-02-28"],
    ["2026-08-31", -6, "2026-02-28"],
    ["2024-08-31", -6, "2024-02-29"],
    ["2026-05-31", 1, "2026-06-30"],
    ["2026-01-30", 1, "2026-02-28"],
  ])("écrête à la fin du mois : %s %+i mois donne %s", (from, months, expected) => {
    expect(addMonths(isoDate(from), months)).toBe(expected);
  });
});

describe("addYears", () => {
  it.each([
    ["2026-08-12", 5, "2031-08-12"],
    ["2026-08-12", 0, "2026-08-12"],
    ["2026-08-12", -5, "2021-08-12"],
    ["2020-02-29", 4, "2024-02-29"],
    ["2024-02-29", 5, "2029-02-28"],
    ["2024-02-29", 1, "2025-02-28"],
    ["2096-02-29", 4, "2100-02-28"],
    ["1996-02-29", 4, "2000-02-29"],
  ])("%s %+i ans donne %s", (from, years, expected) => {
    expect(addYears(isoDate(from), years)).toBe(expected);
  });
});

describe("compareIsoDate / isBefore / isAfter", () => {
  const early = isoDate("2026-08-11");
  const late = isoDate("2026-08-12");

  it("ordonne les dates", () => {
    expect(compareIsoDate(early, late)).toBe(-1);
    expect(compareIsoDate(late, early)).toBe(1);
    expect(compareIsoDate(late, late)).toBe(0);
  });

  it("compare correctement au passage d'année", () => {
    expect(compareIsoDate(isoDate("2026-12-31"), isoDate("2027-01-01"))).toBe(-1);
  });

  it("expose des prédicats stricts", () => {
    expect(isBefore(early, late)).toBe(true);
    expect(isBefore(late, late)).toBe(false);
    expect(isAfter(late, early)).toBe(true);
    expect(isAfter(late, late)).toBe(false);
  });
});

describe("differenceInDays", () => {
  it.each([
    ["2026-08-12", "2026-08-12", 0],
    ["2026-08-12", "2026-08-13", 1],
    ["2026-08-13", "2026-08-12", -1],
    ["2026-08-12", "2026-09-23", 42],
    ["2026-01-01", "2027-01-01", 365],
    ["2024-01-01", "2025-01-01", 366],
    ["2024-02-28", "2024-03-01", 2],
    ["2026-02-28", "2026-03-01", 1],
    ["2100-02-28", "2100-03-01", 1],
  ])("de %s à %s : %i jours", (from, to, expected) => {
    expect(differenceInDays(isoDate(from), isoDate(to))).toBe(expected);
  });

  it("est l'inverse d'addDays", () => {
    const from = isoDate("2026-08-12");
    expect(differenceInDays(from, addDays(from, 1234))).toBe(1234);
  });
});
