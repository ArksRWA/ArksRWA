#!/bin/bash

# Script to update frontend environment variables from root .env file
# This should be run after dfx deploy to sync canister IDs

if [ -f ".env" ]; then
    echo "Updating frontend environment variables..."
    
    # Extract canister IDs from root .env file
    BACKEND_ID=$(grep "CANISTER_ID_ARKS_RWA_BACKEND=" .env | cut -d'=' -f2 | tr -d "'")
    FRONTEND_ID=$(grep "CANISTER_ID_FRONTEND=" .env | cut -d'=' -f2 | tr -d "'")
    II_ID=$(grep "CANISTER_ID_INTERNET_IDENTITY=" .env | cut -d'=' -f2 | tr -d "'")
    NETWORK=$(grep "DFX_NETWORK=" .env | cut -d'=' -f2 | tr -d "'")
    
    # Create/update frontend .env.local file
    cat > src/frontend/.env.local << EOF
# DFX CANISTER ENVIRONMENT VARIABLES (Auto-generated)
CANISTER_ID_INTERNET_IDENTITY=$II_ID
CANISTER_ID_FRONTEND=$FRONTEND_ID
CANISTER_ID_ARKS_RWA_BACKEND=$BACKEND_ID
NEXT_PUBLIC_DFX_NETWORK=$NETWORK
DFX_NETWORK=$NETWORK
EOF
    
    echo "Frontend environment variables updated successfully!"
    echo "Backend: $BACKEND_ID"
    echo "Frontend: $FRONTEND_ID"
    echo "Internet Identity: $II_ID"
    echo "Network: $NETWORK"
else
    echo "Error: .env file not found. Please run 'dfx deploy' first."
    exit 1
fi