#!/usr/bin/env node

/**
 * Individual Test Runner
 * Runs tests individually to identify hanging tests
 */

const { spawn } = require('child_process');
const path = require('path');

const testSuites = [
  'Fix #1: Vector Dimension Consistency',
  'Fix #2: Environment Configuration Validation', 
  'Fix #3: Connection Pool Enhancement',
  'Integration Tests',
  'Error Handling'
];

async function runTest(testName) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Running: ${testName}`);
    console.log('='.repeat(50));
    
    const timeout = setTimeout(() => {
      console.log(`❌ TIMEOUT: ${testName} (hanging after 15 seconds)`);
      resolve({ name: testName, status: 'timeout' });
    }, 15000);
    
    const testProcess = spawn('npm', ['test', '__tests__/unit/critical-fixes.test.js', '--', '--testNamePattern', testName], {
      stdio: 'pipe',
      shell: true,
      cwd: process.cwd()
    });
    
    let output = '';
    let errorOutput = '';
    
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    testProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        console.log(`✅ PASSED: ${testName}`);
        resolve({ name: testName, status: 'passed', output });
      } else {
        console.log(`❌ FAILED: ${testName}`);
        console.log('Error output:', errorOutput);
        resolve({ name: testName, status: 'failed', output, error: errorOutput });
      }
    });
    
    testProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`💥 ERROR: ${testName} - ${error.message}`);
      resolve({ name: testName, status: 'error', error: error.message });
    });
  });
}

async function runAllTests() {
  console.log('🚀 Running individual test suites to identify hanging tests...\n');
  
  const results = [];
  
  for (const testSuite of testSuites) {
    const result = await runTest(testSuite);
    results.push(result);
    
    // Wait a bit between tests to avoid interference
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'passed');
  const failed = results.filter(r => r.status === 'failed');
  const timeouts = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');
  
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏰ Timeouts: ${timeouts.length}`);
  console.log(`💥 Errors: ${errors.length}`);
  
  if (timeouts.length > 0) {
    console.log('\n⏰ HANGING TESTS:');
    timeouts.forEach(t => console.log(`  - ${t.name}`));
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failed.forEach(t => console.log(`  - ${t.name}`));
  }
  
  if (errors.length > 0) {
    console.log('\n💥 ERROR TESTS:');
    errors.forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }
  
  console.log('\n🎯 Next steps:');
  if (timeouts.length > 0) {
    console.log('- Fix hanging tests by adding timeouts and proper cleanup');
  }
  if (failed.length > 0) {
    console.log('- Fix failing assertions and logic errors');
  }
  if (errors.length > 0) {
    console.log('- Fix test setup and configuration errors');
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };
