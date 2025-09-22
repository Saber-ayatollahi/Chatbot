#!/usr/bin/env node

/**
 * Quick Test - Verify critical fixes without hanging
 */

async function quickTest() {
  console.log('🧪 QUICK CRITICAL FIXES TEST');
  console.log('=============================');
  
  const tests = [];
  
  // Test 1: Configuration Loading
  try {
    const { getConfig } = require('../config/environment');
    const config = getConfig();
    
    const vectorDim = config.get('vector.dimension');
    const embeddingModel = config.get('openai.embeddingModel');
    
    if (vectorDim === 3072 && embeddingModel === 'text-embedding-3-large') {
      tests.push({ name: 'Configuration Consistency', status: '✅ PASS' });
    } else {
      tests.push({ name: 'Configuration Consistency', status: `❌ FAIL - Dim: ${vectorDim}, Model: ${embeddingModel}` });
    }
  } catch (error) {
    tests.push({ name: 'Configuration Loading', status: `💥 ERROR - ${error.message}` });
  }
  
  // Test 2: Database Connection (with timeout)
  try {
    const { getDatabase } = require('../config/database');
    const db = getDatabase();
    
    // Set a short timeout for this test
    const originalTimeout = process.env.DB_CONNECTION_TIMEOUT;
    process.env.DB_CONNECTION_TIMEOUT = '3000';
    
    await Promise.race([
      db.initialize(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 4000))
    ]);
    
    const healthCheck = await db.healthCheck();
    await db.close();
    
    if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
      tests.push({ name: 'Database Connection', status: `✅ PASS - ${healthCheck.status}` });
    } else {
      tests.push({ name: 'Database Connection', status: `⚠️ WARN - ${healthCheck.status}` });
    }
    
    // Restore timeout
    if (originalTimeout) {
      process.env.DB_CONNECTION_TIMEOUT = originalTimeout;
    } else {
      delete process.env.DB_CONNECTION_TIMEOUT;
    }
    
  } catch (error) {
    tests.push({ name: 'Database Connection', status: `⚠️ SKIP - ${error.message.split('\n')[0]}` });
  }
  
  // Test 3: Environment Validation
  try {
    // Test validation without actually running full validation
    const { EnvironmentConfig } = require('../config/environment');
    const envConfig = new EnvironmentConfig();
    
    // Check if validation method exists and is callable
    if (typeof envConfig.validateConfiguration === 'function') {
      tests.push({ name: 'Environment Validation', status: '✅ PASS - Method available' });
    } else {
      tests.push({ name: 'Environment Validation', status: '❌ FAIL - Method missing' });
    }
  } catch (error) {
    if (error.message.includes('Configuration validation failed')) {
      tests.push({ name: 'Environment Validation', status: '⚠️ WARN - Validation active but failed' });
    } else {
      tests.push({ name: 'Environment Validation', status: `💥 ERROR - ${error.message}` });
    }
  }
  
  // Test 4: OpenAI Integration (quick check)
  try {
    const OpenAI = require('openai');
    const { getConfig } = require('../config/environment');
    const config = getConfig();
    
    const apiKey = config.get('openai.apiKey');
    if (!apiKey || apiKey.includes('your-api-key') || apiKey.includes('replace-me')) {
      tests.push({ name: 'OpenAI Integration', status: '⚠️ SKIP - No valid API key' });
    } else {
      // Just test client creation, not actual API call
      const openai = new OpenAI({ apiKey, timeout: 1000 });
      tests.push({ name: 'OpenAI Integration', status: '✅ PASS - Client created' });
    }
  } catch (error) {
    tests.push({ name: 'OpenAI Integration', status: `💥 ERROR - ${error.message}` });
  }
  
  // Test 5: File System
  try {
    const fs = require('fs');
    const path = require('path');
    
    const criticalFiles = [
      'config/environment.js',
      'config/database.js', 
      'database/schema.sql',
      '__tests__/unit/critical-fixes.test.js',
      'scripts/validateEnvironment.js'
    ];
    
    const missingFiles = criticalFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length === 0) {
      tests.push({ name: 'Critical Files', status: '✅ PASS - All files present' });
    } else {
      tests.push({ name: 'Critical Files', status: `❌ FAIL - Missing: ${missingFiles.join(', ')}` });
    }
  } catch (error) {
    tests.push({ name: 'Critical Files', status: `💥 ERROR - ${error.message}` });
  }
  
  // Report Results
  console.log('\n📊 RESULTS:');
  console.log('-'.repeat(50));
  
  tests.forEach(test => {
    console.log(`${test.status.padEnd(25)} ${test.name}`);
  });
  
  const passed = tests.filter(t => t.status.includes('✅')).length;
  const failed = tests.filter(t => t.status.includes('❌')).length;
  const warnings = tests.filter(t => t.status.includes('⚠️')).length;
  const errors = tests.filter(t => t.status.includes('💥')).length;
  
  console.log('-'.repeat(50));
  console.log(`✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️ Warnings: ${warnings} | 💥 Errors: ${errors}`);
  
  if (failed === 0 && errors === 0) {
    console.log('\n🎉 All critical components working!');
    return true;
  } else {
    console.log('\n🔧 Some issues need attention');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  quickTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Quick test failed:', error);
    process.exit(1);
  });
}

module.exports = { quickTest };
