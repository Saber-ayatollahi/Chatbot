#!/usr/bin/env node

/**
 * Run Performance Benchmarks Script
 * Executes comprehensive performance testing suite
 */

const path = require('path');
const logger = require('../utils/logger');
const PerformanceBenchmarker = require('../evaluation/PerformanceBenchmarker');

async function main() {
  try {
    console.log('🏃‍♂️ Starting Performance Benchmarks...');
    console.log('====================================\n');
    console.log(`⏱️ Start Time: ${new Date().toISOString()}\n`);

    // Initialize benchmarker
    const benchmarker = new PerformanceBenchmarker();

    // Configuration
    const benchmarkConfig = {
      concurrencyLevels: [1, 2, 5, 10],
      iterations: 50, // Reduced for CI/CD
      warmupIterations: 5,
      includeSystemMetrics: true,
      includeMemoryProfiling: true,
    };

    // Run benchmarks
    const results = await benchmarker.runBenchmark(benchmarkConfig);

    // Display results
    console.log('\n🎉 Performance Benchmarks Complete!');
    console.log('==================================');
    console.log(`⏱️ Total Execution Time: ${(results.executionTime / 1000).toFixed(2)}s`);

    // Performance summary
    const analysis = results.analysis;
    console.log('\n📊 Performance Summary:');
    console.log(`🎯 Average Response Time: ${analysis.performance.averageResponseTime.toFixed(0)}ms`);
    console.log(`📈 95th Percentile: ${analysis.performance.p95ResponseTime.toFixed(0)}ms`);
    console.log(`⚡ Throughput: ${analysis.performance.throughput.toFixed(2)} RPS`);
    console.log(`✅ Success Rate: ${(analysis.performance.successRate * 100).toFixed(1)}%`);

    // Scalability analysis
    if (analysis.scalability && analysis.scalability.performanceDegradation) {
      console.log('\n📈 Scalability Analysis:');
      Object.entries(analysis.scalability.performanceDegradation).forEach(([concurrency, metrics]) => {
        console.log(`  ${concurrency} threads: ${metrics.responseTime.toFixed(0)}ms avg, ${metrics.throughput.toFixed(2)} RPS`);
      });
    }

    // Reliability analysis
    console.log('\n🔒 Reliability Analysis:');
    console.log(`❌ Overall Error Rate: ${(analysis.reliability.overallErrorRate * 100).toFixed(2)}%`);
    
    if (analysis.reliability.errorTypes && Object.keys(analysis.reliability.errorTypes).length > 0) {
      console.log('Error Types:');
      Object.entries(analysis.reliability.errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    // Memory analysis
    if (results.memoryProfile && results.memoryProfile.analysis) {
      const memAnalysis = results.memoryProfile.analysis;
      console.log('\n🧠 Memory Analysis:');
      console.log(`📈 Heap Growth: ${(memAnalysis.memoryGrowth.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 RSS Growth: ${(memAnalysis.memoryGrowth.rss / 1024 / 1024).toFixed(2)}MB`);
      
      if (memAnalysis.leakIndicators.length > 0) {
        console.log('⚠️ Memory Leak Indicators:');
        memAnalysis.leakIndicators.forEach(indicator => {
          console.log(`  ${indicator.severity.toUpperCase()}: ${indicator.message}`);
        });
      } else {
        console.log('✅ No memory leak indicators detected');
      }
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
      });
    }

    // Save results
    const outputDir = path.join(__dirname, '..', 'evaluation', 'performance_results');
    const reportPaths = await benchmarker.generatePerformanceReport(results, outputDir);
    
    console.log(`\n💾 Results saved to: ${outputDir}`);
    console.log(`📊 Summary: ${reportPaths.summaryPath}`);
    console.log(`📈 CSV: ${reportPaths.csvPath}`);

    // Output JSON for CI/CD
    const ciOutput = {
      analysis: results.analysis,
      executionTime: results.executionTime,
      timestamp: new Date().toISOString(),
    };
    
    console.log('\n' + JSON.stringify(ciOutput, null, 2));

    // Quality gates
    const qualityGates = {
      p95ResponseTime: 3000, // 3 seconds
      errorRate: 0.05, // 5%
      throughput: 1.0, // 1 RPS minimum
    };

    let qualityGatesPassed = true;

    if (analysis.performance.p95ResponseTime > qualityGates.p95ResponseTime) {
      console.log(`\n⚠️ Quality Gate Failed: P95 response time ${analysis.performance.p95ResponseTime.toFixed(0)}ms > ${qualityGates.p95ResponseTime}ms`);
      qualityGatesPassed = false;
    }

    if (analysis.reliability.overallErrorRate > qualityGates.errorRate) {
      console.log(`\n⚠️ Quality Gate Failed: Error rate ${(analysis.reliability.overallErrorRate * 100).toFixed(2)}% > ${(qualityGates.errorRate * 100)}%`);
      qualityGatesPassed = false;
    }

    if (analysis.performance.throughput < qualityGates.throughput) {
      console.log(`\n⚠️ Quality Gate Failed: Throughput ${analysis.performance.throughput.toFixed(2)} RPS < ${qualityGates.throughput} RPS`);
      qualityGatesPassed = false;
    }

    // Cleanup
    benchmarker.cleanup();

    if (!qualityGatesPassed) {
      console.log('\n❌ Performance quality gates failed!');
      process.exit(1);
    }

    console.log('\n✅ All performance quality gates passed!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Performance benchmarking failed:', error);
    console.error('\n💥 Performance benchmarking failed:', error.message);
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Benchmarking interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Benchmarking terminated');
  process.exit(1);
});

// Run the script
main();
