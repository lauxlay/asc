# Pain points & opportunités

> Statut : draft

Cartographie des douleurs constatées chez Progilift / Praxedo / terrain, et la réponse produit associée.

| # | Pain point | Source | Réponse produit |
|---|---|---|---|
| PP1 | Pas d'offline réel : technicien bloqué en gaine/sous-sol | Praxedo | Mobile offline-first, sync différée automatique |
| PP2 | Syndic sans visibilité sur les visites réelles ; carnet non tenu | Terrain / réglementaire | Portail client + preuve de passage (géoloc, horodatage, photos) + carnet numérique |
| PP3 | Licences rigides, techniciens payés plein tarif | Praxedo | Licence terrain allégée, admin sur tablette |
| PP4 | Intégrations fermées (compta, ERP syndic) | Progilift + Praxedo | API publique REST + webhooks, connecteurs compta (Pennylane, Sage, Cegid) |
| PP5 | UX datée, formation longue | Progilift | Onboarding < 1 jour, UI moderne, import assisté |
| PP6 | Replanification manuelle des pannes urgentes | Terrain | Moteur de planning : insertion d'urgence dans tournées, respect contrainte 6 semaines |
| PP7 | Ressaisie papier → facturation, délais d'encaissement | Terrain | Rapport signé sur mobile → facture générée automatiquement |
| PP8 | Échéances réglementaires oubliées (quinquennal, visites) | Terrain | Moteur d'échéances : alertes, blocage de conformité, tableau de bord parc |
| PP9 | Historique appareil éparpillé (pannes, pièces, plans) | Terrain | Fiche appareil unique : QR code en cabine → historique complet |
| PP10 | Astreintes / demandes de dépannage par téléphone 24/7 | Terrain | Demande d'intervention en ligne (portail + QR code cabine), routage astreinte |

## Opportunités différenciantes (aucun concurrent ne le fait)

1. **QR code en cabine** : usager scanne → signalement panne géolocalisé → ticket créé, syndic notifié.
2. **Score de conformité par appareil** : visites faites / dues, quinquennal à jour, carnet complet — exportable pour l'AG.
3. **Carnet d'entretien numérique opposable** : horodaté, signé, inaltérable (append-only), conforme au choix copro papier/électronique.
4. **IoT-ready** : ingestion télésurveillance (pannes remontées automatiquement) en roadmap.
