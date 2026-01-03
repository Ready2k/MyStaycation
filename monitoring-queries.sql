-- Daily Monitoring Report Queries
-- Run these daily during staging soak test

-- 1. Fetch Runs Status Distribution (Last 24 Hours)
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM fetch_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- 2. Fetch Runs by Provider (Last 24 Hours)
SELECT 
    p.name as provider,
    fr.status,
    COUNT(*) as count
FROM fetch_runs fr
JOIN providers p ON fr.provider_id = p.id
WHERE fr.started_at > NOW() - INTERVAL '24 hours'
GROUP BY p.name, fr.status
ORDER BY p.name, fr.status;

-- 3. Parse Failures with Error Messages
SELECT 
    p.name as provider,
    fr.error_message,
    COUNT(*) as occurrences,
    MAX(fr.started_at) as last_occurrence
FROM fetch_runs fr
JOIN providers p ON fr.provider_id = p.id
WHERE fr.status IN ('PARSE_FAILED', 'ERROR')
  AND fr.started_at > NOW() - INTERVAL '7 days'
GROUP BY p.name, fr.error_message
ORDER BY occurrences DESC;

-- 4. Observations Created Per Day
SELECT 
    DATE(observed_at) as date,
    COUNT(*) as observations,
    COUNT(DISTINCT series_key) as unique_series,
    COUNT(DISTINCT fingerprint_id) as unique_fingerprints
FROM price_observations
WHERE observed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(observed_at)
ORDER BY date DESC;

-- 5. Series Key Distribution
SELECT 
    series_key,
    MIN(stay_start_date) as first_stay_date,
    stay_nights,
    COUNT(*) as observation_count,
    MIN(price_total_gbp) as min_price,
    MAX(price_total_gbp) as max_price,
    AVG(price_total_gbp) as avg_price
FROM price_observations
GROUP BY series_key, stay_nights
HAVING COUNT(*) > 1
ORDER BY observation_count DESC
LIMIT 20;

-- 6. Insights Created Per Day
SELECT 
    DATE(created_at) as date,
    type,
    COUNT(*) as count
FROM insights
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), type
ORDER BY date DESC, type;

-- 7. Alerts Sent Per Day
SELECT 
    DATE(created_at) as date,
    status,
    COUNT(*) as count
FROM alerts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), status
ORDER BY date DESC, status;

-- 8. Dedupe Effectiveness Check
-- Should return 0 rows (no duplicate insights)
SELECT 
    dedupe_key,
    COUNT(*) as duplicate_count
FROM insights
GROUP BY dedupe_key
HAVING COUNT(*) > 1;

-- 9. Observations Without Series Key (Should be 0)
SELECT COUNT(*) as missing_series_key_count
FROM price_observations
WHERE series_key IS NULL OR series_key = '';

-- 10. Playwright Fallback Rate
SELECT 
    CASE 
        WHEN error_message LIKE '%Playwright%' OR error_message LIKE '%browser%' 
        THEN 'Playwright Used'
        ELSE 'HTTP Only'
    END as fetch_method,
    COUNT(*) as count
FROM fetch_runs
WHERE status = 'OK'
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY fetch_method;

-- 11. Average Observations Per Fetch Run
SELECT 
    AVG(obs_count) as avg_observations_per_run,
    MIN(obs_count) as min_observations,
    MAX(obs_count) as max_observations
FROM (
    SELECT 
        fetch_run_id,
        COUNT(*) as obs_count
    FROM price_observations
    WHERE observed_at > NOW() - INTERVAL '24 hours'
    GROUP BY fetch_run_id
) subquery;

-- 12. Users with Email Notifications Enabled
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN notifications_enabled THEN 1 ELSE 0 END) as notifications_enabled,
    SUM(CASE WHEN email_verified THEN 1 ELSE 0 END) as email_verified
FROM users;

-- 13. Health Check - Recent Activity
SELECT 
    'Last Fetch Run' as metric,
    MAX(started_at)::text as value
FROM fetch_runs
UNION ALL
SELECT 
    'Last Observation' as metric,
    MAX(observed_at)::text as value
FROM price_observations
UNION ALL
SELECT 
    'Last Insight' as metric,
    MAX(created_at)::text as value
FROM insights
UNION ALL
SELECT 
    'Last Alert' as metric,
    MAX(created_at)::text as value
FROM alerts;
