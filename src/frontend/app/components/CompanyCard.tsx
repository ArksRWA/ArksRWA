'use client';

import { useRouter } from 'next/navigation';
import { Company } from '../../services/backend';
import StatusBadge, { getCompanyRiskStatus } from './StatusBadge';

interface CompanyCardProps {
  company: Company;
  currentUser?: any;
  showManageButton?: boolean;
  className?: string;
}

export default function CompanyCard({ 
  company, 
  currentUser, 
  showManageButton = true,
  className = "" 
}: CompanyCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/company?id=${company.id}`);
  };

  const handleManageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/manage-company?id=${company.id}`);
  };

  return (
    <div
      className={`modern-card p-6 cursor-pointer group ${className}`}
      onClick={handleCardClick}
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
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <span className="text-xl font-bold text-primary">{company.symbol[0]}</span>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
              {company.name}
            </h3>
            <StatusBadge status={getCompanyRiskStatus(company)} size="small" showTooltip={false} />
          </div>
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
          <span className="text-white font-medium">{Number(company.token_price).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Available:</span>
          <span className="text-white font-medium">{Number(company.remaining)}/{Number(company.supply)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Valuation:</span>
          <span className="text-white font-medium">{Number(company.valuation).toLocaleString()}</span>
        </div>
      </div>

      {/* Availability Status and Actions */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-1 rounded-full ${
          company.remaining > 0 
            ? 'bg-green-900/20 text-green-400 border border-green-500/30' 
            : 'bg-red-900/20 text-red-400 border border-red-500/30'
        }`}>
          {company.remaining > 0 ? 'Available' : 'Sold Out'}
        </span>
        <div className="flex items-center gap-2">
          {showManageButton && currentUser && currentUser.principal === company.owner && (
            <button
              onClick={handleManageClick}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Manage
            </button>
          )}
          <span className="text-xs text-gray-500">
            {new Date(company.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
