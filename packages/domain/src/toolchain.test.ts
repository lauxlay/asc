import { describe, expect, it } from "vitest";

/**
 * Test fumigène du bootstrap (lot L0.1) : prouve que Vitest tourne en local
 * et en CI. Remplacé par les vrais tests métier au lot L0.2.
 */
describe("toolchain", () => {
  it("exécute les tests TypeScript", () => {
    expect(1 + 1).toBe(2);
  });
});
