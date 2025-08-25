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

  useEffect(() => {
    const checkAuthAndCompany = async () => {
      const user = authService.getCurrentUser();
      const role = authService.getUserRole();

      if (!user || !user.isConnected) {
        router.push('/');
        return;
      }

      if (role !== 'company') {
        // Redirect non-company users to regular dashboard
        router.push('/dashboard');
        return;
      }

      setCurrentUser(user);
      setUserRole(role);
      await loadCompanyData();
    };

    checkAuthAndCompany();
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
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
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
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Manage Company
              </button>
            </div>
          </div>
        </div>

        {/* Company Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Company Info Card */}
          <div className="lg:col-span-2 bg-card-bg border border-gray-700 rounded-lg p-6">
            <div className="flex items-start gap-4">
              {company.logo_url && (
                <img
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  className="w-16 h-16 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white ml-2">
                      {new Date(company.created_at / 1000000).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Verification Score:</span>
                    <span className="text-white ml-2">
                      {company.verification_score ? `${company.verification_score.toFixed(1)}/100` : 'N/A'}
                    </span>
                  </div>
                  {company.last_verified && (
                    <div className="col-span-2">
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

          {/* Quick Stats */}
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold text-primary">{tokensSold.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Tokens Sold</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{Number(totalRaised).toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Raised</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{soldPercentage.toFixed(1)}%</div>
                <div className="text-sm text-gray-400">Tokens Sold</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Token Price</h4>
            <div className="text-2xl font-bold text-white">{Number(company.token_price).toLocaleString()}</div>
            <div className="text-sm text-gray-400">per token</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Market Cap</h4>
            <div className="text-2xl font-bold text-white">{Number(marketCap).toLocaleString()}</div>
            <div className="text-sm text-gray-400">total value</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Remaining Supply</h4>
            <div className="text-2xl font-bold text-white">{Number(company.remaining).toLocaleString()}</div>
            <div className="text-sm text-gray-400">tokens available</div>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Valuation</h4>
            <div className="text-2xl font-bold text-white">{Number(company.valuation).toLocaleString()}</div>
            <div className="text-sm text-gray-400">company value</div>
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
                ) : 'Not Available'}
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
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
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