import { getCanisterId, HOST } from '../config/canister';
import type { AuthUser, AuthService } from '../types/canister';

// Re-export types for convenience
export type { AuthUser, AuthService } from '../types/canister';

// ---- Plug typings (updated) ----
declare global {
  interface Window {
    ic?: {
      plug?: {
        requestConnect: (options?: { whitelist?: string[]; host?: string; timeout?: number }) => Promise<any>;
        isConnected: () => Promise<boolean>;
        disconnect?: () => Promise<void>;
        agent: any | null;
        principalId?: string;
        accountId?: string;
        isWalletLocked?: boolean;
        onExternalDisconnect?: (cb: () => void) => void;
        onLockStateChange?: (cb: (locked: boolean) => void) => void;
      };
    };
  }
}

class AuthServiceImpl implements AuthService {
  private currentUser: AuthUser | null = null;
  private readonly canisterId = getCanisterId('arks_core');
  private readonly host = HOST;
  private userRole: 'user' | 'company' | undefined = undefined;
  private identityCheckInterval: NodeJS.Timeout | null = null;
  private whitelist = [this.canisterId];

  constructor() {
    // Advisory restore (NOT trusted as authenticated until verified)
    this.restoreSession();

    // React to wallet events (revokes / lock state)
    if (window.ic?.plug) {
      window.ic.plug.onExternalDisconnect?.(() => this.disconnect());
      window.ic.plug.onLockStateChange?.((_locked) => {
        // optional: reflect lock state in UI
      });
    }
  }

  // ---------- Public API ----------
  async connectPlug(): Promise<AuthUser> {
    if (!window.ic?.plug) throw new Error('Plug wallet not detected');

    // (1) Ensure live connection (request if needed)
    let connected = await window.ic.plug.isConnected();
    if (!connected) {
      await window.ic.plug.requestConnect({
        whitelist: this.whitelist,
        host: this.host,
        timeout: 50_000,
      });
      connected = await window.ic.plug.isConnected();
    }
    if (!connected) {
      this.disconnect();
      throw new Error('Unable to establish a Plug connection.');
    }

    // (2) Hydrate from live provider (source of truth)
    const principal = window.ic.plug.principalId;
    if (!principal) {
      this.disconnect();
      throw new Error('Plug connected but principalId unavailable.');
    }

    this.currentUser = {
      principal,
      agent: window.ic.plug.agent ?? null,
      isConnected: true,
      walletType: 'plug',
      role: this.getUserRole(),
      sessionRestored: false,
    };

    // (3) Store a minimal advisory hint
    this.writeHint(principal);

    // (4) Start identity checks (optional hardening)
    this.startIdentityCheck();

    console.log('Plug wallet connected successfully.');
    return this.currentUser;
  }

  disconnect(): void {
    try { window.ic?.plug?.disconnect?.(); } catch { /* ignore */ }

    this.currentUser = null;
    this.userRole = undefined;
    this.stopIdentityCheck();
    this.clearStorage();
    console.log('User disconnected');

    // Clear backend service cache when user disconnects
    import('./backend').then(({ backendService }) => backendService.disconnect());
  }

  getCurrentUser(): AuthUser | null {
    if (this.currentUser && !this.currentUser.role) {
      const role = this.getUserRole();
      if (role) this.currentUser.role = role;
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return !!(this.currentUser && this.currentUser.isConnected);
  }

  setUserRole(role: 'user' | 'company'): void {
    this.userRole = role;
    if (this.currentUser) this.currentUser.role = role;
    try { localStorage.setItem('arks-rwa-role', role); } catch (e) {
      console.warn('Failed to store role in local storage:', e);
    }
  }

  getUserRole(): 'user' | 'company' | undefined {
    if (!this.userRole) {
      try {
        const r = localStorage.getItem('arks-rwa-role') as 'user' | 'company' | null;
        if (r === 'user' || r === 'company') this.userRole = r;
      } catch (e) {
        console.warn('Failed to get role from local storage:', e);
      }
    }
    return this.userRole;
  }

  // ---------- Internals ----------
  private writeHint(principal: string) {
    try {
      localStorage.setItem('arks-rwa-auth', JSON.stringify({
        principal,
        walletType: 'plug',
        ts: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to store auth in local storage:', e);
    }
  }

  private clearStorage() {
    try {
      localStorage.removeItem('arks-rwa-auth');
      localStorage.removeItem('arks-rwa-role');
    } catch (e) {
      console.warn('Failed to clear local storage:', e);
    }
  }

  private restoreSession(): void {
    try {
      const raw = localStorage.getItem('arks-rwa-auth');
      if (!raw) return;

      const authData = JSON.parse(raw);
      if (authData?.walletType !== 'plug' || !window.ic?.plug) {
        this.clearStorage();
        return;
      }

      // Do NOT mark as connected yet — verify later
      this.currentUser = {
        principal: String(authData.principal),
        agent: null,
        isConnected: false,
        walletType: 'plug',
        sessionRestored: true,
      };
    } catch (e) {
      console.warn('Failed to restore session from local storage:', e);
      this.clearStorage();
    }
  }

  // Recreate/verify agent if needed just before canister calls
  async ensureAgent(): Promise<boolean> {
    if (!this.currentUser) return false;

    const liveConnected = await window.ic?.plug?.isConnected?.();
    if (this.currentUser.agent && liveConnected) return true;

    if (this.currentUser.sessionRestored && window.ic?.plug) {
      const connected = await window.ic.plug.isConnected();
      if (!connected) return false;

      const principalNow = window.ic.plug.principalId;
      if (!principalNow || principalNow !== this.currentUser.principal) {
        console.warn('Wallet identity changed, clearing old session');
        this.disconnect();
        return false;
      }

      this.currentUser.agent = window.ic.plug.agent ?? null;
      this.currentUser.isConnected = true;
      this.currentUser.sessionRestored = false;
      return !!this.currentUser.agent;
    }

    return false;
  }

  // Periodic identity verification (detect account switch/revoke)
  private startIdentityCheck(): void {
    this.stopIdentityCheck();
    if (typeof window === 'undefined') return;
    this.identityCheckInterval = setInterval(async () => {
      await this.verifyCurrentIdentity();
    }, 5000);
  }

  private stopIdentityCheck(): void {
    if (this.identityCheckInterval) {
      clearInterval(this.identityCheckInterval);
      this.identityCheckInterval = null;
    }
  }

  private async verifyCurrentIdentity(): Promise<void> {
    if (!this.currentUser) return;
    if (!window.ic?.plug) { this.disconnect(); return; }

    try {
      const connected = await window.ic.plug.isConnected();
      const livePrincipal = window.ic.plug.principalId;
      if (!connected || !livePrincipal || livePrincipal !== this.currentUser.principal) {
        console.warn('Wallet identity mismatch or disconnected, forcing logout');
        this.disconnect();
        window.dispatchEvent(new CustomEvent('wallet-identity-changed', {
          detail: { oldPrincipal: this.currentUser?.principal, newPrincipal: livePrincipal || null }
        }));
      }
    } catch (e) {
      console.warn('Identity verification failed:', e);
      this.disconnect();
    }
  }
}

// Export singleton instance
export const authService = new AuthServiceImpl();
