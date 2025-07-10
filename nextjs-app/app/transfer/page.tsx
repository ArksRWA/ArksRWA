'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { backendService, Company } from '../../services/backend';
import { authService, AuthUser } from '../../services/auth';

interface UserHolding {
  company: Company;
  amount: number;
  currentValue: number;
}

interface TransferFormData {
  companyId: string;
  recipient: string;
  amount: string;
  memo: string;
}

export default function TransferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Transfer form state
  const [formData, setFormData] = useState<TransferFormData>({
    companyId: '',
    recipient: '',
    amount: '',
    memo: ''
  });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Selected company for transfer
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<UserHolding | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      if (!user || !user.isConnected) {
        router.push('/');
        return;
      }
      setCurrentUser(user);
      loadTransferData();
    };
    
    checkAuth();
  }, [router]);

  const loadTransferData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load all companies
      const companiesList = await backendService.listCompanies();
      setCompanies(companiesList);
      
      // Load user holdings for each company
      const holdingsPromises = companiesList.map(async (company) => {
        const amount = await backendService.getUserHoldings(company.id);
        if (amount > 0) {
          const currentValue = amount * company.token_price;
          return {
            company,
            amount,
            currentValue
          };
        }
        return null;
      });
      
      const holdingsResults = await Promise.all(holdingsPromises);
      const validHoldings = holdingsResults.filter(h => h !== null) as UserHolding[];
      setHoldings(validHoldings);
      
      // Check for pre-selected company from URL params
      const companyParam = searchParams.get('company');
      if (companyParam && validHoldings.length > 0) {
        const preSelectedHolding = validHoldings.find(h => h.company.id.toString() === companyParam);
        if (preSelectedHolding) {
          setFormData(prev => ({ ...prev, companyId: companyParam }));
          setSelectedCompany(preSelectedHolding.company);
          setSelectedHolding(preSelectedHolding);
        }
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfer data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update selected company and holding when company changes
    if (name === 'companyId') {
      const company = companies.find(c => c.id.toString() === value);
      const holding = holdings.find(h => h.company.id.toString() === value);
      setSelectedCompany(company || null);
      setSelectedHolding(holding || null);
    }
  };

  const validateTransfer = () => {
    if (!formData.companyId) {
      throw new Error('Please select a company');
    }
    if (!formData.recipient.trim()) {
      throw new Error('Please enter recipient address');
    }
    if (!formData.amount || parseInt(formData.amount) <= 0) {
      throw new Error('Please enter a valid amount');
    }

    const amount = parseInt(formData.amount);
    if (!selectedHolding || amount > selectedHolding.amount) {
      throw new Error('Insufficient tokens for transfer');
    }

    // Basic principal validation (simplified)
    if (formData.recipient.length < 20) {
      throw new Error('Invalid recipient address format');
    }

    if (currentUser && formData.recipient === currentUser.principal) {
      throw new Error('Cannot transfer to yourself');
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    try {
      validateTransfer();
      setShowConfirmation(true);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  const executeTransfer = async () => {
    if (!selectedCompany) return;

    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    setShowConfirmation(false);

    try {
      const result = await backendService.transferTokens(
        parseInt(formData.companyId),
        formData.recipient,
        parseInt(formData.amount),
        formData.memo
      );

      setTransferSuccess(result);
      
      // Reset form
      setFormData({
        companyId: '',
        recipient: '',
        amount: '',
        memo: ''
      });
      setSelectedCompany(null);
      setSelectedHolding(null);
      
      // Reload holdings to reflect the transfer
      await loadTransferData();
      
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading transfer data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 pt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Transfer Tokens</h1>
          <p className="text-gray-400">Send your company tokens to other users</p>
        </div>

        {/* Success/Error Messages */}
        {transferSuccess && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <p className="text-green-400">{transferSuccess}</p>
          </div>
        )}
        
        {transferError && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{transferError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transfer Form */}
          <div className="lg:col-span-2">
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Transfer Details</h2>
              
              <form onSubmit={handleTransferSubmit} className="space-y-6">
                {/* Company Selection */}
                <div>
                  <label htmlFor="companyId" className="block text-sm font-medium text-gray-300 mb-2">
                    Select Company Token
                  </label>
                  <select
                    id="companyId"
                    name="companyId"
                    value={formData.companyId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Choose a company...</option>
                    {holdings.map((holding) => (
                      <option key={holding.company.id} value={holding.company.id.toString()}>
                        {holding.company.name} ({holding.company.symbol}) - {holding.amount} tokens
                      </option>
                    ))}
                  </select>
                  {holdings.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">You don't own any tokens yet</p>
                  )}
                </div>

                {/* Recipient Address */}
                <div>
                  <label htmlFor="recipient" className="block text-sm font-medium text-gray-300 mb-2">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    id="recipient"
                    name="recipient"
                    value={formData.recipient}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter recipient's principal ID"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Principal ID format: abc12-def34-ghi56-...
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter amount to transfer"
                    min="1"
                    max={selectedHolding?.amount || 0}
                    required
                  />
                  {selectedHolding && (
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {selectedHolding.amount} tokens
                    </p>
                  )}
                </div>

                {/* Memo */}
                <div>
                  <label htmlFor="memo" className="block text-sm font-medium text-gray-300 mb-2">
                    Memo (Optional)
                  </label>
                  <textarea
                    id="memo"
                    name="memo"
                    value={formData.memo}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Add a note for this transfer..."
                  />
                </div>

                {/* Transfer Summary */}
                {selectedCompany && formData.amount && (
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Transfer Summary</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Company:</span>
                        <span className="text-white">{selectedCompany.name} ({selectedCompany.symbol})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount:</span>
                        <span className="text-white">{formData.amount} tokens</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Value:</span>
                        <span className="text-white">
                          {(parseInt(formData.amount || '0') * selectedCompany.token_price).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={transferLoading || holdings.length === 0}
                  className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {transferLoading ? 'Processing...' : 'Review Transfer'}
                </button>
              </form>
            </div>
          </div>

          {/* Holdings Summary */}
          <div className="space-y-6">
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Holdings</h3>
              
              {holdings.length > 0 ? (
                <div className="space-y-4">
                  {holdings.map((holding) => (
                    <div key={holding.company.id} className="p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
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
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount:</span>
                          <span className="text-white">{holding.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Value:</span>
                          <span className="text-white">{holding.currentValue.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-gray-400 mb-2">No tokens to transfer</div>
                  <button
                    onClick={() => router.push('/companies')}
                    className="text-primary hover:text-primary/80 transition-colors text-sm"
                  >
                    Browse Companies →
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-card-bg border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Dashboard
                </button>
                <button
                  onClick={() => router.push('/transactions')}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Transactions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Confirm Transfer</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Company:</span>
                <span className="text-white">{selectedCompany.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white">{formData.amount} {selectedCompany.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">To:</span>
                <span className="text-white text-sm break-all">{formData.recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Value:</span>
                <span className="text-white">
                  {(parseInt(formData.amount) * selectedCompany.token_price).toLocaleString()}
                </span>
              </div>
              {formData.memo && (
                <div>
                  <span className="text-gray-400">Memo:</span>
                  <div className="text-white text-sm mt-1">{formData.memo}</div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeTransfer}
                disabled={transferLoading}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {transferLoading ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}