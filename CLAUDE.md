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

docker-compose exec api npm run seed   # seed database
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
npm run seed                # seed database with initial data
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

## Useful docs

- `docs/development/PROVIDER_GUIDE.md` — adding a new scraping provider
- `docs/SEARCH_PREVIEW_API.md` — search/preview API reference
- `docs/deployment/SYNOLOGY_DEPLOYMENT.md` — NAS deployment
- `SECURITY_CHECKLIST.md` — security requirements checklist
