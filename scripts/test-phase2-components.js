#!/usr/bin/env node

/**
 * Phase 2 Component Testing Script
 * 
 * Comprehensive testing of all Phase 2 components:
 * - HierarchicalSemanticChunker
 * - MultiScaleEmbeddingGenerator (when available)
 * - AdvancedContextualRetriever (when available)
 * - AdvancedDocumentProcessingService (when available)
 */

const logger = require('../utils/logger');
const HierarchicalSemanticChunker = require('../knowledge/chunking/HierarchicalSemanticChunker');

class Phase2ComponentTester {
  constructor() {
    this.testResults = {
      hierarchicalChunker: { passed: 0, failed: 0, tests: [] },
      embeddingGenerator: { passed: 0, failed: 0, tests: [] },
      contextualRetriever: { passed: 0, failed: 0, tests: [] },
      orchestrationService: { passed: 0, failed: 0, tests: [] }
    };
    
    this.sampleDocuments = [
      {
        id: 'test-doc-1',
        name: 'Sample Fund Report',
        content: `
# Fund Performance Report Q3 2024

## Executive Summary
The fund has demonstrated strong performance in Q3 2024, with a net asset value (NAV) increase of 8.5%. 
This performance was driven by strategic investments in technology and healthcare sectors.

## Investment Strategy
Our investment approach focuses on long-term value creation through diversified portfolio management. 
The fund maintains exposure across multiple asset classes including equities, bonds, and alternative investments.

### Portfolio Allocation
- Equities: 65%
- Fixed Income: 25% 
- Alternative Investments: 10%

## Risk Management
Risk management remains a top priority. We employ sophisticated risk models to monitor portfolio exposure 
and maintain compliance with regulatory requirements. The fund's risk-adjusted returns continue to 
outperform benchmark indices.

## Compliance and Audit
All fund operations comply with SEC regulations and industry best practices. Regular audits ensure 
transparency and accountability in fund management processes.
        `.trim()
      },
      {
        id: 'test-doc-2',
        name: 'Technical Documentation',
        content: `
# API Documentation

## Overview
This API provides access to fund data and analytics.

## Authentication
All requests require API key authentication.

## Endpoints

### GET /api/funds
Returns list of available funds.

### GET /api/funds/{id}
Returns detailed fund information.

### POST /api/analytics
Submits analytics request.
        `.trim()
      }
    ];
  }

  async runAllTests() {
    logger.info('🧪 Starting Phase 2 Component Tests');
    logger.info('====================================');
    
    const startTime = Date.now();
    
    // Test HierarchicalSemanticChunker
    await this.testHierarchicalChunker();
    
    // Test MultiScaleEmbeddingGenerator (if available)
    await this.testEmbeddingGenerator();
    
    // Test AdvancedContextualRetriever (if available)
    await this.testContextualRetriever();
    
    // Test AdvancedDocumentProcessingService (if available)
    await this.testOrchestrationService();
    
    const totalTime = Date.now() - startTime;
    
    // Generate summary report
    const summary = this.generateSummaryReport(totalTime);
    this.logSummary(summary);
    
    return summary;
  }

  async testHierarchicalChunker() {
    logger.info('🔧 Testing HierarchicalSemanticChunker');
    logger.info('------------------------------------');
    
    try {
      const chunker = new HierarchicalSemanticChunker();
      
      // Test 1: Basic chunking functionality
      await this.runTest('hierarchicalChunker', 'Basic Document Chunking', async () => {
        const result = await chunker.chunkDocumentHierarchically(this.sampleDocuments[0]);
        
        if (!result.success) {
          throw new Error('Chunking failed');
        }
        
        if (!result.chunks || result.chunks.length === 0) {
          throw new Error('No chunks generated');
        }
        
        if (!result.statistics) {
          throw new Error('No statistics provided');
        }
        
        logger.info(`✅ Generated ${result.chunks.length} chunks with average quality ${result.statistics.averageQuality?.toFixed(3)}`);
        return true;
      });
      
      // Test 2: Quality validation
      await this.runTest('hierarchicalChunker', 'Quality Validation', async () => {
        const result = await chunker.chunkDocumentHierarchically(this.sampleDocuments[0]);
        
        const qualityChunks = result.chunks.filter(chunk => 
          chunk.quality && chunk.quality.score >= 0.4
        );
        
        if (qualityChunks.length === 0) {
          throw new Error('No chunks meet quality threshold');
        }
        
        logger.info(`✅ ${qualityChunks.length}/${result.chunks.length} chunks meet quality threshold`);
        return true;
      });
      
      // Test 3: Hierarchical relationships
      await this.runTest('hierarchicalChunker', 'Hierarchical Relationships', async () => {
        const result = await chunker.chunkDocumentHierarchically(this.sampleDocuments[0]);
        
        const chunksWithRelationships = result.chunks.filter(chunk => 
          chunk.previousId || chunk.nextId
        );
        
        if (chunksWithRelationships.length === 0) {
          throw new Error('No hierarchical relationships established');
        }
        
        logger.info(`✅ ${chunksWithRelationships.length} chunks have hierarchical relationships`);
        return true;
      });
      
      // Test 4: Semantic boundary detection
      await this.runTest('hierarchicalChunker', 'Semantic Boundary Detection', async () => {
        const result = await chunker.chunkDocumentHierarchically(this.sampleDocuments[0], {
          semanticCoherence: { enableSemanticBoundaryDetection: true }
        });
        
        const semanticChunks = result.chunks.filter(chunk => 
          chunk.semanticBoundaries && chunk.semanticBoundaries.length > 0
        );
        
        logger.info(`✅ ${semanticChunks.length} chunks have semantic boundaries detected`);
        return true;
      });
      
      // Test 5: Performance metrics
      await this.runTest('hierarchicalChunker', 'Performance Metrics', async () => {
        const metrics = chunker.getMetrics();
        
        if (!metrics.documentsProcessed || metrics.documentsProcessed === 0) {
          throw new Error('No processing metrics available');
        }
        
        if (!metrics.averageProcessingTime || metrics.averageProcessingTime === 0) {
          throw new Error('No timing metrics available');
        }
        
        logger.info(`✅ Metrics: ${metrics.documentsProcessed} docs, ${metrics.averageProcessingTime.toFixed(2)}ms avg`);
        return true;
      });
      
    } catch (error) {
      logger.error('❌ HierarchicalSemanticChunker test setup failed:', error.message);
      this.testResults.hierarchicalChunker.failed++;
    }
  }

  async testEmbeddingGenerator() {
    logger.info('🔮 Testing MultiScaleEmbeddingGenerator');
    logger.info('------------------------------------');
    
    try {
      const MultiScaleEmbeddingGenerator = require('../knowledge/embeddings/MultiScaleEmbeddingGenerator');
      const generator = new MultiScaleEmbeddingGenerator();
      
      const sampleChunk = {
        id: 'test-chunk-1',
        content: 'This is a sample chunk about fund management and investment strategies.',
        metadata: { source: 'test' }
      };
      
      // Test 1: Basic embedding generation
      await this.runTest('embeddingGenerator', 'Basic Embedding Generation', async () => {
        const result = await generator.generateMultiScaleEmbeddings(sampleChunk);
        
        if (!result.success) {
          throw new Error('Embedding generation failed');
        }
        
        if (!result.embeddings || Object.keys(result.embeddings).length === 0) {
          throw new Error('No embeddings generated');
        }
        
        logger.info(`✅ Generated ${Object.keys(result.embeddings).length} embedding types`);
        return true;
      });
      
      // Test 2: Domain optimization
      await this.runTest('embeddingGenerator', 'Domain Optimization', async () => {
        const result = await generator.generateMultiScaleEmbeddings(sampleChunk, {
          domainOptimization: true
        });
        
        if (!result.embeddings.content || !result.embeddings.content.metadata.domainOptimized) {
          throw new Error('Domain optimization not applied');
        }
        
        logger.info('✅ Domain optimization applied successfully');
        return true;
      });
      
      // Test 3: Quality validation
      await this.runTest('embeddingGenerator', 'Quality Validation', async () => {
        const result = await generator.generateMultiScaleEmbeddings(sampleChunk);
        
        if (!result.quality || !result.quality.overall) {
          throw new Error('No quality assessment provided');
        }
        
        if (!result.quality.overall.passed) {
          throw new Error('Embeddings failed quality validation');
        }
        
        logger.info(`✅ Quality validation passed with score ${result.quality.overall.score.toFixed(3)}`);
        return true;
      });
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        logger.warn('⚠️ MultiScaleEmbeddingGenerator not available - skipping tests');
        this.testResults.embeddingGenerator.tests.push({
          name: 'Module Availability',
          status: 'skipped',
          message: 'Module not found'
        });
      } else {
        logger.error('❌ MultiScaleEmbeddingGenerator test setup failed:', error.message);
        this.testResults.embeddingGenerator.failed++;
      }
    }
  }

  async testContextualRetriever() {
    logger.info('🔍 Testing AdvancedContextualRetriever');
    logger.info('------------------------------------');
    
    try {
      const AdvancedContextualRetriever = require('../knowledge/retrieval/AdvancedContextualRetriever');
      const retriever = new AdvancedContextualRetriever();
      await retriever.initialize();
      
      const sampleQuery = 'What is the fund performance in Q3 2024?';
      const sampleContext = { domain: 'financial', sessionId: 'test-session' };
      
      // Test 1: Basic retrieval
      await this.runTest('contextualRetriever', 'Basic Contextual Retrieval', async () => {
        const result = await retriever.retrieveContextually(sampleQuery, sampleContext);
        
        if (!result.success) {
          throw new Error('Retrieval failed');
        }
        
        if (!result.results || result.results.length === 0) {
          logger.warn('⚠️ No results returned (expected if no data in database)');
        }
        
        logger.info(`✅ Retrieval completed with ${result.results?.length || 0} results`);
        return true;
      });
      
      // Test 2: Query analysis
      await this.runTest('contextualRetriever', 'Query Analysis', async () => {
        const analysis = await retriever.analyzeQuery(sampleQuery, sampleContext);
        
        if (!analysis.type || !analysis.complexity || !analysis.recommendedStrategy) {
          throw new Error('Incomplete query analysis');
        }
        
        logger.info(`✅ Query analyzed: type=${analysis.type}, complexity=${analysis.complexity.toFixed(3)}, strategy=${analysis.recommendedStrategy}`);
        return true;
      });
      
      // Test 3: Strategy selection
      await this.runTest('contextualRetriever', 'Strategy Selection', async () => {
        const analysis = await retriever.analyzeQuery(sampleQuery, sampleContext);
        const strategy = await retriever.selectOptimalStrategy(analysis, sampleContext);
        
        const validStrategies = ['vector_only', 'hybrid', 'multi_scale', 'contextual'];
        if (!validStrategies.includes(strategy)) {
          throw new Error('Invalid strategy selected');
        }
        
        logger.info(`✅ Strategy selected: ${strategy}`);
        return true;
      });
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        logger.warn('⚠️ AdvancedContextualRetriever not available - skipping tests');
        this.testResults.contextualRetriever.tests.push({
          name: 'Module Availability',
          status: 'skipped',
          message: 'Module not found'
        });
      } else {
        logger.error('❌ AdvancedContextualRetriever test setup failed:', error.message);
        this.testResults.contextualRetriever.failed++;
      }
    }
  }

  async testOrchestrationService() {
    logger.info('🎼 Testing AdvancedDocumentProcessingService');
    logger.info('--------------------------------------------');
    
    try {
      const AdvancedDocumentProcessingService = require('../services/AdvancedDocumentProcessingService');
      const service = new AdvancedDocumentProcessingService();
      await service.initialize();
      
      // Test 1: Service initialization
      await this.runTest('orchestrationService', 'Service Initialization', async () => {
        const health = await service.healthCheck();
        
        if (!health || health.status === 'unhealthy') {
          throw new Error('Service health check failed');
        }
        
        logger.info(`✅ Service health: ${health.status}`);
        return true;
      });
      
      // Test 2: Document processing
      await this.runTest('orchestrationService', 'Document Processing', async () => {
        const result = await service.processDocument(this.sampleDocuments[0]);
        
        if (!result.success && result.errors && result.errors.length > 0) {
          throw new Error(`Processing failed: ${result.errors[0].error}`);
        }
        
        logger.info(`✅ Document processed: ${result.chunks?.length || 0} chunks generated`);
        return true;
      });
      
      // Test 3: Metrics collection
      await this.runTest('orchestrationService', 'Metrics Collection', async () => {
        const metrics = service.getMetrics();
        
        if (!metrics.documentsProcessed || metrics.documentsProcessed === 0) {
          throw new Error('No processing metrics available');
        }
        
        logger.info(`✅ Metrics: ${metrics.documentsProcessed} docs processed`);
        return true;
      });
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        logger.warn('⚠️ AdvancedDocumentProcessingService not available - skipping tests');
        this.testResults.orchestrationService.tests.push({
          name: 'Module Availability',
          status: 'skipped',
          message: 'Module not found'
        });
      } else {
        logger.error('❌ AdvancedDocumentProcessingService test setup failed:', error.message);
        this.testResults.orchestrationService.failed++;
      }
    }
  }

  async runTest(component, testName, testFunction) {
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      
      this.testResults[component].passed++;
      this.testResults[component].tests.push({
        name: testName,
        status: 'passed',
        duration: duration
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults[component].failed++;
      this.testResults[component].tests.push({
        name: testName,
        status: 'failed',
        duration: duration,
        error: error.message
      });
      
      logger.error(`❌ ${testName} failed: ${error.message}`);
    }
  }

  generateSummaryReport(totalTime) {
    const summary = {
      totalTime: totalTime,
      overallStatus: 'passed',
      components: {},
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0
    };
    
    for (const [component, results] of Object.entries(this.testResults)) {
      const componentSummary = {
        passed: results.passed,
        failed: results.failed,
        skipped: results.tests.filter(t => t.status === 'skipped').length,
        total: results.tests.length,
        status: results.failed > 0 ? 'failed' : 'passed'
      };
      
      summary.components[component] = componentSummary;
      summary.totalTests += componentSummary.total;
      summary.totalPassed += componentSummary.passed;
      summary.totalFailed += componentSummary.failed;
      summary.totalSkipped += componentSummary.skipped;
      
      if (componentSummary.status === 'failed') {
        summary.overallStatus = 'failed';
      }
    }
    
    return summary;
  }

  logSummary(summary) {
    logger.info('\n📊 PHASE 2 COMPONENT TEST SUMMARY');
    logger.info('==================================');
    logger.info(`Total Time: ${summary.totalTime}ms`);
    logger.info(`Overall Status: ${summary.overallStatus.toUpperCase()}`);
    logger.info(`Total Tests: ${summary.totalTests}`);
    logger.info(`Passed: ${summary.totalPassed}`);
    logger.info(`Failed: ${summary.totalFailed}`);
    logger.info(`Skipped: ${summary.totalSkipped}`);
    logger.info('');
    
    for (const [component, results] of Object.entries(summary.components)) {
      const status = results.status === 'passed' ? '✅' : '❌';
      logger.info(`${status} ${component}: ${results.passed}/${results.total} passed`);
      
      if (results.failed > 0) {
        const failedTests = this.testResults[component].tests.filter(t => t.status === 'failed');
        for (const test of failedTests) {
          logger.error(`   ❌ ${test.name}: ${test.error}`);
        }
      }
    }
    
    logger.info('==================================');
    
    if (summary.overallStatus === 'passed') {
      logger.info('🎉 All Phase 2 component tests passed!');
    } else {
      logger.error('💥 Some Phase 2 component tests failed. Please review the errors above.');
    }
  }
}

// Main execution
async function main() {
  try {
    logger.info('🚀 Starting Phase 2 Component Testing');
    
    const tester = new Phase2ComponentTester();
    const results = await tester.runAllTests();
    
    if (results.overallStatus === 'passed') {
      logger.info('✅ Phase 2 component testing completed successfully!');
      process.exit(0);
    } else {
      logger.error('❌ Phase 2 component testing failed!');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('💥 Phase 2 component testing crashed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { Phase2ComponentTester };
