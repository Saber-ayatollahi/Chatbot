/**
 * Logger Utility Module
 * Comprehensive logging system with multiple transports and formatting
 * Phase 1: Foundation & Infrastructure Setup
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs-extra');
const { getConfig } = require('../config/environment');

class Logger {
  constructor() {
    this.config = null;
    this.logger = null;
    this.initialized = false;
    this.initializeLogger();
  }

  /**
   * Initialize Winston logger with configuration
   */
  initializeLogger() {
    try {
      // Get configuration (with fallbacks for early initialization)
      try {
        this.config = getConfig();
      } catch (error) {
        // Use defaults if config not available
        this.config = {
          get: (key) => {
            const defaults = {
              'logging.level': 'info',
              'logging.logFilePath': './logs/app.log',
              'logging.maxSize': '10m',
              'logging.maxFiles': 5,
              'app.environment': 'development'
            };
            return defaults[key];
          }
        };
      }

      // Ensure log directory exists
      const logDir = path.dirname(this.config.get('logging.logFilePath'));
      fs.ensureDirSync(logDir);

      // Define log format
      const logFormat = winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let logMessage = `${timestamp} [${level.toUpperCase()}]`;
          
          // Add service/module info if available
          if (meta.service) {
            logMessage += ` [${meta.service}]`;
          }
          
          logMessage += `: ${message}`;
          
          // Add stack trace for errors
          if (stack) {
            logMessage += `\n${stack}`;
          }
          
          // Add metadata if present
          if (Object.keys(meta).length > 0) {
            const cleanMeta = { ...meta };
            delete cleanMeta.service;
            if (Object.keys(cleanMeta).length > 0) {
              logMessage += `\n${JSON.stringify(cleanMeta, null, 2)}`;
            }
          }
          
          return logMessage;
        })
      );

      // Console format for development
      const consoleFormat = winston.format.combine(
        winston.format.timestamp({
          format: 'HH:mm:ss'
        }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service }) => {
          let logMessage = `${timestamp} ${level}`;
          if (service) {
            logMessage += ` [${service}]`;
          }
          logMessage += `: ${message}`;
          return logMessage;
        })
      );

      // Create transports
      const transports = [];

      // Console transport
      transports.push(new winston.transports.Console({
        level: this.config.get('app.environment') === 'production' ? 'warn' : 'debug',
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
      }));

      // File transport with rotation
      transports.push(new DailyRotateFile({
        filename: this.config.get('logging.logFilePath').replace('.log', '-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: this.config.get('logging.maxSize'),
        maxFiles: this.config.get('logging.maxFiles'),
        level: this.config.get('logging.level'),
        format: logFormat,
        handleExceptions: true,
        handleRejections: true,
        zippedArchive: true
      }));

      // Error file transport
      transports.push(new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: this.config.get('logging.maxSize'),
        maxFiles: this.config.get('logging.maxFiles'),
        level: 'error',
        format: logFormat,
        handleExceptions: true,
        handleRejections: true,
        zippedArchive: true
      }));

      // Create logger instance
      this.logger = winston.createLogger({
        level: this.config.get('logging.level'),
        format: logFormat,
        transports: transports,
        exitOnError: false
      });

      // Handle uncaught exceptions and rejections
      this.logger.exceptions.handle(
        new winston.transports.File({ 
          filename: path.join(logDir, 'exceptions.log'),
          format: logFormat
        })
      );

      this.logger.rejections.handle(
        new winston.transports.File({ 
          filename: path.join(logDir, 'rejections.log'),
          format: logFormat
        })
      );

      this.initialized = true;
      this.info('Logger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize logger:', error);
      // Fallback to console logging
      this.logger = console;
      this.initialized = false;
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    if (this.initialized) {
      this.logger.debug(message, meta);
    } else {
      console.debug(`[DEBUG] ${message}`, meta);
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    if (this.initialized) {
      this.logger.info(message, meta);
    } else {
      console.info(`[INFO] ${message}`, meta);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    if (this.initialized) {
      this.logger.warn(message, meta);
    } else {
      console.warn(`[WARN] ${message}`, meta);
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or metadata
   */
  error(message, error = {}) {
    if (this.initialized) {
      if (error instanceof Error) {
        this.logger.error(message, { 
          error: error.message, 
          stack: error.stack,
          name: error.name
        });
      } else {
        this.logger.error(message, error);
      }
    } else {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  /**
   * Log fatal error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or metadata
   */
  fatal(message, error = {}) {
    if (this.initialized) {
      if (error instanceof Error) {
        this.logger.error(`[FATAL] ${message}`, { 
          error: error.message, 
          stack: error.stack,
          name: error.name,
          fatal: true
        });
      } else {
        this.logger.error(`[FATAL] ${message}`, { ...error, fatal: true });
      }
    } else {
      console.error(`[FATAL] ${message}`, error);
    }
  }

  /**
   * Create child logger with service context
   * @param {string} service - Service name
   * @returns {Object} Child logger
   */
  child(service) {
    const childLogger = {
      debug: (message, meta = {}) => this.debug(message, { ...meta, service }),
      info: (message, meta = {}) => this.info(message, { ...meta, service }),
      warn: (message, meta = {}) => this.warn(message, { ...meta, service }),
      error: (message, error = {}) => this.error(message, error instanceof Error ? error : { ...error, service }),
      fatal: (message, error = {}) => this.fatal(message, error instanceof Error ? error : { ...error, service })
    };

    return childLogger;
  }

  /**
   * Log HTTP request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} responseTime - Response time in milliseconds
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('Content-Length') || 0
    };

    const message = `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`;

    if (res.statusCode >= 400) {
      this.warn(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  /**
   * Log database query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @param {number} duration - Query duration in milliseconds
   */
  logQuery(query, params = [], duration) {
    const meta = {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      paramCount: params.length,
      duration: `${duration}ms`
    };

    if (duration > 1000) {
      this.warn(`Slow query detected`, meta);
    } else if (this.config && this.config.get('logging.logQueries')) {
      this.debug(`Database query executed`, meta);
    }
  }

  /**
   * Log API call to external service
   * @param {string} service - Service name
   * @param {string} endpoint - API endpoint
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration in milliseconds
   * @param {Object} meta - Additional metadata
   */
  logApiCall(service, endpoint, statusCode, duration, meta = {}) {
    const logMeta = {
      service,
      endpoint,
      statusCode,
      duration: `${duration}ms`,
      ...meta
    };

    const message = `API call to ${service}: ${endpoint} ${statusCode} ${duration}ms`;

    if (statusCode >= 400) {
      this.error(message, logMeta);
    } else if (duration > 5000) {
      this.warn(`Slow API call: ${message}`, logMeta);
    } else {
      this.info(message, logMeta);
    }
  }

  /**
   * Log performance metric
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} meta - Additional metadata
   */
  logPerformance(operation, duration, meta = {}) {
    const logMeta = {
      operation,
      duration: `${duration}ms`,
      ...meta
    };

    if (duration > 10000) {
      this.warn(`Slow operation: ${operation} took ${duration}ms`, logMeta);
    } else {
      this.debug(`Performance: ${operation} completed in ${duration}ms`, logMeta);
    }
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} details - Event details
   */
  logSecurity(event, details = {}) {
    this.warn(`Security event: ${event}`, {
      securityEvent: true,
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log business event
   * @param {string} event - Business event type
   * @param {Object} details - Event details
   */
  logBusiness(event, details = {}) {
    this.info(`Business event: ${event}`, {
      businessEvent: true,
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLevel() {
    return this.initialized ? this.logger.level : 'info';
  }

  /**
   * Set log level
   * @param {string} level - New log level
   */
  setLevel(level) {
    if (this.initialized) {
      this.logger.level = level;
      this.info(`Log level changed to: ${level}`);
    }
  }

  /**
   * Flush all log transports
   * @returns {Promise} Promise that resolves when all transports are flushed
   */
  async flush() {
    if (this.initialized && this.logger.end) {
      return new Promise((resolve) => {
        this.logger.end(resolve);
      });
    }
  }

  /**
   * Get logger statistics
   * @returns {Object} Logger statistics
   */
  getStats() {
    if (!this.initialized) {
      return { initialized: false };
    }

    return {
      initialized: true,
      level: this.logger.level,
      transportCount: this.logger.transports.length,
      transports: this.logger.transports.map(transport => ({
        name: transport.name,
        level: transport.level,
        filename: transport.filename
      }))
    };
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the instance and the class
module.exports = logger;
module.exports.Logger = Logger;
