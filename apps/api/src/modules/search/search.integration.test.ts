import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createCustomer,
  createSite,
  createTestApp,
  createUnit,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

/** Spec 010 — recherche globale. */

interface SearchBody {
  readonly items: {
    readonly kind: string;
    readonly id: string;
    readonly label: string;
    readonly sublabel: string;
    readonly targetId: string;
  }[];
  readonly truncated: boolean;
}

describe("GET /search", () => {
  let api: TestApp;
  let token: string;
  let siteId: string;
  let unitId: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
    siteId = await createSite(api, token);
    unitId = await createUnit(api, token, siteId, "Ascenseur A");
  });

  afterEach(async () => {
    await api.close();
  });

  const search = (q: string, bearerToken = token) =>
    api.inject({
      method: "GET",
      url: `/api/search?q=${encodeURIComponent(q)}`,
      headers: bearer(bearerToken),
    });

  const resultsOf = async (q: string): Promise<SearchBody["items"]> =>
    (await search(q)).json<SearchBody>().items;

  describe("ce qu'on trouve", () => {
    it("trouve un immeuble par son nom", async () => {
      const items = await resultsOf("Tilleuls");

      expect(items.some((item) => item.kind === "site" && item.id === siteId)).toBe(true);
    });

    it("trouve un immeuble par son adresse et par sa ville", async () => {
      expect((await resultsOf("rue des Lilas")).some((item) => item.id === siteId)).toBe(true);
      expect((await resultsOf("Lyon")).some((item) => item.id === siteId)).toBe(true);
    });

    it("trouve un appareil par son repère", async () => {
      const items = await resultsOf("Ascenseur A");

      expect(items.some((item) => item.kind === "unit" && item.id === unitId)).toBe(true);
    });

    it("trouve un appareil par le nom de son immeuble", async () => {
      // Le cas d'usage du découpage : un gardien dit « c'est aux Tilleuls ».
      const items = await resultsOf("Tilleuls");

      expect(items.some((item) => item.kind === "unit" && item.id === unitId)).toBe(true);
    });

    it("mène l'appareil à la fiche de son immeuble", async () => {
      // Un appareil n'a pas de page à lui : la destination est une décision
      // produit, pas une convention de client (R4).
      const unit = (await resultsOf("Ascenseur A")).find((item) => item.kind === "unit");

      expect(unit?.targetId).toBe(siteId);
      expect(unit?.id).toBe(unitId);
    });

    it("situe l'appareil par son immeuble", async () => {
      const unit = (await resultsOf("Ascenseur A")).find((item) => item.kind === "unit");

      expect(unit?.sublabel).toContain("Résidence Les Tilleuls");
    });

    it("trouve un client par son nom", async () => {
      const customerId = await createCustomer(api, token, { name: "Cabinet Marchand" });

      const items = await resultsOf("Marchand");

      expect(items.some((item) => item.kind === "customer" && item.id === customerId)).toBe(true);
    });

    it("trouve un OT par son numéro et par son objet", async () => {
      const created = await api.inject({
        method: "POST",
        url: "/api/work-orders",
        headers: bearer(token),
        payload: { unitId, summary: "Porte qui grince au troisième" },
      });
      const { id, reference } = created.json<{ id: string; reference: string }>();

      expect((await resultsOf(reference)).some((item) => item.id === id)).toBe(true);
      expect((await resultsOf("grince")).some((item) => item.id === id)).toBe(true);
    });

    it("trouve un contrat par son numéro", async () => {
      const created = await api.inject({
        method: "POST",
        url: "/api/contracts",
        headers: bearer(token),
        payload: {
          reference: "CT-2026-777",
          type: "minimal",
          unitIds: [unitId],
          startsOn: "2026-01-01",
        },
      });
      const contractId = created.json<{ id: string }>().id;

      const items = await resultsOf("CT-2026-777");

      expect(items.some((item) => item.kind === "contract" && item.id === contractId)).toBe(true);
    });

    it("ignore la casse et les accents", async () => {
      await createSite(api, token, { name: "Résidence Église", addressLine: "3 place du Marché" });

      expect((await resultsOf("eglise")).some((item) => item.label === "Résidence Église")).toBe(
        true,
      );
    });
  });

  describe("ce qu'on ne trouve pas", () => {
    it("ne rend rien sur une requête vide", async () => {
      expect(await resultsOf("")).toStrictEqual([]);
    });

    it("ne rend rien sur un seul caractère", async () => {
      // Sur une lettre, tout correspondrait.
      expect(await resultsOf("a")).toStrictEqual([]);
    });

    it("ne rend rien sur des espaces seuls", async () => {
      expect(await resultsOf("   ")).toStrictEqual([]);
    });

    it("ne rend rien quand rien ne correspond", async () => {
      expect(await resultsOf("zzzzz-introuvable")).toStrictEqual([]);
    });
  });

  describe("classement", () => {
    it("place l'égalité exacte en tête", async () => {
      // Un immeuble dont le nom contient le repère cherché ne doit pas passer
      // devant l'appareil qui s'appelle exactement comme ça.
      await createSite(api, token, {
        name: "Immeuble Ascenseur A bis",
        addressLine: "8 rue Neuve",
      });

      const items = await resultsOf("Ascenseur A");

      expect(items[0]?.kind).toBe("unit");
      expect(items[0]?.label).toBe("Ascenseur A");
    });

    it("place l'appareil devant le client à qualité égale", async () => {
      // Le nom du client **contient** le terme sans commencer par lui, comme
      // l'immeuble de l'appareil : les deux sont en sous-chaîne, et c'est donc
      // la famille qui départage.
      await createCustomer(api, token, { name: "Gestion Les Tilleuls" });

      const kinds = (await resultsOf("Tilleuls")).map((item) => item.kind);

      expect(kinds.indexOf("unit")).toBeLessThan(kinds.indexOf("customer"));
    });

    it("laisse la qualité passer devant la famille", async () => {
      // Un client dont le nom **commence** par le terme passe devant un
      // appareil qui ne le contient qu'au milieu de l'adresse de son immeuble.
      await createCustomer(api, token, { name: "Tilleuls Gestion" });

      const kinds = (await resultsOf("Tilleuls")).map((item) => item.kind);

      expect(kinds.indexOf("customer")).toBeLessThan(kinds.indexOf("unit"));
    });

    it("rend deux fois le même ordre", async () => {
      const first = (await resultsOf("Tilleuls")).map((item) => item.id);
      const second = (await resultsOf("Tilleuls")).map((item) => item.id);

      expect(first).toStrictEqual(second);
    });
  });

  describe("volume", () => {
    it("plafonne à vingt résultats et le signale", async () => {
      for (let index = 0; index < 25; index += 1) {
        await createUnit(api, token, siteId, `Cabine ${String(index).padStart(2, "0")}`);
      }

      const body = (await search("Cabine")).json<SearchBody>();

      expect(body.items).toHaveLength(20);
      expect(body.truncated).toBe(true);
    });

    it("ne signale rien quand tout tient", async () => {
      expect((await search("Tilleuls")).json<SearchBody>().truncated).toBe(false);
    });
  });

  describe("isolation multi-tenant", () => {
    it("ne rend rien depuis un autre tenant, même sur le nom exact", async () => {
      const otherToken = await api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

      const body = (await search("Résidence Les Tilleuls", otherToken)).json<SearchBody>();

      expect(body.items).toStrictEqual([]);
    });
  });

  it("exige un jeton", async () => {
    expect((await api.inject({ method: "GET", url: "/api/search?q=tilleuls" })).statusCode).toBe(
      401,
    );
  });
});
