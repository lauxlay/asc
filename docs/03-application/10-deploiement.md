# Déploiement — Docker, VPS et Dokploy

> Statut : opérationnel pour la partie livrée en lot **L0.6**. Applique l'ADR-002.

## Ce que produit le repo

Une **image unique** (`Dockerfile`) qui sert l'API **et** le back-office buildé : un seul point d'entrée, un seul certificat, pas de CORS.

```
/                      → back-office (React, PWA)
/login, /planning…     → repli sur index.html (liens profonds)
/api/*                 → API NestJS
/api/health            → sonde de vivacité (publique)
/data                  → volume persistant : JSON et fichiers (ADR-001)
```

Le process tourne en utilisateur non privilégié (`node`), et **tout l'état vit dans `/data`** — rien n'est écrit ailleurs dans le container.

## En local

```bash
cp .env.example .env          # renseigner JWT_SECRET : openssl rand -base64 48
docker compose up --build
docker compose exec app node apps/api/dist/seed.js   # jeu de démonstration
```

Le back-office répond sur `http://localhost:3000`.

Le développement au quotidien reste **hors Docker** (`pnpm dev`, rechargement à chaud) : le compose sert à vérifier l'artefact réel, pas à écrire du code.

## Variables d'environnement

| Variable | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `JWT_SECRET` | **oui** | — | Signature des jetons, 32 caractères minimum. Aucun défaut : un déploiement mal configuré échoue au démarrage |
| `PORT` | non | `3000` | Port d'écoute |
| `DATA_DIR` | non | `/data` | Racine du volume persistant |
| `WEB_DIST_DIR` | non | `/app/apps/web/dist` | Back-office buildé. Vide → l'API sert uniquement `/api` |
| `JWT_EXPIRES_IN` | non | `28800` | Validité d'un jeton, en secondes |

## Staging sur VPS avec Dokploy

> **Non réalisé dans ce lot** : cela demande un VPS et une instance Dokploy. La marche à suivre ci-dessous est prête à exécuter.

1. **VPS européen** (Hetzner CX22 ou équivalent, ~5 €/mois), Debian 12, puis installation de Dokploy :
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```
2. **Application** dans Dokploy : type *Docker Compose* (ou *Application* pointant sur le `Dockerfile`), source = ce dépôt GitHub, branche `main`.
3. **Domaine** `staging.<domaine>` avec certificat Let's Encrypt automatique.
4. **Variables** : `JWT_SECRET` généré spécifiquement pour le staging, jamais partagé avec la production.
5. **Volume** : monter `asc-data` sur `/data`. C'est la seule donnée à sauvegarder.
6. **Sonde** : `/api/health` — Dokploy s'en sert pour ne router le trafic que sur un container prêt.
7. **Premier démarrage** : lancer le seed une fois pour créer le compte de démonstration.
   ```bash
   docker compose exec app node apps/api/dist/seed.js
   ```
8. **Déploiement continu** : activer le webhook GitHub de Dokploy sur `main`. Un merge déclenche build puis déploiement.

### Sauvegardes

`/data` est le seul état. Sauvegarde nocturne hors du serveur (ADR-002) :

```bash
rclone sync /var/lib/docker/volumes/asc-data/_data s3-scaleway:asc-backups/$(date +%F)
```

Test de restauration **trimestriel** (`06-securite-rgpd.md`).

### Passage en production

Même image, deuxième application Dokploy sur le domaine de production, avec son propre `JWT_SECRET` et son propre volume. Le staging reste sur le même VPS — coût nul.

## Limite connue

Le stockage fichiers impose **une seule instance** (ADR-001) : pas de montée en charge horizontale avant la migration PostgreSQL. Le verrou n'est pas Docker, c'est le stockage — et Docker rend justement cette migration indolore, seule l'image changera.
