/**
 * Database Mock System
 * Provides comprehensive database mocking for all tests
 */

const { getMockResponse } = require('../fixtures/testData');

class MockDatabaseConfig {
  constructor() {
    this.isConnected = true;
    this.pool = new MockPool();
    this.config = {
      host: 'localhost',
      port: 5432,
      database: 'test_fund_chatbot',
      user: 'test_user',
      password: 'test_password',
      max: 20,
      min: 2,
    };
    
    // Add poolStats property for tests that access it directly
    this.poolStats = {
      totalQueries: 0,
      totalErrors: 0,
      slowQueries: 0,
      connectionErrors: 0,
      queryErrors: 0
    };
  }

  async initialize() {
    // Simulate connection failure for invalid configurations
    if (this.config.host === 'invalid-host-that-does-not-exist' || this.config.port === 9999) {
      this.isConnected = false;
      throw new Error('Database connection failed: ENOTFOUND invalid-host-that-does-not-exist');
    }
    
    this.isConnected = true;
    return Promise.resolve();
  }

  async close() {
    this.isConnected = false;
    return Promise.resolve();
  }

  async query(sql, params = []) {
    // Increment query statistics
    this.poolStats.totalQueries++;
    
    // Use centralized test data for consistent responses
    return getMockResponse(sql);
  }

  async transaction(callback) {
    const mockClient = {
      query: this.query.bind(this),
      release: jest.fn()
    };
    return await callback(mockClient);
  }

  async healthCheck() {
    // Check if this is configured with invalid settings (for error testing)
    if (this.config.host === 'invalid-host-that-does-not-exist' || this.config.port === 9999) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed: invalid configuration',
        responseTime: 'N/A',
        poolStats: {
          total: 0,
          idle: 0,
          waiting: 0,
          active: 0,
          maxSize: 20,
          minSize: 2,
          utilization: '0.0%',
          status: 'disconnected'
        },
        performance: {
          totalQueries: 0,
          totalErrors: 1,
          slowQueries: 0,
          errorRate: '100.00%',
          slowQueryRate: '0.00%'
        },
        lastError: { message: 'Connection failed', timestamp: new Date() },
        lastSlowQuery: null,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy',
      message: 'Mock database is healthy',
      responseTime: '5ms',
      poolStats: {
        total: 1,
        idle: 0,
        waiting: 0,
        active: 1,
        maxSize: 20,
        minSize: 2,
        utilization: '5.0%',
        status: 'connected'
      },
      performance: {
        totalQueries: 10,
        totalErrors: 0,
        slowQueries: 0,
        errorRate: '0.00%',
        slowQueryRate: '0.00%'
      },
      lastError: null,
      lastSlowQuery: null,
      timestamp: new Date().toISOString()
    };
  }

  isReady() {
    return this.isConnected;
  }

  getPoolStats() {
    return {
      totalCount: this.pool?.totalCount || 1,
      idleCount: this.pool?.idleCount || 1,
      waitingCount: this.pool?.waitingCount || 0,
      maxSize: this.config?.max || 20,
      minSize: this.config?.min || 2,
      connectionErrors: 0,
      queryErrors: 0,
      slowQueries: 0,
      totalQueries: 0,
      timestamp: new Date()
    };
  }

  sanitizeParams(params) {
    if (!Array.isArray(params)) return params;
    
    return params.map(param => {
      if (typeof param === 'string' && param.length >= 100) {
        return param.substring(0, 50) + '...';
      }
      return param;
    });
  }

  generateQueryId(text, params) {
    const hash = require('crypto').createHash('md5');
    hash.update(text + JSON.stringify(params || []));
    return hash.digest('hex').substring(0, 8);
  }

  updatePoolStats() {
    // Mock implementation - just update timestamp
    this.poolStats.timestamp = new Date();
  }

  checkPoolHealth() {
    return {
      status: 'healthy',
      message: 'Mock database pool is healthy',
      timestamp: new Date(),
      poolStats: this.getPoolStats()
    };
  }
}

class MockPool {
  constructor() {
    this.totalCount = 20;
    this.idleCount = 19;
    this.waitingCount = 0;
  }

  async connect() {
    return {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn()
    };
  }

  async query(sql, params) {
    const mockDb = new MockDatabaseConfig();
    return mockDb.query(sql, params);
  }

  async end() {
    return Promise.resolve();
  }
}

// Mock the database module for tests
const mockDatabase = () => {
  const mockDb = new MockDatabaseConfig();
  
  // Mock the DatabaseConfig class
  jest.doMock('../../config/database', () => ({
    DatabaseConfig: jest.fn().mockImplementation(() => mockDb)
  }));

  // Mock the getDatabase function
  jest.doMock('../../config/database', () => ({
    DatabaseConfig: jest.fn().mockImplementation(() => mockDb),
    getDatabase: jest.fn().mockReturnValue(mockDb)
  }));

  return mockDb;
};

module.exports = {
  MockDatabaseConfig,
  MockPool,
  mockDatabase
};
