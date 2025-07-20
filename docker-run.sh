#!/bin/bash

set -e

echo "🚀 Starting ARKS RWA Platform with Docker..."

# Function to cleanup on error (not on normal exit)
cleanup_on_error() {
    echo "❌ Error occurred, cleaning up..."
    docker-compose down
}

# Only trap cleanup on error, not normal exit
trap cleanup_on_error ERR

# Build and start services
echo "📦 Building Docker images..."
docker-compose build

echo "🏃 Starting services..."
docker-compose up -d dfx-replica

echo "⏳ Waiting for DFX replica to be ready..."
timeout=60
counter=0
while ! curl -s http://localhost:4943 > /dev/null; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo "❌ Timeout waiting for DFX replica"
        exit 1
    fi
    echo "   ... waiting ($counter/${timeout}s)"
done

echo "✅ DFX replica is ready!"

echo "🔧 Deploying Motoko backend..."
docker-compose up -d motoko-backend

echo "⏳ Waiting for backend deployment..."
sleep 10

echo "🌐 Starting Next.js frontend..."
docker-compose up -d nextjs-frontend

echo "🎉 Platform is running in detached mode!"
echo "   Frontend: http://localhost:3000"
echo "   DFX Replica: http://localhost:4943"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose logs -f [service-name]"
echo "   Stop all: docker-compose down"
echo "   Restart: docker-compose restart [service-name]"
echo ""
echo "✅ All services are running in the background!"

# Remove cleanup trap since we want detached mode
trap - EXIT