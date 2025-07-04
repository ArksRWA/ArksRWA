export interface AuthUser {
  principal: string;
  agent?: any;
  isConnected: boolean;
  walletType: 'plug' | 'internet-identity' | 'demo';
}

export interface AuthService {
  connectPlug(): Promise<AuthUser>;
  connectInternetIdentity(): Promise<AuthUser>;
  disconnect(): void;
  getCurrentUser(): AuthUser | null;
  isAuthenticated(): boolean;
}

class AuthServiceImpl implements AuthService {
  private currentUser: AuthUser | null = null;
  private readonly canisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  private readonly host = "https://icp0.io";

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
    console.log("User disconnected");
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentUser.isConnected;
  }
}

// Export singleton instance
export const authService = new AuthServiceImpl();