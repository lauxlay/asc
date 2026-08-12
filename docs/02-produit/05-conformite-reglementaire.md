# Conformité réglementaire (France)

> Statut : draft — à faire valider par un juriste / expert métier avant commercialisation.

Le réglementaire est le cœur du produit : chaque règle ci-dessous doit être encodée dans le moteur d'échéances.

## Obligations d'entretien

- **Contrat d'entretien écrit obligatoire** (loi SAE 2003, décret 2004-964) pour tout propriétaire d'ascenseur, durée minimale 1 an. En copropriété, signé par le syndic sur mandat de l'AG.
- **Visites périodiques : au moins une toutes les 6 semaines** (~8–9/an), incluant vérification du fonctionnement des portes et de la précision d'arrêt.
- **Contrats types** (arrêté du 7 novembre 2012) : contrat minimal vs contrat étendu (pièces incluses). Le produit doit modéliser les deux.

## Contrôle technique quinquennal

- Tous les 5 ans, par un organisme/contrôleur agréé indépendant.
- Rapport remis au propriétaire/syndic et **consigné dans le carnet d'entretien**.

## Carnet d'entretien

- Chaque intervention doit y être consignée par le prestataire.
- Format papier **ou** électronique, **au choix du propriétaire** (la copro peut imposer son choix — cf. position de l'ARC). Conséquence produit : notre carnet numérique doit être exportable/imprimable et rester la propriété du client, pas de l'ascensoriste — argument commercial fort face aux carnets « verrouillés » des prestataires.
- Le conseil syndical a un droit de regard : prévoir un accès lecture.

## Autres exigences à instruire

- Étude de sécurité tous les 5 ans (à confirmer selon type d'appareil).
- Normes EN 81-20/50 (conception) — hors scope logiciel mais utile en référentiel de fiche appareil.
- Décret 2008-1325 et arrêtés SAE (travaux de mise en sécurité) — champ « travaux SAE » sur la fiche appareil.
- RGPD : données des occupants (signalements), géolocalisation des techniciens (voir 03-application/06).

## Traduction produit

| Règle | Feature |
|---|---|
| Visite ≤ 6 semaines | Génération auto + alerte retard + indicateur rouge parc |
| Quinquennal 5 ans | Échéance longue durée + alerte à 6 mois |
| Carnet obligatoire | Append-only, horodaté, export PDF, accès client |
| Contrat 1 an min | Gestion des dates, tacite reconduction, préavis résiliation |
| Choix papier/électronique | Export PDF du carnet toujours disponible |

Sources : [Travaux.com — réglementation ascenseur](https://www.travaux.com/ascenseurs/guide-des-prix/reglementation-ascenseur), [ARC — carnet d'entretien électronique](https://arc-copro.fr/documentation/refusez-le-carnet-dentretien-electronique-de-votre-ascensoriste), [IRC — maintenance des ascenseurs](https://www.informationsrapidesdelacopropriete.fr/dossiers/4300-635-la-maintenance-des-ascenseurs)
