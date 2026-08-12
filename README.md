# asc — SaaS de gestion d'ascenseurs

Monorepo du SaaS de gestion / maintenance / intervention d'ascenseurs pour PME ascensoristes, syndics-copros et particuliers.

Contexte produit, architecture et décisions : [`docs/`](docs/README.md). Conventions de travail : [`CLAUDE.md`](CLAUDE.md).

## Prérequis

- **Node 22 LTS** (`.nvmrc` — `nvm use`)
- **pnpm 11** via Corepack (`corepack enable`)

## Démarrer

```bash
nvm use
corepack enable
pnpm install
pnpm check
```

## Commandes

| Commande | Effet |
|---|---|
| `pnpm check` | lint + typecheck + test + build — **identique à la CI** |
| `pnpm fix` | corrige lint et formatage (Biome) |
| `pnpm typecheck` / `pnpm test` / `pnpm build` | une étape à la fois |
| `pnpm dev` | serveurs de dev (au fur et à mesure des lots) |

## Structure

```
apps/
  api/        # NestJS — seule app à toucher au stockage (ADR-001)
  web/        # back-office React + Vite, PWA installable (ADR-003)
  portal/     # portail client Next.js
  mobile/     # app technicien Expo, offline-first
packages/
  domain/     # entités et règles métier PURES (zéro dépendance framework)
  contracts/  # schémas Zod des API, partagés client/serveur
  ui/         # composants React partagés web/portal
  config/     # presets tsconfig et Biome partagés
docs/         # nomenclature projet (business, produit, application, ADR, specs)
```

Règle de dépendances : `apps/* → contracts → domain`, `apps/* → ui`. Jamais d'import entre apps, jamais de logique métier hors de `domain`.

## Contribuer

Un lot (`docs/03-application/09-decoupage-execution-opus.md`) = une branche `feat/lN-M-nom` = une PR. Commits conventionnels, merge uniquement CI verte + review, jamais de commit direct sur `main`.
