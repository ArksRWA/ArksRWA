import express from 'express';
import Joi from 'joi';
import FraudAnalyzer from '../services/fraud-analyzer.js';
import { serpAPIService } from '../services/serpapi-service.js';

const router = express.Router();
const fraudAnalyzer = new FraudAnalyzer();

// Request validation schema - Evidence-based analysis only
const companyAnalysisSchema = Joi.object({
  name: Joi.string().required().min(1).max(200),
  description: Joi.string().required().min(10).max(2000)
});


/**
 * GET /test-connection
 * Test endpoint to verify service connectivity
 */
router.get('/test-connection', async (req, res) => {
  try {
    // Test Gemini API connection
    const geminiTest = await fraudAnalyzer.geminiService.testConnection();
    
    res.json({
      success: true,
      service: 'ARKS RWA AI Fraud Detection',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      tests: {
        geminiApi: geminiTest.success,
        analyzer: true
      },
      status: 'healthy'
    });
    
  } catch (error) {
    console.error('Connection test error:', error);
    
    res.status(503).json({
      success: false,
      error: 'Service health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /analyze
 * NEW: Enhanced fraud analysis using SerpAPI + Gemini AI with 15-minute timeout support
 * Superior data quality and evidence-based scoring
 */
router.post('/analyze', async (req, res) => {
  // Set extended timeout for this request (15 minutes)
  const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS) || 900000; // 15 minutes
  req.setTimeout(requestTimeout);
  res.setTimeout(requestTimeout);
  
  // Create timeout promise for graceful handling
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Analysis timeout: Request exceeded ${requestTimeout/60000} minutes limit`));
    }, requestTimeout);
  });
  
  try {
    // Validate request data
    const { error, value } = companyAnalysisSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const companyData = value;
    
    // Log SerpAPI analysis request with timeout info
    console.log(`🔍 Starting SerpAPI-enhanced analysis for: ${companyData.name}`);
    console.log(`⏱️ Request timeout set to: ${requestTimeout}ms (${requestTimeout/60000} minutes)`);
    
    // Perform SerpAPI-enhanced fraud analysis with timeout protection
    const analysisStart = Date.now();
    const analysisPromise = fraudAnalyzer.analyzeCompanyWithSerpAPI(companyData);
    
    // Race between analysis and timeout
    const result = await Promise.race([analysisPromise, timeoutPromise]);
    const analysisTime = Date.now() - analysisStart;
    
    console.log(`✅ SerpAPI analysis completed in ${analysisTime}ms - Score: ${result.fraudScore}, Risk: ${result.riskLevel}`);
    
    // Extract data sources using the same method as traditional analysis
    const dataSources = router.extractDataSources(result);
    
    // Prepare enhanced response with full pipeline results
    const response = {
      success: true,
      data: {
        companyName: companyData.name,
        fraudScore: result.fraudScore,
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        methodology: result.source || 'serpapi_enhanced_intelligent_analysis',
        
        // Enhanced analysis structure
        analysis: result.analysis,
        
        // Entity Resolution (from enhanced pipeline)
        entityResolution: result.analysis?.entity || {
          canonicalName: companyData.name,
          entityType: 'unknown',
          industry: 'unknown',
          jurisdiction: 'Indonesia',
          registrationStatus: 'unknown',
          aliases: [companyData.name],
          confidence: 0.5
        },
        
        // Evidence breakdown (from full pipeline)
        evidenceBreakdown: result.analysis?.evidence || [],
        
        // Website verification with badges
        verification: result.verification || {
          country: 'ID',
          websiteVerified: false,
          badges: []
        },
        
        // Data sources (comprehensive extraction)
        dataSources: dataSources,
        
        // Processing details
        processingDetails: {
          ...result.performance,
          processingTime: analysisTime,
          timestamp: new Date().toISOString()
        },
        
        // SerpAPI-specific metrics (if available)
        serpAPIMetrics: {
          searchesExecuted: result.performance?.resourcesUsed?.serpAPISearches || 0,
          totalResults: result.stageResults?.stage2_scraping?.serpAPIResults?.summary?.totalResults || 0,
          fraudIndicators: result.stageResults?.stage2_scraping?.serpAPIResults?.summary?.fraudIndicators || 0,
          legitimacySignals: result.stageResults?.stage2_scraping?.serpAPIResults?.summary?.legitimacySignals || 0,
          earlyTermination: result.performance?.resourcesUsed?.earlyTermination || false,
          quotaUsed: serpAPIService.getStats().quotaUsed
        }
      },
      
      // Include raw data for debugging (optional)
      debug: process.env.NODE_ENV === 'development' ? {
        stageResults: result.stageResults,
        performance: result.performance,
        fullAnalysis: result.analysis
      } : undefined,
      
      metadata: {
        version: '1.0.0',
        source: result.source || 'serpapi_enhanced_analysis',
        cached: result.source === 'cache_serpapi'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error(`SerpAPI analysis error for ${req.body?.name || 'unknown'}:`, error);
    
    // Handle SerpAPI quota/configuration errors specifically
    if (error.message.includes('quota exhausted') || 
        error.message.includes('SerpAPI key not configured') ||
        error.message.includes('SerpAPI service unavailable')) {
      return res.status(503).json({
        success: false,
        error: 'SerpAPI Service Unavailable',
        message: error.message,
        details: {
          issue: 'SerpAPI quota exhausted or misconfigured',
          solution: 'Please check SerpAPI quota limits and API key configuration',
          retryAfter: 'Try again tomorrow when quota resets'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle Gemini API quota/configuration errors specifically
    if (error.message.includes('Gemini API quota exhausted') ||
        error.message.includes('429 Too Many Requests') ||
        error.message.includes('exceeded your current quota') ||
        error.message.includes('GoogleGenerativeAIError') ||
        error.message.includes('generate_content_free_tier_requests')) {
      return res.status(429).json({
        success: false,
        error: 'Gemini AI Service Quota Exhausted',
        message: error.message,
        details: {
          issue: 'Gemini API daily quota exceeded',
          solution: 'Please check your Gemini API quota limits and billing details',
          retryAfter: 'Try again tomorrow when quota resets',
          moreInfo: 'https://ai.google.dev/gemini-api/docs/rate-limits'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle timeout specifically
    if (error.message.includes('timeout') || error.message.includes('exceeded')) {
      return res.status(408).json({
        success: false,
        error: 'Analysis timeout',
        message: `Analysis exceeded the ${requestTimeout/60000}-minute time limit`,
        details: {
          timeoutMs: requestTimeout,
          timeoutMinutes: requestTimeout/60000,
          suggestion: 'Try with a simpler company analysis or check if the company exists',
          fallbackAvailable: false
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error.message,
      details: {
        issue: 'Unexpected error during analysis',
        suggestion: 'Please try again or contact support if the issue persists'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /serpapi/stats
 * Get SerpAPI service statistics and quota information
 */
router.get('/serpapi/stats', (req, res) => {
  try {
    const stats = serpAPIService.getStats();
    
    res.json({
      success: true,
      data: {
        quotaUsed: stats.quotaUsed,
        quotaRemaining: stats.quotaRemaining,
        quotaTotal: stats.quotaUsed + stats.quotaRemaining,
        cacheSize: stats.cacheSize,
        lastReset: stats.lastReset,
        isOperational: stats.isOperational,
        apiKeyConfigured: stats.isOperational
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get SerpAPI stats',
      message: error.message
    });
  }
});

/**
 * POST /serpapi/search
 * Direct SerpAPI search endpoint for testing
 */
router.post('/serpapi/search', async (req, res) => {
  try {
    const { companyName, searchTypes = ['general', 'news'], priority = 'balanced' } = req.body;
    
    if (!companyName || typeof companyName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Company name is required'
      });
    }
    
    console.log(`🔍 Direct SerpAPI search for: ${companyName}`);
    
    const searchStart = Date.now();
    const results = await serpAPIService.analyzeCompany(companyName, {
      priority,
      skipOnConclusiveEvidence: false,
      maxSearches: Math.min(searchTypes.length, 5)
    });
    
    const searchTime = Date.now() - searchStart;
    
    res.json({
      success: true,
      data: {
        companyName,
        searchResults: results,
        processingTime: searchTime,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Direct SerpAPI search error:', error);
    
    res.status(500).json({
      success: false,
      error: 'SerpAPI search failed',
      message: error.message
    });
  }
});

/**
 * Extract comprehensive data sources information from analysis result
 * Provides transparency about where fraud detection data comes from
 */
router.extractDataSources = function(analysisResult) {
  const dataSources = {
    summary: {
      totalSources: 0,
      sourcesScraped: 0,
      dataQuality: 'unknown',
      aiEnhanced: false
    },
    sources: [],
    searchTerms: {
      totalTermsUsed: 0,
      categories: []
    },
    performance: {
      scrapingTimeMs: 0,
      earlyTermination: false,
      efficiency: 'unknown'
    }
  };

  try {
    // Log the structure for debugging
    console.log('🔍 Extracting data sources from result:', {
      hasStageResults: !!analysisResult.stageResults,
      hasAnalysis: !!analysisResult.analysis,
      source: analysisResult.source
    });
    
    // Extract from stage results (enhanced analysis)
    if (analysisResult.stageResults?.stage2_scraping) {
      const scrapingData = analysisResult.stageResults.stage2_scraping;
      
      // Summary information
      dataSources.summary.sourcesScraped = scrapingData.sourcesScraped || 0;
      dataSources.summary.dataQuality = scrapingData.summary?.dataQuality || 'unknown';
      dataSources.summary.aiEnhanced = true;
      
      // Performance information
      dataSources.performance.scrapingTimeMs = scrapingData.processingTimeMs || 0;
      dataSources.performance.earlyTermination = scrapingData.intelligence?.earlyTermination || false;
      dataSources.performance.efficiency = scrapingData.summary?.processingEfficiency || 'unknown';
      
      // Search terms information
      if (scrapingData.searchTermsUsed) {
        const searchTerms = scrapingData.searchTermsUsed;
        dataSources.searchTerms.totalTermsUsed = Object.values(searchTerms).flat().length;
        dataSources.searchTerms.categories = Object.keys(searchTerms);
      }
      
      // Individual sources information
      if (scrapingData.sources) {
        const sources = scrapingData.sources;
        
        // IDX (Indonesia Stock Exchange) Source - Tier-0 Evidence
        if (sources.idx) {
          dataSources.sources.push({
            name: 'IDX (Indonesia Stock Exchange)',
            type: 'regulatory',
            tier: 0, // Highest tier evidence
            baseUrl: 'https://www.idx.co.id',
            urls: ['https://www.idx.co.id'],
            isListed: sources.idx.isListed || false,
            ticker: sources.idx.ticker || null,
            sector: sources.idx.sector || null,
            resultsFound: sources.idx.isListed ? 1 : 0,
            dataQuality: sources.idx.isListed ? 'excellent' : 'minimal',
            evidence: sources.idx.evidence || []
          });
        }
        
        // OJK (Financial Authority) Source
        if (sources.ojk) {
          // Extract specific OJK URLs from details
          const ojkUrls = sources.ojk.details
            ?.map(detail => detail.url)
            .filter(url => url && url !== '')
            .slice(0, 5) || ['https://www.ojk.go.id'];
          
          dataSources.sources.push({
            name: 'OJK (Financial Services Authority)',
            type: 'regulatory',
            tier: 1, // Tier-1 evidence
            baseUrl: 'https://www.ojk.go.id',
            urls: ojkUrls,
            searchQuery: sources.ojk.searchQuery || 'OJK database search',
            resultsFound: sources.ojk.foundEntries || 0,
            dataQuality: sources.ojk.foundEntries > 0 ? 'good' : 'minimal',
            registrationStatus: sources.ojk.registrationStatus || 'unknown',
            details: sources.ojk.details?.map(detail => ({
              title: detail.title,
              url: detail.url,
              relevance: detail.relevanceScore || 'unknown'
            })) || []
          });
        }
        
        // News Sources
        if (sources.news) {
          // Extract URLs from news articles with better validation
          const newsUrls = [];
          const validArticles = [];
          
          if (sources.news.articles && Array.isArray(sources.news.articles)) {
            for (const article of sources.news.articles) {
              if (article && typeof article === 'object' && article.url && article.title) {
                newsUrls.push(article.url);
                validArticles.push({
                  title: article.title,
                  url: article.url,
                  sentiment: article.sentiment || 'neutral',
                  source: article.source || 'unknown'
                });
              }
            }
          }
          
          // Generate fallback URLs for Indonesian news sites if no articles found
          const fallbackUrls = newsUrls.length === 0 ? [
            'https://www.detik.com',
            'https://www.kompas.com', 
            'https://www.tribunnews.com'
          ] : newsUrls.slice(0, 5);
          
          const uniqueDomains = [...new Set(
            fallbackUrls.map(url => {
              try {
                return new URL(url).hostname;
              } catch {
                return url.replace(/^https?:\/\//, '').split('/')[0];
              }
            })
          )];
          
          dataSources.sources.push({
            name: 'Indonesian News Media',
            type: 'news_coverage',
            urls: fallbackUrls,
            domains: uniqueDomains,
            resultsFound: sources.news.totalArticles || 0,
            dataQuality: sources.news.totalArticles > 3 ? 'good' : sources.news.totalArticles > 0 ? 'limited' : 'minimal',
            sentiment: sources.news.sentiment || 'neutral',
            fraudMentions: sources.news.fraudMentions || 0,
            searchStatus: newsUrls.length === 0 ? 'no_articles_found' : 'articles_found',
            details: validArticles.slice(0, 3)
          });
        }
        
        // Business Information Sources
        if (sources.businessInfo) {
          // Extract business directory URLs if available
          const businessUrls = [];
          if (sources.businessInfo.sources) {
            sources.businessInfo.sources.forEach(source => {
              if (source.url) businessUrls.push(source.url);
            });
          }
          
          dataSources.sources.push({
            name: 'Business Directories & Registries',
            type: 'business_verification',
            urls: businessUrls.length > 0 ? businessUrls : ['Various business directories'],
            resultsFound: sources.businessInfo.legitimacySignals?.length || 0,
            dataQuality: sources.businessInfo.legitimacySignals?.length > 2 ? 'good' : 'limited',
            digitalFootprint: sources.businessInfo.digitalFootprint || 'minimal',
            legitimacySignals: sources.businessInfo.legitimacySignals || []
          });
        }
        
        // Fraud Reports Sources
        if (sources.fraudReports) {
          // Extract fraud report URLs if available
          const fraudUrls = [];
          if (sources.fraudReports.sources) {
            sources.fraudReports.sources.forEach(source => {
              if (source.url) fraudUrls.push(source.url);
            });
          }
          
          dataSources.sources.push({
            name: 'Fraud Report Databases',
            type: 'fraud_intelligence',
            urls: fraudUrls.length > 0 ? fraudUrls : ['Fraud intelligence databases'],
            resultsFound: sources.fraudReports.fraudReportsFound || 0,
            dataQuality: sources.fraudReports.fraudReportsFound > 0 ? 'critical' : 'minimal',
            riskLevel: sources.fraudReports.riskLevel || 'unknown',
            warnings: sources.fraudReports.warnings || []
          });
        }
        
        // Enhanced sources (additional Indonesian sources)
        if (sources.enhanced) {
          Object.entries(sources.enhanced).forEach(([sourceName, sourceData]) => {
            if (Array.isArray(sourceData) && sourceData.length > 0) {
              // Extract specific URLs from enhanced source data
              const enhancedUrls = sourceData
                .map(result => result.url)
                .filter(url => url && url !== '')
                .slice(0, 5);
              
              dataSources.sources.push({
                name: router.getSourceDisplayName(sourceName),
                type: 'specialized_research',
                baseUrl: router.getSourceBaseUrl(sourceName),
                urls: enhancedUrls.length > 0 ? enhancedUrls : [router.getSourceBaseUrl(sourceName)],
                resultsFound: sourceData.length,
                dataQuality: sourceData.length > 3 ? 'good' : 'limited',
                specialization: sourceData[0]?.sourceSpecialization || 'general',
                details: sourceData.slice(0, 3).map(result => ({
                  title: result.title,
                  url: result.url,
                  relevance: result.relevanceScore || 'unknown'
                }))
              });
            }
          });
        }
      }
    }
    
    // Extract from legacy analysis (fallback)
    else if (analysisResult.analysis?.webResearch) {
      const webResearch = analysisResult.analysis.webResearch;
      dataSources.summary.sourcesScraped = webResearch.sourcesUsed || 0;
      dataSources.summary.dataQuality = webResearch.dataQuality || 'unknown';
      dataSources.summary.aiEnhanced = false;
      
      // Add basic source information
      if (webResearch.keyFindings && webResearch.keyFindings.length > 0) {
        dataSources.sources.push({
          name: 'Basic Web Research',
          type: 'general',
          urls: ['General web search results'],
          resultsFound: webResearch.sourcesUsed || 0,
          dataQuality: webResearch.dataQuality || 'unknown',
          keyFindings: webResearch.keyFindings
        });
      }
    }
    
    // Basic fallback - create minimal source information
    else {
      console.log('📋 Using basic fallback for data sources');
      dataSources.summary.dataQuality = 'basic';
      dataSources.summary.aiEnhanced = analysisResult.source?.includes('ai') || false;
      
      // Create basic source entry based on analysis type
      if (analysisResult.analysis?.ai || analysisResult.analysis?.combined) {
        dataSources.sources.push({
          name: 'AI-Enhanced Analysis',
          type: 'ai_analysis',
          urls: ['Internal AI analysis'],
          resultsFound: 1,
          dataQuality: 'internal',
          credibility: 'high',
          priority: 2,
          analysisType: analysisResult.analysis?.combined ? 'combined' : 'ai_only'
        });
      }
      
      if (analysisResult.analysis?.ruleBased) {
        dataSources.sources.push({
          name: 'Rule-Based Analysis',
          type: 'rule_based',
          urls: ['Internal rule-based patterns'],
          resultsFound: 1,
          dataQuality: 'internal',
          credibility: 'medium',
          priority: 3,
          patterns: Object.keys(analysisResult.analysis.ruleBased)
        });
      }
      
      // Add basic performance information
      if (analysisResult.performance) {
        dataSources.performance.scrapingTimeMs = analysisResult.performance.totalTimeMs || 0;
        dataSources.performance.efficiency = analysisResult.performance.efficiency || 'unknown';
      }
    }
    
    // Calculate total sources
    dataSources.summary.totalSources = dataSources.sources.length;
    
    // Add source credibility information
    dataSources.sources.forEach(source => {
      if (!source.credibility) {
        source.credibility = router.assessSourceCredibility(source.type, source.name);
      }
      if (!source.priority) {
        source.priority = router.getSourcePriority(source.type);
      }
    });
    
  } catch (error) {
    console.error('Error extracting data sources:', error);
    dataSources.summary.error = 'Failed to extract source information';
  }
  
  return dataSources;
};

/**
 * Get display name for Indonesian sources
 */
router.getSourceDisplayName = function(sourceName) {
  const sourceNames = {
    'ppatk': 'PPATK (Financial Intelligence Unit)',
    'ahu': 'AHU (Ministry of Law & Human Rights)',
    'tribunnews': 'Tribun News',
    'tempo': 'Tempo Magazine',
    'kaskus': 'Kaskus Forum',
    'yellowpages': 'Yellow Pages Indonesia',
    'detik': 'Detik News',
    'kompas': 'Kompas News'
  };
  return sourceNames[sourceName] || sourceName;
};

/**
 * Get base URL for sources
 */
router.getSourceBaseUrl = function(sourceName) {
  const sourceUrls = {
    'ppatk': 'https://www.ppatk.go.id',
    'ahu': 'https://ahu.go.id',
    'tribunnews': 'https://www.tribunnews.com',
    'tempo': 'https://www.tempo.co',
    'kaskus': 'https://www.kaskus.co.id',
    'yellowpages': 'https://www.yellowpages.co.id',
    'detik': 'https://www.detik.com',
    'kompas': 'https://www.kompas.com'
  };
  return sourceUrls[sourceName] || 'https://google.com';
};

/**
 * Assess source credibility
 */
router.assessSourceCredibility = function(sourceType, sourceName) {
  const credibilityMap = {
    'regulatory': 'very_high',
    'news_coverage': 'high',
    'business_verification': 'medium',
    'fraud_intelligence': 'high',
    'specialized_research': 'medium',
    'general': 'low'
  };
  
  // Special cases for high-credibility sources
  if (sourceName.includes('OJK') || sourceName.includes('PPATK')) {
    return 'very_high';
  }
  
  return credibilityMap[sourceType] || 'unknown';
};

/**
 * Get source priority for fraud detection
 */
router.getSourcePriority = function(sourceType) {
  const priorityMap = {
    'regulatory': 1,
    'fraud_intelligence': 2,
    'business_verification': 3,
    'news_coverage': 4,
    'specialized_research': 5,
    'general': 6
  };
  
  return priorityMap[sourceType] || 10;
};

/**
 * GET /stats
 * Service statistics endpoint
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      service: 'ARKS RWA AI Fraud Detection',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: {
        entries: fraudAnalyzer.analysisCache.size
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Stats endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stats',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;