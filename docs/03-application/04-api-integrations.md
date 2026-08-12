# API & intégrations

> Statut : draft

Réponse directe au pain point « écosystème fermé » de Progilift/Praxedo.

## API publique

- REST versionnée (`/v1/…`), la même que celle du front (dogfooding).
- Auth : clés API par tenant + OAuth2 pour intégrations tierces.
- Ressources exposées dès v1 : units, sites, customers, work_orders, contracts, invoices, compliance.
- Rate limiting par tenant ; OpenAPI publié.

## Webhooks

Événements : `work_order.completed`, `breakdown.reported`, `compliance.overdue`, `invoice.created`, `quote.accepted`. Signature HMAC, retries exponentiels.

## Connecteurs prioritaires

| Cible | Usage | Priorité |
|---|---|---|
| Compta : Pennylane, Sage, Cegid, export FEC | Factures, encaissements | P1 |
| Paiement : Stripe / GoCardless (SEPA) | Prélèvement contrats | P1 |
| ERP syndics (Vilogi, ICS, Crypto/Septeo) | Sync immeubles, OS travaux | P2 |
| Calendriers (ics) | Tournées techniciens | P2 |
| Télésurveillance / IoT (protocoles fabricants) | Pannes auto | P3 |

## Import / migration

- Import CSV/Excel générique (mapping assisté) : parc, clients, contrats, historique.
- **Assistant migration Progilift** : parser les exports Progilift — outil commercial critique, à maintenir comme un produit.

## Notifications sortantes

Email (Brevo), push mobile (Expo), SMS (astreintes / personne bloquée, P0). Préférences par utilisateur et par criticité.
