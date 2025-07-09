'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService } from '../../services/auth';

type SortOption = 'name' | 'symbol' | 'token_price' | 'valuation' | 'remaining' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        router.push('/');
        return;
      }
      loadCompanies();
    };
    
    checkAuth();
  }, [router]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [companies, searchTerm, sortBy, sortDirection, priceRange, availableOnly]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError('');
      const companiesList = await backendService.listCompanies();
      setCompanies(companiesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...companies];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply price range filter
    if (priceRange.min) {
      filtered = filtered.filter(company => company.token_price >= parseInt(priceRange.min));
    }
    if (priceRange.max) {
      filtered = filtered.filter(company => company.token_price <= parseInt(priceRange.max));
    }

    // Apply availability filter
    if (availableOnly) {
      filtered = filtered.filter(company => company.remaining > 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      // Handle string comparisons
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredCompanies(filtered);
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setPriceRange({ min: '', max: '' });
    setAvailableOnly(false);
    setSortBy('name');
    setSortDirection('asc');
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
        <div className="text-white">Loading companies...</div>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>
            <button
              onClick={() => router.push('/create-company')}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Company
            </button>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-2">Companies</h1>
          <p className="text-gray-400">Discover and invest in tokenized companies</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Company name, symbol, or description"
              />
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Min"
                />
                <input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Max"
                />
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="name">Name</option>
                <option value="symbol">Symbol</option>
                <option value="token_price">Token Price</option>
                <option value="valuation">Valuation</option>
                <option value="remaining">Available Tokens</option>
                <option value="created_at">Created Date</option>
              </select>
            </div>

            {/* Sort Direction & Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Options</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white hover:bg-gray-700 transition-colors"
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
                <button
                  onClick={() => setAvailableOnly(!availableOnly)}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                    availableOnly 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-800 border border-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  Available
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {filteredCompanies.length} of {companies.length} companies
            </span>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Companies Grid */}
        {filteredCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="bg-card-bg border border-gray-700 rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => router.push(`/company/${company.id}`)}
              >
                {/* Company Header */}
                <div className="flex items-center gap-3 mb-4">
                  {company.logo_url ? (
                    <img 
                      src={company.logo_url} 
                      alt={company.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">{company.symbol[0]}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                      {company.name}
                    </h3>
                    <p className="text-sm text-gray-400">{company.symbol}</p>
                  </div>
                </div>

                {/* Company Description */}
                <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                  {company.description || 'No description available'}
                </p>

                {/* Company Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Token Price:</span>
                    <span className="text-white font-medium">{company.token_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Available:</span>
                    <span className="text-white font-medium">{company.remaining}/{company.supply}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Valuation:</span>
                    <span className="text-white font-medium">{company.valuation.toLocaleString()}</span>
                  </div>
                </div>

                {/* Availability Status */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    company.remaining > 0 
                      ? 'bg-green-900/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-900/20 text-red-400 border border-red-500/30'
                  }`}>
                    {company.remaining > 0 ? 'Available' : 'Sold Out'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(company.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">No companies found matching your criteria</div>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}