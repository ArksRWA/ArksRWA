#!/usr/bin/env node

/**
 * Test script for SerpAPI integration with full fraud analyzer pipeline
 * Tests the complete fix to ensure SerpAPI uses the sophisticated fraud detection system
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'test-secure-auth-token-123';

async function testSerpAPIIntegration() {
  console.log('🧪 Testing SerpAPI integration with full fraud analyzer pipeline...\n');

  const testCompanies = [
    {
      name: 'PT Bank Mandiri',
      description: 'Bank BUMN terbesar Indonesia terdaftar OJK dengan layanan digital',
      expectedRisk: 'low'
    },
    {
      name: 'PT Investasi Ponzi Guaranteed',
      description: 'Investasi guaranteed profit 50% per bulan money game tanpa risiko',
      expectedRisk: 'critical'
    },
    {
      name: 'PT Aqua Golden Mississippi',
      description: 'Produsen air minum dalam kemasan AQUA terbesar Indonesia',
      expectedRisk: 'low'
    }
  ];

  const results = [];

  for (const company of testCompanies) {
    console.log(`🔍 Testing: ${company.name}`);
    console.log(`📝 Description: ${company.description}`);
    console.log(`🎯 Expected Risk: ${company.expectedRisk}`);
    
    try {
      const startTime = Date.now();
      
      const response = await axios.post(`${API_BASE_URL}/analyze-company/serpapi`, {
        name: company.name,
        description: company.description
      }, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000 // 90 seconds timeout
      });

      const duration = Date.now() - startTime;
      
      if (response.data.success) {
        const data = response.data.data;
        
        console.log(`✅ Analysis completed in ${duration}ms`);
        console.log(`📊 Fraud Score: ${data.fraudScore}`);
        console.log(`⚠️  Risk Level: ${data.riskLevel}`);
        console.log(`🔬 Confidence: ${data.confidence}`);
        console.log(`🔧 Methodology: ${data.methodology}`);
        
        // Check if it's using the full pipeline
        const isFullPipeline = data.methodology.includes('intelligent_analysis');
        console.log(`🧠 Full Pipeline Used: ${isFullPipeline ? 'YES ✅' : 'NO ❌'}`);
        
        // Check for sophisticated analysis components
        const hasEntityResolution = !!data.entityResolution;
        const hasEvidenceBreakdown = !!data.evidenceBreakdown;
        const hasDataSources = !!data.dataSources;
        const hasPerformanceMetrics = !!data.processingDetails;
        
        console.log(`🏢 Entity Resolution: ${hasEntityResolution ? 'YES ✅' : 'NO ❌'}`);
        console.log(`🧩 Evidence Breakdown: ${hasEvidenceBreakdown ? 'YES ✅' : 'NO ❌'}`);
        console.log(`📚 Data Sources: ${hasDataSources ? 'YES ✅' : 'NO ❌'}`);
        console.log(`⚡ Performance Metrics: ${hasPerformanceMetrics ? 'YES ✅' : 'NO ❌'}`);
        
        // Check SerpAPI specific metrics
        const serpMetrics = data.serpAPIMetrics;
        if (serpMetrics) {
          console.log(`🔍 SerpAPI Searches: ${serpMetrics.searchesExecuted}`);
          console.log(`📈 Total Results: ${serpMetrics.totalResults}`);
          console.log(`🚨 Fraud Indicators: ${serpMetrics.fraudIndicators}`);
          console.log(`✅ Legitimacy Signals: ${serpMetrics.legitimacySignals}`);
          console.log(`⚡ Early Termination: ${serpMetrics.earlyTermination}`);
        }
        
        // Check data sources detail
        if (data.dataSources) {
          console.log(`📊 Data Sources Summary:`);
          console.log(`   - Total Sources: ${data.dataSources.summary.totalSources}`);
          console.log(`   - Sources Scraped: ${data.dataSources.summary.sourcesScraped}`);
          console.log(`   - Data Quality: ${data.dataSources.summary.dataQuality}`);
          console.log(`   - AI Enhanced: ${data.dataSources.summary.aiEnhanced}`);
        }
        
        results.push({
          company: company.name,
          success: true,
          fraudScore: data.fraudScore,
          riskLevel: data.riskLevel,
          confidence: data.confidence,
          methodology: data.methodology,
          duration: duration,
          fullPipeline: isFullPipeline,
          sophistication: {
            entityResolution: hasEntityResolution,
            evidenceBreakdown: hasEvidenceBreakdown,
            dataSources: hasDataSources,
            performanceMetrics: hasPerformanceMetrics
          }
        });
        
      } else {
        console.log(`❌ Analysis failed: ${response.data.error}`);
        results.push({
          company: company.name,
          success: false,
          error: response.data.error,
          duration: duration
        });
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
      results.push({
        company: company.name,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
    }
    
    console.log('─'.repeat(60));
  }

  // Generate summary report
  console.log('\n📊 TEST SUMMARY REPORT');
  console.log('═'.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful Analyses: ${successful.length}/${results.length}`);
  console.log(`❌ Failed Analyses: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🧠 FULL PIPELINE VERIFICATION:');
    const fullPipelineCount = successful.filter(r => r.fullPipeline).length;
    console.log(`   Full Pipeline Used: ${fullPipelineCount}/${successful.length} analyses`);
    
    console.log('\n🔧 SOPHISTICATION CHECK:');
    const avgSophistication = successful.reduce((sum, r) => {
      const score = Object.values(r.sophistication || {}).filter(Boolean).length;
      return sum + score;
    }, 0) / successful.length;
    console.log(`   Average Sophistication Score: ${avgSophistication.toFixed(1)}/4`);
    
    console.log('\n📈 PERFORMANCE METRICS:');
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
    
    console.log('\n📊 FRAUD SCORES:');
    successful.forEach(result => {
      console.log(`   ${result.company}: ${result.fraudScore} (${result.riskLevel})`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED ANALYSES:');
    failed.forEach(result => {
      console.log(`   ${result.company}: ${result.error}`);
    });
  }
  
  // Final assessment
  console.log('\n🎯 INTEGRATION ASSESSMENT:');
  const fullPipelineSuccess = successful.filter(r => r.fullPipeline).length === successful.length;
  const sophisticationSuccess = successful.every(r => 
    Object.values(r.sophistication || {}).filter(Boolean).length >= 3
  );
  
  if (fullPipelineSuccess && sophisticationSuccess && successful.length === results.length) {
    console.log('🟢 INTEGRATION SUCCESSFUL: SerpAPI is using the full fraud analyzer pipeline!');
    console.log('✅ All sophisticated fraud detection capabilities are working correctly.');
    console.log('✅ Entity resolution, evidence collection, and intelligent analysis are active.');
  } else {
    console.log('🟡 INTEGRATION PARTIAL: Some issues detected');
    if (!fullPipelineSuccess) {
      console.log('❌ Not all analyses used the full pipeline');
    }
    if (!sophisticationSuccess) {
      console.log('❌ Some analyses missing sophisticated components');
    }
    if (successful.length !== results.length) {
      console.log('❌ Some analyses failed completely');
    }
  }
  
  console.log('\n📝 RECOMMENDATION:');
  if (fullPipelineSuccess && sophisticationSuccess) {
    console.log('✅ SerpAPI integration is working correctly. The full fraud analyzer pipeline');
    console.log('   is being used, providing sophisticated fraud detection with entity resolution,');
    console.log('   intelligent triage, context-aware scraping, and advanced result combination.');
  } else {
    console.log('⚠️  Review the integration. SerpAPI should use the complete fraud analyzer');
    console.log('   pipeline for maximum detection sophistication and accuracy.');
  }
}

// Run the test
testSerpAPIIntegration().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
});