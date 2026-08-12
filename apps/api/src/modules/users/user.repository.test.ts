import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { InMemoryUserRepository } from "./in-memory-user.repository.js";
import { JsonUserRepository } from "./json-user.repository.js";
import { describeUserRepositoryContract } from "./user.repository.contract.js";

describeUserRepositoryContract("JsonUserRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-users-"));
  return {
    repository: new JsonUserRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeUserRepositoryContract("InMemoryUserRepository", async () => ({
  repository: new InMemoryUserRepository(),
}));
