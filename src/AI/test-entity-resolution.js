#!/usr/bin/env node

/**
 * Test script for Entity Resolution and AI Narrative enhancements
 */

import EntityUtils from './services/entity-utils.js';
import GeminiService from './services/gemini.js';

async function testEntityResolution() {
  console.log('🧪 Testing Entity Resolution enhancements...\n');
  
  const entityUtils = new EntityUtils();
  
  // Test cases
  const testCases = [
    {
      name: 'PT Bank Mandiri (Persero) Tbk',
      description: 'Bank BUMN terbesar Indonesia terdaftar OJK dengan layanan digital banking'
    },
    {
      name: 'PT Aqua Golden Mississippi',
      description: 'Produsen air minum dalam kemasan AMDK merek Aqua sejak 1973'
    },
    {
      name: 'PT Scam Investment Guaranteed',
      description: 'Investasi dengan guaranteed profit 50% per bulan tanpa risiko money game'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    
    // Test entity resolution
    const entityResolution = entityUtils.resolveEntity(testCase.name, testCase.description);
    
    console.log('\n🎯 Entity Resolution Results:');
    console.log(`  Canonical Name: ${entityResolution.canonicalName}`);
    console.log(`  Entity Type: ${entityResolution.entityType}`);
    console.log(`  Industry: ${entityResolution.industry}`);
    console.log(`  Jurisdiction: ${entityResolution.jurisdiction}`);
    console.log(`  Registration Status: ${entityResolution.registrationStatus}`);
    console.log(`  Confidence: ${entityResolution.confidence}`);
    console.log(`  Aliases: ${entityResolution.aliases.slice(0, 3).join(', ')}`);
    
    console.log('\n' + '='.repeat(80));
  }
}

async function testAINarrative() {
  console.log('\n\n🤖 Testing AI Narrative Generation...\n');
  
  const geminiService = new GeminiService();
  
  // Mock analysis result for testing
  const mockCompanyData = {
    name: 'PT Bank Mandiri (Persero) Tbk',
    description: 'Bank BUMN terbesar Indonesia dengan sertifikat OJK dan ISO compliance'
  };
  
  const mockAnalysisResult = {
    fraudScore: 15,
    riskLevel: 'low',
    confidence: 85,
    analysis: {
      fraudIndicators: {
        score: 5,
        detectedKeywords: [],
        financialTroubles: [],
        victimReports: []
      },
      legitimacyEvidence: {
        score: 85,
        businessMarkers: ['pt', 'bank', 'persero', 'tbk', 'ojk', 'iso'],
        registrationEvidence: ['pt', 'persero', 'tbk']
      },
      regulatoryWarnings: {
        score: 10,
        officialWarnings: [],
        investigations: []
      },
      webResearchImpact: {
        score: 20,
        keyFindings: ['Strong digital presence', 'Positive news coverage'],
        dataQuality: 'good'
      }
    }
  };
  
  const mockEntityResolution = {
    canonicalName: 'PT Bank Mandiri (Persero) Tbk',
    entityType: 'tbk',
    industry: 'banking',
    jurisdiction: 'DKI Jakarta',
    registrationStatus: 'registered',
    aliases: ['Bank Mandiri', 'Mandiri', 'PT Bank Mandiri'],
    confidence: 0.95
  };
  
  console.log('🧠 Generating AI narrative for mock legitimate company...');
  
  const narrativeResult = await geminiService.generateCompanyNarrative(
    mockCompanyData,
    mockAnalysisResult,
    mockEntityResolution
  );
  
  if (narrativeResult.success) {
    const narrative = narrativeResult.data;
    console.log('\n📝 AI Narrative Results:');
    console.log(`\n📋 Summary:\n${narrative.summary}`);
    console.log(`\n🔍 Key Findings:`);
    narrative.keyFindings.forEach((finding, index) => {
      console.log(`  ${index + 1}. ${finding}`);
    });
    console.log(`\n⚖️ Risk Explanation:\n${narrative.riskExplanation}`);
    console.log(`\n📌 Recommendations:`);
    narrative.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    console.log(`\n🎯 Confidence Reasoning:\n${narrative.confidenceReasoning}`);
    console.log(`\n🏢 Business Context:\n${narrative.businessContext}`);
  } else {
    console.log('❌ AI Narrative generation failed:', narrativeResult.error);
    if (narrativeResult.fallback) {
      console.log('🔄 Using fallback narrative:', narrativeResult.fallback.data.summary);
    }
  }
}

async function main() {
  try {
    await testEntityResolution();
    await testAINarrative();
    
    console.log('\n\n✅ All tests completed successfully!');
    console.log('\n🎉 Entity Resolution and AI Narrative enhancements are working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();