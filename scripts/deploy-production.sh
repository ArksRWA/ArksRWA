#!/bin/bash

# Production deployment script for ARKS RWA
# This script deploys the application to Internet Computer mainnet

set -e

echo "🚀 Starting production deployment to IC mainnet..."

# Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
    echo "✅ Loaded production environment variables"
else
    echo "❌ .env.production file not found!"
    echo "Please create .env.production with your production admin principal"
    exit 1
fi

# Validate admin principal is set
if [ -z "$ADMIN_PRINCIPAL" ] || [ "$ADMIN_PRINCIPAL" = "YOUR_PRODUCTION_ADMIN_PRINCIPAL_HERE" ]; then
    echo "❌ Production admin principal not configured!"
    echo "Please set ADMIN_PRINCIPAL in .env.production to your actual production principal"
    exit 1
fi

# Confirm deployment
echo "⚠️  You are about to deploy to IC mainnet with:"
echo "   Admin Principal: $ADMIN_PRINCIPAL"
echo "   Network: ic"
echo ""
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Build frontend
echo "🎨 Building frontend for production..."
cd src/frontend
npm run build
cd ../..

# Deploy to IC mainnet
echo "🏗️  Deploying backend canisters to IC..."
DEPLOYER_PRINCIPAL="$(dfx identity get-principal)"
echo "Deployer principal: ${DEPLOYER_PRINCIPAL}"

# Deploy Core canister
echo "Deploying arks-core..."
dfx deploy --network ic arks-core \
  --argument "(principal \"${DEPLOYER_PRINCIPAL}\")"

# Deploy Identity canister
echo "Deploying arks-identity..."
dfx deploy --network ic arks-identity \
  --argument "(opt principal \"${DEPLOYER_PRINCIPAL}\")"

# Deploy Risk Engine canister
echo "Deploying arks-risk-engine..."
dfx deploy --network ic arks-risk-engine \
  --argument "(principal \"${DEPLOYER_PRINCIPAL}\", null, null)"

# Deploy Token Factory canister
CORE_ID="$(dfx canister id arks-core)"
echo "arks-core canister id: ${CORE_ID}"
dfx deploy --network ic arks-token-factory \
  --argument "(opt principal \"${DEPLOYER_PRINCIPAL}\", principal \"${CORE_ID}\")"

# Add risk engine to Core admins
RISK_ENGINE_ID="$(dfx canister id arks-risk-engine)"
echo "arks-risk-engine canister id: ${RISK_ENGINE_ID}"
echo "Adding risk engine to Core admins..."
dfx canister call --network ic arks-core addAdmin "(principal \"${RISK_ENGINE_ID}\")"

# Register Core with risk engine
echo "Registering Core with risk engine..."
dfx canister call --network ic arks-risk-engine registerCoreCanister "(principal \"${CORE_ID}\")"

echo "🌐 Deploying frontend to IC..."
dfx deploy frontend --network ic

echo "🎉 Production deployment completed!"
echo ""
echo "📍 Your application is now live on IC mainnet:"
echo "   Frontend: https://$(dfx canister id frontend --network ic).icp0.io"
echo "   Core Canister ID: $(dfx canister id arks-core --network ic)"
echo ""
echo "🔐 Admin principal configured: $ADMIN_PRINCIPAL"