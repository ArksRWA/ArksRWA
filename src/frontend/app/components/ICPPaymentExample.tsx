'use client';

import React, { useState, useEffect } from 'react';
import { authService } from '../../services/auth';
import { backendService } from '../../services/backend';

// ICP Ledger interface for direct payments
interface ICPLedgerTransferArgs {
  from_subaccount?: Uint8Array;
  to: {
    owner: string; // Principal as string
    subaccount?: Uint8Array;
  };
  amount: bigint;
  fee?: bigint;
  memo?: Uint8Array;
  created_at_time?: bigint;
}

interface ICPLedgerTransferResult {
  Ok?: bigint;
  Err?: any;
}

// Plug wallet interface with additional methods
interface PlugWallet {
  requestConnect: (options?: any) => Promise<any>;
  agent: any;
  principal: any;
  accountId: string;
  requestTransfer: (args: any) => Promise<any>;
  createActor: (canisterId: string, interfaceFactory: any) => Promise<any>;
}

const ICPPaymentExample: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [tokenAmount, setTokenAmount] = useState<number>(1);
  const [tokenCost, setTokenCost] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  // ICP Ledger canister ID (mainnet)
  const ICP_LEDGER_CANISTER_ID = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
  
  // Your backend canister ID (this should be your actual canister principal)
  const BACKEND_CANISTER_PRINCIPAL = 'your-backend-canister-principal-here';

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    
    if (currentUser) {
      loadCompanies();
    }
  }, []);

  useEffect(() => {
    if (selectedCompany && tokenAmount > 0) {
      calculateTokenCost();
    }
  }, [selectedCompany, tokenAmount]);

  const loadCompanies = async () => {
    try {
      const companiesList = await backendService.listCompanies();
      setCompanies(companiesList);
      if (companiesList.length > 0) {
        setSelectedCompany(companiesList[0]);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      setStatus('Error loading companies');
    }
  };

  const calculateTokenCost = async () => {
    if (!selectedCompany) return;
    
    try {
      const cost = await backendService.getTokenCostInICP(selectedCompany.id, tokenAmount);
      setTokenCost(cost);
    } catch (error) {
      console.error('Error calculating cost:', error);
    }
  };

  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setStatus('Connecting to Plug wallet...');
      
      const connectedUser = await authService.connectPlug();
      setUser(connectedUser);
      setStatus('Wallet connected successfully!');
      
      await loadCompanies();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setStatus('Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const buyTokensWithRealICP = async () => {
    if (!user || !selectedCompany || !window.ic?.plug) {
      setStatus('Please connect your Plug wallet first');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Initiating ICP payment...');

      // Step 1: Calculate the exact cost including platform fees
      const totalCostE8s = await backendService.getTokenCostInICP(selectedCompany.id, tokenAmount);
      const totalCostICP = totalCostE8s / 100_000_000; // Convert e8s to ICP

      setStatus(`Requesting payment of ${totalCostICP} ICP...`);

      // Step 2: Request ICP transfer through Plug wallet
      const transferArgs = {
        to: BACKEND_CANISTER_PRINCIPAL, // Your backend canister receives the payment
        amount: totalCostE8s, // Amount in e8s
        fee: 10000, // Standard ICP fee (0.0001 ICP)
        memo: new TextEncoder().encode(`Token purchase: Company ${selectedCompany.id}, Amount ${tokenAmount}`)
      };

      // Use Plug's requestTransfer method with type assertion
      const plug = window.ic.plug as PlugWallet;
      const transferResult = await plug.requestTransfer(transferArgs);
      
      if (transferResult.height) {
        setStatus('Payment successful! Processing token purchase...');
        
        // Step 3: Call your backend with the payment proof
        const blockIndex = Number(transferResult.height);
        const purchaseResult = await backendService.buyTokensWithICP(
          selectedCompany.id, 
          tokenAmount, 
          blockIndex
        );
        
        setStatus(`Success! ${purchaseResult}`);
        
        // Refresh company data to show updated token count
        await loadCompanies();
        
      } else {
        throw new Error('Payment failed or was cancelled');
      }

    } catch (error: any) {
      console.error('Error during ICP payment:', error);
      setStatus(`Payment failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sellTokensForRealICP = async () => {
    if (!user || !selectedCompany || !window.ic?.plug) {
      setStatus('Please connect your Plug wallet first');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Processing token sale...');

      // Step 1: Get the sale value
      const saleValueE8s = await backendService.getTokenSaleValue(selectedCompany.id, tokenAmount);
      const saleValueICP = saleValueE8s / 100_000_000;

      setStatus(`Selling ${tokenAmount} tokens for ${saleValueICP} ICP...`);

      // Step 2: Execute the sale (this would trigger ICP transfer to user in a real implementation)
      const saleResult = await backendService.sellTokensForICP(selectedCompany.id, tokenAmount);
      
      setStatus(`Success! ${saleResult}`);
      
      // Note: In a real implementation, your backend would need to:
      // 1. Verify the user owns the tokens
      // 2. Transfer ICP from the platform's account to the user's account
      // 3. Update the token holdings
      
      // Refresh company data
      await loadCompanies();

    } catch (error: any) {
      console.error('Error during token sale:', error);
      setStatus(`Sale failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">ICP Payment Demo</h2>
        <p className="mb-4">Connect your Plug wallet to buy/sell tokens with real ICP payments.</p>
        <button
          onClick={connectWallet}
          disabled={isLoading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Connecting...' : 'Connect Plug Wallet'}
        </button>
        {status && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="text-sm">{status}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">ICP Payment Demo</h2>
      
      <div className="mb-4 p-3 bg-green-100 rounded">
        <p className="text-sm">
          <strong>Connected:</strong> {user.principal.slice(0, 10)}...
          <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded">
            {user.walletType}
          </span>
        </p>
      </div>

      {companies.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Company:</label>
            <select
              value={selectedCompany?.id || ''}
              onChange={(e) => {
                const company = companies.find(c => c.id === parseInt(e.target.value));
                setSelectedCompany(company);
              }}
              className="w-full p-2 border rounded"
            >
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.symbol}) - {company.remaining} tokens available
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Token Amount:</label>
            <input
              type="number"
              min="1"
              max={selectedCompany?.remaining || 1}
              value={tokenAmount}
              onChange={(e) => setTokenAmount(parseInt(e.target.value) || 1)}
              className="w-full p-2 border rounded"
            />
          </div>

          {tokenCost > 0 && (
            <div className="p-3 bg-blue-50 rounded">
              <p className="text-sm">
                <strong>Cost:</strong> {(tokenCost / 100_000_000).toFixed(8)} ICP 
                <span className="text-gray-600 ml-2">({tokenCost} e8s)</span>
              </p>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={buyTokensWithRealICP}
              disabled={isLoading || !selectedCompany || tokenAmount <= 0}
              className="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Buy with ICP'}
            </button>

            <button
              onClick={sellTokensForRealICP}
              disabled={isLoading || !selectedCompany || tokenAmount <= 0}
              className="flex-1 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Sell for ICP'}
            </button>
          </div>

          {status && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <p className="text-sm">{status}</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold text-yellow-800 mb-2">Implementation Notes:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• This demo shows the complete ICP payment flow</li>
              <li>• Real payments require proper canister principal configuration</li>
              <li>• Backend must verify payment blocks on the ICP ledger</li>
              <li>• Platform fees are automatically calculated and included</li>
              <li>• Selling tokens requires backend to transfer ICP to users</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ICPPaymentExample;