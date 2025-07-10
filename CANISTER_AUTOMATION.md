# Canister ID Automation

This project now includes automated canister ID management for both local and production environments.

## How It Works

### 1. Automated Environment Variables
- The `src/frontend/config/canister.ts` file now reads canister IDs from environment variables
- Both local and production configurations use the same pattern
- Fallback values are provided for safety

### 2. Local Development Setup
When you run `dfx deploy --network local`:
1. DFX generates a `.env` file in the root directory with canister IDs
2. Run the `update-env.sh` script to sync these IDs to the frontend
3. Next.js automatically picks up the new environment variables

### 3. Automation Script
The `update-env.sh` script:
- Reads canister IDs from the root `.env` file
- Creates/updates `src/frontend/.env.local` with the correct format for Next.js
- Automatically triggers Next.js to reload the environment variables

## Usage

### Quick Start
```bash
# Deploy everything locally (recommended)
./deploy.sh local

# Or use the management script
./manage.sh deploy local
```

### Development Workflow
```bash
# Start development environment (includes deployment)
./manage.sh dev

# Or manual deployment after changes
./deploy.sh local
```

### Production Deployment
```bash
# Deploy to Internet Computer mainnet
./deploy.sh ic
## Deployment Scripts

### `deploy.sh` - Complete Deployment Script
Handles the full deployment process with proper dependency management:

```bash
# Deploy locally for development
./deploy.sh local

# Deploy to Internet Computer mainnet
./deploy.sh ic
```

**Features:**
- ✅ Validates network arguments
- ✅ Starts local replica automatically (for local deployments)
- ✅ Builds frontend with dependency installation
- ✅ Deploys canisters in correct order (II → Backend → Frontend)
- ✅ Generates canister declarations
- ✅ Updates frontend environment variables
- ✅ Provides deployment summary with URLs
- ✅ Colored output for better readability

### `manage.sh` - Project Management Script
Provides common operations for project management:

```bash
# Available commands
./manage.sh deploy <local|ic>    # Deploy to specified network
./manage.sh start                # Start local DFX replica
./manage.sh stop                 # Stop local DFX replica
./manage.sh clean                # Clean restart local replica
./manage.sh status               # Show deployment status
./manage.sh logs                 # Show canister logs
./manage.sh update-env           # Update frontend environment variables
./manage.sh dev                  # Start complete development environment
./manage.sh build                # Build frontend for production
./manage.sh help                 # Show help message
```

**Development Workflow Examples:**
```bash
# Start development (auto-deploys if needed)
./manage.sh dev

# Check deployment status
./manage.sh status

# Clean restart everything
./manage.sh clean
./manage.sh deploy local

# View backend logs
./manage.sh logs
```
```

### Environment Variables Used
- `CANISTER_ID_ARKS_RWA_BACKEND` - Backend canister ID
- `CANISTER_ID_INTERNET_IDENTITY` - Internet Identity canister ID  
- `CANISTER_ID_FRONTEND` - Frontend canister ID
- `NEXT_PUBLIC_DFX_NETWORK` - Network environment (local/ic)

## Files Modified
- `src/frontend/config/canister.ts` - Now reads from environment variables
- `src/frontend/.env.local` - Contains Next.js environment variables
- `update-env.sh` - Automation script for syncing canister IDs

## Benefits
- ✅ No more manual canister ID updates
- ✅ Consistent across deployments
- ✅ Automatic environment variable management
- ✅ Fallback values for safety
- ✅ Works for both local and production environments