# Features & MVP

> Statut : draft

## Périmètre MVP (cible : 4–6 mois)

### 1. Gestion de parc

- Fiche appareil : localisation, caractéristiques techniques, contrat associé, documents (plans, notices), QR code.
- Fiche site/immeuble : contacts (syndic, gardien), codes d'accès, consignes.
- Import CSV/Excel du parc existant (migration Progilift).

### 2. Contrats & conformité

- Contrats types minimal / étendu (arrêté du 7 novembre 2012), clauses personnalisables.
- Moteur d'échéances : visites toutes les 6 semaines max, contrôle technique quinquennal, échéances contractuelles.
- Tableau de bord conformité : visites dues / faites / en retard par appareil.

### 3. Planification & interventions

- Planning drag & drop par technicien, vue semaine/mois, génération automatique des visites périodiques.
- Types d'OT : visite d'entretien, dépannage, réparation, travaux, contrôle.
- Insertion d'urgence : suggestion du technicien le plus proche/disponible.

### 4. Mobile technicien (offline-first)

- Tournée du jour, navigation, fiche appareil complète hors ligne.
- Checklist de visite configurable (points de contrôle réglementaires pré-remplis).
- Photos, pièces posées, temps passé, signature client, rapport PDF auto.
- Sync automatique au retour du réseau.

### 5. Carnet d'entretien numérique

- Alimenté automatiquement par chaque intervention (append-only, horodaté).
- Export PDF conforme, consultable par le client.

### 6. Devis & facturation (v1 simple)

- Devis depuis une intervention (pièces + main d'œuvre), acceptation en ligne.
- Facturation des contrats (échéancier) et des interventions hors contrat, export compta.
- ⚠️ Facturation électronique (obligation TPE/PME au 01/09/2027) : décision parquée, mais modèle de données compatible Factur-X dès le départ — voir `08-facturation-electronique.md`.

## v1.1 — Portail client (différenciateur)

- Accès syndic/copro : parc, visites réalisées (preuve de passage), pannes en cours, carnet, documents.
- Demande d'intervention en ligne + suivi statut.
- Score de conformité et export AG.

## v2+

- Optimisation de tournées (multi-contraintes), QR code usager en cabine, astreintes,
  connecteurs compta, API publique, télésurveillance IoT, module supervision syndic multi-prestataires.

## Hors scope (assumé)

- Paie, RH, gestion de stock avancée (simple liste de pièces au départ), multi-langue (FR only au MVP).
