/**
 * A/B Testing Framework
 * Framework for testing different prompting strategies and configurations
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const logger = require('../utils/logger');
const RAGChatService = require('../services/RAGChatService');
const RegressionTester = require('./RegressionTester');
const { getConfig } = require('../config/environment');

class ABTestingFramework {
  constructor() {
    this.config = getConfig();
    this.regressionTester = new RegressionTester();
    this.experiments = new Map();
    this.results = new Map();
  }

  /**
   * Define an A/B test experiment
   */
  defineExperiment(experimentId, config) {
    const experiment = {
      id: experimentId,
      name: config.name,
      description: config.description,
      variants: config.variants, // Array of variant configurations
      testDataset: config.testDataset,
      metrics: config.metrics || ['accuracy', 'citationPrecision', 'responseTime'],
      sampleSize: config.sampleSize || 100,
      significanceLevel: config.significanceLevel || 0.05,
      createdAt: new Date().toISOString(),
      status: 'defined',
    };

    this.experiments.set(experimentId, experiment);
    logger.info(`🧪 Experiment defined: ${experimentId} - ${config.name}`);
    
    return experiment;
  }

  /**
   * Run A/B test experiment
   */
  async runExperiment(experimentId, options = {}) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    logger.info(`🚀 Starting A/B test experiment: ${experiment.name}`);
    
    const startTime = performance.now();
    experiment.status = 'running';

    try {
      // Load test dataset
      const testDataset = await this.loadTestDataset(experiment.testDataset);
      logger.info(`📊 Loaded ${testDataset.length} test cases`);

      // Sample test cases if needed
      const sampleSize = Math.min(experiment.sampleSize, testDataset.length);
      const sampledTests = this.sampleTestCases(testDataset, sampleSize);
      logger.info(`🎯 Using ${sampledTests.length} test cases for experiment`);

      // Run each variant
      const variantResults = [];
      for (const variant of experiment.variants) {
        logger.info(`🔄 Testing variant: ${variant.name}`);
        
        const variantResult = await this.runVariant(
          variant,
          sampledTests,
          options
        );
        
        variantResults.push(variantResult);
        logger.info(`✅ Variant ${variant.name} completed`);
      }

      // Analyze results
      const analysis = await this.analyzeResults(variantResults, experiment);

      // Store results
      const experimentResult = {
        experimentId,
        experiment,
        variantResults,
        analysis,
        executionTime: performance.now() - startTime,
        completedAt: new Date().toISOString(),
      };

      this.results.set(experimentId, experimentResult);
      experiment.status = 'completed';

      logger.info(`🎉 Experiment ${experimentId} completed in ${(experimentResult.executionTime / 1000).toFixed(2)}s`);
      
      return experimentResult;

    } catch (error) {
      experiment.status = 'failed';
      logger.error(`❌ Experiment ${experimentId} failed:`, error);
      throw error;
    }
  }

  /**
   * Load test dataset
   */
  async loadTestDataset(datasetPath) {
    try {
      const content = await fs.readFile(datasetPath, 'utf8');
      
      if (datasetPath.endsWith('.jsonl')) {
        return content
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      } else {
        return JSON.parse(content);
      }
    } catch (error) {
      logger.error(`❌ Error loading test dataset from ${datasetPath}:`, error);
      throw error;
    }
  }

  /**
   * Sample test cases for experiment
   */
  sampleTestCases(testDataset, sampleSize) {
    if (testDataset.length <= sampleSize) {
      return testDataset;
    }

    // Stratified sampling to maintain category distribution
    const categories = {};
    testDataset.forEach(test => {
      const category = test.category || 'general';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(test);
    });

    const sampledTests = [];
    const categoryNames = Object.keys(categories);
    const testsPerCategory = Math.floor(sampleSize / categoryNames.length);
    
    categoryNames.forEach(category => {
      const categoryTests = categories[category];
      const shuffled = categoryTests.sort(() => 0.5 - Math.random());
      const sampled = shuffled.slice(0, Math.min(testsPerCategory, categoryTests.length));
      sampledTests.push(...sampled);
    });

    // Fill remaining slots randomly
    const remaining = sampleSize - sampledTests.length;
    if (remaining > 0) {
      const unusedTests = testDataset.filter(test => 
        !sampledTests.some(sampled => sampled.id === test.id)
      );
      const shuffled = unusedTests.sort(() => 0.5 - Math.random());
      sampledTests.push(...shuffled.slice(0, remaining));
    }

    return sampledTests.slice(0, sampleSize);
  }

  /**
   * Run a single variant
   */
  async runVariant(variant, testCases, options = {}) {
    logger.info(`🧪 Running variant: ${variant.name}`);

    const startTime = performance.now();
    const results = [];

    // Create RAG service with variant configuration
    const ragService = this.createRAGServiceForVariant(variant);

    // Run tests
    const batchSize = options.batchSize || 5;
    for (let i = 0; i < testCases.length; i += batchSize) {
      const batch = testCases.slice(i, i + batchSize);
      
      try {
        const batchResults = await this.runVariantBatch(
          ragService,
          batch,
          variant
        );
        results.push(...batchResults);

        // Progress update
        logger.info(`📈 Variant ${variant.name}: ${results.length}/${testCases.length} tests completed`);

        // Rate limiting
        if (i + batchSize < testCases.length) {
          await this.delay(500);
        }

      } catch (error) {
        logger.error(`❌ Error in variant ${variant.name} batch ${i}-${i + batchSize}:`, error);
      }
    }

    // Calculate metrics
    const metrics = this.calculateVariantMetrics(results);

    return {
      variant,
      results,
      metrics,
      executionTime: performance.now() - startTime,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Create RAG service with variant configuration
   */
  createRAGServiceForVariant(variant) {
    // Create a new RAG service instance with variant-specific configuration
    const ragService = new RAGChatService();

    // Apply variant configuration
    if (variant.config.retrievalStrategy) {
      ragService.defaultOptions.retrievalStrategy = variant.config.retrievalStrategy;
    }

    if (variant.config.maxChunks) {
      ragService.defaultOptions.maxChunks = variant.config.maxChunks;
    }

    if (variant.config.citationFormat) {
      ragService.defaultOptions.citationFormat = variant.config.citationFormat;
    }

    if (variant.config.templateType) {
      ragService.defaultOptions.templateType = variant.config.templateType;
    }

    // Override prompt templates if specified
    if (variant.config.promptTemplates) {
      ragService.promptAssembler.templates = {
        ...ragService.promptAssembler.templates,
        ...variant.config.promptTemplates,
      };
    }

    // Override confidence thresholds if specified
    if (variant.config.confidenceThresholds) {
      ragService.confidenceManager.thresholds = {
        ...ragService.confidenceManager.thresholds,
        ...variant.config.confidenceThresholds,
      };
    }

    return ragService;
  }

  /**
   * Run variant batch
   */
  async runVariantBatch(ragService, testBatch, variant) {
    const batchResults = [];

    for (const testCase of testBatch) {
      try {
        const startTime = performance.now();

        const response = await ragService.generateResponse(
          testCase.question,
          `ab_test_${variant.id}_${testCase.id}`,
          variant.config
        );

        const responseTime = performance.now() - startTime;

        // Evaluate response
        const evaluation = await this.regressionTester.evaluateResponse(testCase, response);

        batchResults.push({
          testId: testCase.id,
          variantId: variant.id,
          question: testCase.question,
          response: response.message,
          responseTime,
          confidence: response.confidence,
          citations: response.citations || [],
          evaluation,
          testCase: {
            category: testCase.category,
            difficulty: testCase.difficulty,
          },
        });

      } catch (error) {
        logger.error(`❌ Error in variant ${variant.name} test ${testCase.id}:`, error);
        
        batchResults.push({
          testId: testCase.id,
          variantId: variant.id,
          question: testCase.question,
          error: error.message,
          responseTime: 0,
          confidence: 0,
          evaluation: { accuracy: 0, passed: false },
        });
      }
    }

    return batchResults;
  }

  /**
   * Calculate variant metrics
   */
  calculateVariantMetrics(results) {
    const validResults = results.filter(r => !r.error && r.evaluation);
    
    if (validResults.length === 0) {
      return {
        accuracy: 0,
        citationPrecision: 0,
        citationRecall: 0,
        averageResponseTime: 0,
        confidenceCalibration: 0,
        passRate: 0,
        totalTests: results.length,
        validTests: 0,
      };
    }

    const metrics = {
      accuracy: validResults.reduce((sum, r) => sum + r.evaluation.accuracy, 0) / validResults.length,
      citationPrecision: validResults.reduce((sum, r) => sum + r.evaluation.citationPrecision, 0) / validResults.length,
      citationRecall: validResults.reduce((sum, r) => sum + r.evaluation.citationRecall, 0) / validResults.length,
      averageResponseTime: validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length,
      confidenceCalibration: validResults.reduce((sum, r) => sum + r.evaluation.confidenceAlignment, 0) / validResults.length,
      passRate: validResults.filter(r => r.evaluation.passed).length / validResults.length,
      totalTests: results.length,
      validTests: validResults.length,
    };

    return metrics;
  }

  /**
   * Analyze A/B test results
   */
  async analyzeResults(variantResults, experiment) {
    logger.info('📊 Analyzing A/B test results...');

    const analysis = {
      summary: this.generateSummary(variantResults),
      statisticalSignificance: this.calculateStatisticalSignificance(variantResults, experiment),
      recommendations: this.generateRecommendations(variantResults),
      detailedComparison: this.generateDetailedComparison(variantResults),
    };

    return analysis;
  }

  /**
   * Generate summary of results
   */
  generateSummary(variantResults) {
    const summary = {
      totalVariants: variantResults.length,
      bestVariant: null,
      worstVariant: null,
      metrics: {},
    };

    // Find best and worst variants by primary metric (accuracy)
    let bestAccuracy = -1;
    let worstAccuracy = 2;

    variantResults.forEach(result => {
      const accuracy = result.metrics.accuracy;
      
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        summary.bestVariant = {
          name: result.variant.name,
          accuracy: accuracy,
          passRate: result.metrics.passRate,
        };
      }

      if (accuracy < worstAccuracy) {
        worstAccuracy = accuracy;
        summary.worstVariant = {
          name: result.variant.name,
          accuracy: accuracy,
          passRate: result.metrics.passRate,
        };
      }
    });

    // Calculate overall metrics
    const allMetrics = ['accuracy', 'citationPrecision', 'citationRecall', 'averageResponseTime', 'passRate'];
    allMetrics.forEach(metric => {
      const values = variantResults.map(r => r.metrics[metric]);
      summary.metrics[metric] = {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((sum, val) => sum + val, 0) / values.length,
        std: this.calculateStandardDeviation(values),
      };
    });

    return summary;
  }

  /**
   * Calculate statistical significance
   */
  calculateStatisticalSignificance(variantResults, experiment) {
    const significance = {
      significanceLevel: experiment.significanceLevel,
      tests: [],
    };

    // Pairwise comparisons between variants
    for (let i = 0; i < variantResults.length; i++) {
      for (let j = i + 1; j < variantResults.length; j++) {
        const variantA = variantResults[i];
        const variantB = variantResults[j];

        const test = this.performStatisticalTest(variantA, variantB, experiment.significanceLevel);
        significance.tests.push(test);
      }
    }

    return significance;
  }

  /**
   * Perform statistical test between two variants
   */
  performStatisticalTest(variantA, variantB, significanceLevel) {
    // Extract accuracy scores for both variants
    const scoresA = variantA.results
      .filter(r => !r.error && r.evaluation)
      .map(r => r.evaluation.accuracy);
    
    const scoresB = variantB.results
      .filter(r => !r.error && r.evaluation)
      .map(r => r.evaluation.accuracy);

    // Perform two-sample t-test
    const tTest = this.twoSampleTTest(scoresA, scoresB);

    const isSignificant = tTest.pValue < significanceLevel;
    const winner = tTest.meanDifference > 0 ? variantA.variant.name : variantB.variant.name;

    return {
      variantA: variantA.variant.name,
      variantB: variantB.variant.name,
      meanA: tTest.meanA,
      meanB: tTest.meanB,
      meanDifference: tTest.meanDifference,
      tStatistic: tTest.tStatistic,
      pValue: tTest.pValue,
      isSignificant,
      winner: isSignificant ? winner : null,
      confidenceInterval: tTest.confidenceInterval,
    };
  }

  /**
   * Two-sample t-test implementation
   */
  twoSampleTTest(samplesA, samplesB) {
    const n1 = samplesA.length;
    const n2 = samplesB.length;
    
    const mean1 = samplesA.reduce((sum, val) => sum + val, 0) / n1;
    const mean2 = samplesB.reduce((sum, val) => sum + val, 0) / n2;
    
    const var1 = samplesA.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
    const var2 = samplesB.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);
    
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const standardError = Math.sqrt(pooledVar * (1/n1 + 1/n2));
    
    const tStatistic = (mean1 - mean2) / standardError;
    const degreesOfFreedom = n1 + n2 - 2;
    
    // Simplified p-value calculation (two-tailed)
    const pValue = this.tDistributionPValue(Math.abs(tStatistic), degreesOfFreedom);
    
    // 95% confidence interval for difference
    const tCritical = 1.96; // Approximate for large samples
    const marginOfError = tCritical * standardError;
    const confidenceInterval = [
      (mean1 - mean2) - marginOfError,
      (mean1 - mean2) + marginOfError
    ];

    return {
      meanA: mean1,
      meanB: mean2,
      meanDifference: mean1 - mean2,
      tStatistic,
      pValue: pValue * 2, // Two-tailed
      confidenceInterval,
    };
  }

  /**
   * Approximate t-distribution p-value calculation
   */
  tDistributionPValue(t, df) {
    // Simplified approximation - in production, use a proper statistical library
    if (df >= 30) {
      // Use normal approximation for large df
      return 1 - this.normalCDF(t);
    }
    
    // Very rough approximation for smaller df
    const factor = Math.sqrt(df / (df + t * t));
    return (1 - factor) / 2;
  }

  /**
   * Normal CDF approximation
   */
  normalCDF(x) {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  erf(x) {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(variantResults) {
    const recommendations = [];

    // Find best performing variant
    const bestVariant = variantResults.reduce((best, current) => 
      current.metrics.accuracy > best.metrics.accuracy ? current : best
    );

    recommendations.push({
      type: 'winner',
      priority: 'high',
      recommendation: `Deploy variant "${bestVariant.variant.name}" as it shows the best performance with ${(bestVariant.metrics.accuracy * 100).toFixed(1)}% accuracy.`,
      details: {
        variant: bestVariant.variant.name,
        accuracy: bestVariant.metrics.accuracy,
        passRate: bestVariant.metrics.passRate,
        responseTime: bestVariant.metrics.averageResponseTime,
      }
    });

    // Performance insights
    const performanceVariant = variantResults.reduce((fastest, current) => 
      current.metrics.averageResponseTime < fastest.metrics.averageResponseTime ? current : fastest
    );

    if (performanceVariant.variant.id !== bestVariant.variant.id) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        recommendation: `Consider elements from "${performanceVariant.variant.name}" for faster response times (${(performanceVariant.metrics.averageResponseTime / 1000).toFixed(2)}s vs ${(bestVariant.metrics.averageResponseTime / 1000).toFixed(2)}s).`,
        details: {
          variant: performanceVariant.variant.name,
          responseTime: performanceVariant.metrics.averageResponseTime,
        }
      });
    }

    // Citation quality insights
    const citationVariant = variantResults.reduce((best, current) => 
      current.metrics.citationPrecision > best.metrics.citationPrecision ? current : best
    );

    if (citationVariant.metrics.citationPrecision > bestVariant.metrics.citationPrecision + 0.05) {
      recommendations.push({
        type: 'citations',
        priority: 'medium',
        recommendation: `Incorporate citation strategies from "${citationVariant.variant.name}" to improve citation quality (${(citationVariant.metrics.citationPrecision * 100).toFixed(1)}% precision).`,
        details: {
          variant: citationVariant.variant.name,
          citationPrecision: citationVariant.metrics.citationPrecision,
        }
      });
    }

    return recommendations;
  }

  /**
   * Generate detailed comparison
   */
  generateDetailedComparison(variantResults) {
    const comparison = {
      variants: [],
      metricComparisons: {},
    };

    // Variant details
    variantResults.forEach(result => {
      comparison.variants.push({
        name: result.variant.name,
        description: result.variant.description,
        config: result.variant.config,
        metrics: result.metrics,
        executionTime: result.executionTime,
      });
    });

    // Metric comparisons
    const metrics = ['accuracy', 'citationPrecision', 'citationRecall', 'averageResponseTime', 'passRate'];
    metrics.forEach(metric => {
      const values = variantResults.map(r => ({ 
        variant: r.variant.name, 
        value: r.metrics[metric] 
      }));
      
      values.sort((a, b) => b.value - a.value);
      
      comparison.metricComparisons[metric] = {
        ranking: values,
        best: values[0],
        worst: values[values.length - 1],
        range: values[0].value - values[values.length - 1].value,
      };
    });

    return comparison;
  }

  /**
   * Save experiment results
   */
  async saveExperimentResults(experimentId, outputDir) {
    const result = this.results.get(experimentId);
    if (!result) {
      throw new Error(`Experiment results for ${experimentId} not found`);
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Save complete results
    const resultsPath = path.join(outputDir, `${experimentId}_results.json`);
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2), 'utf8');

    // Save analysis summary
    const summaryPath = path.join(outputDir, `${experimentId}_summary.json`);
    await fs.writeFile(summaryPath, JSON.stringify(result.analysis, null, 2), 'utf8');

    // Save CSV for easy analysis
    const csvPath = path.join(outputDir, `${experimentId}_metrics.csv`);
    await this.saveMetricsCSV(result.variantResults, csvPath);

    logger.info(`📊 Experiment results saved to ${outputDir}`);

    return {
      resultsPath,
      summaryPath,
      csvPath,
    };
  }

  /**
   * Save metrics as CSV
   */
  async saveMetricsCSV(variantResults, csvPath) {
    const headers = [
      'variant_name',
      'accuracy',
      'citation_precision',
      'citation_recall',
      'average_response_time',
      'pass_rate',
      'total_tests',
      'valid_tests'
    ];

    const rows = variantResults.map(result => [
      result.variant.name,
      result.metrics.accuracy.toFixed(4),
      result.metrics.citationPrecision.toFixed(4),
      result.metrics.citationRecall.toFixed(4),
      result.metrics.averageResponseTime.toFixed(2),
      result.metrics.passRate.toFixed(4),
      result.metrics.totalTests,
      result.metrics.validTests,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    await fs.writeFile(csvPath, csvContent, 'utf8');
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
   * Utility: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ABTestingFramework;
