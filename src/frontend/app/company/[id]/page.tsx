'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { backendService, Company } from '../../../services/backend';
import { authService } from '../../../services/auth';

export default function CompanyDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userHoldings, setUserHoldings] = useState(0);
  
  // Trading states
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company data');
    } finally {
      setLoading(false);
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
        const totalCost = amount * company.token_price;
        if (totalCost < company.minimum_purchase) {
          throw new Error(`Minimum purchase is ${company.minimum_purchase.toLocaleString()}`);
        }
        if (amount > company.remaining) {
          throw new Error('Not enough tokens available');
        }
        
        const result = await backendService.buyTokens(parseInt(companyId), amount);
        setTradeSuccess(result);
        
        // Reload company data to get updated prices and holdings
        await loadCompanyData();
        
      } else {
        // Sell tokens
        if (amount > userHoldings) {
          throw new Error('Not enough tokens to sell');
        }
        
        const result = await backendService.sellTokens(parseInt(companyId), amount);
        setTradeSuccess(result);
        
        // Reload company data to get updated prices and holdings
        await loadCompanyData();
      }
      
      setTradeAmount('');
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setTradeLoading(false);
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
                  <div className="text-2xl font-bold text-primary">{company.token_price.toLocaleString()}</div>
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
                  Value: {(userHoldings * company.token_price).toLocaleString()}
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
                <div className="mb-4 p-3 bg-gray-800 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price per token:</span>
                    <span className="text-white">{company.token_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total {tradeType === 'buy' ? 'cost' : 'value'}:</span>
                    <span className="text-white">
                      {(parseInt(tradeAmount || '0') * company.token_price).toLocaleString()}
                    </span>
                  </div>
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