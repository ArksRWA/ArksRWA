'use client';

import { useRouter } from 'next/navigation';
import StatusBadge, { getCompanyRiskStatus } from './StatusBadge';

interface HoldingData {
  company: {
    id: number;
    name: string;
    symbol: string;
    logo_url: string;
    token_price: bigint;
  };
  amount: bigint;
  currentValue: bigint;
  investmentValue: bigint;
  profitLoss: bigint;
  profitLossPercent: bigint;
}

interface HoldingsTableProps {
  holdings: HoldingData[];
  onTransfer?: (companyId: number) => void;
  onTrade?: (companyId: number) => void;
  showActions?: boolean;
  showHeader?: boolean;
  className?: string;
}

export default function HoldingsTable({ 
  holdings, 
  onTransfer, 
  onTrade, 
  showActions = true,
  showHeader = true,
  className = "" 
}: HoldingsTableProps) {
  const router = useRouter();

  const handleTransfer = (companyId: number) => {
    if (onTransfer) {
      onTransfer(companyId);
    } else {
      router.push(`/transfer?company=${companyId}`);
    }
  };

  const handleTrade = (companyId: number) => {
    if (onTrade) {
      onTrade(companyId);
    } else {
      router.push(`/company?id=${companyId}`);
    }
  };

  const emptyState = (
    <div className="text-center py-8">
      <div className="text-gray-400 mb-4">You don't have any holdings yet</div>
      <button
        onClick={() => router.push('/companies')}
        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        Browse Companies
      </button>
    </div>
  );

  const tableContent = (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-600">
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Company</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Holdings</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Price</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Value</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Invested</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">P&L</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">P&L %</th>
            {showActions && (
              <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.company.id} className="border-b border-gray-700 hover:bg-gray-800/50">
              <td className="py-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {holding.company.logo_url ? (
                      <img
                        src={holding.company.logo_url}
                        alt={holding.company.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{holding.company.symbol[0]}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-white">{holding.company.name}</div>
                      <div className="text-sm text-gray-400">{holding.company.symbol}</div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <StatusBadge status={getCompanyRiskStatus(holding.company)} size="small" showTooltip={false} />
                  </div>
                </div>
              </td>
              <td className="py-4 px-4 text-right text-white">{Number(holding.amount)}</td>
              <td className="py-4 px-4 text-right text-white">{Number(holding.company.token_price).toLocaleString()}</td>
              <td className="py-4 px-4 text-right text-white">{Number(holding.currentValue).toLocaleString()}</td>
              <td className="py-4 px-4 text-right text-gray-400">{Number(holding.investmentValue).toLocaleString()}</td>
              <td className={`py-4 px-4 text-right ${Number(holding.profitLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(holding.profitLoss) >= 0 ? '+' : ''}{Number(holding.profitLoss).toLocaleString()}
              </td>
              <td className={`py-4 px-4 text-right ${Number(holding.profitLossPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(holding.profitLossPercent) >= 0 ? '+' : ''}{(Number(holding.profitLossPercent) / 100).toFixed(2)}%
              </td>
              {showActions && (
                <td className="py-4 px-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleTransfer(holding.company.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => handleTrade(holding.company.id)}
                      className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-xs"
                    >
                      Trade
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!showHeader) {
    return holdings.length === 0 ? emptyState : tableContent;
  }

  return (
    <div className={`bg-card-bg border border-gray-700 rounded-lg p-6 mb-12 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Your Holdings</h2>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/transfer')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Transfer
          </button>
          <button
            onClick={() => router.push('/transactions')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Transactions
          </button>
        </div>
      </div>
      
      {holdings.length === 0 ? emptyState : tableContent}
    </div>
  );
}