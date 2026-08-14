# 010 — Recherche globale au clavier

> Lot **L1.9** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.1, L1.2, L1.6** · **constatée : L1.4** (les contrats sont cherchables par leur numéro).
>
> **Parcours de référence** : « clavier d'abord » (`../02-produit/07-principes-ux.md`, règle 5).
> **Cible chiffrée : trouver un appareil par nom d'immeuble sans toucher la souris.**

## Contexte

Le dispatcher passe ses journées dans l'outil, une main sur le téléphone. Il sait ce qu'il cherche — « les Tilleuls », « l'OT de ce matin », « le cabinet Dupont » — mais pas dans quel écran ça vit. Aujourd'hui il doit choisir : parc, clients, contrats, OT. Quatre écrans, quatre champs de recherche, dont trois n'existent pas.

> « **Clavier d'abord** : recherche globale (Cmd+K), navigation planning aux flèches — un dispatcher vit dans l'outil 8 h/jour. »

Ce lot ferme la Phase 1 et la règle UX 5, dont la moitié « planning aux flèches » a été livrée en L1.7.

## Ce que la recherche couvre

Quatre familles, celles du découpage :

| Famille | Cherchable par | Mène à |
|---|---|---|
| **Appareil** | son repère, **et le nom ou l'adresse de son immeuble** | la fiche de l'immeuble |
| **Immeuble** | nom, adresse, code postal, ville | sa fiche |
| **Client** | nom | sa fiche |
| **Ordre de travail** | numéro (`OT-2026-00042`), objet, **et l'immeuble concerné** | sa fiche |

Chercher un appareil par le nom de son immeuble n'est pas un bonus : c'est **le** cas d'usage du découpage, et le prolongement direct de la règle 2 des principes UX — « recherche par adresse ou nom d'immeuble, pas par référence ». Un gardien dit « c'est aux Tilleuls », jamais « c'est l'appareil A ».

Les **contrats** s'ajoutent par leur numéro : ils sont déjà dans le produit depuis L1.4, un numéro de contrat se cite au téléphone, et les exclure serait un trou visible.

## Règles métier

### R1 — Correspondance

1. La correspondance est **une sous-chaîne, insensible à la casse et aux accents**, espaces normalisés. C'est exactement la règle déjà écrite pour la recherche d'immeubles (spec 002, R2) : `normalizeSearchText` est réutilisée, pas réécrite.
2. Une requête **vide ne rend rien**. C'est l'inverse de la recherche d'immeubles, où le champ vide affiche tout le parc : ici une liste de tout le tenant n'aiderait personne, et la palette s'ouvre déjà vide.
3. Une requête de **moins de deux caractères** ne rend rien non plus : sur une lettre, tout correspond.
4. Chaque famille balaie **plusieurs champs réunis** : une requête tombe dans n'importe lequel.

### R2 — Classement

Une recherche transverse mélange quatre familles ; sans règle d'ordre, le résultat utile se retrouve en douzième position. Trois clés, dans cet ordre :

1. **Qualité de la correspondance** : égalité exacte, puis début de champ, puis sous-chaîne. Taper `OT-2026-00042` place cet OT en tête, pas les quarante OT dont l'objet contient « 2026 ».
2. **Famille**, à qualité égale, dans l'ordre : appareil, immeuble, ordre de travail, client, contrat. Le dispatcher cherche un lieu d'intervention bien plus souvent qu'une entité administrative.
3. **Libellé**, par ordre alphabétique, pour que deux appels rendent exactement la même liste.

### R3 — Volume

1. Au plus **20 résultats** rendus, toutes familles confondues. Une palette qui déroule trois cents lignes ne se lit pas au clavier.
2. Le plafond s'applique **après** le classement : on garde les vingt meilleurs, pas les vingt premiers trouvés.
3. La réponse indique s'il y avait **davantage** de correspondances, pour que l'utilisateur sache qu'il doit préciser plutôt que de croire avoir tout vu.

### R4 — Ce que rend un résultat

Chaque résultat porte de quoi être **lu et ouvert** sans second appel :

| Champ | Rôle |
|---|---|
| `kind` | La famille — pilote l'icône, le libellé de section et la destination |
| `id` | L'identifiant de l'entité |
| `label` | Ce qui est cherché et reconnu : « Ascenseur A », « OT-2026-00042 » |
| `sublabel` | Ce qui situe : l'immeuble, la ville, l'objet de l'OT |
| `targetId` | L'identifiant de la **page à ouvrir**, qui n'est pas toujours celui du résultat |

`targetId` existe pour une raison précise : **un appareil n'a pas de page à lui**. Le chercher mène à la fiche de son immeuble (spec 002). Sans ce champ, le client devrait connaître cette règle de navigation — c'est une décision produit, elle appartient au serveur.

### R5 — La palette

1. **Cmd+K** (macOS) et **Ctrl+K** ouvrent la palette depuis n'importe quel écran authentifié.
2. Le focus va au champ de saisie à l'ouverture. **Flèches** pour parcourir, **Entrée** pour ouvrir, **Échap** pour fermer.
3. La palette est un vrai **dialogue** : le focus n'en sort pas à la tabulation, et le fond n'est pas atteignable.
4. À la fermeture, le focus **revient d'où il venait**. Un dispatcher interrompu reprend sa saisie là où il l'avait laissée (règle UX 3).
5. Le premier résultat est **présélectionné** : taper puis Entrée doit suffire dans le cas courant.
6. La navigation ne « sort » pas de la liste : à la dernière ligne, la flèche du bas revient à la première. Sur vingt lignes au plus, faire le tour est plus rapide que de remonter.
7. Aucun raccourci n'est capturé quand la palette est fermée, **sauf** Cmd/Ctrl+K. On ne vole pas les raccourcis du navigateur.

### R6 — Isolation (ADR-001)

La recherche ne lit que le tenant du jeton. Aucun résultat, aucun compte, aucun libellé ne peut provenir d'un autre tenant.

## Critères d'acceptation

- [ ] La **qualité de correspondance** et le **classement** (R2) sont des fonctions pures de `packages/domain`, testées sur les égalités, préfixes, sous-chaînes, accents et égalités parfaites entre familles.
- [ ] `normalizeSearchText` est **réutilisée** telle quelle : une recherche qui trouve un immeuble depuis le parc le trouve aussi depuis la palette.
- [ ] R1.2 et R1.3 couvertes : requête vide et requête d'un caractère ne rendent rien.
- [ ] R3 couverte : plafond appliqué après classement, et le signalement « il y en avait plus » est juste.
- [ ] R6 couverte : aucune fuite entre tenants, vérifiée par un jeton d'un autre tenant.
- [ ] Un appareil trouvé mène à **la fiche de son immeuble**, sans que le client connaisse cette règle.
- [ ] **E2E Playwright** : ouvrir la palette, trouver un appareil **par le nom de son immeuble**, l'ouvrir — **au clavier uniquement**, sans un seul clic.
- [ ] Le focus revient à son point de départ après fermeture.
- [ ] **Régression L1.1, L1.2, L1.6, L1.7** : parc, clients, OT et planning restent verts.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

- **Recherche floue** (tolérance aux fautes de frappe) → demande une distance d'édition et un vrai moteur ; à instruire si les design partners se plaignent des fautes.
- **Index de recherche** → la Phase 0 balaie les collections à chaque appel. C'est tenable sur un parc de PME et cela disparaîtra avec le passage en base (ADR-001) ; voir la note de performance.
- **Actions dans la palette** (« créer un OT », « aller au planning ») → une palette de commandes complète est un autre produit. Ce lot cherche des **choses**, pas des verbes.
- **Historique des recherches récentes** et **résultats à l'ouverture** → demandent de stocker un usage par utilisateur, sans besoin établi.
- **Recherche de contacts** → non listée par le découpage ; un contact se trouve par son client ou son immeuble.
- **Surlignage du terme trouvé** dans les résultats → confort, P1.

## Note de performance, assumée

Chaque frappe déclenche un balayage complet des collections du tenant. Sur les volumes cibles (1 000 appareils, ~9 000 OT/an) c'est un parcours de quelques dizaines de milliers d'objets en mémoire, après lecture des fichiers JSON — de l'ordre de la dizaine de millisecondes, et le client n'interroge qu'après une courte pause de frappe.

Ce n'est pas une architecture de recherche, et ce n'est pas censé en être une : le jour où le stockage devient une base, la même règle de correspondance devient une clause `WHERE`, et les fonctions pures du domaine restent la référence de comportement. Le noter maintenant évite qu'on la découvre comme un défaut plus tard.

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Recherche côté **serveur** | Un endpoint | Chercher côté client obligerait à télécharger tout le parc et tous les OT à chaque ouverture de la palette |
| Requête vide = aucun résultat | Rien | Contraire à la recherche d'immeubles (spec 002, R2.4), et volontairement : une liste de tout le tenant n'aide personne |
| Deux caractères minimum | 2 | Sur une lettre, tout correspond : le classement n'aurait plus rien à classer |
| Plafond de 20 résultats | 20 | Une palette se parcourt aux flèches ; au-delà on ne lit plus, on fait défiler |
| Ordre des familles à qualité égale | Appareil, immeuble, OT, client, contrat | Le dispatcher cherche un lieu d'intervention bien plus souvent qu'une entité administrative |
| `targetId` rendu par le serveur | Champ dédié | Un appareil n'a pas de page ; la règle « il mène à son immeuble » est une décision produit, pas une convention de client |
| Contrats inclus | Ajoutés à la liste du découpage | Un numéro de contrat se cite au téléphone, et ils existent depuis L1.4 |
| **Aucune dépendance nouvelle** pour la palette | Écrite à la main | Contrairement au glisser-déposer de L1.7, où le clavier était le vrai travail, une palette est une liste avec quatre touches. `cmdk` apporterait un filtrage côté client dont on ne veut pas — le filtrage est au serveur |
| Boucle en fin de liste | La flèche du bas revient en haut | Sur vingt lignes, faire le tour est plus court que de remonter |
