# ADR-003 — Back-office en PWA (client « lourd »)

> Statut : validé | Date : 2026-08-12 | Décideurs : Jorys

## Contexte

Le dispatcher vit dans l'outil 8 h/jour (`02-produit/07-principes-ux.md`). Une app installable — icône, fenêtre dédiée plein écran, démarrage instantané — donne l'effet « client lourd » d'un Progilift sans les inconvénients (pas d'installation MSI, mises à jour transparentes).

## Décision

**`apps/web` (back-office) devient une PWA installable.** Le portail syndic reste un site web classique (usage occasionnel, SEO). L'app technicien reste native Expo (ADR : offline-first — iOS peut purger le stockage d'une PWA et n'offre pas de background sync fiable, rédhibitoire pour le terrain).

## Périmètre technique

- **Manifest + service worker** via `vite-plugin-pwa` (Workbox) : installable desktop/mobile, icônes, thème, écran de démarrage.
- **Stratégie de cache** :
  - App shell (JS/CSS/fonts) : precache → démarrage instantané, fonctionne au premier affichage même réseau lent.
  - Données API : network-first avec fallback cache (lecture seule) — le dispatcher peut CONSULTER planning/parc récents en coupure réseau.
  - **Pas d'écriture offline côté back-office** : la saisie exige le réseau (mono-instance, pas d'outbox web). L'offline d'écriture reste l'exclusivité du mobile technicien. Bandeau discret « hors ligne — lecture seule » le cas échéant.
- **Mises à jour** : SW `autoUpdate` + toast « nouvelle version, recharger » — jamais de version figée chez un client.
- Raccourcis manifest (nouvelle panne, planning) ; notifications push web : plus tard (P3, avec `03-application/04`).

## Conséquences

- Lot Phase 0 : la config PWA s'ajoute à **L0.5** (squelette web) — coût faible si fait dès le départ, pénible en retrofit.
- Les e2e Playwright testent aussi le mode dégradé lecture seule (réseau coupé → planning consultable, saisie bloquée proprement).
- La CI vérifie que le precache ne casse pas les déploiements (versionnement des assets géré par le plugin).
- Le portail pourra devenir PWA plus tard si l'usage le justifie — rien ne l'empêche, décision réversible.
