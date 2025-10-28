#!/bin/bash

# Local deployment script for ARKS RWA
# This script deploys the application to local DFX network

set -e

echo "🚀 Starting local deployment..."

# Load local environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
    echo "✅ Loaded local environment variables"
else
    echo "⚠️  .env.local file not found, using defaults"
fi

# Start DFX if not already running
if ! dfx ping > /dev/null 2>&1; then
    echo "📡 Starting DFX..."
    dfx start --background --clean
else
    echo "✅ DFX is already running"
fi

# Deploy Internet Identity
echo "🔐 Deploying Internet Identity..."
dfx deploy internet_identity

# Deploy backend with admin parameter
echo "🏗️  Deploying backend canister..."
if [ -n "$ADMIN_PRINCIPAL" ]; then
    dfx deploy arks-rwa-backend --argument "(opt principal \"$ADMIN_PRINCIPAL\")"
    echo "✅ Backend deployed with admin principal: $ADMIN_PRINCIPAL"
else
    dfx deploy arks-rwa-backend --argument "(null)"
    echo "✅ Backend deployed with default admin principal"
fi

# Build and deploy frontend
echo "🎨 Building frontend..."
cd src/frontend
npm run build
cd ../..

echo "🌐 Deploying frontend..."
dfx deploy frontend

echo "🎉 Local deployment completed!"
echo ""
echo "📍 Access your application at:"
echo "   Frontend: http://localhost:4943/?canisterId=$(dfx canister id frontend)"
echo "   Backend Candid UI: http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$(dfx canister id arks-rwa-backend)"