#!/bin/bash

# Example script to spawn a token for a company
# This assumes you have already uploaded the WASM using upload-token-wasm.sh

set -e

# Configuration - update these values for your use case
COMPANY_ID=1                    # Company ID from Core canister
TOKEN_NAME="Example Token"      # Token name
TOKEN_SYMBOL="EXMPL"            # Token symbol (3-5 chars)
DECIMALS=8                      # Token decimals
TOTAL_SUPPLY=1000000000         # Total token supply
PLATFORM_EQUITY_BIPS=300        # Platform equity percentage (300 = 3%)
TREASURY_PRINCIPAL="$(dfx identity get-principal)"  # Platform treasury principal
COMPANY_OWNER_PRINCIPAL="$(dfx identity get-principal)"  # Company owner principal
FREEZE_MINT=true                # Whether to freeze minting after initial mint

echo "Spawning token for company $COMPANY_ID..."
echo "Token details:"
echo "  Name: $TOKEN_NAME"
echo "  Symbol: $TOKEN_SYMBOL"
echo "  Decimals: $DECIMALS"
echo "  Total Supply: $TOTAL_SUPPLY"
echo "  Platform Equity: $((PLATFORM_EQUITY_BIPS / 100))%"
echo "  Treasury: $TREASURY_PRINCIPAL"
echo "  Company Owner: $COMPANY_OWNER_PRINCIPAL"
echo ""

# Call createToken on the token_factory canister
dfx canister call token_factory createToken "(record {
  company_id = $COMPANY_ID : nat;
  name = \"$TOKEN_NAME\" : text;
  symbol = \"$TOKEN_SYMBOL\" : text;
  decimals = $DECIMALS : nat;
  total_supply = $TOTAL_SUPPLY : nat;
  platform_equity_bips = $PLATFORM_EQUITY_BIPS : nat;
  platform_treasury = record {
    owner = \"$TREASURY_PRINCIPAL\" : principal;
    subaccount = null : opt vec nat8;
  };
  company_owner = \"$COMPANY_OWNER_PRINCIPAL\" : principal;
  freeze_mint_after_init = ${FREEZE_MINT} : bool;
})" --with-cycles 100000000000

echo ""
echo "Token spawned successfully!"
echo ""
echo "To verify the token was created and registered in Core:"
echo "dfx canister call core getCompany ($COMPANY_ID)"
echo ""
echo "To check the token canister details:"
echo "dfx canister call token_factory getTokenOf ($COMPANY_ID)"