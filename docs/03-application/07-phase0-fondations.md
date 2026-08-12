# Phase 0 — Fondations techniques

> Statut : draft | Objectif : structurer le code AVANT la première feature. Durée cible : 3–4 semaines.

## Critères de choix techno

Récent mais éprouvé, maintenance active, grosse communauté, embauche facile. Règle : **boring technology pour l'infrastructure, moderne pour l'outillage**. Aucune techno < 2 ans de production significative.

## Stack retenue (à figer en ADR-002)

| Brique | Choix | Pourquoi (communauté / maintenance) |
|---|---|---|
| Langage | **TypeScript 5.x strict** partout | Un seul langage back/front/mobile, pool de devs énorme |
| Runtime | **Node.js 22 LTS** | LTS = support long, écosystème n°1 |
| Monorepo | **pnpm workspaces + Turborepo** | Standard actuel, cache de build, Vercel-backed |
| API | **NestJS 11** (Fastify adapter) | Structure imposée (modules/DI) = dette évitée en solo, communauté massive. Alt. plus légère : Hono |
| Validation | **Zod 4** | Schémas = source unique de vérité types + validation runtime |
| Web back-office | **React 19 + Vite + TanStack Router/Query** | Écosystème dominant, TanStack très maintenu |
| Portail client | **Next.js 15** (App Router) | SSR/SEO, standard de facto |
| Mobile | **Expo SDK (React Native) + expo-sqlite** | Offline-first OK, OTA updates, réutilise React/TS |
| UI kit | **Tailwind 4 + shadcn/ui** | Productif, pas de lock-in (code possédé) |
| Tests | **Vitest** (unit/intégration) + **Playwright** (e2e web) | Rapides, standards 2026 |
| Lint/format | **Biome** | Un seul outil, très rapide, activement développé. Alt. : ESLint 9 + Prettier |
| CI/CD | **GitHub Actions** | Standard, gratuit au début |
| Stockage Phase 0 | Fichiers JSON via repositories (ADR-001) | Zéro ops, migrable SQLite→Postgres |
| PDF | Templates React → **Playwright print** ou react-pdf | Réutilise les compétences front |

## Structure du monorepo

```
ascenseur/
├── apps/
│   ├── api/          # NestJS — la seule à toucher au stockage
│   ├── web/          # back-office React
│   ├── portal/       # portail client Next.js
│   └── mobile/       # Expo
├── packages/
│   ├── domain/       # 💎 entités, types, règles métier PURES (zéro dépendance framework)
│   ├── contracts/    # schémas Zod des API (partagés client/serveur) + types générés
│   ├── ui/           # composants React partagés web/portal
│   └── config/       # tsconfig, biome, presets partagés
├── docs/             # ← la présente nomenclature (01-business, 02-produit…)
├── turbo.json / pnpm-workspace.yaml
└── .github/workflows/ci.yml
```

### Règles de dépendances (anti-dette n°1)

```
apps/*  →  packages/contracts  →  packages/domain
apps/*  →  packages/ui, packages/domain
packages/domain → RIEN (aucun import externe métier)
```

Interdit : import entre apps ; import de `api` interne depuis web/mobile (ils passent par `contracts`) ; logique métier dans les apps (elle vit dans `domain`).

## Architecture du code API (hexagonal léger)

```
apps/api/src/
└── modules/
    └── work-orders/
        ├── work-orders.controller.ts   # HTTP uniquement (parse/validate via contracts)
        ├── work-orders.service.ts      # orchestration, appelle domain
        ├── work-order.repository.ts    # INTERFACE (port)
        └── json-work-order.repository.ts # implémentation Phase 0 (adapter)
```

- Le service dépend de l'interface, jamais de l'implémentation (DI NestJS).
- **Tests de contrat de repository** : une suite de tests unique exécutée contre chaque implémentation (JSON aujourd'hui, SQLite demain) — c'est la garantie de migration de l'ADR-001.

## Conventions « code propre »

1. **TS strict total** : `strict: true`, `noUncheckedIndexedAccess`, pas de `any` (Biome le bloque).
2. **Zod aux frontières** : toute donnée entrante (HTTP, fichier, sync mobile) est parsée. À l'intérieur, les types sont sûrs.
3. **Fonctions métier pures dans `domain`** : le moteur d'échéances est une fonction `computeDeadlines(unit, contract, visits) → Deadline[]` testée exhaustivement, sans I/O.
4. **Nommage** : glossaire FR→EN figé (`03-modele-donnees.md`) — un concept = un mot, partout.
5. **Commits conventionnels** (`feat:`, `fix:`…) + branches courtes ; PR même en solo (auto-revue + CI verte obligatoire).
6. **ADR pour toute décision structurante** (`decisions/`), 15 lignes suffisent.
7. **Pas d'abstraction spéculative** : on n'ajoute une interface/généricité qu'au 2e cas d'usage réel (sauf repositories, imposés par ADR-001).
8. **Definition of Done** : typé strict + testé (métier : unit ; endpoint : intégration ; **parcours : e2e navigateur Playwright**) + suite de régression e2e complète verte + lint OK + doc mise à jour si le comportement change. Cycle détaillé par lot : `09-decoupage-execution-opus.md`.

## CI minimale (dès la semaine 1)

`pnpm turbo lint typecheck test build` sur chaque PR ; déploiement staging auto sur `main`. Une seule commande locale : `pnpm check` = exactement ce que fait la CI.

## Checklist de sortie de Phase 0

- [ ] Monorepo bootstrapp é, `pnpm dev` lance api + web
- [ ] `packages/domain` : entités + `computeDeadlines` testé (règle 6 semaines + quinquennal)
- [ ] `packages/contracts` : schémas Zod units/work-orders
- [ ] Repositories JSON + suite de tests de contrat
- [ ] Auth simple (email/mot de passe, JWT, tenant unique)
- [ ] CRUD appareil + création d'un OT via API, visibles dans le web
- [ ] CI verte, staging déployé
- [ ] ADR-002 (stack) rédigé et validé
