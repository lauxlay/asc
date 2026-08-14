import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WorkOrderDraft, WorkOrderRepository } from "./work-order.repository.js";

/**
 * Suite de tests de **contrat** du port `WorkOrderRepository` (ADR-001).
 *
 * Une seule suite, exécutée contre chaque implémentation : JSON aujourd'hui,
 * SQLite demain. Elle garantit qu'une migration de stockage ne change aucun
 * comportement observable — **numérotation comprise**, qui est la partie la
 * plus facile à casser en changeant de stockage.
 */

export interface WorkOrderRepositoryHarness {
  readonly repository: WorkOrderRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeDraft(overrides: Partial<WorkOrderDraft> = {}): WorkOrderDraft {
  return {
    id: "wo-1",
    tenantId: TENANT_A,
    type: "breakdown",
    status: "new",
    priority: "normal",
    unitId: "unit-1",
    summary: "Cabine bloquée au 3e",
    onSiteContact: null,
    followUpOf: null,
    reportCount: 1,
    reportedAt: "2026-03-10T09:00:00.000Z",
    lastReportedAt: "2026-03-10T09:00:00.000Z",
    entrapment: null,
    ...overrides,
  };
}

export function describeWorkOrderRepositoryContract(
  implementation: string,
  createHarness: () => Promise<WorkOrderRepositoryHarness>,
): void {
  describe(`contrat WorkOrderRepository — ${implementation}`, () => {
    let harness: WorkOrderRepositoryHarness;
    let repository: WorkOrderRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    /** Spec 007, R6 — la propriété la plus coûteuse à perdre. */
    describe("numérotation", () => {
      it("attribue le premier rang de l'année", async () => {
        const created = await repository.create(makeDraft());

        expect(created.reference).toBe("OT-2026-00001");
      });

      it("incrémente à chaque création", async () => {
        const first = await repository.create(makeDraft({ id: "wo-1" }));
        const second = await repository.create(makeDraft({ id: "wo-2" }));
        const third = await repository.create(makeDraft({ id: "wo-3" }));

        expect([first.reference, second.reference, third.reference]).toStrictEqual([
          "OT-2026-00001",
          "OT-2026-00002",
          "OT-2026-00003",
        ]);
      });

      it("ne réutilise jamais le numéro d'un OT supprimé", async () => {
        await repository.create(makeDraft({ id: "wo-1" }));
        const second = await repository.create(makeDraft({ id: "wo-2" }));
        await repository.deleteById(TENANT_A, second.id);

        const third = await repository.create(makeDraft({ id: "wo-3" }));

        // Le rang 2 est perdu avec l'OT supprimé : un trou est acceptable,
        // un doublon ne l'est pas.
        expect(third.reference).toBe("OT-2026-00003");
      });

      it("repart à 1 l'année suivante", async () => {
        await repository.create(makeDraft({ id: "wo-1" }));
        const nouvelle = await repository.create(
          makeDraft({ id: "wo-2", reportedAt: "2027-01-04T08:30:00.000Z" }),
        );

        expect(nouvelle.reference).toBe("OT-2027-00001");
      });

      it("tient deux séquences d'années en parallèle", async () => {
        await repository.create(makeDraft({ id: "wo-1", reportedAt: "2026-12-31T23:00:00.000Z" }));
        await repository.create(makeDraft({ id: "wo-2", reportedAt: "2027-01-01T01:00:00.000Z" }));
        const retardataire = await repository.create(
          makeDraft({ id: "wo-3", reportedAt: "2026-12-31T23:30:00.000Z" }),
        );

        expect(retardataire.reference).toBe("OT-2026-00002");
      });

      it("numérote chaque tenant indépendamment", async () => {
        await repository.create(makeDraft({ id: "wo-1", tenantId: TENANT_A }));
        await repository.create(makeDraft({ id: "wo-2", tenantId: TENANT_A }));
        const autre = await repository.create(makeDraft({ id: "wo-3", tenantId: TENANT_B }));

        expect(autre.reference).toBe("OT-2026-00001");
      });

      it("ne renumérote pas un OT réenregistré", async () => {
        const created = await repository.create(makeDraft());
        await repository.save({ ...created, status: "in_progress" });

        expect((await repository.findById(TENANT_A, created.id))?.reference).toBe(
          created.reference,
        );
      });

      it("ne produit aucun doublon sur des créations concurrentes", async () => {
        const drafts = Array.from({ length: 20 }, (_value, index) =>
          makeDraft({ id: `wo-${index}` }),
        );

        const created = await Promise.all(drafts.map((draft) => repository.create(draft)));
        const references = new Set(created.map((workOrder) => workOrder.reference));

        expect(references.size).toBe(drafts.length);
      });
    });

    describe("findById", () => {
      it("rend null quand l'OT n'existe pas", async () => {
        expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
      });

      it("rend l'OT créé, référence comprise", async () => {
        const created = await repository.create(makeDraft());

        expect(await repository.findById(TENANT_A, created.id)).toStrictEqual(created);
      });

      it("conserve les champs facultatifs et le script de désincarcération", async () => {
        const created = await repository.create(
          makeDraft({
            priority: "entrapment",
            onSiteContact: "Mme Diallo, gardienne — code portail 1234A",
            followUpOf: "wo-precedent",
            entrapment: { medicalEmergency: false, peopleCount: 2, betweenFloors: true },
          }),
        );

        const reread = await repository.findById(TENANT_A, created.id);

        expect(reread?.onSiteContact).toBe("Mme Diallo, gardienne — code portail 1234A");
        expect(reread?.followUpOf).toBe("wo-precedent");
        expect(reread?.entrapment).toStrictEqual({
          medicalEmergency: false,
          peopleCount: 2,
          betweenFloors: true,
        });
      });

      it("distingue une réponse non demandée d'une réponse négative", async () => {
        // `null` = pas encore demandé ; `false` = demandé, la réponse est non.
        const created = await repository.create(
          makeDraft({
            priority: "entrapment",
            entrapment: { medicalEmergency: null, peopleCount: null, betweenFloors: false },
          }),
        );

        const reread = await repository.findById(TENANT_A, created.id);

        expect(reread?.entrapment?.medicalEmergency).toBeNull();
        expect(reread?.entrapment?.betweenFloors).toBe(false);
      });
    });

    /** Spec 007, R9.1 — l'inverse des autres ports, et c'est voulu. */
    describe("findAll", () => {
      it("rend une liste vide pour un tenant sans données", async () => {
        expect(await repository.findAll("tenant-vide")).toStrictEqual([]);
      });

      it("rend du plus récent au plus ancien", async () => {
        await repository.create(makeDraft({ id: "wo-1" }));
        await repository.create(makeDraft({ id: "wo-2" }));
        await repository.create(makeDraft({ id: "wo-3" }));

        expect((await repository.findAll(TENANT_A)).map((workOrder) => workOrder.id)).toStrictEqual(
          ["wo-3", "wo-2", "wo-1"],
        );
      });

      it("ne déplace pas un OT modifié dans l'ordre", async () => {
        const first = await repository.create(makeDraft({ id: "wo-1" }));
        await repository.create(makeDraft({ id: "wo-2" }));
        await repository.save({ ...first, status: "in_progress" });

        expect((await repository.findAll(TENANT_A)).map((workOrder) => workOrder.id)).toStrictEqual(
          ["wo-2", "wo-1"],
        );
      });

      it("rend un instantané détaché du magasin", async () => {
        await repository.create(makeDraft({ id: "wo-1" }));
        const snapshot = await repository.findAll(TENANT_A);
        await repository.create(makeDraft({ id: "wo-2" }));

        expect(snapshot).toHaveLength(1);
      });
    });

    describe("save", () => {
      it("remplace l'OT existant au lieu d'en créer un deuxième", async () => {
        const created = await repository.create(makeDraft());
        await repository.save({ ...created, status: "done", reportCount: 4 });

        const all = await repository.findAll(TENANT_A);

        expect(all).toHaveLength(1);
        expect(all[0]?.status).toBe("done");
        expect(all[0]?.reportCount).toBe(4);
      });

      it("garde les autres OT intacts", async () => {
        const first = await repository.create(makeDraft({ id: "wo-1" }));
        const second = await repository.create(makeDraft({ id: "wo-2" }));
        await repository.save({ ...first, status: "cancelled" });

        expect((await repository.findById(TENANT_A, second.id))?.status).toBe("new");
      });
    });

    describe("deleteById", () => {
      it("supprime et rend true", async () => {
        const created = await repository.create(makeDraft());

        expect(await repository.deleteById(TENANT_A, created.id)).toBe(true);
        expect(await repository.findById(TENANT_A, created.id)).toBeNull();
      });

      it("rend false quand l'OT n'existe pas", async () => {
        expect(await repository.deleteById(TENANT_A, "inconnu")).toBe(false);
      });

      it("ne touche pas aux autres OT", async () => {
        await repository.create(makeDraft({ id: "wo-1" }));
        await repository.create(makeDraft({ id: "wo-2" }));
        await repository.deleteById(TENANT_A, "wo-1");

        expect(await repository.findAll(TENANT_A)).toHaveLength(1);
      });
    });

    describe("isolation entre tenants", () => {
      it("ne rend pas par findById l'OT d'un autre tenant", async () => {
        const created = await repository.create(makeDraft({ tenantId: TENANT_A }));

        expect(await repository.findById(TENANT_B, created.id)).toBeNull();
      });

      it("ne mélange pas les listes de deux tenants", async () => {
        await repository.create(makeDraft({ id: "wo-1", tenantId: TENANT_A }));
        await repository.create(makeDraft({ id: "wo-2", tenantId: TENANT_B }));

        expect((await repository.findAll(TENANT_A)).map((w) => w.id)).toStrictEqual(["wo-1"]);
        expect((await repository.findAll(TENANT_B)).map((w) => w.id)).toStrictEqual(["wo-2"]);
      });

      it("laisse coexister le même identifiant dans deux tenants", async () => {
        await repository.create(makeDraft({ id: "wo-1", tenantId: TENANT_A, summary: "Chez A" }));
        await repository.create(makeDraft({ id: "wo-1", tenantId: TENANT_B, summary: "Chez B" }));

        expect((await repository.findById(TENANT_A, "wo-1"))?.summary).toBe("Chez A");
        expect((await repository.findById(TENANT_B, "wo-1"))?.summary).toBe("Chez B");
      });

      it("ne supprime pas l'homonyme d'un autre tenant", async () => {
        await repository.create(makeDraft({ id: "wo-1", tenantId: TENANT_A }));
        await repository.create(makeDraft({ id: "wo-1", tenantId: TENANT_B }));

        expect(await repository.deleteById(TENANT_A, "wo-1")).toBe(true);
        expect(await repository.findById(TENANT_B, "wo-1")).not.toBeNull();
      });
    });
  });
}
