import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createTestApp,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

const HEADER = "Immeuble;Adresse;CP;Ville;Repère;Mise en service";

function csvOf(...rows: readonly string[]): string {
  return [HEADER, ...rows].join("\n");
}

/** Un parc de `count` appareils répartis dans `count / 2` immeubles. */
function parcCsv(count: number): string {
  const rows = Array.from({ length: count }, (_value, index) => {
    const building = Math.floor(index / 2) + 1;
    const reference = index % 2 === 0 ? "Ascenseur A" : "Ascenseur B";
    return `Résidence ${building};${building} rue des Lilas;69003;Lyon;${reference};2015-06-01`;
  });
  return csvOf(...rows);
}

describe("import de parc", () => {
  let api: TestApp;
  let token: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
  });

  afterEach(async () => {
    await api.close();
  });

  const analyze = (csv: string, mapping: unknown = null) =>
    api.inject({
      method: "POST",
      url: "/api/parc-import/analyze",
      headers: bearer(token),
      payload: { csv, mapping },
    });

  const commit = (csv: string, mapping: unknown) =>
    api.inject({
      method: "POST",
      url: "/api/parc-import",
      headers: bearer(token),
      payload: { csv, mapping },
    });

  const suggestedMappingOf = async (csv: string): Promise<unknown> =>
    (await analyze(csv)).json<{ suggestedMapping: unknown }>().suggestedMapping;

  /** Importe en enchaînant analyse et confirmation, comme le fait l'écran. */
  const importCsv = async (csv: string) => commit(csv, await suggestedMappingOf(csv));

  const listSites = () => api.inject({ method: "GET", url: "/api/sites", headers: bearer(token) });
  const listUnits = () => api.inject({ method: "GET", url: "/api/units", headers: bearer(token) });

  describe("POST /parc-import/analyze", () => {
    it("rend les colonnes, la correspondance devinée et les décomptes", async () => {
      const response = await analyze(
        csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;2015-06-01"),
      );

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        separator: string;
        headers: string[];
        suggestedMapping: Record<string, number | null>;
        rowCount: number;
        createdSiteCount: number;
        unitCount: number;
        issues: unknown[];
      }>();
      expect(body.separator).toBe(";");
      expect(body.headers).toStrictEqual([
        "Immeuble",
        "Adresse",
        "CP",
        "Ville",
        "Repère",
        "Mise en service",
      ]);
      expect(body.suggestedMapping.siteName).toBe(0);
      expect(body.suggestedMapping.reference).toBe(4);
      expect(body.rowCount).toBe(1);
      expect(body.createdSiteCount).toBe(1);
      expect(body.unitCount).toBe(1);
      expect(body.issues).toStrictEqual([]);
    });

    it("rend un aperçu des premières lignes", async () => {
      const response = await analyze(parcCsv(20));

      const preview = response.json<{ preview: { reference: string; siteIsNew: boolean }[] }>()
        .preview;
      expect(preview).toHaveLength(5);
      expect(preview[0]?.reference).toBe("Ascenseur A");
      expect(preview[0]?.siteIsNew).toBe(true);
    });

    it("n'écrit rien, même appelée deux fois", async () => {
      const csv = csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;");
      await analyze(csv);
      await analyze(csv);

      expect((await listSites()).json<{ items: unknown[] }>().items).toStrictEqual([]);
      expect((await listUnits()).json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("rend les erreurs sans échouer : analyser n'est pas importer", async () => {
      const response = await analyze(csvOf("Tilleuls;;69003;Lyon;Ascenseur A;"));

      expect(response.statusCode).toBe(200);
      expect(response.json<{ issues: unknown[] }>().issues).toHaveLength(1);
    });

    it("applique la correspondance fournie plutôt que la suggestion", async () => {
      // Colonnes anonymes : la suggestion ne trouve rien, l'utilisateur mappe.
      const csv = "A;B;C;D;E\nTilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A";
      const mapping = {
        siteName: 0,
        addressLine: 1,
        postalCode: 2,
        city: 3,
        reference: 4,
        commissionedOn: null,
        lastStatutoryInspectionOn: null,
      };

      const suggested = await analyze(csv);
      expect(suggested.json<{ issues: unknown[] }>().issues.length).toBeGreaterThan(0);

      const mapped = await analyze(csv, mapping);
      expect(mapped.json<{ issues: unknown[] }>().issues).toStrictEqual([]);
      expect(mapped.json<{ unitCount: number }>().unitCount).toBe(1);
    });

    it("refuse un fichier vide", async () => {
      expect((await analyze("")).statusCode).toBe(400);
    });

    it("refuse un fichier de lignes vides", async () => {
      expect((await analyze("\n\n")).statusCode).toBe(422);
    });
  });

  describe("POST /parc-import", () => {
    it("crée les immeubles et les appareils", async () => {
      const response = await importCsv(
        csvOf(
          "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;2015-06-01",
          "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur B;",
          "Clos;8 avenue de la Gare;69100;Villeurbanne;Ascenseur unique;",
        ),
      );

      expect(response.statusCode).toBe(201);
      expect(response.json()).toStrictEqual({
        createdSiteCount: 2,
        reusedSiteCount: 0,
        createdUnitCount: 3,
      });

      expect((await listSites()).json<{ items: unknown[] }>().items).toHaveLength(2);
      expect((await listUnits()).json<{ items: unknown[] }>().items).toHaveLength(3);
    });

    it("importe 50 appareils d'un coup", async () => {
      const response = await importCsv(parcCsv(50));

      expect(response.json<{ createdUnitCount: number }>().createdUnitCount).toBe(50);
      expect((await listUnits()).json<{ items: unknown[] }>().items).toHaveLength(50);
      expect((await listSites()).json<{ items: unknown[] }>().items).toHaveLength(25);
    });

    it("laisse les immeubles importés sans client", async () => {
      await importCsv(csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;"));

      const sites = (await listSites()).json<{ items: { customerId: unknown }[] }>().items;
      expect(sites[0]?.customerId).toBeNull();
    });

    it("conserve les dates lues au format français", async () => {
      await importCsv(csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;01/06/2015"));

      const units = (await listUnits()).json<{ items: { commissionedOn: unknown }[] }>().items;
      expect(units[0]?.commissionedOn).toBe("2015-06-01");
    });

    it("refuse tout le fichier dès qu'une ligne est invalide, sans rien écrire", async () => {
      const response = await importCsv(
        csvOf(
          "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
          "Clos;;44000;Nantes;Ascenseur B;",
        ),
      );

      expect(response.statusCode).toBe(422);
      expect((await listSites()).json<{ items: unknown[] }>().items).toStrictEqual([]);
      expect((await listUnits()).json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("rend les erreurs avec leur numéro de ligne", async () => {
      const response = await importCsv(
        csvOf(
          "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
          "Clos;;44000;Nantes;Ascenseur B;",
        ),
      );

      // Corps d'erreur : `{ message, issues }` à plat, tel que Nest sérialise
      // l'objet passé à l'exception. L'écran d'import s'appuie dessus.
      const body = response.json<{ message: string; issues: { lineNumber: number }[] }>();
      expect(typeof body.message).toBe("string");
      expect(body.issues).toHaveLength(1);
      expect(body.issues[0]?.lineNumber).toBe(3);
    });

    it("réutilise un immeuble déjà au parc au lieu de le dupliquer", async () => {
      await importCsv(csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;"));

      const response = await importCsv(
        csvOf("Peu importe;12 rue des Lilas;69003;Lyon;Ascenseur B;"),
      );

      expect(response.json()).toStrictEqual({
        createdSiteCount: 0,
        reusedSiteCount: 1,
        createdUnitCount: 1,
      });
      expect((await listSites()).json<{ items: unknown[] }>().items).toHaveLength(1);
      expect((await listUnits()).json<{ items: unknown[] }>().items).toHaveLength(2);
    });

    it("rend un double import inoffensif", async () => {
      const csv = csvOf(
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur B;",
      );
      expect((await importCsv(csv)).statusCode).toBe(201);

      const replay = await importCsv(csv);

      expect(replay.statusCode).toBe(422);
      expect((await listUnits()).json<{ items: unknown[] }>().items).toHaveLength(2);
    });

    it("refuse une correspondance incomplète", async () => {
      const response = await commit(csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;"), {
        siteName: 0,
        addressLine: 1,
        postalCode: null,
        city: 3,
        reference: 4,
        commissionedOn: null,
        lastStatutoryInspectionOn: null,
      });

      expect(response.statusCode).toBe(422);
    });

    it("refuse une correspondance absente du corps", async () => {
      const response = await api.inject({
        method: "POST",
        url: "/api/parc-import",
        headers: bearer(token),
        payload: { csv: csvOf("T;12 rue des Lilas;69003;Lyon;A;") },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("isolation entre tenants", () => {
    /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
    const otherTenantToken = (): Promise<string> =>
      api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

    it("n'importe que dans le tenant du jeton", async () => {
      await importCsv(csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;"));

      const response = await api.inject({
        method: "GET",
        url: "/api/sites",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("ne voit pas comme doublon l'appareil d'un autre tenant", async () => {
      const csv = csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;");
      await importCsv(csv);

      const intruder = await otherTenantToken();
      const response = await api.inject({
        method: "POST",
        url: "/api/parc-import",
        headers: bearer(intruder),
        payload: { csv, mapping: await suggestedMappingOf(csv) },
      });

      // Le même fichier passe dans un tenant vierge : les doublons se comptent
      // par tenant, jamais globalement.
      expect(response.statusCode).toBe(201);
    });

    it("ne réutilise pas l'immeuble d'un autre tenant", async () => {
      const csv = csvOf("Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;");
      await importCsv(csv);

      const intruder = await otherTenantToken();
      const response = await api.inject({
        method: "POST",
        url: "/api/parc-import",
        headers: bearer(intruder),
        payload: { csv, mapping: await suggestedMappingOf(csv) },
      });

      expect(response.json<{ createdSiteCount: number }>().createdSiteCount).toBe(1);
    });
  });

  describe("bornes du fichier", () => {
    it("refuse un fichier trop volumineux", async () => {
      const response = await analyze(`${HEADER}\n${"x".repeat(800_001)}`);

      expect(response.statusCode).toBe(400);
    });

    it("refuse un fichier de plus de 5 000 lignes", async () => {
      const response = await analyze(parcCsv(5_001));

      expect(response.statusCode).toBe(422);
    });
  });
});
