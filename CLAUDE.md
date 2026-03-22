# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UK Staycation Price & Deal Watcher — monitors prices across UK holiday providers (Hoseasons, Haven, Center Parcs, Butlins, ParkDean, Away Resorts), tracks historical prices, and sends smart email alerts when genuine deals are detected.

The actual codebase lives in `MyStaycation/` (one level down from this file).

## Commands

### Development (Docker — recommended)

```bash
cd MyStaycation
cp .env.example .env        # then edit .env with credentials
./start.sh                  # starts all services with --rebuild
# or: docker-compose --profile dev up -d

docker-compose exec api node dist/seeds/index.js   # seed database (production image — tsx not available)
docker-compose logs -f                 # tail all logs
```

Services: Web UI → http://localhost:3000 | API → http://localhost:4000

### Development (without Docker)

```bash
# Backend (port 4000)
cd MyStaycation/backend
npm install
npm run dev

# Frontend (port 3000) — separate terminal
cd MyStaycation/web
npm install
npm run dev
```

### Production

```bash
cd MyStaycation
./start-prod.sh             # includes nginx reverse proxy on port 80
```

Web UI and API served via nginx at http://localhost (API at /api path).

### Backend scripts (run from `MyStaycation/backend`)

```bash
npm run migrate             # run pending TypeORM migrations
npm run migrate:generate    # generate new migration from entity changes
npm run migrate:revert      # revert last migration
npm run seed                # seed database (dev only — uses tsx)
# In production container use: node dist/seeds/index.js
npm test                    # run Jest tests (70% coverage threshold)
npm run test:watch          # watch mode
npm run test:coverage       # coverage report
npm run lint                # ESLint
npm run format              # Prettier
```

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | Fastify (v4) + TypeScript |
| Frontend | Next.js 14 (App Router) + React 18 + Tailwind CSS |
| Database | PostgreSQL 16 via TypeORM |
| Job queue | Redis 7 + BullMQ |
| Web scraping | Playwright (JS-heavy sites) + Cheerio (static HTML) |
| Email | AWS SES (primary) + Nodemailer/SMTP (fallback) |
| Auth | JWT (Fastify-JWT) + bcrypt |
| Containers | Docker + Docker Compose + Nginx (prod) |

### Backend structure (`MyStaycation/backend/src/`)

- **`adapters/`** — one file per holiday provider, each extending `base.adapter.ts`. New providers are added here; see `docs/development/PROVIDER_GUIDE.md`.
- **`adapters/registry.ts`** — registers enabled adapters based on env flags (`PROVIDER_HAVEN_ENABLED`, etc.).
- **`entities/`** — 13 TypeORM entities: `User`, `HolidayProfile`, `Deal`, `PriceObservation`, `Alert`, `Insight`, `FetchRun`, `Provider`, `SearchFingerprint`, `SystemLog`, and others.
- **`routes/`** — Fastify route handlers: `auth`, `profiles`, `search`, `insights`, `alerts`, `users`, `admin`.
- **`services/`** — Business logic: `AuthService`, `AlertService`, `DealService`, `EmailService`, `InsightService`, `SystemLogger`; search sub-services under `services/search/`.
- **`jobs/`** — BullMQ job definitions (`queues.ts`, `scheduler.ts`) and workers under `jobs/workers/`: `monitor.worker.ts` (scraping), `alert.worker.ts` (email dispatch), `deal.worker.ts` (deal scanning), `insight.worker.ts` (price analysis).
- **`migrations/`** — TypeORM migration files; always generate rather than hand-edit.
- **`config/`** — `database.ts` (TypeORM config) and `redis.ts` (BullMQ connection).
- **`index.ts`** — Server entry point; registers plugins, middleware, and routes.

### Frontend structure (`MyStaycation/web/src/`)

- **`app/`** — Next.js App Router pages: `auth/` (login, register, verify, reset-password), `dashboard/` (profiles, alerts, settings, admin panel).
- **`components/`** — React components including provider-specific forms (e.g. `HoseasonsForm.tsx`) and `ui/` primitives.
- **`services/`** — Axios-based API client modules.

### Data flow

1. User creates a **HolidayProfile** with search criteria.
2. **Scheduler** enqueues monitor jobs (≈48h intervals + jitter) via BullMQ.
3. **Monitor worker** picks the correct adapter, scrapes the provider with Playwright or Cheerio, and stores a **PriceObservation**.
4. **Insight worker** analyses price history and flags good deals.
5. **Alert worker** sends email via SES/SMTP when a deal threshold is met; records an **Alert** in the DB.

### Key environment variables

```
# Required
POSTGRES_HOST / _PORT / _DB / _USER / _PASSWORD
REDIS_HOST / _PORT
JWT_SECRET              # min 32 chars
JWT_REFRESH_SECRET
EMAIL_PROVIDER          # ses | smtp
AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
EMAIL_FROM

# Provider toggles
PROVIDER_HAVEN_ENABLED=true
PROVIDER_HOSEASONS_ENABLED=true
SCRAPING_ENABLED=true
PLAYWRIGHT_ENABLED=true
PLAYWRIGHT_CONCURRENCY=1    # keep low to avoid detection

# App
NODE_ENV=development|production
APP_URL=http://localhost
CORS_ORIGIN=http://localhost:3000
```

See `.env.example` for the full list. Run `./setup-env.sh` for interactive setup.

## Synology NAS Deployment

Docker image: `ready2k/mystaycation-api:latest` (multi-arch: amd64 + arm64)

```bash
# Always build multi-arch so the NAS gets the correct platform variant
docker buildx build --platform linux/amd64,linux/arm64 \
  -f backend/Dockerfile -t ready2k/mystaycation-api:latest --push backend/

# Deploy on Synology
sudo docker compose -f /volume1/docker/my_staycation/compose.yaml pull api
sudo docker compose -f /volume1/docker/my_staycation/compose.yaml up -d --no-deps api

# Run seed (tsx not available in production image — use compiled JS)
sudo docker compose -f /volume1/docker/my_staycation/compose.yaml exec api node dist/seeds/index.js
```

**Important:** The production image has no `tsx` or dev dependencies. All scripts that use `tsx` must be run via `node dist/<path>.js` (compiled output). The build context must be `backend/` not the repo root.

## Known Issues & Fixes

### Rate limiting (429) — all users sharing one bucket
**Cause:** All web→API traffic comes from the web container IP (`172.31.x.x`), so every user shares one rate-limit bucket.
**Fix:** `@fastify/rate-limit` `keyGenerator` in `backend/src/index.ts` decodes the JWT and keys by `userId`; falls back to IP for unauthenticated requests. Limit raised to 300 req/15 min.

### Geocoding — park coordinates missing on map
**Cause 1:** Seeded parks (Center Parcs, Haven, etc.) had no hardcoded coordinates and relied entirely on Nominatim. Nominatim doesn't know commercial park names like "Clawford Lakes Resort and Spa".
**Fix:** `backend/src/seeds/providers.seed.ts` now includes hardcoded lat/lon for all seeded parks. Re-running the seed with `node dist/seeds/index.js` backfills any parks that have `NULL` coordinates.

**Cause 2:** Dynamically-created parks (auto-created by `monitor.worker.ts` when scraping discovers a new park) use the scraped property name which often includes commercial suffixes ("Resort and Spa", "Holiday Park", "Lodges") or are outright accommodation types ("3 bedroom Woodland Lodge").
**Fix:** `backend/src/services/geocoding.service.ts` normalises names before querying Nominatim — strips commercial suffixes, handles "X at Y" patterns (extracts Y), and skips entries that look like accommodation types rather than place names.

**Trigger geocoding:** Admin panel → "Geocode Parks" button (POST `/admin/geocode-parks`). Respects Nominatim's 1 req/s limit — takes ~1 min per 30 parks. Small private parks not in OpenStreetMap will always fail; this is expected.

## Useful docs

- `docs/development/PROVIDER_GUIDE.md` — adding a new scraping provider
- `docs/SEARCH_PREVIEW_API.md` — search/preview API reference
- `docs/deployment/SYNOLOGY_DEPLOYMENT.md` — NAS deployment
- `SECURITY_CHECKLIST.md` — security requirements checklist
