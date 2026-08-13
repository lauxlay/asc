# Décisions métier en attente

> Statut : vivant — registre des arbitrages produit soulevés pendant le développement et laissés ouverts.

## À quoi sert ce document

Chaque lot développé produit des choix que les docs ne couvraient pas. Ils sont tranchés sur le moment — sinon rien n'avance — avec l'option la plus simple, et consignés dans la table **« Choix non couverts par les docs »** de la spec du lot.

Ce document rassemble ceux qui **méritent une vraie décision métier**, pour qu'ils ne restent pas enterrés dans une spec que personne ne relit. Il ne bloque aucun développement : tout ce qui est listé ici a déjà une implémentation par défaut qui fonctionne.

**Cycle de vie d'une entrée** : soulevée ici → tranchée par le produit → la règle part dans le document de référence qui convient (`05-conformite-reglementaire.md` pour le réglementaire, `../03-application/03-modele-donnees.md` pour le modèle) → l'entrée disparaît d'ici, et la spec concernée est mise à jour.

## Vue d'ensemble

| # | Sujet | Origine | Urgence |
|---|---|---|---|
| **A1** | Durée du préavis de résiliation | Spec 001 → 005 | **Une feature attend** |
| B1 | Le gardien : contact du client ou de l'immeuble ? | Spec 003 | Reprise de données si ça change |
| B2 | La liste des types de client est-elle complète ? | Spec 003 | Reprise de données si ça change |
| B3 | Un immeuble peut-il avoir plusieurs clients ? | Spec 003 | Reprise de données si ça change |
| B4 | Un appareil peut-il avoir deux contrats actifs ? | Spec 005 | Reprise de données si ça change |
| B5 | Appareils sans repère hérités : défaut ou reprise ? | Lot L1.1 | Reprise de données si ça change |
| B6 | Faut-il un soft delete ? | Spec 003 | Reprise de données si ça change |
| C1 | Le rôle d'un contact : texte libre ou liste fermée ? | Spec 003 | À revoir avec l'usage |
| C2 | Faut-il contraindre le code postal ? | Spec 002 | À revoir avec l'usage |
| C3 | Réimport : erreur ou mise à jour ? | Spec 004 | À revoir avec l'usage |
| C4 | Suppressions : refus ou cascade ? | Specs 002, 003, 005 | À revoir avec l'usage |
| C5 | Transfert de contrat : refus ou reprise automatique ? | Spec 005 | À revoir avec l'usage |

---

## A — À trancher avant de coder

### A1 — Durée du préavis de résiliation

**Origine** : la spec 001 (moteur d'échéances) a explicitement renvoyé au lot L1.4 les échéances contractuelles (`kind: contract`), en notant « la règle de préavis n'est pas arrêtée ». Le lot L1.4 est fait, et la règle n'est toujours pas arrêtée.

**Ce que disent les docs** : `05-conformite-reglementaire.md` liste la feature — « Contrat 1 an min | Gestion des dates, tacite reconduction, préavis résiliation » — mais **ne donne aucune durée**.

**Ce qui est en place** : les deux échéances réglementaires (visite 6 semaines, quinquennal 5 ans) sont calculées et affichées. La durée minimale d'un an est contrôlée à la signature. Le préavis, lui, n'existe pas.

**La question** : combien de temps avant le terme faut-il alerter, et selon quelle règle ?

- Une durée fixe (30 jours ? 3 mois ?) ?
- Une durée portée par le contrat lui-même, saisie au cas par cas ?
- Une durée qui dépend du type de contrat, ou de la nature du client (copropriété vs professionnel) ?

**Pourquoi ça ne s'invente pas** : une alerte de préavis ratée, c'est un contrat reconduit tacitement pour un an contre le gré du client. Une alerte inventée trop tôt ou trop tard est pire que pas d'alerte du tout, parce qu'on lui fera confiance.

**Ce que ça débloque** : un troisième type d'échéance dans le tableau de conformité (L1.5), et les notifications de L3.5.

---

## B — À valider : déjà en place, une reprise de données si ça change

Ces choix sont **implémentés et fonctionnels**. Les changer plus tard reste possible, mais suppose de reprendre les données déjà saisies.

### B1 — Le gardien : contact du client ou de l'immeuble ?

**Origine** : lot L1.2, spec 003.

**Le conflit** : le modèle figé (`../03-application/03-modele-donnees.md`) rattache `contact` au **client** (`customer ── contact`). Or le lot s'intitule « clients & contacts (syndic, **gardien**) », et un gardien est le contact d'**un immeuble précis**, pas d'un syndic qui en gère quarante.

**Ce qui est en place** : `contact.siteId`, nullable. Renseigné = contact d'un immeuble (le gardien) ; vide = interlocuteur du client en général. Un contact rattaché à un immeuble doit appartenir au client de cet immeuble — sinon on ferait fuir de l'information entre clients.

**La question** : cette extension du modèle est-elle la bonne, ou le contact doit-il vivre sous le site ? Dans le second cas, c'est `03-modele-donnees.md` qu'il faut amender, pas le code.

### B2 — La liste des types de client est-elle complète ?

**Origine** : lot L1.2, spec 003 — et le type **professionnel** a été ajouté après coup, en review, parce qu'il manquait.

**Ce qui est en place** : syndic, copropriété, professionnel, particulier.

**La question** : un cas réel manque-t-il encore ? Bailleur social, collectivité et établissement public sont des candidats plausibles pour un parc français, et ils ne se comportent ni comme un syndic ni comme un professionnel au moment de facturer (L3.2).

**Pourquoi maintenant** : le type est une énumération fermée, contrôlée à l'écriture. Chaque valeur ajoutée plus tard suppose de reclasser les clients déjà saisis sous une valeur par défaut inexacte.

### B3 — Un immeuble peut-il avoir plusieurs clients ?

**Origine** : lot L1.2, spec 003.

**Ce qui est en place** : `site.customerId` est un identifiant unique — un immeuble a un client, ou aucun.

**La question** : le multi-mandat existe-t-il dans le métier ? Un immeuble suivi à la fois par un syndic et par une copropriété, ou en co-propriété partagée entre deux mandants, imposerait une table de liaison.

**État actuel de l'analyse** : aucun cas de ce genre n'apparaît dans le backlog ni dans les parcours utilisateurs. Le champ scalaire a donc été retenu plutôt qu'une table de liaison spéculative.

### B4 — Un appareil peut-il avoir deux contrats actifs ?

**Origine** : lot L1.4, spec 005.

**Ce qui est en place** : **non**. Lier un appareil déjà couvert par un contrat dont la période se chevauche est refusé. Les contrats successifs restent évidemment acceptés.

**Pourquoi cette contrainte existe** : ce n'est pas un choix de confort. `computeDeadlines(unit, contract, …)` prend **un** contrat. Deux contrats actifs sur le même appareil rendraient le calcul d'échéance indéterminé — et l'échéance est la valeur centrale du produit.

**La question** : existe-t-il un cas réel de co-traitance, ou de contrat de travaux qui cohabiterait avec le contrat d'entretien ? Si oui, ce n'est pas la contrainte qu'il faut lever mais la signature du moteur d'échéances qu'il faut revoir — ce qui touche du code figé depuis L0.2.

### B5 — Appareils sans repère hérités : défaut ou reprise ?

**Origine** : lot L1.1 a ajouté `unit.reference`, obligatoire. Le défaut a été découvert au lot L1.2 : l'API refusait de démarrer sur un volume `data/` écrit avant ce changement.

**Ce qui est en place** : lecture tolérante. Un appareil enregistré avant L1.1 se lit avec le repère `« Sans repère »`, une valeur visiblement provisoire — inventer un repère plausible serait pire que d'avouer qu'on ne le connaît pas.

**La question** : si un environnement porte déjà des données réelles, faut-il un script de reprise qui attribue de vrais repères plutôt que de laisser ce défaut visible à l'écran ?

### B6 — Faut-il un soft delete ?

**Origine** : lot L1.2, spec 003.

**Ce que disent les docs** : `03-modele-donnees.md` prévoit « soft delete partout sauf logbook ».

**Ce qui est en place** : **rien**. Les suppressions sont réelles. Aucune feature ne consomme encore un état « supprimé », et l'implémenter sans besoin aurait ajouté un filtre à chaque lecture.

**La question** : quel est le premier besoin réel — restauration après fausse manœuvre, piste d'audit, obligation RGPD ? La réponse détermine si c'est un soft delete, un journal d'événements, ou les deux.

---

## C — À revoir avec l'usage : changement peu coûteux

Ces choix sont réversibles sans reprise de données lourde. Ils attendent surtout un retour de design partner.

### C1 — Le rôle d'un contact : texte libre ou liste fermée ?

Le rôle (« Gardien », « Gestionnaire », « Président du conseil syndical ») est aujourd'hui du **texte libre** : une énumération figée serait fausse dès le premier client réel. À transformer en liste fermée le jour où une feature en dépend — typiquement les notifications ciblées de L3.5, qui devront savoir à qui écrire.

### C2 — Faut-il contraindre le code postal ?

Le code postal n'est **pas** contraint à cinq chiffres. Une reprise de parc existant contient des saisies imparfaites, et bloquer un import de 500 lignes sur un code postal mal saisi coûterait plus que ça ne rapporte. À resserrer si la qualité des adresses devient un problème — la recherche par adresse en dépend.

### C3 — Réimport : erreur ou mise à jour ?

Réimporter un appareil déjà présent est une **erreur**, signalée ligne par ligne. Une mise à jour silencieuse écraserait des données saisies après l'import initial. La réconciliation d'un import avec un parc existant est un sujet à part entière, prévu au lot L3.6 (migration Progilift enrichie).

Corollaire non tranché : les immeubles créés par import ne sont rattachés à **aucun client**, parce que le CSV ne porte pas le type de client, obligatoire à la création. Faire correspondre un nom de syndic par approximation relève aussi de L3.6.

### C4 — Suppressions : refus ou cascade ?

Le produit refuse (`409`) plutôt que de supprimer en cascade, partout :

- un immeuble qui porte des appareils ou des contacts n'est pas supprimable ;
- un client rattaché à des immeubles ou des contacts non plus.

**Raison** : dans un produit à valeur probante, la donnée de conformité ne disparaît pas par effet de bord. **À surveiller** : si les utilisateurs se retrouvent régulièrement à devoir détacher dix choses à la main pour supprimer un client créé par erreur, l'ergonomie devra être revue — probablement par une suppression en cascade **explicitement confirmée**, pas par un assouplissement de la règle.

### C5 — Transfert de contrat : refus ou reprise automatique ?

Lier un appareil déjà couvert est refusé (voir B4). Le produit **ne clôt pas automatiquement** le contrat précédent : ce serait une décision commerciale prise à la place de l'utilisateur. À revoir si le changement d'ascensoriste en cours d'année s'avère assez fréquent pour mériter un parcours dédié « reprendre cet appareil au 1er du mois ».
