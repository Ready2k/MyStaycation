#!/bin/bash
# Daily Health Check - Comprehensive system health report

set -e

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_TIME=$(date +%H:%M:%S)
REPORT_FILE="/reports/health-check-${REPORT_DATE}.txt"

echo "========================================" > "$REPORT_FILE"
echo "Daily Health Check - $REPORT_DATE $REPORT_TIME" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 1. Database Connection Test
echo "## Database Connection" >> "$REPORT_FILE"
if PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database connection: OK" >> "$REPORT_FILE"
else
    echo "❌ Database connection: FAILED" >> "$REPORT_FILE"
    exit 1
fi
echo "" >> "$REPORT_FILE"

# 2. Fetch Runs Status (Last 24h)
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

# 3. Parse Failures
echo "## Parse Failures (Last 24h)" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    p.name as provider,
    fr.\"errorMessage\",
    COUNT(*) as count
FROM fetch_runs fr
JOIN providers p ON fr.provider_id = p.id
WHERE fr.status IN ('PARSE_FAILED', 'ERROR')
  AND fr.\"startedAt\" > NOW() - INTERVAL '24 hours'
GROUP BY p.name, fr.\"errorMessage\"
ORDER BY count DESC
LIMIT 10;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# 4. Observations Created
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

# 5. Insights Created
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

# 6. Alerts Sent
echo "## Alerts Sent (Last 24h)" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    status,
    COUNT(*) as count
FROM alerts
WHERE \"createdAt\" > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# 7. Series Key Integrity Check
echo "## Series Key Integrity" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: All observations have series keys'
        ELSE '❌ FAIL: ' || COUNT(*) || ' observations missing series key'
    END
FROM price_observations
WHERE \"seriesKey\" IS NULL OR \"seriesKey\" = '';
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# 8. Dedupe Check
echo "## Deduplication Check" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: No duplicate insights'
        ELSE '❌ FAIL: ' || COUNT(*) || ' duplicate insights found'
    END
FROM (
    SELECT \"dedupeKey\"
    FROM insights
    GROUP BY \"dedupeKey\"
    HAVING COUNT(*) > 1
) duplicates;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# 9. Database Size
echo "## Database Size" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    pg_size_pretty(pg_database_size('$POSTGRES_DB')) as database_size;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# 10. Table Sizes
echo "## Top 5 Largest Tables" >> "$REPORT_FILE"
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 5;
" >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

# 11. Summary
echo "## Summary" >> "$REPORT_FILE"
echo "Report generated at: $(date)" >> "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" >> "$REPORT_FILE"

# Keep only last 30 days of reports
find /reports -name "health-check-*.txt" -mtime +30 -delete

echo "✅ Health check complete: $REPORT_FILE"
