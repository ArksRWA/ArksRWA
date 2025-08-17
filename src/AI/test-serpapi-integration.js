#!/usr/bin/env node

/**
 * Test Script for SerpAPI + Gemini LLM Integration
 * Tests the complete pipeline: SerpAPI → Gemini AI → Risk Assessment
 */

import axios from 'axios';
import chalk from 'chalk';

const API_BASE_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'test-secure-auth-token-123';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

/**
 * Test cases for SerpAPI integration
 */
const testCases = [
  {
    name: 'PT Bank Digital Indonesia',
    description: 'Bank digital terdaftar OJK dengan sertifikat ISO 27001 dan audit PWC',
    expectedRisk: 'low',
    category: 'legitimate_financial'
  },
  {
    name: 'PT Aqua Golden Mississippi',
    description: 'Perusahaan air minum kemasan terbesar di Indonesia dengan sertifikat SNI',
    expectedRisk: 'low',
    category: 'legitimate_manufacturing'
  },
  {
    name: 'PT Investasi Ponzi Guaranteed',
    description: 'Investasi dengan keuntungan guaranteed 50% per bulan tanpa risiko money game',
    expectedRisk: 'critical',
    category: 'obvious_fraud'
  },
  {
    name: 'PT Anti-Fraud Security Consulting',
    description: 'Konsultan pencegahan penipuan dan fraud prevention untuk perusahaan Indonesia',
    expectedRisk: 'low',
    category: 'fraud_prevention_company'
  },
  {
    name: 'Unknown Small Company',
    description: 'Small local business with limited online presence',
    expectedRisk: 'medium',
    category: 'limited_data'
  }
];

/**
 * Test SerpAPI service statistics
 */
async function testSerpAPIStats() {
  console.log(chalk.blue('\n🔍 Testing SerpAPI Statistics...'));
  
  try {
    const response = await axios.get(`${API_BASE_URL}/serpapi/stats`, { headers });
    
    if (response.data.success) {
      const stats = response.data.data;
      console.log(chalk.green('✅ SerpAPI Stats:'));
      console.log(`   📊 Quota Used: ${stats.quotaUsed}/${stats.quotaTotal}`);
      console.log(`   📋 Cache Size: ${stats.cacheSize}`);
      console.log(`   🔑 API Key Configured: ${stats.apiKeyConfigured ? 'Yes' : 'No'}`);
      console.log(`   🔄 Last Reset: ${stats.lastReset}`);
      return true;
    } else {
      console.log(chalk.red('❌ SerpAPI stats failed'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ SerpAPI stats error: ${error.message}`));
    return false;
  }
}

/**
 * Test direct SerpAPI search functionality
 */
async function testDirectSerpAPISearch() {
  console.log(chalk.blue('\n🔍 Testing Direct SerpAPI Search...'));
  
  const testCompany = 'PT Bank Digital Indonesia';
  
  try {
    const response = await axios.post(`${API_BASE_URL}/serpapi/search`, {
      companyName: testCompany,
      searchTypes: ['general', 'news', 'regulatory'],
      priority: 'balanced'
    }, { headers });
    
    if (response.data.success) {
      const data = response.data.data;
      console.log(chalk.green('✅ Direct SerpAPI Search Success:'));
      console.log(`   🏢 Company: ${data.companyName}`);
      console.log(`   📊 Total Results: ${data.searchResults.summary?.totalResults || 0}`);
      console.log(`   🚨 Fraud Indicators: ${data.searchResults.summary?.fraudIndicators || 0}`);
      console.log(`   ✅ Legitimacy Signals: ${data.searchResults.summary?.legitimacySignals || 0}`);
      console.log(`   ⚡ Early Termination: ${data.searchResults.summary?.earlyTermination ? 'Yes' : 'No'}`);
      console.log(`   ⏱️ Processing Time: ${data.processingTime}ms`);
      return true;
    } else {
      console.log(chalk.red('❌ Direct SerpAPI search failed'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Direct SerpAPI search error: ${error.message}`));
    return false;
  }
}

/**
 * Test SerpAPI-enhanced fraud analysis
 */
async function testSerpAPIEnhancedAnalysis(testCase) {
  console.log(chalk.blue(`\n🧠 Testing SerpAPI-Enhanced Analysis: ${testCase.name}`));
  
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze-company/serpapi`, {
      name: testCase.name,
      description: testCase.description
    }, { headers });
    
    if (response.data.success) {
      const data = response.data.data;
      console.log(chalk.green('✅ SerpAPI-Enhanced Analysis Success:'));
      console.log(`   🏢 Company: ${data.companyName}`);
      console.log(`   📊 Fraud Score: ${data.fraudScore}/100`);
      console.log(`   🚨 Risk Level: ${data.riskLevel}`);
      console.log(`   🎯 Confidence: ${data.confidence}%`);
      console.log(`   🔬 Methodology: ${data.methodology}`);
      console.log(`   📈 Data Quality: ${data.dataQuality}`);
      
      // SerpAPI metrics
      const serpMetrics = data.serpAPIMetrics;
      console.log(`   🔍 SerpAPI Searches: ${serpMetrics.searchesExecuted}`);
      console.log(`   📋 Total Results: ${serpMetrics.totalResults}`);
      console.log(`   🚨 Fraud Indicators: ${serpMetrics.fraudIndicators}`);
      console.log(`   ✅ Legitimacy Signals: ${serpMetrics.legitimacySignals}`);
      console.log(`   ⚡ Early Termination: ${serpMetrics.earlyTermination ? 'Yes' : 'No'}`);
      console.log(`   📊 Quota Used: ${serpMetrics.quotaUsed}`);
      
      // Processing details
      console.log(`   ⏱️ Processing Time: ${data.processingDetails.processingTime}ms`);
      console.log(`   🔬 AI Analysis Success: ${data.processingDetails.aiAnalysisSuccess ? 'Yes' : 'No'}`);
      console.log(`   📝 Total Evidence: ${data.processingDetails.totalEvidence}`);
      
      // Recommendations
      if (data.recommendations && data.recommendations.length > 0) {
        console.log(`   💡 Recommendations:`);
        data.recommendations.slice(0, 3).forEach(rec => {
          console.log(`     - ${rec}`);
        });
      }
      
      // Risk level validation
      const riskMatch = data.riskLevel === testCase.expectedRisk;
      if (riskMatch) {
        console.log(chalk.green(`   ✅ Risk level matches expectation: ${testCase.expectedRisk}`));
      } else {
        console.log(chalk.yellow(`   ⚠️ Risk level mismatch: expected ${testCase.expectedRisk}, got ${data.riskLevel}`));
      }
      
      return {
        success: true,
        fraudScore: data.fraudScore,
        riskLevel: data.riskLevel,
        confidence: data.confidence,
        processingTime: data.processingDetails.processingTime,
        riskMatch,
        serpAPIMetrics: serpMetrics
      };
    } else {
      console.log(chalk.red('❌ SerpAPI-enhanced analysis failed'));
      return { success: false };
    }
  } catch (error) {
    console.log(chalk.red(`❌ SerpAPI-enhanced analysis error: ${error.message}`));
    return { success: false, error: error.message };
  }
}

/**
 * Compare traditional vs SerpAPI-enhanced analysis
 */
async function compareAnalysisMethods(testCase) {
  console.log(chalk.blue(`\n⚖️ Comparing Analysis Methods: ${testCase.name}`));
  
  const results = {};
  
  try {
    // Traditional analysis
    console.log('   🔄 Running traditional analysis...');
    const traditionalResponse = await axios.post(`${API_BASE_URL}/analyze-company`, {
      name: testCase.name,
      description: testCase.description
    }, { headers });
    
    if (traditionalResponse.data.success) {
      results.traditional = {
        fraudScore: traditionalResponse.data.data.fraudScore,
        riskLevel: traditionalResponse.data.data.riskLevel,
        confidence: traditionalResponse.data.data.confidence,
        processingTime: traditionalResponse.data.data.processingTime
      };
    }
    
    // SerpAPI-enhanced analysis
    console.log('   🔄 Running SerpAPI-enhanced analysis...');
    const serpAPIResponse = await axios.post(`${API_BASE_URL}/analyze-company/serpapi`, {
      name: testCase.name,
      description: testCase.description
    }, { headers });
    
    if (serpAPIResponse.data.success) {
      results.serpapi = {
        fraudScore: serpAPIResponse.data.data.fraudScore,
        riskLevel: serpAPIResponse.data.data.riskLevel,
        confidence: serpAPIResponse.data.data.confidence,
        processingTime: serpAPIResponse.data.data.processingDetails.processingTime
      };
    }
    
    // Comparison
    if (results.traditional && results.serpapi) {
      console.log(chalk.green('✅ Comparison Results:'));
      console.log(`   📊 Traditional Score: ${results.traditional.fraudScore} (${results.traditional.riskLevel})`);
      console.log(`   📊 SerpAPI Score: ${results.serpapi.fraudScore} (${results.serpapi.riskLevel})`);
      console.log(`   🎯 Traditional Confidence: ${results.traditional.confidence}%`);
      console.log(`   🎯 SerpAPI Confidence: ${results.serpapi.confidence}%`);
      console.log(`   ⏱️ Traditional Time: ${results.traditional.processingTime}ms`);
      console.log(`   ⏱️ SerpAPI Time: ${results.serpapi.processingTime}ms`);
      
      const confidenceImprovement = results.serpapi.confidence - results.traditional.confidence;
      if (confidenceImprovement > 0) {
        console.log(chalk.green(`   📈 Confidence improved by ${confidenceImprovement}%`));
      } else if (confidenceImprovement < 0) {
        console.log(chalk.yellow(`   📉 Confidence decreased by ${Math.abs(confidenceImprovement)}%`));
      } else {
        console.log(`   ➡️ Confidence unchanged`);
      }
    }
    
    return results;
  } catch (error) {
    console.log(chalk.red(`❌ Comparison error: ${error.message}`));
    return null;
  }
}

/**
 * Run comprehensive test suite
 */
async function runTestSuite() {
  console.log(chalk.bold.blue('🚀 Starting SerpAPI + Gemini LLM Integration Test Suite\n'));
  
  const results = {
    statsTest: false,
    directSearchTest: false,
    analysisTests: [],
    comparisons: []
  };
  
  // Test 1: SerpAPI Statistics
  results.statsTest = await testSerpAPIStats();
  
  // Test 2: Direct SerpAPI Search
  results.directSearchTest = await testDirectSerpAPISearch();
  
  // Test 3: SerpAPI-Enhanced Analysis for each test case
  for (const testCase of testCases) {
    const analysisResult = await testSerpAPIEnhancedAnalysis(testCase);
    results.analysisTests.push({
      testCase,
      result: analysisResult
    });
    
    // Compare with traditional method
    const comparison = await compareAnalysisMethods(testCase);
    if (comparison) {
      results.comparisons.push({
        testCase,
        comparison
      });
    }
  }
  
  // Summary
  console.log(chalk.bold.blue('\n📋 Test Suite Summary:'));
  console.log(`   📊 SerpAPI Stats: ${results.statsTest ? chalk.green('PASS') : chalk.red('FAIL')}`);
  console.log(`   🔍 Direct Search: ${results.directSearchTest ? chalk.green('PASS') : chalk.red('FAIL')}`);
  
  const successfulAnalyses = results.analysisTests.filter(test => test.result.success).length;
  console.log(`   🧠 Enhanced Analyses: ${successfulAnalyses}/${testCases.length} ${successfulAnalyses === testCases.length ? chalk.green('PASS') : chalk.yellow('PARTIAL')}`);
  
  const riskMatches = results.analysisTests.filter(test => test.result.riskMatch).length;
  console.log(`   🎯 Risk Level Accuracy: ${riskMatches}/${testCases.length} ${riskMatches >= testCases.length * 0.8 ? chalk.green('GOOD') : chalk.yellow('NEEDS IMPROVEMENT')}`);
  
  const avgConfidence = results.analysisTests
    .filter(test => test.result.success)
    .reduce((sum, test) => sum + (test.result.confidence || 0), 0) / successfulAnalyses;
  console.log(`   📈 Average Confidence: ${avgConfidence.toFixed(1)}% ${avgConfidence >= 75 ? chalk.green('GOOD') : chalk.yellow('MODERATE')}`);
  
  const avgProcessingTime = results.analysisTests
    .filter(test => test.result.success)
    .reduce((sum, test) => sum + (test.result.processingTime || 0), 0) / successfulAnalyses;
  console.log(`   ⏱️ Average Processing Time: ${avgProcessingTime.toFixed(0)}ms ${avgProcessingTime <= 5000 ? chalk.green('FAST') : chalk.yellow('MODERATE')}`);
  
  console.log(chalk.bold.green('\n✅ SerpAPI + Gemini LLM Integration Test Suite Completed!'));
  
  return results;
}

// Run the test suite
runTestSuite().catch(error => {
  console.error(chalk.red('Test suite failed:'), error);
  process.exit(1);
});