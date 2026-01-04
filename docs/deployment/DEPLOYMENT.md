# Deployment Guide

## Local Development

### 1. Prerequisites
- Docker Desktop installed and running
- Git
- Text editor

### 2. Setup
```bash
# Clone repository
git clone <repository-url>
cd MyStaycation

# Create environment file
cp .env.example .env

# Edit .env with your settings
nano .env  # or use your preferred editor
```

### 3. Start Services
```bash
# Start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Check container status
docker-compose ps
```

### 4. Initialize Database
```bash
# Run migrations (automatic in development)
# Run seeds
docker-compose exec api npm run seed
```

### 5. Access Application
- Web: http://localhost
- API: http://localhost:4000
- Database: localhost:5432 (use a PostgreSQL client)

---

## Production Deployment (AWS)

### Option 1: AWS Lightsail (Recommended for MVP)

**1. Create Lightsail Instance**
- Choose Ubuntu 22.04 LTS
- Select at least 2GB RAM plan ($10/month)
- Enable static IP

**2. Connect and Install Docker**
```bash
ssh ubuntu@<your-ip>

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
exit
ssh ubuntu@<your-ip>
```

**3. Deploy Application**
```bash
# Clone repository
git clone <repository-url>
cd MyStaycation

# Create production .env
cp .env.example .env
nano .env

# IMPORTANT: Set these in .env
# - Strong JWT_SECRET
# - Production database password
# - AWS SES credentials
# - APP_URL to your domain
# - NODE_ENV=production
```

**4. Configure SSL with Let's Encrypt**
```bash
# Install certbot
sudo apt update
sudo apt install certbot

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be in /etc/letsencrypt/live/yourdomain.com/

# Update nginx/nginx.conf to use SSL (uncomment HTTPS server block)
# Update paths to certificates

# Set up auto-renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

**5. Start Application**
```bash
# Start services
docker-compose -f docker-compose.yml up -d

# Run seeds
docker-compose exec api npm run seed

# Check logs
docker-compose logs -f
```

**6. Configure Firewall**
```bash
# In Lightsail console, configure firewall:
# - Allow HTTP (80)
# - Allow HTTPS (443)
# - Allow SSH (22) from your IP only
```

### Option 2: AWS ECS Fargate

**1. Build and Push Images**
```bash
# Login to ECR
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-west-1.amazonaws.com

# Create ECR repositories
aws ecr create-repository --repository-name staycation-api
aws ecr create-repository --repository-name staycation-worker
aws ecr create-repository --repository-name staycation-web

# Build and push
docker build -t staycation-api -f backend/Dockerfile backend/
docker tag staycation-api:latest <account-id>.dkr.ecr.eu-west-1.amazonaws.com/staycation-api:latest
docker push <account-id>.dkr.ecr.eu-west-1.amazonaws.com/staycation-api:latest

# Repeat for worker and web
```

**2. Create RDS PostgreSQL Database**
- Use AWS Console or CLI
- Choose PostgreSQL 16
- Note connection details for environment variables

**3. Create ElastiCache Redis**
- Choose Redis 7
- Note connection endpoint

**4. Create ECS Cluster and Task Definitions**
- Use AWS Console or Infrastructure as Code (Terraform/CDK)
- Define tasks for api, worker, web
- Set environment variables from Secrets Manager

**5. Create Application Load Balancer**
- Configure target groups for web and api
- Set up SSL certificate from ACM

---

## Environment Variables Reference

### Required
```bash
# Database
POSTGRES_HOST=postgres
POSTGRES_DB=staycation_db
POSTGRES_USER=staycation
POSTGRES_PASSWORD=<strong-password>

# JWT
JWT_SECRET=<minimum-32-character-random-string>

# Email (AWS SES)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
EMAIL_FROM=noreply@yourdomain.com

# Application
APP_URL=https://yourdomain.com
NODE_ENV=production
```

### Optional
```bash
# SMTP (alternative to SES)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<username>
SMTP_PASSWORD=<password>

# Monitoring
MONITORING_INTERVAL_HOURS=48
MONITORING_JITTER_PERCENT=30

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX_REQUESTS=100
```

---

## AWS SES Setup

**1. Verify Email Address**
```bash
aws ses verify-email-identity --email-address noreply@yourdomain.com
```

**2. Request Production Access**
- By default, SES is in sandbox mode
- Request production access in AWS Console
- Provide use case description

**3. Create IAM User**
```bash
# Create user with SES permissions
aws iam create-user --user-name staycation-ses

# Attach policy
aws iam attach-user-policy --user-name staycation-ses --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess

# Create access key
aws iam create-access-key --user-name staycation-ses
# Save the AccessKeyId and SecretAccessKey
```

---

## Database Backup

### Automated Backups
```bash
# Add to crontab
0 2 * * * docker-compose exec -T postgres pg_dump -U staycation staycation_db | gzip > /backups/staycation_$(date +\%Y\%m\%d).sql.gz
```

### Manual Backup
```bash
docker-compose exec postgres pg_dump -U staycation staycation_db > backup.sql
```

### Restore
```bash
docker-compose exec -T postgres psql -U staycation staycation_db < backup.sql
```

---

## Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker

# Last 100 lines
docker-compose logs --tail=100 api
```

### Monitor Resources
```bash
docker stats
```

### Health Checks
```bash
# API health
curl http://localhost:4000/health

# Database connection
docker-compose exec postgres psql -U staycation -d staycation_db -c "SELECT 1;"
```

---

## Troubleshooting

### Containers won't start
```bash
# Check logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection errors
```bash
# Check if postgres is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify credentials in .env
```

### Email not sending
```bash
# Check API logs for email errors
docker-compose logs api | grep email

# Verify AWS SES credentials
# Check SES sending limits in AWS Console
```

### Worker not processing jobs
```bash
# Check worker logs
docker-compose logs worker

# Check Redis connection
docker-compose exec redis redis-cli ping
```

---

## Scaling

### Horizontal Scaling
- Add more worker containers: `docker-compose up -d --scale worker=3`
- Use load balancer for multiple API instances

### Vertical Scaling
- Increase container resources in docker-compose.yml
- Upgrade server instance size

---

## Security Checklist

- [ ] Strong JWT_SECRET set (32+ characters)
- [ ] Strong database password
- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured (only 80, 443, 22)
- [ ] SSH key-based authentication only
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] Database backups automated
- [ ] Secrets not committed to git
- [ ] Rate limiting enabled
- [ ] CORS properly configured
