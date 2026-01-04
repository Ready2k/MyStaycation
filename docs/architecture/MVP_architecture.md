MVP architecture
Principles
Human-speed monitoring: per provider 24–72h (and jittered), never hammer sites.
Reproducible “search fingerprints”: same query produces same canonical key.
Provider adapters: every provider is its own plug-in with strict rate limits and parsing rules.
Opinionated alerts: store enough history to decide “meaningful” vs “noise”.
Compliance-first: log what you fetched, when, from where, and why.
High-level components
Client app (web/mobile)
Create holiday profiles (fingerprints)
View price history + deal timeline
Configure alert thresholds
API backend
Auth, profiles, notifications
Exposes “observations” and “insights” (not raw scraping junk)
Scheduler + job queue
Creates monitoring jobs at low frequency with jitter
Per-provider concurrency limits
Provider watcher workers
“Adapter” per provider (Center Parcs, Forest Holidays, etc.)
Fetch offer pages + run search queries
Parse to structured results
Emit Observations
Deal intelligence workers
Watch provider “offers” pages
Watch community sources (e.g., HotUKDeals) using whatever compliant method is available (RSS/feed/API if offered)
Normalise deals into Deals
Price memory + insight engine
Builds baselines (rolling medians, min seen, seasonality-lite)
Detects significant changes
Creates Insights + triggers Alerts
Notification service
Email/push/SMS later
Digest mode as default (spam is how apps get deleted)
C4-ish views (MVP)
Context
flowchart LR
  U[User] --> A[Staycation Watcher App]
  A --> P[Staycation Providers\n(Center Parcs, Forest Holidays, etc.)]
  A --> D[Deal Sources\n(Offers pages, HotUKDeals, etc.)]
  A --> N[Notification Channels\n(email/push/SMS)]
Container view
flowchart TB
  subgraph Client
    W[Web/Mobile UI]
  end

  subgraph Backend
    API[API Service]
    AUTH[Auth]
    INS[Insight Engine]
    NOTIF[Notification Service]
  end

  subgraph Data
    DB[(Postgres)]
    OBJ[(Object Storage\nHTML snapshots optional)]
    CACHE[(Redis\nrate limit / dedupe)]
  end

  subgraph Jobs
    SCH[Scheduler]
    Q[Job Queue]
    WRK[Watcher Workers\nProvider Adapters]
    DWRK[Deal Workers]
  end

  W --> API
  API --> AUTH
  API --> DB

  SCH --> Q
  Q --> WRK
  Q --> DWRK

  WRK --> DB
  WRK --> CACHE
  WRK --> OBJ

  DWRK --> DB
  DWRK --> CACHE
  DWRK --> OBJ

  DB --> INS
  INS --> DB
  INS --> NOTIF
  NOTIF --> API
  API --> W
Data model (Postgres-first MVP)
You want a schema that supports:
canonical fingerprints
observations over time
deals over time
insights/alerts that reference evidence
audit trail of fetches (for sanity + disputes)
Core entities
1) Users
users
id (uuid pk)
email
created_at
2) Holiday profiles (the “fingerprint”)
A user-defined “watch this kind of holiday” object.
holiday_profiles
id (uuid pk)
user_id (fk)
name
party_size_adults, party_size_children
flex_type enum: FIXED | RANGE | FLEXI
date_start, date_end (nullable if truly flexible)
duration_nights_min, duration_nights_max
peak_tolerance enum: OFFPEAK_ONLY | MIXED | PEAK_OK
budget_ceiling_gbp (optional)
created_at, updated_at
profile_provider_targets
id
profile_id (fk)
provider_id (fk)
park_id (nullable if provider-wide)
accom_type_id (nullable)
enabled
Unique: (profile_id,provider_id,park_id,accom_type_id)
3) Providers + catalogue normalisation
providers
id
name (e.g., “Center Parcs”)
base_url
notes (ToS quirks, etc.)
provider_parks
id
provider_id
provider_park_code (their identifier if known)
name
region (optional)
Unique: (provider_id,provider_park_code)
provider_accom_types
id
provider_id
provider_accom_code
name (e.g., “2-bed lodge”, “Treehouse”)
capacity_min, capacity_max (optional)
4) Search fingerprints (canonical query keys)
This is the key to “no constant fiddling”.
search_fingerprints
id
profile_target_id (fk) (ties to provider+park+accom)
canonical_hash (sha256 of canonical JSON)
canonical_json (jsonb)
check_frequency_hours (24–72)
last_scheduled_at
enabled
Unique: canonical_hash
Canonical JSON example (stored in canonical_json):
{
  "provider": "center_parcs",
  "park": "sherwood_forest",
  "party": {"adults":2,"children":2},
  "date_window": {"start":"2026-03-01","end":"2026-04-30"},
  "nights": {"min":3,"max":5},
  "accommodation": "2bed_lodge",
  "peak_tolerance": "mixed"
}
5) Fetch jobs + audit trail
You need to prove you’re behaving. Also helps debugging when parsing breaks.
fetch_runs
id
provider_id
fingerprint_id (nullable for “offers page” runs)
run_type enum: SEARCH | OFFERS_PAGE | DEAL_SOURCE
scheduled_for
started_at, finished_at
status enum: OK | ERROR | BLOCKED | PARSE_FAILED
http_status
request_fingerprint (hash of URL+params+headers template)
response_snapshot_ref (optional pointer to object storage)
error_message (nullable)
6) Observations (prices/inventory as time series)
This is your “price memory”.
price_observations
id
provider_id
fingerprint_id
observed_at
stay_start_date
stay_nights
accom_type_id (nullable if embedded in fingerprint)
party_size
price_total_gbp (decimal)
price_per_night_gbp (decimal, derived but store for speed)
availability enum: AVAILABLE | SOLD_OUT | UNKNOWN
currency default GBP
source_url (optional)
fetch_run_id (fk)
Index: (fingerprint_id,stay_start_date,stay_nights,observed_at desc)
If a provider returns multiple options per query, store multiple rows per fetch_run_id.
7) Deals (normalised promotions)
deals
id
provider_id (nullable for generic deal sources)
source enum: PROVIDER_OFFERS | HOTUKDEALS | OTHER
source_ref (e.g., HUKD post id/url hash)
title
discount_type enum: %OFF | FIXED_OFF | SALE_PRICE | PERK
discount_value (decimal nullable, depends on type)
voucher_code (nullable)
eligibility_tags (text[] like ["NHS","BlueLight","NewCustomer"])
restrictions (jsonb: excluded dates, min spend, etc.)
starts_at (nullable)
ends_at (nullable)
detected_at
last_seen_at
confidence (0–1)
Unique: (source,source_ref)
8) Insights + alerts (the “real value”)
Separate “insight” (computed fact/opinion) from “alert” (user notification event).
insights
id
fingerprint_id
type enum:
LOWEST_IN_X_DAYS
PRICE_DROP_PERCENT
NEW_CAMPAIGN_DETECTED
RISK_RISING
VOUCHER_SPOTTED
summary (short human-readable)
details (jsonb: evidence, baseline window, calculations)
created_at
alerts
id
user_id
profile_id
insight_id
channel enum: EMAIL | PUSH | SMS
status enum: QUEUED | SENT | FAILED | DISMISSED
sent_at (nullable)
dedupe_key (to avoid repeats)
Unique: (user_id,dedupe_key)
Alerting logic (MVP rules that feel smart)
You don’t need “AI” to be useful. You need taste.
Baselines (per fingerprint + stay_start_date + nights)
Compute daily (or on-demand):
rolling window median (e.g., 90d)
min seen (e.g., 180d)
volatility (std dev or median absolute deviation)
“sellout slope” (availability flips to SOLD_OUT over time)
Triggers
Lowest in X months
if price_total <= min_seen(180d) and at least N observations exist.
Meaningful drop
if drop ≥ max(£75, 7%) since last observation and not within “noise band”.
New campaign
deal detected with confidence ≥ 0.7 and relevant provider match.
Risk rising (simple but effective)
if availability is thinning (more SOLD_OUTs) and prices trending up, say:
“Savings left: ~£Y. Risk of missing: rising.”
Dedupe
One alert per fingerprint per insight type per 7 days unless it’s a new lowest.
Job scheduling (so you don’t get blocked)
Jitter every run (random +/- 20–40%)
Global caps:
max X requests/hour/provider
max Y concurrent fetches/provider
Backoff strategy:
if BLOCKED or repeated PARSE_FAILED: pause provider adapter 7 days and surface “needs maintenance”
Cache/ETag:
store last-modified/etag for offers pages if available
Prefer “offers page watching” over deep search crawling.
Minimal tech stack that won’t ruin your life
API: Node/TypeScript (Fastify/Nest) or Python (FastAPI)
DB: Postgres (JSONB earns its keep here)
Queue: Redis + BullMQ (cheap) or SQS if you go AWS
Workers: containerised worker pool
Object storage: S3-compatible for HTML snapshots (optional but helpful)
Notifications: email first (SES/SendGrid), push later
MVP scope boundary (what you actually build first)
Providers: pick 2 to start (one “hard”, one “easy”).
Only one accommodation category per provider initially.
Capture:
price_total
availability
deal/voucher mentions
Deliver:
“lowest in 180 days”
“price drop ≥ X”
“new offer page change”
UI: profile setup + timeline chart + alerts log.
That’s enough to validate: “Did this save me money or time?” without building Skynet for caravans.