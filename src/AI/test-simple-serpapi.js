#!/usr/bin/env node

/**
 * Simple Test for SerpAPI Integration
 * Quick validation of core functionality
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
 * Test SerpAPI stats endpoint
 */
async function testStats() {
  console.log(chalk.blue('🔍 Testing SerpAPI Stats...'));
  
  try {
    const response = await axios.get(`${API_BASE_URL}/serpapi/stats`, { headers });
    
    if (response.data.success) {
      const stats = response.data.data;
      console.log(chalk.green('✅ SerpAPI Stats Success:'));
      console.log(`   📊 Quota: ${stats.quotaUsed}/${stats.quotaTotal}`);
      console.log(`   🔑 API Key: ${stats.apiKeyConfigured ? 'Configured' : 'Not Configured'}`);
      return true;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Stats test failed: ${error.message}`));
    return false;
  }
}

/**
 * Test basic SerpAPI-enhanced analysis
 */
async function testSerpAPIAnalysis() {
  console.log(chalk.blue('🧠 Testing SerpAPI-Enhanced Analysis...'));
  
  const testCompany = {
    name: 'PT Test Company',
    description: 'Test company for SerpAPI integration'
  };
  
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze-company/serpapi`, testCompany, { 
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.data.success) {
      const data = response.data.data;
      console.log(chalk.green('✅ SerpAPI Analysis Success:'));
      console.log(`   🏢 Company: ${data.companyName}`);
      console.log(`   📊 Score: ${data.fraudScore}/100`);
      console.log(`   🚨 Risk: ${data.riskLevel}`);
      console.log(`   🎯 Confidence: ${data.confidence}%`);
      console.log(`   📈 Data Quality: ${data.dataQuality}`);
      console.log(`   ⏱️ Processing Time: ${data.processingDetails?.processingTime}ms`);
      return true;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Analysis test failed: ${error.message}`));
    return false;
  }
}

/**
 * Test direct SerpAPI search
 */
async function testDirectSearch() {
  console.log(chalk.blue('🔍 Testing Direct SerpAPI Search...'));
  
  try {
    const response = await axios.post(`${API_BASE_URL}/serpapi/search`, {
      companyName: 'PT Test Company',
      searchTypes: ['general'],
      priority: 'speed'
    }, { 
      headers,
      timeout: 5000 // 5 second timeout
    });
    
    if (response.data.success) {
      const data = response.data.data;
      console.log(chalk.green('✅ Direct Search Success:'));
      console.log(`   🏢 Company: ${data.companyName}`);
      console.log(`   📊 Total Results: ${data.searchResults.summary?.totalResults || 0}`);
      console.log(`   ⏱️ Processing Time: ${data.processingTime}ms`);
      return true;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Direct search test failed: ${error.message}`));
    return false;
  }
}

/**
 * Run simple test suite
 */
async function runSimpleTests() {
  console.log(chalk.bold.blue('🚀 Starting Simple SerpAPI Integration Tests\n'));
  
  const results = {
    stats: false,
    directSearch: false,
    analysis: false
  };
  
  // Test 1: Stats
  results.stats = await testStats();
  
  // Test 2: Direct Search (faster)
  results.directSearch = await testDirectSearch();
  
  // Test 3: Full Analysis
  results.analysis = await testSerpAPIAnalysis();
  
  // Summary
  console.log(chalk.bold.blue('\n📋 Test Results:'));
  console.log(`   📊 Stats: ${results.stats ? chalk.green('PASS') : chalk.red('FAIL')}`);
  console.log(`   🔍 Direct Search: ${results.directSearch ? chalk.green('PASS') : chalk.red('FAIL')}`);
  console.log(`   🧠 Analysis: ${results.analysis ? chalk.green('PASS') : chalk.red('FAIL')}`);
  
  const passCount = Object.values(results).filter(r => r).length;
  const totalTests = Object.keys(results).length;
  
  if (passCount === totalTests) {
    console.log(chalk.bold.green('\n✅ All Tests Passed! SerpAPI Integration Working'));
  } else {
    console.log(chalk.bold.yellow(`\n⚠️ ${passCount}/${totalTests} Tests Passed`));
  }
  
  return results;
}

// Run the tests
runSimpleTests().catch(error => {
  console.error(chalk.red('Test suite failed:'), error);
  process.exit(1);
});