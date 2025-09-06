import { getCanisterId, HOST } from '../config/canister';
import type { AuthUser, AuthService } from '../types/canister';

// Re-export types for convenience
export type { AuthUser, AuthService } from '../types/canister';

// Extend Window interface for Plug wallet
declare global {
  interface Window {
    ic?: {
      plug?: {
        requestConnect: (options?: any) => Promise<any>;
        agent: any;
        principal: any;
        accountId: string;
      };
    };
  }
}

class AuthServiceImpl implements AuthService {
  private currentUser: AuthUser | null = null;
  private readonly canisterId = getCanisterId('arks_core');
  private readonly host = HOST;
  private userRole: 'user' | 'company' | undefined = undefined;

  async connectPlug(): Promise<AuthUser> {
    // Check if Plug wallet is available
    if (!window.ic?.plug) {
      throw new Error("Plug wallet not detected");
    }

    // Dynamic import to avoid SSR issues
    const { PlugLogin } = await import('ic-auth');

    const whitelist = [this.canisterId];
    const user = await PlugLogin(whitelist, this.host);

    if (user && user.principal) {
      const authUser: AuthUser = {
        principal: typeof user.principal === 'string' ? user.principal : String(user.principal),
        agent: user.agent,
        isConnected: true,
        walletType: 'plug'
      };

      this.currentUser = authUser;
      
      // Persist user session in localStorage
      try {
        localStorage.setItem('arks-rwa-auth', JSON.stringify({
          principal: authUser.principal,
          isConnected: authUser.isConnected,
          walletType: authUser.walletType
        }));
      } catch (e) {
        console.warn('Failed to store auth in local storage:', e);
      }
      
      console.log("Plug wallet connected successfully with ic-auth!");
      return authUser;
    } else {
      throw new Error("Failed to get user object from Plug");
    }
  }

  disconnect(): void {
    this.currentUser = null;
    this.userRole = undefined;
    console.log("User disconnected");

    // Clear any stored session data
    try {
      localStorage.removeItem('arks-rwa-auth');
      localStorage.removeItem('arks-rwa-role');
    } catch (e) {
      console.warn('Failed to clear local storage:', e);
    }

    // Clear backend service cache when user disconnects
    import('./backend').then(({ backendService }) => {
      backendService.disconnect();
    });
  }

  getCurrentUser(): AuthUser | null {
    // Try to restore session if user is null but localStorage has data
    if (!this.currentUser) {
      this.restoreSession();
    }
    
    if (this.currentUser && !this.currentUser.role) {
      // Add role to current user if not present
      const role = this.getUserRole();
      if (role) {
        this.currentUser.role = role;
      }
    }
    return this.currentUser;
  }

  private restoreSession(): void {
    try {
      const storedAuth = localStorage.getItem('arks-rwa-auth');
      
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        
        // Validate that the stored wallet is actually available in current tab
        const walletAvailable = this.isWalletAvailable(authData.walletType);
        
        if (!walletAvailable) {
          // Wallet not available, clear session silently
          localStorage.removeItem('arks-rwa-auth');
          localStorage.removeItem('arks-rwa-role');
          return;
        }
        
        // Recreate user object with session state (agent will be recreated on demand)
        this.currentUser = {
          principal: authData.principal,
          agent: null, // Will be recreated on first blockchain call
          isConnected: true, // Session is valid, but may need wallet reconnection for transactions
          walletType: authData.walletType || 'plug',
          sessionRestored: true // Flag to indicate this is a restored session
        };
      }
    } catch (e) {
      console.warn('Failed to restore session from local storage:', e);
      // Clear corrupted data
      localStorage.removeItem('arks-rwa-auth');
    }
  }

  private isWalletAvailable(walletType: string): boolean {
    switch (walletType) {
      case 'plug':
        return !!(window.ic?.plug);
      default:
        return false;
    }
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentUser.isConnected;
  }

  // Recreate agent if session was restored and agent is needed for blockchain calls
  async ensureAgent(): Promise<boolean> {
    if (!this.currentUser || this.currentUser.agent) {
      return !!this.currentUser?.agent;
    }

    if (this.currentUser.sessionRestored) {
      try {
        // Attempt to reconnect the wallet silently
        if (this.currentUser.walletType === 'plug' && window.ic?.plug) {
          // Try to get existing connection without user prompt
          const connected = await window.ic.plug.agent;
          if (connected) {
            this.currentUser.agent = connected;
            this.currentUser.sessionRestored = false;
            return true;
          }
        }
      } catch (e) {
        console.warn('Failed to restore agent silently:', e);
      }
    }

    return false;
  }

  setUserRole(role: 'user' | 'company'): void {
    this.userRole = role;
    if (this.currentUser) {
      this.currentUser.role = role;
    }

    try {
      localStorage.setItem('arks-rwa-role', role);
    } catch (e) {
      console.warn('Failed to store role in local storage:', e);
    }
  }

  getUserRole(): 'user' | 'company' | undefined {
    if (!this.userRole) {
      try {
        const storedRole = localStorage.getItem('arks-rwa-role') as 'user' | 'company' | null;
        if (storedRole) {
          this.userRole = storedRole;
        }
      } catch (e) {
        console.warn('Failed to get role from local storage:', e);
      }
    }

    return this.userRole;
  }
}

// Export singleton instance
export const authService = new AuthServiceImpl();