import { GoogleGenerativeAI } from '@google/generative-ai';

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
    
    // Indonesian fraud detection configuration
    this.config = {
      temperature: 0.1, // Low temperature for consistent, factual analysis
      topK: 1,
      topP: 0.1,
      maxOutputTokens: 2048,
    };
  }

  /**
   * Creates specialized Indonesian fraud detection prompt
   */
  createIndonesianFraudPrompt(companyData) {
    const { name, description, industry, region } = companyData;
    
    return `
Analyze the following Indonesian company for fraud risk using your knowledge of Indonesian business practices, regulatory environment, and fraud patterns. Provide a comprehensive fraud risk assessment.

**COMPANY INFORMATION:**
- Name: ${name}
- Description: ${description}
- Industry: ${industry || 'Not specified'}
- Region: ${region || 'Indonesia'}

**ANALYSIS FRAMEWORK:**
Please analyze this company using these Indonesian-specific criteria:

1. **OJK REGULATORY COMPLIANCE** (Weight: 30%)
   - Does this appear to be a legitimate Indonesian financial services company?
   - Are there any OJK registration requirements they should meet?
   - Look for mentions of proper licensing (OJK, Bank Indonesia, Ministry approvals)
   - Check for compliance with Indonesian financial regulations

2. **INDONESIAN FRAUD INDICATORS** (Weight: 25%)
   - Scan for Indonesian fraud keywords: "investasi bodong", "skema ponzi", "money game", "penipuan", "scam"
   - Look for unrealistic profit promises common in Indonesian investment scams
   - Check for pyramid scheme language or MLM red flags
   - Analyze for "get rich quick" schemes targeting Indonesian investors

3. **BUSINESS LEGITIMACY SIGNALS** (Weight: 25%)
   - Look for proper Indonesian business entity indicators: "PT", "CV", "Tbk"
   - Check for mentions of NPWP, NIB, or other Indonesian business registration
   - Analyze for professional business language vs. suspicious marketing speak
   - Look for established business operations vs. new/vague ventures

4. **REGIONAL CONTEXT** (Weight: 15%)
   - Consider Indonesian business environment and practices
   - Account for regional variations (Jakarta, Surabaya, Bandung vs. smaller cities)
   - Analyze cultural and language patterns for authenticity
   - Consider industry norms in Indonesian market

5. **RED FLAGS DETECTION** (Weight: 5%)
   - Guaranteed returns or "risk-free" investments
   - Pressure tactics or urgency language
   - Vague business models or unclear revenue sources
   - Celebrity endorsements without substance
   - Targeting of specific demographics (elderly, students, etc.)

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
    "regionalContext": {
      "score": [0-100],
      "contextualFactors": ["relevant regional business factors"],
      "industryFit": "assessment of industry appropriateness"
    }
  },
  "reasoning": "Brief explanation of the overall assessment",
  "recommendations": ["list of specific recommendations"],
  "requiresManualReview": boolean
}

**SCORING GUIDE:**
- 0-20: Very Low Risk (Highly legitimate, strong compliance indicators)
- 21-40: Low Risk (Generally legitimate with minor concerns)
- 41-60: Medium Risk (Mixed signals, requires closer examination)
- 61-80: High Risk (Multiple red flags, significant concerns)
- 81-100: Critical Risk (Clear fraud indicators, immediate attention required)

**IMPORTANT NOTES:**
- Be sensitive to legitimate Indonesian businesses that may have limited digital presence
- Consider that traditional Indonesian businesses may not have extensive online footprints
- Account for language variations and local business practices
- Distinguish between companies offering fraud prevention services vs. fraudulent companies
- Consider the regulatory environment and typical business practices in Indonesia

Begin your analysis now:`;
  }

  /**
   * Analyzes Indonesian company for fraud risk using Gemini AI
   */
  async analyzeCompanyFraud(companyData) {
    try {
      const prompt = this.createIndonesianFraudPrompt(companyData);
      
      // Handle test mode with mock responses
      if (this.testMode) {
        return this.generateMockResponse(companyData);
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
   * Generates mock response for testing purposes
   */
  generateMockResponse(companyData) {
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
    
    if (suspiciousCount > 1) {
      fraudScore = 75 + Math.random() * 20; // 75-95
      riskLevel = 'high';
      reasoning = 'Multiple fraud indicators detected in company description';
    } else if (legitimateCount > 1) {
      fraudScore = 15 + Math.random() * 20; // 15-35
      riskLevel = 'low';
      reasoning = 'Strong legitimacy indicators found, appears to be legitimate business';
    } else {
      fraudScore = 40 + Math.random() * 20; // 40-60
      riskLevel = 'medium';
      reasoning = 'Mixed signals detected, requires further investigation';
    }
    
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
          regionalContext: {
            score: 70,
            contextualFactors: ['Indonesian business environment'],
            industryFit: 'Standard Indonesian business practices'
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
      const testPrompt = 'Respond with "OK" if you can process this message.';
      const result = await this.model.generateContent(testPrompt);
      const response = await result.response;
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
}

export default GeminiService;