import { addDays, isoDate } from "@asc/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createSite,
  createTestApp,
  createUnit,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

/** Spec 006 — tableau de conformité du parc. */

/** Jour d'évaluation du serveur : les scénarios se datent par rapport à lui. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Décalage en jours par rapport à aujourd'hui, au format ISO. */
function daysFromToday(offset: number): string {
  return addDays(isoDate(today()), offset);
}

describe("GET /compliance", () => {
  let api: TestApp;
  let token: string;
  let siteId: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
    siteId = await createSite(api, token);
  });

  afterEach(async () => {
    await api.close();
  });

  const overview = (query = "") =>
    api.inject({ method: "GET", url: `/api/compliance${query}`, headers: bearer(token) });

  const body = async (query = "") =>
    (await overview(query)).json<{
      evaluatedOn: string;
      summary: {
        total: number;
        overdue: number;
        dueSoon: number;
        ok: number;
        unknown: number;
        withoutContract: number;
      };
      items: {
        unitReference: string;
        siteName: string;
        contractReference: string | null;
        status: string;
        visit: { dueOn: string; status: string } | null;
        inspection: { dueOn: string; status: string } | null;
      }[];
    }>();

  /** Couvre `unitIds` par un contrat prenant effet il y a `startedDaysAgo` jours. */
  const coverWith = (unitIds: readonly string[], startedDaysAgo: number, reference: string) =>
    api.inject({
      method: "POST",
      url: "/api/contracts",
      headers: bearer(token),
      payload: {
        reference,
        type: "minimal",
        unitIds,
        startsOn: daysFromToday(-startedDaysAgo),
      },
    });

  describe("une ligne par appareil", () => {
    it("rend une ligne vide quand le parc est vide", async () => {
      const result = await body();

      expect(result.items).toStrictEqual([]);
      expect(result.summary.total).toBe(0);
    });

    it("liste chaque appareil, contrat ou pas", async () => {
      await createUnit(api, token, siteId, "Ascenseur A");
      await createUnit(api, token, siteId, "Ascenseur B");

      const result = await body();

      expect(result.items).toHaveLength(2);
      expect(result.summary.total).toBe(2);
    });

    it("garde visible un appareil sans contrat ni date connue", async () => {
      // Le piège du lot : cet appareil ne produit aucune échéance. S'il
      // disparaissait du tableau, le plus problématique passerait pour conforme.
      await createUnit(api, token, siteId, "Ascenseur orphelin");

      const result = await body();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.unitReference).toBe("Ascenseur orphelin");
      expect(result.items[0]?.visit).toBeNull();
      expect(result.items[0]?.inspection).toBeNull();
    });

    it("marque cet appareil inconnu, jamais à jour", async () => {
      await createUnit(api, token, siteId, "Ascenseur orphelin");

      const result = await body();

      expect(result.items[0]?.status).toBe("unknown");
      expect(result.summary.unknown).toBe(1);
      expect(result.summary.ok).toBe(0);
    });

    it("porte le nom de l'immeuble et la référence du contrat", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      await coverWith([unitId], 10, "CT-2026-001");

      const result = await body();

      expect(result.items[0]?.siteName).toBe("Résidence Les Tilleuls");
      expect(result.items[0]?.contractReference).toBe("CT-2026-001");
    });
  });

  /** Le scénario de sortie du lot. */
  describe("statuts", () => {
    it("met en retard un appareil sans visite depuis 7 semaines", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      // Contrat pris il y a 49 jours : l'échéance des 6 semaines est tombée il
      // y a 7 jours.
      await coverWith([unitId], 49, "CT-RETARD");

      const result = await body();

      expect(result.items[0]?.visit?.status).toBe("overdue");
      expect(result.items[0]?.visit?.dueOn).toBe(daysFromToday(-7));
      expect(result.items[0]?.status).toBe("overdue");
      expect(result.summary.overdue).toBe(1);
    });

    it("annonce bientôt due une échéance dans la fenêtre d'alerte", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      // Contrat pris il y a 40 jours : échéance dans 2 jours, fenêtre de 7.
      await coverWith([unitId], 40, "CT-BIENTOT");

      const result = await body();

      expect(result.items[0]?.visit?.status).toBe("due_soon");
      expect(result.items[0]?.status).toBe("due_soon");
      expect(result.summary.dueSoon).toBe(1);
    });

    it("annonce à jour une échéance lointaine", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      await coverWith([unitId], 1, "CT-A-JOUR");

      const result = await body();

      expect(result.items[0]?.status).toBe("ok");
      expect(result.summary.ok).toBe(1);
    });

    it("retient le pire statut de l'appareil", async () => {
      // Quinquennal largement dépassé, visite toute fraîche : la ligne doit
      // rester rouge.
      const created = await api.inject({
        method: "POST",
        url: "/api/units",
        headers: bearer(token),
        payload: { siteId, reference: "Ascenseur A", commissionedOn: "2000-01-01" },
      });
      const unitId = created.json<{ id: string }>().id;
      await coverWith([unitId], 1, "CT-MIXTE");

      const result = await body();

      expect(result.items[0]?.visit?.status).toBe("ok");
      expect(result.items[0]?.inspection?.status).toBe("overdue");
      expect(result.items[0]?.status).toBe("overdue");
    });

    it("garde l'échéance quinquennale d'un appareil sans contrat", async () => {
      // L'obligation de contrôle pèse sur le propriétaire, pas sur
      // l'ascensoriste (spec 001, R2.1).
      await api.inject({
        method: "POST",
        url: "/api/units",
        headers: bearer(token),
        payload: { siteId, reference: "Ascenseur A", commissionedOn: "2000-01-01" },
      });

      const result = await body();

      expect(result.items[0]?.contractReference).toBeNull();
      expect(result.items[0]?.visit).toBeNull();
      expect(result.items[0]?.inspection?.status).toBe("overdue");
      expect(result.items[0]?.status).toBe("overdue");
    });

    it("ne retient pas un contrat expiré", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      await api.inject({
        method: "POST",
        url: "/api/contracts",
        headers: bearer(token),
        payload: {
          reference: "CT-EXPIRE",
          type: "minimal",
          unitIds: [unitId],
          startsOn: "2020-01-01",
          endsOn: "2021-01-01",
        },
      });

      const result = await body();

      expect(result.items[0]?.contractReference).toBeNull();
      expect(result.items[0]?.status).toBe("unknown");
    });
  });

  describe("compteurs", () => {
    it("partitionne le parc : chaque appareil compté une fois", async () => {
      const enRetard = await createUnit(api, token, siteId, "Retard");
      const aJour = await createUnit(api, token, siteId, "À jour");
      await createUnit(api, token, siteId, "Inconnu");
      await coverWith([enRetard], 49, "CT-1");
      await coverWith([aJour], 1, "CT-2");

      const { summary } = await body();

      expect(summary.overdue + summary.dueSoon + summary.ok + summary.unknown).toBe(summary.total);
      expect(summary.total).toBe(3);
    });

    it("compte les appareils sans contrat sur un axe séparé", async () => {
      // Sans contrat ET en retard sur son quinquennal : compté dans les deux.
      await api.inject({
        method: "POST",
        url: "/api/units",
        headers: bearer(token),
        payload: { siteId, reference: "Ascenseur A", commissionedOn: "2000-01-01" },
      });

      const { summary } = await body();

      expect(summary.withoutContract).toBe(1);
      expect(summary.overdue).toBe(1);
    });

    it("ne change pas les compteurs quand la vue est filtrée", async () => {
      const enRetard = await createUnit(api, token, siteId, "Retard");
      await createUnit(api, token, siteId, "Inconnu");
      await coverWith([enRetard], 49, "CT-1");

      const filtre = await body("?status=overdue");

      expect(filtre.items).toHaveLength(1);
      // Les compteurs décrivent le parc entier, pas la vue.
      expect(filtre.summary.total).toBe(2);
      expect(filtre.summary.unknown).toBe(1);
    });
  });

  describe("filtre", () => {
    it("filtre par statut", async () => {
      const enRetard = await createUnit(api, token, siteId, "Retard");
      await createUnit(api, token, siteId, "Inconnu");
      await coverWith([enRetard], 49, "CT-1");

      expect((await body("?status=overdue")).items.map((i) => i.unitReference)).toStrictEqual([
        "Retard",
      ]);
      expect((await body("?status=unknown")).items.map((i) => i.unitReference)).toStrictEqual([
        "Inconnu",
      ]);
    });

    it("filtre les appareils sans contrat, tous statuts confondus", async () => {
      const couvert = await createUnit(api, token, siteId, "Couvert");
      await createUnit(api, token, siteId, "Sans contrat");
      await coverWith([couvert], 49, "CT-1");

      const result = await body("?status=without_contract");

      expect(result.items.map((i) => i.unitReference)).toStrictEqual(["Sans contrat"]);
    });

    it("refuse un statut hors énumération", async () => {
      expect((await overview("?status=peut-etre")).statusCode).toBe(400);
    });
  });

  describe("lecture seule et isolation", () => {
    it("ne modifie rien : deux appels rendent le même résultat", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      await coverWith([unitId], 49, "CT-1");

      const first = await body();
      const second = await body();

      expect(second).toStrictEqual(first);
    });

    it("ne montre que le parc du tenant du jeton", async () => {
      const unitId = await createUnit(api, token, siteId, "Ascenseur A");
      await coverWith([unitId], 49, "CT-1");

      const intruder = await api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });
      const response = await api.inject({
        method: "GET",
        url: "/api/compliance",
        headers: bearer(intruder),
      });

      expect(response.json<{ items: unknown[]; summary: { total: number } }>().items).toStrictEqual(
        [],
      );
      expect(response.json<{ summary: { total: number } }>().summary.total).toBe(0);
    });
  });
});
