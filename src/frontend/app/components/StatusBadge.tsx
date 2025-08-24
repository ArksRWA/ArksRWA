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

// Helper function to get risk status from real company verification data
export const getCompanyRiskStatus = (company: any): CompanyRiskStatus => {
  // First, check if the status field exists and is valid (for backward compatibility)
  if (company.status && ['low', 'medium', 'high'].includes(company.status)) {
    return company.status;
  }
  
  // Use real verification_score from backend to determine risk level
  // Higher score = Higher risk (reversed logic)
  if (company.verification_score !== null && company.verification_score !== undefined) {
    const score = Number(company.verification_score);
    
    if (score >= 70) return 'high';     // 70-100: High risk (red) - Very risky
    if (score >= 40) return 'medium';   // 40-69: Medium risk (yellow) - Some risk
    return 'low';                       // 0-39: Low risk (green) - Safe investment
  }
  
  // If no verification score available, check verification status
  if (company.verification_status) {
    // Handle different status formats from backend
    const status = company.verification_status;
    
    // New backend structure
    if (typeof status === 'object') {
      if ('verified' in status) return 'low';
      if ('pending' in status) return 'medium';
      if ('suspicious' in status || 'failed' in status || 'error' in status) return 'high';
      
      // Legacy VerificationState structure
      if ('Verified' in status) return 'low';
      if ('VerificationPending' in status || 'Registered' in status) return 'medium';
      if ('NeedsUpdate' in status || 'Failed' in status || 'Rejected' in status) return 'high';
    }
  }
  
  // Default to medium risk if no verification data available
  return 'medium';
};