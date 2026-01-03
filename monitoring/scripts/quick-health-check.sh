#!/bin/bash
# Quick Health Check - Runs every hour for immediate issue detection

set -e

TIMESTAMP=$(date +%Y-%m-%d_%H:%M:%S)

# Check if any fetch runs failed in the last hour
FAILED_RUNS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT COUNT(*) 
FROM fetch_runs 
WHERE status IN ('ERROR', 'PARSE_FAILED') 
  AND \"startedAt\" > NOW() - INTERVAL '1 hour';
")

if [ "$FAILED_RUNS" -gt 10 ]; then
    echo "⚠️  WARNING [$TIMESTAMP]: $FAILED_RUNS fetch runs failed in the last hour"
fi

# Check if any observations were created in the last 2 hours
RECENT_OBS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT COUNT(*) 
FROM price_observations 
WHERE \"observedAt\" > NOW() - INTERVAL '2 hours';
")

if [ "$RECENT_OBS" -eq 0 ]; then
    echo "⚠️  WARNING [$TIMESTAMP]: No observations created in the last 2 hours"
fi

# Check database connection
if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ CRITICAL [$TIMESTAMP]: Database connection failed"
    exit 1
fi

echo "✅ Quick health check passed [$TIMESTAMP]"
