#!/bin/bash
# Check for Stale Jobs - Detect jobs that are stuck or taking too long

set -e

TIMESTAMP=$(date +%Y-%m-%d_%H:%M:%S)

echo "Checking for stale jobs at $TIMESTAMP"

# Check for fetch runs that started more than 1 hour ago and haven't finished
STALE_RUNS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT COUNT(*) 
FROM fetch_runs 
WHERE started_at < NOW() - INTERVAL '1 hour' 
  AND finished_at IS NULL;
")

if [ "$STALE_RUNS" -gt 0 ]; then
    echo "⚠️  WARNING: $STALE_RUNS stale fetch runs detected"
    
    # Get details
    PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 
        id,
        started_at,
        NOW() - started_at as running_for,
        status
    FROM fetch_runs 
    WHERE started_at < NOW() - INTERVAL '1 hour' 
      AND finished_at IS NULL
    ORDER BY started_at;
    "
else
    echo "✅ No stale jobs detected"
fi
