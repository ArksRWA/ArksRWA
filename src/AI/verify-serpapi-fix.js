#!/usr/bin/env node

/**
 * Verification script for SerpAPI integration fix
 * Checks that the SerpAPI endpoint now uses the full fraud analyzer pipeline
 */

import FraudAnalyzer from './services/fraud-analyzer.js';

async function verifySerpAPIFix() {
  console.log('🔧 Verifying SerpAPI integration fix...\n');

  const fraudAnalyzer = new FraudAnalyzer();
  
  // Test company data
  const testCompany = {
    name: 'PT Test Company Indonesia',
    description: 'Test company for verifying SerpAPI integration with full fraud analyzer pipeline'
  };

  console.log('📋 Test Company:', testCompany.name);
  console.log('📝 Description:', testCompany.description);
  console.log('');

  try {
    console.log('🔍 Testing analyzeCompanyWithSerpAPI method...');
    const startTime = Date.now();
    
    // This should now use the full pipeline instead of bypassing it
    const result = await fraudAnalyzer.analyzeCompanyWithSerpAPI(testCompany);
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Completed in ${duration}ms`);
    console.log('');

    // Check if result has the sophisticated analysis structure
    console.log('🧪 VERIFICATION CHECKLIST:');
    console.log('════════════════════════════');

    // 1. Check methodology/source indicates full pipeline
    const isFullPipeline = result.source?.includes('intelligent_analysis') || 
                          result.methodology?.includes('full_pipeline');
    console.log(`✅ Full Pipeline Used: ${isFullPipeline ? '✅ YES' : '❌ NO'}`);

    // 2. Check for entity resolution
    const hasEntityResolution = !!(result.analysis?.entity || result.entityResolution);
    console.log(`🏢 Entity Resolution: ${hasEntityResolution ? '✅ YES' : '❌ NO'}`);

    // 3. Check for evidence atoms
    const hasEvidence = !!(result.analysis?.evidence && result.analysis.evidence.length > 0);
    console.log(`🧩 Evidence Collection: ${hasEvidence ? '✅ YES' : '❌ NO'}`);

    // 4. Check for stage results (intelligent analysis structure)
    const hasStageResults = !!(result.stageResults);
    console.log(`🔬 Stage Results: ${hasStageResults ? '✅ YES' : '❌ NO'}`);

    // 5. Check for performance metrics
    const hasPerformanceMetrics = !!(result.performance);
    console.log(`⚡ Performance Metrics: ${hasPerformanceMetrics ? '✅ YES' : '❌ NO'}`);

    // 6. Check for triage results
    const hasTriageResults = !!(result.stageResults?.stage1_triage);
    console.log(`🧠 Intelligent Triage: ${hasTriageResults ? '✅ YES' : '❌ NO'}`);

    // 7. Check for context-aware scraping
    const hasContextAwareScraping = !!(result.stageResults?.stage2_scraping);
    console.log(`🌐 Context-Aware Scraping: ${hasContextAwareScraping ? '✅ YES' : '❌ NO'}`);

    // 8. Check for intelligent result combination
    const hasIntelligentCombination = !!(result.analysis?.triage || result.analysis?.webResearch);
    console.log(`🤝 Intelligent Combination: ${hasIntelligentCombination ? '✅ YES' : '❌ NO'}`);

    console.log('');

    // Final assessment
    const sophisticationScore = [
      isFullPipeline,
      hasEntityResolution, 
      hasEvidence,
      hasStageResults,
      hasPerformanceMetrics,
      hasTriageResults,
      hasContextAwareScraping,
      hasIntelligentCombination
    ].filter(Boolean).length;

    console.log('📊 FINAL ASSESSMENT:');
    console.log('═══════════════════');
    console.log(`🎯 Sophistication Score: ${sophisticationScore}/8`);
    console.log(`📈 Fraud Score: ${result.fraudScore || 'N/A'}`);
    console.log(`⚠️  Risk Level: ${result.riskLevel || 'N/A'}`);
    console.log(`🔬 Confidence: ${result.confidence || 'N/A'}`);
    console.log(`🔧 Methodology: ${result.source || result.methodology || 'unknown'}`);

    if (sophisticationScore >= 6) {
      console.log('');
      console.log('🟢 VERIFICATION SUCCESSFUL!');
      console.log('✅ SerpAPI is now using the full fraud analyzer pipeline');
      console.log('✅ All sophisticated fraud detection capabilities are active');
      console.log('✅ The fix has been successfully implemented');
    } else if (sophisticationScore >= 4) {
      console.log('');
      console.log('🟡 VERIFICATION PARTIAL');
      console.log('⚠️  SerpAPI is using some sophisticated features but not all');
      console.log('🔧 Review implementation for missing components');
    } else {
      console.log('');
      console.log('🔴 VERIFICATION FAILED');
      console.log('❌ SerpAPI is still using simplified pipeline');
      console.log('❌ Sophisticated fraud detection features are missing');
      console.log('🚨 The fix needs to be reviewed and corrected');
    }

    console.log('');
    console.log('📋 DETAILED RESULT STRUCTURE:');
    console.log('════════════════════════════');
    console.log('Keys present in result:');
    Object.keys(result).forEach(key => {
      const value = result[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      const size = Array.isArray(value) ? value.length : 
                   typeof value === 'object' && value !== null ? Object.keys(value).length : 
                   'N/A';
      console.log(`  - ${key}: ${type} ${size !== 'N/A' ? `(${size} items)` : ''}`);
    });

    if (result.analysis) {
      console.log('\nKeys present in result.analysis:');
      Object.keys(result.analysis).forEach(key => {
        const value = result.analysis[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const size = Array.isArray(value) ? value.length : 
                     typeof value === 'object' && value !== null ? Object.keys(value).length : 
                     'N/A';
        console.log(`  - analysis.${key}: ${type} ${size !== 'N/A' ? `(${size} items)` : ''}`);
      });
    }

  } catch (error) {
    console.log('❌ VERIFICATION FAILED');
    console.error('Error during verification:', error.message);
    
    if (error.stack) {
      console.log('\nStack trace:');
      console.log(error.stack);
    }
  }
}

// Run verification
verifySerpAPIFix().catch(error => {
  console.error('Verification script error:', error);
  process.exit(1);
});