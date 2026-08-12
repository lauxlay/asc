# ADR-002 — Déploiement : Docker + VPS + PaaS self-hosted

> Statut : validé | Date : 2026-08-11 | Décideurs : Jorys

## Contexte

Besoin : déployer facilement, mettre à jour souvent, coût minimal, hébergement UE (RGPD), et un chemin de scaling sans ré-architecture. Contraintes existantes : monolithe mono-process + stockage fichiers JSON sur disque (ADR-001) → il faut un volume persistant et une seule instance de l'API.

## Décision

**Docker dès la Phase 0**, déployé sur un **VPS européen** (Hetzner ~5–15 €/mois, ou Scaleway/OVH si 100 % FR exigé) via **Dokploy ou Coolify** — des PaaS open-source self-hosted (Heroku-like) très actifs : push git → build → déploiement, SSL automatique (Let's Encrypt), rollbacks, logs, zéro config serveur manuelle.

### Ce que ça donne concrètement

- `Dockerfile` pour `apps/api` (qui sert aussi le web buildé), `docker-compose.yml` pour le dev local — l'environnement de dev = celui de prod, fin des « ça marche chez moi ».
- Déploiement : merge sur `main` → GitHub Actions build l'image → Dokploy/Coolify la déploie. Mise à jour = un git push.
- `data/` (JSON + photos) monté en volume persistant, sauvegardé chaque nuit hors du serveur (rclone vers un object storage S3 Scaleway, quelques centimes/mois).
- Portail Next.js et web statique : servis par le même serveur au début (un seul point d'entrée, reverse proxy géré par l'outil).

## Options considérées

1. **VPS + Dokploy/Coolify (choisi)** — ~10 €/mois tout compris, contrôle total, UE, communautés larges et très actives. Charge ops quasi nulle une fois installé.
2. **PaaS managés (Railway, Render, Fly.io)** — encore plus simples, mais sociétés US (RGPD à instruire), coûts qui grimpent vite avec volumes persistants, moins de contrôle.
3. **Scaleway Serverless Containers / AWS** — serverless incompatible avec notre stockage fichiers local (pas de disque persistant fiable) ; pertinent seulement après migration Postgres.
4. **Kubernetes** — surdimensionné, dette opérationnelle massive pour un solo. Non.

## Chemin de scaling (aligné sur les phases de stockage)

| Étape | Infra | Coût | Déclencheur |
|---|---|---|---|
| Phase 0–1 | 1 VPS (2 vCPU/4 Go), 1 container API, volume `data/` | ~10 €/mois | maintenant |
| Croissance | VPS plus gros (vertical) — largement suffisant jusqu'à des dizaines de tenants | 20–40 €/mois | CPU/RAM saturés |
| Phase 2 stockage | + PostgreSQL managé (Scaleway ~15 €/mois) → l'API devient stateless → **plusieurs containers + load balancer possibles** | 50–100 €/mois | migration Postgres (ADR-001) |
| Plus tard | Multi-serveurs via le même Dokploy, ou bascule PaaS managé | selon charge | > centaines de tenants |

Le vrai verrou de scalabilité n'est pas Docker, c'est le stockage fichiers (mono-instance). Docker rend justement la levée de ce verrou indolore : le jour de la migration Postgres, seule l'image change.

## Conséquences

- La CI (07-phase0-fondations.md) gagne une étape `docker build` + healthcheck.
- Discipline : aucun état hors du volume `data/` (pas de fichiers écrits ailleurs dans le container).
- Staging = même VPS, deuxième container sur un sous-domaine — coût nul.
- Test de restauration de sauvegarde : trimestriel (cf. 06-securite-rgpd.md).
