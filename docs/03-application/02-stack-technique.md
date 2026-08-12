# Stack technique

> Statut : draft — propositions à trancher (ADR).
> Version détaillée et figée pour le démarrage : voir `07-phase0-fondations.md` (structure monorepo, conventions, checklist Phase 0).

## Proposition de référence

| Couche | Choix proposé | Alternatives | Critère |
|---|---|---|---|
| Backend | TypeScript + NestJS (ou AdonisJS) | Rails, Django, Go | Un seul langage front/back, écosystème |
| Stockage Phase 0 | **Fichiers JSON + repositories** (ADR-001) | SQLite direct | Zéro ops, migrable |
| Stockage Phase 1/2 | SQLite puis PostgreSQL 16 + RLS | — | Multi-tenant, JSONB pour checklists |
| ORM | (Phase 1+) Prisma ou Drizzle | TypeORM | Migrations propres |
| Jobs Phase 0 | Cron in-process (node-cron) | — | Échéances, PDF, emails |
| Jobs Phase 2 | BullMQ (Redis) ou pg-boss | — | Quand multi-process |
| Web back-office | React + Vite, **PWA installable** (vite-plugin-pwa, ADR-003) | Next.js | Effet client lourd, lecture offline |
| Portail client | Next.js (SSR, SEO léger) | même SPA | Partage de composants |
| Mobile | **React Native + Expo** + SQLite (expo-sqlite / WatermelonDB) | Flutter | Offline-first, partage TS |
| Stockage fichiers | S3-compatible (Scaleway) | — | Photos, PDF, plans |
| PDF | Templates HTML → Gotenberg/Playwright | pdfkit | Rapports, carnets, factures |
| Auth | Auth maison JWT ou Keycloak/Auth.js | Clerk (US ⚠ RGPD) | Multi-tenant, rôles |
| Emails/notifs | Resend/Brevo + push Expo | — | Brevo = FR |
| Infra | Docker + Scaleway/OVH, IaC Terraform | Fly.io | Hébergement UE |
| Observabilité | Sentry + OpenTelemetry + Grafana | — | — |
| CI/CD | GitHub Actions | — | — |

## Contraintes non négociables

1. **Offline mobile d'abord** : tout choix mobile doit être validé contre le scénario « 3 h en sous-sol sans réseau ».
2. **Hébergement UE** des données.
3. **Monorepo** (pnpm workspaces / Turborepo) : `apps/api`, `apps/web`, `apps/portal`, `apps/mobile`, `packages/domain` (types partagés).

## Nomenclature de code

- Langue du code : anglais ; langue du domaine métier : glossaire FR→EN figé (voir 03-modele-donnees.md) pour éviter le franglais incohérent (`appareil` = `unit`, `visite` = `maintenance_visit`…).
- Branches : `feat/…`, `fix/…`, `chore/…` ; commits conventionnels.
