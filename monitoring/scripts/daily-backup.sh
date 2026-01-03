#!/bin/bash
# Daily Backup - PostgreSQL database backup with rotation

set -e

BACKUP_DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/backups/staycation-backup-${BACKUP_DATE}.sql"
BACKUP_COMPRESSED="/backups/staycation-backup-${BACKUP_DATE}.sql.gz"

echo "Starting database backup at $(date)"

# Create backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --create \
    > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Verify backup exists and has content
if [ -s "$BACKUP_COMPRESSED" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_COMPRESSED" | cut -f1)
    echo "✅ Backup created successfully: $BACKUP_COMPRESSED ($BACKUP_SIZE)"
else
    echo "❌ Backup failed or is empty"
    exit 1
fi

# Keep only last 7 daily backups
find /backups -name "staycation-backup-*.sql.gz" -mtime +7 -delete

# Keep one backup per week for the last 4 weeks
# Keep one backup per month for the last 12 months
# (This is a simple version - could be enhanced)

echo "Backup rotation complete"
echo "Current backups:"
ls -lh /backups/

echo "✅ Backup complete at $(date)"
