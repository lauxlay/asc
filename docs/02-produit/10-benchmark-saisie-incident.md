# Benchmark — saisie d'incident rapide (ascenseur & GMAO/FSM)

> Statut : draft | Parcours de référence : « Saisir une panne entrante (dispatcher) < 30 s, ≤ 4 champs » (02-produit/07, règle 2) et « Signaler une panne (usager QR) : 2 clics, 0 compte » (règle 14).

Objectif : confronter notre conception de la saisie (type et criticité pré-remplis, 3 champs obligatoires, recherche par adresse) à ce qui se fait de mieux — chez les acteurs ascenseur, les FSM/GMAO grand format, et les systèmes de signalement citoyen dont le problème (déclarants multiples, non formés, urgence variable) est structurellement le même.

## Ce que le benchmark valide

### 1. L'identification avant la saisie (ServiceTitan, téléphonie d'urgence)

ServiceTitan, référence US du call booking artisans/FSM, pousse notre logique un cran plus loin : le CSR **voit qui appelle avant de décrocher** — la fiche client et la fiche du bâtiment (âge, historique) se peuplent automatiquement via le caller ID. Le principe affiché : « the customer — not the keyboard — has their undivided attention » ; la saisie se fait par listes déroulantes guidées, jamais par texte libre.

Le monde des téléphones de cabine (Kings III et équivalents) applique la version radicale : **la ligne EST la localisation**. L'opérateur qui décroche sait déjà de quel appareil il s'agit, l'appelant n'a rien à identifier.

**Enseignement** : le champ « appareil » ne devrait être un vrai champ de saisie que pour le canal le moins qualifié (appel entrant inconnu). Chaque canal doit porter son identité :

| Canal | Appareil connu ? | Champs restants |
|---|---|---|
| QR cabine | ✅ pré-résolu | description (criticité déduite) |
| Portail syndic (immeuble sélectionné) | ✅ ou liste courte | appareil si >1, description |
| Appel n° reconnu (gardien, syndic) | 🟡 immeuble(s) suggéré(s) avant décroché | appareil, criticité |
| Appel inconnu | ❌ | recherche adresse + criticité + description |

→ Le CTI (couplage téléphonie) n'est pas MVP, mais le **modèle contact→immeubles** qui le rend possible doit exister dès le MVP : un numéro ou un nom tapé dans la recherche globale doit remonter « Mme Diallo — gardienne, 12 rue des Lilas (2 appareils) ».

### 2. Recherche par adresse, pas par référence — confirmé partout

Otis même, dans son Customer Portal, fait sélectionner **bâtiment → unité → étage**, jamais une référence d'appareil. Personne au téléphone ne connaît un numéro de série ; notre règle est l'état de l'art, pas une audace.

### 3. QR sans compte — MaintainX fixe le standard

Les request portals MaintainX : lien public ou QR imprimable, **aucun compte requis**, formulaire dont l'admin choisit les champs (et les champs obligatoires), **liens générés par actif** — le QR d'une machine pré-sélectionne la machine. Le déclarant peut opter pour des **mises à jour de statut par e-mail** sans jamais créer de compte. Notre « 2 clics, 0 compte » est aligné ; la brique à ne pas oublier est le **suivi sans compte** (lien de statut ou e-mail optionnel) — c'est ce qui évite le 2ᵉ signalement du même usager frustré.

## Les écarts — ce que notre conception ne couvre pas encore

### 4. Détection de doublon AVANT création (l'écart n° 1)

Une panne d'ascenseur réelle = 1 gardien + 3 résidents + 1 gestionnaire qui signalent **la même chose en 2 heures**, par des canaux différents. C'est le problème central du signalement citoyen : FixMyStreet affiche les signalements ouverts à proximité **avant** de laisser créer le sien ; côté helpdesk, l'alerte proactive « ticket déjà ouvert pour ce compte » est une des demandes les plus votées chez Zoho Desk.

Chez nous : **dès que l'appareil est résolu (QR, sélection, recherche), afficher l'état avant le formulaire** — « ⚠️ Panne déjà signalée il y a 25 min — Karim en route (ETA 14 h 10) », avec une action « **Rattacher ce signalement** » (1 clic). Trois effets : le cas répété (fréquent) passe **sous les 10 s** au lieu de 30 ; le compteur de signalements rattachés devient un signal de pression/urgence pour le dispatcher ; et côté usager QR, ça remplace le formulaire par une bonne nouvelle (« on est au courant, technicien en route ») — exactement la « communication proactive » d'Otis ONE qu'on a mise en P1.

### 5. Personne bloquée = micro-script, pas un formulaire

Les centres de télésurveillance (Kings III : opérateurs certifiés Emergency Medical Dispatcher) et les SOG pompiers traitent la désincarcération par **protocole scripté**, pas par saisie libre : rassurer, puis 3 questions fermées — urgence médicale ? combien de personnes ? cabine entre deux étages ?

Chez nous : quand criticité = P0, le formulaire devrait basculer en mode script — les 3 mêmes cases à cocher (0 texte), affichage immédiat du technicien le plus proche, et **horodatage automatique du signalement**. Bonus stratégique : WeMaintain communique commercialement sur « 37 minutes de désincarcération en moyenne ». Ce chiffre n'existe que si le point de départ est horodaté proprement — en le capturant à la saisie, on offre gratuitement cette métrique-vitrine à chaque ascensoriste client.

### 6. La criticité par défaut dépend du canal, et « différable » est une issue de saisie

KONE 24/7 classe chaque événement **critique → intervention immédiate** vs **différable → traité à la prochaine visite planifiée** (déjà P1 chez nous, cf. 01-business/06). L'endroit où cette règle vit, c'est le formulaire de saisie :

- criticité **pré-remplie selon le canal** (QR usager → « à qualifier », appel + mot-clé personne bloquée → P0, portail syndic → P2 par défaut) ;
- à côté de « Créer l'OT », un second bouton de sortie : « **Rattacher à la prochaine visite** » (voyant grillé, bruit non bloquant). Pas d'OT de dépannage, une ligne ajoutée à la checklist de la visite déjà planifiée. C'est la feature qui économise des déplacements — elle doit être à un clic dans la saisie, pas dans un écran de triage séparé.

### 7. Le 4ᵉ champ utile : « contact sur place »

Otis fait vérifier le point de contact et demande explicitement les consignes d'arrivée (« prévenir le gestionnaire en arrivant »). Notre 4ᵉ champ (optionnel, pré-rempli avec le gardien de l'immeuble) devrait être **contact sur place + consigne d'accès** — c'est l'information qui fait perdre 20 minutes au technicien quand elle manque, et elle est pré-remplissable à 90 % depuis la fiche immeuble.

## Synthèse — impact sur la saisie

| Pattern | Source | Chez nous | Effort |
|---|---|---|---|
| Identité portée par le canal (QR = appareil, contact connu = immeuble) | ServiceTitan, Kings III, MaintainX | Modèle contact→immeubles dès MVP ; CTI plus tard | MVP (modèle), P2 (CTI) |
| Doublon : état de l'appareil affiché avant le formulaire + « rattacher » | FixMyStreet, Zoho Desk | Nouveau — à specer dans le flux de saisie | **MVP** — c'est ce qui rend < 30 s tenable en vrai |
| P0 scripté : 3 cases, 0 texte, horodatage auto | Kings III, SOG pompiers | Nouveau — variante P0 du formulaire | MVP (léger) |
| Criticité par canal + issue « prochaine visite » | KONE 24/7 | Complète le triage P1 existant | P1 |
| Suivi sans compte (lien statut / e-mail opt-in) | MaintainX, Otis portal | À ajouter au flux QR usager | P1 (v1.1 portail) |
| Contact sur place + consigne d'accès en 4ᵉ champ | Otis Customer Portal | Précise le 4ᵉ champ optionnel | MVP |
| Saisie par listes guidées, jamais de texte libre obligatoire | ServiceTitan | Déjà conforme (07-principes-ux) | ✅ |
| Recherche par adresse/immeuble | Otis, tous | Déjà conforme | ✅ |

**Le verdict d'ensemble** : nos cibles (< 30 s, ≤ 4 champs, QR 0 compte) sont au niveau de ce qui se fait de mieux — rien à revoir sur les fondamentaux. Les deux vrais manques sont des **raccourcis de sortie** plutôt que des champs : le rattachement au ticket existant (doublon) et le rattachement à la prochaine visite (différable). Dans les deux cas, la meilleure saisie est celle qui n'a pas lieu.

Sources : [ServiceTitan — Call Booking Software](https://www.servicetitan.com/features/call-booking-software), [ServiceTitan — Call booking workflow](https://help.servicetitan.com/v1/docs/set-up-the-call-booking-process-recommended-workflow), [MaintainX — Request Portals](https://help.getmaintainx.com/set-up-a-request-portal), [MaintainX — Work Requests](https://www.getmaintainx.com/use-cases/work-request-management), [Otis — Customer Portal Tutorial](https://service.otiselevator.com/en-us-customerportaltutorial), [Kings III — Emergency Monitoring](https://www.kingsiii.com/emergency-monitoring/), [Kings III — Elevator Entrapment Tips](https://www.kingsiii.com/help-phone-blog/elevator-entrapment-tips/), [West Valley Fire — SOG Elevator Emergencies](http://www.westvalleyfire.com/Assets/dept_1/PM/pdf/Elevator%20Emergencies.pdf), [FixMyStreet — FAQ](https://www.fixmystreet.com/faq), [Zoho Desk — Proactive alert for existing open tickets](https://help.zoho.com/portal/de/community/topic/proactive-alert-for-existing-open-tickets-per-contact-account), [WeMaintain — Pannes ascenseurs copropriété](https://www.wemaintain.com/fr-fr/blog/guides-outils/pannes-ascenseurs-copropriete-5-choses-a-savoir), [Huoltu — Ascensoriste](https://www.huoltu.com/metier/ascensoriste/), [KONE 24/7 Connected Services](https://www.kone.com/en/products-and-services/maintenance-and-modernization/24-7-connected-services.aspx)
