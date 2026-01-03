# REAL_WORLD_MAPPING.md
## HolidayProfile → Real-World Inventory Mapping (Authoritative Spec)

**Status**: Aligned with current codebase  
**Last Updated**: 2026-01-03  
**Applies to**: `HolidayProfile`, `SearchFingerprint`, Provider Adapters

---

## 1. Purpose

The `HolidayProfile` represents **user intent**.  
Provider websites represent **messy, inconsistent inventory**.

This document defines how a `HolidayProfile` is safely and truthfully mapped onto:
- provider search queries
- parsed inventory results
- price observations
- alerts

**Core rule**:  
> If a profile field cannot be mapped reliably for a provider, it MUST NOT be enforced as a hard filter.

Silence beats lying.

---

## 2. Domain Alignment (Canonical Terms)

| Concept | Meaning |
|------|--------|
| HolidayProfile | User-defined preferences & constraints |
| SearchFingerprint | Canonical query identity derived from fingerprint-bound fields |
| Observation | One measured price/availability result |
| SeriesKey | Like-for-like grouping of the same stay across time |
| Adapter | Provider-specific mapping + parsing logic |

---

## 3. HolidayProfile Field Mapping Matrix

Each field is classified across four dimensions:

- **Fingerprint-bound**: change creates a new fingerprint
- **Query-level**: influences provider search URL
- **Post-filter**: applied after parsing results
- **Reliability**: NATIVE / DERIVED / HEURISTIC / UNSUPPORTED

---

### 3.1 Party & Dates

| Field | Fingerprint | Query | Post | Reliability | Notes |
|-----|-------------|-------|------|------------|------|
| partySizeAdults | ✅ | ✅ | — | NATIVE | Always supported |
| partySizeChildren | ✅ | ✅ | — | NATIVE | Always supported |
| flexType | ✅ | ⚠️ | — | DERIVED | Providers vary |
| dateStart | ✅ | ⚠️ | — | DERIVED | Often query param |
| dateEnd | ✅ | ⚠️ | — | DERIVED | Often inferred |
| durationNightsMin | ✅ | ⚠️ | ✅ | DERIVED | Parsed if missing |
| durationNightsMax | ✅ | ⚠️ | ✅ | DERIVED | Parsed if missing |
| stayPattern | ❌ | ❌ | ✅ | DERIVED | Computed from dates |
| schoolHolidays | ❌ | ❌ | ✅ | DERIVED | Calendar-based |

**Rule**:  
Dates and nights MUST NEVER be defaulted if missing.  
Invalid or missing values → result discarded.

---

### 3.2 Budget & Enablement

| Field | Fingerprint | Query | Post | Reliability | Notes |
|-----|-------------|-------|------|------------|------|
| budgetCeilingGbp | ❌ | ❌ | ✅ | DERIVED | Hard cap only |
| enabled | ❌ | ❌ | ❌ | NATIVE | Scheduler only |

---

### 3.3 Accommodation Constraints

| Field | Fingerprint | Query | Post | Reliability | Notes |
|-----|-------------|-------|------|------------|------|
| accommodationType | ✅ | ⚠️ | ✅ | DERIVED | Normalised enum |
| minBedrooms | ✅ | ❌ | ✅ | DERIVED | Detail page preferred |
| tier | ❌ | ❌ | ✅ | HEURISTIC | Never hard-filter |

**Important**  
`AccommodationTier` is **ranking-only**.  
It MUST NOT invalidate observations or fingerprints.

---

### 3.4 Pets & Accessibility

| Field | Fingerprint | Query | Post | Reliability | Notes |
|-----|-------------|-------|------|------------|------|
| pets | ✅ | ⚠️ | ✅ | DERIVED | Binary only |
| petsNumber | ❌ | ❌ | ❌ | HEURISTIC | Advisory only |
| stepFreeAccess | ❌ | ❌ | ❌ | UNSUPPORTED | Never enforced |
| accessibleBathroom | ❌ | ❌ | ❌ | UNSUPPORTED | Never enforced |

**Rule**  
Accessibility flags are **informational only** unless a provider explicitly supports them.

---

### 3.5 Facilities

| Field | Fingerprint | Query | Post | Reliability | Notes |
|-----|-------------|-------|------|------------|------|
| requiredFacilities | ❌ | ❌ | ✅ | DERIVED | Must-have only |

Facilities MAY:
- downgrade confidence
- exclude from alerts if explicitly required

Facilities MUST NOT:
- break fingerprints
- discard inventory silently

---

### 3.6 Alerts

| Field | Fingerprint | Query | Post | Reliability | Notes |
|-----|-------------|-------|------|------------|------|
| alertSensitivity | ❌ | ❌ | ❌ | NATIVE | Alert engine only |

---

## 4. Fingerprint Composition (MANDATORY)

A `SearchFingerprint` MUST be derived ONLY from:

- partySizeAdults
- partySizeChildren
- flexType
- dateStart
- dateEnd
- durationNightsMin
- durationNightsMax
- accommodationType
- minBedrooms
- pets (boolean)

**Explicitly excluded**:
- tier
- facilities
- accessibility
- alertSensitivity
- budgetCeilingGbp

This ensures:
- historical continuity
- stable price series
- safe evolution of preferences

---

## 5. Adapter Output Contract (Required)

Each adapter MUST emit normalized results with:

### Required
- providerId
- sourceUrl
- stayStartDate (ISO)
- stayNights (>0)
- priceTotalGbp
- availability
- parkId (or `ANY`)
- accommodationType (or `ANY`)

### Optional (Confidence Enhancers)
- bedrooms
- tier
- facilities
- petsAllowed

### Forbidden
- defaulted dates
- guessed nights
- inferred accessibility

Invalid results MUST be skipped, not corrected.

---

## 6. Match Confidence Classification

Each parsed result MUST be classified:

| Confidence | Meaning |
|----------|--------|
| MATCH_STRONG | All fingerprint fields confirmed |
| MATCH_WEAK | Fingerprint ok, some soft fields unknown |
| MATCH_UNKNOWN | Key data missing, do not alert |
| MISMATCH | Hard constraint violated |

**Alert rule**:  
Only `MATCH_STRONG` results generate alerts by default.

---

## 7. SeriesKey Interaction

SeriesKey MUST be derived from:
- providerId
- stayStartDate
- stayNights
- parkId (or ANY)
- accommodationType (or ANY)

SeriesKey MUST NOT include:
- price
- availability
- timestamp
- profile preferences

---

## 8. Provider Capability Matrix (Required Artifact)

Each provider MUST maintain a capability definition:

- Which fields are NATIVE
- Which are DERIVED
- Which are UNSUPPORTED

This matrix MUST be:
- versioned
- referenced by adapters
- updated when parsing changes

---

## 9. UI Trust Rules

The HolidayProfile UI MUST display:

**Enforced**
- dates
- nights
- party size
- pets
- accommodation type
- bedrooms

**Preferred**
- tier
- facilities
- school holiday handling

**Unknown**
- accessibility
- pet count restrictions

If users misunderstand what is enforced, trust is lost.

---

## 10. Definition of “Works in the Real World”

The system is considered real-world valid when:

- Every alert corresponds to a bookable result
- No alert relies on guessed data
- Provider HTML changes do not crash workers
- Unknown data results in silence, not lies
- Historical price series remain intact across profile edits

---

## Final Principle

The HolidayProfile describes **intent**, not certainty.

Mapping exists to:
- respect intent
- accept uncertainty
- and never pretend otherwise

If the system ever feels confident when it should be unsure, it is wrong.
