'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { backendService, Company } from '../../../services/backend';
import { authService } from '../../../services/auth';

export default function ManageCompanyPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    description: '',
    logoUrl: ''
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      const authenticated = authService.isAuthenticated();
      
      setCurrentUser(user);
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
      
      const companyData = await backendService.getCompanyById(parseInt(companyId));
      
      if (!companyData) {
        throw new Error('Company not found');
      }
      
      setCompany(companyData);
      setFormData({
        description: companyData.description || '',
        logoUrl: companyData.logo_url || ''
      });
      
      // Check if current user is the owner
      const user = authService.getCurrentUser();
      if (user && user.principal === companyData.owner) {
        setIsOwner(true);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setUpdateLoading(true);
    setUpdateError('');
    setUpdateSuccess('');

    try {
      await backendService.updateCompanyDescription(parseInt(companyId), formData.description);
      setUpdateSuccess('Company description updated successfully!');
      
      // Reload company data to get updated information
      await loadCompanyData();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update company description');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdateLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setUpdateLoading(true);
    setUpdateError('');
    setUpdateSuccess('');

    try {
      // Note: This would need a new backend method
      // For now, we'll show a message that this feature is coming soon
      throw new Error('Logo update feature coming soon');
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update company logo');
    } finally {
      setUpdateLoading(false);
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
            onClick={() => router.push('/companies')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Companies
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
            onClick={() => router.push('/companies')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Companies
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">You are not authorized to manage this company</div>
          <p className="text-gray-400 mb-6">Only the company owner can manage company details</p>
          <button
            onClick={() => router.push(`/company/${companyId}`)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            View Company Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push(`/company/${companyId}`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Company
            </button>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Manage Company</h1>
          <p className="text-gray-400">Update your company profile and information</p>
        </div>

        {/* Company Header */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
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
              <h2 className="text-2xl font-bold text-white mb-2">{company.name}</h2>
              <p className="text-xl text-gray-300 mb-2">{company.symbol}</p>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Created: {new Date(company.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>Valuation: {Number(company.valuation).toLocaleString()}</span>
                <span>•</span>
                <span>Tokens: {company.remaining}/{company.supply}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {updateSuccess && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <p className="text-green-400">{updateSuccess}</p>
          </div>
        )}
        
        {updateError && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{updateError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Update Description */}
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Update Description</h3>
            <form onSubmit={handleUpdateDescription} className="space-y-4">
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Company Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe your company..."
                />
              </div>
              
              <button
                type="submit"
                disabled={updateLoading}
                className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateLoading ? 'Updating...' : 'Update Description'}
              </button>
            </form>
          </div>

          {/* Update Logo */}
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Update Logo</h3>
            <form onSubmit={handleUpdateLogo} className="space-y-4">
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
              
              {formData.logoUrl && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2">Preview:</p>
                  <img 
                    src={formData.logoUrl} 
                    alt="Logo preview"
                    className="w-16 h-16 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <button
                type="submit"
                disabled={updateLoading}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateLoading ? 'Updating...' : 'Update Logo'}
              </button>
            </form>
            
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm">
                <span className="font-medium">Note:</span> Logo update feature is coming soon. For now, you can only update the description.
              </p>
            </div>
          </div>
        </div>

        {/* Company Statistics */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-semibold text-white mb-4">Company Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Number(company.valuation).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Valuation</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Number(company.token_price).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Current Price</div>
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
    </div>
  );
}