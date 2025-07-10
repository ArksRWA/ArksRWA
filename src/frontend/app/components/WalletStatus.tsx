'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService, AuthUser } from '../../services/auth';
import { isLocal, shouldUseRealWallet } from '../../config/canister';

interface WalletStatusProps {
  showBalance?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export default function WalletStatus({ 
  showBalance = false, 
  showActions = true, 
  compact = false 
}: WalletStatusProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      setCurrentUser(user);
    };

    checkAuth();
    
    // Check auth state periodically
    const interval = setInterval(checkAuth, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectPlug = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const user = await authService.connectPlug();
      setCurrentUser(user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectII = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const user = await authService.connectInternetIdentity();
      setCurrentUser(user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    authService.disconnect();
    setCurrentUser(null);
    router.push('/');
  };

  if (!currentUser) {
    return (
      <div className={`bg-card-bg border border-gray-700 rounded-lg p-4 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="text-center">
          <h3 className={`font-semibold text-white mb-2 ${compact ? 'text-sm' : 'text-lg'}`}>
            Connect Your Wallet
          </h3>
          <p className={`text-gray-400 mb-4 ${compact ? 'text-xs mb-3' : 'text-sm mb-4'}`}>
            Connect a wallet to start trading and managing your assets
          </p>
          
          <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row'}`}>
            <button
              onClick={handleConnectPlug}
              disabled={isConnecting}
              className={`flex items-center justify-center gap-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 ${
                compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isConnecting ? 'Connecting...' : 'Plug Wallet'}
            </button>
            
            <button
              onClick={handleConnectII}
              disabled={isConnecting}
              className={`flex items-center justify-center gap-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 ${
                compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Internet Identity
            </button>
          </div>
          
          {error && (
            <div className="mt-3 p-2 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card-bg border border-gray-700 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-medium">
              {currentUser.principal.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <div className={`font-medium text-white ${compact ? 'text-sm' : ''}`}>
              {currentUser.principal.slice(0, 12)}...
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                currentUser.walletType === 'demo' || !shouldUseRealWallet()
                  ? 'bg-yellow-900/20 text-yellow-400'
                  : currentUser.walletType === 'plug'
                  ? 'bg-blue-900/20 text-blue-400'
                  : 'bg-green-900/20 text-green-400'
              }`}>
                {currentUser.walletType === 'demo' || !shouldUseRealWallet() ? 'Demo Mode' :
                 currentUser.walletType === 'plug' ? 'Plug Wallet' :
                 'Internet Identity'}
              </span>
              {currentUser.walletType !== 'demo' && shouldUseRealWallet() && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="text-xs text-green-400">Live</span>
                </div>
              )}
              {!shouldUseRealWallet() && currentUser.walletType !== 'demo' && (
                <span className="text-xs text-yellow-400">
                  (Local Dev)
                </span>
              )}
            </div>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className={`bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors ${
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={handleDisconnect}
              className={`bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors ${
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
              }`}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
      
      {(currentUser.walletType === 'demo' || !shouldUseRealWallet()) && (
        <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-500 rounded">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-yellow-400 text-xs">
              {!shouldUseRealWallet() && currentUser.walletType !== 'demo'
                ? (
                  <div>
                    <div>Local development - Real ICP transactions disabled</div>
                    <div className="text-gray-500 mt-1">Set FORCE_REAL_WALLET=true in config to enable real wallet</div>
                  </div>
                )
                : 'Demo mode - Connect a real wallet for actual ICP transactions'
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}