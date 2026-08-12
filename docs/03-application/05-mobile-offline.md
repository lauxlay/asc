# Mobile offline-first

> Statut : draft

Le pain point n°1 de Praxedo. C'est une contrainte d'architecture, pas une feature.

## Principe

L'app fonctionne à 100 % sans réseau pendant une journée complète. Le réseau est une optimisation, pas un prérequis.

## Modèle de sync

1. **Pull au démarrage / à la demande** : tournée du jour + fiches appareils + historique récent + templates de checklists → SQLite locale.
2. **Travail local** : toutes les écritures (rapport, photos, signature) vont dans une outbox locale.
3. **Push différé** : à chaque retour de réseau, l'outbox se vide (ordre garanti, idempotence via `offline_id` UUID généré côté client).
4. **Conflits** : rares par construction (un OT = un technicien assigné). Stratégie : last-write-wins par champ + journal de conflit visible back-office. Le dispatcher ne peut pas modifier un OT « en cours » côté terrain.

## Cas limites à gérer

- Photo lourdes : compression locale, upload en tâche de fond, jamais bloquant.
- OT réassigné pendant que le technicien est offline → à la sync, l'OT réalisé gagne, notification au dispatcher.
- Horloge locale non fiable → horodatage serveur à la réception + horodatage local conservé.
- Batterie / crash → outbox persistée sur disque, reprise au redémarrage.

## Preuve de passage

- Géolocalisation capturée au démarrage et à la clôture de l'intervention (avec consentement, voir 06-securite-rgpd.md).
- Scan du QR code appareil = preuve de présence physique (le QR est dans la machinerie/cabine).
- Horodatage + photos → alimentent le portail client.

## Tests

Scénario de recette obligatoire à chaque release mobile : « mode avion complet : 5 interventions, 20 photos, 2 signatures, sync en une fois ».
