# Analyse concurrentielle

> Statut : draft

## Progilift (JMB Software)

Logiciel SAV/maintenance conçu pour les ascensoristes, conforme aux normes françaises. Modules : maintenance (visites périodiques), interventions sur panne, devis, facturation, rapports d'activité, suivi qualité.

**Forces**

- Profondeur métier ascensoriste FR : cycles de visites, réglementaire, facturation contrats.
- Couvre le cycle complet : planification → intervention → facturation.
- Base installée et notoriété chez les indépendants.

**Faiblesses (à exploiter)**

- UX datée, courbe d'apprentissage, logique client lourd / legacy.
- Pas de portail client final (syndic/copro aveugle).
- Écosystème fermé : API/intégrations limitées (compta, ERP syndic).
- Mobile terrain en retrait vs standards actuels.

## Praxedo

Field service management généraliste (planification, optimisation de tournées, app mobile, ordres de travail), positionné mid-market/enterprise.

**Forces**

- Planning et optimisation de tournées excellents.
- App mobile technicien mature, formulaires d'intervention configurables.
- Multi-secteurs, scalable.

**Faiblesses (à exploiter)**

- **Pas de métier ascenseur** : ni carnet d'entretien réglementaire, ni contrats types, ni contrôle quinquennal.
- **Offline insuffisant** : techniciens bloqués en zone blanche (cave, gaine, sous-sol — précisément là où on intervient sur un ascenseur).
- **Intégrations limitées** hors écosystème Praxedo.
- **Licences rigides** : pas de licence allégée pour techniciens à besoins réduits, pas d'admin sur mobile/tablette.
- Surdimensionné et cher pour les petites structures (cible = PME ascensoristes).

## Autres acteurs à surveiller

- **Huoltu** : gestion d'interventions avec verticale ascensoriste — concurrent direct émergent.
- **Fabrico, FM at Work** : GMAO généralistes avec discours ascenseur.
- Outils internes des majors (Otis ONE, KONE 24/7, Schindler Ahead, TKE MAX) : hors cible mais fixent les attentes des syndics → analyse détaillée et features à reprendre dans `06-benchmark-majors.md`.

## Synthèse — notre pari

| | Progilift | Praxedo | Nous |
|---|---|---|---|
| Métier ascenseur FR | ✅ | ❌ | ✅ |
| Planning / tournées | ➖ | ✅ | ✅ |
| Mobile offline-first | ➖ | ❌ | ✅ |
| Portail client (syndic/copro) | ❌ | ❌ | ✅ |
| API ouverte | ❌ | ➖ | ✅ |
| Pricing PME flexible | ➖ | ❌ | ✅ |

Sources : [Progilift](https://www.progilift.fr/decouvrir-progilift/), [JMB Software](https://www.jmb.fr/progilift/), [Gartner Peer Insights — Praxedo](https://www.gartner.com/reviews/market/field-service-management/vendor/praxedo/product/praxedo-field-service-management), [TEC — Praxedo](https://www3.technologyevaluation.com/solutions/62232/praxedo), [Huoltu ascensoriste](https://www.huoltu.com/metier/ascensoriste/)
