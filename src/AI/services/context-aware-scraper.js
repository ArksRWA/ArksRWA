import WebScrapingService from './web-scraper.js';
import EntityUtils from './entity-utils.js';
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
    
    // Initialize entity resolution utility
    this.entityUtils = new EntityUtils();
    
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
   * Optimized cost efficiency and early termination logic
   */
  async scrapeWithSerpAPI(companyData, triageResults) {
    try {
      console.log(`🧠 Starting SerpAPI-enhanced intelligent scraping for: ${companyData.name}`);
      
      const strategy = this.determineScrapingStrategy(triageResults);
      const searchTerms = this.generateIntelligentSearchTerms(companyData, triageResults);
      
      // Step 1: Intelligent SerpAPI search prioritization
      const serpAPIPriority = this.determineSerpAPIPriority(triageResults, searchTerms);
      console.log(`🎯 SerpAPI search priority: ${serpAPIPriority.join(', ')}`);
      
      // Step 2: Execute SerpAPI searches with smart batching
      const serpResults = await this.executeSerpAPISearches(
        companyData.name,
        serpAPIPriority,
        strategy
      );
      
      // Step 3: Early termination check
      if (this.shouldTerminateEarly(serpResults, strategy)) {
        console.log(`⚡ Early termination triggered for ${companyData.name}`);
        return this.formatSerpAPIResults(serpResults, true);
      }
      
      // Step 4: HTTP fallback for missing critical data
      const httpFallback = await this.executeHTTPFallback(
        companyData.name,
        serpResults,
        strategy
      );
      
      // Step 5: Combine and format results
      const combinedResults = this.combineSerpAPIAndHTTP(serpResults, httpFallback);
      
      console.log(`✅ SerpAPI-enhanced scraping completed for: ${companyData.name}`);
      return this.formatSerpAPIResults(combinedResults, false);
      
    } catch (error) {
      console.error(`SerpAPI enhanced scraping failed: ${error.message}`);
      
      // Fallback to traditional intelligent scraping
      console.log(`🔄 Falling back to traditional scraping for: ${companyData.name}`);
      return await this.scrapeWithIntelligence(companyData, triageResults);
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
    
    const { riskLevel, riskFactors, priorityPatterns } = triageResults.data;
    
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
            searchResult = await serpAPIService.searchCompanyGeneral(companyName);
            break;
          case 'fraud':
            searchResult = await serpAPIService.searchCompanyFraud(companyName);
            break;
          case 'financial':
            searchResult = await serpAPIService.searchCompanyFinancialTroubles(companyName);
            break;
          case 'regulatory':
            searchResult = await serpAPIService.searchCompanyRegulatory(companyName);
            break;
          case 'news':
            searchResult = await serpAPIService.searchCompanyNews(companyName);
            break;
          case 'victims':
            searchResult = await serpAPIService.searchCompanyVictims(companyName);
            break;
          case 'official':
            searchResult = await serpAPIService.searchCompanyOfficialSites(companyName);
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
   */
  async executeHTTPFallback(companyName, serpResults, strategy) {
    const fallbackNeeded = this.identifyFallbackNeeds(serpResults);
    
    if (fallbackNeeded.length === 0) {
      console.log(`📋 No HTTP fallback needed for: ${companyName}`);
      return null;
    }
    
    console.log(`🔄 Executing HTTP fallback for: ${fallbackNeeded.join(', ')}`);
    
    const fallbackResults = {};
    
    for (const source of fallbackNeeded.slice(0, 2)) { // Limit fallback sources
      try {
        switch (source) {
          case 'ojk_direct':
            fallbackResults.ojkDirect = await this.checkOJKDirect(companyName);
            break;
          case 'business_registry':
            fallbackResults.businessRegistry = await this.checkBusinessRegistry(companyName);
            break;
          case 'indonesian_news':
            fallbackResults.indonesianNews = await this.checkIndonesianNews(companyName);
            break;
        }
      } catch (error) {
        console.warn(`HTTP fallback ${source} failed: ${error.message}`);
      }
    }
    
    return fallbackResults;
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
   * Enhanced company research with context-aware intelligence
   */
  async scrapeWithIntelligence(companyData, triageResults) {
    try {
      console.log(`🔍 Starting intelligent scraping for: ${companyData.name}`);
      console.log(`📋 Strategy: ${triageResults.scrapingStrategy.level}, Priority: ${triageResults.riskLevel}`);
      
      const strategy = triageResults.scrapingStrategy;
      const startTime = Date.now();
      
      // STEP 1: Entity Resolution (canonicalize before scraping)
      const entityData = this.entityUtils.resolveEntity(companyData.name, companyData.description);
      console.log(`🏢 Entity resolved: ${entityData.canonicalName} (certainty: ${entityData.erCertainty})`);
      
      // Use canonical name and aliases for more accurate searching
      const enhancedCompanyData = {
        ...companyData,
        canonicalName: entityData.canonicalName,
        aliases: entityData.aliases,
        entityData: entityData
      };
      
      // STEP 2: Generate contextual search terms (using canonical name + aliases)
      const searchTerms = this.generateContextualSearchTerms(enhancedCompanyData, triageResults);
      
      // STEP 3: Select and prioritize sources based on strategy  
      const prioritizedSources = this.prioritizeSources(strategy, triageResults.riskLevel);
      
      // STEP 4: Execute intelligent scraping with early termination logic
      const scrapingResults = await this.executeIntelligentScraping(
        enhancedCompanyData.canonicalName,
        searchTerms,
        prioritizedSources,
        strategy
      );
      
      // STEP 5: Collect domains for impersonation detection
      const collectedDomains = this.collectDomains(scrapingResults);
      const impersonationRisk = this.entityUtils.checkImpersonationRisk(collectedDomains);
      console.log(`🚨 Impersonation risk: ${impersonationRisk.risk} (${collectedDomains.length} domains checked)`);
      
      // Analyze results for early termination conditions
      const conclusiveEvidence = this.analyzeForConclusiveEvidence(scrapingResults, triageResults.riskLevel);
      
      const processingTime = Date.now() - startTime;
      
      // Generate enhanced research summary
      const enhancedSummary = this.generateEnhancedResearchSummary(
        scrapingResults,
        triageResults,
        conclusiveEvidence,
        processingTime
      );
      
      console.log(`✅ Intelligent scraping completed in ${processingTime}ms - Quality: ${enhancedSummary.dataQuality}`);
      
      // FIXED: Collect and include evidence atoms in results
      const finalResults = {
        companyName: companyData.name,
        canonicalName: entityData.canonicalName,
        entityResolution: entityData, // Include full ER data
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
        strategy: strategy,
        searchTermsUsed: searchTerms,
        sourcesScraped: prioritizedSources.length,
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
        evidence: this.evidenceAtoms || [] // Include collected evidence atoms
      };
      
      // Ensure evidence atoms are properly collected from all sources
      return this.collectAndReturnEvidence(finalResults);
      
    } catch (error) {
      console.error('Intelligent scraping failed:', error);
      return this.generateFallbackResearch(companyData.name, companyData.region || 'Indonesia', error);
    }
  }

  /**
   * Generates contextual search terms based on industry and risk patterns
   */
  generateContextualSearchTerms(companyData, triageResults) {
    const { name } = companyData;
    const { riskLevel, riskFactors } = triageResults;
    
    const searchTerms = {
      base: [`"${companyData.name}"`],
      legitimacy: [],
      fraud: [],
      regulatory: [],
      contextual: [],
      troubles: []  // New category for financial troubles
    };
    
    // Universal fraud patterns (no industry bias)
    const universalFraudPatterns = [
      'penipuan', 'scam', 'penipu', 'fraud',
      'investasi bodong', 'skema ponzi', 'money game',
      'bermasalah', 'bermasalah financial', 'financial trouble',
      'tutup usaha', 'bangkrut', 'bankruptcy', 'failed business',
      'daftar hitam', 'blacklist', 'warning issued'
    ];
    
    // Add universal fraud search terms
    searchTerms.fraud.push(...universalFraudPatterns.map(term => `"${companyData.name}" ${term}`));
    
    // Financial troubles and business problems
    const troublePatterns = [
      'dissolution', 'likuidasi', 'ceased operations', 'tutup', 
      'gagal bayar', 'default payment', 'debt problems', 'hutang bermasalah',
      'investigation', 'investigasi', 'under review', 'sedang diteliti'
    ];
    searchTerms.troubles.push(...troublePatterns.map(term => `"${companyData.name}" ${term}`));
    
    // Regulatory warnings and sanctions (evidence-based)
    const regulatoryWarnings = [
      'OJK peringatan', 'OJK warning', 'OJK sanctions',
      'PPATK suspicious', 'PPATK investigation',
      'government investigation', 'investigasi pemerintah',
      'license revoked', 'izin dicabut', 'suspended operations'
    ];
    searchTerms.regulatory.push(...regulatoryWarnings.map(term => `"${companyData.name}" ${term}`));
    
    // Risk-based term prioritization
    if (riskLevel === 'critical' || riskLevel === 'high') {
      // Focus on fraud investigation and victim testimonials
      searchTerms.fraud.push(
        `"${companyData.name}" korban testimoni`,
        `"${companyData.name}" victim testimonial`,
        `"${companyData.name}" complaint keluhan`,
        `"${companyData.name}" "tidak bisa withdraw"`,
        `"${companyData.name}" "cannot withdraw"`,
        `"${companyData.name}" "gagal bayar investor"`
      );
      
      // Financial troubles for high-risk companies
      searchTerms.troubles.push(
        `"${companyData.name}" "financial difficulty"`,
        `"${companyData.name}" "cash flow problem"`,
        `"${companyData.name}" "investor losses"`
      );
    } else if (riskLevel === 'low') {
      // Focus on positive legitimacy indicators
      searchTerms.legitimacy.push(
        `"${companyData.name}" "good reputation"`,
        `"${companyData.name}" "reputasi baik"`,
        `"${companyData.name}" "customer satisfaction"`,
        `"${companyData.name}" "successful business"`
      );
    }
    
    // Add contextual terms based on detected risk factors
    for (const riskFactor of riskFactors) {
      if (riskFactor.includes('ponzi') || riskFactor.includes('investment')) {
        searchTerms.contextual.push(
          `"${companyData.name}" "skema ponzi"`,
          `"${companyData.name}" "investment scam"`,
          `"${companyData.name}" "pyramid scheme"`
        );
      }
      if (riskFactor.includes('guaranteed') || riskFactor.includes('profit')) {
        searchTerms.contextual.push(
          `"${companyData.name}" "unrealistic returns"`,
          `"${companyData.name}" "too good to be true"`,
          `"${companyData.name}" "guaranteed profit scam"`
        );
      }
      if (riskFactor.includes('financial') || riskFactor.includes('bank')) {
        searchTerms.contextual.push(
          `"${companyData.name}" "unlicensed financial"`,
          `"${companyData.name}" "illegal banking"`,
          `"${companyData.name}" "unregistered fintech"`
        );
      }
    }
    
    return searchTerms;
  }

  /**
   * Prioritizes sources based on strategy and risk level
   */
  prioritizeSources(strategy, riskLevel) {
    const availableSources = Object.keys(this.enhancedSources);
    const baseTargets = this.config.targets;
    
    // Combine base and enhanced sources
    const allSources = [...Object.keys(baseTargets), ...availableSources];
    
    // Priority mapping based on risk level
    const riskPriorities = {
      critical: ['ppatk', 'ojk', 'ahu', 'detik', 'kompas', 'tribunnews', 'tempo'],
      high: ['ojk', 'ppatk', 'detik', 'kompas', 'ahu'],
      medium: ['ojk', 'detik', 'kompas', 'ahu'],
      low: ['ojk', 'google', 'yellowpages']
    };
    
    const priorityList = riskPriorities[riskLevel] || riskPriorities.medium;
    
    // Filter sources based on strategy limits
    const selectedSources = priorityList.slice(0, strategy.maxSources || 5);
    
    return selectedSources.map(sourceName => ({
      name: sourceName,
      config: this.enhancedSources[sourceName] || this.config.targets[sourceName] || this.config.targets.google,
      maxResults: strategy.maxResultsPerSource || 5
    }));
  }

  /**
   * Executes intelligent scraping with early termination logic
   */
  async executeIntelligentScraping(companyName, searchTerms, sources, strategy) {
    const results = {
      ojk: { registrationStatus: 'unknown', foundEntries: 0, details: [] },
      news: { totalArticles: 0, sentiment: 'neutral', fraudMentions: 0, articles: [] },
      businessInfo: { businessRegistration: 'unknown', digitalFootprint: 'minimal', legitimacySignals: [] },
      fraudReports: { fraudReportsFound: 0, riskLevel: 'unknown', warnings: [] },
      enhanced: {}
    };
    
    let totalEvidence = 0;
    const startTime = Date.now();
    
    for (const source of sources) {
      // Check timeout
      if (Date.now() - startTime > strategy.timeoutMs) {
        console.log(`⏰ Scraping timeout reached for ${companyName}`);
        break;
      }
      
      // Check early termination
      if (strategy.earlyTermination && totalEvidence >= strategy.terminationThreshold) {
        console.log(`🔚 Early termination triggered for ${companyName} - Evidence threshold reached`);
        break;
      }
      
      try {
        console.log(`🌐 Scraping source: ${source.name}`);
        
        // Select appropriate search terms based on source specialization
        const relevantTerms = this.selectRelevantSearchTerms(searchTerms, source);
        
        // Execute source-specific scraping
        const sourceResults = await this.scrapeSourceIntelligently(
          companyName, 
          relevantTerms, 
          source
        );
        
        // Integrate results
        this.integrateSourceResults(results, sourceResults, source.name);
        
        // Update evidence counter
        totalEvidence += this.countEvidence(sourceResults);
        
        // Random delay between sources
        await this.randomDelay();
        
      } catch (error) {
        console.warn(`Source scraping failed for ${source.name}:`, error.message);
        continue;
      }
    }
    
    return results;
  }

  /**
   * Selects relevant search terms based on source specialization
   */
  selectRelevantSearchTerms(searchTerms, source) {
    const specialization = source.config?.specialization;
    
    switch (specialization) {
      case 'financial_crime':
        return [...searchTerms.base, ...searchTerms.fraud, ...searchTerms.regulatory, ...searchTerms.troubles];
        
      case 'business_registration':
        return [...searchTerms.base, ...searchTerms.legitimacy, ...searchTerms.regulatory];
        
      case 'news_coverage':
      case 'investigative_journalism':
        return [...searchTerms.base, ...searchTerms.fraud, ...searchTerms.contextual, ...searchTerms.troubles];
        
      case 'social_sentiment':
        return [...searchTerms.base, ...searchTerms.fraud, ...searchTerms.troubles];
        
      case 'business_directory':
        return [...searchTerms.base, ...searchTerms.legitimacy];
        
      default:
        // Use enhanced terms for general sources with fraud focus
        return [
          ...searchTerms.base,
          ...searchTerms.fraud.slice(0, 3),
          ...searchTerms.troubles.slice(0, 2),
          ...searchTerms.legitimacy.slice(0, 1),
          ...searchTerms.contextual.slice(0, 1)
        ];
    }
  }

  /**
   * Scrapes a specific source with intelligent term selection
   */
  async scrapeSourceIntelligently(companyName, searchTerms, source) {
    const results = [];
    
    // Limit search terms to avoid overwhelming the source
    const limitedTerms = searchTerms.slice(0, 3);
    
    for (const searchTerm of limitedTerms) {
      try {
        const searchResults = await this.performGoogleSearch(searchTerm, source.name);
        
        // Filter and enhance results based on source specialization
        const enhancedResults = this.enhanceSearchResults(searchResults, source.config.specialization);
        
        results.push(...enhancedResults);
        
        // Limit results per source
        if (results.length >= source.maxResults) {
          break;
        }
        
        // Small delay between search terms
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.warn(`Search failed for term "${searchTerm}" on ${source.name}:`, error.message);
        continue;
      }
    }
    
    return results.slice(0, source.maxResults);
  }

  /**
   * Enhances search results based on source specialization
   */
  enhanceSearchResults(results, specialization) {
    return results.map(result => ({
      ...result,
      sourceSpecialization: specialization,
      relevanceScore: this.calculateRelevanceScore(result, specialization),
      extractedSignals: this.extractSpecializedSignals(result, specialization)
    }));
  }

  /**
   * Calculates relevance score based on content and specialization
   */
  calculateRelevanceScore(result, specialization) {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    let score = 50; // Base score
    
    const specializationKeywords = {
      financial_crime: ['ppatk', 'money laundering', 'financial crime', 'suspicious transaction'],
      business_registration: ['terdaftar', 'registered', 'business permit', 'legal entity'],
      news_coverage: ['berita', 'news', 'reported', 'coverage'],
      investigative_journalism: ['investigasi', 'investigation', 'exposed', 'analysis'],
      social_sentiment: ['review', 'pengalaman', 'complaint', 'testimonial'],
      business_directory: ['directory', 'listing', 'business profile', 'company info']
    };
    
    const keywords = specializationKeywords[specialization] || [];
    
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 15;
      }
    }
    
    // Fraud indicators increase relevance for certain specializations
    const fraudKeywords = ['penipuan', 'scam', 'fraud', 'kerugian', 'victim'];
    if (['financial_crime', 'investigative_journalism'].includes(specialization)) {
      for (const keyword of fraudKeywords) {
        if (text.includes(keyword)) {
          score += 20;
        }
      }
    }
    
    return Math.min(100, score);
  }

  /**
   * Extracts specialized signals from search results
   */
  extractSpecializedSignals(result, specialization) {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    const signals = [];
    
    const signalPatterns = {
      financial_crime: {
        positive: ['cleared', 'legitimate', 'compliant'],
        negative: ['suspicious', 'money laundering', 'financial crime', 'ppatk investigation'],
        regulatory: ['ppatk report', 'financial intelligence', 'transaction monitoring']
      },
      business_registration: {
        positive: ['terdaftar resmi', 'legally registered', 'valid permit'],
        negative: ['tidak terdaftar', 'unregistered', 'illegal operation'],
        regulatory: ['kemenkumham', 'ministry approval', 'business license']
      },
      news_coverage: {
        positive: ['positive coverage', 'success story', 'achievement'],
        negative: ['scandal', 'controversy', 'investigation'],
        neutral: ['mentioned in news', 'media coverage', 'press release']
      }
    };
    
    const patterns = signalPatterns[specialization];
    if (patterns) {
      for (const [type, keywords] of Object.entries(patterns)) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            signals.push({ type, keyword, context: specialization });
          }
        }
      }
    }
    
    return signals;
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
   * Counts evidence from source results for early termination logic
   */
  countEvidence(sourceResults) {
    let evidenceCount = 0;
    
    for (const result of sourceResults) {
      // High relevance results count as more evidence
      if (result.relevanceScore > 80) {
        evidenceCount += 3;
      } else if (result.relevanceScore > 60) {
        evidenceCount += 2;
      } else {
        evidenceCount += 1;
      }
      
      // Specialized signals add to evidence count
      evidenceCount += result.extractedSignals.length;
    }
    
    return evidenceCount;
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
   * Test the context-aware scraper with different risk scenarios
   */
  async testContextAwareScraping() {
    const testScenarios = [
      // Low risk scenario
      {
        companyData: {
          name: 'PT Bank Digital Indonesia',
          industry: 'banking'
        },
        triageResults: {
          riskLevel: 'low',
          riskFactors: [],
          scrapingStrategy: {
            level: 'light',
            maxSources: 3,
            maxResultsPerSource: 3,
            timeoutMs: 15000,
            earlyTermination: true,
            terminationThreshold: 5
          }
        }
      },
      
      // High risk scenario
      {
        companyData: {
          name: 'Investasi Ponzi Guaranteed',
          industry: 'investment'
        },
        triageResults: {
          riskLevel: 'critical',
          riskFactors: ['ponzi scheme indicators', 'guaranteed returns'],
          scrapingStrategy: {
            level: 'deep',
            maxSources: 8,
            maxResultsPerSource: 8,
            timeoutMs: 45000,
            earlyTermination: false,
            terminationThreshold: null
          }
        }
      }
    ];
    
    console.log('🧪 Testing Context-Aware Web Scraper...');
    const results = [];
    
    for (const scenario of testScenarios) {
      console.log(`Testing: ${scenario.companyData.name} (${scenario.triageResults.riskLevel} risk)`);
      const result = await this.scrapeWithIntelligence(scenario.companyData, scenario.triageResults);
      results.push({
        scenario: scenario.companyData.name,
        result
      });
    }
    
    return results;
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
    const summary = super.generateResearchSummary ? super.generateResearchSummary(sources) : {};
    
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