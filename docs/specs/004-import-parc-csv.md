# 004 — Import du parc par CSV

> Lot **L1.3** (`../03-application/09-decoupage-execution-opus.md`) · Périmètre : `packages/domain`, `packages/contracts`, `apps/api`, `apps/web`. Cycle complet 1→5.
> **Imbrications déclarées : L1.1, L1.2** — l'import écrit dans les immeubles et les appareils, et ses immeubles doivent rester rattachables à un client.

## Contexte

« Sans migration, pas d'onboarding » (`../02-produit/06-backlog-priorise-planning.md`, P0 n°7). Une PME ascensoriste qui essaie le produit arrive avec 300 à 1 500 appareils dans un Excel ou un export Progilift. Lui demander de les saisir à la main, c'est perdre le prospect au premier écran.

Le jalon de sortie de la Phase 1 est explicite : « démo : import d'un parc réel, planning annuel généré ».

Persona : le dispatcher, ou plus souvent le patron de la PME, une seule fois, le jour de la reprise. C'est un parcours **rare, à fort enjeu et sans droit à l'erreur** : un import raté à moitié laisse un parc incohérent que personne ne saura nettoyer.

## Le fichier réel

Un export de parc français n'est pas un CSV de manuel :

- séparateur **`;`** (Excel francophone) aussi souvent que `,` ;
- **BOM UTF-8** en tête, ajouté par Excel ;
- fins de ligne **CRLF** ;
- champs **entre guillemets** dès qu'ils contiennent le séparateur (`"12, rue des Lilas"`) ;
- colonnes nommées librement : `Immeuble`, `Résidence`, `Adresse`, `CP`, `Commune`, `N° appareil`, `Repère`, `Mise en service`…
- lignes vides en fin de fichier.

Le lot doit avaler ça sans demander à l'utilisateur de préparer son fichier.

## Parcours

Deux temps, séparés par une confirmation — **jamais d'import à l'aveugle** :

1. **Analyse** — l'utilisateur choisit son fichier. Le serveur rend : colonnes détectées, correspondance suggérée, aperçu des premières lignes, décompte des immeubles et appareils qui seraient créés, et **toutes** les erreurs.
2. **Import** — l'utilisateur corrige la correspondance si besoin, puis confirme. L'import s'exécute **en entier ou pas du tout**.

## Règles métier

### R1 — Lecture du fichier

1. Le **séparateur** est détecté sur la ligne d'en-tête : `;` ou `,`, celui qui découpe le plus de colonnes. Un fichier à une seule colonne reste valide.
2. Le **BOM UTF-8** est retiré s'il est présent ; il ne doit pas polluer le nom de la première colonne.
3. `CRLF`, `LF` et `CR` sont acceptés indifféremment.
4. Les champs entre guillemets peuvent contenir le séparateur, des retours à la ligne et des guillemets doublés (`""` = un guillemet). Convention RFC 4180.
5. Les **lignes vides sont ignorées**, où qu'elles soient.
6. Un fichier **sans ligne d'en-tête exploitable** (vide, ou en-tête sans aucune colonne nommée) est refusé avec un message clair.
7. Les espaces de bord de chaque cellule sont retirés.

### R2 — Correspondance assistée des colonnes

1. Chaque colonne de destination est devinée à partir du **nom de la colonne du fichier**, comparé sans casse, sans accents et sans espaces superflus — la même normalisation que la recherche d'adresse (spec 002, R2).
2. Synonymes reconnus, au minimum :

   | Destination | Noms reconnus |
   |---|---|
   | `siteName` | immeuble, residence, résidence, site, batiment, bâtiment, nom |
   | `addressLine` | adresse, voie, rue, numero et voie |
   | `postalCode` | code postal, cp, codepostal |
   | `city` | ville, commune, localite, localité |
   | `reference` | appareil, ascenseur, repere, repère, numero appareil, n° appareil, reference, référence |
   | `commissionedOn` | mise en service, date de mise en service, miseenservice |
   | `lastStatutoryInspectionOn` | quinquennal, controle technique, contrôle technique, dernier controle |

3. La suggestion est **modifiable** : l'utilisateur peut réaffecter n'importe quelle colonne, ou n'en affecter aucune.
4. Une même colonne du fichier ne peut alimenter **qu'une seule** destination.
5. Colonnes **obligatoires** : `siteName`, `addressLine`, `postalCode`, `city`, `reference`. Sans elles, l'import est refusé — ce sont exactement les champs obligatoires d'un immeuble (spec 002) et d'un appareil.
6. Les colonnes du fichier non affectées sont **ignorées sans bruit** : un export Progilift porte trente colonnes dont on ne veut pas.

### R3 — Regroupement des immeubles

1. Plusieurs lignes décrivant le **même immeuble** ne créent qu'un immeuble. La clé de regroupement est le triplet **(voie, code postal, ville)** normalisé comme en R2.1 — deux saisies `12 RUE DES LILAS` et `12 rue des Lilas` désignent le même bâtiment.
2. Le **nom** retenu pour l'immeuble est celui de sa première ligne ; les lignes suivantes du même immeuble n'écrasent rien.
3. Si un immeuble du tenant porte **déjà** cette adresse, il est **réutilisé** : l'import ajoute ses appareils sans le dupliquer. C'est le cas normal d'un parc repris en deux fois.
4. Le nom d'immeuble ne participe **pas** à la clé : deux bâtiments à la même adresse sous deux noms sont le même immeuble, et l'inverse (même nom, deux adresses) est courant chez les syndics.

### R4 — Validation, tout ou rien

1. Chaque ligne est validée : champs obligatoires non vides, dates au format `YYYY-MM-DD` ou `JJ/MM/AAAA`, jours réels.
2. **Toutes** les erreurs sont rendues d'un coup, avec le **numéro de ligne du fichier** (en-tête = ligne 1) — corriger un CSV erreur après erreur est intenable sur 500 lignes.
3. **Aucune ligne n'est importée si une seule est invalide.** Un parc à moitié importé est pire qu'un import refusé : personne ne sait ce qui manque.
4. Un fichier **sans aucune ligne de données** est refusé.

### R5 — Doublons d'appareils

1. Deux lignes du fichier portant le **même repère dans le même immeuble** sont une erreur : le fichier se contredit.
2. Une ligne dont le couple (immeuble, repère) **existe déjà dans le parc** est une erreur, signalée comme déjà importée. C'est ce qui rend un double import inoffensif au lieu de dupliquer tout le parc.
3. Le même repère dans **deux immeubles différents** est normal : « Ascenseur A » existe dans chaque bâtiment.

### R6 — Dates

Deux formats acceptés en entrée, parce que les deux sortent d'Excel : `YYYY-MM-DD` et `JJ/MM/AAAA`. Une date vide vaut « inconnue » (`null`), pas une erreur. Une date impossible (`30/02/2026`) est une erreur. Le domaine ne raisonne qu'en jours calendaires (spec 001, R6).

### R7 — Isolation multi-tenant (ADR-001)

L'import lit et écrit exclusivement dans le tenant du jeton : le décompte des doublons, la réutilisation des immeubles et les écritures. Aucune donnée d'un autre tenant n'est lue ni révélée.

### R8 — Rattachement client

Les immeubles créés par l'import ne sont rattachés à **aucun client** (`customerId: null`). Le rattachement se fait ensuite depuis l'écran client (L1.2), qui doit les proposer.

## Critères d'acceptation

- [ ] Le parseur CSV et la construction du plan d'import sont des **fonctions pures de `packages/domain`**, sans I/O, testées sur : séparateur `;` et `,`, BOM, CRLF, guillemets, séparateur et retour à la ligne échappés, lignes vides, en-tête absent.
- [ ] R2 couverte : détection des synonymes, réaffectation manuelle, colonne obligatoire manquante refusée.
- [ ] R3 couverte : lignes regroupées par adresse normalisée, immeuble existant réutilisé et non dupliqué.
- [ ] R4 couverte : erreurs rendues d'un coup avec numéro de ligne ; une seule ligne invalide n'importe rien.
- [ ] R5 couverte : doublon dans le fichier et doublon contre le parc existant refusés ; même repère dans deux immeubles accepté.
- [ ] R6 couverte : les deux formats de date, date vide, date impossible.
- [ ] L'analyse ne modifie **rien** : deux analyses successives laissent le parc identique.
- [ ] Back-office : choix du fichier, tableau de correspondance modifiable, aperçu et erreurs avant confirmation — shadcn/ui uniquement.
- [ ] E2E Playwright : importer **50 appareils** depuis un CSV et les retrouver dans le parc.
- [ ] **Régression L1.1 / L1.2** : recherche d'adresse, création manuelle d'immeuble et d'appareil, et rattachement d'un immeuble importé à un client restent verts.
- [ ] `pnpm check` et `pnpm e2e` verts.

## Hors scope

- **Excel `.xlsx` natif** → l'utilisateur exporte en CSV. Lire un classeur demanderait une dépendance de parsing binaire pour un gain nul en Phase 1.
- **Encodages autres qu'UTF-8** (Latin-1 / Windows-1252) → le fichier est lu comme du texte par le navigateur. Un fichier Latin-1 produira des caractères abîmés, pas une erreur silencieuse de données. À traiter si un design partner bute dessus.
- **Import des clients, contrats, historique de visites** → **L3.6** (migration Progilift enrichie). Ici : immeubles et appareils, rien d'autre.
- **Rattachement client depuis le CSV** → voir R8 et le tableau des choix.
- **Correction des lignes dans l'écran d'import** → l'utilisateur corrige son fichier et recommence. Un éditeur de tableur dans le navigateur est un produit à lui seul.
- **Annulation d'un import** → non couverte : l'import est refusé avant d'écrire, il n'y a donc rien à annuler. Une vraie reprise arrière demanderait le soft delete, non implémenté (spec 003).

## Choix non couverts par les docs

| Sujet | Choix | Pourquoi |
|---|---|---|
| Transport du fichier | Texte CSV dans le corps JSON, pas de multipart | Évite une dépendance de parsing multipart et un stockage temporaire de fichier. Taille bornée (voir ci-dessous) |
| Taille maximale | 800 000 caractères et 5 000 lignes de données | Couvre très largement le parc d'une PME (1 500 appareils ≈ 120 Ko) tout en restant, une fois encodé en JSON, sous la limite de corps par défaut de Fastify (1 Mo) |
| Écriture non transactionnelle | Assumé | Le stockage Phase 0 est un fichier par collection (ADR-001), sans transaction. La validation étant **entièrement** faite avant la première écriture, le seul risque de parc à moitié importé est une panne disque en cours d'écriture, pas une donnée refusée. À revoir avec le passage à SQLite |
| État entre l'analyse et l'import | **Aucun** — le navigateur renvoie le CSV avec la correspondance confirmée | Pas de session d'import à stocker ni à nettoyer. L'analyse devient une fonction pure du couple (fichier, correspondance) |
| Tout ou rien plutôt qu'import partiel | Tout ou rien | Voir R4.3. Un parc à moitié importé n'est pas rattrapable à la main |
| Doublon existant = erreur, pas mise à jour | Erreur | Une mise à jour silencieuse écraserait des données saisies après l'import initial. La réconciliation est un sujet de L3.6 |
| Immeubles importés sans client | `customerId: null` | Le CSV ne porte pas le type de client, obligatoire à la création (spec 003). Faire correspondre un nom de syndic par approximation est un sujet de L3.6 ; le rattachement manuel de L1.2 fonctionne déjà |
| Nom d'immeuble hors clé de regroupement | Clé = adresse seule | Voir R3.4 |
| Parseur CSV écrit à la main | ~80 lignes dans `domain` | Une dépendance de parsing CSV apporterait des options dont aucune n'est utile ici, et la logique doit rester pure et testable dans `domain` (règle des dépendances de `07-phase0-fondations.md`) |
| Format de date `JJ/MM/AAAA` accepté | Accepté | C'est ce que produit un Excel francophone. Le refuser ferait échouer la majorité des fichiers réels sur un détail de présentation |
