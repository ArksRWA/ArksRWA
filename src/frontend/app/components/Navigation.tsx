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
    return pathname === path;
  };

  const NavLink = ({ href, children, icon }: { href: string; children: React.ReactNode; icon: React.ReactNode }) => (
    <button
      onClick={() => router.push(href)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isActivePath(href)
          ? 'bg-primary text-white'
          : 'text-gray-300 hover:text-white hover:bg-gray-700'
      }`}
    >
      {icon}
      <span className="font-medium">{children}</span>
    </button>
  );

  const UserDropdown = () => (
    <div className="relative group">
      <button className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-medium">
            {currentUser?.principal.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="text-left">
          <div className="text-sm font-medium text-white">
            {currentUser?.principal.slice(0, 10)}...
          </div>
          <div className="text-xs text-gray-400">
            {currentUser?.walletType}
          </div>
        </div>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div className="absolute right-0 mt-2 w-48 bg-card-bg border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="p-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Dashboard
          </button>
          <button
            onClick={() => router.push('/companies')}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            My Companies
          </button>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-card-bg border-b border-gray-700 ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-white hover:text-primary transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="text-xl font-bold">ARKS RWA</span>
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

                <div className="w-px h-6 bg-gray-700 mx-2"></div>
                
                <UserDropdown />
              </>
            ) : (
              <button
                onClick={handleShowLoginModal}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
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