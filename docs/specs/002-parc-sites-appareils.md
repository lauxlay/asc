# 002 — Parc : sites et appareils

> Lot **L1.1** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.

## Contexte

Le parc est la fondation de tout le produit : sans immeubles ni appareils, il n'y a ni contrat (L1.4), ni échéance de conformité (L1.5), ni ordre de travail (L1.6). C'est le premier écran qu'un design partner ouvre, et le premier qu'il faut reprendre d'un export Progilift (L3.6).

Persona : le **dispatcher** de la PME ascensoriste (`../02-produit/01-pain-points-opportunites.md`). Son pain point ici est la recherche : chez Progilift, retrouver un appareil suppose de connaître le code interne de l'immeuble. Le dispatcher, lui, raisonne par **adresse** — le gardien qui appelle dit « le 12 rue des Lilas », jamais « le site S-0483 ».

Jusqu'ici (lot L0.4), `unit.siteId` est une **chaîne libre** : rien ne garantit qu'elle désigne quoi que ce soit. Ce lot lui donne une entité en face.

## Modèle

Deux entités, glossaire figé par `../03-application/03-modele-donnees.md` (`immeuble/site` = `site`, `appareil` = `unit`) :

```
site (immeuble)  ──<  unit (appareil)
```

### `site`

| Champ | Type | Règle |
|---|---|---|
| `id` | UUID applicatif | Généré par le serveur (ADR-001) |
| `tenantId` | Id | Vient du jeton, jamais du client |
| `name` | string non vide | Nom d'usage : « Résidence Les Tilleuls » |
| `addressLine` | string non vide | Numéro et voie |
| `postalCode` | string non vide | Non validé au format français : voir les choix en fin de spec |
| `city` | string non vide | |

### `unit`

Les champs existants (`commissionedOn`, `lastStatutoryInspectionOn`) sont inchangés. Deux évolutions :

- `siteId` devient une **référence vérifiée** vers un `site` du même tenant (R1) ;
- ajout de `reference` (string non vide) : le repère de l'appareil **dans son immeuble** — « Ascenseur A », « Cage B ». Un immeuble porte couramment plusieurs appareils ; sans ce repère, ni le dispatcher ni le technicien ne peuvent les distinguer.

## Règles métier

### R1 — Rattachement d'un appareil à un site

1. Créer ou modifier un appareil avec un `siteId` qui ne désigne **aucun site du tenant** est refusé (`400`). Un appareil orphelin n'a pas de sens : il porte des obligations réglementaires qui pèsent sur un immeuble.
2. Un `siteId` qui désigne un site d'un **autre tenant** est traité exactement comme un identifiant inconnu — même code, même message. Un écart de comportement révélerait l'existence de la donnée d'autrui.
3. `reference` est libre et **n'est pas unique** : un doublon de saisie est un problème de qualité de données, pas une erreur système, et une PME reprenant un parc existant a le droit de saisir ce qu'elle a.

### R2 — Recherche de sites par adresse

1. `GET /sites?q=` filtre sur `name`, `addressLine`, `postalCode` et `city`, réunis. Le dispatcher tape ce qu'il entend, sans savoir dans quel champ ça tombe.
2. Correspondance par **sous-chaîne**, insensible à la **casse** et aux **accents** : `eglise` trouve « Église », `LILAS` trouve « Lilas ». Un dispatcher au téléphone ne compose pas d'accents.
3. Les espaces en trop sont ignorés, en début, en fin et à l'intérieur : `12   rue` trouve « 12 rue ».
4. Une requête vide, absente ou réduite à des espaces rend **tout le parc** — pas une liste vide.
5. Sans correspondance, la liste est vide : ce n'est pas une erreur.
6. La recherche ne franchit jamais la frontière du tenant.

### R3 — Suppression d'un site

1. Supprimer un site qui porte **au moins un appareil** est refusé (`409`). La suppression en cascade détruirait des appareils portant un historique de conformité — dans un produit à valeur probante, la donnée ne disparaît pas par effet de bord.
2. Un site sans appareil se supprime normalement (`204`).
3. Le décompte des appareils bloquants est fait **dans le tenant du demandeur** uniquement.

### R4 — Isolation multi-tenant (ADR-001)

Identique aux appareils (lot L0.4) : lire, modifier ou supprimer un site d'un autre tenant répond `404`, et les listes ne se mélangent jamais. Deux tenants peuvent porter le même identifiant de site.

### R5 — Ordre

`GET /sites` et `GET /units` rendent l'**ordre d'insertion**, comme les appareils depuis L0.3. Aucun tri métier n'est arrêté à ce stade ; la recherche préserve cet ordre.

## Critères d'acceptation

- [ ] `site` a son port, son adaptateur JSON, son adaptateur mémoire et **une suite de tests de contrat** exécutée contre les deux (`apps/api/CLAUDE.md`).
- [ ] Le prédicat de recherche (R2) est une **fonction pure de `packages/domain`**, testée casse / accents / espaces / requête vide, sans I/O.
- [ ] CRUD complet des sites via l'API, `tenantId` issu du jeton, UUID applicatifs.
- [ ] R1 couverte : `siteId` inconnu et `siteId` d'un autre tenant refusés à la création **et** à la modification.
- [ ] R3 couverte : site occupé non supprimable, site vide supprimable.
- [ ] `GET /units?siteId=` liste les appareils d'un site.
- [ ] Back-office : liste des sites avec recherche, création de site, fiche site avec ses appareils et ajout d'appareil — composants shadcn/ui uniquement.
- [ ] E2E Playwright : créer un site, y ajouter un appareil, le retrouver par recherche d'adresse.
- [ ] Suite e2e cumulative complète verte (L0.5 + L1.1) et `pnpm check` vert.

## Hors scope

- **Client / syndic rattaché au site** (`customer`, `contact`) → **L1.2**. Le site n'a volontairement pas de `customerId` tant que l'entité n'existe pas.
- **Import CSV du parc** → **L1.3**. Ce lot ne saisit qu'à la main.
- **Contrats et échéances affichées sur la fiche** → **L1.4 / L1.5**. Le moteur de L0.2 n'est pas branché ici.
- **Recherche globale Cmd+K** (appareils, clients, OT) → **L1.9**. Ici la recherche est locale à l'écran des sites.
- **Documents, QR code, photos d'appareil** → non planifiés en Phase 1.
- **Géocodage, normalisation postale, autocomplétion d'adresse** : aucune dépendance externe dans ce lot.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Champs d'adresse | `addressLine` + `postalCode` + `city`, tous obligatoires | Le minimum pour identifier un immeuble et le retrouver. Pas de pays (marché français), pas de complément de voie tant qu'un cas réel ne l'exige pas |
| `postalCode` non contraint à 5 chiffres | Chaîne non vide | Une reprise de parc existant contient des saisies imparfaites ; bloquer l'import (L1.3) sur un code postal mal saisi coûterait plus que ça ne rapporte |
| Ajout de `unit.reference` | Champ obligatoire | Un immeuble a souvent plusieurs appareils ; sans repère, l'écran de parc et la tournée du technicien (L2.1) sont inutilisables. Touche L0.2/L0.3/L0.4 (entité `Unit`) — imbrication à vérifier en review |
| `siteId` inconnu → `400`, pas `404` | `400` | La ressource visée par l'URL (`/units`) existe ; c'est le **corps** qui est invalide. `404` désignerait l'appareil |
| Site occupé → `409`, pas de cascade | `409` | Voir R3.1 : produit à valeur probante, pas de destruction implicite |
| Filtrage de la recherche dans le service, pas dans le port | Le port garde `findAll` | ADR-001 rend le port ré-implémentable en SQL ; ajouter `search()` maintenant serait une abstraction spéculative (règle 7 de `../03-application/07-phase0-fondations.md`). Le volume Phase 0 (un parc de PME) tient en mémoire. À déplacer dans le port le jour où le stockage sait filtrer |
| Pas de soft delete | Suppression réelle | `03-modele-donnees.md` prévoit du soft delete « partout sauf logbook », mais rien ne le consomme encore. À introduire avec le premier besoin réel (restauration, audit) |
