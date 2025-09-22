#!/usr/bin/env node

/**
 * Phase 5 Validation Script
 * Validates the compliance and audit system implementation
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');

class Phase5Validator {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: [],
    };
  }

  /**
   * Run complete Phase 5 validation
   */
  async run() {
    try {
      console.log('🔍 Phase 5 Validation - Compliance & Audit System');
      console.log('=' .repeat(60));

      // Core validation tests
      await this.validateDatabase();
      await this.validateServices();
      await this.validateEncryption();
      await this.validateAuditSystem();
      await this.validateRBAC();
      await this.validateDataLifecycle();
      await this.validateCompliance();
      await this.validateIntegration();
      await this.validateSecurity();
      await this.validatePerformance();

      // Print results
      this.printResults();

      return this.results.failed === 0;

    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      return false;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Validate database schema and tables
   */
  async validateDatabase() {
    console.log('\n📊 Validating Database Schema...');

    try {
      const client = await this.pool.connect();

      // Check required tables exist
      const requiredTables = [
        'users', 'roles', 'audit_logs', 'data_retention_policies',
        'user_sessions', 'compliance_violations', 'system_config'
      ];

      for (const table of requiredTables) {
        try {
          const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `, [table]);

          if (result.rows.length === 0) {
            this.addResult('fail', `Table ${table} does not exist`);
          } else {
            this.addResult('pass', `Table ${table} exists with ${result.rows.length} columns`);
          }
        } catch (error) {
          this.addResult('fail', `Failed to check table ${table}: ${error.message}`);
        }
      }

      // Check indexes exist
      const criticalIndexes = [
        'idx_audit_logs_session_id',
        'idx_audit_logs_created_at',
        'idx_user_sessions_user_id',
        'idx_compliance_violations_type',
      ];

      for (const index of criticalIndexes) {
        try {
          const result = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE indexname = $1
          `, [index]);

          if (result.rows.length > 0) {
            this.addResult('pass', `Index ${index} exists`);
          } else {
            this.addResult('warn', `Index ${index} missing - may impact performance`);
          }
        } catch (error) {
          this.addResult('warn', `Failed to check index ${index}: ${error.message}`);
        }
      }

      // Check data integrity
      try {
        // Check if roles are properly configured
        const roleCheck = await client.query('SELECT COUNT(*) as count FROM roles');
        const roleCount = parseInt(roleCheck.rows[0].count, 10);
        
        if (roleCount >= 5) {
          this.addResult('pass', `Found ${roleCount} roles configured`);
        } else {
          this.addResult('fail', `Only ${roleCount} roles found, expected at least 5`);
        }

        // Check retention policies
        const policyCheck = await client.query('SELECT COUNT(*) as count FROM data_retention_policies');
        const policyCount = parseInt(policyCheck.rows[0].count, 10);
        
        if (policyCount >= 3) {
          this.addResult('pass', `Found ${policyCount} retention policies`);
        } else {
          this.addResult('warn', `Only ${policyCount} retention policies found`);
        }

      } catch (error) {
        this.addResult('fail', `Data integrity check failed: ${error.message}`);
      }

      client.release();

    } catch (error) {
      this.addResult('fail', `Database validation failed: ${error.message}`);
    }
  }

  /**
   * Validate core services
   */
  async validateServices() {
    console.log('\n🔧 Validating Core Services...');

    const services = [
      { name: 'AuditLogger', path: '../services/AuditLogger' },
      { name: 'PIIDetector', path: '../services/PIIDetector' },
      { name: 'EncryptionManager', path: '../services/EncryptionManager' },
      { name: 'DataLifecycleManager', path: '../services/DataLifecycleManager' },
      { name: 'ComplianceReportGenerator', path: '../services/ComplianceReportGenerator' },
      { name: 'RBACManager', path: '../services/RBACManager' },
    ];

    for (const service of services) {
      try {
        const ServiceClass = require(service.path);
        const instance = new ServiceClass();
        
        // Check if service has required methods
        const requiredMethods = this.getRequiredMethods(service.name);
        const missingMethods = [];
        
        for (const method of requiredMethods) {
          if (typeof instance[method] !== 'function') {
            missingMethods.push(method);
          }
        }
        
        if (missingMethods.length === 0) {
          this.addResult('pass', `Service ${service.name} has all required methods`);
        } else {
          this.addResult('fail', `Service ${service.name} missing methods: ${missingMethods.join(', ')}`);
        }

        // Try to initialize service if it has an initialize method
        if (typeof instance.initialize === 'function') {
          try {
            await instance.initialize();
            this.addResult('pass', `Service ${service.name} initialized successfully`);
            
            // Clean up
            if (typeof instance.close === 'function') {
              await instance.close();
            }
          } catch (error) {
            this.addResult('fail', `Service ${service.name} initialization failed: ${error.message}`);
          }
        }

      } catch (error) {
        this.addResult('fail', `Failed to load service ${service.name}: ${error.message}`);
      }
    }
  }

  /**
   * Validate encryption system
   */
  async validateEncryption() {
    console.log('\n🔐 Validating Encryption System...');

    try {
      const EncryptionManager = require('../services/EncryptionManager');
      const encryptionManager = new EncryptionManager();
      
      await encryptionManager.initialize();
      
      // Check encryption stats
      const stats = encryptionManager.getEncryptionStats();
      
      if (stats.initialized) {
        this.addResult('pass', 'Encryption Manager initialized');
        
        const expectedKeys = ['master', 'audit', 'pii', 'session', 'metadata', 'rsa'];
        const actualKeys = Object.keys(stats.keys);
        
        for (const expectedKey of expectedKeys) {
          if (actualKeys.includes(expectedKey)) {
            this.addResult('pass', `Encryption key ${expectedKey} available`);
          } else {
            this.addResult('fail', `Encryption key ${expectedKey} missing`);
          }
        }
      } else {
        this.addResult('fail', 'Encryption Manager not initialized');
      }

      // Test encryption/decryption
      try {
        const testData = { test: 'encryption-validation', timestamp: new Date().toISOString() };
        const encrypted = encryptionManager.encrypt(testData, 'audit');
        const decrypted = encryptionManager.decrypt(encrypted, 'audit');
        
        if (JSON.stringify(testData) === JSON.stringify(decrypted)) {
          this.addResult('pass', 'Encryption/decryption test passed');
        } else {
          this.addResult('fail', 'Encryption/decryption test failed - data mismatch');
        }
      } catch (error) {
        this.addResult('fail', `Encryption/decryption test failed: ${error.message}`);
      }

      // Validate integrity
      try {
        const integrityResults = await encryptionManager.validateIntegrity();
        
        if (integrityResults.valid) {
          this.addResult('pass', `Encryption integrity validated - ${integrityResults.checks.length} checks passed`);
        } else {
          this.addResult('fail', `Encryption integrity failed: ${integrityResults.errors.join(', ')}`);
        }
      } catch (error) {
        this.addResult('fail', `Encryption integrity validation failed: ${error.message}`);
      }

      await encryptionManager.close();

    } catch (error) {
      this.addResult('fail', `Encryption validation failed: ${error.message}`);
    }
  }

  /**
   * Validate audit system
   */
  async validateAuditSystem() {
    console.log('\n📝 Validating Audit System...');

    try {
      const AuditLogger = require('../services/AuditLogger');
      const auditLogger = new AuditLogger();
      
      // Test audit logging
      const testInteraction = {
        sessionId: 'test-session-' + Date.now(),
        query: 'Test audit query',
        response: 'Test audit response',
        confidenceScore: 0.95,
        responseTime: 150,
        modelVersion: 'test-model',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        metadata: { test: true },
      };

      try {
        await auditLogger.logInteraction(testInteraction);
        this.addResult('pass', 'Audit logging test passed');

        // Try to retrieve the logged interaction
        const logs = await auditLogger.getAuditLogs(
          { sessionId: testInteraction.sessionId },
          { limit: 1, offset: 0 }
        );

        if (logs.length > 0) {
          this.addResult('pass', 'Audit log retrieval test passed');
        } else {
          this.addResult('fail', 'Audit log retrieval test failed - no logs found');
        }

      } catch (error) {
        this.addResult('fail', `Audit logging test failed: ${error.message}`);
      }

      // Test PII detection
      const PIIDetector = require('../services/PIIDetector');
      const piiDetector = new PIIDetector();
      
      const testPII = 'My email is john.doe@example.com and phone is 555-123-4567';
      const redacted = piiDetector.redact(testPII);
      
      if (redacted.includes('[REDACTED_PII]')) {
        this.addResult('pass', 'PII detection and redaction working');
      } else {
        this.addResult('fail', 'PII detection failed - no redaction occurred');
      }

    } catch (error) {
      this.addResult('fail', `Audit system validation failed: ${error.message}`);
    }
  }

  /**
   * Validate RBAC system
   */
  async validateRBAC() {
    console.log('\n👤 Validating RBAC System...');

    try {
      const RBACManager = require('../services/RBACManager');
      const rbacManager = new RBACManager();
      
      await rbacManager.initialize();

      // Check role hierarchy
      const roles = rbacManager.getAllRoles();
      const expectedRoles = ['super_admin', 'admin', 'compliance_officer', 'analyst', 'user'];
      
      for (const expectedRole of expectedRoles) {
        if (roles.includes(expectedRole)) {
          this.addResult('pass', `Role ${expectedRole} defined`);
        } else {
          this.addResult('fail', `Role ${expectedRole} missing`);
        }
      }

      // Check permissions
      const permissions = rbacManager.getAllPermissions();
      const criticalPermissions = [
        'system:manage', 'users:create', 'audit:read', 'data:delete', 'chat:use'
      ];
      
      for (const permission of criticalPermissions) {
        if (permissions.includes(permission)) {
          this.addResult('pass', `Permission ${permission} defined`);
        } else {
          this.addResult('fail', `Permission ${permission} missing`);
        }
      }

      // Test permission checking
      const testResult = rbacManager.roleHasPermission('admin', 'users:create');
      if (testResult) {
        this.addResult('pass', 'Permission checking works correctly');
      } else {
        this.addResult('fail', 'Permission checking failed');
      }

      await rbacManager.close();

    } catch (error) {
      this.addResult('fail', `RBAC validation failed: ${error.message}`);
    }
  }

  /**
   * Validate data lifecycle management
   */
  async validateDataLifecycle() {
    console.log('\n🗂️  Validating Data Lifecycle Management...');

    try {
      const DataLifecycleManager = require('../services/DataLifecycleManager');
      const lifecycleManager = new DataLifecycleManager();
      
      await lifecycleManager.initialize();

      // Get lifecycle stats
      const stats = await lifecycleManager.getLifecycleStats();
      
      if (stats.retentionPolicies && stats.retentionPolicies.length > 0) {
        this.addResult('pass', `Found ${stats.retentionPolicies.length} retention policies`);
      } else {
        this.addResult('fail', 'No retention policies found');
      }

      if (stats.scheduledJobs && stats.scheduledJobs.length > 0) {
        this.addResult('pass', `Found ${stats.scheduledJobs.length} scheduled jobs`);
      } else {
        this.addResult('warn', 'No scheduled jobs found');
      }

      // Test dry run cleanup
      try {
        const result = await lifecycleManager.manualCleanup('audit_logs', {
          retentionDays: 30,
          dryRun: true,
        });
        
        if (result.dryRun) {
          this.addResult('pass', `Dry run cleanup test passed - would delete ${result.recordsToDelete} records`);
        } else {
          this.addResult('fail', 'Dry run cleanup test failed');
        }
      } catch (error) {
        this.addResult('warn', `Dry run cleanup test failed: ${error.message}`);
      }

      await lifecycleManager.close();

    } catch (error) {
      this.addResult('fail', `Data lifecycle validation failed: ${error.message}`);
    }
  }

  /**
   * Validate compliance features
   */
  async validateCompliance() {
    console.log('\n⚖️  Validating Compliance Features...');

    try {
      // Check compliance middleware
      const ComplianceMiddleware = require('../middleware/complianceMiddleware');
      const middleware = new ComplianceMiddleware();
      
      await middleware.initialize();
      
      // Check middleware functions
      const middlewareFunctions = [
        'sessionTracking', 'auditLogging', 'piiProtection',
        'securityHeaders', 'createRateLimit', 'inputValidation'
      ];
      
      for (const func of middlewareFunctions) {
        if (typeof middleware[func] === 'function') {
          this.addResult('pass', `Compliance middleware ${func} available`);
        } else {
          this.addResult('fail', `Compliance middleware ${func} missing`);
        }
      }

      // Test compliance report generation
      const ComplianceReportGenerator = require('../services/ComplianceReportGenerator');
      const reportGenerator = new ComplianceReportGenerator();
      
      try {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() - 1); // Yesterday
        
        const reportPath = await reportGenerator.generateDailySummary(testDate);
        
        // Check if report file exists
        const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
        
        if (reportExists) {
          this.addResult('pass', 'Compliance report generation working');
        } else {
          this.addResult('fail', 'Compliance report generation failed - file not created');
        }
      } catch (error) {
        this.addResult('warn', `Compliance report test failed: ${error.message}`);
      }

      await middleware.close();

    } catch (error) {
      this.addResult('fail', `Compliance validation failed: ${error.message}`);
    }
  }

  /**
   * Validate system integration
   */
  async validateIntegration() {
    console.log('\n🔗 Validating System Integration...');

    try {
      // Check admin routes
      const AdminRoutes = require('../routes/admin');
      const adminRoutes = new AdminRoutes();
      
      await adminRoutes.initialize();
      
      const router = adminRoutes.getRouter();
      
      if (router && typeof router === 'function') {
        this.addResult('pass', 'Admin routes initialized successfully');
      } else {
        this.addResult('fail', 'Admin routes initialization failed');
      }

      // Check if all required files exist
      const requiredFiles = [
        'services/AuditLogger.js',
        'services/PIIDetector.js',
        'services/EncryptionManager.js',
        'services/DataLifecycleManager.js',
        'services/ComplianceReportGenerator.js',
        'services/RBACManager.js',
        'middleware/complianceMiddleware.js',
        'routes/admin.js',
        'database/audit_schema.sql',
      ];

      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(process.cwd(), file));
          this.addResult('pass', `Required file ${file} exists`);
        } catch (error) {
          this.addResult('fail', `Required file ${file} missing`);
        }
      }

    } catch (error) {
      this.addResult('fail', `Integration validation failed: ${error.message}`);
    }
  }

  /**
   * Validate security measures
   */
  async validateSecurity() {
    console.log('\n🔒 Validating Security Measures...');

    try {
      // Check directory permissions for sensitive folders
      const sensitiveDirs = ['keys', 'logs', 'backups'];
      
      for (const dir of sensitiveDirs) {
        try {
          const dirPath = path.join(process.cwd(), dir);
          const stats = await fs.stat(dirPath);
          
          if (stats.isDirectory()) {
            this.addResult('pass', `Sensitive directory ${dir} exists`);
          } else {
            this.addResult('warn', `${dir} exists but is not a directory`);
          }
        } catch (error) {
          if (error.code === 'ENOENT') {
            this.addResult('warn', `Sensitive directory ${dir} does not exist`);
          } else {
            this.addResult('fail', `Cannot access directory ${dir}: ${error.message}`);
          }
        }
      }

      // Check environment variables
      const criticalEnvVars = [
        'DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY'
      ];
      
      for (const envVar of criticalEnvVars) {
        if (process.env[envVar]) {
          this.addResult('pass', `Environment variable ${envVar} is set`);
        } else {
          this.addResult('fail', `Environment variable ${envVar} is missing`);
        }
      }

      // Check optional compliance environment variables
      const complianceEnvVars = [
        'ENABLE_PII_REDACTION', 'ENABLE_DATA_ENCRYPTION', 'ENABLE_AUDIT_LOGGING'
      ];
      
      for (const envVar of complianceEnvVars) {
        if (process.env[envVar]) {
          this.addResult('pass', `Compliance setting ${envVar} configured`);
        } else {
          this.addResult('warn', `Compliance setting ${envVar} not configured (using defaults)`);
        }
      }

    } catch (error) {
      this.addResult('fail', `Security validation failed: ${error.message}`);
    }
  }

  /**
   * Validate performance considerations
   */
  async validatePerformance() {
    console.log('\n⚡ Validating Performance Considerations...');

    try {
      const client = await this.pool.connect();

      // Check database indexes on critical tables
      const indexChecks = [
        { table: 'audit_logs', column: 'created_at' },
        { table: 'audit_logs', column: 'session_id' },
        { table: 'users', column: 'username' },
        { table: 'user_sessions', column: 'user_id' },
      ];

      for (const check of indexChecks) {
        try {
          const result = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = $1 AND indexdef LIKE $2
          `, [check.table, `%${check.column}%`]);

          if (result.rows.length > 0) {
            this.addResult('pass', `Index on ${check.table}.${check.column} exists`);
          } else {
            this.addResult('warn', `No index found on ${check.table}.${check.column} - may impact performance`);
          }
        } catch (error) {
          this.addResult('warn', `Failed to check index on ${check.table}.${check.column}: ${error.message}`);
        }
      }

      // Check table sizes to identify potential performance issues
      const tableSizeCheck = await client.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      for (const row of tableSizeCheck.rows) {
        if (row.size.includes('GB')) {
          this.addResult('warn', `Table ${row.tablename} is large (${row.size}) - monitor performance`);
        } else {
          this.addResult('pass', `Table ${row.tablename} size: ${row.size}`);
        }
      }

      client.release();

    } catch (error) {
      this.addResult('fail', `Performance validation failed: ${error.message}`);
    }
  }

  /**
   * Get required methods for each service
   */
  getRequiredMethods(serviceName) {
    const methodMap = {
      'AuditLogger': ['logInteraction', 'getAuditLogs', 'getAuditLogCount'],
      'PIIDetector': ['redact', 'containsPII', 'identifyPII'],
      'EncryptionManager': ['initialize', 'encrypt', 'decrypt', 'validateIntegrity'],
      'DataLifecycleManager': ['initialize', 'runDataCleanup', 'getLifecycleStats'],
      'ComplianceReportGenerator': ['generateDailySummary', 'generateMonthlyStatusReport'],
      'RBACManager': ['initialize', 'authenticateUser', 'hasPermission', 'createUser'],
    };
    
    return methodMap[serviceName] || [];
  }

  /**
   * Add validation result
   */
  addResult(type, message) {
    const result = { type, message, timestamp: new Date().toISOString() };
    this.results.details.push(result);
    
    switch (type) {
      case 'pass':
        this.results.passed++;
        console.log(`  ✅ ${message}`);
        break;
      case 'fail':
        this.results.failed++;
        console.log(`  ❌ ${message}`);
        break;
      case 'warn':
        this.results.warnings++;
        console.log(`  ⚠️  ${message}`);
        break;
    }
  }

  /**
   * Print validation results summary
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 5 VALIDATION RESULTS');
    console.log('='.repeat(60));
    
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📊 Total: ${this.results.passed + this.results.failed + this.results.warnings}`);
    
    if (this.results.failed === 0) {
      console.log('\n🎉 All critical validations passed!');
      if (this.results.warnings > 0) {
        console.log(`⚠️  Note: ${this.results.warnings} warnings should be addressed for optimal operation`);
      }
    } else {
      console.log(`\n💥 ${this.results.failed} critical issues found that must be resolved`);
    }

    console.log('\nFor detailed results, check the validation log above.');
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new Phase5Validator();
  validator.run()
    .then((success) => {
      if (success) {
        console.log('\n✅ Phase 5 validation completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Phase 5 validation failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Phase 5 validation error:', error);
      process.exit(1);
    });
}

module.exports = Phase5Validator;
