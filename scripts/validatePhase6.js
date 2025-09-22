#!/usr/bin/env node

/**
 * Phase 6 Validation Script
 * Validates the Continuous Improvement and Advanced Features implementation
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

class Phase6Validator {
  constructor() {
    this.dbConfig = {
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    };
    this.pool = new Pool(this.dbConfig);
    this.validationTests = [
      'Database Schema Validation',
      'Service Initialization Tests',
      'Knowledge Base System Tests',
      'Feedback Analysis System Tests',
      'Model Fine-Tuning Service Tests',
      'Configuration Validation',
      'Directory Structure Validation',
      'Integration Tests',
      'Performance Tests'
    ];
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  async run() {
    try {
      log('\n🔍 Validating Phase 6: Continuous Improvement & Advanced Features', 'cyan');
      log('=' .repeat(70), 'cyan');

      for (let i = 0; i < this.validationTests.length; i++) {
        const test = this.validationTests[i];
        log(`\n📋 Test ${i + 1}/${this.validationTests.length}: ${test}`, 'blue');
        
        try {
          switch (test) {
            case 'Database Schema Validation':
              await this.validateDatabaseSchema();
              break;
            case 'Service Initialization Tests':
              await this.testServiceInitialization();
              break;
            case 'Knowledge Base System Tests':
              await this.testKnowledgeBaseSystem();
              break;
            case 'Feedback Analysis System Tests':
              await this.testFeedbackAnalysisSystem();
              break;
            case 'Model Fine-Tuning Service Tests':
              await this.testModelFineTuningService();
              break;
            case 'Configuration Validation':
              await this.validateConfiguration();
              break;
            case 'Directory Structure Validation':
              await this.validateDirectoryStructure();
              break;
            case 'Integration Tests':
              await this.runIntegrationTests();
              break;
            case 'Performance Tests':
              await this.runPerformanceTests();
              break;
          }
          
          this.recordResult(test, 'passed', 'All checks passed');
          log(`✅ ${test} passed`, 'green');

        } catch (error) {
          this.recordResult(test, 'failed', error.message);
          log(`❌ ${test} failed: ${error.message}`, 'red');
        }
      }

      this.displaySummary();

    } catch (error) {
      log(`\n💥 Validation failed with critical error: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }

  async validateDatabaseSchema() {
    const client = await this.pool.connect();
    
    try {
      log('  📊 Checking knowledge base tables...', 'yellow');
      
      // Check knowledge_base_versions table
      const kbVersionsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_base_versions'
        ORDER BY ordinal_position
      `);
      
      const requiredKbColumns = [
        'id', 'document_id', 'version_number', 'title', 'content',
        'metadata', 'content_hash', 'created_by', 'created_at',
        'is_current', 'quality_score'
      ];
      
      const kbColumns = kbVersionsResult.rows.map(row => row.column_name);
      for (const column of requiredKbColumns) {
        if (!kbColumns.includes(column)) {
          throw new Error(`Missing column '${column}' in knowledge_base_versions table`);
        }
      }
      
      log('  📈 Checking feedback analysis tables...', 'yellow');
      
      // Check feedback_analysis table
      const feedbackAnalysisResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'feedback_analysis'
        ORDER BY ordinal_position
      `);
      
      const requiredFeedbackColumns = [
        'id', 'feedback_id', 'sentiment_score', 'sentiment_label',
        'confidence_score', 'categories', 'keywords', 'topics',
        'urgency_score', 'complexity_score', 'analyzed_at'
      ];
      
      const feedbackColumns = feedbackAnalysisResult.rows.map(row => row.column_name);
      for (const column of requiredFeedbackColumns) {
        if (!feedbackColumns.includes(column)) {
          throw new Error(`Missing column '${column}' in feedback_analysis table`);
        }
      }
      
      log('  🤖 Checking fine-tuning tables...', 'yellow');
      
      // Check fine_tuning_datasets table
      const ftDatasetsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'fine_tuning_datasets'
        ORDER BY ordinal_position
      `);
      
      const requiredFtColumns = [
        'id', 'dataset_name', 'category', 'source_type',
        'total_examples', 'training_examples', 'validation_examples',
        'created_at', 'created_by', 'is_active'
      ];
      
      const ftColumns = ftDatasetsResult.rows.map(row => row.column_name);
      for (const column of requiredFtColumns) {
        if (!ftColumns.includes(column)) {
          throw new Error(`Missing column '${column}' in fine_tuning_datasets table`);
        }
      }
      
      log('  ✅ Database schema validation passed', 'green');

    } finally {
      client.release();
    }
  }

  async testServiceInitialization() {
    log('  🔧 Testing service imports...', 'yellow');
    
    // Test Knowledge Base Maintenance System
    try {
      const KnowledgeBaseMaintenanceSystem = require('../services/KnowledgeBaseMaintenanceSystem');
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      
      if (typeof kbSystem.initialize !== 'function') {
        throw new Error('KnowledgeBaseMaintenanceSystem missing initialize method');
      }
      
      log('    ✅ Knowledge Base Maintenance System import successful', 'green');
    } catch (error) {
      throw new Error(`Knowledge Base Maintenance System import failed: ${error.message}`);
    }
    
    // Test Feedback Analysis System
    try {
      const FeedbackAnalysisSystem = require('../services/FeedbackAnalysisSystem');
      const feedbackSystem = new FeedbackAnalysisSystem();
      
      if (typeof feedbackSystem.initialize !== 'function') {
        throw new Error('FeedbackAnalysisSystem missing initialize method');
      }
      
      log('    ✅ Feedback Analysis System import successful', 'green');
    } catch (error) {
      throw new Error(`Feedback Analysis System import failed: ${error.message}`);
    }
    
    // Test Model Fine-Tuning Service
    try {
      const ModelFineTuningService = require('../services/ModelFineTuningService');
      const ftService = new ModelFineTuningService();
      
      if (typeof ftService.initialize !== 'function') {
        throw new Error('ModelFineTuningService missing initialize method');
      }
      
      log('    ✅ Model Fine-Tuning Service import successful', 'green');
    } catch (error) {
      throw new Error(`Model Fine-Tuning Service import failed: ${error.message}`);
    }
    
    log('  ✅ Service initialization tests passed', 'green');
  }

  async testKnowledgeBaseSystem() {
    log('  📚 Testing Knowledge Base Maintenance System...', 'yellow');
    
    try {
      const KnowledgeBaseMaintenanceSystem = require('../services/KnowledgeBaseMaintenanceSystem');
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      
      // Test initialization
      await kbSystem.initialize();
      
      if (!kbSystem.initialized) {
        throw new Error('Knowledge Base system failed to initialize properly');
      }
      
      // Test basic functionality
      const testDocId = 'test_doc_' + Date.now();
      const result = await kbSystem.updateDocument(
        testDocId,
        'Test Document',
        'This is a test document for validation purposes.',
        { test: true },
        'validator'
      );
      
      if (!result.success) {
        throw new Error('Failed to create test document');
      }
      
      // Test document retrieval
      const currentVersion = await kbSystem.getCurrentVersion(testDocId);
      if (!currentVersion || currentVersion.title !== 'Test Document') {
        throw new Error('Failed to retrieve created document');
      }
      
      // Test history
      const history = await kbSystem.getDocumentHistory(testDocId);
      if (!history || history.length === 0) {
        throw new Error('Failed to retrieve document history');
      }
      
      // Cleanup
      await kbSystem.close();
      
      log('    ✅ Knowledge Base system functionality validated', 'green');
      
    } catch (error) {
      throw new Error(`Knowledge Base system test failed: ${error.message}`);
    }
  }

  async testFeedbackAnalysisSystem() {
    log('  🔍 Testing Feedback Analysis System...', 'yellow');
    
    try {
      const FeedbackAnalysisSystem = require('../services/FeedbackAnalysisSystem');
      const feedbackSystem = new FeedbackAnalysisSystem();
      
      // Test initialization
      await feedbackSystem.initialize();
      
      if (!feedbackSystem.initialized) {
        throw new Error('Feedback Analysis system failed to initialize properly');
      }
      
      // Test sentiment analysis
      const sentiment = await feedbackSystem.analyzeSentiment('This is a great chatbot! Very helpful.');
      
      if (!sentiment || typeof sentiment.score !== 'number' || !sentiment.label) {
        throw new Error('Sentiment analysis failed to return proper results');
      }
      
      // Test keyword extraction
      const keywords = await feedbackSystem.extractKeywords('The chatbot response was slow and inaccurate');
      
      if (!Array.isArray(keywords)) {
        throw new Error('Keyword extraction failed to return array');
      }
      
      // Test categorization
      const categories = await feedbackSystem.categorizeFeeback(
        'The response was wrong and took too long',
        { feedback_text: 'The response was wrong and took too long' }
      );
      
      if (!Array.isArray(categories)) {
        throw new Error('Categorization failed to return array');
      }
      
      // Cleanup
      await feedbackSystem.close();
      
      log('    ✅ Feedback Analysis system functionality validated', 'green');
      
    } catch (error) {
      throw new Error(`Feedback Analysis system test failed: ${error.message}`);
    }
  }

  async testModelFineTuningService() {
    log('  🎯 Testing Model Fine-Tuning Service...', 'yellow');
    
    try {
      const ModelFineTuningService = require('../services/ModelFineTuningService');
      const ftService = new ModelFineTuningService();
      
      // Test initialization
      await ftService.initialize();
      
      if (!ftService.initialized) {
        throw new Error('Model Fine-Tuning service failed to initialize properly');
      }
      
      // Test dataset creation
      const datasetId = await ftService.createTrainingDataset(
        'Test Dataset',
        'style_tone',
        'Test dataset for validation',
        'validator'
      );
      
      if (!datasetId) {
        throw new Error('Failed to create test dataset');
      }
      
      // Test adding training examples
      const testExamples = [
        {
          userMessage: 'What is fund management?',
          assistantMessage: 'Fund management is the professional management of investment funds...',
          type: 'training'
        }
      ];
      
      await ftService.addTrainingExamples(datasetId, testExamples, 'validator');
      
      // Test token estimation
      const tokenCount = await ftService.estimateTokenCount(testExamples[0]);
      
      if (typeof tokenCount !== 'number' || tokenCount <= 0) {
        throw new Error('Token estimation failed');
      }
      
      // Cleanup
      await ftService.close();
      
      log('    ✅ Model Fine-Tuning service functionality validated', 'green');
      
    } catch (error) {
      throw new Error(`Model Fine-Tuning service test failed: ${error.message}`);
    }
  }

  async validateConfiguration() {
    log('  ⚙️  Validating configuration files...', 'yellow');
    
    // Check knowledge base config
    try {
      const kbConfigPath = path.join(process.cwd(), 'knowledge_base', 'config.json');
      const kbConfigData = await fs.readFile(kbConfigPath, 'utf8');
      const kbConfig = JSON.parse(kbConfigData);
      
      const requiredKbFields = [
        'versioningEnabled', 'maxVersionsToKeep', 'autoBackupEnabled',
        'changeDetectionEnabled', 'qualityCheckEnabled'
      ];
      
      for (const field of requiredKbFields) {
        if (!(field in kbConfig)) {
          throw new Error(`Missing field '${field}' in knowledge base config`);
        }
      }
      
      log('    ✅ Knowledge base configuration valid', 'green');
      
    } catch (error) {
      throw new Error(`Knowledge base configuration validation failed: ${error.message}`);
    }
    
    // Check fine-tuning config
    try {
      const ftConfigPath = path.join(process.cwd(), 'fine_tuning', 'config.json');
      const ftConfigData = await fs.readFile(ftConfigPath, 'utf8');
      const ftConfig = JSON.parse(ftConfigData);
      
      const requiredFtFields = [
        'baseModel', 'maxTrainingExamples', 'minTrainingExamples',
        'validationSplit', 'trainingEpochs'
      ];
      
      for (const field of requiredFtFields) {
        if (!(field in ftConfig)) {
          throw new Error(`Missing field '${field}' in fine-tuning config`);
        }
      }
      
      log('    ✅ Fine-tuning configuration valid', 'green');
      
    } catch (error) {
      throw new Error(`Fine-tuning configuration validation failed: ${error.message}`);
    }
  }

  async validateDirectoryStructure() {
    log('  📁 Validating directory structure...', 'yellow');
    
    const requiredDirectories = [
      'knowledge_base',
      'knowledge_base/documents',
      'knowledge_base/versions',
      'knowledge_base/backups',
      'fine_tuning',
      'fine_tuning/datasets',
      'fine_tuning/training_files',
      'fine_tuning/models',
      'feedback_analysis'
    ];
    
    for (const dir of requiredDirectories) {
      const fullPath = path.join(process.cwd(), dir);
      
      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isDirectory()) {
          throw new Error(`${dir} exists but is not a directory`);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Required directory ${dir} does not exist`);
        }
        throw error;
      }
    }
    
    log('  ✅ Directory structure validation passed', 'green');
  }

  async runIntegrationTests() {
    log('  🔗 Running integration tests...', 'yellow');
    
    // Test database connectivity
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1 as test');
      log('    ✅ Database connectivity test passed', 'green');
    } finally {
      client.release();
    }
    
    // Test service integrations
    try {
      const KnowledgeBaseMaintenanceSystem = require('../services/KnowledgeBaseMaintenanceSystem');
      const FeedbackAnalysisSystem = require('../services/FeedbackAnalysisSystem');
      const ModelFineTuningService = require('../services/ModelFineTuningService');
      
      // Test that services can be instantiated together
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      const feedbackSystem = new FeedbackAnalysisSystem();
      const ftService = new ModelFineTuningService();
      
      // Test that they don't interfere with each other
      await kbSystem.initialize();
      await feedbackSystem.initialize();
      await ftService.initialize();
      
      // Cleanup
      await kbSystem.close();
      await feedbackSystem.close();
      await ftService.close();
      
      log('    ✅ Service integration test passed', 'green');
      
    } catch (error) {
      throw new Error(`Service integration test failed: ${error.message}`);
    }
  }

  async runPerformanceTests() {
    log('  ⚡ Running performance tests...', 'yellow');
    
    try {
      // Test knowledge base system performance
      const KnowledgeBaseMaintenanceSystem = require('../services/KnowledgeBaseMaintenanceSystem');
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      
      await kbSystem.initialize();
      
      const startTime = Date.now();
      
      // Create multiple test documents
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          kbSystem.updateDocument(
            `perf_test_${i}_${Date.now()}`,
            `Performance Test Document ${i}`,
            `This is test document ${i} for performance testing. `.repeat(50),
            { test: true, index: i },
            'performance_test'
          )
        );
      }
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      await kbSystem.close();
      
      // Should complete within reasonable time (10 seconds for 5 documents)
      if (duration > 10000) {
        this.recordResult('Performance Tests', 'warning', `Slow performance: ${duration}ms for 5 documents`);
        log(`    ⚠️  Performance warning: ${duration}ms for 5 documents`, 'yellow');
      } else {
        log(`    ✅ Performance test passed: ${duration}ms for 5 documents`, 'green');
      }
      
    } catch (error) {
      throw new Error(`Performance test failed: ${error.message}`);
    }
  }

  recordResult(test, status, message) {
    this.results.details.push({ test, status, message });
    
    switch (status) {
      case 'passed':
        this.results.passed++;
        break;
      case 'failed':
        this.results.failed++;
        break;
      case 'warning':
        this.results.warnings++;
        break;
    }
  }

  displaySummary() {
    log('\n📊 Validation Summary', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    log(`✅ Passed: ${this.results.passed}`, 'green');
    log(`❌ Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    log(`⚠️  Warnings: ${this.results.warnings}`, this.results.warnings > 0 ? 'yellow' : 'green');
    
    if (this.results.failed > 0) {
      log('\n❌ Failed Tests:', 'red');
      this.results.details
        .filter(result => result.status === 'failed')
        .forEach(result => {
          log(`  • ${result.test}: ${result.message}`, 'red');
        });
    }
    
    if (this.results.warnings > 0) {
      log('\n⚠️  Warnings:', 'yellow');
      this.results.details
        .filter(result => result.status === 'warning')
        .forEach(result => {
          log(`  • ${result.test}: ${result.message}`, 'yellow');
        });
    }
    
    if (this.results.failed === 0) {
      log('\n🎉 All critical validations passed! Phase 6 is ready for use.', 'green');
      log('\nAvailable Phase 6 features:', 'cyan');
      log('• Knowledge Base Maintenance with version control', 'cyan');
      log('• Automated feedback analysis and clustering', 'cyan');
      log('• Model fine-tuning capabilities', 'cyan');
      log('• Trend analysis and improvement recommendations', 'cyan');
      log('• Advanced quality scoring and validation', 'cyan');
      
      log('\nNext steps:', 'yellow');
      log('1. Start using knowledge base maintenance: npm run kb:sync', 'yellow');
      log('2. Analyze feedback patterns: npm run feedback:analyze', 'yellow');
      log('3. Explore fine-tuning options: npm run ft:create-dataset', 'yellow');
      log('4. Monitor system improvements continuously', 'yellow');
    } else {
      log('\n⚠️  Some validations failed. Please address the issues before proceeding.', 'red');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new Phase6Validator();
  validator.run();
}

module.exports = Phase6Validator;
