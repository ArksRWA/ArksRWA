#!/bin/bash

# Local deployment script for ARKS RWA Multi-Canister Architecture
# This script deploys the application to local DFX network with proper inter-canister communication

set -e

echo "🚀 Starting ARKS RWA local deployment with multi-canister architecture..."

# Load local environment variables if they exist
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
    echo "✅ Loaded local environment variables"
else
    echo "ℹ️  .env.local file not found, using defaults"
fi

# Set default admin principal if not provided
if [ -z "$ADMIN_PRINCIPAL" ]; then
    ADMIN_PRINCIPAL=$(dfx identity get-principal)
    echo "ℹ️  Using current identity as admin: $ADMIN_PRINCIPAL"
fi

# Start DFX if not already running
if ! dfx ping > /dev/null 2>&1; then
    echo "📡 Starting DFX network..."
    dfx start --background --clean
    sleep 3  # Wait for network to stabilize
else
    echo "✅ DFX network is already running"
fi

echo ""
echo "🏗️  Deploying canisters in dependency order..."
echo "=================================================="

# Phase 1: Deploy Core Canister (foundation) - admin principal is required
echo ""
echo "📦 Phase 1: Deploying Core Canister..."
dfx deploy arks-core --argument "(principal \"$ADMIN_PRINCIPAL\", null)"
CORE_CANISTER_ID=$(dfx canister id arks-core)
echo "✅ Core canister deployed: $CORE_CANISTER_ID"

# Phase 2: Deploy Risk Engine with Core reference - admin principal is required
echo ""
echo "🧠 Phase 2: Deploying Risk Engine Canister..."
dfx deploy arks-risk-engine --argument "(principal \"$ADMIN_PRINCIPAL\", null, null, opt \"$CORE_CANISTER_ID\")"
RISK_ENGINE_ID=$(dfx canister id arks-risk-engine)
echo "✅ Risk engine deployed: $RISK_ENGINE_ID"

# Phase 3: Update Core canister with Risk Engine reference - admin principal is required
echo ""
echo "🔄 Phase 3: Updating Core canister with Risk Engine reference..."
dfx deploy arks-core --argument "(principal \"$ADMIN_PRINCIPAL\", opt \"$RISK_ENGINE_ID\")" --mode upgrade
echo "✅ Core canister updated with risk engine reference"

# Phase 4: Deploy Token Factory with Core reference
echo ""
echo "🏭 Phase 4: Deploying Token Factory..."
dfx deploy arks-token-factory --argument "(opt principal \"$ADMIN_PRINCIPAL\", principal \"$CORE_CANISTER_ID\")"
TOKEN_FACTORY_ID=$(dfx canister id arks-token-factory)
echo "✅ Token factory deployed: $TOKEN_FACTORY_ID"

# Phase 5: Deploy Identity Canister
echo ""
echo "🔐 Phase 5: Deploying Identity Canister..."
dfx deploy arks-identity --argument "(opt principal \"$ADMIN_PRINCIPAL\")"
IDENTITY_ID=$(dfx canister id arks-identity)
echo "✅ Identity canister deployed: $IDENTITY_ID"

# Phase 6: Deploy Internet Identity (if not already deployed)
echo ""
echo "🌐 Phase 6: Deploying Internet Identity..."
if dfx canister id internet_identity > /dev/null 2>&1; then
    echo "✅ Internet Identity already deployed"
else
    dfx deploy internet_identity
    echo "✅ Internet Identity deployed"
fi

# Phase 7: Generate TypeScript declarations
echo ""
echo "📝 Phase 7: Generating TypeScript declarations..."
dfx generate
echo "✅ TypeScript declarations generated"

# Phase 8: Build and Deploy Frontend (if build directory exists)
echo ""
echo "🎨 Phase 8: Building and Deploying Frontend..."
if [ -d "src/frontend" ]; then
    cd src/frontend
    
    if [ -f "package.json" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
        
        echo "🏗️  Building frontend..."
        npm run build
        
        cd ../..
        
        echo "🌐 Deploying frontend..."
        dfx deploy frontend
        FRONTEND_ID=$(dfx canister id frontend)
        echo "✅ Frontend deployed: $FRONTEND_ID"
    else
        echo "⚠️  Frontend package.json not found, skipping frontend build"
        cd ../..
    fi
else
    echo "⚠️  Frontend directory not found, skipping frontend deployment"
fi

# Deployment Summary
echo ""
echo "🎉 ARKS RWA Local Deployment Completed Successfully!"
echo "=================================================="
echo "📍 Canister IDs and Access URLs:"
echo ""
echo "🏢 Core Canister:        $CORE_CANISTER_ID"
echo "   Candid UI:            http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$CORE_CANISTER_ID"
echo ""
echo "🧠 Risk Engine:          $RISK_ENGINE_ID"
echo "   Candid UI:            http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$RISK_ENGINE_ID"
echo ""
echo "🏭 Token Factory:        $TOKEN_FACTORY_ID"
echo "   Candid UI:            http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$TOKEN_FACTORY_ID"
echo ""
echo "🔐 Identity:             $IDENTITY_ID"
echo "   Candid UI:            http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$IDENTITY_ID"
echo ""

if [ -d "src/frontend" ] && dfx canister id frontend > /dev/null 2>&1; then
    FRONTEND_ID=$(dfx canister id frontend)
    echo "🌐 Frontend:             $FRONTEND_ID"
    echo "   Application:          http://localhost:4943/?canisterId=$FRONTEND_ID"
    echo ""
fi

echo "👤 Admin Principal:      $ADMIN_PRINCIPAL"
echo ""
echo "🔗 Inter-canister communication configured:"
echo "   Core ↔ Risk Engine:   ✅ Connected"
echo "   Token Factory → Core: ✅ Connected"
echo ""
echo "📚 Next steps:"
echo "   1. Test company creation: dfx canister call arks-core createCompany"
echo "   2. Test verification: dfx canister call arks-risk-engine startVerificationWithApiKey"
echo "   3. Access frontend application at the URL above"
echo ""
echo "For AI services integration, make sure to:"
echo "   1. Set SERPAPI_API_KEY and GEMINI_API_KEY environment variables"
echo "   2. Start AI services: cd src/AI && npm start"
echo ""