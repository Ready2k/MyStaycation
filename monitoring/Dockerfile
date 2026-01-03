# Monitoring container Dockerfile
# Compatible with Synology NAS (x86_64/amd64)

FROM --platform=linux/amd64 postgres:16-alpine

# Install required tools
RUN apk add --no-cache \
    bash \
    curl \
    postgresql-client \
    tzdata \
    dcron \
    tini

# Set timezone
ENV TZ=Europe/London

# Create directories
RUN mkdir -p /reports /backups /scripts /var/log/monitoring

# Copy monitoring scripts
COPY scripts/daily-health-check.sh /scripts/
COPY scripts/daily-backup.sh /scripts/
COPY scripts/daily-report.sh /scripts/
COPY scripts/weekly-cleanup.sh /scripts/
COPY scripts/quick-health-check.sh /scripts/
COPY scripts/check-stale-jobs.sh /scripts/
COPY scripts/entrypoint.sh /entrypoint.sh

# Make scripts executable
RUN chmod +x /scripts/*.sh /entrypoint.sh

# Copy crontab
COPY crontab /etc/crontabs/root

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["crond", "-f", "-l", "2"]
