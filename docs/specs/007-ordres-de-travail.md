# 007 — Ordres de travail

> Lot **L1.6** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.1.**
>
> **Parcours de référence** : « saisir une panne entrante » (`../02-produit/07-principes-ux.md`).
> **Cible chiffrée : < 30 s, ≤ 4 champs obligatoires.**

## Contexte

L'ordre de travail est l'unité de production de l'ascensoriste : tout ce que fait un technicien est un OT. Sans lui, pas de planning (L1.7), pas de tournée mobile (L2.1), pas de rapport ni de carnet (L2.6).

Ce lot construit la saisie **manuelle**, et la construit autour du moment le plus tendu du métier : **le téléphone sonne, quelqu'un est bloqué dans une cabine**. Le dispatcher est interrompu quarante fois par jour ; s'il doit réfléchir à l'outil au lieu d'écouter son interlocuteur, l'outil a échoué.

C'est de là que vient la cible : `../02-produit/07-principes-ux.md` la donne comme **critère d'acceptation mesuré, pas comme une intention**.

## Le parcours qui commande tout le reste

> téléphone à l'oreille → **saisie appareil (recherche par adresse ou nom d'immeuble, jamais par référence)** → criticité → validé

Personne au téléphone ne dit « l'appareil ASC-0483 ». On dit « le 12 rue des Lilas », ou « la résidence Les Tilleuls ». La recherche par adresse existe depuis le lot L1.1 : ce lot la réutilise, il ne la réinvente pas.

## Modèle

Entité `work_order`, glossaire figé par `../03-application/03-modele-donnees.md` :

| Champ | Type | Règle |
|---|---|---|
| `id`, `tenantId` | | Comme les autres entités |
| `reference` | string non vide | Numéro d'OT lisible, généré par le serveur (voir R6) |
| `type` | `visit` \| `breakdown` \| `repair` | Visite / panne / réparation |
| `status` | `new` \| `in_progress` \| `done` \| `cancelled` | Voir R3 |
| `priority` | `entrapment` \| `urgent` \| `normal` | `entrapment` = personne bloquée = P0 |
| `unitId` | Id | Appareil concerné, vérifié |
| `summary` | string non vide | Ce que dit l'appelant, en une ligne |
| `createdOn` | date | Jour de création, fourni par l'API |

## Règles métier

### R1 — Saisie minimale (la cible du lot)

1. Créer un OT exige **au plus 4 champs obligatoires**. Aujourd'hui il en faut **3** : appareil, criticité, description.
2. Chaque champ qui peut avoir une valeur par défaut en a une : le **type** vaut `breakdown` et la **criticité** vaut `normal` sur l'écran de saisie rapide. « L'utilisateur corrige l'exception, il ne saisit pas la règle. »
3. L'appareil se cherche **par adresse ou nom d'immeuble**, jamais par référence interne. La recherche est celle du lot L1.1 (spec 002, R2).
4. Aucune étape intermédiaire : pas de sélection d'immeuble **puis** d'appareil sur deux écrans, pas de confirmation modale. La création est réversible (annulation), donc pas de modale (`07-principes-ux.md`).

### R2 — Types d'OT

1. Trois types dans ce lot : `visit`, `breakdown`, `repair`.
2. Le modèle de données prévoit aussi `works` et `inspection`. Ils ne sont **pas** implémentés : rien ne les produirait ni ne les consommerait. Ils arriveront avec leurs features (devis→travaux en L3.1, contrôle technique en L2.6).
3. Le type n'a **aucun effet** sur le cycle de vie : une visite, une panne et une réparation suivent les mêmes statuts.

### R3 — Statuts et transitions

1. Cycle : `new` → `in_progress` → `done`. `cancelled` est atteignable depuis `new` et `in_progress`.
2. Un OT `done` ou `cancelled` est **terminal** : aucune transition n'en sort. Rouvrir un OT clôturé effacerait la trace de ce qui s'est passé ; on en crée un nouveau.
3. Une transition non autorisée est refusée (`422`), avec le statut courant et les transitions possibles dans le message.
4. Un OT naît toujours `new`. Le client ne choisit pas le statut initial.

### R4 — Criticité

1. `entrapment` (personne bloquée), `urgent`, `normal`. La valeur par défaut est `normal`.
2. `entrapment` est le **P0** du produit : c'est la seule criticité qui porte la couleur d'alerte, au même titre que les échéances réglementaires (`07-principes-ux.md`, règle 4). Pas d'inflation d'alertes.
3. La criticité est indépendante du type : une visite peut être urgente, une panne peut être normale.

### R5 — Rattachement à l'appareil

1. `unitId` référence un appareil **existant du tenant**. Inconnu → `400`, comme partout ailleurs (spec 002, R1).
2. Un appareil d'un **autre tenant** est traité exactement comme un identifiant inconnu.
3. Un appareil peut porter **autant d'OT que nécessaire**, y compris plusieurs ouverts en même temps : une panne pendant une réparation en cours est un cas réel.

### R6 — Référence lisible

1. Chaque OT reçoit une référence lisible du type `OT-000042`, générée par le serveur, **en plus** de son UUID.
2. Elle est **unique dans le tenant** et n'est jamais réutilisée, même après annulation : on cite un numéro d'OT au téléphone et dans un rapport, il doit désigner une seule chose pour toujours.
3. Le client ne la choisit pas.

### R7 — Isolation multi-tenant (ADR-001)

Identique aux autres lots : lire, modifier ou supprimer l'OT d'un autre tenant répond `404`, aucune liste ne se mélange, et la numérotation de R6 est propre à chaque tenant.

### R8 — Ordre et filtres

1. `GET /work-orders` rend les OT du **plus récent au plus ancien** — contrairement aux autres collections. Un dispatcher veut voir ce qui vient d'arriver, pas ce qu'il a saisi il y a six mois.
2. Filtres : par statut, par type, par appareil.

## Critères d'acceptation

- [ ] Les transitions de statut (R3) sont une **fonction pure de `packages/domain`**, testée sur toutes les paires possibles, y compris les terminales.
- [ ] `work_order` a son port, son adaptateur JSON, son adaptateur mémoire et **une suite de tests de contrat** exécutée contre les deux (`apps/api/CLAUDE.md`).
- [ ] R5 couverte : appareil inconnu et appareil d'un autre tenant refusés.
- [ ] R6 couverte : références successives, uniques, non réutilisées après suppression, propres au tenant.
- [ ] Back-office : saisie rapide de panne, liste filtrable, fiche OT avec changement de statut — shadcn/ui uniquement.
- [ ] **La recherche d'appareil se fait par adresse ou nom d'immeuble** dans le formulaire de saisie.
- [ ] E2E Playwright : **saisir une panne avec au plus 4 champs obligatoires**, parcours chronométré (voir la réserve ci-dessous).
- [ ] **Régression L1.1** : le parc, la recherche d'adresse et l'import restent verts.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Ce que le chronomètre du test prouve, et ce qu'il ne prouve pas

Le découpage demande une « cible UX chronométrée dans le test ». Elle est implémentée, avec une réserve qu'il vaut mieux écrire que découvrir plus tard :

- **Ce qui est réellement garanti** : le **nombre de champs obligatoires** (≤ 4), compté sur le formulaire rendu. C'est une contrainte structurelle, elle ne peut pas dériver sans faire échouer le test.
- **Ce que le chronomètre garantit** : que le parcours ne gagne pas d'étape lourde — une navigation de plus, un aller-retour serveur supplémentaire, un écran intermédiaire. Un budget dépassé signale une régression de flux.
- **Ce qu'il ne garantit pas** : qu'un **humain** y arrive en 30 secondes. Playwright remplit un formulaire en une seconde ; aucune exécution automatisée ne mesure le temps de lecture, d'hésitation ou de dictée au téléphone. Seule une observation d'utilisateur réel valide la cible de 30 s.

Le test emploie donc la valeur de `07-principes-ux.md` (30 s) comme **plafond**, et le compte de champs comme garde-fou réel.

## Hors scope

- **Affectation à un technicien et planification** → **L1.7** (planning semaine, drag & drop, `scheduled_at`, `assignee`). Un OT créé ici est non affecté.
- **Génération automatique des visites périodiques** → **L1.8**. Ici, tout OT est saisi à la main.
- **Suggestion du technicien le plus proche/disponible** (UC2, étape 3) → demande le planning et les tournées, donc **L1.7 / L1.8**.
- **Checklist, photos, signature, clôture terrain** → **L2.3 / L2.4** (mobile).
- **Rapport PDF et carnet d'entretien** → **L2.6**.
- **Cause de panne codifiée** (UC2, étape 4) → nomenclature non arrêtée, à instruire avec un design partner.
- **Signalement par QR code ou portail** → **Phase 4** et L3.4.
- **`offline_id`** (déduplication à la sync mobile) → **L2.5**, avec la sync qui l'utilise.
- **Devis depuis une intervention** → **L3.1**.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Statuts retenus | `new` / `in_progress` / `done` / `cancelled` | Le modèle de données annonce un `status` sans en fixer les valeurs. Ces quatre couvrent le cycle complet sans anticiper l'affectation ; `assigned` arrivera avec le planning de L1.7 |
| Statuts terminaux définitifs | Pas de réouverture | Voir R3.2. Un OT clôturé est une trace ; on en crée un nouveau plutôt que d'en réécrire un ancien |
| `works` et `inspection` non implémentés | Trois types | Rien ne les produirait ni ne les lirait aujourd'hui (règle 7 de `07-phase0-fondations.md`) |
| Référence `OT-000042` | Séquence par tenant, 6 chiffres | On cite un numéro d'OT au téléphone : un UUID est inutilisable à l'oral. Six chiffres couvrent 999 999 OT, soit largement la vie du produit chez une PME |
| Séquence non réutilisée | Jamais recyclée | Un numéro qui désigne deux OT différents dans le temps rend tout rapport ambigu |
| `summary` obligatoire | Obligatoire | C'est le contenu de l'appel. Un OT sans description oblige à rappeler le client — le contraire de l'objectif |
| Tri antéchronologique | Plus récent d'abord | Seule collection triée ainsi, et c'est délibéré : voir R8.1 |
| Pas d'`assignee` dans ce lot | Champ absent de l'entité | Il arrive avec le planning qui le remplit (L1.7). L'ajouter vide maintenant serait un champ mort |
