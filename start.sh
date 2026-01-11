#!/bin/bash

# Development mode (default)
# Usage: ./start.sh [--rebuild]
#   --rebuild: Force rebuild of Docker containers (use after code changes)

set -e

# Parse arguments
REBUILD_FLAG=""
if [[ "$1" == "--rebuild" ]]; then
    REBUILD_FLAG="--build"
    echo "🔨 Rebuild mode enabled - containers will be rebuilt"
fi

echo "🚀 Starting UK Staycation Watcher in DEVELOPMENT mode..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 No .env file found!"
    echo ""
    echo "You can either:"
    echo "  1. Run the automated setup: ./setup-env.sh"
    echo "  2. Manually copy and edit: cp .env.example .env"
    echo ""
    read -p "Run automated setup now? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        ./setup-env.sh
    else
        echo "Please create .env file manually before continuing."
        exit 1
    fi
fi

# Check if JWT_SECRET is set
if grep -q "change_me" .env; then
    echo "⚠️  Insecure secrets detected in .env file!"
    echo ""
    echo "You can either:"
    echo "  1. Run the automated setup: ./setup-env.sh"
    echo "  2. Manually generate secrets with: openssl rand -hex 32"
    echo ""
    read -p "Run automated setup now? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        ./setup-env.sh
    else
        echo "Please update .env file with secure secrets before continuing."
        exit 1
    fi
fi

# Start Docker containers in dev mode (no nginx)
echo "🐳 Starting Docker containers (dev profile)..."
docker-compose --profile dev up -d $REBUILD_FLAG

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Run database seeds
echo "🌱 Seeding database..."
docker-compose exec -T api npm run seed

echo "✅ Setup complete!"
echo ""
echo "📍 Access points:"
echo "   Web UI: http://localhost:3000"
echo "   API: http://localhost:4000"
echo "   Health: http://localhost:4000/health"
echo ""
echo "📖 Next steps:"
echo "   1. Visit http://localhost:3000 to create an account"
echo "   2. Check logs: docker-compose logs -f"
echo "   3. Read TESTING.md for manual testing checklist"
echo ""
echo "🛑 To stop: docker-compose --profile dev down"
