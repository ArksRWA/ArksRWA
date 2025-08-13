import express from 'express';
import Joi from 'joi';
import FraudAnalyzer from '../services/fraud-analyzer.js';

const router = express.Router();
const fraudAnalyzer = new FraudAnalyzer();

// Request validation schema
const companyAnalysisSchema = Joi.object({
  name: Joi.string().required().min(1).max(200),
  description: Joi.string().required().min(10).max(2000),
  industry: Joi.string().optional().max(50),
  region: Joi.string().optional().max(50),
  valuation: Joi.number().optional().min(0),
  symbol: Joi.string().optional().max(10)
});

/**
 * POST /analyze-company
 * Main endpoint for Indonesian company fraud analysis
 */
router.post('/analyze-company', async (req, res) => {
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
    
    // Log analysis request (without sensitive data)
    console.log(`🔍 Starting fraud analysis for: ${companyData.name}`);
    
    // Perform fraud analysis
    const analysisStart = Date.now();
    const result = await fraudAnalyzer.analyzeCompany(companyData);
    const analysisTime = Date.now() - analysisStart;
    
    console.log(`✅ Analysis completed in ${analysisTime}ms - Score: ${result.fraudScore}, Risk: ${result.riskLevel}`);
    
    // Prepare response
    const response = {
      success: true,
      data: {
        fraudScore: result.fraudScore,
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        analysis: result.analysis,
        timestamp: result.timestamp,
        processingTimeMs: analysisTime
      },
      metadata: {
        version: '1.0.0',
        source: result.source || 'ai_service',
        cached: result.source === 'cache'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Analysis endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: 'An error occurred during fraud analysis',
      timestamp: new Date().toISOString()
    });
  }
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
 * GET /analyze-company/demo
 * Demo endpoint with sample Indonesian companies
 */
router.get('/analyze-company/demo', async (req, res) => {
  try {
    const demoResults = await fraudAnalyzer.testAnalyzer();
    
    res.json({
      success: true,
      message: 'Demo analysis completed',
      results: demoResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Demo analysis error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Demo analysis failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /analyze-company/bulk
 * Bulk analysis endpoint for multiple companies
 */
router.post('/analyze-company/bulk', async (req, res) => {
  try {
    const { companies } = req.body;
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'companies must be a non-empty array'
      });
    }
    
    if (companies.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Bulk limit exceeded',
        message: 'Maximum 10 companies per bulk request'
      });
    }
    
    // Validate each company
    const validationErrors = [];
    companies.forEach((company, index) => {
      const { error } = companyAnalysisSchema.validate(company);
      if (error) {
        validationErrors.push({
          index,
          errors: error.details.map(detail => detail.message)
        });
      }
    });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation errors',
        details: validationErrors
      });
    }
    
    // Process companies in parallel (with limit)
    const analysisPromises = companies.map(async (company, index) => {
      try {
        const result = await fraudAnalyzer.analyzeCompany(company);
        return {
          index,
          success: true,
          data: result
        };
      } catch (error) {
        return {
          index,
          success: false,
          error: error.message,
          companyName: company.name
        };
      }
    });
    
    const results = await Promise.all(analysisPromises);
    
    // Calculate summary statistics
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const avgScore = successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.data.fraudScore, 0) / successful.length 
      : 0;
    
    res.json({
      success: true,
      summary: {
        total: companies.length,
        successful: successful.length,
        failed: failed.length,
        averageScore: Math.round(avgScore)
      },
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Bulk analysis error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Bulk analysis failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

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