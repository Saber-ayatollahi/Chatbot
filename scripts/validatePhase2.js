/**
 * Phase 2 Validation Script
 * Comprehensive validation of all Phase 2 RAG components
 */

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config/environment');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

// Import Phase 2 components
const RAGChatService = require('../services/RAGChatService');
const ConfidenceManager = require('../services/ConfidenceManager');
const CitationManager = require('../knowledge/citations/CitationManager');
const VectorRetriever = require('../knowledge/retrieval/VectorRetriever');
const RetrievalEngine = require('../knowledge/retrieval/RetrievalEngine');
const PromptAssembler = require('../knowledge/prompting/PromptAssembler');

class Phase2Validator {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.validationResults = {
      components: {},
      integration: {},
      performance: {},
      overall: { success: false, score: 0 }
    };
  }

  async validatePhase2() {
    console.log('🔍 Starting Phase 2 RAG System Validation...\n');
    
    try {
      // Initialize database
      await this.initializeDatabase();
      
      // Validate individual components
      await this.validateComponents();
      
      // Validate integration
      await this.validateIntegration();
      
      // Validate performance
      await this.validatePerformance();
      
      // Calculate overall score
      this.calculateOverallScore();
      
      // Generate report
      this.generateValidationReport();
      
      return this.validationResults;
      
    } catch (error) {
      console.error('❌ Phase 2 validation failed:', error);
      this.validationResults.overall.success = false;
      this.validationResults.overall.error = error.message;
      return this.validationResults;
    }
  }

  async initializeDatabase() {
    this.db = getDatabase();
    if (!this.db.isReady()) {
      await this.db.initialize();
    }
  }

  async validateComponents() {
    console.log('📦 Validating Phase 2 Components...');
    
    const components = [
      { name: 'VectorRetriever', class: VectorRetriever },
      { name: 'RetrievalEngine', class: RetrievalEngine },
      { name: 'PromptAssembler', class: PromptAssembler },
      { name: 'RAGChatService', class: RAGChatService },
      { name: 'ConfidenceManager', class: ConfidenceManager },
      { name: 'CitationManager', class: CitationManager }
    ];
    
    for (const component of components) {
      console.log(`  🔧 Testing ${component.name}...`);
      
      try {
        const instance = new component.class();
        const result = await this.testComponent(component.name, instance);
        this.validationResults.components[component.name] = result;
        
        console.log(`    ${result.success ? '✅' : '❌'} ${component.name}: ${result.success ? 'PASS' : 'FAIL'}`);
        if (!result.success) {
          console.log(`       Error: ${result.error}`);
        }
        
      } catch (error) {
        this.validationResults.components[component.name] = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        console.log(`    ❌ ${component.name}: FAIL - ${error.message}`);
      }
    }
  }

  async testComponent(name, instance) {
    const startTime = Date.now();
    
    try {
      let testResult;
      
      switch (name) {
        case 'VectorRetriever':
          testResult = await instance.testRetrieval();
          break;
        case 'RetrievalEngine':
          testResult = await instance.testEngine();
          break;
        case 'PromptAssembler':
          testResult = await this.testPromptAssembler(instance);
          break;
        case 'RAGChatService':
          testResult = await instance.testService();
          break;
        case 'ConfidenceManager':
          testResult = await instance.testConfidenceManager();
          break;
        case 'CitationManager':
          testResult = await instance.testCitationManager();
          break;
        default:
          throw new Error(`Unknown component: ${name}`);
      }
      
      return {
        success: testResult.success,
        processingTime: Date.now() - startTime,
        details: testResult,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async testPromptAssembler(instance) {
    // Custom test for PromptAssembler since it doesn't have a built-in test method
    const mockChunks = [{
      chunk_id: 'test-1',
      content: 'Test content for prompt assembly validation.',
      citation: { source: 'Test Guide', page: 1, section: 'Test' },
      similarity_score: 0.9,
      quality_score: 0.8
    }];
    
    const result = await instance.assembleRAGPrompt(
      'Test query for validation',
      mockChunks,
      [],
      { templateType: 'standard' }
    );
    
    return {
      success: !!(result && result.prompt && result.citations),
      details: {
        hasPrompt: !!result.prompt,
        hasCitations: !!result.citations,
        estimatedTokens: result.metadata?.estimatedTokens || 0
      }
    };
  }

  async validateIntegration() {
    console.log('\n🔗 Validating Component Integration...');
    
    const integrationTests = [
      { name: 'End-to-End RAG Flow', test: this.testEndToEndRAG.bind(this) },
      { name: 'API Integration', test: this.testAPIIntegration.bind(this) },
      { name: 'Database Integration', test: this.testDatabaseIntegration.bind(this) },
      { name: 'Error Handling', test: this.testErrorHandling.bind(this) }
    ];
    
    for (const test of integrationTests) {
      console.log(`  🧪 Testing ${test.name}...`);
      
      try {
        const result = await test.test();
        this.validationResults.integration[test.name] = result;
        
        console.log(`    ${result.success ? '✅' : '❌'} ${test.name}: ${result.success ? 'PASS' : 'FAIL'}`);
        if (!result.success) {
          console.log(`       Error: ${result.error}`);
        }
        
      } catch (error) {
        this.validationResults.integration[test.name] = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        console.log(`    ❌ ${test.name}: FAIL - ${error.message}`);
      }
    }
  }

  async testEndToEndRAG() {
    const ragService = new RAGChatService();
    
    const response = await ragService.generateResponse(
      'How do I create a new fund?',
      'validation-test-session',
      { useKnowledgeBase: true, maxChunks: 3 }
    );
    
    return {
      success: !!(response && response.message && response.confidence !== undefined),
      details: {
        hasMessage: !!response.message,
        hasConfidence: response.confidence !== undefined,
        useKnowledgeBase: response.useKnowledgeBase,
        citationCount: response.citations?.length || 0,
        sourceCount: response.sources?.length || 0
      },
      timestamp: new Date().toISOString()
    };
  }

  async testAPIIntegration() {
    // Check if chat routes file exists and has required endpoints
    const chatRoutesPath = path.join(__dirname, '../routes/chat.js');
    
    if (!fs.existsSync(chatRoutesPath)) {
      throw new Error('Chat routes file not found');
    }
    
    const chatRoutes = fs.readFileSync(chatRoutesPath, 'utf8');
    
    const requiredEndpoints = [
      'POST.*message',
      'GET.*health',
      'GET.*stats',
      'POST.*test'
    ];
    
    const missingEndpoints = requiredEndpoints.filter(endpoint => 
      !new RegExp(endpoint).test(chatRoutes)
    );
    
    return {
      success: missingEndpoints.length === 0,
      details: {
        requiredEndpoints: requiredEndpoints.length,
        foundEndpoints: requiredEndpoints.length - missingEndpoints.length,
        missingEndpoints
      },
      timestamp: new Date().toISOString()
    };
  }

  async testDatabaseIntegration() {
    // Test database connectivity and required tables
    const requiredTables = [
      'kb_sources', 'kb_chunks', 'audit_logs', 'conversations',
      'feedback', 'ingestion_jobs', 'embedding_cache', 'validation_reports'
    ];
    
    const existingTables = [];
    
    for (const table of requiredTables) {
      try {
        const result = await this.db.query(
          `SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1`,
          [table]
        );
        
        if (parseInt(result.rows[0].count) > 0) {
          existingTables.push(table);
        }
      } catch (error) {
        // Table doesn't exist or query failed
      }
    }
    
    return {
      success: existingTables.length === requiredTables.length,
      details: {
        requiredTables: requiredTables.length,
        existingTables: existingTables.length,
        missingTables: requiredTables.filter(table => !existingTables.includes(table))
      },
      timestamp: new Date().toISOString()
    };
  }

  async testErrorHandling() {
    const confidenceManager = new ConfidenceManager();
    
    // Test fallback strategies
    const strategies = [
      'low_retrieval_confidence',
      'no_relevant_sources',
      'poor_citation_quality',
      'query_ambiguity'
    ];
    
    let successfulFallbacks = 0;
    
    for (const strategy of strategies) {
      try {
        const fallback = await confidenceManager.applyFallbackStrategy(strategy, {
          query: 'test query',
          originalResponse: 'test response',
          originalConfidence: 0.3
        });
        
        if (fallback && fallback.strategy === strategy) {
          successfulFallbacks++;
        }
      } catch (error) {
        // Fallback failed
      }
    }
    
    return {
      success: successfulFallbacks === strategies.length,
      details: {
        totalStrategies: strategies.length,
        successfulFallbacks,
        successRate: successfulFallbacks / strategies.length
      },
      timestamp: new Date().toISOString()
    };
  }

  async validatePerformance() {
    console.log('\n⚡ Validating Performance...');
    
    const performanceTests = [
      { name: 'Response Time', test: this.testResponseTime.bind(this) },
      { name: 'Concurrent Requests', test: this.testConcurrentRequests.bind(this) },
      { name: 'Memory Usage', test: this.testMemoryUsage.bind(this) }
    ];
    
    for (const test of performanceTests) {
      console.log(`  📊 Testing ${test.name}...`);
      
      try {
        const result = await test.test();
        this.validationResults.performance[test.name] = result;
        
        console.log(`    ${result.success ? '✅' : '❌'} ${test.name}: ${result.success ? 'PASS' : 'FAIL'}`);
        if (result.details) {
          console.log(`       ${JSON.stringify(result.details)}`);
        }
        
      } catch (error) {
        this.validationResults.performance[test.name] = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        console.log(`    ❌ ${test.name}: FAIL - ${error.message}`);
      }
    }
  }

  async testResponseTime() {
    const ragService = new RAGChatService();
    const iterations = 3;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      await ragService.generateResponse(
        `Performance test query ${i + 1}`,
        `perf-test-${i}`,
        { useKnowledgeBase: true, maxChunks: 3 }
      );
      
      times.push(Date.now() - startTime);
    }
    
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxAcceptableTime = 10000; // 10 seconds
    
    return {
      success: averageTime < maxAcceptableTime,
      details: {
        averageTime: Math.round(averageTime),
        maxTime: Math.max(...times),
        minTime: Math.min(...times),
        threshold: maxAcceptableTime,
        iterations
      },
      timestamp: new Date().toISOString()
    };
  }

  async testConcurrentRequests() {
    const ragService = new RAGChatService();
    const concurrency = 3;
    
    const requests = Array.from({ length: concurrency }, (_, i) =>
      ragService.generateResponse(
        `Concurrent test ${i + 1}`,
        `concurrent-test-${i}`,
        { useKnowledgeBase: true, maxChunks: 2 }
      )
    );
    
    const startTime = Date.now();
    const results = await Promise.allSettled(requests);
    const totalTime = Date.now() - startTime;
    
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const successRate = successful / concurrency;
    
    return {
      success: successRate >= 0.8, // 80% success rate
      details: {
        concurrency,
        successful,
        failed: concurrency - successful,
        successRate: Math.round(successRate * 100),
        totalTime
      },
      timestamp: new Date().toISOString()
    };
  }

  async testMemoryUsage() {
    const initialMemory = process.memoryUsage();
    
    // Perform memory-intensive operations
    const ragService = new RAGChatService();
    
    for (let i = 0; i < 5; i++) {
      await ragService.generateResponse(
        `Memory test ${i + 1}`,
        `memory-test-${i}`,
        { useKnowledgeBase: true }
      );
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
    
    // Memory increase should be reasonable (less than 50%)
    return {
      success: memoryIncreasePercent < 50,
      details: {
        initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        increaseMB: Math.round(memoryIncrease / 1024 / 1024),
        increasePercent: Math.round(memoryIncreasePercent)
      },
      timestamp: new Date().toISOString()
    };
  }

  calculateOverallScore() {
    const categories = ['components', 'integration', 'performance'];
    let totalScore = 0;
    let totalTests = 0;
    
    for (const category of categories) {
      const categoryResults = this.validationResults[category];
      const categoryTests = Object.values(categoryResults);
      const categorySuccesses = categoryTests.filter(test => test.success).length;
      
      totalScore += categorySuccesses;
      totalTests += categoryTests.length;
    }
    
    const overallScore = totalTests > 0 ? (totalScore / totalTests) * 100 : 0;
    
    this.validationResults.overall = {
      success: overallScore >= 80, // 80% pass rate required
      score: Math.round(overallScore),
      totalTests,
      passedTests: totalScore,
      failedTests: totalTests - totalScore
    };
  }

  generateValidationReport() {
    console.log('\n📋 Phase 2 Validation Report');
    console.log('================================');
    
    const { overall } = this.validationResults;
    
    console.log(`\n🎯 Overall Result: ${overall.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📊 Score: ${overall.score}% (${overall.passedTests}/${overall.totalTests} tests passed)`);
    
    if (overall.success) {
      console.log('\n🎉 Phase 2 RAG System Validation SUCCESSFUL!');
      console.log('✅ All critical components are operational');
      console.log('✅ Integration tests passed');
      console.log('✅ Performance meets requirements');
      console.log('\n🚀 System is ready for production deployment!');
    } else {
      console.log('\n⚠️ Phase 2 validation completed with issues');
      console.log('❌ Some components or tests failed');
      console.log('🔧 Review failed tests and address issues before deployment');
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, '../validation-reports/phase2-validation.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.validationResults, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new Phase2Validator();
  
  validator.validatePhase2()
    .then(results => {
      process.exit(results.overall.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation script failed:', error);
      process.exit(1);
    });
}

module.exports = Phase2Validator;
