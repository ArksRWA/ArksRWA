# ARKS RWA Deployment Guide

Complete guide for deploying and managing the ARKS RWA project on both local and Internet Computer networks.

## 🚀 Quick Start

### Local Development
```bash
# One-command deployment and setup
./deploy.sh local

# Or start complete development environment
./manage.sh dev
```

### Production Deployment
```bash
# Deploy to Internet Computer mainnet
./deploy.sh ic
```

## 📋 Prerequisites

- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install/) installed
- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## 🛠 Available Scripts

### `deploy.sh` - Complete Deployment Script

**Usage:** `./deploy.sh <network>`

**Networks:**
- `local` - Deploy to local DFX replica
- `ic` - Deploy to Internet Computer mainnet

**What it does:**
1. ✅ Validates network arguments
2. ✅ Starts local replica (for local deployments)
3. ✅ Installs frontend dependencies
4. ✅ Builds Next.js application
5. ✅ Deploys canisters in correct order:
   - Internet Identity (local only)
   - Backend canister
   - Frontend canister
6. ✅ Generates canister declarations
7. ✅ Updates frontend environment variables
8. ✅ Provides deployment summary with access URLs

### `manage.sh` - Project Management Script

**Usage:** `./manage.sh <command> [options]`

| Command | Description |
|---------|-------------|
| `deploy <local\|ic>` | Deploy all canisters to specified network |
| `start` | Start local DFX replica |
| `stop` | Stop local DFX replica |
| `clean` | Clean and restart local replica |
| `status` | Show deployment status and canister IDs |
| `logs` | Show backend canister logs |
| `update-env` | Update frontend environment variables |
| `dev` | Start complete development environment |
| `build` | Build frontend for production |
| `help` | Show help message |

### `update-env.sh` - Environment Variable Sync

**Usage:** `./update-env.sh`

Automatically syncs canister IDs from root `.env` file to `src/frontend/.env.local` for Next.js.

## 🏗 Project Architecture

### Canisters
1. **arks-rwa-backend** - Motoko backend canister
2. **frontend** - Assets canister for built Next.js app
3. **internet_identity** - Authentication canister (local development)

### Dependencies
- Frontend depends on Backend (for canister IDs)
- Deployment order: II → Backend → Frontend

## 📁 File Structure

```
├── deploy.sh              # Main deployment script
├── manage.sh              # Project management script
├── update-env.sh          # Environment variable sync
├── dfx.json               # DFX configuration
├── .env                   # Generated canister IDs (by DFX)
├── src/
│   ├── arks-rwa-backend/  # Motoko backend
│   └── frontend/          # Next.js frontend
│       ├── .env.local     # Frontend environment variables
│       └── ...
└── ...
```

## 🔧 Development Workflow

### First Time Setup
```bash
# Clone repository
git clone <repository-url>
cd arks-rwa

# Make scripts executable (if needed)
chmod +x deploy.sh manage.sh update-env.sh

# Deploy locally
./deploy.sh local
```

### Daily Development
```bash
# Start development environment
./manage.sh dev

# Check status
./manage.sh status

# After making changes, redeploy
./deploy.sh local
```

### Troubleshooting
```bash
# Clean restart everything
./manage.sh clean
./deploy.sh local

# Check logs
./manage.sh logs

# Manual environment sync
./manage.sh update-env
```

## 🌐 Production Deployment

### Prerequisites for IC Deployment
1. **DFX Identity:** Ensure you have a DFX identity with cycles
2. **Cycles:** Ensure sufficient cycles for deployment
3. **Build:** Frontend must be production-ready

### Deployment Steps
```bash
# Build and deploy to IC
./deploy.sh ic

# Check deployment status
./manage.sh status
```

### Post-Deployment
1. **Test functionality** on the provided URLs
2. **Monitor cycles** consumption
3. **Set up monitoring** for production canisters

## 🔍 Environment Variables

### Automatically Managed
- `CANISTER_ID_ARKS_RWA_BACKEND`
- `CANISTER_ID_FRONTEND`
- `CANISTER_ID_INTERNET_IDENTITY`
- `DFX_NETWORK`
- `NEXT_PUBLIC_DFX_NETWORK`

### Manual Configuration (if needed)
Edit `src/frontend/.env.local` for custom settings.

## 🚨 Common Issues

### "Replica not running"
```bash
./manage.sh start
# or
./manage.sh clean
```

### "Frontend not loading"
```bash
# Rebuild frontend
./manage.sh build
./deploy.sh local
```

### "Environment variables not updating"
```bash
./manage.sh update-env
```

### "Canister not found"
```bash
# Redeploy everything
./deploy.sh local
```

## 📊 Access URLs

### Local Development
- **Next.js Dev Server:** http://localhost:3000
- **Frontend Canister:** http://[canister-id].localhost:4943/
- **Backend Candid UI:** http://127.0.0.1:4943/?canisterId=[canister-id]

### Production (IC)
- **Frontend:** https://[canister-id].icp0.io/
- **Backend Candid:** https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=[canister-id]

## 🎯 Best Practices

1. **Always use scripts** instead of manual DFX commands
2. **Test locally** before deploying to IC
3. **Monitor cycles** for production canisters
4. **Keep backups** of important canister states
5. **Use version control** for all configuration changes

## 🆘 Support

If you encounter issues:
1. Check this guide first
2. Run `./manage.sh status` to diagnose
3. Check canister logs with `./manage.sh logs`
4. Try clean restart with `./manage.sh clean`

---

**Happy Deploying! 🚀**