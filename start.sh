#!/bin/bash

# Quick start script for UK Staycation Watcher

set -e

echo "🚀 Starting UK Staycation Watcher..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and set JWT_SECRET before continuing!"
    echo "   You can generate a secret with: openssl rand -hex 32"
    exit 1
fi

# Check if JWT_SECRET is set
if grep -q "change_me" .env; then
    echo "⚠️  Please set a strong JWT_SECRET in .env before continuing!"
    echo "   You can generate one with: openssl rand -hex 32"
    exit 1
fi

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose up -d

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
echo "   Web UI: http://localhost"
echo "   API: http://localhost:4000"
echo "   Health: http://localhost:4000/health"
echo ""
echo "📖 Next steps:"
echo "   1. Visit http://localhost to create an account"
echo "   2. Check logs: docker-compose logs -f"
echo "   3. Read TESTING.md for manual testing checklist"
echo ""
echo "🛑 To stop: docker-compose down"
