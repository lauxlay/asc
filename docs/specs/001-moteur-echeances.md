# 001 — Moteur d'échéances de conformité

> Lot **L0.2** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain` uniquement, logique pure, zéro I/O.

## Contexte

Le réglementaire est la raison d'achat du produit (`../02-produit/06-backlog-priorise-planning.md`, priorité 2). Le dispatcher d'une PME ascensoriste n'a aujourd'hui aucun moyen fiable de savoir quels appareils sont hors des clous : chez Progilift l'information existe mais est noyée, et Praxedo ne connaît pas le métier.

Deux obligations françaises (`../02-produit/05-conformite-reglementaire.md`) :

- **Visite périodique** : au moins une toutes les **6 semaines**.
- **Contrôle technique quinquennal** : tous les **5 ans**, par un organisme agréé, avec **alerte à 6 mois**.

Ce lot encode ces deux règles. Il ne construit ni stockage, ni API, ni UI.

## Fonction

Signature figée par `../03-application/07-phase0-fondations.md` :

```ts
computeDeadlines(unit, contract, visits, referenceOn) → ComplianceDeadline[]
```

`referenceOn` (le « aujourd'hui ») est un **paramètre**, jamais une horloge lue dans le domaine : c'est ce qui rend le moteur testable exhaustivement et déterministe.

## Règles métier

### R1 — Échéance de visite (`visit_6w`)

1. Elle n'existe que si un **contrat actif couvre l'appareil** : `contract.unitIds` contient `unit.id`, `startsOn ≤ referenceOn`, et (`endsOn` absent **ou** `referenceOn ≤ endsOn`). Bornes **incluses**.
2. `dueOn` = **date de la dernière visite réalisée + 6 semaines** (42 jours).
3. Sans aucune visite réalisée, le compteur part de `contract.startsOn` : `dueOn = startsOn + 42 jours`.
4. Une visite **planifiée mais non réalisée** (`completedOn` absent) ne déplace pas l'échéance.
5. Une visite réalisée **après `referenceOn`** est ignorée : elle n'a pas encore eu lieu.
6. Plusieurs visites : seule la **plus récente** compte, quel que soit l'ordre d'entrée.
7. Le type de contrat (`minimal` / `extended`) n'a **aucun effet** sur les échéances — il ne joue que sur les pièces facturées.

### R2 — Échéance de contrôle quinquennal (`inspection_5y`)

1. Elle est **indépendante du contrat d'entretien** : l'obligation pèse sur le propriétaire, pas sur l'ascensoriste. Un appareil sans contrat, ou dont le contrat est expiré, porte quand même son échéance quinquennale.
2. `dueOn` = **dernier contrôle + 5 ans** (`unit.lastStatutoryInspectionOn`).
3. Sans contrôle connu, le compteur part de la **mise en service** : `unit.commissionedOn + 5 ans`.
4. Si ni contrôle ni mise en service ne sont connus, **aucune échéance n'est produite** — on ne devine pas.

### R3 — Statuts

| Statut | Condition |
|---|---|
| `overdue` | `referenceOn` est **strictement après** `dueOn` |
| `due_soon` | l'échéance tombe dans la fenêtre d'alerte (bornes incluses) — le jour même de l'échéance est `due_soon`, pas `overdue` |
| `ok` | au-delà de la fenêtre d'alerte |

Fenêtres d'alerte : **7 jours** pour `visit_6w`, **6 mois** pour `inspection_5y`.

### R4 — Invariants multi-tenant (ADR-001)

`unit`, `contract` et chaque visite doivent porter le **même `tenantId`**, et toutes les visites doivent concerner **`unit.id`**. Toute violation lève une erreur : produire une échéance à partir des visites d'un autre appareil signifierait déclarer conforme un appareil qui ne l'est pas.

### R5 — Déterminisme

Le résultat est trié par `dueOn` croissant, puis par `kind` alphabétique. Deux appels avec les mêmes entrées rendent exactement le même tableau.

### R6 — Dates

Le domaine raisonne en **jours calendaires UTC** (`YYYY-MM-DD`), jamais en instants : la règle des 6 semaines est une règle de calendrier. La conversion d'un horodatage d'intervention en jour calendaire est une affaire de frontière (`contracts` / `api`), pas de domaine.

Arithmétique de dates, cas limites à couvrir à 100 % :

- **Années bissextiles** : `2024-02-29` valide, `2026-02-29` invalide, `2100-02-29` invalide (siècle non bissextile), `2000-02-29` valide (règle des 400 ans).
- **Débordement de mois écrêté** : `+ 1 mois` sur `2026-01-31` donne `2026-02-28` (et non `2026-03-03`) ; `+ 5 ans` sur `2024-02-29` donne `2029-02-28`. On écrête toujours à la fin du mois, ce qui rend l'échéance **plus tôt** — le sens strict pour de la conformité.
- Franchissements de mois et d'année, décalages négatifs, décalage nul.

## Critères d'acceptation

- [ ] `computeDeadlines` est pure : aucun I/O, aucune lecture d'horloge, aucune dépendance externe (`packages/domain` n'a aucune dépendance de production).
- [ ] R1 à R6 couvertes par des tests unitaires, cas limites de dates inclus.
- [ ] Un appareil sans visite depuis 7 semaines ressort `overdue` (c'est le scénario e2e du lot L1.5).
- [ ] Un contrôle quinquennal à moins de 6 mois ressort `due_soon`.
- [ ] Les violations d'invariants de R4 lèvent une erreur typée.
- [ ] `pnpm check` vert.

## Hors scope

Échéances contractuelles (`kind: contract`, préavis de résiliation, tacite reconduction) → **L1.4**, la règle de préavis n'est pas arrêtée. Persistance des échéances et recalcul à la clôture d'un OT → **L0.3 / L1.5**. Tableau de bord conformité → **L1.5**. Génération des visites dans le planning → **L1.8**.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Fenêtre d'alerte des visites | 7 jours | Non spécifié ; une semaine est l'horizon de planification d'une tournée. Constante exportée, ajustable en L1.5 |
| Origine du compteur sans visite | `contract.startsOn` | L'obligation naît avec le contrat |
| Origine du quinquennal sans contrôle | `unit.commissionedOn` | Un appareil neuf est contrôlé 5 ans après sa mise en service |
| `lastStatutoryInspectionOn` porté par `unit` | Champ dénormalisé sur l'appareil | La signature figée par `07` ne passe pas de collection d'inspections. À remplacer par une vraie collection si l'historique des contrôles devient nécessaire (L2.6) |
| Jour de l'échéance | `due_soon`, pas `overdue` | On n'est pas en retard le jour même où l'obligation tombe |
