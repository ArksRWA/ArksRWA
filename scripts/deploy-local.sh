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

# Deploy backend canisters with admin parameter
echo "🏗️  Deploying backend canisters..."
DEPLOYER_PRINCIPAL="$(dfx identity get-principal)"
echo "Deployer principal: ${DEPLOYER_PRINCIPAL}"

# Deploy Core canister
echo "Deploying arks-core..."
dfx deploy --network local arks-core \
  --argument "(principal \"${DEPLOYER_PRINCIPAL}\")"

# Deploy Identity canister
echo "Deploying arks-identity..."
dfx deploy --network local arks-identity \
  --argument "(opt principal \"${DEPLOYER_PRINCIPAL}\")"

# Deploy Risk Engine canister
echo "Deploying arks-risk-engine..."
dfx deploy --network local arks-risk-engine \
  --argument "(principal \"${DEPLOYER_PRINCIPAL}\", null, null)"

# Deploy Token Factory canister
CORE_ID="$(dfx canister id arks-core)"
echo "arks-core canister id: ${CORE_ID}"
dfx deploy --network local arks-token-factory \
  --argument "(opt principal \"${DEPLOYER_PRINCIPAL}\", principal \"${CORE_ID}\")"

# Add risk engine to Core admins
RISK_ENGINE_ID="$(dfx canister id arks-risk-engine)"
echo "arks-risk-engine canister id: ${RISK_ENGINE_ID}"
echo "Adding risk engine to Core admins..."
dfx canister call --network local arks-core addAdmin "(principal \"${RISK_ENGINE_ID}\")"

# Register Core with risk engine
echo "Registering Core with risk engine..."
dfx canister call --network local arks-risk-engine registerCoreCanister "(principal \"${CORE_ID}\")"

echo "✅ Backend canisters deployed"

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
echo "   Core Candid UI: http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$(dfx canister id arks-core)"
echo "   Risk Engine Candid UI: http://localhost:4943/?canisterId=$(dfx canister id __Candid_UI)&id=$(dfx canister id arks-risk-engine)"