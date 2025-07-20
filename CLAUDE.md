# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ARKS RWA** is a Real World Asset tokenization platform built on the Internet Computer Protocol (ICP). It features a Motoko backend canister with sophisticated bonding curve pricing and a Next.js frontend with multi-wallet authentication support including Plug wallet and Internet Identity.

## Essential Development Commands

### Local Development Setup
```bash
# Start the complete local environment (backend + frontend)
npm run dev                    # Runs deploy-local.sh script

# Alternative granular commands
dfx start --background         # Start local IC replica
dfx deploy arks-rwa-backend   # Deploy backend canister
dfx generate arks-rwa-backend # Generate TypeScript declarations
cd src/frontend && npm run dev # Start frontend dev server (with Turbopack enabled)
```

### Build and Deploy
```bash
# Local deployment
npm run deploy:local          # Full local deployment with environment setup

# Production deployment  
npm run deploy:production     # Deploy to IC mainnet

# Frontend only
cd src/frontend && npm run build  # Build and export static assets to build/ directory
```

### Backend Development
```bash
# Deploy specific canister
dfx deploy arks-rwa-backend --argument '(opt principal "YOUR_ADMIN_PRINCIPAL")'

# Test backend functions
dfx canister call arks-rwa-backend listCompanies
dfx canister call arks-rwa-backend getUserType '(principal "YOUR_PRINCIPAL")'  # Returns #company or #user
dfx canister call arks-rwa-backend simulatePurchasePrice '(0, 10)'  # Test pricing simulation
dfx canister call arks-rwa-backend getPricingParameters  # Get current pricing config

# Test ICRC-1 compliance
dfx canister call arks-rwa-backend icrc1_name '(0)'
dfx canister call arks-rwa-backend icrc1_symbol '(0)'
dfx canister call arks-rwa-backend icrc1_balance_of '(0, record{owner=principal "YOUR_PRINCIPAL"; subaccount=null})'

# Check canister status
dfx canister status arks-rwa-backend
```

### Frontend Development
```bash
cd src/frontend
npm run dev                   # Start with Turbopack (configurable)
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
- **Authentication**: Multi-wallet (Plug, Internet Identity)
- **ICP Integration**: @dfinity/agent with automatic type generation
- **Build Output**: Static assets exported to `src/frontend/build/`
- **Auth Library**: ic-auth for wallet connections

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
- **Authentication**: `src/frontend/services/auth.ts` handles multi-wallet connections

#### Module Resolution
- **Declarations Path**: `../../declarations/arks-rwa-backend` (relative imports)
- **TypeScript Config**: Includes `../declarations/**/*.ts` for proper resolution
- **Webpack Alias**: `@declarations` alias with fallback to relative paths

## Enhanced Pricing System

### Core Implementation
The platform uses a sophisticated bonding curve pricing model with modular helper functions:

- **Bonding Curve**: Exponential price growth using formula `Price = Base_Price × (1 + Sold_Ratio)^1.5`
- **Scarcity Multiplier**: Gradual increase as supply decreases: `max(1.0, 2.0 - scarcityRatio)`
- **Volume Multiplier**: Gradual increase with purchase amount: `min(1.5, 1.0 + amount/100.0)`
- **Combined Effect**: Multipliers applied multiplicatively for compound pricing impact
- **Price Bounds**: 0.5x to 10x base price limits with safe Float/Int conversion

### Pricing Architecture (main.mo:127-182)
**Helper Functions**:
- `calculateBaseBondingCurvePrice()`: Pure bonding curve calculation with bounds checking
- `calculateCombinedMultiplier()`: Combines scarcity and volume effects into single multiplier
- `calculateEnhancedPrice()`: Clean main function using helper functions (no in-place assignments)

**Safety Features**:
- **Bounds Checking**: Price limits prevent extreme movements (0.5x to 10x base price)
- **Underflow Protection**: `simulateSellPrice` handles edge cases with proper error messages
- **Zero Division**: Safe division functions prevent mathematical traps

### Economic Impact
- **Small Purchases**: Minimal volume impact (10 tokens ≈ 10% increase)
- **Large Purchases**: Significant volume premium (50 tokens ≈ 50% increase)
- **Supply Scarcity**: Exponential price acceleration as remaining supply decreases
- **Combined Effects**: Scarcity and volume multipliers compound for maximum price discovery

## Authentication & Wallet Integration

### Multi-Wallet Support
1. **Plug Wallet**: Browser extension with full backend connectivity using ic-auth library
2. **Internet Identity**: Native ICP authentication using ic-auth library

### Authentication Flow
- **ic-auth Library**: Used for both Plug and Internet Identity connections
- **Role Management**: Support for both company and user roles with localStorage persistence
- **Authentication Required**: All backend operations require wallet connection

### Critical Authentication Pattern
```typescript
// Always import Principal for backend calls
const { Principal } = await import('@dfinity/principal');
const callerPrincipal = Principal.fromText(user.principal);
const result = await actor.functionName(param1, param2, callerPrincipal);
```

## Development Environment Configuration

### Network Configuration
- **Local**: `http://localhost:4943` (dfx local replica)
- **Production**: `https://icp-api.io` (IC mainnet)
- **Auto-detection**: Environment-based canister ID resolution via `NEXT_PUBLIC_DFX_NETWORK`

### Canister IDs Management
- **Config File**: `src/frontend/config/canister.ts`
- **Local IDs**: Hardcoded for development consistency
  - Backend: `uxrrr-q7777-77774-qaaaq-cai`
  - Internet Identity: `vpyes-67777-77774-qaaeq-cai`
  - Frontend: `vizcg-th777-77774-qaaea-cai`
- **Production IDs**: Environment variable based (`CANISTER_ID_ARKS_RWA_BACKEND`)

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
# Test enhanced pricing with volume effects
dfx canister call arks-rwa-backend simulatePurchasePrice '(0, 50)'  # Large volume
dfx canister call arks-rwa-backend simulatePurchasePrice '(0, 10)'  # Small volume
dfx canister call arks-rwa-backend simulateSellPrice '(0, 5)'  # Test sell price simulation

# Test pricing parameters
dfx canister call arks-rwa-backend getPricingParameters

# Test account types (returns #company or #user)
dfx canister call arks-rwa-backend getUserType '(principal "YOUR_PRINCIPAL")'
dfx canister call arks-rwa-backend setAccountType '(#company, principal "YOUR_PRINCIPAL")' # Set account type manually
dfx canister call arks-rwa-backend getAccountTypeSource '(principal "YOUR_PRINCIPAL")' # Check if manual or derived

# Test company operations
dfx canister call arks-rwa-backend buyTokens '(0, 15, principal "YOUR_PRINCIPAL")'
dfx canister call arks-rwa-backend sellTokens '(0, 5, principal "YOUR_PRINCIPAL")'

# Test ICRC-1 token transfers
dfx canister call arks-rwa-backend icrc1_transfer '(0, record{from_subaccount=null; to=record{owner=principal "RECIPIENT_PRINCIPAL"; subaccount=null}; amount=10; fee=null; memo=null; created_at_time=null}, principal "SENDER_PRINCIPAL")'

# Test company management
dfx canister call arks-rwa-backend updateCompanyDescription '(0, "Updated description", principal "COMPANY_OWNER_PRINCIPAL")'
```

### Frontend Testing
- **Type Checking**: Run `npx tsc --noEmit` before commits
- **Wallet Integration**: Test with actual Plug wallet and Internet Identity on localhost
- **Authentication Required**: All features require wallet connection for testing

## Key Files & Responsibilities

### Backend Core
- `src/arks-rwa-backend/main.mo`: Complete canister implementation with modular pricing system
  - **Pricing Functions**: Lines 127-182 contain refactored pricing logic
  - **Helper Functions**: `calculateBaseBondingCurvePrice`, `calculateCombinedMultiplier`
  - **Main Function**: `calculateEnhancedPrice` with clean, step-by-step structure
  - **ICRC-1 Functions**: Full token standard compliance with transfer, balance, and metadata functions
  - **Account Management**: User type detection and manual account type overrides
- `src/arks-rwa-backend/docs/token-pricing-analysis.md`: Pricing system documentation

### Frontend Core
- `src/frontend/services/backend.ts`: Backend integration service with full wallet integration
- `src/frontend/services/auth.ts`: Authentication service with multi-wallet support
- `src/frontend/types/canister.ts`: Type definitions and Candid conversions
- `src/frontend/config/canister.ts`: Network and canister configuration
- `src/frontend/app/layout.tsx`: Root layout with Navigation component

### Frontend Pages & Components
- `src/frontend/app/page.tsx`: Landing page
- `src/frontend/app/companies/page.tsx`: Company listing page
- `src/frontend/app/company/[id]/page.tsx`: Individual company details
- `src/frontend/app/create-company/page.tsx`: Company creation form
- `src/frontend/app/dashboard/page.tsx`: User dashboard
- `src/frontend/app/manage-company/[id]/page.tsx`: Company management interface
- `src/frontend/app/transfer/page.tsx`: Token transfer interface
- `src/frontend/app/transactions/page.tsx`: Transaction history
- `src/frontend/app/components/`: Reusable UI components (Navigation, CompanyCard, etc.)

### Deployment & Scripts
- `scripts/deploy-local.sh`: Complete local environment setup with Internet Identity
- `scripts/deploy-production.sh`: Production deployment with confirmation prompts
- `dfx.json`: Canister configuration including Internet Identity
- `package.json`: Root project scripts and metadata

## Production Deployment Notes

### Environment Variables Required
- `CANISTER_ID_ARKS_RWA_BACKEND`: Production backend canister ID
- `NEXT_PUBLIC_DFX_NETWORK`: Set to "ic" for production

### Admin Principal Setup
- Backend requires admin principal for certain operations
- Set via dfx deploy argument: `--argument '(opt principal "YOUR_ADMIN_PRINCIPAL")'`

This project implements a production-ready tokenization platform with sophisticated economic models and comprehensive ICP integration.