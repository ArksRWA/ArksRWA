'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authService, AuthUser } from '../../services/auth';
import LoginModal from './LoginModal';

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'company' | undefined>(undefined);

  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      const authenticated = authService.isAuthenticated();
      const role = authService.getUserRole();
      setCurrentUser(user);
      setIsAuthenticated(authenticated);
      setUserRole(role);
    };

    checkAuth();

    // Check auth state periodically
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = () => {
    authService.disconnect();
    setCurrentUser(null);
    setIsAuthenticated(false);
    router.push('/');
  };

  const handleShowLoginModal = () => {
    setShowLoginModal(true);
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
  };

  const handleLoginAsUser = async () => {
    setIsConnecting(true);
    try {
      const user = await authService.connectPlug();
      // Set role as user
      authService.setUserRole('user');
      const userWithRole = { ...user, role: 'user' as const };
      setCurrentUser(userWithRole);
      setIsAuthenticated(true);
      setUserRole('user');
      setShowLoginModal(false);
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLoginAsCompany = async () => {
    setIsConnecting(true);
    try {
      const user = await authService.connectPlug();
      // Set role as company
      authService.setUserRole('company');
      const userWithRole = { ...user, role: 'company' as const };
      setCurrentUser(userWithRole);
      setIsAuthenticated(true);
      setUserRole('company');
      setShowLoginModal(false);
      router.push('/create-company');
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const isActivePath = (path: string) => {
    const normalizedPathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const isMatch = normalizedPathname === normalizedPath;
    console.log('Current pathname:', pathname, 'Normalized:', normalizedPathname, 'Checking path:', path, 'Normalized:', normalizedPath, 'Match:', isMatch);
    return isMatch;
  };

  const NavLink = ({ href, children, icon }: { href: string; children: React.ReactNode; icon: React.ReactNode }) => (
    <button
      onClick={() => router.push(href)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm relative overflow-hidden group ${
        isActivePath(href)
          ? 'text-white shadow-glow'
          : 'text-foreground-secondary hover:text-foreground hover:bg-card-bg backdrop-blur-sm border border-transparent hover:border-card-border'
      }`}
      style={isActivePath(href) ? { 
        backgroundColor: '#10b981',
        color: 'white'
      } : {}}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10">{children}</span>
    </button>
  );

  const UserDropdown = () => (
    <div className="relative group">
      <button className="flex items-center gap-4 px-4 py-3 rounded-2xl text-foreground-secondary hover:text-foreground hover:bg-card-bg backdrop-blur-sm border border-transparent hover:border-card-border transition-all duration-300">
        <div className="w-10 h-10 rounded-full bg-gradient-button flex items-center justify-center shadow-glow">
          <span className="text-white font-bold text-sm">
            {currentUser?.principal.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold text-foreground">
            {currentUser?.principal.slice(0, 10)}...
          </div>
          <div className="text-xs text-foreground-muted">
            {currentUser?.walletType}
          </div>
        </div>
        <svg className="w-4 h-4 transition-transform group-hover:rotate-180 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div className="absolute right-0 mt-3 w-56 bg-card-bg backdrop-blur-xl border border-card-border rounded-2xl shadow-dark-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 overflow-hidden">
        <div className="p-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-foreground-secondary hover:text-foreground hover:bg-card-bg-hover rounded-xl transition-all duration-200 group/item"
          >
            <svg className="w-5 h-5 group-hover/item:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => router.push('/companies')}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-foreground-secondary hover:text-foreground hover:bg-card-bg-hover rounded-xl transition-all duration-200 group/item"
          >
            <svg className="w-5 h-5 group-hover/item:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="font-medium">My Companies</span>
          </button>
          <div className="h-px bg-card-border my-2"></div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200 group/item"
          >
            <svg className="w-5 h-5 group-hover/item:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Disconnect</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-card-bg/90 backdrop-blur-2xl border-b border-card-border/50 ${className}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 text-foreground hover:text-primary transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-button flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">ARKS RWA</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <NavLink
                  href="/dashboard"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  }
                >
                  Dashboard
                </NavLink>
                
                <NavLink
                  href="/companies"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  }
                >
                  Companies
                </NavLink>
                
                <NavLink
                  href="/transactions"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  }
                >
                  Transactions
                </NavLink>
                
                <NavLink
                  href="/transfer"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  }
                >
                  Transfer
                </NavLink>
                
                {/* Only show Create Company for company role */}
                {userRole !== 'user' && (
                  <NavLink
                    href="/create-company"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    }
                  >
                    Create Company
                  </NavLink>
                )}

                <div className="w-px h-8 bg-card-border mx-4"></div>
                
                <UserDropdown />
              </>
            ) : (
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="group relative flex items-center gap-3 px-6 py-3 bg-primary text-white rounded-2xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-glow overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="relative z-10">{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            )}
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
    </nav>
  );
}