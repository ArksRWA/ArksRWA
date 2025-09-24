'use client';

import { useState, useEffect } from 'react';
import { Company, backendService } from '../../services/backend';

interface RiskScoreDetailProps {
  company: Company;
  className?: string;
}

interface RiskData {
  riskScore: number | null;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High' | 'Pending';
  note: string;
}

// Convert backend risk profile to frontend format
const mapBackendRiskData = (riskProfile: {
  score: number | null;
  risk_label: 'Trusted' | 'Caution' | 'HighRisk';
  explanation_hash?: string;
}): RiskData => {
  // Handle null score - verification ongoing
  const score = riskProfile.score;
  
  if (score === null) {
    return {
      riskScore: null,
      riskLevel: 'Pending',
      note: 'Risk assessment is currently in progress. Our verification system is analyzing company data and documentation. Please check back soon for the complete risk profile.'
    };
  }
  
  let riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  let note: string;
  
  // Map backend risk_label and score to frontend format
  if (riskProfile.risk_label === 'Trusted' || score < 25) {
    riskLevel = 'Low';
    note = 'Company has been verified and shows strong fundamentals with low risk indicators. Suitable for most investors.';
  } else if (riskProfile.risk_label === 'Caution' || score < 60) {
    riskLevel = score < 40 ? 'Medium' : 'High';
    note = score < 40 
      ? 'Moderate risk profile with some areas requiring attention. Company shows stable performance but faces industry challenges.'
      : 'Elevated risk due to verification concerns or market factors. Recent performance or compliance issues detected.';
  } else {
    riskLevel = 'Very High';
    note = 'High-risk investment with significant concerns identified during verification. Investment requires careful consideration.';
  }
  
  return {
    riskScore: score,
    riskLevel,
    note
  };
};

// Fallback data for when backend is unavailable
const getFallbackRiskData = (): RiskData => ({
  riskScore: null,
  riskLevel: 'Pending',
  note: 'Risk assessment temporarily unavailable. Please try again later.'
});

export default function RiskScoreDetail({ company, className = "" }: RiskScoreDetailProps) {
  const [riskData, setRiskData] = useState<RiskData>(getFallbackRiskData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRiskData = async () => {
      try {
        setLoading(true);
        setError(null);
        const riskProfile = await backendService.getRiskProfile(company.id);
        setRiskData(mapBackendRiskData(riskProfile));
      } catch (err) {
        console.error('Failed to fetch risk data:', err);
        setError('Failed to load risk assessment');
        setRiskData(getFallbackRiskData());
      } finally {
        setLoading(false);
      }
    };

    fetchRiskData();
  }, [company.id]);
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-green-400 bg-green-900/20 border-green-500/30';
      case 'Medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
      case 'High': return 'text-orange-400 bg-orange-900/20 border-orange-500/30';
      case 'Very High': return 'text-red-400 bg-red-900/20 border-red-500/30';
      case 'Pending': return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
    }
  };
  
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-blue-400';  // Pending verification = Blue
    if (score >= 80) return 'text-red-400';      // High score = High risk = Red
    if (score >= 60) return 'text-orange-400';   // Medium-high score = Orange
    if (score >= 40) return 'text-yellow-400';   // Medium score = Yellow
    return 'text-green-400';                     // Low score = Low risk = Green
  };
  
  return (
    <div className={`bg-card-bg border border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Risk Assessment</h2>
        <span className="text-xs px-2 py-1 bg-blue-900/20 text-blue-400 border border-blue-500/30 rounded-full">
          BETA
        </span>
      </div>
      
      {/* Risk Score and Level */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-3xl font-bold ${getScoreColor(riskData.riskScore)}`}>
              {loading ? '...' : riskData.riskScore === null ? '⏳' : riskData.riskScore}
            </div>
            <div className="text-sm text-gray-400">Risk Score</div>
          </div>
          <div className="text-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(riskData.riskLevel)}`}>
              {loading ? 'Loading...' : `${riskData.riskLevel} Risk`}
            </span>
          </div>
        </div>
        
        {/* Risk Score Bar */}
        <div className="flex-1 ml-6">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                riskData.riskScore === null ? 'bg-blue-400' :       // Pending = Blue
                riskData.riskScore >= 80 ? 'bg-red-400' :           // High score = High risk = Red
                riskData.riskScore >= 60 ? 'bg-orange-400' :        // Medium-high score = Orange
                riskData.riskScore >= 40 ? 'bg-yellow-400' :        // Medium score = Yellow
                'bg-green-400'                                      // Low score = Low risk = Green
              }`}
              style={{ 
                width: riskData.riskScore === null ? '50%' : `${riskData.riskScore}%`,
                animation: riskData.riskScore === null ? 'pulse 2s infinite' : 'none'
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low Risk</span>
            <span>High Risk</span>
          </div>
        </div>
      </div>
      
      {/* Risk Note */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Assessment Note</h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          {loading ? 'Loading risk assessment...' : error ? error : riskData.note}
        </p>
      </div>
      
      {/* Disclaimer */}
      <div className="pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          * Risk assessment is based on algorithmic analysis and should not be considered as financial advice. 
          Always conduct your own research before making investment decisions.
        </p>
      </div>
    </div>
  );
}
