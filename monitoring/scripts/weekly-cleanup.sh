#!/bin/bash
# Weekly Cleanup - Remove old data and optimize database

set -e

echo "Starting weekly cleanup at $(date)"

# 1. Clean up old fetch runs (keep last 90 days)
echo "Cleaning up old fetch runs..."
DELETED_RUNS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
DELETE FROM fetch_runs 
WHERE started_at < NOW() - INTERVAL '90 days'
RETURNING id;
" | wc -l)
echo "Deleted $DELETED_RUNS old fetch runs"

# 2. Clean up old insights (keep last 180 days)
echo "Cleaning up old insights..."
DELETED_INSIGHTS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
DELETE FROM insights 
WHERE created_at < NOW() - INTERVAL '180 days'
RETURNING id;
" | wc -l)
echo "Deleted $DELETED_INSIGHTS old insights"

# 3. Clean up old alerts (keep last 90 days)
echo "Cleaning up old alerts..."
DELETED_ALERTS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
DELETE FROM alerts 
WHERE created_at < NOW() - INTERVAL '90 days'
RETURNING id;
" | wc -l)
echo "Deleted $DELETED_ALERTS old alerts"

# 4. Vacuum and analyze database
echo "Running VACUUM ANALYZE..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "VACUUM ANALYZE;"

# 5. Generate cleanup report
REPORT_FILE="/reports/weekly-cleanup-$(date +%Y-%m-%d).txt"
cat > "$REPORT_FILE" << EOF
Weekly Cleanup Report - $(date)
================================

Deleted Records:
- Fetch Runs: $DELETED_RUNS
- Insights: $DELETED_INSIGHTS
- Alerts: $DELETED_ALERTS

Database Size After Cleanup:
EOF

PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB')) as database_size;
" >> "$REPORT_FILE"

echo "✅ Weekly cleanup complete at $(date)"
echo "Report saved to: $REPORT_FILE"
