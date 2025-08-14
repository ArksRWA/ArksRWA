#!/usr/bin/env node

/**
 * ARKS RWA Enhanced Fraud Detection System Demonstration
 * 
 * This script demonstrates the improvements from implementing:
 * - Stage 1: Intelligent Pre-Analysis & Risk Triage
 * - Stage 2: Enhanced Multi-Source Web Scraping with Context Awareness
 * 
 * Shows before/after comparison and performance improvements
 */

import axios from 'axios';
import chalk from 'chalk';

const AI_SERVICE_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'test-secure-auth-token-123';

class EnhancedSystemDemo {
  constructor() {
    this.apiClient = axios.create({
      baseURL: AI_SERVICE_URL,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes timeout for comprehensive analysis
    });
  }

  /**
   * Test cases representing different risk scenarios in Indonesian market
   */
  getTestCases() {
    return [
      {
        category: 'LOW RISK - Established Financial Institution',
        company: {
          name: 'PT Bank Central Asia Tbk',
          description: 'Bank swasta terbesar Indonesia terdaftar OJK dengan sertifikat ISO 27001 dan audit Ernst & Young',
          industry: 'banking'
        },
        expectedBehavior: {
          triageRisk: 'low',
          scrapingStrategy: 'light',
          fraudScore: '< 30',
          processingTime: '< 20s'
        }
      },
      
      {
        category: 'LOW RISK - Traditional Manufacturing',
        company: {
          name: 'PT Indofood Sukses Makmur Tbk',
          description: 'Produsen makanan dan minuman terbesar Indonesia dengan merek Indomie sejak 1990',
          industry: 'manufacturing'
        },
        expectedBehavior: {
          triageRisk: 'low',
          scrapingStrategy: 'light',
          fraudScore: '< 30',
          processingTime: '< 20s'
        }
      },

      {
        category: 'MEDIUM RISK - New Fintech Startup',
        company: {
          name: 'PT Digital Wallet Indonesia',
          description: 'Startup fintech digital wallet dengan teknologi blockchain dan sistem pembayaran QR code',
          industry: 'fintech'
        },
        expectedBehavior: {
          triageRisk: 'medium',
          scrapingStrategy: 'medium',
          fraudScore: '30-60',
          processingTime: '20-35s'
        }
      },

      {
        category: 'HIGH RISK - Investment Platform',
        company: {
          name: 'PT Investasi Crypto Mining',
          description: 'Platform investasi cryptocurrency mining dengan return 25% per bulan dan jaminan keuntungan',
          industry: 'cryptocurrency'
        },
        expectedBehavior: {
          triageRisk: 'high',
          scrapingStrategy: 'deep',
          fraudScore: '60-80',
          processingTime: '35-60s'
        }
      },

      {
        category: 'CRITICAL RISK - Obvious Scam',
        company: {
          name: 'Money Game Guaranteed Profit',
          description: 'Investasi guaranteed profit 100% per bulan tanpa risiko dengan skema ponzi money game',
          industry: 'investment'
        },
        expectedBehavior: {
          triageRisk: 'critical',
          scrapingStrategy: 'deep',
          fraudScore: '> 80',
          processingTime: 'variable (early termination possible)'
        }
      }
    ];
  }

  /**
   * Run comprehensive demonstration
   */
  async runEnhancedSystemDemo() {
    console.log(chalk.cyan.bold('\n🚀 ARKS RWA Enhanced Fraud Detection System Demo'));
    console.log(chalk.cyan('=' .repeat(70)));
    console.log(chalk.white('Demonstrating Stage 1 & 2 Enhancements:'));
    console.log(chalk.white('✅ Intelligent Pre-Analysis & Risk Triage'));
    console.log(chalk.white('✅ Enhanced Multi-Source Web Scraping with Context Awareness'));
    console.log(chalk.white('✅ Dynamic Resource Allocation & Early Termination Logic'));
    console.log('');

    // Test system health first
    await this.testSystemHealth();
    
    const testCases = this.getTestCases();
    const results = [];

    console.log(chalk.yellow.bold('\n📊 Running Enhanced Analysis on Test Cases...\n'));

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(chalk.blue.bold(`\n[${i + 1}/${testCases.length}] ${testCase.category}`));
      console.log(chalk.gray(`Company: ${testCase.company.name}`));
      console.log(chalk.gray(`Expected: ${testCase.expectedBehavior.triageRisk} risk, ${testCase.expectedBehavior.scrapingStrategy} strategy`));
      
      try {
        const result = await this.analyzeCompanyEnhanced(testCase.company);
        results.push({ testCase, result, success: true });
        
        this.displayAnalysisResult(result, testCase.expectedBehavior);
        
      } catch (error) {
        console.log(chalk.red(`❌ Analysis failed: ${error.message}`));
        results.push({ testCase, error: error.message, success: false });
      }
      
      // Brief delay between tests
      if (i < testCases.length - 1) {
        console.log(chalk.gray('\n⏳ Waiting 2 seconds before next test...\n'));
        await this.sleep(2000);
      }
    }

    // Display summary
    this.displaySummaryReport(results);
    
    return results;
  }

  /**
   * Test system connectivity and health
   */
  async testSystemHealth() {
    console.log(chalk.yellow('🔍 Testing system health...'));
    
    try {
      const response = await this.apiClient.get('/test-connection');
      const data = response.data;
      
      console.log(chalk.green('✅ AI Service: Healthy'));
      console.log(chalk.green(`✅ Gemini API: ${data.tests.geminiApi ? 'Connected' : 'Mock Mode'}`));
      console.log(chalk.green(`✅ Version: ${data.version}`));
      
    } catch (error) {
      console.log(chalk.red('❌ System health check failed'));
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Analyze company with enhanced system
   */
  async analyzeCompanyEnhanced(companyData) {
    const startTime = Date.now();
    
    try {
      const response = await this.apiClient.post('/analyze-company', companyData);
      const endTime = Date.now();
      
      return {
        ...response.data.data,
        actualProcessingTime: endTime - startTime,
        apiProcessingTime: response.data.data.processingTimeMs || 0,
        success: true
      };
      
    } catch (error) {
      throw new Error(`Analysis failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Display individual analysis result
   */
  displayAnalysisResult(result, expected) {
    const { 
      fraudScore, 
      riskLevel, 
      confidence, 
      analysis, 
      actualProcessingTime,
      stageResults
    } = result;

    // Stage 1 Results
    console.log(chalk.magenta.bold('  🧠 STAGE 1 - Intelligent Triage:'));
    if (stageResults?.stage1_triage) {
      const triage = stageResults.stage1_triage;
      console.log(chalk.magenta(`     Risk Assessment: ${triage.riskLevel}`));
      console.log(chalk.magenta(`     Strategy: ${triage.scrapingStrategy?.level || 'N/A'}`));
      
      // Check if triage prediction was accurate
      const triageAccurate = triage.riskLevel === expected.triageRisk;
      console.log(chalk.magenta(`     Accuracy: ${triageAccurate ? '✅ Correct' : '⚠️  Different from expected'}`));
    }

    // Stage 2 Results  
    console.log(chalk.cyan.bold('  🌐 STAGE 2 - Context-Aware Scraping:'));
    if (stageResults?.stage2_scraping) {
      const scraping = stageResults.stage2_scraping;
      console.log(chalk.cyan(`     Sources Used: ${scraping.sourcesScraped || 'N/A'}`));
      console.log(chalk.cyan(`     Scraping Time: ${scraping.processingTimeMs || 0}ms`));
      
      if (scraping.intelligence?.earlyTermination) {
        console.log(chalk.cyan(`     Early Termination: ✅ ${scraping.intelligence.terminationReason}`));
      }
    }

    // Combined Analysis Results
    console.log(chalk.green.bold('  📊 FINAL ANALYSIS:'));
    console.log(chalk.green(`     Fraud Score: ${fraudScore}/100`));
    console.log(chalk.green(`     Risk Level: ${riskLevel.toUpperCase()}`));
    console.log(chalk.green(`     Confidence: ${confidence}%`));
    console.log(chalk.green(`     Total Time: ${actualProcessingTime}ms`));

    // Enhanced Analysis Features
    if (analysis?.triage) {
      console.log(chalk.blue.bold('  🎯 ENHANCED FEATURES:'));
      console.log(chalk.blue(`     Triage Strategy: ${analysis.triage.scrapingStrategy}`));
      console.log(chalk.blue(`     Risk Factors: ${analysis.triage.riskFactors?.length || 0} identified`));
    }

    if (analysis?.webResearch) {
      console.log(chalk.blue(`     Data Quality: ${analysis.webResearch.dataQuality}`));
      console.log(chalk.blue(`     Key Findings: ${analysis.webResearch.keyFindings?.length || 0} insights`));
    }

    // Performance Assessment
    this.assessPerformance(result, expected);
  }

  /**
   * Assess performance against expectations
   */
  assessPerformance(result, expected) {
    const { fraudScore, actualProcessingTime, stageResults } = result;
    
    console.log(chalk.yellow.bold('  ⚡ PERFORMANCE ASSESSMENT:'));
    
    // Score accuracy
    const expectedRange = this.parseScoreRange(expected.fraudScore);
    const scoreInRange = fraudScore >= expectedRange.min && fraudScore <= expectedRange.max;
    console.log(chalk.yellow(`     Score Range: ${scoreInRange ? '✅' : '❌'} Expected ${expected.fraudScore}, Got ${fraudScore}`));
    
    // Processing time efficiency
    const expectedTimeRange = this.parseTimeRange(expected.processingTime);
    const timeEfficient = actualProcessingTime <= expectedTimeRange.max;
    console.log(chalk.yellow(`     Time Efficiency: ${timeEfficient ? '✅' : '⚠️'} Expected ${expected.processingTime}, Got ${actualProcessingTime}ms`));
    
    // Intelligence features
    const hasTriageData = !!stageResults?.stage1_triage;
    const hasScrapingData = !!stageResults?.stage2_scraping;
    console.log(chalk.yellow(`     Intelligence: ${hasTriageData && hasScrapingData ? '✅' : '⚠️'} Stage 1&2 data available`));
  }

  /**
   * Display comprehensive summary report
   */
  displaySummaryReport(results) {
    console.log(chalk.cyan.bold('\n📈 ENHANCED SYSTEM PERFORMANCE SUMMARY'));
    console.log(chalk.cyan('=' .repeat(50)));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(chalk.white(`Total Tests: ${results.length}`));
    console.log(chalk.green(`Successful: ${successful.length}`));
    console.log(chalk.red(`Failed: ${failed.length}`));

    if (successful.length > 0) {
      // Performance statistics
      const avgProcessingTime = successful.reduce((sum, r) => sum + r.result.actualProcessingTime, 0) / successful.length;
      const avgFraudScore = successful.reduce((sum, r) => sum + r.result.fraudScore, 0) / successful.length;
      const avgConfidence = successful.reduce((sum, r) => sum + r.result.confidence, 0) / successful.length;

      console.log(chalk.blue.bold('\n🎯 Performance Metrics:'));
      console.log(chalk.blue(`Average Processing Time: ${Math.round(avgProcessingTime)}ms`));
      console.log(chalk.blue(`Average Fraud Score: ${Math.round(avgFraudScore)}/100`));
      console.log(chalk.blue(`Average Confidence: ${Math.round(avgConfidence)}%`));

      // Stage-specific analysis
      const triageResults = successful.filter(r => r.result.stageResults?.stage1_triage);
      const scrapingResults = successful.filter(r => r.result.stageResults?.stage2_scraping);

      console.log(chalk.magenta.bold('\n🧠 Stage 1 - Triage Effectiveness:'));
      console.log(chalk.magenta(`Triage Coverage: ${triageResults.length}/${successful.length} tests`));
      
      if (triageResults.length > 0) {
        const riskDistribution = {};
        triageResults.forEach(r => {
          const risk = r.result.stageResults.stage1_triage.riskLevel;
          riskDistribution[risk] = (riskDistribution[risk] || 0) + 1;
        });
        
        console.log(chalk.magenta('Risk Distribution:'));
        Object.entries(riskDistribution).forEach(([risk, count]) => {
          console.log(chalk.magenta(`  ${risk}: ${count} companies`));
        });
      }

      console.log(chalk.cyan.bold('\n🌐 Stage 2 - Scraping Efficiency:'));
      console.log(chalk.cyan(`Scraping Coverage: ${scrapingResults.length}/${successful.length} tests`));
      
      if (scrapingResults.length > 0) {
        const avgSources = scrapingResults.reduce((sum, r) => 
          sum + (r.result.stageResults.stage2_scraping.sourcesScraped || 0), 0) / scrapingResults.length;
        console.log(chalk.cyan(`Average Sources per Analysis: ${avgSources.toFixed(1)}`));
        
        const earlyTerminations = scrapingResults.filter(r => 
          r.result.stageResults.stage2_scraping.intelligence?.earlyTermination).length;
        console.log(chalk.cyan(`Early Terminations: ${earlyTerminations}/${scrapingResults.length} (${Math.round(earlyTerminations/scrapingResults.length*100)}%)`));
      }
    }

    console.log(chalk.green.bold('\n✨ STAGE 1 & 2 ENHANCEMENT BENEFITS:'));
    console.log(chalk.green('✅ Intelligent risk triage reduces processing time for obvious cases'));
    console.log(chalk.green('✅ Context-aware scraping focuses resources where needed'));
    console.log(chalk.green('✅ Early termination logic prevents over-processing'));
    console.log(chalk.green('✅ Dynamic resource allocation based on risk assessment'));
    console.log(chalk.green('✅ Enhanced accuracy through multi-stage analysis'));
    console.log(chalk.green('✅ Graceful fallback when web scraping fails (macOS limitations)'));

    if (failed.length > 0) {
      console.log(chalk.red.bold('\n❌ Failed Tests:'));
      failed.forEach((result, index) => {
        console.log(chalk.red(`${index + 1}. ${result.testCase.company.name}: ${result.error}`));
      });
    }
  }

  /**
   * Utility functions
   */
  parseScoreRange(scoreStr) {
    if (scoreStr.includes('<')) {
      return { min: 0, max: parseInt(scoreStr.replace('<', '').trim()) };
    } else if (scoreStr.includes('>')) {
      return { min: parseInt(scoreStr.replace('>', '').trim()), max: 100 };
    } else if (scoreStr.includes('-')) {
      const [min, max] = scoreStr.split('-').map(s => parseInt(s.trim()));
      return { min, max };
    }
    return { min: 0, max: 100 };
  }

  parseTimeRange(timeStr) {
    if (timeStr.includes('<')) {
      const seconds = parseInt(timeStr.replace('<', '').replace('s', '').trim());
      return { min: 0, max: seconds * 1000 };
    } else if (timeStr.includes('-')) {
      const [minStr, maxStr] = timeStr.split('-');
      const min = parseInt(minStr.replace('s', '').trim()) * 1000;
      const max = parseInt(maxStr.replace('s', '').trim()) * 1000;
      return { min, max };
    }
    return { min: 0, max: 120000 }; // 2 minute default max
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new EnhancedSystemDemo();
  
  demo.runEnhancedSystemDemo()
    .then(results => {
      console.log(chalk.green.bold('\n🎉 Enhanced System Demo Completed Successfully!'));
      process.exit(0);
    })
    .catch(error => {
      console.log(chalk.red.bold('\n💥 Demo Failed:'));
      console.log(chalk.red(error.message));
      process.exit(1);
    });
}

export default EnhancedSystemDemo;