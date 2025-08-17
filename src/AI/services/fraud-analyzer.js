import GeminiService from './gemini.js';
import IntelligentRiskTriageService from './intelligent-triage.js';
import ContextAwareWebScraper from './context-aware-scraper.js';
import EntityUtils from './entity-utils.js';
import { serpAPIService } from './serpapi-service.js';

/**
 * Indonesian Fraud Analysis Service
 * Stage 1 & 2 Enhanced: Combines intelligent triage with context-aware web scraping
 * Specialized for Indonesian business environment and regulations
 */
class FraudAnalyzer {
  constructor() {
    this.geminiService = new GeminiService();
    this.triageService = new IntelligentRiskTriageService(this.geminiService);
    this.contextAwareScraper = new ContextAwareWebScraper();
    this.entityUtils = new EntityUtils();
    
    // Authoritative-first risk buckets (deterministic thresholds)
    this.RISK_BUCKETS = {
      low: [0, 30],
      medium: [31, 60], 
      high: [61, 85],
      critical: [86, 100]
    };
    
    // Evidence-based configuration (no industry bias)
    this.config = {
      // Cache settings
      cacheExpiryHours: 24,
      maxRetries: 3,
      timeoutMs: 30000
    };
    
    // Analysis cache
    this.analysisCache = new Map();
  }

  /**
   * NEW: Enhanced fraud analysis with SerpAPI integration using FULL pipeline
   * Uses SerpAPI for data collection, then processes through complete fraud analyzer pipeline
   */
  async analyzeCompanyWithSerpAPI(companyData) {
    const analysisStart = Date.now();
    
    try {
      console.log(`🔍 Starting SerpAPI-enhanced fraud analysis for: ${companyData.name}`);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(companyData);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`📋 Using cached analysis for: ${companyData.name}`);
        return {
          ...cached,
          source: 'cache_serpapi',
          timestamp: new Date().toISOString()
        };
      }

      // STAGE 1: Intelligent Risk Triage (same as full pipeline)
      console.log(`🧠 Stage 1: Performing intelligent triage...`);
      const triageResults = await this.triageService.performInitialTriage(companyData);
      
      // STAGE 2: SerpAPI-Enhanced Context-Aware Web Scraping
      console.log(`🌐 Stage 2: SerpAPI-enhanced context-aware scraping (${triageResults.scrapingStrategy.level} strategy)...`);
      const intelligentWebResearch = await this.contextAwareScraper.scrapeWithSerpAPI(
        companyData, 
        triageResults
      );

      // Prepare enhanced company data with triage insights
      const enhancedData = this.enhanceCompanyDataWithTriage(companyData, triageResults);
      
      // STAGE 3A: Enhanced AI Analysis (with SerpAPI data and triage context)
      console.log(`🤖 Stage 3A: AI analysis with SerpAPI intelligence context...`);
      const aiAnalysis = await this.performEnhancedAIAnalysis(
        enhancedData, 
        intelligentWebResearch, 
        triageResults
      );
      
      // STAGE 3B: Enhanced Rule-Based Analysis (with SerpAPI data)
      console.log(`📊 Stage 3B: Rule-based analysis with SerpAPI insights...`);
      const ruleBasedAnalysis = this.performEnhancedRuleBasedAnalysis(
        enhancedData, 
        intelligentWebResearch, 
        triageResults
      );
      
      // STAGE 4: Intelligent Result Combination (full pipeline)
      const combinedAnalysis = this.combineIntelligentAnalysisResults(
        aiAnalysis, 
        ruleBasedAnalysis, 
        triageResults,
        intelligentWebResearch,
        enhancedData
      );
      
      // Add performance metrics
      const totalAnalysisTime = Date.now() - analysisStart;
      combinedAnalysis.performance = {
        totalTimeMs: totalAnalysisTime,
        triageTimeMs: triageResults.processingTimeMs,
        scrapingTimeMs: intelligentWebResearch.processingTimeMs,
        efficiency: this.calculateEfficiencyScore(totalAnalysisTime, triageResults, intelligentWebResearch),
        resourcesUsed: {
          sources: intelligentWebResearch.sourcesScraped,
          searchTerms: intelligentWebResearch.searchTermsUsed ? Object.values(intelligentWebResearch.searchTermsUsed).flat().length : 0,
          earlyTermination: intelligentWebResearch.intelligence?.earlyTermination || false,
          serpAPISearches: intelligentWebResearch.serpAPIResults?.summary?.searchesExecuted || 0
        }
      };
      
      // Mark as SerpAPI-enhanced methodology
      combinedAnalysis.source = 'serpapi_enhanced_intelligent_analysis';
      combinedAnalysis.methodology = 'serpapi_full_pipeline';
      
      // Cache the result
      this.addToCache(cacheKey, combinedAnalysis);
      
      console.log(`✅ SerpAPI-enhanced analysis completed in ${totalAnalysisTime}ms - Score: ${combinedAnalysis.fraudScore}, Efficiency: ${combinedAnalysis.performance.efficiency}`);
      return combinedAnalysis;
      
    } catch (error) {
      console.error(`SerpAPI-enhanced analysis failed for ${companyData.name}:`, error);
      
      // Fallback to traditional analysis
      console.log(`🔄 Falling back to traditional analysis for: ${companyData.name}`);
      return await this.analyzeCompany(companyData);
    }
  }

  /**
   * Perform rule-based validation on SerpAPI results
   */
  performRuleBasedValidation(companyData, serpResults) {
    const validation = {
      fraudIndicators: [],
      legitimacySignals: [],
      regulatoryIssues: [],
      businessValidation: {},
      riskFactors: []
    };
    
    // Validate Indonesian business patterns
    validation.businessValidation = this.validateIndonesianBusiness(companyData);
    
    // Analyze SerpAPI search results for patterns
    Object.entries(serpResults.searches).forEach(([searchType, searchData]) => {
      if (searchData && !searchData.error) {
        const analysis = this.analyzeSearchTypeResults(searchType, searchData, companyData);
        
        validation.fraudIndicators.push(...analysis.fraudIndicators);
        validation.legitimacySignals.push(...analysis.legitimacySignals);
        validation.regulatoryIssues.push(...analysis.regulatoryIssues);
        validation.riskFactors.push(...analysis.riskFactors);
      }
    });
    
    return validation;
  }

  /**
   * Analyze specific search type results for fraud patterns
   */
  analyzeSearchTypeResults(searchType, searchData, companyData) {
    const analysis = {
      fraudIndicators: [],
      legitimacySignals: [],
      regulatoryIssues: [],
      riskFactors: []
    };
    
    const results = searchData.organic_results || searchData.news_results || [];
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet || ''}`.toLowerCase();
      const companyName = companyData.name.toLowerCase();
      
      // Fraud indicator detection
      if (this.detectFraudIndicators(text, companyName)) {
        analysis.fraudIndicators.push({
          type: searchType,
          source: result.link,
          evidence: result.title,
          severity: this.assessEvidenceSeverity(text, searchType)
        });
      }
      
      // Legitimacy signal detection
      if (this.detectLegitimacySignals(text, companyName)) {
        analysis.legitimacySignals.push({
          type: searchType,
          source: result.link,
          evidence: result.title,
          strength: this.assessSignalStrength(text, searchType)
        });
      }
      
      // Regulatory issue detection
      if (this.detectRegulatoryIssues(text, companyName)) {
        analysis.regulatoryIssues.push({
          type: searchType,
          source: result.link,
          issue: result.title,
          severity: this.assessRegulatorySeverity(text)
        });
      }
    });
    
    return analysis;
  }

  /**
   * Detect fraud indicators in search results
   */
  detectFraudIndicators(text, companyName) {
    const fraudKeywords = [
      'penipuan', 'scam', 'fraud', 'penipu', 'menipu',
      'investasi bodong', 'skema ponzi', 'money game',
      'gugatan', 'complaint', 'korban', 'victim',
      'bangkrut', 'bermasalah', 'tutup', 'closed',
      'peringatan', 'warning', 'blacklist', 'daftar hitam'
    ];
    
    // Check if fraud terms are directly associated with the company
    return fraudKeywords.some(keyword => {
      const keywordIndex = text.indexOf(keyword);
      const companyIndex = text.indexOf(companyName);
      
      // If both are found and relatively close (within 100 characters)
      if (keywordIndex !== -1 && companyIndex !== -1) {
        return Math.abs(keywordIndex - companyIndex) < 100;
      }
      
      return false;
    });
  }

  /**
   * Detect legitimacy signals in search results
   */
  detectLegitimacySignals(text, companyName) {
    const legitimacyKeywords = [
      'ojk', 'terdaftar', 'registered', 'resmi', 'official',
      'sertifikat', 'certified', 'izin', 'licensed',
      'akreditasi', 'accredited', 'iso', 'audit',
      'penghargaan', 'award', 'prestasi', 'achievement',
      'ekspansi', 'expansion', 'growth', 'berkembang'
    ];
    
    return legitimacyKeywords.some(keyword => {
      const keywordIndex = text.indexOf(keyword);
      const companyIndex = text.indexOf(companyName);
      
      if (keywordIndex !== -1 && companyIndex !== -1) {
        return Math.abs(keywordIndex - companyIndex) < 100;
      }
      
      return false;
    });
  }

  /**
   * Detect regulatory issues in search results
   */
  detectRegulatoryIssues(text, companyName) {
    const regulatoryKeywords = [
      'sanksi', 'sanction', 'peringatan', 'warning',
      'investigasi', 'investigation', 'pemeriksaan', 'audit',
      'pelanggaran', 'violation', 'denda', 'fine',
      'pencabutan izin', 'license revocation', 'suspended'
    ];
    
    return regulatoryKeywords.some(keyword => {
      const keywordIndex = text.indexOf(keyword);
      const companyIndex = text.indexOf(companyName);
      
      if (keywordIndex !== -1 && companyIndex !== -1) {
        return Math.abs(keywordIndex - companyIndex) < 100;
      }
      
      return false;
    });
  }

  /**
   * Assess evidence severity
   */
  assessEvidenceSeverity(text, searchType) {
    if (searchType === 'regulatory' && (text.includes('sanksi') || text.includes('revoked'))) {
      return 'critical';
    }
    
    if (searchType === 'victims' && text.includes('korban')) {
      return 'high';
    }
    
    if (text.includes('ponzi') || text.includes('investasi bodong')) {
      return 'high';
    }
    
    if (text.includes('complaint') || text.includes('gugatan')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Assess legitimacy signal strength
   */
  assessSignalStrength(text, searchType) {
    if (searchType === 'regulatory' && text.includes('ojk')) {
      return 'high';
    }
    
    if (text.includes('certified') || text.includes('sertifikat')) {
      return 'high';
    }
    
    if (text.includes('official') || text.includes('resmi')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Assess regulatory severity
   */
  assessRegulatorySeverity(text) {
    if (text.includes('pencabutan') || text.includes('revoked')) {
      return 'critical';
    }
    
    if (text.includes('sanksi') || text.includes('sanction')) {
      return 'high';
    }
    
    if (text.includes('peringatan') || text.includes('warning')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Combine SerpAPI and AI analysis results with entity resolution
   */
  combineSerpAPIAndAIAnalysis(geminiAnalysis, ruleBasedAnalysis, serpResults, companyData, entityResolution = null) {
    const aiData = geminiAnalysis.data;
    const fallbackScore = aiData?.fraudScore || 50;
    
    // Factor in entity resolution confidence
    let entityResolutionBonus = 0;
    if (entityResolution) {
      if (entityResolution.confidence > 0.9) {
        entityResolutionBonus = 5; // High confidence entity resolution
      } else if (entityResolution.confidence > 0.7) {
        entityResolutionBonus = 3; // Medium confidence
      } else if (entityResolution.confidence < 0.5) {
        entityResolutionBonus = -5; // Low confidence penalty
      }
    }
    
    // Calculate weighted final score
    const aiWeight = geminiAnalysis.success && aiData ? 0.7 : 0.3;
    const ruleWeight = 1 - aiWeight;
    
    const ruleBasedScore = this.calculateRuleBasedScore(ruleBasedAnalysis, serpResults);
    const baseScore = Math.round((fallbackScore * aiWeight) + (ruleBasedScore * ruleWeight));
    const finalScore = Math.max(0, Math.min(100, baseScore + entityResolutionBonus));
    
    // Determine final risk level
    const riskLevel = this.determineRiskLevel(finalScore);
    
    // Generate comprehensive recommendations with entity context
    const recommendations = this.generateSerpAPIRecommendations(
      geminiAnalysis,
      ruleBasedAnalysis,
      serpResults,
      riskLevel,
      entityResolution
    );
    
    return {
      fraudScore: finalScore,
      riskLevel,
      confidence: this.calculateSerpAPIConfidence(geminiAnalysis, serpResults),
      methodology: 'serpapi_gemini_hybrid_with_entity_resolution',
      entityResolution: entityResolution,
      evidenceBreakdown: {
        aiAnalysis: aiData?.evidenceBreakdown || {},
        ruleBasedFindings: ruleBasedAnalysis,
        serpAPIMetrics: serpResults.summary,
        entityResolutionImpact: entityResolutionBonus
      },
      recommendations,
      dataQuality: this.assessOverallDataQuality(geminiAnalysis, serpResults),
      processingDetails: {
        serpAPISearches: Object.keys(serpResults.searches).length,
        aiAnalysisSuccess: geminiAnalysis.success,
        totalEvidence: this.countTotalEvidence(ruleBasedAnalysis),
        earlyTermination: serpResults.summary?.earlyTermination || false,
        entityResolutionConfidence: entityResolution?.confidence || 0
      }
    };
  }

  /**
   * Calculate rule-based score from validation results
   */
  calculateRuleBasedScore(ruleBasedAnalysis, serpResults) {
    let score = 30; // Base score
    
    // Penalty for fraud indicators
    const fraudIndicators = ruleBasedAnalysis.fraudIndicators.length;
    score += fraudIndicators * 15;
    
    // Bonus for legitimacy signals
    const legitimacySignals = ruleBasedAnalysis.legitimacySignals.length;
    score -= legitimacySignals * 8;
    
    // Penalty for regulatory issues
    const regulatoryIssues = ruleBasedAnalysis.regulatoryIssues.length;
    score += regulatoryIssues * 20;
    
    // Factor in search result volume
    const totalResults = serpResults.summary?.totalResults || 0;
    if (totalResults > 20) {
      score += 5; // More results = more visibility = potentially more issues
    } else if (totalResults < 5) {
      score += 10; // Very low visibility = suspicious
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate confidence based on data availability
   */
  calculateConfidence(geminiAnalysis, serpResults) {
    let confidence = 50; // Base confidence
    
    // AI analysis contribution
    if (geminiAnalysis.success && geminiAnalysis.data?.confidence) {
      confidence += (geminiAnalysis.data.confidence - 50) * 0.5;
    }
    
    // SerpAPI data quality contribution
    const totalResults = serpResults.summary?.totalResults || 0;
    if (totalResults > 15) confidence += 20;
    else if (totalResults > 8) confidence += 10;
    else if (totalResults > 3) confidence += 5;
    
    // Search diversity contribution
    const searchTypes = Object.keys(serpResults.searches).length;
    confidence += Math.min(searchTypes * 3, 15);
    
    // Early termination indicates strong evidence
    if (serpResults.summary?.earlyTermination) {
      confidence += 10;
    }
    
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Generate comprehensive recommendations with entity resolution context
   */
  generateSerpAPIRecommendations(geminiAnalysis, ruleBasedAnalysis, serpResults, riskLevel, entityResolution = null) {
    const recommendations = [];
    
    // Risk-based recommendations
    switch (riskLevel) {
      case 'critical':
        recommendations.push('REJECT: High fraud risk detected');
        recommendations.push('Report findings to relevant authorities');
        break;
      case 'high':
        recommendations.push('MANUAL REVIEW: Detailed investigation required');
        recommendations.push('Verify all documentation before proceeding');
        break;
      case 'medium':
        recommendations.push('ENHANCED DUE DILIGENCE: Additional verification needed');
        break;
      case 'low':
        recommendations.push('APPROVE: Low risk profile');
        break;
    }
    
    // Entity-specific recommendations
    if (entityResolution) {
      if (entityResolution.industry === 'banking' || entityResolution.industry === 'fintech') {
        recommendations.push('Verify OJK registration and compliance requirements');
        if (entityResolution.registrationStatus === 'unknown') {
          recommendations.push('CRITICAL: Financial services licensing verification required');
        }
      }
      
      if (entityResolution.entityType === 'tbk') {
        recommendations.push('Verify IDX listing status and annual reporting compliance');
      }
      
      if (entityResolution.confidence < 0.7) {
        recommendations.push('Enhanced entity verification required due to low resolution confidence');
      }
    }
    
    // Evidence-based recommendations
    if (ruleBasedAnalysis.fraudIndicators.length > 0) {
      recommendations.push(`Review ${ruleBasedAnalysis.fraudIndicators.length} fraud indicators found`);
    }
    
    if (ruleBasedAnalysis.regulatoryIssues.length > 0) {
      recommendations.push(`Investigate ${ruleBasedAnalysis.regulatoryIssues.length} regulatory concerns`);
    }
    
    // Data quality recommendations
    if (serpResults.summary?.totalResults < 5) {
      recommendations.push('Low online presence - verify business operations independently');
    }
    
    // AI analysis recommendations
    if (geminiAnalysis.success && geminiAnalysis.data?.recommendedAction) {
      recommendations.push(`AI recommendation: ${geminiAnalysis.data.recommendedAction}`);
    }
    
    return recommendations;
  }

  /**
   * Assess overall data quality
   */
  assessOverallDataQuality(geminiAnalysis, serpResults) {
    const aiQuality = geminiAnalysis.success ? 'good' : 'limited';
    const serpQuality = serpResults.summary?.totalResults > 15 ? 'comprehensive' : 
                       serpResults.summary?.totalResults > 8 ? 'good' :
                       serpResults.summary?.totalResults > 3 ? 'limited' : 'minimal';
    
    // Return the better of the two
    const qualityLevels = ['minimal', 'limited', 'good', 'comprehensive'];
    const aiIndex = qualityLevels.indexOf(aiQuality);
    const serpIndex = qualityLevels.indexOf(serpQuality);
    
    return qualityLevels[Math.max(aiIndex, serpIndex)];
  }

  /**
   * Count total evidence from rule-based analysis
   */
  countTotalEvidence(ruleBasedAnalysis) {
    return (ruleBasedAnalysis.fraudIndicators?.length || 0) +
           (ruleBasedAnalysis.legitimacySignals?.length || 0) +
           (ruleBasedAnalysis.regulatoryIssues?.length || 0);
  }

  /**
   * Validate Indonesian business patterns and entity structure
   */
  validateIndonesianBusiness(companyData) {
    const validation = {
      entityType: 'unknown',
      isIndonesianEntity: false,
      hasProperNaming: false,
      industryClassification: 'unknown',
      complianceRequirements: [],
      validationScore: 0
    };

    const companyName = companyData.name.toUpperCase();
    const description = companyData.description.toLowerCase();

    // Check Indonesian entity types
    const entityTypes = ['PT', 'CV', 'TBK', 'PERSERO', 'PERUM'];
    for (const entityType of entityTypes) {
      if (companyName.includes(entityType + ' ') || companyName.includes(' ' + entityType)) {
        validation.entityType = entityType;
        validation.isIndonesianEntity = true;
        validation.hasProperNaming = true;
        validation.validationScore += 20;
        break;
      }
    }

    // Industry classification based on description
    const industryKeywords = {
      financial: ['bank', 'keuangan', 'investasi', 'financial', 'fintech', 'payment'],
      manufacturing: ['manufaktur', 'produksi', 'pabrik', 'industri', 'manufacturing'],
      retail: ['retail', 'perdagangan', 'jual', 'toko', 'store'],
      technology: ['teknologi', 'digital', 'software', 'tech', 'it'],
      services: ['layanan', 'jasa', 'service', 'konsultan']
    };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => description.includes(keyword))) {
        validation.industryClassification = industry;
        validation.validationScore += 10;
        break;
      }
    }

    // Determine compliance requirements
    if (validation.industryClassification === 'financial') {
      validation.complianceRequirements.push('OJK_registration');
      validation.complianceRequirements.push('BI_approval');
    }

    if (validation.isIndonesianEntity) {
      validation.complianceRequirements.push('NPWP');
      validation.complianceRequirements.push('NIB');
      validation.complianceRequirements.push('business_license');
    }

    // Check for suspicious naming patterns
    const suspiciousPatterns = [
      'guaranteed', 'profit', 'income', 'money', 'investment',
      'ponzi', 'mlm', 'binary', 'forex'
    ];

    for (const pattern of suspiciousPatterns) {
      if (companyName.includes(pattern.toUpperCase())) {
        validation.validationScore -= 15;
        break;
      }
    }

    return validation;
  }

  /**
   * Main fraud analysis function - Enhanced with Stage 1 & 2 Intelligence
   * Step 1: Intelligent Triage (determines analysis strategy)
   * Step 2: Context-Aware Web Scraping (resource-optimized research)  
   * Step 3: Combined AI and Rule-Based Analysis
   */
  async analyzeCompany(companyData) {
    const analysisStart = Date.now();
    
    try {
      console.log(`🔍 Starting enhanced fraud analysis for: ${companyData.name}`);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(companyData);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`📋 Using cached analysis for: ${companyData.name}`);
        return {
          ...cached,
          source: 'cache',
          timestamp: new Date().toISOString()
        };
      }

      // STAGE 1: Intelligent Risk Triage
      console.log(`🧠 Stage 1: Performing intelligent triage...`);
      const triageResults = await this.triageService.performInitialTriage(companyData);
      
      // STAGE 2: Context-Aware Web Scraping (based on triage strategy)
      console.log(`🌐 Stage 2: Context-aware web scraping (${triageResults.scrapingStrategy.level} strategy)...`);
      const intelligentWebResearch = await this.contextAwareScraper.scrapeWithIntelligence(
        companyData, 
        triageResults
      );

      // Prepare enhanced company data with triage insights
      const enhancedData = this.enhanceCompanyDataWithTriage(companyData, triageResults);
      
      // STAGE 3A: Enhanced AI Analysis (with web research and triage context)
      console.log(`🤖 Stage 3A: AI analysis with intelligence context...`);
      const aiAnalysis = await this.performEnhancedAIAnalysis(
        enhancedData, 
        intelligentWebResearch, 
        triageResults
      );
      
      // STAGE 3B: Enhanced Rule-Based Analysis
      console.log(`📊 Stage 3B: Rule-based analysis with triage insights...`);
      const ruleBasedAnalysis = this.performEnhancedRuleBasedAnalysis(
        enhancedData, 
        intelligentWebResearch, 
        triageResults
      );
      
      // STAGE 4: Intelligent Result Combination
      const combinedAnalysis = this.combineIntelligentAnalysisResults(
        aiAnalysis, 
        ruleBasedAnalysis, 
        triageResults,
        intelligentWebResearch,
        enhancedData
      );
      
      // Add performance metrics
      const totalAnalysisTime = Date.now() - analysisStart;
      combinedAnalysis.performance = {
        totalTimeMs: totalAnalysisTime,
        triageTimeMs: triageResults.processingTimeMs,
        scrapingTimeMs: intelligentWebResearch.processingTimeMs,
        efficiency: this.calculateEfficiencyScore(totalAnalysisTime, triageResults, intelligentWebResearch),
        resourcesUsed: {
          sources: intelligentWebResearch.sourcesScraped,
          searchTerms: intelligentWebResearch.searchTermsUsed ? Object.values(intelligentWebResearch.searchTermsUsed).flat().length : 0,
          earlyTermination: intelligentWebResearch.intelligence?.earlyTermination || false
        }
      };
      
      // Cache the result
      this.addToCache(cacheKey, combinedAnalysis);
      
      console.log(`✅ Enhanced analysis completed in ${totalAnalysisTime}ms - Score: ${combinedAnalysis.fraudScore}, Efficiency: ${combinedAnalysis.performance.efficiency}`);
      return combinedAnalysis;
      
    } catch (error) {
      console.error('Enhanced fraud analysis error:', error);
      
      // Return enhanced fallback analysis
      return this.generateEnhancedFallbackAnalysis(companyData, error, Date.now() - analysisStart);
    }
  }

  /**
   * Enhances company data with business context (no industry categorization)
   */
  enhanceCompanyData(companyData) {
    const enhanced = { ...companyData };
    
    // Set region to Indonesia for context but don't use for scoring
    enhanced.region = enhanced.region || 'Indonesia';
    
    // Add business entity type detection
    enhanced.entityType = this.detectEntityType(enhanced.name);
    
    // Add Indonesian language detection
    enhanced.languageContext = this.analyzeLanguageContext(enhanced.description);
    
    return enhanced;
  }

  /**
   * Enhances company data with triage insights for more informed analysis
   */
  enhanceCompanyDataWithTriage(companyData, triageResults) {
    const enhanced = this.enhanceCompanyData(companyData);
    
    // Add triage intelligence
    enhanced.triageInsights = {
      initialRiskAssessment: triageResults.riskLevel,
      identifiedRiskFactors: triageResults.riskFactors,
      detectedLegitimacySignals: triageResults.legitimacySignals,
      priorityInvestigationAreas: triageResults.investigationFocus || [],
      aiTriageConfidence: triageResults.confidence
    };
    
    // Add scraping strategy context
    enhanced.scrapingContext = {
      strategyLevel: triageResults.scrapingStrategy.level,
      resourceAllocation: triageResults.resourceEstimate,
      expectedDataQuality: this.predictDataQuality(triageResults.scrapingStrategy)
    };
    
    return enhanced;
  }

  /**
   * Performs enhanced AI analysis with web research and triage context
   */
  async performEnhancedAIAnalysis(enhancedData, webResearch, triageResults) {
    try {
      // Use the original Gemini analysis but with enhanced data
      const aiResult = await this.geminiService.analyzeCompanyFraud(enhancedData);
      
      // Enhance AI result with triage and web research context
      if (aiResult.success) {
        aiResult.data.enhancedContext = {
          triageValidation: this.validateTriageWithAI(aiResult.data, triageResults),
          webResearchAlignment: this.analyzeWebResearchAlignment(aiResult.data, webResearch),
          confidenceAdjustment: this.calculateConfidenceAdjustment(aiResult.data, webResearch, triageResults)
        };
        
        // Adjust AI confidence based on web research quality
        const webDataQuality = webResearch.summary?.dataQuality || 'minimal';
        const qualityBonus = this.getDataQualityBonus(webDataQuality);
        aiResult.data.confidence = Math.min(100, aiResult.data.confidence + qualityBonus);
      }
      
      return aiResult;
      
    } catch (error) {
      console.error('Enhanced AI analysis failed:', error);
      return {
        success: false,
        error: error.message,
        fallbackScore: this.calculateEnhancedFallbackScore(enhancedData, webResearch, triageResults)
      };
    }
  }

  /**
   * Performs enhanced rule-based analysis with web research and triage context
   */
  performEnhancedRuleBasedAnalysis(enhancedData, webResearch, triageResults) {
    // Start with the original rule-based analysis
    const ruleAnalysis = this.performRuleBasedAnalysis(enhancedData);
    
    // Enhance with web research insights
    const webResearchScore = this.analyzeWebResearchRisk(webResearch);
    
    // Enhance with triage validation
    const triageValidationScore = this.validateTriageWithRules(triageResults, webResearch);
    
    // Enhanced scoring with intelligent weights
    const enhancedWeights = this.calculateIntelligentWeights(triageResults, webResearch);
    
    const enhancedAnalysis = {
      ...ruleAnalysis,
      webResearchScore: webResearchScore,
      triageValidationScore: triageValidationScore,
      enhancedBreakdown: {
        ...ruleAnalysis.breakdown,
        webResearchContribution: webResearchScore,
        triageValidation: triageValidationScore,
        intelligentWeights: enhancedWeights
      }
    };
    
    // Recalculate overall score with enhanced factors
    enhancedAnalysis.overallScore = this.calculateEnhancedRuleScore(
      ruleAnalysis,
      webResearchScore,
      triageValidationScore,
      enhancedWeights
    );
    
    enhancedAnalysis.riskLevel = this.determineRiskLevel(enhancedAnalysis.overallScore);
    enhancedAnalysis.confidence = Math.min(100, ruleAnalysis.confidence + 10); // Bonus for enhanced analysis
    
    return enhancedAnalysis;
  }

  /**
   * Combines analysis results with intelligent weighting based on data quality
   */
  combineIntelligentAnalysisResults(aiResult, ruleResult, triageResults, webResearch, companyData) {
    // Step 1: Entity Resolution and Evidence Collection
    const entityData = triageResults.er || this.entityUtils.resolveEntity(companyData.name, companyData.description);
    const evidenceAtoms = webResearch.evidence || [];
    
    // Step 2: Calculate base fraud score 
    let finalScore;
    if (aiResult.success) {
      const weights = this.calculateDynamicWeights(aiResult, ruleResult, triageResults, webResearch);
      finalScore = Math.round(
        aiResult.data.fraudScore * weights.ai + 
        ruleResult.overallScore * weights.rules +
        (triageResults.initialScore || 50) * weights.triage
      );
    } else {
      finalScore = Math.round(ruleResult.overallScore * 0.7 + (triageResults.initialScore || 50) * 0.3);
    }
    
    // Step 3: Apply Authoritative Override (IDX + OJK + no severe red flags → force ≤10)
    const authoritativeOverride = this.entityUtils.getAuthoritativeOverride(entityData, evidenceAtoms);
    if (authoritativeOverride.shouldApply) {
      finalScore = Math.min(finalScore, 10);
      console.log(`🏛️ Authoritative override applied for ${entityData.canonicalName} - Score capped at 10`);
    }
    
    // Step 4: Calculate confidence (resilient multi-component scoring system)
    const confidence = this.calculateConfidence(evidenceAtoms, entityData, aiResult, ruleResult, webResearch);
    
    // Step 5: Check impersonation risk separately
    const domains = webResearch.sources?.businessInfo?.domains || [];
    const impersonationCheck = this.entityUtils.checkImpersonationRisk(domains);
    
    // Step 6: Determine final risk level using RISK_BUCKETS
    const riskLevel = this.determineRiskLevel(finalScore);
    
    // Step 7: Build analysis object with entity data and overrides
    const analysis = {
      entity: entityData,
      evidence: evidenceAtoms,
      overrides: {
        authoritativeOverrideApplied: authoritativeOverride.shouldApply,
        impersonationRisk: impersonationCheck.risk
      },
      ai: aiResult.success ? aiResult.data.analysis : null,
      ruleBased: ruleResult.enhancedBreakdown || ruleResult.breakdown,
      triage: {
        initialAssessment: triageResults.riskLevel,
        riskFactors: triageResults.riskFactors,
        scrapingStrategy: triageResults.scrapingStrategy.level
      },
      webResearch: {
        dataQuality: webResearch.summary?.dataQuality || 'minimal',
        keyFindings: webResearch.summary?.keyFindings || [],
        sourcesUsed: webResearch.sourcesScraped || 0
      }
    };
    
    return {
      fraudScore: finalScore,
      riskLevel: riskLevel,
      confidence: confidence,
      analysis: analysis,
      companyData: companyData,
      timestamp: new Date().toISOString(),
      source: 'enhanced_intelligent_analysis',
      stageResults: {
        stage1_triage: triageResults,
        stage2_scraping: webResearch,
        stage3_analysis: { ai: aiResult, rules: ruleResult }
      }
    };
  }


  /**
   * Calculate confidence score: Resilient multi-component scoring system
   * FIXED: No longer returns 0 when evidence atoms are missing
   */
  calculateConfidence(evidenceAtoms, entityData, aiResult, ruleResult, webResearch = null) {
    let confidence = 45; // Start with meaningful base confidence instead of 0
    
    // Component 1: Evidence Collection Quality (0-25 points)
    const expectedEvidenceSources = ['OJK', 'IDX', 'news', 'businessInfo'];
    
    // Ensure evidenceAtoms is an array before using map
    const evidenceArray = Array.isArray(evidenceAtoms) ? evidenceAtoms : [];
    const sourcesFound = new Set(evidenceArray.map(atom => atom.source)).size;
    const evidenceBonus = Math.round((sourcesFound / expectedEvidenceSources.length) * 25);
    confidence += evidenceBonus;
    
    // Component 2: Web Research Quality (0-20 points) - NEW
    if (webResearch?.summary?.dataQuality) {
      const qualityBonus = {
        'comprehensive': 20,
        'good': 15, 
        'limited': 10,
        'minimal': 5,
        'unavailable': 0
      };
      confidence += qualityBonus[webResearch.summary.dataQuality] || 5;
    } else if (webResearch?.sources) {
      // Fallback: count sources that actually found data
      const activeSources = Object.values(webResearch.sources).filter(source => 
        (source.foundEntries && source.foundEntries > 0) ||
        (source.totalArticles && source.totalArticles > 0) ||
        (source.resultsFound && source.resultsFound > 0)
      );
      confidence += Math.min(15, activeSources.length * 3);
    }
    
    // Component 3: Entity Resolution Quality (0-15 points) - IMPROVED
    const erCertainty = entityData.erCertainty || 0.3;
    const erBonus = Math.round(erCertainty * 15);
    confidence += erBonus;
    
    // Component 4: AI-Rules Agreement (0-10 points)
    if (aiResult.success && ruleResult.overallScore) {
      const scoreDiff = Math.abs(aiResult.data.fraudScore - ruleResult.overallScore);
      const agreement = Math.max(0, 1 - (scoreDiff / 100));
      const agreementBonus = Math.round(agreement * 10);
      confidence += agreementBonus;
    } else {
      confidence += 5; // Default modest bonus when both systems ran
    }
    
    // Component 5: Analysis Completeness (0-5 points) - NEW
    let completenessBonus = 0;
    if (aiResult.success) completenessBonus += 2;
    if (ruleResult.overallScore > 0) completenessBonus += 2;
    if (entityData.canonicalName) completenessBonus += 1;
    confidence += completenessBonus;
    
    // Tier-0/1 Evidence Bonus (high-authority sources)
    const hasTier01Evidence = evidenceAtoms.some(atom => atom.tier <= 1);
    if (hasTier01Evidence) {
      confidence += 10; // Significant bonus for authoritative evidence
    } else {
      // Cap at 75 if no high-tier evidence (instead of 60)
      confidence = Math.min(confidence, 75);
    }
    
    // Ensure confidence stays within reasonable bounds
    return Math.min(100, Math.max(25, confidence)); // Minimum 25, Maximum 100
  }

  /**
   * Calculate confidence specifically for SerpAPI analysis
   */
  calculateSerpAPIConfidence(geminiAnalysis, serpResults) {
    let confidence = 50; // Base confidence for SerpAPI analysis
    
    // AI analysis quality contribution (0-25 points)
    if (geminiAnalysis.success && geminiAnalysis.data?.confidence) {
      const aiConfidence = geminiAnalysis.data.confidence;
      confidence += Math.round((aiConfidence - 50) * 0.5); // Scale AI confidence to max 25 points
    }
    
    // SerpAPI data quality contribution (0-30 points)
    const totalResults = serpResults.summary?.totalResults || 0;
    if (totalResults > 15) confidence += 25;
    else if (totalResults > 8) confidence += 20;
    else if (totalResults > 3) confidence += 15;
    else if (totalResults > 0) confidence += 10;
    
    // Search diversity contribution (0-15 points)
    const searchTypes = Object.keys(serpResults.searches || {}).length;
    confidence += Math.min(searchTypes * 3, 15);
    
    // Early termination indicates strong evidence (0-10 points)
    if (serpResults.summary?.earlyTermination) {
      confidence += 10;
    }
    
    // Conclusive evidence bonus (0-10 points)
    if (serpResults.summary?.conclusiveEvidence) {
      confidence += 10;
    }
    
    return Math.max(30, Math.min(100, Math.round(confidence)));
  }

  /**
   * Determine risk level using RISK_BUCKETS (replaces old determineRiskLevel)
   */
  determineRiskLevel(score) {
    for (const [level, range] of Object.entries(this.RISK_BUCKETS)) {
      if (score >= range[0] && score <= range[1]) {
        return level;
      }
    }
    return 'critical'; // fallback for scores > 100
  }


  /**
   * Detects Indonesian business entity type
   */
  detectEntityType(name) {
    const upperName = name.toUpperCase();
    
    if (upperName.includes('PT ')) return 'pt'; // Perseroan Terbatas
    if (upperName.includes('CV ')) return 'cv'; // Commanditaire Vennootschap
    if (upperName.includes('TBK')) return 'tbk'; // Publicly listed company
    if (upperName.includes('KOPERASI')) return 'koperasi';
    if (upperName.includes('YAYASAN')) return 'yayasan';
    if (upperName.includes('FIRMA')) return 'firma';
    
    return 'unknown';
  }

  /**
   * Analyzes Indonesian language context
   */
  analyzeLanguageContext(description) {
    const indonesianIndicators = [
      'dan', 'atau', 'yang', 'dengan', 'untuk', 'dari', 'pada', 'dalam',
      'adalah', 'akan', 'dapat', 'telah', 'sudah', 'kami', 'kita'
    ];
    
    const englishIndicators = [
      'and', 'or', 'the', 'with', 'for', 'from', 'in', 'on',
      'is', 'are', 'will', 'can', 'have', 'has', 'we', 'our'
    ];
    
    let indonesianScore = 0;
    let englishScore = 0;
    
    const lowerDesc = description.toLowerCase();
    
    for (const word of indonesianIndicators) {
      if (lowerDesc.includes(word)) indonesianScore++;
    }
    
    for (const word of englishIndicators) {
      if (lowerDesc.includes(word)) englishScore++;
    }
    
    if (indonesianScore > englishScore) return 'indonesian';
    if (englishScore > indonesianScore) return 'english';
    return 'mixed';
  }

  /**
   * Performs rule-based fraud analysis using Indonesian business patterns (evidence-based)
   */
  performRuleBasedAnalysis(companyData) {
    const analysis = {
      entityTypeScore: this.analyzeEntityType(companyData),
      languageScore: this.analyzeLanguageConsistency(companyData),
      ojkComplianceScore: this.analyzeOJKCompliance(companyData),
      fraudKeywordScore: this.analyzeFraudKeywords(companyData),
      legitimacySignalScore: this.analyzeLegitimacySignals(companyData)
    };
    
    // Calculate weighted overall score (evidence-based weights)
    const weights = {
      entityTypeScore: 0.15,
      languageScore: 0.10,
      ojkComplianceScore: 0.25, // Evidence-based OJK compliance
      fraudKeywordScore: 0.35, // High weight for actual fraud indicators
      legitimacySignalScore: 0.15
    };
    
    let weightedScore = 0;
    for (const [metric, score] of Object.entries(analysis)) {
      weightedScore += score * (weights[metric] || 0);
    }
    
    return {
      overallScore: Math.round(weightedScore),
      breakdown: analysis,
      riskLevel: this.determineRiskLevel(weightedScore),
      confidence: 75 // Rule-based analysis confidence
    };
  }

  /**
   * Analyzes Indonesian business entity type appropriateness
   */
  analyzeEntityType(companyData) {
    const { entityType, industry } = companyData;
    
    // PT is expected for most formal businesses
    if (entityType === 'pt') return 20; // Lower risk
    if (entityType === 'tbk') return 10; // Lowest risk (public company)
    if (entityType === 'cv' && industry !== 'fintech') return 35; // Medium risk
    if (entityType === 'unknown') return 60; // Higher risk
    
    return 40; // Default medium risk
  }

  /**
   * Analyzes language consistency for Indonesian companies
   */
  analyzeLanguageConsistency(companyData) {
    const { languageContext } = companyData;
    
    // Indonesian companies should primarily use Indonesian
    if (languageContext === 'indonesian') return 20;
    if (languageContext === 'mixed') return 35;
    if (languageContext === 'english') return 50;
    
    return 40;
  }

  /**
   * Analyzes OJK compliance based on actual business activities (evidence-based)
   */
  analyzeOJKCompliance(companyData) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Check if company claims to be in financial services based on description
    const financialKeywords = [
      'bank', 'perbankan', 'financial services', 'layanan keuangan',
      'fintech', 'digital payment', 'pembayaran digital', 'lending', 'pinjaman',
      'investment', 'investasi', 'insurance', 'asuransi', 'crowdfunding',
      'cryptocurrency', 'kripto', 'e-money', 'dompet digital', 'wallet'
    ];
    
    const isFinancialBusiness = financialKeywords.some(keyword => text.includes(keyword));
    
    if (isFinancialBusiness) {
      // Look for OJK compliance indicators
      const ojkIndicators = ['ojk', 'terdaftar ojk', 'licensed', 'regulated', 'compliance', 'authorized'];
      const hasOJKMention = ojkIndicators.some(indicator => text.includes(indicator));
      
      return hasOJKMention ? 15 : 65; // Higher risk if financial business without OJK mention
    }
    
    return 10; // Low risk for non-financial businesses
  }

  /**
   * Analyzes Indonesian fraud keywords
   */
  analyzeFraudKeywords(companyData) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    const fraudKeywords = [
      'investasi bodong', 'skema ponzi', 'money game', 'penipuan', 'scam',
      'guaranteed profit', 'tanpa risiko', 'passive income', 'get rich quick',
      'binary option', 'robot trading', 'forex scam', 'cryptocurrency scam',
      'mlm', 'multi level marketing', 'piramida', 'network marketing'
    ];
    
    let fraudScore = 0;
    const detectedKeywords = [];
    
    for (const keyword of fraudKeywords) {
      if (text.includes(keyword)) {
        fraudScore += 20;
        detectedKeywords.push(keyword);
      }
    }
    
    return Math.min(fraudScore, 100);
  }

  /**
   * Analyzes legitimacy signals in Indonesian context
   */
  analyzeLegitimacySignals(companyData) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    const legitimacyKeywords = [
      'resmi', 'terdaftar', 'licensed', 'certified', 'iso',
      'audit', 'compliance', 'npwp', 'nib', 'siup',
      'kementerian', 'ministry', 'government', 'bank indonesia'
    ];
    
    let legitimacyScore = 50; // Start with neutral
    
    for (const keyword of legitimacyKeywords) {
      if (text.includes(keyword)) {
        legitimacyScore -= 8; // Lower risk
      }
    }
    
    return Math.max(legitimacyScore, 0);
  }

  /**
   * Combines AI and rule-based analysis results
   */
  combineAnalysisResults(aiResult, ruleResult, companyData) {
    let finalScore;
    let confidence;
    let analysis;
    
    if (aiResult.success) {
      // Weight AI analysis (60%) and rule-based (40%)
      finalScore = Math.round(aiResult.data.fraudScore * 0.6 + ruleResult.overallScore * 0.4);
      confidence = Math.round((aiResult.data.confidence + ruleResult.confidence) / 2);
      analysis = {
        ai: aiResult.data.analysis,
        ruleBased: ruleResult.breakdown,
        combined: true
      };
    } else {
      // Use rule-based analysis only
      finalScore = ruleResult.overallScore;
      confidence = ruleResult.confidence;
      analysis = {
        ruleBased: ruleResult.breakdown,
        aiError: aiResult.error,
        combined: false
      };
    }
    
    return {
      fraudScore: finalScore,
      riskLevel: this.determineRiskLevel(finalScore),
      confidence: confidence,
      analysis: analysis,
      companyData: companyData,
      timestamp: new Date().toISOString(),
      source: 'combined_analysis'
    };
  }

  /**
   * Determines risk level from fraud score
   */
  determineRiskLevel(score) {
    if (score <= 20) return 'low';
    if (score <= 40) return 'medium';
    if (score <= 70) return 'high';
    return 'critical';
  }

  /**
   * Generates fallback analysis when main analysis fails
   */
  generateFallbackAnalysis(companyData, error) {
    const enhancedData = this.enhanceCompanyData(companyData);
    const fallbackScore = this.performBasicFraudCheck(enhancedData);
    
    return {
      fraudScore: fallbackScore,
      riskLevel: this.determineRiskLevel(fallbackScore),
      confidence: 30,
      analysis: {
        fallback: true,
        error: error.message
      },
      timestamp: new Date().toISOString(),
      source: 'fallback_analysis'
    };
  }

  /**
   * Performs basic fraud check for fallback scenarios
   */
  performBasicFraudCheck(companyData) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    let riskScore = 40; // Start with medium risk
    
    // Check for obvious fraud indicators
    const highRiskKeywords = ['ponzi', 'guaranteed profit', 'risk-free', 'get rich quick'];
    for (const keyword of highRiskKeywords) {
      if (text.includes(keyword)) riskScore += 30;
    }
    
    // Check for legitimacy indicators
    const legitimacyKeywords = ['registered', 'licensed', 'certified', 'compliance'];
    for (const keyword of legitimacyKeywords) {
      if (text.includes(keyword)) riskScore -= 15;
    }
    
    return Math.max(0, Math.min(100, riskScore));
  }

  /**
   * Cache management functions
   */
  generateCacheKey(companyData) {
    const { name, description } = companyData;
    return Buffer.from(`${name}:${description}`).toString('base64');
  }

  getFromCache(key) {
    const cached = this.analysisCache.get(key);
    if (!cached) return null;
    
    const now = new Date();
    const expiry = new Date(cached.timestamp);
    expiry.setHours(expiry.getHours() + this.config.cacheExpiryHours);
    
    if (now > expiry) {
      this.analysisCache.delete(key);
      return null;
    }
    
    return cached;
  }

  addToCache(key, analysis) {
    this.analysisCache.set(key, analysis);
  }

  /**
   * Helper methods for enhanced analysis
   */

  predictDataQuality(scrapingStrategy) {
    const qualityMap = {
      light: 'limited',
      medium: 'good', 
      deep: 'comprehensive'
    };
    return qualityMap[scrapingStrategy.level] || 'minimal';
  }

  validateTriageWithAI(aiData, triageResults) {
    const aiRisk = aiData.riskLevel;
    const triageRisk = triageResults.riskLevel;
    
    // Check for alignment between triage and AI assessment
    const riskLevelMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const aiRiskNum = riskLevelMap[aiRisk] || 2;
    const triageRiskNum = riskLevelMap[triageRisk] || 2;
    
    const alignment = Math.abs(aiRiskNum - triageRiskNum);
    
    return {
      aligned: alignment <= 1,
      difference: alignment,
      explanation: alignment <= 1 ? 'AI analysis confirms triage assessment' : 'AI analysis differs from initial triage'
    };
  }

  analyzeWebResearchAlignment(aiData, webResearch) {
    const webRisk = webResearch.summary?.overallRisk || 'medium';
    const aiRisk = aiData.riskLevel;
    
    const alignment = webRisk === aiRisk;
    
    return {
      aligned: alignment,
      webRisk: webRisk,
      aiRisk: aiRisk,
      explanation: alignment ? 'Web research confirms AI assessment' : 'Web research suggests different risk level'
    };
  }

  calculateConfidenceAdjustment(aiData, webResearch, triageResults) {
    let adjustment = 0;
    
    // High-quality web research increases confidence
    const dataQuality = webResearch.summary?.dataQuality;
    if (dataQuality === 'comprehensive') adjustment += 15;
    else if (dataQuality === 'good') adjustment += 10;
    else if (dataQuality === 'limited') adjustment += 5;
    
    // Triage-AI alignment increases confidence
    const triageValidation = this.validateTriageWithAI(aiData, triageResults);
    if (triageValidation.aligned) adjustment += 10;
    
    // Conclusive evidence increases confidence
    if (webResearch.conclusiveEvidence?.triggered) adjustment += 20;
    
    return Math.min(25, adjustment); // Cap at 25% increase
  }

  getDataQualityBonus(dataQuality) {
    const bonuses = {
      comprehensive: 15,
      good: 10,
      limited: 5,
      minimal: 0,
      unavailable: -5
    };
    return bonuses[dataQuality] || 0;
  }

  analyzeWebResearchRisk(webResearch) {
    let riskScore = 30; // Neutral baseline
    
    // OJK findings
    if (webResearch.sources?.ojk?.registrationStatus === 'warning_issued') {
      riskScore += 30;
    } else if (webResearch.sources?.ojk?.registrationStatus === 'registered') {
      riskScore -= 15;
    }
    
    // News sentiment
    if (webResearch.sources?.news?.sentiment === 'negative') {
      riskScore += 20;
    } else if (webResearch.sources?.news?.sentiment === 'positive') {
      riskScore -= 10;
    }
    
    // Fraud reports
    const fraudReports = webResearch.sources?.fraudReports?.fraudReportsFound || 0;
    riskScore += fraudReports * 15;
    
    // Legitimacy signals
    const legitimacySignals = webResearch.sources?.businessInfo?.legitimacySignals?.length || 0;
    riskScore -= legitimacySignals * 5;
    
    return Math.max(0, Math.min(100, riskScore));
  }

  validateTriageWithRules(triageResults, webResearch) {
    // Compare triage predictions with actual web research findings
    let validationScore = 50; // Neutral
    
    const predictedRisk = triageResults.riskLevel;
    const actualFindings = webResearch.summary?.overallRisk;
    
    // Reward accurate predictions
    if (predictedRisk === actualFindings) {
      validationScore = 20; // Lower risk score for accurate prediction
    } else {
      const riskLevelMap = { low: 1, medium: 2, high: 3, critical: 4 };
      const difference = Math.abs(
        (riskLevelMap[predictedRisk] || 2) - (riskLevelMap[actualFindings] || 2)
      );
      validationScore = 30 + (difference * 10); // Higher risk for inaccurate predictions
    }
    
    return validationScore;
  }

  calculateIntelligentWeights(triageResults, webResearch) {
    const weights = {
      entityType: 0.15,
      language: 0.08,
      industry: 0.20,
      ojkCompliance: 0.25,
      fraudKeywords: 0.17,
      legitimacy: 0.05,
      webResearch: 0.10 // New weight for web research
    };
    
    // Adjust weights based on data quality
    const dataQuality = webResearch.summary?.dataQuality;
    if (dataQuality === 'comprehensive') {
      weights.webResearch = 0.20;
      weights.ojkCompliance = 0.20;
    } else if (dataQuality === 'good') {
      weights.webResearch = 0.15;
    }
    
    return weights;
  }

  calculateEnhancedRuleScore(ruleAnalysis, webResearchScore, triageValidationScore, weights) {
    let score = 0;
    
    // Original rule-based components
    for (const [component, componentScore] of Object.entries(ruleAnalysis.breakdown)) {
      const weight = weights[component.replace('Score', '')] || 0;
      score += componentScore * weight;
    }
    
    // Add web research contribution
    score += webResearchScore * weights.webResearch;
    
    // Adjust based on triage validation (lower is better for validation)
    if (triageValidationScore < 30) {
      score *= 0.9; // Reduce risk if triage was accurate
    } else if (triageValidationScore > 60) {
      score *= 1.1; // Increase risk if triage was inaccurate
    }
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  calculateDynamicWeights(aiResult, ruleResult, triageResults, webResearch) {
    let weights = { ai: 0.5, rules: 0.4, triage: 0.1 };
    
    // Adjust based on AI availability and confidence
    if (!aiResult.success) {
      weights = { ai: 0.0, rules: 0.8, triage: 0.2 };
    } else if (aiResult.data.confidence > 85) {
      weights = { ai: 0.6, rules: 0.3, triage: 0.1 };
    }
    
    // Adjust based on web research quality
    const dataQuality = webResearch.summary?.dataQuality;
    if (dataQuality === 'comprehensive') {
      weights.rules *= 1.2; // Give more weight to rule-based analysis with good data
      // Normalize
      const total = weights.ai + weights.rules + weights.triage;
      weights.ai /= total;
      weights.rules /= total;
      weights.triage /= total;
    }
    
    // Adjust based on conclusive evidence
    if (webResearch.conclusiveEvidence?.triggered) {
      weights.triage *= 1.5; // Give more weight to initial triage if conclusive evidence found
      // Normalize
      const total = weights.ai + weights.rules + weights.triage;
      weights.ai /= total;
      weights.rules /= total;
      weights.triage /= total;
    }
    
    return weights;
  }

  determineIntelligentRiskLevel(score, triageResults, conclusiveEvidence) {
    // Start with standard risk level determination
    let riskLevel = this.determineRiskLevel(score);
    
    // Override based on conclusive evidence
    if (conclusiveEvidence?.triggered && conclusiveEvidence.confidence > 85) {
      if (conclusiveEvidence.reason === 'regulatory_warning' || 
          conclusiveEvidence.reason === 'multiple_fraud_reports') {
        riskLevel = 'critical';
      } else if (conclusiveEvidence.reason === 'strong_legitimacy') {
        riskLevel = 'low';
      }
    }
    
    // Validate against triage assessment
    const triageRisk = triageResults.riskLevel;
    const riskLevelMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const currentRiskNum = riskLevelMap[riskLevel];
    const triageRiskNum = riskLevelMap[triageRisk];
    
    // Don't allow final assessment to differ by more than 2 levels from triage unless conclusive evidence
    if (!conclusiveEvidence?.triggered && Math.abs(currentRiskNum - triageRiskNum) > 2) {
      // Move towards triage assessment
      const reverseMap = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
      const adjustedLevel = Math.max(1, Math.min(4, 
        Math.round((currentRiskNum + triageRiskNum) / 2)
      ));
      riskLevel = reverseMap[adjustedLevel];
    }
    
    return riskLevel;
  }

  calculateEfficiencyScore(totalTime, triageResults, webResearch) {
    let efficiency = 100;
    
    // Time efficiency
    if (totalTime > 60000) efficiency -= 30; // Over 1 minute
    else if (totalTime > 45000) efficiency -= 20; // Over 45 seconds
    else if (totalTime > 30000) efficiency -= 10; // Over 30 seconds
    
    // Early termination bonus
    if (webResearch.intelligence?.earlyTermination) {
      efficiency += 20;
    }
    
    // Data quality vs time efficiency
    const dataQuality = webResearch.summary?.dataQuality;
    if (dataQuality === 'comprehensive' && totalTime < 30000) {
      efficiency += 15; // Great data quality in short time
    } else if (dataQuality === 'minimal' && totalTime > 45000) {
      efficiency -= 20; // Poor data quality despite long time
    }
    
    return Math.max(0, Math.min(100, efficiency));
  }

  calculateEnhancedFallbackScore(enhancedData, webResearch, triageResults) {
    // Start with basic fallback
    const basicFallback = this.calculateFallbackScore(enhancedData);
    
    // Enhance with available data
    let enhancedScore = basicFallback.fraudScore;
    
    // Use triage score if available
    if (triageResults?.initialScore) {
      enhancedScore = Math.round((enhancedScore + triageResults.initialScore) / 2);
    }
    
    // Use web research if available
    if (webResearch?.summary?.overallRisk) {
      const webRiskScore = { low: 20, medium: 50, high: 75, critical: 90 };
      const webScore = webRiskScore[webResearch.summary.overallRisk] || 50;
      enhancedScore = Math.round((enhancedScore + webScore) / 2);
    }
    
    return {
      ...basicFallback,
      fraudScore: enhancedScore,
      enhancedFallback: true
    };
  }

  generateEnhancedFallbackAnalysis(companyData, error, processingTime) {
    const enhancedData = this.enhanceCompanyData(companyData);
    const fallbackScore = this.performBasicFraudCheck(enhancedData);
    
    return {
      fraudScore: fallbackScore,
      riskLevel: this.determineRiskLevel(fallbackScore),
      confidence: 20,
      analysis: {
        fallback: true,
        error: error.message,
        basicCheck: true
      },
      performance: {
        totalTimeMs: processingTime,
        efficiency: 10, // Low efficiency due to failure
        resourcesUsed: {
          sources: 0,
          searchTerms: 0,
          earlyTermination: false
        }
      },
      timestamp: new Date().toISOString(),
      source: 'enhanced_fallback_analysis'
    };
  }

  /**
   * Test the enhanced analyzer with sample Indonesian companies
   */
  async testEnhancedAnalyzer() {
    const testCompanies = [
      {
        name: 'PT Bank Digital Indonesia',
        description: 'Bank digital terdaftar OJK dengan layanan mobile banking dan digital payment'
      },
      {
        name: 'Investasi Ponzi Guaranteed',
        description: 'Investasi dengan keuntungan guaranteed 50% per bulan tanpa risiko money game'
      },
      {
        name: 'PT Aqua Golden Mississippi',
        description: 'Produsen air minum dalam kemasan merek AQUA terbesar Indonesia'
      }
    ];
    
    console.log('🧪 Testing Enhanced Fraud Analyzer with Stage 1 & 2...');
    const results = [];
    
    for (const company of testCompanies) {
      console.log(`\n--- Testing: ${company.name} ---`);
      const startTime = Date.now();
      
      try {
        const result = await this.analyzeCompany(company);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Analysis completed in ${duration}ms`);
        console.log(`📊 Score: ${result.fraudScore}, Risk: ${result.riskLevel}, Efficiency: ${result.performance?.efficiency || 'N/A'}`);
        
        results.push({
          company: company.name,
          duration: duration,
          result: result
        });
      } catch (error) {
        console.error(`❌ Analysis failed for ${company.name}:`, error.message);
        results.push({
          company: company.name,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Test legacy analyzer (without Stage 1 & 2) for comparison
   */
  async testLegacyAnalyzer() {
    const testCompanies = [
      {
        name: 'PT Bank Digital Indonesia',
        description: 'Bank digital terdaftar OJK dengan layanan mobile banking dan digital payment'
      },
      {
        name: 'Investasi Ponzi Guaranteed',
        description: 'Investasi dengan keuntungan guaranteed 50% per bulan tanpa risiko money game'
      }
    ];
    
    const results = [];
    for (const company of testCompanies) {
      const startTime = Date.now();
      
      // Use original analysis methods directly (bypass enhanced flow)
      const enhancedData = this.enhanceCompanyData(company);
      const aiAnalysis = await this.geminiService.analyzeCompanyFraud(enhancedData);
      const ruleBasedAnalysis = this.performRuleBasedAnalysis(enhancedData);
      const combinedAnalysis = this.combineAnalysisResults(aiAnalysis, ruleBasedAnalysis, enhancedData);
      
      const duration = Date.now() - startTime;
      
      results.push({
        company: company.name,
        duration: duration,
        result: combinedAnalysis
      });
    }
    
    return results;
  }

  /**
   * Cleanup enhanced services
   */
  async cleanup() {
    if (this.geminiService && typeof this.geminiService.cleanup === 'function') {
      await this.geminiService.cleanup();
    }
    
    if (this.triageService && typeof this.triageService.cleanup === 'function') {
      await this.triageService.cleanup();
    }
    
    if (this.contextAwareScraper && typeof this.contextAwareScraper.cleanup === 'function') {
      await this.contextAwareScraper.cleanup();
    }
    
    this.analysisCache.clear();
  }
}

export default FraudAnalyzer;