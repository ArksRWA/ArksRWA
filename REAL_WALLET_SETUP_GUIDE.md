# Real Wallet Setup Guide

This guide explains how to switch from Demo Mode to using a real Plug wallet for actual ICP transactions.

## Quick Start: Switch to Real Wallet

### Method 1: Homepage Connection (Recommended)
1. Navigate to `http://localhost:3000`
2. Click **"Plug Wallet"** button
3. Install Plug wallet if prompted: [plugwallet.ooo](https://plugwallet.ooo)
4. Authorize the connection in Plug wallet
5. You'll be redirected to the dashboard with real wallet connected

### Method 2: Connect Wallet Button
- If already in the app, click the **"Connect Wallet"** button in the top-right corner
- Choose "Plug Wallet" to connect your real wallet

### Method 3: Avoid Demo Route
- Don't use `/demo` route - this forces demo mode
- Use the main homepage for wallet connections

## Enable Real Wallet in Local Development

By default, the app uses demo mode in local development to prevent ICP ledger errors. To enable real Plug wallet:

### Option 1: Configuration Flag (Recommended)
Edit [`src/frontend/config/canister.ts`](src/frontend/config/canister.ts):

```typescript
// Change this line from false to true
export const FORCE_REAL_WALLET = true;
```

### Option 2: Environment Variable
Set environment variable:
```bash
export NEXT_PUBLIC_FORCE_REAL_WALLET=true
```

## Prerequisites for Real Wallet

### 1. Install Plug Wallet
- Download from [plugwallet.ooo](https://plugwallet.ooo)
- Create or import your wallet
- Ensure you have some ICP for transactions

### 2. Network Configuration
- **Local Development**: Uses local canister network
- **Production**: Uses Internet Computer mainnet
- Real ICP transactions require mainnet deployment

### 3. ICP Balance
- You need ICP in your Plug wallet for real transactions
- Minimum amount depends on token prices and platform fees
- Platform charges 1% fee on transactions

## Wallet Connection Process

### 1. Plug Wallet Detection
```typescript
// App checks for Plug wallet availability
if (!window.ic?.plug) {
  throw new Error("Plug wallet not detected");
}
```

### 2. Authorization Request
- Plug wallet will request permission to connect
- App requests access to your principal and agent
- You must approve the connection

### 3. Canister Whitelist
- App automatically whitelists required canisters
- Includes backend canister for token operations
- ICP ledger canister for payments

## Real vs Demo Mode Differences

| Feature | Demo Mode | Real Wallet Mode |
|---------|-----------|------------------|
| **Transactions** | Simulated | Real ICP blockchain |
| **Costs** | Free | Actual ICP costs + fees |
| **Wallet Required** | No | Yes (Plug wallet) |
| **Persistence** | Session only | Permanent on blockchain |
| **Token Ownership** | Simulated | Real ICRC-1 tokens |
| **Transfers** | Demo only | Real ICP transfers |

## Visual Indicators

### Demo Mode Indicators
- 🟡 **Yellow badge**: "Demo Mode"
- ⚠️ **Warning message**: "Demo mode - Connect a real wallet for actual ICP transactions"
- 🔧 **Local dev notice**: "Local development - Real ICP transactions disabled"

### Real Wallet Indicators
- 🔵 **Blue badge**: "Plug Wallet" 
- 🟢 **Green dot**: "Live" status
- 💰 **ICP costs**: Real ICP amounts displayed

## Troubleshooting

### "Plug wallet not detected"
- Install Plug wallet extension
- Refresh the page after installation
- Check browser compatibility

### "Canister not found" errors
- This happens in local development with real wallet
- Set `FORCE_REAL_WALLET = true` to override
- Or deploy to mainnet for full functionality

### Connection fails
- Check Plug wallet is unlocked
- Ensure you're on the correct network
- Try disconnecting and reconnecting

### No ICP balance
- Transfer ICP to your Plug wallet
- Check you're on the correct network (local vs mainnet)
- Verify wallet address

## Production Deployment

For full real wallet functionality:

1. **Deploy to Internet Computer mainnet**
2. **Update canister IDs** in configuration
3. **Set network to "ic"** in environment
4. **Test with small amounts** first

## Security Notes

- ✅ **Never share** your wallet seed phrase
- ✅ **Verify transaction details** before confirming
- ✅ **Start with small amounts** for testing
- ✅ **Keep wallet software updated**
- ⚠️ **Local development** uses test networks only

## Support

If you encounter issues:
1. Check browser console for error messages
2. Verify Plug wallet is properly installed and unlocked
3. Ensure sufficient ICP balance for transactions
4. Try refreshing the page and reconnecting

For production use, deploy to Internet Computer mainnet for full real wallet functionality.