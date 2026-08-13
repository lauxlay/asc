# syntax=docker/dockerfile:1

# Image unique servant l'API et le back-office buildé (ADR-002).
# Un seul point d'entrée, un seul certificat, pas de CORS.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app


# --- Dépendances -------------------------------------------------------------
# Les manifestes seuls d'abord : tant qu'aucune dépendance ne change, Docker
# réutilise cette couche même quand tout le code a changé.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/portal/package.json ./apps/portal/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/ui/package.json ./packages/ui/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile


# --- Build -------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm turbo run build --filter=@asc/api --filter=@asc/web


# --- Dépendances de production ----------------------------------------------
# Réinstallation sans les devDependencies : ni TypeScript, ni Vite, ni Vitest
# n'ont à voyager dans l'image finale.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/portal/package.json ./apps/portal/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/ui/package.json ./packages/ui/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @asc/api...


# --- Runtime -----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV PORT=3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/contracts/node_modules ./packages/contracts/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/

COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Tout l'état vit dans le volume, rien ailleurs (ADR-002). Le dossier appartient
# à l'utilisateur non privilégié qui fait tourner le process.
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
