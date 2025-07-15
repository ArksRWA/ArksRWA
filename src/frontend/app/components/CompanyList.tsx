'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService } from '../../services/auth';
import CompanyCard from './CompanyCard';

interface CompanyListProps {
  maxCompanies?: number;
  showViewAllButton?: boolean;
}

export default function CompanyList({
  maxCompanies = 6,
  showViewAllButton = true
}: CompanyListProps) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Check if user is authenticated
      const user = authService.getCurrentUser();
      setCurrentUser(user);
      
      // For non-authenticated users, show demo data
      if (!user || !user.isConnected) {
        const demoCompanies: Company[] = [
          {
            id: 1,
            name: 'TechCorp Solutions',
            symbol: 'TECH',
            owner: 'demo-owner-1',
            valuation: 75_000_000,
            base_price: 1_500_000,
            token_price: 1_500_000,
            supply: 50,
            remaining: 35,
            minimum_purchase: 7_500_000,
            logo_url: '',
            description: 'Leading technology solutions provider specializing in AI and blockchain innovations.',
            created_at: Date.now() - 86400000 * 30 // 30 days ago
          },
          {
            id: 2,
            name: 'GreenEnergy Inc',
            symbol: 'GREEN',
            owner: 'demo-owner-2',
            valuation: 120_000_000,
            base_price: 2_400_000,
            token_price: 2_600_000,
            supply: 50,
            remaining: 20,
            minimum_purchase: 12_000_000,
            logo_url: '',
            description: 'Renewable energy company focused on solar and wind power solutions for sustainable future.',
            created_at: Date.now() - 86400000 * 15 // 15 days ago
          },
          {
            id: 3,
            name: 'HealthTech Innovations',
            symbol: 'HLTH',
            owner: 'demo-owner-3',
            valuation: 90_000_000,
            base_price: 1_800_000,
            token_price: 1_950_000,
            supply: 50,
            remaining: 42,
            minimum_purchase: 9_000_000,
            logo_url: '',
            description: 'Revolutionary healthcare technology company developing next-generation medical devices.',
            created_at: Date.now() - 86400000 * 7 // 7 days ago
          },
          {
            id: 4,
            name: 'FinanceFlow',
            symbol: 'FLOW',
            owner: 'demo-owner-4',
            valuation: 60_000_000,
            base_price: 1_200_000,
            token_price: 1_320_000,
            supply: 50,
            remaining: 28,
            minimum_purchase: 6_000_000,
            logo_url: '',
            description: 'Digital payment solutions and financial services platform for modern businesses.',
            created_at: Date.now() - 86400000 * 45 // 45 days ago
          },
          {
            id: 5,
            name: 'EduTech Global',
            symbol: 'EDU',
            owner: 'demo-owner-5',
            valuation: 45_000_000,
            base_price: 900_000,
            token_price: 990_000,
            supply: 50,
            remaining: 38,
            minimum_purchase: 4_500_000,
            logo_url: '',
            description: 'Online education platform providing cutting-edge learning experiences worldwide.',
            created_at: Date.now() - 86400000 * 20 // 20 days ago
          },
          {
            id: 6,
            name: 'FoodChain Logistics',
            symbol: 'FOOD',
            owner: 'demo-owner-6',
            valuation: 85_000_000,
            base_price: 1_700_000,
            token_price: 1_785_000,
            supply: 50,
            remaining: 15,
            minimum_purchase: 8_500_000,
            logo_url: '',
            description: 'Supply chain management and food distribution network leveraging blockchain technology.',
            created_at: Date.now() - 86400000 * 10 // 10 days ago
          }
        ];
        
        setCompanies(demoCompanies.slice(0, maxCompanies));
      } else {
        // For authenticated users, fetch real data
        const companiesList = await backendService.listCompanies();
        setCompanies(companiesList.slice(0, maxCompanies));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = () => {
    // If user is not authenticated, redirect to login first
    if (!currentUser || !currentUser.isConnected) {
      router.push('/companies');
    } else {
      router.push('/companies');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Trending Company</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Price</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Total Supply</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(6)].map((_, index) => (
                  <tr key={index} className="border-b border-gray-700/50 animate-pulse">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-700"></div>
                        <div>
                          <div className="h-4 bg-gray-700 rounded mb-2 w-32"></div>
                          <div className="h-3 bg-gray-700 rounded w-16"></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-700 rounded mb-2 w-20"></div>
                      <div className="h-3 bg-gray-700 rounded w-16"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-700 rounded mb-2 w-24"></div>
                      <div className="h-3 bg-gray-700 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-8 bg-gray-700 rounded w-24 mx-auto"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={loadCompanies}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {companies.length > 0 ? (
        <>
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Company</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Price</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Total Supply</th>
                    <th className="text-center py-3 px-4 text-gray-300 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company, index) => (
                    <tr
                      key={company.id}
                      className={`border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors ${
                        index === companies.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt={company.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">{company.symbol[0]}</span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white">{company.name}</div>
                            <div className="text-sm text-gray-400">{company.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-white font-medium">
                          {Number(company.token_price).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-400">per token</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-white font-medium">
                          {Number(company.supply).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-400">
                          {Number(company.remaining).toLocaleString()} available
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => router.push(`/company/${company.id}`)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        >
                          View Company
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showViewAllButton && (
            <div className="text-center">
              <button
                onClick={handleViewAll}
                className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                View All Companies
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">No companies available at the moment</div>
          {showViewAllButton && (
            <button
              onClick={handleViewAll}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Explore Companies
            </button>
          )}
        </div>
      )}
    </div>
  );
}
