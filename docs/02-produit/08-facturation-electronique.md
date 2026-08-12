# Facturation électronique — réflexion ultérieure

> Statut : **parking** — décision à instruire avant la Phase 3 (facturation). Rien à coder au MVP, mais le contexte réglementaire est daté et non négociable.

## Ce que dit la réforme (état août 2026)

- **1er septembre 2026** : toutes les entreprises FR doivent pouvoir **recevoir** des factures électroniques via une PDP (plateforme de dématérialisation partenaire) ; grandes entreprises et ETI doivent aussi **émettre**.
- **1er septembre 2027** : obligation d'**émission** étendue aux TPE/PME — c'est-à-dire à **tous nos clients ascensoristes**.
- Formats autorisés : **Factur-X** (PDF + XML hybride, le plus adapté aux PME), UBL, CII.
- Calendrier déjà reporté deux fois, désormais considéré comme définitif.

## Impact sur notre produit

Nos clients facturent des professionnels (syndics, bailleurs) → leurs factures B2B tomberont sous l'obligation dès 09/2027. Un module de facturation qui ne produit que du PDF simple sera **illégal pour eux** à cette date. Inversement, Progilift devra aussi s'adapter — fenêtre d'opportunité si on est prêt avant.

## Options (à trancher plus tard, avant Phase 3)

1. **Ne pas devenir PDP** (quasi certain) : l'immatriculation PDP est un métier réglementaire lourd — hors scope définitif.
2. **Générer du Factur-X + laisser le client transmettre** via sa PDP / son expert-comptable (Pennylane, Sage… sont ou seront PDP). Effort minimal, dépend de l'outillage du client.
3. **Intégrer une PDP partenaire en marque blanche via API** : nos factures partent directement dans le circuit légal depuis notre UI. Meilleure UX, un partenariat à négocier — probablement la bonne cible.

## Ce qu'on fait quand même dès le MVP (sans effort supplémentaire)

- Modèle de données facture **compatible Factur-X** : SIREN/SIRET client et émetteur, TVA détaillée par taux, mentions obligatoires, numérotation séquentielle inaltérable — champs à prévoir dans `contracts` dès le départ pour ne pas migrer dans la douleur.
- Statuts de facture alignés sur le cycle de vie de la réforme (émise, déposée, rejetée, encaissée).
- Aucune promesse commerciale sur la conformité e-invoicing avant la décision.

## Échéance de décision

Instruire au démarrage de la Phase 3 (module facturation), au plus tard T1 2027 pour être prêt avant le 01/09/2027.

Sources : [Urssaf](https://www.urssaf.fr/accueil/actualites/facturation-electronique.html), [Service-Public](https://entreprendre.service-public.gouv.fr/vosdroits/F23208?lang=fr), [Cegid — calendrier](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/), [Pennylane — réforme](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/reforme-facturation-electronique)
