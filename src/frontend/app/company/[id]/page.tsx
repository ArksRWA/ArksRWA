'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { backendService, Company } from '../../../services/backend';
import { authService } from '../../../services/auth';
import { getCanisterId, isLocal, shouldUseRealWallet } from '../../../config/canister';

// Plug wallet interface for transfers
interface PlugWallet {
  requestConnect: (options?: any) => Promise<any>;
  agent: any;
  principal: any;
  accountId: string;
  requestTransfer: (args: any) => Promise<any>;
  createActor: (canisterId: string, interfaceFactory: any) => Promise<any>;
}

export default function CompanyDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userHoldings, setUserHoldings] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Trading states
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');
  const [tokenCostICP, setTokenCostICP] = useState(0);
  const [tokenSaleValueICP, setTokenSaleValueICP] = useState(0);

  // Get backend canister principal from configuration
  const BACKEND_CANISTER_PRINCIPAL = getCanisterId('arks_rwa_backend');

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        router.push('/');
        return;
      }
      loadCompanyData();
    };
    
    checkAuth();
  }, [router, companyId]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [companyData, holdings] = await Promise.all([
        backendService.getCompanyById(parseInt(companyId)),
        backendService.getUserHoldings(parseInt(companyId))
      ]);
      
      if (!companyData) {
        throw new Error('Company not found');
      }
      
      setCompany(companyData);
      setUserHoldings(holdings);
      
      // Check if current user is the owner
      const user = authService.getCurrentUser();
      setCurrentUser(user);
      if (user && user.principal === companyData.owner) {
        setIsOwner(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate costs when trade amount changes
  useEffect(() => {
    if (company && tradeAmount && parseInt(tradeAmount) > 0) {
      calculateTradeCosts();
    } else {
      setTokenCostICP(0);
      setTokenSaleValueICP(0);
    }
  }, [company, tradeAmount, tradeType]);

  const calculateTradeCosts = async () => {
    if (!company || !tradeAmount) return;
    
    try {
      const amount = parseInt(tradeAmount);
      if (isNaN(amount) || amount <= 0) return;
      
      if (tradeType === 'buy') {
        const cost = await backendService.getTokenCostInICP(company.id, amount);
        setTokenCostICP(cost);
      } else {
        const saleValue = await backendService.getTokenSaleValue(company.id, amount);
        setTokenSaleValueICP(saleValue);
      }
    } catch (error) {
      console.error('Error calculating trade costs:', error);
    }
  };

  const handleTrade = async () => {
    if (!company || !tradeAmount) return;
    
    setTradeLoading(true);
    setTradeError('');
    setTradeSuccess('');
    
    try {
      const amount = parseInt(tradeAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }
      
      if (tradeType === 'buy') {
        await handleBuyWithICP(amount);
      } else {
        await handleSellForICP(amount);
      }
      
      setTradeAmount('');
    } catch (err) {
      setTradeLoading(false);
      setTradeError(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setTradeLoading(false);
    }
  };

  const handleBuyWithICP = async (amount: number) => {
    if (!company || !currentUser) {
      throw new Error('Missing required data');
    }

    // Check basic validations
    const totalCost = amount * Number(company.token_price);
    if (totalCost < company.minimum_purchase) {
      throw new Error(`Minimum purchase is ${company.minimum_purchase.toLocaleString()}`);
    }
    if (amount > company.remaining) {
      throw new Error('Not enough tokens available');
    }

    // Check if user is in demo mode OR if real wallet is disabled
    if (currentUser.walletType === 'demo' || !shouldUseRealWallet()) {
      if (!shouldUseRealWallet() && currentUser.walletType !== 'demo') {
        setTradeSuccess('Local development detected - using demo mode for transaction...');
      }
      
      const result = await backendService.buyTokensWithICP(parseInt(companyId), amount, 0); // 0 block index for demo
      setTradeSuccess(result);
      await loadCompanyData();
      return;
    }

    // Real ICP payment flow (only available on mainnet)
    if (!window.ic?.plug) {
      throw new Error('Plug wallet not detected. Please install Plug wallet or use demo mode.');
    }

    setTradeSuccess('Initiating ICP payment...');

    try {
      // Step 1: Calculate the exact cost including platform fees
      const totalCostE8s = await backendService.getTokenCostInICP(company.id, amount);
      const totalCostICP = totalCostE8s / 100_000_000; // Convert e8s to ICP

      setTradeSuccess(`Requesting payment of ${totalCostICP.toFixed(8)} ICP...`);

      // Step 2: Request ICP transfer through Plug wallet
      const transferArgs = {
        to: BACKEND_CANISTER_PRINCIPAL, // Your backend canister receives the payment
        amount: totalCostE8s, // Amount in e8s
        fee: 10000, // Standard ICP fee (0.0001 ICP)
        memo: new TextEncoder().encode(`Token purchase: Company ${company.id}, Amount ${amount}`)
      };

      // Use Plug's requestTransfer method
      const plug = window.ic.plug as PlugWallet;
      const transferResult = await plug.requestTransfer(transferArgs);
      
      if (transferResult.height) {
        setTradeSuccess('Payment successful! Processing token purchase...');
        
        // Step 3: Call your backend with the payment proof
        const blockIndex = Number(transferResult.height);
        const purchaseResult = await backendService.buyTokensWithICP(
          company.id,
          amount,
          blockIndex
        );
        
        setTradeSuccess(`Success! ${purchaseResult}`);
        
        // Refresh company data to show updated token count
        await loadCompanyData();
        
      } else {
        throw new Error('Payment failed or was cancelled');
      }
    } catch (error) {
      // Handle ICP ledger connectivity issues
      if (error instanceof Error && error.message.includes('Canister') && error.message.includes('not found')) {
        throw new Error('ICP ledger not available. Real ICP transactions require mainnet deployment. Using demo mode instead...');
      }
      throw error;
    }
  };

  const handleSellForICP = async (amount: number) => {
    if (!company || !currentUser) {
      throw new Error('Missing required data');
    }

    // Check if user has enough tokens
    if (amount > userHoldings) {
      throw new Error('Not enough tokens to sell');
    }

    // Check if user is in demo mode OR if real wallet is disabled
    if (currentUser.walletType === 'demo' || !shouldUseRealWallet()) {
      if (!shouldUseRealWallet() && currentUser.walletType !== 'demo') {
        setTradeSuccess('Local development detected - using demo mode for transaction...');
      }
      
      const result = await backendService.sellTokensForICP(parseInt(companyId), amount); // Demo mode
      setTradeSuccess(result);
      await loadCompanyData();
      return;
    }

    // Real ICP sale flow (only available on mainnet)
    setTradeSuccess('Processing token sale...');

    try {
      // Step 1: Get the sale value
      const saleValueE8s = await backendService.getTokenSaleValue(company.id, amount);
      const saleValueICP = saleValueE8s / 100_000_000;

      setTradeSuccess(`Selling ${amount} tokens for ${saleValueICP.toFixed(8)} ICP...`);

      // Step 2: Execute the sale (this would trigger ICP transfer to user in a real implementation)
      const saleResult = await backendService.sellTokensForICP(company.id, amount);
      
      setTradeSuccess(`Success! ${saleResult}`);
      
      // Note: In a real implementation, your backend would need to:
      // 1. Verify the user owns the tokens
      // 2. Transfer ICP from the platform's account to the user's account
      // 3. Update the token holdings
      
      // Refresh company data
      await loadCompanyData();
    } catch (error) {
      // Handle ICP ledger connectivity issues
      if (error instanceof Error && error.message.includes('Canister') && error.message.includes('not found')) {
        throw new Error('ICP ledger not available. Real ICP transactions require mainnet deployment. Using demo mode instead...');
      }
      throw error;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Checking authentication...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading company details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white mb-4">Company not found</div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {isOwner && (
            <div className="flex justify-end">
              <button
                onClick={() => router.push(`/manage-company/${companyId}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Manage Company
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-6">
                {company.logo_url ? (
                  <img 
                    src={company.logo_url} 
                    alt={company.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">{company.symbol[0]}</span>
                  </div>
                )}
                
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{company.name}</h1>
                  <p className="text-xl text-gray-300 mb-4">{company.symbol}</p>
                  <p className="text-gray-400">{company.description}</p>
                </div>
              </div>
            </div>

            {/* Company Stats */}
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Company Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{company.valuation.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Valuation</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{Number(company.token_price).toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Token Price</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{company.supply}</div>
                  <div className="text-sm text-gray-400">Total Supply</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{company.remaining}</div>
                  <div className="text-sm text-gray-400">Available</div>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Panel */}
          <div className="space-y-6">
            {/* User Holdings */}
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Holdings</h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{userHoldings}</div>
                <div className="text-sm text-gray-400">Tokens</div>
                <div className="text-sm text-gray-500 mt-1">
                  Value: {(Number(userHoldings) * Number(company.token_price)).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Trading Interface */}
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Trade Tokens</h3>
              
              {/* Trade Type Toggle */}
              <div className="flex mb-4">
                <button
                  onClick={() => setTradeType('buy')}
                  className={`flex-1 py-2 px-4 rounded-l-lg transition-colors ${
                    tradeType === 'buy' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTradeType('sell')}
                  className={`flex-1 py-2 px-4 rounded-r-lg transition-colors ${
                    tradeType === 'sell' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter amount"
                  min="1"
                />
              </div>

              {/* Trade Info */}
              {tradeAmount && (
                <div className="mb-4 p-3 bg-gray-800 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price per token:</span>
                    <span className="text-white">{Number(company.token_price).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total {tradeType === 'buy' ? 'cost' : 'value'}:</span>
                    <span className="text-white">
                      {(parseInt(tradeAmount || '0') * Number(company.token_price)).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* ICP Cost/Value Display */}
                  {currentUser && currentUser.walletType !== 'demo' && shouldUseRealWallet() && (
                    <>
                      {tradeType === 'buy' && tokenCostICP > 0 && (
                        <div className="flex justify-between border-t border-gray-600 pt-2">
                          <span className="text-gray-400">ICP Cost:</span>
                          <span className="text-primary font-medium">
                            {(tokenCostICP / 100_000_000).toFixed(8)} ICP
                          </span>
                        </div>
                      )}
                      {tradeType === 'sell' && tokenSaleValueICP > 0 && (
                        <div className="flex justify-between border-t border-gray-600 pt-2">
                          <span className="text-gray-400">ICP Payout:</span>
                          <span className="text-green-400 font-medium">
                            {(tokenSaleValueICP / 100_000_000).toFixed(8)} ICP
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Wallet Type Indicator */}
                  {currentUser && (
                    <div className="flex justify-between border-t border-gray-600 pt-2">
                      <span className="text-gray-400">Payment Method:</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        currentUser.walletType === 'demo' || !shouldUseRealWallet()
                          ? 'bg-yellow-900/20 text-yellow-400'
                          : 'bg-green-900/20 text-green-400'
                      }`}>
                        {currentUser.walletType === 'demo' || !shouldUseRealWallet() ? 'Demo Mode' : 'Real ICP'}
                      </span>
                    </div>
                  )}
                  
                  {/* Local Development Notice */}
                  {!shouldUseRealWallet() && currentUser.walletType !== 'demo' && (
                    <div className="text-xs text-yellow-400 bg-yellow-900/10 p-2 rounded border border-yellow-500/20">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Local Development: Real ICP transactions disabled
                        <div className="text-xs text-gray-500 mt-1">
                          Set FORCE_REAL_WALLET=true in config to enable real wallet
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Success/Error Messages */}
              {tradeSuccess && (
                <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded-lg">
                  <p className="text-green-400 text-sm">{tradeSuccess}</p>
                </div>
              )}
              
              {tradeError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
                  <p className="text-red-400 text-sm">{tradeError}</p>
                </div>
              )}

              {/* Trade Button */}
              <button
                onClick={handleTrade}
                disabled={tradeLoading || !tradeAmount}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  tradeType === 'buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tradeLoading ? 'Processing...' : `${tradeType === 'buy' ? 'Buy' : 'Sell'} Tokens`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}