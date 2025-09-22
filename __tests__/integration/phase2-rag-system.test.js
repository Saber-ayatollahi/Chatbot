/**
 * Phase 2 RAG System Integration Tests
 * Comprehensive testing for all Phase 2 components
 */

const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../config/database');
const { getConfig } = require('../../config/environment');
const RAGChatService = require('../../services/RAGChatService');
const ConfidenceManager = require('../../services/ConfidenceManager');
const CitationManager = require('../../knowledge/citations/CitationManager');
const VectorRetriever = require('../../knowledge/retrieval/VectorRetriever');
const RetrievalEngine = require('../../knowledge/retrieval/RetrievalEngine');
const PromptAssembler = require('../../knowledge/prompting/PromptAssembler');
const logger = require('../../utils/logger');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  testSessionId: 'test-phase2-integration',
  testQueries: [
    'How do I create a new fund?',
    'What are the steps for NAV calculation?',
    'What compliance requirements are needed?',
    'How do I set up fund hierarchy?'
  ]
};

describe('Phase 2 RAG System Integration Tests', () => {
  let app;
  let db;
  let config;
  let ragChatService;
  let confidenceManager;
  let citationManager;
  let vectorRetriever;
  let retrievalEngine;
  let promptAssembler;

  beforeAll(async () => {
    // Initialize configuration
    config = getConfig();
    
    // Initialize database
    db = getDatabase();
    await db.initialize();
    
    // Initialize services
    ragChatService = new RAGChatService();
    confidenceManager = new ConfidenceManager();
    citationManager = new CitationManager();
    vectorRetriever = new VectorRetriever();
    retrievalEngine = new RetrievalEngine();
    promptAssembler = new PromptAssembler();
    
    // Setup Express app for API testing
    app = express();
    app.use(express.json());
    app.use('/api/chat', require('../../routes/chat'));
    
    logger.info('🧪 Phase 2 integration test setup complete');
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.query('DELETE FROM audit_logs WHERE session_id LIKE $1', ['test-%']);
      await db.query('DELETE FROM conversations WHERE session_id LIKE $1', ['test-%']);
    } catch (error) {
      logger.warn('⚠️ Cleanup failed:', error.message);
    }
    
    logger.info('🧹 Phase 2 integration test cleanup complete');
  });

  describe('Vector Retrieval System', () => {
    test('should retrieve relevant chunks using vector similarity', async () => {
      const testQuery = 'fund creation process';
      
      const result = await vectorRetriever.retrieveRelevantChunks(testQuery, {
        topK: 5,
        similarityThreshold: 0.5
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('similarity_score');
        expect(result[0]).toHaveProperty('content');
        expect(result[0]).toHaveProperty('citation');
        expect(result[0].similarity_score).toBeGreaterThanOrEqual(0.5);
      }
    });

    test('should handle empty results gracefully', async () => {
      const testQuery = 'completely unrelated quantum physics topic';
      
      const result = await vectorRetriever.retrieveRelevantChunks(testQuery, {
        topK: 5,
        similarityThreshold: 0.9
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should provide retrieval statistics', async () => {
      const stats = await vectorRetriever.getRetrievalStats();
      
      if (stats) {
        expect(stats).toHaveProperty('totalChunks');
        expect(stats).toHaveProperty('totalSources');
        expect(stats).toHaveProperty('averageQuality');
        expect(typeof stats.totalChunks).toBe('number');
      }
    });
  });

  describe('Retrieval Engine', () => {
    test('should execute different retrieval strategies', async () => {
      const testQuery = 'How to create a fund?';
      const strategies = ['vector_only', 'hybrid', 'contextual'];
      
      for (const strategy of strategies) {
        const result = await retrievalEngine.retrieve(testQuery, {}, {
          strategy,
          maxResults: 3
        });
        
        expect(result).toBeDefined();
        expect(result).toHaveProperty('strategy', strategy);
        expect(result).toHaveProperty('chunks');
        expect(result).toHaveProperty('metadata');
        expect(Array.isArray(result.chunks)).toBe(true);
      }
    });

    test('should analyze queries correctly', async () => {
      const testQueries = [
        { query: 'What is NAV?', expectedType: 'definition' },
        { query: 'How to create a fund?', expectedType: 'procedure' },
        { query: 'List fund types', expectedType: 'list' }
      ];
      
      for (const { query, expectedType } of testQueries) {
        const result = await retrievalEngine.retrieve(query, {}, { maxResults: 1 });
        
        expect(result.queryAnalysis).toBeDefined();
        expect(result.queryAnalysis.queryType).toBeDefined();
        
        if (result.queryAnalysis.intent && result.queryAnalysis.intent.length > 0) {
          expect(result.queryAnalysis.intent).toContain(expectedType);
        }
      }
    });

    test('should provide engine statistics', async () => {
      const stats = await retrievalEngine.getEngineStats();
      
      if (stats) {
        expect(stats).toHaveProperty('availableStrategies');
        expect(stats).toHaveProperty('availableRerankingModels');
        expect(Array.isArray(stats.availableStrategies)).toBe(true);
        expect(Array.isArray(stats.availableRerankingModels)).toBe(true);
      }
    });
  });

  describe('Prompt Assembly System', () => {
    test('should assemble RAG prompts with citations', async () => {
      const testQuery = 'How do I create a fund?';
      const mockChunks = [
        {
          chunk_id: 'test-1',
          content: 'Fund creation requires several steps including name selection and hierarchy setup.',
          citation: { source: 'Test Guide', page: 1, section: 'Fund Creation' },
          similarity_score: 0.9,
          quality_score: 0.8
        }
      ];
      
      const result = await promptAssembler.assembleRAGPrompt(
        testQuery,
        mockChunks,
        [],
        { templateType: 'procedure' }
      );
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('citations');
      expect(result).toHaveProperty('metadata');
      expect(result.prompt).toHaveProperty('system');
      expect(result.prompt).toHaveProperty('user');
      expect(Array.isArray(result.citations)).toBe(true);
    });

    test('should handle different template types', async () => {
      const templates = ['standard', 'definition', 'procedure', 'comparison'];
      const mockChunks = [{
        chunk_id: 'test-1',
        content: 'Test content',
        citation: { source: 'Test', page: 1 },
        similarity_score: 0.8,
        quality_score: 0.7
      }];
      
      for (const templateType of templates) {
        const result = await promptAssembler.assembleRAGPrompt(
          'test query',
          mockChunks,
          [],
          { templateType }
        );
        
        expect(result.metadata.templateType).toBe(templateType);
      }
    });

    test('should validate token limits', async () => {
      const longContent = 'Very long content. '.repeat(1000);
      const mockChunks = [{
        chunk_id: 'test-long',
        content: longContent,
        citation: { source: 'Test', page: 1 },
        similarity_score: 0.8,
        quality_score: 0.7
      }];
      
      const result = await promptAssembler.assembleRAGPrompt(
        'test query',
        mockChunks,
        []
      );
      
      expect(result.metadata.tokenValidation).toBeDefined();
      expect(result.metadata.tokenValidation).toHaveProperty('isValid');
      expect(result.metadata.tokenValidation).toHaveProperty('totalTokens');
    });
  });

  describe('Citation Management', () => {
    test('should extract and validate citations', async () => {
      const testText = 'According to the Fund Manager User Guide (Guide 1, p.12), fund creation requires several steps.';
      const mockSources = [{
        chunk_id: 'test-1',
        citation: { source: 'Fund Manager User Guide', page: 12 },
        filename: 'guide1.pdf'
      }];
      
      const result = await citationManager.extractCitations(testText, mockSources);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalCitations');
      expect(result).toHaveProperty('validatedCitations');
      expect(result).toHaveProperty('qualityScore');
      expect(Array.isArray(result.validatedCitations)).toBe(true);
    });

    test('should format citations in different styles', async () => {
      const mockCitations = [{
        id: 1,
        source: 'Test Guide',
        page: 1,
        section: 'Introduction',
        isValid: true
      }];
      
      const formats = ['inline', 'academic', 'numbered', 'detailed'];
      
      for (const format of formats) {
        const formatted = citationManager.formatCitations(mockCitations, format);
        
        expect(Array.isArray(formatted)).toBe(true);
        expect(formatted[0]).toHaveProperty('formatted');
        expect(typeof formatted[0].formatted).toBe('string');
      }
    });

    test('should generate bibliography', async () => {
      const mockCitations = [
        { source: 'Guide 1', page: 1, isValid: true },
        { source: 'Guide 1', page: 2, isValid: true },
        { source: 'Guide 2', page: 5, isValid: true }
      ];
      
      const bibliography = citationManager.generateBibliography(mockCitations);
      
      expect(Array.isArray(bibliography)).toBe(true);
      expect(bibliography.length).toBeGreaterThan(0);
      expect(bibliography[0]).toHaveProperty('source');
      expect(bibliography[0]).toHaveProperty('formatted');
    });
  });

  describe('Confidence Management', () => {
    test('should calculate comprehensive confidence scores', async () => {
      const mockData = {
        retrievalData: {
          chunks: [
            { similarity_score: 0.85, quality_score: 0.9 },
            { similarity_score: 0.75, quality_score: 0.8 }
          ]
        },
        contentData: {
          response: 'Test response with citations (Test Guide, p.1)',
          citations: [{ isValid: true, source: 'Test Guide', page: 1 }]
        },
        contextData: {
          queryAnalysis: {
            hasQuestionWords: true,
            complexity: 'simple',
            entities: ['fund']
          }
        },
        generationData: {
          model: 'gpt-4',
          finishReason: 'stop',
          responseLength: 100
        }
      };
      
      const assessment = await confidenceManager.calculateConfidence(
        mockData.retrievalData,
        mockData.contentData,
        mockData.contextData,
        mockData.generationData
      );
      
      expect(assessment).toBeDefined();
      expect(assessment).toHaveProperty('overallConfidence');
      expect(assessment).toHaveProperty('confidenceLevel');
      expect(assessment).toHaveProperty('components');
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(assessment.overallConfidence).toBeLessThanOrEqual(1);
    });

    test('should apply fallback strategies', async () => {
      const strategies = [
        'low_retrieval_confidence',
        'no_relevant_sources',
        'poor_citation_quality',
        'query_ambiguity'
      ];
      
      for (const strategy of strategies) {
        const fallback = await confidenceManager.applyFallbackStrategy(strategy, {
          query: 'test query',
          originalResponse: 'test response',
          originalConfidence: 0.3
        });
        
        expect(fallback).toBeDefined();
        expect(fallback).toHaveProperty('strategy', strategy);
        expect(fallback).toHaveProperty('message');
        expect(fallback).toHaveProperty('confidence');
      }
    });

    test('should identify confidence issues', async () => {
      const lowConfidenceData = {
        retrieval: { score: 0.3, details: {} },
        content: { score: 0.4, details: { citationAccuracy: 0.5 } },
        context: { score: 0.5, details: { queryClarity: 0.3 } },
        generation: { score: 0.6, details: { finishReason: 0.5 } },
        overall: 0.4
      };
      
      const issues = confidenceManager.identifyConfidenceIssues(lowConfidenceData);
      
      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toHaveProperty('type');
      expect(issues[0]).toHaveProperty('severity');
    });
  });

  describe('RAG Chat Service', () => {
    test('should generate knowledge-based responses', async () => {
      const testQuery = 'How do I create a new fund?';
      
      const response = await ragChatService.generateResponse(
        testQuery,
        TEST_CONFIG.testSessionId,
        { useKnowledgeBase: true, maxChunks: 3 }
      );
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('useKnowledgeBase');
      expect(response).toHaveProperty('confidence');
      expect(response).toHaveProperty('citations');
      expect(response).toHaveProperty('sources');
      expect(typeof response.message).toBe('string');
      expect(response.message.length).toBeGreaterThan(0);
    });

    test('should handle standard responses without knowledge base', async () => {
      const testQuery = 'Hello, how are you?';
      
      const response = await ragChatService.generateResponse(
        testQuery,
        TEST_CONFIG.testSessionId,
        { useKnowledgeBase: false }
      );
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('useKnowledgeBase', false);
      expect(response).toHaveProperty('confidence');
    });

    test('should provide service statistics', async () => {
      const stats = await ragChatService.getServiceStats();
      
      if (stats) {
        expect(stats).toHaveProperty('interactions');
        expect(stats).toHaveProperty('performance');
        expect(stats).toHaveProperty('conversations');
        expect(stats).toHaveProperty('serviceConfig');
      }
    });

    test('should run service tests', async () => {
      const testResult = await ragChatService.testService(
        'Test query for service validation',
        'test-service-validation'
      );
      
      expect(testResult).toBeDefined();
      expect(testResult).toHaveProperty('success');
      expect(testResult).toHaveProperty('query');
      expect(testResult).toHaveProperty('processingTime');
      
      if (testResult.success) {
        expect(testResult).toHaveProperty('confidence');
        expect(testResult).toHaveProperty('citationCount');
      }
    });
  });

  describe('API Integration', () => {
    test('should handle chat messages via API', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'How do I create a new fund?',
          sessionId: TEST_CONFIG.testSessionId,
          useKnowledgeBase: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('processingTime');
    });

    test('should validate input parameters', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: '',
          sessionId: TEST_CONFIG.testSessionId
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_MESSAGE');
    });

    test('should provide health check endpoint', async () => {
      const response = await request(app)
        .get('/api/chat/health');
      
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('configuration');
      expect(response.body).toHaveProperty('services');
    });

    test('should provide statistics endpoint', async () => {
      const response = await request(app)
        .get('/api/chat/stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('system');
    });

    test('should handle conversation history', async () => {
      // First, send a message to create history
      await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Test message for history',
          sessionId: TEST_CONFIG.testSessionId
        });
      
      // Then retrieve history
      const response = await request(app)
        .get(`/api/chat/history/${TEST_CONFIG.testSessionId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conversation');
      expect(response.body).toHaveProperty('sessionId');
      expect(Array.isArray(response.body.conversation)).toBe(true);
    });

    test('should run system tests via API', async () => {
      const response = await request(app)
        .post('/api/chat/test')
        .send({
          testQuery: 'Test query for API validation',
          testType: 'rag',
          sessionId: 'api-test-session'
        });
      
      expect([200, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('testType');
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('results');
    });
  });

  describe('End-to-End RAG Workflow', () => {
    test('should complete full RAG workflow for multiple queries', async () => {
      for (const testQuery of TEST_CONFIG.testQueries) {
        const response = await request(app)
          .post('/api/chat/message')
          .send({
            message: testQuery,
            sessionId: `e2e-test-${Date.now()}`,
            useKnowledgeBase: true
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message.length).toBeGreaterThan(10);
        
        // Verify RAG-specific properties
        expect(response.body).toHaveProperty('useKnowledgeBase');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body).toHaveProperty('qualityIndicators');
        
        // Log results for analysis
        logger.info(`E2E Test - Query: "${testQuery}"`);
        logger.info(`E2E Test - Confidence: ${response.body.confidence}`);
        logger.info(`E2E Test - Citations: ${response.body.citations?.length || 0}`);
        logger.info(`E2E Test - Sources: ${response.body.sources?.length || 0}`);
      }
    });

    test('should handle conversation context across multiple turns', async () => {
      const sessionId = `context-test-${Date.now()}`;
      
      // First message
      const response1 = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'What is a fund?',
          sessionId,
          useKnowledgeBase: true
        });
      
      expect(response1.status).toBe(200);
      
      // Follow-up message with context
      const response2 = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'How do I create one?',
          sessionId,
          useKnowledgeBase: true
        });
      
      expect(response2.status).toBe(200);
      expect(response2.body.message).toBeDefined();
      
      // Verify conversation history
      const historyResponse = await request(app)
        .get(`/api/chat/history/${sessionId}`);
      
      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.conversation.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
    });

    test('should demonstrate confidence-based fallback mechanisms', async () => {
      // Test with a query likely to have low confidence
      const ambiguousQuery = 'xyz abc 123 random unrelated query';
      
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: ambiguousQuery,
          sessionId: `fallback-test-${Date.now()}`,
          useKnowledgeBase: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Should either have low confidence or fallback applied
      const hasLowConfidence = response.body.confidence < 0.5;
      const hasFallback = response.body.fallbackApplied === true;
      const hasSuggestions = response.body.suggestions && response.body.suggestions.length > 0;
      
      expect(hasLowConfidence || hasFallback || hasSuggestions).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/chat/message')
          .send({
            message: `Concurrent test query ${i + 1}`,
            sessionId: `concurrent-test-${i}`,
            useKnowledgeBase: true
          })
      );
      
      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('sessionId', `concurrent-test-${index}`);
      });
    });

    test('should complete requests within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Performance test query',
          sessionId: 'performance-test',
          useKnowledgeBase: true
        });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      logger.info(`Performance Test - Processing time: ${processingTime}ms`);
    });

    test('should maintain system stability under load', async () => {
      const loadTestRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/chat/message')
          .send({
            message: `Load test query ${i + 1}: How do I create a fund?`,
            sessionId: `load-test-${i}`,
            useKnowledgeBase: true
          })
      );
      
      const responses = await Promise.allSettled(loadTestRequests);
      
      const successfulResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 200
      );
      
      const successRate = successfulResponses.length / responses.length;
      
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      
      logger.info(`Load Test - Success rate: ${(successRate * 100).toFixed(1)}%`);
    });
  });
});

// Helper function to wait for async operations
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
