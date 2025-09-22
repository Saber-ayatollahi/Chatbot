/**
 * Database Configuration Module
 * Comprehensive PostgreSQL connection management with pgvector support
 * Phase 1: Foundation & Infrastructure Setup
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class DatabaseConfig {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.retryDelay = 5000; // 5 seconds
    
    // Statistics tracking
    this.connectionErrors = 0;
    this.queryErrors = 0;
    this.slowQueries = 0;
    this.totalQueries = 0;
    
    // Pool statistics object for health check
    this.poolStats = {
      totalQueries: 0,
      totalErrors: 0,
      slowQueries: 0,
      connectionErrors: 0
    };
    
    // ✅ ENHANCED: Advanced database configuration with test environment support
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || (process.env.NODE_ENV === 'test' ? 'fund_chatbot' : 'fund_chatbot'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : '',
      
      // ✅ ENHANCED: Connection pool settings
      max: parseInt(process.env.DB_POOL_SIZE) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
      
      // ✅ NEW: Advanced pool settings
      maxUses: parseInt(process.env.DB_MAX_USES) || 7500, // Close connections after N uses
      allowExitOnIdle: process.env.DB_ALLOW_EXIT_ON_IDLE !== 'false',
      keepAlive: process.env.DB_KEEP_ALIVE !== 'false',
      keepAliveInitialDelayMillis: parseInt(process.env.DB_KEEP_ALIVE_DELAY) || 0,
      
      // ✅ ENHANCED: SSL configuration
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ca: process.env.DB_SSL_CA ? fs.readFileSync(process.env.DB_SSL_CA) : undefined,
        cert: process.env.DB_SSL_CERT ? fs.readFileSync(process.env.DB_SSL_CERT) : undefined,
        key: process.env.DB_SSL_KEY ? fs.readFileSync(process.env.DB_SSL_KEY) : undefined,
        // ✅ NEW: Additional SSL options
        servername: process.env.DB_SSL_SERVERNAME,
        checkServerIdentity: process.env.DB_SSL_CHECK_IDENTITY !== 'false'
      } : false,
      
      // ✅ ENHANCED: Application identification
      application_name: process.env.DB_APPLICATION_NAME || `fund-chatbot-${process.pid}`,
      
      // ✅ NEW: Query and statement timeouts
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
      idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT) || 60000,
      
      // ✅ NEW: Connection-level settings
      options: process.env.DB_OPTIONS || '-c statement_timeout=30s -c lock_timeout=10s'
    };
    
    // ✅ NEW: Connection pool monitoring
    this.poolStats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      totalErrors: 0,
      slowQueries: 0,
      lastError: null,
      lastSlowQuery: null,
      startTime: new Date()
    };
    
    // ✅ NEW: Prepared statement cache
    this.preparedStatements = new Map();
    this.queryCache = new Map();
    
    // ✅ NEW: Performance monitoring
    this.monitoringInterval = null;
    
    this.validateConfig();
  }

  /**
   * Validate database configuration
   */
  validateConfig() {
    const required = ['host', 'port', 'database', 'user'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
    }
    
    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error('Database port must be between 1 and 65535');
    }
    
    if (this.config.max < 1 || this.config.max > 100) {
      throw new Error('Database pool size must be between 1 and 100');
    }
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      console.log('🔌 Initializing database connection...');
      console.log(`📍 Connecting to: ${this.config.host}:${this.config.port}/${this.config.database}`);
      
      this.pool = new Pool(this.config);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Test connection
      await this.testConnection();
      
      // Verify pgvector extension
      await this.verifyExtensions();
      
      this.isConnected = true;
      console.log('✅ Database connection established successfully');
      
      return this.pool;
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      await this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Set up connection pool event handlers
   */
  setupEventHandlers() {
    // ✅ ENHANCED: Connection lifecycle management
    this.pool.on('connect', (client) => {
      this.poolStats.totalConnections++;
      console.log(`🔗 New database client connected (total: ${this.poolStats.totalConnections})`);
      
      // ✅ ENHANCED: Set comprehensive session parameters
      const sessionConfig = `
        SET search_path TO public;
        SET statement_timeout TO ${this.config.statement_timeout};
        SET lock_timeout TO 10000;
        SET idle_in_transaction_session_timeout TO ${this.config.idle_in_transaction_session_timeout};
        SET log_statement TO 'none';
        SET log_min_duration_statement TO ${process.env.LOG_SLOW_QUERIES_MS || 1000};
        SET work_mem TO '${process.env.DB_WORK_MEM || '4MB'}';
        SET maintenance_work_mem TO '${process.env.DB_MAINTENANCE_WORK_MEM || '64MB'}';
        SET effective_cache_size TO '${process.env.DB_EFFECTIVE_CACHE_SIZE || '1GB'}';
        SET random_page_cost TO ${process.env.DB_RANDOM_PAGE_COST || '1.1'};
      `;
      
      client.query(sessionConfig).catch(err => {
        console.error('❌ Failed to set session parameters:', err.message);
        this.poolStats.totalErrors++;
        this.poolStats.lastError = { message: err.message, timestamp: new Date() };
      });

      // ✅ NEW: Client-specific error handling
      client.on('error', (err) => {
        console.error('💥 Database client error:', err.message);
        this.poolStats.totalErrors++;
        this.poolStats.lastError = { message: err.message, timestamp: new Date() };
      });

      // ✅ NEW: Track connection end
      client.on('end', () => {
        this.poolStats.totalConnections--;
        if (process.env.NODE_ENV !== 'test') {
          console.log(`🔌 Database client disconnected (remaining: ${this.poolStats.totalConnections})`);
        }
      });
    });

    this.pool.on('acquire', (client) => {
      this.poolStats.activeConnections++;
      // Only log in development to avoid spam
      if (process.env.NODE_ENV === 'development' && process.env.LOG_POOL_EVENTS === 'true') {
        console.log(`📤 Client acquired (active: ${this.poolStats.activeConnections})`);
      }
    });

    this.pool.on('release', (client) => {
      this.poolStats.activeConnections--;
      this.poolStats.idleConnections++;
      if (process.env.NODE_ENV === 'development' && process.env.LOG_POOL_EVENTS === 'true') {
        console.log(`📥 Client released (idle: ${this.poolStats.idleConnections})`);
      }
    });

    this.pool.on('remove', (client) => {
      this.poolStats.idleConnections--;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`🗑️ Client removed from pool (idle: ${this.poolStats.idleConnections})`);
      }
    });

    // ✅ ENHANCED: Pool-level error handling with recovery
    this.pool.on('error', (err, client) => {
      console.error('💥 Unexpected database pool error:', err.message);
      this.poolStats.totalErrors++;
      this.poolStats.lastError = { message: err.message, timestamp: new Date() };
      
      // ✅ NEW: Automatic recovery for specific errors
      this.handlePoolError(err);
    });

    // ✅ NEW: Monitor pool health
    this.startPoolMonitoring();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
      console.log('🕐 Database time:', result.rows[0].current_time);
      console.log('🐘 PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
      
      // Test basic functionality
      await client.query('SELECT 1 as test');
      console.log('✅ Database connection test passed');
    } finally {
      client.release();
    }
  }

  /**
   * Verify required extensions are installed
   */
  async verifyExtensions() {
    const client = await this.pool.connect();
    try {
      // Check for pgvector extension
      const vectorResult = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as has_vector
      `);
      
      if (!vectorResult.rows[0].has_vector) {
        console.log('⚠️ pgvector extension not found - continuing without vector support');
        // Skip vector extension for now
        return;
      }
      
      // Check for other required extensions
      const extensionsResult = await client.query(`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm')
        ORDER BY extname
      `);
      
      console.log('📦 Installed extensions:');
      extensionsResult.rows.forEach(row => {
        console.log(`  - ${row.extname} v${row.extversion}`);
      });
      
      // Test vector operations
      await client.query('SELECT vector_dims(\'[1,2,3]\'::vector) as dims');
      console.log('✅ Vector extension is working correctly');
      
    } finally {
      client.release();
    }
  }

  /**
   * Handle connection errors with retry logic
   */
  async handleConnectionError(error) {
    this.isConnected = false;
    this.connectionErrors++;
    this.connectionAttempts++;
    
    if (this.connectionAttempts < this.maxConnectionAttempts) {
      console.log(`🔄 Retrying connection (${this.connectionAttempts}/${this.maxConnectionAttempts}) in ${this.retryDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      
      try {
        return await this.initialize();
      } catch (retryError) {
        return await this.handleConnectionError(retryError);
      }
    } else {
      console.error('💀 Maximum connection attempts reached. Database unavailable.');
      throw new Error(`Database connection failed after ${this.maxConnectionAttempts} attempts: ${error.message}`);
    }
  }

  /**
   * Handle pool errors
   */
  async handlePoolError(error) {
    console.error('🚨 Database pool error detected:', error.message);
    
    // Attempt to reconnect if connection is lost
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.log('🔄 Attempting to reconnect to database...');
      this.isConnected = false;
      
      try {
        await this.close();
        await this.initialize();
      } catch (reconnectError) {
        console.error('❌ Failed to reconnect to database:', reconnectError.message);
      }
    }
  }

  /**
   * Execute a query with error handling and logging
   */
  async query(text, params = [], options = {}) {
    const startTime = Date.now();
    const queryId = this.generateQueryId(text, params);
    
    // ✅ NEW: Query options
    const {
      timeout = this.config.query_timeout,
      prepared = false,
      cache = false,
      cacheKey = null,
      cacheTTL = 300000 // 5 minutes
    } = options;

    let client;
    
    try {
      // ✅ NEW: Check cache first if enabled
      if (cache && cacheKey) {
        const cached = await this.getCachedQuery(cacheKey);
        if (cached) {
          console.log(`⚡ Cache hit for query: ${cacheKey}`);
          return cached;
        }
      }

      client = await this.pool.connect();
      this.poolStats.totalQueries++;

      // ✅ ENHANCED: Query logging with better formatting
      if (process.env.NODE_ENV === 'development' && process.env.LOG_QUERIES === 'true') {
        const truncatedQuery = text.length > 100 ? text.substring(0, 100) + '...' : text;
        console.log(`🔍 Executing query [${queryId}]:`, truncatedQuery);
        if (params && params.length > 0) {
          console.log(`📋 Parameters [${queryId}]:`, this.sanitizeParams(params));
        }
      }

      // ✅ NEW: Prepared statement handling
      let result;
      if (prepared && this.preparedStatements.has(text)) {
        const preparedName = this.preparedStatements.get(text);
        result = await client.query({ name: preparedName, values: params });
      } else if (prepared) {
        const preparedName = `prepared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await client.query({ name: preparedName, text: text });
        this.preparedStatements.set(text, preparedName);
        result = await client.query({ name: preparedName, values: params });
      } else {
        // ✅ ENHANCED: Regular query with timeout
        const queryPromise = client.query(text, params || []);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
        );
        
        result = await Promise.race([queryPromise, timeoutPromise]);
      }

      const duration = Date.now() - startTime;

      // ✅ ENHANCED: Performance monitoring
      if (duration > (parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000)) {
        this.poolStats.slowQueries++;
        this.poolStats.lastSlowQuery = {
          query: text.substring(0, 200),
          duration,
          timestamp: new Date(),
          params: this.sanitizeParams(params)
        };
        console.warn(`🐌 Slow query detected [${queryId}] (${duration}ms):`, text.substring(0, 100));
      }

      // ✅ NEW: Cache result if enabled
      if (cache && cacheKey && result.rows.length > 0) {
        await this.setCachedQuery(cacheKey, result, cacheTTL);
      }

      // ✅ ENHANCED: Success logging
      if (process.env.LOG_QUERY_PERFORMANCE === 'true') {
        console.log(`✅ Query completed [${queryId}] in ${duration}ms (${result.rows.length} rows)`);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.poolStats.totalErrors++;
      this.poolStats.lastError = { 
        message: error.message, 
        query: text.substring(0, 200),
        duration,
        timestamp: new Date() 
      };

      console.error(`❌ Query failed [${queryId}] after ${duration}ms:`, error.message);
      console.error(`📝 Query:`, text.substring(0, 200));
      if (params && params.length > 0) {
        console.error(`📋 Parameters:`, this.sanitizeParams(params));
      }

      // ✅ NEW: Error classification and handling
      if (error.code === '57014') { // Query timeout
        console.error('⏱️ Query timeout - consider optimizing or increasing timeout');
      } else if (error.code === '40001') { // Serialization failure
        console.error('🔄 Serialization failure - consider retrying transaction');
      } else if (error.code === '23505') { // Unique violation
        console.error('🔑 Unique constraint violation');
      }

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // ✅ NEW: Helper methods
  generateQueryId(text, params) {
    const hash = require('crypto').createHash('md5');
    hash.update(text + JSON.stringify(params));
    return hash.digest('hex').substring(0, 8);
  }

  sanitizeParams(params) {
    if (!params || !Array.isArray(params)) return [];
    return params.map(param => {
      if (typeof param === 'string' && param.length > 50) {
        return param.substring(0, 50) + '...';
      }
      return param;
    });
  }

  async getCachedQuery(cacheKey) {
    // ✅ NEW: Simple in-memory cache implementation
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    return null;
  }

  async setCachedQuery(cacheKey, result, ttl) {
    // ✅ NEW: Simple in-memory cache implementation
    this.queryCache.set(cacheKey, {
      result: JSON.parse(JSON.stringify(result)), // Deep copy
      timestamp: Date.now(),
      ttl: ttl
    });
    
    // ✅ NEW: Clean up old cache entries
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('🔄 Transaction started');
      
      // Create a wrapper that provides the same interface as this.db
      const transactionWrapper = {
        query: async (text, params = []) => {
          // Only pass params if they exist to match test expectations
          if (params && params.length > 0) {
            return await client.query(text, params || []);
          } else {
            return await client.query(text);
          }
        },
        // Add other methods that might be needed
        transaction: () => {
          throw new Error('Nested transactions not supported');
        }
      };
      
      const result = await callback(transactionWrapper);
      
      await client.query('COMMIT');
      console.log('✅ Transaction committed');
      
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
        console.error('🔙 Transaction rolled back:', error.message);
      } catch (rollbackError) {
        console.error('⚠️ Rollback failed:', rollbackError.message);
        console.error('🔙 Original error:', error.message);
        // Still throw the original error, not the rollback error
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return {
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
        maxSize: this.config?.max || 20,
        minSize: this.config?.min || 2,
        connectionErrors: 0,
        queryErrors: 0,
        slowQueries: 0,
        totalQueries: 0,
        timestamp: new Date()
      };
    }
    
    return {
      totalCount: this.pool.totalCount || 0,
      idleCount: this.pool.idleCount || 0,
      waitingCount: this.pool.waitingCount || 0,
      maxSize: this.config?.max || 20,
      minSize: this.config?.min || 2,
      connectionErrors: this.connectionErrors || 0,
      queryErrors: this.queryErrors || 0,
      slowQueries: this.slowQueries || 0,
      totalQueries: this.totalQueries || 0,
      timestamp: new Date()
    };
  }

  /**
   * Health check for the database connection
   */
  async healthCheck() {
    try {
      if (!this.isConnected || !this.pool) {
        return {
          status: 'unhealthy',
          message: 'Database not connected',
          timestamp: new Date().toISOString()
        };
      }

      const start = Date.now();
      await this.query('SELECT 1');
      const responseTime = Date.now() - start;

      const stats = this.getDetailedPoolStats();

      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime: `${responseTime}ms`,
        poolStats: stats,
        performance: {
          totalQueries: this.poolStats.totalQueries,
          totalErrors: this.poolStats.totalErrors,
          slowQueries: this.poolStats.slowQueries,
          errorRate: `${((this.poolStats.totalErrors / Math.max(this.poolStats.totalQueries, 1)) * 100).toFixed(2)}%`,
          slowQueryRate: `${((this.poolStats.slowQueries / Math.max(this.poolStats.totalQueries, 1)) * 100).toFixed(2)}%`
        },
        lastError: this.poolStats.lastError,
        lastSlowQuery: this.poolStats.lastSlowQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const stats = this.getDetailedPoolStats(); // Still get pool stats even on error
      
      return {
        status: 'unhealthy',
        message: error.message,
        responseTime: 'N/A',
        poolStats: stats,
        performance: {
          totalQueries: this.poolStats.totalQueries,
          totalErrors: this.poolStats.totalErrors,
          slowQueries: this.poolStats.slowQueries,
          errorRate: `${((this.poolStats.totalErrors / Math.max(this.poolStats.totalQueries, 1)) * 100).toFixed(2)}%`,
          slowQueryRate: `${((this.poolStats.slowQueries / Math.max(this.poolStats.totalQueries, 1)) * 100).toFixed(2)}%`
        },
        lastError: this.poolStats.lastError,
        lastSlowQuery: this.poolStats.lastSlowQuery,
        timestamp: new Date().toISOString()
      };
    }
  }

  getDetailedPoolStats() {
    if (!this.pool) {
      return {
        total: 0,
        idle: 0,
        waiting: 0,
        active: 0,
        maxSize: this.config?.max || 20,
        minSize: this.config?.min || 2,
        utilization: '0.0%',
        status: 'disconnected'
      };
    }

    return {
      total: this.pool.totalCount || 0,
      idle: this.pool.idleCount || 0,
      waiting: this.pool.waitingCount || 0,
      active: (this.pool.totalCount || 0) - (this.pool.idleCount || 0),
      maxSize: this.config.max,
      minSize: this.config.min,
      utilization: `${(((this.pool.totalCount || 0) / this.config.max) * 100).toFixed(1)}%`,
      status: 'connected'
    };
  }

  // ✅ NEW: Pool monitoring methods
  startPoolMonitoring() {
    // Skip monitoring during tests to avoid interference
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // ✅ NEW: Regular health checks
    const monitoringInterval = parseInt(process.env.DB_MONITORING_INTERVAL) || 30000; // 30 seconds
    
    this.monitoringInterval = setInterval(() => {
      this.updatePoolStats();
      this.checkPoolHealth();
    }, monitoringInterval);

    console.log(`📊 Database pool monitoring started (interval: ${monitoringInterval}ms)`);
  }

  updatePoolStats() {
    if (!this.pool) return;

    this.poolStats = {
      ...this.poolStats,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxSize: this.config.max,
      minSize: this.config.min,
      lastUpdate: new Date()
    };
  }

  checkPoolHealth() {
    const stats = this.poolStats;
    const warnings = [];

    // ✅ Check for pool exhaustion
    if (stats.waitingCount > 0) {
      warnings.push(`${stats.waitingCount} clients waiting for connections`);
    }

    // ✅ Check for high error rate
    const errorRate = stats.totalErrors / Math.max(stats.totalQueries, 1);
    if (errorRate > 0.05) { // 5% error rate
      warnings.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    // ✅ Check for too many slow queries
    const slowQueryRate = stats.slowQueries / Math.max(stats.totalQueries, 1);
    if (slowQueryRate > 0.1) { // 10% slow queries
      warnings.push(`High slow query rate: ${(slowQueryRate * 100).toFixed(2)}%`);
    }

    // ✅ Check for pool size issues
    if (stats.totalCount >= stats.maxSize * 0.9) {
      warnings.push(`Pool near capacity: ${stats.totalCount}/${stats.maxSize}`);
    }

    if (warnings.length > 0) {
      console.warn('⚠️ Database pool health warnings:', warnings);
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema() {
    try {
      console.log('🏗️ Initializing database schema...');
      
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }
      
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.transaction(async (db) => {
        // Split schema into individual statements
        const statements = schema
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📄 Executing ${statements.length} schema statements...`);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement) {
            try {
              await db.query(statement);
              console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
            } catch (error) {
              // Ignore "already exists" errors for idempotent operations
              if (!error.message.includes('already exists')) {
                console.error(`❌ Statement ${i + 1} failed:`, error.message);
                throw error;
              } else {
                console.log(`⚠️ Statement ${i + 1} skipped (already exists)`);
              }
            }
          }
        }
      });
      
      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Schema initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('📊 Database monitoring stopped');
    }

    if (this.pool) {
      console.log('🔌 Closing database connection pool...');
      
      // Clear caches
      this.preparedStatements.clear();
      this.queryCache.clear();
      
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('✅ Database connection pool closed');
    }
  }

  /**
   * Get database connection instance
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Check if database is connected
   */
  isReady() {
    return this.isConnected && this.pool !== null;
  }
}

// Singleton instance
let dbInstance = null;

/**
 * Get database instance (singleton pattern)
 */
function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseConfig();
  }
  return dbInstance;
}

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  const db = getDatabase();
  await db.initialize();
  return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  DatabaseConfig,
  getDatabase,
  initializeDatabase,
  closeDatabase
};
