/**
 * Security Manager
 * Comprehensive security management including RBAC, authentication, and security auditing
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');

class SecurityManager {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({
      connectionString: this.config.database.url,
      max: 10,
    });
    this.roles = new Map([
      ['admin', {
        name: 'Administrator',
        permissions: ['*'], // All permissions
        description: 'Full system access',
      }],
      ['compliance_officer', {
        name: 'Compliance Officer',
        permissions: [
          'view_audit_logs',
          'export_audit_data',
          'generate_reports',
          'view_compliance_stats',
          'manage_violations',
        ],
        description: 'Compliance monitoring and reporting',
      }],
      ['analyst', {
        name: 'Data Analyst',
        permissions: [
          'view_audit_logs',
          'view_compliance_stats',
          'generate_reports',
        ],
        description: 'Data analysis and reporting',
      }],
      ['viewer', {
        name: 'Viewer',
        permissions: [
          'view_audit_logs',
          'view_compliance_stats',
        ],
        description: 'Read-only access to audit data',
      }],
    ]);
    this.initializeSecurityTables();
  }

  /**
   * Initialize security-related database tables
   */
  async initializeSecurityTables() {
    const client = await this.pool.connect();
    
    try {
      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          roles JSONB DEFAULT '[]'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMP WITH TIME ZONE,
          last_login_ip VARCHAR(64),
          failed_login_attempts INTEGER DEFAULT 0,
          locked_until TIMESTAMP WITH TIME ZONE,
          created_by INTEGER REFERENCES admin_users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          must_change_password BOOLEAN DEFAULT FALSE
        )
      `);

      // User sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(64),
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE
        )
      `);

      // Security events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS security_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          user_id INTEGER REFERENCES admin_users(id),
          username VARCHAR(50),
          ip_address VARCHAR(64),
          user_agent TEXT,
          details JSONB,
          severity VARCHAR(20) DEFAULT 'info',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
        )
      `);

      // API keys table
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id SERIAL PRIMARY KEY,
          key_name VARCHAR(100) NOT NULL,
          key_hash VARCHAR(255) UNIQUE NOT NULL,
          key_prefix VARCHAR(20) NOT NULL,
          user_id INTEGER REFERENCES admin_users(id),
          permissions JSONB DEFAULT '[]'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          last_used TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by INTEGER REFERENCES admin_users(id)
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_admin_user_sessions_user_id ON admin_user_sessions(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_admin_user_sessions_token ON admin_user_sessions(session_token)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)');

      // Create default admin user if none exists
      await this.createDefaultAdminUser(client);

    } catch (error) {
      logger.error('Error initializing security tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create default admin user
   */
  async createDefaultAdminUser(client) {
    try {
      const result = await client.query('SELECT COUNT(*) FROM admin_users WHERE roles @> \'["admin"]\'');
      const adminCount = parseInt(result.rows[0].count);

      if (adminCount === 0) {
        const defaultPassword = this.config.auth.defaultAdminPassword || 'admin123!';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        await client.query(`
          INSERT INTO admin_users (
            username, email, password_hash, roles, must_change_password
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          'admin',
          this.config.auth.defaultAdminEmail || 'admin@fundmanagement.local',
          passwordHash,
          JSON.stringify(['admin']),
          true,
        ]);

        logger.warn('Default admin user created. Please change the password immediately!', {
          username: 'admin',
          password: defaultPassword,
        });
      }
    } catch (error) {
      logger.error('Error creating default admin user:', error);
    }
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Validate input
      this.validateUserData(userData);

      // Check if username or email already exists
      const existingUser = await client.query(
        'SELECT id FROM admin_users WHERE username = $1 OR email = $2',
        [userData.username, userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 12);

      // Insert user
      const query = `
        INSERT INTO admin_users (
          username, email, password_hash, roles, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, roles, is_active, created_at
      `;

      const values = [
        userData.username,
        userData.email,
        passwordHash,
        JSON.stringify(userData.roles || ['viewer']),
        userData.createdBy,
      ];

      const result = await client.query(query, values);
      const user = result.rows[0];

      // Log security event
      await this.logSecurityEvent(client, {
        eventType: 'user_created',
        userId: user.id,
        username: user.username,
        details: {
          roles: userData.roles,
          createdBy: userData.createdBy,
        },
        severity: 'info',
      });

      await client.query('COMMIT');

      logger.info('User created successfully', {
        userId: user.id,
        username: user.username,
        roles: userData.roles,
      });

      return user;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT id, username, email, roles, is_active, last_login, 
               last_login_ip, created_at, updated_at, must_change_password
        FROM admin_users
        WHERE id = $1
      `;

      const result = await client.query(query, [userId]);
      return result.rows[0] || null;

    } finally {
      client.release();
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT id, username, email, password_hash, roles, is_active, 
               last_login, failed_login_attempts, locked_until,
               must_change_password
        FROM admin_users
        WHERE username = $1
      `;

      const result = await client.query(query, [username]);
      return result.rows[0] || null;

    } finally {
      client.release();
    }
  }

  /**
   * Get all users
   */
  async getUsers(options = {}) {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT id, username, email, roles, is_active, last_login,
               last_login_ip, created_at, updated_at
        FROM admin_users
      `;

      const conditions = [];
      const params = [];

      if (!options.includeInactive) {
        conditions.push('is_active = TRUE');
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY username';

      const result = await client.query(query, params);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const fields = [];
      const values = [];
      let paramIndex = 1;

      // Handle specific fields
      if (updateData.email) {
        fields.push(`email = $${paramIndex++}`);
        values.push(updateData.email);
      }

      if (updateData.roles) {
        fields.push(`roles = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.roles));
      }

      if (typeof updateData.isActive === 'boolean') {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(updateData.isActive);
      }

      if (updateData.password) {
        const passwordHash = await bcrypt.hash(updateData.password, 12);
        fields.push(`password_hash = $${paramIndex++}`);
        values.push(passwordHash);
        fields.push(`password_changed_at = NOW()`);
        fields.push(`must_change_password = FALSE`);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE admin_users 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, roles, is_active
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      // Log security event
      await this.logSecurityEvent(client, {
        eventType: 'user_updated',
        userId: user.id,
        username: user.username,
        details: updateData,
        severity: 'info',
      });

      await client.query('COMMIT');

      return user;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const query = `
        UPDATE admin_users 
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING username
      `;

      const result = await client.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const username = result.rows[0].username;

      // Deactivate all sessions
      await client.query(
        'UPDATE admin_user_sessions SET is_active = FALSE WHERE user_id = $1',
        [userId]
      );

      // Log security event
      await this.logSecurityEvent(client, {
        eventType: 'user_deleted',
        userId,
        username,
        severity: 'warning',
      });

      await client.query('COMMIT');

      return { success: true, username };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Authenticate user
   */
  async authenticateUser(username, password, ipAddress, userAgent) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const user = await this.getUserByUsername(username);
      
      if (!user) {
        await this.logSecurityEvent(client, {
          eventType: 'login_failed',
          username,
          ipAddress,
          userAgent,
          details: { reason: 'user_not_found' },
          severity: 'warning',
        });
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if account is locked
      if (user.locked_until && new Date() < new Date(user.locked_until)) {
        await this.logSecurityEvent(client, {
          eventType: 'login_blocked',
          userId: user.id,
          username,
          ipAddress,
          userAgent,
          details: { reason: 'account_locked' },
          severity: 'warning',
        });
        return { success: false, error: 'Account temporarily locked' };
      }

      // Check if account is active
      if (!user.is_active) {
        await this.logSecurityEvent(client, {
          eventType: 'login_blocked',
          userId: user.id,
          username,
          ipAddress,
          userAgent,
          details: { reason: 'account_inactive' },
          severity: 'warning',
        });
        return { success: false, error: 'Account inactive' };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        // Increment failed attempts
        const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
        const maxAttempts = this.config.auth.maxFailedAttempts || 5;
        const lockDuration = this.config.auth.lockDurationMinutes || 30;
        
        let updateQuery = 'UPDATE admin_users SET failed_login_attempts = $1';
        const updateParams = [newFailedAttempts, user.id];
        
        if (newFailedAttempts >= maxAttempts) {
          const lockUntil = new Date(Date.now() + lockDuration * 60 * 1000);
          updateQuery += ', locked_until = $3';
          updateParams.splice(2, 0, lockUntil.toISOString());
        }
        
        updateQuery += ' WHERE id = $' + updateParams.length;
        await client.query(updateQuery, updateParams);

        await this.logSecurityEvent(client, {
          eventType: 'login_failed',
          userId: user.id,
          username,
          ipAddress,
          userAgent,
          details: { 
            reason: 'invalid_password',
            failedAttempts: newFailedAttempts,
            locked: newFailedAttempts >= maxAttempts,
          },
          severity: newFailedAttempts >= maxAttempts ? 'error' : 'warning',
        });

        await client.query('COMMIT');
        return { success: false, error: 'Invalid credentials' };
      }

      // Successful authentication - reset failed attempts
      await client.query(
        'UPDATE admin_users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW(), last_login_ip = $1 WHERE id = $2',
        [this.hashIP(ipAddress), user.id]
      );

      // Create session
      const sessionToken = this.generateSessionToken();
      const expiresAt = new Date(Date.now() + (this.config.auth.sessionDurationHours || 8) * 60 * 60 * 1000);
      
      await client.query(`
        INSERT INTO admin_user_sessions (
          user_id, session_token, ip_address, user_agent, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        user.id,
        sessionToken,
        this.hashIP(ipAddress),
        userAgent,
        expiresAt.toISOString(),
      ]);

      // Log successful login
      await this.logSecurityEvent(client, {
        eventType: 'login_success',
        userId: user.id,
        username,
        ipAddress,
        userAgent,
        severity: 'info',
      });

      await client.query('COMMIT');

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
          mustChangePassword: user.must_change_password,
        },
        sessionToken,
        expiresAt,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Authentication error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate session
   */
  async validateSession(sessionToken) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT s.user_id, s.expires_at, u.username, u.email, u.roles, u.is_active
        FROM admin_user_sessions s
        JOIN admin_users u ON s.user_id = u.id
        WHERE s.session_token = $1 AND s.is_active = TRUE AND s.expires_at > NOW()
      `;

      const result = await client.query(query, [sessionToken]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const session = result.rows[0];

      // Update last activity
      await client.query(
        'UPDATE admin_user_sessions SET last_activity = NOW() WHERE session_token = $1',
        [sessionToken]
      );

      return {
        userId: session.user_id,
        username: session.username,
        email: session.email,
        roles: session.roles,
        isActive: session.is_active,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionToken) {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE admin_user_sessions SET is_active = FALSE WHERE session_token = $1',
        [sessionToken]
      );

      return { success: true };

    } finally {
      client.release();
    }
  }

  /**
   * Check user permissions
   */
  hasPermission(user, permission) {
    if (!user || !user.roles) {
      return false;
    }

    // Admin has all permissions
    if (user.roles.includes('admin')) {
      return true;
    }

    // Check specific permissions for user roles
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (role && (role.permissions.includes('*') || role.permissions.includes(permission))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate API key
   */
  async generateAPIKey(keyData) {
    const client = await this.pool.connect();
    
    try {
      const apiKey = this.generateRandomKey();
      const keyHash = this.hashAPIKey(apiKey);
      const keyPrefix = apiKey.substring(0, 8);

      const query = `
        INSERT INTO api_keys (
          key_name, key_hash, key_prefix, user_id, permissions, expires_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, key_name, key_prefix, created_at
      `;

      const values = [
        keyData.name,
        keyHash,
        keyPrefix,
        keyData.userId,
        JSON.stringify(keyData.permissions || []),
        keyData.expiresAt,
        keyData.createdBy,
      ];

      const result = await client.query(query, values);

      return {
        ...result.rows[0],
        apiKey, // Return the full key only once
      };

    } finally {
      client.release();
    }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(apiKey) {
    const client = await this.pool.connect();
    
    try {
      const keyHash = this.hashAPIKey(apiKey);
      
      const query = `
        SELECT ak.id, ak.user_id, ak.permissions, u.username, u.is_active
        FROM api_keys ak
        JOIN admin_users u ON ak.user_id = u.id
        WHERE ak.key_hash = $1 AND ak.is_active = TRUE 
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
      `;

      const result = await client.query(query, [keyHash]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const keyData = result.rows[0];

      // Update last used timestamp
      await client.query(
        'UPDATE api_keys SET last_used = NOW() WHERE id = $1',
        [keyData.id]
      );

      return {
        userId: keyData.user_id,
        username: keyData.username,
        permissions: keyData.permissions,
        isActive: keyData.is_active,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(client, eventData) {
    try {
      const query = `
        INSERT INTO security_events (
          event_type, user_id, username, ip_address, user_agent, details, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        eventData.eventType,
        eventData.userId || null,
        eventData.username || null,
        eventData.ipAddress ? this.hashIP(eventData.ipAddress) : null,
        eventData.userAgent || null,
        JSON.stringify(eventData.details || {}),
        eventData.severity || 'info',
      ];

      await client.query(query, values);

    } catch (error) {
      logger.error('Error logging security event:', error);
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(filters = {}) {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT event_type, user_id, username, ip_address, details, severity, created_at
        FROM security_events
      `;

      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (filters.eventType) {
        conditions.push(`event_type = $${paramIndex++}`);
        params.push(filters.eventType);
      }

      if (filters.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(filters.userId);
      }

      if (filters.severity) {
        conditions.push(`severity = $${paramIndex++}`);
        params.push(filters.severity);
      }

      if (filters.dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.dateTo);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY created_at DESC LIMIT $' + paramIndex++;
      params.push(filters.limit || 100);

      const result = await client.query(query, params);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Perform security audit
   */
  async performSecurityAudit(options = {}) {
    const audit = {
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    try {
      // Check for inactive users with recent activity
      const inactiveUsersCheck = await this.auditInactiveUsers();
      audit.checks.push(inactiveUsersCheck);

      // Check for failed login attempts
      const failedLoginsCheck = await this.auditFailedLogins(options.dateFrom, options.dateTo);
      audit.checks.push(failedLoginsCheck);

      // Check for expired sessions
      const expiredSessionsCheck = await this.auditExpiredSessions();
      audit.checks.push(expiredSessionsCheck);

      // Check for API key security
      const apiKeysCheck = await this.auditAPIKeys();
      audit.checks.push(apiKeysCheck);

      // Check password policies
      const passwordPolicyCheck = await this.auditPasswordPolicies();
      audit.checks.push(passwordPolicyCheck);

      // Calculate summary
      audit.checks.forEach(check => {
        audit.summary.total++;
        if (check.status === 'passed') {
          audit.summary.passed++;
        } else if (check.status === 'failed') {
          audit.summary.failed++;
        } else if (check.status === 'warning') {
          audit.summary.warnings++;
        }
      });

      return audit;

    } catch (error) {
      logger.error('Security audit failed:', error);
      throw error;
    }
  }

  /**
   * Audit inactive users
   */
  async auditInactiveUsers() {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM admin_users
        WHERE is_active = FALSE AND last_login > NOW() - INTERVAL '30 days'
      `;

      const result = await client.query(query);
      const count = parseInt(result.rows[0].count);

      return {
        name: 'Inactive Users with Recent Activity',
        status: count === 0 ? 'passed' : 'warning',
        details: `${count} inactive users with recent login activity`,
        recommendation: count > 0 ? 'Review inactive users with recent activity' : null,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Audit failed logins
   */
  async auditFailedLogins(dateFrom, dateTo) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM security_events
        WHERE event_type = 'login_failed' 
        AND created_at >= COALESCE($1, NOW() - INTERVAL '24 hours')
        AND created_at <= COALESCE($2, NOW())
      `;

      const result = await client.query(query, [dateFrom, dateTo]);
      const count = parseInt(result.rows[0].count);
      const threshold = 50; // Configurable threshold

      return {
        name: 'Failed Login Attempts',
        status: count < threshold ? 'passed' : 'warning',
        details: `${count} failed login attempts in the specified period`,
        recommendation: count >= threshold ? 'High number of failed logins detected - investigate potential attacks' : null,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Audit expired sessions
   */
  async auditExpiredSessions() {
    const client = await this.pool.connect();
    
    try {
      // Clean up expired sessions
      const cleanupResult = await client.query(
        'UPDATE admin_user_sessions SET is_active = FALSE WHERE expires_at < NOW() AND is_active = TRUE'
      );

      return {
        name: 'Expired Sessions Cleanup',
        status: 'passed',
        details: `${cleanupResult.rowCount} expired sessions cleaned up`,
        recommendation: null,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Audit API keys
   */
  async auditAPIKeys() {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
          COUNT(*) FILTER (WHERE last_used < NOW() - INTERVAL '90 days') as unused
        FROM api_keys
        WHERE is_active = TRUE
      `;

      const result = await client.query(query);
      const stats = result.rows[0];

      const issues = [];
      if (stats.expired > 0) issues.push(`${stats.expired} expired keys`);
      if (stats.unused > 0) issues.push(`${stats.unused} unused keys`);

      return {
        name: 'API Key Security',
        status: issues.length === 0 ? 'passed' : 'warning',
        details: `${stats.total} active API keys. Issues: ${issues.join(', ') || 'None'}`,
        recommendation: issues.length > 0 ? 'Review and deactivate expired or unused API keys' : null,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Audit password policies
   */
  async auditPasswordPolicies() {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM admin_users
        WHERE password_changed_at < NOW() - INTERVAL '90 days' AND is_active = TRUE
      `;

      const result = await client.query(query);
      const count = parseInt(result.rows[0].count);

      return {
        name: 'Password Age Policy',
        status: count === 0 ? 'passed' : 'warning',
        details: `${count} users with passwords older than 90 days`,
        recommendation: count > 0 ? 'Enforce password rotation policy' : null,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth() {
    const client = await this.pool.connect();
    
    try {
      const health = {
        database: 'healthy',
        activeUsers: 0,
        activeSessions: 0,
        recentSecurityEvents: 0,
        timestamp: new Date().toISOString(),
      };

      // Check active users
      const usersResult = await client.query('SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE');
      health.activeUsers = parseInt(usersResult.rows[0].count);

      // Check active sessions
      const sessionsResult = await client.query('SELECT COUNT(*) FROM admin_user_sessions WHERE is_active = TRUE AND expires_at > NOW()');
      health.activeSessions = parseInt(sessionsResult.rows[0].count);

      // Check recent security events
      const eventsResult = await client.query('SELECT COUNT(*) FROM security_events WHERE created_at > NOW() - INTERVAL \'24 hours\'');
      health.recentSecurityEvents = parseInt(eventsResult.rows[0].count);

      return health;

    } catch (error) {
      return {
        database: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId, ipAddress) {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE admin_users SET last_login = NOW(), last_login_ip = $1 WHERE id = $2',
        [this.hashIP(ipAddress), userId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Validate user data
   */
  validateUserData(userData) {
    if (!userData.username || userData.username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      throw new Error('Valid email address is required');
    }

    if (!userData.password || userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!userData.roles || !Array.isArray(userData.roles) || userData.roles.length === 0) {
      throw new Error('At least one role must be assigned');
    }

    // Validate roles exist
    for (const role of userData.roles) {
      if (!this.roles.has(role)) {
        throw new Error(`Invalid role: ${role}`);
      }
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate session token
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate random API key
   */
  generateRandomKey() {
    const prefix = 'fmc_'; // Fund Management Chatbot
    const randomPart = crypto.randomBytes(24).toString('hex');
    return prefix + randomPart;
  }

  /**
   * Hash API key
   */
  hashAPIKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Hash IP address
   */
  hashIP(ipAddress) {
    if (!ipAddress) return null;
    return crypto.createHash('sha256').update(ipAddress + this.config.auth.ipSalt).digest('hex').substring(0, 16);
  }

  /**
   * Get available roles
   */
  getRoles() {
    return Array.from(this.roles.entries()).map(([key, role]) => ({
      id: key,
      ...role,
    }));
  }

  /**
   * Close database connections
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = SecurityManager;
