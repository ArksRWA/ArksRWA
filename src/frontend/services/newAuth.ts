// Assumes a shape like:
// type AuthUser = { principal: string; agent: any | null; isConnected: boolean; walletType: 'plug'; sessionRestored?: boolean; role?: string | null };
export type { AuthUser, AuthService } from '../types/canister';
import { AuthUser } from "./auth";
const STORAGE_KEY_AUTH = 'arks-rwa-auth';
const STORAGE_KEY_ROLE = 'arks-rwa-role';

async function ensurePlugReady(): Promise<boolean> {
  return typeof window !== 'undefined' && !!(window as any)?.ic?.plug;
}

async function verifyLivePlugConnection(whitelist: string[], host?: string): Promise<boolean> {
  const plug = (window as any).ic.plug;
  const connected = await plug.isConnected(); // live truth
  if (connected) return true;

  // Re-persist connection silently (will only prompt if permissions were revoked)
  try {
    await plug.requestConnect({ whitelist, host, timeout: 50_000 });
    return await plug.isConnected();
  } catch {
    return false;
  }
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private readonly whitelist: string[];
  private readonly host?: string;

  constructor(opts: { whitelist: string[]; host?: string }) {
    this.whitelist = opts.whitelist;
    this.host = opts.host;

    // Keep app state in sync with wallet:
    if (typeof window !== 'undefined') {
      const plug = (window as any)?.ic?.plug;
      if (plug) {
        plug.onExternalDisconnect?.(() => this.clearSession()); // clear ASAP on external revoke/switch
        plug.onLockStateChange?.((_locked: boolean) => {
          // optional: reflect UI; do not change principal here
        });
      }
    }
  }

  getCurrentUser(): AuthUser | null {
    // Fast path: already hydrated in memory
    if (this.currentUser?.isConnected) return this.currentUser;

    // Attempt a guarded restore (sync entrypoint; the live verification happens lazily below)
    this.restoreSessionHint();

    // Defer live verification to next tick to avoid making getCurrentUser async.
    // Callers that need a guaranteed live session should call this.ensureLiveSession().
    return this.currentUser;
  }

  // Call this before any sensitive canister call (e.g., trade), or at app start.
  async ensureLiveSession(): Promise<AuthUser | null> {
    if (!await ensurePlugReady()) return this.clearSession();

    const ok = await verifyLivePlugConnection(this.whitelist, this.host);
    if (!ok) return this.clearSession();

    const plug = (window as any).ic.plug;
    const livePrincipal: string | undefined = plug.principalId; // live principal from provider
    if (!livePrincipal) return this.clearSession();

    // If we had a cached hint, make sure it matches the live principal. If not, drop it.
    const hint = this.readStorage();
    if (hint?.principal && hint.principal !== livePrincipal) {
      this.clearSession();
    }

    // Hydrate from live provider (agent provided by Plug)
    this.currentUser = {
      principal: livePrincipal,
      agent: plug.agent ?? null,        // on-demand usage is fine
      isConnected: true,
      walletType: 'plug',
      sessionRestored: true,
    };

    // Persist a minimal, advisory hint (principal + walletType + timestamp)
    this.writeStorage({
      principal: livePrincipal,
      walletType: 'plug',
      ts: Date.now(),
    });

    return this.currentUser;
  }

  private restoreSessionHint(): void {
    try {
      const hint = this.readStorage();
      // Only prefill memory if we at least have a hint; DO NOT mark connected yet.
      if (hint?.walletType === 'plug' && hint?.principal) {
        this.currentUser = {
          principal: hint.principal,
          agent: null,             // recreated lazily from Plug
          isConnected: false,      // will be set true only after ensureLiveSession()
          walletType: 'plug',
          sessionRestored: true,
        };
      }
    } catch {
      this.clearStorage();
    }
  }

  private readStorage(): { principal: string; walletType: 'plug'; ts: number } | null {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Tiny validation
    if (typeof parsed?.principal !== 'string' || parsed?.walletType !== 'plug') return null;
    return parsed;
  }

  private writeStorage(v: { principal: string; walletType: 'plug'; ts: number }) {
    // Keep it minimal; avoid storing roles/permissions/agents/etc.
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(v));
  }

  private clearStorage() {
    localStorage.removeItem(STORAGE_KEY_AUTH);
    localStorage.removeItem(STORAGE_KEY_ROLE);
  }

  private clearSession(): null {
    this.clearStorage();
    this.currentUser = null;
    return null;
  }

  private getUserRole(): string | null {
    // Your existing role resolution; ideally fetched server-side by principal
    return localStorage.getItem(STORAGE_KEY_ROLE);
  }
}
