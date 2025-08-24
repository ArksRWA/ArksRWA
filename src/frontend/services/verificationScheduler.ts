import { authService } from './auth';
import { backendService } from './backend';
import { getCanisterId, isLocal } from '../config/canister';

// Import risk engine declarations
type VerificationStatus = 
  | { pending: null }
  | { verified: null }
  | { suspicious: null }
  | { failed: null }
  | { error: null };

type JobPriority = 
  | { high: null }
  | { normal: null }
  | { low: null };

interface VerificationJob {
  jobId: number;
  companyId: number;
  companyName: string;
  priority: JobPriority;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

interface VerificationProfile {
  companyId: number;
  overallScore: number;
  verificationStatus: VerificationStatus;
  lastVerified: number;
  nextDueAt?: number;
  confidenceLevel: number;
}

class VerificationSchedulerService {
  private riskEngineCanisterId = getCanisterId('arks_risk_engine');
  private riskEngineActor: any = null;
  private isRunning = false;
  private dailyTimeoutId: NodeJS.Timeout | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  
  // Indonesian timezone configuration
  private readonly INDONESIA_TIMEZONE = 'Asia/Jakarta'; // WIB (UTC+7)
  private readonly DAILY_RUN_HOUR = 0; // Midnight (00:00)
  private readonly DAILY_RUN_MINUTE = 0;
  private readonly STATUS_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute status checks
  private readonly MAX_CONCURRENT_VERIFICATIONS = 5;
  private readonly MAX_VERIFICATIONS_PER_RUN = 10; // More aggressive daily processing
  
  private activeVerifications = new Set<number>();
  private lastScheduledRun: Date | null = null;
  private nextScheduledRun: Date | null = null;
  
  // Persistence keys for localStorage
  private readonly STORAGE_KEYS = {
    LAST_RUN: 'arks_verification_last_run',
    ACTIVE_VERIFICATIONS: 'arks_verification_active',
    SCHEDULER_STATE: 'arks_verification_scheduler_state'
  };

  // Persistence methods
  private saveToStorage(): void {
    try {
      const state = {
        lastScheduledRun: this.lastScheduledRun?.toISOString(),
        activeVerifications: Array.from(this.activeVerifications),
        isRunning: this.isRunning,
        savedAt: new Date().toISOString()
      };
      
      localStorage.setItem(this.STORAGE_KEYS.SCHEDULER_STATE, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save scheduler state to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stateStr = localStorage.getItem(this.STORAGE_KEYS.SCHEDULER_STATE);
      if (!stateStr) return;

      const state = JSON.parse(stateStr);
      
      // Restore last run date
      if (state.lastScheduledRun) {
        this.lastScheduledRun = new Date(state.lastScheduledRun);
      }
      
      // Restore active verifications (clear old ones after 1 hour)
      if (state.activeVerifications && state.savedAt) {
        const savedAt = new Date(state.savedAt);
        const hoursSinceSaved = (new Date().getTime() - savedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceSaved < 1) {
          this.activeVerifications = new Set(state.activeVerifications);
          console.log(`🔄 Restored ${state.activeVerifications.length} active verifications from storage`);
        } else {
          console.log('🧹 Cleared old active verifications (>1 hour old)');
        }
      }
      
      console.log('✅ Scheduler state restored from localStorage');
    } catch (error) {
      console.warn('Failed to load scheduler state from localStorage:', error);
    }
  }

  // Initialize risk engine actor
  private async createRiskEngineActor() {
    if (this.riskEngineActor) {
      return this.riskEngineActor;
    }

    try {
      const { Actor, HttpAgent } = await import('@dfinity/agent');
      
      // Create agent (same pattern as backend service)
      const isBrowser = typeof window !== 'undefined';
      const agent = new HttpAgent({
        ...(isBrowser ? {} : { 
          host: (isLocal() ? 'http://127.0.0.1:4943' : 'https://icp-api.io') 
        }),
      });
      
      if (isLocal()) {
        try { 
          await agent.fetchRootKey(); 
        } catch (e) {
          console.warn('Failed to fetch root key:', e);
        }
      }

      // For now, we'll need to create a simple IDL for the risk engine
      // In production, this would use generated declarations
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
          'companyNeedsReverification': IDL.Func(
            [IDL.Nat],
            [IDL.Bool],
            ['query']
          ),
        });
      };

      this.riskEngineActor = Actor.createActor(riskEngineIdl, {
        agent,
        canisterId: this.riskEngineCanisterId,
      });

      console.log('Risk engine actor created successfully');
      return this.riskEngineActor;
    } catch (error) {
      console.error('Error creating risk engine actor:', error);
      throw error;
    }
  }

  // Check if a company needs verification
  private async checkCompanyVerificationStatus(companyId: number, companyName: string): Promise<boolean> {
    try {
      const actor = await this.createRiskEngineActor();
      const needsVerification = await actor.companyNeedsReverification(companyId);
      
      if (needsVerification) {
        console.log(`Company ${companyName} (ID: ${companyId}) needs verification`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error checking verification status for company ${companyId}:`, error);
      return false; // Don't trigger verification on error
    }
  }

  // Start verification for a company
  private async startCompanyVerification(companyId: number, companyName: string): Promise<boolean> {
    if (this.activeVerifications.has(companyId)) {
      console.log(`Verification already in progress for company ${companyId}`);
      return false;
    }

    if (this.activeVerifications.size >= this.MAX_CONCURRENT_VERIFICATIONS) {
      console.log('Maximum concurrent verifications reached, skipping for now');
      return false;
    }

    try {
      this.activeVerifications.add(companyId);
      console.log(`Starting verification for company ${companyName} (ID: ${companyId})`);
      
      const actor = await this.createRiskEngineActor();
      const jobId = await actor.startVerification(
        companyId, 
        companyName, 
        { normal: null } as JobPriority
      );
      
      console.log(`Verification job ${jobId} started for company ${companyId}`);
      
      // Remove from active verifications after a delay (job is now queued in backend)
      setTimeout(() => {
        this.activeVerifications.delete(companyId);
      }, 30000); // 30 seconds
      
      return true;
    } catch (error) {
      console.error(`Error starting verification for company ${companyId}:`, error);
      this.activeVerifications.delete(companyId);
      return false;
    }
  }

  // Get current time in Indonesian timezone
  private getIndonesianTime(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: this.INDONESIA_TIMEZONE }));
  }

  // Calculate next midnight in Indonesian time
  private calculateNextMidnight(): Date {
    const now = this.getIndonesianTime();
    const nextMidnight = new Date(now);
    
    // Set to next midnight (00:00:00)
    nextMidnight.setHours(this.DAILY_RUN_HOUR, this.DAILY_RUN_MINUTE, 0, 0);
    
    // If it's already past midnight today, schedule for tomorrow
    if (nextMidnight <= now) {
      nextMidnight.setDate(nextMidnight.getDate() + 1);
    }
    
    return nextMidnight;
  }

  // Check if we should run today (in case of missed runs)
  private shouldRunToday(): boolean {
    const today = this.getIndonesianTime();
    const todayStr = today.toISOString().split('T')[0];
    
    if (!this.lastScheduledRun) {
      return true; // First run
    }
    
    const lastRunStr = this.lastScheduledRun.toISOString().split('T')[0];
    return todayStr !== lastRunStr; // Haven't run today yet
  }

  // Main daily verification routine
  private async performDailyVerificationCheck(): Promise<void> {
    const indonesianTime = this.getIndonesianTime();
    console.log(`🕛 Starting daily verification check at ${indonesianTime.toLocaleString('en-US', { 
      timeZone: this.INDONESIA_TIMEZONE,
      dateStyle: 'full',
      timeStyle: 'medium'
    })}`);

    try {
      // Get all companies from backend
      const companies = await backendService.listCompanies();
      console.log(`📊 Checking verification status for ${companies.length} companies`);

      let verificationsStarted = 0;
      let companiesNeedingVerification = 0;

      for (const company of companies) {
        if (verificationsStarted >= this.MAX_VERIFICATIONS_PER_RUN) {
          console.log(`⏹️ Reached maximum verifications per run (${this.MAX_VERIFICATIONS_PER_RUN})`);
          break;
        }

        if (this.activeVerifications.size >= this.MAX_CONCURRENT_VERIFICATIONS) {
          console.log(`⏸️ Maximum concurrent verifications reached (${this.MAX_CONCURRENT_VERIFICATIONS})`);
          break;
        }

        try {
          const needsVerification = await this.checkCompanyVerificationStatus(
            company.id, 
            company.name
          );

          if (needsVerification) {
            companiesNeedingVerification++;
            const started = await this.startCompanyVerification(
              company.id, 
              company.name
            );
            
            if (started) {
              verificationsStarted++;
              // Add small delay between verifications
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        } catch (error) {
          console.error(`❌ Error checking company ${company.id}:`, error);
        }
      }

      // Update last run timestamp
      this.lastScheduledRun = indonesianTime;
      
      // Save state to persistence
      this.saveToStorage();
      
      console.log(`✅ Daily verification check completed:`);
      console.log(`   • Companies checked: ${companies.length}`);
      console.log(`   • Companies needing verification: ${companiesNeedingVerification}`);
      console.log(`   • Verifications started: ${verificationsStarted}`);
      console.log(`   • Active verifications: ${this.activeVerifications.size}`);

      // Schedule next run
      this.scheduleNextMidnightRun();
      
    } catch (error) {
      console.error('❌ Error during daily verification check:', error);
      // Still schedule next run even if current one failed
      this.scheduleNextMidnightRun();
    }
  }

  // Schedule the next midnight run
  private scheduleNextMidnightRun(): void {
    // Clear existing timeout
    if (this.dailyTimeoutId) {
      clearTimeout(this.dailyTimeoutId);
    }

    const nextMidnight = this.calculateNextMidnight();
    const now = new Date();
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    
    this.nextScheduledRun = nextMidnight;

    console.log(`⏰ Next verification scheduled for: ${nextMidnight.toLocaleString('en-US', { 
      timeZone: this.INDONESIA_TIMEZONE,
      dateStyle: 'full', 
      timeStyle: 'medium'
    })}`);
    console.log(`   Time until next run: ${Math.round(msUntilMidnight / (1000 * 60 * 60))} hours`);

    this.dailyTimeoutId = setTimeout(() => {
      this.performDailyVerificationCheck();
    }, msUntilMidnight);
  }

  // Start the daily midnight verification scheduler
  public start(): void {
    if (this.isRunning) {
      console.log('🔄 Verification scheduler is already running');
      return;
    }

    // Load previous state from localStorage
    this.loadFromStorage();

    const indonesianTime = this.getIndonesianTime();
    console.log(`🚀 Starting daily verification scheduler at ${indonesianTime.toLocaleString('en-US', { 
      timeZone: this.INDONESIA_TIMEZONE,
      dateStyle: 'short',
      timeStyle: 'medium'
    })}`);
    
    this.isRunning = true;

    // Check if we missed today's run and should run now
    if (this.shouldRunToday()) {
      console.log('📅 Missed scheduled run detected, running verification check now...');
      // Run after 10 seconds to allow system to initialize
      setTimeout(() => {
        this.performDailyVerificationCheck();
      }, 10000);
    } else {
      console.log('✅ Already ran today, scheduling next midnight run');
      this.scheduleNextMidnightRun();
    }

    // Set up status monitoring (every minute)
    this.checkIntervalId = setInterval(() => {
      // Just log periodic status
      if (this.activeVerifications.size > 0) {
        console.log(`🔍 Verification status: ${this.activeVerifications.size} active verifications`);
      }
    }, this.STATUS_CHECK_INTERVAL_MS);
  }

  // Stop the scheduler
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('⏹️ Stopping daily verification scheduler');
    this.isRunning = false;

    if (this.dailyTimeoutId) {
      clearTimeout(this.dailyTimeoutId);
      this.dailyTimeoutId = null;
    }

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    this.activeVerifications.clear();
    this.nextScheduledRun = null;
    
    // Clear persisted state
    try {
      localStorage.removeItem(this.STORAGE_KEYS.SCHEDULER_STATE);
    } catch (error) {
      console.warn('Failed to clear scheduler state from localStorage:', error);
    }
  }

  // Get scheduler status
  public getStatus() {
    const indonesianTime = this.getIndonesianTime();
    const nextRunHours = this.nextScheduledRun 
      ? Math.round((this.nextScheduledRun.getTime() - new Date().getTime()) / (1000 * 60 * 60))
      : null;

    return {
      isRunning: this.isRunning,
      activeVerifications: Array.from(this.activeVerifications),
      lastScheduledRun: this.lastScheduledRun,
      nextScheduledRun: this.nextScheduledRun,
      nextRunInHours: nextRunHours,
      currentIndonesianTime: indonesianTime,
      timezone: this.INDONESIA_TIMEZONE,
    };
  }

  // Manual trigger for testing (runs full daily check)
  public async triggerManualCheck(): Promise<void> {
    console.log('🔧 Manual verification check triggered');
    
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running, starting manual check...');
    }
    
    await this.performDailyVerificationCheck();
  }

  // Check specific company verification status (for debugging)
  public async checkCompanyStatus(companyId: number): Promise<any> {
    try {
      const actor = await this.createRiskEngineActor();
      return await actor.getCompanyVerificationStatus(companyId);
    } catch (error) {
      console.error(`Error checking company ${companyId} status:`, error);
      return null;
    }
  }

  // Testing utilities for development
  public getTestInfo() {
    const indonesianTime = this.getIndonesianTime();
    const nextMidnight = this.calculateNextMidnight();
    const msUntilMidnight = nextMidnight.getTime() - new Date().getTime();
    
    return {
      currentIndonesianTime: indonesianTime,
      nextMidnight: nextMidnight,
      hoursUntilNext: Math.round(msUntilMidnight / (1000 * 60 * 60)),
      minutesUntilNext: Math.round(msUntilMidnight / (1000 * 60)),
      shouldRunToday: this.shouldRunToday(),
      lastRun: this.lastScheduledRun,
      timezone: this.INDONESIA_TIMEZONE,
      scheduledTime: `${this.DAILY_RUN_HOUR.toString().padStart(2, '0')}:${this.DAILY_RUN_MINUTE.toString().padStart(2, '0')} WIB`
    };
  }

  // Force next run time (for testing)
  public setTestRunTime(minutesFromNow: number): void {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('⚠️ Test functions only available in development mode');
      return;
    }

    const testTime = new Date(Date.now() + (minutesFromNow * 60 * 1000));
    console.log(`🧪 Test mode: Next verification scheduled for ${testTime.toLocaleString()}`);
    
    // Clear existing timeout
    if (this.dailyTimeoutId) {
      clearTimeout(this.dailyTimeoutId);
    }

    // Set test timeout
    this.dailyTimeoutId = setTimeout(() => {
      console.log('🧪 Test verification triggered');
      this.performDailyVerificationCheck();
    }, minutesFromNow * 60 * 1000);

    this.nextScheduledRun = testTime;
  }
}

// Export singleton instance
export const verificationScheduler = new VerificationSchedulerService();

// Export types for use in components
export type { VerificationStatus, VerificationProfile, VerificationJob };