# Architecture

> Statut : draft

## Vue d'ensemble

Monolithe modulaire multi-tenant + app mobile offline-first. Pas de microservices au départ : une équipe petite, un domaine cohérent.

```
┌─────────────┐  ┌──────────────┐  ┌───────────────┐
│  Web app     │  │ App mobile   │  │ Portail client │
│ (back-office)│  │ (technicien) │  │ (syndic/copro) │
└──────┬──────┘  └──────┬───────┘  └──────┬────────┘
       │                │ sync offline     │
       └────────────┬───┴──────────────────┘
                    ▼
            ┌──────────────┐      ┌─────────────┐
            │   API (REST)  │─────▶│ Jobs async  │
            │  monolithe    │      │ (échéances, │
            │  modulaire    │      │  PDF, mails)│
            └──────┬───────┘      └─────────────┘
                   ▼
        Stockage (voir phases ci-dessous) + fichiers (photos/docs)
```

## Stratégie de stockage par phases (décision : démarrer SANS BDD)

Voir `decisions/001-stockage-sans-bdd.md`.

- **Phase 0 (maintenant)** : stockage fichiers JSON sur disque, un dossier par tenant, un fichier par collection. Zéro serveur de base de données, zéro ops.
- **Phase 1** : SQLite (toujours un simple fichier, pas de serveur) quand les requêtes croisées deviennent pénibles.
- **Phase 2** : PostgreSQL + RLS quand multi-utilisateurs concurrent réel / volumétrie.

La migration est indolore car **tout le code métier passe par des interfaces repository** — seule l'implémentation du stockage change, jamais le domaine.

## Modules du monolithe (bounded contexts)

- `parc` : appareils, sites, documents, QR codes.
- `contrats` : contrats, clauses, échéanciers.
- `conformite` : moteur d'échéances (visites 6 sem., quinquennal), score de conformité.
- `interventions` : OT, checklists, rapports, carnet d'entretien (append-only).
- `planning` : tournées, affectations, urgences.
- `facturation` : devis, factures, exports compta.
- `portail` : accès clients finaux, notifications.
- `identite` : tenants, utilisateurs, rôles, licences.

## Décisions structurantes (ADR à créer dans decisions/)

1. **Stockage par phases** : JSON fichiers → SQLite → PostgreSQL, derrière des repositories (ADR-001). `tenant_id` présent dans toutes les données dès le jour 1 pour que la migration multi-tenant soit mécanique.
2. **Offline-first mobile** : base locale embarquée (SQLite) + protocole de sync (voir 05-mobile-offline.md). C'est LA contrainte qui gouverne la conception de l'API.
3. **Carnet d'entretien = event log append-only** : jamais d'UPDATE, exports signés — valeur probante.
4. **API publique = la même API que le front** (dogfooding), versionnée dès le départ.

## Environnements

dev → staging → prod. Hébergement UE obligatoire (RGPD, clientèle FR) : Scaleway / OVH / AWS eu-west-3.
