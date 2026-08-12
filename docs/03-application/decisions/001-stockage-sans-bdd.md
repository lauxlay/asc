# ADR-001 — Démarrer sans base de données, migrable

> Statut : validé | Date : 2026-08-11 | Décideurs : Jorys

## Contexte

Phase de démarrage : un seul développeur, pas de trafic, besoin d'itérer vite sur le modèle métier. Installer/opérer PostgreSQL est prématuré. Mais le produit finira multi-tenant avec de la volumétrie : la migration doit être triviale.

## Décision

Stockage **fichiers JSON** au départ, isolé derrière des **interfaces repository**. Le code métier ne sait jamais comment les données sont stockées.

### Règles qui garantissent la migrabilité

1. **Repository pattern strict** : `UnitRepository`, `WorkOrderRepository`… Une interface par agrégat, une implémentation `JsonFileXxxRepository`. Interdiction d'accéder aux fichiers hors des repositories.
2. **UUID générés par l'application** dès le jour 1 (jamais d'auto-increment) — les IDs survivent à toutes les migrations.
3. **`tenant_id` sur chaque enregistrement** même avec un seul tenant.
4. **Schéma versionné** : chaque fichier porte `{ "schemaVersion": 3, "items": [...] }` + petites fonctions de migration à la lecture.
5. **Pas de jointure implicite** : les repositories exposent des méthodes métier (`findVisitsDueBefore(date)`), pas de query language — ces méthodes se réimplémentent en SQL sans toucher les appelants.
6. **Dates ISO 8601 UTC**, montants en centimes (entiers) — représentations identiques en JSON et SQL.

### Organisation disque

```
data/
 └── {tenant_id}/
     ├── units.json
     ├── customers.json
     ├── contracts.json
     ├── work_orders/2026.json      # partitionné par an (volumineux)
     ├── logbook/2026.jsonl         # append-only → JSON Lines naturel
     └── files/{uuid}.jpg           # photos/PDF hors JSON
```

- Écritures atomiques : write temp + rename. Un mutex par fichier (mono-process).
- `logbook` en `.jsonl` append-only : on n'écrit qu'à la fin, jamais de réécriture — cohérent avec l'exigence de valeur probante.
- Sauvegarde = copie du dossier `data/` (ou commit git privé au tout début).

## Options considérées

1. **JSON fichiers (choisi)** — zéro ops, débogable à l'œil nu, parfait < ~50 000 enregistrements. Limite : pas de requêtes croisées efficaces, mono-process.
2. **SQLite direct** — presque aussi simple (un fichier), SQL disponible ; mais impose de figer un schéma tôt alors que le modèle bouge. Retenu comme **étape intermédiaire naturelle** (Phase 1) : les repositories `JsonFile*` deviennent `Sqlite*`.
3. **PostgreSQL tout de suite** — la cible finale, mais ops + rigidité prématurées.

## Chemin de migration

- Phase 0 → 1 (SQLite) : script qui lit chaque JSON et INSERT ; réécrire les implémentations de repositories ; les tests de contrat des repositories (suite partagée exécutée contre chaque implémentation) valident l'équivalence.
- Phase 1 → 2 (PostgreSQL) : SQL → SQL, ajouter RLS sur `tenant_id`.

## Conséquences

- Déploiement Phase 0 = un binaire/process + un dossier. Idéal démos design partners.
- Contrainte assumée : **mono-process** jusqu'à Phase 1/2 (pas de scaling horizontal). L'app mobile sync via l'API, donc rien ne change pour elle lors des migrations.
- Discipline requise : toute tentation de « lire le JSON directement » casse la migrabilité — revue de code vigilante.

## Impact sur la stack

Le choix backend (TypeScript) reste inchangé ; Prisma/Drizzle deviennent utiles seulement en Phase 1+. Les jobs (échéances, PDF) tournent dans le même process (cron in-process type `node-cron`) au lieu de BullMQ/Redis — Redis retiré de la Phase 0.
