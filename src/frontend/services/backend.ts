import { authService } from './auth';
import { getCanisterId, HOST, isLocal } from '../config/canister';
import {
  Company,
  CreateCompanyParams,
  candidCompanyToFrontend,
  candidTokenHolderToFrontend,
  CanisterCallError
} from '../types/canister';
// REMOVE BELOW CODE IF TRIGGER ERROR
import * as declarations from '../declarations/arks-core/index.js';

// Re-export types for convenience
export type { Company, CreateCompanyParams } from '../types/canister';

class BackendService {
  private readonly canisterId = getCanisterId('arks_core');
  private readonly host = HOST;
  
  // Cache for actor and agent to avoid recreating them repeatedly
  private actorCache: any = null;
  private agentCache: any = null;

  private async oldcreateActor(requireAuth = true) {
    const user = authService.getCurrentUser();
    if (requireAuth && (!user || !user.isConnected)) {
      throw new Error('User not authenticated');
    }

    // Always clear cache for now to ensure fresh connections
    this.actorCache = null;

    try {
      // Only import when needed for real backend calls
      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const canisterHost = isLocal()
        ? `http://${this.canisterId}.localhost:4943`
        : `https://${this.canisterId}.icp0.io`;
      // Create agent (reuse if possible)
      if (!this.agentCache) {
        this.agentCache = new HttpAgent({ host: canisterHost });
        await this.agentCache.fetchRootKey(); // For local development
      }

      // If user has an agent (from wallet connection), try to use it
      if (user && user.agent) {
        console.log('User agent available from wallet, checking if it has the right interface...');
        
        // Check if the agent has the expected methods
        if (typeof user.agent.listCompanies === 'function') {
          console.log('Using user agent from wallet connection');
          this.actorCache = user.agent;
          return user.agent;
        } else {
          console.log('User agent missing expected methods, creating our own actor...');
        }
      }

      // Remove the dynamic import logic and use the imported declarations directly
      const idlFactory = declarations.idlFactory;

      this.actorCache = Actor.createActor(idlFactory, {
        agent: this.agentCache,
        canisterId: this.canisterId,
      });

      console.log('Actor created successfully:', {
        canisterId: this.canisterId,
        hasListCompanies: typeof this.actorCache.listCompanies === 'function',
        methods: Object.getOwnPropertyNames(this.actorCache)
      });

      return this.actorCache;
    } catch (error) {
      console.error('Error creating actor:', error);
      throw error;
    }
  }
private async createActor(requireAuth = true) {
  const user = await Promise.resolve(authService.getCurrentUser?.());
  if (requireAuth && (!user || !user.isConnected)) {
    throw new Error('User not authenticated');
  }

  // Always clear cache for now to ensure fresh connections
  this.actorCache = null;

  try {
    const { Actor, HttpAgent } = await import('@dfinity/agent');

    // ✅ Use SAME ORIGIN in the browser to avoid CORS
    const isBrowser = typeof window !== 'undefined';
    const agent = this.agentCache ?? new HttpAgent({
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

    // Prefer wallet-provided ACTOR if it really is an actor with your canister methods
    if (user && user.agent && typeof (user.agent as any).listCompanies === 'function') {
      this.actorCache = user.agent;
      return this.actorCache;
    }

    // Use your generated idlFactory
    const idlFactory = declarations.idlFactory;

    this.actorCache = Actor.createActor(idlFactory, {
      agent: this.agentCache,
      canisterId: this.canisterId,
    });

    return this.actorCache;
  } catch (error) {
    console.error('Error creating actor:', error);
    throw error;
  }
}

  // Clear cache when user changes
  private clearCache() {
    this.actorCache = null;
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

  async getCompanyById(id: number): Promise<Company | null> {
    try {
      // Real backend call - no authentication required for public data
      const actor = await this.createActor(false);
      const company = await actor.getCompany(id);
      const companyResult = company as any[];
      return companyResult[0] ? candidCompanyToFrontend(companyResult[0]) : null;
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
      // Real backend call - import Principal for proper typing
      const { Principal } = await import('@dfinity/principal');
      const actor = await this.createActor();
      const callerPrincipal = Principal.fromText(user.principal);
      const result = await actor.buyTokens(companyId, amount, callerPrincipal);
      return result as string;
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
      // Real backend call
      const { Principal } = await import('@dfinity/principal');
      const actor = await this.createActor();
      const callerPrincipal = Principal.fromText(user.principal);
      const result = await actor.sellTokens(companyId, amount, callerPrincipal);
      return result as string;
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
      // Real backend call
      const actor = await this.createActor();
      await actor.updateCompanyDescription(companyId, newDescription);
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
}

export const backendService = new BackendService();