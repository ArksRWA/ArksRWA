import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import UserAgent from 'user-agents';
import { serpAPIService } from './serpapi-service.js';

/**
 * Web Scraping Service for Indonesian Company Research
 * Scrapes OJK database, news sites, and business directories
 */
class WebScrapingService {
  constructor() {
    this.browser = null;
    this.userAgent = new UserAgent();
    
    this.config = {
      // Request delays to avoid being blocked
      minDelay: 2000, // 2 seconds
      maxDelay: 5000, // 5 seconds
      
      // Timeout settings
      pageTimeout: 30000,
      requestTimeout: 15000,
      
      // Anti-detection settings - ENSURE headless mode for production  
      headless: process.env.PUPPETEER_HEADLESS === 'false' ? false : 'new', // Use new headless mode for better performance
      viewport: { width: 1366, height: 768 },
      
      // Cache settings
      cacheExpiryHours: 24,
      
      // Target websites configuration
      targets: {
        ojk: {
          baseUrl: 'https://www.ojk.go.id',
          searchUrl: 'https://www.google.com/search?q=site%3Aojk.go.id+',
          selectors: {
            results: '.search-result',
            title: 'h3',
            snippet: '.search-snippet'
          }
        },
        google: {
          baseUrl: 'https://www.google.com/search?q=',
          selectors: {
            results: '[data-ved]',
            title: 'h3',
            snippet: '[data-sncf="1"]'
          }
        },
        detik: {
          baseUrl: 'https://www.detik.com',
          searchUrl: 'https://www.google.com/search?q=site%3Adetik.com+',
          selectors: {
            results: '.search-result',
            title: 'h3',
            content: '.detail-content'
          }
        }
      }
    };
    
    // Results cache
    this.searchCache = new Map();
    
    // Evidence tracking
    this.evidenceAtoms = [];
  }

  /**
   * Initialize browser instance with anti-detection measures
   * FIXED: Enhanced error handling and multiple fallback configurations
   */
  async initializeBrowser() {
    if (this.browser) return this.browser;
    
    // Check if browser fallback is disabled
    if (process.env.DISABLE_BROWSER_FALLBACK === 'true') {
      throw new Error('Browser fallback disabled by configuration');
    }
    
    // Try multiple browser configurations for maximum compatibility
    const configs = [
      // Primary configuration (most secure)
      {
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ]
      },
      // Fallback configuration (less restrictive)
      {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      },
      // Minimal configuration (emergency fallback)
      {
        headless: true,
        args: ['--no-sandbox']
      }
    ];
    
    let lastError;
    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`🚀 Attempting browser initialization (config ${i + 1}/${configs.length})...`);
        this.browser = await puppeteer.launch(configs[i]);
        console.log(`✅ Web scraper browser initialized with config ${i + 1}`);
        return this.browser;
      } catch (error) {
        lastError = error;
        console.warn(`❌ Browser config ${i + 1} failed: ${error.message}`);
        
        if (i < configs.length - 1) {
          console.log(`🔄 Trying next browser configuration...`);
        }
      }
    }
    
    // If all configurations failed, throw informative error
    console.error('All browser initialization attempts failed:', lastError);
    throw new Error(`Failed to initialize web scraper browser after ${configs.length} attempts. Last error: ${lastError.message}`);
  }


  /**
   * HTTP fallback for critical Indonesian government sites
   */
  async performHTTPFallback(companyName) {
    const results = {
      ojkDirect: null,
      businessRegistry: null,
      errors: []
    };
    
    try {
      // Direct OJK API/site check (if available)
      console.log(`🏛️ Checking OJK direct access for: ${companyName}`);
      results.ojkDirect = await this.checkOJKDirect(companyName);
    } catch (error) {
      results.errors.push(`OJK direct check failed: ${error.message}`);
    }
    
    try {
      // Indonesian business registry check
      console.log(`📋 Checking business registry for: ${companyName}`);
      results.businessRegistry = await this.checkBusinessRegistry(companyName);
    } catch (error) {
      results.errors.push(`Business registry check failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Direct OJK website check using HTTP requests
   */
  async checkOJKDirect(companyName) {
    try {
      const userAgent = this.userAgent.toString();
      const searchUrl = `https://www.google.com/search?q=site:ojk.go.id "${companyName}"`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000
      });
      
      // Basic parsing to check for OJK mentions
      const hasRegistration = response.data.includes(companyName) && 
                             (response.data.includes('terdaftar') || 
                              response.data.includes('registered') ||
                              response.data.includes('izin'));
      
      const hasWarning = response.data.includes('peringatan') || 
                        response.data.includes('sanksi') ||
                        response.data.includes('warning');
      
      return {
        found: hasRegistration || hasWarning,
        status: hasWarning ? 'warning_issued' : (hasRegistration ? 'registered' : 'not_found'),
        source: 'ojk_direct_http'
      };
      
    } catch (error) {
      console.warn(`OJK direct check failed: ${error.message}`);
      return {
        found: false,
        status: 'unknown',
        error: error.message,
        source: 'ojk_direct_http'
      };
    }
  }

  /**
   * Indonesian business registry check
   */
  async checkBusinessRegistry(companyName) {
    try {
      // Check for PT/CV entity indicators
      const entityTypes = ['PT', 'CV', 'TBK'];
      const hasEntityType = entityTypes.some(type => 
        companyName.toUpperCase().includes(type + ' ') || 
        companyName.toUpperCase().includes(' ' + type)
      );
      
      return {
        hasEntityType,
        entityType: hasEntityType ? entityTypes.find(type => 
          companyName.toUpperCase().includes(type)
        ) : null,
        isIndonesianEntity: hasEntityType,
        source: 'business_registry_check'
      };
      
    } catch (error) {
      return {
        hasEntityType: false,
        entityType: null,
        isIndonesianEntity: false,
        error: error.message,
        source: 'business_registry_check'
      };
    }
  }

  /**
   * Convert SerpAPI results to standard sources format
   */
  convertSerpAPIToSources(serpResults, httpResults) {
    const sources = {
      ojk: this.convertSerpAPIToOJK(serpResults, httpResults),
      news: this.convertSerpAPIToNews(serpResults),
      businessInfo: this.convertSerpAPIToBusinessInfo(serpResults, httpResults),
      fraudReports: this.convertSerpAPIToFraudReports(serpResults)
    };
    
    return sources;
  }

  /**
   * Convert SerpAPI results to OJK format
   */
  convertSerpAPIToOJK(serpResults, httpResults) {
    const regulatorySearch = serpResults.searches?.regulatory;
    const officialSearch = serpResults.searches?.official;
    const httpOJK = httpResults?.ojkDirect;
    
    let registrationStatus = 'unknown';
    let foundEntries = 0;
    const details = [];
    
    // Check HTTP direct result first
    if (httpOJK && httpOJK.found) {
      registrationStatus = httpOJK.status;
      foundEntries++;
    }
    
    // Check SerpAPI regulatory results
    if (regulatorySearch && !regulatorySearch.error) {
      const results = regulatorySearch.organic_results || [];
      foundEntries += results.length;
      
      // Analyze results for registration status
      for (const result of results.slice(0, 3)) {
        details.push({
          title: result.title,
          url: result.link,
          snippet: result.snippet
        });
        
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        if (text.includes('peringatan') || text.includes('sanksi')) {
          registrationStatus = 'warning_issued';
        } else if (text.includes('terdaftar') || text.includes('registered')) {
          registrationStatus = 'registered';
        } else if (foundEntries > 0 && registrationStatus === 'unknown') {
          registrationStatus = 'not_registered';
        }
      }
    }
    
    // Check official sites search
    if (officialSearch && !officialSearch.error) {
      const results = officialSearch.organic_results || [];
      foundEntries += results.length;
      
      for (const result of results.slice(0, 2)) {
        details.push({
          title: result.title,
          url: result.link,
          snippet: result.snippet
        });
      }
    }
    
    return {
      registrationStatus,
      foundEntries,
      details: details.slice(0, 5), // Limit to top 5
      source: 'serpapi_enhanced'
    };
  }

  /**
   * Convert SerpAPI results to news format
   */
  convertSerpAPIToNews(serpResults) {
    const newsSearch = serpResults.searches?.news;
    
    if (!newsSearch || newsSearch.error) {
      return {
        totalArticles: 0,
        sentiment: 'neutral',
        fraudMentions: 0,
        articles: [],
        source: 'serpapi_enhanced'
      };
    }
    
    const articles = newsSearch.news_results || newsSearch.organic_results || [];
    let fraudMentions = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    
    const processedArticles = articles.slice(0, 10).map(article => {
      const text = `${article.title} ${article.snippet || ''}`.toLowerCase();
      
      // Count fraud mentions
      const fraudKeywords = ['penipuan', 'scam', 'fraud', 'gugatan', 'bangkrut'];
      if (fraudKeywords.some(keyword => text.includes(keyword))) {
        fraudMentions++;
        negativeCount++;
      } else {
        // Check for positive indicators
        const positiveKeywords = ['prestasi', 'penghargaan', 'ekspansi', 'growth'];
        if (positiveKeywords.some(keyword => text.includes(keyword))) {
          positiveCount++;
        }
      }
      
      return {
        title: article.title,
        url: article.link,
        snippet: article.snippet || '',
        publishedAt: article.date || 'unknown',
        source: article.source || 'unknown'
      };
    });
    
    // Determine sentiment
    let sentiment = 'neutral';
    if (negativeCount > positiveCount) sentiment = 'negative';
    else if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > 0 || positiveCount > 0) sentiment = 'mixed';
    
    return {
      totalArticles: articles.length,
      sentiment,
      fraudMentions,
      articles: processedArticles,
      source: 'serpapi_enhanced'
    };
  }

  /**
   * Convert SerpAPI results to business info format
   */
  convertSerpAPIToBusinessInfo(serpResults, httpResults) {
    const generalSearch = serpResults.searches?.general;
    const businessRegistry = httpResults?.businessRegistry;
    
    let businessRegistration = 'unknown';
    let digitalFootprint = 'unknown';
    const legitimacySignals = [];
    
    // Check business registry
    if (businessRegistry) {
      if (businessRegistry.isIndonesianEntity) {
        businessRegistration = 'registered';
        legitimacySignals.push(`${businessRegistry.entityType}_entity`);
      }
    }
    
    // Analyze general search results
    if (generalSearch && !generalSearch.error) {
      const results = generalSearch.organic_results || [];
      
      // Determine digital footprint strength
      if (results.length > 15) {
        digitalFootprint = 'strong';
      } else if (results.length > 8) {
        digitalFootprint = 'moderate';
      } else if (results.length > 3) {
        digitalFootprint = 'weak';
      } else {
        digitalFootprint = 'minimal';
      }
      
      // Extract legitimacy signals
      results.slice(0, 5).forEach(result => {
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        
        if (text.includes('official') || text.includes('resmi')) {
          legitimacySignals.push('official_website');
        }
        if (text.includes('certified') || text.includes('sertifikat')) {
          legitimacySignals.push('certification');
        }
        if (text.includes('iso')) {
          legitimacySignals.push('iso_certification');
        }
      });
    }
    
    return {
      businessRegistration,
      digitalFootprint,
      legitimacySignals: [...new Set(legitimacySignals)], // Remove duplicates
      source: 'serpapi_enhanced'
    };
  }

  /**
   * Convert SerpAPI results to fraud reports format
   */
  convertSerpAPIToFraudReports(serpResults) {
    const fraudSearch = serpResults.searches?.fraud;
    const victimsSearch = serpResults.searches?.victims;
    
    let fraudReportsFound = 0;
    let riskLevel = 'unknown';
    const warnings = [];
    
    // Analyze fraud search results
    if (fraudSearch && !fraudSearch.error) {
      const results = fraudSearch.organic_results || [];
      fraudReportsFound += results.length;
      
      results.forEach(result => {
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        
        if (text.includes('scam') || text.includes('penipuan')) {
          warnings.push({
            title: result.title,
            description: result.snippet,
            severity: 'high',
            source: result.link
          });
        }
      });
    }
    
    // Analyze victims search results
    if (victimsSearch && !victimsSearch.error) {
      const results = victimsSearch.organic_results || [];
      fraudReportsFound += results.length;
      
      results.forEach(result => {
        if (result.snippet && result.snippet.toLowerCase().includes('korban')) {
          warnings.push({
            title: result.title,
            description: result.snippet,
            severity: 'critical',
            source: result.link
          });
        }
      });
    }
    
    // Determine risk level
    if (fraudReportsFound > 5) riskLevel = 'high';
    else if (fraudReportsFound > 2) riskLevel = 'medium';
    else if (fraudReportsFound > 0) riskLevel = 'low';
    else riskLevel = 'unknown';
    
    return {
      fraudReportsFound,
      riskLevel,
      warnings: warnings.slice(0, 10), // Limit warnings
      source: 'serpapi_enhanced'
    };
  }

  /**
   * Generate research summary from SerpAPI results
   */
  generateSerpAPIResearchSummary(serpResults, httpResults) {
    const { summary } = serpResults;
    
    let overallRisk = 'unknown';
    let confidence = 50;
    let dataQuality = 'limited';
    const keyFindings = [];
    
    if (summary) {
      // Determine overall risk
      if (summary.fraudIndicators > 3) {
        overallRisk = 'high';
        confidence = 85;
      } else if (summary.fraudIndicators > 0) {
        overallRisk = 'medium';
        confidence = 75;
      } else if (summary.legitimacySignals > 2) {
        overallRisk = 'low';
        confidence = 80;
      } else {
        overallRisk = 'medium';
        confidence = 60;
      }
      
      // Determine data quality
      if (summary.totalResults > 20) dataQuality = 'comprehensive';
      else if (summary.totalResults > 10) dataQuality = 'good';
      else if (summary.totalResults > 5) dataQuality = 'limited';
      else dataQuality = 'minimal';
      
      // Generate key findings
      keyFindings.push(`Found ${summary.totalResults} search results across multiple sources`);
      
      if (summary.fraudIndicators > 0) {
        keyFindings.push(`Detected ${summary.fraudIndicators} potential fraud indicators`);
      }
      
      if (summary.legitimacySignals > 0) {
        keyFindings.push(`Identified ${summary.legitimacySignals} legitimacy signals`);
      }
      
      if (summary.earlyTermination) {
        keyFindings.push('Analysis terminated early due to conclusive evidence');
      }
    }
    
    // Add HTTP fallback findings
    if (httpResults?.ojkDirect?.found) {
      keyFindings.push('Direct OJK verification completed');
    }
    
    if (httpResults?.businessRegistry?.isIndonesianEntity) {
      keyFindings.push('Confirmed Indonesian business entity');
    }
    
    return {
      overallRisk,
      confidence,
      dataQuality,
      keyFindings,
      totalSources: Object.keys(serpResults.searches || {}).length,
      enhancedVerification: true
    };
  }

  /**
   * Research company using SerpAPI (compatibility method for legacy code)
   * This method provides a bridge for existing code that expects researchCompany()
   */
  async researchCompany(companyName, region = 'Indonesia') {
    console.log(`🔍 Researching company via SerpAPI: ${companyName}`);
    
    try {
      // Use SerpAPI for comprehensive research
      const serpResults = await serpAPIService.analyzeCompany(companyName, {
        priority: 'balanced',
        maxSearches: 5
      });
      
      // Add fallback HTTP research if SerpAPI data is limited
      let httpResults = null;
      const dataQuality = this.assessSerpAPIDataQuality(serpResults);
      
      if (dataQuality < 3) {
        console.log('🔄 SerpAPI data limited, adding HTTP fallback...');
        httpResults = await this.performHTTPFallback(companyName);
      }
      
      // Convert to standard format expected by legacy code
      const sources = this.convertSerpAPIToSources(serpResults, httpResults);
      
      return {
        companyName,
        canonicalName: companyName,
        region,
        sources,
        summary: {
          dataQuality: dataQuality > 5 ? 'high' : dataQuality > 2 ? 'medium' : 'low',
          sourcesUsed: Object.keys(sources).length,
          totalDataPoints: this.countDataPoints(sources),
          processingTimeMs: Date.now() - Date.now(), // Will be set by caller
          methodology: 'serpapi_with_http_fallback'
        },
        serpAPIResults: serpResults,
        httpFallbackResults: httpResults,
        fallback: false
      };
      
    } catch (error) {
      console.error('Research company failed:', error);
      
      // Check if this is a SerpAPI quota or configuration error
      if (error.message.includes('quota exhausted') || 
          error.message.includes('SerpAPI key not configured') ||
          error.message.includes('run out of searches') ||
          error.message.includes('Your account has run out of searches')) {
        console.error('🚫 SerpAPI quota exhausted - stopping all analysis immediately');
        throw error; // Re-throw the original error to maintain quota error detection
      }
      
      // For other errors, return minimal fallback structure  
      return {
        companyName,
        canonicalName: companyName,
        region,
        sources: {
          businessInfo: { legitimacySignals: [], sources: [] },
          news: { articles: [], sentiment: 'neutral' },
          ojk: { foundEntries: 0, registrationStatus: 'unknown' },
          fraudReports: { fraudReportsFound: 0, reports: [] }
        },
        summary: {
          dataQuality: 'low',
          sourcesUsed: 0,
          totalDataPoints: 0,
          processingTimeMs: 0,
          methodology: 'fallback_only'
        },
        error: error.message,
        fallback: true
      };
    }
  }
  
  /**
   * Assess SerpAPI data quality for fallback decision
   */
  assessSerpAPIDataQuality(serpResults) {
    if (!serpResults?.searches) return 0;
    
    let quality = 0;
    Object.values(serpResults.searches).forEach(search => {
      if (!search.error) {
        const results = search.organic_results || search.news_results || [];
        quality += results.length;
      }
    });
    
    return quality;
  }
  
  /**
   * Count total data points in sources structure
   */
  countDataPoints(sources) {
    let count = 0;
    if (sources.businessInfo?.legitimacySignals) count += sources.businessInfo.legitimacySignals.length;
    if (sources.news?.articles) count += sources.news.articles.length;
    if (sources.ojk?.foundEntries) count += sources.ojk.foundEntries;
    if (sources.fraudReports?.fraudReportsFound) count += sources.fraudReports.fraudReportsFound;
    return count;
  }

  /**
   * Cleanup browser resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🧹 Web scraper browser closed');
    }
  }
}

export default WebScrapingService;