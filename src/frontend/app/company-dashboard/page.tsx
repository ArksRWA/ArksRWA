'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService, AuthUser } from '../../services/auth';
import { EditIcon, ViewIcon, AnalyticsIcon } from '../components/Icons';

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'company' | undefined>(undefined);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);

  useEffect(() => {
    const checkAuthAndCompany = async () => {
      // Check if we're in the browser (not SSR)
      if (typeof window === 'undefined') {
        return;
      }

      // Simple auth check - the auth service handles session restoration internally
      const user = authService.getCurrentUser();

      // Quick check for immediate redirect
      if (!user || !user.isConnected) {
        // Give auth service a brief moment to restore session if needed
        await new Promise(resolve => setTimeout(resolve, 100));
        const retryUser = authService.getCurrentUser();
        if (!retryUser || !retryUser.isConnected) {
          router.push('/');
          return;
        }
      }

      const finalUser = authService.getCurrentUser();
      const finalRole = authService.getUserRole();

      if (!finalUser || !finalUser.isConnected) {
        router.push('/');
        return;
      }

      if (finalRole !== 'company') {
        router.push('/dashboard');
        return;
      }

      setCurrentUser(finalUser);
      setUserRole(finalRole);
      await loadCompanyData();
    };

    checkAuthAndCompany();

    // Handle wallet identity changes
    const handleWalletIdentityChange = () => {
      console.warn('Wallet identity changed, redirecting to home');
      router.push('/');
    };

    window.addEventListener('wallet-identity-changed', handleWalletIdentityChange);

    return () => {
      window.removeEventListener('wallet-identity-changed', handleWalletIdentityChange);
    };
  }, [router]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      setError('');

      // Get companies owned by this user using the backend service
      const ownedCompanies = await backendService.getOwnedCompanies();

      if (ownedCompanies.length === 0) {
        // No company found, redirect to create company
        router.push('/create-company');
        return;
      }

      // Use the first company (users can only have one)
      const ownedCompany = ownedCompanies[0];

      // Fetch fresh company data using getCompanyById to get latest verification status
      const freshCompanyData = await backendService.getCompanyById(ownedCompany.id);
      if (freshCompanyData) {
        setCompany(freshCompanyData);
      } else {
        // Fallback to owned company data if getCompanyById fails
        setCompany(ownedCompany);
      }
    } catch (error) {
      console.error('Error loading company data:', error);
      setError('Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDescription = () => {
    if (company) {
      router.push(`/manage-company?id=${company.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading company dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">No Company Found</h2>
          <p className="text-gray-400 mb-6">You don't have a company yet.</p>
          <button
            onClick={() => router.push('/create-company')}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg transition-colors"
          >
            Create Company
          </button>
        </div>
      </div>
    );
  }

  // Get verification status from backend fields - handle both new and legacy structures
  const getVerificationStatusLabel = (status: any) => {
    if (!status) return 'Unknown';
    if (typeof status === 'object') {
      // New backend structure
      if ('verified' in status) return 'Verified';
      if ('pending' in status) return 'Pending';
      if ('suspicious' in status) return 'Suspicious';
      if ('failed' in status) return 'Failed';
      if ('error' in status) return 'Error';
      // Legacy VerificationState structure
      if ('Verified' in status) return 'Verified';
      if ('VerificationPending' in status) return 'Pending';
      if ('NeedsUpdate' in status) return 'Needs Update';
      if ('Failed' in status) return 'Failed';
      if ('Rejected' in status) return 'Rejected';
      if ('Registered' in status) return 'Registered';
    }
    return String(status);
  };

  const getVerificationColor = (status: any) => {
    const label = getVerificationStatusLabel(status);
    switch (label) {
      case 'Verified': return 'text-green-400';
      case 'Pending': case 'VerificationPending': case 'Registered': return 'text-yellow-400';
      case 'Suspicious': case 'Needs Update': return 'text-orange-400';
      case 'Failed': case 'Error': case 'Rejected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const tokensSold = Number(company.supply - company.remaining);
  const soldPercentage = Number(company.supply) > 0 ? (tokensSold / Number(company.supply)) * 100 : 0;
  const totalRaised = BigInt(tokensSold) * company.token_price;
  const marketCap = company.supply * company.token_price;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-32">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Company Dashboard</h1>
              <p className="text-gray-400">Manage and monitor your company's performance</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleUpdateDescription}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors relative z-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Company
              </button>
            </div>
          </div>
        </div>

        {/* Company Info Card */}
        <div className="lg:col-span-2 bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-8">
            {company.logo_url && !imageLoadError ? (
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className="w-32 h-32 rounded-lg object-cover"
                onError={() => setImageLoadError(true)}
              />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-gray-700 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{company.name}</h2>
                <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm font-medium">
                  {company.symbol}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getVerificationColor(company.verification_status)} bg-gray-800 border border-gray-600`}>
                  {getVerificationStatusLabel(company.verification_status)}
                </span>
              </div>
              <p className="text-gray-300 mb-4">{company.description || 'No description available'}</p>
              <div className="justify-between grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Created: </span>
                  <span className="text-white">
                    {new Date(company.created_at / 1000000).toLocaleDateString()}
                  </span>
                  <div>
                    <span className="text-gray-400">Company Valuation:</span>
                    <span className="text-white ml-2">
                      {Number(company.valuation).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className='text-right'>
                  <div className="text-gray-400">Verification Score:</div>
                  <div className="text-white text-lg">
                    {company.verification_score ? `${company.verification_score.toFixed(1)}/100` : 'Ongoing Verification'}
                  </div>
                </div>

                {company.last_verified && (
                  <div className="text-right">
                    <span className="text-gray-400">Last Verified:</span>
                    <span className="text-white ml-2">
                      {new Date(company.last_verified / 1000000).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Company Metrics */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Company Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-300">{Number(totalRaised).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Total Raised</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-300">{Number(company.token_price).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Token Price</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-300">{Number(marketCap).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Market Cap</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-300">{tokensSold.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Tokens Sold</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-300">{Number(company.remaining).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Remaining Supply</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-300">{soldPercentage.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Sold Percentage</div>
            </div>
          </div>
        </div>

        {/* Verification Details */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Verification Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getVerificationColor(company.verification_status).replace('text-', 'bg-')}`}></div>
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="text-white font-medium">{getVerificationStatusLabel(company.verification_status)}</div>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Score</div>
              <div className="text-white font-medium">
                {company.verification_score ? (
                  <span className={`${company.verification_score >= 70 ? 'text-red-400' : company.verification_score >= 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {company.verification_score.toFixed(1)}/100
                  </span>
                ) : <span className="text-blue-400">Ongoing Verification</span>}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Last Verified</div>
              <div className="text-white font-medium">
                {company.last_verified ? new Date(company.last_verified / 1000000).toLocaleDateString() : 'Never'}
              </div>
            </div>

            {company.verification_job_id && (
              <div className="md:col-span-3">
                <div className="text-sm text-gray-400">Job ID</div>
                <div className="text-white font-medium font-mono">#{company.verification_job_id}</div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Token Sale Progress</h3>
          <div className="relative">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>0</span>
              <span>{Number(company.supply).toLocaleString()} Total Supply</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-primary to-primary/80 h-4 rounded-full transition-all duration-300"
                style={{ width: `${soldPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-green-400">{tokensSold.toLocaleString()} sold</span>
              <span className="text-gray-400">{Number(company.remaining).toLocaleString()} remaining</span>
            </div>
          </div>
        </div>

        {/* Company Management Actions */}
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Company Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={handleUpdateDescription}
              className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-lg flex items-center justify-center">
                  <EditIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-white">Update Company Info</h4>
                  <p className="text-sm text-gray-400">Edit description and details</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push(`/company?id=${company.id}`)}
              className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <ViewIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">View Public Page</h4>
                  <p className="text-sm text-gray-400">See how others view your company</p>
                </div>
              </div>
            </button>

            <button
              disabled
              className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg transition-colors text-left opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
                  <AnalyticsIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">Analytics</h4>
                  <p className="text-sm text-gray-400">Coming soon</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}