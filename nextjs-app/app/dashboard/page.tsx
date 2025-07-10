'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService, AuthUser } from '../../services/auth';

interface UserHolding {
  company: Company;
  amount: number;
  currentValue: number;
  investmentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Portfolio stats
  const [totalValue, setTotalValue] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalProfitLoss, setTotalProfitLoss] = useState(0);
  const [totalProfitLossPercent, setTotalProfitLossPercent] = useState(0);

  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      if (!user || !user.isConnected) {
        router.push('/');
        return;
      }
      setCurrentUser(user);
      loadDashboardData();
    };
    
    checkAuth();
  }, [router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load all companies first
      const companiesList = await backendService.listCompanies();
      setCompanies(companiesList);
      
      // Load user holdings for each company
      const holdingsPromises = companiesList.map(async (company) => {
        const amount = await backendService.getUserHoldings(company.id);
        if (amount > 0) {
          const currentValue = amount * company.token_price;
          // For demo purposes, assume invested at base price
          const investmentValue = amount * company.base_price;
          const profitLoss = currentValue - investmentValue;
          const profitLossPercent = investmentValue > 0 ? (profitLoss / investmentValue) * 100 : 0;
          
          return {
            company,
            amount,
            currentValue,
            investmentValue,
            profitLoss,
            profitLossPercent
          };
        }
        return null;
      });
      
      const holdingsResults = await Promise.all(holdingsPromises);
      const validHoldings = holdingsResults.filter(h => h !== null) as UserHolding[];
      setHoldings(validHoldings);
      
      // Calculate portfolio totals
      const totalVal = validHoldings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalInv = validHoldings.reduce((sum, h) => sum + h.investmentValue, 0);
      const totalPL = validHoldings.reduce((sum, h) => sum + h.profitLoss, 0);
      const totalPLPercent = totalInv > 0 ? (totalPL / totalInv) * 100 : 0;
      
      setTotalValue(totalVal);
      setTotalInvested(totalInv);
      setTotalProfitLoss(totalPL);
      setTotalProfitLossPercent(totalPLPercent);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading dashboard...</div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Welcome back, {currentUser?.principal.slice(0, 10)}...</p>
        </div>

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total Portfolio Value</h3>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">{totalValue.toLocaleString()}</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total Invested</h3>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">{totalInvested.toLocaleString()}</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total P&L</h3>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className={`text-2xl font-bold ${totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfitLoss >= 0 ? '+' : ''}{totalProfitLoss.toLocaleString()}
            </div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total P&L %</h3>
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className={`text-2xl font-bold ${totalProfitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfitLossPercent >= 0 ? '+' : ''}{totalProfitLossPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Your Holdings</h2>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/transfer')}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Transfer
              </button>
              <button
                onClick={() => router.push('/transactions')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Transactions
              </button>
            </div>
          </div>
          
          {holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Company</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Holdings</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Price</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Value</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Invested</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">P&L</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">P&L %</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => (
                    <tr key={holding.company.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {holding.company.logo_url ? (
                            <img 
                              src={holding.company.logo_url} 
                              alt={holding.company.name}
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">{holding.company.symbol[0]}</span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white">{holding.company.name}</div>
                            <div className="text-sm text-gray-400">{holding.company.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-white">{holding.amount}</td>
                      <td className="py-4 px-4 text-right text-white">{holding.company.token_price.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-white">{holding.currentValue.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-gray-400">{holding.investmentValue.toLocaleString()}</td>
                      <td className={`py-4 px-4 text-right ${holding.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {holding.profitLoss >= 0 ? '+' : ''}{holding.profitLoss.toLocaleString()}
                      </td>
                      <td className={`py-4 px-4 text-right ${holding.profitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {holding.profitLossPercent >= 0 ? '+' : ''}{holding.profitLossPercent.toFixed(2)}%
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => router.push(`/transfer?company=${holding.company.id}`)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                          >
                            Transfer
                          </button>
                          <button
                            onClick={() => router.push(`/company/${holding.company.id}`)}
                            className="px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-xs"
                          >
                            Trade
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">You don't have any holdings yet</div>
              <button
                onClick={() => router.push('/companies')}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Browse Companies
              </button>
            </div>
          )}
        </div>

        {/* Market Overview */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Market Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.slice(0, 6).map((company) => (
              <div
                key={company.id}
                className="bg-gray-800 border border-gray-600 rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/company/${company.id}`)}
              >
                <div className="flex items-center gap-3 mb-3">
                  {company.logo_url ? (
                    <img 
                      src={company.logo_url} 
                      alt={company.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{company.symbol[0]}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-white">{company.name}</h3>
                    <p className="text-sm text-gray-400">{company.symbol}</p>
                  </div>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price:</span>
                    <span className="text-white">{company.token_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Available:</span>
                    <span className="text-white">{company.remaining}/{company.supply}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/companies')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              View All Companies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}