#!/bin/bash
set -e

echo "Starting monitoring container..."
echo "Timezone: $TZ"
echo "Current time: $(date)"

# Wait for postgres to be ready
echo "Waiting for PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"

# Create initial report
echo "Generating initial report..."
/scripts/daily-health-check.sh

# Start cron
echo "Starting cron daemon..."
exec "$@"
