# 008 — Planning de la semaine

> Lot **L1.7** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.6** · **imbrications constatées : L0.3** (utilisateurs et hachage), **L1.1** (appareils et immeubles affichés sur la carte d'OT).
>
> **Parcours de référence** : « tout se fait depuis le planning » (`../02-produit/07-principes-ux.md`, règles 1 et 5).
> **Cible chiffrée** : affecter un OT tient en **un geste**, et ce geste existe **au clavier comme à la souris**.

## Contexte

Un OT existe depuis L1.6, mais **personne ne le fait**. Il naît `new`, sans technicien ni date, et rien dans le produit ne permet de l'attribuer. Le planning est la pièce qui transforme une liste d'incidents en travail réparti — et c'est, selon les principes UX, l'écran d'accueil du dispatcher, pas un module de plus :

> « Tout se fait depuis le planning : créer, déplacer, réassigner un OT sans changer d'écran. Le planning est la page d'accueil, pas un module. »

Ce lot débloque aussi toute la Phase 2 : la tournée du jour de L2.1 n'est rien d'autre que la lecture, côté mobile, de ce que le dispatcher a posé ici.

## Le trou du découpage : personne ne crée d'utilisateurs

**Aucun lot du découpage ne crée d'utilisateurs.** La collection `users` existe depuis L0.3 — port, deux adaptateurs, suite de contrat — mais sans API ni écran : le seul compte du système est le dispatcher du seed. Or ce lot demande une vue « par technicien », et L2.1 fait *se connecter* un technicien sur son mobile.

Le lot absorbe donc une **gestion minimale des utilisateurs** — lister, créer, désactiver. Arbitré avec le porteur du produit avant rédaction : c'est le plus petit ajout qui rende L1.7 démontrable et L2.1 possible, et il réutilise la collection et le hachage déjà en place.

## Périmètre

| | Contenu | Justification | Statut |
|---|---|---|---|
| **Cœur** | Vue semaine par technicien, drag & drop d'OT, affectation persistée | Le découpage L1.7 | Retenu |
| **A** | Utilisateurs : lister, créer un technicien, désactiver | Sans lui, le planning n'a qu'une colonne et L2.1 est bloqué | Retenu |
| **B** | Backlog des OT non planifiés, à gauche du planning | Une grille sans réservoir n'a rien à déplacer | Retenu |
| **C** | Déplacement **au clavier** (règle UX 5) | « Un dispatcher vit dans l'outil 8 h/jour » | Retenu |
| **D** | Le planning devient la page d'accueil | Règle UX 1, littéralement | Retenu |

**Conséquence assumée** : le lot est gros. Si l'exécution montre qu'il ne tient pas, la coupe se fait sur **D** (le planning reste à `/planning`, l'accueil ne bouge pas) — un changement de route ne coûte rien à reprendre. A, B et C sont indissociables du cœur.

## Modèle

### Utilisateur — deux champs ajoutés

`User` porte aujourd'hui `id`, `tenantId`, `email`, `role`. Le planning en exige deux de plus :

| Champ | Type | Règle |
|---|---|---|
| `name` | string non vide | Nom affiché en tête de colonne. Un email n'est pas un nom de technicien |
| `active` | booléen | `false` = compte désactivé : ne peut plus se connecter, ne reçoit plus d'affectation |

`passwordHash` reste hors du domaine : l'authentification est affaire d'adaptateur, comme depuis L0.3.

> **Lecture tolérante** (le volume `data/` survit aux déploiements — `../03-application/decisions/002-deploiement-docker.md`) : ces deux champs arrivent sur une collection déjà écrite. Le schéma de persistance leur donne un défaut — `name` vaut `« Sans nom »`, visiblement provisoire, et `active` vaut `true` — et `legacy-records.test.ts` fige la garantie.

### Ordre de travail — deux champs ajoutés

Annoncés par la spec 007 comme arrivant ici :

| Champ | Type | Règle |
|---|---|---|
| `assignee` | Id \| `null` | Utilisateur **actif** du tenant à qui l'OT est confié |
| `scheduledOn` | jour ISO \| `null` | Jour d'intervention prévu |

Et un statut de plus : **`assigned`**, entre `new` et `in_progress`.

> **`scheduledOn` et non `scheduledAt`** : le modèle de données annonce `scheduled_at`. Le champ retenu est un **jour calendaire**, pas un instant — voir R3.1 — et la convention du code réserve le suffixe `At` aux horodatages (`reportedAt`) et `On` aux jours (`completedOn`). Le nom dit donc la vérité du champ. Écart consigné plus bas.

## Règles métier

### R1 — Utilisateurs : le strict nécessaire

1. **Lister** les utilisateurs du tenant, actifs et désactivés, avec nom, email, rôle et état.
2. **Créer** un utilisateur : email, nom, rôle, mot de passe initial. Créé actif.
3. **Désactiver** et **réactiver** un utilisateur. Il n'y a **pas de suppression** : un utilisateur est référencé par des OT passés, et un planning d'il y a trois mois doit rester lisible.
4. Le mot de passe initial est **choisi par l'administrateur et transmis hors de l'outil**. Aucun envoi d'e-mail, aucun lien d'invitation, aucune obligation de changement à la première connexion — tout cela demande un service d'e-mail que la Phase 0 n'a pas.
5. Longueur minimale du mot de passe : **12 caractères**. Aucune autre règle de composition (recommandation ANSSI : la longueur, pas les symboles obligatoires).
6. Le mot de passe n'est **jamais rendu** par l'API, ni en clair ni haché, sur aucune réponse.
7. L'email est **unique dans le tenant**, insensible à la casse. Un doublon est refusé (`409`).
8. **On ne peut pas se désactiver soi-même** : c'est la seule façon de se verrouiller dehors sans recours en Phase 0.
9. Un utilisateur désactivé qui tente de se connecter reçoit **exactement la même erreur** qu'un mot de passe faux. Rien ne doit permettre d'énumérer les comptes, ni de distinguer « compte désactivé » de « compte inexistant ».
10. **Pas de contrôle de rôle sur ces endpoints** : tout utilisateur authentifié du tenant peut gérer les utilisateurs. Voir la note ci-dessous — c'est un écart assumé, pas un oubli.

> **Sur l'absence de contrôle des rôles.** Le rôle est déclaratif dans tout le produit depuis L0.4 : rien n'empêche aujourd'hui un `accountant` de supprimer un immeuble. Ajouter un garde-fou sur les seuls utilisateurs donnerait l'illusion d'un contrôle d'accès sans en installer un. **Aucun lot du découpage ne porte les autorisations par rôle** — c'est un manque de la planification, pas de ce lot, et il est remonté dans `../02-produit/09-decisions-metier-en-attente.md`.

### R2 — Affecter, c'est un seul geste

1. Un OT est soit **planifié** — `assignee` *et* `scheduledOn` renseignés — soit **non planifié** — les deux à `null`. **Il n'y a pas d'état intermédiaire.**
2. Un technicien sans date serait du travail sans échéance ; une date sans technicien serait du travail que personne ne voit. Les deux disparaîtraient du planning : la règle existe pour qu'aucun OT ne se perde entre deux cases.
3. L'API expose donc **une** opération, `PATCH /work-orders/:id/assignment`, qui reçoit les deux ensemble ou les deux à `null`. Une combinaison mixte est refusée (`422`).
4. Cette opération est **le geste du drag & drop** : déposer une carte dans une case, c'est fixer un technicien et un jour d'un coup.
5. Retirer un OT du planning — le renvoyer au backlog — est la même opération avec les deux champs à `null`.

### R3 — Le jour, pas l'heure

1. `scheduledOn` est un **jour calendaire**, sans heure ni durée. Un dispatcher d'ascensoriste répartit une journée entre techniciens ; c'est le technicien qui ordonne sa tournée sur le terrain.
2. Des créneaux horaires exigeraient une durée par type d'OT, un temps de trajet et une détection de conflit — c'est-à-dire l'optimisation de tournées, explicitement rangée en P2 par `../02-produit/02-features-mvp.md`.
3. Conforme à la règle des jours de la spec 001, R6 : ce qui se calcule en échéances se compte en jours.
4. Un jour **passé** est acceptable : on replanifie une intervention ratée sur hier pour tenir la trace. Aucune borne temporelle n'est imposée.

### R4 — Statuts : `assigned` est une conséquence, jamais un choix

1. Le cycle devient : `new` → `assigned` → `in_progress` → `done`, `cancelled` restant atteignable depuis les trois premiers.
2. **Affecter un OT `new` le fait passer `assigned`.** **Le renvoyer au backlog le fait repasser `new`.** Le client ne demande jamais ces deux transitions : elles sont l'effet de l'affectation.
3. L'invariant qui en découle, vérifié dans le domaine et testé : `status === "assigned"` **si et seulement si** l'OT est planifié au sens de R2.1 et n'a pas commencé.
4. Un OT `in_progress` **ne peut pas être désaffecté** : le travail a commencé, retirer le technicien effacerait qui l'a fait. Il peut en revanche être **réaffecté** — un technicien tombe malade en cours de journée — et changer de jour.
5. Un OT `done` ou `cancelled` garde son affectation, figée comme le reste : c'est la trace de qui a fait quoi.
6. Une transition interdite reste refusée en `422` avec le statut courant et les transitions possibles, comme en L1.6.

### R5 — La grille

1. La vue montre **une semaine**, du lundi au dimanche. Le week-end est affiché comme les autres jours : une désincarcération n'attend pas lundi.
2. **Une ligne par utilisateur actif**, quel que soit son rôle — voir le tableau des choix. Une colonne par jour. Chaque case contient les OT planifiés pour ce couple (utilisateur, jour).
3. Un utilisateur **désactivé** apparaît quand même **s'il porte des OT dans la semaine affichée**, signalé comme désactivé. Même principe qu'au tableau de conformité de L1.5 : **rien ne disparaît en silence**. Ses OT doivent être vus pour être redistribués.
4. Dans une case, les OT sont ordonnés par **criticité décroissante** puis par ancienneté de signalement. Une désincarcération est en tête, toujours.
5. La semaine affichée est **dans l'URL**. Un planning se partage par lien, et l'état survit à un rechargement — « reprendre où on en était » (règle UX 3).
6. Navigation : semaine précédente, semaine suivante, retour à la semaine courante.

### R6 — Le backlog

1. À gauche de la grille, les **OT non planifiés et ouverts**, du plus critique au plus ancien — le même ordre qu'en R5.4. Ce sont les `new`, et aussi les `in_progress` sans technicien : un OT démarré sans passer par le planning n'apparaîtrait nulle part ailleurs.
2. C'est la réserve de travail : le dispatcher y puise pour remplir la semaine.
3. Un OT créé en L1.6 y arrive **automatiquement**, sans action : c'est ce qui relie les deux lots.
4. Le backlog ne dépend pas de la semaine affichée : un OT non planifié n'a pas de date, il est visible depuis n'importe quelle semaine.

### R7 — Déplacer : souris **et** clavier

1. Le déplacement se fait à la souris par glisser-déposer, **et au clavier** : prendre la carte, la déplacer de case en case avec les flèches, déposer, ou annuler.
2. Le clavier n'est pas une option d'accessibilité ajoutée après coup, c'est la règle UX 5 — le dispatcher passe sa journée dans l'outil et une main sur le téléphone.
3. Chaque étape est **annoncée aux lecteurs d'écran** : ce qui est saisi, où ça se déplace, où ça se dépose.
4. Le déplacement est **optimiste** : la carte est dans sa nouvelle case immédiatement. En cas de refus du serveur, elle revient à sa place avec un message. Un planning qui clignote à chaque geste est inutilisable.
5. **Aucune modale de confirmation** : le déplacement est réversible, donc pas de modale (règle UX transverse).

### R8 — Contrôles de cohérence

1. `assignee` doit désigner un utilisateur **existant, actif, du tenant**. Inconnu, inactif ou d'un autre tenant → `400`.
2. Un utilisateur d'un autre tenant est traité **exactement comme un identifiant inconnu** : aucune réponse ne doit révéler qu'il existe ailleurs.
3. Un OT d'un autre tenant répond `404`, comme partout (ADR-001).
4. Rien n'interdit d'empiler dix OT sur un technicien le même jour. Une charge maximale par jour serait une règle inventée ; le dispatcher voit la pile et décide.

## Critères d'acceptation

- [ ] Les transitions incluant `assigned` et l'invariant de R4.3 sont des **fonctions pures de `packages/domain`**, testées sur toutes les paires de statuts et sur les combinaisons mixtes de R2.3.
- [ ] Le calcul des jours d'une semaine et l'ordre du backlog (R5.4) sont purs et testés, **changement d'heure et passage d'année compris**.
- [ ] `UserRepository` gagne `findAll` ; sa **suite de contrat** couvre les deux nouveaux champs, l'unicité d'email insensible à la casse et l'isolation des tenants, et tourne **contre les deux adaptateurs**.
- [ ] Défauts de persistance en place pour `name`, `active`, `assignee`, `scheduledOn`, et **un cas par champ dans `legacy-records.test.ts`**.
- [ ] R1 couverte côté API : création, doublon d'email refusé, mot de passe jamais rendu, auto-désactivation refusée, connexion d'un compte désactivé refusée avec le message générique.
- [ ] R2, R4 et R8 couvertes : affectation mixte refusée, utilisateur inactif refusé, désaffectation d'un OT commencé refusée, statut recalculé dans les deux sens.
- [ ] Back-office : planning semaine, backlog, navigation de semaine dans l'URL, écran utilisateurs — **shadcn/ui uniquement**, hors dnd-kit (voir les choix).
- [ ] **E2E Playwright** : créer un technicien, déplacer un OT du backlog vers sa case **au clavier**, recharger la page et vérifier que l'affectation a tenu.
- [ ] **Régression L1.6** : saisie de panne, rattachement de doublon et fiche d'OT restent verts, ainsi que le reste de la suite.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

Daté, pas oublié :

- **Génération automatique des visites périodiques dans le planning** → **L1.8**, la suite immédiate.
- **Suggestion du technicien le plus proche ou le plus disponible** → P1 (`02-features-mvp.md`), demande une géolocalisation et une notion de charge.
- **Créneaux horaires, durées, détection de conflit, optimisation de tournées** → P2, voir R3.2.
- **Vue mois**, vue jour, vue « carte » → P1. La semaine est la maille de travail du dispatcher.
- **Compétences, habilitations, zones géographiques d'un technicien** → aucune n'est décrite dans les docs ; à instruire avec un design partner.
- **Congés, absences, astreintes** → P1, listé en P2 dans `02-features-mvp.md` pour les astreintes.
- **Autorisations par rôle** → manquant du découpage, remonté dans le registre des décisions.
- **Invitation par e-mail, réinitialisation de mot de passe, changement à la première connexion** → demandent un service d'e-mail, absent de la Phase 0. Voir R1.4.
- **Notification au technicien d'un OT affecté** → **L3.5**, explicitement.
- **Tournée du jour côté mobile** → **L2.1**, qui lira ce que ce lot écrit.
- **Création d'un OT depuis le planning** (règle UX 1, « créer sans changer d'écran ») → la saisie rapide de L1.6 existe et le backlog l'alimente. Le raccourci depuis une case est un confort, pas un manque.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Le planning affiche **tous** les utilisateurs actifs, pas seulement les `technician` | Toutes lignes | Dans une PME, le patron et le dispatcher interviennent. Filtrer par rôle inventerait une règle que rien ne décrit, et rendrait un collègue non affectable |
| `scheduledOn` (jour) et non `scheduled_at` (instant) | Jour calendaire | Voir R3 : le nom dit la vérité du champ, et la convention `On`/`At` du code distingue déjà jours et horodatages. Écart avec `03-modele-donnees.md` |
| `assigned` est un statut réel, pas un état déduit | Statut réel, mais **jamais choisi par le client** | La fiche et les filtres affichent un statut ; « Nouveau » sur un OT planifié jeudi est faux. L'invariant de R4.3 empêche la contradiction que crée d'ordinaire un état redondant |
| Planifié = les deux champs, ou aucun | Pas d'état mixte | Voir R2.2. Le prix : « une date sans technicien » est impossible. L'échappatoire, si le besoin apparaît, est une ligne « à affecter » par jour — P1 |
| Semaine du lundi au dimanche | 7 jours | Convention française ; le week-end reste visible parce que les pannes n'attendent pas |
| Pas de charge maximale par jour | Aucune limite | R8.4 : une limite serait un chiffre inventé |
| Mot de passe initial choisi par l'admin | Transmis hors outil | Pas de service d'e-mail en Phase 0 (R1.4) |
| Longueur minimale 12 caractères, sans autre règle | 12 | Recommandation ANSSI. Aucune contrainte de composition : elles produisent des mots de passe pires |
| Pas de contrôle de rôle sur les endpoints utilisateurs | Aucun | Voir la note de R1.10 : le contrôle d'accès n'existe nulle part dans le produit, aucun lot ne le porte |
| **dnd-kit**, première dépendance UI du projet | Dépendance retenue | La convention dit « shadcn/ui par défaut, zéro custom tant qu'un défaut suffit ». Ici aucun défaut ne suffit : le glisser-déposer natif du navigateur **ne donne rien au clavier**, et la règle UX 5 l'exige. L'écrire à la main produirait bien plus de code custom que la règle ne cherche à en éviter |
| Le planning remplace le parc en page d'accueil | `/` = planning, le parc passe à `/parc` | Règle UX 1, littéralement. Coupable en dernier recours (périmètre, ligne D) |
