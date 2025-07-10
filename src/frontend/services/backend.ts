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
  private readonly canisterId = getCanisterId('arks_rwa_backend');

  async createCompany(params: CreateCompanyParams): Promise<number> {
    const user = authService.getCurrentUser();
    if (!user || !user.isConnected) {
      throw new Error('User not authenticated');
    }

    try {
      // In demo mode, simulate the backend call
      if (user.walletType === 'demo') {
        console.log('Demo mode: Creating company with params:', params);
        
        // Simulate validation
        if (params.valuation < 10_000_000) {
          throw new Error('Valuation too low.');
        }
        if (params.symbol.length < 3 || params.symbol.length > 5) {
          throw new Error('Symbol must be 3-5 characters.');
        }
        
        // Simulate success
        const simulatedId = Math.floor(Math.random() * 1000);
        console.log('Demo company created with ID:', simulatedId);
        return simulatedId;
      }

      // Real backend call using the agent
      if (!user.agent) {
        throw new Error('User agent not available');
      }

      // Create actor using the agent
      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const { idlFactory } = await import('../declarations/arks-rwa-backend');
      
      // Create agent for the appropriate environment
      const agent = new HttpAgent({
        host: HOST,
      });
      
      // Fetch root key for local development
      if (isLocal()) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

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
      // In demo mode, return mock data
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
      if (!user.agent) {
        throw new Error('User agent not available');
      }

      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const { idlFactory } = await import('../declarations/arks-rwa-backend');
      const { candidCompanyToFrontend } = await import('../types/canister');
      
      // Create agent for the appropriate environment
      const agent = new HttpAgent({
        host: HOST,
      });
      
      // Fetch root key for local development
      if (isLocal()) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

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
      // In demo mode, return mock data
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
      if (!user.agent) {
        throw new Error('User agent not available');
      }

      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const { idlFactory } = await import('../declarations/arks-rwa-backend');
      const { candidCompanyToFrontend } = await import('../types/canister');
      
      // Create agent for the appropriate environment
      const agent = new HttpAgent({
        host: HOST,
      });
      
      // Fetch root key for local development
      if (isLocal()) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

      const company = await actor.getCompanyById(BigInt(id));
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
      // In demo mode, return mock data
      if (user.walletType === 'demo') {
        return 5; // Mock holdings
      }

      // Real backend call
      if (!user.agent) {
        throw new Error('User agent not available');
      }

      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const { idlFactory } = await import('../declarations/arks-rwa-backend');
      
      // Create agent for the appropriate environment
      const agent = new HttpAgent({
        host: HOST,
      });
      
      // Fetch root key for local development
      if (isLocal()) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

      const holdings = await actor.getMyHolding(BigInt(companyId));
      return Number(holdings);
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
      // In demo mode, simulate the call
      if (user.walletType === 'demo') {
        console.log('Demo mode: Buying tokens:', { companyId, amount });
        return `Demo: Successfully bought ${amount} tokens`;
      }

      // Real backend call
      if (!user.agent) {
        throw new Error('User agent not available');
      }

      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const { idlFactory } = await import('../declarations/arks-rwa-backend');
      
      // Create agent for the appropriate environment
      const agent = new HttpAgent({
        host: HOST,
      });
      
      // Fetch root key for local development
      if (isLocal()) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

      const result = await actor.buyTokens(BigInt(companyId), BigInt(amount));
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
      // In demo mode, simulate the call
      if (user.walletType === 'demo') {
        console.log('Demo mode: Selling tokens:', { companyId, amount });
        return `Demo: Successfully sold ${amount} tokens`;
      }

      // Real backend call
      if (!user.agent) {
        throw new Error('User agent not available');
      }

      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const { idlFactory } = await import('../declarations/arks-rwa-backend');
      
      // Create agent for the appropriate environment
      const agent = new HttpAgent({
        host: HOST,
      });
      
      // Fetch root key for local development
      if (isLocal()) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

      const result = await actor.sellTokens(BigInt(companyId), BigInt(amount));
      return result as string;
    } catch (error) {
      console.error('Error selling tokens:', error);
      throw error;
    }
  }
}

export const backendService = new BackendService();