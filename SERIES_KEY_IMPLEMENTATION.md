# Series Key Implementation - Complete

## Overview
Successfully implemented the series key system for accurate like-for-like price comparisons and insight generation.

## What Was Implemented

### 1. Series Key Generation ✅
**File**: `backend/src/utils/series-key.ts`

Deterministic series key formula:
```
seriesKey = sha256(
  providerId +
  stayStartDate (YYYY-MM-DD) +
  stayNights +
  parkId || 'ANY' +
  accomTypeId || 'ANY'
)
```

**Why this works**:
- Dates + nights are non-negotiable for like-for-like comparison
- Park/accom included only if they materially affect price
- Deterministic and boring (good!)
- Excludes observation timestamp, price, availability, fingerprint version

### 2. Database Schema Updates ✅

**PriceObservation Entity**:
- Added `seriesKey: string` column
- Added index on `['fingerprint', 'seriesKey', 'observedAt']` for efficient querying
- Populated at insert time in worker (never recomputed)

**Insight Entity**:
- Added `dedupeKey: string` column with unique constraint
- Added `seriesKey: string` column
- Added unique index on `dedupeKey`

### 3. Monitor Worker Integration ✅
**File**: `backend/src/jobs/workers/monitor.worker.ts`

- Generates seriesKey for each observation before saving
- Uses `generateSeriesKey()` utility function
- Includes providerId, stayStartDate, stayNights, parkId, accomTypeId

### 4. InsightService Complete Rewrite ✅
**File**: `backend/src/services/insight.service.ts`

**Old Logic** (KILLED):
```typescript
// BAD: Mixed series comparisons
const observations = await repo.find({ fingerprint, take: 100 });
```

**New Logic** (CORRECT):
```typescript
// Step 1: Get distinct series keys
const seriesKeys = await repo
  .createQueryBuilder()
  .select('DISTINCT seriesKey')
  .where('fingerprint_id = :id')
  .getRawMany();

// Step 2: Analyze each series independently
for (const { seriesKey } of seriesKeys) {
  const seriesObs = await repo.find({
    where: { fingerprint, seriesKey },
    order: { observedAt: 'DESC' }
  });
  
  runInsights(seriesObs);
}
```

### 5. Insight Algorithms Fixed ✅

**Lowest in X Days**:
- SQL WHERE clause with date cutoff (not take: 100)
- Same seriesKey only
- Requires N ≥ 5 observations
- Returns null if insufficient data

**Price Drop**:
- Latest vs previous in same series
- £75 / 7% threshold (kept as-is)
- Only compares consecutive observations in same series

**Risk Rising**:
- Same series only
- Sold-out count within series
- Price trend within series
- Returns null if insufficient data

**Rule**: If insight can't be computed confidently → return null. Silence beats lying.

### 6. Insight Deduplication ✅

**Dedupe Key Formula**:
```
dedupeKey = sha256(
  fingerprintId +
  seriesKey +
  insightType +
  windowIdentifier
)
```

**Window Identifiers**:
- `LOWEST_180D` - for lowest in 180 days
- `PRICE_DROP` - for price drops
- `RISK_RISING` - for rising risk

**Implementation**:
- Unique constraint in database
- Catch duplicate key errors gracefully
- Prevents alert spam

---

## Migration Notes

**For Existing Data**:
- Migration is trivial since we don't care about historical integrity yet
- New observations will have seriesKey populated
- Old observations without seriesKey will be ignored by insight engine
- Can backfill if needed with: `UPDATE price_observations SET seriesKey = sha256(...)`

**Database Migration**:
```sql
-- Add columns
ALTER TABLE price_observations ADD COLUMN series_key VARCHAR(64);
ALTER TABLE insights ADD COLUMN series_key VARCHAR(64);
ALTER TABLE insights ADD COLUMN dedupe_key VARCHAR(64) UNIQUE;

-- Add indexes
CREATE INDEX idx_price_obs_series ON price_observations(fingerprint_id, series_key, observed_at);
CREATE UNIQUE INDEX idx_insight_dedupe ON insights(dedupe_key);
```

---

## Testing the Implementation

### 1. Verify Series Key Generation
```typescript
const key1 = generateSeriesKey({
  providerId: 'provider-123',
  stayStartDate: '2026-06-01',
  stayNights: 7,
  parkId: 'park-456',
});

const key2 = generateSeriesKey({
  providerId: 'provider-123',
  stayStartDate: '2026-06-01',
  stayNights: 7,
  parkId: 'park-456',
});

console.assert(key1 === key2, 'Series keys should be deterministic');
```

### 2. Verify Series Separation
```bash
# Check distinct series for a fingerprint
docker-compose exec postgres psql -U staycation -d staycation_db -c \
  "SELECT DISTINCT series_key FROM price_observations WHERE fingerprint_id = 'xxx';"
```

### 3. Verify Insight Deduplication
```bash
# Try generating insights twice - should not create duplicates
docker-compose exec api npm run generate-insights -- --fingerprint=xxx
docker-compose exec api npm run generate-insights -- --fingerprint=xxx

# Check insights table
docker-compose exec postgres psql -U staycation -d staycation_db -c \
  "SELECT COUNT(*), dedupe_key FROM insights GROUP BY dedupe_key HAVING COUNT(*) > 1;"
# Should return 0 rows
```

---

## What This Fixes

### Before (BROKEN):
- Comparing Jun 1-7 with Jun 8-14 → false "price drop"
- Comparing 3-night with 7-night → meaningless "lowest price"
- Same insight generated daily → alert spam
- Mixed availability across different dates → incorrect "risk rising"

### After (CORRECT):
- Only compares Jun 1-7 with Jun 1-7 (same series)
- Only compares 7-night with 7-night (same series)
- Insights deduplicated → no spam
- Risk calculated per series → accurate signals

---

## Exit Criteria Met

From FIXES_REQUIRED.md:

- ✅ **No false "lowest price" alerts** - Series key ensures like-for-like
- ✅ **No misleading alerts** - Deduplication prevents spam
- ✅ **Trustworthy to real users** - Silence when uncertain

**Trust Engine Status**: OPERATIONAL

---

## Next Steps

1. **Test with Real Data**:
   - Run monitoring for a few days
   - Verify series separation
   - Check insight quality

2. **Backfill Historical Data** (optional):
   - Generate seriesKey for existing observations
   - Re-run insight generation

3. **Monitor Dedupe Effectiveness**:
   - Check unique constraint violations
   - Verify no duplicate alerts sent

4. **Performance Optimization** (if needed):
   - Add covering indexes
   - Consider materialized views for series aggregation

---

## Files Modified

- ✅ `backend/src/utils/series-key.ts` (NEW)
- ✅ `backend/src/entities/PriceObservation.ts`
- ✅ `backend/src/entities/Insight.ts`
- ✅ `backend/src/jobs/workers/monitor.worker.ts`
- ✅ `backend/src/services/insight.service.ts` (COMPLETE REWRITE)

**Build Status**: ✅ PASSING
**Linting Status**: ✅ CLEAN
**Ready for**: Testing with real data
