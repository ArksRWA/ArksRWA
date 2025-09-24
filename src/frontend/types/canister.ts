// Re-export generated types from declarations
export type {
  Company as CandidCompany,
  TokenHolder as CandidTokenHolder,
  _SERVICE
} from '../declarations/arks-core/arks-core.did';

// Risk level status type
export type CompanyRiskStatus = 'low' | 'medium' | 'high' | 'pending';

// Frontend-friendly types that convert bigint to number for easier use
export interface Company {
  id: number;
  name: string;
  symbol: string;
  owner: string;
  valuation: bigint;
  base_price: bigint;
  token_price: bigint;
  supply: bigint;
  remaining: bigint;
  minimum_purchase: bigint;
  logo_url: string;
  description: string;
  created_at: number;
  // Backend verification fields from main.mo
  verification_status: any; // VerificationTypes.VerificationStatus
  verification_score: number | null;
  last_verified: number | null;
  verification_job_id: number | null;
  // Legacy frontend fields for backward compatibility
  trading_paused?: boolean;
  token_canister_id?: string | null;
  treasury_account?: string;
  status?: CompanyRiskStatus; // Keep for backward compatibility
  // Full verification object for StatusBadge component
  verification?: {
    state: any;
    score: any;
    risk_label: any;
    last_scored_at: any;
    next_due_at: any;
    explanation_hash: any;
    last_vc_registration: any;
    last_vc_valuation: any;
  };
}

export interface TokenHolder {
  amount: number;
  investor: string;
  companyId: number;
}

export interface CreateCompanyParams {
  name: string;
  symbol: string;
  logoUrl: string;
  description: string;
  valuation: bigint;
  desiredSupply?: bigint;
  desiredPrice?: bigint;
}

// Utility functions to convert between Candid and frontend types
export const candidCompanyToFrontend = (candidCompany: any): Company => {
  return {
    id: Number(candidCompany.id),
    name: candidCompany.name,
    symbol: candidCompany.symbol,
    owner: candidCompany.owner.toString(),
    valuation: BigInt(candidCompany.valuation),
    base_price: BigInt(candidCompany.base_price),
    token_price: BigInt(candidCompany.token_price),
    supply: BigInt(candidCompany.supply),
    remaining: BigInt(candidCompany.remaining),
    minimum_purchase: BigInt(candidCompany.minimum_purchase),
    logo_url: candidCompany.logo_url,
    description: candidCompany.description,
    created_at: Number(candidCompany.created_at),
    trading_paused: candidCompany.trading_paused,
    
    // Handle verification fields from the verification object
    verification_status: candidCompany.verification?.state || null,
    verification_score: candidCompany.verification?.score?.[0] ?? null,
    last_verified: candidCompany.verification?.last_scored_at?.[0] ? Number(candidCompany.verification.last_scored_at[0]) : null,
    verification_job_id: null, // Not available in current backend structure
    
    // Handle optional fields with Candid array format
    token_canister_id: candidCompany.token_canister_id?.[0]?.toString() || null,
    treasury_account: candidCompany.treasury_account?.toString(),
    
    // Add verification object for StatusBadge component
    verification: {
      state: candidCompany.verification?.state,
      score: candidCompany.verification?.score,
      risk_label: candidCompany.verification?.risk_label,
      last_scored_at: candidCompany.verification?.last_scored_at,
      next_due_at: candidCompany.verification?.next_due_at,
      explanation_hash: candidCompany.verification?.explanation_hash,
      last_vc_registration: candidCompany.verification?.last_vc_registration,
      last_vc_valuation: candidCompany.verification?.last_vc_valuation
    }
  };
};

export const candidTokenHolderToFrontend = (candidHolder: import('../declarations/arks-core/arks-core.did').TokenHolder): TokenHolder => {
  return {
    amount: Number(candidHolder.amount),
    investor: candidHolder.investor.toString(),
    companyId: Number(candidHolder.companyId),
  };
};

// Error handling types
export interface CanisterError extends Error {
  code?: string;
  details?: any;
}

export class CanisterCallError extends Error implements CanisterError {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CanisterCallError';
  }
}

// Result types for better error handling
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

// Authentication types
export interface AuthUser {
  principal: string;
  agent?: any;
  isConnected: boolean;
  walletType: 'plug';
  role?: 'user' | 'company';
  sessionRestored?: boolean; // Flag to indicate if session was restored from localStorage
}

export interface AuthService {
  connectPlug(): Promise<AuthUser>;
  disconnect(): void;
  getCurrentUser(): AuthUser | null;
  isAuthenticated(): boolean;
  setUserRole(role: 'user' | 'company'): void;
  getUserRole(): 'user' | 'company' | undefined;
}