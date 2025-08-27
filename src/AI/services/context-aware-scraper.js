import WebScrapingService from './web-scraper.js';
import { serpAPIService } from './serpapi-service.js';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';

/**
 * Context-Aware Web Scraper for Indonesian Fraud Detection
 * Stage 2 Implementation: Enhanced multi-source web scraping with intelligence
 * Extends the base WebScrapingService with context-aware strategies
 */
class ContextAwareWebScraper extends WebScrapingService {
  constructor() {
    super();
    
    // Removed entity resolution utility - using simple name passthrough
    
    // Enhanced Indonesian sources configuration
    this.enhancedSources = {
      // Financial Intelligence Unit - PPATK
      ppatk: {
        baseUrl: 'https://www.ppatk.go.id',
        searchUrl: 'https://www.google.com/search?q=site%3Appatk.go.id+',
        priority: 'high',
        specialization: 'financial_crime',
        selectors: {
          results: '[data-ved]',
          title: 'h3',
          snippet: '[data-sncf="1"]'
        }
      },
      
      // Ministry of Law and Human Rights - AHU
      ahu: {
        baseUrl: 'https://ahu.go.id',
        searchUrl: 'https://www.google.com/search?q=site%3Aahu.go.id+',
        priority: 'medium',
        specialization: 'business_registration',
        selectors: {
          results: '[data-ved]',
          title: 'h3',
          snippet: '[data-sncf="1"]'
        }
      },
      
      // Additional Indonesian news sources
      tribunnews: {
        baseUrl: 'https://www.tribunnews.com',
        searchUrl: 'https://www.google.com/search?q=site%3Atribunnews.com+',
        priority: 'medium',
        specialization: 'news_coverage',
        selectors: {
          results: '[data-ved]',
          title: 'h3',
          snippet: '[data-sncf="1"]'
        }
      },
      
      tempo: {
        baseUrl: 'https://www.tempo.co',
        searchUrl: 'https://www.google.com/search?q=site%3Atempo.co+',
        priority: 'medium',
        specialization: 'investigative_journalism',
        selectors: {
          results: '[data-ved]',
          title: 'h3',
          snippet: '[data-sncf="1"]'
        }
      },
      
      // Social media and complaint sites
      kaskus: {
        baseUrl: 'https://www.kaskus.co.id',
        searchUrl: 'https://www.google.com/search?q=site%3Akaskus.co.id+',
        priority: 'low',
        specialization: 'social_sentiment',
        selectors: {
          results: '[data-ved]',
          title: 'h3',
          snippet: '[data-sncf="1"]'
        }
      },
      
      // Business directories
      yellowpages: {
        baseUrl: 'https://www.yellowpages.co.id',
        searchUrl: 'https://www.google.com/search?q=site%3Ayellowpages.co.id+',
        priority: 'low',
        specialization: 'business_directory',
        selectors: {
          results: '[data-ved]',
          title: 'h3',
          snippet: '[data-sncf="1"]'
        }
      }
    };
    
    // Context-aware scraping strategies
    this.scrapingStrategies = {
      light: {
        maxSources: 3,
        maxResultsPerSource: 3,
        timeoutMs: 15000,
        sources: ['ojk', 'google_news', 'business_directories'],
        earlyTermination: true,
        terminationThreshold: 5
      },
      medium: {
        maxSources: 5,
        maxResultsPerSource: 5,
        timeoutMs: 30000,
        sources: ['ojk', 'ppatk', 'detik', 'kompas', 'ahu'],
        earlyTermination: true,
        terminationThreshold: 8
      },
      deep: {
        maxSources: 8,
        maxResultsPerSource: 8,
        timeoutMs: 45000,
        sources: ['ojk', 'ppatk', 'ahu', 'detik', 'kompas', 'tribunnews', 'tempo', 'kaskus'],
        earlyTermination: false,
        terminationThreshold: null
      }
    };
    
    // Indonesian fraud pattern database for contextual search terms
    this.contextPatterns = this.initializeContextPatterns();
  }

  /**
   * Determine scraping strategy based on triage results
   */
  determineScrapingStrategy(triageResults) {
    const riskLevel = triageResults?.riskLevel || 'medium';
    const scrapingLevel = triageResults?.scrapingStrategy?.level || 'medium';
    
    // Return strategy based on triage level, fallback to risk level
    if (this.scrapingStrategies[scrapingLevel]) {
      return this.scrapingStrategies[scrapingLevel];
    }
    
    // Fallback mapping from risk level to strategy
    const riskToStrategy = {
      'low': 'light',
      'medium': 'medium', 
      'high': 'deep',
      'critical': 'deep'
    };
    
    const strategyLevel = riskToStrategy[riskLevel] || 'medium';
    return this.scrapingStrategies[strategyLevel];
  }
  
  /**
   * Generate contextual search terms based on company data, triage results, and SerpAPI insights
   * FIXED: Implemented missing method for contextual search term generation
   */
  generateContextualSearchTerms(companyData, triageResults, serpResults = null) {
    const searchTerms = {
      base: [`"${companyData.name}"`],
      legitimacy: [],
      fraud: [],
      regulatory: [],
      contextual: [],
      aliases: []
    };

    // Simple search terms using original name only
    // Removed complex alias processing

    // Use industry-specific search patterns if provided
    const industry = companyData.entityData?.industry || companyData.industry || 'general';
    const contextPatterns = this.contextPatterns[industry] || this.contextPatterns.manufacturing; // fallback

    // Add industry-specific legitimacy terms using original name
    searchTerms.legitimacy.push(...contextPatterns.legitimacy.map(term => 
      `"${companyData.name}" ${term}`
    ));

    // Add industry-specific fraud terms using original name
    searchTerms.fraud.push(...contextPatterns.fraud.map(term => 
      `"${companyData.name}" ${term}`
    ));

    // Add regulatory search terms using original name
    searchTerms.regulatory.push(...contextPatterns.regulatory.map(term => 
      `"${companyData.name}" ${term}`
    ));

    // Enhanced contextual terms based on SerpAPI insights
    if (serpResults && serpResults.summary) {
      const { fraudIndicators, legitimacySignals } = serpResults.summary;
      
      // If initial SerpAPI shows fraud indicators, add more fraud-specific terms using original name
      if (fraudIndicators > legitimacySignals) {
        searchTerms.contextual.push(
          `"${companyData.name}" victim complaint`,
          `"${companyData.name}" penipuan korban`,
          `"${companyData.name}" scam report`
        );
      }
      
      // If initial SerpAPI shows legitimacy signals, add verification terms using original name
      if (legitimacySignals > fraudIndicators) {
        searchTerms.contextual.push(
          `"${companyData.name}" terdaftar resmi`,
          `"${companyData.name}" licensed certified`,
          `"${companyData.name}" legitimate business`
        );
      }
    }

    // Add triage-based contextual terms
    if (triageResults && triageResults.riskLevel) {
      const riskLevel = triageResults.riskLevel;
      
      if (riskLevel === 'high' || riskLevel === 'critical') {
        searchTerms.contextual.push(
          `"${companyData.name}" investigation`,
          `"${companyData.name}" warning`,
          `"${companyData.name}" sanctions`
        );
      } else if (riskLevel === 'low') {
        searchTerms.contextual.push(
          `"${companyData.name}" award`,
          `"${companyData.name}" recognition`,
          `"${companyData.name}" partnership`
        );
      }
    }

    console.log(`🔍 Generated ${Object.values(searchTerms).flat().length} contextual search terms for ${companyData.name}`);
    
    return searchTerms;
  }

  /**
   * Helper method to determine industry from company name
   */

  /**
   * Generate intelligent search terms for SerpAPI prioritization
   */
  generateIntelligentSearchTerms(companyData) {
    const searchTerms = {
      base: [`"${companyData.name}"`],
      legitimacy: [],
      fraud: [],
      regulatory: [],
      contextual: []
    };
    
    // Add basic search patterns
    searchTerms.fraud.push(`"${companyData.name}" penipuan`, `"${companyData.name}" scam`);
    searchTerms.regulatory.push(`"${companyData.name}" OJK`, `"${companyData.name}" regulatory`);
    searchTerms.legitimacy.push(`"${companyData.name}" terdaftar`, `"${companyData.name}" licensed`);
    
    return searchTerms;
  }
  
  /**
   * Initialize context-aware search patterns for Indonesian companies
   */
  initializeContextPatterns() {
    return {
      // Industry-specific search patterns
      fintech: {
        legitimacy: ['fintech terdaftar OJK', 'financial technology licensed', 'digital payment legal'],
        fraud: ['fintech penipuan', 'aplikasi pinjol illegal', 'startup scam'],
        regulatory: ['OJK fintech', 'Bank Indonesia digital', 'regulatory sandbox']
      },
      
      investment: {
        legitimacy: ['investment manager registered', 'manajer investasi terdaftar', 'fund management licensed'],
        fraud: ['investasi bodong', 'skema ponzi', 'investment scam', 'money game'],
        regulatory: ['OJK investment warning', 'daftar hitam investasi']
      },
      
      banking: {
        legitimacy: ['bank terdaftar', 'licensed bank', 'bank umum', 'BPR registered'],
        fraud: ['bank penipuan', 'fake bank', 'bank ilegal'],
        regulatory: ['izin usaha bank', 'bank supervision OJK']
      },
      
      cryptocurrency: {
        legitimacy: ['crypto exchange terdaftar', 'blockchain technology legal'],
        fraud: ['cryptocurrency scam', 'bitcoin penipuan', 'crypto ponzi', 'mining contract scam'],
        regulatory: ['cryptocurrency regulation Indonesia', 'crypto trading legal']
      },
      
      // Traditional industries with different patterns
      manufacturing: {
        legitimacy: ['pabrik resmi', 'manufacturing licensed', 'industri terdaftar', 'ISO certified'],
        fraud: ['produk palsu', 'fake manufacturing', 'pabrik illegal'],
        regulatory: ['izin industri', 'BPOM registered', 'environmental permit']
      },
      
      retail: {
        legitimacy: ['toko resmi', 'retail authorized', 'distributor resmi'],
        fraud: ['toko online penipuan', 'online shop scam', 'fake retail'],
        regulatory: ['izin usaha perdagangan', 'SIUP retail']
      }
    };
  }

  /**
   * NEW: Enhanced scraping with SerpAPI as primary intelligence source
   * Uses SerpAPI data to enhance the FULL context-aware scraping pipeline
   */
  async scrapeWithSerpAPI(companyData, triageResults) {
    try {
      console.log(`🧠 Starting SerpAPI-enhanced intelligent scraping for: ${companyData.name}`);
      
      const strategy = this.determineScrapingStrategy(triageResults);
      const startTime = Date.now();
      
      // STEP 1: Simple entity data (removed complex entity resolution)
      const entityData = {
        canonicalName: companyData.name,
        aliases: [companyData.name],
        entityType: 'unknown',
        industry: 'unknown',
        jurisdiction: 'Indonesia',
        registrationStatus: 'unknown',
        confidence: 0.5,
        erCertainty: 0.5
      };
      console.log(`🏢 Using company name as-is: ${entityData.canonicalName}`);
      
      // Use original name for searching
      const enhancedCompanyData = {
        ...companyData,
        canonicalName: companyData.name,
        aliases: [companyData.name],
        entityData: entityData
      };
      
      // STEP 2: Execute SerpAPI data collection first
      console.log(`🔍 Step 2A: Collecting SerpAPI data...`);
      const serpResults = await this.executeSerpAPISearches(
        companyData.name,
        this.determineSerpAPIPriority(triageResults, {}),
        strategy
      );
      
      // STEP 3: Process SerpAPI data through full scraping pipeline
      console.log(`🔍 Step 2B: Processing SerpAPI data through full pipeline...`);
      const scrapingResults = await this.processSerpAPIDataThroughPipeline(
        enhancedCompanyData,
        serpResults,
        triageResults,
        strategy
      );
      
      // STEP 4: Generate contextual search terms (using canonical name + SerpAPI insights)
      const searchTerms = this.generateContextualSearchTerms(enhancedCompanyData, triageResults, serpResults);
      
      // STEP 5: HTTP fallback for missing critical data (if needed)
      const httpFallback = await this.executeHTTPFallbackIfNeeded(
        companyData.name,
        scrapingResults,
        strategy
      );
      
      // STEP 6: Simple domain collection (removed complex impersonation detection)
      const collectedDomains = this.collectDomainsFromBothSources(scrapingResults, serpResults);
      const impersonationRisk = { risk: 'unknown', domains: collectedDomains };
      console.log(`🚨 Collected ${collectedDomains.length} domains (impersonation detection removed)`);
      
      // STEP 7: Analyze results for early termination conditions
      const conclusiveEvidence = this.analyzeForConclusiveEvidenceWithSerpAPI(scrapingResults, serpResults, triageResults.riskLevel);
      
      const processingTime = Date.now() - startTime;
      
      // STEP 8: Generate enhanced research summary with SerpAPI integration
      const enhancedSummary = this.generateSerpAPIEnhancedResearchSummary(
        scrapingResults,
        serpResults,
        triageResults,
        conclusiveEvidence,
        processingTime
      );
      
      console.log(`✅ SerpAPI-enhanced intelligent scraping completed in ${processingTime}ms - Quality: ${enhancedSummary.dataQuality}`);
      
      // STEP 9: Build comprehensive results with SerpAPI data integration
      const finalResults = {
        companyName: companyData.name,
        canonicalName: companyData.name,
        entityResolution: entityData,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
        strategy: strategy,
        searchTermsUsed: searchTerms,
        sourcesScraped: Object.keys(scrapingResults).length,
        sources: scrapingResults,
        domains: collectedDomains,
        impersonationRisk: impersonationRisk,
        conclusiveEvidence: conclusiveEvidence,
        summary: enhancedSummary,
        intelligence: {
          earlyTermination: conclusiveEvidence.triggered,
          terminationReason: conclusiveEvidence.reason,
          confidenceLevel: conclusiveEvidence.confidence
        },
        serpAPIResults: serpResults, // Include SerpAPI data
        httpFallback: httpFallback,
        evidence: this.evidenceAtoms || []
      };
      
      // STEP 10: Ensure evidence atoms are properly collected from all sources
      return this.collectAndReturnEvidence(finalResults);
      
    } catch (error) {
      console.error(`SerpAPI enhanced scraping failed: ${error.message}`);
      
      // Check if this is a SerpAPI quota exhaustion error and immediately throw to stop all processing
      if (error.message && (
        error.message.includes('quota exhausted') || 
        error.message.includes('run out of searches') || 
        error.message.includes('Your account has run out of searches')
      )) {
        console.error(`🚫 SerpAPI quota exhausted in scraping - stopping all analysis immediately`);
        throw error; // Re-throw to stop entire analysis
      }
      
      // Generate fallback research result for non-quota errors
      console.log(`🔄 Generating fallback research for: ${companyData.name}`);
      
      // Create minimal fallback research structure
      const fallbackResults = {
        companyName: companyData.name,
        canonicalName: companyData.name,
        entityResolution: {
          canonicalName: companyData.name,
          entityType: 'unknown',
          industry: 'unknown',
          jurisdiction: 'Indonesia',
          registrationStatus: 'unknown',
          aliases: [companyData.name],
          confidence: 0.5
        },
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
        strategy: { level: 'fallback', maxSources: 0 },
        searchTermsUsed: {},
        sourcesScraped: 0,
        sources: {},
        domains: [],
        impersonationRisk: { risk: 'unknown', domains: [] },
        conclusiveEvidence: { triggered: false, reason: 'fallback', confidence: 0 },
        summary: {
          overallRisk: 'unknown',
          confidence: 30,
          dataQuality: 'minimal',
          keyFindings: ['Analysis failed, using fallback'],
          totalSources: 0,
          enhancedVerification: false
        },
        intelligence: {
          earlyTermination: false,
          terminationReason: 'error_fallback',
          confidenceLevel: 30
        },
        serpAPIResults: null,
        httpFallback: null,
        evidence: [],
        fallback: true,
        error: error.message
      };
      
      return fallbackResults;
    }
  }

  /**
   * Determine SerpAPI search prioritization based on triage
   */
  determineSerpAPIPriority(triageResults, searchTerms) {
    const priority = [];
    
    if (!triageResults || !triageResults.data) {
      // Default balanced approach
      return ['general', 'news', 'regulatory', 'fraud'];
    }
    
    const { riskLevel } = triageResults.data;
    
    // High-risk companies: Focus on fraud evidence first
    if (riskLevel === 'critical' || riskLevel === 'high') {
      priority.push('fraud', 'regulatory', 'victims', 'financial', 'news', 'general');
    }
    // Low-risk companies: Focus on legitimacy verification
    else if (riskLevel === 'low') {
      priority.push('general', 'regulatory', 'news', 'official');
    }
    // Medium-risk: Balanced approach
    else {
      priority.push('general', 'news', 'fraud', 'regulatory', 'financial');
    }
    
    // Remove duplicates and limit to 6 searches max
    return [...new Set(priority)].slice(0, 6);
  }

  /**
   * Execute SerpAPI searches with intelligent batching
   */
  async executeSerpAPISearches(companyName, searchPriority, strategy) {
    const results = {
      searches: {},
      summary: {
        totalResults: 0,
        fraudIndicators: 0,
        legitimacySignals: 0,
        conclusiveEvidence: false,
        earlyTermination: false
      }
    };
    
    let searchCount = 0;
    const maxSearches = Math.min(searchPriority.length, strategy.maxSources);
    
    for (const searchType of searchPriority) {
      if (searchCount >= maxSearches) break;
      
      try {
        console.log(`🔍 Executing SerpAPI ${searchType} search for: ${companyName}`);
        
        let searchResult;
        switch (searchType) {
          case 'general':
            searchResult = await serpAPIService.searchCompanyReputationNews(companyName);
            break;
          case 'fraud':
            searchResult = await serpAPIService.searchFraudInvestigativeNews(companyName);
            break;
          case 'financial':
            searchResult = await serpAPIService.searchFinancialCrimeNews(companyName);
            break;
          case 'regulatory':
            searchResult = await serpAPIService.searchRegulatoryNewsAlerts(companyName);
            break;
          case 'news':
            searchResult = await serpAPIService.searchRecentNewsTrends(companyName);
            break;
          case 'victims':
            searchResult = await serpAPIService.searchVictimTestimonialsInNews(companyName);
            break;
          case 'official':
            searchResult = await serpAPIService.searchOfficialRegulatoryMentions(companyName);
            break;
          default:
            continue;
        }
        
        results.searches[searchType] = searchResult;
        searchCount++;
        
        // Analyze for early termination
        const analysis = this.analyzeSerpAPIResult(searchResult, searchType);
        results.summary.totalResults += analysis.resultCount;
        results.summary.fraudIndicators += analysis.fraudSignals;
        results.summary.legitimacySignals += analysis.legitimacySignals;
        
        // Check for conclusive evidence
        if (analysis.isConclusiveEvidence && strategy.earlyTermination) {
          console.log(`🎯 Conclusive evidence found in ${searchType} search`);
          results.summary.conclusiveEvidence = true;
          break;
        }
        
      } catch (error) {
        console.warn(`SerpAPI ${searchType} search failed: ${error.message}`);
        
        // Check if this is a quota exhaustion error and immediately throw to stop all processing
        if (error.message && (
          error.message.includes('quota exhausted') || 
          error.message.includes('run out of searches') || 
          error.message.includes('Your account has run out of searches')
        )) {
          console.error(`🚫 SerpAPI quota exhausted during ${searchType} search - stopping all processing immediately`);
          throw error; // Re-throw to stop entire analysis
        }
        
        results.searches[searchType] = { error: error.message };
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }

  /**
   * Analyze SerpAPI result for evidence patterns
   */
  analyzeSerpAPIResult(searchResult, searchType) {
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
      'resmi', 'terdaftar', 'ojk', 'sertifikat', 'izin', 'akreditasi',
      'kementerian', 'official', 'licensed', 'certified'
    ];
    
    for (const result of results) {
      const text = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
      
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
      
      // Check for conclusive evidence patterns
      if (searchType === 'regulatory' && (text.includes('sanksi') || text.includes('peringatan'))) {
        analysis.isConclusiveEvidence = true;
      }
      
      if (searchType === 'fraud' && fraudMatches >= 2) {
        analysis.isConclusiveEvidence = true;
      }
      
      if (searchType === 'victims' && text.includes('korban')) {
        analysis.isConclusiveEvidence = true;
      }
    }
    
    return analysis;
  }

  /**
   * Check if early termination should be triggered
   */
  shouldTerminateEarly(serpResults, strategy) {
    if (!strategy.earlyTermination) return false;
    
    const { summary } = serpResults;
    const threshold = strategy.terminationThreshold || 8;
    
    // Terminate if conclusive evidence found
    if (summary.conclusiveEvidence) return true;
    
    // Terminate if enough evidence collected
    if (summary.totalResults >= threshold) {
      // Strong fraud evidence
      if (summary.fraudIndicators >= 3) return true;
      // Strong legitimacy evidence
      if (summary.legitimacySignals >= 5) return true;
    }
    
    return false;
  }

  /**
   * Execute HTTP fallback for missing critical data
   * FIXED: Enhanced error handling and graceful degradation
   */
  async executeHTTPFallback(companyName, serpResults, strategy) {
    const fallbackNeeded = this.identifyFallbackNeeds(serpResults);
    
    if (fallbackNeeded.length === 0) {
      console.log(`📋 No HTTP fallback needed for: ${companyName}`);
      return null;
    }
    
    console.log(`🔄 Executing HTTP fallback for: ${fallbackNeeded.join(', ')}`);
    
    const fallbackResults = {};
    let browserInitialized = false;
    
    // Try to initialize browser for HTTP fallback
    try {
      await this.initializeBrowser();
      browserInitialized = true;
      console.log(`✅ Browser ready for HTTP fallback`);
    } catch (error) {
      console.warn(`🚫 Browser initialization failed for HTTP fallback: ${error.message}`);
      console.log(`📊 Will attempt HTTP-only fallback without browser automation`);
    }
    
    for (const source of fallbackNeeded.slice(0, 2)) { // Limit fallback sources
      try {
        switch (source) {
          case 'ojk_direct':
            if (browserInitialized) {
              fallbackResults.ojkDirect = await this.checkOJKDirect(companyName);
            } else {
              fallbackResults.ojkDirect = await this.checkOJKDirectHTTPOnly(companyName);
            }
            break;
          case 'business_registry':
            if (browserInitialized) {
              fallbackResults.businessRegistry = await this.checkBusinessRegistry(companyName);
            } else {
              fallbackResults.businessRegistry = await this.checkBusinessRegistryHTTPOnly(companyName);
            }
            break;
          case 'indonesian_news':
            if (browserInitialized) {
              fallbackResults.indonesianNews = await this.checkIndonesianNews(companyName);
            } else {
              fallbackResults.indonesianNews = await this.checkIndonesianNewsHTTPOnly(companyName);
            }
            break;
        }
      } catch (error) {
        console.warn(`HTTP fallback ${source} failed: ${error.message}`);
        // Continue with other sources instead of failing completely
        fallbackResults[source] = { error: error.message, attempted: true };
      }
    }
    
    return fallbackResults;
  }

  /**
   * HTTP-only fallback methods that don't require browser automation
   * These use direct HTTP requests instead of Puppeteer
   */
  async checkOJKDirectHTTPOnly(companyName) {
    console.log(`🌐 Checking OJK directly via HTTP for: ${companyName}`);
    try {
      // Use axios to search Google for OJK results
      const searchQuery = `site:ojk.go.id "${companyName}"`;
      const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      // Simple text analysis instead of DOM parsing
      const hasOJKMention = response.data.includes('ojk.go.id') && response.data.includes(companyName);
      
      return {
        found: hasOJKMention,
        method: 'http_only',
        source: 'google_search_ojk'
      };
    } catch (error) {
      console.warn(`OJK HTTP-only check failed: ${error.message}`);
      return { found: false, error: error.message, method: 'http_only' };
    }
  }

  async checkBusinessRegistryHTTPOnly(companyName) {
    console.log(`🌐 Checking business registry via HTTP for: ${companyName}`);
    try {
      // Use axios to search for Indonesian business registration
      const searchQuery = `"${companyName}" terdaftar OR registered indonesia business`;
      const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      // Simple analysis for Indonesian business terms
      const businessTerms = ['terdaftar', 'registered', 'PT ', 'CV ', 'business'];
      const hasBusinessSignals = businessTerms.some(term => response.data.includes(term));
      
      return {
        isIndonesianEntity: hasBusinessSignals,
        method: 'http_only',
        source: 'google_search_business'
      };
    } catch (error) {
      console.warn(`Business registry HTTP-only check failed: ${error.message}`);
      return { isIndonesianEntity: false, error: error.message, method: 'http_only' };
    }
  }

  async checkIndonesianNewsHTTPOnly(companyName) {
    console.log(`🌐 Checking Indonesian news via HTTP for: ${companyName}`);
    try {
      // Use axios to search for news coverage
      const searchQuery = `"${companyName}" site:detik.com OR site:kompas.com OR site:tribunnews.com`;
      const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      // Simple analysis for news coverage
      const newsTerms = ['detik.com', 'kompas.com', 'tribunnews.com'];
      const newsCount = newsTerms.filter(term => response.data.includes(term)).length;
      
      return {
        coverage: newsCount > 0 ? 'found' : 'not_found',
        sources: newsCount,
        method: 'http_only'
      };
    } catch (error) {
      console.warn(`Indonesian news HTTP-only check failed: ${error.message}`);
      return { coverage: 'not_found', error: error.message, method: 'http_only' };
    }
  }

  /**
   * Identify which sources need HTTP fallback
   */
  identifyFallbackNeeds(serpResults) {
    const needs = [];
    
    // Check if OJK data is insufficient
    if (!serpResults.searches.regulatory || 
        serpResults.searches.regulatory.error ||
        (serpResults.searches.regulatory.organic_results || []).length === 0) {
      needs.push('ojk_direct');
    }
    
    // Check if business registration data is missing
    if (!serpResults.searches.general || 
        serpResults.searches.general.error ||
        (serpResults.searches.general.organic_results || []).length < 3) {
      needs.push('business_registry');
    }
    
    // Check if Indonesian news coverage is insufficient
    if (!serpResults.searches.news || 
        serpResults.searches.news.error ||
        (serpResults.searches.news.news_results || []).length === 0) {
      needs.push('indonesian_news');
    }
    
    return needs;
  }

  /**
   * Combine SerpAPI and HTTP fallback results
   */
  combineSerpAPIAndHTTP(serpResults, httpFallback) {
    const combined = { ...serpResults };
    
    if (httpFallback) {
      combined.httpFallback = httpFallback;
      
      // Enhance summary with fallback data
      if (httpFallback.ojkDirect?.found) {
        combined.summary.legitimacySignals++;
      }
      
      if (httpFallback.businessRegistry?.isIndonesianEntity) {
        combined.summary.legitimacySignals++;
      }
    }
    
    return combined;
  }

  /**
   * Process SerpAPI data through the full context-aware scraping pipeline
   */
  async processSerpAPIDataThroughPipeline(enhancedCompanyData, serpResults, triageResults, strategy) {
    // Initialize results structure
    const results = {
      ojk: { registrationStatus: 'unknown', foundEntries: 0, details: [] },
      news: { totalArticles: 0, sentiment: 'neutral', fraudMentions: 0, articles: [] },
      businessInfo: { businessRegistration: 'unknown', digitalFootprint: 'minimal', legitimacySignals: [] },
      fraudReports: { fraudReportsFound: 0, riskLevel: 'unknown', warnings: [] },
      enhanced: {}
    };
    
    // Initialize evidence atoms array
    if (!this.evidenceAtoms) {
      this.evidenceAtoms = [];
    }
    
    // Process SerpAPI search results through the intelligence pipeline
    for (const [searchType, searchData] of Object.entries(serpResults.searches || {})) {
      if (searchData && !searchData.error) {
        console.log(`🔍 Processing ${searchType} SerpAPI data...`);
        
        // Convert SerpAPI results to internal format
        const processedResults = this.convertSerpAPIToInternalFormat(searchData, searchType);
        
        // Apply intelligent analysis to each result
        const enhancedResults = processedResults.map(result => ({
          ...result,
          sourceSpecialization: this.mapSearchTypeToSpecialization(searchType),
          relevanceScore: this.calculateRelevanceScore(result, this.mapSearchTypeToSpecialization(searchType)),
          extractedSignals: this.extractSpecializedSignals(result, this.mapSearchTypeToSpecialization(searchType))
        }));
        
        // Integrate results using existing intelligent integration logic
        this.integrateSourceResults(results, enhancedResults, this.mapSearchTypeToSourceName(searchType));
      }
    }
    
    return results;
  }
  
  /**
   * Convert SerpAPI results to internal scraping format
   */
  convertSerpAPIToInternalFormat(searchData, searchType) {
    const results = [];
    
    // Handle organic results
    if (searchData.organic_results) {
      for (const result of searchData.organic_results) {
        results.push({
          title: result.title || '',
          snippet: result.snippet || '',
          url: result.link || '',
          source: 'serpapi',
          searchType: searchType
        });
      }
    }
    
    // Handle news results
    if (searchData.news_results) {
      for (const result of searchData.news_results) {
        results.push({
          title: result.title || '',
          snippet: result.snippet || '',
          url: result.link || '',
          source: 'serpapi_news',
          searchType: searchType,
          date: result.date || ''
        });
      }
    }
    
    return results;
  }
  
  /**
   * Map SerpAPI search type to source specialization
   */
  mapSearchTypeToSpecialization(searchType) {
    const mappings = {
      'general': 'business_directory',
      'fraud': 'investigative_journalism', 
      'financial': 'financial_crime',
      'regulatory': 'business_registration',
      'news': 'news_coverage',
      'victims': 'social_sentiment',
      'official': 'business_directory'
    };
    
    return mappings[searchType] || 'news_coverage';
  }
  
  /**
   * Map SerpAPI search type to internal source name
   */
  mapSearchTypeToSourceName(searchType) {
    const mappings = {
      'general': 'businessInfo',
      'fraud': 'fraudReports', 
      'financial': 'fraudReports',
      'regulatory': 'ojk',
      'news': 'news',
      'victims': 'fraudReports',
      'official': 'businessInfo'
    };
    
    return mappings[searchType] || 'enhanced';
  }
  
  /**
   * Calculate relevance score for SerpAPI results based on search specialization
   */
  calculateRelevanceScore(result, specialization) {
    let score = 0;
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const link = (result.link || '').toLowerCase();
    const text = `${title} ${snippet}`;
    
    // Base scoring based on specialization
    switch (specialization) {
      case 'business_registration':
        // Higher score for official government sites
        if (link.includes('.go.id') || link.includes('ojk.go.id') || link.includes('kemenkeu.go.id')) {
          score += 40;
        }
        if (text.includes('terdaftar') || text.includes('registered') || text.includes('npwp') || text.includes('nib')) {
          score += 30;
        }
        break;
        
      case 'investigative_journalism':
        // Higher score for fraud-related content
        const fraudKeywords = ['penipuan', 'scam', 'fraud', 'penipu', 'gugatan', 'sanksi'];
        const fraudMatches = fraudKeywords.filter(keyword => text.includes(keyword)).length;
        score += fraudMatches * 15;
        
        // Bonus for news sites
        if (link.includes('detik.com') || link.includes('kompas.com') || link.includes('tempo.co')) {
          score += 20;
        }
        break;
        
      case 'financial_crime':
        // Financial trouble indicators
        if (text.includes('bangkrut') || text.includes('likuidasi') || text.includes('bermasalah finansial')) {
          score += 35;
        }
        if (text.includes('pailit') || text.includes('debt') || text.includes('kerugian')) {
          score += 25;
        }
        break;
        
      case 'news_coverage':
        // General news relevance
        if (link.includes('news') || link.includes('berita')) {
          score += 20;
        }
        // Recency bonus (if available in result metadata)
        if (result.date && this.isRecentDate(result.date)) {
          score += 15;
        }
        break;
        
      case 'social_sentiment':
        // User complaints and reviews
        if (text.includes('korban') || text.includes('pengalaman buruk') || text.includes('review')) {
          score += 25;
        }
        if (text.includes('tertipu') || text.includes('complaint') || text.includes('keluhan')) {
          score += 30;
        }
        break;
        
      default:
        // Basic relevance for business directory
        if (text.includes('company') || text.includes('perusahaan') || text.includes('bisnis')) {
          score += 10;
        }
    }
    
    // General quality indicators
    if (link.includes('https://')) score += 5;
    if (title.length > 10 && title.length < 100) score += 5;
    if (snippet && snippet.length > 50) score += 10;
    
    // Penalty for spam-like results
    if (text.includes('click here') || text.includes('free money') || link.includes('bit.ly')) {
      score -= 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Check if a date string represents recent content (within last 6 months)
   */
  isRecentDate(dateStr) {
    try {
      const resultDate = new Date(dateStr);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return resultDate > sixMonthsAgo;
    } catch {
      return false;
    }
  }
  
  /**
   * Extract specialized signals based on search specialization
   */
  extractSpecializedSignals(result, specialization) {
    const signals = [];
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const text = `${title} ${snippet}`;
    
    switch (specialization) {
      case 'business_registration':
        if (text.includes('terdaftar')) signals.push('registered');
        if (text.includes('npwp')) signals.push('tax_registered');
        if (text.includes('nib')) signals.push('business_id');
        if (text.includes('.go.id')) signals.push('official_source');
        break;
        
      case 'investigative_journalism':
        if (text.includes('penipuan')) signals.push('fraud_allegation');
        if (text.includes('gugatan')) signals.push('legal_action');
        if (text.includes('sanksi')) signals.push('sanctions');
        if (text.includes('investigation')) signals.push('under_investigation');
        break;
        
      case 'financial_crime':
        if (text.includes('bangkrut')) signals.push('bankruptcy');
        if (text.includes('likuidasi')) signals.push('liquidation');
        if (text.includes('bermasalah finansial')) signals.push('financial_trouble');
        break;
        
      case 'social_sentiment':
        if (text.includes('korban')) signals.push('victims');
        if (text.includes('tertipu')) signals.push('cheated');
        if (text.includes('pengalaman buruk')) signals.push('bad_experience');
        break;
    }
    
    return signals;
  }
  
  /**
   * Execute HTTP fallback only if needed based on SerpAPI results
   * FIXED: More conservative fallback - only when SerpAPI completely fails
   */
  async executeHTTPFallbackIfNeeded(companyName, scrapingResults, strategy) {
    // Check if SerpAPI provided any meaningful data
    const ojkData = scrapingResults.ojk?.foundEntries || 0;
    const newsData = scrapingResults.news?.totalArticles || 0;
    const businessData = scrapingResults.businessInfo?.legitimacySignals?.length || 0;
    const fraudData = scrapingResults.fraudReports?.fraudReportsFound || 0;
    
    const totalData = ojkData + newsData + businessData + fraudData;
    
    // FIXED: Much lower threshold - only fallback if we have almost no data (≤2 data points)
    // This prevents unnecessary browser initialization when SerpAPI provides reasonable data
    if (totalData <= 2) {
      console.log(`🔄 SerpAPI data very limited (${totalData} data points), attempting HTTP fallback...`);
      
      // ADDED: Check if browser-based scraping is disabled
      if (process.env.DISABLE_BROWSER_FALLBACK === 'true') {
        console.log(`🚫 Browser fallback disabled by environment configuration`);
        return null;
      }
      
      try {
        return await this.executeHTTPFallback(companyName, { searches: {} }, strategy);
      } catch (error) {
        console.warn(`🚫 HTTP fallback failed: ${error.message}`);
        console.log(`✅ Continuing with SerpAPI data only (${totalData} data points)`);
        return null;
      }
    }
    
    console.log(`📊 SerpAPI data sufficient (${totalData} data points), skipping HTTP fallback`);
    return null;
  }
  
  /**
   * Collect domains from both SerpAPI and traditional scraping results
   */
  collectDomainsFromBothSources(scrapingResults, serpResults) {
    const domains = new Set();
    
    // Collect from traditional scraping results
    const traditionalDomains = this.collectDomains(scrapingResults);
    traditionalDomains.forEach(domain => domains.add(domain));
    
    // Collect from SerpAPI results
    Object.values(serpResults.searches || {}).forEach(searchData => {
      if (searchData && !searchData.error) {
        const results = searchData.organic_results || searchData.news_results || [];
        results.forEach(result => {
          if (result.link) {
            try {
              const domain = new URL(result.link).hostname;
              domains.add(domain);
            } catch (e) {
              // Invalid URL, skip
            }
          }
        });
      }
    });
    
    return Array.from(domains);
  }
  
  /**
   * Analyze for conclusive evidence including SerpAPI data
   */
  analyzeForConclusiveEvidenceWithSerpAPI(scrapingResults, serpResults, riskLevel) {
    // Start with traditional analysis
    const evidence = this.analyzeForConclusiveEvidence(scrapingResults, riskLevel);
    
    // Enhance with SerpAPI-specific evidence
    if (serpResults.summary?.conclusiveEvidence) {
      evidence.triggered = true;
      evidence.reason = 'serpapi_conclusive_evidence';
      evidence.confidence = Math.max(evidence.confidence, 90);
      evidence.conclusiveFactors.push('SerpAPI found conclusive evidence');
    }
    
    // Check for multiple fraud indicators across SerpAPI searches
    const fraudSearchTypes = ['fraud', 'victims', 'financial'];
    const fraudEvidence = fraudSearchTypes.filter(searchType => {
      const searchData = serpResults.searches?.[searchType];
      return searchData && !searchData.error && 
             (searchData.organic_results?.length > 0 || searchData.news_results?.length > 0);
    });
    
    if (fraudEvidence.length >= 2) {
      evidence.triggered = true;
      evidence.reason = 'multiple_serpapi_fraud_sources';
      evidence.confidence = Math.max(evidence.confidence, 85);
      evidence.conclusiveFactors.push(`Fraud evidence found in ${fraudEvidence.length} SerpAPI search types`);
    }
    
    return evidence;
  }
  
  /**
   * Generate research summary enhanced with SerpAPI integration
   */
  generateSerpAPIEnhancedResearchSummary(scrapingResults, serpResults, triageResults, conclusiveEvidence, processingTime) {
    // Start with traditional enhanced summary
    const summary = this.generateEnhancedResearchSummary(scrapingResults, triageResults, conclusiveEvidence, processingTime);
    
    // Add SerpAPI-specific insights
    const serpAPISearches = Object.keys(serpResults.searches || {}).length;
    const serpAPIResults = serpResults.summary?.totalResults || 0;
    
    summary.intelligenceInsights.push(`SerpAPI: ${serpAPISearches} searches, ${serpAPIResults} total results`);
    
    // Enhance data quality based on SerpAPI contribution
    if (serpAPIResults > 15) {
      summary.dataQuality = summary.dataQuality === 'comprehensive' ? 'comprehensive' : 'good';
    } else if (serpAPIResults > 8) {
      summary.dataQuality = summary.dataQuality === 'minimal' ? 'limited' : summary.dataQuality;
    }
    
    // Add SerpAPI efficiency metrics
    summary.serpAPIEfficiency = {
      searchesExecuted: serpAPISearches,
      resultsFound: serpAPIResults,
      earlyTermination: serpResults.summary?.earlyTermination || false,
      conclusiveEvidence: serpResults.summary?.conclusiveEvidence || false
    };
    
    return summary;
  }
  
  /**
   * Format SerpAPI results for consumption
   */
  formatSerpAPIResults(results, earlyTermination) {
    return {
      companyName: results.companyName || 'unknown',
      timestamp: new Date().toISOString(),
      dataSource: 'serpapi_context_aware',
      earlyTermination,
      serpAPIResults: results,
      summary: {
        ...results.summary,
        earlyTermination,
        dataQuality: this.assessDataQuality(results),
        searchEfficiency: this.calculateSearchEfficiency(results)
      }
    };
  }

  /**
   * Assess overall data quality from SerpAPI results
   */
  assessDataQuality(results) {
    const totalResults = results.summary?.totalResults || 0;
    const searchCount = Object.keys(results.searches || {}).length;
    
    if (totalResults > 20 && searchCount > 4) return 'comprehensive';
    if (totalResults > 10 && searchCount > 2) return 'good';
    if (totalResults > 5) return 'limited';
    return 'minimal';
  }

  /**
   * Calculate search efficiency metrics
   */
  calculateSearchEfficiency(results) {
    const searchCount = Object.keys(results.searches || {}).length;
    const totalResults = results.summary?.totalResults || 0;
    const evidenceFound = (results.summary?.fraudIndicators || 0) + 
                         (results.summary?.legitimacySignals || 0);
    
    return {
      searchesExecuted: searchCount,
      resultsPerSearch: searchCount > 0 ? Math.round(totalResults / searchCount) : 0,
      evidencePerSearch: searchCount > 0 ? Math.round(evidenceFound / searchCount) : 0,
      costEfficiency: results.summary?.earlyTermination ? 'high' : 'standard'
    };
  }










  /**
   * Integrates source results into the main results structure
   */
  integrateSourceResults(mainResults, sourceResults, sourceName) {
    // Initialize evidence atoms array if not exists
    if (!this.evidenceAtoms) {
      this.evidenceAtoms = [];
    }
    
    // Map source results to appropriate categories AND create evidence atoms
    if (sourceName === 'ojk' || sourceName === 'ppatk') {
      // Regulatory sources
      mainResults.ojk.foundEntries += sourceResults.length;
      mainResults.ojk.details.push(...sourceResults.slice(0, 3));
      
      // Analyze for registration status
      const registrationSignals = sourceResults.filter(r => 
        r.extractedSignals && r.extractedSignals.some(s => s.type === 'positive' || s.type === 'regulatory')
      );
      
      if (registrationSignals.length > 0) {
        mainResults.ojk.registrationStatus = 'registered';
        
        // FIXED: Create Tier-1 evidence atoms for OJK registration
        registrationSignals.forEach(result => {
          if (result.extractedSignals) {
            result.extractedSignals.forEach(signal => {
              const evidenceAtom = this.createEvidenceAtom(
                1, // Tier-1 for OJK
                sourceName.toUpperCase(),
                'registration',
                'registered',
                result.url || 'https://www.ojk.go.id',
                'verified',
                result.relevanceScore ? result.relevanceScore / 100 : 0.8
              );
              this.evidenceAtoms.push(evidenceAtom);
            });
          }
        });
      }
      
    } else if (sourceName === 'ahu') {
      // Business registration source
      mainResults.businessInfo.foundSources += sourceResults.length;
      
      const legitimacySignals = sourceResults
        .filter(r => r.extractedSignals && r.extractedSignals.some(s => s.type === 'positive'))
        .map(r => r.extractedSignals.filter(s => s.type === 'positive'))
        .flat()
        .map(s => s.keyword);
      
      mainResults.businessInfo.legitimacySignals.push(...legitimacySignals);
      
      // FIXED: Create Tier-2 evidence atoms for business registration
      sourceResults.forEach(result => {
        if (result.extractedSignals) {
          result.extractedSignals.forEach(signal => {
            if (signal.type === 'positive') {
              const evidenceAtom = this.createEvidenceAtom(
                2, // Tier-2 for business registration
                'AHU',
                'business_registration',
                signal.keyword,
                result.url || 'https://ahu.go.id',
                'partial',
                result.relevanceScore ? result.relevanceScore / 100 : 0.6
              );
              this.evidenceAtoms.push(evidenceAtom);
            }
          });
        }
      });
      
    } else if (['detik', 'kompas', 'tribunnews', 'tempo'].includes(sourceName)) {
      // News sources - ensure proper article structure with URLs
      const validArticles = sourceResults
        .filter(result => result && result.url && result.title)
        .slice(0, 3)
        .map(result => ({
          title: result.title || 'Untitled Article',
          url: result.url,
          snippet: result.snippet || '',
          source: sourceName,
          relevanceScore: result.relevanceScore || 50,
          sentiment: this.analyzeSentimentFromSignals(result.extractedSignals)
        }));
      
      mainResults.news.totalArticles += sourceResults.length;
      mainResults.news.articles.push(...validArticles);
      
      // Log the URLs being added for debugging
      console.log(`📰 Added ${validArticles.length} news articles from ${sourceName}:`, 
        validArticles.map(a => a.url).slice(0, 2));
      
      // Analyze sentiment and fraud mentions
      const fraudArticles = sourceResults.filter(r => 
        r.extractedSignals && r.extractedSignals.some(s => s.type === 'negative')
      );
      
      mainResults.news.fraudMentions += fraudArticles.length;
      
      if (fraudArticles.length > sourceResults.length * 0.6) {
        mainResults.news.sentiment = 'negative';
      } else if (fraudArticles.length < sourceResults.length * 0.2) {
        mainResults.news.sentiment = 'positive';
      } else {
        mainResults.news.sentiment = 'mixed';
      }
      
      // FIXED: Create Tier-2 evidence atoms for news coverage  
      validArticles.forEach(article => {
        // Create evidence atom for news coverage
        const evidenceAtom = this.createEvidenceAtom(
          2, // Tier-2 for news coverage
          sourceName.toUpperCase(),
          'news_coverage',
          article.sentiment || 'neutral',
          article.url,
          'partial',
          article.relevanceScore ? article.relevanceScore / 100 : 0.5
        );
        this.evidenceAtoms.push(evidenceAtom);
      });
      
      // Create evidence atoms for fraud mentions if found
      fraudArticles.forEach(article => {
        if (article.extractedSignals) {
          article.extractedSignals.forEach(signal => {
            if (signal.type === 'negative') {
              const evidenceAtom = this.createEvidenceAtom(
                2, // Tier-2 for news fraud mentions
                sourceName.toUpperCase(),
                'fraud_mention',
                signal.keyword,
                article.url || `https://www.${sourceName}`,
                'partial',
                article.relevanceScore ? article.relevanceScore / 100 : 0.7
              );
              this.evidenceAtoms.push(evidenceAtom);
            }
          });
        }
      });
      
    } else {
      // Other sources go to enhanced results
      if (!mainResults.enhanced[sourceName]) {
        mainResults.enhanced[sourceName] = [];
      }
      mainResults.enhanced[sourceName].push(...sourceResults);
    }
  }

  /**
   * Analyzes sentiment from extracted signals
   */
  analyzeSentimentFromSignals(extractedSignals) {
    if (!extractedSignals || extractedSignals.length === 0) {
      return 'neutral';
    }
    
    const positiveCount = extractedSignals.filter(s => s.type === 'positive').length;
    const negativeCount = extractedSignals.filter(s => s.type === 'negative').length;
    
    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > negativeCount) return 'positive';
    return 'mixed';
  }


  /**
   * Analyzes results for conclusive evidence that allows early termination
   */
  analyzeForConclusiveEvidence(results, riskLevel) {
    const evidence = {
      triggered: false,
      reason: null,
      confidence: 0,
      conclusiveFactors: []
    };
    
    // Check for obvious fraud indicators
    if (results.fraudReports?.fraudReportsFound > 2) {
      evidence.triggered = true;
      evidence.reason = 'multiple_fraud_reports';
      evidence.confidence = 90;
      evidence.conclusiveFactors.push('Multiple fraud reports found');
    }
    
    // Check for OJK warnings
    if (results.ojk?.registrationStatus === 'warning_issued') {
      evidence.triggered = true;
      evidence.reason = 'regulatory_warning';
      evidence.confidence = 95;
      evidence.conclusiveFactors.push('OJK warning issued');
    }
    
    // Check for strong legitimacy signals (for low-risk companies)
    if (riskLevel === 'low') {
      const legitimacyCount = results.businessInfo?.legitimacySignals?.length || 0;
      const positiveNews = results.news?.sentiment === 'positive';
      const ojkRegistered = results.ojk?.registrationStatus === 'registered';
      
      if (legitimacyCount >= 3 && positiveNews && ojkRegistered) {
        evidence.triggered = true;
        evidence.reason = 'strong_legitimacy';
        evidence.confidence = 85;
        evidence.conclusiveFactors.push('Strong legitimacy indicators confirmed');
      }
    }
    
    // Check for comprehensive negative coverage
    if (results.news?.fraudMentions >= 3 && results.news?.sentiment === 'negative') {
      evidence.triggered = true;
      evidence.reason = 'negative_coverage';
      evidence.confidence = 80;
      evidence.conclusiveFactors.push('Consistent negative news coverage');
    }
    
    return evidence;
  }

  /**
   * Generates enhanced research summary with intelligence insights
   */
  generateEnhancedResearchSummary(results, triageResults, conclusiveEvidence, processingTime) {
    const summary = {
      overallRisk: triageResults.riskLevel,
      confidence: 0,
      keyFindings: [],
      dataQuality: 'partial',
      intelligenceInsights: [],
      processingEfficiency: 'standard'
    };
    
    // Calculate confidence based on evidence quality
    let evidencePoints = 0;
    
    if (results.ojk?.foundEntries > 0) {
      evidencePoints += 20;
      summary.keyFindings.push(`OJK database: ${results.ojk.foundEntries} entries found`);
    }
    
    if (results.news?.totalArticles > 0) {
      evidencePoints += 15;
      summary.keyFindings.push(`News coverage: ${results.news.totalArticles} articles, sentiment: ${results.news.sentiment}`);
    }
    
    if (results.businessInfo?.legitimacySignals?.length > 0) {
      evidencePoints += 10;
      summary.keyFindings.push(`Business signals: ${results.businessInfo.legitimacySignals.length} legitimacy indicators`);
    }
    
    // Enhanced sources contribution
    for (const [sourceName, sourceResults] of Object.entries(results.enhanced || {})) {
      if (sourceResults.length > 0) {
        evidencePoints += 5;
        summary.intelligenceInsights.push(`${sourceName}: ${sourceResults.length} relevant results`);
      }
    }
    
    // Conclusive evidence bonus
    if (conclusiveEvidence.triggered) {
      evidencePoints += 20;
      summary.keyFindings.push(conclusiveEvidence.reason.replace('_', ' '));
      summary.intelligenceInsights.push(`Early termination: ${conclusiveEvidence.reason}`);
    }
    
    summary.confidence = Math.min(100, evidencePoints);
    
    // Determine data quality
    if (evidencePoints >= 60) {
      summary.dataQuality = 'comprehensive';
    } else if (evidencePoints >= 40) {
      summary.dataQuality = 'good';
    } else if (evidencePoints >= 20) {
      summary.dataQuality = 'limited';
    } else {
      summary.dataQuality = 'minimal';
    }
    
    // Processing efficiency analysis
    if (processingTime < 20000) {
      summary.processingEfficiency = 'high';
    } else if (processingTime < 35000) {
      summary.processingEfficiency = 'standard';
    } else {
      summary.processingEfficiency = 'low';
    }
    
    // Risk reassessment based on findings
    if (conclusiveEvidence.triggered && conclusiveEvidence.confidence > 85) {
      if (conclusiveEvidence.reason === 'regulatory_warning' || conclusiveEvidence.reason === 'multiple_fraud_reports') {
        summary.overallRisk = 'critical';
      } else if (conclusiveEvidence.reason === 'strong_legitimacy') {
        summary.overallRisk = 'low';
      }
    }
    
    return summary;
  }


  /**
   * Collect domains from scraping results for impersonation detection
   */
  collectDomains(scrapingResults) {
    const domains = new Set();
    
    // Extract domains from various sources
    Object.values(scrapingResults).forEach(sourceData => {
      if (sourceData && typeof sourceData === 'object') {
        // Check for URLs in results
        if (sourceData.details && Array.isArray(sourceData.details)) {
          sourceData.details.forEach(detail => {
            if (detail.url) {
              try {
                const domain = new URL(detail.url).hostname;
                domains.add(domain);
              } catch (e) {
                // Invalid URL, skip
              }
            }
          });
        }
        
        // Check business info for website domains
        if (sourceData.websites && Array.isArray(sourceData.websites)) {
          sourceData.websites.forEach(website => {
            try {
              const domain = new URL(website).hostname;
              domains.add(domain);
            } catch (e) {
              // Invalid URL, skip
            }
          });
        }
      }
    });
    
    return Array.from(domains);
  }

  /**
   * Ensure summary.keyFindings is populated when sourcesScraped > 0
   */
  generateEnhancedResearchSummary(sources, triageResults, conclusiveEvidence, processingTime) {
    const summary = super.generateSerpAPIResearchSummary ? super.generateSerpAPIResearchSummary(sources) : {};
    
    // Ensure keyFindings is non-empty when we have sources
    const sourcesCount = Object.keys(sources).length;
    if (sourcesCount > 0 && (!summary.keyFindings || summary.keyFindings.length === 0)) {
      summary.keyFindings = this.extractKeyFindings(sources, triageResults);
    }
    
    // Add intelligence insights
    summary.intelligenceInsights = [
      `Processed ${sourcesCount} sources in ${processingTime}ms`,
      `Strategy: ${triageResults.scrapingStrategy.level}`,
      conclusiveEvidence.triggered ? `Early termination: ${conclusiveEvidence.reason}` : 'Full analysis completed'
    ];
    
    return summary;
  }

  /**
   * Extract key findings from sources when none exist
   */
  extractKeyFindings(sources, triageResults) {
    const findings = [];
    
    // IDX findings
    if (sources.idx && sources.idx.isListed) {
      findings.push(`Listed on IDX with ticker ${sources.idx.ticker}`);
    }
    
    // OJK findings
    if (sources.ojk && sources.ojk.registrationStatus !== 'not_found') {
      findings.push(`OJK status: ${sources.ojk.registrationStatus}`);
    }
    
    // News findings
    if (sources.news && sources.news.totalArticles > 0) {
      findings.push(`${sources.news.totalArticles} news articles found`);
    }
    
    // Business info
    if (sources.businessInfo && sources.businessInfo.digitalFootprint) {
      findings.push(`Digital footprint: ${sources.businessInfo.digitalFootprint}`);
    }
    
    // Fraud reports
    if (sources.fraudReports && sources.fraudReports.fraudReportsFound > 0) {
      findings.push(`${sources.fraudReports.fraudReportsFound} fraud reports found`);
    }
    
    // If still no findings, add generic one
    if (findings.length === 0) {
      findings.push('Basic company information gathered');
    }
    
    return findings;
  }
  
  /**
   * Create evidence atom with proper structure for fraud detection
   * FIXED: Standardized evidence atom creation across all scraping sources
   */
  createEvidenceAtom(tier, source, field, value, url = '', verification = 'partial', confidence = 0.7) {
    return {
      tier: Number(tier),
      source: String(source),
      field: String(field),
      value: String(value),
      url: String(url),
      timestamp: new Date().toISOString(),
      verification: String(verification),
      confidence: Math.min(1.0, Math.max(0.0, Number(confidence)))
    };
  }
  
  /**
   * Ensure evidence atoms are collected and returned with scraping results
   * FIXED: Makes sure evidence atoms are always included in analysis
   */
  collectAndReturnEvidence(scrapingResults) {
    // Ensure evidence atoms from context-aware scraper are included
    if (this.evidenceAtoms && this.evidenceAtoms.length > 0) {
      scrapingResults.evidence = [...(scrapingResults.evidence || []), ...this.evidenceAtoms];
      console.log(`🧩 Collected ${this.evidenceAtoms.length} evidence atoms from context-aware scraping`);
    }
    
    // Also ensure evidence from base web scraper is included
    if (this.webScraper && this.webScraper.evidenceAtoms && this.webScraper.evidenceAtoms.length > 0) {
      scrapingResults.evidence = [...(scrapingResults.evidence || []), ...this.webScraper.evidenceAtoms];
      console.log(`🧩 Collected ${this.webScraper.evidenceAtoms.length} evidence atoms from base web scraping`);
    }
    
    return scrapingResults;
  }
}

export default ContextAwareWebScraper;