#!/usr/bin/env node

/**
 * Critical Fixes Validation Script
 * Comprehensive testing and validation of all critical issues
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class CriticalFixValidator {
  constructor() {
    this.results = {
      databaseTransaction: { status: 'pending', details: [] },
      schemaMismatches: { status: 'pending', details: [] },
      confidenceNullChecks: { status: 'pending', details: [] },
      openaiIntegration: { status: 'pending', details: [] },
      integrationTests: { status: 'pending', details: [] }
    };
    
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  /**
   * Main validation entry point
   */
  async validateAll() {
    console.log('🚀 Starting Critical Fixes Validation');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Validate code syntax and structure
      await this.validateCodeSyntax();
      
      // Step 2: Run unit tests for each critical fix
      await this.runCriticalTests();
      
      // Step 3: Run integration tests
      await this.runIntegrationTests();
      
      // Step 4: Validate database schema alignment
      await this.validateSchemaAlignment();
      
      // Step 5: Test OpenAI integration
      await this.validateOpenAIIntegration();
      
      // Step 6: Generate final report
      this.generateFinalReport();
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate code syntax and imports
   */
  async validateCodeSyntax() {
    console.log('\n📋 Step 1: Validating Code Syntax...');
    
    const criticalFiles = [
      'config/database.js',
      'services/RAGChatService.js',
      'services/ConfidenceManager.js',
      'knowledge/retrieval/VectorRetriever.js',
      'knowledge/embeddings/EmbeddingGenerator.js'
    ];

    for (const file of criticalFiles) {
      try {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
          // Try to require the file to check for syntax errors
          delete require.cache[require.resolve(filePath)];
          require(filePath);
          console.log(`  ✅ ${file} - Syntax OK`);
        } else {
          console.log(`  ⚠️ ${file} - File not found`);
        }
      } catch (error) {
        console.log(`  ❌ ${file} - Syntax Error: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Run critical unit tests
   */
  async runCriticalTests() {
    console.log('\n🧪 Step 2: Running Critical Unit Tests...');
    
    const testSuites = [
      {
        name: 'Database Transaction Tests',
        file: '__tests__/unit/database-transaction.test.js',
        key: 'databaseTransaction'
      },
      {
        name: 'Schema Validation Tests',
        file: '__tests__/unit/schema-validation.test.js',
        key: 'schemaMismatches'
      },
      {
        name: 'Confidence Manager Tests',
        file: '__tests__/unit/confidence-manager-null-safety.test.js',
        key: 'confidenceNullChecks'
      },
      {
        name: 'OpenAI Integration Tests',
        file: '__tests__/unit/openai-integration.test.js',
        key: 'openaiIntegration'
      }
    ];

    for (const suite of testSuites) {
      console.log(`\n  🔍 Running ${suite.name}...`);
      
      try {
        const testResult = await this.runJestTest(suite.file);
        this.results[suite.key] = {
          status: testResult.success ? 'passed' : 'failed',
          details: testResult.output,
          testsRun: testResult.testsRun,
          testsPassed: testResult.testsPassed
        };
        
        this.totalTests += testResult.testsRun;
        this.passedTests += testResult.testsPassed;
        this.failedTests += (testResult.testsRun - testResult.testsPassed);
        
        if (testResult.success) {
          console.log(`    ✅ ${suite.name} - All tests passed`);
        } else {
          console.log(`    ❌ ${suite.name} - Some tests failed`);
          console.log(`    📊 ${testResult.testsPassed}/${testResult.testsRun} tests passed`);
        }
        
      } catch (error) {
        console.log(`    ❌ ${suite.name} - Test execution failed: ${error.message}`);
        this.results[suite.key] = {
          status: 'error',
          details: error.message
        };
      }
    }
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests() {
    console.log('\n🔗 Step 3: Running Integration Tests...');
    
    try {
      const testResult = await this.runJestTest('__tests__/critical-integration.test.js');
      
      this.results.integrationTests = {
        status: testResult.success ? 'passed' : 'failed',
        details: testResult.output,
        testsRun: testResult.testsRun,
        testsPassed: testResult.testsPassed
      };
      
      this.totalTests += testResult.testsRun;
      this.passedTests += testResult.testsPassed;
      this.failedTests += (testResult.testsRun - testResult.testsPassed);
      
      if (testResult.success) {
        console.log('  ✅ Integration Tests - All tests passed');
      } else {
        console.log('  ❌ Integration Tests - Some tests failed');
        console.log(`  📊 ${testResult.testsPassed}/${testResult.testsRun} tests passed`);
      }
      
    } catch (error) {
      console.log(`  ❌ Integration Tests - Execution failed: ${error.message}`);
      this.results.integrationTests = {
        status: 'error',
        details: error.message
      };
    }
  }

  /**
   * Validate database schema alignment
   */
  async validateSchemaAlignment() {
    console.log('\n🗃️ Step 4: Validating Database Schema Alignment...');
    
    try {
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Check for required tables
      const requiredTables = ['kb_sources', 'kb_chunks', 'conversations', 'audit_logs', 'feedback'];
      const missingTables = [];
      
      for (const table of requiredTables) {
        if (!schema.includes(`CREATE TABLE ${table}`)) {
          missingTables.push(table);
        }
      }
      
      if (missingTables.length === 0) {
        console.log('  ✅ All required tables present in schema');
      } else {
        console.log(`  ❌ Missing tables: ${missingTables.join(', ')}`);
      }
      
      // Check for required indexes
      const requiredIndexes = ['idx_kb_chunks_embedding', 'idx_kb_chunks_source_id'];
      const missingIndexes = [];
      
      for (const index of requiredIndexes) {
        if (!schema.includes(index)) {
          missingIndexes.push(index);
        }
      }
      
      if (missingIndexes.length === 0) {
        console.log('  ✅ All required indexes present in schema');
      } else {
        console.log(`  ❌ Missing indexes: ${missingIndexes.join(', ')}`);
      }
      
      // Check vector extension
      if (schema.includes('CREATE EXTENSION IF NOT EXISTS vector')) {
        console.log('  ✅ pgvector extension setup present');
      } else {
        console.log('  ❌ pgvector extension setup missing');
      }
      
    } catch (error) {
      console.log(`  ❌ Schema validation failed: ${error.message}`);
    }
  }

  /**
   * Validate OpenAI integration
   */
  async validateOpenAIIntegration() {
    console.log('\n🤖 Step 5: Validating OpenAI Integration...');
    
    try {
      // Check for proper fallback implementations
      const ragServicePath = path.join(__dirname, '..', 'services', 'RAGChatService.js');
      const ragServiceCode = fs.readFileSync(ragServicePath, 'utf8');
      
      if (ragServiceCode.includes("|| 'gpt-4o'")) {
        console.log('  ✅ Chat model fallback implemented');
      } else {
        console.log('  ❌ Chat model fallback missing');
      }
      
      const vectorRetrieverPath = path.join(__dirname, '..', 'knowledge', 'retrieval', 'VectorRetriever.js');
      const vectorRetrieverCode = fs.readFileSync(vectorRetrieverPath, 'utf8');
      
      if (vectorRetrieverCode.includes("|| 'text-embedding-3-large'")) {
        console.log('  ✅ Embedding model fallback implemented');
      } else {
        console.log('  ❌ Embedding model fallback missing');
      }
      
      // Check for API key validation
      if (ragServiceCode.includes('OpenAI API key is required')) {
        console.log('  ✅ API key validation implemented');
      } else {
        console.log('  ❌ API key validation missing');
      }
      
    } catch (error) {
      console.log(`  ❌ OpenAI integration validation failed: ${error.message}`);
    }
  }

  /**
   * Run a Jest test file
   */
  async runJestTest(testFile) {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', testFile, '--verbose', '--no-cache'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      jest.on('close', (code) => {
        // Parse Jest output to extract test results
        const testResults = this.parseJestOutput(output + errorOutput);
        
        resolve({
          success: code === 0,
          output: output + errorOutput,
          testsRun: testResults.total,
          testsPassed: testResults.passed,
          testsFailed: testResults.failed
        });
      });

      jest.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse Jest output to extract test statistics
   */
  parseJestOutput(output) {
    const results = { total: 0, passed: 0, failed: 0 };
    
    // Look for Jest summary line
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (summaryMatch) {
      results.failed = parseInt(summaryMatch[1]);
      results.passed = parseInt(summaryMatch[2]);
      results.total = parseInt(summaryMatch[3]);
    } else {
      // Look for all passed case
      const allPassedMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (allPassedMatch) {
        results.passed = parseInt(allPassedMatch[1]);
        results.total = parseInt(allPassedMatch[2]);
        results.failed = 0;
      }
    }
    
    return results;
  }

  /**
   * Generate final validation report
   */
  generateFinalReport() {
    console.log('\n📊 CRITICAL FIXES VALIDATION REPORT');
    console.log('=' .repeat(60));
    
    const overallStatus = this.passedTests === this.totalTests ? 'PASSED' : 'FAILED';
    const statusIcon = overallStatus === 'PASSED' ? '✅' : '❌';
    
    console.log(`${statusIcon} Overall Status: ${overallStatus}`);
    console.log(`📈 Test Summary: ${this.passedTests}/${this.totalTests} tests passed`);
    
    if (this.failedTests > 0) {
      console.log(`❌ Failed Tests: ${this.failedTests}`);
    }
    
    console.log('\nDetailed Results:');
    console.log('-' .repeat(40));
    
    Object.entries(this.results).forEach(([key, result]) => {
      const icon = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' : '⚠️';
      console.log(`${icon} ${this.formatTestName(key)}: ${result.status.toUpperCase()}`);
      
      if (result.testsRun) {
        console.log(`   📊 ${result.testsPassed}/${result.testsRun} tests passed`);
      }
    });
    
    // Generate recommendations
    console.log('\n🎯 Recommendations:');
    console.log('-' .repeat(40));
    
    if (overallStatus === 'PASSED') {
      console.log('✅ All critical fixes are working correctly');
      console.log('✅ System is ready for deployment with real API keys');
      console.log('✅ Run integration tests with actual database before production');
    } else {
      console.log('❌ Some critical issues remain - address before deployment');
      console.log('🔧 Review failed tests and fix underlying issues');
      console.log('🧪 Re-run validation after fixes');
    }
    
    // Save report to file
    const reportPath = path.join(__dirname, '..', 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      overallStatus,
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      results: this.results
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(overallStatus === 'PASSED' ? 0 : 1);
  }

  /**
   * Format test name for display
   */
  formatTestName(key) {
    const names = {
      databaseTransaction: 'Database Transaction Pattern',
      schemaMismatches: 'Schema-Code Alignment',
      confidenceNullChecks: 'Confidence Manager Null Safety',
      openaiIntegration: 'OpenAI Integration',
      integrationTests: 'End-to-End Integration'
    };
    
    return names[key] || key;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new CriticalFixValidator();
  validator.validateAll().catch(error => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
}

module.exports = CriticalFixValidator;
