# Build the static SPA, then serve it from nginx.
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @fitfiller/web...
COPY apps/web apps/web
# VITE_API_BASE_URL is baked at build time; default to same-origin /api.
ARG VITE_API_BASE_URL=/api
ARG VITE_MAP_STYLE
RUN pnpm --filter @fitfiller/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
