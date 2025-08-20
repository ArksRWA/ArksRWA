import { GoogleGenerativeAI } from '@google/generative-ai';
import WebScrapingService from './web-scraper.js';
import { serpAPIService } from './serpapi-service.js';

/**
 * Data validation utility for Indonesian fraud detection
 */
class DataValidator {
  static validateWebResearchData(data) {
    if (!data || typeof data !== 'object') {
      return { 
        isValid: false, 
        issues: ['Invalid or missing web research data structure'] 
      };
    }

    const issues = [];
    const validatedData = { ...data };

    // Validate OJK data structure
    if (data.sources?.ojk) {
      const ojkValidation = this.validateOJKData(data.sources.ojk);
      if (!ojkValidation.isValid) {
        issues.push(...ojkValidation.issues);
      } else {
        validatedData.sources.ojk = ojkValidation.cleanedData;
      }
    }

    // Validate news data
    if (data.sources?.news) {
      const newsValidation = this.validateNewsData(data.sources.news);
      if (!newsValidation.isValid) {
        issues.push(...newsValidation.issues);
      } else {
        validatedData.sources.news = newsValidation.cleanedData;
      }
    }

    // Validate business info
    if (data.sources?.businessInfo) {
      const businessValidation = this.validateBusinessInfo(data.sources.businessInfo);
      if (!businessValidation.isValid) {
        issues.push(...businessValidation.issues);
      } else {
        validatedData.sources.businessInfo = businessValidation.cleanedData;
      }
    }

    // Validate fraud reports
    if (data.sources?.fraudReports) {
      const fraudValidation = this.validateFraudReports(data.sources.fraudReports);
      if (!fraudValidation.isValid) {
        issues.push(...fraudValidation.issues);
      } else {
        validatedData.sources.fraudReports = fraudValidation.cleanedData;
      }
    }

    // Validate summary
    if (data.summary) {
      const summaryValidation = this.validateSummary(data.summary);
      if (!summaryValidation.isValid) {
        issues.push(...summaryValidation.issues);
      } else {
        validatedData.summary = summaryValidation.cleanedData;
      }
    }

    // Validate evidence atoms if present
    if (data.evidence && Array.isArray(data.evidence)) {
      const evidenceValidation = this.validateEvidenceAtoms(data.evidence, data.sourcesScraped || 0);
      if (!evidenceValidation.isValid) {
        issues.push(...evidenceValidation.issues);
      } else {
        validatedData.evidence = evidenceValidation.cleanedData;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData: validatedData
    };
  }

  /**
   * Validate evidence atoms array and enforce atoms when sourcesUsed > 0
   */
  static validateEvidenceAtoms(evidenceAtoms, sourcesUsed = 0) {
    const issues = [];
    const cleanedData = [];

    // Enforce: if sourcesUsed > 0, must have at least one evidence atom
    if (sourcesUsed > 0 && evidenceAtoms.length === 0) {
      issues.push('Sources were used but no evidence atoms found');
      return { isValid: false, issues, cleanedData: [] };
    }

    for (const [index, atom] of evidenceAtoms.entries()) {
      if (!atom || typeof atom !== 'object') {
        issues.push(`Evidence atom ${index} is not a valid object`);
        continue;
      }

      const cleanedAtom = { ...atom };

      // Validate required fields
      if (typeof atom.tier !== 'number' || atom.tier < 0 || atom.tier > 3) {
        issues.push(`Evidence atom ${index}: tier must be 0-3`);
        cleanedAtom.tier = 3; // Default to lowest tier
      }

      if (!atom.source || typeof atom.source !== 'string') {
        issues.push(`Evidence atom ${index}: source is required`);
        cleanedAtom.source = 'unknown';
      }

      if (!atom.field || typeof atom.field !== 'string') {
        issues.push(`Evidence atom ${index}: field is required`);
        cleanedAtom.field = 'unknown';
      }

      if (atom.value === undefined || atom.value === null) {
        issues.push(`Evidence atom ${index}: value is required`);
        cleanedAtom.value = '';
      }

      // Validate optional fields
      if (atom.confidence !== undefined) {
        if (typeof atom.confidence !== 'number' || atom.confidence < 0 || atom.confidence > 1) {
          issues.push(`Evidence atom ${index}: confidence must be 0-1`);
          cleanedAtom.confidence = 0.5;
        }
      } else {
        cleanedAtom.confidence = 0.7; // Default confidence
      }

      if (atom.verification && !['exact', 'verified', 'partial', 'unverified'].includes(atom.verification)) {
        issues.push(`Evidence atom ${index}: invalid verification status`);
        cleanedAtom.verification = 'partial';
      }

      cleanedData.push(cleanedAtom);
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }

  static validateOJKData(ojkData) {
    const issues = [];
    const cleanedData = { ...ojkData };

    // Validate registration status
    if (ojkData.registrationStatus !== undefined) {
      if (!this.isValidRegistrationStatus(ojkData.registrationStatus)) {
        issues.push(`Invalid OJK registration status: ${ojkData.registrationStatus}`);
        cleanedData.registrationStatus = 'unknown';
      }
    } else {
      cleanedData.registrationStatus = 'unknown';
    }

    // Validate found entries
    if (ojkData.foundEntries !== undefined) {
      if (typeof ojkData.foundEntries !== 'number' || ojkData.foundEntries < 0) {
        issues.push(`Invalid OJK found entries count: ${ojkData.foundEntries}`);
        cleanedData.foundEntries = 0;
      }
    } else {
      cleanedData.foundEntries = 0;
    }

    // Validate details array
    if (ojkData.details) {
      if (!Array.isArray(ojkData.details)) {
        issues.push('OJK details should be an array');
        cleanedData.details = [];
      } else {
        cleanedData.details = ojkData.details
          .filter(detail => this.isValidOJKDetail(detail))
          .slice(0, 50); // Limit to prevent abuse
      }
    } else {
      cleanedData.details = [];
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }

  static validateNewsData(newsData) {
    const issues = [];
    const cleanedData = { ...newsData };

    // Validate total articles
    if (newsData.totalArticles !== undefined) {
      if (typeof newsData.totalArticles !== 'number' || newsData.totalArticles < 0) {
        issues.push(`Invalid news total articles count: ${newsData.totalArticles}`);
        cleanedData.totalArticles = 0;
      }
    } else {
      cleanedData.totalArticles = 0;
    }

    // Validate sentiment
    if (newsData.sentiment !== undefined) {
      if (!['positive', 'negative', 'neutral', 'mixed'].includes(newsData.sentiment)) {
        issues.push(`Invalid news sentiment: ${newsData.sentiment}`);
        cleanedData.sentiment = 'neutral';
      }
    } else {
      cleanedData.sentiment = 'neutral';
    }

    // Validate fraud mentions
    if (newsData.fraudMentions !== undefined) {
      if (typeof newsData.fraudMentions !== 'number' || newsData.fraudMentions < 0) {
        issues.push(`Invalid fraud mentions count: ${newsData.fraudMentions}`);
        cleanedData.fraudMentions = 0;
      }
    } else {
      cleanedData.fraudMentions = 0;
    }

    // Validate articles array
    if (newsData.articles) {
      if (!Array.isArray(newsData.articles)) {
        issues.push('News articles should be an array');
        cleanedData.articles = [];
      } else {
        cleanedData.articles = newsData.articles
          .filter(article => this.isValidNewsArticle(article))
          .slice(0, 20); // Limit to prevent abuse
      }
    } else {
      cleanedData.articles = [];
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }

  static validateBusinessInfo(businessInfo) {
    const issues = [];
    const cleanedData = { ...businessInfo };

    // Validate business registration
    if (businessInfo.businessRegistration !== undefined) {
      if (typeof businessInfo.businessRegistration !== 'string') {
        issues.push('Business registration should be a string');
        cleanedData.businessRegistration = 'unknown';
      }
    } else {
      cleanedData.businessRegistration = 'unknown';
    }

    // Validate digital footprint
    if (businessInfo.digitalFootprint !== undefined) {
      if (typeof businessInfo.digitalFootprint !== 'string') {
        issues.push('Digital footprint should be a string');
        cleanedData.digitalFootprint = 'unknown';
      }
    } else {
      cleanedData.digitalFootprint = 'unknown';
    }

    // Validate legitimacy signals
    if (businessInfo.legitimacySignals) {
      if (!Array.isArray(businessInfo.legitimacySignals)) {
        issues.push('Legitimacy signals should be an array');
        cleanedData.legitimacySignals = [];
      } else {
        cleanedData.legitimacySignals = businessInfo.legitimacySignals
          .filter(signal => typeof signal === 'string' && signal.length > 0)
          .slice(0, 20); // Limit to prevent abuse
      }
    } else {
      cleanedData.legitimacySignals = [];
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }

  static validateFraudReports(fraudReports) {
    const issues = [];
    const cleanedData = { ...fraudReports };

    // Validate fraud reports found
    if (fraudReports.fraudReportsFound !== undefined) {
      if (typeof fraudReports.fraudReportsFound !== 'number' || fraudReports.fraudReportsFound < 0) {
        issues.push(`Invalid fraud reports count: ${fraudReports.fraudReportsFound}`);
        cleanedData.fraudReportsFound = 0;
      }
    } else {
      cleanedData.fraudReportsFound = 0;
    }

    // Validate risk level
    if (fraudReports.riskLevel !== undefined) {
      if (!['low', 'medium', 'high', 'critical', 'unknown'].includes(fraudReports.riskLevel)) {
        issues.push(`Invalid fraud risk level: ${fraudReports.riskLevel}`);
        cleanedData.riskLevel = 'unknown';
      }
    } else {
      cleanedData.riskLevel = 'unknown';
    }

    // Validate warnings array
    if (fraudReports.warnings) {
      if (!Array.isArray(fraudReports.warnings)) {
        issues.push('Fraud warnings should be an array');
        cleanedData.warnings = [];
      } else {
        cleanedData.warnings = fraudReports.warnings
          .filter(warning => this.isValidFraudWarning(warning))
          .slice(0, 30); // Limit to prevent abuse
      }
    } else {
      cleanedData.warnings = [];
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }

  static validateSummary(summary) {
    const issues = [];
    const cleanedData = { ...summary };

    // Validate overall risk
    if (summary.overallRisk !== undefined) {
      if (!['low', 'medium', 'high', 'critical', 'unknown'].includes(summary.overallRisk)) {
        issues.push(`Invalid overall risk level: ${summary.overallRisk}`);
        cleanedData.overallRisk = 'unknown';
      }
    } else {
      cleanedData.overallRisk = 'unknown';
    }

    // Validate confidence
    if (summary.confidence !== undefined) {
      if (typeof summary.confidence !== 'number' || summary.confidence < 0 || summary.confidence > 100) {
        issues.push(`Invalid confidence percentage: ${summary.confidence}`);
        cleanedData.confidence = 50;
      }
    } else {
      cleanedData.confidence = 50;
    }

    // Validate data quality
    if (summary.dataQuality !== undefined) {
      // FIXED: Accept both legacy ('high', 'medium', 'low') and new ('comprehensive', 'good', 'limited', 'minimal', 'unavailable') data quality levels
      const validLevels = ['comprehensive', 'good', 'limited', 'minimal', 'unavailable', 'high', 'medium', 'low'];
      if (!validLevels.includes(summary.dataQuality)) {
        issues.push(`Invalid data quality level: ${summary.dataQuality}`);
        cleanedData.dataQuality = 'unavailable';
      } else {
        // Convert legacy levels to new standard
        const levelMapping = {
          'high': 'comprehensive',
          'medium': 'good', 
          'low': 'limited'
        };
        cleanedData.dataQuality = levelMapping[summary.dataQuality] || summary.dataQuality;
      }
    } else {
      cleanedData.dataQuality = 'unavailable';
    }

    // Validate key findings
    if (summary.keyFindings) {
      if (!Array.isArray(summary.keyFindings)) {
        issues.push('Key findings should be an array');
        cleanedData.keyFindings = [];
      } else {
        cleanedData.keyFindings = summary.keyFindings
          .filter(finding => typeof finding === 'string' && finding.length > 0)
          .slice(0, 10); // Limit to prevent abuse
      }
    } else {
      cleanedData.keyFindings = [];
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }

  static isValidRegistrationStatus(status) {
    const validStatuses = [
      'registered', 
      'not_registered', 
      'warning_issued', 
      'suspended', 
      'revoked',
      'pending',
      'unknown'
    ];
    return validStatuses.includes(status);
  }

  static isValidOJKDetail(detail) {
    if (!detail || typeof detail !== 'object') return false;
    if (typeof detail.title !== 'string' || detail.title.length === 0) return false;
    if (detail.url && typeof detail.url !== 'string') return false;
    if (detail.date && typeof detail.date !== 'string') return false;
    return true;
  }

  static isValidNewsArticle(article) {
    if (!article || typeof article !== 'object') return false;
    if (typeof article.title !== 'string' || article.title.length === 0) return false;
    if (article.url && typeof article.url !== 'string') return false;
    if (article.publishedAt && typeof article.publishedAt !== 'string') return false;
    if (article.source && typeof article.source !== 'string') return false;
    return true;
  }

  static isValidFraudWarning(warning) {
    if (!warning || typeof warning !== 'object') return false;
    if (typeof warning.title !== 'string' || warning.title.length === 0) return false;
    if (warning.description && typeof warning.description !== 'string') return false;
    if (warning.severity && !['low', 'medium', 'high', 'critical'].includes(warning.severity)) {
      return false;
    }
    return true;
  }

  static validateCompanyData(companyData) {
    const issues = [];
    const cleanedData = { ...companyData };

    // Validate required fields
    if (!companyData.name || typeof companyData.name !== 'string') {
      issues.push('Company name is required and must be a string');
    } else {
      cleanedData.name = companyData.name.trim().substring(0, 200); // Limit length
    }

    if (!companyData.description || typeof companyData.description !== 'string') {
      issues.push('Company description is required and must be a string');
    } else {
      cleanedData.description = companyData.description.trim().substring(0, 2000); // Limit length
    }


    if (companyData.region !== undefined) {
      if (typeof companyData.region !== 'string') {
        issues.push('Region must be a string');
        cleanedData.region = 'Indonesia';
      } else {
        cleanedData.region = companyData.region.trim().substring(0, 100);
      }
    } else {
      cleanedData.region = 'Indonesia';
    }

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData
    };
  }
}

/**
 * Enhanced legitimacy signal analyzer for Indonesian companies
 * Stage 2 Implementation: Tier-based analysis with evidence atoms integration
 */
class LegitimacyAnalyzer {
  static analyzeLegitimacySignals(companyData, webResearch = null) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Enhanced legitimacy keywords with weights (trivial markers down-weighted)
    const legitimacyKeywords = [
      // Strong legitimacy indicators (weight: 15-20)
      { keyword: 'ojk', weight: 20 },
      { keyword: 'terdaftar', weight: 18 },
      { keyword: 'registered', weight: 18 },
      { keyword: 'resmi', weight: 17 },
      { keyword: 'licensed', weight: 17 },
      { keyword: 'certified', weight: 16 },
      { keyword: 'iso certified', weight: 16 },
      { keyword: 'npwp', weight: 15 },
      { keyword: 'nib', weight: 15 },
      { keyword: 'siup', weight: 15 },
      
      // Medium legitimacy indicators (weight: 10-14)
      { keyword: 'cv ', weight: 14 },
      { keyword: ' tbk', weight: 14 },
      { keyword: 'fintech', weight: 12 },
      { keyword: 'finance', weight: 12 },
      { keyword: 'financial', weight: 12 },
      { keyword: 'industri', weight: 11 },
      { keyword: 'manufaktur', weight: 11 },
      { keyword: 'perusahaan', weight: 10 },
      { keyword: 'corporation', weight: 10 },
      { keyword: 'established', weight: 10 },
      
      // Basic legitimacy indicators (weight: 5-9)
      { keyword: 'company', weight: 8 },
      { keyword: 'ltd', weight: 8 },
      { keyword: 'llc', weight: 8 },
      { keyword: 'inc', weight: 7 },
      { keyword: 'corp', weight: 7 },
      { keyword: 'official', weight: 6 },
      { keyword: 'legal', weight: 6 },
      { keyword: 'business', weight: 5 },
      
      // Trivial markers (down-weighted for Stage 2)
      { keyword: 'pt ', weight: 3 }, // Reduced from 14 to 3
      { keyword: 'bank', weight: 3 } // Reduced from 13 to 3
    ];
    
    let score = 0;
    const businessMarkers = [];
    const concerns = [];
    
    // Calculate legitimacy score
    for (const { keyword, weight } of legitimacyKeywords) {
      if (text.includes(keyword)) {
        score += weight;
        businessMarkers.push(keyword.trim());
      }
    }
    
    // Additional scoring from web research
    if (webResearch && !webResearch.fallback) {
      // Business registration verification
      if (webResearch.sources?.businessInfo?.businessRegistration === 'registered') {
        score += 15;
        businessMarkers.push('business_registration_verified');
      }
      
      // Digital footprint analysis
      if (webResearch.sources?.businessInfo?.digitalFootprint === 'strong') {
        score += 10;
        businessMarkers.push('strong_digital_presence');
      } else if (webResearch.sources?.businessInfo?.digitalFootprint === 'moderate') {
        score += 5;
        businessMarkers.push('moderate_digital_presence');
      }
      
      // Legitimacy signals from web research
      if (webResearch.sources?.businessInfo?.legitimacySignals?.length > 0) {
        const webLegitimacyCount = webResearch.sources.businessInfo.legitimacySignals.length;
        score += Math.min(webLegitimacyCount * 5, 20); // Cap at 20 points
        businessMarkers.push(...webResearch.sources.businessInfo.legitimacySignals);
      }
      
      // NEW: Tier-0/1 Evidence Atoms Up-weighting (+30 cap)
      const evidenceAtoms = webResearch.evidence || [];
      const tier01EvidenceBonus = this.calculateTier01Bonus(evidenceAtoms);
      if (tier01EvidenceBonus > 0) {
        score += tier01EvidenceBonus;
        businessMarkers.push(`tier_01_evidence_bonus_${tier01EvidenceBonus}`);
      }
    }
    
    // Apply diminishing returns to prevent score inflation
    score = Math.min(100, score);
    
    // Normalize score to 0-100 range with better distribution
    let normalizedScore;
    if (score <= 20) {
      normalizedScore = Math.min(25, score * 1.25);
    } else if (score <= 50) {
      normalizedScore = 25 + ((score - 20) * 0.83);
    } else if (score <= 80) {
      normalizedScore = 50 + ((score - 50) * 0.83);
    } else {
      normalizedScore = 75 + ((score - 80) * 0.625);
    }
    
    normalizedScore = Math.round(Math.min(100, normalizedScore));
    
    // Add concerns based on suspicious patterns
    const suspiciousKeywords = [
      'get rich quick', 'guaranteed profit', 'no risk', 'risk-free',
      'investasi bodong', 'skema ponzi', 'money game', 'penipuan'
    ];
    
    for (const keyword of suspiciousKeywords) {
      if (text.includes(keyword)) {
        concerns.push(`Suspicious keyword detected: ${keyword}`);
      }
    }
    
    return {
      score: normalizedScore,
      businessMarkers: [...new Set(businessMarkers)], // Remove duplicates
      concerns
    };
  }
  
  /**
   * Calculate bonus from Tier-0/1 evidence atoms (up to +30 cap)
   */
  static calculateTier01Bonus(evidenceAtoms) {
    if (!Array.isArray(evidenceAtoms)) return 0;
    
    let bonus = 0;
    const tier01Atoms = evidenceAtoms.filter(atom => 
      atom.tier !== undefined && atom.tier <= 1
    );
    
    for (const atom of tier01Atoms) {
      if (atom.tier === 0) {
        // Tier-0 (IDX): +15 per atom
        bonus += 15;
      } else if (atom.tier === 1) {
        // Tier-1 (OJK): +10 per atom
        bonus += 10;
      }
    }
    
    // Cap at +30 as specified
    return Math.min(30, bonus);
  }
}

/**
 * Gemini AI service for Indonesian fraud detection
 * Specialized prompts for OJK compliance and Indonesian business context
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.testMode = !this.apiKey || this.apiKey === 'test-api-key-for-development';
    
    if (!this.testMode) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } else {
      console.log('Running in test mode - using mock responses for Gemini API');
    }
    
    // Initialize web scraping service
    this.webScraper = new WebScrapingService();
    
    // Initialize data validator (using static methods, no instantiation needed)
    this.dataValidator = DataValidator;
    
    // Initialize legitimacy analyzer
    this.legitimacyAnalyzer = LegitimacyAnalyzer;
    
    // Indonesian fraud detection configuration
    this.config = {
      temperature: 0.1, // Low temperature for consistent, factual analysis
      topK: 1,
      topP: 0.1,
      maxOutputTokens: 2048,
    };
  }

  /**
   * Safe getter function for accessing nested object properties
   */
  safeGet(obj, path, fallback = null) {
    return path.split('.').reduce((o, k) => o?.[k], obj) ?? fallback;
  }

  /**
   * Creates specialized Indonesian fraud detection prompt with web research data
   * Enhanced with structured format, explicit weighting, and defensive programming
   */
  createIndonesianFraudPrompt(companyData, webResearch = null) {
    // Validate company data before creating prompt
    const validation = this.dataValidator.validateCompanyData(companyData);
    if (!validation.isValid) {
      throw new Error(`Invalid company data: ${validation.issues.join(', ')}`);
    }
    
    const { name, description, region } = validation.cleanedData;
    
    // Safe access to web research data with fallbacks
    const safeWebResearch = webResearch && !webResearch.fallback ? {
      ojk: {
        registrationStatus: this.safeGet(webResearch, 'sources.ojk.registrationStatus', 'not found'),
        foundEntries: this.safeGet(webResearch, 'sources.ojk.foundEntries', 0),
        details: this.safeGet(webResearch, 'sources.ojk.details', [])
      },
      news: {
        totalArticles: this.safeGet(webResearch, 'sources.news.totalArticles', 0),
        sentiment: this.safeGet(webResearch, 'sources.news.sentiment', 'neutral'),
        fraudMentions: this.safeGet(webResearch, 'sources.news.fraudMentions', 0),
        articles: this.safeGet(webResearch, 'sources.news.articles', [])
      },
      businessInfo: {
        businessRegistration: this.safeGet(webResearch, 'sources.businessInfo.businessRegistration', 'unknown'),
        digitalFootprint: this.safeGet(webResearch, 'sources.businessInfo.digitalFootprint', 'minimal'),
        legitimacySignals: this.safeGet(webResearch, 'sources.businessInfo.legitimacySignals', [])
      },
      fraudReports: {
        fraudReportsFound: this.safeGet(webResearch, 'sources.fraudReports.fraudReportsFound', 0),
        riskLevel: this.safeGet(webResearch, 'sources.fraudReports.riskLevel', 'unknown'),
        warnings: this.safeGet(webResearch, 'sources.fraudReports.warnings', [])
      },
      summary: {
        overallRisk: this.safeGet(webResearch, 'summary.overallRisk', 'unknown'),
        confidence: this.safeGet(webResearch, 'summary.confidence', 0),
        keyFindings: this.safeGet(webResearch, 'summary.keyFindings', []),
        dataQuality: this.safeGet(webResearch, 'summary.dataQuality', 'unavailable')
      }
    } : null;

    // === CONTEXT SECTION ===
    let prompt = `
INDONESIAN FRAUD DETECTION ANALYSIS

**COMPANY INFORMATION:**
- Name: ${name}
- Description: ${description}
- Region: ${region || 'Indonesia'}

**INDONESIAN REGULATORY CONTEXT:**
• Financial services companies require OJK (Otoritas Jasa Keuangan) registration
• Non-financial companies (retail, manufacturing, agriculture) are NOT expected to have OJK registration
• Traditional businesses may have minimal digital presence without being fraudulent
• Focus on actual evidence rather than assumptions about business type

**LEGITIMATE INDONESIAN BANKS (Score 0-15 unless fraud evidence found):**
• PT Bank Mandiri (Persero) Tbk - State bank, OJK & BI regulated
• PT Bank Negara Indonesia (Persero) Tbk / BNI - State bank, OJK & BI regulated
• PT Bank Rakyat Indonesia (Persero) Tbk / BRI - State bank, OJK & BI regulated
• PT Bank Central Asia Tbk / BCA - Major private bank, OJK regulated
• PT Bank Tabungan Negara (Persero) Tbk / BTN - State bank, OJK regulated`;

    // === WEB RESEARCH DATA SECTION ===
    if (safeWebResearch) {
      prompt += `

**INTERNET RESEARCH FINDINGS:**
**OJK Registration Status:** ${safeWebResearch.ojk.registrationStatus}
- Found ${safeWebResearch.ojk.foundEntries} OJK-related entries
${safeWebResearch.ojk.details.length > 0 ? 
  '- Key findings: ' + safeWebResearch.ojk.details.slice(0, 3).map(d => d.title || 'untitled').join('; ') : ''}

**News Coverage Analysis:**
- Total articles found: ${safeWebResearch.news.totalArticles}
- News sentiment: ${safeWebResearch.news.sentiment}
- Fraud mentions: ${safeWebResearch.news.fraudMentions}
${safeWebResearch.news.articles.length > 0 ?
  '- Recent headlines: ' + safeWebResearch.news.articles.slice(0, 2).map(a => a.title || 'untitled').join('; ') : ''}

**Business Registration:**
- Registration status: ${safeWebResearch.businessInfo.businessRegistration}
- Digital footprint: ${safeWebResearch.businessInfo.digitalFootprint}
- Legitimacy signals: ${Array.isArray(safeWebResearch.businessInfo.legitimacySignals) ? 
    safeWebResearch.businessInfo.legitimacySignals.join(', ') : 'none found'}

**Fraud Reports:**
- Fraud reports found: ${safeWebResearch.fraudReports.fraudReportsFound}
- Risk assessment: ${safeWebResearch.fraudReports.riskLevel}
${safeWebResearch.fraudReports.warnings.length > 0 ?
  '- Warnings: ' + safeWebResearch.fraudReports.warnings.slice(0, 2).map(w => w.title || 'untitled').join('; ') : ''}

**Research Summary:**
- Overall risk from web research: ${safeWebResearch.summary.overallRisk}
- Data confidence: ${safeWebResearch.summary.confidence}%
- Key findings: ${Array.isArray(safeWebResearch.summary.keyFindings) ? 
    safeWebResearch.summary.keyFindings.join(', ') : 'none available'}
- Data quality: ${safeWebResearch.summary.dataQuality}`;
    }

    // === ANALYSIS RULES SECTION ===
    prompt += `

**ANALYSIS RULES:**

**SCORING FORMULA:**
fraudScore = (fraudIndicators.score × 0.5) + (regulatoryWarnings.score × 0.25) + (legitimacyEvidence.score × 0.25) + (publicSentiment.score × 0.1)

**ANALYSIS CATEGORIES:**

1. **FRAUD INDICATORS (50% weight)**
   • Scan for Indonesian fraud terms: "investasi bodong", "skema ponzi", "money game", "penipuan", "scam"
   • Look for unrealistic profit promises or "guaranteed returns"
   • Check for pyramid scheme/MLM language
   • Evidence of financial troubles, bankruptcy, business closure
   • Victim testimonials, complaints, withdrawal problems
   ${safeWebResearch ? '• Weight news reports and fraud mentions heavily' : ''}

2. **REGULATORY WARNINGS (25% weight)**
   • OJK warnings/sanctions (ONLY for financial services companies)
   • PPATK suspicious transaction reports
   • Government investigations or regulatory actions
   • License revocations or suspended operations
   • Official warnings from Indonesian authorities
   ${safeWebResearch ? '• Factor in regulatory findings from web research' : ''}

3. **LEGITIMACY EVIDENCE (25% weight - INVERTED SCORING)**
   • Indonesian business entities: "PT", "CV", "Tbk"
   • Business registration docs: NPWP, NIB, OSS
   • Professional communication vs suspicious marketing
   • Established operations and real business activities
   • Positive reviews, awards, recognition
   ${safeWebResearch ? '• Consider registration and legitimacy signals from research' : ''}

4. **PUBLIC SENTIMENT (10% weight)**
   • Negative news coverage or media reports
   • Social media complaints or warning posts
   • Forum complaints (Kaskus, etc.)
   • Customer dissatisfaction evidence
   • Public advisories or community warnings
   ${safeWebResearch ? '• Include sentiment analysis from web research' : ''}

**CRITICAL EDGE CASES:**
• When legitimacy evidence conflicts with fraud reports: Weight recent, specific fraud evidence higher
• Traditional businesses with minimal digital presence: Do NOT penalize for weak online footprint
• Financial vs non-financial companies: Only expect OJK compliance for financial services
• Fraud prevention companies: Reduce fraud keyword penalties when business is fraud prevention services

**STRICT JSON OUTPUT REQUIREMENT:**
⚠️ WARNING: Your response MUST be valid JSON only. Any non-JSON text will cause system failure.
⚠️ Do NOT include explanations, comments, or text before/after the JSON object.
⚠️ Ensure all fields are present and properly formatted as shown in the example below.

**REQUIRED OUTPUT FORMAT WITH EXAMPLE:**
⚠️ CRITICAL: riskLevel must be exactly one of: "low", "medium", "high", "critical" (no other values allowed)

{
  "fraudScore": 25,
  "riskLevel": "low",
  "confidence": 85,
  "analysis": {
    "fraudIndicators": {
      "score": 15,
      "detectedKeywords": ["none found"],
      "financialTroubles": ["no evidence of financial problems"],
      "victimReports": ["no victim testimonials found"]
    },
    "regulatoryWarnings": {
      "score": 10,
      "officialWarnings": ["no official warnings found"],
      "investigations": ["no ongoing investigations"]
    },
    "legitimacyEvidence": {
      "score": 90,
      "businessMarkers": ["PT entity", "professional description", "established business"],
      "registrationEvidence": ["proper business entity structure"]
    },
    "publicSentiment": {
      "score": 20,
      "negativeReports": ["no negative media coverage"],
      "customerComplaints": ["no customer complaints found"]
    },
    "webResearchImpact": {
      "score": ${safeWebResearch ? '25' : '0'},
      "keyFindings": ${safeWebResearch ? '["OJK registration confirmed", "positive news coverage"]' : '["no web research conducted"]'},
      "dataQuality": "${safeWebResearch ? safeWebResearch.summary.dataQuality : 'unavailable'}"
    }
  },
  "reasoning": "Company shows strong legitimacy markers with PT entity structure and professional description. No fraud indicators detected. ${safeWebResearch ? 'Web research confirms positive standing.' : 'Analysis based on description only.'}",
  "recommendations": ["Monitor for any future regulatory changes", "Verify business registration documents if needed"],
  "requiresManualReview": false
}

**SCORING GUIDELINES:**
• 0-20: Very Low Risk (Strong legitimacy, no fraud indicators)
• 21-40: Low Risk (Good legitimacy, minimal concerns)
• 41-60: Medium Risk (Limited evidence, some concerns)
• 61-80: High Risk (Multiple fraud indicators, significant concerns)
• 81-100: Critical Risk (Clear fraud evidence, regulatory warnings)

**ANALYSIS PRINCIPLES:**
• Evidence-based assessment only - no industry assumptions
• Absence of fraud evidence is positive (lowers score)
• Absence of news coverage is neutral (doesn't increase score)
• Prioritize recent, specific evidence over general patterns
• ${safeWebResearch ? 'Weight internet research findings heavily in final assessment' : 'Base analysis on company description and name only'}

BEGIN ANALYSIS - RESPOND WITH JSON ONLY:`;

    return prompt;
  }

  /**
   * Analyze actor role in fraud cases (VICTIM vs PERPETRATOR) for fair scoring
   */
  async analyzeActorRole(companyName, newsArticles = []) {
    if (this.testMode) {
      return {
        actorRole: 'UNCLEAR',
        confidence: 50,
        reasoning: 'Test mode - no actual analysis performed',
        articles: []
      };
    }

    try {
      const prompt = this.createActorRolePrompt(companyName, newsArticles);
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: this.config,
      });

      const response = await result.response;
      const text = response.text();
      
      console.log('🎭 Actor role analysis response length:', text.length);
      console.log('🎭 Actor role analysis preview:', text.substring(0, 200));
      
      // Extract JSON from response
      let jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        const codeBlockMatch = text.match(/```(?:json)?([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/);
        }
      }
      
      if (!jsonMatch) {
        console.warn('❌ No valid JSON in actor role analysis:', text);
        return {
          actorRole: 'UNCLEAR',
          confidence: 30,
          reasoning: 'Failed to parse actor role analysis',
          articles: [],
          error: 'Invalid JSON response'
        };
      }

      const analysis = JSON.parse(jsonMatch[0]);
      console.log('✅ Actor role analysis completed:', analysis.actorRole, `(${analysis.confidence}% confidence)`);
      
      return {
        actorRole: analysis.actorRole || 'UNCLEAR',
        confidence: analysis.confidence || 30,
        reasoning: analysis.reasoning || 'No reasoning provided',
        articles: analysis.articles || [],
        evidenceDetails: analysis.evidenceDetails || {},
        success: true
      };

    } catch (error) {
      console.error('❌ Actor role analysis failed:', error.message);
      return {
        actorRole: 'UNCLEAR',
        confidence: 30,
        reasoning: 'Analysis failed due to technical error',
        articles: [],
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Creates prompt for actor role analysis
   */
  createActorRolePrompt(companyName, newsArticles = []) {
    // Filter out mock data that should not be treated as real evidence
    const realArticles = newsArticles.filter(article => {
      const url = article.link || article.url || '';
      const title = article.title || '';
      const snippet = article.snippet || article.content || '';
      
      // Detect mock/test data patterns
      const isMockData = 
        url.includes('example.com') ||
        url.includes('mock') ||
        url.includes('test') ||
        title.includes('Mock') ||
        title.includes('Test') ||
        snippet.includes('mock data') ||
        snippet.includes('test data') ||
        (url === 'https://example.com/fraud-warning' && 
         snippet.includes('Multiple reports of fraudulent activities and investor complaints'));
      
      return !isMockData;
    });
    
    const articlesText = realArticles.map((article, index) => 
      `**Article ${index + 1}:**
Title: ${article.title || 'No title'}
Source: ${article.source || 'Unknown source'}
Content: ${article.snippet || article.content || 'No content'}
URL: ${article.link || 'No URL'}
Date: ${article.date || 'No date'}
---`
    ).join('\n\n');
    
    // If no real articles after filtering, note this
    if (realArticles.length === 0 && newsArticles.length > 0) {
      console.log('🚫 All articles filtered out as mock data for actor role analysis');
    }

    return `
ACTOR ROLE ANALYSIS FOR FRAUD CASES

**COMPANY TO ANALYZE:** ${companyName}

**NEWS ARTICLES AND REPORTS:**
${realArticles.length > 0 ? articlesText : 'No credible news articles found (mock/test data filtered out)'}

**ANALYSIS TASK:**
Determine the role of "${companyName}" in fraud-related incidents based on the news articles provided. This is critical for fair fraud scoring.

${realArticles.length === 0 ? '**IMPORTANT**: No real news articles available for analysis. All articles were identified as mock/test data and excluded.' : ''}

**POSSIBLE ROLES:**
1. **PERPETRATOR** - Company committed fraud, scammed customers, ran illegal schemes
2. **VICTIM** - Company was targeted by fraudsters, suffered from cybercrime, had data breached
3. **NEUTRAL** - Company mentioned in fraud prevention context, expert commentary, or regulatory guidance
4. **UNCLEAR** - Insufficient information or ambiguous role

**ANALYSIS CRITERIA:**

**PERPETRATOR Indicators:**
- Company accused of scamming customers
- Company running Ponzi schemes, investment fraud, MLM scams
- Company leaders arrested for fraud
- Customers reporting losses due to company actions
- Regulatory sanctions against the company for fraudulent practices
- Court cases where company is defendant in fraud cases

**EXECUTIVE/LEADERSHIP FRAUD (Company becomes PERPETRATOR):**
- CEO, CFO, directors, or senior management arrested/indicted for fraud
- Executive embezzlement or theft of company/customer funds
- Leadership running investment schemes using company platform or resources
- Management insider trading, securities violations, or financial manipulation
- Executive corruption, bribery, or money laundering involving company operations
- Founders or board members orchestrating fraud schemes through the company
- Senior management falsifying financial records, reports, or business metrics
- Leadership using company name, reputation, or resources for personal fraud schemes
- Company executives as masterminds of customer deception or financial crimes
- Management-led corporate fraud, accounting scandals, or investor deception

**INDONESIAN EXECUTIVE FRAUD TERMS:**
- "direktur utama ditangkap" (CEO arrested), "CFO tersangka" (CFO suspect)
- "manajemen tersangka penipuan" (management suspected of fraud)
- "pimpinan perusahaan korupsi" (company leadership corruption)
- "eksekutif terlibat skandal keuangan" (executive involved in financial scandal)
- "komisaris dituduh suap" (commissioner accused of bribery)
- "pendiri perusahaan penipuan" (company founder fraud)
- "direksi terlibat pencucian uang" (directors involved in money laundering)
- "manajemen senior tersangka" (senior management suspect)

**VICTIM Indicators:**
- Company suffered data breaches or cyberattacks
- Company customers were targeted by impersonation scams
- Company reported fraud attempts to authorities
- Company warned customers about scams using their name
- Company was subject to false advertising or impersonation
- Company is plaintiff in fraud cases against others

**NEUTRAL Indicators:**
- Company provides fraud prevention services
- Company executives giving expert opinions on fraud
- Company mentioned in regulatory guidelines as example
- Company participating in anti-fraud initiatives

**INDONESIAN CONTEXT:**
- Major Indonesian banks (BNI, BRI, Mandiri, BCA, BTN) are state-regulated institutions - default to NEUTRAL unless specific evidence
- Consider OJK warnings (against company = PERPETRATOR, by company = VICTIM/NEUTRAL)
- Analyze victim testimonials ("korban", "tertipu", "rugi")
- Check investigation status ("diselidiki", "tersangka" = PERPETRATOR)
- Look for company statements defending against accusations
- Banks mentioned in fraud prevention context = NEUTRAL, not UNCLEAR

**CRITICAL: Your response must be valid JSON only.**

**OUTPUT FORMAT:**
{
  "actorRole": "[PERPETRATOR|VICTIM|NEUTRAL|UNCLEAR]",
  "confidence": [0-100 integer],
  "reasoning": "Detailed explanation of the decision based on evidence",
  "articles": [
    {
      "articleIndex": 1,
      "relevance": "[HIGH|MEDIUM|LOW]",
      "roleEvidence": "What this article reveals about the company's role",
      "keyQuotes": ["relevant quotes from the article"]
    }
  ],
  "evidenceDetails": {
    "perpetratorEvidence": ["list of evidence suggesting company committed fraud"],
    "victimEvidence": ["list of evidence suggesting company was fraud victim"],
    "neutralEvidence": ["list of evidence suggesting neutral role"],
    "ambiguousEvidence": ["evidence that could support multiple interpretations"]
  }
}

**ANALYSIS PRINCIPLES:**
- Prioritize recent and credible news sources
- Look for direct quotes and factual reporting
- Consider the tone of articles (accusatory vs. sympathetic)
- Distinguish between allegations and proven facts

**EXECUTIVE FRAUD CLASSIFICATION RULES:**
- If executives used company resources/platform for fraud → Company = PERPETRATOR (80-95% confidence)
- If executives acted in official company capacity for fraud → Company = PERPETRATOR (85-95% confidence)
- If company directly profited from executive fraud → Company = PERPETRATOR (90-95% confidence)
- If company culture enabled/encouraged fraud → Company = PERPETRATOR (75-90% confidence)
- If isolated personal executive crime unrelated to business → Evaluate context (50-70% confidence)
- If multiple executives involved in fraud scheme → Company = PERPETRATOR (90-95% confidence)
- If executives have official fraud charges/convictions → High confidence PERPETRATOR (85-95%)

**CONFIDENCE SCORING FOR EXECUTIVE CASES:**
- 90-95%: Clear evidence of executive fraud using company, multiple sources, official charges
- 80-89%: Strong evidence of management fraud, credible reporting, some official action
- 70-79%: Credible allegations of executive fraud, investigation ongoing
- 60-69%: Allegations exist but limited credible sources or unclear company involvement
- 50-59%: Unclear relationship between executive actions and company operations
- Weight multiple consistent reports higher than single mentions
- Consider the company's response and defense statements

Begin analysis now:`;
  }

  /**
   * Creates specialized triage prompt for initial risk assessment
   */
  createTriagePrompt(companyData, patternAnalysis = null) {
    const { name, description, industry, region } = companyData;
    
    return `
INDONESIAN COMPANY TRIAGE ANALYSIS

**COMPANY INFORMATION:**
- Name: ${name}
- Description: ${description}
- Industry: ${industry || 'Not specified'}
- Region: ${region || 'Indonesia'}

${patternAnalysis ? `
**PATTERN ANALYSIS:**
- Red Flags: ${patternAnalysis.immediateRedFlags?.join(', ') || 'None'}
- Concerns: ${patternAnalysis.potentialConcerns?.join(', ') || 'None'}
- Legitimacy: ${patternAnalysis.legitimacySignals?.join(', ') || 'None'}
- Context: ${patternAnalysis.businessContext || 'Unknown'}
` : ''}

**TRIAGE OBJECTIVE:**
Perform rapid initial risk assessment focusing on Indonesian fraud patterns. Determine investigation priority level.

**ANALYSIS CRITERIA:**
1. **IMMEDIATE FRAUD INDICATORS** - Indonesian scam patterns (investasi bodong, ponzi, money game)
2. **INDUSTRY RISK CONTEXT** - OJK requirements, typical Indonesian business practices
3. **LEGITIMACY SIGNALS** - Proper registration, established operations, regulatory compliance
4. **INVESTIGATION PRIORITY** - Resource allocation for detailed verification

**RESPONSE FORMAT (JSON):**
{
  "riskLevel": "[low|medium|high|critical]",
  "initialScore": [0-100],
  "confidence": [0-100],
  "riskFactors": ["specific concerns requiring investigation"],
  "priorityPatterns": ["Indonesian fraud patterns to investigate"],
  "investigationFocus": ["verification areas to prioritize"],
  "scrapingPriority": ["sources to prioritize in web research"],
  "reasoning": "Brief risk assessment rationale"
}

**TRIAGE SCORING:**
- 0-25: Low - Light verification (traditional business, clear legitimacy)
- 26-50: Medium - Standard verification (typical business review)
- 51-75: High - Deep investigation (multiple concerns)
- 76-100: Critical - Immediate review (obvious fraud indicators)

Perform triage analysis now:`;
  }

  /**
   * Performs rapid triage analysis using Gemini AI
   */
  async performTriageAnalysis(companyData, patternAnalysis = null) {
    try {
      console.log(`🧠 Performing AI triage for: ${companyData.name}`);
      
      const triagePrompt = this.createTriagePrompt(companyData, patternAnalysis);
      
      // Handle test mode with triage-specific mock
      if (this.testMode) {
        return this.generateTriageMockResponse(companyData, patternAnalysis);
      }
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: triagePrompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 1024, // Smaller output for faster triage
        },
      });

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON response found in triage output');
      }
      
      const triageResult = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        data: triageResult,
        rawResponse: text,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Triage analysis error:', error);
      
      return {
        success: false,
        error: error.message,
        fallbackTriage: this.calculateFallbackTriage(companyData),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generates triage-specific mock response
   */
  generateTriageMockResponse(companyData, patternAnalysis = null) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    let riskLevel = 'medium';
    let initialScore = 40;
    const riskFactors = [];
    const priorityPatterns = [];
    const investigationFocus = [];
    const scrapingPriority = [];
    
    // Enhanced triage logic based on patterns
    const fraudKeywords = ['ponzi', 'guaranteed', 'scam', 'investasi bodong', 'money game'];
    const legitimateKeywords = ['ojk', 'terdaftar', 'resmi', 'pt ', 'bank', 'certified'];
    
    let fraudCount = 0;
    let legitCount = 0;
    
    for (const keyword of fraudKeywords) {
      if (text.includes(keyword)) {
        fraudCount++;
        riskFactors.push(`Fraud indicator: ${keyword}`);
      }
    }
    
    for (const keyword of legitimateKeywords) {
      if (text.includes(keyword)) {
        legitCount++;
      }
    }
    
    // Determine triage outcome
    if (fraudCount > 0) {
      riskLevel = 'critical';
      initialScore = 80 + Math.random() * 20;
      priorityPatterns.push('investment_scam_verification', 'ponzi_scheme_check');
      investigationFocus.push('fraud_reports', 'ojk_warnings', 'victim_testimonials');
      scrapingPriority.push('ppatk.go.id', 'ojk.go.id', 'fraud_news');
    } else if (legitCount >= 2) {
      riskLevel = 'low';
      initialScore = 15 + Math.random() * 15;
      priorityPatterns.push('legitimacy_confirmation');
      investigationFocus.push('registration_verification', 'positive_coverage');
      scrapingPriority.push('ojk.go.id', 'business_directories');
    } else {
      // Standard assessment
      priorityPatterns.push('standard_verification');
      investigationFocus.push('business_registration', 'news_sentiment');
      scrapingPriority.push('ojk.go.id', 'news_sources');
    }
    
    return {
      success: true,
      data: {
        riskLevel,
        initialScore: Math.round(initialScore),
        confidence: 85,
        riskFactors,
        priorityPatterns,
        investigationFocus,
        scrapingPriority,
        reasoning: `Triage based on content analysis: ${fraudCount} fraud indicators, ${legitCount} legitimacy signals found`
      },
      rawResponse: '[MOCK TRIAGE RESPONSE]',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculates fallback triage when AI fails
   */
  calculateFallbackTriage(companyData) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Enhanced fraud keyword detection
    const suspiciousKeywords = [
      'guaranteed', 'risk-free', 'ponzi', 'scam', 'money game', 'investasi bodong',
      'profit guaranteed', 'tanpa risiko', 'keuntungan pasti', 'bangkrut', 'tutup usaha'
    ];
    const legitimateKeywords = [
      'registered', 'licensed', 'certified', 'ojk', 'terdaftar', 'resmi',
      'pt ', 'cv ', 'tbk', 'npwp', 'nib'
    ];
    
    let riskScore = 50; // Start neutral
    
    for (const keyword of suspiciousKeywords) {
      if (text.includes(keyword)) riskScore += 15;
    }
    
    for (const keyword of legitimateKeywords) {
      if (text.includes(keyword)) riskScore -= 12;
    }
    
    // Evidence-based adjustments instead of industry
    const financialKeywords = ['investment', 'investasi', 'financial', 'keuangan', 'bank'];
    const needsRegulation = financialKeywords.some(keyword => text.includes(keyword));
    const hasRegulation = legitimateKeywords.some(keyword => text.includes(keyword));
    
    if (needsRegulation && !hasRegulation) {
      riskScore += 15; // Higher risk for financial business without regulation indicators
    }
    
    riskScore = Math.max(0, Math.min(100, riskScore));
    
    return {
      riskLevel: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
      initialScore: riskScore,
      confidence: 40,
      riskFactors: ['fallback_analysis'],
      priorityPatterns: ['basic_verification'],
      investigationFocus: ['general_verification'],
      scrapingPriority: ['ojk.go.id', 'google_news'],
      reasoning: 'Fallback triage due to AI service unavailability'
    };
  }

  /**
   * NEW: Analyzes company with SerpAPI search results
   * Enhanced fraud detection with structured search data
   */
  async analyzeCompanyWithSerpData(companyName, description, serpResults) {
    try {
      console.log(`🧠 Analyzing company with SerpAPI data: ${companyName}`);
      
      // Validate inputs
      if (!serpResults || !serpResults.searches) {
        throw new Error('Invalid SerpAPI results provided');
      }
      
      // Create enhanced prompt with SerpAPI data
      const prompt = this.createSerpAPIEnhancedPrompt(companyName, description, serpResults);
      
      // Handle test mode
      if (this.testMode) {
        return this.generateSerpAPIResponse(companyName, description, serpResults);
      }
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON response found in SerpAPI analysis');
      }
      
      const analysisResult = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      this.validateSerpAPIAnalysisResult(analysisResult);
      
      return {
        success: true,
        data: analysisResult,
        rawResponse: text,
        serpData: serpResults,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('SerpAPI analysis error:', error);
      
      return {
        success: false,
        error: error.message,
        fallbackAnalysis: this.generateSerpAPIFallback(companyName, description, serpResults),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Creates enhanced prompt with SerpAPI search results
   */
  createSerpAPIEnhancedPrompt(companyName, description, serpResults) {
    const { searches, summary } = serpResults;
    
    let prompt = `
Analyze the following Indonesian company for fraud risk using comprehensive internet search data from SerpAPI. Base your assessment on actual evidence found online.

**COMPANY INFORMATION:**
- Name: ${companyName}
- Description: ${description}

**COMPREHENSIVE INTERNET RESEARCH FINDINGS:`;

    // Add search results sections
    Object.entries(searches).forEach(([searchType, searchData]) => {
      if (searchData && !searchData.error) {
        prompt += this.formatSerpSearchResults(searchType, searchData);
      }
    });

    // Add summary findings
    if (summary) {
      prompt += `

**SEARCH SUMMARY:**
- Total Results Found: ${summary.totalResults}
- Fraud Indicators: ${summary.fraudIndicators}
- Legitimacy Signals: ${summary.legitimacySignals}
- Conclusive Evidence: ${summary.conclusiveEvidence ? 'Yes' : 'No'}
- Early Termination: ${summary.earlyTermination ? 'Yes (sufficient evidence found)' : 'No'}`;
    }

    // Add analysis framework
    prompt += `

**EVIDENCE-BASED ANALYSIS FRAMEWORK:**
Analyze this company based ONLY on evidence found in the internet search results above. Do not make assumptions.

**ANALYSIS REQUIREMENTS:**

1. **FRAUD EVIDENCE ANALYSIS** (Weight: 40%)
   - Direct fraud reports, victim testimonials, scam warnings
   - Investment fraud patterns (ponzi, guaranteed returns, money games)
   - Financial troubles (bankruptcy, business closure, license revocation)
   - Regulatory sanctions and government warnings

2. **LEGITIMACY VERIFICATION** (Weight: 30%)
   - Official business registration and licenses
   - OJK registration for financial services (if applicable)
   - Positive news coverage and business achievements
   - Professional certifications and industry recognition

3. **PUBLIC SENTIMENT ANALYSIS** (Weight: 20%)
   - News coverage tone and frequency
   - Social media sentiment and discussions
   - Customer reviews and experiences
   - Community warnings or endorsements

4. **REGULATORY COMPLIANCE** (Weight: 10%)
   - Government database listings
   - Official warnings or sanctions
   - License status and regulatory standing
   - Compliance with Indonesian business laws

**OUTPUT FORMAT:**
Return a JSON object with this exact structure:

{
  "fraudScore": [0-100 integer],
  "riskLevel": "[low|medium|high|critical]",
  "confidence": [0-100 integer],
  "evidenceBreakdown": {
    "fraudIndicators": ["specific fraud evidence found"],
    "financialTroubles": ["business problems or bankruptcy evidence"],
    "regulatoryIssues": ["government warnings or sanctions"],
    "publicSentiment": "[positive|neutral|negative|mixed]",
    "legitimacySignals": ["positive business indicators found"]
  },
  "reasoning": "Detailed explanation based on search findings",
  "keyFindings": ["most important discoveries from internet research"],
  "recommendedAction": "[approve|investigate|reject|manual_review]",
  "evidenceQuality": "[comprehensive|good|limited|minimal]",
  "searchImpact": {
    "totalSources": [number of sources analyzed],
    "reliableSources": [number of authoritative sources],
    "conflictingInfo": [true|false]
  }
}

**SCORING GUIDELINES:**
- 0-20: Very Low Risk - Strong legitimacy evidence, no fraud indicators
- 21-40: Low Risk - Good business standing, minimal concerns
- 41-60: Medium Risk - Mixed evidence, standard verification needed
- 61-80: High Risk - Multiple fraud indicators or regulatory issues
- 81-100: Critical Risk - Clear fraud evidence or victim reports

**ANALYSIS PRINCIPLES:**
- Prioritize authoritative sources (government, established news, official sites)
- Weight recent information more heavily than old reports
- Distinguish between fraud accusations vs fraud prevention services
- Consider Indonesian business context and regulatory requirements
- Base confidence on quality and quantity of evidence found

Begin detailed analysis:`;

    return prompt;
  }

  /**
   * Formats SerpAPI search results for prompt inclusion
   */
  formatSerpSearchResults(searchType, searchData) {
    let section = `

**${searchType.toUpperCase()} SEARCH RESULTS:**`;
    
    const results = searchData.organic_results || searchData.news_results || [];
    if (results.length === 0) {
      section += `\n- No relevant results found`;
      return section;
    }

    results.slice(0, 5).forEach((result, index) => {
      section += `
${index + 1}. Title: ${result.title}
   Source: ${result.link}
   Summary: ${result.snippet || 'No summary available'}`;
      
      if (result.date) {
        section += `\n   Date: ${result.date}`;
      }
    });

    return section;
  }

  /**
   * Generates SerpAPI-based response for test mode
   */
  generateSerpAPIResponse(companyName, description, serpResults) {
    const { summary } = serpResults;
    
    // Calculate scores based on SerpAPI findings
    let fraudScore = 30; // Base score
    let riskLevel = 'medium';
    let confidence = 85;
    
    const fraudIndicators = [];
    const financialTroubles = [];
    const regulatoryIssues = [];
    const legitimacySignals = [];
    
    // Analyze search results
    if (summary) {
      // Increase fraud score based on indicators
      if (summary.fraudIndicators > 0) {
        fraudScore += summary.fraudIndicators * 15;
        fraudIndicators.push(`${summary.fraudIndicators} fraud-related search results found`);
      }
      
      // Decrease fraud score based on legitimacy
      if (summary.legitimacySignals > 0) {
        fraudScore -= summary.legitimacySignals * 10;
        legitimacySignals.push(`${summary.legitimacySignals} legitimacy indicators found`);
      }
      
      // Early termination indicates strong evidence
      if (summary.earlyTermination) {
        if (summary.fraudIndicators > summary.legitimacySignals) {
          fraudScore = Math.max(fraudScore, 75);
          fraudIndicators.push('Early termination due to conclusive fraud evidence');
        } else {
          fraudScore = Math.min(fraudScore, 25);
          legitimacySignals.push('Early termination due to strong legitimacy evidence');
        }
      }
    }

    // Determine risk level
    fraudScore = Math.max(0, Math.min(100, fraudScore));
    if (fraudScore >= 80) riskLevel = 'critical';
    else if (fraudScore >= 60) riskLevel = 'high';
    else if (fraudScore >= 40) riskLevel = 'medium';
    else riskLevel = 'low';

    // Determine public sentiment
    let publicSentiment = 'neutral';
    if (summary && summary.fraudIndicators > 2) publicSentiment = 'negative';
    else if (summary && summary.legitimacySignals > 2) publicSentiment = 'positive';

    // Generate key findings
    const keyFindings = [];
    if (summary) {
      keyFindings.push(`Found ${summary.totalResults} total search results`);
      if (summary.fraudIndicators > 0) {
        keyFindings.push(`Detected ${summary.fraudIndicators} potential fraud indicators`);
      }
      if (summary.legitimacySignals > 0) {
        keyFindings.push(`Identified ${summary.legitimacySignals} legitimacy signals`);
      }
      if (summary.conclusiveEvidence) {
        keyFindings.push('Search revealed conclusive evidence for assessment');
      }
    }

    // Determine recommended action
    let recommendedAction = 'investigate';
    if (fraudScore >= 80) recommendedAction = 'reject';
    else if (fraudScore >= 60) recommendedAction = 'manual_review';
    else if (fraudScore <= 30) recommendedAction = 'approve';

    // Determine evidence quality
    let evidenceQuality = 'limited';
    if (summary && summary.totalResults > 20) evidenceQuality = 'comprehensive';
    else if (summary && summary.totalResults > 10) evidenceQuality = 'good';
    else if (summary && summary.totalResults > 5) evidenceQuality = 'limited';
    else evidenceQuality = 'minimal';

    return {
      success: true,
      data: {
        fraudScore: Math.round(fraudScore),
        riskLevel,
        confidence,
        evidenceBreakdown: {
          fraudIndicators,
          financialTroubles,
          regulatoryIssues,
          publicSentiment,
          legitimacySignals
        },
        reasoning: `Analysis based on comprehensive internet search of ${companyName}. ${keyFindings.join('. ')}.`,
        keyFindings,
        recommendedAction,
        evidenceQuality,
        searchImpact: {
          totalSources: summary?.totalResults || 0,
          reliableSources: Math.floor((summary?.totalResults || 0) * 0.7),
          conflictingInfo: summary?.fraudIndicators > 0 && summary?.legitimacySignals > 0
        }
      },
      rawResponse: '[SERPAPI MOCK RESPONSE]',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validates SerpAPI analysis result structure
   */
  validateSerpAPIAnalysisResult(result) {
    const required = [
      'fraudScore', 'riskLevel', 'confidence', 'evidenceBreakdown', 
      'reasoning', 'keyFindings', 'recommendedAction', 'evidenceQuality'
    ];
    
    for (const field of required) {
      if (!(field in result)) {
        throw new Error(`Missing required field in SerpAPI analysis: ${field}`);
      }
    }
    
    if (typeof result.fraudScore !== 'number' || result.fraudScore < 0 || result.fraudScore > 100) {
      throw new Error('fraudScore must be a number between 0 and 100');
    }
    
    if (!['low', 'medium', 'high', 'critical'].includes(result.riskLevel)) {
      throw new Error('riskLevel must be one of: low, medium, high, critical');
    }
    
    if (!['approve', 'investigate', 'reject', 'manual_review'].includes(result.recommendedAction)) {
      throw new Error('recommendedAction must be one of: approve, investigate, reject, manual_review');
    }
  }

  /**
   * Generates fallback analysis when SerpAPI analysis fails
   */
  generateSerpAPIFallback(companyName, description, serpResults) {
    const text = `${companyName} ${description}`.toLowerCase();
    
    // Basic keyword analysis
    const suspiciousKeywords = ['guaranteed', 'ponzi', 'scam', 'investasi bodong'];
    const legitimateKeywords = ['ojk', 'terdaftar', 'resmi', 'pt '];
    
    const suspiciousCount = suspiciousKeywords.filter(k => text.includes(k)).length;
    const legitimateCount = legitimateKeywords.filter(k => text.includes(k)).length;
    
    let fraudScore = 50;
    if (suspiciousCount > 0) fraudScore += suspiciousCount * 20;
    if (legitimateCount > 0) fraudScore -= legitimateCount * 15;
    
    fraudScore = Math.max(0, Math.min(100, fraudScore));
    
    return {
      fraudScore,
      riskLevel: fraudScore > 70 ? 'high' : fraudScore > 40 ? 'medium' : 'low',
      confidence: 30,
      reasoning: 'Fallback analysis due to SerpAPI processing error',
      source: 'keyword_analysis'
    };
  }

  /**
   * Analyzes Indonesian company for fraud risk using Gemini AI with web research
   */
  async analyzeCompanyFraud(companyData) {
    try {
      console.log(`🔍 Starting enhanced fraud analysis for: ${companyData.name}`);
      
      // Validate company data
      const companyValidation = this.dataValidator.validateCompanyData(companyData);
      if (!companyValidation.isValid) {
        throw new Error(`Invalid company data: ${companyValidation.issues.join(', ')}`);
      }
      const validatedCompanyData = companyValidation.cleanedData;
      
      // Step 1: Perform web research
      let webResearch = null;
      try {
        console.log('📡 Conducting web research...');
        webResearch = await this.webScraper.researchCompany(
          validatedCompanyData.name, 
          validatedCompanyData.region
        );
        
        // Validate web research data
        if (webResearch && !webResearch.fallback) {
          const webValidation = this.dataValidator.validateWebResearchData(webResearch);
          if (!webValidation.isValid) {
            console.warn('⚠️ Web research data validation issues:', webValidation.issues.join(', '));
            // Continue with original data but log the issues
          } else {
            webResearch = webValidation.cleanedData;
          }
        }
        
        console.log(`✅ Web research completed - Quality: ${webResearch?.summary?.dataQuality || 'unknown'}`);
      } catch (webError) {
        console.warn('⚠️ Web research failed, proceeding with basic analysis:', webError.message);
        
        // Check if this is a SerpAPI quota exhaustion error and immediately throw to stop all processing
        if (webError.message && (
          webError.message.includes('quota exhausted') || 
          webError.message.includes('run out of searches') || 
          webError.message.includes('Your account has run out of searches')
        )) {
          console.error('🚫 SerpAPI quota exhausted in Gemini web research - stopping all analysis immediately');
          throw webError; // Re-throw to stop entire analysis
        }
        
        webResearch = null;
      }

      // Step 2: Create enhanced prompt with web research
      const prompt = this.createIndonesianFraudPrompt(validatedCompanyData, webResearch);
      
      // Handle test mode with mock responses (enhanced with web data)
      if (this.testMode) {
        return this.generateMockResponse(validatedCompanyData, webResearch);
      }
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: this.config,
      });

      const response = await result.response;
      const text = response.text();
      
      // Debug logging
      console.log('🤖 Gemini raw response length:', text.length);
      console.log('🤖 Gemini raw response preview:', text.substring(0, 200));
      
      // Extract JSON from response with better error handling
      let jsonMatch = text.match(/\{[\s\S]*\}/);
      
      // Try to find JSON in different formats
      if (!jsonMatch) {
        // Look for JSON wrapped in code blocks
        const codeBlockMatch = text.match(/```(?:json)?([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/);
        }
      }
      
      if (!jsonMatch) {
        console.warn('❌ No valid JSON response found in Gemini output:');
        console.warn('Full response:', text);
        // Return a fallback analysis instead of throwing
        return {
          success: false,
          error: 'Invalid JSON response format from Gemini AI',
          fallbackScore: this.calculateFallbackScore(companyData),
          timestamp: new Date().toISOString()
        };
      }
      
      let analysisResult;
      try {
        analysisResult = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn('JSON parsing failed:', parseError.message);
        console.warn('Raw JSON:', jsonMatch[0].substring(0, 200));
        
        // Try to clean up common JSON issues
        let cleanedJson = jsonMatch[0]
          .replace(/\n/g, ' ')  // Remove newlines
          .replace(/\t/g, ' ')  // Remove tabs
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        // Try parsing cleaned JSON
        try {
          analysisResult = JSON.parse(cleanedJson);
        } catch (secondParseError) {
          console.warn('Even cleaned JSON parsing failed, using fallback');
          return {
            success: false,
            error: 'JSON parsing error: ' + parseError.message,
            fallbackScore: this.calculateFallbackScore(companyData),
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // Validate required fields
      this.validateAnalysisResult(analysisResult);
      
      return {
        success: true,
        data: analysisResult,
        rawResponse: text,
        webResearch: webResearch,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Gemini analysis error:', error);
      
      return {
        success: false,
        error: error.message,
        fallbackScore: this.calculateFallbackScore(companyData),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generates mock response for testing purposes with web research integration
   */
  generateMockResponse(companyData, webResearch = null) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Detect suspicious patterns
    const suspiciousKeywords = [
      // Direct fraud terms
      'guaranteed', 'profit', 'ponzi', 'scam', 'money game', 'investasi bodong',
      // Financial distress indicators  
      'dissolution', 'tutup', 'bangkrut', 'gagal', 'bermasalah', 'failed', 'closed',
      'bankruptcy', 'insolvent', 'liquidation', 'shut down', 'ceased operations',
      // Inflated claims indicators
      'largest', 'terbesar', 'claimed', 'mengklaim', 'supposedly', 'allegedly',
      'world\'s biggest', 'number one', 'market leader', 'dominate market'
    ];
    const legitimateKeywords = [
      // Financial legitimacy
      'ojk', 'registered', 'terdaftar', 'certified', 'iso', 'bank', 'fintech',
      // Retail/Manufacturing legitimacy  
      'amdk', 'kemasan', 'produksi', 'merek', 'pabrik', 'manufaktur', 'industri',
      'air minum', 'minuman', 'makanan', 'consumer goods', 'fmcg',
      // General business legitimacy (excluding PT/CV/TBK - handled separately)
      'resmi', 'legal', 'licensed', 'perusahaan'
    ];
    
    const suspiciousCount = suspiciousKeywords.filter(keyword => text.includes(keyword)).length;
    let legitimateCount = legitimateKeywords.filter(keyword => text.includes(keyword)).length;
    
    // Add entity type legitimacy only if it's at the start of company name
    const nameUpper = name.toUpperCase();
    if (nameUpper.startsWith('PT ') || nameUpper.startsWith('CV ') || nameUpper.includes(' TBK')) {
      legitimateCount += 1;
    }
    
    let fraudScore;
    let riskLevel;
    let reasoning;
    
    // Enhance scoring with web research if available
    let webResearchImpact = 0;
    let webDataQuality = 'unavailable';
    let keyWebFindings = ['No web research conducted'];
    
    if (webResearch && !webResearch.fallback) {
      // Validate web research data
      const webValidation = this.dataValidator.validateWebResearchData(webResearch);
      const validatedWebData = webValidation.isValid ? webValidation.cleanedData : webResearch;
      
      webDataQuality = validatedWebData.summary?.dataQuality || 'limited';
      keyWebFindings = validatedWebData.summary?.keyFindings || [];
      
      // Adjust score based on web research findings
      if (validatedWebData.summary?.overallRisk === 'high') {
        webResearchImpact = 20; // Increase risk
      } else if (validatedWebData.summary?.overallRisk === 'low') {
        webResearchImpact = -15; // Decrease risk
      }
      
      // Factor in OJK registration
      if (validatedWebData.sources?.ojk?.registrationStatus === 'registered') {
        webResearchImpact -= 10; // Lower risk
      } else if (validatedWebData.sources?.ojk?.registrationStatus === 'warning_issued') {
        webResearchImpact += 25; // Higher risk
      }
      
      // Factor in fraud reports
      if (validatedWebData.sources?.fraudReports?.fraudReportsFound > 0) {
        webResearchImpact += 15; // Higher risk
      }
    }
    
    // Base scoring logic with industry awareness
    if (suspiciousCount > 1) {
      fraudScore = 75 + Math.random() * 20 + webResearchImpact;
      riskLevel = fraudScore > 80 ? 'critical' : 'high';
      reasoning = `Multiple fraud indicators detected in company description${webResearch ? ' and web research findings' : ''}`;
    } else if (legitimateCount > 1) {
      fraudScore = 15 + Math.random() * 20 + webResearchImpact;
      riskLevel = fraudScore < 25 ? 'low' : 'medium';
      reasoning = `Strong legitimacy indicators found${webResearch ? ' supported by web research' : ''}, appears to be legitimate business`;
    } else {
      // Industry-aware base scoring for neutral cases
      const baseScore = this.getIndustryBaseFraudScore(companyData);
      fraudScore = baseScore + Math.random() * 15 + webResearchImpact;
      riskLevel = fraudScore > 60 ? 'high' : (fraudScore > 35 ? 'medium' : 'low');
      reasoning = `Industry-adjusted risk assessment${webResearch ? ' with web research findings' : ''}, standard verification recommended`;
    }
    
    // Ensure score stays within bounds
    fraudScore = Math.max(0, Math.min(100, fraudScore));
    
    // Enhanced legitimacy analysis
    const legitimacyAnalysis = this.legitimacyAnalyzer.analyzeLegitimacySignals(companyData, webResearch);
    
    return {
      success: true,
      data: {
        fraudScore: Math.round(fraudScore),
        riskLevel,
        confidence: 85,
        analysis: {
          fraudIndicators: {
            score: suspiciousCount * 30,
            detectedKeywords: suspiciousKeywords.filter(k => text.includes(k)),
            financialTroubles: suspiciousKeywords.filter(k => ['bankruptcy', 'bangkrut', 'tutup', 'failed'].some(t => k.includes(t))),
            victimReports: suspiciousKeywords.filter(k => ['victim', 'korban', 'complaint'].some(t => k.includes(t)))
          },
          regulatoryWarnings: {
            score: this.calculateRegulatoryWarningsScore(companyData, webResearch),
            officialWarnings: [],
            investigations: []
          },
          legitimacyEvidence: {
            score: legitimacyAnalysis.score,
            businessMarkers: legitimacyAnalysis.businessMarkers,
            registrationEvidence: legitimacyAnalysis.businessMarkers.filter(m => ['pt', 'cv', 'tbk', 'npwp', 'nib'].includes(m))
          },
          publicSentiment: {
            score: this.calculatePublicSentimentScore(webResearch),
            negativeReports: [],
            customerComplaints: []
          },
          webResearchImpact: {
            score: this.calculateWebResearchImpactScore(webResearchImpact, webResearch),
            keyFindings: keyWebFindings,
            dataQuality: webDataQuality
          }
        },
        reasoning,
        recommendations: this.generateRecommendations(riskLevel, legitimacyAnalysis, webResearch),
        requiresManualReview: riskLevel === 'high' || riskLevel === 'critical'
      },
      rawResponse: '[MOCK RESPONSE]',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate contextual recommendations based on analysis
   */
  generateRecommendations(riskLevel, legitimacyAnalysis, webResearch = null) {
    const recommendations = [];
    
    // Risk-based recommendations
    switch (riskLevel) {
      case 'critical':
        recommendations.push('Immediate manual review required');
        recommendations.push('Block all transactions until verification completed');
        recommendations.push('Report to OJK and relevant authorities');
        break;
      case 'high':
        recommendations.push('Manual review required');
        recommendations.push('Request additional documentation (NPWP, SIUP, NIB)');
        recommendations.push('Verify business registration with relevant authorities');
        break;
      case 'medium':
        recommendations.push('Standard verification process');
        recommendations.push('Cross-check with OJK registered companies database');
        recommendations.push('Monitor for additional suspicious activities');
        break;
      case 'low':
        recommendations.push('Standard onboarding process');
        recommendations.push('Periodic monitoring recommended');
        break;
    }
    
    // Legitimacy-based recommendations
    if (legitimacyAnalysis.score < 30) {
      recommendations.push('Verify company registration status with Ministry of Law and Human Rights');
      recommendations.push('Confirm physical business address');
      recommendations.push('Request official business documentation');
    } else if (legitimacyAnalysis.score > 70) {
      recommendations.push('Company shows strong legitimacy indicators');
      recommendations.push('Proceed with standard due diligence');
    }
    
    // Web research-based recommendations
    if (webResearch && !webResearch.fallback) {
      if (webResearch.summary?.dataQuality === 'limited' || webResearch.summary?.dataQuality === 'minimal') {
        recommendations.push('Conduct additional manual verification due to limited online presence');
      }
      
      if (webResearch.sources?.fraudReports?.fraudReportsFound > 0) {
        recommendations.push('Review fraud reports in detail');
        recommendations.push('Contact reported victims if possible for additional information');
      }
      
      if (webResearch.sources?.ojk?.registrationStatus === 'not_registered') {
        recommendations.push('Verify if company should be OJK registered based on business activities');
      }
    }
    
    // Industry-specific recommendations
    if (legitimacyAnalysis.businessMarkers.includes('fintech') || 
        legitimacyAnalysis.businessMarkers.includes('bank') ||
        legitimacyAnalysis.businessMarkers.includes('financial')) {
      recommendations.push('Verify OJK registration status');
      recommendations.push('Confirm compliance with Indonesian financial regulations');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Gets industry-appropriate base fraud score for neutral cases
   */
  getIndustryBaseFraudScore(companyData) {
    const { industry } = companyData;
    
    // Industry-specific base fraud scores for neutral cases
    const industryBaseScores = {
      // Low-risk traditional industries
      'retail': 20,
      'manufacturing': 18,
      'agriculture': 25, // Increased due to eFishery fraud case
      'education': 20,
      'healthcare': 22,
      
      // Medium-risk industries
      'technology': 25,
      'consulting': 30,
      'ecommerce': 28,
      
      // Higher-risk financial industries
      'fintech': 35,
      'investment': 40,
      'banking': 30,
      'cryptocurrency': 45,
      'lending': 38,
      
      // Default for unknown industries
      'default': 30
    };
    
    return industryBaseScores[industry] || industryBaseScores['default'];
  }

  /**
   * Calculates OJK compliance score based on industry context
   */
  calculateOJKComplianceScore(companyData, legitimateCount) {
    const { industry, name, description } = companyData;
    
    // Industries that require OJK compliance
    const ojkRequiredIndustries = [
      'fintech', 'banking', 'insurance', 'investment', 'payment',
      'lending', 'crowdfunding', 'cryptocurrency', 'digital wallet'
    ];
    
    const requiresOJK = ojkRequiredIndustries.includes(industry);
    
    if (requiresOJK) {
      // Count OJK-specific compliance indicators
      const text = `${name} ${description}`.toLowerCase();
      const ojkSpecificKeywords = ['ojk', 'terdaftar ojk', 'licensed', 'regulated', 'compliance', 'certified'];
      let ojkIndicators = ojkSpecificKeywords.filter(keyword => text.includes(keyword)).length;
      
      // Add industry-specific compliance indicators
      if (industry === 'banking') {
        const bankingKeywords = [
          // Strong banking legitimacy indicators
          'state-owned bank', 'bank negara', 'bank rakyat', 'bank central asia',
          'bank mandiri', 'bank bri', 'bank bni', 'bank bca',
          // Moderate banking legitimacy indicators  
          'indonesian bank', 'bank indonesia', 'cabang', 'branches',
          'state bank', 'government bank', 'bumn bank'
        ];
        
        const bankingIndicators = bankingKeywords.filter(keyword => text.includes(keyword)).length;
        ojkIndicators += bankingIndicators;
      } else if (industry === 'fintech') {
        const fintechKeywords = [
          'fintech terdaftar', 'payment institution', 'e-money license',
          'digital banking', 'registered fintech', 'licensed payment'
        ];
        
        const fintechIndicators = fintechKeywords.filter(keyword => text.includes(keyword)).length;
        ojkIndicators += fintechIndicators;
      }
      
      // Graduated scoring based on compliance strength
      if (ojkIndicators >= 3) return 15; // Strong compliance
      if (ojkIndicators === 2) return 25; // Moderate compliance  
      if (ojkIndicators === 1) return 45; // Weak compliance
      return 75; // No compliance indicators - high risk
    } else {
      // For non-regulated industries, OJK compliance is not applicable
      return 0; // Not applicable - OJK compliance doesn't apply to this industry
    }
  }

  /**
   * Validates the structure of Gemini analysis result
   */
  validateAnalysisResult(result) {
    const required = ['fraudScore', 'riskLevel', 'confidence', 'analysis', 'reasoning'];
    
    for (const field of required) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (typeof result.fraudScore !== 'number' || result.fraudScore < 0 || result.fraudScore > 100) {
      throw new Error('fraudScore must be a number between 0 and 100');
    }
    
    if (!['low', 'medium', 'high', 'critical'].includes(result.riskLevel)) {
      throw new Error('riskLevel must be one of: low, medium, high, critical');
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
      throw new Error('confidence must be a number between 0 and 100');
    }
  }

  /**
   * Calculates fallback fraud score when Gemini API fails
   * Uses basic Indonesian keyword analysis
   */
  calculateFallbackScore(companyData) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Indonesian fraud keywords
    const fraudKeywords = [
      'investasi bodong', 'skema ponzi', 'money game', 'penipuan', 'scam',
      'guaranteed profit', 'risk-free', 'get rich quick', 'passive income',
      'binary option', 'forex scam', 'cryptocurrency scam'
    ];
    
    // Legitimacy indicators
    const legitimacyKeywords = [
      'ojk', 'terdaftar', 'resmi', 'pt ', 'cv ', 'tbk', 'npwp',
      'iso certified', 'audit', 'compliance', 'licensed'
    ];
    
    let riskScore = 30; // Base medium risk
    
    // Check for fraud indicators
    for (const keyword of fraudKeywords) {
      if (text.includes(keyword)) {
        riskScore += 15;
      }
    }
    
    // Check for legitimacy indicators
    for (const keyword of legitimacyKeywords) {
      if (text.includes(keyword)) {
        riskScore -= 10;
      }
    }
    
    // Clamp score between 0-100
    riskScore = Math.max(0, Math.min(100, riskScore));
    
    return {
      fraudScore: riskScore,
      riskLevel: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high',
      confidence: 40, // Lower confidence for fallback
      source: 'fallback_analysis',
      reasoning: 'Fallback analysis due to AI service unavailability'
    };
  }

  /**
   * Test Gemini API connection
   */
  async testConnection() {
    try {
      if (this.testMode) {
        return {
          success: true,
          response: 'OK (Test Mode)',
          timestamp: new Date().toISOString()
        };
      }
      
      const testPrompt = 'Respond with "OK" if you can process this message.';
      const result = await this.model.generateContent(testPrompt);
      const response = result.response;
      const text = response.text().trim();
      
      return {
        success: true,
        response: text,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate web research impact score ensuring never 0 when sources used
   * Stage 2 Implementation: Prevents webResearchImpact.score = 0 when sourcesUsed > 0
   */
  calculateWebResearchImpactScore(webResearchImpact, webResearch) {
    const sourcesUsed = webResearch?.sourcesScraped || 0;
    let impactScore = Math.round(Math.abs(webResearchImpact) * 5); // Convert impact to 0-100 scale
    
    // Ensure score is never 0 when sources were actually used
    if (sourcesUsed > 0 && impactScore === 0) {
      // Minimum score of 10 when sources were used but impact was minimal
      impactScore = 10;
    }
    
    return impactScore;
  }

  /**
   * Calculate regulatory warnings score based on evidence found
   */
  calculateRegulatoryWarningsScore(companyData, webResearch) {
    let score = 0;
    
    // Check for regulatory issues in web research
    if (webResearch && !webResearch.fallback) {
      if (webResearch.sources?.ojk?.registrationStatus === 'warning_issued') {
        score += 70;
      } else if (webResearch.sources?.ojk?.registrationStatus === 'suspended') {
        score += 80;
      } else if (webResearch.sources?.ojk?.registrationStatus === 'revoked') {
        score += 90;
      }
      
      // Add points for investigations
      const investigations = webResearch.sources?.fraudReports?.investigations || 0;
      score += Math.min(investigations * 20, 60);
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate public sentiment score based on negative indicators
   */
  calculatePublicSentimentScore(webResearch) {
    let score = 0;
    
    if (webResearch && !webResearch.fallback) {
      // Negative news sentiment
      if (webResearch.sources?.news?.sentiment === 'negative') {
        score += 40;
      } else if (webResearch.sources?.news?.sentiment === 'mixed') {
        score += 20;
      }
      
      // Fraud mentions in news
      const fraudMentions = webResearch.sources?.news?.fraudMentions || 0;
      score += Math.min(fraudMentions * 15, 45);
      
      // Customer complaints or social sentiment
      if (webResearch.sources?.businessInfo?.digitalFootprint === 'negative') {
        score += 30;
      }
    }
    
    return Math.min(score, 100);
  }

  /**
   * Generates human-readable company narrative from analysis results
   */
  async generateCompanyNarrative(companyData, analysisResult, entityResolution = null) {
    try {
      const prompt = this.createNarrativePrompt(companyData, analysisResult, entityResolution);
      
      if (this.testMode) {
        return this.generateMockNarrative(companyData, analysisResult, entityResolution);
      }
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3, // Slightly higher for more natural language
          topK: 10,
          topP: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON response found in narrative generation');
      }
      
      return {
        success: true,
        data: JSON.parse(jsonMatch[0]),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Narrative generation error:', error);
      return {
        success: false,
        error: error.message,
        fallback: this.generateMockNarrative(companyData, analysisResult, entityResolution)
      };
    }
  }

  /**
   * Creates prompt for AI narrative generation
   */
  createNarrativePrompt(companyData, analysisResult, entityResolution) {
    const { name, description } = companyData;
    const { fraudScore, riskLevel, confidence } = analysisResult;
    
    return `
Generate a comprehensive, human-readable analysis narrative for the following Indonesian company fraud assessment.

**COMPANY INFORMATION:**
- Name: ${name}
- Description: ${description}
${entityResolution ? `
**ENTITY RESOLUTION:**
- Canonical Name: ${entityResolution.canonicalName}
- Entity Type: ${entityResolution.entityType}
- Industry: ${entityResolution.industry}
- Jurisdiction: ${entityResolution.jurisdiction}
- Registration Status: ${entityResolution.registrationStatus}
- Known Aliases: ${entityResolution.aliases.slice(0, 3).join(', ')}` : ''}

**ANALYSIS RESULTS:**
- Fraud Score: ${fraudScore}/100
- Risk Level: ${riskLevel}
- Analysis Confidence: ${confidence}%

**EVIDENCE FINDINGS:**
${this.formatEvidenceForNarrative(analysisResult)}

**NARRATIVE REQUIREMENTS:**
Create a professional, accessible narrative that explains the fraud assessment in plain language. The narrative should be suitable for business stakeholders who need to understand the risk assessment without technical jargon.

**OUTPUT FORMAT (JSON):**
{
  "summary": "2-3 sentence overall risk assessment summary",
  "keyFindings": [
    "Most important discovery 1",
    "Most important discovery 2",
    "Most important discovery 3"
  ],
  "riskExplanation": "Detailed explanation of why this fraud score was assigned, referencing specific evidence",
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "confidenceReasoning": "Explanation of why we have this level of confidence in the assessment",
  "businessContext": "How this assessment should be interpreted in the context of Indonesian business environment"
}

**WRITING GUIDELINES:**
- Use professional but accessible language
- Focus on business implications
- Cite specific evidence when possible
- Avoid technical fraud detection terminology
- Consider Indonesian business context and regulations
- Be objective and fact-based
- Provide actionable insights

Generate the narrative now:`;
  }

  /**
   * Formats evidence for narrative generation
   */
  formatEvidenceForNarrative(analysisResult) {
    let evidence = '';
    
    if (analysisResult.analysis?.fraudIndicators) {
      const fraud = analysisResult.analysis.fraudIndicators;
      evidence += `- Fraud Indicators: Score ${fraud.score}/100`;
      if (fraud.detectedKeywords?.length > 0) {
        evidence += `, Keywords: ${fraud.detectedKeywords.slice(0, 3).join(', ')}`;
      }
      evidence += '\n';
    }
    
    if (analysisResult.analysis?.legitimacyEvidence) {
      const legit = analysisResult.analysis.legitimacyEvidence;
      evidence += `- Legitimacy Evidence: Score ${legit.score}/100`;
      if (legit.businessMarkers?.length > 0) {
        evidence += `, Markers: ${legit.businessMarkers.slice(0, 3).join(', ')}`;
      }
      evidence += '\n';
    }
    
    if (analysisResult.analysis?.regulatoryWarnings) {
      const regulatory = analysisResult.analysis.regulatoryWarnings;
      evidence += `- Regulatory Status: Score ${regulatory.score}/100\n`;
    }
    
    if (analysisResult.analysis?.webResearchImpact) {
      const web = analysisResult.analysis.webResearchImpact;
      evidence += `- Web Research: Score ${web.score}/100, Quality: ${web.dataQuality}\n`;
    }
    
    return evidence || '- No detailed evidence breakdown available\n';
  }

  /**
   * Generates mock narrative for testing
   */
  generateMockNarrative(companyData, analysisResult, entityResolution) {
    const { name } = companyData;
    const { fraudScore, riskLevel, confidence } = analysisResult;
    
    let summary, riskExplanation, businessContext;
    const keyFindings = [];
    const recommendations = [];
    
    // Generate content based on risk level
    if (riskLevel === 'critical' || riskLevel === 'high') {
      summary = `${name} presents significant fraud risk with a score of ${fraudScore}/100. Multiple concerning indicators were identified requiring immediate attention and enhanced due diligence.`;
      
      keyFindings.push(
        'Multiple fraud-related keywords detected in company description',
        'Limited or suspicious regulatory compliance evidence',
        'Negative indicators outweigh legitimacy signals'
      );
      
      recommendations.push(
        'Conduct enhanced due diligence before any business engagement',
        'Verify all business registration documents with Indonesian authorities',
        'Consider rejecting business relationship until concerns are addressed'
      );
      
      riskExplanation = `The high fraud score is primarily driven by the presence of suspicious keywords commonly associated with fraudulent investment schemes, combined with insufficient evidence of legitimate business operations and regulatory compliance.`;
      
    } else if (riskLevel === 'medium') {
      summary = `${name} shows moderate risk characteristics with a score of ${fraudScore}/100. While some legitimacy indicators are present, additional verification is recommended before establishing business relationships.`;
      
      keyFindings.push(
        'Mixed signals between legitimacy and risk indicators',
        'Some business registration evidence found',
        'Requires additional verification for complete assessment'
      );
      
      recommendations.push(
        'Conduct standard enhanced due diligence procedures',
        'Verify OJK registration status if applicable to business type',
        'Monitor for additional risk signals during onboarding'
      );
      
      riskExplanation = `The moderate risk score reflects a balance between positive legitimacy indicators and areas of concern that require further investigation.`;
      
    } else {
      summary = `${name} demonstrates low fraud risk with a score of ${fraudScore}/100. The company shows strong legitimacy indicators consistent with established Indonesian business practices.`;
      
      keyFindings.push(
        'Strong business legitimacy indicators present',
        'Proper Indonesian business entity structure identified',
        'No significant fraud-related concerns detected'
      );
      
      recommendations.push(
        'Proceed with standard due diligence procedures',
        'Maintain routine monitoring as part of ongoing relationship',
        'Consider for streamlined onboarding process'
      );
      
      riskExplanation = `The low risk score is supported by clear business legitimacy indicators and absence of fraud-related warning signs.`;
    }
    
    businessContext = `This assessment considers Indonesian business regulatory environment including OJK oversight for financial services and standard PT/CV corporate structures. ${entityResolution ? `The company operates as a ${entityResolution.entityType} entity in the ${entityResolution.industry} sector within ${entityResolution.jurisdiction} jurisdiction.` : ''}`;
    
    const confidenceReasoning = `Assessment confidence of ${confidence}% is based on ${analysisResult.analysis?.webResearchImpact ? 'comprehensive web research findings combined with' : ''} AI analysis of company information and established fraud detection patterns for Indonesian businesses.`;
    
    return {
      success: true,
      data: {
        summary,
        keyFindings,
        riskExplanation,
        recommendations,
        confidenceReasoning,
        businessContext
      },
      source: 'mock_narrative'
    };
  }

  /**
   * Extracts key findings from analysis results
   */
  extractKeyFindings(analysisResult, maxFindings = 5) {
    const findings = [];
    
    // Extract from fraud indicators
    if (analysisResult.analysis?.fraudIndicators?.detectedKeywords?.length > 0) {
      findings.push(`Fraud keywords detected: ${analysisResult.analysis.fraudIndicators.detectedKeywords.slice(0, 2).join(', ')}`);
    }
    
    // Extract from legitimacy evidence
    if (analysisResult.analysis?.legitimacyEvidence?.businessMarkers?.length > 0) {
      findings.push(`Business legitimacy markers: ${analysisResult.analysis.legitimacyEvidence.businessMarkers.slice(0, 2).join(', ')}`);
    }
    
    // Extract from regulatory status
    if (analysisResult.analysis?.regulatoryWarnings?.score > 50) {
      findings.push('Regulatory compliance concerns identified');
    } else if (analysisResult.analysis?.regulatoryWarnings?.score < 30) {
      findings.push('Strong regulatory compliance indicators');
    }
    
    // Extract from web research
    if (analysisResult.analysis?.webResearchImpact?.dataQuality) {
      findings.push(`Web research quality: ${analysisResult.analysis.webResearchImpact.dataQuality}`);
    }
    
    // Extract from entity resolution if available
    if (analysisResult.entityResolution?.registrationStatus === 'registered') {
      findings.push('Confirmed business registration status');
    }
    
    return findings.slice(0, maxFindings);
  }

  /**
   * Generates risk explanation based on analysis components
   */
  generateRiskExplanation(analysisResult) {
    const { fraudScore, riskLevel } = analysisResult;
    const components = [];
    
    // Analyze each component's contribution
    if (analysisResult.analysis?.fraudIndicators?.score > 30) {
      components.push(`fraud indicators (${analysisResult.analysis.fraudIndicators.score}/100)`);
    }
    
    if (analysisResult.analysis?.legitimacyEvidence?.score > 50) {
      components.push(`strong legitimacy evidence (${analysisResult.analysis.legitimacyEvidence.score}/100)`);
    } else if (analysisResult.analysis?.legitimacyEvidence?.score < 30) {
      components.push(`weak legitimacy evidence (${analysisResult.analysis.legitimacyEvidence.score}/100)`);
    }
    
    if (analysisResult.analysis?.regulatoryWarnings?.score > 40) {
      components.push(`regulatory compliance concerns (${analysisResult.analysis.regulatoryWarnings.score}/100)`);
    }
    
    const explanation = `The ${riskLevel} risk assessment with a score of ${fraudScore}/100 is primarily based on ${components.join(', ')}.`;
    
    return explanation;
  }

  /**
   * Generates actionable recommendations based on risk level and findings
   */
  generateRecommendations(analysisResult, entityResolution = null) {
    const { riskLevel, fraudScore } = analysisResult;
    const recommendations = [];
    
    // Risk-level specific recommendations
    if (riskLevel === 'critical') {
      recommendations.push('Immediate manual review and investigation required');
      recommendations.push('Consider blocking all transactions until verification completed');
      recommendations.push('Report suspicious activity to relevant Indonesian authorities');
    } else if (riskLevel === 'high') {
      recommendations.push('Enhanced due diligence required before business engagement');
      recommendations.push('Verify all business documents with Indonesian regulatory authorities');
      recommendations.push('Implement enhanced monitoring if relationship proceeds');
    } else if (riskLevel === 'medium') {
      recommendations.push('Standard enhanced due diligence procedures recommended');
      recommendations.push('Additional verification of business registration and licenses');
      recommendations.push('Regular monitoring during initial business relationship period');
    } else {
      recommendations.push('Standard due diligence procedures sufficient');
      recommendations.push('Proceed with normal onboarding process');
      recommendations.push('Routine periodic monitoring as part of ongoing relationship');
    }
    
    // Industry-specific recommendations
    if (entityResolution?.industry === 'banking' || entityResolution?.industry === 'fintech') {
      recommendations.push('Verify OJK registration and compliance status');
      recommendations.push('Review financial services licensing requirements');
    }
    
    // Entity-type specific recommendations
    if (entityResolution?.entityType === 'tbk') {
      recommendations.push('Verify IDX listing status and trading information');
    }
    
    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  /**
   * Explains confidence reasoning based on data quality and analysis depth
   */
  explainConfidenceReasoning(analysisResult) {
    const { confidence } = analysisResult;
    const factors = [];
    
    // Data quality factors
    if (analysisResult.analysis?.webResearchImpact?.dataQuality) {
      const quality = analysisResult.analysis.webResearchImpact.dataQuality;
      if (quality === 'comprehensive' || quality === 'good') {
        factors.push('high-quality web research data');
      } else if (quality === 'limited') {
        factors.push('limited web research data available');
      } else {
        factors.push('minimal web research data');
      }
    }
    
    // Analysis coverage
    const analysisComponents = Object.keys(analysisResult.analysis || {}).length;
    if (analysisComponents >= 4) {
      factors.push('comprehensive multi-component analysis');
    } else if (analysisComponents >= 2) {
      factors.push('standard multi-component analysis');
    } else {
      factors.push('basic analysis coverage');
    }
    
    // Entity resolution quality
    if (analysisResult.entityResolution?.confidence > 0.8) {
      factors.push('high entity resolution confidence');
    } else if (analysisResult.entityResolution?.confidence > 0.5) {
      factors.push('moderate entity resolution confidence');
    }
    
    let reasoning = `Confidence level of ${confidence}% is based on ${factors.join(', ')}.`;
    
    // Add confidence interpretation
    if (confidence >= 80) {
      reasoning += ' This high confidence level indicates reliable assessment suitable for business decision-making.';
    } else if (confidence >= 60) {
      reasoning += ' This moderate confidence level suggests additional verification may be beneficial for critical decisions.';
    } else {
      reasoning += ' This lower confidence level indicates that additional manual review and verification is strongly recommended.';
    }
    
    return reasoning;
  }

  /**
   * Cleanup resources (web scraper browser)
   */
  async cleanup() {
    try {
      if (this.webScraper) {
        await this.webScraper.cleanup();
        console.log('🧹 Gemini service cleanup completed');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

export default GeminiService;
export { DataValidator, LegitimacyAnalyzer };