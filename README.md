# ARKS RWA - Real World Assets Tokenization Platform

A decentralized platform for tokenizing Real World Assets (RWA) on the Internet Computer, built with Motoko backend and Next.js frontend.

## 🚀 Project Overview

ARKS RWA enables users to create, trade, and manage tokenized companies with full transparency and security. The platform implements ICRC-1 token standards and provides seamless wallet integration for a complete DeFi experience.

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

## 🛠️ Installation & Setup

### Step 1: Clone the Repository
```bash
git clone <your-repository-url>
cd arks-rwa
```

### Step 2: Install Dependencies

#### Install Frontend Dependencies
```bash
cd src/frontend
npm install
cd ../..
```

### Step 3: Start Local Internet Computer Replica
```bash
# Start the local IC replica in background
dfx start --background

# Verify it's running
dfx ping
```

### Step 4: Deploy Backend Canister
```bash
# Deploy the Motoko canister
dfx deploy arks-rwa-backend

# Verify deployment
dfx canister status arks-rwa-backend
```

### Step 5: Generate TypeScript Declarations
```bash
# Generate TypeScript types from Motoko canister
dfx generate arks-rwa-backend

# Copy declarations to frontend (already configured)
# This step is automatically handled by our setup
```

### Step 6: Start Frontend Development Server
```bash
cd src/frontend
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000 (or 3001 if 3000 is busy)
- **Candid UI**: http://localhost:4943/?canisterId={canister-id}

## 🚀 Running the Application

### Development Mode

1. **Start IC Replica** (if not already running):
   ```bash
   dfx start --background
   ```

2. **Deploy Backend** (if not already deployed):
   ```bash
   dfx deploy arks-rwa-backend
   ```

3. **Start Frontend**:
   ```bash
   cd src/frontend
   npm run dev
   ```

4. **Access Application**:
   - Open http://localhost:3000 in your browser
   - Choose authentication method:
     - **Plug Wallet**: Connect with Plug browser extension
     - **Internet Identity**: Use Internet Identity authentication
     - **Demo Mode**: Test without wallet (limited functionality)

### Production Deployment

1. **Build Frontend**:
   ```bash
   cd src/frontend
   npm run build
   ```

2. **Deploy to IC Mainnet**:
   ```bash
   dfx deploy --network ic
   ```

## 🔧 Configuration

### Environment Variables

The application uses the following configuration:

- **Canister IDs**: Automatically managed by DFX in `.env`
- **Network Configuration**: Set via `DFX_NETWORK` environment variable
- **Frontend Config**: Located in `src/frontend/config/canister.ts`

### Customization

#### Backend Configuration
- **Admin Principal**: Update in `src/arks-rwa-backend/main.mo` line 17
- **Minimum Valuation**: Configurable via `setMinValuationE8s` function
- **Token Standards**: ICRC-1 compliant, extensible for additional standards

#### Frontend Configuration
- **Styling**: Modify `src/frontend/tailwind.config.js`
- **Components**: Located in `src/frontend/app/` directory
- **Services**: API integration in `src/frontend/services/`

## 📁 Project Structure

```
arks-rwa/
├── dfx.json                          # DFX configuration
├── README.md                         # This file
├── src/
│   ├── arks-rwa-backend/
│   │   └── main.mo                   # Motoko canister code
│   ├── frontend/
│   │   ├── app/                      # Next.js app directory
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── globals.css          # Global styles
│   │   │   ├── companies/           # Companies page
│   │   │   ├── dashboard/           # Dashboard page
│   │   │   └── company/[id]/        # Individual company page
│   │   ├── components/              # Reusable components
│   │   ├── services/                # API services
│   │   │   ├── auth.ts             # Authentication service
│   │   │   ├── backend.ts          # Backend integration
│   │   │   └── canister.ts         # Canister communication
│   │   ├── types/                   # TypeScript type definitions
│   │   ├── config/                  # Configuration files
│   │   ├── declarations/            # Generated TypeScript declarations
│   │   ├── package.json            # Frontend dependencies
│   │   └── tailwind.config.js      # Tailwind configuration
│   └── declarations/                # Generated canister declarations
└── .env                             # Environment variables (auto-generated)
```

## 🔍 API Reference

### Backend Canister Methods

#### Company Management
- `createCompany(name, symbol, logo_url, description, valuation, desiredSupply?, desiredPrice?)` - Create new company
- `listCompanies()` - Get all companies
- `getCompanyById(companyId)` - Get specific company details
- `updateCompanyDescription(companyId, newDescription)` - Update company description

#### Token Trading
- `buyTokens(companyId, amount)` - Purchase company tokens
- `sellTokens(companyId, amount)` - Sell company tokens
- `getMyHolding(companyId)` - Get user's token balance
- `listHoldings()` - Get all token holdings

#### ICRC-1 Standard Methods
- `icrc1_balance_of(companyId, account)` - Get token balance
- `icrc1_transfer(companyId, args, caller)` - Transfer tokens
- `icrc1_name(companyId)` - Get token name
- `icrc1_symbol(companyId)` - Get token symbol
- `icrc1_total_supply(companyId)` - Get total token supply
- `icrc1_metadata(companyId)` - Get token metadata

### Frontend Services

#### Authentication (`src/frontend/services/auth.ts`)
- Plug Wallet integration
- Internet Identity support
- Demo mode functionality

#### Backend Integration (`src/frontend/services/backend.ts`)
- Canister method calls
- Error handling
- Type-safe API interactions

## 🧪 Testing

### Backend Testing
```bash
# Test canister methods via Candid UI
dfx canister call arks-rwa-backend listCompanies

# Test company creation
dfx canister call arks-rwa-backend createCompany '("Test Company", "TEST", "logo.png", "Description", 1000000, null, null)'
```

### Frontend Testing
```bash
cd src/frontend
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot find module" errors**:
   ```bash
   # Clear Next.js cache
   cd src/frontend
   rm -rf .next build
   npm run dev
   ```

2. **Canister not found**:
   ```bash
   # Redeploy canister
   dfx deploy arks-rwa-backend
   dfx generate arks-rwa-backend
   ```

3. **Port conflicts**:
   ```bash
   # Check running processes
   lsof -i :3000
   lsof -i :4943
   
   # Kill processes if needed
   kill -9 <PID>
   ```

4. **DFX replica issues**:
   ```bash
   # Stop and restart replica
   dfx stop
   dfx start --clean --background
   ```

### Development Tips

- Always run `dfx generate` after backend changes
- Clear Next.js cache when experiencing import issues
- Use demo mode for testing without wallet setup
- Check browser console for detailed error messages

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
