# Modèle de données

> Statut : draft

## Glossaire FR → EN (à figer avant la première migration)

| Métier (FR) | Code (EN) |
|---|---|
| Société de maintenance | `company` (tenant) |
| Client (syndic, copro, particulier) | `customer` |
| Immeuble / site | `site` |
| Appareil (ascenseur) | `unit` |
| Contrat d'entretien | `contract` |
| Visite périodique | `maintenance_visit` |
| Dépannage | `breakdown` |
| Ordre de travail | `work_order` |
| Tournée | `route` |
| Carnet d'entretien | `logbook` / `logbook_entry` |
| Contrôle quinquennal | `statutory_inspection` |
| Point de contrôle | `checklist_item` |

## Entités principales

```
company (tenant)
 ├── user (rôles : admin, dispatcher, technician, accountant)
 ├── customer ── contact
 │    └── site ── unit ── document, qr_code
 ├── contract (type: minimal|extended, unit_ids, échéancier)
 ├── work_order (type: visit|breakdown|repair|works|inspection,
 │               status, priority, unit_id, assignee, scheduled_at)
 │    ├── checklist_result
 │    ├── photo, part_used, time_entry
 │    ├── signature
 │    └── report (PDF)
 ├── logbook_entry (append-only, source: work_order|manual|inspection)
 ├── compliance_deadline (unit_id, kind: visit_6w|inspection_5y|contract,
 │                        due_at, status)
 ├── quote ── invoice ── payment
 └── portal_access (customer_id, user léger côté client)
```

## Règles clés

- `tenant_id` sur toutes les tables + RLS PostgreSQL.
- `logbook_entry` : INSERT only (trigger interdisant UPDATE/DELETE), hash chaîné optionnel pour valeur probante.
- `compliance_deadline` recalculée par job à chaque clôture de `work_order` de type visite/inspection.
- `work_order` porte un `offline_id` (UUID client) pour la déduplication à la sync mobile.
- Checklists en JSONB versionné (`checklist_template_version`) : une visite reste lisible même si le modèle de checklist évolue.
- Soft delete partout sauf logbook ; `created_at`/`updated_at` systématiques.

## Volumétrie cible (dimensionnement)

500 tenants × 1 000 appareils × 9 visites/an ≈ 4,5 M work_orders/an + photos (~5/OT). PostgreSQL + S3 tiennent largement ; prévoir partitionnement par année sur `work_order` et `logbook_entry` au-delà.
