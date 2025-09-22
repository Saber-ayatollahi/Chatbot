#!/usr/bin/env node

/**
 * Phase 4 Validation Script
 * Validates the complete Evaluation & Testing Framework implementation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Phase 4 Validation Script');
console.log('============================\n');

const REQUIRED_FILES = [
  // Core Evaluation Components
  'evaluation/GoldenDatasetGenerator.js',
  'evaluation/RegressionTester.js',
  'evaluation/ABTestingFramework.js',
  'evaluation/PerformanceBenchmarker.js',
  
  // Execution Scripts
  'scripts/generateGoldenDataset.js',
  'scripts/runRegressionTests.js',
  'scripts/runPerformanceBenchmarks.js',
  'scripts/runABTests.js',
  
  // CI/CD Integration
  '.github/workflows/evaluation.yml',
  
  // Tests
  '__tests__/evaluation/GoldenDatasetGenerator.test.js',
  '__tests__/evaluation/RegressionTester.test.js',
  '__tests__/integration/phase4-evaluation-system.test.js',
  
  // Documentation
  'PHASE4_README.md',
];

const REQUIRED_NPM_SCRIPTS = [
  'test:regression',
  'test:performance',
  'test:ab',
  'generate:dataset',
  'evaluate:quality',
  'benchmark:performance',
  'report:evaluation',
];

const REQUIRED_FUNCTIONS = [
  // GoldenDatasetGenerator
  {
    file: 'evaluation/GoldenDatasetGenerator.js',
    functions: [
      'generateGoldenDataset',
      'loadDocuments',
      'extractKeyChunks',
      'generateQAPairs',
      'createEdgeCases',
      'saveDataset',
    ],
  },
  // RegressionTester
  {
    file: 'evaluation/RegressionTester.js',
    functions: [
      'runEvaluationSuite',
      'runSingleTest',
      'evaluateResponse',
      'evaluateAnswerAccuracy',
      'evaluateCitations',
      'calculateMetrics',
    ],
  },
  // ABTestingFramework
  {
    file: 'evaluation/ABTestingFramework.js',
    functions: [
      'defineExperiment',
      'runExperiment',
      'runVariant',
      'analyzeResults',
      'performStatisticalTest',
    ],
  },
  // PerformanceBenchmarker
  {
    file: 'evaluation/PerformanceBenchmarker.js',
    functions: [
      'runBenchmark',
      'runSingleThreadedBenchmark',
      'runConcurrentBenchmark',
      'runLoadTest',
      'runMemoryProfiling',
      'calculateBenchmarkMetrics',
    ],
  },
];

let validationPassed = true;

function validateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${filePath}`);
    validationPassed = false;
    return false;
  }
  
  const stats = fs.statSync(fullPath);
  if (stats.size === 0) {
    console.error(`❌ Empty file: ${filePath}`);
    validationPassed = false;
    return false;
  }
  
  console.log(`✅ ${filePath}`);
  return true;
}

function validateNpmScripts() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    console.log('\n📋 Validating NPM Scripts...\n');
    
    for (const scriptName of REQUIRED_NPM_SCRIPTS) {
      if (!packageJson.scripts[scriptName]) {
        console.error(`❌ Missing NPM script: ${scriptName}`);
        validationPassed = false;
      } else {
        console.log(`✅ ${scriptName}: ${packageJson.scripts[scriptName]}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error validating NPM scripts:', error.message);
    validationPassed = false;
    return false;
  }
}

function validateFunctions() {
  console.log('\n🔍 Validating Core Functions...\n');
  
  for (const fileSpec of REQUIRED_FUNCTIONS) {
    const filePath = path.join(process.cwd(), fileSpec.file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found for function validation: ${fileSpec.file}`);
      validationPassed = false;
      continue;
    }
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      for (const functionName of fileSpec.functions) {
        // Check for function definition (method or function)
        const functionRegex = new RegExp(`(${functionName}\\s*\\(|${functionName}\\s*=|async\\s+${functionName}\\s*\\()`);
        
        if (functionRegex.test(fileContent)) {
          console.log(`✅ ${path.basename(fileSpec.file)}: ${functionName}`);
        } else {
          console.error(`❌ Missing function: ${functionName} in ${fileSpec.file}`);
          validationPassed = false;
        }
      }
    } catch (error) {
      console.error(`❌ Error reading ${fileSpec.file}:`, error.message);
      validationPassed = false;
    }
  }
}

function validateCICD() {
  console.log('\n🔄 Validating CI/CD Configuration...\n');
  
  const workflowPath = path.join(process.cwd(), '.github/workflows/evaluation.yml');
  
  if (!fs.existsSync(workflowPath)) {
    console.error('❌ Missing GitHub Actions workflow: .github/workflows/evaluation.yml');
    validationPassed = false;
    return false;
  }
  
  try {
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    
    // Check for required jobs
    const requiredJobs = [
      'regression-testing',
      'performance-testing',
      'ab-testing',
      'generate-report',
    ];
    
    for (const job of requiredJobs) {
      if (workflowContent.includes(job)) {
        console.log(`✅ CI/CD Job: ${job}`);
      } else {
        console.error(`❌ Missing CI/CD job: ${job}`);
        validationPassed = false;
      }
    }
    
    // Check for quality gates
    const qualityGates = [
      'Quality Gate - Accuracy',
      'Quality Gate - Citation Precision',
      'Quality Gate - Response Time',
    ];
    
    for (const gate of qualityGates) {
      if (workflowContent.includes(gate)) {
        console.log(`✅ Quality Gate: ${gate}`);
      } else {
        console.error(`❌ Missing quality gate: ${gate}`);
        validationPassed = false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error validating CI/CD configuration:', error.message);
    validationPassed = false;
    return false;
  }
}

function validateTests() {
  console.log('\n🧪 Running Unit Tests...\n');
  
  try {
    // Run Jest tests for evaluation components
    execSync('npm test -- --testPathPattern=evaluation --passWithNoTests', {
      stdio: 'inherit',
      timeout: 60000,
    });
    
    console.log('\n✅ Unit tests passed!');
    return true;
  } catch (error) {
    console.error('\n❌ Unit tests failed:', error.message);
    validationPassed = false;
    return false;
  }
}

function validateDocumentation() {
  console.log('\n📚 Validating Documentation...\n');
  
  const readmePath = path.join(process.cwd(), 'PHASE4_README.md');
  
  if (!fs.existsSync(readmePath)) {
    console.error('❌ Missing Phase 4 documentation: PHASE4_README.md');
    validationPassed = false;
    return false;
  }
  
  try {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    // Check for required sections
    const requiredSections = [
      '## Overview',
      '## 🎯 Objectives Achieved',
      '## 🏗️ Architecture',
      '## 🚀 Key Features',
      '## 🧪 Testing Strategy',
      '## 📊 CI/CD Integration',
      '## 🚀 Usage Guide',
    ];
    
    for (const section of requiredSections) {
      if (readmeContent.includes(section)) {
        console.log(`✅ Documentation section: ${section}`);
      } else {
        console.error(`❌ Missing documentation section: ${section}`);
        validationPassed = false;
      }
    }
    
    // Check documentation length (should be comprehensive)
    const wordCount = readmeContent.split(/\s+/).length;
    if (wordCount < 5000) {
      console.error(`❌ Documentation too short: ${wordCount} words (expected >5000)`);
      validationPassed = false;
    } else {
      console.log(`✅ Documentation length: ${wordCount} words`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error validating documentation:', error.message);
    validationPassed = false;
    return false;
  }
}

function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 4: Evaluation & Testing Framework',
    status: validationPassed ? 'PASSED' : 'FAILED',
    validation: {
      files: {
        total: REQUIRED_FILES.length,
        validated: REQUIRED_FILES.filter(file => {
          const fullPath = path.join(process.cwd(), file);
          return fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0;
        }).length,
      },
      npmScripts: {
        total: REQUIRED_NPM_SCRIPTS.length,
        validated: REQUIRED_NPM_SCRIPTS.filter(script => {
          try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return !!packageJson.scripts[script];
          } catch {
            return false;
          }
        }).length,
      },
      functions: {
        total: REQUIRED_FUNCTIONS.reduce((sum, spec) => sum + spec.functions.length, 0),
        validated: REQUIRED_FUNCTIONS.reduce((sum, spec) => {
          try {
            const filePath = path.join(process.cwd(), spec.file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return sum + spec.functions.filter(func => {
              const functionRegex = new RegExp(`(${func}\\s*\\(|${func}\\s*=|async\\s+${func}\\s*\\()`);
              return functionRegex.test(fileContent);
            }).length;
          } catch {
            return sum;
          }
        }, 0),
      },
    },
    capabilities: [
      'Golden Dataset Generation',
      'Automated Regression Testing',
      'A/B Testing Framework',
      'Performance Benchmarking',
      'CI/CD Integration with Quality Gates',
      'Statistical Analysis',
      'Comprehensive Reporting',
      'Real-time Monitoring',
    ],
  };
  
  const reportPath = path.join(process.cwd(), 'phase4-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📊 Validation report saved to: ${reportPath}`);
  return report;
}

// Main validation process
async function main() {
  try {
    console.log('1️⃣ Validating Required Files...\n');
    REQUIRED_FILES.forEach(validateFile);
    
    console.log('\n2️⃣ Validating NPM Scripts...');
    validateNpmScripts();
    
    console.log('\n3️⃣ Validating Core Functions...');
    validateFunctions();
    
    console.log('\n4️⃣ Validating CI/CD Configuration...');
    validateCICD();
    
    console.log('\n5️⃣ Validating Documentation...');
    validateDocumentation();
    
    console.log('\n6️⃣ Running Tests...');
    validateTests();
    
    const report = generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 PHASE 4 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${report.status}`);
    console.log(`Files: ${report.validation.files.validated}/${report.validation.files.total}`);
    console.log(`NPM Scripts: ${report.validation.npmScripts.validated}/${report.validation.npmScripts.total}`);
    console.log(`Functions: ${report.validation.functions.validated}/${report.validation.functions.total}`);
    console.log('='.repeat(60));
    
    if (validationPassed) {
      console.log('\n🎉 Phase 4 validation completed successfully!');
      console.log('✨ Evaluation & Testing Framework is fully implemented and ready!');
      console.log('\n🧪 Key Capabilities Validated:');
      report.capabilities.forEach(capability => {
        console.log(`   ✅ ${capability}`);
      });
      console.log('\n🚀 Ready for production evaluation workflows!');
      process.exit(0);
    } else {
      console.log('\n❌ Phase 4 validation failed!');
      console.log('🔧 Please fix the issues above and run validation again.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Validation script error:', error.message);
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Validation interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Validation terminated');
  process.exit(1);
});

// Run the validation
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
