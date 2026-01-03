#!/bin/bash

# Production deployment script
# Usage: ./start-prod.sh

set -e

echo "🚀 Starting UK Staycation Watcher in PRODUCTION mode..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Copy .env.example and configure for production."
    exit 1
fi

# Validate production environment
if grep -q "change_me" .env; then
    echo "❌ Production secrets not configured! Update JWT_SECRET and POSTGRES_PASSWORD."
    exit 1
fi

if ! grep -q "NODE_ENV=production" .env; then
    echo "⚠️  Warning: NODE_ENV is not set to 'production' in .env"
fi

# Build production images
echo "🔨 Building production images..."
export BUILD_TARGET=production
docker-compose build

# Start all services including nginx
echo "🐳 Starting Docker containers (prod profile with nginx)..."
docker-compose --profile prod up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

# Run database migrations
echo "📊 Running database migrations..."
docker-compose exec -T api npm run migration:run

# Run seeds (optional in production)
read -p "Run database seeds? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose exec -T api npm run seed
fi

echo "✅ Production deployment complete!"
echo ""
echo "📍 Access points:"
echo "   Application: http://localhost (via nginx)"
echo "   API (internal): http://localhost:4000"
echo ""
echo "📖 Next steps:"
echo "   1. Configure SSL certificates in nginx/ssl/"
echo "   2. Update nginx.conf to enable HTTPS"
echo "   3. Set up monitoring and backups"
echo "   4. Review logs: docker-compose logs -f"
echo ""
echo "🛑 To stop: docker-compose --profile prod down"
