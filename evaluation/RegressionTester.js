/**
 * Regression Test Suite
 * Automated testing framework for RAG system evaluation
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const logger = require('../utils/logger');
const RAGChatService = require('../services/RAGChatService');
const { getConfig } = require('../config/environment');

class RegressionTester {
  constructor() {
    this.config = getConfig();
    this.ragChatService = new RAGChatService();
    this.testResults = [];
    this.metrics = {
      accuracy: 0,
      citationPrecision: 0,
      citationRecall: 0,
      averageResponseTime: 0,
      confidenceCalibration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
    };
  }

  /**
   * Run complete evaluation suite
   */
  async runEvaluationSuite(testDatasetPath, options = {}) {
    logger.info('🧪 Starting regression test suite...');

    const startTime = performance.now();

    try {
      // Load test dataset
      const testDataset = await this.loadTestDataset(testDatasetPath);
      logger.info(`📊 Loaded ${testDataset.length} test cases`);

      // Initialize results
      this.testResults = [];
      this.resetMetrics();

      // Run tests in batches
      const batchSize = options.batchSize || 10;
      const results = await this.runTestsInBatches(testDataset, batchSize);

      // Calculate metrics
      const metrics = this.calculateMetrics(results);

      // Generate report
      const report = await this.generateEvaluationReport(results, metrics);

      const totalTime = performance.now() - startTime;
      logger.info(`✅ Evaluation suite completed in ${(totalTime / 1000).toFixed(2)}s`);

      return {
        results,
        metrics,
        report,
        executionTime: totalTime,
      };

    } catch (error) {
      logger.error('❌ Error running evaluation suite:', error);
      throw error;
    }
  }

  /**
   * Load test dataset from file
   */
  async loadTestDataset(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Handle both JSON and JSONL formats
      if (filePath.endsWith('.jsonl')) {
        return content
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      } else {
        return JSON.parse(content);
      }
    } catch (error) {
      logger.error(`❌ Error loading test dataset from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Run tests in batches to manage resources
   */
  async runTestsInBatches(testDataset, batchSize) {
    const results = [];
    const totalBatches = Math.ceil(testDataset.length / batchSize);

    for (let i = 0; i < testDataset.length; i += batchSize) {
      const batch = testDataset.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.info(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tests)`);

      try {
        const batchResults = await this.runTestBatch(batch);
        results.push(...batchResults);

        // Progress update
        logger.info(`📈 Progress: ${results.length}/${testDataset.length} tests completed`);

        // Rate limiting between batches
        if (i + batchSize < testDataset.length) {
          await this.delay(1000); // 1 second between batches
        }

      } catch (error) {
        logger.error(`❌ Error in batch ${batchNumber}:`, error);
        // Continue with next batch
      }
    }

    return results;
  }

  /**
   * Run a batch of tests
   */
  async runTestBatch(testBatch) {
    const batchResults = [];

    for (const testCase of testBatch) {
      try {
        const result = await this.runSingleTest(testCase);
        batchResults.push(result);
      } catch (error) {
        logger.error(`❌ Error in test ${testCase.id}:`, error);
        
        // Record failed test
        batchResults.push({
          testId: testCase.id,
          question: testCase.question,
          expectedAnswer: testCase.expected_answer,
          actualAnswer: null,
          error: error.message,
          passed: false,
          responseTime: 0,
          confidence: 0,
          citations: [],
          metrics: {
            accuracy: 0,
            citationPrecision: 0,
            citationRecall: 0,
          }
        });
      }
    }

    return batchResults;
  }

  /**
   * Run a single test case
   */
  async runSingleTest(testCase) {
    const startTime = performance.now();

    try {
      // Generate response using RAG system
      const response = await this.ragChatService.generateResponse(
        testCase.question,
        `test_session_${testCase.id}`,
        {
          maxChunks: 5,
          retrievalStrategy: 'hybrid',
          citationFormat: 'inline',
          templateType: 'standard',
        }
      );

      const responseTime = performance.now() - startTime;

      // Evaluate response
      const evaluation = await this.evaluateResponse(testCase, response);

      // Record result
      const result = {
        testId: testCase.id,
        question: testCase.question,
        expectedAnswer: testCase.expected_answer,
        actualAnswer: response.message,
        passed: evaluation.passed,
        responseTime,
        confidence: response.confidence,
        citations: response.citations || [],
        sources: response.sources || [],
        retrievalMetadata: response.retrievalMetadata,
        testCase: {
          category: testCase.category,
          difficulty: testCase.difficulty,
          testType: testCase.test_type || 'standard',
        },
        evaluation,
        timestamp: new Date().toISOString(),
      };

      this.testResults.push(result);
      return result;

    } catch (error) {
      logger.error(`❌ Error running test ${testCase.id}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate response against expected answer
   */
  async evaluateResponse(testCase, response) {
    const evaluation = {
      passed: false,
      accuracy: 0,
      citationPrecision: 0,
      citationRecall: 0,
      confidenceAlignment: 0,
      details: {},
    };

    try {
      // 1. Evaluate answer accuracy
      evaluation.accuracy = await this.evaluateAnswerAccuracy(
        testCase.expected_answer,
        response.message
      );

      // 2. Evaluate citations
      const citationEval = this.evaluateCitations(
        testCase.expected_citations || [],
        response.citations || []
      );
      evaluation.citationPrecision = citationEval.precision;
      evaluation.citationRecall = citationEval.recall;

      // 3. Evaluate confidence alignment
      evaluation.confidenceAlignment = this.evaluateConfidenceAlignment(
        evaluation.accuracy,
        response.confidence
      );

      // 4. Handle special test types
      if (testCase.test_type) {
        evaluation.specialTypeEval = await this.evaluateSpecialTestType(testCase, response);
      }

      // 5. Determine if test passed
      evaluation.passed = this.determineTestPass(evaluation, testCase);

      // 6. Add detailed feedback
      evaluation.details = {
        accuracyDetails: `Answer accuracy: ${(evaluation.accuracy * 100).toFixed(1)}%`,
        citationDetails: `Citation precision: ${(evaluation.citationPrecision * 100).toFixed(1)}%, recall: ${(evaluation.citationRecall * 100).toFixed(1)}%`,
        confidenceDetails: `Confidence: ${response.confidence}, alignment: ${(evaluation.confidenceAlignment * 100).toFixed(1)}%`,
      };

      return evaluation;

    } catch (error) {
      logger.error(`❌ Error evaluating response for test ${testCase.id}:`, error);
      return {
        ...evaluation,
        error: error.message,
      };
    }
  }

  /**
   * Evaluate answer accuracy using semantic similarity
   */
  async evaluateAnswerAccuracy(expectedAnswer, actualAnswer) {
    try {
      // Use OpenAI to evaluate semantic similarity
      const evaluationPrompt = `
Evaluate how well the actual answer matches the expected answer for a fund management question.

Expected Answer: ${expectedAnswer}

Actual Answer: ${actualAnswer}

Rate the accuracy on a scale of 0.0 to 1.0 where:
- 1.0 = Perfect match, contains all key information
- 0.8-0.9 = Very good, minor missing details
- 0.6-0.7 = Good, some important information missing
- 0.4-0.5 = Partial, significant gaps
- 0.2-0.3 = Poor, major inaccuracies
- 0.0-0.1 = Completely wrong or irrelevant

Consider:
1. Factual accuracy of key information
2. Completeness of the answer
3. Relevance to the question
4. Technical correctness

Return only a number between 0.0 and 1.0.`;

      const response = await this.ragChatService.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert evaluator of fund management information. Provide accurate numerical assessments.'
          },
          {
            role: 'user',
            content: evaluationPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 10,
      });

      const scoreText = response.choices[0].message.content.trim();
      const score = parseFloat(scoreText);

      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));

    } catch (error) {
      logger.error('❌ Error evaluating answer accuracy:', error);
      // Fallback to simple text similarity
      return this.calculateSimpleTextSimilarity(expectedAnswer, actualAnswer);
    }
  }

  /**
   * Simple text similarity fallback
   */
  calculateSimpleTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Evaluate citation quality
   */
  evaluateCitations(expectedCitations, actualCitations) {
    if (!expectedCitations || expectedCitations.length === 0) {
      return { precision: 1.0, recall: 1.0 }; // No citations expected
    }

    if (!actualCitations || actualCitations.length === 0) {
      return { precision: 0.0, recall: 0.0 }; // Citations expected but none provided
    }

    // Extract source identifiers from citations
    const expectedSources = new Set(
      expectedCitations.map(citation => this.extractSourceId(citation))
    );
    
    const actualSources = new Set(
      actualCitations.map(citation => this.extractSourceId(citation.source || citation.text || citation))
    );

    // Calculate precision and recall
    const intersection = new Set([...expectedSources].filter(source => actualSources.has(source)));
    
    const precision = actualSources.size > 0 ? intersection.size / actualSources.size : 0;
    const recall = expectedSources.size > 0 ? intersection.size / expectedSources.size : 1;

    return { precision, recall };
  }

  /**
   * Extract source identifier from citation
   */
  extractSourceId(citation) {
    if (typeof citation === 'string') {
      // Extract source name from citation text
      const match = citation.match(/Guide\s*(\d+)/i) || citation.match(/(\w+\s*Guide)/i);
      return match ? match[0].toLowerCase() : citation.toLowerCase();
    }
    
    if (citation.source) {
      return citation.source.toLowerCase();
    }
    
    return String(citation).toLowerCase();
  }

  /**
   * Evaluate confidence alignment
   */
  evaluateConfidenceAlignment(accuracy, confidence) {
    // Good alignment means high confidence with high accuracy, low confidence with low accuracy
    const idealConfidence = accuracy;
    const difference = Math.abs(confidence - idealConfidence);
    
    // Convert difference to alignment score (lower difference = better alignment)
    return Math.max(0, 1 - difference);
  }

  /**
   * Evaluate special test types
   */
  async evaluateSpecialTestType(testCase, response) {
    const evaluation = {};

    switch (testCase.test_type) {
      case 'out_of_scope':
        evaluation.outOfScopeHandling = this.evaluateOutOfScopeHandling(response);
        break;
        
      case 'ambiguous':
        evaluation.ambiguityHandling = this.evaluateAmbiguityHandling(response);
        break;
        
      case 'complex_multi_step':
        evaluation.complexityHandling = this.evaluateComplexityHandling(testCase, response);
        break;
        
      case 'adversarial':
        evaluation.adversarialRobustness = this.evaluateAdversarialRobustness(testCase, response);
        break;
    }

    return evaluation;
  }

  /**
   * Evaluate out-of-scope handling
   */
  evaluateOutOfScopeHandling(response) {
    const message = response.message.toLowerCase();
    
    // Check for appropriate decline language
    const declineIndicators = [
      'cannot help',
      'outside my scope',
      'fund management',
      'not able to',
      'specialized in',
    ];

    const hasAppropriateDecline = declineIndicators.some(indicator => 
      message.includes(indicator)
    );

    // Should have low confidence for out-of-scope
    const appropriateConfidence = response.confidence < 0.5;

    return {
      appropriateDecline: hasAppropriateDecline,
      appropriateConfidence,
      score: (hasAppropriateDecline && appropriateConfidence) ? 1.0 : 0.0,
    };
  }

  /**
   * Evaluate ambiguity handling
   */
  evaluateAmbiguityHandling(response) {
    const message = response.message.toLowerCase();
    
    // Check for clarification requests
    const clarificationIndicators = [
      'could you clarify',
      'need more information',
      'which specific',
      'can you be more specific',
      'unclear',
    ];

    const requestsClarification = clarificationIndicators.some(indicator => 
      message.includes(indicator)
    );

    return {
      requestsClarification,
      score: requestsClarification ? 1.0 : 0.5,
    };
  }

  /**
   * Evaluate complexity handling
   */
  evaluateComplexityHandling(testCase, response) {
    const message = response.message;
    
    // Check if response addresses multiple aspects
    const hasMultipleAspects = message.split('.').length > 3;
    
    // Check for structured response
    const hasStructure = message.includes('1.') || message.includes('First') || message.includes('Second');
    
    // Check for comprehensive citations
    const hasMultipleCitations = (response.citations || []).length > 1;

    const score = [hasMultipleAspects, hasStructure, hasMultipleCitations]
      .filter(Boolean).length / 3;

    return {
      hasMultipleAspects,
      hasStructure,
      hasMultipleCitations,
      score,
    };
  }

  /**
   * Evaluate adversarial robustness
   */
  evaluateAdversarialRobustness(testCase, response) {
    // Check if system handled typos/variations correctly
    const providedAnswer = response.message;
    const hasReasonableAnswer = providedAnswer.length > 50; // Basic check
    
    return {
      handledVariations: hasReasonableAnswer,
      score: hasReasonableAnswer ? 1.0 : 0.0,
    };
  }

  /**
   * Determine if test passed based on evaluation
   */
  determineTestPass(evaluation, testCase) {
    const thresholds = this.getPassThresholds(testCase);
    
    // Standard tests
    if (!testCase.test_type || testCase.test_type === 'standard') {
      return (
        evaluation.accuracy >= thresholds.accuracy &&
        evaluation.citationPrecision >= thresholds.citationPrecision &&
        evaluation.citationRecall >= thresholds.citationRecall
      );
    }

    // Special test types
    if (evaluation.specialTypeEval) {
      switch (testCase.test_type) {
        case 'out_of_scope':
          return evaluation.specialTypeEval.outOfScopeHandling?.score >= 0.8;
        case 'ambiguous':
          return evaluation.specialTypeEval.ambiguityHandling?.score >= 0.8;
        case 'complex_multi_step':
          return evaluation.specialTypeEval.complexityHandling?.score >= 0.6;
        case 'adversarial':
          return evaluation.specialTypeEval.adversarialRobustness?.score >= 0.7;
      }
    }

    return false;
  }

  /**
   * Get pass thresholds based on test case
   */
  getPassThresholds(testCase) {
    const baseThresholds = {
      accuracy: 0.85,
      citationPrecision: 0.90,
      citationRecall: 0.80,
    };

    // Adjust thresholds based on difficulty
    if (testCase.difficulty === 'hard') {
      return {
        accuracy: 0.75,
        citationPrecision: 0.85,
        citationRecall: 0.70,
      };
    }

    if (testCase.difficulty === 'easy') {
      return {
        accuracy: 0.95,
        citationPrecision: 0.95,
        citationRecall: 0.90,
      };
    }

    return baseThresholds;
  }

  /**
   * Calculate overall metrics
   */
  calculateMetrics(results) {
    if (results.length === 0) {
      return this.metrics;
    }

    const validResults = results.filter(r => r.evaluation && !r.error);
    
    this.metrics.totalTests = results.length;
    this.metrics.passedTests = results.filter(r => r.passed).length;
    this.metrics.failedTests = this.metrics.totalTests - this.metrics.passedTests;

    if (validResults.length > 0) {
      // Calculate averages
      this.metrics.accuracy = validResults.reduce((sum, r) => sum + r.evaluation.accuracy, 0) / validResults.length;
      this.metrics.citationPrecision = validResults.reduce((sum, r) => sum + r.evaluation.citationPrecision, 0) / validResults.length;
      this.metrics.citationRecall = validResults.reduce((sum, r) => sum + r.evaluation.citationRecall, 0) / validResults.length;
      this.metrics.averageResponseTime = validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length;
      this.metrics.confidenceCalibration = validResults.reduce((sum, r) => sum + r.evaluation.confidenceAlignment, 0) / validResults.length;
    }

    return this.metrics;
  }

  /**
   * Generate evaluation report
   */
  async generateEvaluationReport(results, metrics) {
    const report = {
      summary: {
        totalTests: metrics.totalTests,
        passedTests: metrics.passedTests,
        failedTests: metrics.failedTests,
        passRate: metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) : 0,
        generatedAt: new Date().toISOString(),
      },
      metrics: {
        accuracy: metrics.accuracy,
        citationPrecision: metrics.citationPrecision,
        citationRecall: metrics.citationRecall,
        averageResponseTime: metrics.averageResponseTime,
        confidenceCalibration: metrics.confidenceCalibration,
      },
      categoryBreakdown: this.generateCategoryBreakdown(results),
      difficultyBreakdown: this.generateDifficultyBreakdown(results),
      testTypeBreakdown: this.generateTestTypeBreakdown(results),
      failedTests: results.filter(r => !r.passed).map(r => ({
        testId: r.testId,
        question: r.question,
        reason: this.getFailureReason(r),
        accuracy: r.evaluation?.accuracy || 0,
      })),
      recommendations: this.generateRecommendations(results, metrics),
    };

    return report;
  }

  /**
   * Generate category breakdown
   */
  generateCategoryBreakdown(results) {
    const breakdown = {};
    
    results.forEach(result => {
      const category = result.testCase?.category || 'unknown';
      if (!breakdown[category]) {
        breakdown[category] = { total: 0, passed: 0, failed: 0 };
      }
      
      breakdown[category].total++;
      if (result.passed) {
        breakdown[category].passed++;
      } else {
        breakdown[category].failed++;
      }
    });

    // Add pass rates
    Object.keys(breakdown).forEach(category => {
      const data = breakdown[category];
      data.passRate = data.total > 0 ? data.passed / data.total : 0;
    });

    return breakdown;
  }

  /**
   * Generate difficulty breakdown
   */
  generateDifficultyBreakdown(results) {
    const breakdown = {};
    
    results.forEach(result => {
      const difficulty = result.testCase?.difficulty || 'unknown';
      if (!breakdown[difficulty]) {
        breakdown[difficulty] = { total: 0, passed: 0, failed: 0 };
      }
      
      breakdown[difficulty].total++;
      if (result.passed) {
        breakdown[difficulty].passed++;
      } else {
        breakdown[difficulty].failed++;
      }
    });

    // Add pass rates
    Object.keys(breakdown).forEach(difficulty => {
      const data = breakdown[difficulty];
      data.passRate = data.total > 0 ? data.passed / data.total : 0;
    });

    return breakdown;
  }

  /**
   * Generate test type breakdown
   */
  generateTestTypeBreakdown(results) {
    const breakdown = {};
    
    results.forEach(result => {
      const testType = result.testCase?.testType || 'standard';
      if (!breakdown[testType]) {
        breakdown[testType] = { total: 0, passed: 0, failed: 0 };
      }
      
      breakdown[testType].total++;
      if (result.passed) {
        breakdown[testType].passed++;
      } else {
        breakdown[testType].failed++;
      }
    });

    // Add pass rates
    Object.keys(breakdown).forEach(testType => {
      const data = breakdown[testType];
      data.passRate = data.total > 0 ? data.passed / data.total : 0;
    });

    return breakdown;
  }

  /**
   * Get failure reason for a test
   */
  getFailureReason(result) {
    if (result.error) {
      return `Error: ${result.error}`;
    }

    if (!result.evaluation) {
      return 'No evaluation data';
    }

    const evaluation = result.evaluation;
    const reasons = [];

    if (evaluation.accuracy < 0.85) {
      reasons.push(`Low accuracy (${(evaluation.accuracy * 100).toFixed(1)}%)`);
    }
    
    if (evaluation.citationPrecision < 0.90) {
      reasons.push(`Low citation precision (${(evaluation.citationPrecision * 100).toFixed(1)}%)`);
    }
    
    if (evaluation.citationRecall < 0.80) {
      reasons.push(`Low citation recall (${(evaluation.citationRecall * 100).toFixed(1)}%)`);
    }

    return reasons.join(', ') || 'Unknown failure reason';
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(results, metrics) {
    const recommendations = [];

    // Accuracy recommendations
    if (metrics.accuracy < 0.85) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        issue: `Overall accuracy is ${(metrics.accuracy * 100).toFixed(1)}% (target: 85%+)`,
        recommendation: 'Review prompt templates and retrieval strategy. Consider fine-tuning retrieval parameters.',
      });
    }

    // Citation recommendations
    if (metrics.citationPrecision < 0.90) {
      recommendations.push({
        type: 'citations',
        priority: 'high',
        issue: `Citation precision is ${(metrics.citationPrecision * 100).toFixed(1)}% (target: 90%+)`,
        recommendation: 'Improve citation extraction and validation. Review prompt instructions for citation formatting.',
      });
    }

    // Performance recommendations
    if (metrics.averageResponseTime > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        issue: `Average response time is ${(metrics.averageResponseTime / 1000).toFixed(2)}s (target: <3s)`,
        recommendation: 'Optimize retrieval queries and consider caching frequently accessed chunks.',
      });
    }

    // Category-specific recommendations
    const categoryBreakdown = this.generateCategoryBreakdown(results);
    Object.entries(categoryBreakdown).forEach(([category, data]) => {
      if (data.passRate < 0.80) {
        recommendations.push({
          type: 'category',
          priority: 'medium',
          issue: `${category} category has low pass rate (${(data.passRate * 100).toFixed(1)}%)`,
          recommendation: `Review and improve knowledge base content for ${category}. Consider adding more training examples.`,
        });
      }
    });

    return recommendations;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      accuracy: 0,
      citationPrecision: 0,
      citationRecall: 0,
      averageResponseTime: 0,
      confidenceCalibration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
    };
  }

  /**
   * Save results to file
   */
  async saveResults(results, metrics, report, outputPath) {
    const outputData = {
      results,
      metrics,
      report,
      generatedAt: new Date().toISOString(),
    };

    await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    logger.info(`📊 Evaluation results saved to ${outputPath}`);
  }

  /**
   * Utility: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RegressionTester;
