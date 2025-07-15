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
  private readonly canisterId = getCanisterId('arks_rwa_backend');
  private readonly host = HOST;
  private userRole: 'user' | 'company' | undefined = undefined;

  async connectPlug(): Promise<AuthUser> {
    try {
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
        console.log("Plug wallet connected successfully with ic-auth!");
        return authUser;
      } else {
        throw new Error("Failed to get user object from Plug");
      }

    } catch (e: any) {
      console.error("Plug connection failed:", e);

      // Fallback to demo mode
      const demoUser: AuthUser = {
        principal: "demo-plug-" + Math.random().toString(36).substring(2, 11),
        isConnected: true,
        walletType: 'demo'
      };

      this.currentUser = demoUser;
      console.log("Falling back to demo mode for Plug");
      return demoUser;
    }
  }

  async connectInternetIdentity(): Promise<AuthUser> {
    try {
      // Dynamic import to avoid SSR issues
      const { IdentityLogin } = await import('ic-auth');

      const user = await IdentityLogin(this.host);

      if (user && user.principal) {
        const authUser: AuthUser = {
          principal: typeof user.principal === 'string' ? user.principal : String(user.principal),
          agent: user.agent,
          isConnected: true,
          walletType: 'internet-identity'
        };

        this.currentUser = authUser;
        console.log("Internet Identity connected successfully with ic-auth!");
        return authUser;
      } else {
        throw new Error("Failed to get user object from Internet Identity");
      }

    } catch (e: any) {
      console.error("Internet Identity connection failed:", e);

      // Fallback to demo mode
      const demoUser: AuthUser = {
        principal: "demo-ii-" + Math.random().toString(36).substring(2, 11),
        isConnected: true,
        walletType: 'demo'
      };

      this.currentUser = demoUser;
      console.log("Falling back to demo mode for Internet Identity");
      return demoUser;
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
    // We need to import this dynamically to avoid circular dependency
    import('./backend').then(({ backendService }) => {
      backendService.disconnect();
    });
  }

  getCurrentUser(): AuthUser | null {
    if (this.currentUser && !this.currentUser.role) {
      // Add role to current user if not present
      const role = this.getUserRole();
      if (role) {
        this.currentUser.role = role;
      }
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentUser.isConnected;
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

  // Demo mode function for testing without wallet
  async connectDemo(): Promise<AuthUser> {
    const demoUser: AuthUser = {
      principal: "demo-user-" + Math.random().toString(36).substring(2, 11),
      isConnected: true,
      walletType: 'demo'
    };

    this.currentUser = demoUser;
    console.log("Demo mode activated:", demoUser.principal);
    return demoUser;
  }
}

// Export singleton instance
export const authService = new AuthServiceImpl();