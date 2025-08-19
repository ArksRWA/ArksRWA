'use client';

import { useState } from 'react';
import { CompanyRiskStatus } from '../../types/canister';

interface StatusBadgeProps {
  status: CompanyRiskStatus;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  className?: string;
  showTooltip?: boolean;
}

export default function StatusBadge({ 
  status, 
  size = 'medium', 
  showIcon = true,
  className = "",
  showTooltip = true
}: StatusBadgeProps) {
  const [showTooltipState, setShowTooltipState] = useState(false);

  const getStatusConfig = (status: CompanyRiskStatus) => {
    switch (status) {
      case 'low':
        return {
          label: 'Low Risk',
          bgColor: 'bg-green-900/20',
          textColor: 'text-green-400',
          borderColor: 'border-green-500/30',
          icon: '🟢',
          tooltip: '✅ SAFE: No fraud detected - Trusted investment!'
        };
      case 'medium':
        return {
          label: 'Medium Risk',
          bgColor: 'bg-yellow-900/20',
          textColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/30',
          icon: '🟡',
          tooltip: '⚠️ CAUTION: Some fraud concerns - Invest carefully!'
        };
      case 'high':
        return {
          label: 'High Risk',
          bgColor: 'bg-red-900/20',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/30',
          icon: '🔴',
          tooltip: '🚨 DANGER: High fraud risk - Avoid investment!'
        };
      default:
        return {
          label: 'On Validation',
          bgColor: 'bg-gray-900/20',
          textColor: 'text-gray-400',
          borderColor: 'border-gray-500/30',
          icon: '⚪',
          tooltip: '⏳ PENDING: Safety check in progress...'
        };
    }
  };

  const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small':
        return 'text-xs px-2 py-1';
      case 'medium':
        return 'text-sm px-3 py-1.5';
      case 'large':
        return 'text-base px-4 py-2';
      default:
        return 'text-sm px-3 py-1.5';
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);

  return (
    <div className="relative inline-block">
      <span 
        className={`
          inline-flex items-center gap-1.5 rounded-full border font-medium
          ${showTooltip ? 'cursor-help' : ''}
          ${config.bgColor} ${config.textColor} ${config.borderColor}
          ${sizeClasses}
          ${className}
        `}
        onMouseEnter={() => showTooltip && setShowTooltipState(true)}
        onMouseLeave={() => showTooltip && setShowTooltipState(false)}
        title={showTooltip ? undefined : `Risk Level: ${config.label}`}
      >
        {showIcon && <span className="text-xs">{config.icon}</span>}
        {config.label}
      </span>
      
      {/* Tooltip */}
      {showTooltip && showTooltipState && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 shadow-xl min-w-80 max-w-200 whitespace-nowrap">
            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-gray-800"></div>
            </div>
            
            {/* Single line Content */}
            <p className="text-sm text-gray-300 text-center">
              {config.tooltip}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// TODO: MOCK Helper function to get risk status from company data
export const getCompanyRiskStatus = (company: any): CompanyRiskStatus => {
  // For now, return the status field if it exists, otherwise determine based on some logic
  if (company.status) {
    return company.status;
  }
  
  // Temporary logic to determine risk based on remaining tokens ratio
  // This can be replaced with actual backend risk calculation
  const remaining = Number(company.remaining || 0);
  const supply = Number(company.supply || 1);
  const remainingRatio = remaining / supply;
  
  if (remainingRatio > 0.7) return 'low';    // More than 70% tokens available = low risk
  if (remainingRatio > 0.3) return 'medium'; // 30-70% tokens available = medium risk
  return 'high';                             // Less than 30% tokens available = high risk
};