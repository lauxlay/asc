# Business model & pricing

> Statut : draft

## Modèle

SaaS B2B par abonnement, facturé à la société de maintenance. Le portail client (syndic/copro) est inclus — c'est un canal d'acquisition, pas un coût.

## Grille indicative (à valider par interviews)

| Plan | Cible | Prix indicatif | Contenu |
|---|---|---|---|
| Starter | 1–5 techniciens | 49 €/mois + 25 €/tech | Parc, visites, interventions, mobile offline |
| Pro | 5–20 techniciens | 99 €/mois + 35 €/tech | + planning optimisé, devis/facturation, portail client |
| Business | 20+ | Sur devis | + API, multi-agences, SSO, SLA |

**Correction du pain point Praxedo** : licence « technicien terrain » allégée (mobile seul) moins chère que la licence back-office. Admin accessible sur tablette sans licence dédiée.

## Leviers de revenus additionnels

- Module facturation / prélèvement SEPA (commission ou add-on).
- Offre « Supervision » vendue aux syndics gérant plusieurs ascensoristes (multi-prestataires).
- Marketplace pièces détachées (long terme).

## Taille de marché (données Fédération des Ascenseurs, 2025)

- Secteur FR : 661 000 appareils, 2,83 Md€ de CA, 17 200 salariés.
- ~170 entreprises adhérentes Fédération + ~180 indépendantes hors fédération → **~300–350 sociétés**, dont 4 majors (Otis, KONE, Schindler, TKE) qui concentrent la majorité du CA et ont leurs outils internes.
- **Cible adressable : ~250–300 TPE/PME/ETI**, gérant estimativement 20–30 % du parc (~130 000–200 000 appareils).

### Segmentation & potentiel ARR (grille ci-dessus)

| Segment | Nb estimé | Panier/mois | ARR/client | ARR segment |
|---|---|---|---|---|
| TPE (1–4 tech) | ~150 | ~150 € | 1 800 € | ~270 k€ |
| PME (5–20 tech) | ~100 | ~450 € | 5 400 € | ~540 k€ |
| ETI (20–100 tech) | ~40–50 | ~1 500 € | 18 000 € | ~800 k€ |
| **SAM ascensoristes FR** | **~300** | | | **~1,6 M€/an** |

Extensions du SAM : sociétés multi-techniques faisant de l'ascenseur, portes automatiques / escaliers mécaniques, offre supervision syndics, Belgique/Suisse → potentiel 3–5 M€ ARR.

### Objectifs réalistes (SOM)

- An 1 : 10–15 clients (design partners convertis + early adopters) ≈ 40–80 k€ ARR.
- An 3 : 40–60 clients (15–20 % de pénétration) ≈ 250–450 k€ ARR.
- Le marché FR seul ne fait pas une licorne : c'est un business rentable de niche, ou une plateforme à étendre (multi-métiers, multi-pays) — à trancher.

## Modèle de paiement vs Progilift

Progilift vend à l'ancienne : licence sur devis + contrat de maintenance annuel, installation, engagement — coût d'entrée élevé et opaque. Notre contre-modèle :

1. **Prix publics affichés** sur le site (rare dans le métier → différenciateur de confiance).
2. **Abonnement mensuel sans engagement** (annuel = –2 mois) vs licence + engagement.
3. **Essai 30 jours + migration Progilift offerte** → coût de switch ≈ 0.
4. **Licence technicien terrain allégée** (~50 % du prix back-office) — corrige le pain point Praxedo.
5. **Option pricing à l'appareil** (~1–1,50 €/appareil/mois, planchers par plan) : aligné sur notre north star metric et sur la valeur perçue (« 1 €/ascenseur/mois pour être conforme »), prévisible pour le client. À tester en A/B sur les design partners vs prix par technicien.
6. **Tarif fondateur à vie** pour les 10 premiers clients (verrouille les références).

> ⚠️ Estimations internes à valider : répartition TPE/PME/ETI par interviews + données Fédération ; prix Progilift réels à obtenir (démo commerciale / clients migrés).

Sources : [Fédération des Ascenseurs — chiffres clés](https://www.ascenseurs.fr/notre-federation/les-chiffres-cles/), [Fédération — adhérents](https://www.ascenseurs.fr/nos-adherents/)
