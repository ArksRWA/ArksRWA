'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService } from '../../services/auth';

// helpers
const toBig = (v: unknown): bigint => {
  try {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(v);
    if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
  } catch {}
  return 0n;
};

export default function CompanyDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const idParam = searchParams.get('id');
  const companyId = useMemo(
    () => (idParam && /^\d+$/.test(idParam) ? parseInt(idParam, 10) : NaN),
    [idParam]
  );

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userHoldings, setUserHoldings] = useState<bigint>(0n);
  const [isOwner, setIsOwner] = useState(false);

  // Trading states
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState(''); // keep as string for input
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await Promise.resolve(authService.isAuthenticated());
      setIsAuthenticated(!!authenticated);
      if (!authenticated) {
        router.push('/');
        return;
      }

      if (!idParam || Number.isNaN(companyId)) {
        setLoading(false);
        setError('Missing or invalid company ID in URL');
        return;
      }

      await loadCompanyData();
    };

    void checkAuth();
  }, [idParam, companyId, router]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      setError('');

      const [companyData, holdings] = await Promise.all([
        backendService.getCompanyById(companyId),
        backendService.getUserHoldings(companyId), // if this returns number, we'll convert
      ]);

      if (!companyData) throw new Error('Company not found');

      // normalize possibly-bigint fields to bigint (no decimals supported)
      const normalized = {
        ...companyData,
        valuation: toBig(companyData.valuation),
        token_price: toBig(companyData.token_price),
        supply: toBig(companyData.supply),
        remaining: toBig(companyData.remaining),
        minimum_purchase: toBig(companyData.minimum_purchase),
      } as Company;

      setCompany(normalized);
      setUserHoldings(toBig(holdings));

      const user = await Promise.resolve(authService.getCurrentUser());
      setIsOwner(Boolean(user && user.principal === (companyData as any).owner));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  const handleTrade = async () => {
    if (!company || !tradeAmount) return;

    setTradeLoading(true);
    setTradeError('');
    setTradeSuccess('');

    try {
      if (!/^\d+$/.test(tradeAmount)) throw new Error('Please enter a valid amount');
      const amount = BigInt(tradeAmount);
      if (amount <= 0n) throw new Error('Please enter a valid amount');

      const price = toBig((company as any).token_price);
      const minPurchase = toBig((company as any).minimum_purchase);
      const available = toBig((company as any).remaining);

      if (tradeType === 'buy') {
        const totalCost = amount * price;
        if (totalCost < minPurchase) {
          throw new Error(`Minimum purchase is ${minPurchase.toLocaleString()}`);
        }
        if (amount > available) {
          throw new Error('Not enough tokens available');
        }

        // If your candid expects Nat/BigInt, pass amount directly.
        // If your BackendService expects number, convert *safely*:
        const result = await backendService.buyTokens(companyId, amount); // or change service to accept bigint
        setTradeSuccess(result);
        await loadCompanyData();
      } else {
        if (amount > userHoldings) throw new Error('Not enough tokens to sell');

        const result = await backendService.sellTokens(companyId, amount); // or change service to accept bigint
        setTradeSuccess(result);
        await loadCompanyData();
      }

      setTradeAmount('');
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setTradeLoading(false);
    }
  };

  if (!isAuthenticated) {
    return screenWrap('Checking authentication...');
  }
  if (loading) {
    return screenWrap('Loading company details...');
  }
  if (error) {
    return errorWrap(error, () => router.push('/'));
  }
  if (!company) {
    return errorWrap('Company not found', () => router.push('/'));
  }

  const price = toBig((company as any).token_price);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-20">
      <div className="max-w-6xl mx-auto">
        {isOwner && (
          <div className="flex justify-end mb-6">
            <button
              onClick={() => router.push(`/manage-company/${companyId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage Company
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-6">
                {(company as any).logo_url ? (
                  <img
                    src={(company as any).logo_url}
                    alt={(company as any).name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {(company as any).symbol?.[0] ?? '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{(company as any).name}</h1>
                  <p className="text-xl text-gray-300 mb-4">{(company as any).symbol}</p>
                  <p className="text-gray-400">{(company as any).description}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Company Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Valuation" value={toBig((company as any).valuation)} />
                <Stat label="Token Price" value={price} />
                <Stat label="Total Supply" value={toBig((company as any).supply)} />
                <Stat label="Available" value={toBig((company as any).remaining)} />
              </div>
            </div>
          </div>

          {/* Trading */}
          <div className="space-y-6">
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-4">Your Holdings</h3>
              <div className="text-3xl font-bold text-primary">{userHoldings.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Tokens</div>
              <div className="text-sm text-gray-500 mt-1">
                Value: {(userHoldings * price).toLocaleString()}
              </div>
            </div>

            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Trade Tokens</h3>

              <div className="flex mb-4">
                <button
                  onClick={() => setTradeType('buy')}
                  className={`flex-1 py-2 px-4 rounded-l-lg ${
                    tradeType === 'buy'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTradeType('sell')}
                  className={`flex-1 py-2 px-4 rounded-r-lg ${
                    tradeType === 'sell'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Sell
                </button>
              </div>

              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 mb-4 bg-gray-800 border border-gray-600 rounded-lg text-white"
                min="1"
              />

              {tradeAmount && /^\d+$/.test(tradeAmount) && (
                <div className="mb-4 text-sm bg-gray-800 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span>Price per token:</span>
                    <span>{price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total {tradeType === 'buy' ? 'cost' : 'value'}:</span>
                    <span>{(BigInt(tradeAmount) * price).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {tradeSuccess && <p className="text-green-400 mb-4">{tradeSuccess}</p>}
              {tradeError && <p className="text-red-400 mb-4">{tradeError}</p>}

              <button
                onClick={handleTrade}
                disabled={tradeLoading || !tradeAmount}
                className={`w-full py-3 rounded-lg ${
                  tradeType === 'buy'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white disabled:opacity-50`}
              >
                {tradeLoading ? 'Processing...' : `${tradeType === 'buy' ? 'Buy' : 'Sell'} Tokens`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function screenWrap(text: string) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-white">{text}</div>
    </div>
  );
}

function errorWrap(msg: string, back: () => void) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 mb-4">{msg}</div>
        <button
          onClick={back}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-primary">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
