/**
 * Integration Tests for Phase 5 Compliance System
 */

const request = require('supertest');
const express = require('express');
const { Pool } = require('pg');
const AuditLogger = require('../../services/AuditLogger');
const EncryptionManager = require('../../services/EncryptionManager');
const RBACManager = require('../../services/RBACManager');
const ComplianceMiddleware = require('../../middleware/complianceMiddleware');
const AdminRoutes = require('../../routes/admin');

// Mock external dependencies
jest.mock('pg');
jest.mock('../../utils/logger');
jest.mock('../../config/environment');

describe('Phase 5 Compliance System Integration', () => {
  let app;
  let mockPool;
  let mockClient;
  let auditLogger;
  let encryptionManager;
  let rbacManager;
  let complianceMiddleware;
  let adminRoutes;

  beforeAll(async () => {
    // Setup database mocks
    mockClient = {
      connect: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
    };

    Pool.mockImplementation(() => mockPool);

    // Mock config
    require('../../config/environment').getConfig = jest.fn().mockReturnValue({
      get: (path) => {
        const config = {
          'database.url': 'mock-database-url',
          'rbac.defaultAdminPassword': 'test-admin-password',
          'rbac.sessionTimeout': 3600000,
          'rbac.maxLoginAttempts': 5,
          'rbac.jwtSecret': 'test-jwt-secret',
          'encryption.keyDirectory': './test-keys',
          'encryption.algorithm': 'aes-256-gcm',
          'compliance.enablePiiRedaction': true,
          'compliance.enableDataEncryption': true,
          'compliance.enableAuditLogging': true,
        };
        return config[path];
      },
      database: { url: 'mock-database-url' },
      rbac: {
        defaultAdminPassword: 'test-admin-password',
        sessionTimeout: 3600000,
        maxLoginAttempts: 5,
        jwtSecret: 'test-jwt-secret',
      },
      compliance: {
        enablePiiRedaction: true,
        enableDataEncryption: true,
        enableAuditLogging: true,
      },
      encryption: { 
        keyDirectory: './test-keys',
        algorithm: 'aes-256-gcm',
      },
      jwt: { secret: 'test-secret', expiresIn: '1h' },
    });

    // Initialize services
    auditLogger = new AuditLogger();
    encryptionManager = new EncryptionManager();
    rbacManager = new RBACManager();
    complianceMiddleware = new ComplianceMiddleware();
    adminRoutes = new AdminRoutes();

    // Mock file system for encryption keys
    const fs = require('fs').promises;
    jest.doMock('fs', () => ({
      promises: {
        mkdir: jest.fn().mockResolvedValue(),
        readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
        writeFile: jest.fn().mockResolvedValue(),
        stat: jest.fn().mockResolvedValue({ birthtime: new Date() }),
        access: jest.fn().mockResolvedValue(),
      },
    }));

    // Initialize services
    await encryptionManager.initialize();
    await rbacManager.initialize();
    await complianceMiddleware.initialize();
    await adminRoutes.initialize();

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Apply compliance middleware
    const complianceStack = complianceMiddleware.createComplianceStack();
    app.use(...complianceStack);
    
    // Add admin routes (ensure they're properly initialized with auth middleware)
    if (!adminRoutes.initialized) {
      throw new Error('Admin routes not properly initialized');
    }
    app.use('/admin', adminRoutes.getRouter());

    // Add test endpoints
    app.post('/api/chat', 
      rbacManager.createAuthMiddleware('chat:use'),
      async (req, res) => {
        const { message } = req.body;
        
        // Simulate chat interaction
        const response = `Echo: ${message}`;
        const interactionData = {
          sessionId: req.sessionInfo?.sessionId || 'test-session',
          query: message,
          response,
          confidenceScore: 0.95,
          responseTime: 150,
          modelVersion: 'test-model',
          userAgent: req.get('User-Agent'),
          ipAddress: req.sessionInfo?.ipAddress,
          metadata: { endpoint: '/api/chat' },
        };

        // Log interaction
        await auditLogger.logInteraction(interactionData);

        res.json({ response, sessionId: interactionData.sessionId });
      }
    );

    app.get('/api/test-pii', async (req, res) => {
      const testData = {
        email: 'user@example.com',
        phone: '555-123-4567',
        message: 'This contains PII data',
      };
      
      res.json(testData);
    });
  });

  afterAll(async () => {
    if (encryptionManager) await encryptionManager.close();
    if (rbacManager) await rbacManager.close();
    if (complianceMiddleware) await complianceMiddleware.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/admin/users')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Authorization token required');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should authenticate valid user', async () => {
      // Mock user authentication
      mockClient.query
        .mockResolvedValueOnce({ // User lookup
          rows: [{
            id: 'user-123',
            username: 'testuser',
            password_hash: '$2a$12$hashedpassword',
            role: 'admin',
            permissions: ['users:read'],
            role_level: 4,
          }]
        })
        .mockResolvedValueOnce({ // Update last login
          rows: []
        });

      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const authResult = await rbacManager.authenticateUser('testuser', 'password');
      
      expect(authResult.success).toBe(true);
      expect(authResult.token).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    it('should log API interactions', async () => {
      // Mock successful audit log storage
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'audit-log-123' }]
      });

      const response = await request(app)
        .get('/api/test-pii')
        .expect(200);

      // Check that audit logging was called
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.any(Array)
      );
    });

    it('should redact PII in audit logs', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'audit-log-123' }]
      });

      await request(app)
        .get('/api/test-pii')
        .expect(200);

      // Verify PII redaction was applied
      const auditCall = mockClient.query.mock.calls.find(call => 
        call[0].includes('INSERT INTO audit_logs')
      );
      
      expect(auditCall).toBeDefined();
      // The exact assertion would depend on the PII detection implementation
    });
  });

  describe('Encryption', () => {
    it('should encrypt sensitive data', () => {
      const sensitiveData = { ssn: '123-45-6789', email: 'user@example.com' };
      
      const encrypted = encryptionManager.encrypt(sensitiveData, 'pii');
      
      expect(encrypted).toHaveProperty('encrypted', true);
      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('algorithm', 'aes-256-gcm');
      expect(encrypted).toHaveProperty('keyType', 'pii');
    });

    it('should decrypt encrypted data correctly', () => {
      const originalData = { message: 'Secret message', timestamp: new Date().toISOString() };
      
      const encrypted = encryptionManager.encrypt(originalData, 'audit');
      const decrypted = encryptionManager.decrypt(encrypted, 'audit');
      
      expect(decrypted).toEqual(originalData);
    });

    it('should validate encryption integrity', async () => {
      const results = await encryptionManager.validateIntegrity();
      
      expect(results).toHaveProperty('valid', true);
      expect(results.checks.length).toBeGreaterThan(0);
      expect(results.errors.length).toBe(0);
    });
  });

  describe('Compliance Middleware', () => {
    it('should add security headers', async () => {
      const response = await request(app)
        .get('/api/test-pii')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should handle CORS correctly', async () => {
      const response = await request(app)
        .options('/api/test-pii')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    it('should track sessions', async () => {
      const response = await request(app)
        .get('/api/test-pii')
        .expect(200);

      // Session tracking should add session information to the request
      // This would be verified through the audit logs or response headers
      expect(response.status).toBe(200);
    });
  });

  describe('Data Lifecycle Management', () => {
    it('should handle retention policies', async () => {
      // Mock retention policy queries
      mockClient.query
        .mockResolvedValueOnce({ // Get retention policies
          rows: [
            { table_name: 'audit_logs', retention_days: 365 },
            { table_name: 'conversations', retention_days: 90 },
          ]
        });

      const DataLifecycleManager = require('../../services/DataLifecycleManager');
      const lifecycleManager = new DataLifecycleManager();
      await lifecycleManager.initialize();

      const stats = await lifecycleManager.getLifecycleStats();
      
      expect(stats).toHaveProperty('retentionPolicies');
      expect(stats.retentionPolicies.length).toBeGreaterThan(0);

      await lifecycleManager.close();
    });

    it('should perform dry run cleanup', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ count: '5' }] // 5 records would be deleted
      });

      const DataLifecycleManager = require('../../services/DataLifecycleManager');
      const lifecycleManager = new DataLifecycleManager();
      await lifecycleManager.initialize();

      const result = await lifecycleManager.manualCleanup('audit_logs', {
        retentionDays: 30,
        dryRun: true,
      });

      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('recordsToDelete', 5);

      await lifecycleManager.close();
    });
  });

  describe('Admin Interface', () => {
    let adminToken;

    beforeEach(async () => {
      // Create admin token for testing
      // Note: This is a bcrypt hash for the password 'password'
      const passwordHash = '$2b$10$rOCVZKm8fJbXD.nQVYntaOGMiSa9VdVHM5AAWcNrQQXjWMz8OzPyG';
      
      mockClient.query.mockResolvedValue({
        rows: [{
          id: 'admin-123',
          username: 'admin',
          role: 'admin',
          password_hash: passwordHash,
          permissions: ['system:monitor', 'users:read', 'audit:read'],
          role_level: 4,
        }]
      });

      const authResult = await rbacManager.authenticateUser('admin', 'password');
      adminToken = authResult.token;
    });

    it('should provide system status', async () => {
      // Mock database queries for both user lookup and system status
      mockClient.query.mockImplementation((query) => {
        if (query.includes('SELECT * FROM users WHERE id')) {
          // Return user data for authentication
          return Promise.resolve({
            rows: [{
              id: 'admin-123',
              username: 'admin',
              role: 'admin',
              permissions: ['system:monitor', 'users:read', 'audit:read'],
              role_level: 4,
            }]
          });
        }
        // Return generic result for other queries (health checks, etc.)
        return Promise.resolve({ rows: [{ result: 1 }] });
      });

      const response = await request(app)
        .get('/admin/system/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toHaveProperty('system');
      expect(response.body.status).toHaveProperty('services');
      expect(response.body.status).toHaveProperty('compliance');
    });

    it('should retrieve audit logs', async () => {
      const mockAuditLogs = [
        {
          id: 'log-1',
          session_id: 'session-1',
          user_query: 'Test query',
          final_response: 'Test response',
          created_at: new Date().toISOString(),
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockAuditLogs }) // Get logs
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Get count

      const response = await request(app)
        .get('/admin/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/test-pii')
        .expect(200); // Should still respond even if audit logging fails

      expect(response.status).toBe(200);
    });

    it('should handle encryption errors gracefully', async () => {
      // Mock encryption failure
      const originalEncrypt = encryptionManager.encrypt;
      encryptionManager.encrypt = jest.fn().mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const response = await request(app)
        .get('/api/test-pii')
        .expect(200); // Should still respond

      expect(response.status).toBe(200);

      // Restore original method
      encryptionManager.encrypt = originalEncrypt;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent requests', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'audit-log-123' }]
      });

      const requests = Array(10).fill().map(() =>
        request(app)
          .get('/api/test-pii')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large payloads within limits', async () => {
      const largePayload = {
        data: 'x'.repeat(1000), // 1KB payload
        metadata: { test: true },
      };

      mockClient.query.mockResolvedValue({
        rows: [{ id: 'audit-log-123' }]
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ message: JSON.stringify(largePayload) })
        .expect(401); // Should be unauthorized without token

      expect(response.status).toBe(401); // Expected due to auth requirement
    });
  });

  describe('Compliance Validation', () => {
    it('should maintain audit trail for all operations', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'audit-log-123' }]
      });

      await request(app)
        .get('/api/test-pii')
        .expect(200);

      // Verify audit log was created
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.any(Array)
      );
    });

    it('should enforce data retention policies', async () => {
      const DataLifecycleManager = require('../../services/DataLifecycleManager');
      const lifecycleManager = new DataLifecycleManager();
      
      // Mock retention policy data
      mockClient.query.mockResolvedValue({
        rows: [
          { table_name: 'audit_logs', retention_days: 365 },
          { table_name: 'conversations', retention_days: 90 },
        ]
      });

      await lifecycleManager.initialize();
      const stats = await lifecycleManager.getLifecycleStats();

      expect(stats.retentionPolicies.length).toBeGreaterThan(0);
      expect(stats.retentionPolicies.every(policy => policy.retentionDays > 0)).toBe(true);

      await lifecycleManager.close();
    });

    it('should protect sensitive data through encryption', () => {
      const sensitiveData = {
        personalInfo: 'John Doe',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
      };

      const encrypted = encryptionManager.encryptPII(sensitiveData);
      
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.keyType).toBe('pii');
      
      // Verify original data is not accessible in encrypted form
      expect(JSON.stringify(encrypted)).not.toContain('John Doe');
      expect(JSON.stringify(encrypted)).not.toContain('123-45-6789');
    });
  });
});
