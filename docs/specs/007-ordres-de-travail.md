# 007 — Ordres de travail

> Lot **L1.6** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.1** · **imbrication constatée : L1.2** (le contact d'immeuble alimente le 4ᵉ champ).
>
> **Parcours de référence** : « saisir une panne entrante » (`../02-produit/07-principes-ux.md`, règle 2).
> **Cible chiffrée : < 30 s, ≤ 4 champs obligatoires.**
> **Sources de conception** : `../02-produit/07-principes-ux.md` et `../02-produit/10-benchmark-saisie-incident.md`.

## Contexte

L'ordre de travail est l'unité de production de l'ascensoriste : tout ce que fait un technicien est un OT. Sans lui, pas de planning (L1.7), pas de tournée mobile (L2.1), pas de rapport ni de carnet (L2.6).

Ce lot construit la saisie **manuelle**, autour du moment le plus tendu du métier : **le téléphone sonne, quelqu'un est bloqué dans une cabine**. Le dispatcher est interrompu quarante fois par jour ; s'il doit réfléchir à l'outil au lieu d'écouter son interlocuteur, l'outil a échoué.

## Ce que le benchmark a changé dans cette spec

`10-benchmark-saisie-incident.md` confirme les fondamentaux — recherche par adresse, listes guidées, ≤ 4 champs — et son verdict est net :

> « Les deux vrais manques sont des **raccourcis de sortie** plutôt que des champs. […] La meilleure saisie est celle qui n'a pas lieu. »

Une panne réelle, c'est **un gardien + trois résidents + un gestionnaire qui signalent la même chose en deux heures**. Un formulaire, même parfait à 3 champs, fait saisir cinq fois le même incident. D'où la règle qui structure désormais tout l'écran : **on montre l'état de l'appareil avant de proposer un formulaire** (R2).

Trois apports du benchmark entrent dans ce lot ; les autres sont datés en hors scope.

## Périmètre — arbitré et complet

Le lot dépasse la ligne du découpage (« OT : création manuelle, statuts, fiche »). C'est délibéré et validé : les trois apports du benchmark sont marqués MVP par ce document, et deux d'entre eux ne sont pas des champs mais des **raccourcis** — les couper reviendrait à livrer un formulaire correct pour un métier qui n'en veut pas.

| | Contenu | Justification | Statut |
|---|---|---|---|
| **Cœur** | Entité, statuts, numérotation, CRUD, liste, fiche, saisie rapide | Le découpage L1.6 | Retenu |
| **A** | Détection de doublon + « rattacher ce signalement » | Benchmark §4, **MVP** — « c'est ce qui rend < 30 s tenable en vrai » | Retenu |
| **B** | 4ᵉ champ « contact sur place », pré-rempli depuis le contact de l'immeuble | Benchmark §7, **MVP** — 20 min perdues par intervention quand l'info manque | Retenu |
| **C** | Mode P0 scripté : 3 questions fermées, zéro texte, horodatage | Benchmark §5, **MVP (léger)** | Retenu |
| **D** | Chaînage d'OT (`followUpOf`) | Permet de « rouvrir » sans rouvrir (R5) | Retenu |

**Conséquence assumée** : L1.6 est le plus gros lot de la Phase 1 à ce jour. Si l'exécution montre qu'il ne tient pas, la coupe se fait sur **C** — la saisie P0 redevient alors un OT `entrapment` ordinaire, sans script ni questions fermées, et le reste du lot n'en dépend pas. A, B et D sont imbriqués dans le cœur et ne se coupent pas proprement.

## Modèle

Entité `work_order`, glossaire figé par `../03-application/03-modele-donnees.md` :

| Champ | Type | Règle |
|---|---|---|
| `id`, `tenantId` | | Comme les autres entités |
| `reference` | string | `OT-2026-00042` — voir R6 |
| `type` | `visit` \| `breakdown` \| `repair` | Visite / panne / réparation |
| `status` | `new` \| `in_progress` \| `done` \| `cancelled` | Voir R4 |
| `priority` | `entrapment` \| `urgent` \| `normal` | `entrapment` = personne bloquée = P0 |
| `unitId` | Id | Appareil concerné, vérifié |
| `summary` | string non vide | Ce que dit l'appelant, en une ligne |
| `onSiteContact` | string \| `null` | Contact sur place et consigne d'accès (apport B) |
| `followUpOf` | Id \| `null` | OT dont celui-ci prend la suite (R5) |
| `reportCount` | entier ≥ 1 | Nombre de signalements rattachés (apport A) |
| `reportedAt` | horodatage ISO | Instant du **premier** signalement |
| `lastReportedAt` | horodatage ISO | Instant du **dernier** signalement rattaché |
| `entrapment` | objet \| `null` | Réponses du script P0 (apport C) — voir ci-dessous |

Détail de `entrapment`, renseigné uniquement quand la criticité vaut `entrapment`, et dont **chaque réponse est indépendamment facultative** :

| Champ | Type | Question posée |
|---|---|---|
| `medicalEmergency` | booléen \| `null` | Urgence médicale ? |
| `peopleCount` | entier ≥ 0 \| `null` | Combien de personnes dans la cabine ? |
| `betweenFloors` | booléen \| `null` | Cabine bloquée entre deux étages ? |

`null` signifie **« pas encore demandé »**, et se distingue de `false` qui signifie « demandé, la réponse est non ». La différence compte : un dispatcher qui n'a pas eu le temps de poser la question ne doit pas apparaître comme ayant constaté l'absence d'urgence médicale.

> **Instants et non jours** : `reportedAt` est un horodatage, pas un jour calendaire. Ce n'est pas une entorse à la spec 001, R6 : cette règle concerne le **calcul d'échéances**, qui reste en jours. Un délai de désincarcération se mesure en minutes, et le benchmark en fait un argument commercial (« 37 minutes en moyenne » chez WeMaintain) — ce chiffre n'existe que si le départ est horodaté proprement.

## Règles métier

### R1 — Saisie minimale

1. Créer un OT exige **au plus 4 champs**, dont **3 obligatoires** : appareil, criticité, description. Le 4ᵉ, contact sur place, est facultatif et pré-rempli.
2. Chaque champ qui peut avoir une valeur par défaut en a une : type = `breakdown`, criticité = `normal`, contact sur place = **le contact de l'immeuble** s'il en existe un (L1.2). « L'utilisateur corrige l'exception, il ne saisit pas la règle. »
3. L'appareil se cherche **par adresse ou nom d'immeuble**, jamais par référence interne. C'est la recherche du lot L1.1 (spec 002, R2), et le benchmark confirme que c'est l'état de l'art : Otis lui-même fait choisir bâtiment → unité, jamais un numéro de série.
4. Aucune confirmation modale : la création est réversible (annulation), donc pas de modale (`07-principes-ux.md`).

### R2 — L'état de l'appareil avant le formulaire (apport A)

1. Dès que l'appareil est résolu, et **avant** de proposer la saisie, l'écran affiche ses **OT ouverts** (`new` ou `in_progress`) : référence, criticité, statut, ancienneté.
2. Si un OT ouvert existe, l'action principale devient **« Rattacher ce signalement »**, en un clic. Créer un nouvel OT reste possible, mais devient l'action secondaire.
3. Rattacher **n'ouvre aucun OT** : cela incrémente `reportCount` et met à jour `lastReportedAt` de l'OT existant.
4. `reportCount` est un **signal de pression** pour le dispatcher : cinq signalements en deux heures ne décrivent pas la même urgence qu'un seul.
5. Sans OT ouvert, l'écran passe directement au formulaire — le cas nominal ne paie pas le prix du cas répété.

> Le rattachement est **la** raison d'être de ce raccourci : sur un incident déjà connu, la saisie passe de 30 s à un clic, et le cinquième appelant reçoit une réponse au lieu d'un formulaire.

### R3 — Mode P0 scripté (apport C)

1. Quand la criticité vaut `entrapment`, le champ description est **remplacé** par trois questions fermées, reprises des protocoles de télésurveillance et des SOG pompiers : **urgence médicale ?**, **combien de personnes ?**, **cabine entre deux étages ?**
2. Ces trois réponses sont **facultatives**. Une personne est bloquée : l'OT doit exister *immédiatement*, les précisions arrivent pendant que la conversation continue. Bloquer l'enregistrement sur trois réponses irait contre l'objectif.
3. `reportedAt` est horodaté automatiquement, sans action de l'utilisateur.
4. Le nombre de champs obligatoires reste **≤ 4** : le script remplace la description, il ne s'y ajoute pas.

### R4 — Statuts et transitions

1. Cycle : `new` → `in_progress` → `done`. `cancelled` est atteignable depuis `new` et `in_progress`.
2. Un OT `done` ou `cancelled` est **terminal**. Rouvrir un OT clôturé effacerait la trace de ce qui s'est passé.
3. Une transition non autorisée est refusée (`422`), avec le statut courant et les transitions possibles dans le message.
4. Un OT naît toujours `new`. Le client ne choisit pas le statut initial.

### R5 — Chaînage des OT

1. Un OT peut déclarer prendre la suite d'un autre : `followUpOf`. C'est la réponse au besoin de « rouvrir » sans rouvrir.
2. Deux usages réels : une panne qui **revient** après une intervention clôturée, et une **réparation** qui fait suite au diagnostic d'un dépannage.
3. L'OT référencé doit exister dans le tenant. Inconnu → `400`.
4. Un OT ne peut pas se référencer lui-même, ni former un cycle. La chaîne se remonte donc toujours jusqu'à un OT d'origine.
5. La fiche affiche la chaîne dans les deux sens : « fait suite à OT-2026-00012 » et « suivi par OT-2026-00089 ».

> Rattacher (R2) et chaîner (R5) répondent à deux questions différentes : *le même incident signalé plusieurs fois* pour l'un, *un nouvel incident lié à un ancien* pour l'autre. Les confondre ferait perdre les deux informations.

### R6 — Numérotation

1. Format `OT-AAAA-NNNNN` : `OT-2026-00042`. Séquence **remise à zéro chaque année**, comme un numéro de facture française.
2. Choisi pour trois raisons : on **situe l'OT dans le temps** sans rien ouvrir, on classe et on retrouve par année, et le numéro reste **court à dicter au téléphone**. Cinq chiffres couvrent 99 999 OT par an, très au-delà d'une PME (≈ 13 500/an pour 1 500 appareils).
3. **Unique dans le tenant et jamais réutilisée**, même après suppression : on cite un numéro d'OT au téléphone et dans un rapport, il doit désigner une seule chose pour toujours. Des **trous** dans la séquence sont acceptables ; un doublon ne l'est pas.
4. L'année est celle du signalement, pas celle de la clôture.
5. Le client ne choisit jamais la référence.

### R7 — Rattachement à l'appareil

1. `unitId` référence un appareil **existant du tenant**. Inconnu → `400`.
2. Un appareil d'un **autre tenant** est traité exactement comme un identifiant inconnu.
3. Un appareil peut porter **plusieurs OT ouverts simultanément** : une panne pendant une réparation en cours est un cas réel. C'est précisément pourquoi R2 les montre tous.

### R8 — Isolation multi-tenant (ADR-001)

Lire, modifier ou supprimer l'OT d'un autre tenant répond `404`, aucune liste ne se mélange, et **la séquence de R6 est propre à chaque tenant**.

### R9 — Ordre et filtres

1. `GET /work-orders` rend les OT du **plus récent au plus ancien** — contrairement aux autres collections. Un dispatcher veut voir ce qui vient d'arriver.
2. Filtres : par statut, par type, par appareil, et **ouverts uniquement** (ce dont R2 a besoin).

## Critères d'acceptation

- [ ] Les transitions de statut (R4) et l'absence de cycle dans le chaînage (R5.4) sont des **fonctions pures de `packages/domain`**, testées sur toutes les paires de statuts et sur les cycles directs comme indirects.
- [ ] `work_order` a son port, son adaptateur JSON, son adaptateur mémoire et **une suite de tests de contrat** exécutée contre les deux (`apps/api/CLAUDE.md`).
- [ ] R6 couverte par la suite de contrat : séquences successives, jamais réutilisées après suppression, remise à zéro à l'année, propres au tenant.
- [ ] R7 couverte : appareil inconnu et appareil d'un autre tenant refusés.
- [ ] R2 couverte : les OT ouverts de l'appareil sont rendus avant la saisie ; rattacher incrémente `reportCount` **sans créer d'OT**.
- [ ] Back-office : saisie rapide, liste filtrable, fiche avec changement de statut et chaîne d'OT — shadcn/ui uniquement.
- [ ] **Au plus 4 champs, dont 3 obligatoires**, vérifié en comptant les champs du formulaire rendu (voir ci-dessous).
- [ ] Le contact sur place est **pré-rempli** depuis le contact de l'immeuble quand il en existe un.
- [ ] E2E Playwright : saisir une panne ; retomber sur l'OT existant au second signalement et le rattacher.
- [ ] **Régression L1.1 / L1.2** : parc, recherche d'adresse, import, clients et contacts restent verts.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Sur la « cible chronométrée »

Le découpage demande une « cible UX chronométrée dans le test ». **Le chronomètre n'est pas implémenté**, décision assumée : Playwright remplit un formulaire en une seconde, un tel chiffre mesurerait la vitesse de la machine, pas celle d'un humain au téléphone. Il donnerait une fausse garantie.

Ce qui est réellement vérifié :

- le **nombre de champs** (≤ 4, dont 3 obligatoires), compté sur le formulaire rendu — contrainte structurelle qui ne peut pas dériver sans faire échouer le test ;
- le **raccourci du cas répété** (R2), qui est ce qui fait vraiment tomber le temps de saisie en usage réel.

La cible de 30 s reste une cible d'observation utilisateur, à mesurer avec un design partner.

## Hors scope

Daté, pas oublié — les références renvoient au benchmark :

- **Criticité déduite du canal** et **« rattacher à la prochaine visite »** (benchmark §6) → **P1**. Le second demande un planning pour savoir à quelle visite rattacher : **L1.8**.
- **Suivi sans compte** pour le déclarant, lien de statut ou e-mail (benchmark §3) → **P1**, avec le portail.
- **Signalement par QR cabine** (benchmark §3) → **Phase 4**. L'entité est prête : un QR ne fera que pré-résoudre `unitId`.
- **CTI / identification à l'appel entrant** (benchmark §1) → **P2**. Le modèle contact→immeubles qu'il exige existe déjà depuis L1.2.
- **Affectation à un technicien, planification, suggestion du plus proche** → **L1.7 / L1.8**. Un OT créé ici est non affecté.
- **Génération automatique des visites périodiques** → **L1.8**.
- **Checklist, photos, signature, clôture terrain** → **L2.3 / L2.4**.
- **Rapport PDF et carnet d'entretien** → **L2.6**.
- **Cause de panne codifiée** → nomenclature non arrêtée, à instruire avec un design partner.
- **`offline_id`** (déduplication à la sync mobile) → **L2.5**.
- **Métrique de délai de désincarcération** → l'horodatage est capturé ici, le calcul et l'affichage viendront avec les tableaux de bord (**L3.x**).

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Statuts retenus | `new` / `in_progress` / `done` / `cancelled` | Le modèle annonce un `status` sans en fixer les valeurs. `assigned` arrivera avec le planning de L1.7 |
| Statuts terminaux définitifs | Pas de réouverture, mais chaînage (R5) | Un OT clôturé est une trace ; on en crée un nouveau qui le référence |
| `works` et `inspection` non implémentés | Trois types | Rien ne les produirait ni ne les lirait aujourd'hui (règle 7) |
| Rattachement = compteur, pas entité | `reportCount` + `lastReportedAt` | Une collection `signalement` avec auteur et canal n'a de sens qu'avec le QR et le portail (Phase 4). Deux champs suffisent à ce que le benchmark demande au MVP |
| Questions P0 facultatives | Facultatives | Voir R3.2 : une personne est bloquée, l'OT doit exister avant les précisions |
| `reportedAt` en horodatage | Instant | Voir la note du modèle : la règle des jours calendaires concerne le calcul d'échéances |
| Tri antéchronologique | Plus récent d'abord | Seule collection triée ainsi, et c'est délibéré (R9.1) |
| Pas d'`assignee` dans ce lot | Champ absent | Il arrive avec le planning qui le remplit (L1.7) ; vide, ce serait un champ mort |
