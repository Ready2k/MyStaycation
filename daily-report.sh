#!/bin/bash

# Daily Staging Report Script
# Run this daily during the 7-day soak test

set -e

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="staging-report-${REPORT_DATE}.txt"

echo "==================================" > "$REPORT_FILE"
echo "Staging Report - $REPORT_DATE" >> "$REPORT_FILE"
echo "==================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 1. Container Health
echo "## Container Status" >> "$REPORT_FILE"
docker-compose ps >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 2. Fetch Runs Status (Last 24h)
echo "## Fetch Runs (Last 24h)" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM fetch_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 3. Parse Failures
echo "## Parse Failures (Last 24h)" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    p.name as provider,
    fr.error_message,
    COUNT(*) as count
FROM fetch_runs fr
JOIN providers p ON fr.provider_id = p.id
WHERE fr.status IN ('PARSE_FAILED', 'ERROR')
  AND fr.started_at > NOW() - INTERVAL '24 hours'
GROUP BY p.name, fr.error_message
ORDER BY count DESC
LIMIT 10;
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 4. Observations Created
echo "## Observations Created (Last 24h)" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    COUNT(*) as total_observations,
    COUNT(DISTINCT series_key) as unique_series,
    COUNT(DISTINCT fingerprint_id) as unique_fingerprints
FROM price_observations
WHERE observed_at > NOW() - INTERVAL '24 hours';
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 5. Insights Created
echo "## Insights Created (Last 24h)" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    type,
    COUNT(*) as count
FROM insights
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY count DESC;
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 6. Alerts Sent
echo "## Alerts Sent (Last 24h)" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    status,
    COUNT(*) as count
FROM alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 7. Series Key Integrity Check
echo "## Series Key Integrity" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS: All observations have series keys'
        ELSE 'FAIL: ' || COUNT(*) || ' observations missing series key'
    END as status
FROM price_observations
WHERE series_key IS NULL OR series_key = '';
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 8. Dedupe Check
echo "## Deduplication Check" >> "$REPORT_FILE"
docker-compose exec -T postgres psql -U staycation -d staycation_db -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS: No duplicate insights'
        ELSE 'FAIL: ' || COUNT(*) || ' duplicate insights found'
    END as status
FROM (
    SELECT dedupe_key
    FROM insights
    GROUP BY dedupe_key
    HAVING COUNT(*) > 1
) duplicates;
" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 9. Recent Errors from Logs
echo "## Recent Errors (Last 100 lines)" >> "$REPORT_FILE"
docker-compose logs --tail=100 worker 2>&1 | grep -i error | tail -20 >> "$REPORT_FILE" || echo "No errors found" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 10. Summary
echo "## Summary" >> "$REPORT_FILE"
echo "Report generated at: $(date)" >> "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" >> "$REPORT_FILE"

# Display report
cat "$REPORT_FILE"

echo ""
echo "✅ Report saved to: $REPORT_FILE"
