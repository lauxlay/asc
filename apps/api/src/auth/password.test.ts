import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("hashPassword", () => {
  it("produit une empreinte scrypt paramétrée", async () => {
    const stored = await hashPassword("mot-de-passe");

    const [algorithm, n, r, p, salt, key] = stored.split("$");
    expect(algorithm).toBe("scrypt");
    expect(Number(n)).toBe(32768);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(salt).toBeTruthy();
    expect(key).toBeTruthy();
  });

  it("ne stocke jamais le mot de passe en clair", async () => {
    const stored = await hashPassword("mot-de-passe");

    expect(stored).not.toContain("mot-de-passe");
  });

  it("produit deux empreintes différentes pour le même mot de passe", async () => {
    // Sel aléatoire : deux comptes avec le même mot de passe ne se
    // reconnaissent pas à leur empreinte.
    const [first, second] = await Promise.all([
      hashPassword("identique"),
      hashPassword("identique"),
    ]);

    expect(first).not.toBe(second);
    expect(await verifyPassword("identique", first as string)).toBe(true);
    expect(await verifyPassword("identique", second as string)).toBe(true);
  });
});

describe("verifyPassword", () => {
  it("accepte le bon mot de passe", async () => {
    const stored = await hashPassword("bon-mot-de-passe");

    expect(await verifyPassword("bon-mot-de-passe", stored)).toBe(true);
  });

  it.each([
    ["mauvais", "mot de passe différent"],
    ["bon-mot-de-pass", "préfixe du bon"],
    ["Bon-mot-de-passe", "casse différente"],
    ["", "vide"],
  ])("refuse %o (%s)", async (candidate) => {
    const stored = await hashPassword("bon-mot-de-passe");

    expect(await verifyPassword(candidate, stored)).toBe(false);
  });

  it("refuse une empreinte altérée", async () => {
    const stored = await hashPassword("bon-mot-de-passe");
    const parts = stored.split("$");
    const tampered = [...parts.slice(0, 5), "AAAA"].join("$");

    expect(await verifyPassword("bon-mot-de-passe", tampered)).toBe(false);
  });

  it.each([
    ["", "chaîne vide"],
    ["pas-une-empreinte", "sans séparateur"],
    ["bcrypt$1$2$3$sel$empreinte", "autre algorithme"],
    ["scrypt$1$2$3", "champs manquants"],
    ["scrypt$0$8$1$sel$empreinte", "paramètre nul"],
    ["scrypt$abc$8$1$sel$empreinte", "paramètre non numérique"],
    ["scrypt$32768$8$1$sel$", "empreinte vide"],
  ])("rend false sans lever sur une empreinte illisible (%s)", async (stored) => {
    // Un enregistrement corrompu ne doit ni révéler d'information ni faire
    // tomber la route de login.
    await expect(verifyPassword("peu-importe", stored)).resolves.toBe(false);
  });
});
