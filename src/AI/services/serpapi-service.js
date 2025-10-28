/**
 * SerpAPI Service for Indonesian Fraud Detection
 * 
 * Provides news-focused search capabilities with tiered Indonesian news sources
 * and specialized fraud detection queries optimized for credible journalism.
 */

import { getJson } from 'serpapi';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

export class SerpAPIService {
  constructor() {
    this.apiKey = process.env.SERPAPI_API_KEY;
    this.rateLimit = parseInt(process.env.SERPAPI_RATE_LIMIT_MS) || 1000;
    this.maxRetries = parseInt(process.env.SERPAPI_MAX_RETRIES) || 3;
    this.timeout = parseInt(process.env.SERPAPI_TIMEOUT_MS) || 120000;
    this.extendedTimeout = parseInt(process.env.SERPAPI_EXTENDED_TIMEOUT_MS) || 300000;
    this.dailyQuota = parseInt(process.env.SERPAPI_QUOTA_DAILY) || 1000;
    this.cacheTTL = parseInt(process.env.SERPAPI_CACHE_TTL_HOURS) || 24;
    
    // Cache for storing search results
    this.cache = new Map();
    this.quotaUsed = 0;
    this.lastReset = new Date().toDateString();
    
    // Rate limiting
    this.lastRequest = 0;
    
    // Tiered Indonesian News Sources with Credibility Scoring
    this.newsSources = {
      tier1: { // Highest credibility (100% weight)
        sources: ['liputan6.com', 'cnn.indonesia.com', 'kompas.com'],
        weight: 1.0,
        description: 'Premium national news sources'
      },
      tier2: { // High credibility (80% weight)
        sources: ['detik.com', 'tempo.co', 'republika.co.id', 'antara.com'],
        weight: 0.8,
        description: 'Established national news sources'
      },
      tier3: { // Financial focus (90% weight for financial topics)
        sources: ['kontan.co.id', 'bisnis.com', 'investor.id', 'bareksa.com'],
        weight: 0.9,
        description: 'Financial and business news specialists'
      },
      tier4: { // Investigative (95% weight)
        sources: ['tirto.id', 'theconversation.com'],
        weight: 0.95,
        description: 'Investigative and analytical journalism'
      }
    };
    
    // All news sources for comprehensive searches
    this.allNewsSources = [
      ...this.newsSources.tier1.sources,
      ...this.newsSources.tier2.sources,
      ...this.newsSources.tier3.sources,
      ...this.newsSources.tier4.sources
    ];
    
    console.log(chalk.blue('📰 SerpAPI Service initialized with tiered Indonesian news sources'));
    console.log(chalk.gray(`   Total sources: ${this.allNewsSources.length} across 4 tiers`));
  }

  /**
   * Build site query string for specific news sources
   */
  buildSiteQuery(sources) {
    return sources.map(site => `site:${site}`).join(' OR ');
  }

  /**
   * Get credibility weight for a specific source
   */
  getSourceCredibility(domain) {
    for (const tier of Object.values(this.newsSources)) {
      if (tier.sources.some(source => domain.includes(source))) {
        return tier.weight;
      }
    }
    return 0.5; // Default weight for unknown sources
  }

  /**
   * Calculate article recency weight (more recent = higher weight)
   */
  getRecencyWeight(dateString) {
    if (!dateString) return 0.5;
    
    const now = new Date();
    const articleDate = new Date(dateString);
    const daysDiff = Math.floor((now - articleDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 7) return 1.0;        // Last week: full weight
    if (daysDiff <= 30) return 0.8;       // Last month: 80%
    if (daysDiff <= 90) return 0.6;       // Last quarter: 60%
    if (daysDiff <= 365) return 0.4;      // Last year: 40%
    return 0.2;                           // Older: 20%
  }

  /**
   * Reset daily quota if new day
   */
  resetQuotaIfNewDay() {
    const today = new Date().toDateString();
    if (today !== this.lastReset) {
      this.quotaUsed = 0;
      this.lastReset = today;
      console.log(chalk.green('📊 SerpAPI quota reset for new day'));
    }
  }

  /**
   * Check if within quota limits
   */
  isWithinQuota() {
    this.resetQuotaIfNewDay();
    return this.quotaUsed < this.dailyQuota;
  }

  /**
   * Apply rate limiting
   */
  async applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.rateLimit) {
      const delay = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequest = Date.now();
  }

  /**
   * Generate cache key for search parameters
   */
  getCacheKey(engine, query, options = {}) {
    const key = `${engine}_${query}_${JSON.stringify(options)}`;
    return key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  /**
   * Check cache for existing results
   */
  getCachedResult(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const hoursSinceCached = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
    if (hoursSinceCached > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    console.log(chalk.yellow(`📦 Using cached result for query`));
    return cached.data;
  }

  /**
   * Store result in cache
   */
  setCachedResult(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Execute SerpAPI search with retry logic and extended timeout support
   */
  async executeSearch(engine, query, options = {}) {
    // Check if SerpAPI is enabled via environment flag
    const serpApiEnabled = process.env.SERPAPI_ENABLED === 'true';
    
    if (!serpApiEnabled) {
      console.log(chalk.yellow('⚠️ SerpAPI disabled via SERPAPI_ENABLED flag, returning structured noop result'));
      return {
        search_metadata: {
          id: 'disabled',
          status: 'Disabled',
          json_endpoint: '',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          google_url: '',
          raw_html_file: '',
          total_time_taken: 0
        },
        search_parameters: {
          engine,
          q: query,
          ...options
        },
        organic_results: [],
        news_results: [],
        related_searches: [],
        knowledge_graph: {},
        answer_box: {},
        shopping_results: [],
        images_results: [],
        inline_videos: [],
        related_questions: []
      };
    }
    
    if (!this.apiKey || this.apiKey === 'your-serpapi-key-here') {
      console.log(chalk.yellow('⚠️ SerpAPI key not configured, returning structured noop result'));
      return {
        search_metadata: {
          id: 'no_key',
          status: 'No Key',
          json_endpoint: '',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          google_url: '',
          raw_html_file: '',
          total_time_taken: 0
        },
        search_parameters: {
          engine,
          q: query,
          ...options
        },
        organic_results: [],
        news_results: [],
        related_searches: [],
        knowledge_graph: {},
        answer_box: {},
        shopping_results: [],
        images_results: [],
        inline_videos: [],
        related_questions: []
      };
    }

    if (!this.isWithinQuota()) {
      console.log(chalk.yellow('⚠️ SerpAPI quota exceeded, returning structured noop result'));
      return {
        search_metadata: {
          id: 'quota_exceeded',
          status: 'Quota Exceeded',
          json_endpoint: '',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          google_url: '',
          raw_html_file: '',
          total_time_taken: 0
        },
        search_parameters: {
          engine,
          q: query,
          ...options
        },
        organic_results: [],
        news_results: [],
        related_searches: [],
        knowledge_graph: {},
        answer_box: {},
        shopping_results: [],
        images_results: [],
        inline_videos: [],
        related_questions: []
      };
    }

    const cacheKey = this.getCacheKey(engine, query, options);
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    await this.applyRateLimit();

    const searchParams = {
      engine,
      q: query,
      api_key: this.apiKey,
      ...options
    };

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(chalk.blue(`🔍 SerpAPI search (attempt ${attempt}): ${query.substring(0, 50)}...`));
        
        // Use extended timeout for comprehensive analysis or regular timeout for quick searches
        const timeoutMs = options.useExtendedTimeout ? this.extendedTimeout : this.timeout;
        console.log(chalk.gray(`   Using ${timeoutMs}ms timeout (${timeoutMs === this.extendedTimeout ? 'extended' : 'standard'})`));
        
        const result = await Promise.race([
          getJson(searchParams),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Search timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);

        this.quotaUsed++;
        this.setCachedResult(cacheKey, result);
        
        console.log(chalk.green(`✅ SerpAPI search successful`));
        return result;

      } catch (error) {
        lastError = error;
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        console.log(chalk.red(`❌ SerpAPI search failed (attempt ${attempt}): ${errorMessage}`));
        
        // Check if this is a quota exhaustion error - immediately throw without retries
        if (errorMessage.includes('run out of searches') || errorMessage.includes('quota exhausted') || errorMessage.includes('Your account has run out of searches')) {
          console.log(chalk.red('💳 SerpAPI quota exhausted - immediately throwing error, no retries'));
          throw new Error(`SerpAPI quota exhausted: ${errorMessage}`);
        }
        
        console.log(chalk.red(`   Error details:`, error));
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const finalErrorMessage = lastError?.message || lastError?.toString() || 'Unknown error occurred';
    throw new Error(`SerpAPI search failed after ${this.maxRetries} attempts: ${finalErrorMessage}`);
  }


  /**
   * Specialized News-Focused Search Functions
   */

  /**
   * Search for investigative journalism on fraud
   */
  async searchFraudInvestigativeNews(companyName, options = {}) {
    const investigativeSources = this.buildSiteQuery([
      ...this.newsSources.tier4.sources, // Investigative journalism
      ...this.newsSources.tier1.sources  // Premium sources
    ]);
    
    const query = `(${investigativeSources}) "${companyName}" AND (penipuan OR "investasi bodong" OR penyidikan OR "kasus fraud" OR "modus operandi" OR "korban masyarakat")`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 15,
      ...options
    });
  }

  /**
   * Search for financial crime coverage in business news
   */
  async searchFinancialCrimeNews(companyName, options = {}) {
    const financialSources = this.buildSiteQuery([
      ...this.newsSources.tier3.sources, // Financial specialists
      ...this.newsSources.tier1.sources  // Premium sources
    ]);
    
    const query = `(${financialSources}) "${companyName}" AND ("money laundering" OR pencucian uang OR "financial fraud" OR "investment scam" OR "ponzi scheme" OR "kasus keuangan")`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 12,
      ...options
    });
  }

  /**
   * Search for regulatory news alerts and official actions
   */
  async searchRegulatoryNewsAlerts(companyName) {
    const allSources = this.buildSiteQuery(this.allNewsSources);
    
    const query = `(${allSources}) "${companyName}" AND (OJK OR "Bank Indonesia" OR "Kementerian Keuangan" OR sanksi OR peringatan OR "tindakan hukum" OR "investigasi otoritas")`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  /**
   * Search for victim testimonials covered by professional journalism
   */
  async searchVictimTestimonialsInNews(companyName) {
    const credibleSources = this.buildSiteQuery([
      ...this.newsSources.tier1.sources,
      ...this.newsSources.tier2.sources
    ]);
    
    const query = `(${credibleSources}) "${companyName}" AND (korban OR "investor kecewa" OR "kehilangan uang" OR "laporan masyarakat" OR "pengalaman buruk" OR testimonial OR "cerita korban")`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 12
    });
  }

  /**
   * Search for general company reputation in news
   */
  async searchCompanyReputationNews(companyName) {
    const tier1Sources = this.buildSiteQuery(this.newsSources.tier1.sources);
    
    const query = `(${tier1Sources}) "${companyName}" AND (reputasi OR kredibilitas OR "track record" OR prestasi OR penghargaan OR "kinerja perusahaan")`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  /**
   * Search official government sites for regulatory mentions
   */
  async searchOfficialRegulatoryMentions(companyName) {
    const query = `site:ojk.go.id OR site:bi.go.id OR site:kemenkeu.go.id OR site:bapepam.go.id "${companyName}"`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 8
    });
  }

  /**
   * Search for recent news trends about the company
   */
  async searchRecentNewsTrends(companyName) {
    const allSources = this.buildSiteQuery(this.allNewsSources);
    
    const query = `(${allSources}) "${companyName}"`;
    
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 15,
      tbs: 'qdr:m3' // Last 3 months
    });
  }

  /**
   * News-focused company analysis with credibility scoring and extended timeout support
   */
  async analyzeCompany(companyName, options = {}) {
    const {
      skipOnConclusiveEvidence = true,
      maxSearches = 6,
      priority = 'balanced', // 'speed', 'balanced', 'thorough'
      useExtendedTimeout = false // Enable for 15-minute timeout scenarios
    } = options;

    console.log(chalk.blue(`📰 Starting news-focused SerpAPI analysis for: ${companyName}`));
    
    const results = {
      companyName,
      timestamp: new Date().toISOString(),
      searches: {},
      credibilityAnalysis: {},
      summary: {
        totalResults: 0,
        weightedFraudScore: 0,
        weightedLegitimacyScore: 0,
        conclusiveEvidence: false,
        earlyTermination: false,
        highestCredibilitySource: null,
        averageSourceCredibility: 0
      }
    };

    // Define search priority with news focus first
    let searchOrder;
    if (priority === 'speed') {
      searchOrder = ['fraudInvestigative', 'regulatoryNews', 'officialRegulatory'];
    } else if (priority === 'thorough') {
      searchOrder = ['fraudInvestigative', 'financialCrime', 'regulatoryNews', 'victimTestimonials', 'reputationNews', 'recentTrends', 'officialRegulatory'];
    } else {
      // Balanced: prioritize news-based searches over generic searches
      searchOrder = ['fraudInvestigative', 'regulatoryNews', 'financialCrime', 'victimTestimonials', 'reputationNews', 'officialRegulatory'];
    }

    let searchCount = 0;
    let totalCredibilityScore = 0;
    let credibilityCount = 0;
    
    for (const searchType of searchOrder) {
      if (searchCount >= maxSearches) break;
      
      try {
        let searchResult;
        
        // Pass extended timeout option to all search methods
        const searchOptions = useExtendedTimeout ? { useExtendedTimeout: true } : {};
        
        switch (searchType) {
          case 'fraudInvestigative':
            searchResult = await this.searchFraudInvestigativeNews(companyName, searchOptions);
            break;
          case 'financialCrime':
            searchResult = await this.searchFinancialCrimeNews(companyName, searchOptions);
            break;
          case 'regulatoryNews':
            searchResult = await this.searchRegulatoryNewsAlerts(companyName, searchOptions);
            break;
          case 'victimTestimonials':
            searchResult = await this.searchVictimTestimonialsInNews(companyName, searchOptions);
            break;
          case 'reputationNews':
            searchResult = await this.searchCompanyReputationNews(companyName, searchOptions);
            break;
          case 'recentTrends':
            searchResult = await this.searchRecentNewsTrends(companyName, searchOptions);
            break;
          case 'officialRegulatory':
            searchResult = await this.searchOfficialRegulatoryMentions(companyName, searchOptions);
            break;
          default:
            continue;
        }

        results.searches[searchType] = searchResult;
        searchCount++;

        // Analyze results with credibility scoring
        const analysis = this.analyzeNewsSearchResults(searchResult, searchType);
        results.credibilityAnalysis[searchType] = analysis;
        
        results.summary.totalResults += analysis.resultCount;
        results.summary.weightedFraudScore += analysis.weightedFraudScore;
        results.summary.weightedLegitimacyScore += analysis.weightedLegitimacyScore;
        
        if (analysis.averageCredibility > 0) {
          totalCredibilityScore += analysis.averageCredibility;
          credibilityCount++;
        }
        
        if (analysis.highestCredibilitySource && 
           (!results.summary.highestCredibilitySource || 
            analysis.highestCredibilitySource.credibility > results.summary.highestCredibilitySource.credibility)) {
          results.summary.highestCredibilitySource = analysis.highestCredibilitySource;
        }

        // Early termination conditions for news sources
        if (skipOnConclusiveEvidence && analysis.isConclusiveEvidence) {
          console.log(chalk.yellow(`⚡ Early termination: Conclusive evidence found in ${searchType} from credible news sources`));
          results.summary.conclusiveEvidence = true;
          results.summary.earlyTermination = true;
          break;
        }

      } catch (error) {
        console.log(chalk.red(`❌ News search failed for ${searchType}: ${error.message}`));
        
        // If this is a quota exhaustion error, immediately throw and stop all searches
        if (error.message.includes('quota exhausted') || error.message.includes('run out of searches')) {
          console.log(chalk.red('💳 SerpAPI quota exhausted - stopping all searches immediately'));
          throw error;
        }
        
        results.searches[searchType] = { error: error.message };
      }
    }

    // Calculate final credibility metrics
    results.summary.averageSourceCredibility = credibilityCount > 0 ? 
      (totalCredibilityScore / credibilityCount) : 0;

    console.log(chalk.green(`✅ News-focused analysis completed for ${companyName}`));
    console.log(chalk.gray(`   Searches: ${searchCount}, Avg credibility: ${results.summary.averageSourceCredibility.toFixed(2)}`));
    
    return results;
  }

  /**
   * Analyze news search results with credibility scoring
   */
  analyzeNewsSearchResults(searchResult, searchType) {
    const analysis = {
      resultCount: 0,
      rawFraudSignals: 0,
      rawLegitimacySignals: 0,
      weightedFraudScore: 0,
      weightedLegitimacyScore: 0,
      averageCredibility: 0,
      highestCredibilitySource: null,
      isConclusiveEvidence: false,
      sourceBreakdown: {}
    };

    if (!searchResult || searchResult.error) {
      return analysis;
    }

    const results = searchResult.organic_results || searchResult.news_results || [];
    analysis.resultCount = results.length;

    if (results.length === 0) return analysis;

    const fraudKeywords = [
      'penipuan', 'scam', 'fraud', 'penipu', 'gugatan', 'sanksi',
      'bermasalah', 'bangkrut', 'korban', 'tertipu', 'investasi bodong',
      'penyidikan', 'modus operandi', 'kasus fraud', 'pencucian uang',
      'money laundering', 'ponzi scheme'
    ];

    const legitimacyKeywords = [
      'resmi', 'terdaftar', 'OJK', 'sertifikat', 'izin', 'akreditasi',
      'kementerian', 'official', 'licensed', 'certified', 'reputasi',
      'kredibilitas', 'prestasi', 'penghargaan', 'kinerja perusahaan'
    ];

    let totalCredibility = 0;
    let highestCredibility = 0;

    for (const result of results) {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      const domain = new URL(result.link).hostname;
      
      // Get source credibility
      const sourceCredibility = this.getSourceCredibility(domain);
      totalCredibility += sourceCredibility;
      
      // Get recency weight if date available
      const recencyWeight = this.getRecencyWeight(result.date);
      const finalWeight = sourceCredibility * recencyWeight;
      
      // Track source breakdown
      if (!analysis.sourceBreakdown[domain]) {
        analysis.sourceBreakdown[domain] = {
          count: 0,
          credibility: sourceCredibility,
          fraudSignals: 0,
          legitimacySignals: 0
        };
      }
      analysis.sourceBreakdown[domain].count++;
      
      // Count fraud indicators with weighting
      const fraudMatches = fraudKeywords.filter(keyword => text.includes(keyword)).length;
      if (fraudMatches > 0) {
        analysis.rawFraudSignals++;
        analysis.weightedFraudScore += fraudMatches * finalWeight;
        analysis.sourceBreakdown[domain].fraudSignals++;
      }

      // Count legitimacy signals with weighting
      const legitimacyMatches = legitimacyKeywords.filter(keyword => text.includes(keyword)).length;
      if (legitimacyMatches > 0) {
        analysis.rawLegitimacySignals++;
        analysis.weightedLegitimacyScore += legitimacyMatches * finalWeight;
        analysis.sourceBreakdown[domain].legitimacySignals++;
      }

      // Track highest credibility source
      if (sourceCredibility > highestCredibility) {
        highestCredibility = sourceCredibility;
        analysis.highestCredibilitySource = {
          domain,
          credibility: sourceCredibility,
          title: result.title,
          url: result.link
        };
      }

      // Check for conclusive evidence from credible sources
      if (sourceCredibility >= 0.8) { // High credibility sources only
        if ((searchType === 'regulatoryNews' || searchType === 'officialRegulatory') && 
            (text.includes('sanksi') || text.includes('peringatan') || text.includes('investigasi otoritas'))) {
          analysis.isConclusiveEvidence = true;
        }
        
        if (searchType === 'fraudInvestigative' && fraudMatches >= 2) {
          analysis.isConclusiveEvidence = true;
        }
        
        if (searchType === 'financialCrime' && 
            (text.includes('money laundering') || text.includes('ponzi scheme') || text.includes('pencucian uang'))) {
          analysis.isConclusiveEvidence = true;
        }
      }
    }

    analysis.averageCredibility = totalCredibility / results.length;

    return analysis;
  }

  /**
   * Legacy analysis function for backward compatibility
   * @deprecated Use analyzeNewsSearchResults instead
   */
  analyzeSearchResults(searchResult, searchType) {
    const newsAnalysis = this.analyzeNewsSearchResults(searchResult, searchType);
    
    // Convert to legacy format
    return {
      resultCount: newsAnalysis.resultCount,
      fraudSignals: newsAnalysis.rawFraudSignals,
      legitimacySignals: newsAnalysis.rawLegitimacySignals,
      isConclusiveEvidence: newsAnalysis.isConclusiveEvidence
    };
  }

  /**
   * Get service statistics including news source information
   */
  getStats() {
    this.resetQuotaIfNewDay();
    
    return {
      quotaUsed: this.quotaUsed,
      quotaRemaining: this.dailyQuota - this.quotaUsed,
      cacheSize: this.cache.size,
      lastReset: this.lastReset,
      isOperational: this.apiKey && this.apiKey !== 'your-serpapi-key-here',
      newsSources: {
        totalSources: this.allNewsSources.length,
        tier1Sources: this.newsSources.tier1.sources.length,
        tier2Sources: this.newsSources.tier2.sources.length,
        tier3Sources: this.newsSources.tier3.sources.length,
        tier4Sources: this.newsSources.tier4.sources.length,
        sourcesByTier: this.newsSources
      },
      searchCapabilities: [
        'Fraud Investigative News',
        'Financial Crime Coverage',
        'Regulatory News Alerts',
        'Victim Testimonials in News',
        'Company Reputation News',
        'Official Regulatory Mentions',
        'Recent News Trends'
      ]
    };
  }

  /**
   * Get detailed news source information
   */
  getNewsSourceInfo() {
    return {
      tiers: Object.keys(this.newsSources).map(tierKey => {
        const tier = this.newsSources[tierKey];
        return {
          tier: tierKey,
          weight: tier.weight,
          description: tier.description,
          sources: tier.sources,
          count: tier.sources.length
        };
      }),
      allSources: this.allNewsSources,
      totalCount: this.allNewsSources.length
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log(chalk.green('🧹 SerpAPI cache cleared'));
  }
}

// Export singleton instance
export const serpAPIService = new SerpAPIService();