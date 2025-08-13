import GeminiService from './gemini.js';

/**
 * Indonesian Fraud Analysis Service
 * Combines AI analysis with rule-based fraud detection
 * Specialized for Indonesian business environment and regulations
 */
class FraudAnalyzer {
  constructor() {
    this.geminiService = new GeminiService();
    
    // Indonesian-specific configuration
    this.config = {
      // Regional trust factors
      regionMultipliers: {
        'jakarta': 1.1,
        'surabaya': 1.05,
        'bandung': 1.0,
        'yogyakarta': 1.0,
        'semarang': 0.95,
        'makassar': 0.9,
        'palembang': 0.9,
        'medan': 0.85,
        'default': 0.8
      },
      
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
   * Main fraud analysis function
   * Combines AI analysis with rule-based checks
   */
  async analyzeCompany(companyData) {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(companyData);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          source: 'cache',
          timestamp: new Date().toISOString()
        };
      }

      // Prepare enhanced company data
      const enhancedData = this.enhanceCompanyData(companyData);
      
      // Run AI analysis
      const aiAnalysis = await this.geminiService.analyzeCompanyFraud(enhancedData);
      
      // Run rule-based analysis
      const ruleBasedAnalysis = this.performRuleBasedAnalysis(enhancedData);
      
      // Combine AI and rule-based results
      const combinedAnalysis = this.combineAnalysisResults(aiAnalysis, ruleBasedAnalysis, enhancedData);
      
      // Cache the result
      this.addToCache(cacheKey, combinedAnalysis);
      
      return combinedAnalysis;
      
    } catch (error) {
      console.error('Fraud analysis error:', error);
      
      // Return fallback analysis
      return this.generateFallbackAnalysis(companyData, error);
    }
  }

  /**
   * Enhances company data with Indonesian business context
   */
  enhanceCompanyData(companyData) {
    const enhanced = { ...companyData };
    
    // Detect industry from name/description
    enhanced.industry = enhanced.industry || this.detectIndustry(enhanced.name, enhanced.description);
    
    // Normalize region
    enhanced.region = this.normalizeRegion(enhanced.region);
    
    // Add business entity type detection
    enhanced.entityType = this.detectEntityType(enhanced.name);
    
    // Add Indonesian language detection
    enhanced.languageContext = this.analyzeLanguageContext(enhanced.description);
    
    return enhanced;
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
   * Normalizes Indonesian region names
   */
  normalizeRegion(region) {
    if (!region) return 'default';
    
    const normalized = region.toLowerCase().trim();
    
    // Map common variations
    const regionMappings = {
      'dki jakarta': 'jakarta',
      'jakarta raya': 'jakarta',
      'jawa timur': 'surabaya',
      'jawa barat': 'bandung',
      'di yogyakarta': 'yogyakarta',
      'jawa tengah': 'semarang',
      'sulawesi selatan': 'makassar',
      'sumatera selatan': 'palembang',
      'sumatera utara': 'medan'
    };
    
    return regionMappings[normalized] || normalized;
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
      regionalScore: this.analyzeRegionalFactors(companyData),
      ojkComplianceScore: this.analyzeOJKCompliance(companyData),
      fraudKeywordScore: this.analyzeFraudKeywords(companyData),
      legitimacySignalScore: this.analyzeLegitimacySignals(companyData)
    };
    
    // Calculate weighted overall score
    const weights = {
      entityTypeScore: 0.15,
      languageScore: 0.10,
      industryRiskScore: 0.20,
      regionalScore: 0.10,
      ojkComplianceScore: 0.25,
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
    const { languageContext, region } = companyData;
    
    // Indonesian companies should primarily use Indonesian
    if (languageContext === 'indonesian') return 20;
    if (languageContext === 'mixed') return 35;
    if (languageContext === 'english' && region !== 'jakarta') return 55;
    
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
   * Analyzes regional trust factors
   */
  analyzeRegionalFactors(companyData) {
    const { region } = companyData;
    const multiplier = this.config.regionMultipliers[region] || this.config.regionMultipliers.default;
    
    // Convert multiplier to risk score (lower multiplier = higher risk)
    return Math.round((2.0 - multiplier) * 40);
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
    
    return 30; // Medium risk for non-regulated industries
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
   * Test the analyzer with sample Indonesian companies
   */
  async testAnalyzer() {
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
      const result = await this.analyzeCompany(company);
      results.push(result);
    }
    
    return results;
  }
}

export default FraudAnalyzer;