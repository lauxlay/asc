# Roadmap

> Statut : draft — priorisation fine et planning par phases : voir `06-backlog-priorise-planning.md`.

## T1 — Fondations (M1–M3)

- Auth multi-tenant, gestion de parc, contrats, moteur d'échéances.
- Planning basique + génération des visites périodiques.
- Import parc (CSV + assistant migration Progilift).

## T2 — Terrain (M3–M6)

- App mobile offline-first : tournées, checklists, photos, signature, rapport PDF.
- Carnet d'entretien numérique.
- Devis / facturation v1.
- 🎯 Jalon : 3 design partners en production, boucle visite → rapport → facture complète.

## T3 — Différenciation (M6–M9)

- Portail client syndic/copro + preuve de passage + score de conformité.
- Demandes d'intervention en ligne, notifications.
- 🎯 Jalon : premier syndic actif ; NPS ascensoristes > 40.

## T4 — Scale (M9–M12)

- Optimisation de tournées, gestion des astreintes.
- API publique + webhooks, connecteurs compta.
- QR code cabine (signalement usager).
- 🎯 Jalon : 20 clients payants, 5 000 appareils gérés.

## Plus tard (backlog)

- Télésurveillance / IoT, supervision multi-prestataires pour syndics,
  marketplace pièces, extension portes automatiques / escaliers mécaniques, i18n.

## Principes de priorisation

1. Ce qui fait gagner du temps admin à l'ascensoriste (payeur) d'abord.
2. Le portail client dès que la boucle terrain est fiable — c'est l'argument de vente n°1.
3. Aucune feature qui casse l'offline mobile.
