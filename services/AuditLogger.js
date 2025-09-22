/**
 * Comprehensive Audit Logging System
 * Logs all user interactions with PII redaction and compliance features
 */

const crypto = require('crypto');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const PIIDetector = require('./PIIDetector');

class AuditLogger {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    const connectionString = this.config?.database?.url || 
                            process.env.DATABASE_URL || 
                            'postgresql://localhost:5432/fund_chatbot';
    
    this.pool = new Pool({ 
      connectionString: connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.piiDetector = new PIIDetector();
    this.encryptionKey = this.config?.audit?.encryptionKey || this.generateEncryptionKey();
    this.retentionDays = this.config?.audit?.retentionDays || 365;
    
    // Robust OpenAI configuration handling for both runtime and test environments
    this.openaiConfig = {
      chatModel: this.config?.get?.('openai.chatModel') || this.config?.openai?.chatModel || 'gpt-4',
      embeddingModel: this.config?.get?.('openai.embeddingModel') || this.config?.openai?.embeddingModel || 'text-embedding-3-large',
      apiKey: this.config?.get?.('openai.apiKey') || this.config?.openai?.apiKey || process.env.OPENAI_API_KEY || 'test-key-12345-development',
    };
  }

  /**
   * Log a complete user interaction
   */
  async logInteraction(interactionData) {
    const startTime = Date.now();
    
    try {
      // Validate required fields
      this.validateInteractionData(interactionData);

      // Create comprehensive audit log entry
      const logEntry = await this.createAuditLogEntry(interactionData);

      // Store in database with encryption
      const auditId = await this.storeAuditLog(logEntry);

      // Log performance metrics
      const duration = Date.now() - startTime;
      logger.info(`Audit log stored successfully`, {
        auditId,
        sessionId: interactionData.sessionId,
        duration: `${duration}ms`,
      });

      return auditId;

    } catch (error) {
      logger.error('Failed to log interaction:', {
        error: error.message,
        sessionId: interactionData.sessionId,
        stack: error.stack,
      });
      
      // Store error in separate error log table (gracefully handle this too)
      try {
        await this.logAuditError(interactionData, error);
      } catch (logError) {
        logger.error('Failed to log audit error:', logError);
      }
      
      // Don't throw - handle gracefully for user experience
      return null;
    }
  }

  /**
   * Create comprehensive audit log entry
   */
  async createAuditLogEntry(data) {
    const timestamp = new Date().toISOString();
    
    // Redact PII from user query
    const sanitizedQuery = await this.redactPII(data.query);
    
    // Redact PII from response
    const sanitizedResponse = await this.redactPII(data.response);

    // Create base log entry
    const logEntry = {
      // Core interaction data
      session_id: data.sessionId,
      message_id: data.messageId || this.generateMessageId(),
      user_query: sanitizedQuery,
      user_query_hash: this.hashContent(data.query),
      final_response: sanitizedResponse,
      final_response_hash: this.hashContent(data.response),
      
      // RAG system data
      retrieved_chunks: this.sanitizeChunks(data.retrievedChunks || []),
      citations: this.sanitizeCitations(data.citations || []),
      sources: this.sanitizeSources(data.sources || []),
      
      // Quality and performance metrics
      confidence_score: data.confidenceScore || 0,
      accuracy_score: data.accuracyScore || null,
      response_time_ms: data.responseTime || 0,
      token_count: data.tokenCount || 0,
      
      // System metadata
      model_version: data.modelVersion || this.openaiConfig.chatModel,
      embedding_model: data.embeddingModel || this.openaiConfig.embeddingModel,
      retrieval_strategy: data.retrievalStrategy || 'hybrid',
      template_type: data.templateType || 'standard',
      
      // Request context
      user_agent: this.sanitizeUserAgent(data.userAgent),
      ip_address: this.hashIP(data.ipAddress),
      request_id: data.requestId || this.generateRequestId(),
      
      // Compliance flags
      pii_detected: sanitizedQuery !== data.query || sanitizedResponse !== data.response,
      content_flags: await this.detectContentFlags(data),
      compliance_status: 'compliant',
      
      // Timestamps
      timestamp: timestamp,
      created_at: timestamp,
      retention_until: this.calculateRetentionDate(timestamp),
      
      // Additional metadata
      metadata: this.encryptSensitiveData({
        original_query_length: data.query?.length || 0,
        original_response_length: data.response?.length || 0,
        retrieval_metadata: data.retrievalMetadata || {},
        generation_metadata: data.generationMetadata || {},
        quality_indicators: data.qualityIndicators || {},
        fallback_applied: data.fallbackApplied || false,
        error_occurred: !!data.error,
        user_feedback: data.userFeedback || null,
      }),
    };

    // Add PII detection details if any found
    if (logEntry.pii_detected) {
      logEntry.pii_details = await this.createPIIReport(data.query, data.response);
    }

    return logEntry;
  }

  /**
   * Store audit log in database with encryption
   */
  async storeAuditLog(logEntry) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert main audit log entry
      const auditQuery = `
        INSERT INTO audit_logs (
          session_id, message_id, user_query, user_query_hash,
          final_response, final_response_hash, retrieved_chunks,
          citations, sources, confidence_score, accuracy_score,
          response_time_ms, token_count, model_version, embedding_model,
          retrieval_strategy, template_type, user_agent, ip_address,
          request_id, pii_detected, content_flags, compliance_status,
          timestamp, created_at, retention_until, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        ) RETURNING id
      `;

      const auditValues = [
        logEntry.session_id,
        logEntry.message_id,
        logEntry.user_query,
        logEntry.user_query_hash,
        logEntry.final_response,
        logEntry.final_response_hash,
        JSON.stringify(logEntry.retrieved_chunks),
        JSON.stringify(logEntry.citations),
        JSON.stringify(logEntry.sources),
        logEntry.confidence_score,
        logEntry.accuracy_score,
        logEntry.response_time_ms,
        logEntry.token_count,
        logEntry.model_version,
        logEntry.embedding_model,
        logEntry.retrieval_strategy,
        logEntry.template_type,
        logEntry.user_agent,
        logEntry.ip_address,
        logEntry.request_id,
        logEntry.pii_detected,
        JSON.stringify(logEntry.content_flags),
        logEntry.compliance_status,
        logEntry.timestamp,
        logEntry.created_at,
        logEntry.retention_until,
        logEntry.metadata,
      ];

      const result = await client.query(auditQuery, auditValues);
      const auditId = result.rows[0].id;

      // Store PII details if detected
      if (logEntry.pii_detected && logEntry.pii_details) {
        await this.storePIIDetails(client, auditId, logEntry.pii_details);
      }

      // Update session statistics
      await this.updateSessionStats(client, logEntry.session_id, logEntry);

      await client.query('COMMIT');
      return auditId;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to store audit log:', error);
      throw new Error('Failed to store audit log');
    } finally {
      client.release();
    }
  }

  /**
   * Advanced PII detection and redaction
   */
  async redactPII(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    try {
      // Use PIIDetector service for comprehensive detection
      const detectionResult = await this.piiDetector.detectAndRedact(text);
      
      return detectionResult.redactedText;
    } catch (error) {
      logger.error('PII redaction failed:', error);
      // Fallback to basic redaction
      return this.basicPIIRedaction(text);
    }
  }

  /**
   * Basic PII redaction as fallback
   */
  basicPIIRedaction(text) {
    let redacted = text;

    // Email addresses
    redacted = redacted.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );

    // Phone numbers (various formats)
    redacted = redacted.replace(
      /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      '[PHONE_REDACTED]'
    );

    // Social Security Numbers
    redacted = redacted.replace(
      /\b\d{3}-\d{2}-\d{4}\b/g,
      '[SSN_REDACTED]'
    );

    // Credit card numbers (basic pattern)
    redacted = redacted.replace(
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      '[CARD_REDACTED]'
    );

    // Account numbers (8+ consecutive digits)
    redacted = redacted.replace(
      /\b\d{8,}\b/g,
      '[ACCOUNT_REDACTED]'
    );

    return redacted;
  }

  /**
   * Hash IP address for privacy
   */
  hashIP(ipAddress) {
    if (!ipAddress) return null;
    
    const hash = crypto.createHash('sha256');
    const ipSalt = this.config?.audit?.ipSalt || this.config?.get?.('audit.ipSalt') || 'default-ip-salt-for-hashing';
    hash.update(ipAddress + ipSalt);
    return hash.digest('hex'); // Full SHA-256 hash (64 characters)
  }

  /**
   * Hash content for integrity verification
   */
  hashContent(content) {
    if (!content) return null;
    
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Sanitize user agent string
   */
  sanitizeUserAgent(userAgent) {
    if (!userAgent) return null;
    
    // Remove potentially identifying information but keep browser/OS info
    return userAgent.replace(/\d+\.\d+\.\d+/g, 'X.X.X'); // Version numbers
  }

  /**
   * Sanitize retrieved chunks for logging
   */
  sanitizeChunks(chunks) {
    return chunks.map(chunk => ({
      id: chunk.id,
      source_id: chunk.source_id,
      similarity_score: chunk.similarity_score,
      chunk_index: chunk.chunk_index,
      content_preview: chunk.content ? chunk.content.substring(0, 200) + '...' : null,
      metadata: {
        page_number: chunk.page_number,
        heading: chunk.heading,
        category: chunk.category,
      },
    }));
  }

  /**
   * Sanitize citations for logging
   */
  sanitizeCitations(citations) {
    return citations.map(citation => ({
      source: citation.source,
      page: citation.page,
      section: citation.section,
      relevance_score: citation.relevance_score,
      text_preview: citation.text ? citation.text.substring(0, 100) + '...' : null,
    }));
  }

  /**
   * Sanitize sources for logging
   */
  sanitizeSources(sources) {
    return sources.map(source => ({
      id: source.id,
      title: source.title,
      version: source.version,
      type: source.type,
      relevance_score: source.relevance_score,
    }));
  }

  /**
   * Detect content flags for compliance
   */
  async detectContentFlags(data) {
    const flags = [];

    // Check for potentially sensitive topics
    const sensitiveTopics = [
      'personal information',
      'confidential',
      'proprietary',
      'insider trading',
      'money laundering',
    ];

    const queryLower = (data.query || '').toLowerCase();
    const responseLower = (data.response || '').toLowerCase();

    sensitiveTopics.forEach(topic => {
      if (queryLower.includes(topic) || responseLower.includes(topic)) {
        flags.push({
          type: 'sensitive_topic',
          topic: topic,
          source: queryLower.includes(topic) ? 'query' : 'response',
        });
      }
    });

    // Check for low confidence responses
    if (data.confidenceScore && data.confidenceScore < 0.5) {
      flags.push({
        type: 'low_confidence',
        score: data.confidenceScore,
      });
    }

    // Check for errors
    if (data.error) {
      flags.push({
        type: 'error_occurred',
        error: data.error,
      });
    }

    // Check for fallback usage
    if (data.fallbackApplied) {
      flags.push({
        type: 'fallback_applied',
      });
    }

    return flags;
  }

  /**
   * Create PII detection report
   */
  async createPIIReport(query, response) {
    const report = {
      query_pii: await this.piiDetector.detect(query),
      response_pii: await this.piiDetector.detect(response),
      redaction_applied: true,
      detection_confidence: 'high',
      detection_timestamp: new Date().toISOString(),
    };

    return this.encryptSensitiveData(report);
  }

  /**
   * Store PII details in separate table
   */
  async storePIIDetails(client, auditId, piiDetails) {
    const query = `
      INSERT INTO audit_pii_details (
        audit_log_id, pii_report, created_at
      ) VALUES ($1, $2, $3)
    `;

    await client.query(query, [
      auditId,
      piiDetails,
      new Date().toISOString(),
    ]);
  }

  /**
   * Update session statistics
   */
  async updateSessionStats(client, sessionId, logEntry) {
    const upsertQuery = `
      INSERT INTO audit_session_stats (
        session_id, total_interactions, total_tokens, avg_confidence,
        avg_response_time, pii_detections, error_count, last_interaction,
        created_at, updated_at
      ) VALUES (
        $1, 1, $2, $3, $4, $5, $6, $7, $8, $8
      ) ON CONFLICT (session_id) DO UPDATE SET
        total_interactions = audit_session_stats.total_interactions + 1,
        total_tokens = audit_session_stats.total_tokens + $2,
        avg_confidence = (audit_session_stats.avg_confidence * audit_session_stats.total_interactions + $3) / (audit_session_stats.total_interactions + 1),
        avg_response_time = (audit_session_stats.avg_response_time * audit_session_stats.total_interactions + $4) / (audit_session_stats.total_interactions + 1),
        pii_detections = audit_session_stats.pii_detections + $5,
        error_count = audit_session_stats.error_count + $6,
        last_interaction = $7,
        updated_at = $8
    `;

    const values = [
      sessionId,
      logEntry.token_count || 0,
      logEntry.confidence_score || 0,
      logEntry.response_time_ms || 0,
      logEntry.pii_detected ? 1 : 0,
      (logEntry.content_flags && Array.isArray(logEntry.content_flags)) ? 
        logEntry.content_flags.some(flag => flag.type === 'error_occurred') ? 1 : 0 : 0,
      logEntry.timestamp,
      new Date().toISOString(),
    ];

    await client.query(upsertQuery, values);
  }

  /**
   * Encrypt sensitive data
   */
  encryptSensitiveData(data) {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      logger.error('Failed to encrypt sensitive data:', error);
      return JSON.stringify(data); // Fallback to unencrypted
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt sensitive data:', error);
      return null;
    }
  }

  /**
   * Calculate retention date
   */
  calculateRetentionDate(timestamp) {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + this.retentionDays);
    return date.toISOString();
  }

  /**
   * Log audit errors
   */
  async logAuditError(interactionData, error) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO audit_errors (
          session_id, error_message, error_stack, interaction_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        interactionData.sessionId || 'unknown',
        error.message,
        error.stack,
        JSON.stringify({
          query_length: interactionData.query?.length || 0,
          response_length: interactionData.response?.length || 0,
          has_chunks: !!(interactionData.retrievedChunks?.length),
        }),
        new Date().toISOString(),
      ];

      await client.query(query, values);
      client.release();

    } catch (logError) {
      logger.error('Failed to log audit error:', logError);
    }
  }

  /**
   * Validate interaction data
   */
  validateInteractionData(data) {
    const required = ['sessionId', 'query', 'response'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof data.query !== 'string' || typeof data.response !== 'string') {
      throw new Error('Query and response must be strings');
    }
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters = {}, pagination = {}) {
    const {
      sessionId,
      dateFrom,
      dateTo,
      piiDetected,
      complianceStatus,
      minConfidence,
      maxConfidence,
    } = filters;

    const {
      page = 1,
      limit = 100,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = pagination;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Build WHERE clause dynamically
    if (sessionId) {
      whereClause += ` AND session_id = $${paramIndex++}`;
      queryParams.push(sessionId);
    }

    if (dateFrom) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(dateTo);
    }

    if (typeof piiDetected === 'boolean') {
      whereClause += ` AND pii_detected = $${paramIndex++}`;
      queryParams.push(piiDetected);
    }

    if (complianceStatus) {
      whereClause += ` AND compliance_status = $${paramIndex++}`;
      queryParams.push(complianceStatus);
    }

    if (typeof minConfidence === 'number') {
      whereClause += ` AND confidence_score >= $${paramIndex++}`;
      queryParams.push(minConfidence);
    }

    if (typeof maxConfidence === 'number') {
      whereClause += ` AND confidence_score <= $${paramIndex++}`;
      queryParams.push(maxConfidence);
    }

    // Main query
    const query = `
      SELECT 
        id, session_id, message_id, user_query, final_response,
        confidence_score, response_time_ms, pii_detected,
        compliance_status, created_at, model_version
      FROM audit_logs
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs
      ${whereClause}
    `;

    try {
      const client = await this.pool.connect();
      
      const [logsResult, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, queryParams.slice(0, -2)), // Remove limit/offset params
      ]);

      client.release();

      return logsResult.rows;

    } catch (error) {
      logger.error('Failed to retrieve audit logs:', error);
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get audit log count with filters
   */
  async getAuditLogCount(filters = {}) {
    try {
      const client = await this.pool.connect();
      
      let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
      const values = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.sessionId) {
        query += ` AND session_id = $${paramIndex}`;
        values.push(filters.sessionId);
        paramIndex++;
      }

      if (filters.dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        values.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        values.push(filters.dateTo);
        paramIndex++;
      }

      if (filters.piiDetected !== undefined) {
        query += ` AND pii_detected = $${paramIndex}`;
        values.push(filters.piiDetected);
        paramIndex++;
      }

      const result = await client.query(query, values);
      client.release();

      return parseInt(result.rows[0].count, 10);

    } catch (error) {
      logger.error('Failed to retrieve audit log count:', error);
      throw new Error('Failed to retrieve audit log count');
    }
  }

  /**
   * Get compliance statistics
   */
  async getComplianceStats(dateFrom, dateTo) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT 
          COUNT(*) as total_interactions,
          COUNT(CASE WHEN pii_detected = true THEN 1 END) as pii_detections,
          COUNT(CASE WHEN compliance_status = 'non_compliant' THEN 1 END) as compliance_violations,
          AVG(confidence_score) as avg_confidence,
          AVG(response_time_ms) as avg_response_time,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
      `;

      const result = await client.query(query, [dateFrom, dateTo]);
      client.release();

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to get compliance stats:', error);
      throw error;
    }
  }

  /**
   * Clean up expired audit logs
   */
  async cleanupExpiredLogs() {
    try {
      const client = await this.pool.connect();
      
      const query = `
        DELETE FROM audit_logs
        WHERE retention_until < NOW()
      `;

      const result = await client.query(query);
      client.release();

      logger.info(`Cleaned up ${result.rowCount} expired audit logs`);
      return result.rowCount;

    } catch (error) {
      logger.error('Failed to cleanup expired logs:', error);
      throw error;
    }
  }

  /**
   * Export audit data for compliance
   */
  async exportAuditData(filters = {}, format = 'json') {
    const { logs } = await this.getAuditLogs(filters, { limit: 10000 });
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    }
    
    return logs;
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = Object.keys(logs[0]).join(',');
    const rows = logs.map(log => 
      Object.values(log).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Close database connections
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = AuditLogger;
