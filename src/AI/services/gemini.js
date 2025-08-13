import { GoogleGenerativeAI } from '@google/generative-ai';
import WebScrapingService from './web-scraper.js';

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
    const { name, description, industry, region } = companyData;
    
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
      prompt += `

**INTERNET RESEARCH FINDINGS:**
**OJK Registration Status:** ${webResearch.sources.ojk.registrationStatus}
- Found ${webResearch.sources.ojk.foundEntries} OJK-related entries
${webResearch.sources.ojk.details.length > 0 ? 
  '- Key findings: ' + webResearch.sources.ojk.details.map(d => d.title).join('; ') : ''}

**News Coverage Analysis:**
- Total articles found: ${webResearch.sources.news.totalArticles}
- News sentiment: ${webResearch.sources.news.sentiment}
- Fraud mentions: ${webResearch.sources.news.fraudMentions}
${webResearch.sources.news.articles.length > 0 ?
  '- Recent headlines: ' + webResearch.sources.news.articles.slice(0, 2).map(a => a.title).join('; ') : ''}

**Business Registration:**
- Registration status: ${webResearch.sources.businessInfo.businessRegistration}
- Digital footprint: ${webResearch.sources.businessInfo.digitalFootprint}
- Legitimacy signals: ${webResearch.sources.businessInfo.legitimacySignals.join(', ')}

**Fraud Reports:**
- Fraud reports found: ${webResearch.sources.fraudReports.fraudReportsFound}
- Risk assessment: ${webResearch.sources.fraudReports.riskLevel}
${webResearch.sources.fraudReports.warnings.length > 0 ?
  '- Warnings: ' + webResearch.sources.fraudReports.warnings.map(w => w.title).join('; ') : ''}

**Research Summary:**
- Overall risk from web research: ${webResearch.summary.overallRisk}
- Data confidence: ${webResearch.summary.confidence}%
- Key findings: ${webResearch.summary.keyFindings.join(', ')}
- Data quality: ${webResearch.summary.dataQuality}`;
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
   * Analyzes Indonesian company for fraud risk using Gemini AI with web research
   */
  async analyzeCompanyFraud(companyData) {
    try {
      console.log(`🔍 Starting enhanced fraud analysis for: ${companyData.name}`);
      
      // Step 1: Perform web research
      let webResearch = null;
      try {
        console.log('📡 Conducting web research...');
        webResearch = await this.webScraper.researchCompany(companyData.name, companyData.region);
        console.log(`✅ Web research completed - Quality: ${webResearch.summary?.dataQuality || 'unknown'}`);
      } catch (webError) {
        console.warn('⚠️ Web research failed, proceeding with basic analysis:', webError.message);
        webResearch = null;
      }

      // Step 2: Create enhanced prompt with web research
      const prompt = this.createIndonesianFraudPrompt(companyData, webResearch);
      
      // Handle test mode with mock responses (enhanced with web data)
      if (this.testMode) {
        return this.generateMockResponse(companyData, webResearch);
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
    const suspiciousKeywords = ['guaranteed', 'profit', 'ponzi', 'scam', 'money game', 'investasi bodong'];
    const legitimateKeywords = ['ojk', 'registered', 'terdaftar', 'certified', 'iso', 'bank', 'fintech'];
    
    const suspiciousCount = suspiciousKeywords.filter(keyword => text.includes(keyword)).length;
    const legitimateCount = legitimateKeywords.filter(keyword => text.includes(keyword)).length;
    
    let fraudScore;
    let riskLevel;
    let reasoning;
    
    // Enhance scoring with web research if available
    let webResearchImpact = 0;
    let webDataQuality = 'unavailable';
    let keyWebFindings = ['No web research conducted'];
    
    if (webResearch && !webResearch.fallback) {
      webDataQuality = webResearch.summary?.dataQuality || 'limited';
      keyWebFindings = webResearch.summary?.keyFindings || [];
      
      // Adjust score based on web research findings
      if (webResearch.summary?.overallRisk === 'high') {
        webResearchImpact = 20; // Increase risk
      } else if (webResearch.summary?.overallRisk === 'low') {
        webResearchImpact = -15; // Decrease risk
      }
      
      // Factor in OJK registration
      if (webResearch.sources?.ojk?.registrationStatus === 'registered') {
        webResearchImpact -= 10; // Lower risk
      } else if (webResearch.sources?.ojk?.registrationStatus === 'warning_issued') {
        webResearchImpact += 25; // Higher risk
      }
      
      // Factor in fraud reports
      if (webResearch.sources?.fraudReports?.fraudReportsFound > 0) {
        webResearchImpact += 15; // Higher risk
      }
    }
    
    // Base scoring logic
    if (suspiciousCount > 1) {
      fraudScore = 75 + Math.random() * 20 + webResearchImpact;
      riskLevel = fraudScore > 80 ? 'critical' : 'high';
      reasoning = `Multiple fraud indicators detected in company description${webResearch ? ' and web research findings' : ''}`;
    } else if (legitimateCount > 1) {
      fraudScore = 15 + Math.random() * 20 + webResearchImpact;
      riskLevel = fraudScore < 25 ? 'low' : 'medium';
      reasoning = `Strong legitimacy indicators found${webResearch ? ' supported by web research' : ''}, appears to be legitimate business`;
    } else {
      fraudScore = 40 + Math.random() * 20 + webResearchImpact;
      riskLevel = fraudScore > 60 ? 'high' : (fraudScore > 40 ? 'medium' : 'low');
      reasoning = `Mixed signals detected${webResearch ? ' in both company data and web research' : ''}, requires further investigation`;
    }
    
    // Ensure score stays within bounds
    fraudScore = Math.max(0, Math.min(100, fraudScore));
    
    return {
      success: true,
      data: {
        fraudScore: Math.round(fraudScore),
        riskLevel,
        confidence: 85,
        analysis: {
          ojkCompliance: {
            score: legitimateCount > 0 ? 80 : 40,
            issues: suspiciousCount > 0 ? ['Potential regulatory compliance concerns'] : [],
            positives: legitimateCount > 0 ? ['Proper registration indicated'] : []
          },
          fraudIndicators: {
            score: suspiciousCount * 30,
            detectedKeywords: suspiciousKeywords.filter(k => text.includes(k)),
            riskFactors: suspiciousCount > 0 ? ['Suspicious language patterns'] : []
          },
          legitimacySignals: {
            score: legitimateCount * 25,
            businessMarkers: legitimateKeywords.filter(k => text.includes(k)),
            concerns: suspiciousCount > 0 ? ['Potential fraud indicators present'] : []
          },
          webResearchImpact: {
            score: Math.round(Math.abs(webResearchImpact) * 5), // Convert impact to 0-100 scale
            keyFindings: keyWebFindings,
            dataQuality: webDataQuality
          }
        },
        reasoning,
        recommendations: riskLevel === 'high' ? ['Manual review required', 'Request additional documentation'] : ['Standard verification process'],
        requiresManualReview: riskLevel === 'high'
      },
      rawResponse: '[MOCK RESPONSE]',
      timestamp: new Date().toISOString()
    };
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