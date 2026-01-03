FROM postgres:16-alpine

# Install required tools
RUN apk add --no-cache \
    bash \
    curl \
    postgresql-client \
    tzdata

# Set timezone
ENV TZ=Europe/London

# Create directories
RUN mkdir -p /reports /backups /scripts

# Copy monitoring scripts
COPY scripts/daily-health-check.sh /scripts/
COPY scripts/daily-backup.sh /scripts/
COPY scripts/daily-report.sh /scripts/
COPY scripts/weekly-cleanup.sh /scripts/
COPY monitoring-queries.sql /scripts/

# Make scripts executable
RUN chmod +x /scripts/*.sh

# Install cron
RUN apk add --no-cache dcron

# Copy crontab
COPY crontab /etc/crontabs/root

# Create log directory
RUN mkdir -p /var/log/monitoring

# Entry point script
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["crond", "-f", "-l", "2"]
