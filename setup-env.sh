#!/bin/bash

# Environment Setup Script for UK Staycation Watcher
# This script generates a secure .env file with all required secrets

set -e

echo "🔧 UK Staycation Watcher - Environment Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate random secret
generate_secret() {
    openssl rand -hex 32
}

# Function to generate random password
generate_password() {
    openssl rand -base64 24 | tr -d "=+/" | cut -c1-20
}

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting setup. Existing .env file preserved."
        exit 0
    fi
    # Backup existing .env
    BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backed up existing .env to $BACKUP_FILE${NC}"
fi

# Check if .env.example exists
if [ ! -f .env.example ]; then
    echo -e "${RED}❌ .env.example not found!${NC}"
    exit 1
fi

echo "📝 Generating secure secrets..."
echo ""

# Generate secrets
JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
POSTGRES_PASSWORD=$(generate_password)

echo -e "${GREEN}✓ JWT_SECRET generated (64 chars)${NC}"
echo -e "${GREEN}✓ JWT_REFRESH_SECRET generated (64 chars)${NC}"
echo -e "${GREEN}✓ POSTGRES_PASSWORD generated (20 chars)${NC}"
echo ""

# Prompt for environment type
echo "Select environment type:"
echo "  1) Development (default)"
echo "  2) Production"
read -p "Enter choice [1-2] (default: 1): " ENV_CHOICE
ENV_CHOICE=${ENV_CHOICE:-1}

if [ "$ENV_CHOICE" = "2" ]; then
    NODE_ENV="production"
    echo -e "${YELLOW}⚠️  Production mode selected${NC}"
    
    # Prompt for production-specific settings
    read -p "Enter your domain (e.g., staycation.example.com): " APP_DOMAIN
    APP_URL="https://${APP_DOMAIN}"
    
    read -p "Enter email FROM address (e.g., noreply@${APP_DOMAIN}): " EMAIL_FROM
    
    echo ""
    echo "Email provider options:"
    echo "  1) AWS SES"
    echo "  2) SMTP"
    read -p "Select email provider [1-2] (default: 1): " EMAIL_CHOICE
    EMAIL_CHOICE=${EMAIL_CHOICE:-1}
    
    if [ "$EMAIL_CHOICE" = "1" ]; then
        EMAIL_PROVIDER="ses"
        read -p "AWS Region (default: eu-west-1): " AWS_REGION
        AWS_REGION=${AWS_REGION:-eu-west-1}
        read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
        read -sp "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
        echo ""
    else
        EMAIL_PROVIDER="smtp"
        read -p "SMTP Host: " SMTP_HOST
        read -p "SMTP Port (default: 587): " SMTP_PORT
        SMTP_PORT=${SMTP_PORT:-587}
        read -p "SMTP User: " SMTP_USER
        read -sp "SMTP Password: " SMTP_PASSWORD
        echo ""
        read -p "Use TLS? (y/N): " SMTP_SECURE_INPUT
        if [[ $SMTP_SECURE_INPUT =~ ^[Yy]$ ]]; then
            SMTP_SECURE="true"
        else
            SMTP_SECURE="false"
        fi
    fi
    
    CORS_ORIGIN="https://${APP_DOMAIN}"
else
    NODE_ENV="development"
    APP_URL="http://localhost"
    EMAIL_FROM="noreply@localhost"
    EMAIL_PROVIDER="ses"
    CORS_ORIGIN="http://localhost:3000"
fi

echo ""
echo "🔨 Creating .env file..."

# Create .env from template
cp .env.example .env

# Replace secrets using sed (macOS compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|NODE_ENV=.*|NODE_ENV=${NODE_ENV}|g" .env
    sed -i '' "s|APP_URL=.*|APP_URL=${APP_URL}|g" .env
    sed -i '' "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|g" .env
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env
    sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" .env
    sed -i '' "s|EMAIL_PROVIDER=.*|EMAIL_PROVIDER=${EMAIL_PROVIDER}|g" .env
    sed -i '' "s|EMAIL_FROM=.*|EMAIL_FROM=${EMAIL_FROM}|g" .env
    sed -i '' "s|CORS_ORIGIN=.*|CORS_ORIGIN=${CORS_ORIGIN}|g" .env
    
    if [ "$ENV_CHOICE" = "2" ]; then
        if [ "$EMAIL_CHOICE" = "1" ]; then
            sed -i '' "s|AWS_REGION=.*|AWS_REGION=${AWS_REGION}|g" .env
            sed -i '' "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}|g" .env
            sed -i '' "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}|g" .env
        else
            sed -i '' "s|SMTP_HOST=.*|SMTP_HOST=${SMTP_HOST}|g" .env
            sed -i '' "s|SMTP_PORT=.*|SMTP_PORT=${SMTP_PORT}|g" .env
            sed -i '' "s|SMTP_USER=.*|SMTP_USER=${SMTP_USER}|g" .env
            sed -i '' "s|SMTP_PASSWORD=.*|SMTP_PASSWORD=${SMTP_PASSWORD}|g" .env
            sed -i '' "s|SMTP_SECURE=.*|SMTP_SECURE=${SMTP_SECURE}|g" .env
        fi
    fi
else
    # Linux
    sed -i "s|NODE_ENV=.*|NODE_ENV=${NODE_ENV}|g" .env
    sed -i "s|APP_URL=.*|APP_URL=${APP_URL}|g" .env
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|g" .env
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" .env
    sed -i "s|EMAIL_PROVIDER=.*|EMAIL_PROVIDER=${EMAIL_PROVIDER}|g" .env
    sed -i "s|EMAIL_FROM=.*|EMAIL_FROM=${EMAIL_FROM}|g" .env
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=${CORS_ORIGIN}|g" .env
    
    if [ "$ENV_CHOICE" = "2" ]; then
        if [ "$EMAIL_CHOICE" = "1" ]; then
            sed -i "s|AWS_REGION=.*|AWS_REGION=${AWS_REGION}|g" .env
            sed -i "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}|g" .env
            sed -i "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}|g" .env
        else
            sed -i "s|SMTP_HOST=.*|SMTP_HOST=${SMTP_HOST}|g" .env
            sed -i "s|SMTP_PORT=.*|SMTP_PORT=${SMTP_PORT}|g" .env
            sed -i "s|SMTP_USER=.*|SMTP_USER=${SMTP_USER}|g" .env
            sed -i "s|SMTP_PASSWORD=.*|SMTP_PASSWORD=${SMTP_PASSWORD}|g" .env
            sed -i "s|SMTP_SECURE=.*|SMTP_SECURE=${SMTP_SECURE}|g" .env
        fi
    fi
fi

echo -e "${GREEN}✅ .env file created successfully!${NC}"
echo ""
echo "📋 Configuration Summary:"
echo "  Environment: ${NODE_ENV}"
echo "  App URL: ${APP_URL}"
echo "  Database Password: ${POSTGRES_PASSWORD}"
echo "  JWT Secret: ${JWT_SECRET:0:16}... (truncated)"
echo "  Email Provider: ${EMAIL_PROVIDER}"
echo "  Email From: ${EMAIL_FROM}"
echo ""

if [ "$NODE_ENV" = "development" ]; then
    echo -e "${GREEN}🚀 Ready to start in development mode!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review .env file if needed: nano .env"
    echo "  2. Start the application: ./start.sh"
else
    echo -e "${YELLOW}⚠️  Production Configuration${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review .env file: nano .env"
    echo "  2. Configure SSL certificates in nginx/ssl/"
    echo "  3. Update nginx.conf for your domain"
    echo "  4. Start the application: ./start-prod.sh"
fi

echo ""
echo -e "${YELLOW}🔒 Security Reminder:${NC}"
echo "  - Never commit .env to version control"
echo "  - Keep your secrets secure"
echo "  - Backup .env file in a secure location"
echo ""
