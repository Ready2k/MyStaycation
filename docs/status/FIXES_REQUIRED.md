# FIXES_REQUIRED.md
## MyStaycation – MVP Stabilisation & Hardening Tasks

This document lists **required fixes and improvements** identified during implementation review.
These items should be addressed before expanding providers, scaling users, or adding monetisation.

Audience: Engineering / “Google Antigravity” automation  
Priority: High → Medium (ordered)

---

## 1. Docker & Infrastructure Fixes

### 1.1 Secure Database & Cache Exposure
- [ ] Restrict Postgres port exposure to localhost or remove host binding entirely
- [ ] Restrict Redis port exposure to localhost or remove host binding entirely
- [ ] Confirm no external access to Postgres/Redis in non-dev environments

**Reason:** Current config exposes critical services to the host network.

---

### 1.2 Add Scraping Kill Switches
Add environment flags and enforce them in worker startup logic:
- [ ] `SCRAPING_ENABLED`
- [ ] `PLAYWRIGHT_ENABLED`
- [ ] `PROVIDER_HAVEN_ENABLED`
- [ ] `PROVIDER_HOSEASONS_ENABLED`
- [ ] `PLAYWRIGHT_CONCURRENCY` (default = 1)

**Reason:** Providers will change HTML. You need a switch, not an incident.

---

### 1.3 Make Nginx Optional for Local Development
- [ ] Add Docker Compose profiles (`dev`, `prod`)
- [ ] Disable Nginx + SSL by default in local dev
- [ ] Document production-only Nginx usage

**Reason:** Local SSL/Nginx increases friction without MVP benefit.

---

## 2. Provider Adapter Fixes (Critical)

### 2.1 Robots.txt Handling
- [ ] Change robots.txt disallow handling from hard error → soft failure
- [ ] Log fetch run as `BLOCKED_ROBOTS`
- [ ] Do not crash monitoring or halt scheduling

**Reason:** Monitoring must degrade gracefully, not silently stop.

---

### 2.2 Date Parsing Safety
- [ ] Do NOT default stayStartDate to search window start
- [ ] Require explicit, confidently parsed stay date per result
- [ ] If date cannot be parsed, discard result or mark as untrusted

**Reason:** Defaulting dates creates false historical observations.

---

### 2.3 Nights / Duration Parsing
- [ ] Implement explicit duration parsing:
  - “X nights”
  - “Mon–Fri”, “Fri–Mon”
- [ ] If duration cannot be confidently parsed, do not guess
- [ ] Allow `stayNights` to be undefined when necessary

**Reason:** Incorrect durations corrupt per-night pricing and insights.

---

### 2.4 Price Per Night Calculation Guard
- [ ] Prevent division by zero / NaN in price-per-night calculation
- [ ] Only compute when stayNights is valid and > 0

---

### 2.5 Source URL Normalisation
- [ ] Normalize relative vs absolute URLs using URL constructor
- [ ] Prevent baseUrl duplication in concatenated URLs

---

### 2.6 Offers Date Parsing
- [ ] Do not rely on `new Date(string)` for UK-formatted dates
- [ ] Parse known formats explicitly (UK DD/MM/YYYY, “Ends Sunday”, etc.)
- [ ] Store raw date text for audit/debugging

---

## 3. Canonical Fingerprint & Series Integrity (High Impact)

### 3.1 Introduce Series Key
- [ ] Define a deterministic `seriesKey` for price observations
  - Components: stayStartDate + stayNights (+ park/accom if applicable)
- [ ] Store or compute seriesKey consistently

**Reason:** Insights must compare like-for-like stays only.

---

### 3.2 Enforce Fingerprint Determinism
- [ ] Ensure canonical ordering of arrays (parks, accom types)
- [ ] Normalise date windows and defaults explicitly
- [ ] Version fingerprint logic for future migrations

---

## 4. Insight Engine Corrections (Critical)

### 4.1 Prevent Mixed-Series Comparisons
- [ ] Run insight calculations per `seriesKey`, not per fingerprint only
- [ ] Do not compare different dates/durations/accoms in one insight

---

### 4.2 Lowest-in-X-Days Query Fix
- [ ] Query observations by date cutoff in database, not after `take: 100`
- [ ] Ensure full 180-day window is considered when available

---

### 4.3 Price Drop Logic Fix
- [ ] Compare latest vs previous observation **within same series**
- [ ] Prevent cross-series price drop calculations

---

### 4.4 Risk Rising Logic Fix
- [ ] Count SOLD_OUT occurrences per series
- [ ] Evaluate price trend within same series
- [ ] Avoid averaging unrelated observations

---

### 4.5 Insight Deduplication
- [ ] Add dedupe key at Insight level OR
- [ ] Enforce uniqueness via `(fingerprint, seriesKey, type, timeWindow)`
- [ ] Prevent repeated identical insights being stored daily

---

## 5. Job Scheduling & Worker Safety

### 5.1 Idempotency
- [ ] Prevent duplicate monitoring jobs for same fingerprint/window
- [ ] Add idempotency keys to BullMQ jobs

---

### 5.2 Concurrency Controls
- [ ] Enforce per-provider concurrency limits
- [ ] Enforce global Playwright concurrency cap

---

### 5.3 Failure Handling
- [ ] Ensure parse failures do not insert partial/invalid observations
- [ ] Mark fetch runs accurately: OK / PARSE_FAILED / BLOCKED / ERROR

---

## 6. Security & Hygiene

### 6.1 Secrets Validation
- [ ] Enforce minimum JWT secret length at startup
- [ ] Fail fast if required secrets are missing in production

---

### 6.2 Password & Token Safety
- [ ] Ensure password hashes only (no plaintext anywhere)
- [ ] Hash or strictly TTL-limit email verification tokens

---

### 6.3 Rate Limiting Coverage
- [ ] Confirm rate limiting applied to:
  - login
  - register
  - password reset
  - verification endpoints

---

## 7. Testing Improvements

### 7.1 Adapter Fixture Discipline
- [ ] Ensure integration tests default to stored HTML fixtures
- [ ] Make live scraping tests opt-in and throttled

---

### 7.2 Insight Tests
- [ ] Add unit tests for:
  - seriesKey grouping
  - mixed-series prevention
  - dedupe logic

---

## 8. Cleanup & Consistency

### 8.1 Fix Naming Typos
- [ ] Rename `adapaters` → `adapters` if present
- [ ] Update all imports accordingly

---

### 8.2 Documentation Updates
- [ ] Document kill switches in README
- [ ] Clarify Nginx usage (dev vs prod)
- [ ] Document seriesKey concept in architecture docs

---

## Exit Criteria
This list is considered complete when:
- Monitoring runs safely for 14 days without manual intervention
- No false “lowest price” or misleading alerts are generated
- Provider HTML changes do not crash workers
- Alerts feel trustworthy to a real user

If these aren’t fixed, the app will technically work — but users will quietly stop trusting it.
Which is worse.
