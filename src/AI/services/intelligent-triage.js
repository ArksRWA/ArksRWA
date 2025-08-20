import GeminiService from './gemini.js';

/**
 * Intelligent Risk Triage Service for Indonesian Fraud Detection
 * Performs initial risk assessment and generates resource-efficient scraping strategies
 * Stage 1 Implementation: Pre-analysis intelligence and strategy generation
 */
class IntelligentRiskTriageService {
  constructor(geminiService = null) {
    this.gemini = geminiService || new GeminiService();
    
    // Indonesian fraud pattern database (based on historical analysis)
    this.riskPatterns = this.initializeIndonesianRiskPatterns();
    
    // Triage configuration
    this.config = {
      // Risk thresholds for strategy generation
      lowRiskThreshold: 25,
      mediumRiskThreshold: 50,
      highRiskThreshold: 75,
      
      // Timeout configurations by strategy level
      timeoutStrategies: {
        light: { maxTime: 15000, sources: 2, maxResults: 5 },
        medium: { maxTime: 30000, sources: 4, maxResults: 10 },
        deep: { maxTime: 45000, sources: 6, maxResults: 20 }
      },
      
      // Industry-specific risk multipliers
      industryMultipliers: {
        'fintech': 1.2,
        'cryptocurrency': 1.5,
        'investment': 1.4,
        'lending': 1.3,
        'banking': 0.8,
        'manufacturing': 0.7,
        'agriculture': 0.8,
        'retail': 0.9,
        'default': 1.0
      }
    };
    
    // Triage cache for repeated analyses
    this.triageCache = new Map();
  }

  /**
   * Initialize Indonesian-specific fraud patterns based on historical data
   */
  initializeIndonesianRiskPatterns() {
    return {
      // High-risk immediate indicators (requiring deep analysis)
      immediateRedFlags: [
        // Investment scam patterns
        'investasi bodong', 'skema ponzi', 'money game', 'robot trading',
        'guaranteed profit', 'tanpa risiko', 'passive income', 'profit guaranteed',
        
        // MLM and pyramid schemes
        'mlm', 'multi level marketing', 'network marketing', 'binary bonus',
        'referral income', 'downline', 'upline', 'matrix system',
        
        // Cryptocurrency scams
        'auto trading bot', 'mining contract', 'cloud mining', 'arbitrage bot',
        'cryptocurrency guaranteed', 'bitcoin investment', 'altcoin scheme',
        
        // Indonesian-specific scam terms
        'arisan online', 'tabungan berjangka', 'investasi syariah palsu',
        'bisnis rumahan menguntungkan', 'kerja dari rumah profit'
      ],
      
      // Medium-risk patterns (requiring standard verification)
      potentialConcerns: [
        // Financial irregularities
        'pinjaman online', 'kredit cepat', 'cash advance', 'dana instan',
        'pinjaman tanpa jaminan', 'bunga rendah dijamin',
        
        // Business model concerns
        'franchise murah', 'modal kecil untung besar', 'bisnis online terpercaya',
        'jual beli online', 'dropship guaranteed', 'affiliate marketing'
      ],
      
      // Low-risk patterns (light verification sufficient)
      legitimacySignals: [
        // Official registration indicators
        'terdaftar ojk', 'izin ojk', 'registered financial', 'bank indonesia',
        'kementerian', 'kemenkumham', 'ministry approved',
        
        // Business legitimacy markers
        'iso certified', 'audit pwc', 'audit kpmg', 'listed company',
        'go public', 'tbk', 'blue chip', 'state owned enterprise',
        
        // Industry leadership indicators
        'market leader', 'industry pioneer', 'established since', 'founded'
      ],
      
      // Indonesian business context patterns
      businessContexts: {
        traditional: ['warung', 'toko', 'usaha keluarga', 'umkm', 'home industry'],
        digital: ['fintech', 'startup', 'unicorn', 'e-commerce', 'marketplace'],
        formal: ['pt ', 'cv ', 'tbk', 'bumn', 'persero'],
        regulated: ['bank', 'asuransi', 'sekuritas', 'multifinance', 'fintech']
      }
    };
  }

  /**
   * Main triage function - performs initial risk assessment
   * @param {Object} companyData - Company information for analysis
   * @returns {Object} Triage results with risk level and scraping strategy
   */
  async performInitialTriage(companyData) {
    try {
      console.log(`🧠 Starting intelligent triage for: ${companyData.name}`);
      
      // Check cache first
      const cacheKey = this.generateTriageCacheKey(companyData);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`📋 Using cached triage for: ${companyData.name}`);
        return { ...cached, cached: true };
      }
      
      // Step 1: Immediate pattern matching for obvious cases
      const patternAnalysis = this.performPatternMatching(companyData);
      
      // Step 2: Enhanced Gemini-powered risk assessment
      const aiTriage = await this.performAITriage(companyData, patternAnalysis);
      
      // Step 3: Generate intelligent scraping strategy
      const scrapingStrategy = this.generateScrapingStrategy(aiTriage.riskLevel, patternAnalysis);
      
      // Step 4: Estimate resource requirements
      const resourceEstimate = this.estimateResourceRequirements(scrapingStrategy);
      
      const triageResult = {
        riskLevel: aiTriage.riskLevel,
        initialScore: aiTriage.initialScore,
        confidence: aiTriage.confidence,
        riskFactors: aiTriage.riskFactors,
        legitimacySignals: patternAnalysis.legitimacySignals,
        scrapingStrategy: scrapingStrategy,
        resourceEstimate: resourceEstimate,
        timestamp: new Date().toISOString(),
        processingTimeMs: aiTriage.processingTimeMs
      };
      
      // Cache the result
      this.addToCache(cacheKey, triageResult);
      
      console.log(`✅ Triage completed - Risk: ${triageResult.riskLevel}, Strategy: ${scrapingStrategy.level}`);
      return triageResult;
      
    } catch (error) {
      console.error('Triage error:', error);
      throw new Error(`Intelligent triage failed: ${error.message}. No fallback triage available.`);
    }
  }

  /**
   * Performs immediate pattern matching against known fraud indicators
   */
  performPatternMatching(companyData) {
    const { name, description, industry } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    const analysis = {
      immediateRedFlags: [],
      potentialConcerns: [],
      legitimacySignals: [],
      businessContext: 'unknown',
      industryRisk: 'medium'
    };
    
    // Check for immediate red flags
    for (const pattern of this.riskPatterns.immediateRedFlags) {
      if (text.includes(pattern)) {
        analysis.immediateRedFlags.push(pattern);
      }
    }
    
    // Check for potential concerns
    for (const pattern of this.riskPatterns.potentialConcerns) {
      if (text.includes(pattern)) {
        analysis.potentialConcerns.push(pattern);
      }
    }
    
    // Check for legitimacy signals
    for (const pattern of this.riskPatterns.legitimacySignals) {
      if (text.includes(pattern)) {
        analysis.legitimacySignals.push(pattern);
      }
    }
    
    // Determine business context
    for (const [context, patterns] of Object.entries(this.riskPatterns.businessContexts)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          analysis.businessContext = context;
          break;
        }
      }
      if (analysis.businessContext !== 'unknown') break;
    }
    
    // Apply industry risk multiplier
    const multiplier = this.config.industryMultipliers[industry] || this.config.industryMultipliers.default;
    analysis.industryRiskMultiplier = multiplier;
    
    return analysis;
  }

  /**
   * Performs AI-powered triage using Gemini
   */
  async performAITriage(companyData, patternAnalysis) {
    const startTime = Date.now();
    
    try {
      // Create specialized triage prompt
      const triagePrompt = this.createTriagePrompt(companyData, patternAnalysis);
      
      // Use Gemini for intelligent risk assessment
      const aiResponse = await this.gemini.model?.generateContent({
        contents: [{ role: 'user', parts: [{ text: triagePrompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 1024
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      if (!aiResponse) {
        throw new Error('AI triage service unavailable - no mock data fallback available');
      }
      
      if (this.gemini.testMode) {
        throw new Error('AI triage service in test mode - no mock data fallback available');
      }
      
      const response = await aiResponse.response;
      const text = response.text();
      
      // Extract structured response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI triage response format');
      }
      
      const aiTriage = JSON.parse(jsonMatch[0]);
      aiTriage.processingTimeMs = processingTime;
      
      return aiTriage;
      
    } catch (error) {
      console.error('AI triage failed:', error.message);
      throw new Error(`AI triage service failed: ${error.message}. No mock data fallback available.`);
    }
  }

  /**
   * Creates specialized Gemini prompt for triage analysis
   */
  createTriagePrompt(companyData, patternAnalysis) {
    const { name, description, industry } = companyData;
    
    return `
INDONESIAN COMPANY RISK TRIAGE ANALYSIS

**COMPANY INFORMATION:**
- Name: ${name}
- Description: ${description}
- Industry: ${industry || 'Not specified'}

**PATTERN ANALYSIS RESULTS:**
- Immediate Red Flags Found: ${patternAnalysis.immediateRedFlags.length > 0 ? patternAnalysis.immediateRedFlags.join(', ') : 'None'}
- Potential Concerns: ${patternAnalysis.potentialConcerns.length > 0 ? patternAnalysis.potentialConcerns.join(', ') : 'None'}
- Legitimacy Signals: ${patternAnalysis.legitimacySignals.length > 0 ? patternAnalysis.legitimacySignals.join(', ') : 'None'}
- Business Context: ${patternAnalysis.businessContext}

**ANALYSIS OBJECTIVE:**
Perform rapid initial risk assessment to determine appropriate investigation depth. Focus on:

1. **IMMEDIATE RISK DETERMINATION** - Can we conclusively classify this as high/low risk?
2. **RESOURCE ALLOCATION** - How much investigation effort is warranted?
3. **PRIORITY FRAUD PATTERNS** - What specific Indonesian fraud patterns should we investigate?
4. **INVESTIGATION FOCUS** - What sources/keywords will yield the most valuable information?

**RESPONSE FORMAT (JSON):**
{
  "riskLevel": "[low|medium|high|critical]",
  "initialScore": [0-100],
  "confidence": [0-100],
  "riskFactors": ["list of specific risk factors found"],
  "priorityPatterns": ["Indonesian fraud patterns to investigate"],
  "investigationFocus": ["specific areas requiring verification"],
  "reasoning": "Brief explanation of risk assessment"
}

**SCORING CRITERIA:**
- 0-25: Low Risk - Light verification sufficient (traditional businesses, clear legitimacy)
- 26-50: Medium Risk - Standard verification needed (typical business concerns)
- 51-75: High Risk - Deep investigation required (multiple red flags)
- 76-100: Critical Risk - Immediate manual review (obvious fraud patterns)

**INDONESIAN CONTEXT CONSIDERATIONS:**
- Traditional businesses may have limited digital presence (not suspicious)
- OJK registration requirements apply only to financial services
- Consider regional business practices and cultural factors
- Distinguish between fraud prevention services vs fraudulent companies

Begin analysis now:`;
  }


  /**
   * Generates intelligent scraping strategy based on triage results
   */
  generateScrapingStrategy(riskLevel, patternAnalysis) {
    const baseStrategies = {
      low: {
        level: 'light',
        priority: ['ojk_basic', 'news_sentiment'],
        sources: ['ojk.go.id', 'google_news'],
        searchTerms: ['basic_verification', 'legitimacy_check'],
        maxResults: 5,
        timeoutMs: 15000,
        earlyTermination: true,
        terminationThreshold: 3 // Stop if 3+ positive signals found
      },
      medium: {
        level: 'medium',
        priority: ['business_registration', 'news_coverage', 'ojk_detailed'],
        sources: ['ojk.go.id', 'detik.com', 'kompas.com', 'business_directories'],
        searchTerms: ['comprehensive_check', 'reputation_analysis'],
        maxResults: 10,
        timeoutMs: 30000,
        earlyTermination: true,
        terminationThreshold: 5 // Continue until 5+ data points
      },
      high: {
        level: 'deep',
        priority: ['fraud_investigation', 'regulatory_warnings', 'victim_reports'],
        sources: ['ojk.go.id', 'ppatk.go.id', 'detik.com', 'kompas.com', 'tribunnews.com', 'social_media'],
        searchTerms: ['fraud_investigation', 'scam_reports', 'regulatory_action'],
        maxResults: 20,
        timeoutMs: 45000,
        earlyTermination: false, // Continue full investigation
        terminationThreshold: null
      },
      critical: {
        level: 'deep',
        priority: ['immediate_verification', 'fraud_evidence', 'regulatory_action'],
        sources: ['ojk.go.id', 'ppatk.go.id', 'ahu.go.id', 'all_news_sources', 'social_media', 'complaint_sites'],
        searchTerms: ['fraud_confirmation', 'scam_evidence', 'victim_testimonials'],
        maxResults: 25,
        timeoutMs: 60000,
        earlyTermination: false,
        terminationThreshold: null
      }
    };
    
    const strategy = baseStrategies[riskLevel] || baseStrategies.medium;
    
    // Enhance strategy based on pattern analysis
    if (patternAnalysis.businessContext === 'regulated') {
      strategy.sources.push('bank_indonesia');
      strategy.searchTerms.push('regulatory_compliance');
    }
    
    if (patternAnalysis.immediateRedFlags.length > 0) {
      strategy.priority.unshift('immediate_fraud_check');
      strategy.searchTerms.unshift('fraud_alert', 'scam_warning');
    }
    
    return strategy;
  }

  /**
   * Estimates resource requirements for the scraping strategy
   */
  estimateResourceRequirements(strategy) {
    const baseRequirements = this.config.timeoutStrategies[strategy.level];
    
    return {
      estimatedTimeMs: strategy.timeoutMs,
      maxSources: strategy.sources.length,
      maxResults: strategy.maxResults,
      networkRequests: strategy.sources.length * 2, // Estimate 2 requests per source
      memoryMb: Math.ceil(strategy.maxResults * 0.5), // Estimate 0.5MB per result
      cpuIntensive: strategy.level === 'deep',
      parallelizable: true
    };
  }

  /**
   * Cache management for triage results
   */
  generateTriageCacheKey(companyData) {
    const { name, description } = companyData;
    return Buffer.from(`triage:${name}:${description.substring(0, 100)}`).toString('base64');
  }

  getFromCache(key) {
    const cached = this.triageCache.get(key);
    if (!cached) return null;
    
    const now = new Date();
    const expiry = new Date(cached.timestamp);
    expiry.setHours(expiry.getHours() + 6); // 6-hour cache for triage
    
    if (now > expiry) {
      this.triageCache.delete(key);
      return null;
    }
    
    return cached;
  }

  addToCache(key, result) {
    this.triageCache.set(key, result);
  }


  /**
   * Test the triage service with sample companies
   */
  async testTriage() {
    const testCompanies = [
      {
        name: 'PT Bank Digital Indonesia',
        description: 'Bank digital terdaftar OJK dengan layanan mobile banking',
        industry: 'banking'
      },
      {
        name: 'Investasi Ponzi Guaranteed',
        description: 'Investasi dengan keuntungan guaranteed 50% per bulan',
        industry: 'investment'
      },
      {
        name: 'PT Aqua Golden Mississippi',
        description: 'Produsen air minum dalam kemasan merek AQUA',
        industry: 'manufacturing'
      }
    ];
    
    console.log('🧪 Testing Intelligent Triage Service...');
    const results = [];
    
    for (const company of testCompanies) {
      const result = await this.performInitialTriage(company);
      results.push({
        company: company.name,
        result
      });
    }
    
    return results;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.triageCache.clear();
    if (this.gemini && typeof this.gemini.cleanup === 'function') {
      await this.gemini.cleanup();
    }
  }
}

export default IntelligentRiskTriageService;