# Principes UX — métier d'abord

> Statut : draft | S'impose aux agents front, mobile et ui. Le design (esthétique) est secondaire ; la fluidité et la logique métier sont non négociables.

## Principe directeur

Chaque écran doit épouser le déroulé réel du métier, pas l'inverse. On conçoit à partir des situations : un dispatcher interrompu 40 fois par jour, un technicien avec des gants dans une gaine sans réseau, un gestionnaire syndic pressé qui ne sera jamais formé. Si un utilisateur doit réfléchir à l'outil au lieu de son métier, c'est un bug UX.

## Règles par contexte d'usage

### Dispatcher (back-office) — métier : l'interruption permanente

1. **Tout se fait depuis le planning** : créer, déplacer, réassigner un OT sans changer d'écran. Le planning est la page d'accueil, pas un module.
2. **Une panne entrante se traite en < 30 secondes** : téléphone à l'oreille → saisie appareil (recherche par adresse/nom d'immeuble, pas par référence) → criticité → technicien suggéré → validé. Jamais plus de 4 champs obligatoires.
3. **Reprendre où on en était** : après interruption, l'état (filtres, scroll, brouillon) est conservé. Aucune ressaisie.
4. **Le rouge veut dire réglementaire** : la couleur d'alerte est réservée aux échéances légales (visite 6 sem., quinquennal) et au P0. Pas d'inflation d'alertes — une alerte ignorable est une alerte qui tue les autres.
5. **Clavier d'abord** : recherche globale (Cmd+K), navigation planning aux flèches — un dispatcher vit dans l'outil 8 h/jour.

### Technicien (mobile) — métier : les mains prises, pas de réseau

6. **Zéro navigation pendant l'intervention** : un seul écran du début à la fin de la visite — checklist, photo, anomalie, signature s'enchaînent verticalement. Pas de retour arrière nécessaire.
7. **Cibles tactiles ≥ 48 px, utilisable avec des gants**, contraste fort (machinerie mal éclairée). Saisie texte minimale : cases, choix, dictée — jamais de paragraphe obligatoire.
8. **L'ordre de la checklist = l'ordre physique de la tournée d'inspection** (cabine → toit → gaine → machinerie → cuvette), pas l'ordre alphabétique ou réglementaire.
9. **Le statut réseau n'est jamais bloquant ni anxiogène** : un badge discret « X à synchroniser », c'est tout. Aucune action ne peut échouer pour cause de réseau.
10. **Clôturer une visite standard : ≤ 60 secondes, ≤ 6 gestes.** C'est un critère d'acceptation mesuré, pas une intention.

### Syndic / copro (portail) — métier : rendre des comptes sans expertise

11. **Vocabulaire copro, pas ascensoriste** : « votre ascenseur est en règle », pas « OT #4521 clôturé ». La traduction métier→client fait partie du produit.
12. **La réponse avant la question** : conformité, prochaine visite, dernier passage visibles sans un seul clic après connexion.
13. **Chaque page pense à l'AG** : tout ce qui s'affiche doit être exportable en un document propre à joindre à une convocation.
14. **Signaler une panne : 2 clics, zéro compte requis** pour un usager via QR code cabine.

## Règles transverses

- **Un flux = un objectif** : jamais d'écran fourre-tout. Si un écran sert deux personas, c'est deux écrans.
- **Les valeurs par défaut font le travail** : type de contrat pré-déduit, technicien habituel de l'immeuble pré-sélectionné, durée pré-remplie par type d'OT. L'utilisateur corrige l'exception, il ne saisit pas la règle.
- **Vocabulaire du glossaire partout** (03-application/03) : un concept = un mot, dans l'UI comme dans le code. Jamais « intervention » ici et « OT » là.
- **États vides pédagogiques** : un parc vide propose l'import, pas une page blanche.
- **Aucune confirmation modale pour les actions réversibles** ; undo plutôt que « êtes-vous sûr ». Les modales sont réservées à l'irréversible (suppression, envoi client).

## Critères mesurables (repris dans les DoD des agents)

| Parcours | Cible |
|---|---|
| Saisir une panne entrante (dispatcher) | < 30 s, ≤ 4 champs |
| Clôturer une visite standard (mobile) | ≤ 60 s, ≤ 6 gestes |
| Trouver l'état d'un appareil (syndic) | 0 clic après connexion |
| Signaler une panne (usager QR) | 2 clics, 0 compte |
| Onboarding nouveau client | 1er planning généré < 1 jour |

Toute nouvelle spec (`docs/specs/`) doit indiquer son parcours de référence et sa cible chiffrée quand elle touche un de ces flux.
