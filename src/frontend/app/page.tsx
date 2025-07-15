'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService, AuthUser } from '../services/auth';
import CompanyList from './components/CompanyList';
import LoginModal from './components/LoginModal';

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginType, setLoginType] = useState<'user' | 'company' | null>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && user.isConnected) {
      setCurrentUser(user);
      // Redirect to dashboard immediately if user is already logged in
      router.push('/dashboard');
    }
  }, [router]);

  const handleShowLoginModal = () => {
    setShowLoginModal(true);
    setError('');
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    setLoginType(null);
  };

  const handleLoginAsUser = async () => {
    setLoginType('user');
    setIsConnecting(true);
    setError('');
    try {
      const user = await authService.connectPlug();
      // Set role as user
      const userWithRole = { ...user, role: 'user' as const };
      authService.setUserRole('user');
      setCurrentUser(userWithRole);
      setShowLoginModal(false);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLoginAsCompany = async () => {
    setLoginType('company');
    setIsConnecting(true);
    setError('');
    try {
      const user = await authService.connectPlug();
      // Set role as company
      const userWithRole = { ...user, role: 'company' as const };
      authService.setUserRole('company');
      setCurrentUser(userWithRole);
      setShowLoginModal(false);
      router.push('/create-company');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDemoMode = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const user = await authService.connectDemo();
      setCurrentUser(user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start demo mode');
    } finally {
      setIsConnecting(false);
    }
  };

  // If user is already logged in, they will be redirected in the useEffect

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              ARKS <span className="text-primary">RWA</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Tokenize Real World Assets on the Internet Computer
            </p>
            <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
              Create, trade, and manage tokenized companies with full transparency and security. 
              Built on the Internet Computer for true decentralization.
            </p>

            {/* Connection Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {isConnecting ? 'Connecting...' : 'Connect with Plug'}
              </button>

              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="flex items-center gap-3 px-8 py-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Internet Identity
              </button>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-900/20 border border-red-500 rounded-lg max-w-md mx-auto">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            <p className="text-sm text-gray-500">
              Need help connecting? Make sure your Plug wallet extension is installed and unlocked.
            </p>
          </div>
        </div>
      </div>

      {/* Companies Section */}
      <CompanyList />

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Why Choose ARKS RWA?</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Experience the future of asset tokenization with cutting-edge technology and user-friendly design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-card-bg border border-gray-700 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Secure & Decentralized</h3>
            <p className="text-gray-400">
              Built on the Internet Computer with end-to-end encryption and decentralized governance.
            </p>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Real-Time Trading</h3>
            <p className="text-gray-400">
              Trade tokenized assets instantly with dynamic pricing and real-time market updates.
            </p>
          </div>

          <div className="bg-card-bg border border-gray-700 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Company Management</h3>
            <p className="text-gray-400">
              Create and manage tokenized companies with comprehensive tools and analytics.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-800/50 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              Join the future of asset tokenization. Connect your wallet and start trading today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Get Started
              </button>
              <button
                onClick={() => router.push('/companies')}
                className="px-8 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Explore Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={handleCloseLoginModal}
        onLoginAsUser={handleLoginAsUser}
        onLoginAsCompany={handleLoginAsCompany}
        isConnecting={isConnecting}
      />
    </div>
  );
}