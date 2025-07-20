#!/bin/bash

echo "🔧 Quick Fix for Docker Issues"
echo "=============================="

echo "1️⃣ Cleaning up existing containers..."
docker-compose down 2>/dev/null || true

echo "2️⃣ Clearing Docker cache..."
docker system prune -f 2>/dev/null || true

echo "3️⃣ Testing Docker connectivity..."
if ! docker pull hello-world &>/dev/null; then
    echo "❌ Docker registry connectivity issue detected"
    echo "🔄 Trying to reset Docker credentials..."
    docker logout 2>/dev/null || true
    
    echo "🔄 Trying alternative approach with simple compose file..."
    if [ -f "docker-compose.simple.yml" ]; then
        echo "Using simplified Docker Compose..."
        docker-compose -f docker-compose.simple.yml up --build -d
    else
        echo "❌ Simple compose file not found"
        exit 1
    fi
else
    echo "✅ Docker connectivity OK"
    docker rmi hello-world 2>/dev/null || true
    
    echo "4️⃣ Starting with original compose..."
    docker-compose up --build -d
fi

echo ""
echo "✅ Quick fix complete!"
echo "Check status with: docker-compose ps"