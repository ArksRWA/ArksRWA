#!/usr/bin/env bash

# spawn-token.sh — Script to spawn a token using the TokenFactory
# Usage:
#   ./spawn-token.sh <company_id> <name> <symbol> <decimals> <total_supply> <platform_equity_bips> <cycles>
#   ./spawn-token.sh 1 "My Company" "MYCO" 8 1000000000 300 1000000000000

set -Eeuo pipefail

# ---------- Parameters ----------
COMPANY_ID="${1:-1}"
NAME="${2:-"My Company"}"
SYMBOL="${3:-"MYCO"}"
DECIMALS="${4:-8}"
TOTAL_SUPPLY="${5:-1000000000}"
PLATFORM_EQUITY_BIPS="${6:-300}"  # 3%
CYCLES="${7:-1000000000000}"  # 1 trillion cycles

# ---------- Config ----------
CANISTER_NAME="arks-token-factory"
CORE_CANISTER_NAME="arks-core"

# ---------- Helpers ----------
log() { printf "\033[1;32m[spawn-token]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[spawn-token]\033[0m %s\n" "$*" >&2; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing required command: $1"; exit 1; }; }

# ---------- Requirements ----------
require_cmd dfx

# ---------- Get canister IDs ----------
CANISTER_ID=$(dfx canister id "$CANISTER_NAME" 2>/dev/null || true)
if [[ -z "$CANISTER_ID" ]]; then
    err "Could not get canister ID for $CANISTER_NAME"
    err "Make sure the canister is deployed first"
    exit 1
fi

CORE_CANISTER_ID=$(dfx canister id "$CORE_CANISTER_NAME" 2>/dev/null || true)
if [[ -z "$CORE_CANISTER_ID" ]]; then
    err "Could not get canister ID for $CORE_CANISTER_NAME"
    err "Make sure the canister is deployed first"
    exit 1
fi

# ---------- Get company owner ----------
log "Getting company owner for company ID $COMPANY_ID..."
COMPANY_OWNER=$(dfx canister call "$CORE_CANISTER_NAME" getCompany "(record { id = $COMPANY_ID:nat32; })" |
    grep "owner" | head -1 | cut -d'"' -f4)

if [[ -z "$COMPANY_OWNER" ]]; then
    err "Could not get company owner for company ID $COMPANY_ID"
    exit 1
fi

log "Company owner: $COMPANY_OWNER"

# ---------- Get platform treasury ----------
log "Getting platform treasury..."
PLATFORM_TREASURY=$(dfx canister call "$CORE_CANISTER_NAME" getGovernance |
    grep "platform_treasury" | head -1 | cut -d'"' -f4)

if [[ -z "$PLATFORM_TREASURY" ]]; then
    err "Could not get platform treasury"
    exit 1
fi

log "Platform treasury: $PLATFORM_TREASURY"

# ---------- Spawn token ----------
log "Spawning token with the following parameters:"
log "  Company ID: $COMPANY_ID"
log "  Name: $NAME"
log "  Symbol: $SYMBOL"
log "  Decimals: $DECIMALS"
log "  Total Supply: $TOTAL_SUPPLY"
log "  Platform Equity Bips: $PLATFORM_EQUITY_BIPS"
log "  Cycles: $CYCLES"

# Build the argument for the createToken call
ARGUMENT="(record {
    company_id = $COMPANY_ID:nat32;
    name = \"$NAME\";
    symbol = \"$SYMBOL\";
    decimals = $DECIMALS:nat32;
    total_supply = $TOTAL_SUPPLY:nat64;
    platform_equity_bips = $PLATFORM_EQUITY_BIPS:nat32;
    platform_treasury = record {
        owner = principal \"$PLATFORM_TREASURY\";
        subaccount = null : opt vec nat8;
    };
    company_owner = principal \"$COMPANY_OWNER\";
    freeze_mint_after_init = true;
})"

log "Calling createToken on $CANISTER_NAME with $CYCLES cycles..."
RESULT=$(dfx canister call "$CANISTER_NAME" createToken "$ARGUMENT" --with-cycles "$CYCLES")

log "Token creation result: $RESULT"

# Extract token canister ID from the result
TOKEN_CANISTER_ID=$(echo "$RESULT" | grep "token_canister_id" | cut -d'"' -f4)

if [[ -n "$TOKEN_CANISTER_ID" ]]; then
    log "Token canister ID: $TOKEN_CANISTER_ID"
    log "You can now interact with the token canister at: $TOKEN_CANISTER_ID"
else
    err "Could not extract token canister ID from the result"
    exit 1
fi