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

  private async createHttpAgent(): Promise<any> {
    const { HttpAgent } = await import('@dfinity/agent');

    if (this.agentCache) {
      return this.agentCache;
    }

    // ✅ Use SAME ORIGIN in the browser to avoid CORS
    const isBrowser = typeof window !== 'undefined';
    const agent = new HttpAgent({
      // If we're in the browser, let it default to window.location.origin by not setting host
      ...(isBrowser ? {} : { host: (isLocal() ? 'http://127.0.0.1:4943' : 'https://icp-api.io') }),
    });

    // TESTING PURPOSE - BYPASS ISBROWSER
    // const agent = this.agentCache ?? new HttpAgent({
    //   host: (isLocal() ? 'http://127.0.0.1:4943' : 'https://icp-api.io'),
    // });
    // ENDING TESTING PURPOSE - BYPASS ISBROWSER


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

  // Clear cache when user changes
  private clearCache() {
    this.coreActorCache = null;
    this.riskEngineActorCache = null;
    this.agentCache = null;
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
      const { Principal } = await import('@dfinity/principal');
      const actor = await this.createActor();
      const callerPrincipal = Principal.fromText(user.principal);
      const result = await actor.createCompany(
        params.name,
        params.symbol,
        params.logoUrl,
        params.description,
        params.valuation,
        params.desiredSupply ? [params.desiredSupply] : [],
        params.desiredPrice ? [params.desiredPrice] : [],
        callerPrincipal
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
      const { Principal } = await import('@dfinity/principal');
      const callerPrincipal = Principal.fromText(user.principal);
      const actor = await this.createActor(true);
      const ownedCompanies = await actor.getOwnedCompanies(callerPrincipal);
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
      const { Principal } = await import('@dfinity/principal');
      const callerPrincipal = Principal.fromText(user.principal);
      const actor = await this.createActor(true);
      const ownedCompanies = await actor.getOwnedCompanies(callerPrincipal);
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
      // Real backend call
      const { Principal } = await import('@dfinity/principal');
      const actor = await this.createActor();
      const callerPrincipal = Principal.fromText(user.principal);
      const holdings = await actor.get_my_holding(companyId, callerPrincipal);
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

      // TODO: Implement actual token buying through company's individual token canister
      // This would require:
      // 1. Creating actor for the company's specific token canister
      // 2. Calling the ICRC-1/2 transfer methods on that canister
      // 3. Handling the purchase flow through the token factory system
      
      throw new Error('Token purchasing will be available once individual company token canisters are implemented through the token factory.');
      
      /*
      // Future implementation:
      const { Principal } = await import('@dfinity/principal');
      const tokenCanisterId = company.token_canister_id;
      const tokenActor = await this.createCompanyTokenActor(tokenCanisterId);
      const callerPrincipal = Principal.fromText(user.principal);
      const result = await tokenActor.purchase(amount, callerPrincipal);
      return result as string;
      */
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

      // TODO: Implement actual token selling through company's individual token canister
      // This would require:
      // 1. Creating actor for the company's specific token canister
      // 2. Calling the ICRC-1/2 transfer methods on that canister
      // 3. Handling the sale flow through the token factory system
      
      throw new Error('Token selling will be available once individual company token canisters are implemented through the token factory.');
      
      /*
      // Future implementation:
      const { Principal } = await import('@dfinity/principal');
      const tokenCanisterId = company.token_canister_id;
      const tokenActor = await this.createCompanyTokenActor(tokenCanisterId);
      const callerPrincipal = Principal.fromText(user.principal);
      const result = await tokenActor.sell(amount, callerPrincipal);
      return result as string;
      */
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
      const { Principal } = await import('@dfinity/principal');
      const actor = await this.createActor();
      const callerPrincipal = Principal.fromText(user.principal);
      await actor.updateDescription(companyId, newDescription, callerPrincipal);
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
      // Real backend call
      const actor = await this.createActor();
      
      // Prepare transfer arguments according to ICRC-1 standard
      const transferArgs = {
        from_subaccount: null, // Using default subaccount
        to: {
          owner: recipient, // Principal ID as string, will be converted by backend
          subaccount: null
        },
        amount: amount,
        fee: null, // Let backend determine fee
        memo: memo ? [new TextEncoder().encode(memo)] : null,
        created_at_time: null // Let backend set timestamp
      };

      const result = await actor.icrc1_transfer(companyId, transferArgs, user.principal);
      
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
        throw new Error('Unexpected response format from backend');
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
      // Real backend call
      const actor = await this.createActor();
      const account = {
        owner: principalId || user.principal,
        subaccount: null
      };
      
      const result = await actor.icrc1_balance_of(companyId, account);
      
      if (result.ok !== undefined) {
        return result.ok;
      } else if (result.err) {
        throw new Error(result.err);
      } else {
        throw new Error('Unexpected response format');
      }
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