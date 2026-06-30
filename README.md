# fitfiller

[![CI](https://github.com/thomascamminady/fitfiller/actions/workflows/ci.yml/badge.svg)](https://github.com/thomascamminady/fitfiller/actions/workflows/ci.yml)
[![Deploy](https://github.com/thomascamminady/fitfiller/actions/workflows/deploy.yml/badge.svg)](https://github.com/thomascamminady/fitfiller/actions/workflows/deploy.yml)

Ever stopped your watch at a red light only to realize three kilometers later
that you forgot to unpause and now your hard-earned kilometres are gone?
Cry no more, `fitfiller` helps you fill in the gaps of your latest activity and
recreates a new .fit file that you can upload.

## Features

- Upload a .fit file and see it visualized on a map
- Iterate through all your paused segments and fill in the gaps if wanted
- Trace the route that you actually ran
- Recreate the .fit file, download it, and upload it anywhere

## Premium features

- Query elevation data from trusted sources and write them to the .fit file
- Grade-adjusted pace instead of average pace

---

## How it works

1. **Decode** — the uploaded `.fit` is parsed with the official Garmin FIT SDK.
   Records, laps and timer `start`/`stop` events become a clean domain model.
2. **Detect pauses** — timer stop→start pairs (and large record time-gaps) are
   turned into `PauseSegment`s, each bounded by the last point before and first
   point after the gap.
3. **Fill** — you trace the route you actually ran. fitfiller distributes the
   pause time (minus your real break) along that route at constant pace — or
   grade-adjusted pace with elevation (premium) — and synthesizes records, with
   heart rate / cadence filled from the surrounding data.
4. **Re-encode** — the new records are spliced back in, subsequent distances are
   shifted, the bridged timer events are dropped, and session/lap totals are
   updated. Out comes a valid `.fit` ready to upload anywhere.

## Architecture

A pnpm + Turborepo monorepo. The frontend is a thin client; all FIT logic lives
behind the API.

```
packages/core   Framework-agnostic domain logic (decode, pause detect, gap
                fill, encode, geo + elevation). Fully unit-tested. No HTTP.
apps/api        Fastify REST API. Provider-agnostic auth + premium boundary,
                in-memory activity store, elevation provider, fill service.
apps/web        Vite + React + MapLibre. Upload, map, pause stepper, route
                drawing, export. Talks only to the API.
```

The auth/premium boundary (`apps/api/src/auth`) is an interface with a dev
implementation; swapping in real sessions + Stripe entitlement later means
implementing `AuthProvider` without touching routes. Elevation is likewise a
pluggable `ElevationProvider`.

## Develop

A `Makefile` wraps the common tasks (run `make help` to list them):

```bash
make dev      # install + build core + run API and web together (live reload)
make check    # typecheck + all tests (the full quality gate)
make sample   # write a test .fit with a forgotten pause to /tmp/sample-run.fit
make stop     # stop stray dev servers
```

Equivalent raw commands:

```bash
pnpm install
cp .env.example apps/api/.env

# in two terminals (or `pnpm dev` to run all via turbo)
pnpm --filter @fitfiller/api dev   # http://localhost:3001
pnpm --filter @fitfiller/web dev   # http://localhost:5173 (proxies /api)
```

## Testing

Every compartment is tested. From the repo root:

```bash
pnpm -r test         # run all suites (core + api + web)
pnpm -r typecheck    # strict type checks across the monorepo
pnpm -r build        # ensure everything compiles/bundles
```

Run or watch a single package:

```bash
pnpm --filter @fitfiller/core test          # domain logic (59 tests)
pnpm --filter @fitfiller/api  test          # HTTP routes + services (22 tests)
pnpm --filter @fitfiller/web  test          # client + components (31 tests)

pnpm --filter @fitfiller/core exec vitest   # watch mode
pnpm --filter @fitfiller/core exec vitest run gap-fill   # one file
```

What each suite covers:

- **core** — geo math, semicircle conversions, pause detection (events +
  time-gap fallback), the gap-fill engine (pace, break handling, HR/cadence/
  elevation, grade adjustment), and full FIT decode→fill→encode round-trips
  including multi-gap distance shifting. Uses an in-test FIT builder
  (`src/__tests__/fixtures.ts`) — no binary test files needed.
- **api** — upload/parse/preview/export routes via Fastify `inject` (no socket),
  validation 400s, unknown-activity 404s, premium gating 402s, and `FillService`
  unit tests with a faked elevation provider.
- **web** — formatters, the typed API client (mocked `fetch`), `Landing` and
  `PauseInspector` component behaviour, and an `App` flow test (MapLibre and the
  API are mocked) covering upload → editor and the legal modal.

Coverage (optional): add `@vitest/coverage-v8` to a package, then
`pnpm --filter <pkg> exec vitest run --coverage`.

### Key env vars (`apps/api/.env`)

| Var                  | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `AUTH_PROVIDER`      | `dev` \| `none` \| `stripe` (stripe is a stub) |
| `DEV_FORCE_PREMIUM`  | unlock premium features locally                |
| `ELEVATION_PROVIDER` | `none` \| `opentopodata` \| `open-elevation`   |
| `CORS_ORIGIN`        | comma-separated allowed web origins            |

## CI / CD

Two GitHub Actions workflows, both in `.github/workflows`:

- **CI** (`ci.yml`) runs on every push and pull request: it installs with a
  frozen lockfile, then checks formatting, types, tests, and a production
  build across the whole monorepo. Reproduce it locally with `pnpm ci`.
- **Deploy** (`deploy.yml`) runs on every push to `main`: it builds the web
  and API images and publishes them to the GitHub Container Registry
  (`ghcr.io/<owner>/fitfiller-web` and `-api`), tagged `latest` and the commit
  SHA. A second, optional job rolls those images out to a Hetzner host.

### Enabling automatic rollout

The deploy job stays skipped until you opt in. In the repo settings add:

- Variable `DEPLOY_ENABLED` = `true`
- Secrets `HETZNER_HOST`, `HETZNER_USER`, `HETZNER_SSH_KEY`, `HETZNER_APP_DIR`
  (the directory on the host holding `docker-compose.prod.yml` + `Caddyfile`)

On the host, place `docker-compose.prod.yml` and `Caddyfile`, point your
domain's A/AAAA records at the server, and set the same env vars used below.
Each push to `main` then pulls the new images and restarts the stack.

## Deploy (Hetzner, single host)

`docker-compose.yml` builds both images locally and fronts them with Caddy
(automatic TLS). On a fresh Hetzner box with Docker installed:

```bash
# point your domain's A/AAAA records at the server, then edit:
#   Caddyfile        -> your domain
#   .env / compose   -> PUBLIC_ORIGIN, AUTH_PROVIDER, ELEVATION_*
docker compose up -d --build
```

To run the published GHCR images instead of building, use
`docker-compose.prod.yml` (this is what CD does):

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Caddy routes `/api/*` to the API and everything else to the static SPA.

## Legal

Impressum, GDPR privacy notice and license attributions live in
`apps/web/src/components/Legal.tsx`. **The bracketed `[...]` fields are
placeholders and must be completed before going live** — a real Impressum is
legally required in Germany (TMG §5).

## License & attribution

Built on the Garmin FIT JavaScript SDK (FIT Protocol License), MapLibre GL JS
(BSD-3-Clause), React, Fastify, Vite and Zod (MIT).
