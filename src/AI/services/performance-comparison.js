/**
 * Performance Comparison Utilities for Enhanced Fraud Detection System
 * Compares Stage 1 & 2 Enhanced Analysis with Legacy System
 */
class PerformanceComparison {
  constructor() {
    this.testResults = [];
    this.comparisonMetrics = {
      accuracy: [],
      speed: [],
      resourceEfficiency: [],
      dataQuality: []
    };
  }

  /**
   * Runs comprehensive performance comparison between enhanced and legacy systems
   */
  async runPerformanceComparison(fraudAnalyzer, testCases = null) {
    console.log('🚀 Starting Performance Comparison: Enhanced vs Legacy Analysis');
    console.log('=' .repeat(60));
    
    const testCompanies = testCases || this.getDefaultTestCases();
    const results = {
      enhanced: [],
      legacy: [],
      comparison: {},
      summary: {}
    };
    
    // Run Enhanced Analysis (Stage 1 & 2)
    console.log('\n📊 Running Enhanced Analysis (with Stage 1 & 2)...');
    for (const company of testCompanies) {
      const enhancedResult = await this.runEnhancedAnalysis(fraudAnalyzer, company);
      results.enhanced.push(enhancedResult);
    }
    
    // Run Legacy Analysis (without Stage 1 & 2)
    console.log('\n📊 Running Legacy Analysis (original system)...');
    for (const company of testCompanies) {
      const legacyResult = await this.runLegacyAnalysis(fraudAnalyzer, company);
      results.legacy.push(legacyResult);
    }
    
    // Generate comparison metrics
    results.comparison = this.generateComparisonMetrics(results.enhanced, results.legacy);
    results.summary = this.generatePerformanceSummary(results.comparison);
    
    // Store results for historical tracking
    this.testResults.push({
      timestamp: new Date().toISOString(),
      results: results
    });
    
    this.printPerformanceReport(results);
    return results;
  }

  /**
   * Default test cases covering various risk scenarios
   */
  getDefaultTestCases() {
    return [
      // Low Risk Cases
      {
        name: 'PT Bank Mandiri Tbk',
        description: 'Bank BUMN terbesar Indonesia terdaftar OJK dengan sertifikat ISO 27001',
        industry: 'banking',
        expectedRisk: 'low',
        category: 'established_financial'
      },
      {
        name: 'PT Aqua Golden Mississippi',
        description: 'Produsen air minum dalam kemasan merek AQUA terbesar Indonesia sejak 1985',
        industry: 'manufacturing',
        expectedRisk: 'low',
        category: 'established_manufacturing'
      },
      
      // Medium Risk Cases
      {
        name: 'PT Digital Payment Indonesia',
        description: 'Startup fintech digital payment dengan aplikasi mobile banking',
        industry: 'fintech',
        expectedRisk: 'medium',
        category: 'new_fintech'
      },
      {
        name: 'CV Batik Yogyakarta',
        description: 'Usaha batik tradisional dengan penjualan online sejak 2020',
        industry: 'retail',
        expectedRisk: 'medium',
        category: 'traditional_digitizing'
      },
      
      // High Risk Cases
      {
        name: 'PT Investasi Crypto Mining',
        description: 'Perusahaan investasi cryptocurrency mining dengan return 25% per bulan',
        industry: 'cryptocurrency',
        expectedRisk: 'high',
        category: 'high_return_investment'
      },
      {
        name: 'Bisnis Online Guaranteed Profit',
        description: 'Platform investasi online dengan jaminan profit guaranteed tanpa risiko',
        industry: 'investment',
        expectedRisk: 'critical',
        category: 'obvious_scam'
      }
    ];
  }

  /**
   * Runs enhanced analysis and captures performance metrics
   */
  async runEnhancedAnalysis(fraudAnalyzer, testCase) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fraudAnalyzer.analyzeCompany({
        name: testCase.name,
        description: testCase.description,
        industry: testCase.industry
      });
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      return {
        testCase: testCase,
        result: result,
        performance: {
          duration: endTime - startTime,
          memoryUsage: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          },
          resourcesUsed: result.performance?.resourcesUsed || {},
          efficiency: result.performance?.efficiency || 0
        },
        success: true
      };
      
    } catch (error) {
      return {
        testCase: testCase,
        error: error.message,
        performance: {
          duration: Date.now() - startTime,
          memoryUsage: { heapUsed: 0, heapTotal: 0 },
          resourcesUsed: {},
          efficiency: 0
        },
        success: false
      };
    }
  }

  /**
   * Runs legacy analysis and captures performance metrics
   */
  async runLegacyAnalysis(fraudAnalyzer, testCase) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fraudAnalyzer.testLegacyAnalyzer();
      const matchingResult = result.find(r => r.company === testCase.name) || result[0];
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      return {
        testCase: testCase,
        result: matchingResult?.result || {},
        performance: {
          duration: endTime - startTime,
          memoryUsage: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          },
          resourcesUsed: { sources: 0, searchTerms: 0, earlyTermination: false },
          efficiency: 50 // Default efficiency for legacy
        },
        success: true
      };
      
    } catch (error) {
      return {
        testCase: testCase,
        error: error.message,
        performance: {
          duration: Date.now() - startTime,
          memoryUsage: { heapUsed: 0, heapTotal: 0 },
          resourcesUsed: {},
          efficiency: 0
        },
        success: false
      };
    }
  }

  /**
   * Generates detailed comparison metrics
   */
  generateComparisonMetrics(enhancedResults, legacyResults) {
    const metrics = {
      accuracy: this.compareAccuracy(enhancedResults, legacyResults),
      speed: this.compareSpeed(enhancedResults, legacyResults),
      resourceEfficiency: this.compareResourceEfficiency(enhancedResults, legacyResults),
      dataQuality: this.compareDataQuality(enhancedResults, legacyResults),
      reliability: this.compareReliability(enhancedResults, legacyResults)
    };

    return metrics;
  }

  /**
   * Compares accuracy by checking alignment with expected risk levels
   */
  compareAccuracy(enhancedResults, legacyResults) {
    const enhancedAccuracy = this.calculateAccuracy(enhancedResults);
    const legacyAccuracy = this.calculateAccuracy(legacyResults);
    
    return {
      enhanced: enhancedAccuracy,
      legacy: legacyAccuracy,
      improvement: enhancedAccuracy.percentage - legacyAccuracy.percentage,
      winner: enhancedAccuracy.percentage >= legacyAccuracy.percentage ? 'enhanced' : 'legacy'
    };
  }

  /**
   * Calculates accuracy based on expected vs actual risk levels
   */
  calculateAccuracy(results) {
    let correct = 0;
    let total = results.length;
    const details = [];
    
    for (const result of results) {
      if (result.success && result.result.riskLevel) {
        const expected = result.testCase.expectedRisk;
        const actual = result.result.riskLevel;
        const isCorrect = this.isRiskLevelMatch(expected, actual);
        
        if (isCorrect) correct++;
        
        details.push({
          company: result.testCase.name,
          expected: expected,
          actual: actual,
          correct: isCorrect
        });
      }
    }
    
    return {
      correct: correct,
      total: total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      details: details
    };
  }

  /**
   * Checks if risk levels are reasonably aligned (allows for one level difference)
   */
  isRiskLevelMatch(expected, actual) {
    const riskMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const expectedNum = riskMap[expected] || 2;
    const actualNum = riskMap[actual] || 2;
    
    return Math.abs(expectedNum - actualNum) <= 1; // Allow one level difference
  }

  /**
   * Compares processing speed between systems
   */
  compareSpeed(enhancedResults, legacyResults) {
    const enhancedTimes = enhancedResults.map(r => r.performance.duration);
    const legacyTimes = legacyResults.map(r => r.performance.duration);
    
    const enhancedAvg = this.calculateAverage(enhancedTimes);
    const legacyAvg = this.calculateAverage(legacyTimes);
    
    return {
      enhanced: {
        average: enhancedAvg,
        min: Math.min(...enhancedTimes),
        max: Math.max(...enhancedTimes),
        times: enhancedTimes
      },
      legacy: {
        average: legacyAvg,
        min: Math.min(...legacyTimes),
        max: Math.max(...legacyTimes),
        times: legacyTimes
      },
      speedImprovement: legacyAvg > 0 ? Math.round(((legacyAvg - enhancedAvg) / legacyAvg) * 100) : 0,
      winner: enhancedAvg <= legacyAvg ? 'enhanced' : 'legacy'
    };
  }

  /**
   * Compares resource efficiency between systems
   */
  compareResourceEfficiency(enhancedResults, legacyResults) {
    const enhancedEfficiency = this.calculateAverageEfficiency(enhancedResults);
    const legacyEfficiency = this.calculateAverageEfficiency(legacyResults);
    
    const enhancedResources = this.calculateResourceUsage(enhancedResults);
    const legacyResources = this.calculateResourceUsage(legacyResults);
    
    return {
      enhanced: {
        efficiency: enhancedEfficiency,
        resourceUsage: enhancedResources
      },
      legacy: {
        efficiency: legacyEfficiency,
        resourceUsage: legacyResources
      },
      efficiencyImprovement: enhancedEfficiency - legacyEfficiency,
      winner: enhancedEfficiency >= legacyEfficiency ? 'enhanced' : 'legacy'
    };
  }

  /**
   * Compares data quality between systems
   */
  compareDataQuality(enhancedResults, legacyResults) {
    const enhancedQuality = this.calculateDataQuality(enhancedResults);
    const legacyQuality = this.calculateDataQuality(legacyResults);
    
    return {
      enhanced: enhancedQuality,
      legacy: legacyQuality,
      improvement: enhancedQuality.score - legacyQuality.score,
      winner: enhancedQuality.score >= legacyQuality.score ? 'enhanced' : 'legacy'
    };
  }

  /**
   * Compares system reliability (success rate)
   */
  compareReliability(enhancedResults, legacyResults) {
    const enhancedSuccessRate = (enhancedResults.filter(r => r.success).length / enhancedResults.length) * 100;
    const legacySuccessRate = (legacyResults.filter(r => r.success).length / legacyResults.length) * 100;
    
    return {
      enhanced: Math.round(enhancedSuccessRate),
      legacy: Math.round(legacySuccessRate),
      improvement: Math.round(enhancedSuccessRate - legacySuccessRate),
      winner: enhancedSuccessRate >= legacySuccessRate ? 'enhanced' : 'legacy'
    };
  }

  /**
   * Helper calculation methods
   */
  calculateAverage(numbers) {
    return numbers.length > 0 ? Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length) : 0;
  }

  calculateAverageEfficiency(results) {
    const efficiencies = results
      .filter(r => r.success && r.performance.efficiency > 0)
      .map(r => r.performance.efficiency);
    
    return this.calculateAverage(efficiencies);
  }

  calculateResourceUsage(results) {
    const resources = results
      .filter(r => r.success && r.performance.resourcesUsed)
      .map(r => r.performance.resourcesUsed);
    
    return {
      avgSources: this.calculateAverage(resources.map(r => r.sources || 0)),
      avgSearchTerms: this.calculateAverage(resources.map(r => r.searchTerms || 0)),
      earlyTerminationRate: Math.round((resources.filter(r => r.earlyTermination).length / resources.length) * 100)
    };
  }

  calculateDataQuality(results) {
    const qualityScores = {
      comprehensive: 100,
      good: 80,
      limited: 60,
      minimal: 40,
      unavailable: 20
    };
    
    const qualities = results
      .filter(r => r.success && r.result.webResearchSummary?.dataQuality)
      .map(r => qualityScores[r.result.webResearchSummary.dataQuality] || 50);
    
    return {
      score: this.calculateAverage(qualities),
      distribution: this.getQualityDistribution(results)
    };
  }

  getQualityDistribution(results) {
    const distribution = { comprehensive: 0, good: 0, limited: 0, minimal: 0, unavailable: 0 };
    
    for (const result of results) {
      if (result.success && result.result.webResearchSummary?.dataQuality) {
        const quality = result.result.webResearchSummary.dataQuality;
        if (distribution.hasOwnProperty(quality)) {
          distribution[quality]++;
        }
      }
    }
    
    return distribution;
  }

  /**
   * Generates performance summary with recommendations
   */
  generatePerformanceSummary(comparison) {
    const summary = {
      overallWinner: this.determineOverallWinner(comparison),
      keyImprovements: [],
      recommendations: [],
      riskAssessment: 'medium'
    };
    
    // Analyze key improvements
    if (comparison.accuracy.improvement > 0) {
      summary.keyImprovements.push(`Accuracy improved by ${comparison.accuracy.improvement}%`);
    }
    
    if (comparison.speed.speedImprovement > 0) {
      summary.keyImprovements.push(`Speed improved by ${comparison.speed.speedImprovement}%`);
    }
    
    if (comparison.resourceEfficiency.efficiencyImprovement > 0) {
      summary.keyImprovements.push(`Resource efficiency improved by ${Math.round(comparison.resourceEfficiency.efficiencyImprovement)}%`);
    }
    
    if (comparison.dataQuality.improvement > 0) {
      summary.keyImprovements.push(`Data quality improved by ${Math.round(comparison.dataQuality.improvement)} points`);
    }
    
    // Generate recommendations
    summary.recommendations = this.generateRecommendations(comparison);
    
    // Assess deployment risk
    summary.riskAssessment = this.assessDeploymentRisk(comparison);
    
    return summary;
  }

  /**
   * Determines overall winner based on weighted scoring
   */
  determineOverallWinner(comparison) {
    const weights = {
      accuracy: 0.4,
      speed: 0.2,
      resourceEfficiency: 0.2,
      dataQuality: 0.15,
      reliability: 0.05
    };
    
    let enhancedScore = 0;
    let legacyScore = 0;
    
    for (const [metric, weight] of Object.entries(weights)) {
      if (comparison[metric].winner === 'enhanced') {
        enhancedScore += weight;
      } else {
        legacyScore += weight;
      }
    }
    
    return {
      winner: enhancedScore >= legacyScore ? 'enhanced' : 'legacy',
      enhancedScore: Math.round(enhancedScore * 100),
      legacyScore: Math.round(legacyScore * 100),
      confidence: Math.abs(enhancedScore - legacyScore) > 0.3 ? 'high' : 'medium'
    };
  }

  /**
   * Generates deployment recommendations
   */
  generateRecommendations(comparison) {
    const recommendations = [];
    
    if (comparison.accuracy.improvement >= 10) {
      recommendations.push('✅ Significant accuracy improvement - ready for production deployment');
    } else if (comparison.accuracy.improvement < -5) {
      recommendations.push('⚠️ Accuracy regression detected - review risk assessment logic');
    }
    
    if (comparison.speed.speedImprovement >= 20) {
      recommendations.push('✅ Excellent performance optimization achieved');
    } else if (comparison.speed.speedImprovement < -20) {
      recommendations.push('⚠️ Performance degradation - optimize scraping strategy');
    }
    
    if (comparison.resourceEfficiency.efficiencyImprovement >= 15) {
      recommendations.push('✅ Resource efficiency significantly improved');
    }
    
    if (comparison.reliability.improvement < 0) {
      recommendations.push('❌ Reliability decreased - investigate error handling');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('➡️ Mixed results - consider A/B testing in production');
    }
    
    return recommendations;
  }

  /**
   * Assesses deployment risk level
   */
  assessDeploymentRisk(comparison) {
    let riskFactors = 0;
    
    if (comparison.accuracy.improvement < -10) riskFactors += 2;
    if (comparison.speed.speedImprovement < -30) riskFactors += 1;
    if (comparison.reliability.improvement < -5) riskFactors += 2;
    if (comparison.resourceEfficiency.efficiencyImprovement < -20) riskFactors += 1;
    
    if (riskFactors >= 3) return 'high';
    if (riskFactors >= 1) return 'medium';
    return 'low';
  }

  /**
   * Prints comprehensive performance report
   */
  printPerformanceReport(results) {
    const { comparison, summary } = results;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE COMPARISON REPORT');
    console.log('='.repeat(60));
    
    // Overall Winner
    console.log(`\n🏆 OVERALL WINNER: ${summary.overallWinner.winner.toUpperCase()}`);
    console.log(`   Enhanced Score: ${summary.overallWinner.enhancedScore}% | Legacy Score: ${summary.overallWinner.legacyScore}%`);
    console.log(`   Confidence: ${summary.overallWinner.confidence.toUpperCase()}`);
    
    // Detailed Metrics
    console.log('\n📈 DETAILED METRICS:');
    console.log(`┌─ Accuracy: ${comparison.accuracy.winner} wins (Enhanced: ${comparison.accuracy.enhanced.percentage}% | Legacy: ${comparison.accuracy.legacy.percentage}%)`);
    console.log(`├─ Speed: ${comparison.speed.winner} wins (Enhanced: ${comparison.speed.enhanced.average}ms | Legacy: ${comparison.speed.legacy.average}ms)`);
    console.log(`├─ Resource Efficiency: ${comparison.resourceEfficiency.winner} wins (Enhanced: ${comparison.resourceEfficiency.enhanced.efficiency}% | Legacy: ${comparison.resourceEfficiency.legacy.efficiency}%)`);
    console.log(`├─ Data Quality: ${comparison.dataQuality.winner} wins (Enhanced: ${comparison.dataQuality.enhanced.score} | Legacy: ${comparison.dataQuality.legacy.score})`);
    console.log(`└─ Reliability: ${comparison.reliability.winner} wins (Enhanced: ${comparison.reliability.enhanced}% | Legacy: ${comparison.reliability.legacy}%)`);
    
    // Key Improvements
    if (summary.keyImprovements.length > 0) {
      console.log('\n✨ KEY IMPROVEMENTS:');
      summary.keyImprovements.forEach(improvement => console.log(`   • ${improvement}`));
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    summary.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    console.log(`\n⚠️ DEPLOYMENT RISK: ${summary.riskAssessment.toUpperCase()}`);
    console.log('='.repeat(60));
  }

  /**
   * Export results to JSON for further analysis
   */
  exportResults(filename = null) {
    const exportData = {
      timestamp: new Date().toISOString(),
      testResults: this.testResults,
      summary: 'Performance comparison results for Enhanced vs Legacy fraud detection'
    };
    
    const fileName = filename || `performance_comparison_${Date.now()}.json`;
    
    try {
      const fs = require('fs');
      fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2));
      console.log(`📁 Results exported to ${fileName}`);
      return fileName;
    } catch (error) {
      console.error('Export failed:', error.message);
      return null;
    }
  }
}

export default PerformanceComparison;