# Action List: Real-time Search Preview (POST /api/search/preview)

> Goal: Lock in trust guarantees, improve diagnostics, and harden preview against provider breakage/abuse.  
> Principle: **Preview must never persist observations or trigger alerts. Audit-only.**

---

## 1) Trust Contract Tests (must-have)

### 1.1 No persistence of observations
- Add an integration test that runs `/api/search/preview` with mocked adapter results.
- Assert:
  - `Observation` (or equivalent price history/observations table) has **no inserts/updates**.
  - Any repository `save/insert` for observations is **not called**.

### 1.2 No alerts or insight jobs enqueued
- Add a test to assert **no BullMQ queue jobs** are created by preview execution.
- Spy/inspect:
  - `alertsQueue.add`, `insightsQueue.add`, `watcherQueue.add` (whatever exists).
- Assert: **0 calls**.

### 1.3 Audit logging always happens (success + failure)
- Add tests for both:
  - success response
  - adapter fetch failure returning `FETCH_FAILED`
- Assert `fetch_runs` row exists with:
  - `runType = MANUAL_PREVIEW`
  - `requestId` present
  - `mode` present (`INLINE_PROFILE` or `PROFILE_ID`)
  - provider(s) recorded
  - timing fields recorded (at least total + fetch/parse)

### 1.4 SeriesKey completeness + confidence downgrade rules
- Add tests where adapter returns items with missing critical fields (price/date/nights/accommodation type).
- Assert:
  - `seriesKey === null` (or explicit `UNKNOWN_*` bucket, if that’s the agreed rule)
  - confidence score/classification is downgraded
  - reasons include a specific code like `SERIESKEY_INCOMPLETE` / `MISSING_CRITICAL_FIELDS`

---

## 2) Response Contract Improvements

### 2.1 Add explicit Side Effects block
- Ensure API response includes:
```json
"sideEffects": {
  "observationsStored": false,
  "alertsGenerated": false,
  "emailsSent": false
}
2.2 Per-provider execution status
Ensure response includes per-provider status objects:
OK | FETCH_FAILED | PARSE_FAILED | BLOCKED | ROBOTS_DENIED | KILL_SWITCHED | TIMEOUT
Include timings per provider where possible.
2.3 Confidence reasons as stable codes
Ensure confidence summary includes:
classification: PASS|FAIL|UNKNOWN
score: number (0..1)
reasons: [{ code, severity, message? }]
Use stable machine-readable code values.
2.4 Clarify/rename dryRun
Rename request option dryRun to something unambiguous:
includeDebug
forcePlaywright
includeRaw (default false)
If dryRun stays, enforce it does not change persistence behaviour.
3) Audit Logging Hardening (FetchRun)
3.1 Store minimal but useful debug stats (no raw HTML)
Ensure fetch_runs captures:
adapter mode used (CHEERIO/PLAYWRIGHT)
http status (if available)
blocked detection flags
parse stats (counts: parsed, with_price, with_dates, with_seriesKey)
timings breakdown
optional html_fingerprint_hash (no raw HTML)
3.2 Log PROFILE_ID overrides (if supported)
If request overrides profile fields in PROFILE_ID mode:
record overridesApplied: true
store a redacted diff summary in audit
4) Operational Guardrails
4.1 Rate limiting: layered enforcement
Confirm and/or implement:
per-user/token limit
per-IP backstop
daily cap per user (optional)
Return 429 with clear reason fields.
4.2 Kill switch + robots ordering
Ensure route order:
auth
rate limit
kill switch
robots check (cached)
fetch
4.3 Timeout behaviour
Implement a strict timeout per provider.
If multiple providers requested:
partial provider failures should not crash the whole response
overall classification should become UNKNOWN if mixed outcomes
5) Manual Verification Checklist (real providers)
5.1 Sanity run (INLINE_PROFILE)
Run the provided curl example.
Verify:
response contains requestId
results include nullable seriesKey
confidence block populated
sideEffects block present
5.2 Failure simulation
Force adapter fetch failure (bad URL/mock flag).
Verify:
response returns FETCH_FAILED
fetch_runs entry created
no observations inserted
no queue jobs created
5.3 Provider layout breakage smoke test
Use forcePlaywright toggle (if supported).
Verify:
adapter mode recorded correctly
confidence reasons reflect fallback usage and any parsing uncertainty
6) Documentation Updates
6.1 Update docs/SEARCH_PREVIEW_API.md
Document:
modes (INLINE_PROFILE, PROFILE_ID)
request schema + option meanings
response schema including sideEffects
error/status codes and per-provider statuses
explicit non-persistence guarantee
6.2 Add “Trust Guarantees” section
Bullet list:
no observation storage
no alerts/emails
audit-only
safe parsing (no defaults)
like-for-like seriesKey rules