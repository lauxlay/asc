# Sécurité & RGPD

> Statut : draft

## Multi-tenant

- Isolation par RLS PostgreSQL (`tenant_id`), testée par des tests d'intégration dédiés (tentatives cross-tenant).
- Rôles : admin, dispatcher, technicien, comptable + rôles portail (client lecture, client demandeur).
- Le client final (syndic) est propriétaire de SES données de carnet : export complet garanti même en cas de résiliation (argument commercial vs carnets verrouillés — cf. position ARC).

## RGPD

| Donnée | Base légale | Points d'attention |
|---|---|---|
| Géolocalisation techniciens | Intérêt légitime / contrat de travail | Capturée uniquement au start/stop d'intervention, pas de tracking continu. Information des salariés, consultation CSE si applicable |
| Signalements usagers (QR cabine) | Intérêt légitime | Minimisation : pas de compte requis, téléphone optionnel |
| Contacts clients | Exécution du contrat | Durées de conservation définies |
| Photos d'intervention | Exécution du contrat | Consigne : pas de personnes identifiables |

- Hébergement UE exclusivement ; sous-traitants listés (DPA) ; registre des traitements dès le départ.
- Droit à l'effacement vs carnet append-only : pseudonymisation des données personnelles, conservation des faits techniques (obligation légale de traçabilité prime).

## Sécurité applicative

- MFA proposé (imposé pour admins), sessions courtes API, secrets en vault.
- Sauvegardes chiffrées, PITR PostgreSQL, test de restauration trimestriel.
- Journal d'audit des actions sensibles (suppression, export, changement de droits).
- Cible à 18 mois : certification / questionnaire sécurité type ISO 27001-light pour répondre aux AO des gros syndics.

## Valeur probante du carnet

- `logbook_entry` : append-only + hash chaîné + horodatage serveur.
- Export PDF avec empreinte de vérification — le carnet doit être opposable en cas de litige ou de sinistre.
