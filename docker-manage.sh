#!/bin/bash

# Docker management script for ARKS RWA Platform

show_help() {
    echo "🐳 ARKS RWA Platform Docker Management"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       - Start all services in detached mode"
    echo "  start-clean - Start with clean build (no cache)"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  status      - Show status of all services"
    echo "  logs        - Show logs from all services"
    echo "  logs-f      - Follow logs from all services"
    echo "  logs-fe     - Show frontend logs"
    echo "  logs-be     - Show backend logs"
    echo "  logs-dfx    - Show DFX replica logs"
    echo "  build       - Rebuild all images"
    echo "  clean       - Stop and remove all containers, volumes, and images"
    echo "  shell-fe    - Open shell in frontend container"
    echo "  shell-be    - Open shell in backend container"
    echo "  troubleshoot- Run Docker troubleshooting"
    echo "  help        - Show this help message"
    echo ""
}

case "$1" in
    "start")
        echo "🚀 Starting ARKS RWA Platform in detached mode..."
        if ! ./docker-run.sh; then
            echo ""
            echo "❌ Failed to start with docker-run.sh"
            echo "🔄 Trying alternative method..."
            echo ""
            docker-compose down 2>/dev/null || true
            docker-compose up --build -d
        fi
        ;;
    "start-clean")
        echo "🚀 Starting with clean build (no cache)..."
        docker-compose down 2>/dev/null || true
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    "troubleshoot")
        echo "🔍 Running troubleshooting..."
        if [ -f "./docker-troubleshoot.sh" ]; then
            chmod +x docker-troubleshoot.sh
            ./docker-troubleshoot.sh
        else
            echo "❌ docker-troubleshoot.sh not found"
        fi
        ;;
    "stop")
        echo "🛑 Stopping all services..."
        docker-compose down
        echo "✅ All services stopped"
        ;;
    "restart")
        echo "🔄 Restarting all services..."
        docker-compose restart
        echo "✅ All services restarted"
        ;;
    "status")
        echo "📊 Service Status:"
        docker-compose ps
        ;;
    "logs")
        echo "📋 All service logs:"
        docker-compose logs
        ;;
    "logs-f")
        echo "📋 Following all service logs (Ctrl+C to exit):"
        docker-compose logs -f
        ;;
    "logs-fe")
        echo "🌐 Frontend logs:"
        docker-compose logs nextjs-frontend
        ;;
    "logs-be")
        echo "🔧 Backend logs:"
        docker-compose logs motoko-backend
        ;;
    "logs-dfx")
        echo "⚙️ DFX Replica logs:"
        docker-compose logs dfx-replica
        ;;
    "build")
        echo "📦 Rebuilding all images..."
        docker-compose build --no-cache
        echo "✅ All images rebuilt"
        ;;
    "clean")
        echo "🧹 Cleaning up everything..."
        read -p "This will remove all containers, volumes, and images. Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v --rmi all
            docker system prune -f
            echo "✅ Everything cleaned up"
        else
            echo "❌ Cleanup cancelled"
        fi
        ;;
    "shell-fe")
        echo "🐚 Opening shell in frontend container..."
        docker-compose exec nextjs-frontend sh
        ;;
    "shell-be")
        echo "🐚 Opening shell in backend container..."
        docker-compose exec motoko-backend bash
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac