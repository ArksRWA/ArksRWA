'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService, AuthUser } from '../../services/auth';
import HoldingsTable from '../components/HoldingsTable';
import StatusBadge, { getCompanyRiskStatus } from '../components/StatusBadge';

interface UserHolding {
  company: Company;
  amount: bigint;
  currentValue: bigint;
  investmentValue: bigint;
  profitLoss: bigint;
  profitLossPercent: bigint;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Portfolio stats
  const [totalValue, setTotalValue] = useState(BigInt(0));
  const [totalInvested, setTotalInvested] = useState(BigInt(0));
  const [totalProfitLoss, setTotalProfitLoss] = useState(BigInt(0));
  const [totalProfitLossPercent, setTotalProfitLossPercent] = useState(BigInt(0));

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
          const profitLossPercent = investmentValue > 0 ? (profitLoss / investmentValue) * BigInt(100) : BigInt(0);

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
      const totalVal = validHoldings.reduce((sum, h) => sum + h.currentValue, BigInt(0));
      const totalInv = validHoldings.reduce((sum, h) => sum + h.investmentValue, BigInt(0));
      const totalPL = validHoldings.reduce((sum, h) => sum + h.profitLoss, BigInt(0));
      const totalPLPercent = totalInv > 0 ? (totalPL / totalInv) * BigInt(100) : BigInt(0);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-600 tracking-wider">Portfolio</h2>
              <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="text-3xl font-black text-white">{Number(totalValue).toLocaleString()}</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-600 tracking-wider">Invested</h2>
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-3xl font-black text-white">{Number(totalInvested).toLocaleString()}</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">P&L</h2>
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className={`text-2xl font-black ${Number(totalProfitLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(totalProfitLoss) >= 0 ? '+' : ''}{Number(totalProfitLoss).toLocaleString()}
              </div>
              <div className={`text-2xl font-bold ${Number(totalProfitLossPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(totalProfitLossPercent) >= 0 ? '+' : ''}{Number(totalProfitLossPercent).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <HoldingsTable holdings={holdings} />

        {/* Market Overview */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
          <h2 className="text-xs font-semibold text-white mb-6">Market Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.slice(0, 6).map((company) => (
              <div
                key={company.id}
                className="bg-gray-800 border border-gray-600 rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/company?id=${company.id}`)}
              >

                <div className="flex items-center gap-3 flex-1">
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

                  <div className="flex-1">
                    {/* Name + Badge in the same row */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white">{company.name}</h3>
                      <StatusBadge status={getCompanyRiskStatus(company)} size="small" />
                    </div>

                    {/* Symbol goes below */}
                    <p className="text-sm text-gray-400">{company.symbol}</p>
                  </div>
                </div>





                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price:</span>
                    <span className="text-white">{Number(company.token_price).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Available:</span>
                    <span className="text-white">{Number(company.remaining)}/{Number(company.supply)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/companies')}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              View All Companies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}