'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService } from '../../services/backend';
import { authService } from '../../services/auth';

export default function CreateCompanyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    logoUrl: '',
    description: '',
    valuation: '',
    supplyType: 'auto', // 'auto', 'supply', 'price'
    desiredSupply: '',
    desiredPrice: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        router.push('/');
      }
    };
    
    checkAuth();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { name, symbol, logoUrl, description, valuation, supplyType, desiredSupply, desiredPrice } = formData;
      
      if (!name || !symbol || !valuation) {
        throw new Error('Please fill in all required fields');
      }

      const valuationNum = parseInt(valuation);
      if (isNaN(valuationNum) || valuationNum < 10_000_000) {
        throw new Error('Valuation must be at least 10,000,000');
      }

      if (symbol.length < 3 || symbol.length > 5) {
        throw new Error('Symbol must be 3-5 characters');
      }

      let supply: number | undefined = undefined;
      let price: number | undefined = undefined;

      if (supplyType === 'supply' && desiredSupply) {
        supply = parseInt(desiredSupply);
        if (isNaN(supply) || supply <= 0) {
          throw new Error('Supply must be a positive number');
        }
      } else if (supplyType === 'price' && desiredPrice) {
        price = parseInt(desiredPrice);
        if (isNaN(price) || price <= 0) {
          throw new Error('Price must be a positive number');
        }
      }

      const companyId = await backendService.createCompany({
        name,
        symbol: symbol.toUpperCase(),
        logoUrl,
        description,
        valuation: valuationNum,
        desiredSupply: supply,
        desiredPrice: price
      });

      console.log('Company created successfully with ID:', companyId);
      router.push('/');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card-bg border border-gray-700 rounded-lg shadow-2xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Company</h1>
            <p className="text-gray-400">Launch your company on the ARKS RWA platform</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter company name"
                  required
                />
              </div>

              <div>
                <label htmlFor="symbol" className="block text-sm font-medium text-gray-300 mb-2">
                  Symbol *
                </label>
                <input
                  type="text"
                  id="symbol"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
                  placeholder="ABC"
                  maxLength={5}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">3-5 characters</p>
              </div>
            </div>

            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-300 mb-2">
                Logo URL
              </label>
              <input
                type="url"
                id="logoUrl"
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Describe your company..."
              />
            </div>

            <div>
              <label htmlFor="valuation" className="block text-sm font-medium text-gray-300 mb-2">
                Valuation *
              </label>
              <input
                type="number"
                id="valuation"
                name="valuation"
                value={formData.valuation}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="10000000"
                min="10000000"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum: 10,000,000</p>
            </div>

            <div>
              <label htmlFor="supplyType" className="block text-sm font-medium text-gray-300 mb-2">
                Token Configuration
              </label>
              <select
                id="supplyType"
                name="supplyType"
                value={formData.supplyType}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="auto">Auto (Default: 1,000,000 per token)</option>
                <option value="supply">Set Total Supply</option>
                <option value="price">Set Token Price</option>
              </select>
            </div>

            {formData.supplyType === 'supply' && (
              <div>
                <label htmlFor="desiredSupply" className="block text-sm font-medium text-gray-300 mb-2">
                  Total Supply
                </label>
                <input
                  type="number"
                  id="desiredSupply"
                  name="desiredSupply"
                  value={formData.desiredSupply}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="1000000"
                  min="1"
                />
              </div>
            )}

            {formData.supplyType === 'price' && (
              <div>
                <label htmlFor="desiredPrice" className="block text-sm font-medium text-gray-300 mb-2">
                  Token Price
                </label>
                <input
                  type="number"
                  id="desiredPrice"
                  name="desiredPrice"
                  value={formData.desiredPrice}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="1000000"
                  min="1"
                />
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Company'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}