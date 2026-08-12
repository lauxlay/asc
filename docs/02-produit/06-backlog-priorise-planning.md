# Backlog priorisé & planning de développement

> Statut : draft — remplace la priorisation implicite de `02-features-mvp.md` et `03-roadmap.md` (qui restent la vue « quoi », ce doc est la vue « quand »).

## Priorités (du plus au moins important)

### P0 — Vital : sans ça, aucun client ne peut travailler

| # | Feature | Justification |
|---|---|---|
| 1 | Parc : fiches appareils + sites + contacts | Tout repose dessus |
| 2 | Contrats (minimal/étendu) + **moteur d'échéances** (visite ≤ 6 sem., quinquennal) | Cœur réglementaire = raison d'achat |
| 3 | Ordres de travail (visite, dépannage, réparation) + statuts | Unité de travail de base |
| 4 | Planning : génération auto des visites + affectation technicien | Remplace l'Excel du dispatcher |
| 5 | Mobile technicien **offline-first** : tournée, checklist, photos, signature | Le terrain n'adoptera rien d'autre |
| 6 | Rapport PDF auto + **carnet d'entretien** append-only | Livrable légal de chaque visite |
| 7 | Import parc CSV | Sans migration, pas d'onboarding |

### P1 — Vendable : transforme l'outil en produit qu'on achète

8. Tableau de bord conformité (visites dues/faites/en retard, alertes).
9. Devis (depuis intervention) → facture → export compta ; facturation des contrats.
10. Triage des signalements : critique vs « à la prochaine visite » (inspiration KONE).
11. Notifications email/push (technicien, back-office).
12. Assistant migration Progilift (import enrichi : contrats + historique).

### P2 — Différenciant : ce qui fait gagner contre Progilift/Praxedo

13. **Portail client syndic/copro** : parc, visites, pannes, carnet consultable.
14. Preuve de passage (géoloc + horodatage + photos) visible client.
15. Demande d'intervention en ligne + suivi statut.
16. Score santé/conformité par appareil + export rapport AG.
17. Licences allégées technicien / admin sur tablette.

### P3 — Scale : efficacité et écosystème

18. Optimisation de tournées, gestion des astreintes (routage P0 personne bloquée).
19. API publique + webhooks.
20. Connecteurs compta (Pennylane, Sage) + paiement SEPA (GoCardless/Stripe).
21. QR code cabine : signalement usager.
22. Base de connaissance pannes (inspiration TKE Virtual Coach).
23. Rapport « moderniser ou réparer » (inspiration KONE asset management).

### Parking (décision datée, pas de dev)

- Facturation électronique (Factur-X / PDP) : instruire au démarrage de la Phase 3, prêt avant le 01/09/2027 — `08-facturation-electronique.md`.

### P4 — Backlog long terme

24. Ingestion télésurveillance/IoT tiers. 25. Supervision syndic multi-prestataires. 26. Extension portes automatiques/escalators. 27. i18n / export BE-CH. 28. Marketplace pièces.

## Planning de développement

> Hypothèse : 1 dev à plein temps (ajuster si équipe). Stockage sans BDD (ADR-001).

| Phase | Durée | Contenu | Jalon de sortie |
|---|---|---|---|
| **Phase 0 — Fondations** | 3–4 sem. | Monorepo, CI, conventions, squelette API + repositories JSON, auth basique, modèle de données codé (`packages/domain`) | `pnpm dev` lance API+web ; 1er OT créé en API ; tests verts en CI |
| **Phase 1 — Back-office P0** | 6–8 sem. | Parc, contrats, moteur d'échéances, planning, OT (features 1–4, 7) | Démo : import d'un parc réel, planning annuel généré |
| **Phase 2 — Terrain P0** | 6–8 sem. | App mobile offline, checklists, rapport PDF, carnet (features 5–6) | Recette « mode avion : 5 visites, sync OK » ; 1er design partner en prod |
| **Phase 3 — Vendable P1** | 6 sem. | Conformité, devis/facturation, triage, notifications, migration Progilift (8–12) | 3 design partners facturent via l'outil |
| **Phase 4 — Portail P2** | 6–8 sem. | Portail client, preuve de passage, score, demandes en ligne (13–17) | 1er syndic actif ; argument de vente n°1 démontrable |
| **Phase 5 — Scale P3** | continu | 18–23 par ordre de traction commerciale | 20 clients payants |

Total jusqu'à fin Phase 4 : **~7–9 mois** solo. Chaque phase se termine par une release utilisable — jamais plus de 8 semaines sans mise en prod chez un utilisateur réel.

## Règles de gestion du backlog

- Une feature n'entre en développement qu'avec : persona cible + pain point référencé (`01-pain-points-opportunites.md`) + critère de démo.
- Toute demande client design partner passe par ce backlog (pas de dev « en direct »).
- Re-priorisation à chaque fin de phase, pas en cours de phase.
