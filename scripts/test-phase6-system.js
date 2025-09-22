#!/usr/bin/env node

/**
 * Phase 6 System Test Script
 * 
 * Test the Phase 6 production deployment system components
 */

const logger = require('../utils/logger');
const { initializeDatabase, closeDatabase } = require('../config/database');

async function testDatabaseConnection() {
  logger.info('🔍 Testing database connection...');
  
  try {
    const db = await initializeDatabase();
    logger.info('✅ Database connection successful');
    
    // Test a simple query
    const result = await db.query('SELECT NOW() as current_time');
    logger.info('✅ Database query successful:', result.rows[0]);
    
    await closeDatabase();
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testFeatureFlagManager() {
  logger.info('🚩 Testing Feature Flag Manager...');
  
  try {
    const { FeatureFlagManager } = require('./feature-flag-manager');
    const flagManager = new FeatureFlagManager();
    
    // Initialize with database
    const db = await initializeDatabase();
    await flagManager.initialize();
    
    logger.info('✅ Feature Flag Manager initialized successfully');
    
    // Test flag status
    const flagStatus = await flagManager.getFlagStatus();
    logger.info('📊 Flag status:', Object.keys(flagStatus).length, 'flags found');
    
    await closeDatabase();
    return true;
  } catch (error) {
    logger.error('❌ Feature Flag Manager test failed:', error.message);
    return false;
  }
}

async function testMonitoringSystem() {
  logger.info('📊 Testing Monitoring System...');
  
  try {
    const { ProductionMonitoringSystem } = require('../monitoring/production-monitoring-system');
    const monitoringSystem = new ProductionMonitoringSystem();
    
    // Initialize with database
    const db = await initializeDatabase();
    await monitoringSystem.initialize();
    
    logger.info('✅ Monitoring System initialized successfully');
    
    // Test health checks
    await monitoringSystem.performHealthChecks();
    logger.info('✅ Health checks completed');
    
    // Test performance checks
    await monitoringSystem.performPerformanceChecks();
    logger.info('✅ Performance checks completed');
    
    await closeDatabase();
    return true;
  } catch (error) {
    logger.error('❌ Monitoring System test failed:', error.message);
    return false;
  }
}

async function testDeploymentOrchestrator() {
  logger.info('🚀 Testing Deployment Orchestrator...');
  
  try {
    const { ProductionDeploymentOrchestrator } = require('./production-deployment-orchestrator');
    const orchestrator = new ProductionDeploymentOrchestrator();
    
    // Initialize with database
    const db = await initializeDatabase();
    await orchestrator.initialize();
    
    logger.info('✅ Deployment Orchestrator initialized successfully');
    
    // Test environment validation
    await orchestrator.validateProductionEnvironment();
    logger.info('✅ Environment validation completed');
    
    await closeDatabase();
    return true;
  } catch (error) {
    logger.error('❌ Deployment Orchestrator test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  logger.info('🧪 Starting Phase 6 System Tests...');
  
  const tests = [
    { name: 'Database Connection', test: testDatabaseConnection },
    { name: 'Feature Flag Manager', test: testFeatureFlagManager },
    { name: 'Monitoring System', test: testMonitoringSystem },
    { name: 'Deployment Orchestrator', test: testDeploymentOrchestrator }
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    logger.info(`\n🔄 Running test: ${name}`);
    const startTime = Date.now();
    
    try {
      const success = await test();
      const duration = Date.now() - startTime;
      
      results.push({
        name,
        success,
        duration,
        status: success ? 'PASSED' : 'FAILED'
      });
      
      logger.info(`${success ? '✅' : '❌'} Test ${name}: ${success ? 'PASSED' : 'FAILED'} (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({
        name,
        success: false,
        duration,
        status: 'ERROR',
        error: error.message
      });
      
      logger.error(`💥 Test ${name}: ERROR (${duration}ms) - ${error.message}`);
    }
  }
  
  // Summary
  logger.info('\n📊 TEST SUMMARY');
  logger.info('================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  results.forEach(result => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    logger.info(`${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      logger.info(`   Error: ${result.error}`);
    }
  });
  
  logger.info(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed`);
  logger.info(`Total time: ${totalTime}ms`);
  
  if (failed === 0) {
    logger.info('🎉 All Phase 6 system tests passed!');
    return true;
  } else {
    logger.error('💥 Some Phase 6 system tests failed');
    return false;
  }
}

// Main execution
async function main() {
  try {
    const success = await runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logger.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runAllTests };
