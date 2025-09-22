#!/usr/bin/env node

/**
 * Phase 1 Task 1.5: Advanced Testing Framework Setup
 * 
 * This script sets up a comprehensive testing framework with:
 * - Unit testing with Jest
 * - Integration testing
 * - Performance testing
 * - Quality assurance automation
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

class AdvancedTestingFrameworkSetup {
  constructor() {
    this.testingConfig = {
      jest: {
        testEnvironment: 'node',
        collectCoverage: true,
        coverageThreshold: {
          global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
          }
        },
        testMatch: [
          '**/tests/**/*.test.js',
          '**/tests/**/*.spec.js'
        ],
        setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
        collectCoverageFrom: [
          'services/**/*.js',
          'knowledge/**/*.js',
          'utils/**/*.js',
          '!**/node_modules/**',
          '!**/tests/**'
        ]
      },
      performance: {
        loadTesting: {
          tool: 'artillery',
          scenarios: ['basic_load', 'stress_test', 'spike_test']
        },
        benchmarking: {
          tool: 'benchmark.js',
          metrics: ['throughput', 'latency', 'memory']
        }
      },
      quality: {
        linting: {
          tool: 'eslint',
          extends: ['eslint:recommended', 'node']
        },
        formatting: {
          tool: 'prettier',
          config: {
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            trailingComma: 'es5'
          }
        },
        security: {
          tool: 'audit',
          level: 'moderate'
        }
      }
    };
  }

  async setupFramework() {
    logger.info('🧪 Setting up advanced testing framework...');
    
    try {
      // Create test directories
      await this.createTestDirectories();
      
      // Setup Jest configuration
      await this.setupJestConfig();
      
      // Create test setup files
      await this.createTestSetupFiles();
      
      // Setup performance testing
      await this.setupPerformanceTesting();
      
      // Setup quality assurance tools
      await this.setupQualityAssurance();
      
      // Create sample tests
      await this.createSampleTests();
      
      // Update package.json scripts
      await this.updatePackageScripts();
      
      logger.info('✅ Advanced testing framework setup completed successfully');
      
    } catch (error) {
      logger.error('❌ Failed to setup testing framework:', error);
      throw error;
    }
  }

  async createTestDirectories() {
    logger.info('📁 Creating test directory structure...');
    
    const directories = [
      'tests',
      'tests/unit',
      'tests/integration',
      'tests/performance',
      'tests/fixtures',
      'tests/mocks',
      'tests/utils'
    ];
    
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }
  }

  async setupJestConfig() {
    logger.info('⚙️ Setting up Jest configuration...');
    
    const jestConfig = {
      ...this.testingConfig.jest,
      verbose: true,
      forceExit: true,
      detectOpenHandles: true,
      testTimeout: 30000,
      maxWorkers: '50%'
    };
    
    await fs.writeFile(
      'jest.config.js',
      `module.exports = ${JSON.stringify(jestConfig, null, 2)};`
    );
    
    logger.info('✅ Jest configuration created');
  }

  async createTestSetupFiles() {
    logger.info('🔧 Creating test setup files...');
    
    // Main test setup file
    const setupContent = `
// Global test setup
const logger = require('../utils/logger');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateTestData: (type, count = 1) => {
    const generators = {
      chunk: () => ({
        id: \`test-chunk-\${Date.now()}-\${Math.random()}\`,
        content: 'This is test chunk content for testing purposes.',
        metadata: { source: 'test', type: 'test' },
        embedding: new Array(3072).fill(0).map(() => Math.random())
      }),
      
      document: () => ({
        id: \`test-doc-\${Date.now()}-\${Math.random()}\`,
        name: 'test-document.pdf',
        content: 'This is test document content for testing purposes.',
        metadata: { pages: 10, size: 1024 }
      }),
      
      query: () => ({
        text: 'What is the test query about?',
        context: { sessionId: 'test-session' },
        options: { maxResults: 10 }
      })
    };
    
    if (count === 1) {
      return generators[type]();
    }
    
    return Array.from({ length: count }, () => generators[type]());
  },
  
  mockDatabase: () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({}),
    end: jest.fn().mockResolvedValue({})
  }),
  
  mockOpenAI: () => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(3072).fill(0).map(() => Math.random()) }]
      })
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }
    }
  })
};

// Global test hooks
beforeAll(async () => {
  logger.info('🧪 Starting test suite');
});

afterAll(async () => {
  logger.info('✅ Test suite completed');
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});
`;
    
    await fs.writeFile('tests/setup.js', setupContent);
    
    // Test utilities file
    const utilsContent = `
const { performance } = require('perf_hooks');

class TestUtils {
  static async measurePerformance(fn, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      total: times.reduce((sum, time) => sum + time, 0),
      iterations: iterations
    };
  }
  
  static createMockChunk(overrides = {}) {
    return {
      id: \`chunk-\${Date.now()}\`,
      content: 'Test chunk content',
      metadata: { source: 'test' },
      embedding: new Array(3072).fill(0).map(() => Math.random()),
      ...overrides
    };
  }
  
  static createMockDocument(overrides = {}) {
    return {
      id: \`doc-\${Date.now()}\`,
      name: 'test.pdf',
      content: 'Test document content',
      metadata: { pages: 1 },
      ...overrides
    };
  }
  
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(\`Condition not met within \${timeout}ms\`);
  }
}

module.exports = TestUtils;
`;
    
    await fs.writeFile('tests/utils/TestUtils.js', utilsContent);
    
    logger.info('✅ Test setup files created');
  }

  async setupPerformanceTesting() {
    logger.info('⚡ Setting up performance testing...');
    
    // Artillery configuration for load testing
    const artilleryConfig = {
      config: {
        target: 'http://localhost:5000',
        phases: [
          { duration: 60, arrivalRate: 5, name: 'Warm up' },
          { duration: 120, arrivalRate: 10, name: 'Ramp up load' },
          { duration: 300, arrivalRate: 20, name: 'Sustained load' }
        ],
        defaults: {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      },
      scenarios: [
        {
          name: 'Health Check',
          weight: 30,
          flow: [
            { get: { url: '/api/chat/health' } }
          ]
        },
        {
          name: 'Chat Query',
          weight: 50,
          flow: [
            {
              post: {
                url: '/api/chat',
                json: {
                  message: 'What is the fund performance?',
                  sessionId: '{{ $randomString() }}'
                }
              }
            }
          ]
        },
        {
          name: 'Document Upload',
          weight: 20,
          flow: [
            {
              post: {
                url: '/api/documents/upload',
                formData: {
                  file: 'tests/fixtures/sample-document.pdf'
                }
              }
            }
          ]
        }
      ]
    };
    
    await fs.writeFile('tests/performance/artillery-config.yml', 
      `# Artillery Load Testing Configuration\n${JSON.stringify(artilleryConfig, null, 2)}`
    );
    
    // Performance benchmark tests
    const benchmarkContent = `
const Benchmark = require('benchmark');
const TestUtils = require('../utils/TestUtils');

describe('Performance Benchmarks', () => {
  test('Document Processing Benchmark', async () => {
    const suite = new Benchmark.Suite();
    
    // Mock document processing function
    const processDocument = async () => {
      await TestUtils.delay(Math.random() * 100 + 50);
      return { chunks: 10, quality: 0.8 };
    };
    
    const results = await TestUtils.measurePerformance(processDocument, 100);
    
    expect(results.average).toBeLessThan(200); // Should be under 200ms
    expect(results.iterations).toBe(100);
    
    console.log('Document Processing Benchmark:', results);
  });
  
  test('Retrieval Performance Benchmark', async () => {
    const retrieveChunks = async () => {
      await TestUtils.delay(Math.random() * 50 + 25);
      return { results: 5, relevance: 0.9 };
    };
    
    const results = await TestUtils.measurePerformance(retrieveChunks, 100);
    
    expect(results.average).toBeLessThan(100); // Should be under 100ms
    
    console.log('Retrieval Performance Benchmark:', results);
  });
});
`;
    
    await fs.writeFile('tests/performance/benchmark.test.js', benchmarkContent);
    
    logger.info('✅ Performance testing setup completed');
  }

  async setupQualityAssurance() {
    logger.info('🔍 Setting up quality assurance tools...');
    
    // ESLint configuration
    const eslintConfig = {
      env: {
        node: true,
        es2021: true,
        jest: true
      },
      extends: [
        'eslint:recommended'
      ],
      parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
      },
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'error',
        'no-undef': 'error',
        'prefer-const': 'error',
        'no-var': 'error'
      },
      ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'coverage/'
      ]
    };
    
    await fs.writeFile('.eslintrc.json', JSON.stringify(eslintConfig, null, 2));
    
    // Prettier configuration
    const prettierConfig = {
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 80,
      bracketSpacing: true,
      arrowParens: 'avoid'
    };
    
    await fs.writeFile('.prettierrc.json', JSON.stringify(prettierConfig, null, 2));
    
    // Prettier ignore file
    const prettierIgnore = `
node_modules/
dist/
build/
coverage/
*.min.js
*.bundle.js
`;
    
    await fs.writeFile('.prettierignore', prettierIgnore.trim());
    
    logger.info('✅ Quality assurance tools configured');
  }

  async createSampleTests() {
    logger.info('📝 Creating sample tests...');
    
    // Unit test example
    const unitTestContent = `
const TestUtils = require('../utils/TestUtils');

describe('Sample Unit Tests', () => {
  describe('TestUtils', () => {
    test('should create mock chunk with default values', () => {
      const chunk = TestUtils.createMockChunk();
      
      expect(chunk).toHaveProperty('id');
      expect(chunk).toHaveProperty('content');
      expect(chunk).toHaveProperty('metadata');
      expect(chunk).toHaveProperty('embedding');
      expect(chunk.embedding).toHaveLength(3072);
    });
    
    test('should create mock chunk with overrides', () => {
      const overrides = { content: 'Custom content' };
      const chunk = TestUtils.createMockChunk(overrides);
      
      expect(chunk.content).toBe('Custom content');
    });
    
    test('should measure performance correctly', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      };
      
      const results = await TestUtils.measurePerformance(testFunction, 5);
      
      expect(results.iterations).toBe(5);
      expect(results.average).toBeGreaterThan(8);
      expect(results.min).toBeGreaterThan(0);
      expect(results.max).toBeGreaterThan(results.min);
    });
  });
});
`;
    
    await fs.writeFile('tests/unit/sample.test.js', unitTestContent);
    
    // Integration test example
    const integrationTestContent = `
describe('Sample Integration Tests', () => {
  test('should test component integration', async () => {
    // Mock components
    const mockDatabase = global.testUtils.mockDatabase();
    const mockOpenAI = global.testUtils.mockOpenAI();
    
    // Test integration
    const result = await mockDatabase.query('SELECT * FROM test');
    expect(mockDatabase.query).toHaveBeenCalledWith('SELECT * FROM test');
    expect(result.rows).toEqual([]);
  });
  
  test('should handle error scenarios', async () => {
    const mockDatabase = global.testUtils.mockDatabase();
    mockDatabase.query.mockRejectedValue(new Error('Database error'));
    
    await expect(mockDatabase.query('INVALID SQL')).rejects.toThrow('Database error');
  });
});
`;
    
    await fs.writeFile('tests/integration/sample.test.js', integrationTestContent);
    
    // Create test fixtures
    const fixtureContent = `
{
  "sampleDocument": {
    "id": "test-doc-1",
    "name": "sample.pdf",
    "content": "This is a sample document for testing purposes.",
    "metadata": {
      "pages": 1,
      "size": 1024,
      "type": "pdf"
    }
  },
  "sampleChunks": [
    {
      "id": "chunk-1",
      "content": "First chunk of sample content.",
      "metadata": { "page": 1, "position": 0 }
    },
    {
      "id": "chunk-2", 
      "content": "Second chunk of sample content.",
      "metadata": { "page": 1, "position": 1 }
    }
  ],
  "sampleQueries": [
    "What is this document about?",
    "Summarize the main points",
    "What are the key findings?"
  ]
}
`;
    
    await fs.writeFile('tests/fixtures/sample-data.json', fixtureContent);
    
    logger.info('✅ Sample tests created');
  }

  async updatePackageScripts() {
    logger.info('📦 Updating package.json scripts...');
    
    try {
      const packagePath = 'package.json';
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      // Add testing scripts
      packageJson.scripts = {
        ...packageJson.scripts,
        'test': 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        'test:unit': 'jest tests/unit',
        'test:integration': 'jest tests/integration',
        'test:performance': 'jest tests/performance',
        'test:all': 'npm run lint && npm run test:coverage && npm run test:performance',
        'lint': 'eslint .',
        'lint:fix': 'eslint . --fix',
        'format': 'prettier --write .',
        'format:check': 'prettier --check .',
        'quality': 'npm run lint && npm run format:check',
        'load-test': 'artillery run tests/performance/artillery-config.yml',
        'security-audit': 'npm audit --audit-level moderate'
      };
      
      // Add dev dependencies if not present
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'jest': '^29.0.0',
        'eslint': '^8.0.0',
        'prettier': '^2.0.0',
        'artillery': '^2.0.0',
        'benchmark': '^2.1.4'
      };
      
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
      
      logger.info('✅ Package.json updated with testing scripts');
      
    } catch (error) {
      logger.warn('Could not update package.json:', error.message);
    }
  }

  async runInitialTests() {
    logger.info('🧪 Running initial test validation...');
    
    try {
      // Run sample tests to validate setup
      execSync('npm test -- tests/unit/sample.test.js', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      logger.info('✅ Initial tests passed successfully');
      
    } catch (error) {
      logger.warn('Initial tests failed (expected during setup):', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    logger.info('🚀 Starting Phase 1: Advanced Testing Framework Setup');
    
    const setup = new AdvancedTestingFrameworkSetup();
    await setup.setupFramework();
    
    logger.info('📊 TESTING FRAMEWORK SUMMARY');
    logger.info('============================');
    logger.info('✅ Jest configuration with 90% coverage threshold');
    logger.info('✅ Unit, integration, and performance test structure');
    logger.info('✅ ESLint and Prettier for code quality');
    logger.info('✅ Artillery for load testing');
    logger.info('✅ Sample tests and fixtures created');
    logger.info('✅ Package.json scripts updated');
    logger.info('============================');
    
    logger.info('🎯 Next steps:');
    logger.info('  - Run "npm install" to install dev dependencies');
    logger.info('  - Run "npm test" to execute tests');
    logger.info('  - Run "npm run lint" to check code quality');
    logger.info('  - Run "npm run load-test" for performance testing');
    
    logger.info('✅ Phase 1 Task 1.5 completed successfully!');
    
  } catch (error) {
    logger.error('❌ Phase 1 Task 1.5 failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { AdvancedTestingFrameworkSetup };
