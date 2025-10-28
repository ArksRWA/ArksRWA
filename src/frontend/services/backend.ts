import { authService } from './auth';
import { getCanisterId, HOST, isLocal } from '../config/canister';
import {
  Company,
  CreateCompanyParams,
  candidCompanyToFrontend,
  candidTokenHolderToFrontend,
  CanisterCallError
} from '../types/canister';
// Import declarations using the alias
import * as declarations from '@declarations/arks-core/index.js';

// ICRC-1/2 types for token canister interface
interface ICRC1TransferArgs {
  from_subaccount?: [] | [number[]] | undefined;
  to: {
    owner: string;
    subaccount?: [] | [number[]] | undefined;
  };
  amount: number;
  fee?: [] | [number] | undefined;
  memo?: [] | [number[]] | undefined;
  created_at_time?: [] | [bigint] | undefined;
}

interface ICRC1TransferResult {
  Ok?: number;
  Err?: {
    InsufficientFunds?: { balance: number };
    BadFee?: { expected_fee: number };
    GenericError?: { error_code: number; message: string };
  };
}

interface ICRC1Account {
  owner: string;
  subaccount?: [] | [number[]] | undefined;
}

// Company token actor interface
interface CompanyTokenActor {
  icrc1_balance_of: (account: ICRC1Account) => Promise<number>;
  icrc1_transfer: (args: ICRC1TransferArgs) => Promise<ICRC1TransferResult>;
}

// Re-export types for convenience
export type { Company, CreateCompanyParams } from '../types/canister';

class BackendService {
  private readonly coreCanisterId = getCanisterId('arks_core');
  private readonly riskEngineCanisterId = getCanisterId('arks_risk_engine');
  private readonly host = HOST;

  // Cache for actor and agent to avoid recreating them repeatedly
  private coreActorCache: any = null;
  private riskEngineActorCache: any = null;
  private agentCache: any = null;
  private tokenActorCache: Map<string, any> = new Map(); // Cache for company token actors

  private async createHttpAgent(): Promise<any> {
    const { HttpAgent } = await import('@dfinity/agent');

    if (this.agentCache) {
      return this.agentCache;
    }

    // Always set host explicitly: local → http://127.0.0.1:4943, mainnet → https://icp-api.io
    const agent = new HttpAgent({
      host: (isLocal() ? 'http://127.0.0.1:4943' : 'https://icp-api.io'),
    });

    // For local dev only
    if (isLocal()) {
      try { await agent.fetchRootKey(); } catch {}
    }

    this.agentCache = agent;
    return agent;
  }

private async createActor(requireAuth = true) {
  const user = await Promise.resolve(authService.getCurrentUser?.());
  if (requireAuth && (!user || !user.isConnected)) {
    throw new Error('User not authenticated');
  }

  // Always clear cache for now to ensure fresh connections
  this.coreActorCache = null;

  try {
    const { Actor } = await import('@dfinity/agent');

    const agent = await this.createHttpAgent();

    // Prefer wallet-provided ACTOR if it really is an actor with your canister methods
    if (user && user.agent && typeof (user.agent as any).listCompanies === 'function') {
      this.coreActorCache = user.agent;
      return this.coreActorCache;
    }

    // Use your generated idlFactory
    const idlFactory = declarations.idlFactory;

    this.coreActorCache = Actor.createActor(idlFactory, {
      agent,
      canisterId: this.coreCanisterId,
    });

    return this.coreActorCache;
  } catch (error) {
    console.error('Error creating actor:', error);
    throw error;
  }
}

  private async createRiskEngineActor(requireAuth = false) {
    if (requireAuth) {
      const user = await Promise.resolve(authService.getCurrentUser?.());
      if (!user || !user.isConnected) {
        throw new Error('User not authenticated');
      }
    }

    // Return cached actor if available
    if (this.riskEngineActorCache) {
      return this.riskEngineActorCache;
    }

    try {
      const { Actor } = await import('@dfinity/agent');

      const agent = await this.createHttpAgent();

      // Create IDL for risk engine canister
      const riskEngineIdl = ({ IDL }: any) => {
        const VerificationStatus = IDL.Variant({
          'pending': IDL.Null,
          'verified': IDL.Null,
          'suspicious': IDL.Null,
          'failed': IDL.Null,
          'error': IDL.Null,
        });

        const JobPriority = IDL.Variant({
          'high': IDL.Null,
          'normal': IDL.Null,
          'low': IDL.Null,
        });

        const VerificationProfile = IDL.Record({
          'companyId': IDL.Nat,
          'overallScore': IDL.Opt(IDL.Float64),
          'verificationStatus': VerificationStatus,
          'lastVerified': IDL.Int,
          'nextDueAt': IDL.Opt(IDL.Int),
          'checks': IDL.Vec(IDL.Record({
            'checkType': IDL.Text,
            'status': IDL.Text,
            'score': IDL.Float64,
            'details': IDL.Text,
          })),
          'fraudKeywords': IDL.Vec(IDL.Text),
          'newsArticles': IDL.Nat,
          'riskFactors': IDL.Vec(IDL.Text),
          'confidenceLevel': IDL.Float64,
        });

        return IDL.Service({
          'startVerification': IDL.Func(
            [IDL.Nat, IDL.Text, JobPriority],
            [IDL.Nat],
            []
          ),
          'getCompanyVerificationStatus': IDL.Func(
            [IDL.Nat],
            [IDL.Opt(IDL.Record({
              'status': VerificationStatus,
              'score': IDL.Opt(IDL.Float64),
              'lastVerified': IDL.Opt(IDL.Int),
            }))],
            ['query']
          ),
          'getCompanyVerificationProfile': IDL.Func(
            [IDL.Nat],
            [IDL.Opt(VerificationProfile)],
            ['query']
          ),
          'companyNeedsReverification': IDL.Func(
            [IDL.Nat],
            [IDL.Bool],
            ['query']
          ),
        });
      };

      this.riskEngineActorCache = Actor.createActor(riskEngineIdl, {
        agent,
        canisterId: this.riskEngineCanisterId,
      });

      return this.riskEngineActorCache;
    } catch (error) {
      console.error('Error creating risk engine actor:', error);
      throw error;
    }
  }

  // Helper function to create company token actor
  private async createCompanyTokenActor(canisterId: string): Promise<any> {
    // Check cache first
    if (this.tokenActorCache.has(canisterId)) {
      return this.tokenActorCache.get(canisterId);
    }

    try {
      const { Actor } = await import('@dfinity/agent');
      const agent = await this.createHttpAgent();

      // Create a lightweight ICRC-1/2 IDL for the token canister
      const tokenIdl = ({ IDL }: any) => {
        return IDL.Service({
          'icrc1_balance_of': IDL.Func(
            [IDL.Record({
              'owner': IDL.Principal,
              'subaccount': IDL.Opt(IDL.Vec(IDL.Nat8))
            })],
            [IDL.Nat],
            ['query']
          ),
          'icrc1_transfer': IDL.Func(
            [IDL.Record({
              'from_subaccount': IDL.Opt(IDL.Vec(IDL.Nat8)),
              'to': IDL.Record({
                'owner': IDL.Principal,
                'subaccount': IDL.Opt(IDL.Vec(IDL.Nat8))
              }),
              'amount': IDL.Nat,
              'fee': IDL.Opt(IDL.Nat),
              'memo': IDL.Opt(IDL.Vec(IDL.Nat8)),
              'created_at_time': IDL.Opt(IDL.Nat64)
            })],
            [IDL.Variant({
              'Ok': IDL.Nat,
              'Err': IDL.Variant({
                'InsufficientFunds': IDL.Record({ 'balance': IDL.Nat }),
                'BadFee': IDL.Record({ 'expected_fee': IDL.Nat }),
                'GenericError': IDL.Record({
                  'error_code': IDL.Nat,
                  'message': IDL.Text
                })
              })
            })],
            []
          )
        });
      };

      const tokenActor = Actor.createActor(tokenIdl, {
        agent,
        canisterId,
      });

      // Cache the actor
      this.tokenActorCache.set(canisterId, tokenActor);
      return tokenActor;
    } catch (error) {
      console.error('Error creating company token actor:', error);
      throw error;
    }
  }

  // Clear cache when user changes
  private clearCache() {
    this.coreActorCache = null;
    this.riskEngineActorCache = null;
    this.agentCache = null;
    this.tokenActorCache.clear();
  }

  // Public method to clear cache when user disconnects
  disconnect() {
    this.clearCache();
  }

  async createCompany(params: CreateCompanyParams): Promise<number> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Real backend call
      const actor = await this.createActor();
      const result = await actor.createCompany(
        params.name,
        params.symbol,
        params.logoUrl,
        params.description,
        params.valuation,
        params.desiredSupply ? [params.desiredSupply] : [],
        params.desiredPrice ? [params.desiredPrice] : []
      );

      return Number(result);
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  async listCompanies(): Promise<Company[]> {
    try {
      // Real backend call - no authentication required for public data
      const actor = await this.createActor(false);
      const companies = await actor.listCompanies();
      return (companies as any[]).map(candidCompanyToFrontend);
    } catch (error) {
      console.error('Error listing companies:', error);
      throw error;
    }
  }

  async hasOwnedCompany(): Promise<boolean> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      return false;
    }

    try {
      const actor = await this.createActor(true);
      const ownedCompanies = await actor.getOwnedCompanies(user.principal);
      return ownedCompanies.length > 0;
    } catch (error) {
      console.error('Error checking owned company:', error);
      return false;
    }
  }

  async getOwnedCompanies(): Promise<Company[]> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      return [];
    }

    try {
      const actor = await this.createActor(true);
      const ownedCompanies = await actor.getOwnedCompanies(user.principal);
      return (ownedCompanies as any[]).map(candidCompanyToFrontend);
    } catch (error) {
      console.error('Error getting owned companies:', error);
      return [];
    }
  }

  async getCompanyById(id: number): Promise<Company | null> {
    try {
      // Real backend call - no authentication required for public data
      const actor = await this.createActor(false);
      // Use getCompany function as per generated declarations
      const company = await actor.getCompany(id);
      // getCompany returns ?Company (optional), handle as array format [Company] or []
      const companyResult = company as any[];
      return companyResult.length > 0 ? candidCompanyToFrontend(companyResult[0]) : null;
    } catch (error) {
      console.error('Error getting company by ID:', error);
      throw error;
    }
  }

  async getUserHoldings(companyId: number): Promise<bigint> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Real backend call - using shared query which automatically uses caller
      const actor = await this.createActor();
      const holdings = await actor.get_my_holding(companyId);
      return holdings;
    } catch (error) {
      console.error('Error getting user holdings:', error);
      throw error;
    }
  }

  async buyTokens(companyId: number, amount: bigint): Promise<string> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Check if company exists and has a token canister deployed
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Check if the company has a token canister deployed
      if (!company.token_canister_id) {
        throw new Error('Token canister not deployed for this company yet. Please contact the company to deploy their token canister first.');
      }

      // Temporarily disable buyTokens as specified in the todo
      throw new Error('Token purchasing is temporarily disabled. Please use the Transfer function instead.');
    } catch (error) {
      console.error('Error buying tokens:', error);
      throw error;
    }
  }

  async sellTokens(companyId: number, amount: bigint): Promise<string> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Check if company exists and has a token canister deployed
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Check if the company has a token canister deployed
      if (!company.token_canister_id) {
        throw new Error('Token canister not deployed for this company yet. Cannot sell tokens that don\'t exist.');
      }

      // Temporarily disable sellTokens as specified in the todo
      throw new Error('Token selling is temporarily disabled. Please use the Transfer function instead.');
    } catch (error) {
      console.error('Error selling tokens:', error);
      throw error;
    }
  }

  async updateCompanyDescription(companyId: number, newDescription: string): Promise<string> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Real backend call - use correct method name from canister interface
      const actor = await this.createActor();
      await actor.updateDescription(companyId, newDescription);
      return 'Company description updated successfully';
    } catch (error) {
      console.error('Error updating company description:', error);
      throw error;
    }
  }

  async transferTokens(companyId: number, recipient: string, amount: number, memo?: string): Promise<string> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Get company details to find token canister ID
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Check if the company has a token canister deployed
      if (!company.token_canister_id) {
        throw new Error('Token canister not deployed for this company yet');
      }

      // Create actor for the company's token canister
      const tokenActor = await this.createCompanyTokenActor(company.token_canister_id);
      
      // Prepare transfer arguments according to ICRC-1 standard
      const transferArgs = {
        from_subaccount: [], // Using default subaccount
        to: {
          owner: recipient,
          subaccount: []
        },
        amount: amount,
        fee: [], // Let backend determine fee
        memo: memo ? [new TextEncoder().encode(memo)] : [],
        created_at_time: [] // Let backend set timestamp
      };

      const result = await tokenActor.icrc1_transfer(transferArgs);
      
      // Handle the result which is either #Ok(Nat) or #Err(TransferError)
      if (result.Ok !== undefined) {
        return `Transfer successful! Transaction ID: ${result.Ok}`;
      } else if (result.Err) {
        const error = result.Err;
        if (error.InsufficientFunds) {
          throw new Error(`Insufficient funds. Current balance: ${error.InsufficientFunds.balance}`);
        } else if (error.BadFee) {
          throw new Error(`Invalid fee. Expected: ${error.BadFee.expected_fee}`);
        } else if (error.GenericError) {
          throw new Error(`Transfer failed: ${error.GenericError.message}`);
        } else {
          throw new Error('Transfer failed with unknown error');
        }
      } else {
        throw new Error('Unexpected response format from token canister');
      }
    } catch (error) {
      console.error('Error transferring tokens:', error);
      throw error;
    }
  }

  async getTokenBalance(companyId: number, principalId?: string): Promise<number> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Get company details to find token canister ID
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Check if the company has a token canister deployed
      if (!company.token_canister_id) {
        throw new Error('Token canister not deployed for this company yet');
      }

      // Create actor for the company's token canister
      const tokenActor = await this.createCompanyTokenActor(company.token_canister_id);
      
      const account = {
        owner: principalId || user.principal,
        subaccount: []
      };
      
      const result = await tokenActor.icrc1_balance_of(account);
      
      return result;
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  async getRiskProfile(companyId: number): Promise<{
    score: number | null;
    risk_label: 'Trusted' | 'Caution' | 'HighRisk';
    explanation_hash?: string;
    last_scored_at?: bigint;
  }> {
    try {
      // Real backend call - no authentication required for public data
      const actor = await this.createActor(false);
      const verification = await actor.getVerification(companyId);
      
      // Map risk labels to match expected format
      const mapRiskLabel = (label: any): 'Trusted' | 'Caution' | 'HighRisk' => {
        if (label.Trusted !== undefined) return 'Trusted';
        if (label.Caution !== undefined) return 'Caution';
        if (label.HighRisk !== undefined) return 'HighRisk';
        return 'Caution'; // Default fallback
      };

      return {
        score: verification.score?.[0] ?? null, // Handle optional score array - extract first element or null if not available
        risk_label: mapRiskLabel(verification.risk_label),
        explanation_hash: verification.explanation_hash?.[0] || undefined,
        last_scored_at: verification.last_scored_at?.[0] || undefined,
      };
    } catch (error) {
      console.error('Error getting risk profile:', error);
      throw error;
    }
  }

  // Risk Engine Methods
  async startVerification(companyId: number, companyName: string, priority: any = { normal: null }): Promise<number> {
    try {
      const actor = await this.createRiskEngineActor();
      return await actor.startVerification(companyId, companyName, priority);
    } catch (error) {
      console.error('Error starting verification:', error);
      throw error;
    }
  }

  async getCompanyVerificationStatus(companyId: number): Promise<any> {
    try {
      const actor = await this.createRiskEngineActor();
      return await actor.getCompanyVerificationStatus(companyId);
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw error;
    }
  }

  async getCompanyVerificationProfile(companyId: number): Promise<any> {
    try {
      const actor = await this.createRiskEngineActor();
      return await actor.getCompanyVerificationProfile(companyId);
    } catch (error) {
      console.error('Error getting verification profile:', error);
      throw error;
    }
  }

  async companyNeedsReverification(companyId: number): Promise<boolean> {
    try {
      const actor = await this.createRiskEngineActor();
      return await actor.companyNeedsReverification(companyId);
    } catch (error) {
      console.error('Error checking if company needs reverification:', error);
      throw error;
    }
  }
}

export const backendService = new BackendService();