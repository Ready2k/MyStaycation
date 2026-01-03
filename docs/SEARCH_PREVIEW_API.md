# Search Preview API Documentation

## Overview
The Search Preview API (`POST /api/search/preview`) provides a real-time, read-only mechanism to search holiday providers (e.g., Haven, Hoseasons) using strict profile constraints. It is designed for debugging, verifying mapping logic, and testing "what-if" scenarios without persisting data or triggering alerts.

**Endpoint**: `POST /api/search/preview`
**Auth**: Required (JWT)

---

## Trust Guarantees
This API strictly adheres to the following trust contract:

1.  **No Persistence**: No `PriceObservation` or `HolidayResult` records are saved to the database.
2.  **No Side Effects**: No alerts, emails, or push notifications are generated.
3.  **Read-Only**: No active bookings or state changes occur on provider sites.
4.  **Audit Logging**: Every execution (success or failure) is logged to the `fetch_runs` table with type `MANUAL_PREVIEW`, including minimal debug statistics (timings, match counts).

---

## Request Modes

### 1. PROFILE_ID (Recommended)
Uses an existing, persisted `HolidayProfile` to drive the search.
```json
{
  "mode": "PROFILE_ID",
  "profileId": "uuid-string",
  "providers": ["haven"], 
  "options": { "includeDebug": true }
}
```

### 2. INLINE_PROFILE (Testing/Ad-hoc)
Uses a transient profile object provided in the request body. Validated against standard profile schemas.
```json
{
  "mode": "INLINE_PROFILE",
  "profile": {
    "dateStart": "2026-06-01",
    "dateEnd": "2026-06-30",
    "durationNightsMin": 3,
    "durationNightsMax": 7,
    "partySizeAdults": 2,
    "partySizeChildren": 0,
    "pets": false,
    "accommodationType": "CARAVAN",
    "minBedrooms": 2
  },
  "providers": ["haven"]
}
```

---

## Options Schema
Identify specific behaviors for the preview run.

| Field | Type | Default | Description |
|---|---|---|---|
| `maxResults` | number | 20 | Cap on results returned per provider. |
| `enrichTopN` | number | 0 | Fetch detail pages for top N candidates (expensive, requires Playwright). |
| `allowWeakMatches` | boolean | false | Include `MATCH_WEAK` results in the primary `matched` list. |
| `includeMismatches` | boolean | false | Include `MISMATCH` and `UNKNOWN` results in the `other` list. |
| `includeDebug` | boolean | false | Include debug info and mismatched results in `other` without strict filtering. Previously `dryRun`. |

---

## Response Schema
The response provides a structured view of the search results, stratified by provider and match confidence.

```typescript
interface PreviewResponse {
    requestId: string;
    generatedAt: string;
    mode: "PROFILE_ID" | "INLINE_PROFILE";
    providers: ProviderPreview[];
    overallSummary: {
        totalMatched: number;
        lowestMatchedPriceGbp: number | null;
        // ... counts
    };
    sideEffects: {
        observationsStored: boolean; // Always false
        alertsGenerated: boolean;    // Always false
        emailsSent: boolean;         // Always false
    };
}
```

### Provider Preview Status
- `OK`: Search completed successfully.
- `DISABLED`: Provider or scraping disabled via config.
- `BLOCKED_ROBOTS`: `robots.txt` disallows scraping.
- `FETCH_FAILED`: Network or HTTP error during fetch.
- `RATE_LIMITED`: Provider rate limit exceeded.

### Match Confidence & Reasons
Each result includes a `confidence` level and structured `reasons`:

- **STRONG**: Matches all strict constraints (Dates, Price, Pets, Bedrooms, etc.).
- **WEAK**: Minor deviations (if allowed).
- **UNKNOWN**: Critical data missing (e.g., missing stays data).
- **MISMATCH**: Fails strict constraints.

```json
"reasons": {
    "passed": [{ "code": "MATCH", "message": "..." }],
    "failed": [{ "code": "DATE_OUT_OF_RANGE", "message": "..." }],
    "unknown": []
}
```

### SeriesKey
A deterministic hash (`seriesKey`) identifies comparable stays across search runs. If critical data (StartDate, Nights, AccomType) is missing, `seriesKey` will be `"UNKNOWN_MISSING_DATA"`, and confidence downgraded.

---

## Operational Guardrails

- **Rate Limiting**: Throttled per user and per provider.
- **Kill Switches**: Respects `SCRAPING_ENABLED` and provider-specific flags.
- **Timeouts**: Strict timeouts apply to fetch operations.
