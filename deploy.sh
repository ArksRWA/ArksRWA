#!/bin/bash

# ARKS RWA Deployment Script
# Usage: ./deploy.sh [local|ic]
# This script deploys all canisters and sets up the environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to show usage
show_usage() {
    echo "Usage: $0 [local|ic]"
    echo ""
    echo "Arguments:"
    echo "  local    Deploy to local DFX network"
    echo "  ic       Deploy to Internet Computer mainnet"
    echo ""
    echo "Examples:"
    echo "  $0 local     # Deploy locally for development"
    echo "  $0 ic        # Deploy to production"
    exit 1
}

# Check if network argument is provided
if [ $# -eq 0 ]; then
    print_error "Network argument is required"
    show_usage
fi

NETWORK=$1

# Validate network argument
if [ "$NETWORK" != "local" ] && [ "$NETWORK" != "ic" ]; then
    print_error "Invalid network: $NETWORK"
    show_usage
fi

print_status "Starting ARKS RWA deployment to $NETWORK network..."

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
    print_error "dfx is not installed. Please install DFX first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "dfx.json" ]; then
    print_error "dfx.json not found. Please run this script from the project root."
    exit 1
fi

# Start local replica if deploying locally
if [ "$NETWORK" = "local" ]; then
    print_status "Checking local DFX replica..."
    
    # Check if replica is already running
    if ! dfx ping --network local &> /dev/null; then
        print_status "Starting local DFX replica..."
        dfx start --background --clean
        
        # Wait for replica to be ready
        print_status "Waiting for replica to be ready..."
        sleep 5
        
        # Verify replica is running
        if ! dfx ping --network local &> /dev/null; then
            print_error "Failed to start local replica"
            exit 1
        fi
        print_success "Local replica is running"
    else
        print_success "Local replica is already running"
    fi
fi

# Build frontend if deploying locally
if [ "$NETWORK" = "local" ]; then
    print_status "Building frontend..."
    cd src/frontend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Build the frontend
    print_status "Building Next.js application..."
    npm run build
    cd ../..
    print_success "Frontend built successfully"
fi

# Deploy canisters in the correct order
print_status "Deploying canisters to $NETWORK network..."

# Step 1: Deploy Internet Identity (if local)
if [ "$NETWORK" = "local" ]; then
    print_status "Deploying Internet Identity canister..."
    if dfx deploy internet_identity --network $NETWORK; then
        print_success "Internet Identity deployed"
    else
        print_error "Failed to deploy Internet Identity"
        exit 1
    fi
else
    print_warning "Skipping Internet Identity deployment for IC network (using official canister)"
fi

# Step 2: Deploy Backend
print_status "Deploying backend canister..."
if dfx deploy arks-rwa-backend --network $NETWORK; then
    print_success "Backend canister deployed"
else
    print_error "Failed to deploy backend canister"
    exit 1
fi

# Step 3: Deploy Frontend (depends on backend)
print_status "Deploying frontend canister..."
if dfx deploy frontend --network $NETWORK; then
    print_success "Frontend canister deployed"
else
    print_error "Failed to deploy frontend canister"
    exit 1
fi

# Generate declarations
print_status "Generating canister declarations..."
if dfx generate --network $NETWORK; then
    print_success "Declarations generated"
else
    print_warning "Failed to generate declarations (continuing anyway)"
fi

# Update environment variables for frontend
if [ "$NETWORK" = "local" ]; then
    print_status "Updating frontend environment variables..."
    if [ -f "./update-env.sh" ]; then
        chmod +x ./update-env.sh
        if ./update-env.sh; then
            print_success "Frontend environment variables updated"
        else
            print_warning "Failed to update frontend environment variables"
        fi
    else
        print_warning "update-env.sh not found, skipping environment variable update"
    fi
fi

# Display deployment information
print_status "Deployment completed successfully!"
echo ""
print_success "=== DEPLOYMENT SUMMARY ==="
echo "Network: $NETWORK"
echo ""

# Get canister IDs
if [ -f ".env" ]; then
    echo "Canister IDs:"
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
fi

echo ""
print_success "=== ACCESS URLS ==="

if [ "$NETWORK" = "local" ]; then
    if [ -n "$FRONTEND_ID" ]; then
        echo "Frontend (Recommended): http://$FRONTEND_ID.localhost:4943/"
        echo "Frontend (Legacy): http://127.0.0.1:4943/?canisterId=$FRONTEND_ID"
    fi
    
    if [ -n "$BACKEND_ID" ]; then
        echo "Backend Candid UI: http://127.0.0.1:4943/?canisterId=$BACKEND_ID"
    fi
    
    echo "Next.js Dev Server: http://localhost:3000"
else
    if [ -n "$FRONTEND_ID" ]; then
        echo "Frontend: https://$FRONTEND_ID.icp0.io/"
        echo "Frontend (Raw): https://$FRONTEND_ID.raw.icp0.io/"
    fi
    
    if [ -n "$BACKEND_ID" ]; then
        echo "Backend: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=$BACKEND_ID"
    fi
fi

echo ""
print_success "=== NEXT STEPS ==="
if [ "$NETWORK" = "local" ]; then
    echo "1. Start the Next.js development server:"
    echo "   cd src/frontend && npm run dev"
    echo ""
    echo "2. Open http://localhost:3000 in your browser"
    echo ""
    echo "3. To redeploy after changes:"
    echo "   ./deploy.sh local"
else
    echo "1. Your application is now live on the Internet Computer!"
    echo "2. Update your DNS records if using a custom domain"
    echo "3. Monitor your canister cycles and top up as needed"
fi

echo ""
print_success "Deployment completed successfully! 🚀"