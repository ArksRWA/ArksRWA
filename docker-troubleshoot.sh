#!/bin/bash

echo "🔍 Docker Troubleshooting for ARKS RWA Platform"
echo "================================================"

# Check Docker installation
echo "1️⃣ Checking Docker installation..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
    docker --version
else
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker daemon
echo ""
echo "2️⃣ Checking Docker daemon..."
if docker info &> /dev/null; then
    echo "✅ Docker daemon is running"
else
    echo "❌ Docker daemon is not running"
    echo "💡 Try: sudo systemctl start docker (Linux) or start Docker Desktop (Mac/Windows)"
    exit 1
fi

# Check Docker Compose
echo ""
echo "3️⃣ Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose is installed"
    docker-compose --version
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose (v2) is installed"
    docker compose version
else
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Check Docker Hub connectivity
echo ""
echo "4️⃣ Testing Docker Hub connectivity..."
if curl -s --connect-timeout 5 https://registry-1.docker.io/v2/ > /dev/null; then
    echo "✅ Docker Hub is accessible"
else
    echo "⚠️ Docker Hub connectivity issues"
    echo "💡 Check your internet connection or proxy settings"
fi

# Check for existing containers
echo ""
echo "5️⃣ Checking existing containers..."
existing_containers=$(docker ps -a --filter "name=arks-" --format "{{.Names}}" 2>/dev/null)
if [ -n "$existing_containers" ]; then
    echo "⚠️ Found existing ARKS containers:"
    echo "$existing_containers"
    echo "💡 Run: docker-compose down to clean up"
else
    echo "✅ No conflicting containers found"
fi

# Check Docker credentials
echo ""
echo "6️⃣ Checking Docker credentials..."
if [ -f ~/.docker/config.json ]; then
    echo "⚠️ Docker config found - checking for credential issues..."
    echo "💡 If you have credential issues, try: docker logout"
else
    echo "✅ No Docker credentials configured (this is usually fine)"
fi

# Test basic image pull
echo ""
echo "7️⃣ Testing basic image pull..."
echo "Trying to pull alpine:latest..."
if docker pull alpine:latest &> /dev/null; then
    echo "✅ Successfully pulled alpine:latest"
    docker rmi alpine:latest &> /dev/null
else
    echo "❌ Failed to pull alpine:latest"
    echo "💡 This indicates a Docker registry issue"
fi

echo ""
echo "🏁 Troubleshooting complete!"
echo ""
echo "🛠️ Common fixes:"
echo "   • Restart Docker: sudo systemctl restart docker"
echo "   • Clear Docker cache: docker system prune -a"
echo "   • Reset credentials: docker logout && docker login"
echo "   • Check proxy settings if behind corporate firewall"
echo "   • Try switching Docker registry mirror"
echo ""
echo "If issues persist, try the alternative startup method:"
echo "   docker-compose up --build --no-cache"