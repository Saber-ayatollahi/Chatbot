
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
        id: `test-chunk-${Date.now()}-${Math.random()}`,
        content: 'This is test chunk content for testing purposes.',
        metadata: { source: 'test', type: 'test' },
        embedding: new Array(3072).fill(0).map(() => Math.random())
      }),
      
      document: () => ({
        id: `test-doc-${Date.now()}-${Math.random()}`,
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
