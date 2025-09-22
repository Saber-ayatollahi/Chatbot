#!/usr/bin/env node

/**
 * Phase 5 Setup Script
 * Sets up compliance and audit system components
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');

class Phase5Setup {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
  }

  /**
   * Run complete Phase 5 setup
   */
  async run() {
    try {
      console.log('🚀 Starting Phase 5 Setup - Compliance & Audit System');
      console.log('=' .repeat(60));

      // 1. Database setup
      await this.setupDatabase();
      
      // 2. Create directories
      await this.createDirectories();
      
      // 3. Initialize encryption keys
      await this.initializeEncryption();
      
      // 4. Create default admin user
      await this.createDefaultAdmin();
      
      // 5. Set up data retention policies
      await this.setupRetentionPolicies();
      
      // 6. Validate setup
      await this.validateSetup();

      console.log('\n✅ Phase 5 setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Update your environment variables');
      console.log('2. Start the server with: npm run dev');
      console.log('3. Access admin panel at: http://localhost:5000/admin');
      console.log('4. Login with: admin / admin123!@#');
      console.log('5. Change the default admin password immediately!');

    } catch (error) {
      console.error('❌ Phase 5 setup failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Set up database schema and tables
   */
  async setupDatabase() {
    console.log('\n📊 Setting up database schema...');

    try {
      const client = await this.pool.connect();

      // Read and execute audit schema
      const auditSchemaPath = path.join(__dirname, '../database/audit_schema.sql');
      const auditSchema = await fs.readFile(auditSchemaPath, 'utf8');
      
      await client.query(auditSchema);
      console.log('  ✓ Audit schema created');

      // Create additional tables for Phase 5
      await client.query(`
        -- User sessions table for tracking active sessions
        CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(255),
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN DEFAULT true
        );

        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions (session_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);
      `);
      console.log('  ✓ User sessions table created');

      // Create compliance violations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS compliance_violations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR(100),
          user_id UUID REFERENCES users(id),
          violation_type VARCHAR(100) NOT NULL,
          severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
          description TEXT,
          request_path VARCHAR(255),
          request_method VARCHAR(10),
          ip_address VARCHAR(255),
          user_agent TEXT,
          metadata JSONB,
          resolved BOOLEAN DEFAULT false,
          resolved_by UUID REFERENCES users(id),
          resolved_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_compliance_violations_type ON compliance_violations (violation_type);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity ON compliance_violations (severity);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_created_at ON compliance_violations (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_resolved ON compliance_violations (resolved);
      `);
      console.log('  ✓ Compliance violations table created');

      // Create system configuration table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          id SERIAL PRIMARY KEY,
          config_key VARCHAR(100) UNIQUE NOT NULL,
          config_value JSONB NOT NULL,
          description TEXT,
          updated_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Insert default configuration
        INSERT INTO system_config (config_key, config_value, description)
        VALUES 
          ('compliance_settings', '{"pii_redaction_enabled": true, "data_encryption_enabled": true, "audit_logging_enabled": true}', 'Compliance and security settings'),
          ('retention_policies', '{"audit_logs": 365, "conversations": 90, "user_sessions": 30}', 'Data retention policies in days'),
          ('security_settings', '{"jwt_expiration": "8h", "max_login_attempts": 5, "password_policy": {"min_length": 8, "require_special": true}}', 'Security configuration')
        ON CONFLICT (config_key) DO NOTHING;
      `);
      console.log('  ✓ System configuration table created');

      client.release();
      console.log('✅ Database setup completed');

    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  /**
   * Create necessary directories
   */
  async createDirectories() {
    console.log('\n📁 Creating directories...');

    const directories = [
      'keys',
      'reports',
      'reports/compliance',
      'reports/daily',
      'reports/monthly',
      'archives',
      'backups',
      'logs/audit',
      'logs/compliance',
      'temp/exports',
    ];

    for (const dir of directories) {
      const fullPath = path.join(process.cwd(), dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
        console.log(`  ✓ Created: ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.error(`  ❌ Failed to create ${dir}:`, error);
          throw error;
        }
      }
    }

    console.log('✅ Directories created');
  }

  /**
   * Initialize encryption keys
   */
  async initializeEncryption() {
    console.log('\n🔐 Initializing encryption...');

    try {
      const EncryptionManager = require('../services/EncryptionManager');
      const encryptionManager = new EncryptionManager();
      
      await encryptionManager.initialize();
      
      // Validate encryption
      const validationResults = await encryptionManager.validateIntegrity();
      
      if (validationResults.valid) {
        console.log('  ✓ Encryption keys generated and validated');
        console.log(`  ✓ ${validationResults.checks.length} encryption checks passed`);
      } else {
        throw new Error('Encryption validation failed: ' + validationResults.errors.join(', '));
      }

      await encryptionManager.close();
      console.log('✅ Encryption initialization completed');

    } catch (error) {
      console.error('❌ Encryption initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create default admin user
   */
  async createDefaultAdmin() {
    console.log('\n👤 Setting up default admin user...');

    try {
      const client = await this.pool.connect();

      // Check if admin user already exists
      const adminCheck = await client.query(
        "SELECT COUNT(*) as count FROM users WHERE role IN ('super_admin', 'admin')"
      );

      if (parseInt(adminCheck.rows[0].count, 10) === 0) {
        // Create default admin user
        const defaultPassword = 'admin123!@#';
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        await client.query(`
          INSERT INTO users (username, password_hash, role, email, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [
          'admin',
          hashedPassword,
          'admin',
          'admin@fundmanagement.com'
        ]);

        console.log('  ✓ Default admin user created');
        console.log('  📧 Username: admin');
        console.log('  🔑 Password: admin123!@#');
        console.log('  ⚠️  Please change the password after first login!');
      } else {
        console.log('  ℹ️  Admin user already exists, skipping creation');
      }

      client.release();
      console.log('✅ Admin user setup completed');

    } catch (error) {
      console.error('❌ Admin user setup failed:', error);
      throw error;
    }
  }

  /**
   * Set up data retention policies
   */
  async setupRetentionPolicies() {
    console.log('\n🗂️  Setting up data retention policies...');

    try {
      const DataLifecycleManager = require('../services/DataLifecycleManager');
      const lifecycleManager = new DataLifecycleManager();
      
      await lifecycleManager.initialize();
      
      // Update retention policies
      const policies = [
        { table: 'audit_logs', days: 365 },
        { table: 'conversations', days: 90 },
        { table: 'chat_sessions', days: 30 },
        { table: 'user_sessions', days: 7 },
        { table: 'compliance_violations', days: 1095 }, // 3 years
      ];

      for (const policy of policies) {
        await lifecycleManager.updateRetentionPolicy(policy.table, policy.days);
        console.log(`  ✓ ${policy.table}: ${policy.days} days`);
      }

      await lifecycleManager.close();
      console.log('✅ Retention policies configured');

    } catch (error) {
      console.error('❌ Retention policy setup failed:', error);
      throw error;
    }
  }

  /**
   * Validate Phase 5 setup
   */
  async validateSetup() {
    console.log('\n🔍 Validating Phase 5 setup...');

    const validations = [];

    try {
      // Check database tables
      const client = await this.pool.connect();
      
      const tables = [
        'users', 'roles', 'audit_logs', 'data_retention_policies',
        'user_sessions', 'compliance_violations', 'system_config'
      ];

      for (const table of tables) {
        try {
          await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
          validations.push(`✓ Table ${table} exists and accessible`);
        } catch (error) {
          validations.push(`❌ Table ${table} validation failed: ${error.message}`);
        }
      }

      client.release();

      // Check encryption
      try {
        const EncryptionManager = require('../services/EncryptionManager');
        const encryptionManager = new EncryptionManager();
        await encryptionManager.initialize();
        
        const stats = encryptionManager.getEncryptionStats();
        if (stats.initialized) {
          validations.push(`✓ Encryption system initialized with ${Object.keys(stats.keys).length} keys`);
        } else {
          validations.push('❌ Encryption system not initialized');
        }
        
        await encryptionManager.close();
      } catch (error) {
        validations.push(`❌ Encryption validation failed: ${error.message}`);
      }

      // Check directories
      const directories = ['keys', 'reports', 'archives', 'logs'];
      for (const dir of directories) {
        try {
          await fs.access(path.join(process.cwd(), dir));
          validations.push(`✓ Directory ${dir} exists`);
        } catch (error) {
          validations.push(`❌ Directory ${dir} missing`);
        }
      }

      // Check services
      try {
        const services = [
          '../services/AuditLogger',
          '../services/PIIDetector',
          '../services/EncryptionManager',
          '../services/DataLifecycleManager',
          '../services/ComplianceReportGenerator',
          '../services/RBACManager',
        ];

        for (const servicePath of services) {
          try {
            const Service = require(servicePath);
            const service = new Service();
            validations.push(`✓ Service ${servicePath.split('/').pop()} loadable`);
          } catch (error) {
            validations.push(`❌ Service ${servicePath.split('/').pop()} failed: ${error.message}`);
          }
        }
      } catch (error) {
        validations.push(`❌ Service validation failed: ${error.message}`);
      }

      // Print validation results
      console.log('\nValidation Results:');
      for (const validation of validations) {
        console.log(`  ${validation}`);
      }

      const failures = validations.filter(v => v.includes('❌'));
      if (failures.length > 0) {
        throw new Error(`Validation failed: ${failures.length} issues found`);
      }

      console.log('✅ All validations passed');

    } catch (error) {
      console.error('❌ Validation failed:', error);
      throw error;
    }
  }

  /**
   * Create environment template
   */
  async createEnvironmentTemplate() {
    console.log('\n📝 Creating environment template...');

    const envTemplate = `
# Phase 5 - Compliance & Audit System Environment Variables

# Compliance Settings
ENABLE_PII_REDACTION=true
ENABLE_DATA_ENCRYPTION=true
ENABLE_AUDIT_LOGGING=true
ENABLE_VIOLATION_DETECTION=true

# Encryption Settings
ENCRYPTION_KEY_DIRECTORY=./keys
ENCRYPTION_ALGORITHM=aes-256-gcm

# RBAC Settings
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=8h
DEFAULT_ADMIN_PASSWORD=admin123!@#

# Data Lifecycle
DATA_RETENTION_AUDIT_LOGS=365
DATA_RETENTION_CONVERSATIONS=90
DATA_RETENTION_SESSIONS=30

# Security Settings
MAX_LOGIN_ATTEMPTS=5
SESSION_TIMEOUT=8h
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Compliance Reporting
REPORT_DIRECTORY=./reports
ARCHIVE_DIRECTORY=./archives
BACKUP_DIRECTORY=./backups

# Timezone for scheduled jobs
TIMEZONE=UTC

# Optional: External audit log destination
# EXTERNAL_AUDIT_ENDPOINT=https://your-audit-system.com/api/logs
# EXTERNAL_AUDIT_API_KEY=your-api-key
`;

    try {
      const envPath = path.join(process.cwd(), '.env.phase5.template');
      await fs.writeFile(envPath, envTemplate.trim());
      console.log(`  ✓ Environment template created: .env.phase5.template`);
      console.log('  ℹ️  Copy this to .env and update values as needed');
    } catch (error) {
      console.error('  ❌ Failed to create environment template:', error);
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new Phase5Setup();
  setup.run()
    .then(() => {
      console.log('\n🎉 Phase 5 setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Phase 5 setup failed:', error);
      process.exit(1);
    });
}

module.exports = Phase5Setup;
