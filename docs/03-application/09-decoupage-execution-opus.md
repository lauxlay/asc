# Découpage du MVP en lots d'exécution (Claude Opus)

> Statut : draft | Complète `02-produit/06-backlog-priorise-planning.md` (le « quand ») avec le « comment exécuter ».
> Un **lot** = une unité de travail exécutable par Opus en une session = **une branche `feat/lN-M-nom` = une PR** ≈ ≤ 1 journée. Jamais plus gros.
> La PR n'est mergée que si : CI verte (dont suite e2e complète) + review (agent review ou humain). Jamais de commit direct sur `main`.

## Le cycle obligatoire de CHAQUE lot

Aucun lot n'est terminé sans avoir traversé les 5 étapes, dans l'ordre :

```
1. FEATURE   contracts (Zod) → domain (logique pure + tests unit) → api (endpoint + tests intégration)
2. UI        intégration dans web/portal — composants shadcn/ui par défaut, zéro custom design
3. E2E       test navigateur Playwright du PARCOURS UTILISATEUR réel (pas de l'endpoint)
4. RÉGRESSION la suite e2e COMPLÈTE (tous les lots précédents) tourne et passe
5. REVIEW    agent review : conformité spec + imbrications déclarées vérifiées
```

### Règles du cycle

- **Le test e2e simule le métier, pas la technique** : « le dispatcher saisit une panne en < 4 champs et la voit dans le planning », pas « POST /work-orders renvoie 201 ».
- **Suite de régression cumulative** : chaque lot AJOUTE ses tests e2e à la suite ; la suite entière tourne en CI sur chaque PR. Un test e2e supprimé ou skippé = bloquant en review.
- **Imbrications déclarées** : chaque lot liste les lots antérieurs qu'il touche (champ « Imbrications »). La review vérifie spécifiquement ces zones — c'est là que vivent les régressions.
- **Design** : shadcn/ui + Tailwind par défaut, thème neutre unique, zéro composant custom tant qu'un défaut fait le travail. L'énergie va dans les parcours (`02-produit/07-principes-ux.md`), pas les pixels.
- **Mobile** : Playwright ne couvre pas React Native → équivalent = **Maestro** (tests de flows Expo) + le scénario « mode avion » de `05-mobile-offline.md`. Même logique cumulative.

## Prompt type pour lancer un lot avec Opus

```
Exécute le lot L<N> défini dans 03-application/09-decoupage-execution-opus.md.
Contexte obligatoire : CLAUDE.md, la spec docs/specs/<spec>, 07-phase0-fondations.md.
Respecte le cycle 5 étapes. Termine par : pnpm check vert + suite e2e complète verte
+ liste des imbrications vérifiées.
```

---

## Phase 0 — Fondations (pas de UI métier, cycle réduit 1→4)

| Lot | Contenu | Sortie vérifiable |
|---|---|---|
| **L0.1** | Bootstrap monorepo dans **`asc/`** (repo git existant) : pnpm+turbo, apps vides, packages, Biome, tsconfig strict, CI `pnpm check` + copie CLAUDE.md, `.claude/agents/`, nomenclature dans `asc/docs/` | CI verte sur repo vierge ; premier commit conventionnel |
| **L0.2** | `packages/domain` : entités + `computeDeadlines` (règle 6 sem. + quinquennal) tests exhaustifs | 100 % des cas limites de dates testés |
| **L0.3** | Repositories JSON (ADR-001) + suite de tests de contrat + écriture atomique | Suite de contrat verte |
| **L0.4** | Auth JWT mono-tenant + squelette NestJS + premier endpoint `units` | Login + CRUD unit via API |
| **L0.5** | Squelette web (React+Vite+TanStack), login, layout navigation, **config PWA (ADR-003 : manifest, service worker, install)** + **setup Playwright + 1er e2e** (login) | e2e login vert en CI ; app installable |
| **L0.6** | Docker + compose dev + déploiement staging Dokploy (ADR-002) | Staging accessible en HTTPS |

## Phase 1 — Back-office P0

Chaque lot = cycle complet 1→5. « Imbrications » = zones à re-tester.

| Lot | Feature | E2E navigateur ajouté | Imbrications |
|---|---|---|---|
| **L1.1** | Parc : CRUD sites + appareils | Créer un site, y ajouter un appareil, le retrouver par recherche adresse | — |
| **L1.2** | Clients & contacts (syndic, gardien) rattachés aux sites | Créer un client, rattacher 2 sites | L1.1 |
| **L1.3** | Import parc CSV (mapping assisté) | Importer 50 appareils depuis un CSV, vérifier le parc | L1.1, L1.2 |
| **L1.4** | Contrats minimal/étendu liés aux appareils | Créer un contrat, lier 3 appareils, voir les échéances générées | L1.1, L0.2 |
| **L1.5** | Moteur d'échéances branché : tableau conformité (dues/faites/retard) | Un appareil sans visite depuis 7 sem. apparaît en rouge | L1.4, L0.2 |
| **L1.6** | OT : création manuelle (visite/panne/réparation), statuts, fiche | Saisir une panne en ≤ 4 champs et < 30 s (cible UX chronométrée dans le test) | L1.1 |
| **L1.7** | Planning : vue semaine par technicien, drag & drop d'OT | Déplacer un OT, vérifier l'affectation persistée | L1.6 |
| **L1.8** | Génération auto des visites périodiques dans le planning | Un contrat créé génère ses visites plannifiables sur 12 mois | L1.4, L1.5, L1.7 |
| **L1.9** | Recherche globale Cmd+K (appareils, sites, clients, OT) | Trouver un appareil par nom d'immeuble au clavier uniquement | L1.1, L1.2, L1.6 |

## Phase 2 — Terrain P0 (mobile : Maestro remplace Playwright)

| Lot | Feature | Test de flow ajouté | Imbrications |
|---|---|---|---|
| **L2.1** | App mobile : login + tournée du jour (lecture, sync pull) | Voir sa tournée après login | L1.7 |
| **L2.2** | Fiche appareil offline (pull complet + historique) | Consulter une fiche en mode avion | L2.1 |
| **L2.3** | Checklist de visite (ordre physique) + anomalies | Dérouler une checklist complète offline | L2.2 |
| **L2.4** | Photos + signature + clôture (≤ 60 s, ≤ 6 gestes) | Clôturer une visite chronométrée en mode avion | L2.3 |
| **L2.5** | Outbox + sync idempotente (`offline_id`) + reprise après crash | Scénario « mode avion : 5 visites, 20 photos, sync en une fois » | L2.1→L2.4 |
| **L2.6** | Rapport PDF auto + carnet append-only alimenté | Web : le rapport et l'entrée carnet apparaissent après sync (e2e Playwright croisé) | L2.5, L1.5 |
| **L2.7** | Vue carnet d'entretien web + export PDF | Consulter le carnet d'un appareil, exporter | L2.6, L1.1 |

## Phase 3 — Vendable P1

| Lot | Feature | E2E ajouté | Imbrications |
|---|---|---|---|
| **L3.1** | Devis depuis intervention (pièces + MO) + acceptation | Créer un devis depuis une anomalie L2.3, l'accepter | L2.6 |
| **L3.2** | Factures (modèle compatible Factur-X, cf. `02-produit/08`) + export compta | Facturer un devis accepté, exporter | L3.1 |
| **L3.3** | Facturation des contrats (échéancier) | Générer les factures trimestrielles d'un contrat | L1.4, L3.2 |
| **L3.4** | Triage signalements (critique vs prochaine visite) | Un signalement non critique s'attache à la prochaine visite planifiée | L1.6, L1.8 |
| **L3.5** | Notifications email/push (OT assigné, visite en retard) | Une visite en retard déclenche l'alerte | L1.5, L2.1 |
| **L3.6** | Migration Progilift (import enrichi contrats + historique) | Importer un export Progilift type, parc + contrats + échéances corrects | L1.3, L1.4, L1.5 |

## Phase 4 — Portail P2 (mêmes règles ; lots L4.x à détailler au moment venu)

Portail : accès client → parc/visites/carnet → preuve de passage → demandes en ligne → score + export AG. Chaque lot avec e2e Playwright côté portail ET vérification de non-régression back-office (les deux partagent l'API).

---

## Garde-fous transverses

1. Un lot qui grossit en cours de route se COUPE en deux, il ne déborde pas.
2. Un e2e flaky se répare immédiatement (retry ≠ réparation) — une suite de régression douteuse ne protège plus rien.
3. Jeu de données de démo (`seed`) maintenu à chaque lot : les e2e ET les démos design partners tournent dessus.
4. Après chaque phase : passe de l'agent review sur l'ensemble + mise à jour de ce doc (lots réels vs prévus).
