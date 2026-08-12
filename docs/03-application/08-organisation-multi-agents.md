# Organisation multi-agents

> Statut : draft | Prérequis : structure monorepo de `07-phase0-fondations.md`.

## Principe

Le monorepo est déjà découpé en frontières nettes (apps/packages, règles de dépendances) : on aligne les agents sur ces frontières. **Un agent = un périmètre de fichiers = jamais de chevauchement.** Le point de synchronisation entre agents n'est pas la conversation, c'est le code : `packages/contracts` (schémas Zod) et les specs dans `docs/specs/`.

## Les agents et leurs périmètres

| Agent | Périmètre (owner) | Ne touche JAMAIS |
|---|---|---|
| **produit** | `docs/` (specs, backlog, critères d'acceptation) | le code |
| **back** | `apps/api`, `packages/domain`, `packages/contracts` | les apps front |
| **front** | `apps/web`, `apps/portal` | api, domain, contracts |
| **mobile** | `apps/mobile` | api, domain, contracts |
| **ui** | `packages/ui` (design system, composants partagés) | les apps, la logique |
| **infra** | `Dockerfile*`, `.github/`, `turbo.json`, config CI/CD, Dokploy | le code métier |
| **review** | lecture seule partout | n'écrit rien, produit des rapports |

Règle d'or : **`packages/contracts` n'est modifié que par l'agent back**, sur la base d'une spec produit. Front et mobile consomment, ne modifient pas. Si un contrat manque → ticket vers back, pas de contournement.

## Workflow d'une feature (ex. « triage des signalements »)

```
1. produit   → docs/specs/010-triage-signalements.md
              (persona, pain point réf., règles métier, critères d'acceptation)
2. back      → schémas dans contracts + endpoint + logique domain + tests
              (front/mobile peuvent mocker dès que les schémas sont mergés)
3. front ∥ mobile ∥ ui  → en PARALLÈLE contre les contrats (worktrees séparés)
4. review    → relit chaque PR : conformité spec, conventions 07, dette
5. intégration → CI verte, merge dans l'ordre : contracts → back → consommateurs
```

Étapes 3 : parallélisables sans conflit car aucun fichier partagé. C'est tout l'intérêt du découpage.

## Format d'une spec (`docs/specs/NNN-nom.md`)

- Contexte : persona + pain point (réf. `02-produit/01`), priorité backlog (réf. `02-produit/06`).
- Règles métier : exhaustives, avec cas limites (c'est LA section que back transforme en tests).
- Critères d'acceptation : liste vérifiable, chaque agent coche les siens.
- Hors scope : explicite, pour empêcher la dérive.

Une feature sans spec ne se code pas — même en solo avec agents, ça évite 80 % des allers-retours.

## Fichiers de contexte pour les agents

- **`CLAUDE.md` racine** : conventions globales, glossaire FR→EN, commandes (`pnpm check`…), renvois vers la nomenclature. Court : il est lu à chaque session.
- **`CLAUDE.md` par app/package** : spécificités locales (ex. `apps/mobile` : règles offline, outbox ; `apps/api` : repository pattern obligatoire).
- **`.claude/agents/*.md`** : définition de chaque agent (mission, périmètre, interdits, definition of done) — créés, voir dossier.

## Anti-conflits & discipline

1. Un agent = une branche ou un worktree isolé ; **chaque lot (`03-application/09`) = une PR dédiée** (`feat/l1-6-saisie-panne`), mergée uniquement CI verte + review. Jamais de commit direct sur `main`.
2. Deux agents ne travaillent jamais sur le même package en même temps.
3. Toute PR passe la CI + l'agent review avant merge. En cas de doute review ↔ agent, l'humain (toi) tranche.
4. Les agents ne modifient pas les ADR ni les conventions : proposer, jamais imposer — décision humaine.
5. Chaque agent termine par la mise à jour de la doc de son périmètre si le comportement change (DoD de `07`).

## Pièges connus du multi-agents (à éviter)

- **Sur-parallélisation** : en Phase 0–1, la plupart des features sont séquentielles (le contrat d'abord). Lancer 5 agents sur une feature dont le contrat n'existe pas = 4 agents qui inventent. Paralléliser seulement à partir de l'étape 3.
- **Specs floues** : un agent comble les trous en inventant — la qualité des specs produit est le facteur limitant, pas la vitesse de code.
- **Dérive des conventions** : l'agent review vérifie aussi la cohérence inter-agents (nommage du glossaire, patterns), pas seulement les bugs.
