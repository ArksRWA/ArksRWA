import { authService } from './auth';
import { getCanisterId, HOST, isLocal } from '../config/canister';
import type {
  Company,
  CreateCompanyParams,
  candidCompanyToFrontend,
  candidTokenHolderToFrontend,
  CanisterCallError
} from '../types/canister';

// Re-export types for convenience
export type { Company, CreateCompanyParams } from '../types/canister';

class BackendService {
  private readonly canisterId = "uxrrr-q7777-77774-qaaaq-cai";
  private readonly host = 'http://localhost:4943';
  
  // Cache for actor and agent to avoid recreating them repeatedly
  private actorCache: any = null;
  private agentCache: any = null;

  private async createActor() {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    // Return cached actor if available and user hasn't changed
    if (this.actorCache) {
      return this.actorCache;
    }

    try {
      // For demo mode, we don't need a real actor
      if (user.walletType === 'demo') {
        return null; // Demo mode doesn't use real actor
      }

      // Only import when needed for real backend calls
      const { Actor, HttpAgent } = await import('@dfinity/agent');
      
      // Create agent (reuse if possible)
      if (!this.agentCache) {
        this.agentCache = new HttpAgent({ host: this.host });
        await this.agentCache.fetchRootKey(); // For local development
      }

      // Try to import declarations, but handle gracefully if not available
      let idlFactory;
      try {
        const declarations = await import('../declarations/arks-rwa-backend');
        idlFactory = declarations.idlFactory;
      } catch (error) {
        console.warn('IDL declarations not found, using fallback for development');
        // For development, we can create a minimal IDL or use user's agent
        if (user.agent) {
          return user.agent;
        }
        throw new Error('No IDL factory available and no user agent');
      }

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

  async createCompany(params: CreateCompanyParams): Promise<number> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Demo mode simulation
      if (user.walletType === 'demo') {
        console.log('Demo mode: Creating company with params:', params);
        
        // Simulate validation
        if (params.valuation < 10_000_000) {
          throw new Error('Valuation too low.');
        }
        if (params.symbol.length < 3 || params.symbol.length > 5) {
          throw new Error('Symbol must be 3-5 characters.');
        }
        
        const simulatedId = Math.floor(Math.random() * 1000);
        console.log('Demo company created with ID:', simulatedId);
        return simulatedId;
      }

      // Real backend call
      const actor = await this.createActor();
      const result = await actor.createCompany(
        params.name,
        params.symbol,
        params.logoUrl,
        params.description,
        BigInt(params.valuation),
        params.desiredSupply ? [BigInt(params.desiredSupply)] : [],
        params.desiredPrice ? [BigInt(params.desiredPrice)] : []
      );

      return Number(result);
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  async listCompanies(): Promise<Company[]> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Demo mode mock data
      if (user.walletType === 'demo') {
        return [
          {
            id: 1,
            name: 'Demo Company',
            symbol: 'DEMO',
            owner: user.principal,
            valuation: 50_000_000,
            base_price: 1_000_000,
            token_price: 1_000_000,
            supply: 50,
            remaining: 30,
            minimum_purchase: 5_000_000,
            logo_url: '',
            description: 'A demo company for testing',
            created_at: Date.now()
          }
        ];
      }

      // Real backend call
      const actor = await this.createActor();
      const companies = await actor.listCompanies();
      return (companies as any[]).map(candidCompanyToFrontend);
    } catch (error) {
      console.error('Error listing companies:', error);
      throw error;
    }
  }

  async getCompanyById(id: number): Promise<Company | null> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Demo mode mock data
      if (user.walletType === 'demo') {
        return {
          id: id,
          name: 'Demo Company',
          symbol: 'DEMO',
          owner: user.principal,
          valuation: 50_000_000,
          base_price: 1_000_000,
          token_price: 1_200_000,
          supply: 50,
          remaining: 30,
          minimum_purchase: 5_000_000,
          logo_url: '',
          description: 'A demo company for testing the RWA platform. This company provides various services and has been growing steadily.',
          created_at: Date.now()
        };
      }

      // Real backend call
      const actor = await this.createActor();
      const company = await actor.getCompanyById(id);
      const companyResult = company as any[];
      return companyResult[0] ? candidCompanyToFrontend(companyResult[0]) : null;
    } catch (error) {
      console.error('Error getting company by ID:', error);
      throw error;
    }
  }

  async getUserHoldings(companyId: number): Promise<number> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Demo mode mock data
      if (user.walletType === 'demo') {
        return 5; // Mock holdings
      }

      // Real backend call
      const actor = await this.createActor();
      const holdings = await actor.getMyHolding(companyId);
      return holdings as number;
    } catch (error) {
      console.error('Error getting user holdings:', error);
      throw error;
    }
  }

  async buyTokens(companyId: number, amount: number): Promise<string> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Demo mode simulation
      if (user.walletType === 'demo') {
        console.log('Demo mode: Buying tokens:', { companyId, amount });
        return `Demo: Successfully bought ${amount} tokens`;
      }

      // Real backend call
      const actor = await this.createActor();
      const result = await actor.buyTokens(companyId, amount);
      return result as string;
    } catch (error) {
      console.error('Error buying tokens:', error);
      throw error;
    }
  }

  async sellTokens(companyId: number, amount: number): Promise<string> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // Demo mode simulation
      if (user.walletType === 'demo') {
        console.log('Demo mode: Selling tokens:', { companyId, amount });
        return `Demo: Successfully sold ${amount} tokens`;
      }

      // Real backend call
      const actor = await this.createActor();
      const result = await actor.sellTokens(companyId, amount);
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
      // Demo mode simulation
      if (user.walletType === 'demo') {
        console.log('Demo mode: Updating company description:', { companyId, newDescription });
        return `Demo: Successfully updated company description`;
      }

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
      // Demo mode simulation
      if (user.walletType === 'demo') {
        console.log('Demo mode: Transferring tokens:', { companyId, recipient, amount, memo });
        return `Demo: Successfully transferred ${amount} tokens to ${recipient.slice(0, 10)}...`;
      }

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
      // Demo mode simulation
      if (user.walletType === 'demo') {
        return 5; // Mock balance
      }

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

  // Utility method to clear cache when user logs out
  disconnect() {
    this.clearCache();
  }
}

export const backendService = new BackendService();