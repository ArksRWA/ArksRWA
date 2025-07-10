'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService, AuthUser } from '../../services/auth';

interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  company: Company;
  amount: number;
  pricePerToken: number;
  totalValue: number;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  txHash?: string;
}

type FilterType = 'all' | 'buy' | 'sell';
type SortOption = 'timestamp' | 'amount' | 'value' | 'company';
type SortDirection = 'asc' | 'desc';

export default function TransactionsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter and sort states
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      if (!user || !user.isConnected) {
        router.push('/');
        return;
      }
      setCurrentUser(user);
      loadTransactionData();
    };
    
    checkAuth();
  }, [router]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [transactions, filterType, sortBy, sortDirection, dateRange, selectedCompany]);

  const loadTransactionData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load companies for reference
      const companiesList = await backendService.listCompanies();
      setCompanies(companiesList);
      
      // Since the backend doesn't have transaction history yet, we'll generate mock data
      // In a real implementation, this would call something like backendService.getTransactionHistory()
      const mockTransactions = await generateMockTransactions(companiesList);
      setTransactions(mockTransactions);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  // Generate mock transaction data for demonstration
  const generateMockTransactions = async (companiesList: Company[]): Promise<Transaction[]> => {
    const mockTransactions: Transaction[] = [];
    
    if (companiesList.length === 0) return mockTransactions;
    
    // Generate some sample transactions
    for (let i = 0; i < 15; i++) {
      const company = companiesList[Math.floor(Math.random() * companiesList.length)];
      const type = Math.random() > 0.5 ? 'buy' : 'sell';
      const amount = Math.floor(Math.random() * 10) + 1;
      const pricePerToken = company.token_price + (Math.random() - 0.5) * 100000;
      const totalValue = amount * pricePerToken;
      const timestamp = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
      
      mockTransactions.push({
        id: `tx_${i}_${Date.now()}`,
        type,
        company,
        amount,
        pricePerToken,
        totalValue,
        timestamp,
        status: Math.random() > 0.9 ? 'failed' : 'completed',
        txHash: `0x${Math.random().toString(16).substr(2, 8)}...`
      });
    }
    
    return mockTransactions.sort((a, b) => b.timestamp - a.timestamp);
  };

  const applyFiltersAndSort = () => {
    let filtered = [...transactions];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(tx => tx.type === filterType);
    }

    // Apply company filter
    if (selectedCompany) {
      filtered = filtered.filter(tx => tx.company.id.toString() === selectedCompany);
    }

    // Apply date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start).getTime();
      filtered = filtered.filter(tx => tx.timestamp >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end).getTime() + 24 * 60 * 60 * 1000; // End of day
      filtered = filtered.filter(tx => tx.timestamp <= endDate);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (sortBy === 'company') {
        aValue = a.company.name.toLowerCase();
        bValue = b.company.name.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredTransactions(filtered);
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };

  const resetFilters = () => {
    setFilterType('all');
    setSelectedCompany('');
    setDateRange({ start: '', end: '' });
    setSortBy('timestamp');
    setSortDirection('desc');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-900/20 border-green-500/30';
      case 'pending': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
      case 'failed': return 'text-red-400 bg-red-900/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Dashboard
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
          <h1 className="text-4xl font-bold text-white mb-2">Transaction History</h1>
          <p className="text-gray-400">Track your trading activity and performance</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total Transactions</h3>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">{transactions.length}</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Buy Orders</h3>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">
              {transactions.filter(tx => tx.type === 'buy').length}
            </div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Sell Orders</h3>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">
              {transactions.filter(tx => tx.type === 'sell').length}
            </div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total Volume</h3>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">
              {transactions.reduce((sum, tx) => sum + tx.totalValue, 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Transaction Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="buy">Buy Orders</option>
                <option value="sell">Sell Orders</option>
              </select>
            </div>

            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id.toString()}>
                    {company.name} ({company.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="timestamp">Date</option>
                <option value="company">Company</option>
                <option value="amount">Amount</option>
                <option value="value">Value</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {filteredTransactions.length} of {transactions.length} transactions
            </span>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-card-bg border border-gray-700 rounded-lg overflow-hidden">
          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">
                      <button
                        onClick={() => handleSort('timestamp')}
                        className="flex items-center gap-2 hover:text-white"
                      >
                        Date
                        {sortBy === 'timestamp' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Type</th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">
                      <button
                        onClick={() => handleSort('company')}
                        className="flex items-center gap-2 hover:text-white"
                      >
                        Company
                        {sortBy === 'company' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-300 font-medium">
                      <button
                        onClick={() => handleSort('amount')}
                        className="flex items-center gap-2 hover:text-white ml-auto"
                      >
                        Amount
                        {sortBy === 'amount' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-300 font-medium">Price</th>
                    <th className="text-right py-4 px-6 text-gray-300 font-medium">
                      <button
                        onClick={() => handleSort('value')}
                        className="flex items-center gap-2 hover:text-white ml-auto"
                      >
                        Total Value
                        {sortBy === 'value' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-300 font-medium">Status</th>
                    <th className="text-right py-4 px-6 text-gray-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-gray-700 hover:bg-gray-800/50">
                      <td className="py-4 px-6 text-gray-300">{formatDate(transaction.timestamp)}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.type === 'buy' 
                            ? 'bg-green-900/20 text-green-400' 
                            : 'bg-red-900/20 text-red-400'
                        }`}>
                          {transaction.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {transaction.company.logo_url ? (
                            <img 
                              src={transaction.company.logo_url} 
                              alt={transaction.company.name}
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">{transaction.company.symbol[0]}</span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white">{transaction.company.name}</div>
                            <div className="text-sm text-gray-400">{transaction.company.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right text-white">{transaction.amount}</td>
                      <td className="py-4 px-6 text-right text-white">{transaction.pricePerToken.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right text-white">{transaction.totalValue.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
                          {transaction.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => router.push(`/company/${transaction.company.id}`)}
                          className="text-primary hover:text-primary/80 transition-colors text-sm"
                        >
                          View Company
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">No transactions found</div>
              <button
                onClick={() => router.push('/companies')}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Start Trading
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}