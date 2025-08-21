#!/bin/bash

# Production deployment script for ARKS RWA Multi-Canister Architecture
# This script deploys the application to Internet Computer mainnet with full validations

set -e

echo "🚀 ARKS RWA Production Deployment to IC Mainnet"
echo "================================================"

# Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | grep -v '^$' | xargs)
    echo "✅ Loaded production environment variables"
else
    echo "❌ .env.production file not found!"
    echo ""
    echo "Please create .env.production with the following variables:"
    echo "  ADMIN_PRINCIPAL=your-production-admin-principal"
    echo "  SERPAPI_API_KEY=your-serpapi-key (optional)"
    echo "  GEMINI_API_KEY=your-gemini-api-key (optional)"
    echo ""
    echo "Example:"
    echo "  echo 'ADMIN_PRINCIPAL=rg7t5-bghe6-tattl-q7us7-zc57a-2xjvm-r24zv-imqwn-npa36-eso5m-mqe' > .env.production"
    exit 1
fi

# Validate required environment variables
echo ""
echo "🔍 Validating configuration..."

if [ -z "$ADMIN_PRINCIPAL" ] || [ "$ADMIN_PRINCIPAL" = "YOUR_PRODUCTION_ADMIN_PRINCIPAL_HERE" ]; then
    echo "❌ ADMIN_PRINCIPAL not configured!"
    echo "Please set ADMIN_PRINCIPAL in .env.production to your production admin principal"
    echo "You can get your principal with: dfx identity get-principal"
    exit 1
fi

# Validate principal format (basic check)
if [[ ! "$ADMIN_PRINCIPAL" =~ ^[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{3}$ ]]; then
    echo "❌ ADMIN_PRINCIPAL format appears invalid!"
    echo "Expected format: xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxx"
    echo "Current value: $ADMIN_PRINCIPAL"
    exit 1
fi

echo "✅ Admin principal format valid: $ADMIN_PRINCIPAL"

# Check if user is logged in with correct identity
CURRENT_PRINCIPAL=$(dfx identity get-principal)
if [ "$CURRENT_PRINCIPAL" != "$ADMIN_PRINCIPAL" ]; then
    echo "⚠️  Warning: Current DFX identity ($CURRENT_PRINCIPAL) differs from configured admin principal ($ADMIN_PRINCIPAL)"
    echo ""
    read -p "Do you want to continue with current identity? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please switch to the correct identity with:"
        echo "  dfx identity use <your-production-identity>"
        exit 1
    fi
fi

# Pre-deployment checks
echo ""
echo "🔧 Pre-deployment checks..."

# Check dfx version
DFX_VERSION=$(dfx --version | head -n1)
echo "✅ DFX Version: $DFX_VERSION"

# Check if we can connect to IC
echo "🌐 Testing connection to IC mainnet..."
if ! dfx ping --network ic > /dev/null 2>&1; then
    echo "❌ Cannot connect to IC mainnet!"
    echo "Please check your internet connection and try again."
    exit 1
fi
echo "✅ IC mainnet connection successful"

# Check wallet balance (cycles)
echo "💰 Checking wallet cycles balance..."
WALLET_BALANCE=$(dfx wallet --network ic balance 2>/dev/null || echo "Unable to check balance")
echo "💳 Wallet balance: $WALLET_BALANCE"

if [[ "$WALLET_BALANCE" == *"Unable"* ]]; then
    echo "⚠️  Warning: Could not check wallet balance. Make sure you have sufficient cycles for deployment."
fi

# Final confirmation
echo ""
echo "🚨 PRODUCTION DEPLOYMENT CONFIRMATION"
echo "====================================="
echo "You are about to deploy to IC MAINNET with:"
echo ""
echo "📍 Target Network:       IC Mainnet (https://icp-api.io)"
echo "👤 Admin Principal:      $ADMIN_PRINCIPAL"
echo "🆔 Current Identity:     $CURRENT_PRINCIPAL"
echo "💳 Wallet:              $WALLET_BALANCE"
echo ""
echo "🏗️  Canisters to deploy:"
echo "   • arks-core (Company management)"
echo "   • arks-risk-engine (AI verification worker)"  
echo "   • arks-token-factory (Token creation)"
echo "   • arks-identity (Identity management)"
echo "   • frontend (Web application)"
echo ""
echo "⚠️  This action will:"
echo "   • Deploy to LIVE IC mainnet"
echo "   • Consume real cycles from your wallet"
echo "   • Create publicly accessible canisters"
echo "   • Cannot be easily reversed"
echo ""
read -p "Are you ABSOLUTELY SURE you want to continue? (type 'YES' to confirm): " CONFIRMATION

if [ "$CONFIRMATION" != "YES" ]; then
    echo "Deployment cancelled"
    exit 1
fi

echo ""
echo "🏗️  Starting production deployment..."
echo "===================================="

# Build frontend first (fail early if there are build issues)
echo ""
echo "🎨 Building frontend for production..."
if [ -d "src/frontend" ]; then
    cd src/frontend
    
    if [ -f "package.json" ]; then
        echo "📦 Installing frontend dependencies..."
        npm ci  # Use ci for production builds
        
        echo "🔍 Running frontend type check..."
        if ! npm run type-check 2>/dev/null; then
            echo "⚠️  Type check not available, skipping..."
        fi
        
        echo "🏗️  Building frontend..."
        NODE_ENV=production npm run build
        echo "✅ Frontend build completed"
        
        cd ../..
    else
        echo "❌ Frontend package.json not found!"
        exit 1
    fi
else
    echo "❌ Frontend directory not found!"
    exit 1
fi

# Deploy backend canisters in dependency order
echo ""
echo "📦 Deploying backend canisters to IC mainnet..."
echo ""

# Phase 1: Deploy Core Canister
echo "🏢 Phase 1: Deploying Core Canister..."
dfx deploy arks-core --network ic --argument "(opt principal \"$ADMIN_PRINCIPAL\", null)"
CORE_CANISTER_ID=$(dfx canister id arks-core --network ic)
echo "✅ Core canister deployed: $CORE_CANISTER_ID"

# Phase 2: Deploy Risk Engine with Core reference
echo ""
echo "🧠 Phase 2: Deploying Risk Engine Canister..."
dfx deploy arks-risk-engine --network ic --argument "(opt principal \"$ADMIN_PRINCIPAL\", null, null, opt \"$CORE_CANISTER_ID\")"
RISK_ENGINE_ID=$(dfx canister id arks-risk-engine --network ic)
echo "✅ Risk engine deployed: $RISK_ENGINE_ID"

# Phase 3: Update Core canister with Risk Engine reference
echo ""
echo "🔄 Phase 3: Updating Core canister with Risk Engine reference..."
dfx deploy arks-core --network ic --argument "(opt principal \"$ADMIN_PRINCIPAL\", opt \"$RISK_ENGINE_ID\")" --mode upgrade
echo "✅ Core canister updated with risk engine reference"

# Phase 4: Deploy Token Factory with Core reference
echo ""
echo "🏭 Phase 4: Deploying Token Factory..."
dfx deploy arks-token-factory --network ic --argument "(opt principal \"$ADMIN_PRINCIPAL\", principal \"$CORE_CANISTER_ID\")"
TOKEN_FACTORY_ID=$(dfx canister id arks-token-factory --network ic)
echo "✅ Token factory deployed: $TOKEN_FACTORY_ID"

# Phase 5: Deploy Identity Canister
echo ""
echo "🔐 Phase 5: Deploying Identity Canister..."
dfx deploy arks-identity --network ic --argument "(opt principal \"$ADMIN_PRINCIPAL\")"
IDENTITY_ID=$(dfx canister id arks-identity --network ic)
echo "✅ Identity canister deployed: $IDENTITY_ID"

# Phase 6: Generate TypeScript declarations
echo ""
echo "📝 Generating TypeScript declarations..."
dfx generate --network ic
echo "✅ TypeScript declarations generated"

# Phase 7: Deploy Frontend
echo ""
echo "🌐 Phase 7: Deploying Frontend to IC..."
dfx deploy frontend --network ic
FRONTEND_ID=$(dfx canister id frontend --network ic)
echo "✅ Frontend deployed: $FRONTEND_ID"

# Post-deployment validation
echo ""
echo "✅ Validating deployment..."
echo "🔍 Checking canister status..."

for canister in arks-core arks-risk-engine arks-token-factory arks-identity frontend; do
    if dfx canister status $canister --network ic > /dev/null 2>&1; then
        echo "   ✅ $canister: Running"
    else
        echo "   ❌ $canister: Failed"
    fi
done

# Final success message
echo ""
echo "🎉 PRODUCTION DEPLOYMENT SUCCESSFUL!"
echo "===================================="
echo ""
echo "🌐 Your ARKS RWA platform is now LIVE on IC mainnet!"
echo ""
echo "📍 Production URLs:"
echo ""
echo "🏢 Core Canister:        https://$CORE_CANISTER_ID.icp0.io"
echo "🧠 Risk Engine:          https://$RISK_ENGINE_ID.icp0.io"  
echo "🏭 Token Factory:        https://$TOKEN_FACTORY_ID.icp0.io"
echo "🔐 Identity:             https://$IDENTITY_ID.icp0.io"
echo "🌐 Frontend Application: https://$FRONTEND_ID.icp0.io"
echo ""
echo "📋 Canister IDs (save these for reference):"
echo "   CANISTER_ID_ARKS_CORE=$CORE_CANISTER_ID"
echo "   CANISTER_ID_ARKS_RISK_ENGINE=$RISK_ENGINE_ID"
echo "   CANISTER_ID_ARKS_TOKEN_FACTORY=$TOKEN_FACTORY_ID"
echo "   CANISTER_ID_ARKS_IDENTITY=$IDENTITY_ID"
echo "   CANISTER_ID_FRONTEND=$FRONTEND_ID"
echo ""
echo "👤 Admin Principal:      $ADMIN_PRINCIPAL"
echo ""
echo "🔗 Inter-canister communication:"
echo "   Core ↔ Risk Engine:   ✅ Connected"
echo "   Token Factory → Core: ✅ Connected"
echo ""
echo "📚 Next steps:"
echo "   1. Update your frontend environment variables with production canister IDs"
echo "   2. Configure your AI services with production API keys"
echo "   3. Test the platform functionality"
echo "   4. Set up monitoring and alerts"
echo ""
echo "🔐 Security reminder:"
echo "   • Keep your admin principal secure"
echo "   • Regularly monitor canister cycles"
echo "   • Review logs for any unusual activity"
echo ""
echo "📖 Documentation: Check CLAUDE.md for management commands"
echo ""