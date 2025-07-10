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
        if dfx start --background 2>/dev/null; then
            print_success "Local replica started"
        else
            # Check if it's already running
            if dfx ping local &> /dev/null; then
                print_success "Local replica is already running"
            else
                print_error "Failed to start local replica"
                exit 1
            fi
        fi
        
        # Show available URLs
        echo ""
        print_success "=== AVAILABLE URLS ==="
        
        # Check for deployed canisters and show URLs only for properly functional ones
        CANISTERS_FOUND=false
        
        # Check frontend canister (verify it has Wasm module and http_request method)
        if FRONTEND_ID=$(dfx canister id frontend 2>/dev/null) && dfx canister status frontend 2>/dev/null | grep -v "Module hash: None" | grep -q "Module hash:" && curl -s "http://$FRONTEND_ID.localhost:4943/" >/dev/null 2>&1; then
            echo "Frontend Canister:"
            echo "  • http://$FRONTEND_ID.localhost:4943/ (Recommended)"
            echo "  • http://127.0.0.1:4943/?canisterId=$FRONTEND_ID (Legacy)"
            CANISTERS_FOUND=true
        fi
        
        # Check backend canister (verify it supports Candid UI access)
        if BACKEND_ID=$(dfx canister id arks-rwa-backend 2>/dev/null) && dfx canister status arks-rwa-backend 2>/dev/null | grep -v "Module hash: None" | grep -q "Module hash:" && dfx canister call arks-rwa-backend __get_candid_interface_tmp_hack >/dev/null 2>&1; then
            echo "Backend Candid UI:"
            echo "  • http://127.0.0.1:4943/?canisterId=$BACKEND_ID"
            CANISTERS_FOUND=true
        fi
        
        # Check Internet Identity canister (verify it has Wasm module and http_request method)
        if II_ID=$(dfx canister id internet_identity 2>/dev/null) && dfx canister status internet_identity 2>/dev/null | grep -v "Module hash: None" | grep -q "Module hash:" && curl -s "http://$II_ID.localhost:4943/" >/dev/null 2>&1; then
            echo "Internet Identity:"
            echo "  • http://$II_ID.localhost:4943/"
            echo "  • http://127.0.0.1:4943/?canisterId=$II_ID"
            CANISTERS_FOUND=true
        fi
        
        # Check Next.js dev server
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
            echo "Next.js Dev Server:"
            echo "  • http://localhost:3000 (Running)"
            CANISTERS_FOUND=true
        elif curl -s http://localhost:3000 >/dev/null 2>&1; then
            echo "Next.js Dev Server:"
            echo "  • http://localhost:3000 (Running - may have errors)"
            CANISTERS_FOUND=true
        else
            echo "Next.js Dev Server:"
            echo "  • http://localhost:3000 (Start with: cd src/frontend && npm run dev)"
        fi
        
        # Check if there are created but not deployed canisters
        CREATED_BUT_NOT_DEPLOYED=false
        if dfx canister id frontend >/dev/null 2>&1 && ! dfx canister status frontend 2>/dev/null | grep -v "Module hash: None" | grep -q "Module hash:"; then
            CREATED_BUT_NOT_DEPLOYED=true
        fi
        if dfx canister id arks-rwa-backend >/dev/null 2>&1 && ! dfx canister status arks-rwa-backend 2>/dev/null | grep -v "Module hash: None" | grep -q "Module hash:"; then
            CREATED_BUT_NOT_DEPLOYED=true
        fi
        
        if [ "$CANISTERS_FOUND" = false ]; then
            echo ""
            if [ "$CREATED_BUT_NOT_DEPLOYED" = true ]; then
                print_warning "Some canisters are created but not fully deployed yet. Wait for deployment to complete or run './manage.sh deploy local'."
            else
                print_warning "No canisters deployed yet. Run './manage.sh deploy local' to deploy."
            fi
        elif [ "$CREATED_BUT_NOT_DEPLOYED" = true ]; then
            echo ""
            print_warning "Some canisters are still deploying. URLs will appear here once deployment completes."
        fi
        
        echo ""
        print_status "Tip: Run './manage.sh dev' to start the complete development environment"
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
        if dfx ping local &> /dev/null; then
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
        if ! dfx ping local &> /dev/null; then
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