import WebScrapingService from './web-scraper.js';
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
   * Enhanced company research with context-aware intelligence
   */
  async scrapeWithIntelligence(companyData, triageResults) {
    try {
      console.log(`🔍 Starting intelligent scraping for: ${companyData.name}`);
      console.log(`📋 Strategy: ${triageResults.scrapingStrategy.level}, Priority: ${triageResults.riskLevel}`);
      
      const strategy = triageResults.scrapingStrategy;
      const startTime = Date.now();
      
      // Generate contextual search terms based on industry and risk factors
      const searchTerms = this.generateContextualSearchTerms(companyData, triageResults);
      
      // Select and prioritize sources based on strategy
      const prioritizedSources = this.prioritizeSources(strategy, triageResults.riskLevel);
      
      // Execute intelligent scraping with early termination logic
      const scrapingResults = await this.executeIntelligentScraping(
        companyData.name,
        searchTerms,
        prioritizedSources,
        strategy
      );
      
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
      
      return {
        companyName: companyData.name,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
        strategy: strategy,
        searchTermsUsed: searchTerms,
        sourcesScraped: prioritizedSources.length,
        sources: scrapingResults,
        conclusiveEvidence: conclusiveEvidence,
        summary: enhancedSummary,
        intelligence: {
          earlyTermination: conclusiveEvidence.triggered,
          terminationReason: conclusiveEvidence.reason,
          confidenceLevel: conclusiveEvidence.confidence
        }
      };
      
    } catch (error) {
      console.error('Intelligent scraping failed:', error);
      return this.generateFallbackResearch(companyData.name, companyData.region || 'Indonesia', error);
    }
  }

  /**
   * Generates contextual search terms based on industry and risk patterns
   */
  generateContextualSearchTerms(companyData, triageResults) {
    const { industry } = companyData;
    const { riskLevel, riskFactors } = triageResults;
    
    const searchTerms = {
      base: [`"${companyData.name}"`],
      legitimacy: [],
      fraud: [],
      regulatory: [],
      contextual: []
    };
    
    // Get industry-specific patterns
    const industryPatterns = this.contextPatterns[industry] || {
      legitimacy: ['terdaftar resmi', 'legal business'],
      fraud: ['penipuan', 'scam'],
      regulatory: ['izin usaha', 'business permit']
    };
    
    // Add industry-specific terms
    searchTerms.legitimacy.push(...industryPatterns.legitimacy.map(term => `"${companyData.name}" ${term}`));
    searchTerms.fraud.push(...industryPatterns.fraud.map(term => `"${companyData.name}" ${term}`));
    searchTerms.regulatory.push(...industryPatterns.regulatory.map(term => `"${companyData.name}" ${term}`));
    
    // Risk-based term prioritization
    if (riskLevel === 'critical' || riskLevel === 'high') {
      // Focus on fraud investigation terms
      searchTerms.fraud.push(
        `"${companyData.name}" penipuan korban`,
        `"${companyData.name}" scam victim`,
        `"${companyData.name}" investasi bodong`,
        `"${companyData.name}" kerugian investor`
      );
      
      // Add regulatory warning terms
      searchTerms.regulatory.push(
        `"${companyData.name}" OJK peringatan`,
        `"${companyData.name}" PPATK suspicious`,
        `"${companyData.name}" daftar hitam`
      );
    } else if (riskLevel === 'low') {
      // Focus on legitimacy confirmation
      searchTerms.legitimacy.push(
        `"${companyData.name}" award penghargaan`,
        `"${companyData.name}" partnership kemitraan`,
        `"${companyData.name}" media coverage positif`
      );
    }
    
    // Add contextual terms based on detected risk factors
    for (const riskFactor of riskFactors) {
      if (riskFactor.includes('ponzi') || riskFactor.includes('investment')) {
        searchTerms.contextual.push(
          `"${companyData.name}" "skema ponzi"`,
          `"${companyData.name}" "investment fraud"`
        );
      }
      if (riskFactor.includes('guaranteed') || riskFactor.includes('profit')) {
        searchTerms.contextual.push(
          `"${companyData.name}" "guaranteed return"`,
          `"${companyData.name}" "profit guaranteed"`
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
        return [...searchTerms.base, ...searchTerms.fraud, ...searchTerms.regulatory];
        
      case 'business_registration':
        return [...searchTerms.base, ...searchTerms.legitimacy, ...searchTerms.regulatory];
        
      case 'news_coverage':
      case 'investigative_journalism':
        return [...searchTerms.base, ...searchTerms.fraud, ...searchTerms.contextual];
        
      case 'social_sentiment':
        return [...searchTerms.base, ...searchTerms.fraud];
        
      case 'business_directory':
        return [...searchTerms.base, ...searchTerms.legitimacy];
        
      default:
        // Use all terms for general sources
        return [
          ...searchTerms.base,
          ...searchTerms.legitimacy.slice(0, 2),
          ...searchTerms.fraud.slice(0, 2),
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
    // Map source results to appropriate categories
    if (sourceName === 'ojk' || sourceName === 'ppatk') {
      // Regulatory sources
      mainResults.ojk.foundEntries += sourceResults.length;
      mainResults.ojk.details.push(...sourceResults.slice(0, 3));
      
      // Analyze for registration status
      const registrationSignals = sourceResults.filter(r => 
        r.extractedSignals.some(s => s.type === 'positive' || s.type === 'regulatory')
      );
      
      if (registrationSignals.length > 0) {
        mainResults.ojk.registrationStatus = 'registered';
      }
      
    } else if (sourceName === 'ahu') {
      // Business registration source
      mainResults.businessInfo.foundSources += sourceResults.length;
      
      const legitimacySignals = sourceResults
        .filter(r => r.extractedSignals.some(s => s.type === 'positive'))
        .map(r => r.extractedSignals.filter(s => s.type === 'positive'))
        .flat()
        .map(s => s.keyword);
      
      mainResults.businessInfo.legitimacySignals.push(...legitimacySignals);
      
    } else if (['detik', 'kompas', 'tribunnews', 'tempo'].includes(sourceName)) {
      // News sources
      mainResults.news.totalArticles += sourceResults.length;
      mainResults.news.articles.push(...sourceResults.slice(0, 3));
      
      // Analyze sentiment and fraud mentions
      const fraudArticles = sourceResults.filter(r => 
        r.extractedSignals.some(s => s.type === 'negative')
      );
      
      mainResults.news.fraudMentions += fraudArticles.length;
      
      if (fraudArticles.length > sourceResults.length * 0.6) {
        mainResults.news.sentiment = 'negative';
      } else if (fraudArticles.length < sourceResults.length * 0.2) {
        mainResults.news.sentiment = 'positive';
      } else {
        mainResults.news.sentiment = 'mixed';
      }
      
    } else {
      // Other sources go to enhanced results
      if (!mainResults.enhanced[sourceName]) {
        mainResults.enhanced[sourceName] = [];
      }
      mainResults.enhanced[sourceName].push(...sourceResults);
    }
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
}

export default ContextAwareWebScraper;