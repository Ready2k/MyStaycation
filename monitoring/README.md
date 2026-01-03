# Monitoring Container

Automated monitoring and maintenance container for UK Staycation Watcher.

## Features

### Automated Tasks

1. **Daily Health Check** (8 AM)
   - Database connection test
   - Fetch runs status analysis
   - Parse failure detection
   - Observations created count
   - Insights and alerts summary
   - Series key integrity check
   - Deduplication verification
   - Database size monitoring

2. **Daily Backup** (2 AM)
   - Full PostgreSQL database backup
   - Compression (gzip)
   - 7-day rotation (keeps last 7 days)
   - Automatic cleanup of old backups

3. **Daily Report** (9 AM)
   - Summary of last 24 hours activity
   - Fetch runs breakdown
   - Observations and insights created
   - Saved to `/reports` directory

4. **Weekly Cleanup** (Sunday 3 AM)
   - Remove old fetch runs (>90 days)
   - Remove old insights (>180 days)
   - Remove old alerts (>90 days)
   - VACUUM ANALYZE database
   - Generate cleanup report

5. **Hourly Quick Health Check**
   - Detect failed runs in last hour
   - Check for stale observations
   - Database connection verification

6. **Stale Job Detection** (Every 6 hours)
   - Find jobs stuck for >1 hour
   - Alert on long-running processes

## Directory Structure

```
monitoring/
├── Dockerfile
├── crontab
├── scripts/
│   ├── entrypoint.sh
│   ├── daily-health-check.sh
│   ├── daily-backup.sh
│   ├── daily-report.sh
│   ├── weekly-cleanup.sh
│   ├── quick-health-check.sh
│   └── check-stale-jobs.sh
├── reports/          # Generated reports (mounted volume)
└── backups/          # Database backups (mounted volume)
```

## Usage

### Start Monitoring Container

```bash
# Dev mode
docker-compose --profile dev up -d monitoring

# Prod mode
docker-compose --profile prod up -d monitoring
```

### View Logs

```bash
# All monitoring logs
docker-compose logs -f monitoring

# Specific log files
docker-compose exec monitoring tail -f /var/log/monitoring/health-check.log
docker-compose exec monitoring tail -f /var/log/monitoring/backup.log
docker-compose exec monitoring tail -f /var/log/monitoring/daily-report.log
```

### Access Reports

Reports are saved to `./monitoring/reports/` on the host:

```bash
# View latest health check
cat monitoring/reports/health-check-$(date +%Y-%m-%d).txt

# View latest daily report
cat monitoring/reports/daily-report-$(date +%Y-%m-%d).txt

# List all reports
ls -lh monitoring/reports/
```

### Access Backups

Backups are saved to `./monitoring/backups/` on the host:

```bash
# List backups
ls -lh monitoring/backups/

# Restore from backup
gunzip -c monitoring/backups/staycation-backup-YYYY-MM-DD_HH-MM-SS.sql.gz | \
  docker-compose exec -T postgres psql -U staycation -d staycation_db
```

### Manual Task Execution

```bash
# Run health check manually
docker-compose exec monitoring /scripts/daily-health-check.sh

# Run backup manually
docker-compose exec monitoring /scripts/daily-backup.sh

# Run cleanup manually
docker-compose exec monitoring /scripts/weekly-cleanup.sh
```

## Environment Variables

Set in `.env`:

```bash
# Timezone for cron jobs
TZ=Europe/London

# Database connection (automatically set from main config)
POSTGRES_HOST=postgres
POSTGRES_USER=staycation
POSTGRES_PASSWORD=your_password
POSTGRES_DB=staycation_db
```

## Cron Schedule

| Task | Schedule | Description |
|------|----------|-------------|
| Health Check | Daily 8 AM | Comprehensive system health report |
| Backup | Daily 2 AM | Full database backup with rotation |
| Daily Report | Daily 9 AM | 24-hour activity summary |
| Weekly Cleanup | Sunday 3 AM | Remove old data, optimize DB |
| Quick Health | Every hour | Fast health check for issues |
| Stale Jobs | Every 6 hours | Detect stuck processes |

## Customization

### Modify Cron Schedule

Edit `monitoring/crontab`:

```cron
# Example: Run health check at 6 AM instead
0 6 * * * /scripts/daily-health-check.sh >> /var/log/monitoring/health-check.log 2>&1
```

### Add New Monitoring Script

1. Create script in `monitoring/scripts/`
2. Make it executable: `chmod +x monitoring/scripts/your-script.sh`
3. Add to `monitoring/crontab`
4. Rebuild container: `docker-compose build monitoring`

### Adjust Retention Periods

Edit scripts to change how long data is kept:

- **Health checks**: 30 days (in `daily-health-check.sh`)
- **Backups**: 7 days (in `daily-backup.sh`)
- **Reports**: 30 days (in `daily-report.sh`)
- **Fetch runs**: 90 days (in `weekly-cleanup.sh`)
- **Insights**: 180 days (in `weekly-cleanup.sh`)
- **Alerts**: 90 days (in `weekly-cleanup.sh`)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs monitoring

# Verify database connection
docker-compose exec monitoring env | grep POSTGRES
```

### Cron jobs not running

```bash
# Check cron is running
docker-compose exec monitoring ps aux | grep crond

# Check crontab
docker-compose exec monitoring cat /etc/crontabs/root

# Check cron logs
docker-compose exec monitoring cat /var/log/monitoring/*.log
```

### Backups failing

```bash
# Check backup logs
docker-compose exec monitoring cat /var/log/monitoring/backup.log

# Verify disk space
df -h monitoring/backups/

# Test manual backup
docker-compose exec monitoring /scripts/daily-backup.sh
```

## Production Recommendations

1. **External Backup Storage**
   - Mount backups to external volume or S3
   - Set up off-site backup replication

2. **Alerting**
   - Configure email alerts for critical failures
   - Integrate with monitoring tools (Prometheus, Grafana)

3. **Log Aggregation**
   - Send logs to centralized logging (ELK, CloudWatch)
   - Set up log rotation

4. **Monitoring Dashboard**
   - Create Grafana dashboards from reports
   - Set up alerts for anomalies

## Security Notes

- Backups contain sensitive data - encrypt if storing externally
- Reports may contain user data - restrict access appropriately
- Database credentials are passed via environment variables
- Consider using secrets management for production
