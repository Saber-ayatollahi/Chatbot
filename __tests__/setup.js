/**
 * Jest Test Setup
 * Initializes configuration and mocks for all tests
 */

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'fund_chatbot'; // Use existing database with proper credentials
process.env.DB_USER = 'postgres';     // Use existing postgres user
process.env.DB_PASSWORD = '';         // Use existing password (empty for local dev)
process.env.OPENAI_API_KEY = 'test-key-12345-development';
process.env.MOCK_OPENAI_RESPONSES = 'true';

// Import and setup mocks before any other imports
const { mockDatabase } = require('./mocks/database');
const { mockOpenAI } = require('./mocks/openai');

// Setup comprehensive mocking
mockDatabase();
mockOpenAI();

// Mock logger to prevent console spam during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock pg module for database operations
jest.mock('pg', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
    end: jest.fn().mockResolvedValue()
  };
  
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: jest.fn().mockResolvedValue(),
    totalCount: 20,
    idleCount: 19,
    waitingCount: 0
  };
  
  return {
    Pool: jest.fn().mockImplementation(() => mockPool),
    Client: jest.fn().mockImplementation(() => mockClient)
  };
});

// Global test configuration
global.testConfig = {
  database: {
    url: 'postgresql://test_user:test_password@localhost:5432/test_fund_chatbot',
    host: 'localhost',
    port: 5432,
    name: 'test_fund_chatbot',
    user: 'test_user',
    password: 'test_password',
  },
  openai: {
    apiKey: 'test-key-12345-development',
    chatModel: 'gpt-4',
    embeddingModel: 'text-embedding-3-large',
  },
  audit: {
    encryptionKey: 'test-encryption-key',
    retentionDays: 365,
  },
  compliance: {
    enablePiiRedaction: true,
    audit: {
      encryptionKey: 'test-encryption-key',
    },
    retention: {
      auditRetentionDays: 365,
    },
  },
};

// Initialize configuration for tests
try {
  initializeConfig();
} catch (error) {
  // Ignore configuration errors in test environment
  console.warn('Test configuration initialization failed (expected):', error.message);
}
