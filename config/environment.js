/**
 * Environment Configuration Module
 * Comprehensive configuration management with validation and defaults
 * Phase 1: Foundation & Infrastructure Setup
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

class EnvironmentConfig {
  constructor() {
    this.config = {};
    this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load all configuration from environment variables with defaults
   */
  loadConfiguration() {
    // Application Configuration
    this.config.app = {
      name: process.env.APP_NAME || 'fund-management-chatbot',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT) || 5000,
      host: process.env.HOST || 'localhost'
    };

    // Logging Configuration
    this.config.logging = {
      level: process.env.LOG_LEVEL || 'info',
      logQueries: process.env.LOG_QUERIES === 'true',
      enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
      logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
    };

    // Database Configuration
    this.config.database = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      name: process.env.DB_NAME || 'fund_chatbot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      
      // Connection Pool
      poolSize: parseInt(process.env.DB_POOL_SIZE) || 20,
      poolMin: parseInt(process.env.DB_POOL_MIN) || 2,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
      
      // SSL Configuration
      ssl: process.env.DB_SSL === 'true',
      sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      sslCA: process.env.DB_SSL_CA,
      sslCert: process.env.DB_SSL_CERT,
      sslKey: process.env.DB_SSL_KEY,
      
      applicationName: process.env.DB_APPLICATION_NAME || 'fund-chatbot'
    };
    
    // Add database URL for services that expect it
    const { host, port, name, user, password } = this.config.database;
    this.config.database.url = `postgresql://${user}:${password}@${host}:${port}/${name}`;

    // OpenAI Configuration
    this.config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION,
      project: process.env.OPENAI_PROJECT,
      
      // Models
      chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
      
      // Generation Parameters
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
      topP: parseFloat(process.env.OPENAI_TOP_P) || 1.0,
      frequencyPenalty: parseFloat(process.env.OPENAI_FREQUENCY_PENALTY) || 0.0,
      presencePenalty: parseFloat(process.env.OPENAI_PRESENCE_PENALTY) || 0.0,
      
      // Rate Limiting and Retry
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.OPENAI_RETRY_DELAY) || 1000,
      requestTimeout: parseInt(process.env.OPENAI_REQUEST_TIMEOUT) || 30000,
      maxRequestsPerMinute: parseInt(process.env.OPENAI_MAX_REQUESTS_PER_MINUTE) || 60
    };

    // Vector Database Configuration
    this.config.vector = {
      dimension: parseInt(process.env.VECTOR_DIMENSION) || 3072, // ✅ FIXED - Matches text-embedding-3-large
      similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.5,
      maxRetrievedChunks: parseInt(process.env.MAX_RETRIEVED_CHUNKS) || 5,
      similarityMetric: process.env.SIMILARITY_METRIC || 'cosine'
    };

    // Advanced Document Processing Configuration
    this.config.advancedProcessing = {
      hierarchicalChunking: {
        enabled: process.env.ENABLE_HIERARCHICAL_CHUNKING !== 'false',
        scales: {
          document: { 
            maxTokens: parseInt(process.env.DOC_CHUNK_MAX_TOKENS) || 8000, 
            minTokens: parseInt(process.env.DOC_CHUNK_MIN_TOKENS) || 4000 
          },
          section: { 
            maxTokens: parseInt(process.env.SECTION_CHUNK_MAX_TOKENS) || 2000, 
            minTokens: parseInt(process.env.SECTION_CHUNK_MIN_TOKENS) || 500 
          },
          paragraph: { 
            maxTokens: parseInt(process.env.PARA_CHUNK_MAX_TOKENS) || 500, 
            minTokens: parseInt(process.env.PARA_CHUNK_MIN_TOKENS) || 100 
          },
          sentence: { 
            maxTokens: parseInt(process.env.SENT_CHUNK_MAX_TOKENS) || 150, 
            minTokens: parseInt(process.env.SENT_CHUNK_MIN_TOKENS) || 20 
          }
        },
        semanticCoherence: {
          enableSemanticBoundaryDetection: process.env.ENABLE_SEMANTIC_BOUNDARIES !== 'false',
          sentenceSimilarityThreshold: parseFloat(process.env.SENTENCE_SIMILARITY_THRESHOLD) || 0.7
        },
        contextPreservation: {
          hierarchicalOverlap: process.env.ENABLE_HIERARCHICAL_OVERLAP !== 'false',
          parentChildRelationships: process.env.ENABLE_PARENT_CHILD_RELATIONSHIPS !== 'false',
          narrativeFlowPreservation: process.env.ENABLE_NARRATIVE_FLOW !== 'false'
        }
      },
      
      multiScaleEmbeddings: {
        enabled: process.env.ENABLE_MULTI_SCALE_EMBEDDINGS !== 'false',
        embeddingTypes: (process.env.EMBEDDING_TYPES || 'content,contextual,hierarchical,semantic').split(','),
        domainOptimization: {
          enabled: process.env.ENABLE_DOMAIN_OPTIMIZATION !== 'false',
          domain: process.env.DOMAIN || 'fundManagement',
          keywordBoost: parseFloat(process.env.KEYWORD_BOOST) || 1.2
        },
        qualityValidation: {
          enabled: process.env.ENABLE_EMBEDDING_QUALITY_VALIDATION !== 'false',
          minQualityScore: parseFloat(process.env.MIN_EMBEDDING_QUALITY) || 0.6
        },
        embeddingCache: {
          enabled: process.env.ENABLE_EMBEDDING_CACHE !== 'false',
          maxSize: parseInt(process.env.EMBEDDING_CACHE_SIZE) || 1000
        }
      },
      
      advancedRetrieval: {
        enabled: process.env.ENABLE_ADVANCED_RETRIEVAL !== 'false',
        strategies: (process.env.RETRIEVAL_STRATEGIES || 'vector_only,hybrid,multi_scale,contextual').split(','),
        contextExpansion: {
          hierarchicalExpansion: process.env.ENABLE_HIERARCHICAL_EXPANSION !== 'false',
          semanticExpansion: process.env.ENABLE_SEMANTIC_EXPANSION !== 'false',
          temporalExpansion: process.env.ENABLE_TEMPORAL_EXPANSION !== 'false'
        },
        lostInMiddleMitigation: {
          enabled: process.env.ENABLE_LOST_IN_MIDDLE_MITIGATION !== 'false',
          reorderingStrategy: process.env.REORDERING_STRATEGY || 'relevance_based',
          chunkInterleaving: process.env.ENABLE_CHUNK_INTERLEAVING !== 'false'
        },
        qualityOptimization: {
          coherenceScoring: process.env.ENABLE_COHERENCE_SCORING !== 'false',
          redundancyReduction: process.env.ENABLE_REDUNDANCY_REDUCTION !== 'false',
          complementarityMaximization: process.env.ENABLE_COMPLEMENTARITY_MAXIMIZATION !== 'false'
        }
      },
      
      qualityThresholds: {
        minChunkQuality: parseFloat(process.env.MIN_CHUNK_QUALITY) || 0.4,
        minEmbeddingQuality: parseFloat(process.env.MIN_EMBEDDING_QUALITY) || 0.6,
        minOverallQuality: parseFloat(process.env.MIN_OVERALL_QUALITY) || 0.5
      },
      
      batchProcessing: {
        enabled: process.env.ENABLE_BATCH_PROCESSING !== 'false',
        batchSize: parseInt(process.env.BATCH_SIZE) || 5,
        parallelProcessing: process.env.ENABLE_PARALLEL_PROCESSING !== 'false'
      }
    };

    // Embedding Configuration
    this.config.embedding = {
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 100,
      cacheTTL: parseInt(process.env.EMBEDDING_CACHE_TTL) || 86400,
      enableCache: process.env.ENABLE_EMBEDDING_CACHE !== 'false'
    };

    // Document Processing Configuration
    this.config.documentProcessing = {
      pdf: {
        maxFileSize: this.parseSize(process.env.PDF_MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
        processingTimeout: parseInt(process.env.PDF_PROCESSING_TIMEOUT) || 300000,
        enableOCR: process.env.ENABLE_OCR === 'true',
        ocrLanguage: process.env.OCR_LANGUAGE || 'eng'
      },
      
      chunking: {
        chunkSize: parseInt(process.env.CHUNK_SIZE) || 450,
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50,
        minChunkSize: parseInt(process.env.MIN_CHUNK_SIZE) || 100,
        maxChunkSize: parseInt(process.env.MAX_CHUNK_SIZE) || 600,
        preserveStructure: process.env.PRESERVE_STRUCTURE !== 'false',
        chunkStrategy: process.env.CHUNK_STRATEGY || 'semantic'
      },
      
      filtering: {
        enableContentFiltering: process.env.ENABLE_CONTENT_FILTERING !== 'false',
        minQualityScore: parseFloat(process.env.MIN_QUALITY_SCORE) || 0.3,
        filterEmptyChunks: process.env.FILTER_EMPTY_CHUNKS !== 'false',
        filterDuplicateChunks: process.env.FILTER_DUPLICATE_CHUNKS !== 'false'
      }
    };

    // RAG System Configuration
    this.config.rag = {
      retrieval: {
        topK: parseInt(process.env.RETRIEVAL_TOP_K) || 10,
        rerank: process.env.RETRIEVAL_RERANK !== 'false',
        diversityThreshold: parseFloat(process.env.RETRIEVAL_DIVERSITY_THRESHOLD) || 0.8,
        enableHybridSearch: process.env.ENABLE_HYBRID_SEARCH !== 'false'
      },
      
      response: {
        maxTokens: parseInt(process.env.RESPONSE_MAX_TOKENS) || 1000,
        temperature: parseFloat(process.env.RESPONSE_TEMPERATURE) || 0.3,
        confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.6,
        enableCitationValidation: process.env.ENABLE_CITATION_VALIDATION !== 'false'
      },
      
      prompt: {
        templateVersion: process.env.PROMPT_TEMPLATE_VERSION || '1.0',
        systemPromptMaxLength: parseInt(process.env.SYSTEM_PROMPT_MAX_LENGTH) || 4000,
        contextWindowSize: parseInt(process.env.CONTEXT_WINDOW_SIZE) || 8000
      }
    };

    // Compliance and Audit Configuration
    this.config.compliance = {
      audit: {
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
        auditLogLevel: process.env.AUDIT_LOG_LEVEL || 'info',
        auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 365,
        logPIIRedaction: process.env.LOG_PII_REDACTION !== 'false'
      },
      
      retention: {
        conversationRetentionDays: parseInt(process.env.CONVERSATION_RETENTION_DAYS) || 90,
        feedbackRetentionDays: parseInt(process.env.FEEDBACK_RETENTION_DAYS) || 730,
        auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 365
      },
      
      privacy: {
        enablePIIDetection: process.env.ENABLE_PII_DETECTION !== 'false',
        piiRedactionChar: process.env.PII_REDACTION_CHAR || '*',
        hashIPAddresses: process.env.HASH_IP_ADDRESSES !== 'false',
        anonymizeUserData: process.env.ANONYMIZE_USER_DATA !== 'false'
      }
    };

    // Security Configuration
    this.config.security = {
      api: {
        rateLimit: parseInt(process.env.API_RATE_LIMIT) || 100,
        rateWindow: parseInt(process.env.API_RATE_WINDOW) || 900000, // 15 minutes
        enableCORS: process.env.ENABLE_CORS !== 'false',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        enableHelmet: process.env.ENABLE_HELMET !== 'false'
      },
      
      session: {
        secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
        timeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour
        enableRotation: process.env.ENABLE_SESSION_ROTATION !== 'false'
      },
      
      auth: {
        jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
        jwtExpiration: process.env.JWT_EXPIRATION || '24h',
        adminUsername: process.env.ADMIN_USERNAME || 'admin',
        adminPassword: process.env.ADMIN_PASSWORD || 'admin123'
      }
    };

    // Performance Configuration
    this.config.performance = {
      cache: {
        enableRedisCache: process.env.ENABLE_REDIS_CACHE === 'true',
        redisHost: process.env.REDIS_HOST || 'localhost',
        redisPort: parseInt(process.env.REDIS_PORT) || 6379,
        redisPassword: process.env.REDIS_PASSWORD,
        redisDB: parseInt(process.env.REDIS_DB) || 0,
        cacheTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 3600
      },
      
      optimization: {
        responseTimeout: parseInt(process.env.RESPONSE_TIMEOUT_MS) || 30000,
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 50,
        enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
        compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6
      },
      
      memory: {
        maxMemoryUsage: this.parseSize(process.env.MAX_MEMORY_USAGE) || 1024 * 1024 * 1024, // 1GB
        garbageCollectionInterval: parseInt(process.env.GARBAGE_COLLECTION_INTERVAL) || 300000
      }
    };

    // Monitoring Configuration
    this.config.monitoring = {
      healthCheck: {
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        enableEndpoint: process.env.ENABLE_HEALTH_ENDPOINT !== 'false',
        timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
      },
      
      metrics: {
        enable: process.env.ENABLE_METRICS !== 'false',
        port: parseInt(process.env.METRICS_PORT) || 9090,
        endpoint: process.env.METRICS_ENDPOINT || '/metrics'
      },
      
      errorTracking: {
        enable: process.env.ENABLE_ERROR_TRACKING !== 'false',
        service: process.env.ERROR_TRACKING_SERVICE || 'console',
        sentryDSN: process.env.SENTRY_DSN
      }
    };

    // Development Configuration
    this.config.development = {
      enableHotReload: process.env.ENABLE_HOT_RELOAD === 'true',
      enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true',
      mockOpenAIResponses: process.env.MOCK_OPENAI_RESPONSES === 'true',
      skipAuthentication: process.env.SKIP_AUTHENTICATION === 'true',
      
      testing: {
        testDatabaseURL: process.env.TEST_DATABASE_URL,
        enableTestData: process.env.ENABLE_TEST_DATA === 'true',
        testDataSeed: parseInt(process.env.TEST_DATA_SEED) || 12345
      }
    };

    // Feature Flags
    this.config.features = {
      experimental: {
        enableVoiceInput: process.env.ENABLE_VOICE_INPUT === 'true',
        enableMultiLanguage: process.env.ENABLE_MULTI_LANGUAGE === 'true',
        enableAdvancedAnalytics: process.env.ENABLE_ADVANCED_ANALYTICS === 'true',
        enableABTesting: process.env.ENABLE_A_B_TESTING === 'true'
      },
      
      beta: {
        enableFineTuning: process.env.ENABLE_FINE_TUNING === 'true',
        enableCustomModels: process.env.ENABLE_CUSTOM_MODELS === 'true',
        enableExternalIntegrations: process.env.ENABLE_EXTERNAL_INTEGRATIONS === 'true'
      }
    };

    // External Services Configuration
    this.config.external = {
      email: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT) || 587,
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@fundchatbot.com'
      },
      
      storage: {
        type: process.env.STORAGE_TYPE || 'local',
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1',
          s3Bucket: process.env.AWS_S3_BUCKET
        }
      },
      
      webhook: {
        secret: process.env.WEBHOOK_SECRET,
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000
      }
    };

    // Backup Configuration
    this.config.backup = {
      enableAutoBackup: process.env.ENABLE_AUTO_BACKUP === 'true',
      schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
      location: process.env.BACKUP_LOCATION || './backups',
      
      export: {
        enableDataExport: process.env.ENABLE_DATA_EXPORT !== 'false',
        format: process.env.EXPORT_FORMAT || 'json',
        maxSize: this.parseSize(process.env.MAX_EXPORT_SIZE) || 100 * 1024 * 1024 // 100MB
      }
    };
  }

  /**
   * Parse size strings like "50MB", "1GB" to bytes
   */
  parseSize(sizeStr) {
    if (!sizeStr) return null;
    
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    const match = sizeStr.toString().toUpperCase().match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/);
    if (!match) return null;
    
    const [, size, unit] = match;
    return parseFloat(size) * (units[unit] || 1);
  }

  /**
   * Validate configuration values
   */
  validateConfiguration() {
    const errors = [];
    const warnings = [];

    // ✅ CRITICAL: Required environment variables
    const criticalVars = [
      { key: 'DB_HOST', config: 'database.host', message: 'Database host is required' },
      { key: 'DB_NAME', config: 'database.name', message: 'Database name is required' },
      { key: 'DB_USER', config: 'database.user', message: 'Database user is required' }
    ];

    // Add OpenAI API key requirement only for production or if not placeholder
    const apiKey = this.get('openai.apiKey');
    if (this.config.app.environment === 'production' || (apiKey && apiKey !== 'your_openai_api_key_here' && apiKey.length >= 10)) {
      criticalVars.push({ key: 'OPENAI_API_KEY', config: 'openai.apiKey', message: 'OpenAI API key is required for embeddings and chat' });
    } else if (this.config.app.environment === 'development') {
      warnings.push('OpenAI API key not configured - AI features will be disabled in development mode');
    }

    criticalVars.forEach(({ key, config, message }) => {
      const value = this.get(config);
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${key}: ${message}`);
      }
    });

    // ✅ PRODUCTION: Required in production only
    if (this.config.app.environment === 'production') {
      const productionRequired = [
        { key: 'DB_PASSWORD', config: 'database.password', message: 'Database password is required in production' },
        { key: 'SESSION_SECRET', config: 'security.session.secret', message: 'Session secret must be changed in production' },
        { key: 'JWT_SECRET', config: 'security.auth.jwtSecret', message: 'JWT secret must be changed in production' }
      ];

      productionRequired.forEach(({ key, config, message }) => {
        const value = this.get(config);
        if (!value || value === 'default-session-secret-change-in-production' || value === 'default-jwt-secret-change-in-production') {
          errors.push(`${key}: ${message}`);
        }
      });

      // Check for default passwords
      if (this.config.security.auth.adminPassword === 'admin123') {
        errors.push('ADMIN_PASSWORD: Default password must be changed in production');
      }
    }

    // ✅ NUMERIC: Validate numeric ranges
    const numericValidations = [
      { key: 'DB_PORT', value: this.config.database.port, min: 1, max: 65535 },
      { key: 'PORT', value: this.config.app.port, min: 1, max: 65535 },
      { key: 'VECTOR_DIMENSION', value: this.config.vector.dimension, min: 1, max: 10000 },
      { key: 'SIMILARITY_THRESHOLD', value: this.config.vector.similarityThreshold, min: 0, max: 1 },
      { key: 'CHUNK_SIZE', value: this.config.documentProcessing.chunking.chunkSize, min: 50, max: 2000 },
      { key: 'DB_POOL_SIZE', value: this.config.database.poolSize, min: 1, max: 100 }
    ];

    numericValidations.forEach(({ key, value, min, max }) => {
      if (isNaN(value) || value < min || value > max) {
        errors.push(`${key}: Must be a number between ${min} and ${max}, got: ${value}`);
      }
    });

    // ✅ CONSISTENCY: Cross-validation checks
    if (this.config.documentProcessing.chunking.chunkOverlap >= this.config.documentProcessing.chunking.chunkSize) {
      errors.push('CHUNK_OVERLAP: Must be less than CHUNK_SIZE');
    }

    // ✅ MODEL CONSISTENCY: Validate embedding model and dimensions
    const embeddingModel = this.config.openai.embeddingModel;
    const expectedDimensions = {
      'text-embedding-3-large': 3072,
      'text-embedding-3-small': 1536,
      'text-embedding-ada-002': 1536
    };

    const expectedDim = expectedDimensions[embeddingModel];
    if (expectedDim && this.config.vector.dimension !== expectedDim) {
      errors.push(
        `VECTOR_DIMENSION: Model ${embeddingModel} requires ${expectedDim} dimensions, ` +
        `but VECTOR_DIMENSION is set to ${this.config.vector.dimension}`
      );
    }

    // ✅ FILE SYSTEM: Validate file paths and permissions
    const pathValidations = [
      { path: path.dirname(this.config.logging.logFilePath), purpose: 'log directory' },
      { path: this.config.backup.location, purpose: 'backup directory', createIfMissing: true }
    ];

    pathValidations.forEach(({ path: dirPath, purpose, createIfMissing }) => {
      try {
        if (!fs.existsSync(dirPath)) {
          if (createIfMissing) {
            fs.mkdirSync(dirPath, { recursive: true });
            warnings.push(`Created missing ${purpose}: ${dirPath}`);
          } else {
            errors.push(`${purpose} does not exist: ${dirPath}`);
          }
        } else {
          // Check write permissions
          fs.accessSync(dirPath, fs.constants.W_OK);
        }
      } catch (error) {
        errors.push(`Cannot access ${purpose} (${dirPath}): ${error.message}`);
      }
    });

    // ✅ OPENAI API KEY FORMAT: Basic format validation
    if (this.config.openai.apiKey) {
      if (!this.config.openai.apiKey.startsWith('sk-')) {
        warnings.push('OPENAI_API_KEY: API key should start with "sk-"');
      }
      if (this.config.openai.apiKey.length < 40) {
        warnings.push('OPENAI_API_KEY: API key seems too short');
      }
    }

    // ✅ SECURITY: Check for insecure configurations
    if (this.config.app.environment === 'production') {
      if (!this.config.database.ssl) {
        warnings.push('DB_SSL: Consider enabling SSL in production');
      }
      if (this.config.security.api.corsOrigin === '*') {
        warnings.push('CORS_ORIGIN: Wildcard CORS origin is not recommended in production');
      }
    }

    // ✅ REPORT RESULTS
    if (warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      throw new Error(errorMessage);
    }

    console.log('✅ Configuration validation passed');
  }

  /**
   * Get configuration value by path (e.g., 'database.host')
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }

  /**
   * Check if we're in development mode
   */
  isDevelopment() {
    return this.config.app.environment === 'development';
  }

  /**
   * Check if we're in production mode
   */
  isProduction() {
    return this.config.app.environment === 'production';
  }

  /**
   * Check if we're in test mode
   */
  isTest() {
    return this.config.app.environment === 'test';
  }

  /**
   * Get database connection URL
   */
  getDatabaseURL() {
    const { host, port, name, user, password } = this.config.database;
    return `postgresql://${user}:${password}@${host}:${port}/${name}`;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Get configuration summary for logging (without sensitive data)
   */
  getSummary() {
    const summary = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive information
    if (summary.database) {
      summary.database.password = '***';
    }
    if (summary.openai) {
      summary.openai.apiKey = summary.openai.apiKey ? '***' : null;
    }
    if (summary.security) {
      summary.security.session.secret = '***';
      summary.security.auth.jwtSecret = '***';
      summary.security.auth.adminPassword = '***';
    }
    if (summary.external && summary.external.email) {
      summary.external.email.smtpPassword = summary.external.email.smtpPassword ? '***' : null;
    }
    
    return summary;
  }

  /**
   * Validate environment file exists and load it
   */
  static loadEnvironmentFile() {
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      console.warn('⚠️ .env file not found. Using environment variables and defaults.');
      return false;
    }
    
    try {
      require('dotenv').config({ path: envPath });
      console.log('✅ Environment file loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load environment file:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let configInstance = null;

/**
 * Get configuration instance (singleton pattern)
 */
function getConfig() {
  if (!configInstance) {
    try {
      configInstance = new EnvironmentConfig();
    } catch (error) {
      // In test environment, provide a minimal fallback configuration
      if (process.env.NODE_ENV === 'test') {
        console.warn('Using fallback test configuration');
        configInstance = {
          get: (path) => {
            const testConfig = {
              'database.host': 'localhost',
              'database.port': 5432,
              'database.name': 'test_fund_chatbot',
              'database.user': 'test_user',
              'database.password': 'test_password',
              'openai.apiKey': 'test-key-12345-development',
              'openai.chatModel': 'gpt-4',
              'openai.embeddingModel': 'text-embedding-3-large',
            };
            return testConfig[path];
          },
          database: {
            url: 'postgresql://test_user:test_password@localhost:5432/test_fund_chatbot',
            host: 'localhost',
            port: 5432,
            name: 'test_fund_chatbot',
            user: 'test_user',
            password: 'test_password',
          },
          audit: {
            encryptionKey: 'test-encryption-key',
            retentionDays: 365,
            ipSalt: 'test-ip-salt',
          },
          openai: {
            apiKey: 'test-key-12345-development',
            chatModel: 'gpt-4',
            embeddingModel: 'text-embedding-3-large',
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
          encryption: {
            keyDirectory: './keys',
            algorithm: 'aes-256-gcm',
            keyRotationDays: 90,
          },
          rbac: {
            defaultAdminPassword: 'admin123!@#',
            sessionTimeout: 3600000, // 1 hour
            maxLoginAttempts: 5,
          },
        };
      } else {
        throw error;
      }
    }
  }
  return configInstance;
}

/**
 * Initialize configuration
 */
function initializeConfig() {
  EnvironmentConfig.loadEnvironmentFile();
  const config = getConfig();
  
  console.log('🔧 Configuration initialized successfully');
  console.log(`📍 Environment: ${config.get('app.environment')}`);
  console.log(`🚀 Application: ${config.get('app.name')} v${config.get('app.version')}`);
  console.log(`🔌 Database: ${config.get('database.host')}:${config.get('database.port')}/${config.get('database.name')}`);
  console.log(`🤖 OpenAI Model: ${config.get('openai.chatModel')}`);
  console.log(`📊 Vector Dimension: ${config.get('vector.dimension')}`);
  
  return config;
}

module.exports = {
  EnvironmentConfig,
  getConfig,
  initializeConfig
};
