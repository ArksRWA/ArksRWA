'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService } from '../../services/backend';
import { authService } from '../../services/auth';

export default function CreateCompanyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
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
  const [hasCompany, setHasCompany] = useState(false);
  const [checkingCompany, setCheckingCompany] = useState(true);

  useEffect(() => {
    const checkAuthAndCompany = async () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        router.push('/');
        return;
      }

      try {
        // Check if user already has a company
        const userHasCompany = await backendService.hasOwnedCompany();
        setHasCompany(userHasCompany);
        
        if (userHasCompany) {
          // Redirect to company dashboard if they already have a company
          router.push('/company-dashboard');
        }
      } catch (error) {
        console.error('Error checking owned company:', error);
        // Continue to allow company creation if check fails
      } finally {
        setCheckingCompany(false);
      }
    };
    
    checkAuthAndCompany();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const goToNextStep = () => {
    // Validate step 1 fields
    if (currentStep === 1) {
      if (!formData.name || !formData.symbol) {
        setError('Please fill in all required fields in Step 1');
        return;
      }

      if (formData.symbol.length < 3 || formData.symbol.length > 5) {
        setError('Symbol must be 3-5 characters');
        return;
      }
    }

    setError('');
    setCurrentStep(2);
  };

  const goToPreviousStep = () => {
    setError('');
    setCurrentStep(1);
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

      const valuationBigInt = BigInt(valuation);
      if (valuationBigInt < 10000000n) {
        throw new Error('Valuation must be at least 10,000,000');
      }

      if (symbol.length < 3 || symbol.length > 5) {
        throw new Error('Symbol must be 3-5 characters');
      }

      let supply: bigint | undefined = undefined;
      let price: bigint | undefined = undefined;

      if (supplyType === 'supply' && desiredSupply) {
        supply = BigInt(desiredSupply);
        if (supply <= 0n) {
          throw new Error('Supply must be a positive number');
        }
      } else if (supplyType === 'price' && desiredPrice) {
        price = BigInt(desiredPrice);
        if (price <= 0n) {
          throw new Error('Price must be a positive number');
        }
      }

      const companyId = await backendService.createCompany({
        name,
        symbol: symbol.toUpperCase(),
        logoUrl,
        description,
        valuation: valuationBigInt,
        desiredSupply: supply,
        desiredPrice: price
      });

      console.log('Company created successfully with ID:', companyId);
      router.push('/company-dashboard');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || checkingCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">
          {!isAuthenticated ? 'Checking authentication...' : 'Checking company status...'}
        </div>
      </div>
    );
  }

  if (hasCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Company Already Created</h2>
          <p className="text-gray-400 mb-6">You can only create one company per account.</p>
          <button
            onClick={() => router.push('/company-dashboard')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Company Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-32">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card-bg border border-gray-700 rounded-lg shadow-2xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Company</h1>
            <p className="text-gray-400">Launch your company on the ARKS RWA platform</p>

            {/* Step Indicator */}
            <div className="flex items-center justify-center mt-6">
              <div className={`flex items-center ${currentStep >= 1 ? 'text-primary' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 1 ? 'bg-primary text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  1
                </div>
                <span className="ml-2 font-medium">Company Info</span>
              </div>

              <div className={`w-12 h-0.5 mx-2 ${currentStep >= 2 ? 'bg-primary' : 'bg-gray-700'}`}></div>

              <div className={`flex items-center ${currentStep >= 2 ? 'text-primary' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 2 ? 'bg-primary text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  2
                </div>
                <span className="ml-2 font-medium">Valuation & Tokens</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={currentStep === 1 ? (e) => { e.preventDefault(); goToNextStep(); } : handleSubmit} className="space-y-6">
            {/* Step 1: Company Information */}
            {currentStep === 1 && (
              <>
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
              </>
            )}

            {/* Step 2: Valuation & Token Configuration */}
            {currentStep === 2 && (
              <>
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

                {/* Company Summary */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-3">Company Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Name:</span>
                      <span className="text-white font-medium">{formData.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Symbol:</span>
                      <span className="text-white font-medium">{formData.symbol || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Description:</span>
                      <span className="text-white font-medium truncate max-w-[250px]">{formData.description || '-'}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 pt-6">
              {currentStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => router.push('/companies')}
                    className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Next Step
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create Company'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}