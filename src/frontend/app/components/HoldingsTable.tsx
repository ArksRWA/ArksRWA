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
  onTrade?: (companyId: number) => void;
  showHeader?: boolean;
  className?: string;
}

export default function HoldingsTable({ 
  holdings, 
  onTrade, 
  showHeader = true,
  className = "" 
}: HoldingsTableProps) {
  const router = useRouter();

  const handleTransfer = () => {
    router.push('/transfer');
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
      <div className="text-gray-400 mb-4 text-lg">You don't have any holdings yet</div>
      <button
        onClick={() => router.push('/companies')}
        className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg transition-colors"
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
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr 
              key={holding.company.id} 
              className="border-b border-gray-700 hover:bg-gray-800/70 cursor-pointer transition-colors duration-200"
              onClick={() => handleTrade(holding.company.id)}
              title="Click to trade this company's tokens"
            >
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
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-600/20 to-green-700/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{holding.company.symbol[0]}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-white text-xl">{holding.company.name}</div>
                      <div className="text-lg text-gray-400">{holding.company.symbol}</div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <StatusBadge status={getCompanyRiskStatus(holding.company)} size="small" showTooltip={false} />
                  </div>
                </div>
              </td>
              <td className="py-4 px-4 text-right text-white text-xl font-medium">{Number(holding.amount)}</td>
              <td className="py-4 px-4 text-right text-white text-xl font-medium">{Number(holding.company.token_price).toLocaleString()}</td>
              <td className="py-4 px-4 text-right text-white text-xl font-semibold">{Number(holding.currentValue).toLocaleString()}</td>
              <td className="py-4 px-4 text-right text-gray-400 text-xl">{Number(holding.investmentValue).toLocaleString()}</td>
              <td className={`py-4 px-4 text-right text-xl font-semibold ${Number(holding.profitLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(holding.profitLoss) >= 0 ? '+' : ''}{Number(holding.profitLoss).toLocaleString()}
              </td>
              <td className={`py-4 px-4 text-right text-xl font-semibold ${Number(holding.profitLossPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(holding.profitLossPercent) >= 0 ? '+' : ''}{(Number(holding.profitLossPercent) / 100).toFixed(2)}%
              </td>
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-white">Your Holdings</h2>
      </div>
      
      {holdings.length === 0 ? emptyState : tableContent}
    </div>
  );
}