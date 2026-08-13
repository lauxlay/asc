# 006 — Tableau de conformité du parc

> Lot **L1.5** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.4, L0.2.**

## Contexte

« Le réglementaire est la raison d'achat du produit » (`../02-produit/05-conformite-reglementaire.md`). Le dispatcher d'une PME ascensoriste n'a aujourd'hui **aucun moyen fiable** de savoir quels appareils sont hors des clous : chez Progilift l'information existe mais est noyée, et Praxedo ne connaît pas le métier.

Le lot L1.4 a branché le moteur d'échéances, mais il ne se consulte qu'**un contrat à la fois**. Ce lot renverse la perspective : partir du parc, pas du contrat, et répondre à la seule question qui compte le lundi matin — **« qu'est-ce qui est en retard ? »**

Persona : le dispatcher, tous les jours. C'est l'écran qu'il ouvrira en arrivant.

## Le piège à éviter

Un tableau de conformité qui ne liste que les échéances **rate les appareils les plus problématiques** : celui sans contrat ne produit aucune échéance de visite, celui dont on ignore la mise en service n'en produit aucune du tout. Ils seraient invisibles, donc réputés conformes.

D'où la règle centrale de ce lot : **le tableau a une ligne par appareil, pas une ligne par échéance.** Aucun appareil du parc ne peut disparaître du tableau, quelles que soient ses données.

## Règles métier

### R1 — Une ligne par appareil

1. Le tableau liste **tous** les appareils du tenant, sans exception.
2. Chaque ligne porte : l'appareil, son immeuble, son contrat s'il en a un, son échéance de visite, son échéance de contrôle quinquennal, et un **statut de synthèse**.
3. Une échéance non calculable est affichée comme **inconnue**, jamais comme « à jour ». Ne pas savoir n'est pas être conforme.

### R2 — Contrat applicable

1. L'échéance de visite d'un appareil se calcule avec le contrat qui le couvre **au jour d'évaluation** : celui qui le liste et dont la période inclut ce jour (bornes incluses).
2. Un appareil peut avoir plusieurs contrats dans son historique ; **un seul** peut être actif à un instant donné (spec 005, R3.3). C'est cette garantie qui rend la sélection déterministe.
3. Sans contrat actif, il n'y a pas d'échéance de visite — et c'est en soi un défaut de conformité (R4).

### R3 — Statut de synthèse d'un appareil

1. Le statut de la ligne est le **pire** de ses échéances : `overdue` l'emporte sur `due_soon`, qui l'emporte sur `ok`.
2. Un appareil sans aucune échéance calculable a le statut **inconnu**. Il n'est ni conforme ni en retard : on n'en sait rien, et c'est cette information-là qu'il faut montrer.
3. Le statut de synthèse ne remplace pas le détail : les deux échéances restent lisibles sur la ligne.

### R4 — Appareil sans contrat

1. Le contrat d'entretien est **obligatoire par la loi** (loi SAE 2003). Un appareil sans contrat actif est signalé comme tel, distinctement.
2. Ce n'est **pas** un type d'échéance : il n'y a pas de date. C'est un état de l'appareil, compté à part.
3. Un appareil sans contrat conserve son échéance quinquennale si elle est calculable : l'obligation de contrôle pèse sur le propriétaire, pas sur l'ascensoriste (spec 001, R2.1).

### R5 — Compteurs

1. Le tableau est surmonté de compteurs : **en retard**, **bientôt dues**, **à jour**, **inconnu**, **sans contrat**.
2. Les quatre premiers partitionnent le parc : chaque appareil est compté **une fois et une seule**, selon son statut de synthèse.
3. **« Sans contrat » chevauche les autres** : c'est un axe différent, pas une cinquième valeur de statut. Un appareil sans contrat mais dont le quinquennal est en retard compte dans les deux.
4. Les compteurs filtrent le tableau au clic — le dispatcher veut voir les retards, pas les compter.

### R6 — Ce que « faites » veut dire aujourd'hui

Le découpage annonce un tableau « dues / faites / retard ». **Le nombre de visites faites n'est pas calculable dans ce lot** : aucune visite n'est encore enregistrée (collection absente avant L1.6, alimentée à partir de L1.8).

Ce lot livre donc la partition que le moteur sait produire — **à jour / bientôt dues / en retard**, plus les angles morts (inconnu, sans contrat). Le décompte des visites réalisées viendra avec les visites elles-mêmes, sans changer la structure de l'écran.

### R7 — Calcul à la demande

Les échéances sont calculées à chaque consultation, jamais stockées (spec 005, R4.1). Le jour d'évaluation est fourni par l'API, jamais lu dans le domaine (spec 001, R6). Consulter le tableau ne modifie rien.

### R8 — Isolation multi-tenant (ADR-001)

Le tableau ne montre que le parc du tenant du jeton. Les compteurs, les contrats retenus et les échéances sont calculés exclusivement sur ses données.

## Critères d'acceptation

- [ ] La sélection du contrat applicable (R2) et le statut de synthèse (R3) sont des **fonctions pures de `packages/domain`**, testées : plusieurs contrats historiques, contrat expiré, contrat futur, aucun contrat, échéances partielles.
- [ ] R1.1 couverte : un appareil sans contrat **et** sans date de mise en service apparaît quand même dans le tableau.
- [ ] R3.2 couverte : cet appareil-là est marqué **inconnu**, jamais « à jour ».
- [ ] R5.2 et R5.3 couvertes : les statuts partitionnent le parc, « sans contrat » se compte à part.
- [ ] `GET /compliance` rend les lignes et les compteurs, filtrables par statut.
- [ ] Back-office : compteurs cliquables et tableau, **retard en rouge** — shadcn/ui uniquement.
- [ ] E2E Playwright : **un appareil sans visite depuis 7 semaines apparaît en rouge**.
- [ ] **Régression L1.4 / L0.2** : la fiche contrat et ses échéances restent justes ; aucun test du moteur d'échéances n'est modifié.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

- **Décompte des visites réalisées** → voir R6, dépend de **L1.6 / L1.8**.
- **Échéance contractuelle** (`kind: contract`, préavis) → règle non arrêtée, cf. `../02-produit/09-decisions-metier-en-attente.md` (A1).
- **Planification depuis le tableau** (« programmer cette visite ») → **L1.7 / L1.8** : il faut d'abord des ordres de travail et un planning.
- **Export du tableau** (PDF, tableur) → non planifié en Phase 1 ; le carnet d'entretien exportable est un sujet distinct (L2.7).
- **Alertes et notifications** (email quand un appareil passe en retard) → **L3.5**.
- **Recherche et filtre par immeuble ou client** → **L1.9** (recherche globale). Ici, seul le filtre par statut existe.
- **Historique de conformité** (« combien d'appareils étaient en retard le mois dernier ») → demanderait de matérialiser les échéances, ce que R7 refuse.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Ligne par appareil, pas par échéance | Par appareil | Voir « le piège à éviter » : c'est ce qui empêche un appareil sans données de disparaître du tableau |
| Statut `unknown` introduit | Ajouté au read model de l'API, **pas** au moteur | `computeDeadlines` ne rend que des échéances réelles ; l'absence d'échéance est un fait de lecture, pas une échéance de plus. Le moteur de L0.2 n'est pas touché |
| « Sans contrat » hors partition | Axe séparé | Un appareil peut être à la fois sans contrat et en retard sur son quinquennal ; en faire une valeur de statut ferait disparaître l'un des deux |
| Pire échéance comme statut de ligne | `overdue` > `due_soon` > `ok` | Le dispatcher trie par urgence. Afficher la moyenne ou la prochaine échéance masquerait un retard derrière une échéance lointaine |
| Filtre par statut uniquement | Un seul filtre | Le parc d'une PME tient en quelques centaines de lignes ; la recherche globale de L1.9 couvrira le reste |
| Pas de pagination | Liste complète | 1 500 appareils font une page longue mais lisible, et le filtre par statut la réduit immédiatement. À revoir si un design partner dépasse ce volume |
