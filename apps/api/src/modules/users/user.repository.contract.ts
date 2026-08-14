import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PersistedUser, UserRepository } from "./user.repository.js";

/**
 * Suite de tests de contrat du port `UserRepository` (ADR-001) — même principe
 * que celle de `UnitRepository` : une seule suite, chaque implémentation.
 */

export interface UserRepositoryHarness {
  readonly repository: UserRepository;
  readonly cleanup?: () => Promise<void>;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeUser(overrides: Partial<PersistedUser> = {}): PersistedUser {
  return {
    id: "user-1",
    tenantId: TENANT_A,
    email: "dispatcher@ascenseur.test",
    name: "Claire Dupont",
    role: "dispatcher",
    active: true,
    passwordHash: "scrypt$32768$8$1$sel$empreinte",
    ...overrides,
  };
}

export function describeUserRepositoryContract(
  implementation: string,
  createHarness: () => Promise<UserRepositoryHarness>,
): void {
  describe(`contrat UserRepository — ${implementation}`, () => {
    let harness: UserRepositoryHarness;
    let repository: UserRepository;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    it("rend null quand l'utilisateur n'existe pas", async () => {
      expect(await repository.findByEmail(TENANT_A, "personne@ascenseur.test")).toBeNull();
      expect(await repository.findById(TENANT_A, "inconnu")).toBeNull();
    });

    it("retrouve un utilisateur par email et par identifiant", async () => {
      const user = makeUser();
      await repository.save(user);

      expect(await repository.findByEmail(TENANT_A, user.email)).toStrictEqual(user);
      expect(await repository.findById(TENANT_A, user.id)).toStrictEqual(user);
    });

    it("cherche par email sans tenir compte de la casse ni des espaces", async () => {
      await repository.save(makeUser({ email: "Dispatcher@Ascenseur.test" }));

      expect(
        await repository.findByEmail(TENANT_A, "  dispatcher@ascenseur.TEST  "),
      ).not.toBeNull();
    });

    it("remplace l'utilisateur existant au lieu d'en créer un deuxième", async () => {
      await repository.save(makeUser({ role: "dispatcher" }));
      await repository.save(makeUser({ role: "admin" }));

      expect((await repository.findById(TENANT_A, "user-1"))?.role).toBe("admin");
    });

    it("isole les tenants", async () => {
      await repository.save(makeUser({ id: "user-1", tenantId: TENANT_A }));

      expect(await repository.findByEmail(TENANT_B, "dispatcher@ascenseur.test")).toBeNull();
      expect(await repository.findById(TENANT_B, "user-1")).toBeNull();
    });

    it("conserve le nom et l'état d'activité", async () => {
      await repository.save(makeUser({ name: "Marc Vidal", role: "technician", active: false }));

      const user = await repository.findById(TENANT_A, "user-1");
      expect(user?.name).toBe("Marc Vidal");
      expect(user?.active).toBe(false);
    });

    it("rend tous les utilisateurs du tenant, désactivés compris", async () => {
      // Un désactivé porte encore des OT passés : le planning doit pouvoir
      // l'afficher (spec 008, R5.3).
      await repository.save(makeUser({ id: "user-1", name: "Claire" }));
      await repository.save(
        makeUser({ id: "user-2", email: "marc@a.test", name: "Marc", active: false }),
      );

      const all = await repository.findAll(TENANT_A);

      expect(all.map((user) => user.name).sort()).toStrictEqual(["Claire", "Marc"]);
    });

    it("rend une liste vide quand le tenant n'a aucun utilisateur", async () => {
      expect(await repository.findAll(TENANT_B)).toStrictEqual([]);
    });

    it("n'inclut jamais les utilisateurs d'un autre tenant dans la liste", async () => {
      await repository.save(makeUser({ id: "user-a", tenantId: TENANT_A }));
      await repository.save(makeUser({ id: "user-b", tenantId: TENANT_B }));

      expect((await repository.findAll(TENANT_A)).map((user) => user.id)).toStrictEqual(["user-a"]);
      expect((await repository.findAll(TENANT_B)).map((user) => user.id)).toStrictEqual(["user-b"]);
    });

    it("ne duplique pas un utilisateur remplacé dans la liste", async () => {
      await repository.save(makeUser({ name: "Claire" }));
      await repository.save(makeUser({ name: "Claire Dupont" }));

      const all = await repository.findAll(TENANT_A);
      expect(all).toHaveLength(1);
      expect(all[0]?.name).toBe("Claire Dupont");
    });

    it("laisse le même email exister dans deux tenants", async () => {
      await repository.save(makeUser({ id: "user-a", tenantId: TENANT_A }));
      await repository.save(makeUser({ id: "user-b", tenantId: TENANT_B }));

      expect((await repository.findByEmail(TENANT_A, "dispatcher@ascenseur.test"))?.id).toBe(
        "user-a",
      );
      expect((await repository.findByEmail(TENANT_B, "dispatcher@ascenseur.test"))?.id).toBe(
        "user-b",
      );
    });
  });
}
