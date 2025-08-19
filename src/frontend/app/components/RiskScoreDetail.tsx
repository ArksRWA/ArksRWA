'use client';

import { Company } from '../../services/backend';

interface RiskScoreDetailProps {
  company: Company;
  className?: string;
}

// Mock backend response - replace with actual backend API call later
const getMockRiskData = (company: Company): {
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  note: string;
} => {
  // Mock data that simulates what backend will provide
  const mockResponses = [
    {
      riskScore: 25,
      riskLevel: 'Low' as const,
      note: 'Strong financial fundamentals with consistent revenue growth and experienced management team. Low market volatility observed.'
    },
    {
      riskScore: 45,
      riskLevel: 'Medium' as const,
      note: 'Moderate market exposure with some competitive pressure. Company shows stable performance but faces industry challenges.'
    },
    {
      riskScore: 65,
      riskLevel: 'High' as const,
      note: 'Elevated risk due to market volatility and regulatory uncertainties. Recent performance has been inconsistent.'
    },
    {
      riskScore: 85,
      riskLevel: 'Very High' as const,
      note: 'Significant risk factors including high debt levels, declining market share, and operational challenges. Investment requires careful consideration.'
    }
  ];
  
  // Select mock response based on company ID for consistency
  const index = company.id % mockResponses.length;
  return mockResponses[index];
};

export default function RiskScoreDetail({ company, className = "" }: RiskScoreDetailProps) {
  const riskData = getMockRiskData(company);
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-green-400 bg-green-900/20 border-green-500/30';
      case 'Medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
      case 'High': return 'text-orange-400 bg-orange-900/20 border-orange-500/30';
      case 'Very High': return 'text-red-400 bg-red-900/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
    }
  };
  
  const getScoreColor = (score: number) => {
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
              {riskData.riskScore}
            </div>
            <div className="text-sm text-gray-400">Risk Score</div>
          </div>
          <div className="text-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(riskData.riskLevel)}`}>
              {riskData.riskLevel} Risk
            </span>
          </div>
        </div>
        
        {/* Risk Score Bar */}
        <div className="flex-1 ml-6">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                riskData.riskScore >= 80 ? 'bg-red-400' :      // High score = High risk = Red
                riskData.riskScore >= 60 ? 'bg-orange-400' :   // Medium-high score = Orange
                riskData.riskScore >= 40 ? 'bg-yellow-400' :   // Medium score = Yellow
                'bg-green-400'                                 // Low score = Low risk = Green
              }`}
              style={{ width: `${riskData.riskScore}%` }}
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
          {riskData.note}
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
