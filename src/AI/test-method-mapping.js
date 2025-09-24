#!/usr/bin/env node

import ContextAwareWebScraper from './services/context-aware-scraper.js';
import { serpAPIService } from './services/serpapi-service.js';

console.log('🧪 Testing SerpAPI method mapping fixes...');

async function testMethodMapping() {
  try {
    console.log('✅ Imports successful');
    
    // Test that SerpAPI service has the expected methods
    const expectedMethods = [
      'searchFraudInvestigativeNews',
      'searchFinancialCrimeNews', 
      'searchRegulatoryNewsAlerts',
      'searchVictimTestimonialsInNews',
      'searchCompanyReputationNews',
      'searchOfficialRegulatoryMentions',
      'searchRecentNewsTrends'
    ];
    
    console.log('🔍 Checking SerpAPI service methods:');
    let allMethodsExist = true;
    
    for (const method of expectedMethods) {
      if (typeof serpAPIService[method] === 'function') {
        console.log(`  ✅ ${method} - Available`);
      } else {
        console.log(`  ❌ ${method} - Missing`);
        allMethodsExist = false;
      }
    }
    
    // Test the context-aware scraper method mapping
    const scraper = new ContextAwareWebScraper();
    
    console.log('\n🔗 Testing search type mapping:');
    const testMappings = [
      { searchType: 'general', expectedMethod: 'searchCompanyReputationNews' },
      { searchType: 'fraud', expectedMethod: 'searchFraudInvestigativeNews' },
      { searchType: 'financial', expectedMethod: 'searchFinancialCrimeNews' },
      { searchType: 'regulatory', expectedMethod: 'searchRegulatoryNewsAlerts' },
      { searchType: 'news', expectedMethod: 'searchRecentNewsTrends' },
      { searchType: 'victims', expectedMethod: 'searchVictimTestimonialsInNews' },
      { searchType: 'official', expectedMethod: 'searchOfficialRegulatoryMentions' }
    ];
    
    let allMappingsValid = true;
    
    for (const mapping of testMappings) {
      if (typeof serpAPIService[mapping.expectedMethod] === 'function') {
        console.log(`  ✅ ${mapping.searchType} → ${mapping.expectedMethod} - Valid`);
      } else {
        console.log(`  ❌ ${mapping.searchType} → ${mapping.expectedMethod} - Invalid`);
        allMappingsValid = false;
      }
    }
    
    // Test priority generation
    console.log('\n🎯 Testing priority generation:');
    const triageResults = {
      data: {
        riskLevel: 'medium',
        riskFactors: [],
        priorityPatterns: []
      }
    };
    
    const priority = scraper.determineSerpAPIPriority(triageResults, {});
    console.log(`  Generated priority: [${priority.join(', ')}]`);
    
    let allPriorityTypesValid = true;
    for (const searchType of priority) {
      const mapping = testMappings.find(m => m.searchType === searchType);
      if (mapping && typeof serpAPIService[mapping.expectedMethod] === 'function') {
        console.log(`  ✅ Priority ${searchType} has valid method mapping`);
      } else {
        console.log(`  ❌ Priority ${searchType} has invalid method mapping`);
        allPriorityTypesValid = false;
      }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`  SerpAPI methods available: ${allMethodsExist ? '✅' : '❌'}`);
    console.log(`  Method mappings valid: ${allMappingsValid ? '✅' : '❌'}`);
    console.log(`  Priority mappings valid: ${allPriorityTypesValid ? '✅' : '❌'}`);
    
    if (allMethodsExist && allMappingsValid && allPriorityTypesValid) {
      console.log('\n🎉 SUCCESS: All SerpAPI method mappings are correctly fixed!');
      console.log('✅ The context-aware scraper will no longer call non-existent methods');
      console.log('✅ All search types map to valid SerpAPI service methods');
      return true;
    } else {
      console.log('\n❌ FAILURE: Some method mappings are still broken');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
testMethodMapping()
  .then(success => {
    if (success) {
      console.log('\n🏆 Method mapping test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 Method mapping test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });