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
echo "🏗️  Deploying backend canister to IC..."
dfx deploy arks-rwa-backend --network ic --argument "(opt principal \"$ADMIN_PRINCIPAL\")"

echo "🌐 Deploying frontend to IC..."
dfx deploy frontend --network ic

echo "🎉 Production deployment completed!"
echo ""
echo "📍 Your application is now live on IC mainnet:"
echo "   Frontend: https://$(dfx canister id frontend --network ic).icp0.io"
echo "   Backend Canister ID: $(dfx canister id arks-rwa-backend --network ic)"
echo ""
echo "🔐 Admin principal configured: $ADMIN_PRINCIPAL"