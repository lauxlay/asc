# Ascenseur SaaS — contexte projet

## Emplacements

- **Code** : ce repo (`asc/`) — monorepo pnpm + Turborepo, tout le code vit ici.
- **Nomenclature projet** : `docs/01-business/`, `docs/02-produit/`, `docs/03-application/` — copiée dans le repo au lot L0.1 pour qu'il soit autoporteur ; c'est désormais la référence de travail (cf. `docs/README.md`).
- **Agents** : `.claude/agents/` (périmètres dans `docs/03-application/08-organisation-multi-agents.md`).

SaaS de gestion/maintenance/intervention d'ascenseurs pour PME ascensoristes, syndics/copros et particuliers. Concurrents à battre : Progilift (métier, mais fermé/daté) et Praxedo (planning, mais pas métier ni offline).

## Source de vérité

- Vision/marché : `docs/01-business/` · Features/priorités : `docs/02-produit/06-backlog-priorise-planning.md` · Réglementaire : `docs/02-produit/05-conformite-reglementaire.md`
- Architecture : `docs/03-application/` · Décisions figées : `docs/03-application/decisions/` (ADR)
- Specs de features : `docs/specs/` — **pas de code sans spec**.

## Décisions non négociables (ADR)

1. Stockage Phase 0 **sans BDD** : fichiers JSON derrière des interfaces repository. UUID applicatifs, `tenant_id` partout, jamais d'accès fichier hors repository (ADR-001).
2. Déploiement Docker + VPS Dokploy/Coolify, volume `data/` persistant (ADR-002).
3. Mobile **offline-first** : aucune feature ne doit exiger le réseau côté technicien.
4. Carnet d'entretien append-only (valeur probante) : INSERT only.

## Conventions

- TypeScript strict partout, Node 22 LTS, monorepo pnpm + Turborepo (structure : `docs/03-application/07-phase0-fondations.md`).
- Code en anglais, glossaire FR→EN figé dans `docs/03-application/03-modele-donnees.md` (`appareil`=`unit`, `visite`=`maintenance_visit`, `carnet`=`logbook`…).
- Zod à toutes les frontières ; logique métier pure dans `packages/domain` (zéro dépendance framework).
- Dépendances : `apps/* → contracts → domain` ; jamais d'import entre apps.
- Commits conventionnels ; `pnpm check` = lint + typecheck + test + build = exactement ce que fait la CI (`pnpm fix` pour auto-corriger le lint/format).
- **Un lot = une branche `feat/lN-M-nom` = une PR** ; merge uniquement CI verte + review ; jamais de commit direct sur `main`.
- Cycle de dev par lot (`docs/03-application/09-decoupage-execution-opus.md`) : feature → intégration UI → **e2e navigateur Playwright du parcours** → suite de régression complète verte → review. Non négociable. Design : shadcn/ui par défaut, zéro custom tant qu'un défaut suffit.
- Multi-agents : périmètres et workflow dans `docs/03-application/08-organisation-multi-agents.md`. Ne pas sortir de son périmètre.
