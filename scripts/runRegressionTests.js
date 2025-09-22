#!/usr/bin/env node

/**
 * Run Regression Tests Script
 * Executes comprehensive regression testing suite
 */

const path = require('path');
const logger = require('../utils/logger');
const RegressionTester = require('../evaluation/RegressionTester');

async function main() {
  try {
    const args = process.argv.slice(2);
    const testDatasetPath = args[0] || path.join(__dirname, '..', 'evaluation', 'golden_dataset.jsonl');
    
    console.log('🧪 Starting Regression Test Suite...');
    console.log('===================================\n');
    console.log(`📊 Test Dataset: ${testDatasetPath}`);
    console.log(`⏱️ Start Time: ${new Date().toISOString()}\n`);

    // Initialize tester
    const tester = new RegressionTester();

    // Run evaluation suite
    const results = await tester.runEvaluationSuite(testDatasetPath, {
      batchSize: 10,
    });

    // Display results
    console.log('\n🎉 Regression Tests Complete!');
    console.log('=============================');
    console.log(`📊 Total Tests: ${results.metrics.totalTests}`);
    console.log(`✅ Passed: ${results.metrics.passedTests}`);
    console.log(`❌ Failed: ${results.metrics.failedTests}`);
    console.log(`📈 Pass Rate: ${(results.report.summary.passRate * 100).toFixed(1)}%`);
    console.log(`⏱️ Execution Time: ${(results.executionTime / 1000).toFixed(2)}s`);

    console.log('\n📋 Key Metrics:');
    console.log(`🎯 Accuracy: ${(results.metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`📚 Citation Precision: ${(results.metrics.citationPrecision * 100).toFixed(1)}%`);
    console.log(`📚 Citation Recall: ${(results.metrics.citationRecall * 100).toFixed(1)}%`);
    console.log(`⚡ Avg Response Time: ${results.metrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`🎚️ Confidence Calibration: ${(results.metrics.confidenceCalibration * 100).toFixed(1)}%`);

    // Category breakdown
    console.log('\n📂 Category Performance:');
    Object.entries(results.report.categoryBreakdown).forEach(([category, data]) => {
      console.log(`  ${category}: ${(data.passRate * 100).toFixed(1)}% (${data.passed}/${data.total})`);
    });

    // Difficulty breakdown
    console.log('\n🎚️ Difficulty Performance:');
    Object.entries(results.report.difficultyBreakdown).forEach(([difficulty, data]) => {
      console.log(`  ${difficulty}: ${(data.passRate * 100).toFixed(1)}% (${data.passed}/${data.total})`);
    });

    // Failed tests summary
    if (results.report.failedTests.length > 0) {
      console.log('\n❌ Failed Tests Summary:');
      results.report.failedTests.slice(0, 5).forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.testId}: ${test.reason}`);
      });
      
      if (results.report.failedTests.length > 5) {
        console.log(`  ... and ${results.report.failedTests.length - 5} more`);
      }
    }

    // Recommendations
    if (results.report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      results.report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
      });
    }

    // Save results
    const outputPath = path.join(__dirname, '..', 'evaluation', 'regression_results.json');
    await tester.saveResults(results.results, results.metrics, results.report, outputPath);
    console.log(`\n💾 Results saved to: ${outputPath}`);

    // Output JSON for CI/CD
    const ciOutput = {
      metrics: results.metrics,
      report: results.report,
      executionTime: results.executionTime,
      timestamp: new Date().toISOString(),
    };
    
    console.log('\n' + JSON.stringify(ciOutput, null, 2));

    // Exit with appropriate code
    const passThreshold = 0.85; // 85% pass rate threshold
    if (results.report.summary.passRate < passThreshold) {
      console.log(`\n⚠️ Pass rate ${(results.report.summary.passRate * 100).toFixed(1)}% is below threshold ${(passThreshold * 100)}%`);
      process.exit(1);
    }

    console.log('\n✅ All quality gates passed!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Regression testing failed:', error);
    console.error('\n💥 Regression testing failed:', error.message);
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Testing interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Testing terminated');
  process.exit(1);
});

// Run the script
main();
