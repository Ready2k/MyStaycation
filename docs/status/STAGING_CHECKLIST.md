# STAGING_CHECKLIST.md
## UK Staycation Price & Deal Watcher – Things to Check Before Production

Purpose: Verify the system is **actually** production-ready (not just “looks ready in a doc”).

**Last Updated**: 2026-01-03

---

## 1) Deployment & Environment Sanity

- [ ] `docker-compose --profile dev up -d` works cleanly (no nginx)
- [ ] `docker-compose --profile prod up -d` works cleanly (nginx included)
- [ ] `.env` contains all required variables (no defaults accidentally used in prod)
- [ ] Production startup fails fast when:
  - [ ] `JWT_SECRET` missing/too short
  - [ ] DB credentials missing
- [ ] API and worker health endpoints (or logs) confirm boot success
- [ ] Node version in runtime matches `engines.node` (>= 20)

---

## 2) Network & Security

- [ ] Postgres is **not** exposed externally (no host port binding)
- [ ] Redis is **not** exposed externally (no host port binding)
- [ ] Nginx (prod profile):
  - [ ] TLS works (valid certs)
  - [ ] HTTP → HTTPS redirect works
  - [ ] Security headers present (HSTS/CSP/XFO as configured)
- [ ] CORS allows only intended origins
- [ ] Rate limiting is applied on auth endpoints:
  - [ ] register
  - [ ] login
  - [ ] password reset
  - [ ] verify email

---

## 3) Auth & User Flows

- [ ] Register new user
- [ ] Verify email (token flow works end-to-end)
- [ ] Login returns JWT and it works on protected routes
- [ ] Password reset flow works
- [ ] Passwords are stored hashed (inspect DB)
- [ ] Verification tokens are hashed or short-lived (inspect DB / implementation)

---

## 4) Profile → Fingerprint → Scheduling

- [ ] Creating a holiday profile generates:
  - [ ] a fingerprint record
  - [ ] provider targets
  - [ ] canonical hash is deterministic (same input → same hash)
- [ ] Editing a profile updates the right records without duplicating fingerprints
- [ ] Disabled profiles do not schedule jobs

---

## 5) Monitoring Runs (Core Pipeline)

- [ ] Monitoring job executes successfully for each enabled provider
- [ ] `fetch_runs` created for every run with correct status:
  - [ ] `OK`
  - [ ] `BLOCKED` (robots)
  - [ ] `PARSE_FAILED`
  - [ ] `ERROR`
- [ ] Worker never inserts “partial” observations:
  - [ ] missing stayStartDate
  - [ ] missing stayNights
  - [ ] missing priceTotal
- [ ] Playwright fallback only triggers when HTTP parsing fails (expected behaviour)

---

## 6) Scraping Controls & Kill Switches

- [ ] `SCRAPING_ENABLED=false` stops all monitoring activity cleanly
- [ ] `PLAYWRIGHT_ENABLED=false` prevents browser fallback (should not crash jobs)
- [ ] `PROVIDER_HAVEN_ENABLED=false` skips Haven only
- [ ] `PROVIDER_HOSEASONS_ENABLED=false` skips Hoseasons only
- [ ] `PLAYWRIGHT_CONCURRENCY=1` is respected (no parallel browser sessions)
- [ ] Per-provider concurrency caps are respected (`PROVIDER_MAX_CONCURRENT` etc.)

---

## 7) Series Key Integrity (Trust Engine)

- [ ] Every inserted price observation has a `seriesKey`
- [ ] `seriesKey` is deterministic and stable (same stay → same key)
- [ ] Confirm seriesKey does NOT include:
  - [ ] observedAt timestamp
  - [ ] price
  - [ ] availability
- [ ] Confirm seriesKey inputs are consistent:
  - [ ] park/accom fields are either always resolved or consistently defaulted (no accidental series splitting)

SQL check ideas:
- [ ] Count observations per seriesKey (should not explode unexpectedly)
- [ ] Inspect a sample of observations to confirm expected grouping

---

## 8) Insight Engine Correctness

- [ ] InsightService queries distinct seriesKeys and computes insights per series only
- [ ] Lowest-in-180-days:
  - [ ] uses a DB cutoff in WHERE clause (not `take: 100` then filter)
  - [ ] requires N ≥ 5 observations (or configured minimum)
- [ ] Price drop:
  - [ ] compares latest vs previous within same series
  - [ ] threshold works: max(£75, 7%)
- [ ] Risk rising:
  - [ ] SOLD_OUT counts within same series
  - [ ] price trend computed within same series
- [ ] Insights return `null` when uncertain (no guessing)

---

## 9) Deduplication & Alert Spam Prevention

- [ ] Insight dedupe key prevents identical daily insight creation
- [ ] DB uniqueness constraint works (attempted dup insert fails or is skipped)
- [ ] Alert dedupe rules prevent repeated sends within configured window (e.g., 7 days)
- [ ] Confirm legitimate repeated events still alert appropriately (policy check):
  - [ ] new lower low after prior “lowest” alert
  - [ ] another meaningful price drop after the first

---

## 10) Email Notifications (AWS SES)

- [ ] SES credentials configured and valid
- [ ] EMAIL_FROM verified in SES (if required)
- [ ] Emails send successfully:
  - [ ] verification email
  - [ ] password reset email
  - [ ] alert email
- [ ] Email contents look sane:
  - [ ] correct links (APP_URL)
  - [ ] no broken formatting
  - [ ] no leaking internal IDs or secrets

---

## 11) Frontend UX Checks (Mobile + Desktop)

- [ ] Mobile layout works:
  - [ ] login/register screens
  - [ ] dashboard
  - [ ] profile creation/editing
  - [ ] price chart page
  - [ ] alerts list
- [ ] API failures show user-friendly errors (not stack traces)
- [ ] Auth expiry behavior is correct (redirect/login prompt)

---

## 12) Observability & Operational Readiness

- [ ] Logs are structured enough to diagnose:
  - [ ] which provider failed
  - [ ] which fingerprint/seriesKey was involved
  - [ ] why parsing was skipped
- [ ] Metrics or at least simple daily SQL reports exist for:
  - [ ] fetch_runs by status
  - [ ] parse skip counts by reason
  - [ ] Playwright fallback rate
  - [ ] insights created per day
  - [ ] alerts sent per day
- [ ] Worker crash recovery:
  - [ ] container restarts automatically
  - [ ] jobs retry safely without duplication

---

## 13) Backup & Restore (Don’t Skip This)

- [ ] Run `pg_dump` backup successfully
- [ ] Restore backup into a fresh DB
- [ ] App boots and reads historical observations after restore

---

## 14) Staging Soak Test (7–14 days)

- [ ] Run in staging for 7 days minimum
- [ ] Daily review:
  - [ ] error rates stable
  - [ ] parse failures not trending upward
  - [ ] no alert spam
  - [ ] provider blocks are rare and handled
- [ ] If provider HTML changes:
  - [ ] worker does not crash
  - [ ] fetch_run status shows PARSE_FAILED/BLOCKED
  - [ ] kill switches can disable provider cleanly

---

## Exit Criteria (Production Go/No-Go)

Go live only when:
- [ ] 7-day soak test completed with stable monitoring
- [ ] Alerts generated are like-for-like (series-based) and not misleading
- [ ] Email flows confirmed end-to-end
- [ ] Backup/restore rehearsal completed
- [ ] Security checks (ports, secrets, rate limiting) verified
