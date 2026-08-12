# apps/api — règles locales

API NestJS 11 (adaptateur Fastify). **Seule app autorisée à toucher au stockage.**

## Non négociable

- **Repository pattern obligatoire** (ADR-001) : jamais d'accès fichier hors d'un repository. Un service dépend du **port** (`UnitRepository`), jamais de l'adaptateur ; le branchement se fait dans `app.module.ts` via les jetons de `common/tokens.ts`.
- **Toute nouvelle collection persistée** apporte : un port, un adaptateur JSON, un adaptateur mémoire, et **une suite de tests de contrat** exécutée contre les deux (`*.repository.contract.ts`).
- **`tenantId` vient du jeton**, jamais du corps ou de l'URL. Chaque méthode de repository le prend en premier paramètre.
- **Zod aux frontières** : HTTP via `ZodValidationPipe` et les schémas de `@asc/contracts` ; fichiers via les schémas de persistance locaux ; environnement via `config/env.ts`.
- **Logique métier dans `@asc/domain`**, pas ici. Les services orchestrent, ils ne calculent pas de règles.

## Particularités techniques

- Décorateurs NestJS sans `emitDecoratorMetadata` : **chaque injection passe par `@Inject(...)` explicite**. C'est ce qui permet à Vitest de compiler les tests sans transformeur supplémentaire.
- Les schémas de persistance sont typés `satisfies z.ZodType<T>` : ils ne peuvent pas diverger de l'entité du domaine sans casser le typecheck.
- Tests d'intégration : `testing/create-test-app.ts` monte le vrai câblage avec les adaptateurs mémoire, et `app.inject()` évite d'ouvrir un port.

## Commandes

```bash
pnpm --filter @asc/api build && pnpm --filter @asc/api seed   # jeu de démo
pnpm --filter @asc/api start                                   # serveur
```

Variables d'environnement : voir `.env.example`.
