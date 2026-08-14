import { describe, expect, it } from "vitest";
import { addDays, isoDate } from "./iso-date.js";
import { DAYS_PER_WEEK, dayOfWeek, isSameWeek, startOfWeek, weekDays } from "./week.js";

/** Spec 008, R5 — la semaine du planning, du lundi au dimanche. */

describe("dayOfWeek", () => {
  it.each([
    ["2026-08-10", 1, "lundi"],
    ["2026-08-11", 2, "mardi"],
    ["2026-08-12", 3, "mercredi"],
    ["2026-08-13", 4, "jeudi"],
    ["2026-08-14", 5, "vendredi"],
    ["2026-08-15", 6, "samedi"],
    ["2026-08-16", 7, "dimanche"],
  ])("%s → %s (%s)", (value, expected) => {
    expect(dayOfWeek(isoDate(value))).toBe(expected);
  });

  it("reste juste avant l'époque de référence", () => {
    // 1969-12-29 était un lundi : le modulo doit tenir sur les jours négatifs.
    expect(dayOfWeek(isoDate("1969-12-29"))).toBe(1);
    expect(dayOfWeek(isoDate("1969-12-28"))).toBe(7);
  });

  it("avance d'un rang par jour sur plus d'un an, sans trou ni répétition", () => {
    // Part d'un lundi et traverse un 29 février, deux changements d'heure et
    // un passage d'année.
    let day = isoDate("2027-12-27");
    for (let index = 0; index < 400; index += 1) {
      expect(dayOfWeek(day)).toBe((index % DAYS_PER_WEEK) + 1);
      day = addDays(day, 1);
    }
  });
});

describe("startOfWeek", () => {
  it("rend le lundi de la semaine", () => {
    expect(startOfWeek(isoDate("2026-08-13"))).toBe("2026-08-10");
    expect(startOfWeek(isoDate("2026-08-16"))).toBe("2026-08-10");
  });

  it("laisse un lundi en place", () => {
    expect(startOfWeek(isoDate("2026-08-10"))).toBe("2026-08-10");
  });

  it("est idempotente", () => {
    const monday = startOfWeek(isoDate("2026-08-15"));
    expect(startOfWeek(monday)).toBe(monday);
  });

  it("remonte sur l'année précédente quand la semaine est à cheval", () => {
    // 2027-01-01 est un vendredi : sa semaine commence en 2026.
    expect(startOfWeek(isoDate("2027-01-01"))).toBe("2026-12-28");
  });

  it("traverse un 29 février", () => {
    // 2028-03-01 est un mercredi ; le lundi précédent est le 28 février,
    // l'année étant bissextile.
    expect(startOfWeek(isoDate("2028-03-01"))).toBe("2028-02-28");
  });
});

describe("weekDays", () => {
  it("rend sept jours consécutifs du lundi au dimanche", () => {
    expect(weekDays(isoDate("2026-08-13"))).toStrictEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });

  it("normalise elle-même : n'importe quel jour rend la même semaine", () => {
    const reference = weekDays(isoDate("2026-08-10"));
    for (const day of reference) {
      expect(weekDays(day)).toStrictEqual(reference);
    }
  });

  it("fait sept jours même la semaine du changement d'heure", () => {
    // Dernier dimanche de mars 2026 : le passage à l'heure d'été n'a aucune
    // prise sur des jours calendaires.
    expect(weekDays(isoDate("2026-03-29"))).toStrictEqual([
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
    ]);
  });

  it("enjambe le passage d'année", () => {
    expect(weekDays(isoDate("2026-12-31"))).toStrictEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("isSameWeek", () => {
  it("réunit le lundi et le dimanche qui suit", () => {
    expect(isSameWeek(isoDate("2026-08-10"), isoDate("2026-08-16"))).toBe(true);
  });

  it("sépare le dimanche du lundi qui suit", () => {
    expect(isSameWeek(isoDate("2026-08-16"), isoDate("2026-08-17"))).toBe(false);
  });

  it("ne se laisse pas tromper par le changement d'année", () => {
    expect(isSameWeek(isoDate("2026-12-31"), isoDate("2027-01-01"))).toBe(true);
  });
});
