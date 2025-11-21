#!/bin/bash
# Development Redis Setup
# Optional Redis container for local development

set -e

echo "🔧 KeyFlash Development Redis Setup"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Skipping Redis setup."
    echo "✅ Tests will use mock Redis (this is fine for development)"
    exit 0
fi

# Check if Redis container already running
if docker ps | grep -q keyflash-redis; then
    echo "✅ Redis container already running"
    echo "📍 Redis available at: redis://localhost:6379"
    exit 0
fi

# Check if container exists but stopped
if docker ps -a | grep -q keyflash-redis; then
    echo "🚀 Starting existing Redis container..."
    docker start keyflash-redis
else
    echo "📦 Creating new Redis container..."
    docker run -d \
        --name keyflash-redis \
        -p 6379:6379 \
        redis:alpine \
        redis-server --appendonly yes
fi

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 2

# Test Redis connection
if docker exec keyflash-redis redis-cli ping | grep -q PONG; then
    echo "✅ Redis is ready!"
    echo "📍 Redis available at: redis://localhost:6379"
    echo ""
    echo "🔧 To stop Redis: docker stop keyflash-redis"
    echo "🗑️  To remove Redis: docker rm keyflash-redis"
else
    echo "❌ Redis failed to start properly"
    exit 1
fi