# Parcours utilisateurs clés

> Statut : draft

## UC1 — Visite d'entretien périodique (cœur du produit)

1. Le moteur d'échéances génère la visite (≤ 6 semaines après la précédente).
2. Le dispatcher la place dans la tournée (ou auto-planification).
3. Le technicien ouvre sa tournée sur mobile (données déjà synchronisées, offline OK).
4. Sur site : scan QR appareil → checklist réglementaire → photos → anomalies éventuelles → signature.
5. À la sync : rapport PDF généré, carnet d'entretien alimenté, client notifié, compteur de conformité mis à jour.
6. Si anomalie → devis pré-rempli proposé au back-office.

## UC2 — Dépannage urgent (personne bloquée / panne)

1. Signalement : appel, portail syndic, ou QR code cabine par un usager.
2. Ticket créé avec criticité (personne bloquée = P0).
3. Suggestion du technicien le plus proche/disponible → notification push.
4. Intervention, rapport, cause de panne codifiée.
5. Syndic voit le statut en temps réel ; hors contrat → devis/facture auto.

## UC3 — Le syndic prépare l'AG

1. Connexion portail → sélection de l'immeuble.
2. Export « rapport annuel » : visites réalisées vs dues, pannes, taux de disponibilité, dépenses, carnet d'entretien.
3. Document PDF prêt à joindre à la convocation d'AG.

## UC4 — Onboarding d'un nouvel ascensoriste

1. Import du parc (CSV / migration Progilift assistée).
2. Association contrats + dates de dernières visites → le moteur recalcule toutes les échéances.
3. Invitation des techniciens (app mobile) et des clients (portail).
4. Objectif : premier planning généré en < 1 journée.

## UC5 — Contrôle technique quinquennal

1. Alerte 6 mois avant échéance.
2. Planification avec l'organisme agréé, rapport de contrôle stocké sur la fiche appareil.
3. Observations du contrôleur → transformées en devis de travaux.
