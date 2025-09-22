/**
 * Comprehensive Environment Validation Script
 * Validates all critical system components before startup
 */

const { getConfig } = require('../config/environment');
const { getDatabase } = require('../config/database');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

class StartupValidator {
  constructor() {
    this.config = null;
    this.errors = [];
    this.warnings = [];
  }

  async validateComplete() {
    console.log('🔍 Running comprehensive startup validation...\n');

    try {
      // Step 1: Configuration validation
      await this.validateConfiguration();

      // Step 2: Database connectivity
      await this.validateDatabase();

      // Step 3: OpenAI API connectivity
      await this.validateOpenAI();

      // Step 4: File system permissions
      await this.validateFileSystem();

      // Step 5: Performance checks
      await this.validatePerformance();

      // Step 6: Security validation
      await this.validateSecurity();

      this.reportResults();

    } catch (error) {
      console.error('❌ Startup validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateConfiguration() {
    console.log('📋 Validating configuration...');
    try {
      this.config = getConfig(); // This will throw if validation fails
      console.log('✅ Configuration validation passed');
      
      // Additional configuration checks
      const criticalSettings = [
        { path: 'openai.embeddingModel', expected: 'text-embedding-3-large' },
        { path: 'vector.dimension', expected: 3072 },
        { path: 'database.poolSize', min: 10, max: 100 }
      ];

      criticalSettings.forEach(({ path, expected, min, max }) => {
        const value = this.config.get(path);
        if (expected && value !== expected) {
          this.warnings.push(`${path}: Expected ${expected}, got ${value}`);
        }
        if (min && value < min) {
          this.warnings.push(`${path}: Value ${value} below recommended minimum ${min}`);
        }
        if (max && value > max) {
          this.warnings.push(`${path}: Value ${value} above recommended maximum ${max}`);
        }
      });

      console.log('✅ Configuration validation completed\n');
    } catch (error) {
      this.errors.push(`Configuration: ${error.message}`);
      throw error;
    }
  }

  async validateDatabase() {
    console.log('🗄️ Validating database connection...');
    try {
      const db = getDatabase();
      await db.initialize();

      // Test basic operations
      const result = await db.query('SELECT NOW() as current_time, version() as postgres_version');
      const dbTime = result.rows[0].current_time;
      const dbVersion = result.rows[0].postgres_version.split(' ')[0];
      
      console.log(`✅ Database connected: ${dbTime}`);
      console.log(`✅ PostgreSQL version: ${dbVersion}`);

      // Test pgvector extension
      try {
        const vectorTest = await db.query('SELECT vector_dims(\'[1,2,3]\'::vector) as dims');
        console.log('✅ pgvector extension working');
        
        // Test vector operations with correct dimensions
        const expectedDim = this.config.get('vector.dimension');
        const testVector = new Array(expectedDim).fill(0.1);
        await db.query(`SELECT vector_dims('[${testVector.join(',')}]'::vector) as test_dims`);
        console.log(`✅ Vector operations working with ${expectedDim} dimensions`);
        
      } catch (vectorError) {
        this.warnings.push('pgvector extension not available - vector search disabled');
        console.warn('⚠️ pgvector extension not available');
      }

      // Test database schema
      try {
        const tables = await db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        
        const requiredTables = ['kb_chunks', 'kb_sources', 'conversations', 'feedback', 'audit_logs'];
        const existingTables = tables.rows.map(row => row.table_name);
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));
        
        if (missingTables.length > 0) {
          this.warnings.push(`Missing database tables: ${missingTables.join(', ')}`);
        } else {
          console.log(`✅ Database schema complete (${existingTables.length} tables)`);
        }
        
      } catch (schemaError) {
        this.warnings.push(`Database schema check failed: ${schemaError.message}`);
      }

      // Test connection pool
      const poolStats = db.getPoolStats();
      if (poolStats) {
        console.log(`✅ Connection pool: ${poolStats.totalCount}/${poolStats.maxSize} connections`);
      }

      await db.close();
      console.log('✅ Database validation passed\n');

    } catch (error) {
      this.errors.push(`Database: ${error.message}`);
      console.error(`❌ Database validation failed: ${error.message}\n`);
    }
  }

  async validateOpenAI() {
    console.log('🤖 Validating OpenAI API connection...');
    
    // Skip OpenAI validation in development mode if API key is placeholder
    const apiKey = this.config.get('openai.apiKey');
    const environment = this.config.get('app.environment');
    
    if (environment === 'development' && (apiKey === 'your_openai_api_key_here' || !apiKey || apiKey.length < 10)) {
      console.log('⚠️ Skipping OpenAI validation in development mode (placeholder API key)');
      this.warnings.push('OpenAI API key not configured - AI features will be disabled');
      return;
    }
    
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        timeout: 10000,
        maxRetries: 1
      });

      // Test embeddings API
      console.log('  Testing embeddings API...');
      const embeddingModel = this.config.get('openai.embeddingModel');
      const embeddingResponse = await openai.embeddings.create({
        model: embeddingModel,
        input: 'test validation query'
      });

      const actualDim = embeddingResponse.data[0].embedding.length;
      const expectedDim = this.config.get('vector.dimension');

      if (actualDim !== expectedDim) {
        this.errors.push(`Embedding dimension mismatch: expected ${expectedDim}, got ${actualDim}`);
      } else {
        console.log(`✅ Embeddings API working (${actualDim} dimensions)`);
      }

      // Test chat API
      console.log('  Testing chat API...');
      const chatModel = this.config.get('openai.chatModel');
      const chatResponse = await openai.chat.completions.create({
        model: chatModel,
        messages: [{ role: 'user', content: 'Hello, this is a test.' }],
        max_tokens: 10
      });

      if (chatResponse.choices && chatResponse.choices.length > 0) {
        console.log(`✅ Chat API working (${chatModel})`);
      }

      // Check API usage and limits
      if (embeddingResponse.usage) {
        console.log(`✅ API usage tracking: ${embeddingResponse.usage.total_tokens} tokens`);
      }

      console.log('✅ OpenAI validation passed\n');

    } catch (error) {
      this.errors.push(`OpenAI API: ${error.message}`);
      console.error(`❌ OpenAI validation failed: ${error.message}\n`);
    }
  }

  async validateFileSystem() {
    console.log('📁 Validating file system access...');
    try {
      const pathsToCheck = [
        { 
          path: path.dirname(this.config.get('logging.logFilePath')), 
          type: 'log directory',
          required: true
        },
        { 
          path: this.config.get('backup.location'), 
          type: 'backup directory',
          required: false
        },
        {
          path: './knowledge_base',
          type: 'knowledge base directory',
          required: false
        },
        {
          path: './database',
          type: 'database scripts directory',
          required: true
        }
      ];

      for (const { path: filePath, type, required } of pathsToCheck) {
        try {
          // Check if path exists
          if (!fs.existsSync(filePath)) {
            if (required) {
              // Try to create required directories
              fs.mkdirSync(filePath, { recursive: true });
              console.log(`✅ Created ${type}: ${filePath}`);
            } else {
              this.warnings.push(`${type} does not exist: ${filePath}`);
              continue;
            }
          }

          // Check permissions
          fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
          console.log(`✅ ${type} accessible: ${filePath}`);

          // Check disk space for critical directories
          if (required) {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              // Basic space check - this is a simple implementation
              // In production, you might want to use a more sophisticated disk space check
              console.log(`✅ ${type} is writable`);
            }
          }

        } catch (error) {
          if (required) {
            this.errors.push(`Cannot access required ${type} (${filePath}): ${error.message}`);
          } else {
            this.warnings.push(`Cannot access ${type} (${filePath}): ${error.message}`);
          }
        }
      }

      // Check specific files
      const filesToCheck = [
        { path: './database/schema.sql', required: true, type: 'database schema' },
        { path: './package.json', required: true, type: 'package configuration' },
        { path: './.env', required: false, type: 'environment file' }
      ];

      filesToCheck.forEach(({ path: filePath, required, type }) => {
        if (fs.existsSync(filePath)) {
          console.log(`✅ ${type} found: ${filePath}`);
        } else if (required) {
          this.errors.push(`Required ${type} missing: ${filePath}`);
        } else {
          this.warnings.push(`Optional ${type} missing: ${filePath}`);
        }
      });

      console.log('✅ File system validation completed\n');

    } catch (error) {
      this.errors.push(`File system: ${error.message}`);
      console.error(`❌ File system validation failed: ${error.message}\n`);
    }
  }

  async validatePerformance() {
    console.log('⚡ Running performance checks...');
    
    try {
      // Memory check
      const memoryUsage = process.memoryUsage();
      const heapMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      console.log(`📊 Memory usage: ${heapMB}MB heap, ${rssMB}MB RSS`);

      if (heapMB > 500) {
        this.warnings.push(`High memory usage at startup: ${heapMB}MB heap`);
      }

      if (rssMB > 1000) {
        this.warnings.push(`High RSS memory usage: ${rssMB}MB`);
      }

      // Node.js version check
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 18) {
        this.warnings.push(`Node.js version ${nodeVersion} is below recommended v18+`);
      } else {
        console.log(`✅ Node.js version: ${nodeVersion}`);
      }

      // Platform check
      console.log(`✅ Platform: ${process.platform} ${process.arch}`);

      // Environment check
      const environment = this.config.get('app.environment');
      console.log(`✅ Environment: ${environment}`);

      // CPU check
      const cpus = require('os').cpus();
      console.log(`✅ CPU cores: ${cpus.length}`);

      if (cpus.length < 2) {
        this.warnings.push('Single CPU core detected - performance may be limited');
      }

      // Timing check
      const start = process.hrtime.bigint();
      await new Promise(resolve => setTimeout(resolve, 10));
      const end = process.hrtime.bigint();
      const timingAccuracy = Number(end - start) / 1000000; // Convert to milliseconds

      if (timingAccuracy > 50) {
        this.warnings.push(`System timing inaccuracy detected: ${timingAccuracy.toFixed(2)}ms`);
      }

      console.log('✅ Performance checks completed\n');

    } catch (error) {
      this.warnings.push(`Performance check failed: ${error.message}`);
      console.warn(`⚠️ Performance validation warning: ${error.message}\n`);
    }
  }

  async validateSecurity() {
    console.log('🔒 Running security checks...');
    
    try {
      // Environment security
      const environment = this.config.get('app.environment');
      
      if (environment === 'production') {
        // Production security checks
        const securityChecks = [
          {
            check: () => this.config.get('security.session.secret') !== 'default-session-secret-change-in-production',
            message: 'Session secret must be changed in production'
          },
          {
            check: () => this.config.get('security.auth.jwtSecret') !== 'default-jwt-secret-change-in-production',
            message: 'JWT secret must be changed in production'
          },
          {
            check: () => this.config.get('security.auth.adminPassword') !== 'admin123',
            message: 'Admin password must be changed in production'
          },
          {
            check: () => this.config.get('database.ssl') === true,
            message: 'Database SSL should be enabled in production',
            warning: true
          }
        ];

        securityChecks.forEach(({ check, message, warning }) => {
          if (!check()) {
            if (warning) {
              this.warnings.push(`Security: ${message}`);
            } else {
              this.errors.push(`Security: ${message}`);
            }
          }
        });
      }

      // API key security
      const apiKey = this.config.get('openai.apiKey');
      if (apiKey) {
        if (apiKey.includes('your-api-key') || apiKey.includes('replace-me')) {
          this.errors.push('OpenAI API key appears to be a placeholder');
        }
        
        if (apiKey.length < 40) {
          this.warnings.push('OpenAI API key seems unusually short');
        }
      }

      // File permissions security
      try {
        const sensitiveFiles = ['.env', 'config/environment.js'];
        
        sensitiveFiles.forEach(file => {
          if (fs.existsSync(file)) {
            const stats = fs.statSync(file);
            const mode = (stats.mode & parseInt('777', 8)).toString(8);
            
            if (mode !== '600' && mode !== '644') {
              this.warnings.push(`File ${file} has permissive permissions: ${mode}`);
            }
          }
        });
      } catch (error) {
        this.warnings.push(`Could not check file permissions: ${error.message}`);
      }

      console.log('✅ Security checks completed\n');

    } catch (error) {
      this.warnings.push(`Security check failed: ${error.message}`);
      console.warn(`⚠️ Security validation warning: ${error.message}\n`);
    }
  }

  reportResults() {
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    // Configuration summary
    if (this.config) {
      console.log('\n🔧 Configuration Summary:');
      console.log(`  Environment: ${this.config.get('app.environment')}`);
      console.log(`  Application: ${this.config.get('app.name')} v${this.config.get('app.version')}`);
      console.log(`  Database: ${this.config.get('database.host')}:${this.config.get('database.port')}/${this.config.get('database.name')}`);
      console.log(`  OpenAI Model: ${this.config.get('openai.chatModel')}`);
      console.log(`  Embedding Model: ${this.config.get('openai.embeddingModel')}`);
      console.log(`  Vector Dimension: ${this.config.get('vector.dimension')}`);
      console.log(`  Pool Size: ${this.config.get('database.poolSize')}`);
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log('\n💀 Validation failed! Please fix the errors above.');
      process.exit(1);
    }

    console.log('\n✅ All validations passed! System ready for startup.');
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️ Note: ${this.warnings.length} warnings detected. Consider addressing them for optimal performance.`);
    }

    // Performance recommendations
    console.log('\n💡 Recommendations:');
    if (this.config) {
      const poolSize = this.config.get('database.poolSize');
      if (poolSize < 20) {
        console.log('  - Consider increasing DB_POOL_SIZE to 20+ for better performance');
      }
      
      const environment = this.config.get('app.environment');
      if (environment === 'development') {
        console.log('  - Set NODE_ENV=production for production deployment');
        console.log('  - Enable database SSL for production');
        console.log('  - Change default passwords and secrets');
      }
    }

    console.log('  - Monitor system performance after startup');
    console.log('  - Set up regular health checks');
    console.log('  - Configure log rotation');
    console.log('\n🚀 System validation complete!');
  }
}

// Export for use in other modules
module.exports = StartupValidator;

// Run validation if called directly
if (require.main === module) {
  const validator = new StartupValidator();
  validator.validateComplete().catch(error => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
}
