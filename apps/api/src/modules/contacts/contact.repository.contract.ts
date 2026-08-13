import type { Contact } from "@asc/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContactRepository } from "./contact.repository.js";

/**
 * Suite de tests de **contrat** du port `ContactRepository` (ADR-001).
 *
 * Une seule suite, exécutée contre chaque implémentation : JSON aujourd'hui,
 * SQLite demain. C'est elle qui garantit qu'une migration de stockage ne change
 * aucun comportement observable — la promesse centrale de l'ADR-001.
 */

export interface ContactRepositoryHarness {
  readonly repository: ContactRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "contact-1",
    tenantId: TENANT_A,
    customerId: "customer-1",
    siteId: null,
    name: "Martine Ferrand",
    role: "Gestionnaire",
    email: "martine@example.test",
    phone: null,
    ...overrides,
  };
}

export function describeContactRepositoryContract(
  implementation: string,
  createHarness: () => Promise<ContactRepositoryHarness>,
): void {
  describe(`contrat ContactRepository — ${implementation}`, () => {
    let harness: ContactRepositoryHarness;
    let repository: ContactRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    describe("findById", () => {
      it("rend null quand le contact n'existe pas", async () => {
        expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
      });

      it("rend le contact enregistré", async () => {
        const contact = makeContact();
        await repository.save(contact);

        expect(await repository.findById(TENANT_A, contact.id)).toStrictEqual(contact);
      });

      it("conserve les champs nuls et le rattachement à un immeuble", async () => {
        const gardien = makeContact({
          id: "contact-2",
          siteId: "site-1",
          role: "Gardien",
          email: null,
          phone: "0600000000",
        });
        await repository.save(gardien);

        expect(await repository.findById(TENANT_A, "contact-2")).toStrictEqual(gardien);
      });
    });

    describe("save", () => {
      it("remplace le contact existant au lieu d'en créer un deuxième", async () => {
        await repository.save(makeContact({ role: "Gestionnaire" }));
        await repository.save(makeContact({ role: "Gardien" }));

        const contacts = await repository.findAll(TENANT_A);

        expect(contacts).toHaveLength(1);
        expect(contacts[0]?.role).toBe("Gardien");
      });

      it("garde les autres contacts intacts", async () => {
        await repository.save(makeContact({ id: "contact-1" }));
        await repository.save(makeContact({ id: "contact-2" }));
        await repository.save(makeContact({ id: "contact-1", role: "Gardien" }));

        expect(await repository.findById(TENANT_A, "contact-2")).toStrictEqual(
          makeContact({ id: "contact-2" }),
        );
      });
    });

    describe("findAll", () => {
      it("rend une liste vide pour un tenant sans données", async () => {
        expect(await repository.findAll("tenant-vide")).toStrictEqual([]);
      });

      it("préserve l'ordre d'insertion", async () => {
        await repository.save(makeContact({ id: "contact-3" }));
        await repository.save(makeContact({ id: "contact-1" }));
        await repository.save(makeContact({ id: "contact-2" }));

        const ids = (await repository.findAll(TENANT_A)).map((contact) => contact.id);

        expect(ids).toStrictEqual(["contact-3", "contact-1", "contact-2"]);
      });

      it("rend un instantané détaché du magasin", async () => {
        await repository.save(makeContact({ id: "contact-1" }));
        const snapshot = await repository.findAll(TENANT_A);
        await repository.save(makeContact({ id: "contact-2" }));

        expect(snapshot).toHaveLength(1);
      });
    });

    describe("deleteById", () => {
      it("supprime et rend true", async () => {
        await repository.save(makeContact());

        expect(await repository.deleteById(TENANT_A, "contact-1")).toBe(true);
        expect(await repository.findById(TENANT_A, "contact-1")).toBeNull();
      });

      it("rend false quand le contact n'existe pas", async () => {
        expect(await repository.deleteById(TENANT_A, "inconnu")).toBe(false);
      });

      it("ne touche pas aux autres contacts", async () => {
        await repository.save(makeContact({ id: "contact-1" }));
        await repository.save(makeContact({ id: "contact-2" }));
        await repository.deleteById(TENANT_A, "contact-1");

        expect(await repository.findAll(TENANT_A)).toHaveLength(1);
      });
    });

    describe("isolation entre tenants", () => {
      it("ne rend pas par findById le contact d'un autre tenant", async () => {
        await repository.save(makeContact({ id: "contact-1", tenantId: TENANT_A }));

        expect(await repository.findById(TENANT_B, "contact-1")).toBeNull();
      });

      it("ne mélange pas les listes de deux tenants", async () => {
        await repository.save(makeContact({ id: "contact-1", tenantId: TENANT_A }));
        await repository.save(makeContact({ id: "contact-2", tenantId: TENANT_B }));

        expect((await repository.findAll(TENANT_A)).map((contact) => contact.id)).toStrictEqual([
          "contact-1",
        ]);
        expect((await repository.findAll(TENANT_B)).map((contact) => contact.id)).toStrictEqual([
          "contact-2",
        ]);
      });

      it("laisse coexister le même identifiant dans deux tenants", async () => {
        await repository.save(makeContact({ id: "contact-1", tenantId: TENANT_A, name: "Anne" }));
        await repository.save(makeContact({ id: "contact-1", tenantId: TENANT_B, name: "Bruno" }));

        expect((await repository.findById(TENANT_A, "contact-1"))?.name).toBe("Anne");
        expect((await repository.findById(TENANT_B, "contact-1"))?.name).toBe("Bruno");
      });

      it("ne supprime pas l'homonyme d'un autre tenant", async () => {
        await repository.save(makeContact({ id: "contact-1", tenantId: TENANT_A }));
        await repository.save(makeContact({ id: "contact-1", tenantId: TENANT_B }));

        expect(await repository.deleteById(TENANT_A, "contact-1")).toBe(true);
        expect(await repository.findById(TENANT_B, "contact-1")).not.toBeNull();
      });
    });
  });
}
