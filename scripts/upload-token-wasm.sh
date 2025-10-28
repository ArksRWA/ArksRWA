#!/usr/bin/env bash

# upload-token-wasm.sh — Script to upload CompanyToken WASM to TokenFactory
# Usage:
#   ./upload-token-wasm.sh [version]
#   ./upload-token-wasm.sh v1.0.0

set -Eeuo pipefail

VERSION="${1:-v1.0.0}"

# ---------- Config ----------
CANISTER_NAME="arks-token-factory"
WASM_PATH="../target/wasm32-unknown-unknown/release/company_token.wasm"

# ---------- Helpers ----------
log() { printf "\033[1;32m[upload-token-wasm]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[upload-token-wasm]\033[0m %s\n" "$*" >&2; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing required command: $1"; exit 1; }; }

# ---------- Requirements ----------
require_cmd dfx
require_cmd base64

# ---------- Check if WASM exists ----------
if [[ ! -f "$WASM_PATH" ]]; then
    err "WASM file not found at $WASM_PATH"
    err "Please build the CompanyToken canister first:"
    err "  cd src/backend/company_token && cargo build --target wasm32-unknown-unknown --release"
    exit 1
fi

# ---------- Get canister ID ----------
CANISTER_ID=$(dfx canister id "$CANISTER_NAME" 2>/dev/null || true)
if [[ -z "$CANISTER_ID" ]]; then
    err "Could not get canister ID for $CANISTER_NAME"
    err "Make sure the canister is deployed first"
    exit 1
fi

log "Uploading CompanyToken WASM to $CANISTER_NAME ($CANISTER_ID)"
log "WASM path: $WASM_PATH"
log "Version: $VERSION"

# ---------- Convert WASM to base64 ----------
WASM_BASE64=$(base64 -i "$WASM_PATH" | tr -d '\n')

# ---------- Upload WASM ----------
dfx canister call "$CANISTER_NAME" setTokenWasm "(record {
    version = \"$VERSION\";
    token_module = blob \"$WASM_BASE64\";
    uploaded_at_ns = $(date +%s%N);
    notes = null : opt text;
})"

log "WASM uploaded successfully"
log "You can now create tokens using the TokenFactory"