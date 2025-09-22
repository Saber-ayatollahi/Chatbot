/**
 * Unit Tests for AuditLogger Service
 */

const AuditLogger = require('../../services/AuditLogger');
const PIIDetector = require('../../services/PIIDetector');
const { Pool } = require('pg');

// Mock dependencies
jest.mock('pg');
jest.mock('../../services/PIIDetector');
jest.mock('../../utils/logger');
jest.mock('../../config/environment');

describe('AuditLogger', () => {
  let auditLogger;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    // Setup mocks
    mockClient = {
      connect: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    Pool.mockImplementation(() => mockPool);

    // Mock PIIDetector
    PIIDetector.mockImplementation(() => ({
      redact: jest.fn((text) => text.replace(/test@example\.com/g, '[REDACTED_PII]')),
      detect: jest.fn(async (text) => ({
        detections: text.includes('test@example.com') ? [{ type: 'EMAIL', value: 'test@example.com' }] : [],
        hasDetections: text.includes('test@example.com'),
        summary: { totalDetections: text.includes('test@example.com') ? 1 : 0 }
      })),
      detectAndRedact: jest.fn(async (text) => ({
        redactedText: text.replace(/test@example\.com/g, '[REDACTED_PII]'),
        detections: text.includes('test@example.com') ? [{ type: 'EMAIL', value: 'test@example.com' }] : [],
        hasRedactions: text.includes('test@example.com'),
        summary: { totalDetections: text.includes('test@example.com') ? 1 : 0 }
      })),
    }));

    // Mock config
    require('../../config/environment').getConfig = jest.fn().mockReturnValue({
      database: { url: 'mock-database-url' },
      audit: { 
        encryptionKey: 'test-key',
        retentionDays: 365 
      },
    });

    auditLogger = new AuditLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeAuditLog', () => {
    it('should store audit log successfully', async () => {
      const mockLogEntry = {
        session_id: 'test-session',
        message_id: 'msg-123',
        user_query: 'Test query',
        user_query_hash: 'query-hash-123',
        retrieved_chunks: ['chunk1', 'chunk2'],
        citations: ['citation1'],
        sources: ['source1'],
        final_response: 'Test response',
        final_response_hash: 'response-hash-123',
        confidence_score: 0.95,
        accuracy_score: 0.9,
        response_time_ms: 150,
        token_count: 50,
        model_version: 'gpt-4',
        embedding_model: 'text-embedding-3-large',
        retrieval_strategy: 'semantic',
        template_type: 'standard',
        user_agent: 'test-agent',
        ip_address: '127.0.0.1',
        request_id: 'req-123',
        pii_detected: false,
        content_flags: [],
        compliance_status: 'compliant',
        timestamp: new Date().toISOString(),
        created_at: new Date(),
        retention_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        metadata: { test: true },
      };

      mockClient.query.mockResolvedValue({
        rows: [{ id: 'mock-audit-id' }],
      });

      const result = await auditLogger.storeAuditLog(mockLogEntry);

      expect(result).toBe('mock-audit-id');
      
      // Should be called with BEGIN, INSERT INTO audit_logs, INSERT INTO audit_session_stats, COMMIT
      expect(mockClient.query).toHaveBeenCalledTimes(4);
      
      // Check that INSERT INTO audit_logs was called with correct parameters
      const insertCall = mockClient.query.mock.calls.find(call => 
        call[0].includes('INSERT INTO audit_logs')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1]).toEqual(expect.arrayContaining([
        mockLogEntry.session_id,
        mockLogEntry.message_id,
        mockLogEntry.user_query,
        mockLogEntry.user_query_hash,
        mockLogEntry.final_response,
        mockLogEntry.final_response_hash,
      ]));
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockLogEntry = {
        session_id: 'test-session',
        user_query: 'Test query',
        final_response: 'Test response',
      };

      // Mock BEGIN to succeed, INSERT to fail
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(auditLogger.storeAuditLog(mockLogEntry)).rejects.toThrow('Failed to store audit log');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('logInteraction', () => {
    it('should log interaction with PII redaction', async () => {
      const mockInteractionData = {
        sessionId: 'test-session',
        query: 'My email is test@example.com',
        response: 'Response with test@example.com',
        confidenceScore: 0.85,
        responseTime: 200,
        modelVersion: 'gpt-4',
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1',
        metadata: { test: true },
      };

      mockClient.query.mockResolvedValue({
        rows: [{ id: 'mock-audit-id' }],
      });

      await auditLogger.logInteraction(mockInteractionData);

      // Check that INSERT INTO audit_logs was called with the session_id and redacted PII
      const insertCall = mockClient.query.mock.calls.find(call =>
        call[0].includes('INSERT INTO audit_logs')
      );
      expect(insertCall).toBeDefined();
      const params = insertCall[1];
      expect(params[0]).toBe(mockInteractionData.sessionId); // session_id
      expect(params[1]).toMatch(/^msg_/); // message_id (generated)
      expect(params[2]).toBe('My email is [REDACTED_PII]'); // user_query (PII redacted)
      expect(params[3]).toBeTruthy(); // user_query_hash (generated)
      expect(params[4]).toBe('Response with [REDACTED_PII]'); // final_response (PII redacted)
      expect(params[5]).toBeTruthy(); // final_response_hash (generated)
    });

    it('should handle logging errors gracefully', async () => {
      const mockInteractionData = {
        sessionId: 'test-session',
        query: 'Test query',
        response: 'Test response',
      };

      mockClient.query.mockRejectedValue(new Error('Database error'));

      // Should not throw error but return null on failure
      await expect(auditLogger.logInteraction(mockInteractionData)).resolves.toBeNull();
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'log1',
          session_id: 'session1',
          user_query: 'Query 1',
          final_response: 'Response 1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'log2',
          session_id: 'session2',
          user_query: 'Query 2',
          final_response: 'Response 2',
          created_at: new Date().toISOString(),
        },
      ];

      mockClient.query.mockResolvedValue({ rows: mockLogs });

      const filters = {
        sessionId: 'session1',
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-12-31T23:59:59.999Z',
      };

      const pagination = { limit: 10, offset: 0 };

      const result = await auditLogger.getAuditLogs(filters, pagination);

      expect(result).toEqual(mockLogs);
      // Check that the SELECT query was called with proper parameters
      const selectCall = mockClient.query.mock.calls.find(call =>
        call[0].includes('SELECT') && call[0].includes('FROM audit_logs')
      );
      expect(selectCall).toBeDefined();
      expect(selectCall[1]).toEqual(expect.arrayContaining([
        filters.sessionId,
        pagination.limit,
        pagination.offset,
      ]));
    });

    it('should handle empty results', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await auditLogger.getAuditLogs({}, { limit: 10, offset: 0 });

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(auditLogger.getAuditLogs({}, {})).rejects.toThrow('Failed to retrieve audit logs');
    });
  });

  describe('getAuditLogCount', () => {
    it('should return audit log count', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await auditLogger.getAuditLogCount({});

      expect(result).toBe(42);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM audit_logs WHERE 1=1'),
        []
      );
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(auditLogger.getAuditLogCount({})).rejects.toThrow('Failed to retrieve audit log count');
    });
  });

  describe('hashIP', () => {
    it('should hash IP address', () => {
      const ip = '192.168.1.1';
      const hashedIP = auditLogger.hashIP(ip);

      expect(hashedIP).toBeDefined();
      expect(hashedIP).not.toBe(ip);
      expect(typeof hashedIP).toBe('string');
      expect(hashedIP.length).toBe(64); // SHA-256 hex length
    });

    it('should return null for empty IP', () => {
      expect(auditLogger.hashIP(null)).toBeNull();
      expect(auditLogger.hashIP(undefined)).toBeNull();
      expect(auditLogger.hashIP('')).toBeNull();
    });
  });

  describe('redactPII', () => {
    it('should redact PII from text', async () => {
      const textWithPII = 'Contact me at test@example.com';
      const redacted = await auditLogger.redactPII(textWithPII);

      expect(redacted).toBe('Contact me at [REDACTED_PII]');
    });
  });
});
