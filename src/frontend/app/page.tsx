'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authService, AuthUser } from '../services/auth';
import { verificationScheduler } from '../services/verificationScheduler';
import CompanyList from './components/CompanyList';
import LoginModal from './components/LoginModal';
import { CANISTER_IDS, NETWORK, HOST, getCurrentCanisterIds } from '../config/canister';

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginType, setLoginType] = useState<'user' | 'company' | null>(null);
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
      // Redirect to dashboard immediately if user is already logged in
      router.push('/dashboard');
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
      router.push('/company-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
      <div className="pt-16 min-h-screen bg-background-dark text-text-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <span className="material-icons-outlined text-primary">layers</span>
              <span className="font-bold text-lg">ARKS RWA</span>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex items-center space-x-6">
                <a className="text-sm font-medium text-subtext-dark hover:text-text-dark transition-colors" href="#features">Features</a>
                <a className="text-sm font-medium text-subtext-dark hover:text-text-dark transition-colors" href="#how-it-works">How It Works</a>
                <a className="text-sm font-medium text-subtext-dark hover:text-text-dark transition-colors" href="#why-us">Why Us</a>
                <a className="text-sm font-medium text-subtext-dark hover:text-text-dark transition-colors" href="#faq">FAQ</a>
              </nav>
              <button 
                onClick={handleShowLoginModal}
                className="bg-primary hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <span className="material-icons-outlined text-sm">account_balance_wallet</span>
                <span>Connect Wallet</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="min-h-screen bg-background-dark text-text-dark pt-16">
        {/* Hero Section */}
        <section className="pt-32 pb-20 text-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-text-dark mb-4">
              Tokenize Real World Assets on the <span className="text-primary">Internet Computer</span>
            </h1>
            <p className="max-w-3xl mx-auto text-lg text-subtext-dark mb-8">
              Create, trade, and manage tokenized companies with full transparency and security, built on the Internet Computer for true decentralization.
            </p>
            <div className="flex justify-center items-center space-x-4">
              <a 
                className="bg-primary hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center space-x-2 transition-colors" 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleShowLoginModal();
                }}
              >
                <span className="material-icons-outlined">play_circle</span>
                <span>Connect with Plug</span>
              </a>
              <a 
                className="bg-card-dark border border-border-dark hover:bg-gray-700 text-text-dark font-semibold py-3 px-6 rounded-lg flex items-center space-x-2 transition-colors" 
                href="#"
              >
                <span className="material-icons-outlined">fingerprint</span>
                <span>Internet Identity</span>
              </a>
            </div>
            <p className="text-sm text-subtext-dark mt-4">Need help connecting? See how our Plug wallet extension is audited and selected.</p>
          </div>
        </section>

      {/* Dashboard Preview */}
      <section className="pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[1px] rounded-xl shadow-2xl">
            <div className="w-full h-[32rem] bg-card-dark rounded-lg overflow-hidden p-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                <div className="flex items-center space-x-3">
                  <span className="material-icons-outlined text-primary">layers</span>
                  <span className="font-bold text-lg text-white">ARKS RWA</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-subtext-dark">
                  <button className="bg-gray-700 hover:bg-gray-600 rounded px-3 py-1.5 flex items-center space-x-1">
                    <span className="material-icons-outlined text-base">dashboard</span>
                    <span>Dashboard</span>
                  </button>
                  <button className="hover:bg-gray-700 rounded px-3 py-1.5 flex items-center space-x-1">
                    <span className="material-icons-outlined text-base">storefront</span>
                    <span>Companies</span>
                  </button>
                  <button className="hover:bg-gray-700 rounded px-3 py-1.5 flex items-center space-x-1">
                    <span className="material-icons-outlined text-base">swap_horiz</span>
                    <span>Transactions</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full">
                    <span className="material-icons-outlined text-base">notifications</span>
                  </button>
                  <div className="text-sm font-medium bg-gray-900 rounded-full px-4 py-2">0x12...aB56</div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Dashboard</h2>
              <p className="text-subtext-dark mb-6">Welcome back, User! 👋</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-900/50 p-6 rounded-lg">
                  <h3 className="text-subtext-dark text-sm font-medium mb-2">Portfolio</h3>
                  <p className="text-3xl font-bold text-white">$0</p>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg">
                  <h3 className="text-subtext-dark text-sm font-medium mb-2">Invested</h3>
                  <p className="text-3xl font-bold text-white">$0</p>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg">
                  <h3 className="text-subtext-dark text-sm font-medium mb-2">P&amp;L</h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-3xl font-bold text-white">$0</p>
                    <span className="bg-green-900 text-green-400 text-xs font-bold px-2 py-1 rounded-full">+0.00%</span>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Your Holdings</h3>
              <div className="text-center py-8 bg-gray-900/50 rounded-lg">
                <p className="text-subtext-dark mb-4">You don't have any holdings yet.</p>
                <button className="bg-primary hover:bg-green-600 text-white font-semibold py-2 px-5 rounded-lg transition-colors">Browse Companies</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Companies */}
      <section className="py-20 bg-background-dark" id="features">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Trending Companies</h2>
          <p className="max-w-2xl mx-auto text-subtext-dark mb-12"> 
            Discover and invest in tokenized real-world assets. See real-time pricing and market data with our advanced trading platform. 
          </p>
          <div className="text-center py-12 bg-card-dark rounded-xl border border-border-dark">
            <span className="material-icons-outlined text-5xl text-subtext-dark mb-4">storefront</span>
            <p className="text-subtext-dark">No companies available at the moment.</p>
          </div>
        </div>
      </section>

      {/* Join the Revolution */}
      <section className="py-20" id="how-it-works">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-full mb-4">Ready to invest? Get started!</span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Join the <span className="text-primary">Revolution</span></h2>
              <p className="text-subtext-dark text-lg mb-8"> 
                Be part of the next generation of financial infrastructure. Start tokenizing real world assets with zero fees and instant settlement. 
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-start">
                  <span className="material-icons-outlined text-primary mt-1 mr-3">check_circle</span>
                  <span className="text-text-dark">Connect wallet &amp; start trading instantly</span>
                </li>
                <li className="flex items-start">
                  <span className="material-icons-outlined text-primary mt-1 mr-3">check_circle</span>
                  <span className="text-text-dark">Truly decentralized &amp; secure</span>
                </li>
                <li className="flex items-start">
                  <span className="material-icons-outlined text-primary mt-1 mr-3">check_circle</span>
                  <span className="text-text-dark">Zero gas fees on all transactions</span>
                </li>
              </ul>
              <a 
                onClick={handleShowLoginModal}
                className="bg-primary hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors inline-block cursor-pointer"
              >
                Launch App
              </a>
            </div>
            <div className="bg-card-dark p-6 rounded-xl shadow-2xl border border-border-dark">
              <div className="p-4 border-b border-border-dark">
                <h3 className="font-bold">ARKS RWA Funding Interface</h3>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium">TechCorp</div>
                    <div className="text-primary">$500K</div>
                  </div>
                  <div className="w-full bg-background-dark rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-subtext-dark mt-1">
                    <span>75% funded</span>
                    <span>3 days left</span>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium">GreenEnergy</div>
                    <div className="text-primary">$1.2M</div>
                  </div>
                  <div className="w-full bg-background-dark rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-subtext-dark mt-1">
                    <span>40% funded</span>
                    <span>7 days left</span>
                  </div>
                </div>
                
                <button className="w-full py-3 bg-primary hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
                  View All Projects
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose ARKS RWA? */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Why Choose ARKS RWA?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card-dark p-8 rounded-xl border border-border-dark flex flex-col items-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-outlined text-primary text-2xl">security</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Secure & Decentralized</h3>
              <p className="text-subtext-dark text-center">
                Built on the Internet Computer blockchain with enterprise-grade security and true decentralization.
              </p>
            </div>
            <div className="bg-card-dark p-8 rounded-xl border border-border-dark flex flex-col items-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-outlined text-primary text-2xl">bolt</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Real-Time Trading</h3>
              <p className="text-subtext-dark text-center">
                Fast, efficient trading with instant settlement and no gas fees, powered by blockchain technology.
              </p>
            </div>
            <div className="bg-card-dark p-8 rounded-xl border border-border-dark flex flex-col items-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-outlined text-primary text-2xl">business</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Company Management</h3>
              <p className="text-subtext-dark text-center">
                Comprehensive tools for companies to manage their tokenized assets, investors, and compliance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-background-dark border-t border-border-dark">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-card-dark rounded-lg border border-border-dark overflow-hidden">
              <button className="w-full p-4 text-left flex justify-between items-center">
                <span className="font-medium">What is a Real World Asset (RWA)?</span>
                <span className="material-icons-outlined">expand_more</span>
              </button>
            </div>
            
            <div className="bg-card-dark rounded-lg border border-border-dark overflow-hidden">
              <button className="w-full p-4 text-left flex justify-between items-center">
                <span className="font-medium">Why list on the Internet Computer?</span>
                <span className="material-icons-outlined">expand_more</span>
              </button>
            </div>
            
            <div className="bg-card-dark rounded-lg border border-border-dark overflow-hidden">
              <button className="w-full p-4 text-left flex justify-between items-center">
                <span className="font-medium">What is a blockchain?</span>
                <span className="material-icons-outlined">expand_more</span>
              </button>
            </div>
            
            <div className="bg-card-dark rounded-lg border border-border-dark overflow-hidden">
              <button className="w-full p-4 text-left flex justify-between items-center">
                <span className="font-medium">How can I get started?</span>
                <span className="material-icons-outlined">expand_more</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Verification Scheduler Status */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="p-6 bg-card-dark border border-border-dark rounded-xl">
          <h3 className="text-xl font-semibold mb-4">Daily Verification Scheduler Status</h3>
          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${verificationStatus.isRunning ? 'bg-primary' : 'bg-gray-500'}`}></div>
            <span>{verificationStatus.isRunning ? 'Running' : 'Idle'}</span>
          </div>
          {verificationStatus.activeVerifications.length > 0 && (
            <div className="mb-2">
              <span className="text-accent-yellow">Active Verifications: {verificationStatus.activeVerifications.join(', ')}</span>
            </div>
          )}
          {verificationStatus.nextRunInHours !== null && (
            <div className="mb-2">
              <span>Next scheduled run in approximately {verificationStatus.nextRunInHours.toFixed(1)} hours</span>
            </div>
          )}
          {verificationStatus.currentIndonesianTime && (
            <div className="mb-2">
              <span>Current Indonesian Time: {verificationStatus.currentIndonesianTime.toLocaleString()}</span>
            </div>
          )}
          {verificationStatus.lastScheduledRun && (
            <div>
              <span>Last scheduled run: {verificationStatus.lastScheduledRun.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card-dark border-t border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-3 mb-4">
                <span className="material-icons-outlined text-primary text-2xl">layers</span>
                <span className="font-bold text-xl">ARKS RWA</span>
              </div>
              <p className="text-subtext-dark text-sm max-w-xs">The future of real world asset tokenization, built on the Internet Computer.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><a className="text-subtext-dark hover:text-primary" href="#">Browse Assets</a></li>
                <li><a className="text-subtext-dark hover:text-primary" href="#">Dashboard</a></li>
                <li><a className="text-subtext-dark hover:text-primary" href="#">Create Company</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a className="text-subtext-dark hover:text-primary" href="#">Documentation</a></li>
                <li><a className="text-subtext-dark hover:text-primary" href="#">Support</a></li>
                <li><a className="text-subtext-dark hover:text-primary" href="#">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <div className="flex space-x-4">
                <a className="text-subtext-dark hover:text-primary" href="#"><svg aria-hidden="true" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.71v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg></a>
                <a className="text-subtext-dark hover:text-primary" href="#"><svg aria-hidden="true" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12.014c0 4.438 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.031-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.03 1.595 1.03 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12.014C22 6.477 17.523 2 12 2z" fillRule="evenodd"></path></svg></a>
                <a className="text-subtext-dark hover:text-primary" href="#"><svg aria-hidden="true" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2.001C6.486 2.001 2 6.487 2 12.012c0 4.281 2.668 7.91 6.335 9.172.247.164.247.492 0 .656-.247.164-1.233.74-2.875 1.643a.492.492 0 01-.657-.575c.33-1.068.658-2.383.658-2.383s-.33 1.233.082 1.972c2.22-2.794 3.287-4.519 3.287-4.519s-.33.986 0 1.808c.411 1.068.74 1.643.74 1.643s.493-1.479 1.479-3.287c.822-1.808 1.397-3.451 1.397-3.451s.575 1.808 1.15 3.205c.492 1.479.822 2.383.822 2.383s.492-1.315.657-1.808c.165-.493 1.479-4.519 1.479-4.519s-.493 2.3-.493 2.876c0 .493.411.986.411.986s-1.808 3.533-2.055 3.945c-.247.411-.33.575-.33.575s.493-.822.575-1.233c.082-.411.165-.822.165-.822s-2.055 4.519-2.384 5.012a.492.492 0 01-.822 0c-.33-.493-2.383-5.012-2.383-5.012s.082.411.164.822c.082.411.575 1.233.575 1.233s-.082-.164-.33-.575c-.246-.411-2.054-3.533-2.054-3.533s.41.493.41.986c0 .575-.492 2.876-.492 2.876s1.315-4.027 1.479-4.519c.164-.493.822-2.383.822-2.383s.656 1.397 1.15 3.205c.492 1.808 1.15 3.287 1.15 3.287s.33-1.15.74-1.643c.411-.493.082-1.808.082-1.808s.986 1.725 3.205 4.519c.412.657.082.33 0 0s-2.628-1.479-2.875-1.643a.492.492 0 010-.656c3.667-1.262 6.335-4.891 6.335-9.172C22.001 6.487 17.514 2.001 12.012 2.001z"></path></svg></a>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-border-dark pt-8 text-center text-sm text-subtext-dark">
            <p>© 2024 ARKS RWA. All Rights Reserved. Not a financial advice.</p>
          </div>
        </div>
      </footer>
      </main>
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