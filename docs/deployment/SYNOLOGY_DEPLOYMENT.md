# Synology NAS Deployment Guide

This guide covers deploying UK Staycation Watcher on Synology NAS using Docker.

## Prerequisites

- Synology NAS with DSM 7.0 or later
- Docker package installed from Package Center
- At least 4GB RAM available
- 10GB free storage space

## Architecture Compatibility

All Docker images are built for **linux/amd64** (x86_64) architecture, which is compatible with:
- Synology NAS (Intel/AMD processors)
- Most cloud providers
- Standard Linux servers

**Note**: Not compatible with Apple Silicon Macs (M1/M2) without Rosetta emulation.

## Installation Steps

### 1. Prepare Synology

1. Open **Package Center**
2. Install **Docker** if not already installed
3. Open **File Station**
4. Create a shared folder: `docker/staycation`

### 2. Upload Project Files

Upload the entire project to `/docker/staycation/` on your Synology:

```
/docker/staycation/
├── backend/
├── web/
├── monitoring/
├── nginx/
├── docker-compose.yml
├── .env.example
└── ...
```

### 3. Configure Environment

1. SSH into your Synology or use the terminal in DSM
2. Navigate to the project:
   ```bash
   cd /volume1/docker/staycation
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   nano .env  # or use File Station to edit
   ```

4. Set required variables:
   ```bash
   # Generate a strong JWT secret
   JWT_SECRET=$(openssl rand -hex 32)
   
   # Set database password
   POSTGRES_PASSWORD=your_secure_password_here
   
   # Configure email (AWS SES or SMTP)
   AWS_SES_REGION=eu-west-1
   AWS_SES_ACCESS_KEY_ID=your_key
   AWS_SES_SECRET_ACCESS_KEY=your_secret
   EMAIL_FROM=noreply@yourdomain.com
   ```

### 4. Build and Start Containers

#### Option A: Using Docker Compose (Recommended)

```bash
# Development mode (no nginx)
docker-compose --profile dev up -d

# Production mode (with nginx)
docker-compose --profile prod up -d
```

#### Option B: Using Synology Docker UI

1. Open **Docker** app in DSM
2. Go to **Project**
3. Click **Create**
4. Select the folder containing `docker-compose.yml`
5. Choose profile: `dev` or `prod`
6. Click **Next** and **Done**

### 5. Verify Deployment

Check container status:

```bash
docker-compose ps
```

Expected output:
```
NAME                     STATUS
staycation-api           Up (healthy)
staycation-db            Up (healthy)
staycation-monitoring    Up
staycation-redis         Up (healthy)
staycation-web           Up
staycation-worker        Up
```

### 6. Access Application

- **Web UI**: http://your-synology-ip:3000
- **API**: http://your-synology-ip:4000
- **Health Check**: http://your-synology-ip:4000/health

## Synology-Specific Configuration

### Port Mapping

If ports 3000/4000/80 are already in use:

Edit `docker-compose.yml`:
```yaml
services:
  web:
    ports:
      - "8080:3000"  # Change 8080 to any available port
  
  api:
    ports:
      - "8081:4000"  # Change 8081 to any available port
```

### Storage Volumes

Data is stored in Docker volumes:
- `postgres-data`: Database
- `redis-data`: Cache
- `./monitoring/backups`: Database backups
- `./monitoring/reports`: Health reports

To access on Synology:
```bash
# Find volume location
docker volume inspect staycation_postgres-data

# Backups location
/volume1/docker/staycation/monitoring/backups/
```

### Automatic Startup

Enable auto-start in Synology Docker UI:
1. Open **Docker** app
2. Go to **Container**
3. Select each container
4. Click **Edit**
5. Enable **Enable auto-restart**

Or via command line:
```bash
docker update --restart=unless-stopped staycation-api
docker update --restart=unless-stopped staycation-worker
docker update --restart=unless-stopped staycation-db
docker update --restart=unless-stopped staycation-redis
docker update --restart=unless-stopped staycation-web
docker update --restart=unless-stopped staycation-monitoring
```

## Monitoring on Synology

### View Logs

Via Docker UI:
1. Open **Docker** app
2. Go to **Container**
3. Select container
4. Click **Details** → **Log**

Via command line:
```bash
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f monitoring
```

### Access Reports

Reports are saved to `monitoring/reports/`:

```bash
# Via SSH
cat /volume1/docker/staycation/monitoring/reports/health-check-$(date +%Y-%m-%d).txt

# Via File Station
Navigate to: docker/staycation/monitoring/reports/
```

### Database Backups

Automatic backups are saved to `monitoring/backups/`:

```bash
# List backups
ls -lh /volume1/docker/staycation/monitoring/backups/

# Restore backup
gunzip -c monitoring/backups/staycation-backup-YYYY-MM-DD_HH-MM-SS.sql.gz | \
  docker-compose exec -T postgres psql -U staycation -d staycation_db
```

## Resource Management

### Recommended Resources

- **RAM**: 2-4GB total
  - postgres: 512MB
  - redis: 256MB
  - api: 512MB
  - worker: 512MB
  - web: 512MB
  - monitoring: 256MB

### Limit Resources (Optional)

Edit `docker-compose.yml`:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          memory: 256M
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs api

# Check if ports are in use
netstat -tuln | grep -E '3000|4000|5432|6379'

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Issues

```bash
# Check database is running
docker-compose exec postgres pg_isready -U staycation

# Check environment variables
docker-compose exec api env | grep POSTGRES
```

### Out of Memory

```bash
# Check resource usage
docker stats

# Reduce concurrency in .env
PROVIDER_MAX_CONCURRENT=1
PLAYWRIGHT_CONCURRENCY=1
```

### Platform Mismatch Error

If you see "platform mismatch" errors:

```bash
# Force rebuild for amd64
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker-compose build

# Or set in .env
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

## Updating

### Pull Latest Changes

```bash
cd /volume1/docker/staycation
git pull  # If using git

# Or upload new files via File Station
```

### Rebuild and Restart

```bash
docker-compose down
docker-compose build
docker-compose --profile prod up -d
```

### Database Migrations

```bash
docker-compose exec api npm run migration:run
```

## Security Recommendations

1. **Change Default Passwords**
   - Set strong `POSTGRES_PASSWORD`
   - Set strong `JWT_SECRET` (min 32 chars)

2. **Firewall Rules**
   - Block external access to ports 3000, 4000
   - Only expose port 80/443 via reverse proxy

3. **SSL/HTTPS**
   - Use Synology's built-in reverse proxy
   - Or configure nginx with Let's Encrypt

4. **Backups**
   - Enable Synology Hyper Backup for Docker volumes
   - Store backups on external drive or cloud

## Performance Optimization

### For Low-End Synology Models

```bash
# Reduce worker concurrency
PROVIDER_MAX_CONCURRENT=1
PLAYWRIGHT_CONCURRENCY=1

# Disable Playwright (use HTTP only)
PLAYWRIGHT_ENABLED=false

# Reduce monitoring frequency
# Edit monitoring/crontab to run less frequently
```

### For High-End Models

```bash
# Increase concurrency
PROVIDER_MAX_CONCURRENT=4
PLAYWRIGHT_CONCURRENCY=2

# Enable more aggressive monitoring
# Edit monitoring/crontab for more frequent checks
```

## Support

For Synology-specific issues:
1. Check Synology Docker logs: `/var/log/docker.log`
2. Verify DSM version compatibility
3. Ensure sufficient storage space
4. Check network connectivity

For application issues:
- See main `README.md`
- Check `DEPLOYMENT.md`
- Review `STAGING_CHECKLIST.md`
