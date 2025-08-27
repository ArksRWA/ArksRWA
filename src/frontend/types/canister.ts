// Re-export generated types from declarations
export type {
  Company as CandidCompany,
  TokenHolder as CandidTokenHolder,
  _SERVICE
} from '../declarations/arks-core/arks-core.did';

// Risk level status type
export type CompanyRiskStatus = 'low' | 'medium' | 'high';

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
  // Check if we have the newer verification fields or the legacy VerificationProfile structure
  const hasLegacyVerification = candidCompany.verification && candidCompany.verification.score !== undefined;
  
  return {
    id: Number(candidCompany.id),
    name: candidCompany.name,
    symbol: candidCompany.symbol,
    owner: candidCompany.owner.toString(),
    valuation: candidCompany.valuation,
    base_price: candidCompany.base_price,
    token_price: candidCompany.token_price,
    supply: candidCompany.supply,
    remaining: candidCompany.remaining,
    minimum_purchase: candidCompany.minimum_purchase,
    logo_url: candidCompany.logo_url,
    description: candidCompany.description,
    created_at: Number(candidCompany.created_at),
    // Handle verification fields - support both new structure and legacy
    verification_status: candidCompany.verification_status || candidCompany.verification?.state || null,
    verification_score: candidCompany.verification_score ? Number(candidCompany.verification_score) : 
                       (hasLegacyVerification ? Number(candidCompany.verification.score) : null),
    last_verified: candidCompany.last_verified ? Number(candidCompany.last_verified) : 
                  (candidCompany.verification?.last_scored_at ? Number(candidCompany.verification.last_scored_at[0]) : null),
    verification_job_id: candidCompany.verification_job_id ? Number(candidCompany.verification_job_id) : null,
    // Current backend fields from declarations
    trading_paused: candidCompany.trading_paused,
    token_canister_id: candidCompany.token_canister_id?.length > 0 ? candidCompany.token_canister_id[0].toString() : null,
    treasury_account: candidCompany.treasury_account?.toString(),
    // Default to 'medium' risk status until backend provides this field
    status: (candidCompany as any).status || 'medium',
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
}

export interface AuthService {
  connectPlug(): Promise<AuthUser>;
  disconnect(): void;
  getCurrentUser(): AuthUser | null;
  isAuthenticated(): boolean;
  setUserRole(role: 'user' | 'company'): void;
  getUserRole(): 'user' | 'company' | undefined;
}