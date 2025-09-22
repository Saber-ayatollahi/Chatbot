/**
 * Role-Based Access Control (RBAC) Manager
 * Manages user authentication, authorization, and role-based permissions
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const EncryptionManager = require('./EncryptionManager');

class RBACManager {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.rbacConfig = this.config?.rbac || {
      defaultAdminPassword: 'admin123!@#',
      sessionTimeout: 3600000, // 1 hour
      maxLoginAttempts: 5,
      jwtSecret: process.env.JWT_SECRET || 'fallback-jwt-secret-for-development',
    };
    
    const connectionString = this.config?.database?.url || 
                            process.env.DATABASE_URL || 
                            'postgresql://postgres:@localhost:5432/fund_chatbot';
    
    this.pool = new Pool({ connectionString: connectionString });
    this.encryptionManager = new EncryptionManager();
    
    // Define role hierarchy and permissions
    this.roleHierarchy = {
      'super_admin': 5,
      'admin': 4,
      'compliance_officer': 3,
      'analyst': 2,
      'user': 1,
    };

    this.permissions = {
      // System administration
      'system:manage': ['super_admin', 'admin'],
      'system:configure': ['super_admin', 'admin'],
      'system:monitor': ['super_admin', 'admin', 'compliance_officer'],
      
      // User management
      'users:create': ['super_admin', 'admin'],
      'users:read': ['super_admin', 'admin', 'compliance_officer'],
      'users:update': ['super_admin', 'admin'],
      'users:delete': ['super_admin', 'admin'],
      
      // Audit and compliance
      'audit:read': ['super_admin', 'admin', 'compliance_officer'],
      'audit:export': ['super_admin', 'admin', 'compliance_officer'],
      'audit:delete': ['super_admin'],
      
      // Data management
      'data:read': ['super_admin', 'admin', 'compliance_officer', 'analyst'],
      'data:export': ['super_admin', 'admin', 'compliance_officer'],
      'data:delete': ['super_admin', 'admin'],
      'data:archive': ['super_admin', 'admin'],
      
      // Chat and conversations
      'chat:use': ['super_admin', 'admin', 'compliance_officer', 'analyst', 'user'],
      'chat:history': ['super_admin', 'admin', 'compliance_officer', 'analyst', 'user'],
      'chat:export': ['super_admin', 'admin', 'compliance_officer'],
      
      // Reports and analytics
      'reports:generate': ['super_admin', 'admin', 'compliance_officer', 'analyst'],
      'reports:view': ['super_admin', 'admin', 'compliance_officer', 'analyst'],
      'reports:export': ['super_admin', 'admin', 'compliance_officer'],
      
      // Knowledge base
      'knowledge:read': ['super_admin', 'admin', 'compliance_officer', 'analyst', 'user'],
      'knowledge:manage': ['super_admin', 'admin'],
      'knowledge:ingest': ['super_admin', 'admin'],
    };

    this.initialized = false;
  }

  /**
   * Initialize RBAC Manager
   */
  async initialize() {
    try {
      await this.encryptionManager.initialize();
      await this.ensureDefaultRoles();
      await this.createDefaultAdminUser();
      
      this.initialized = true;
      logger.info('RBAC Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize RBAC Manager:', error);
      throw error;
    }
  }

  /**
   * Ensure default roles exist in database
   */
  async ensureDefaultRoles() {
    try {
      const client = await this.pool.connect();
      
      // Create roles table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          level INTEGER NOT NULL,
          permissions JSONB DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default roles
      for (const [roleName, level] of Object.entries(this.roleHierarchy)) {
        const rolePermissions = this.getRolePermissions(roleName);
        
        await client.query(`
          INSERT INTO roles (name, level, permissions, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (name) DO UPDATE SET
            level = EXCLUDED.level,
            permissions = EXCLUDED.permissions,
            updated_at = CURRENT_TIMESTAMP
        `, [
          roleName,
          level,
          JSON.stringify(rolePermissions),
          this.getRoleDescription(roleName)
        ]);
      }
      
      client.release();
      logger.info('Default roles ensured in database');

    } catch (error) {
      logger.error('Failed to ensure default roles:', error);
      throw error;
    }
  }

  /**
   * Get permissions for a specific role
   */
  getRolePermissions(roleName) {
    const rolePermissions = [];
    
    for (const [permission, allowedRoles] of Object.entries(this.permissions)) {
      if (allowedRoles.includes(roleName)) {
        rolePermissions.push(permission);
      }
    }
    
    return rolePermissions;
  }

  /**
   * Get role description
   */
  getRoleDescription(roleName) {
    const descriptions = {
      'super_admin': 'Super Administrator with full system access',
      'admin': 'System Administrator with management privileges',
      'compliance_officer': 'Compliance Officer with audit and reporting access',
      'analyst': 'Data Analyst with read access to data and reports',
      'user': 'Regular user with basic chat functionality',
    };
    
    return descriptions[roleName] || `${roleName} role`;
  }

  /**
   * Create default admin user if none exists
   */
  async createDefaultAdminUser() {
    try {
      const client = await this.pool.connect();
      
      // Check if any admin users exist
      const adminCheck = await client.query(`
        SELECT COUNT(*) as count FROM users 
        WHERE role IN ('super_admin', 'admin')
      `);
      
      // Robust handling of query results
      const adminCount = adminCheck?.rows?.[0]?.count || 0;
      if (parseInt(adminCount, 10) === 0) {
        // Create default admin user
        const defaultPassword = this.rbacConfig.defaultAdminPassword;
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
        
        logger.warn('Default admin user created', {
          username: 'admin',
          password: 'admin123!@#',
          message: 'Please change the default password immediately!'
        });
      }
      
      client.release();

    } catch (error) {
      logger.error('Failed to create default admin user:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with username and password
   */
  async authenticateUser(username, password) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT u.*, r.permissions, r.level as role_level
        FROM users u
        LEFT JOIN roles r ON u.role = r.name
        WHERE u.username = $1
      `;
      
      const result = await client.query(query, [username]);
      client.release();
      
      if (result.rows.length === 0) {
        logger.warn('Authentication failed - user not found', { username });
        return { success: false, error: 'Invalid credentials' };
      }
      
      const user = result.rows[0];
      
      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordValid) {
        logger.warn('Authentication failed - invalid password', { 
          username,
          userId: user.id 
        });
        return { success: false, error: 'Invalid credentials' };
      }
      
      // Generate JWT token
      const token = this.generateJWT(user);
      
      // Update last login
      await this.updateLastLogin(user.id);
      
      logger.info('User authenticated successfully', {
        userId: user.id,
        username: user.username,
        role: user.role
      });
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          permissions: user.permissions || [],
          roleLevel: user.role_level,
        },
        token,
      };

    } catch (error) {
      logger.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Generate JWT token for user
   */
  generateJWT(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions || [],
      iat: Math.floor(Date.now() / 1000),
    };
    
    const secret = this.rbacConfig.jwtSecret;
    const expiresIn = this.rbacConfig.sessionTimeout || '8h';
    
    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token) {
    try {
      const secret = this.rbacConfig.jwtSecret;
      const decoded = jwt.verify(token, secret);
      
      return { success: true, payload: decoded };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Token expired' };
      } else if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid token' };
      } else {
        logger.error('JWT verification error:', error);
        return { success: false, error: 'Token verification failed' };
      }
    }
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userPermissions, requiredPermission) {
    if (!Array.isArray(userPermissions)) {
      return false;
    }
    
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Check if user role has permission
   */
  roleHasPermission(role, permission) {
    const allowedRoles = this.permissions[permission];
    return allowedRoles && allowedRoles.includes(role);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT u.*, r.permissions, r.level as role_level
        FROM users u
        LEFT JOIN roles r ON u.role = r.name
        WHERE u.id = $1
      `;
      
      const result = await client.query(query, [userId]);
      client.release();
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        permissions: user.permissions || [],
        roleLevel: user.role_level,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      };

    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    try {
      const { username, password, role, email } = userData;
      
      // Validate role
      if (!this.roleHierarchy.hasOwnProperty(role)) {
        throw new Error(`Invalid role: ${role}`);
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO users (username, password_hash, role, email, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id, username, role, email, created_at
      `;
      
      const result = await client.query(query, [
        username,
        hashedPassword,
        role,
        email
      ]);
      
      client.release();
      
      const newUser = result.rows[0];
      
      logger.info('User created successfully', {
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role
      });
      
      return {
        success: true,
        user: newUser,
      };

    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return { success: false, error: 'Username or email already exists' };
      }
      
      logger.error('Failed to create user:', error);
      return { success: false, error: 'User creation failed' };
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    try {
      const client = await this.pool.connect();
      
      const allowedFields = ['username', 'role', 'email'];
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [field, value] of Object.entries(updateData)) {
        if (allowedFields.includes(field)) {
          if (field === 'role' && !this.roleHierarchy.hasOwnProperty(value)) {
            throw new Error(`Invalid role: ${value}`);
          }
          
          updates.push(`${field} = $${paramIndex++}`);
          values.push(value);
        }
      }
      
      if (updates.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);
      
      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, role, email, updated_at
      `;
      
      const result = await client.query(query, values);
      client.release();
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      logger.info('User updated successfully', {
        userId,
        updatedFields: Object.keys(updateData)
      });
      
      return {
        success: true,
        user: result.rows[0],
      };

    } catch (error) {
      logger.error('Failed to update user:', error);
      return { success: false, error: 'User update failed' };
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const client = await this.pool.connect();
      
      // Get current user
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        client.release();
        return { success: false, error: 'User not found' };
      }
      
      const user = userResult.rows[0];
      
      // Verify current password
      const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!passwordValid) {
        client.release();
        return { success: false, error: 'Current password is incorrect' };
      }
      
      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      
      // Update password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashedNewPassword, userId]
      );
      
      client.release();
      
      logger.info('Password changed successfully', { userId });
      
      return { success: true };

    } catch (error) {
      logger.error('Failed to change password:', error);
      return { success: false, error: 'Password change failed' };
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      const client = await this.pool.connect();
      
      const result = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING username',
        [userId]
      );
      
      client.release();
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      logger.info('User deleted successfully', {
        userId,
        username: result.rows[0].username
      });
      
      return { success: true };

    } catch (error) {
      logger.error('Failed to delete user:', error);
      return { success: false, error: 'User deletion failed' };
    }
  }

  /**
   * List all users with pagination
   */
  async listUsers(options = {}) {
    try {
      const { limit = 50, offset = 0, role = null } = options;
      
      const client = await this.pool.connect();
      
      let query = `
        SELECT u.id, u.username, u.role, u.email, u.created_at, u.updated_at, u.last_login_at,
               r.permissions, r.level as role_level
        FROM users u
        LEFT JOIN roles r ON u.role = r.name
      `;
      
      const values = [];
      let paramIndex = 1;
      
      if (role) {
        query += ` WHERE u.role = $${paramIndex++}`;
        values.push(role);
      }
      
      query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      values.push(limit, offset);
      
      const result = await client.query(query, values);
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM users';
      if (role) {
        countQuery += ' WHERE role = $1';
        const countResult = await client.query(countQuery, [role]);
        var total = parseInt(countResult.rows[0].total, 10);
      } else {
        const countResult = await client.query(countQuery);
        var total = parseInt(countResult.rows[0].total, 10);
      }
      
      client.release();
      
      return {
        success: true,
        users: result.rows.map(user => ({
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          permissions: user.permissions || [],
          roleLevel: user.role_level,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          lastLoginAt: user.last_login_at,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + result.rows.length < total,
        },
      };

    } catch (error) {
      logger.error('Failed to list users:', error);
      return { success: false, error: 'Failed to list users' };
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId) {
    try {
      const client = await this.pool.connect();
      
      await client.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
      
      client.release();

    } catch (error) {
      logger.error('Failed to update last login:', error);
    }
  }

  /**
   * Get user sessions (if session tracking is implemented)
   */
  async getUserSessions(userId) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT session_id, created_at, last_activity, ip_address, user_agent
        FROM user_sessions
        WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
        ORDER BY last_activity DESC
      `;
      
      const result = await client.query(query, [userId]);
      client.release();
      
      return {
        success: true,
        sessions: result.rows,
      };

    } catch (error) {
      if (error.code === '42P01') { // Table doesn't exist
        return { success: true, sessions: [] };
      }
      
      logger.error('Failed to get user sessions:', error);
      return { success: false, error: 'Failed to get user sessions' };
    }
  }

  /**
   * Middleware for Express.js to authenticate and authorize requests
   */
  createAuthMiddleware(requiredPermission = null) {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Authorization token required' });
        }
        
        const token = authHeader.substring(7);
        const verificationResult = this.verifyJWT(token);
        
        if (!verificationResult.success) {
          return res.status(401).json({ error: verificationResult.error });
        }
        
        const payload = verificationResult.payload;
        
        // Get fresh user data
        const user = await this.getUserById(payload.userId);
        
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        
        // Check permission if required
        if (requiredPermission) {
          if (!this.hasPermission(user.permissions, requiredPermission)) {
            logger.warn('Access denied - insufficient permissions', {
              userId: user.id,
              username: user.username,
              requiredPermission,
              userPermissions: user.permissions,
            });
            
            return res.status(403).json({ 
              error: 'Insufficient permissions',
              required: requiredPermission 
            });
          }
        }
        
        // Add user to request object
        req.user = user;
        req.token = payload;
        
        next();

      } catch (error) {
        logger.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  /**
   * Get all available permissions
   */
  getAllPermissions() {
    return Object.keys(this.permissions);
  }

  /**
   * Get all available roles
   */
  getAllRoles() {
    return Object.keys(this.roleHierarchy);
  }

  /**
   * Get role hierarchy
   */
  getRoleHierarchy() {
    return { ...this.roleHierarchy };
  }

  /**
   * Close and cleanup
   */
  async close() {
    await this.pool.end();
    await this.encryptionManager.close();
    
    this.initialized = false;
    logger.info('RBAC Manager closed');
  }
}

module.exports = RBACManager;
