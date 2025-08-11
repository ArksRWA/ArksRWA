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

  // If user is already logged in, they will be redirected in the useEffect

  return (
    <div className="min-h-screen bg-gradient-primary relative">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-blue/10 rounded-full blur-3xl animate-float" style={{animationDelay: '3s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-purple/5 rounded-full blur-3xl animate-float" style={{animationDelay: '6s'}}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
          <div className="text-center animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight bg-gradient-text bg-clip-text text-transparent">
              ARKS RWA
            </h1>
            <p className="text-xl md:text-3xl text-foreground-secondary mb-8 max-w-4xl mx-auto font-medium leading-relaxed">
              Tokenize Real World Assets on the Internet Computer
            </p>
            <p className="text-lg text-foreground-muted mb-16 max-w-3xl mx-auto leading-relaxed">
              Create, trade, and manage tokenized companies with full transparency and security.
              Built on the Internet Computer for true decentralization.
            </p>

            {/* Connection Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="group relative flex items-center gap-3 px-10 py-5 bg-primary text-white rounded-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed min-w-[240px] font-semibold shadow-glow transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="relative z-10">
                  {isConnecting ? 'Connecting...' : 'Connect with Plug'}
                </span>
              </button>
              
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="group relative flex items-center gap-3 px-10 py-5 bg-card-bg backdrop-blur-sm border border-card-border text-foreground rounded-2xl hover:bg-card-bg-hover hover:border-card-border-hover hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed min-w-[240px] font-semibold transition-all duration-300"
              >
                <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="relative z-10">Internet Identity</span>
              </button>
            </div>

            {error && (
              <div className="mb-12 p-6 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-3xl max-w-md mx-auto animate-scale-in">
                <p className="text-red-400 font-medium">{error}</p>
              </div>
            )}

            <p className="text-sm text-foreground-muted animate-fade-in" style={{animationDelay: '0.5s'}}>
              Need help connecting? Make sure your Plug wallet extension is installed and unlocked.
            </p>
          </div>
        </div>
      </div>

      {/* Companies Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="text-center mb-16 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
          <h2 className="text-4xl font-bold text-foreground mb-6">Trending Companies</h2>
          <p className="text-foreground-muted max-w-3xl mx-auto text-lg leading-relaxed">
            Discover and invest in tokenized companies. View real-time pricing and market data with our advanced trading platform.
          </p>
        </div>
        <div className="animate-fade-in-up" style={{animationDelay: '0.4s'}}>
          <CompanyList />
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="text-center mb-20 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
          <h2 className="text-4xl font-bold text-foreground mb-6">Why Choose ARKS RWA?</h2>
          <p className="text-foreground-muted max-w-3xl mx-auto text-lg leading-relaxed">
            Experience the future of asset tokenization with cutting-edge technology and user-friendly design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="modern-card p-10 text-center group animate-fade-in-up hover-float" style={{animationDelay: '0.4s'}}>
            <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-primary/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">Secure & Decentralized</h3>
            <p className="text-foreground-muted leading-relaxed text-lg">
              Built on the Internet Computer with end-to-end encryption and decentralized governance.
            </p>
          </div>

          <div className="modern-card p-10 text-center group animate-fade-in-up hover-float" style={{animationDelay: '0.5s'}}>
            <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-primary/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">Real-Time Trading</h3>
            <p className="text-foreground-muted leading-relaxed text-lg">
              Trade tokenized assets instantly with dynamic pricing and real-time market updates.
            </p>
          </div>

          <div className="modern-card p-10 text-center group animate-fade-in-up hover-float" style={{animationDelay: '0.6s'}}>
            <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-primary/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">Company Management</h3>
            <p className="text-foreground-muted leading-relaxed text-lg">
              Create and manage tokenized companies with comprehensive tools and analytics.
            </p>
          </div>
        </div>
      </div>


      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent-blue/10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <div className="text-center animate-fade-in-up" style={{animationDelay: '0.5s'}}>
            <h2 className="text-4xl font-bold text-foreground mb-6">Ready to Get Started?</h2>
            <p className="text-foreground-muted mb-12 max-w-3xl mx-auto text-lg leading-relaxed">
              Join the future of asset tokenization. Connect your wallet and start trading today with our advanced platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="group relative px-10 py-4 bg-gradient-button text-white rounded-2xl hover:scale-105 transition-all duration-300 disabled:opacity-50 font-semibold shadow-glow overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <span className="relative z-10">Get Started</span>
              </button>
              <button
                onClick={() => router.push('/companies')}
                className="px-10 py-4 bg-card-bg backdrop-blur-sm border border-card-border text-foreground rounded-2xl hover:bg-card-bg-hover hover:border-card-border-hover hover:scale-105 transition-all duration-300 font-semibold"
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