#!/usr/bin/env node
/**
 * Test script to verify the entity resolution bug fix
 * 
 * Bug: "PT Multidaya Teknologi Nusantara (eFishery)" was incorrectly 
 * resolving to "PT Tirta Investama" (Aqua company) instead of the 
 * correct "PT Multidaya Teknologi Nusantara"
 * 
 * Fix: Improved alias matching algorithm with stricter partial matching
 * and better specificity checks to prevent false matches
 */

import EntityUtils from './services/entity-utils.js';

const entityUtils = new EntityUtils();

console.log('🧪 Entity Resolution Bug Fix Verification');
console.log('=========================================\n');

// Test cases that verify the fix
const testCases = [
  {
    name: 'Original Bug Case',
    input: 'PT Multidaya Teknologi Nusantara (eFishery)',
    expected: 'PT Multidaya Teknologi Nusantara',
    description: 'Should resolve to eFishery, not Aqua'
  },
  {
    name: 'Aqua Still Works',
    input: 'PT Aqua',
    expected: 'PT Tirta Investama',
    description: 'Aqua should still resolve correctly'
  },
  {
    name: 'eFishery Direct',
    input: 'eFishery',
    expected: 'PT Multidaya Teknologi Nusantara',
    description: 'Direct eFishery lookup should work'
  },
  {
    name: 'Edge Case Prevention',
    input: 'PT Teknologi Multidaya Test Company',
    expected: 'PT Teknologi Multidaya Test Company',
    description: 'Should not falsely match existing entities'
  }
];

let passed = 0;
let total = testCases.length;

for (const testCase of testCases) {
  console.log(`📋 ${testCase.name}`);
  console.log(`   Input: "${testCase.input}"`);
  console.log(`   Expected: "${testCase.expected}"`);
  
  const result = entityUtils.resolveEntity(testCase.input);
  const success = result.canonicalName === testCase.expected;
  
  console.log(`   Got: "${result.canonicalName}"`);
  console.log(`   Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Description: ${testCase.description}\n`);
  
  if (success) passed++;
}

console.log('📊 Summary');
console.log(`Tests passed: ${passed}/${total}`);
console.log(`Status: ${passed === total ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

if (passed === total) {
  console.log('\n🎉 Entity resolution bug has been successfully fixed!');
  console.log('   - More specific alias matching prevents false matches');
  console.log('   - Increased scoring threshold (70 vs 50) for better accuracy');
  console.log('   - Added word boundary checks for exact text matches');
  console.log('   - Cleaned up alias database to remove conflicts');
} else {
  console.log('\n⚠️  Some tests failed - bug may not be fully resolved');
}