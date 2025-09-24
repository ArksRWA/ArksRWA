# ARKS RWA - Real World Assets Tokenization Platform

A decentralized platform for tokenizing Real World Assets (RWA) on the Internet Computer, built with Motoko backend and Next.js frontend.

## 🚀 Project Overview

ARKS RWA enables users to create, trade, and manage tokenized companies with full transparency and security. The platform implements ICRC-1 token standards and provides seamless wallet integration for a complete DeFi experience.

## Mainnet URLs
Deployed canisters.
   - Frontend canister via browser:
      - frontend: https://2nyem-kaaaa-aaaad-qhpna-cai.icp0.io/
   - Backend canister via Candid interface:
      - arks-core: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=3jvl6-taaaa-aaaad-qhpla-cai
      - arks-identity: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=3ounk-6yaaa-aaaad-qhplq-cai
      - arks-risk-engine: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=2d2je-rqaaa-aaaad-qhpma-cai
      - arks-token-factory: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=2e3pq-4iaaa-aaaad-qhpmq-cai

### Key Features

- **Company Tokenization**: Create and tokenize companies with customizable parameters
- **Dynamic Pricing**: Token prices adjust based on supply and demand
- **ICRC-1 Compliance**: Full compatibility with Internet Computer token standards
- **Multi-Wallet Support**: Integration with Plug Wallet and Internet Identity
- **Real-time Trading**: Buy and sell company tokens with instant price updates
- **Portfolio Management**: Track holdings and manage investments
- **Demo Mode**: Test functionality without wallet connection

## 🏗️ Architecture

### Backend (Motoko Canister)
- **Location**: `src/arks-rwa-backend/main.mo`
- **Features**: Company management, token trading, ICRC-1 implementation
- **Standards**: ICRC-1 token standard compliance
- **Security**: Principal-based authentication and authorization

### Frontend (Next.js)
- **Location**: `src/frontend/`
- **Framework**: Next.js 15.3.4 with TypeScript
- **Styling**: Tailwind CSS 4.0
- **Authentication**: Internet Identity and Plug Wallet integration
- **State Management**: React hooks with IC agent integration

## 📋 Prerequisites

Before running this project, ensure you have the following installed:

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version
   npm --version
   ```

2. **DFX (DFINITY SDK)**
   ```bash
   # Install DFX
   sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
   
   # Check version
   dfx --version
   ```

3. **Git**
   ```bash
   # Check version
   git --version
   ```


## 🚀 Running the Application

### Development Mode
Run this commands
```bash
chmod +x rundev.sh
./rundev.sh
```
The application will be available at:
- **Frontend**: http://localhost:3000 
- **AI Engine**: http://localhost:3001
- **Candid UI**: http://localhost:4943/?canisterId={canister-id}


## 📚 Additional Resources

- [Internet Computer Documentation](https://internetcomputer.org/docs)
- [Motoko Programming Language](https://internetcomputer.org/docs/current/motoko/main/motoko)
- [ICRC-1 Token Standard](https://github.com/dfinity/ICRC-1)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Live Demo**: [Coming Soon]
- **Documentation**: [Project Wiki]
- **Support**: [Issues Page]

---

## 📝 Development Summary

### What We Accomplished

This project successfully bridges a Next.js frontend with a Motoko canister backend on the Internet Computer. Here's what was implemented:

#### 🔧 Technical Integration
1. **Generated TypeScript Declarations**: Created proper type definitions from Motoko canister using `dfx generate`
2. **Resolved Import Path Issues**: Fixed module resolution by copying declarations locally and updating all import paths
3. **Created Missing Core Files**: Implemented landing page, layout, global styles, and Tailwind configuration
4. **Enhanced Service Layer**: Updated authentication, backend integration, and canister communication services

#### 🎯 Key Features Implemented
- **Multi-Wallet Authentication**: Plug Wallet, Internet Identity, and Demo mode support
- **Company Tokenization**: Full ICRC-1 compliant token creation and management
- **Dynamic Trading**: Real-time token buying/selling with price adjustments
- **Portfolio Management**: User holdings tracking and management
- **Responsive UI**: Modern, mobile-friendly interface with Tailwind CSS

#### ✅ Verified Functionality
- All pages load without import errors
- Authentication flows work correctly
- Backend service integration is operational
- Navigation and routing function properly
- Demo mode provides wallet-free testing

The platform is now fully functional and ready for Real World Assets tokenization on the Internet Computer.
