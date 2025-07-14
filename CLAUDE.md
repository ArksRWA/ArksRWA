# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ARKS RWA** is a Real World Asset tokenization platform built on the Internet Computer Protocol (ICP). It features a Motoko backend canister with sophisticated bonding curve pricing and a Next.js frontend with multi-wallet authentication support.

## Essential Development Commands

### Local Development Setup
```bash
# Start the complete local environment (backend + frontend)
npm run dev                    # Runs deploy-local.sh script

# Alternative granular commands
dfx start --background         # Start local IC replica
dfx deploy arks-rwa-backend   # Deploy backend canister
dfx generate arks-rwa-backend # Generate TypeScript declarations
cd src/frontend && npm run dev # Start frontend dev server
```

### Build and Deploy
```bash
# Local deployment
npm run deploy:local          # Full local deployment with environment setup

# Production deployment  
npm run deploy:production     # Deploy to IC mainnet

# Frontend only
cd src/frontend && npm run build  # Build and export static assets
```

### Backend Development
```bash
# Deploy specific canister
dfx deploy arks-rwa-backend --argument '(opt principal "YOUR_ADMIN_PRINCIPAL")'

# Test backend functions
dfx canister call arks-rwa-backend listCompanies
dfx canister call arks-rwa-backend getUserType '(principal "YOUR_PRINCIPAL")'  # Returns #company or #user

# Check canister status
dfx canister status arks-rwa-backend
```

### Frontend Development
```bash
cd src/frontend
npm run dev                   # Start with Turbopack
npm run lint                  # Run ESLint
npx tsc --noEmit             # Type checking
```

## Architecture Overview

### Backend (Motoko Canister)
- **Location**: `src/arks-rwa-backend/main.mo`
- **Key Feature**: Enhanced bonding curve pricing system with exponential growth
- **Standards**: Full ICRC-1 token compliance
- **Authentication**: Principal-based with caller parameter patterns
- **Pricing Formula**: `Price = Base_Price × (1 + Sold_Ratio)^1.5`

### Frontend (Next.js + TypeScript)
- **Framework**: Next.js 15.3.4 with App Router
- **Styling**: Tailwind CSS 4.0
- **Authentication**: Multi-wallet (Plug, Internet Identity, Demo mode)
- **ICP Integration**: @dfinity/agent with automatic type generation

### Critical Architecture Patterns

#### Backend Function Signatures
All backend functions follow this pattern requiring caller principal:
```motoko
public func functionName(param1: Type1, param2: Type2, caller: Principal) : async ReturnType
```

#### Frontend Service Layer
- **Location**: `src/frontend/services/backend.ts`
- **Pattern**: Always pass caller principal to backend functions
- **Type Conversion**: BigInt ↔ Number conversion for UI compatibility
- **Error Handling**: Comprehensive try-catch with user-friendly messages

#### Module Resolution
- **Declarations Path**: `../../declarations/arks-rwa-backend` (relative imports)
- **TypeScript Config**: Includes `../declarations/**/*.ts` for proper resolution
- **Webpack Alias**: `@declarations` alias with fallback to relative paths

## Enhanced Pricing System

### Core Implementation
The platform uses a sophisticated bonding curve pricing model that replaces linear pricing:

- **Bonding Curve**: Exponential price growth based on token sales ratio
- **Volume Multipliers**: 10% premium for large purchases (≥50 tokens)
- **Scarcity Multipliers**: 2x acceleration when supply <10% remaining
- **Price Bounds**: 0.5x to 10x base price limits

### Economic Impact
- **Early Adopters**: Minimal price impact (110% at 10% sold)
- **Late Investors**: Significant scarcity premium (387% at 90% sold)
- **Revenue Increase**: 55% higher total revenue vs linear pricing

## Authentication & Wallet Integration

### Multi-Wallet Support
1. **Plug Wallet**: Browser extension with full backend connectivity
2. **Internet Identity**: Native ICP authentication
3. **Demo Mode**: Wallet-free testing with simulated data

### Critical Authentication Pattern
```typescript
// Always import Principal for backend calls
const { Principal } = await import('@dfinity/principal');
const callerPrincipal = Principal.fromText(user.principal);
const result = await actor.functionName(param1, param2, callerPrincipal);
```

## Development Environment Configuration

### Network Configuration
- **Local**: `127.0.0.1:4943` (dfx local replica)
- **Production**: `icp-api.io` (IC mainnet)
- **Auto-detection**: Environment-based canister ID resolution

### Canister IDs Management
- **Config File**: `src/frontend/config/canister.ts`
- **Local IDs**: Hardcoded for development consistency
- **Production IDs**: Environment variable based

## Type Safety & Declarations

### Automatic Type Generation
- **Source**: Motoko canister interface
- **Output**: `src/declarations/arks-rwa-backend/`
- **Regeneration**: Run `dfx generate` after backend changes

### Frontend Type Patterns
```typescript
// Candid types → Frontend types conversion
export const candidCompanyToFrontend = (candidCompany: CandidCompany): Company => {
  return {
    id: Number(candidCompany.id),
    token_price: Number(candidCompany.token_price),
    // Always convert BigInt to Number for UI
  };
};
```

## Common Development Issues & Solutions

### Module Import Errors
- **Issue**: "Cannot find module '@declarations/arks-rwa-backend'"
- **Solution**: Use relative imports `../../declarations/arks-rwa-backend`
- **Prevention**: Run `dfx generate` after backend changes

### BigInt Conversion Errors
- **Issue**: "Cannot mix BigInt and other types"
- **Solution**: Wrap all backend values with `Number()` for arithmetic operations
- **Pattern**: `Number(company.token_price) * Number(amount)`

### Backend Function Call Errors
- **Issue**: "Wrong number of message arguments"
- **Solution**: Ensure all functions include caller principal as last parameter
- **Pattern**: `actor.functionName(param1, param2, callerPrincipal)`

## Testing & Verification

### Backend Testing
```bash
# Test enhanced pricing
dfx canister call arks-rwa-backend simulatePurchasePrice '(0, 50)'

# Test account types (returns #company or #user)
dfx canister call arks-rwa-backend getUserType '(principal "YOUR_PRINCIPAL")'

# Test company operations
dfx canister call arks-rwa-backend buyTokens '(0, 15, principal "YOUR_PRINCIPAL")'
```

### Frontend Testing
- **Demo Mode**: Test all functionality without wallet connection
- **Type Checking**: Run `npx tsc --noEmit` before commits
- **Wallet Integration**: Test with actual Plug wallet on localhost

## Key Files & Responsibilities

### Backend Core
- `src/arks-rwa-backend/main.mo`: Complete canister implementation
- `src/arks-rwa-backend/docs/token-pricing-analysis.md`: Pricing system documentation

### Frontend Core
- `src/frontend/services/backend.ts`: Backend integration service
- `src/frontend/types/canister.ts`: Type definitions and conversions
- `src/frontend/config/canister.ts`: Network and canister configuration

### Deployment & Scripts
- `scripts/deploy-local.sh`: Complete local environment setup
- `scripts/deploy-production.sh`: Production deployment automation
- `dfx.json`: Canister configuration and network settings

## Production Deployment Notes

### Environment Variables Required
- `CANISTER_ID_ARKS_RWA_BACKEND`: Production backend canister ID
- `NEXT_PUBLIC_DFX_NETWORK`: Set to "ic" for production

### Admin Principal Setup
- Backend requires admin principal for certain operations
- Set via dfx deploy argument: `--argument '(opt principal "YOUR_ADMIN_PRINCIPAL")'`

This project implements a production-ready tokenization platform with sophisticated economic models and comprehensive ICP integration.