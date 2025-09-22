/**
 * Performance Benchmarker
 * System for measuring and monitoring RAG system performance
 */

const fs = require('fs').promises;
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');
const os = require('os');
const logger = require('../utils/logger');
const RAGChatService = require('../services/RAGChatService');
const { getConfig } = require('../config/environment');

class PerformanceBenchmarker {
  constructor() {
    this.config = getConfig();
    this.ragChatService = new RAGChatService();
    this.benchmarkResults = [];
    this.systemMetrics = [];
    this.performanceObserver = null;
    this.setupPerformanceObserver();
  }

  /**
   * Setup performance observer for detailed metrics
   */
  setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name.startsWith('rag_')) {
          this.recordPerformanceEntry(entry);
        }
      });
    });

    this.performanceObserver.observe({ 
      entryTypes: ['measure', 'mark'],
      buffered: true 
    });
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark(options = {}) {
    logger.info('🏃‍♂️ Starting performance benchmark...');

    const benchmarkConfig = {
      testQueries: options.testQueries || this.getDefaultTestQueries(),
      concurrencyLevels: options.concurrencyLevels || [1, 2, 5, 10],
      iterations: options.iterations || 100,
      warmupIterations: options.warmupIterations || 10,
      includeSystemMetrics: options.includeSystemMetrics !== false,
      includeMemoryProfiling: options.includeMemoryProfiling !== false,
      ...options
    };

    const startTime = performance.now();

    try {
      // System baseline
      const systemBaseline = await this.captureSystemBaseline();
      logger.info('📊 System baseline captured');

      // Warmup
      await this.runWarmup(benchmarkConfig.testQueries, benchmarkConfig.warmupIterations);
      logger.info('🔥 Warmup completed');

      // Run benchmarks
      const benchmarkResults = [];

      // Single-threaded performance
      logger.info('🔄 Running single-threaded benchmarks...');
      const singleThreaded = await this.runSingleThreadedBenchmark(
        benchmarkConfig.testQueries,
        benchmarkConfig.iterations
      );
      benchmarkResults.push(singleThreaded);

      // Concurrent performance
      for (const concurrency of benchmarkConfig.concurrencyLevels) {
        if (concurrency > 1) {
          logger.info(`🔄 Running concurrent benchmark (${concurrency} threads)...`);
          const concurrent = await this.runConcurrentBenchmark(
            benchmarkConfig.testQueries,
            concurrency,
            benchmarkConfig.iterations
          );
          benchmarkResults.push(concurrent);
        }
      }

      // Load testing
      logger.info('🔄 Running load test...');
      const loadTest = await this.runLoadTest(
        benchmarkConfig.testQueries,
        benchmarkConfig.iterations * 2
      );
      benchmarkResults.push(loadTest);

      // Memory profiling
      let memoryProfile = null;
      if (benchmarkConfig.includeMemoryProfiling) {
        logger.info('🧠 Running memory profiling...');
        memoryProfile = await this.runMemoryProfiling(benchmarkConfig.testQueries);
      }

      // System stress test
      logger.info('💪 Running system stress test...');
      const stressTest = await this.runStressTest(benchmarkConfig.testQueries);
      benchmarkResults.push(stressTest);

      // Final system metrics
      const finalSystemMetrics = await this.captureSystemMetrics();

      // Compile results
      const results = {
        config: benchmarkConfig,
        systemBaseline,
        benchmarkResults,
        memoryProfile,
        stressTest,
        finalSystemMetrics,
        executionTime: performance.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // Generate analysis
      const analysis = this.analyzeBenchmarkResults(results);
      results.analysis = analysis;

      logger.info(`✅ Benchmark completed in ${(results.executionTime / 1000).toFixed(2)}s`);
      
      return results;

    } catch (error) {
      logger.error('❌ Benchmark failed:', error);
      throw error;
    }
  }

  /**
   * Get default test queries for benchmarking
   */
  getDefaultTestQueries() {
    return [
      {
        id: 'simple_factual',
        query: 'What are the required fields for fund creation?',
        expectedComplexity: 'low',
        category: 'fund_creation'
      },
      {
        id: 'complex_procedural',
        query: 'Walk me through the complete process of calculating NAV for a multi-asset fund with foreign exchange considerations.',
        expectedComplexity: 'high',
        category: 'nav_calculation'
      },
      {
        id: 'medium_compliance',
        query: 'What compliance requirements must be met before launching a new fund?',
        expectedComplexity: 'medium',
        category: 'compliance'
      },
      {
        id: 'detailed_reporting',
        query: 'How do I generate monthly performance reports with benchmark comparisons?',
        expectedComplexity: 'medium',
        category: 'reporting'
      },
      {
        id: 'troubleshooting',
        query: 'The fund creation wizard is showing validation errors. How do I resolve them?',
        expectedComplexity: 'medium',
        category: 'troubleshooting'
      }
    ];
  }

  /**
   * Capture system baseline metrics
   */
  async captureSystemBaseline() {
    const baseline = {
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
      },
      process: {
        pid: process.pid,
        version: process.version,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      }
    };

    return baseline;
  }

  /**
   * Run warmup iterations
   */
  async runWarmup(testQueries, iterations) {
    const warmupQuery = testQueries[0]; // Use first query for warmup
    
    for (let i = 0; i < iterations; i++) {
      try {
        await this.ragChatService.generateResponse(
          warmupQuery.query,
          `warmup_session_${i}`,
          { maxChunks: 3 }
        );
      } catch (error) {
        logger.warn(`⚠️ Warmup iteration ${i} failed:`, error.message);
      }
    }
  }

  /**
   * Run single-threaded benchmark
   */
  async runSingleThreadedBenchmark(testQueries, iterations) {
    logger.info(`🔄 Running ${iterations} single-threaded iterations...`);

    const results = {
      type: 'single_threaded',
      concurrency: 1,
      iterations,
      results: [],
      metrics: {},
    };

    const startTime = performance.now();
    const systemStart = await this.captureSystemMetrics();

    for (let i = 0; i < iterations; i++) {
      const query = testQueries[i % testQueries.length];
      
      try {
        const iterationResult = await this.runSingleIteration(query, `single_${i}`);
        results.results.push(iterationResult);

        // Progress update
        if ((i + 1) % 10 === 0) {
          logger.info(`📈 Single-threaded progress: ${i + 1}/${iterations}`);
        }

      } catch (error) {
        logger.error(`❌ Single-threaded iteration ${i} failed:`, error);
        results.results.push({
          queryId: query.id,
          error: error.message,
          responseTime: 0,
          success: false,
        });
      }
    }

    const endTime = performance.now();
    const systemEnd = await this.captureSystemMetrics();

    results.executionTime = endTime - startTime;
    results.systemMetrics = {
      start: systemStart,
      end: systemEnd,
    };
    results.metrics = this.calculateBenchmarkMetrics(results.results);

    return results;
  }

  /**
   * Run concurrent benchmark
   */
  async runConcurrentBenchmark(testQueries, concurrency, totalIterations) {
    logger.info(`🔄 Running ${totalIterations} iterations with ${concurrency} concurrent threads...`);

    const results = {
      type: 'concurrent',
      concurrency,
      iterations: totalIterations,
      results: [],
      metrics: {},
    };

    const startTime = performance.now();
    const systemStart = await this.captureSystemMetrics();

    // Split iterations across concurrent batches
    const iterationsPerBatch = Math.ceil(totalIterations / concurrency);
    const batches = [];

    for (let batch = 0; batch < concurrency; batch++) {
      const batchPromises = [];
      
      for (let i = 0; i < iterationsPerBatch && (batch * iterationsPerBatch + i) < totalIterations; i++) {
        const iterationIndex = batch * iterationsPerBatch + i;
        const query = testQueries[iterationIndex % testQueries.length];
        
        const promise = this.runSingleIteration(query, `concurrent_${batch}_${i}`)
          .catch(error => ({
            queryId: query.id,
            error: error.message,
            responseTime: 0,
            success: false,
          }));
        
        batchPromises.push(promise);
      }
      
      batches.push(Promise.all(batchPromises));
    }

    // Execute all batches concurrently
    const batchResults = await Promise.all(batches);
    results.results = batchResults.flat();

    const endTime = performance.now();
    const systemEnd = await this.captureSystemMetrics();

    results.executionTime = endTime - startTime;
    results.systemMetrics = {
      start: systemStart,
      end: systemEnd,
    };
    results.metrics = this.calculateBenchmarkMetrics(results.results);

    return results;
  }

  /**
   * Run load test
   */
  async runLoadTest(testQueries, totalRequests) {
    logger.info(`🔄 Running load test with ${totalRequests} requests...`);

    const results = {
      type: 'load_test',
      totalRequests,
      results: [],
      metrics: {},
    };

    const startTime = performance.now();
    const systemStart = await this.captureSystemMetrics();

    // Gradually increase load
    const phases = [
      { duration: 10000, rps: 1 }, // 10s at 1 RPS
      { duration: 20000, rps: 2 }, // 20s at 2 RPS
      { duration: 30000, rps: 5 }, // 30s at 5 RPS
      { duration: 20000, rps: 10 }, // 20s at 10 RPS
    ];

    let requestCount = 0;

    for (const phase of phases) {
      logger.info(`📈 Load test phase: ${phase.rps} RPS for ${phase.duration/1000}s`);
      
      const phaseStart = performance.now();
      const requestInterval = 1000 / phase.rps; // ms between requests
      
      while (performance.now() - phaseStart < phase.duration && requestCount < totalRequests) {
        const query = testQueries[requestCount % testQueries.length];
        
        // Fire request without waiting
        this.runSingleIteration(query, `load_${requestCount}`)
          .then(result => results.results.push(result))
          .catch(error => results.results.push({
            queryId: query.id,
            error: error.message,
            responseTime: 0,
            success: false,
          }));
        
        requestCount++;
        
        // Wait for next request
        await this.delay(requestInterval);
      }
    }

    // Wait for remaining requests to complete
    await this.delay(5000);

    const endTime = performance.now();
    const systemEnd = await this.captureSystemMetrics();

    results.executionTime = endTime - startTime;
    results.systemMetrics = {
      start: systemStart,
      end: systemEnd,
    };
    results.metrics = this.calculateBenchmarkMetrics(results.results);

    return results;
  }

  /**
   * Run memory profiling
   */
  async runMemoryProfiling(testQueries) {
    logger.info('🧠 Starting memory profiling...');

    const profile = {
      snapshots: [],
      leakDetection: {},
    };

    // Initial memory snapshot
    const initialMemory = process.memoryUsage();
    profile.snapshots.push({
      type: 'initial',
      timestamp: Date.now(),
      memory: initialMemory,
    });

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      profile.snapshots.push({
        type: 'after_gc_initial',
        timestamp: Date.now(),
        memory: process.memoryUsage(),
      });
    }

    // Run queries while monitoring memory
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      const query = testQueries[i % testQueries.length];
      
      try {
        await this.ragChatService.generateResponse(
          query.query,
          `memory_profile_${i}`,
          { maxChunks: 3 }
        );

        // Take memory snapshot every 10 iterations
        if ((i + 1) % 10 === 0) {
          profile.snapshots.push({
            type: 'iteration',
            iteration: i + 1,
            timestamp: Date.now(),
            memory: process.memoryUsage(),
          });
        }

      } catch (error) {
        logger.warn(`⚠️ Memory profiling iteration ${i} failed:`, error.message);
      }
    }

    // Force garbage collection and final snapshot
    if (global.gc) {
      global.gc();
      profile.snapshots.push({
        type: 'after_gc_final',
        timestamp: Date.now(),
        memory: process.memoryUsage(),
      });
    }

    // Final memory snapshot
    const finalMemory = process.memoryUsage();
    profile.snapshots.push({
      type: 'final',
      timestamp: Date.now(),
      memory: finalMemory,
    });

    // Analyze memory usage
    profile.analysis = this.analyzeMemoryProfile(profile.snapshots);

    return profile;
  }

  /**
   * Run stress test
   */
  async runStressTest(testQueries) {
    logger.info('💪 Starting stress test...');

    const stressTest = {
      type: 'stress_test',
      phases: [],
      systemMetrics: [],
    };

    // Phase 1: High concurrency
    logger.info('💪 Stress test phase 1: High concurrency');
    const highConcurrency = await this.runConcurrentBenchmark(testQueries, 20, 100);
    stressTest.phases.push({
      name: 'high_concurrency',
      ...highConcurrency,
    });

    // Phase 2: Memory stress
    logger.info('💪 Stress test phase 2: Memory stress');
    const memoryStress = await this.runMemoryStressTest(testQueries);
    stressTest.phases.push({
      name: 'memory_stress',
      ...memoryStress,
    });

    // Phase 3: Long running queries
    logger.info('💪 Stress test phase 3: Long running queries');
    const longRunning = await this.runLongRunningTest(testQueries);
    stressTest.phases.push({
      name: 'long_running',
      ...longRunning,
    });

    return stressTest;
  }

  /**
   * Run memory stress test
   */
  async runMemoryStressTest(testQueries) {
    const results = {
      type: 'memory_stress',
      iterations: 200,
      results: [],
      metrics: {},
    };

    const startTime = performance.now();
    const systemStart = await this.captureSystemMetrics();

    // Run many iterations to stress memory
    for (let i = 0; i < results.iterations; i++) {
      const query = testQueries[i % testQueries.length];
      
      try {
        const result = await this.runSingleIteration(query, `memory_stress_${i}`);
        results.results.push(result);

        // Monitor memory every 20 iterations
        if ((i + 1) % 20 === 0) {
          const memUsage = process.memoryUsage();
          logger.info(`🧠 Memory usage at iteration ${i + 1}: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
        }

      } catch (error) {
        results.results.push({
          queryId: query.id,
          error: error.message,
          responseTime: 0,
          success: false,
        });
      }
    }

    const endTime = performance.now();
    const systemEnd = await this.captureSystemMetrics();

    results.executionTime = endTime - startTime;
    results.systemMetrics = {
      start: systemStart,
      end: systemEnd,
    };
    results.metrics = this.calculateBenchmarkMetrics(results.results);

    return results;
  }

  /**
   * Run long running test
   */
  async runLongRunningTest(testQueries) {
    const results = {
      type: 'long_running',
      duration: 60000, // 1 minute
      results: [],
      metrics: {},
    };

    const startTime = performance.now();
    const systemStart = await this.captureSystemMetrics();

    let iteration = 0;
    while (performance.now() - startTime < results.duration) {
      const query = testQueries[iteration % testQueries.length];
      
      try {
        const result = await this.runSingleIteration(query, `long_running_${iteration}`);
        results.results.push(result);

        iteration++;

        // Small delay to prevent overwhelming the system
        await this.delay(100);

      } catch (error) {
        results.results.push({
          queryId: query.id,
          error: error.message,
          responseTime: 0,
          success: false,
        });
      }
    }

    const endTime = performance.now();
    const systemEnd = await this.captureSystemMetrics();

    results.executionTime = endTime - startTime;
    results.systemMetrics = {
      start: systemStart,
      end: systemEnd,
    };
    results.metrics = this.calculateBenchmarkMetrics(results.results);

    return results;
  }

  /**
   * Run single iteration
   */
  async runSingleIteration(query, sessionId) {
    const startTime = performance.now();
    performance.mark(`rag_start_${sessionId}`);

    try {
      const response = await this.ragChatService.generateResponse(
        query.query,
        sessionId,
        { maxChunks: 5 }
      );

      const endTime = performance.now();
      performance.mark(`rag_end_${sessionId}`);
      performance.measure(`rag_total_${sessionId}`, `rag_start_${sessionId}`, `rag_end_${sessionId}`);

      return {
        queryId: query.id,
        sessionId,
        query: query.query,
        responseTime: endTime - startTime,
        success: true,
        confidence: response.confidence,
        citationCount: (response.citations || []).length,
        responseLength: response.message.length,
        retrievalTime: response.retrievalMetadata?.vectorSearchTime || 0,
        generationTime: response.generationMetadata?.generationTime || 0,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const endTime = performance.now();
      
      return {
        queryId: query.id,
        sessionId,
        query: query.query,
        responseTime: endTime - startTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Capture current system metrics
   */
  async captureSystemMetrics() {
    return {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      system: {
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
      },
    };
  }

  /**
   * Calculate benchmark metrics
   */
  calculateBenchmarkMetrics(results) {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    if (successfulResults.length === 0) {
      return {
        totalRequests: results.length,
        successfulRequests: 0,
        failedRequests: results.length,
        successRate: 0,
        errorRate: 1,
      };
    }

    const responseTimes = successfulResults.map(r => r.responseTime);
    const sortedTimes = responseTimes.sort((a, b) => a - b);

    const metrics = {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: failedResults.length,
      successRate: successfulResults.length / results.length,
      errorRate: failedResults.length / results.length,
      
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        mean: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        median: this.calculatePercentile(sortedTimes, 50),
        p90: this.calculatePercentile(sortedTimes, 90),
        p95: this.calculatePercentile(sortedTimes, 95),
        p99: this.calculatePercentile(sortedTimes, 99),
        std: this.calculateStandardDeviation(responseTimes),
      },
      
      throughput: {
        requestsPerSecond: successfulResults.length / (Math.max(...responseTimes) / 1000),
      },
    };

    // Add confidence metrics if available
    const confidenceScores = successfulResults
      .filter(r => typeof r.confidence === 'number')
      .map(r => r.confidence);
    
    if (confidenceScores.length > 0) {
      metrics.confidence = {
        mean: confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length,
        min: Math.min(...confidenceScores),
        max: Math.max(...confidenceScores),
      };
    }

    // Add citation metrics if available
    const citationCounts = successfulResults
      .filter(r => typeof r.citationCount === 'number')
      .map(r => r.citationCount);
    
    if (citationCounts.length > 0) {
      metrics.citations = {
        mean: citationCounts.reduce((sum, count) => sum + count, 0) / citationCounts.length,
        min: Math.min(...citationCounts),
        max: Math.max(...citationCounts),
      };
    }

    return metrics;
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(sortedArray, percentile) {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    return sortedArray[lower] * (upper - index) + sortedArray[upper] * (index - lower);
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Analyze memory profile
   */
  analyzeMemoryProfile(snapshots) {
    const analysis = {
      memoryGrowth: {},
      leakIndicators: [],
      recommendations: [],
    };

    if (snapshots.length < 2) {
      return analysis;
    }

    const initial = snapshots[0].memory;
    const final = snapshots[snapshots.length - 1].memory;

    // Calculate memory growth
    analysis.memoryGrowth = {
      heapUsed: final.heapUsed - initial.heapUsed,
      heapTotal: final.heapTotal - initial.heapTotal,
      external: final.external - initial.external,
      rss: final.rss - initial.rss,
    };

    // Check for potential memory leaks
    if (analysis.memoryGrowth.heapUsed > 50 * 1024 * 1024) { // 50MB growth
      analysis.leakIndicators.push({
        type: 'heap_growth',
        severity: 'high',
        growth: analysis.memoryGrowth.heapUsed,
        message: `Heap memory grew by ${Math.round(analysis.memoryGrowth.heapUsed / 1024 / 1024)}MB`,
      });
    }

    if (analysis.memoryGrowth.external > 20 * 1024 * 1024) { // 20MB external growth
      analysis.leakIndicators.push({
        type: 'external_growth',
        severity: 'medium',
        growth: analysis.memoryGrowth.external,
        message: `External memory grew by ${Math.round(analysis.memoryGrowth.external / 1024 / 1024)}MB`,
      });
    }

    // Generate recommendations
    if (analysis.leakIndicators.length > 0) {
      analysis.recommendations.push({
        type: 'memory_management',
        priority: 'high',
        recommendation: 'Investigate potential memory leaks. Consider implementing connection pooling and proper cleanup.',
      });
    }

    return analysis;
  }

  /**
   * Analyze benchmark results
   */
  analyzeBenchmarkResults(results) {
    const analysis = {
      summary: {},
      performance: {},
      scalability: {},
      reliability: {},
      recommendations: [],
    };

    // Summary
    analysis.summary = {
      totalTests: results.benchmarkResults.reduce((sum, r) => sum + r.iterations, 0),
      executionTime: results.executionTime,
      testTypes: results.benchmarkResults.map(r => r.type),
    };

    // Performance analysis
    const singleThreaded = results.benchmarkResults.find(r => r.type === 'single_threaded');
    if (singleThreaded) {
      analysis.performance = {
        averageResponseTime: singleThreaded.metrics.responseTime.mean,
        p95ResponseTime: singleThreaded.metrics.responseTime.p95,
        throughput: singleThreaded.metrics.throughput.requestsPerSecond,
        successRate: singleThreaded.metrics.successRate,
      };
    }

    // Scalability analysis
    const concurrentTests = results.benchmarkResults.filter(r => r.type === 'concurrent');
    if (concurrentTests.length > 0) {
      analysis.scalability = {
        concurrencyLevels: concurrentTests.map(t => t.concurrency),
        performanceDegradation: this.calculatePerformanceDegradation(concurrentTests),
      };
    }

    // Reliability analysis
    const allResults = results.benchmarkResults.flatMap(r => r.results);
    const errorRate = allResults.filter(r => !r.success).length / allResults.length;
    analysis.reliability = {
      overallErrorRate: errorRate,
      errorTypes: this.categorizeErrors(allResults.filter(r => !r.success)),
    };

    // Generate recommendations
    if (analysis.performance.p95ResponseTime > 3000) {
      analysis.recommendations.push({
        type: 'performance',
        priority: 'high',
        issue: `95th percentile response time is ${(analysis.performance.p95ResponseTime / 1000).toFixed(2)}s (target: <3s)`,
        recommendation: 'Optimize retrieval queries, consider caching, or scale infrastructure.',
      });
    }

    if (errorRate > 0.05) {
      analysis.recommendations.push({
        type: 'reliability',
        priority: 'high',
        issue: `Error rate is ${(errorRate * 100).toFixed(1)}% (target: <5%)`,
        recommendation: 'Investigate error causes and implement better error handling.',
      });
    }

    if (results.memoryProfile && results.memoryProfile.leakIndicators.length > 0) {
      analysis.recommendations.push({
        type: 'memory',
        priority: 'medium',
        issue: 'Potential memory leaks detected',
        recommendation: 'Review memory usage patterns and implement proper cleanup.',
      });
    }

    return analysis;
  }

  /**
   * Calculate performance degradation across concurrency levels
   */
  calculatePerformanceDegradation(concurrentTests) {
    const degradation = {};
    
    concurrentTests.forEach(test => {
      degradation[test.concurrency] = {
        responseTime: test.metrics.responseTime.mean,
        throughput: test.metrics.throughput.requestsPerSecond,
        errorRate: test.metrics.errorRate,
      };
    });

    return degradation;
  }

  /**
   * Categorize errors
   */
  categorizeErrors(errorResults) {
    const categories = {};
    
    errorResults.forEach(result => {
      const errorType = this.categorizeError(result.error);
      categories[errorType] = (categories[errorType] || 0) + 1;
    });

    return categories;
  }

  /**
   * Categorize single error
   */
  categorizeError(errorMessage) {
    if (!errorMessage) return 'unknown';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('memory')) return 'memory';
    if (message.includes('database')) return 'database';
    
    return 'other';
  }

  /**
   * Record performance entry
   */
  recordPerformanceEntry(entry) {
    this.systemMetrics.push({
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Save benchmark results
   */
  async saveBenchmarkResults(results, outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
    logger.info(`📊 Benchmark results saved to ${outputPath}`);
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(results, outputDir) {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Save complete results
    const resultsPath = path.join(outputDir, 'benchmark_results.json');
    await this.saveBenchmarkResults(results, resultsPath);

    // Generate summary report
    const summaryPath = path.join(outputDir, 'performance_summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(results.analysis, null, 2), 'utf8');

    // Generate CSV for metrics
    const csvPath = path.join(outputDir, 'performance_metrics.csv');
    await this.generateMetricsCSV(results, csvPath);

    logger.info(`📊 Performance report generated in ${outputDir}`);

    return {
      resultsPath,
      summaryPath,
      csvPath,
    };
  }

  /**
   * Generate metrics CSV
   */
  async generateMetricsCSV(results, csvPath) {
    const headers = [
      'test_type',
      'concurrency',
      'iterations',
      'success_rate',
      'avg_response_time',
      'p95_response_time',
      'throughput_rps',
      'error_rate'
    ];

    const rows = results.benchmarkResults.map(result => [
      result.type,
      result.concurrency || 1,
      result.iterations,
      (result.metrics.successRate * 100).toFixed(2),
      result.metrics.responseTime.mean.toFixed(2),
      result.metrics.responseTime.p95.toFixed(2),
      result.metrics.throughput.requestsPerSecond.toFixed(2),
      (result.metrics.errorRate * 100).toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    await fs.writeFile(csvPath, csvContent, 'utf8');
  }

  /**
   * Utility: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup performance observer
   */
  cleanup() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}

module.exports = PerformanceBenchmarker;
