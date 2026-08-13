# 003 — Clients et contacts

> Lot **L1.2** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.1** — l'entité `Site` gagne un rattachement client.

## Contexte

Le lot L1.1 a donné au parc ses immeubles, mais un immeuble sans donneur d'ordre ne sert à rien : c'est le **syndic** qui signe le contrat (L1.4), reçoit la facture (L3.2) et consulte le portail (Phase 4). Et c'est le **gardien** qu'on appelle pour entrer dans la machinerie.

Persona : le dispatcher. Son pain point ici est PP2 (`../02-produit/01-pain-points-opportunites.md`) — le syndic n'a aucune visibilité, et côté ascensoriste l'information « qui est le client de cet immeuble, qui a les clés » vit dans des têtes et des fichiers Excel.

Ce lot ne construit ni contrat, ni facturation, ni portail : il pose l'entité client et le lien vers les immeubles dont tout le reste dépendra.

## Modèle

Le modèle figé par `../03-application/03-modele-donnees.md` place `contact` sous `customer`, et `site` sous `customer` :

```
customer ──< contact
    └────── < site (L1.1) ──< unit (L1.1)
```

### `customer`

| Champ | Type | Règle |
|---|---|---|
| `id` | UUID applicatif | Généré par le serveur (ADR-001) |
| `tenantId` | Id | Vient du jeton, jamais du client |
| `name` | string non vide | « Cabinet Dupont », « Copropriété Les Tilleuls » |
| `type` | `managing_agent` \| `condominium` \| `individual` | Syndic / copropriété / particulier |

### `contact`

| Champ | Type | Règle |
|---|---|---|
| `id`, `tenantId` | | Comme ci-dessus |
| `customerId` | Id | Référence vérifiée vers un `customer` du tenant |
| `siteId` | Id \| `null` | Contact rattaché à **un** immeuble précis — le gardien. `null` = contact du client en général |
| `name` | string non vide | |
| `role` | string non vide | Texte libre : « Gardien », « Gestionnaire », « Président du conseil syndical » |
| `email` | string \| `null` | |
| `phone` | string \| `null` | |

### `site` (modifié — imbrication L1.1)

Ajout de `customerId: Id | null`. **Nullable** : les immeubles créés en L1.1 n'ont pas de client, et un immeuble peut être saisi avant que son syndic ne soit connu. Forcer le lien casserait la saisie rapide du parc et l'import CSV (L1.3).

## Règles métier

### R1 — Rattachement d'un site à un client

1. `site.customerId` désigne un client **existant du tenant**, ou vaut `null`. Un identifiant inconnu est refusé (`400`), comme le `siteId` d'un appareil (spec 002, R1).
2. Un client d'un **autre tenant** est traité exactement comme un identifiant inconnu — même code, même message.
3. Le rattachement se **modifie et se retire** librement (`customerId: null`) : un immeuble change de syndic, c'est le cas courant du métier, pas une exception.
4. Un client porte **autant d'immeubles que voulu** ; c'est le cas normal d'un syndic.

### R2 — Rattachement d'un contact

1. `contact.customerId` désigne un client existant du tenant. Inconnu → `400`.
2. Si `contact.siteId` est renseigné, l'immeuble doit exister dans le tenant **et être rattaché à ce même client** (`site.customerId === contact.customerId`). Sinon → `400`. Déclarer le gardien d'un immeuble qui appartient à un autre syndic n'a pas de sens et ferait fuir de l'information entre clients.
3. `role` est un **texte libre**, pas une énumération : les organisations réelles inventent des intitulés que nous ne devinerons pas.
4. `email` et `phone` sont facultatifs, mais un contact sans aucun des deux est accepté : on saisit parfois un nom avant d'avoir les coordonnées.

### R3 — Suppression d'un client

1. Supprimer un client encore rattaché à **au moins un immeuble** est refusé (`409`), comme un site encore équipé (spec 002, R3).
2. Supprimer un client portant **au moins un contact** est également refusé (`409`) : pas de destruction implicite en cascade, cohérent avec R3.1.
3. Un client sans immeuble ni contact se supprime normalement (`204`).

### R4 — Suppression d'un site (imbrication L1.1)

La règle de la spec 002 est **étendue** : un site portant des contacts (le gardien) ne se supprime pas non plus tant que ces contacts existent. La règle « un immeuble encore équipé n'est pas supprimable » reste inchangée.

### R5 — Isolation multi-tenant (ADR-001)

Identique aux lots précédents : lire, modifier ou supprimer une ressource d'un autre tenant répond `404`, et aucune liste ne se mélange.

### R6 — Ordre

`GET /customers` et `GET /contacts` rendent l'**ordre d'insertion**, comme les sites et les appareils. Aucun tri métier n'est arrêté à ce stade.

## Critères d'acceptation

- [ ] `customer` et `contact` ont chacun leur port, adaptateur JSON, adaptateur mémoire et **suite de tests de contrat** exécutée contre les deux (`apps/api/CLAUDE.md`).
- [ ] CRUD complet des deux ressources, `tenantId` issu du jeton, UUID applicatifs.
- [ ] R1 couverte : `customerId` inconnu et `customerId` d'un autre tenant refusés ; détachement possible.
- [ ] R2.2 couverte : contact pointant un immeuble d'un autre client refusé.
- [ ] R3 et R4 couvertes : refus de suppression, et suppression possible une fois les rattachements retirés.
- [ ] `GET /sites?customerId=` et `GET /contacts?customerId=` filtrent.
- [ ] Back-office : liste des clients, création, fiche client avec ses immeubles rattachés et ses contacts — shadcn/ui uniquement.
- [ ] E2E Playwright : créer un client, y rattacher **2** immeubles.
- [ ] **Régression L1.1** : la recherche d'adresse, la création de site et l'ajout d'appareil restent verts.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

- **Contrats liés au client** → **L1.4**. Le client ne porte aucune échéance ici.
- **Facturation, adresse de facturation, SIRET, TVA** → **L3.2 / L3.3** (`../02-produit/08-facturation-electronique.md`). Le modèle Factur-X exigera des champs que rien ne consomme aujourd'hui.
- **Accès portail du client** (`portal_access`) → **Phase 4**. Un `contact` n'est pas un compte connectable.
- **Import CSV des clients** → **L1.3**.
- **Recherche globale des clients (Cmd+K)** → **L1.9**. Ici la liste n'a pas de recherche : le nombre de clients d'une PME tient sur un écran, contrairement au parc.
- **Notifications au syndic** → **L3.5**.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| `contact.siteId` optionnel | Ajouté | Le lot nomme explicitement le « gardien », qui est le contact d'**un immeuble**, pas d'un syndic gérant 40 immeubles. Le modèle figé ne rattache le contact qu'au client ; ce champ nullable couvre les deux cas sans le contredire. **Choix à valider** : si le contact doit vivre sous le site, c'est le modèle de données qu'il faut amender |
| `customer.type` en anglais | `managing_agent` / `condominium` / `individual` | Convention « code en anglais ». `managing_agent` est la traduction métier de *syndic* ; le glossaire FR→EN ne tranchait que le nom de l'entité |
| `role` du contact en texte libre | Chaîne | Une énumération figée serait fausse dès le premier client réel. À transformer en énumération le jour où une feature en dépend (notifications ciblées, L3.5) |
| `site.customerId` nullable | Nullable | Les sites de L1.1 existent déjà sans client, et l'import CSV (L1.3) doit pouvoir charger un parc avant les clients |
| Suppression d'un client à contacts → `409` | Refus | Cohérence avec la spec 002 R3 : dans un produit à valeur probante, rien ne disparaît par effet de bord |
| Pas de recherche sur les clients | Liste simple | Un parc se compte en centaines d'immeubles, un portefeuille client en dizaines. La recherche globale de L1.9 couvrira le besoin |
| Un seul client par immeuble | `customerId` scalaire | Le multi-mandat (syndic + copropriété sur le même immeuble) n'est pas un cas connu du backlog ; une table de liaison serait spéculative (règle 7) |
