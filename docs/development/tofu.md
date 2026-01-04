# TOFU.md — Trust-Oriented Fix-Up (Preview Endpoint)

> Purpose: Eliminate trust leaks, correctness bugs, and future foot-guns in the real-time search preview flow.  
> Scope: Backend only. No frontend work. No feature expansion.

---

## 1. SECURITY & ACCESS CONTROL (CRITICAL)

### 1.1 Lock PROFILE_ID access to owning user
**Problem:** `PROFILE_ID` preview loads profiles by ID only, allowing cross-user access.

**Action:**
- Enforce user scoping when loading profiles.
- Either:
  - Resolve profile in route with `id + userId` and pass to `PreviewService`, or
  - Pass `userId` into `PreviewService.executePreview()` and validate internally.

**Acceptance Criteria:**
- Previewing another user’s profile ID returns `404` or `403`.
- No profile lookup occurs without user context.

---

## 2. SERIES KEY CORRECTNESS (CRITICAL)

### 2.1 Use real park identifiers
**Problem:** Preview currently sets `parkId = 'ANY'`, producing invalid series keys.

**Action:**
- Extract `parkId` (or equivalent stable park identifier) from adapter candidate.
- Remove hardcoded `'ANY'` park usage.
- Add `parkId` to `requiredFields` for seriesKey generation.

**Acceptance Criteria:**
- `seriesKey` is `null` when `parkId` is missing.
- Confidence is downgraded with reason `SERIESKEY_INCOMPLETE`.
- No preview result emits a seriesKey with a fake park.

---

## 3. REQUEST VALIDATION HARDENING

### 3.1 Enforce minimum viable profile for preview
**Problem:** Partial inline profiles allow invalid date logic.

**Action:**
- Require:
  - `dateStart` always present
  - For RANGE/FLEXI: `dateEnd` must be present
- Reject invalid profiles with `400 PROFILE_INCOMPLETE`.

**Acceptance Criteria:**
- No `Invalid Date` objects created during preview.
- Preview never infers missing dates silently.

---

## 4. API CONTRACT ALIGNMENT

### 4.1 Remove or neutralise `dryRun`
**Problem:** `dryRun` exists in route schema but does nothing and implies side effects.

**Action (choose one):**
- Remove `dryRun` entirely from schema and docs, OR
- Explicitly ignore it and document “preview is always no-side-effects”.

**Acceptance Criteria:**
- Route schema and `PreviewService` options are aligned.
- No option implies persistence is possible.

---

### 4.2 Align debug options
**Action:**
- Standardise preview options across route + service:
  - `includeDebug`
  - `forcePlaywright`
  - `includeRaw` (default false, redacted)

**Acceptance Criteria:**
- Options validated in Zod match service interface exactly.

---

## 5. AUDIT LOGGING HARDENING

### 5.1 Improve FetchRun diagnostics (no raw HTML)
**Action:**
- Add to `FetchRun` logging:
  - `requestId`
  - `requestFingerprint` (hash of request payload)
  - `providerStatus` (`OK | FETCH_FAILED | PARSE_FAILED | BLOCKED | TIMEOUT`)
  - `errorMessage` (on failure)
  - `httpStatus` (if known)

**Acceptance Criteria:**
- Every preview request creates exactly one `FetchRun`.
- Failures are diagnosable without re-running preview.

---

## 6. COMPLIANCE SIGNAL HONESTY

### 6.1 Populate real compliance flags
**Problem:** `robotsAllowed`, `playwrightUsed`, `rateLimited` are hardcoded.

**Action:**
- Populate these fields from real execution paths:
  - Robots check result
  - Adapter fallback to Playwright
  - Route-level rate limit trigger

**Acceptance Criteria:**
- No compliance field is hardcoded to “true/false”.
- Preview output reflects reality.

---

## 7. PROVIDER NORMALISATION

### 7.1 Canonicalise provider keys
**Problem:** Mixed-case provider names cause adapter lookup errors.

**Action:**
- Normalise provider identifiers at route boundary:
  - trim
  - uppercase (or canonical enum)

**Acceptance Criteria:**
- `"haven"`, `"HAVEN"`, `" Haven "` resolve identically.

---

## 8. RESPONSE CLARITY & TRUST SIGNALS

### 8.1 Enforce explicit side-effects declaration
**Action:**
Ensure every preview response includes:

```json
"sideEffects": {
  "observationsStored": false,
  "alertsGenerated": false,
  "emailsSent": false
}
```
**Acceptance Criteria:**
Present on success and failure responses.

## 9. TEST COVERAGE (LOCK THE RULES IN)

### 9.1 Add trust-contract tests
Add tests asserting:
- No observations are written
- No BullMQ jobs are enqueued
- FetchRun is written on success and failure
- SeriesKey is null when incomplete
- Confidence downgrades correctly

**Acceptance Criteria:**
- Preview cannot regress into persistence without failing tests.

---

## 10. CLEANUP / POLISH

- Fix typo: “required required”
- Ensure `accommodationType` aligns to canonical enum or explicit `UNKNOWN`
- Use strict match descriptions for `matchDetails`, not first classification

---

## Definition of Done

- Preview endpoint is user-safe, series-correct, and audit-only.
- No inferred data, no fake keys, no silent defaults.
- A future developer cannot accidentally turn preview into ingestion.

