# fitfiller

[![Deploy to GitHub Pages](https://github.com/thomascamminady/fitfiller/actions/workflows/pages.yml/badge.svg)](https://github.com/thomascamminady/fitfiller/actions/workflows/pages.yml)

**[fit-filler.com](https://fit-filler.com)** — a free, open-source tool by
[Thomas Camminady](https://github.com/thomascamminady).

Ever stopped your watch at a red light only to realize three kilometers later
that you forgot to unpause and now your hard-earned kilometres are gone?
Cry no more, `fitfiller` helps you fill in the gaps of your latest activity and
recreates a new .fit file that you can upload.

It runs **entirely in your browser** — your `.fit` file never leaves your
device. There is no server, no account and no tracking.

## Features

- Upload a .fit file and see it on a map
- Step through every paused segment; each is flagged as a real break, a gap
  that needs fixing, or already fixed
- Fill a gap by tracing the route you actually ran — or let **Snap to path**
  follow real roads and trails
- Add **real elevation** sampled along the route, and **grade-adjusted pace**
  (constant effort instead of constant pace)
- Heart-rate + elevation timeline, a before/after diff and an integrity check
- Re-encode and download a clean `.fit` to upload anywhere

Everything is free. There is no paid tier.

## How it works

1. **Decode** — the `.fit` is parsed in the browser with the official Garmin
   FIT SDK. Records, laps and timer `start`/`stop` events become a clean model.
2. **Detect pauses** — timer stop→start pairs (and large record time-gaps)
   become `PauseSegment`s, bounded by the last point before and first after.
3. **Fill** — pause time (minus your real break) is distributed along the route
   at constant or grade-adjusted pace; records are synthesized with heart rate /
   cadence filled from the surrounding data.
4. **Re-encode** — the new records are spliced in, later distances shifted, the
   bridged timer events dropped, and session/lap totals updated. Out comes a
   valid `.fit`.

Optional **Snap to path** (BRouter) and **real elevation** (Open-Meteo) call
free, key-less public services with only the gap's coordinates, and fall back
gracefully if unavailable.

## Architecture

A pnpm + Turborepo monorepo. No backend — the app is fully static.

```
packages/core   Framework-agnostic domain logic (decode, pause detect, gap
                fill, encode, geo, elevation + routing providers). Unit-tested.
apps/web        Vite + React + MapLibre SPA. The FIT compute runs client-side
                in src/api.ts using @fitfiller/core.
```

## Develop

```bash
make dev          # core build + Vite dev server on http://localhost:5173
make check        # typecheck + tests
make build        # static site into apps/web/dist
make preview      # serve the production build
```

(Or use `pnpm` directly: `pnpm install`, `pnpm -r build`, `pnpm -r test`.)

## Deploy (GitHub Pages + custom domain)

`.github/workflows/pages.yml` builds the static site and publishes it to GitHub
Pages on every push to `gh-pages-static`. `apps/web/public/CNAME` pins the
custom domain `fit-filler.com`.

One-time setup:

1. **Repo → Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Custom domain:** enter `fit-filler.com` (this matches the `CNAME` file).
   Enable "Enforce HTTPS" once the certificate is issued.
3. **DNS at your registrar** — point the apex domain at GitHub Pages:
   - Four `A` records → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - (optional) a `CNAME` for `www` → `thomascamminady.github.io`

## Privacy & legal

The `.fit` file is processed locally and never uploaded. Optional services
(map tiles, elevation, routing) receive only the coordinates needed for that
feature. The Impressum (§ 5 DDG) and GDPR notice are in
`apps/web/src/components/Legal.tsx`.

## License & attribution

Built on the Garmin FIT JavaScript SDK (FIT Protocol License), MapLibre GL JS
(BSD-3-Clause), React, Vite and Zod (MIT). Map tiles by OpenFreeMap /
OpenMapTiles, data © OpenStreetMap contributors. Routing by BRouter, elevation
by Open-Meteo.
