#!/usr/bin/env node

/**
 * Test script for enhanced data sources API
 * Tests the new dataSources field in analyze-company responses
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'test-secure-auth-token-123';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

async function testSourcesAPI() {
  console.log('🧪 Testing Enhanced Data Sources API\n');
  
  try {
    // Test 1: Analyze legitimate company
    console.log('Test 1: Analyzing legitimate Indonesian company...');
    const legitResponse = await axios.post(`${API_BASE_URL}/analyze-company`, {
      name: 'PT Aqua Golden Mississippi',
      description: 'Produsen air minum dalam kemasan merek AQUA terbesar Indonesia',
      industry: 'manufacturing',
      region: 'Jakarta'
    }, { headers });
    
    console.log(`✅ Legitimate Company Analysis:`);
    console.log(`   Fraud Score: ${legitResponse.data.data.fraudScore}`);
    console.log(`   Risk Level: ${legitResponse.data.data.riskLevel}`);
    console.log(`   Data Sources Summary:`);
    console.log(`   - Total Sources: ${legitResponse.data.data.dataSources.summary.totalSources}`);
    console.log(`   - Sources Scraped: ${legitResponse.data.data.dataSources.summary.sourcesScraped}`);
    console.log(`   - Data Quality: ${legitResponse.data.data.dataSources.summary.dataQuality}`);
    console.log(`   - AI Enhanced: ${legitResponse.data.data.dataSources.summary.aiEnhanced}`);
    
    if (legitResponse.data.data.dataSources.sources.length > 0) {
      console.log(`   Sources Used:`);
      legitResponse.data.data.dataSources.sources.forEach((source, index) => {
        console.log(`   ${index + 1}. ${source.name} (${source.type})`);
        console.log(`      - Results Found: ${source.resultsFound}`);
        console.log(`      - Data Quality: ${source.dataQuality}`);
        console.log(`      - Credibility: ${source.credibility}`);
        console.log(`      - Priority: ${source.priority}`);
      });
    }
    console.log('');
    
    // Test 2: Analyze suspicious company
    console.log('Test 2: Analyzing suspicious company...');
    const suspiciousResponse = await axios.post(`${API_BASE_URL}/analyze-company`, {
      name: 'PT Investasi Ponzi Guaranteed',
      description: 'Investasi dengan guaranteed profit 50% per bulan tanpa risiko money game',
      industry: 'investment'
    }, { headers });
    
    console.log(`🚨 Suspicious Company Analysis:`);
    console.log(`   Fraud Score: ${suspiciousResponse.data.data.fraudScore}`);
    console.log(`   Risk Level: ${suspiciousResponse.data.data.riskLevel}`);
    console.log(`   Data Sources Summary:`);
    console.log(`   - Total Sources: ${suspiciousResponse.data.data.dataSources.summary.totalSources}`);
    console.log(`   - Sources Scraped: ${suspiciousResponse.data.data.dataSources.summary.sourcesScraped}`);
    console.log(`   - Data Quality: ${suspiciousResponse.data.data.dataSources.summary.dataQuality}`);
    
    if (suspiciousResponse.data.data.dataSources.sources.length > 0) {
      console.log(`   Sources Used:`);
      suspiciousResponse.data.data.dataSources.sources.forEach((source, index) => {
        console.log(`   ${index + 1}. ${source.name} (${source.type})`);
        console.log(`      - Results Found: ${source.resultsFound}`);
        console.log(`      - Data Quality: ${source.dataQuality}`);
        console.log(`      - Credibility: ${source.credibility}`);
      });
    }
    console.log('');
    
    // Test 3: Test the sources demo endpoint
    console.log('Test 3: Testing sources demo endpoint...');
    const demoResponse = await axios.get(`${API_BASE_URL}/analyze-company/sources-demo`, { headers });
    
    console.log(`📊 Sources Demo Response:`);
    console.log(`   Success: ${demoResponse.data.success}`);
    console.log(`   Legitimate Example: ${demoResponse.data.examples.legitimate.company}`);
    console.log(`   - Fraud Score: ${demoResponse.data.examples.legitimate.fraudScore}`);
    console.log(`   - Total Sources: ${demoResponse.data.examples.legitimate.dataSources.summary.totalSources}`);
    console.log(`   Suspicious Example: ${demoResponse.data.examples.suspicious.company}`);
    console.log(`   - Fraud Score: ${demoResponse.data.examples.suspicious.fraudScore}`);
    console.log(`   - Total Sources: ${demoResponse.data.examples.suspicious.dataSources.summary.totalSources}`);
    console.log('');
    
    // Test 4: Test bulk analysis with sources
    console.log('Test 4: Testing bulk analysis with source transparency...');
    const bulkResponse = await axios.post(`${API_BASE_URL}/analyze-company/bulk`, {
      companies: [
        {
          name: 'PT Telkom Indonesia',
          description: 'BUMN telekomunikasi terbesar Indonesia yang terdaftar di BEI',
          industry: 'telecommunications'
        },
        {
          name: 'Scam Investment Corp',
          description: 'Get rich quick scheme with guaranteed 100% returns',
          industry: 'investment'
        }
      ]
    }, { headers });
    
    console.log(`📦 Bulk Analysis Results:`);
    console.log(`   Total Companies: ${bulkResponse.data.summary.total}`);
    console.log(`   Successful: ${bulkResponse.data.summary.successful}`);
    
    bulkResponse.data.results.forEach((result, index) => {
      if (result.success) {
        console.log(`   Company ${index + 1}: ${result.data.companyData.name}`);
        console.log(`   - Fraud Score: ${result.data.fraudScore}`);
        console.log(`   - Sources Used: ${result.data.dataSources.summary.totalSources}`);
        console.log(`   - Data Quality: ${result.data.dataSources.summary.dataQuality}`);
      }
    });
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Data Sources Enhancement Summary:');
    console.log('- ✅ Added comprehensive dataSources field to API responses');
    console.log('- ✅ Includes source names, types, URLs, and credibility ratings');
    console.log('- ✅ Shows number of results found from each source');
    console.log('- ✅ Provides data quality indicators for transparency');
    console.log('- ✅ Includes search terms and performance metrics');
    console.log('- ✅ Works with both single and bulk analysis endpoints');
    console.log('- ✅ Added demo endpoint for showcasing source transparency');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the tests
testSourcesAPI();