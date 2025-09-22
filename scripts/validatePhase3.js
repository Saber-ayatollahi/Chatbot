#!/usr/bin/env node

/**
 * Phase 3 Validation Script
 * Validates the complete UI Enhancement implementation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Phase 3 Validation Script');
console.log('============================\n');

const REQUIRED_FILES = [
  // Enhanced Types
  'client/src/types/chat.ts',
  
  // Theme System
  'client/src/theme/index.ts',
  'client/src/contexts/ThemeContext.tsx',
  'client/src/contexts/ChatSettingsContext.tsx',
  
  // Enhanced Components
  'client/src/components/enhanced/EnhancedChatInterface.tsx',
  'client/src/components/enhanced/EnhancedMessageBubble.tsx',
  
  // Citation System
  'client/src/components/citations/CitationBadge.tsx',
  'client/src/components/citations/SourcePanel.tsx',
  
  // Indicators
  'client/src/components/indicators/ConfidenceIndicator.tsx',
  'client/src/components/indicators/ProcessingIndicator.tsx',
  
  // Interactive Features
  'client/src/components/interactive/SettingsPanel.tsx',
  
  // Real-time Features
  'client/src/hooks/useRealTimeFeatures.ts',
  'client/src/components/notifications/NotificationCenter.tsx',
  'client/src/components/realtime/ConnectionStatus.tsx',
  'client/src/components/realtime/LiveUpdates.tsx',
  'client/src/components/realtime/TypingIndicator.tsx',
  
  // Accessibility
  'client/src/hooks/useAccessibility.ts',
  
  // Enhanced Services
  'client/src/services/chatService.ts',
  
  // Main App
  'client/src/App.tsx',
  
  // Tests
  'client/src/__tests__/hooks/useRealTimeFeatures.test.ts',
  'client/src/__tests__/components/NotificationCenter.test.tsx',
  'client/src/__tests__/components/EnhancedChatInterface.test.tsx',
  'client/src/__tests__/integration/phase3-ui-system.test.tsx',
  
  // Documentation
  'PHASE3_README.md',
];

const REQUIRED_DEPENDENCIES = [
  '@mui/material',
  '@mui/icons-material',
  '@emotion/react',
  '@emotion/styled',
  'styled-components',
  'react-markdown',
  'react-syntax-highlighter',
  'framer-motion',
  'react-virtualized',
  'react-intersection-observer',
  'react-hotkeys-hook',
  'react-toastify',
  'lodash.debounce',
  'date-fns',
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

function validateDependency(packageName) {
  try {
    const packageJsonPath = path.join(process.cwd(), 'client', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    if (!dependencies[packageName]) {
      console.error(`❌ Missing dependency: ${packageName}`);
      validationPassed = false;
      return false;
    }
    
    console.log(`✅ ${packageName} (${dependencies[packageName]})`);
    return true;
  } catch (error) {
    console.error(`❌ Error checking dependency ${packageName}:`, error.message);
    validationPassed = false;
    return false;
  }
}

function runTests() {
  try {
    console.log('\n🧪 Running Tests...\n');
    
    // Change to client directory
    process.chdir('client');
    
    // Run tests
    execSync('npm test -- --coverage --watchAll=false', {
      stdio: 'inherit',
      timeout: 120000, // 2 minutes timeout
    });
    
    console.log('\n✅ All tests passed!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    validationPassed = false;
    return false;
  } finally {
    // Change back to root directory
    process.chdir('..');
  }
}

function validateTypeScript() {
  try {
    console.log('\n🔍 TypeScript Validation...\n');
    
    // Change to client directory
    process.chdir('client');
    
    // Run TypeScript compiler
    execSync('npx tsc --noEmit', {
      stdio: 'inherit',
      timeout: 60000, // 1 minute timeout
    });
    
    console.log('\n✅ TypeScript validation passed!\n');
    return true;
  } catch (error) {
    console.error('\n❌ TypeScript validation failed:', error.message);
    validationPassed = false;
    return false;
  } finally {
    // Change back to root directory
    process.chdir('..');
  }
}

function validateLinting() {
  try {
    console.log('\n🔍 ESLint Validation...\n');
    
    // Change to client directory
    process.chdir('client');
    
    // Run ESLint
    execSync('npx eslint src --ext .ts,.tsx', {
      stdio: 'inherit',
      timeout: 60000, // 1 minute timeout
    });
    
    console.log('\n✅ Linting validation passed!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Linting validation failed:', error.message);
    validationPassed = false;
    return false;
  } finally {
    // Change back to root directory
    process.chdir('..');
  }
}

function validateBuild() {
  try {
    console.log('\n🏗️ Build Validation...\n');
    
    // Change to client directory
    process.chdir('client');
    
    // Run build
    execSync('npm run build', {
      stdio: 'inherit',
      timeout: 180000, // 3 minutes timeout
    });
    
    console.log('\n✅ Build validation passed!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Build validation failed:', error.message);
    validationPassed = false;
    return false;
  } finally {
    // Change back to root directory
    process.chdir('..');
  }
}

function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 3: UI Enhancement',
    status: validationPassed ? 'PASSED' : 'FAILED',
    files: {
      total: REQUIRED_FILES.length,
      validated: REQUIRED_FILES.filter(file => {
        const fullPath = path.join(process.cwd(), file);
        return fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0;
      }).length,
    },
    dependencies: {
      total: REQUIRED_DEPENDENCIES.length,
      validated: REQUIRED_DEPENDENCIES.filter(dep => {
        try {
          const packageJsonPath = path.join(process.cwd(), 'client', 'package.json');
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          return !!dependencies[dep];
        } catch {
          return false;
        }
      }).length,
    },
  };
  
  const reportPath = path.join(process.cwd(), 'phase3-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📊 Validation report saved to: ${reportPath}`);
  return report;
}

// Main validation process
async function main() {
  try {
    console.log('1️⃣ Validating Required Files...\n');
    REQUIRED_FILES.forEach(validateFile);
    
    console.log('\n2️⃣ Validating Dependencies...\n');
    REQUIRED_DEPENDENCIES.forEach(validateDependency);
    
    console.log('\n3️⃣ Validating TypeScript...');
    validateTypeScript();
    
    console.log('\n4️⃣ Validating ESLint...');
    validateLinting();
    
    console.log('\n5️⃣ Running Tests...');
    runTests();
    
    console.log('\n6️⃣ Validating Build...');
    validateBuild();
    
    const report = generateReport();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Status: ${report.status}`);
    console.log(`Files: ${report.files.validated}/${report.files.total}`);
    console.log(`Dependencies: ${report.dependencies.validated}/${report.dependencies.total}`);
    console.log('='.repeat(50));
    
    if (validationPassed) {
      console.log('\n🎉 Phase 3 validation completed successfully!');
      console.log('✨ All UI enhancements are properly implemented and tested.');
      process.exit(0);
    } else {
      console.log('\n❌ Phase 3 validation failed!');
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
