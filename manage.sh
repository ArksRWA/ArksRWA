#!/bin/bash

# ARKS RWA Management Script
# Provides common operations for managing the ARKS RWA project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    echo "ARKS RWA Management Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  deploy <local|ic>     Deploy all canisters to specified network"
    echo "  start                 Start local DFX replica"
    echo "  stop                  Stop local DFX replica"
    echo "  clean                 Clean and restart local replica"
    echo "  status                Show deployment status"
    echo "  logs                  Show canister logs"
    echo "  update-env            Update frontend environment variables"
    echo "  dev                   Start development environment"
    echo "  build                 Build frontend for production"
    echo "  test                  Run tests"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy local       Deploy to local network"
    echo "  $0 deploy ic          Deploy to Internet Computer"
    echo "  $0 dev                Start development environment"
    echo "  $0 clean              Clean restart local replica"
    exit 1
}

# Check if command is provided
if [ $# -eq 0 ]; then
    show_usage
fi

COMMAND=$1
shift # Remove first argument

case $COMMAND in
    "deploy")
        if [ $# -eq 0 ]; then
            print_error "Network argument required for deploy command"
            echo "Usage: $0 deploy <local|ic>"
            exit 1
        fi
        NETWORK=$1
        print_status "Deploying to $NETWORK network..."
        ./deploy.sh $NETWORK
        ;;
        
    "start")
        print_status "Starting local DFX replica..."
        dfx start --background
        print_success "Local replica started"
        ;;
        
    "stop")
        print_status "Stopping local DFX replica..."
        dfx stop
        print_success "Local replica stopped"
        ;;
        
    "clean")
        print_status "Cleaning and restarting local replica..."
        dfx stop 2>/dev/null || true
        dfx start --background --clean
        print_success "Local replica cleaned and restarted"
        ;;
        
    "status")
        print_status "Checking deployment status..."
        echo ""
        
        # Check if replica is running
        if dfx ping --network local &> /dev/null; then
            print_success "Local replica is running"
        else
            print_warning "Local replica is not running"
        fi
        
        # Show canister status if .env exists
        if [ -f ".env" ]; then
            echo ""
            echo "Deployed Canisters:"
            if grep -q "CANISTER_ID_ARKS_RWA_BACKEND" .env; then
                BACKEND_ID=$(grep "CANISTER_ID_ARKS_RWA_BACKEND" .env | cut -d'=' -f2 | tr -d "'")
                echo "  Backend: $BACKEND_ID"
            fi
            
            if grep -q "CANISTER_ID_FRONTEND" .env; then
                FRONTEND_ID=$(grep "CANISTER_ID_FRONTEND" .env | cut -d'=' -f2 | tr -d "'")
                echo "  Frontend: $FRONTEND_ID"
            fi
            
            if grep -q "CANISTER_ID_INTERNET_IDENTITY" .env; then
                II_ID=$(grep "CANISTER_ID_INTERNET_IDENTITY" .env | cut -d'=' -f2 | tr -d "'")
                echo "  Internet Identity: $II_ID"
            fi
        else
            print_warning "No deployment found (.env file missing)"
        fi
        ;;
        
    "logs")
        print_status "Showing canister logs..."
        if [ -f ".env" ] && grep -q "CANISTER_ID_ARKS_RWA_BACKEND" .env; then
            BACKEND_ID=$(grep "CANISTER_ID_ARKS_RWA_BACKEND" .env | cut -d'=' -f2 | tr -d "'")
            dfx canister logs $BACKEND_ID
        else
            print_error "Backend canister not found. Deploy first."
        fi
        ;;
        
    "update-env")
        print_status "Updating frontend environment variables..."
        if [ -f "./update-env.sh" ]; then
            ./update-env.sh
        else
            print_error "update-env.sh not found"
            exit 1
        fi
        ;;
        
    "dev")
        print_status "Starting development environment..."
        
        # Check if replica is running
        if ! dfx ping --network local &> /dev/null; then
            print_status "Starting local replica..."
            dfx start --background
            sleep 3
        fi
        
        # Deploy if not already deployed
        if [ ! -f ".env" ]; then
            print_status "No deployment found, deploying locally..."
            ./deploy.sh local
        fi
        
        # Start frontend dev server
        print_status "Starting Next.js development server..."
        cd src/frontend
        npm run dev
        ;;
        
    "build")
        print_status "Building frontend for production..."
        cd src/frontend
        npm run build
        print_success "Frontend built successfully"
        ;;
        
    "test")
        print_status "Running tests..."
        # Add test commands here when tests are implemented
        print_warning "Tests not implemented yet"
        ;;
        
    "help")
        show_usage
        ;;
        
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        ;;
esac