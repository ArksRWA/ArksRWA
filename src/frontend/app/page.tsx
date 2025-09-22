'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService, AuthUser } from '../services/auth';
import { verificationScheduler } from '../services/verificationScheduler';
import CompanyList from './components/CompanyList';
import LoginModal from './components/LoginModal';
import ScaledAppImage from '@/components/ScaledAppImage';

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginType, setLoginType] = useState<'user' | 'company' | null>(null);
  const [loginContext, setLoginContext] = useState<'company-view' | 'general'>('general');
  const [verificationStatus, setVerificationStatus] = useState<{
    isRunning: boolean;
    activeVerifications: number[];
    nextRunInHours: number | null;
    currentIndonesianTime: Date | null;
    lastScheduledRun: Date | null;
  }>({ 
    isRunning: false, 
    activeVerifications: [], 
    nextRunInHours: null, 
    currentIndonesianTime: null,
    lastScheduledRun: null 
  });

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && user.isConnected) {
      setCurrentUser(user);
      // Redirect to appropriate dashboard based on user role
      const userRole = authService.getUserRole();
      const dashboardPath = userRole === 'company' ? '/company-dashboard' : '/dashboard';
      router.push(dashboardPath);
    }

    // Start daily verification scheduler when app loads
    console.log('🚀 Starting daily verification scheduler...');
    verificationScheduler.start();

    // Update verification status periodically
    const statusInterval = setInterval(() => {
      const status = verificationScheduler.getStatus();
      setVerificationStatus({
        isRunning: status.isRunning,
        activeVerifications: status.activeVerifications,
        nextRunInHours: status.nextRunInHours,
        currentIndonesianTime: status.currentIndonesianTime,
        lastScheduledRun: status.lastScheduledRun,
      });
    }, 60000); // Update every minute

    // Initial status check
    const initialStatus = verificationScheduler.getStatus();
    setVerificationStatus({
      isRunning: initialStatus.isRunning,
      activeVerifications: initialStatus.activeVerifications,
      nextRunInHours: initialStatus.nextRunInHours,
      currentIndonesianTime: initialStatus.currentIndonesianTime,
      lastScheduledRun: initialStatus.lastScheduledRun,
    });

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      // Note: We don't stop the scheduler here as it should run globally
      // verificationScheduler.stop();
    };
  }, [router]);

  const handleShowLoginModal = (context: 'company-view' | 'general' = 'general') => {
    setLoginContext(context);
    setShowLoginModal(true);
    setError('');
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    setLoginType(null);
    setLoginContext('general');
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

  // Manual verification trigger (for development/admin)
  const handleManualVerificationCheck = async () => {
    try {
      console.log('Triggering manual verification check...');
      await verificationScheduler.triggerManualCheck();
      
      // Update status immediately after manual trigger
      const status = verificationScheduler.getStatus();
      setVerificationStatus({
        isRunning: status.isRunning,
        activeVerifications: status.activeVerifications,
        nextRunInHours: status.nextRunInHours,
        currentIndonesianTime: status.currentIndonesianTime,
        lastScheduledRun: status.lastScheduledRun,
      });
    } catch (error) {
      console.error('Manual verification check failed:', error);
    }
  };

  // If user is already logged in, they will be redirected in the useEffect

  return (
    <div className="min-h-screen bg-gradient-primary relative">
      {/* Daily Verification Scheduler Status */}
      {verificationStatus.isRunning && process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 z-50 bg-card-bg backdrop-blur-sm border border-card-border rounded-xl p-4 text-sm text-foreground shadow-lg min-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Daily Verification Scheduler</span>
          </div>
          
          <div className="space-y-1 text-xs text-foreground-muted">
            <div className="flex justify-between">
              <span>Schedule:</span>
              <span className="text-foreground">Midnight WIB (UTC+7)</span>
            </div>
            
            {verificationStatus.nextRunInHours !== null && (
              <div className="flex justify-between">
                <span>Next run:</span>
                <span className="text-foreground">
                  {verificationStatus.nextRunInHours < 1 
                    ? 'Soon' 
                    : `${verificationStatus.nextRunInHours}h`
                  }
                </span>
              </div>
            )}
            
            {verificationStatus.activeVerifications.length > 0 && (
              <div className="flex justify-between">
                <span>Active:</span>
                <span className="text-yellow-400 font-medium">
                  {verificationStatus.activeVerifications.length} verifications
                </span>
              </div>
            )}
            
            {verificationStatus.lastScheduledRun && (
              <div className="flex justify-between">
                <span>Last run:</span>
                <span className="text-foreground">
                  {new Date(verificationStatus.lastScheduledRun).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <button 
              onClick={handleManualVerificationCheck}
              className="text-xs text-primary hover:text-primary-hover mt-2 underline cursor-pointer w-full text-center"
            >
              🔧 Trigger Manual Check
            </button>
          )}
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-blue-900/10 to-purple-900/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-green-500/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '4s'}}></div>
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
            <div className="hidden flex flex-wrap justify-center gap-6 mb-12 text-sm text-foreground-muted">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Fully Decentralized</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Real-time Trading</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Zero Gas Fees</span>
              </div>
            </div>
            {/* Connection Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <button
                onClick={() => handleShowLoginModal()}
                disabled={isConnecting}
                className="group relative flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed min-w-[240px] font-semibold shadow-2xl transition-all duration-300 overflow-hidden"
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
                onClick={() => handleShowLoginModal()}
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

      {/* Debug: Canister Information Section */}
      {process.env.NODE_ENV === 'development' && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-blue-900/10 to-purple-900/20"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
            <ScaledAppImage />
          </div>
        </div>
      )}

      {/* Companies Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-blue-900/10 to-purple-900/20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="text-center mb-16 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
          <h2 className="text-4xl font-bold text-foreground mb-6">Trending Companies</h2>
          <p className="text-foreground-muted max-w-3xl mx-auto text-lg leading-relaxed">
            Discover and invest in tokenized companies. View real-time pricing and market data with our advanced trading platform.
          </p>
        </div>
          <div className="animate-fade-in-up" style={{animationDelay: '0.4s'}}>
            <CompanyList onViewCompanyClick={() => handleShowLoginModal('company-view')} />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-blue-900/10 to-purple-900/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-green-500/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center animate-fade-in-up" style={{animationDelay: '0.5s'}}>
            {/* Left Content */}
            <div className="text-left">
              <div className="inline-flex items-center px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
                <span className="text-sm font-medium text-green-400">⚡ Ready in under 1 minute</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                Join the <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">Revolution</span>
              </h2>
              <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                Be part of the next generation of financial infrastructure. Start tokenizing real world assets with zero fees and instant settlements.
              </p>
              
              {/* Benefits List */}
              <div className="space-y-3 mb-8">
                {[
                  { icon: "⚡", text: "Connect wallet & start trading instantly" },
                  { icon: "🔒", text: "100% decentralized & secure" },
                  { icon: "💰", text: "Zero gas fees on all transactions" }
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xl">{benefit.icon}</span>
                    <span className="text-gray-300">{benefit.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => handleShowLoginModal()}
                  disabled={isConnecting}
                  className="group relative px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 font-bold shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <span className="relative z-10 flex items-center gap-2">
                    Launch App
                  </span>
                </button>
                <button
                  onClick={() => router.push('/companies')}
                  className="hidden px-8 py-4 bg-transparent border-2 border-gray-600 hover:border-green-500 text-gray-300 hover:text-green-400 rounded-xl hover:bg-green-500/5 transition-all duration-300 font-semibold"
                >
                  📈 View Market
                </button>
              </div>
            </div>
            
            {/* Right Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-400 text-sm ml-4">ARKS RWA Trading Interface</span>
                </div>
                
                {/* Mock Trading Interface */}
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-semibold">💻 TechCorp</span>
                      <span className="text-green-400">+12.5%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>$125.50</span>
                      <span>24h Volume: $2.1M</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-semibold">🌱 GreenEnergy</span>
                      <span className="text-green-400">+8.3%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>$89.25</span>
                      <span>24h Volume: $1.8M</span>
                    </div>
                  </div>
                  
                  <button className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold">
                    Start Trading →
                  </button>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-green-500/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-blue-500/20 rounded-full blur-xl animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-blue-900/10 to-purple-900/20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="text-center mb-20 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
          <h2 className="text-4xl font-bold text-foreground mb-6">Why Choose ARKS RWA?</h2>
          <p className="text-foreground-muted max-w-3xl mx-auto text-lg leading-relaxed">
            Experience the future of asset tokenization with cutting-edge technology and user-friendly design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="modern-card p-10 text-center group animate-fade-in-up hover-float" style={{animationDelay: '0.4s'}}>
            <div className="w-20 h-20 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-gradient-to-r group-hover:from-green-500/30 group-hover:to-green-600/30 group-hover:scale-110 transition-all duration-300">
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
            <div className="w-20 h-20 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-gradient-to-r group-hover:from-green-500/30 group-hover:to-green-600/30 group-hover:scale-110 transition-all duration-300">
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
              <div className="w-20 h-20 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-gradient-to-r group-hover:from-green-500/30 group-hover:to-green-600/30 group-hover:scale-110 transition-all duration-300">
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
      </div>


      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-blue-900/10 to-purple-900/20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <div className="text-center animate-fade-in-up" style={{animationDelay: '0.5s'}}>
            <h2 className="text-4xl font-bold text-foreground mb-6">Ready to Get Started?</h2>
            <p className="text-foreground-muted mb-12 max-w-3xl mx-auto text-lg leading-relaxed">
              Join the future of asset tokenization. Connect your wallet and start trading today with our advanced platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button
                onClick={() => handleShowLoginModal()}
                disabled={isConnecting}
                className="group relative px-10 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-2xl hover:scale-105 transition-all duration-300 disabled:opacity-50 font-semibold shadow-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <span className="relative z-10">Get Started</span>
              </button>
              <button
                onClick={() => router.push('/companies')}
                className="hidden px-10 py-4 bg-card-bg backdrop-blur-sm border border-card-border text-foreground rounded-2xl hover:bg-card-bg-hover hover:border-card-border-hover hover:scale-105 transition-all duration-300 font-semibold"
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
        context={loginContext}
      />
    </div>
  );
}