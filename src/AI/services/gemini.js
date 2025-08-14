import { GoogleGenerativeAI } from '@google/generative-ai';
import WebScrapingService from './web-scraper.js';

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

    return {
      isValid: issues.length === 0,
      issues,
      cleanedData: validatedData
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
      if (!['comprehensive', 'good', 'limited', 'minimal', 'unavailable'].includes(summary.dataQuality)) {
        issues.push(`Invalid data quality level: ${summary.dataQuality}`);
        cleanedData.dataQuality = 'unavailable';
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

    // Validate optional fields
    if (companyData.industry !== undefined) {
      if (typeof companyData.industry !== 'string') {
        issues.push('Industry must be a string');
        cleanedData.industry = 'unknown';
      } else {
        cleanedData.industry = companyData.industry.trim().substring(0, 100);
      }
    } else {
      cleanedData.industry = 'unknown';
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
 */
class LegitimacyAnalyzer {
  static analyzeLegitimacySignals(companyData, webResearch = null) {
    const { name, description } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Enhanced legitimacy keywords with weights
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
      { keyword: 'pt ', weight: 14 },
      { keyword: 'cv ', weight: 14 },
      { keyword: ' tbk', weight: 14 },
      { keyword: 'bank', weight: 13 },
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
      { keyword: 'business', weight: 5 }
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
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
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
   * Creates specialized Indonesian fraud detection prompt with web research data
   */
  createIndonesianFraudPrompt(companyData, webResearch = null) {
    // Validate company data before creating prompt
    const validation = this.dataValidator.validateCompanyData(companyData);
    if (!validation.isValid) {
      throw new Error(`Invalid company  ${validation.issues.join(', ')}`);
    }
    
    const { name, description, industry, region } = validation.cleanedData;
    
    // Build enhanced prompt with web research
    let prompt = `
Analyze the following Indonesian company for fraud risk using your knowledge of Indonesian business practices, regulatory environment, and fraud patterns. Provide a comprehensive fraud risk assessment.

**COMPANY INFORMATION:**
- Name: ${name}
- Description: ${description}
- Industry: ${industry || 'Not specified'}
- Region: ${region || 'Indonesia'}`;

    // Add web research section if available
    if (webResearch && !webResearch.fallback) {
      // Validate web research data
      const webValidation = this.dataValidator.validateWebResearchData(webResearch);
      const validatedWebData = webValidation.isValid ? webValidation.cleanedData : webResearch;
      
      prompt += `

**INTERNET RESEARCH FINDINGS:**
**OJK Registration Status:** ${validatedWebData.sources.ojk.registrationStatus}
- Found ${validatedWebData.sources.ojk.foundEntries} OJK-related entries
${validatedWebData.sources.ojk.details.length > 0 ? 
  '- Key findings: ' + validatedWebData.sources.ojk.details.map(d => d.title).join('; ') : ''}

**News Coverage Analysis:**
- Total articles found: ${validatedWebData.sources.news.totalArticles}
- News sentiment: ${validatedWebData.sources.news.sentiment}
- Fraud mentions: ${validatedWebData.sources.news.fraudMentions}
${validatedWebData.sources.news.articles.length > 0 ?
  '- Recent headlines: ' + validatedWebData.sources.news.articles.slice(0, 2).map(a => a.title).join('; ') : ''}

**Business Registration:**
- Registration status: ${validatedWebData.sources.businessInfo.businessRegistration}
- Digital footprint: ${validatedWebData.sources.businessInfo.digitalFootprint}
- Legitimacy signals: ${validatedWebData.sources.businessInfo.legitimacySignals.join(', ')}

**Fraud Reports:**
- Fraud reports found: ${validatedWebData.sources.fraudReports.fraudReportsFound}
- Risk assessment: ${validatedWebData.sources.fraudReports.riskLevel}
${validatedWebData.sources.fraudReports.warnings.length > 0 ?
  '- Warnings: ' + validatedWebData.sources.fraudReports.warnings.map(w => w.title).join('; ') : ''}

**Research Summary:**
- Overall risk from web research: ${validatedWebData.summary.overallRisk}
- Data confidence: ${validatedWebData.summary.confidence}%
- Key findings: ${validatedWebData.summary.keyFindings.join(', ')}
- Data quality: ${validatedWebData.summary.dataQuality}`;
    }

    prompt += `

**ANALYSIS FRAMEWORK:**
Please analyze this company using these Indonesian-specific criteria (considering both provided information and internet research findings):`;

    return prompt + `

1. **OJK REGULATORY COMPLIANCE** (Weight: 30%)
   - Does this appear to be a legitimate Indonesian financial services company?
   - Are there any OJK registration requirements they should meet?
   - Look for mentions of proper licensing (OJK, Bank Indonesia, Ministry approvals)
   - Check for compliance with Indonesian financial regulations
   ${webResearch ? '- Consider the internet research findings about OJK registration status' : ''}

2. **INDONESIAN FRAUD INDICATORS** (Weight: 25%)
   - Scan for Indonesian fraud keywords: "investasi bodong", "skema ponzi", "money game", "penipuan", "scam"
   - Look for unrealistic profit promises common in Indonesian investment scams
   - Check for pyramid scheme language or MLM red flags
   - Analyze for "get rich quick" schemes targeting Indonesian investors
   ${webResearch ? '- Consider news reports and fraud mentions found in internet research' : ''}

3. **BUSINESS LEGITIMACY SIGNALS** (Weight: 25%)
   - Look for proper Indonesian business entity indicators: "PT", "CV", "Tbk"
   - Check for mentions of NPWP, NIB, or other Indonesian business registration
   - Analyze for professional business language vs. suspicious marketing speak
   - Look for established business operations vs. new/vague ventures
   ${webResearch ? '- Consider business registration and legitimacy signals from internet research' : ''}

4. **DIGITAL FOOTPRINT & CREDIBILITY** (Weight: 15%)
   - Consider Indonesian business environment and practices
   - Analyze cultural and language patterns for authenticity
   - Consider industry norms in Indonesian market
   ${webResearch ? '- Evaluate digital footprint and online presence found in research' : ''}

5. **RED FLAGS DETECTION** (Weight: 5%)
   - Guaranteed returns or "risk-free" investments
   - Pressure tactics or urgency language
   - Vague business models or unclear revenue sources
   - Celebrity endorsements without substance
   - Targeting of specific demographics (elderly, students, etc.)
   ${webResearch ? '- Consider any warnings or negative reports from internet research' : ''}

**OUTPUT REQUIREMENTS:**
Respond with a JSON object in this exact format:

{
  "fraudScore": [0-100 integer],
  "riskLevel": "[low|medium|high|critical]",
  "confidence": [0-100 integer],
  "analysis": {
    "ojkCompliance": {
      "score": [0-100],
      "issues": ["list of compliance concerns"],
      "positives": ["list of compliance strengths"]
    },
    "fraudIndicators": {
      "score": [0-100],
      "detectedKeywords": ["list of fraud keywords found"],
      "riskFactors": ["list of specific risk factors"]
    },
    "legitimacySignals": {
      "score": [0-100],
      "businessMarkers": ["list of legitimate business indicators"],
      "concerns": ["list of legitimacy concerns"]
    },
    "webResearchImpact": {
      "score": [0-100],
      "keyFindings": ["list of important internet research findings"],
      "dataQuality": "[comprehensive|good|limited|minimal|unavailable]"
    }
  },
  "reasoning": "Brief explanation of the overall assessment incorporating all available data",
  "recommendations": ["list of specific recommendations"],
  "requiresManualReview": boolean
}

**SCORING GUIDE:**
- 0-20: Very Low Risk (Highly legitimate, strong compliance indicators, positive internet research)
- 21-40: Low Risk (Generally legitimate with minor concerns, neutral/positive research)
- 41-60: Medium Risk (Mixed signals, requires closer examination, limited research data)
- 61-80: High Risk (Multiple red flags, significant concerns, negative internet findings)
- 81-100: Critical Risk (Clear fraud indicators, immediate attention required, fraud reports found)

**IMPORTANT NOTES:**
- Give significant weight to internet research findings when available
- Be sensitive to legitimate Indonesian businesses that may have limited digital presence
- Consider that traditional Indonesian businesses may not have extensive online footprints
- Account for language variations and local business practices
- Distinguish between companies offering fraud prevention services vs. fraudulent companies
- Consider the regulatory environment and typical business practices in Indonesia
${webResearch ? '- Prioritize factual internet research findings over general assumptions' : ''}

Begin your analysis now:`;
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
    const { name, description, industry } = companyData;
    const text = `${name} ${description}`.toLowerCase();
    
    // Basic keyword scoring
    const suspiciousKeywords = ['guaranteed', 'risk-free', 'ponzi', 'scam'];
    const legitimateKeywords = ['registered', 'licensed', 'certified', 'ojk'];
    
    let riskScore = 50; // Start neutral
    
    for (const keyword of suspiciousKeywords) {
      if (text.includes(keyword)) riskScore += 20;
    }
    
    for (const keyword of legitimateKeywords) {
      if (text.includes(keyword)) riskScore -= 15;
    }
    
    // Industry adjustments
    const highRiskIndustries = ['investment', 'cryptocurrency', 'lending'];
    if (highRiskIndustries.includes(industry)) {
      riskScore += 10;
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
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON response found in Gemini output');
      }
      
      const analysisResult = JSON.parse(jsonMatch[0]);
      
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
          ojkCompliance: {
            score: this.calculateOJKComplianceScore(companyData, legitimateCount),
            issues: suspiciousCount > 0 ? ['Potential regulatory compliance concerns'] : [],
            positives: legitimateCount > 0 ? ['Proper registration indicated'] : []
          },
          fraudIndicators: {
            score: suspiciousCount * 30,
            detectedKeywords: suspiciousKeywords.filter(k => text.includes(k)),
            riskFactors: suspiciousCount > 0 ? ['Suspicious language patterns'] : []
          },
          legitimacySignals: legitimacyAnalysis,
          webResearchImpact: {
            score: Math.round(Math.abs(webResearchImpact) * 5), // Convert impact to 0-100 scale
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