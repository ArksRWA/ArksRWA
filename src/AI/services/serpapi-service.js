/**
 * SerpAPI Service for Indonesian Fraud Detection
 * 
 * Provides multi-engine search capabilities with Indonesian localization
 * and specialized fraud detection queries optimized for Indonesian companies.
 */

import { getJson } from 'serpapi';
import chalk from 'chalk';

export class SerpAPIService {
  constructor() {
    this.apiKey = process.env.SERPAPI_API_KEY;
    this.rateLimit = parseInt(process.env.SERPAPI_RATE_LIMIT_MS) || 1000;
    this.maxRetries = parseInt(process.env.SERPAPI_MAX_RETRIES) || 3;
    this.timeout = parseInt(process.env.SERPAPI_TIMEOUT_MS) || 10000;
    this.dailyQuota = parseInt(process.env.SERPAPI_QUOTA_DAILY) || 1000;
    this.cacheTTL = parseInt(process.env.SERPAPI_CACHE_TTL_HOURS) || 24;
    
    // Cache for storing search results
    this.cache = new Map();
    this.quotaUsed = 0;
    this.lastReset = new Date().toDateString();
    
    // Rate limiting
    this.lastRequest = 0;
    
    console.log(chalk.blue('🔍 SerpAPI Service initialized with Indonesian fraud detection queries'));
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
   * Execute SerpAPI search with retry logic
   */
  async executeSearch(engine, query, options = {}) {
    if (!this.apiKey || this.apiKey === 'your-serpapi-key-here') {
      console.log(chalk.yellow('⚠️ No SerpAPI key configured, returning mock data'));
      return this.generateMockResults(engine, query);
    }

    if (!this.isWithinQuota()) {
      throw new Error(`SerpAPI daily quota exceeded: ${this.quotaUsed}/${this.dailyQuota}`);
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
        
        const result = await Promise.race([
          getJson(searchParams),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Search timeout')), this.timeout)
          )
        ]);

        this.quotaUsed++;
        this.setCachedResult(cacheKey, result);
        
        console.log(chalk.green(`✅ SerpAPI search successful`));
        return result;

      } catch (error) {
        lastError = error;
        console.log(chalk.red(`❌ SerpAPI search failed (attempt ${attempt}): ${error.message}`));
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`SerpAPI search failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Generate mock results for development/testing
   */
  generateMockResults(engine, query) {
    const isFraudQuery = query.toLowerCase().includes('penipuan') || 
                        query.toLowerCase().includes('scam') || 
                        query.toLowerCase().includes('fraud');
    
    const isOfficialQuery = query.toLowerCase().includes('site:ojk.go.id') ||
                           query.toLowerCase().includes('OJK');

    if (engine === 'google') {
      return {
        organic_results: [
          {
            title: isFraudQuery ? 
              `Warning about ${query.split('"')[1]} - Fraud Report` :
              `${query.split('"')[1]} - Official Company Website`,
            link: isFraudQuery ? 
              'https://example.com/fraud-warning' : 
              'https://company-official.com',
            snippet: isFraudQuery ?
              'Multiple reports of fraudulent activities and investor complaints' :
              'Officially registered company with proper business license'
          }
        ]
      };
    }

    if (engine === 'google_news') {
      return {
        news_results: [
          {
            title: isFraudQuery ?
              `Investors file complaints against ${query.split('"')[1]}` :
              `${query.split('"')[1]} expands operations in Indonesia`,
            link: 'https://news-example.com',
            snippet: isFraudQuery ?
              'Authorities investigating multiple fraud allegations' :
              'Company shows strong growth and regulatory compliance',
            date: '2 days ago'
          }
        ]
      };
    }

    return { mock: true, query, engine };
  }

  /**
   * Indonesian Fraud Detection Queries
   */
  async searchCompanyGeneral(companyName) {
    const query = `"${companyName}" Indonesia business`;
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  async searchCompanyFraud(companyName) {
    const query = `"${companyName}" penipuan scam fraud investasi bodong`;
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  async searchCompanyFinancialTroubles(companyName) {
    const query = `"${companyName}" bangkrut tutup bermasalah finansial likuidasi`;
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  async searchCompanyRegulatory(companyName) {
    const query = `site:ojk.go.id "${companyName}" OR "${companyName}" OJK sanksi peringatan`;
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  async searchCompanyNews(companyName) {
    const query = `"${companyName}" berita Indonesia site:detik.com OR site:kompas.com OR site:tempo.co`;
    return await this.executeSearch('google_news', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10,
      tbm: 'nws'
    });
  }

  async searchCompanyVictims(companyName) {
    const query = `"${companyName}" korban pengalaman review buruk tertipu`;
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 10
    });
  }

  async searchCompanyOfficialSites(companyName) {
    const query = `"${companyName}" site:go.id OR site:kemenkeu.go.id OR site:bi.go.id`;
    return await this.executeSearch('google', query, {
      gl: 'id',
      hl: 'id',
      location: 'Indonesia',
      num: 5
    });
  }

  /**
   * Comprehensive company analysis with early termination
   */
  async analyzeCompany(companyName, options = {}) {
    const {
      skipOnConclusiveEvidence = true,
      maxSearches = 7,
      priority = 'balanced' // 'speed', 'balanced', 'thorough'
    } = options;

    console.log(chalk.blue(`🔍 Starting comprehensive SerpAPI analysis for: ${companyName}`));
    
    const results = {
      companyName,
      timestamp: new Date().toISOString(),
      searches: {},
      summary: {
        totalResults: 0,
        fraudIndicators: 0,
        legitimacySignals: 0,
        conclusiveEvidence: false,
        earlyTermination: false
      }
    };

    // Define search priority based on strategy
    let searchOrder;
    if (priority === 'speed') {
      searchOrder = ['fraud', 'regulatory', 'general'];
    } else if (priority === 'thorough') {
      searchOrder = ['general', 'news', 'fraud', 'regulatory', 'financial', 'victims', 'official'];
    } else {
      searchOrder = ['general', 'fraud', 'regulatory', 'news', 'financial'];
    }

    let searchCount = 0;
    
    for (const searchType of searchOrder) {
      if (searchCount >= maxSearches) break;
      
      try {
        let searchResult;
        
        switch (searchType) {
          case 'general':
            searchResult = await this.searchCompanyGeneral(companyName);
            break;
          case 'fraud':
            searchResult = await this.searchCompanyFraud(companyName);
            break;
          case 'financial':
            searchResult = await this.searchCompanyFinancialTroubles(companyName);
            break;
          case 'regulatory':
            searchResult = await this.searchCompanyRegulatory(companyName);
            break;
          case 'news':
            searchResult = await this.searchCompanyNews(companyName);
            break;
          case 'victims':
            searchResult = await this.searchCompanyVictims(companyName);
            break;
          case 'official':
            searchResult = await this.searchCompanyOfficialSites(companyName);
            break;
          default:
            continue;
        }

        results.searches[searchType] = searchResult;
        searchCount++;

        // Analyze results for early termination
        if (skipOnConclusiveEvidence) {
          const analysis = this.analyzeSearchResults(searchResult, searchType);
          results.summary.totalResults += analysis.resultCount;
          results.summary.fraudIndicators += analysis.fraudSignals;
          results.summary.legitimacySignals += analysis.legitimacySignals;

          // Early termination conditions
          if (analysis.isConclusiveEvidence) {
            console.log(chalk.yellow(`⚡ Early termination: Conclusive evidence found in ${searchType} search`));
            results.summary.conclusiveEvidence = true;
            results.summary.earlyTermination = true;
            break;
          }
        }

      } catch (error) {
        console.log(chalk.red(`❌ Search failed for ${searchType}: ${error.message}`));
        results.searches[searchType] = { error: error.message };
      }
    }

    console.log(chalk.green(`✅ SerpAPI analysis completed for ${companyName} (${searchCount} searches)`));
    return results;
  }

  /**
   * Analyze search results for fraud indicators and early termination
   */
  analyzeSearchResults(searchResult, searchType) {
    const analysis = {
      resultCount: 0,
      fraudSignals: 0,
      legitimacySignals: 0,
      isConclusiveEvidence: false
    };

    if (!searchResult || searchResult.error) {
      return analysis;
    }

    const results = searchResult.organic_results || searchResult.news_results || [];
    analysis.resultCount = results.length;

    const fraudKeywords = [
      'penipuan', 'scam', 'fraud', 'penipu', 'gugatan', 'sanksi',
      'bermasalah', 'bangkrut', 'korban', 'tertipu', 'investasi bodong'
    ];

    const legitimacyKeywords = [
      'resmi', 'terdaftar', 'OJK', 'sertifikat', 'izin', 'akreditasi',
      'kementerian', 'official', 'licensed', 'certified'
    ];

    for (const result of results) {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      
      // Count fraud indicators
      const fraudMatches = fraudKeywords.filter(keyword => text.includes(keyword)).length;
      if (fraudMatches > 0) {
        analysis.fraudSignals++;
      }

      // Count legitimacy signals
      const legitimacyMatches = legitimacyKeywords.filter(keyword => text.includes(keyword)).length;
      if (legitimacyMatches > 0) {
        analysis.legitimacySignals++;
      }

      // Check for conclusive evidence
      if (searchType === 'regulatory' && (text.includes('sanksi') || text.includes('peringatan'))) {
        analysis.isConclusiveEvidence = true;
      }
      
      if (searchType === 'fraud' && fraudMatches >= 3) {
        analysis.isConclusiveEvidence = true;
      }
    }

    return analysis;
  }

  /**
   * Get service statistics
   */
  getStats() {
    this.resetQuotaIfNewDay();
    
    return {
      quotaUsed: this.quotaUsed,
      quotaRemaining: this.dailyQuota - this.quotaUsed,
      cacheSize: this.cache.size,
      lastReset: this.lastReset,
      isOperational: this.apiKey && this.apiKey !== 'your-serpapi-key-here'
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