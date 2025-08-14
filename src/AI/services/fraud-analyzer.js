import GeminiService from './gemini.js';
import IntelligentRiskTriageService from './intelligent-triage.js';
import ContextAwareWebScraper from './context-aware-scraper.js';

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
    
    // Indonesian-specific configuration
    this.config = {
      // Industry risk profiles for Indonesian market
      industryRiskProfiles: {
        'fintech': { baseRisk: 40, digitalExpectation: 'high' },
        'banking': { baseRisk: 20, digitalExpectation: 'high' },
        'ecommerce': { baseRisk: 35, digitalExpectation: 'high' },
        'cryptocurrency': { baseRisk: 70, digitalExpectation: 'high' },
        'investment': { baseRisk: 60, digitalExpectation: 'medium' },
        'manufacturing': { baseRisk: 25, digitalExpectation: 'low' },
        'agriculture': { baseRisk: 20, digitalExpectation: 'low' },
        'retail': { baseRisk: 30, digitalExpectation: 'medium' },
        'consulting': { baseRisk: 35, digitalExpectation: 'medium' },
        'technology': { baseRisk: 30, digitalExpectation: 'high' },
        'education': { baseRisk: 20, digitalExpectation: 'medium' },
        'healthcare': { baseRisk: 25, digitalExpectation: 'medium' },
        'default': { baseRisk: 40, digitalExpectation: 'medium' }
      },
      
      // OJK compliance requirements
      ojkRequiredIndustries: [
        'fintech', 'banking', 'insurance', 'investment', 'payment',
        'lending', 'crowdfunding', 'cryptocurrency', 'digital wallet'
      ],
      
      // Cache settings
      cacheExpiryHours: 24,
      maxRetries: 3,
      timeoutMs: 30000
    };
    
    // Analysis cache
    this.analysisCache = new Map();
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
   * Enhances company data with Indonesian business context
   */
  enhanceCompanyData(companyData) {
    const enhanced = { ...companyData };
    
    // Detect industry from name/description
    enhanced.industry = enhanced.industry || this.detectIndustry(enhanced.name, enhanced.description);
    
    // Keep region for reference but don't use for scoring
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
    let finalScore;
    let confidence;
    let analysis;
    let riskLevel;
    
    // Intelligent weight calculation based on data availability and quality
    const weights = this.calculateDynamicWeights(aiResult, ruleResult, triageResults, webResearch);
    
    if (aiResult.success) {
      // Enhanced combination with dynamic weights
      finalScore = Math.round(
        aiResult.data.fraudScore * weights.ai + 
        ruleResult.overallScore * weights.rules +
        (triageResults.initialScore || 50) * weights.triage
      );
      
      confidence = Math.round(
        (aiResult.data.confidence * weights.ai + 
         ruleResult.confidence * weights.rules +
         (triageResults.confidence || 50) * weights.triage) / 1.0
      );
      
      analysis = {
        ai: aiResult.data.analysis,
        ruleBased: ruleResult.enhancedBreakdown || ruleResult.breakdown,
        triage: {
          initialAssessment: triageResults.riskLevel,
          riskFactors: triageResults.riskFactors,
          scrapingStrategy: triageResults.scrapingStrategy.level
        },
        webResearch: {
          dataQuality: webResearch.summary?.dataQuality || 'minimal',
          keyFindings: webResearch.summary?.keyFindings || [],
          sourcesUsed: webResearch.sourcesScraped || 0,
          intelligenceInsights: webResearch.summary?.intelligenceInsights || []
        },
        combined: true,
        enhancedWeights: weights
      };
    } else {
      // Use enhanced rule-based with triage fallback
      finalScore = Math.round(
        ruleResult.overallScore * 0.7 + 
        (triageResults.initialScore || 50) * 0.3
      );
      
      confidence = Math.round((ruleResult.confidence + triageResults.confidence) / 2);
      
      analysis = {
        ruleBased: ruleResult.enhancedBreakdown || ruleResult.breakdown,
        triage: {
          initialAssessment: triageResults.riskLevel,
          riskFactors: triageResults.riskFactors
        },
        webResearch: {
          dataQuality: webResearch.summary?.dataQuality || 'minimal',
          keyFindings: webResearch.summary?.keyFindings || []
        },
        aiError: aiResult.error,
        combined: false
      };
    }
    
    // Final risk level determination with intelligence override
    riskLevel = this.determineIntelligentRiskLevel(
      finalScore, 
      triageResults, 
      webResearch.conclusiveEvidence
    );
    
    return {
      fraudScore: finalScore,
      riskLevel: riskLevel,
      confidence: Math.min(100, confidence),
      analysis: analysis,
      companyData: companyData,
      triageResults: triageResults,
      webResearchSummary: webResearch.summary,
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
   * Detects industry from company name and description
   */
  detectIndustry(name, description) {
    const text = `${name} ${description}`.toLowerCase();
    
    const industryKeywords = {
      fintech: ['fintech', 'financial technology', 'digital payment', 'mobile banking', 'peer-to-peer', 'p2p'],
      banking: ['bank', 'perbankan', 'tabungan', 'kredit', 'deposito'],
      cryptocurrency: ['crypto', 'bitcoin', 'blockchain', 'digital currency', 'token'],
      investment: ['investasi', 'investment', 'mutual fund', 'reksa dana', 'portfolio'],
      ecommerce: ['e-commerce', 'online shop', 'marketplace', 'toko online'],
      manufacturing: ['manufaktur', 'pabrik', 'produksi', 'manufacturing'],
      agriculture: ['pertanian', 'agriculture', 'perkebunan', 'peternakan'],
      technology: ['teknologi', 'software', 'aplikasi', 'sistem informasi'],
      consulting: ['konsultan', 'consulting', 'advisory', 'management'],
      education: ['pendidikan', 'education', 'sekolah', 'universitas', 'training']
    };
    
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return industry;
        }
      }
    }
    
    return 'default';
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
   * Performs rule-based fraud analysis using Indonesian business patterns
   */
  performRuleBasedAnalysis(companyData) {
    const analysis = {
      entityTypeScore: this.analyzeEntityType(companyData),
      languageScore: this.analyzeLanguageConsistency(companyData),
      industryRiskScore: this.analyzeIndustryRisk(companyData),
      ojkComplianceScore: this.analyzeOJKCompliance(companyData),
      fraudKeywordScore: this.analyzeFraudKeywords(companyData),
      legitimacySignalScore: this.analyzeLegitimacySignals(companyData)
    };
    
    // Calculate weighted overall score (redistributed regional weight)
    const weights = {
      entityTypeScore: 0.15,
      languageScore: 0.10,
      industryRiskScore: 0.25,
      ojkComplianceScore: 0.30,
      fraudKeywordScore: 0.15,
      legitimacySignalScore: 0.05
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
   * Analyzes industry-specific risk factors
   */
  analyzeIndustryRisk(companyData) {
    const { industry } = companyData;
    const profile = this.config.industryRiskProfiles[industry] || this.config.industryRiskProfiles.default;
    return profile.baseRisk;
  }


  /**
   * Analyzes OJK compliance requirements
   */
  analyzeOJKCompliance(companyData) {
    const { industry, description } = companyData;
    const lowerDesc = description.toLowerCase();
    
    // Check if industry requires OJK compliance
    const requiresOJK = this.config.ojkRequiredIndustries.includes(industry);
    
    if (requiresOJK) {
      // Look for OJK compliance indicators
      const ojkIndicators = ['ojk', 'terdaftar ojk', 'licensed', 'regulated', 'compliance'];
      const hasOJKMention = ojkIndicators.some(indicator => lowerDesc.includes(indicator));
      
      return hasOJKMention ? 15 : 75; // High risk if no OJK mention for regulated industry
    }
    
    return 10; // Low risk for non-regulated industries - they don't need OJK compliance
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
        description: 'Bank digital terdaftar OJK dengan layanan mobile banking dan digital payment',
        industry: 'banking'
      },
      {
        name: 'Investasi Ponzi Guaranteed',
        description: 'Investasi dengan keuntungan guaranteed 50% per bulan tanpa risiko',
        industry: 'investment'
      },
      {
        name: 'PT Aqua Golden Mississippi',
        description: 'Produsen air minum dalam kemasan merek AQUA terbesar Indonesia',
        industry: 'manufacturing'
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
        description: 'Investasi dengan keuntungan guaranteed 50% per bulan tanpa risiko'
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