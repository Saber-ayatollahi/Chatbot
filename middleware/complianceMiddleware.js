/**
 * Compliance Middleware
 * Express middleware for compliance, audit logging, and security
 */

const AuditLogger = require('../services/AuditLogger');
const PIIDetector = require('../services/PIIDetector');
const EncryptionManager = require('../services/EncryptionManager');
const RBACManager = require('../services/RBACManager');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

class ComplianceMiddleware {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.complianceConfig = this.config?.compliance || {
      enablePiiRedaction: true,
      enableDataEncryption: true,
      enableAuditLogging: true,
      enableRateLimiting: true,
      enableSecurityHeaders: true,
      enableCors: true,
      enableViolationDetection: true,
      sessionTimeout: 3600000, // 1 hour
      maxRequestSize: 10 * 1024 * 1024, // 10MB in bytes
      allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100, // requests per window
    };
    
    this.auditLogger = new AuditLogger();
    this.piiDetector = new PIIDetector();
    this.encryptionManager = new EncryptionManager();
    this.rbacManager = new RBACManager();
    this.initialized = false;
  }

  /**
   * Initialize compliance middleware
   */
  async initialize() {
    try {
      await this.encryptionManager.initialize();
      await this.rbacManager.initialize();
      
      this.initialized = true;
      logger.info('Compliance Middleware initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Compliance Middleware:', error);
      throw error;
    }
  }

  /**
   * Session tracking middleware
   */
  sessionTracking() {
    return (req, res, next) => {
      try {
        // Generate or retrieve session ID
        if (!req.session) {
          req.session = {};
        }
        
        if (!req.session.id) {
          req.session.id = uuidv4();
          req.session.startTime = new Date();
        }
        
        // Update last activity
        req.session.lastActivity = new Date();
        
        // Add session info to request
        req.sessionInfo = {
          sessionId: req.session.id,
          startTime: req.session.startTime,
          lastActivity: req.session.lastActivity,
          ipAddress: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
        };
        
        next();

      } catch (error) {
        logger.error('Session tracking middleware error:', error);
        next();
      }
    };
  }

  /**
   * Audit logging middleware
   */
  auditLogging() {
    return async (req, res, next) => {
      try {
        // Skip audit logging for health checks and static assets
        if (this.shouldSkipAudit(req.path)) {
          return next();
        }

        const startTime = Date.now();
        
        // Store original res.json to intercept response
        const originalJson = res.json;
        let responseBody = null;
        
        res.json = function(body) {
          responseBody = body;
          return originalJson.call(this, body);
        };
        
        // Continue to next middleware
        next();
        
        // Log after response is sent
        res.on('finish', async () => {
          try {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            // Prepare audit data
            const auditData = {
              sessionId: req.sessionInfo?.sessionId,
              method: req.method,
              path: req.path,
              query: req.query,
              body: this.sanitizeRequestBody(req.body),
              response: this.sanitizeResponseBody(responseBody),
              statusCode: res.statusCode,
              responseTime,
              ipAddress: req.sessionInfo?.ipAddress,
              userAgent: req.sessionInfo?.userAgent,
              userId: req.user?.id,
              username: req.user?.username,
              timestamp: new Date().toISOString(),
            };
            
            // Check for PII in request/response
            if (this.complianceConfig.enablePiiRedaction) {
              auditData.piiDetected = this.detectPII(auditData);
            }
            
            // Log the audit data
            await this.logAuditEvent('api_request', auditData);

          } catch (error) {
            logger.error('Audit logging error:', error);
          }
        });

      } catch (error) {
        logger.error('Audit logging middleware error:', error);
        next();
      }
    };
  }

  /**
   * PII detection and redaction middleware
   */
  piiProtection() {
    return async (req, res, next) => {
      try {
        if (!this.complianceConfig.enablePiiRedaction) {
          return next();
        }

        // Redact PII from request body
        if (req.body) {
          req.body = await this.redactPII(req.body);
        }
        
        // Redact PII from query parameters
        if (req.query) {
          req.query = await this.redactPII(req.query);
        }
        
        // Store original res.json to intercept and redact response
        const originalJson = res.json;
        const self = this; // Capture ComplianceMiddleware instance
        
        res.json = async function(body) {
          const redactedBody = await self.redactPII(body);
          return originalJson.call(this, redactedBody);
        };
        
        next();

      } catch (error) {
        logger.error('PII protection middleware error:', error);
        next();
      }
    };
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req, res, next) => {
      try {
        // Set security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        
        // HSTS header for HTTPS
        if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        
        // Content Security Policy
        const csp = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
        ].join('; ');
        
        res.setHeader('Content-Security-Policy', csp);
        
        next();

      } catch (error) {
        logger.error('Security headers middleware error:', error);
        next();
      }
    };
  }

  /**
   * Rate limiting middleware factory
   */
  createRateLimit(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id?.toString() || this.getClientIP(req);
      },
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
      },
      handler: (req, res, next, options) => {
        logger.warn('Rate limit exceeded', {
          ip: this.getClientIP(req),
          userId: req.user?.id,
          path: req.path,
          method: req.method,
        });
        
        // Log rate limit violation
        this.logAuditEvent('rate_limit_exceeded', {
          ip: this.getClientIP(req),
          userId: req.user?.id,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
        
        // Send rate limit response
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.round(options.windowMs / 1000)
        });
      },
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Input validation and sanitization middleware
   */
  inputValidation() {
    return (req, res, next) => {
      try {
        // Sanitize and validate request body
        if (req.body) {
          req.body = this.sanitizeInput(req.body);
        }
        
        // Sanitize query parameters
        if (req.query) {
          req.query = this.sanitizeInput(req.query);
        }
        
        // Validate content length
        const contentLength = parseInt(req.get('Content-Length') || '0', 10);
        const maxSize = this.complianceConfig.maxRequestSize || 10 * 1024 * 1024; // 10MB default
        
        if (contentLength > maxSize) {
          return res.status(413).json({
            error: 'Request entity too large',
            maxSize: `${maxSize} bytes`,
          });
        }
        
        next();

      } catch (error) {
        logger.error('Input validation middleware error:', error);
        res.status(400).json({ error: 'Invalid request format' });
      }
    };
  }

  /**
   * CORS middleware with compliance considerations
   */
  corsMiddleware() {
    return (req, res, next) => {
      try {
        const allowedOrigins = this.complianceConfig.allowedOrigins || ['http://localhost:3000'];
        const origin = req.get('Origin');
        
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
        }
        
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }
        
        next();

      } catch (error) {
        logger.error('CORS middleware error:', error);
        next();
      }
    };
  }

  /**
   * Data encryption middleware for sensitive endpoints
   */
  dataEncryption() {
    return (req, res, next) => {
      try {
        if (!this.complianceConfig.enableDataEncryption) {
          return next();
        }

        // Encrypt sensitive request data
        if (req.body && this.isSensitiveEndpoint(req.path)) {
          req.body = this.encryptSensitiveData(req.body);
        }
        
        // Store original res.json to encrypt response
        const originalJson = res.json;
        const self = this; // Capture ComplianceMiddleware instance
        
        res.json = function(body) {
          if (self.isSensitiveEndpoint(req.path)) {
            const encryptedBody = self.encryptSensitiveData(body);
            return originalJson.call(this, encryptedBody);
          }
          return originalJson.call(this, body);
        };
        
        next();

      } catch (error) {
        logger.error('Data encryption middleware error:', error);
        next();
      }
    };
  }

  /**
   * Compliance violation detection middleware
   */
  complianceViolationDetection() {
    return async (req, res, next) => {
      try {
        const violations = [];
        
        // Check for potential compliance violations
        
        // 1. Unauthorized data access patterns
        if (this.detectUnauthorizedAccess(req)) {
          violations.push('unauthorized_access_pattern');
        }
        
        // 2. Suspicious query patterns
        if (this.detectSuspiciousQueries(req)) {
          violations.push('suspicious_query_pattern');
        }
        
        // 3. Data exfiltration patterns
        if (this.detectDataExfiltration(req)) {
          violations.push('potential_data_exfiltration');
        }
        
        // 4. PII exposure
        if (this.detectPIIExposure(req)) {
          violations.push('pii_exposure_risk');
        }
        
        // Log violations
        if (violations.length > 0) {
          await this.logComplianceViolation(req, violations);
          
          // Optionally block request based on severity
          if (this.shouldBlockRequest(violations)) {
            return res.status(403).json({
              error: 'Request blocked due to compliance violation',
              code: 'COMPLIANCE_VIOLATION',
            });
          }
        }
        
        next();

      } catch (error) {
        logger.error('Compliance violation detection error:', error);
        next();
      }
    };
  }

  /**
   * Helper methods
   */

  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
           req.get('X-Real-IP') ||
           'unknown';
  }

  shouldSkipAudit(path) {
    const skipPaths = [
      '/health',
      '/api/health',
      '/favicon.ico',
      '/robots.txt',
      '/static/',
      '/assets/',
    ];
    
    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  sanitizeRequestBody(body) {
    if (!body) return body;
    
    // Remove sensitive fields from audit logs
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  sanitizeResponseBody(body) {
    if (!body) return body;
    
    // Limit response body size in audit logs
    const maxSize = 1000; // characters
    const stringified = JSON.stringify(body);
    
    if (stringified.length > maxSize) {
      return `${stringified.substring(0, maxSize)}... [TRUNCATED]`;
    }
    
    return body;
  }

  detectPII(data) {
    const dataString = JSON.stringify(data);
    return this.piiDetector.containsPII(dataString);
  }

  async redactPII(data) {
    if (typeof data === 'string') {
      return await this.piiDetector.redact(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      const redacted = {};
      for (const [key, value] of Object.entries(data)) {
        redacted[key] = await this.redactPII(value);
      }
      return redacted;
    }
    
    return data;
  }

  sanitizeInput(input) {
    if (typeof input === 'string') {
      // Basic XSS prevention
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  isSensitiveEndpoint(path) {
    const sensitiveEndpoints = [
      '/api/chat',
      '/api/audit',
      '/api/users',
      '/api/admin',
    ];
    
    return sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
  }

  encryptSensitiveData(data) {
    try {
      return this.encryptionManager.encrypt(data, 'session');
    } catch (error) {
      logger.error('Failed to encrypt sensitive data:', error);
      return data;
    }
  }

  detectUnauthorizedAccess(req) {
    // Implement logic to detect unauthorized access patterns
    // This is a placeholder - implement based on your security requirements
    return false;
  }

  detectSuspiciousQueries(req) {
    // Implement logic to detect suspicious query patterns
    // This is a placeholder - implement based on your security requirements
    return false;
  }

  detectDataExfiltration(req) {
    // Implement logic to detect potential data exfiltration
    // This is a placeholder - implement based on your security requirements
    return false;
  }

  detectPIIExposure(req) {
    // Check if request might expose PII
    if (req.body || req.query) {
      const data = JSON.stringify({ body: req.body, query: req.query });
      return this.piiDetector.containsPII(data);
    }
    return false;
  }

  shouldBlockRequest(violations) {
    const highSeverityViolations = [
      'potential_data_exfiltration',
      'unauthorized_access_pattern',
    ];
    
    return violations.some(violation => highSeverityViolations.includes(violation));
  }

  async logAuditEvent(eventType, data) {
    try {
      // Ensure query is a string
      let queryString = '';
      if (typeof data.query === 'string') {
        queryString = data.query;
      } else if (data.query && typeof data.query === 'object') {
        queryString = JSON.stringify(data.query);
      } else if (data.path) {
        queryString = data.path;
      } else {
        queryString = `${data.method || 'GET'} ${data.path || '/'}`;
      }
      
      // Ensure response is a string
      let responseString = '';
      if (typeof data.response === 'string') {
        responseString = data.response;
      } else if (data.response && typeof data.response === 'object') {
        responseString = JSON.stringify(data.response);
      } else if (data.statusCode) {
        responseString = `HTTP ${data.statusCode}`;
      } else {
        responseString = 'No response data';
      }

      await this.auditLogger.logInteraction({
        sessionId: data.sessionId || 'unknown-session',
        query: queryString,
        response: responseString,
        confidenceScore: data.confidenceScore || null,
        responseTime: data.responseTime || 0,
        modelVersion: data.modelVersion || 'N/A',
        userAgent: data.userAgent || 'Unknown',
        ipAddress: data.ipAddress || 'Unknown',
        metadata: {
          eventType,
          method: data.method,
          statusCode: data.statusCode,
          userId: data.userId,
          username: data.username,
          piiDetected: data.piiDetected,
          ...data.metadata,
        },
      });
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  async logComplianceViolation(req, violations) {
    try {
      await this.logAuditEvent('compliance_violation', {
        sessionId: req.sessionInfo?.sessionId,
        path: req.path,
        method: req.method,
        ipAddress: req.sessionInfo?.ipAddress,
        userAgent: req.sessionInfo?.userAgent,
        userId: req.user?.id,
        username: req.user?.username,
        metadata: {
          violations,
          body: this.sanitizeRequestBody(req.body),
          query: req.query,
        },
      });
      
      logger.warn('Compliance violation detected', {
        violations,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        ip: req.sessionInfo?.ipAddress,
      });

    } catch (error) {
      logger.error('Failed to log compliance violation:', error);
    }
  }

  /**
   * Create middleware stack for compliance
   */
  createComplianceStack() {
    const middlewares = [];
    
    // Session tracking (always first)
    middlewares.push(this.sessionTracking());
    
    // Security headers
    middlewares.push(this.securityHeaders());
    
    // CORS
    middlewares.push(this.corsMiddleware());
    
    // Input validation
    middlewares.push(this.inputValidation());
    
    // Rate limiting
    middlewares.push(this.createRateLimit());
    
    // PII protection
    if (this.complianceConfig.enablePiiRedaction) {
      middlewares.push(this.piiProtection());
    }
    
    // Data encryption
    if (this.complianceConfig.enableDataEncryption) {
      middlewares.push(this.dataEncryption());
    }
    
    // Compliance violation detection
    if (this.complianceConfig.enableViolationDetection) {
      middlewares.push(this.complianceViolationDetection());
    }
    
    // Audit logging (should be last before route handlers)
    middlewares.push(this.auditLogging());
    
    return middlewares;
  }

  /**
   * Close and cleanup
   */
  async close() {
    await this.encryptionManager.close();
    await this.rbacManager.close();
    
    this.initialized = false;
    logger.info('Compliance Middleware closed');
  }
}

module.exports = ComplianceMiddleware;
