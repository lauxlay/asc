# 005 — Contrats d'entretien

> Lot **L1.4** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.1, L0.2** — le contrat lie des appareils, et il alimente enfin le moteur d'échéances écrit au lot L0.2.

## Contexte

Le contrat d'entretien est **obligatoire par la loi** (loi SAE 2003, décret 2004-964, `../02-produit/05-conformite-reglementaire.md`) : tout propriétaire d'ascenseur doit en avoir un, d'une durée minimale d'un an. C'est aussi le document qui déclenche tout le reste — sans contrat, pas de visite périodique due, donc pas de planning et pas de conformité à suivre.

Jusqu'ici le moteur d'échéances de L0.2 tourne dans le vide : `computeDeadlines` est écrit, testé, et **rien ne l'appelle**. Ce lot lui donne ses entrées et rend enfin visible ce qu'il calcule.

Persona : le dispatcher, à la reprise d'un parc ou à la signature d'un nouveau client.

## Modèle

L'entité `Contract` existe depuis L0.2 (`packages/domain/src/entities.ts`) et n'est pas remaniée :

| Champ | Type | Règle |
|---|---|---|
| `id`, `tenantId` | | Comme les autres entités |
| `reference` | string non vide | **Ajouté ici** : numéro de contrat, « CT-2026-014 ». Sans lui, la liste des contrats n'affiche que des identifiants |
| `type` | `minimal` \| `extended` | Contrats types de l'arrêté du 7 novembre 2012 |
| `unitIds` | Id[] | Appareils couverts |
| `startsOn` | date | Prise d'effet |
| `endsOn` | date \| `null` | `null` = en cours, tacite reconduction |

## Règles métier

### R1 — Type de contrat

1. `minimal` et `extended` sont les deux contrats types de l'arrêté du 7 novembre 2012. Le type décrit **les pièces incluses**, pas le rythme des visites.
2. Le type n'a **aucun effet sur les échéances** — c'est déjà la règle R1.7 de la spec 001, et ce lot ne doit pas la contredire.

### R2 — Durée

1. Un contrat d'entretien dure **au minimum un an** (loi SAE 2003). Si `endsOn` est renseigné, il doit tomber **au moins un an après** `startsOn`. Sinon, refus.
2. La borne est **incluse** : un contrat du `2026-01-01` au `2027-01-01` fait exactement un an et est valide.
3. `endsOn` absent (`null`) signifie **tacite reconduction** : le contrat court tant que personne ne le résilie. C'est le cas le plus fréquent.
4. `endsOn` antérieur à `startsOn` est refusé — c'est le même refus que R2.1, en plus grossier.

### R3 — Couverture d'un appareil

1. `unitIds` référence des appareils **existants du tenant**. Un identifiant inconnu est refusé (`400`), comme le `siteId` d'un appareil (spec 002, R1).
2. Un appareil d'un **autre tenant** est traité exactement comme un identifiant inconnu.
3. **Un appareil ne peut être couvert que par un seul contrat à un instant donné.** Lier un appareil déjà couvert par un contrat dont la période **chevauche** celle du nouveau est refusé (`409`).
4. Deux contrats **successifs** sur le même appareil sont normaux : un contrat du `2024-01-01` au `2025-01-01` et un autre à partir du `2025-01-02` ne se chevauchent pas.
5. Un contrat **sans appareil** est valide : on saisit le contrat signé, on lui rattache les appareils ensuite.
6. Le même appareil ne peut pas figurer **deux fois** dans `unitIds` du même contrat.

> R3.3 n'est pas une préférence de confort : `computeDeadlines(unit, contract, …)` prend **un** contrat. Deux contrats actifs sur un appareil rendraient le calcul d'échéance indéterminé.

### R4 — Échéances générées

1. Les échéances sont **calculées à la demande**, jamais stockées : `computeDeadlines` est pur et déterministe, un cache serait une source de vérité concurrente à maintenir.
2. Le « aujourd'hui » du calcul est fourni par l'API — la frontière, jamais le domaine (spec 001, R6).
3. Tant qu'aucune visite n'est enregistrée (collection absente avant L1.6), le compteur part de `contract.startsOn` : la première échéance de visite tombe à `startsOn + 6 semaines`. C'est exactement la règle R1.3 de la spec 001.
4. L'échéance quinquennale d'un appareil est rendue **même sans contrat** : l'obligation pèse sur le propriétaire (spec 001, R2.1).
5. Les échéances sont lues à travers le tenant de l'appelant, jamais au-delà.

### R5 — Isolation multi-tenant (ADR-001)

Identique aux lots précédents : lire, modifier ou supprimer un contrat d'un autre tenant répond `404`, aucune liste ne se mélange, et le contrôle de chevauchement de R3.3 ne compte que les contrats du tenant.

### R6 — Ordre

`GET /contracts` rend l'**ordre d'insertion**, comme les autres collections.

## Critères d'acceptation

- [ ] `contract` a son port, son adaptateur JSON, son adaptateur mémoire et **une suite de tests de contrat** exécutée contre les deux (`apps/api/CLAUDE.md`).
- [ ] Les règles de durée (R2) et de chevauchement (R3.3/R3.4) sont des **fonctions pures de `packages/domain`**, testées sur les bornes : un an pile, un jour de moins, périodes successives, période ouverte contre période ouverte.
- [ ] CRUD complet des contrats, `tenantId` issu du jeton, UUID applicatifs.
- [ ] R3 couverte : appareil inconnu, appareil d'un autre tenant, doublon dans `unitIds`, chevauchement refusé, succession acceptée.
- [ ] `GET /contracts/:id/deadlines` rend les échéances des appareils du contrat, calculées par `computeDeadlines` — **le moteur de L0.2 est appelé pour de vrai**.
- [ ] Back-office : liste des contrats, création, fiche contrat avec ses appareils et les échéances générées — shadcn/ui uniquement.
- [ ] E2E Playwright : créer un contrat, y lier **3** appareils, voir les échéances générées.
- [ ] **Régression L1.1 / L0.2** : le parc, la recherche et l'import restent verts ; aucun test du moteur d'échéances n'est modifié.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

- **Préavis de résiliation et échéance contractuelle (`kind: contract`)** → la spec 001 les renvoyait à ce lot, mais `../02-produit/05-conformite-reglementaire.md` ne fixe **aucune durée de préavis**. La règle n'est pas arrêtée : l'inventer produirait des alertes fausses sur un sujet contractuel. **Décision produit à prendre avant de coder.**
- **Tableau de bord de conformité du parc** (dues / faites / en retard, indicateur rouge) → **L1.5**. Ici les échéances ne sont visibles que depuis la fiche du contrat.
- **Génération des visites dans le planning** → **L1.8**.
- **Visites réalisées** → collection absente jusqu'à **L1.6** ; les échéances partent donc de `startsOn` (R4.3).
- **Facturation du contrat, échéancier de paiement** → **L3.3**.
- **Clauses personnalisables, PDF du contrat, pièces incluses par type** → non planifiés en Phase 1.
- **Rattachement du contrat à un client** : le modèle figé (`../03-application/03-modele-donnees.md`) place `contract` sous la société, avec `unit_ids`, sans `customer_id`. Le client se déduit des immeubles des appareils couverts.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Ajout de `contract.reference` | Champ obligatoire | Un contrat se désigne par son numéro dans toute conversation métier. Sans lui, la liste n'affiche qu'un UUID. Même raisonnement que `unit.reference` au lot L1.1 |
| Durée minimale contrôlée à l'écriture | Refus (`422`) | La règle est légale et sourcée, pas une préférence. La laisser passer produirait des contrats non conformes que rien ne rattraperait |
| Chevauchement → `409`, pas de reprise automatique | Refus | Clore automatiquement le contrat précédent serait une décision commerciale prise à la place de l'utilisateur |
| Échéances calculées à la demande | Jamais stockées | Voir R4.1. `compliance_deadline` figure au modèle de données comme table, mais rien ne la consomme encore ; la matérialiser avant L1.5 serait spéculatif (règle 7) |
| Pas de paramètre « à la date du » sur l'endpoint | Le serveur fournit le jour | Un paramètre de date de référence serait utile aux tests mais exposerait en production un mode « faire comme si », sans besoin réel. Le domaine reste testable directement, c'est là que les cas de dates sont couverts |
| Contrat sans appareil autorisé | Autorisé | On saisit le contrat signé le jour de la signature, les appareils suivent |
