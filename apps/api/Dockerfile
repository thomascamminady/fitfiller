# Multi-stage build for the Fastify API.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /app
# Copy manifests first for cached installs.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter @fitfiller/core build && pnpm --filter @fitfiller/api build
# Prune to production deps.
RUN pnpm --filter @fitfiller/api --prod deploy /out

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/server.js"]
