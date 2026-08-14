# 009 — Génération des visites périodiques

> Lot **L1.8** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.4, L1.5, L1.7.**
>
> **Parcours de référence** : « onboarding nouveau client » (`../02-produit/07-principes-ux.md`).
> **Cible chiffrée : premier planning généré en moins d'un jour.**

## Contexte

Un contrat d'entretien engage l'ascensoriste à **au moins une visite toutes les 6 semaines** par appareil (`../02-produit/05-conformite-reglementaire.md`). Aujourd'hui le produit sait dire qu'un appareil est en retard (L1.5) et sait planifier un OT à la main (L1.7), mais **personne ne crée les visites** : le dispatcher devrait les saisir une par une, neuf fois par an et par appareil. Sur un parc de 200 appareils, c'est 1 800 saisies annuelles.

C'est aussi la promesse d'onboarding : signer un client et voir son planning se remplir le jour même.

## Ce qu'une visite générée **est**

Un **ordre de travail de type `visit`**. Pas une entité nouvelle.

Le type existe depuis L1.6 précisément pour ça, et c'est ce qui rend la visite *plannifiable* : le planning de L1.7 affiche des OT, les déplace et les affecte. Créer une collection parallèle obligerait à tout redoubler — affectation, statuts, fiche — pour le même objet métier.

> **Et `maintenance_visit` du modèle de données ?** L'entité existe dans `@asc/domain` parce que le moteur d'échéances de L0.2 la consomme (`computeDeadlines`). Elle décrit une visite **réalisée**, avec sa date de réalisation ; l'OT de type `visit` décrit le **travail à faire**. Le pont entre les deux — un OT clôturé qui devient une visite au carnet — se construira à la clôture terrain (**L2.4**, **L2.6**). Ce lot ne le pose pas, et n'invente rien en attendant.

## Modèle — un champ ajouté

| Champ | Type | Règle |
|---|---|---|
| `dueOn` | jour ISO \| `null` | Date **limite réglementaire** de l'intervention |

**`dueOn` n'est pas `scheduledOn`.** L'un dit *quand il faut que ce soit fait*, l'autre *quand on a prévu de le faire*. Une visite générée a une échéance dès sa naissance et **aucun technicien** : elle attend au backlog que le dispatcher la place. C'est exactement ce que la règle « planifié = technicien **et** jour » de la spec 008 (R2) interdisait de représenter avec `scheduledOn`, et la raison pour laquelle ce champ existe séparément plutôt que d'assouplir cette règle.

Une panne n'a pas d'échéance réglementaire : `dueOn` y vaut `null`.

## Règles métier

### R1 — Le calendrier

1. Les visites d'un appareil tombent tous les **35 jours** (5 semaines), à partir de la **date de prise d'effet du contrat**. La cadence vient du réglementaire, pas du contrat : rien dans le modèle ne porte de fréquence, et la loi en fixe une seule — voir R1.7 pour l'écart avec les 42 jours de la loi.
2. La série est **ancrée sur `startsOn`** : la n-ième visite tombe à `startsOn + n × 35 jours`, quelle que soit la date à laquelle on génère. Deux générations successives produisent donc les mêmes dates.
3. **Horizon : 12 mois** à partir du jour de génération. Au-delà, on planifierait un contrat qui peut être résilié.
4. Aucune visite n'est produite **après `endsOn`** quand le contrat en a un.
5. Aucune visite n'est produite **dans le passé** : le calendrier sert à préparer, pas à réécrire. Un contrat signé il y a trois ans reprend à sa prochaine échéance à venir.
6. Une visite est générée **par appareil couvert** : un contrat de trois appareils produit trois séries indépendantes.
7. La cadence est un **maximum légal**, pas un engagement contractuel : la règle est « au moins une toutes les 6 semaines ». Générer exactement à 42 jours ne laisse aucune marge — les visites sont donc posées à **35 jours** (5 semaines), pour que le retard d'une semaine reste rattrapable. Voir les choix.

### R2 — Ce que la génération produit

Un OT par échéance, avec :

| Champ | Valeur |
|---|---|
| `type` | `visit` |
| `status` | `new` |
| `priority` | `normal` — une visite prévue n'est pas une urgence |
| `dueOn` | la date d'échéance calculée |
| `assignee`, `scheduledOn` | `null` : la visite attend au backlog |
| `summary` | « Visite périodique » |
| `reference` | Attribuée par la séquence annuelle habituelle (spec 007, R6) |

`reportCount` vaut 1 et `reportedAt` l'instant de génération : ces deux champs décrivent des signalements, notion qui n'a pas de sens ici. Ils gardent une valeur cohérente plutôt qu'un cas particulier dans le modèle.

### R3 — Idempotence

1. Générer deux fois **ne crée pas de doublon**. La clé naturelle est le triplet **(appareil, type `visit`, `dueOn`)**.
2. Un OT existant sur cette clé est laissé **strictement intact**, quel que soit son statut : déjà planifié, en cours, clôturé ou annulé. Regénérer ne doit jamais défaire le travail du dispatcher.
3. Une visite **annulée** n'est donc pas ressuscitée. L'annulation est une décision, pas un accident.
4. La réponse dit combien d'OT ont été **créés** et combien étaient **déjà là** : sans ce compte, l'utilisateur ne sait pas si son clic a fait quelque chose.

### R4 — Quand ça se déclenche

1. **À la création d'un contrat**, automatiquement. C'est la promesse d'onboarding, et c'est le scénario du découpage.
2. **Quand les appareils couverts changent**, automatiquement aussi. Sans cela la promesse ne tiendrait pas à l'écran : le formulaire de création ne demande pas les appareils, ils sont liés juste après. Un appareil qui rejoint le contrat repart donc avec ses visites.
3. **À la demande**, depuis la fiche du contrat, pour les contrats déjà en base et pour repousser l'horizon.
4. **Pas de tâche planifiée** : la Phase 0 n'a pas d'ordonnanceur. L'horizon glissant se maintient donc à la main, ce qui est tenable pour douze mois d'avance. Daté en hors scope.
5. La génération **ne bloque jamais** la création ni la modification du contrat : si elle échoue, le contrat existe quand même et reste régénérable. Un contrat perdu coûte plus cher qu'un calendrier à relancer.

### R5 — Création en lot

1. Un contrat de 50 appareils produit près de 500 OT d'un coup. Le port reçoit donc une méthode de création **en lot**, qui attribue les références et écrit **une seule fois**.
2. Ce n'est pas qu'une affaire de vitesse : 500 créations successives, c'est 500 lectures-écritures du fichier entier, et autant d'occasions de laisser la collection à moitié écrite. Le lot est atomique — tout ou rien.
3. Les références restent **consécutives et sans trou** à l'intérieur d'un lot, et la séquence reste propre au tenant et à l'année (spec 007, R6).

### R6 — Ce que le dispatcher voit

1. Les visites générées arrivent au **backlog** du planning, avec leur échéance lisible sur la carte.
2. Le backlog se trie désormais par **criticité, puis échéance, puis ancienneté**. La clé d'échéance s'ajoute à celles de la spec 008 (R6.1) parce que les visites générées naissent **toutes au même instant** : l'ancienneté ne les départage pas, et le dispatcher verrait la visite la plus lointaine en tête. Une carte **sans** échéance passe devant celles qui en ont une — une panne n'a pas de date limite parce qu'elle est due maintenant, pas parce qu'elle peut attendre.
3. Les visites sont `normal` : elles passent donc **après** les pannes, ce qui est le bon ordre — une panne bloque un immeuble, une visite a des semaines de marge.
4. La fiche du contrat montre le nombre de visites générées et l'échéance de la prochaine.
5. Une visite se planifie **exactement comme un OT ordinaire** : rien de nouveau à apprendre.

### R7 — Isolation et intégrité (ADR-001)

1. La génération ne lit et n'écrit que dans le tenant du jeton.
2. Un contrat inconnu répond `404`.
3. Un appareil du contrat qui n'existe plus est **ignoré sans faire échouer** le reste : un contrat mal nettoyé ne doit pas empêcher de planifier les autres appareils.

## Critères d'acceptation

- [ ] Le calendrier est une **fonction pure de `packages/domain`** : dates ancrées sur `startsOn`, horizon, borne de fin, exclusion du passé, et rapprochement avec les échéances déjà couvertes. Testée sur les changements d'heure, les années bissextiles et les passages d'année.
- [ ] R3 couverte : deux générations d'affilée laissent le parc identique ; un OT planifié, clôturé ou annulé n'est ni dupliqué ni modifié.
- [ ] R5 couverte par la **suite de contrat** du port, contre les deux adaptateurs : références consécutives, lot atomique, séquence propre au tenant.
- [ ] `dueOn` a son défaut de persistance et son cas dans `legacy-records.test.ts`.
- [ ] Un contrat créé par l'API porte immédiatement ses visites, sans second appel.
- [ ] **E2E Playwright** : créer un contrat, retrouver ses visites au backlog avec leur échéance, en planifier une par glisser-déposer.
- [ ] **Régression L1.4, L1.5, L1.7** : contrats, tableau de conformité et planning restent verts.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

- **Horizon glissant automatique** → demande un ordonnanceur, absent de la Phase 0 (R4.3). À traiter avec les tâches de fond, probablement au moment des notifications (**L3.5**).
- **Affectation automatique** des visites générées à un technicien → la suggestion du plus proche est P1, et l'affectation par défaut « technicien habituel de l'immeuble » demande un historique qui n'existe pas encore.
- **Regroupement par immeuble** — poser d'un coup les six appareils d'une même adresse le même jour → vraie économie de tournée, mais c'est de l'optimisation, rangée en P2.
- **Suppression des visites d'un appareil retiré du contrat** → la génération est additive ; un appareil sorti du contrat garde ses visites futures, que le dispatcher annule. À revoir si le cas devient courant.
- **Clôture d'une visite et alimentation du carnet** → **L2.4**, **L2.6**.
- **Lien entre OT `visit` clôturé et `maintenance_visit`** du moteur d'échéances → même échéance, voir la note du contexte.
- **Visites contractuelles plus fréquentes que le minimum légal** (contrat « premium » mensuel) → le modèle ne porte aucune fréquence ; à instruire avec un design partner.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Une visite générée est un OT `visit` | Pas d'entité nouvelle | Le planning déplace des OT ; une collection parallèle dupliquerait affectation, statuts et fiche |
| `dueOn` distinct de `scheduledOn` | Deux champs | « Quand il faut » et « quand c'est prévu » sont deux faits différents. C'est ce qui permet de garder la règle stricte de la spec 008, R2 |
| Cadence à **35 jours** et non 42 | 5 semaines | La loi dit « au moins une toutes les 6 semaines ». Générer pile à 42 jours ne laisse aucune marge : le moindre report met l'appareil en infraction. Cinq semaines laissent une semaine de rattrapage. Arbitrage produit, remonté au registre des décisions |
| Ancrage sur `startsOn`, pas sur la dernière visite faite | `startsOn` | Le calendrier est un prévisionnel déterministe ; la conformité réelle reste calculée par le moteur de L0.2, qui, lui, part de la dernière visite réalisée |
| Horizon de 12 mois | 12 mois | La ligne du découpage. Au-delà on planifierait un contrat résiliable |
| Idempotence sur (appareil, type, `dueOn`) | Clé naturelle | Pas de champ « généré par » à maintenir, et l'unicité porte sur ce qui compte : une visite due ce jour-là |
| Regénérer ne touche à rien d'existant | Additif seulement | Le dispatcher a pu planifier, faire ou annuler ; une génération qui écrase serait une perte de travail |
| Échec de génération non bloquant | Le contrat est créé quand même | Un contrat perdu coûte plus cher qu'un calendrier à relancer |
