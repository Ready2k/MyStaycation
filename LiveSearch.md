SEARCH_PREVIEW_API.md
Real-time Search Preview API Contract (Aligned to HolidayProfile + REAL_WORLD_MAPPING.md)
Purpose
Provide a real-time “Search now” capability to validate provider parsing, mapping, and matching logic.
This endpoint MUST use the same adapter + matching pipeline as the scheduled worker to avoid logic drift.
Endpoint: POST /api/search/preview
Auth: Required (JWT)
Providers (MVP): Hoseasons, Haven
Rate: Strict throttling per user + provider (see Section 9)
1) Key Requirements
MUST
Respect kill switches:
SCRAPING_ENABLED
PROVIDER_HAVEN_ENABLED, PROVIDER_HOSEASONS_ENABLED
PLAYWRIGHT_ENABLED
PLAYWRIGHT_CONCURRENCY
Respect compliance controls:
robots.txt checks
adapter rate limiting
request jitter where applicable (optional for preview)
Use mapping rules from docs/REAL_WORLD_MAPPING.md:
enforce fingerprint-bound constraints
NEVER default missing dates/nights
handle tier/facilities/accessibility per spec
produce match confidence classification
Write an audit entry (fetch_runs) with type = MANUAL_PREVIEW (or equivalent)
Return match classification + reasons (“why matched/why not”)
MUST NOT
Run aggressive scraping or bypass provider limits
Store raw HTML in DB
Create alerts/emails from preview runs (preview is read-only)
2) Request Modes
Mode A: PROFILE_ID (recommended)
Uses an existing HolidayProfile from DB.
Mode B: INLINE_PROFILE (optional)
Pass a profile-like object without persistence (useful for UI drafts/testing).
3) Request Schema
3.1 Common Request Envelope (fields)
mode: "PROFILE_ID" | "INLINE_PROFILE" (required)
profileId: uuid (required for PROFILE_ID)
profile: HolidayProfile-like payload (required for INLINE_PROFILE)
providers: string[] (optional; default = enabled providers)
options: object (optional; see Section 4)
3.2 Example Request: PROFILE_ID
{
"mode": "PROFILE_ID",
"profileId": "b8a2f18d-1c74-4e7a-8b01-9d6d0ab3c0f1",
"providers": ["hoseasons", "haven"],
"options": {
"maxResults": 20,
"enrichTopN": 0,
"allowWeakMatches": false,
"includeMismatches": false,
"dryRun": false
}
}
3.3 Example Request: INLINE_PROFILE
{
"mode": "INLINE_PROFILE",
"profile": {
"name": "Pets Test",
"partySizeAdults": 2,
"partySizeChildren": 0,
"flexType": "RANGE",
"dateStart": "2026-02-01",
"dateEnd": "2026-02-28",
"durationNightsMin": 3,
"durationNightsMax": 7,
"peakTolerance": "MIXED",
"budgetCeilingGbp": 1000.00,
"enabled": true,
"pets": true,
"accommodationType": "ANY",
"minBedrooms": 0,
"tier": "STANDARD",
"stayPattern": "ANY",
"schoolHolidays": "ALLOW",
"petsNumber": 0,
"stepFreeAccess": false,
"accessibleBathroom": false,
"requiredFacilities": [],
"alertSensitivity": "INSTANT"
},
"providers": ["haven"],
"options": {
"maxResults": 10,
"enrichTopN": 3
}
}
Validation rules
INLINE_PROFILE must be validated using the same Zod schemas as persisted HolidayProfiles.
INLINE_PROFILE must NOT create DB rows (no implicit persistence).
4) Options Schema
Options fields
maxResults: int, default 20
enrichTopN: int, default 0
allowWeakMatches: bool, default false
includeMismatches: bool, default false
dryRun: bool, default false
Semantics
maxResults: max results returned per provider
enrichTopN: fetch detail pages for top N candidates (expensive)
allowWeakMatches: include MATCH_WEAK in matched results
includeMismatches: include MATCH_UNKNOWN and MISMATCH results in response
dryRun: run mapping without saving fetch_runs (debug only; should be false by default)
Constraints
enrichTopN must be capped (recommend ≤ 3)
enrichTopN must be forced to 0 if PLAYWRIGHT_ENABLED=false
if SCRAPING_ENABLED=false, return HTTP 503 with a structured error
5) Response Schema (Top-Level)
Response fields
requestId: uuid
generatedAt: ISO timestamp
mode: "PROFILE_ID" | "INLINE_PROFILE"
profile: object (includes fingerprintBound + preferences split)
providers: ProviderPreview[] (one per provider requested)
overallSummary: summary object
warnings: optional array of Warning objects
Example Response (structure)
{
"requestId": "b3ef6ac7-7b6a-4f03-85a9-cc1c7a6a1b30",
"generatedAt": "2026-01-03T13:10:00.000Z",
"mode": "PROFILE_ID",
"profile": {
"profileId": "b8a2f18d-1c74-4e7a-8b01-9d6d0ab3c0f1",
"name": "Pets Test",
"fingerprintBound": {
"partySizeAdults": 2,
"partySizeChildren": 0,
"flexType": "RANGE",
"dateStart": "2026-02-01",
"dateEnd": "2026-02-28",
"durationNightsMin": 3,
"durationNightsMax": 7,
"accommodationType": "ANY",
"minBedrooms": 0,
"pets": true
},
"preferences": {
"peakTolerance": "MIXED",
"budgetCeilingGbp": 1000.0,
"tier": "STANDARD",
"stayPattern": "ANY",
"schoolHolidays": "ALLOW",
"requiredFacilities": [],
"stepFreeAccess": false,
"accessibleBathroom": false,
"petsNumber": 0,
"alertSensitivity": "INSTANT"
}
},
"providers": [],
"overallSummary": {
"providersRequested": 2,
"providersSucceeded": 2,
"providersFailed": 0,
"totalMatched": 0,
"lowestMatchedPriceGbp": null
},
"warnings": []
}
6) ProviderPreview Schema
ProviderPreview fields
providerKey: string ("hoseasons" | "haven")
status: ProviderStatus
timingMs: object (fetch/parse/match/enrich/total)
compliance: object (scrapingEnabled/robotsAllowed/playwrightUsed/rateLimited)
results: object { matched: PreviewResult[], other: PreviewResult[] }
summary: counts by confidence + lowest matched price
ProviderStatus enum
OK
DISABLED
BLOCKED_ROBOTS
RATE_LIMITED
FETCH_FAILED
PARSE_FAILED
ERROR
ProviderPreview example
{
"providerKey": "haven",
"status": "OK",
"timingMs": {
"fetch": 1240,
"parse": 85,
"match": 21,
"enrich": 0,
"total": 1346
},
"compliance": {
"scrapingEnabled": true,
"robotsAllowed": true,
"playwrightUsed": false,
"rateLimited": false
},
"results": {
"matched": [],
"other": []
},
"summary": {
"totalCandidates": 18,
"matchStrong": 2,
"matchWeak": 4,
"matchUnknown": 12,
"mismatch": 0,
"lowestMatchedPriceGbp": 799.0
}
}
Result routing rules
results.matched contains:
MATCH_STRONG always
MATCH_WEAK only if allowWeakMatches=true
results.other contains MATCH_UNKNOWN and MISMATCH only if includeMismatches=true
7) PreviewResult Schema (Exact)
PreviewResult fields
confidence: "MATCH_STRONG" | "MATCH_WEAK" | "MATCH_UNKNOWN" | "MISMATCH"
providerKey: string
sourceUrl: string
parkId: string ("ANY" allowed)
stayStartDate: yyyy-mm-dd
stayNights: int
accommodationType: enum (matches HolidayProfile.AccommodationType or normalized equivalent)
bedrooms: int (optional)
tier: enum (optional, heuristic)
petsAllowed: boolean (optional)
facilities: string[] (optional)
availability: "AVAILABLE" | "SOLD_OUT" | "UNKNOWN"
price: object { totalGbp: number, perNightGbp: number|null }
seriesKey: string (sha256 hex)
reasons: object { passed: Reason[], failed: Reason[], unknown: Reason[], softNotes: Reason[] }
rawHints: object (optional, minimal debug hints only)
Reason schema
code: string
message: string
details: object (optional)
Example PreviewResult
{
"confidence": "MATCH_STRONG",
"providerKey": "haven",
"sourceUrl": "https://www.haven.com/...",
"parkId": "ANY",
"stayStartDate": "2026-02-10",
"stayNights": 4,
"accommodationType": "CARAVAN",
"bedrooms": 2,
"tier": "STANDARD",
"petsAllowed": true,
"facilities": ["WIFI", "POOL"],
"availability": "AVAILABLE",
"price": {
"totalGbp": 799.0,
"perNightGbp": 199.75
},
"seriesKey": "sha256hex",
"reasons": {
"passed": [
{ "code": "DATE_IN_RANGE", "message": "Stay start date is within profile window." },
{ "code": "NIGHTS_IN_RANGE", "message": "Stay nights within [3,7]." },
{ "code": "PETS_OK", "message": "Pets required and result indicates pets allowed." }
],
"failed": [],
"unknown": [
{ "code": "FACILITIES_UNCONFIRMED", "message": "Facilities not confirmed at list level." }
],
"softNotes": [
{ "code": "TIER_HEURISTIC", "message": "Tier is heuristic and used for ranking only." }
]
},
"rawHints": {
"accommodationLabel": "Bronze Caravan",
"tierLabel": "Bronze",
"priceText": "£799"
}
}
8) Errors & Warnings
Error response (standard)
{
"requestId": "uuid",
"error": {
"code": "SCRAPING_DISABLED",
"message": "Scraping is disabled via SCRAPING_ENABLED=false.",
"details": {}
}
}
Standard error codes
UNAUTHORIZED
INVALID_REQUEST
PROFILE_NOT_FOUND
PROFILE_DISABLED
SCRAPING_DISABLED
PROVIDER_DISABLED
RATE_LIMITED
PLAYWRIGHT_DISABLED
ROBOTS_BLOCKED
INTERNAL_ERROR
Warning schema
code: string
message: string
details: object (optional)
9) Rate Limiting (Required)
Preview searches are a debugging tool and must be tightly throttled.
Recommended limits:
Per user: 5 requests / 10 minutes
Per provider: 2 requests / 10 minutes
If exceeded: HTTP 429 with error code RATE_LIMITED.
Preview must still respect provider request delay settings.
10) Audit Logging (FetchRun)
Each provider attempt MUST write a fetch_runs entry:
type: MANUAL_PREVIEW
providerId / providerKey
fingerprintId (when mode=PROFILE_ID)
startedAt, finishedAt
status: OK / PARSE_FAILED / BLOCKED / ERROR
httpMode: HTTP / PLAYWRIGHT (optional)
resultCounts: totals by confidence
Preview must NOT generate alerts or send emails.
11) Implementation Notes (Non-Negotiable)
Preview must call the same adapter methods used by worker
Preview must call a centralized matcher function (single source of truth)
No duplicated parsing logic
No HTML persistence
If required data is missing, skip result and mark as MATCH_UNKNOWN rather than guessing
12) Acceptance Criteria
Done when:
User can preview search and receives results with confidence + reasons
Only MATCH_STRONG is treated as “matched” by default
Unknown/unreliable fields do not trigger enforcement
Kill switches + robots + rate limiting are respected
fetch_runs audit entries exist for preview
No alerts/emails are produced by preview runs