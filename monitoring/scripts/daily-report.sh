#!/bin/bash
# Daily Report - Same as the standalone daily-report.sh but adapted for container

set -e

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="/reports/daily-report-${REPORT_DATE}.txt"

echo "==================================" > "$REPORT_FILE"
echo "Daily Report - $REPORT_DATE" >> "$REPORT_FILE"
echo "==================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Fetch Runs Status (Last 24h)
echo "## Fetch Runs (Last 24h)" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as percentage
FROM fetch_runs
WHERE \"startedAt\" > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# Observations Created
echo "## Observations Created (Last 24h)" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    COUNT(*) as total_observations,
    COUNT(DISTINCT \"seriesKey\") as unique_series,
    COUNT(DISTINCT fingerprint_id) as unique_fingerprints
FROM price_observations
WHERE \"observedAt\" > NOW() - INTERVAL '24 hours';
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# Insights Created
echo "## Insights Created (Last 24h)" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    type,
    COUNT(*) as count
FROM insights
WHERE \"createdAt\" > NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY count DESC;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

echo "Report generated at: $(date)" >> "$REPORT_FILE"

# Keep only last 30 days of reports
find /reports -name "daily-report-*.txt" -mtime +30 -delete

echo "✅ Daily report complete: $REPORT_FILE"
