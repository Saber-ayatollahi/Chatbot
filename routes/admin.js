/**
 * Admin Routes
 * Administrative endpoints for system management, user management, and compliance
 */

const express = require('express');
const router = express.Router();
const AuditLogger = require('../services/AuditLogger');
const PIIDetector = require('../services/PIIDetector');
const EncryptionManager = require('../services/EncryptionManager');
const DataLifecycleManager = require('../services/DataLifecycleManager');
const ComplianceReportGenerator = require('../services/ComplianceReportGenerator');
const RBACManager = require('../services/RBACManager');
const logger = require('../utils/logger');
const { body, query, param, validationResult } = require('express-validator');

class AdminRoutes {
  constructor() {
    this.auditLogger = new AuditLogger();
    this.piiDetector = new PIIDetector();
    this.encryptionManager = new EncryptionManager();
    this.dataLifecycleManager = new DataLifecycleManager();
    this.complianceReportGenerator = new ComplianceReportGenerator();
    this.rbacManager = new RBACManager();
    this.initialized = false;
  }

  /**
   * Initialize admin routes
   */
  async initialize() {
    try {
      // Skip complex initialization for now, just setup basic routes
      this.setupRoutes();
      this.initialized = true;
      
      logger.info('Admin Routes initialized successfully (basic mode)');

    } catch (error) {
      logger.error('Failed to initialize Admin Routes:', error);
      throw error;
    }
  }

  /**
   * Setup all admin routes
   */
  setupRoutes() {
    // System Management Routes
    this.setupSystemRoutes();
    
    // User Management Routes
    this.setupUserRoutes();
    
    // Audit and Compliance Routes
    this.setupAuditRoutes();
    
    // Data Management Routes
    this.setupDataRoutes();
    
    // Security Management Routes
    this.setupSecurityRoutes();
    
    // Report Generation Routes
    this.setupReportRoutes();
  }

  /**
   * System Management Routes
   */
  setupSystemRoutes() {
    // System status
    router.get('/system/status',
      this.rbacManager.createAuthMiddleware('system:monitor'),
      async (req, res) => {
        try {
          const status = {
            timestamp: new Date().toISOString(),
            system: {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              version: process.version,
            },
            services: {
              database: await this.checkDatabaseHealth(),
              encryption: await this.checkEncryptionHealth(),
              audit: await this.checkAuditHealth(),
            },
            compliance: {
              piiDetection: this.piiDetector ? 'active' : 'inactive',
              dataEncryption: this.encryptionManager.initialized ? 'active' : 'inactive',
              auditLogging: this.auditLogger ? 'active' : 'inactive',
            },
          };

          res.json({ success: true, status });

        } catch (error) {
          logger.error('System status check failed:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get system status' 
          });
        }
      }
    );

    // System configuration
    router.get('/system/config',
      this.rbacManager.createAuthMiddleware('system:configure'),
      async (req, res) => {
        try {
          const config = {
            compliance: {
              piiRedactionEnabled: !!process.env.ENABLE_PII_REDACTION,
              dataEncryptionEnabled: !!process.env.ENABLE_DATA_ENCRYPTION,
              auditLoggingEnabled: !!process.env.ENABLE_AUDIT_LOGGING,
            },
            security: {
              jwtExpiration: process.env.JWT_EXPIRES_IN || '8h',
              rateLimitEnabled: !!process.env.ENABLE_RATE_LIMIT,
              corsEnabled: !!process.env.ENABLE_CORS,
            },
            database: {
              connectionPool: process.env.DB_POOL_SIZE || 10,
              queryTimeout: process.env.DB_QUERY_TIMEOUT || 30000,
            },
            rag: {
              confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.6,
              responseMaxTokens: parseInt(process.env.RESPONSE_MAX_TOKENS) || 1000,
              responseTemperature: parseFloat(process.env.RESPONSE_TEMPERATURE) || 0.3,
              enableCitationValidation: process.env.ENABLE_CITATION_VALIDATION !== 'false',
              retrievalMaxChunks: parseInt(process.env.RETRIEVAL_MAX_CHUNKS) || 10,
              diversityThreshold: parseFloat(process.env.RETRIEVAL_DIVERSITY_THRESHOLD) || 0.8,
            },
          };

          res.json({ success: true, config });

        } catch (error) {
          logger.error('Failed to get system config:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get system configuration' 
          });
        }
      }
    );

    // Update system configuration
    router.put('/system/config',
      this.rbacManager.createAuthMiddleware('system:configure'),
      [
        body('compliance.piiRedactionEnabled').optional().isBoolean(),
        body('compliance.dataEncryptionEnabled').optional().isBoolean(),
        body('compliance.auditLoggingEnabled').optional().isBoolean(),
        body('security.jwtExpiration').optional().isString(),
        body('security.rateLimitEnabled').optional().isBoolean(),
        body('rag.confidenceThreshold').optional().isFloat({ min: 0.0, max: 1.0 }),
        body('rag.responseMaxTokens').optional().isInt({ min: 100, max: 4000 }),
        body('rag.responseTemperature').optional().isFloat({ min: 0.0, max: 2.0 }),
        body('rag.enableCitationValidation').optional().isBoolean(),
        body('rag.retrievalMaxChunks').optional().isInt({ min: 1, max: 50 }),
        body('rag.diversityThreshold').optional().isFloat({ min: 0.0, max: 1.0 }),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          // This would typically update environment variables or configuration files
          // For now, we'll just acknowledge the request
          logger.info('System configuration update requested', {
            userId: req.user.id,
            changes: req.body,
          });

          res.json({ 
            success: true, 
            message: 'Configuration update requested (requires restart)' 
          });

        } catch (error) {
          logger.error('Failed to update system config:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to update system configuration' 
          });
        }
      }
    );

    // RAG-specific configuration endpoints (public for testing)
    router.get('/rag/config',
      async (req, res) => {
        try {
          const { getConfig } = require('../config/environment');
          const config = getConfig();
          
          const ragConfig = {
            confidenceThreshold: config.rag.response.confidenceThreshold,
            responseMaxTokens: config.rag.response.maxTokens,
            responseTemperature: config.rag.response.temperature,
            enableCitationValidation: config.rag.response.enableCitationValidation,
            retrievalMaxChunks: config.rag.retrieval.maxChunks,
            diversityThreshold: config.rag.retrieval.diversityThreshold,
            enableHybridSearch: config.rag.retrieval.enableHybridSearch,
          };

          res.json({ success: true, config: ragConfig });

        } catch (error) {
          logger.error('Failed to get RAG config:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get RAG configuration' 
          });
        }
      }
    );

    router.put('/rag/config',
      [
        body('confidenceThreshold').optional().isFloat({ min: 0.0, max: 1.0 }),
        body('responseMaxTokens').optional().isInt({ min: 100, max: 4000 }),
        body('responseTemperature').optional().isFloat({ min: 0.0, max: 2.0 }),
        body('enableCitationValidation').optional().isBoolean(),
        body('retrievalMaxChunks').optional().isInt({ min: 1, max: 50 }),
        body('diversityThreshold').optional().isFloat({ min: 0.0, max: 1.0 }),
        body('enableHybridSearch').optional().isBoolean(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          // Update environment variables dynamically
          const updates = {};
          if (req.body.confidenceThreshold !== undefined) {
            process.env.CONFIDENCE_THRESHOLD = req.body.confidenceThreshold.toString();
            updates.CONFIDENCE_THRESHOLD = req.body.confidenceThreshold;
          }
          if (req.body.responseMaxTokens !== undefined) {
            process.env.RESPONSE_MAX_TOKENS = req.body.responseMaxTokens.toString();
            updates.RESPONSE_MAX_TOKENS = req.body.responseMaxTokens;
          }
          if (req.body.responseTemperature !== undefined) {
            process.env.RESPONSE_TEMPERATURE = req.body.responseTemperature.toString();
            updates.RESPONSE_TEMPERATURE = req.body.responseTemperature;
          }
          if (req.body.enableCitationValidation !== undefined) {
            process.env.ENABLE_CITATION_VALIDATION = req.body.enableCitationValidation.toString();
            updates.ENABLE_CITATION_VALIDATION = req.body.enableCitationValidation;
          }
          if (req.body.retrievalMaxChunks !== undefined) {
            process.env.RETRIEVAL_MAX_CHUNKS = req.body.retrievalMaxChunks.toString();
            updates.RETRIEVAL_MAX_CHUNKS = req.body.retrievalMaxChunks;
          }
          if (req.body.diversityThreshold !== undefined) {
            process.env.RETRIEVAL_DIVERSITY_THRESHOLD = req.body.diversityThreshold.toString();
            updates.RETRIEVAL_DIVERSITY_THRESHOLD = req.body.diversityThreshold;
          }
          if (req.body.enableHybridSearch !== undefined) {
            process.env.ENABLE_HYBRID_SEARCH = req.body.enableHybridSearch.toString();
            updates.ENABLE_HYBRID_SEARCH = req.body.enableHybridSearch;
          }

          logger.info('RAG configuration updated', {
            userId: req.user?.id || 'system',
            updates: updates,
          });

          res.json({ 
            success: true, 
            message: 'RAG configuration updated successfully',
            updates: updates
          });

        } catch (error) {
          logger.error('Failed to update RAG config:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to update RAG configuration' 
          });
        }
      }
    );
  }

  /**
   * User Management Routes
   */
  setupUserRoutes() {
    // List users
    router.get('/users',
      this.rbacManager.createAuthMiddleware('users:read'),
      [
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 }),
        query('role').optional().isIn(['super_admin', 'admin', 'compliance_officer', 'analyst', 'user']),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const options = {
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            role: req.query.role,
          };

          const result = await this.rbacManager.listUsers(options);
          res.json(result);

        } catch (error) {
          logger.error('Failed to list users:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to list users' 
          });
        }
      }
    );

    // Get user details
    router.get('/users/:userId',
      this.rbacManager.createAuthMiddleware('users:read'),
      [
        param('userId').isUUID(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const user = await this.rbacManager.getUserById(req.params.userId);
          
          if (!user) {
            return res.status(404).json({ 
              success: false, 
              error: 'User not found' 
            });
          }

          res.json({ success: true, user });

        } catch (error) {
          logger.error('Failed to get user:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get user details' 
          });
        }
      }
    );

    // Create user
    router.post('/users',
      this.rbacManager.createAuthMiddleware('users:create'),
      [
        body('username').isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
        body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
        body('email').isEmail(),
        body('role').isIn(['super_admin', 'admin', 'compliance_officer', 'analyst', 'user']),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const result = await this.rbacManager.createUser(req.body);
          
          if (result.success) {
            logger.info('User created by admin', {
              adminId: req.user.id,
              newUserId: result.user.id,
              username: result.user.username,
              role: result.user.role,
            });
          }

          res.status(result.success ? 201 : 400).json(result);

        } catch (error) {
          logger.error('Failed to create user:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to create user' 
          });
        }
      }
    );

    // Update user
    router.put('/users/:userId',
      this.rbacManager.createAuthMiddleware('users:update'),
      [
        param('userId').isUUID(),
        body('username').optional().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
        body('email').optional().isEmail(),
        body('role').optional().isIn(['super_admin', 'admin', 'compliance_officer', 'analyst', 'user']),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const result = await this.rbacManager.updateUser(req.params.userId, req.body);
          
          if (result.success) {
            logger.info('User updated by admin', {
              adminId: req.user.id,
              updatedUserId: req.params.userId,
              changes: req.body,
            });
          }

          res.json(result);

        } catch (error) {
          logger.error('Failed to update user:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to update user' 
          });
        }
      }
    );

    // Delete user
    router.delete('/users/:userId',
      this.rbacManager.createAuthMiddleware('users:delete'),
      [
        param('userId').isUUID(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          // Prevent self-deletion
          if (req.params.userId === req.user.id) {
            return res.status(400).json({ 
              success: false, 
              error: 'Cannot delete your own account' 
            });
          }

          const result = await this.rbacManager.deleteUser(req.params.userId);
          
          if (result.success) {
            logger.info('User deleted by admin', {
              adminId: req.user.id,
              deletedUserId: req.params.userId,
            });
          }

          res.json(result);

        } catch (error) {
          logger.error('Failed to delete user:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to delete user' 
          });
        }
      }
    );
  }

  /**
   * Audit and Compliance Routes
   */
  setupAuditRoutes() {
    // Get audit logs
    router.get('/audit/logs',
      this.rbacManager.createAuthMiddleware('audit:read'),
      [
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 }),
        query('sessionId').optional().isString(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('minConfidence').optional().isFloat({ min: 0, max: 1 }),
        query('maxConfidence').optional().isFloat({ min: 0, max: 1 }),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const filters = {};
          const pagination = {
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0,
          };

          // Build filters
          if (req.query.sessionId) filters.sessionId = req.query.sessionId;
          if (req.query.startDate) filters.startDate = req.query.startDate;
          if (req.query.endDate) filters.endDate = req.query.endDate;
          if (req.query.minConfidence) filters.minConfidence = parseFloat(req.query.minConfidence);
          if (req.query.maxConfidence) filters.maxConfidence = parseFloat(req.query.maxConfidence);

          const logs = await this.auditLogger.getAuditLogs(filters, pagination);
          const totalCount = await this.auditLogger.getAuditLogCount(filters);

          res.json({
            success: true,
            logs,
            pagination: {
              ...pagination,
              total: totalCount,
              hasMore: pagination.offset + logs.length < totalCount,
            },
          });

        } catch (error) {
          logger.error('Failed to get audit logs:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve audit logs' 
          });
        }
      }
    );

    // Export audit logs
    router.post('/audit/export',
      this.rbacManager.createAuthMiddleware('audit:export'),
      [
        body('filters').optional().isObject(),
        body('format').optional().isIn(['json', 'csv']),
        body('dateRange').optional().isObject(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const { filters = {}, format = 'json' } = req.body;
          
          // Get all matching logs (be careful with large datasets)
          const logs = await this.auditLogger.getAuditLogs(filters, { limit: 10000, offset: 0 });
          
          if (format === 'csv') {
            const csv = this.convertLogsToCSV(logs);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
            res.send(csv);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.json');
            res.json({ logs, exportedAt: new Date().toISOString() });
          }

          logger.info('Audit logs exported', {
            adminId: req.user.id,
            recordCount: logs.length,
            format,
          });

        } catch (error) {
          logger.error('Failed to export audit logs:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to export audit logs' 
          });
        }
      }
    );

    // Get compliance statistics
    router.get('/audit/stats',
      this.rbacManager.createAuthMiddleware('audit:read'),
      [
        query('days').optional().isInt({ min: 1, max: 365 }),
      ],
      async (req, res) => {
        try {
          const days = parseInt(req.query.days) || 30;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          const filters = {
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          };

          const logs = await this.auditLogger.getAuditLogs(filters, { limit: 10000, offset: 0 });
          
          const stats = this.calculateAuditStats(logs);
          
          res.json({ success: true, stats, period: { days, startDate: filters.startDate } });

        } catch (error) {
          logger.error('Failed to get audit stats:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get audit statistics' 
          });
        }
      }
    );
  }

  /**
   * Data Management Routes
   */
  setupDataRoutes() {
    // Get data lifecycle statistics
    router.get('/data/lifecycle',
      this.rbacManager.createAuthMiddleware('data:read'),
      async (req, res) => {
        try {
          const stats = await this.dataLifecycleManager.getLifecycleStats();
          res.json({ success: true, stats });

        } catch (error) {
          logger.error('Failed to get lifecycle stats:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get data lifecycle statistics' 
          });
        }
      }
    );

    // Manual data cleanup
    router.post('/data/cleanup',
      this.rbacManager.createAuthMiddleware('data:delete'),
      [
        body('tableName').isString().isLength({ min: 1 }),
        body('retentionDays').optional().isInt({ min: 1 }),
        body('dryRun').optional().isBoolean(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const { tableName, retentionDays, dryRun = false } = req.body;
          
          const result = await this.dataLifecycleManager.manualCleanup(tableName, {
            retentionDays,
            dryRun,
          });

          logger.info('Manual data cleanup executed', {
            adminId: req.user.id,
            tableName,
            dryRun,
            result,
          });

          res.json({ success: true, result });

        } catch (error) {
          logger.error('Failed to execute manual cleanup:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to execute data cleanup' 
          });
        }
      }
    );

    // Update retention policy
    router.put('/data/retention/:tableName',
      this.rbacManager.createAuthMiddleware('data:archive'),
      [
        param('tableName').isString().isLength({ min: 1 }),
        body('retentionDays').isInt({ min: 1 }),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const result = await this.dataLifecycleManager.updateRetentionPolicy(
            req.params.tableName,
            req.body.retentionDays
          );

          logger.info('Retention policy updated', {
            adminId: req.user.id,
            tableName: req.params.tableName,
            retentionDays: req.body.retentionDays,
          });

          res.json(result);

        } catch (error) {
          logger.error('Failed to update retention policy:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to update retention policy' 
          });
        }
      }
    );
  }

  /**
   * Security Management Routes
   */
  setupSecurityRoutes() {
    // Get encryption statistics
    router.get('/security/encryption',
      this.rbacManager.createAuthMiddleware('system:monitor'),
      async (req, res) => {
        try {
          const stats = this.encryptionManager.getEncryptionStats();
          res.json({ success: true, stats });

        } catch (error) {
          logger.error('Failed to get encryption stats:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to get encryption statistics' 
          });
        }
      }
    );

    // Validate encryption integrity
    router.post('/security/validate',
      this.rbacManager.createAuthMiddleware('system:monitor'),
      async (req, res) => {
        try {
          const results = await this.encryptionManager.validateIntegrity();
          
          logger.info('Encryption integrity validation performed', {
            adminId: req.user.id,
            results,
          });

          res.json({ success: true, results });

        } catch (error) {
          logger.error('Failed to validate encryption integrity:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to validate encryption integrity' 
          });
        }
      }
    );

    // Rotate encryption key
    router.post('/security/rotate/:keyType',
      this.rbacManager.createAuthMiddleware('system:configure'),
      [
        param('keyType').isIn(['audit', 'pii', 'session', 'metadata']),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const result = await this.encryptionManager.rotateKey(req.params.keyType);
          
          logger.info('Encryption key rotated', {
            adminId: req.user.id,
            keyType: req.params.keyType,
          });

          res.json(result);

        } catch (error) {
          logger.error('Failed to rotate encryption key:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to rotate encryption key' 
          });
        }
      }
    );
  }

  /**
   * Report Generation Routes
   */
  setupReportRoutes() {
    // Generate daily compliance report
    router.post('/reports/daily',
      this.rbacManager.createAuthMiddleware('reports:generate'),
      [
        body('date').optional().isISO8601(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const date = req.body.date ? new Date(req.body.date) : new Date();
          const reportPath = await this.complianceReportGenerator.generateDailySummary(date);
          
          logger.info('Daily compliance report generated', {
            adminId: req.user.id,
            date: date.toISOString(),
            reportPath,
          });

          res.json({ 
            success: true, 
            reportPath,
            date: date.toISOString() 
          });

        } catch (error) {
          logger.error('Failed to generate daily report:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to generate daily report' 
          });
        }
      }
    );

    // Generate monthly compliance report
    router.post('/reports/monthly',
      this.rbacManager.createAuthMiddleware('reports:generate'),
      [
        body('date').optional().isISO8601(),
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              errors: errors.array() 
            });
          }

          const date = req.body.date ? new Date(req.body.date) : new Date();
          const reportPath = await this.complianceReportGenerator.generateMonthlyStatusReport(date);
          
          logger.info('Monthly compliance report generated', {
            adminId: req.user.id,
            date: date.toISOString(),
            reportPath,
          });

          res.json({ 
            success: true, 
            reportPath,
            date: date.toISOString() 
          });

        } catch (error) {
          logger.error('Failed to generate monthly report:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to generate monthly report' 
          });
        }
      }
    );
  }

  /**
   * Helper methods
   */

  async checkDatabaseHealth() {
    try {
      const client = await this.auditLogger.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  async checkEncryptionHealth() {
    try {
      const results = await this.encryptionManager.validateIntegrity();
      return results.valid ? 'healthy' : 'unhealthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  async checkAuditHealth() {
    try {
      // Try to get audit log count
      await this.auditLogger.getAuditLogCount({});
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  convertLogsToCSV(logs) {
    if (logs.length === 0) {
      return 'No data available';
    }

    const headers = Object.keys(logs[0]);
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const values = headers.map(header => {
        const value = log[header];
        if (typeof value === 'object' && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  calculateAuditStats(logs) {
    const stats = {
      totalInteractions: logs.length,
      uniqueSessions: new Set(logs.map(log => log.session_id)).size,
      averageResponseTime: 0,
      averageConfidenceScore: 0,
      piiRedactionCount: 0,
      errorCount: 0,
      dailyBreakdown: {},
    };

    if (logs.length === 0) {
      return stats;
    }

    let totalResponseTime = 0;
    let totalConfidenceScore = 0;
    let validResponseTimes = 0;
    let validConfidenceScores = 0;

    for (const log of logs) {
      // Response time
      if (log.response_time_ms && log.response_time_ms > 0) {
        totalResponseTime += log.response_time_ms;
        validResponseTimes++;
      }

      // Confidence score
      if (log.confidence_score !== null && log.confidence_score !== undefined) {
        totalConfidenceScore += log.confidence_score;
        validConfidenceScores++;
      }

      // PII redaction
      if (log.user_query && log.user_query.includes('[REDACTED_PII]')) {
        stats.piiRedactionCount++;
      }

      // Errors (if metadata contains error information)
      if (log.metadata && log.metadata.error) {
        stats.errorCount++;
      }

      // Daily breakdown
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!stats.dailyBreakdown[date]) {
        stats.dailyBreakdown[date] = 0;
      }
      stats.dailyBreakdown[date]++;
    }

    stats.averageResponseTime = validResponseTimes > 0 ? 
      Math.round(totalResponseTime / validResponseTimes) : 0;
    
    stats.averageConfidenceScore = validConfidenceScores > 0 ? 
      (totalConfidenceScore / validConfidenceScores).toFixed(2) : 0;

    return stats;
  }

  /**
   * Get router instance
   */
  getRouter() {
    return router;
  }
}

module.exports = AdminRoutes;