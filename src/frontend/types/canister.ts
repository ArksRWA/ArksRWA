// Re-export generated types from declarations
export type {
  ARKSRWA,
  Company as CandidCompany,
  TokenHolder as CandidTokenHolder,
  Account,
  TransferArgs,
  TransferResult,
  TransferError,
  _SERVICE
} from '../../declarations/arks-rwa-backend/arks-rwa-backend.did';

// Frontend-friendly types that convert bigint to number for easier use
export interface Company {
  id: number;
  name: string;
  symbol: string;
  owner: string;
  valuation: number;
  base_price: number;
  token_price: number;
  supply: number;
  remaining: number;
  minimum_purchase: number;
  logo_url: string;
  description: string;
  created_at: number;
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
  valuation: number;
  desiredSupply?: number;
  desiredPrice?: number;
}

// Utility functions to convert between Candid and frontend types
export const candidCompanyToFrontend = (candidCompany: import('../../declarations/arks-rwa-backend/arks-rwa-backend.did').Company): Company => {
  return {
    id: Number(candidCompany.id),
    name: candidCompany.name,
    symbol: candidCompany.symbol,
    owner: candidCompany.owner.toString(),
    valuation: Number(candidCompany.valuation),
    base_price: Number(candidCompany.base_price),
    token_price: Number(candidCompany.token_price),
    supply: Number(candidCompany.supply),
    remaining: Number(candidCompany.remaining),
    minimum_purchase: Number(candidCompany.minimum_purchase),
    logo_url: candidCompany.logo_url,
    description: candidCompany.description,
    created_at: Number(candidCompany.created_at),
  };
};

export const candidTokenHolderToFrontend = (candidHolder: import('../../declarations/arks-rwa-backend/arks-rwa-backend.did').TokenHolder): TokenHolder => {
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
  walletType: 'plug' | 'internet-identity';
  role?: 'user' | 'company';
}

export interface AuthService {
  connectPlug(): Promise<AuthUser>;
  connectInternetIdentity(): Promise<AuthUser>;
  disconnect(): void;
  getCurrentUser(): AuthUser | null;
  isAuthenticated(): boolean;
  setUserRole(role: 'user' | 'company'): void;
  getUserRole(): 'user' | 'company' | undefined;
}