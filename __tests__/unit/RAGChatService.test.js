/**
 * RAG Chat Service Unit Tests
 * Testing the core RAG chat service functionality
 */

const RAGChatService = require('../../services/RAGChatService');
const RetrievalEngine = require('../../knowledge/retrieval/RetrievalEngine');
const PromptAssembler = require('../../knowledge/prompting/PromptAssembler');
const { getConfig } = require('../../config/environment');

// Mock dependencies
jest.mock('../../knowledge/retrieval/RetrievalEngine');
jest.mock('../../knowledge/prompting/PromptAssembler');
jest.mock('../../config/database');
jest.mock('openai');

describe('RAGChatService', () => {
  let ragChatService;
  let mockRetrievalEngine;
  let mockPromptAssembler;
  let mockOpenAI;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock RetrievalEngine
    mockRetrievalEngine = {
      retrieve: jest.fn(),
      getEngineStats: jest.fn()
    };
    RetrievalEngine.mockImplementation(() => mockRetrievalEngine);
    
    // Mock PromptAssembler
    mockPromptAssembler = {
      assembleRAGPrompt: jest.fn()
    };
    PromptAssembler.mockImplementation(() => mockPromptAssembler);
    
    // Mock OpenAI
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    // Initialize service
    ragChatService = new RAGChatService();
    ragChatService.openai = mockOpenAI;
  });

  describe('generateResponse', () => {
    test('should generate knowledge-based response successfully', async () => {
      // Mock retrieval results
      const mockRetrievalResult = {
        chunks: [
          {
            chunk_id: 'test-1',
            content: 'Fund creation requires several steps.',
            similarity_score: 0.9,
            citation: { source: 'Test Guide', page: 1 }
          }
        ],
        metadata: { confidenceScore: 0.8 },
        strategy: 'hybrid',
        queryAnalysis: { queryType: 'procedure' }
      };
      
      mockRetrievalEngine.retrieve.mockResolvedValue(mockRetrievalResult);
      
      // Mock prompt assembly
      const mockPromptResult = {
        prompt: {
          system: 'System prompt',
          user: 'User prompt'
        },
        citations: [{ source: 'Test Guide', page: 1 }],
        metadata: { estimatedTokens: 500 }
      };
      
      mockPromptAssembler.assembleRAGPrompt.mockResolvedValue(mockPromptResult);
      
      // Mock OpenAI response
      const mockGPTResponse = {
        choices: [{
          message: { content: 'To create a fund, follow these steps...' },
          finish_reason: 'stop'
        }],
        model: 'gpt-4',
        usage: { total_tokens: 600 }
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockGPTResponse);
      
      // Mock database operations
      ragChatService.db = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      
      // Test the method
      const result = await ragChatService.generateResponse(
        'How do I create a fund?',
        'test-session',
        { useKnowledgeBase: true }
      );
      
      expect(result).toBeDefined();
      expect(result.message).toBe('To create a fund, follow these steps...');
      expect(result.useKnowledgeBase).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.citations).toBeDefined();
      expect(result.sources).toBeDefined();
      
      // Verify method calls
      expect(mockRetrievalEngine.retrieve).toHaveBeenCalledWith(
        'How do I create a fund?',
        expect.any(Object),
        expect.objectContaining({ maxResults: 5 })
      );
      
      expect(mockPromptAssembler.assembleRAGPrompt).toHaveBeenCalledWith(
        'How do I create a fund?',
        mockRetrievalResult.chunks,
        expect.any(Array),
        expect.any(Object)
      );
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.any(Array)
        })
      );
    });

    test('should generate standard response when knowledge base disabled', async () => {
      // Mock OpenAI response for standard mode
      const mockGPTResponse = {
        choices: [{
          message: { content: 'I can help you with fund management.' },
          finish_reason: 'stop'
        }],
        model: 'gpt-4',
        usage: { total_tokens: 100 }
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockGPTResponse);
      
      // Mock database operations
      ragChatService.db = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      
      const result = await ragChatService.generateResponse(
        'Hello',
        'test-session',
        { useKnowledgeBase: false }
      );
      
      expect(result).toBeDefined();
      expect(result.message).toBe('I can help you with fund management.');
      expect(result.useKnowledgeBase).toBe(false);
      expect(result.citations).toEqual([]);
      expect(result.sources).toEqual([]);
      
      // Should not call retrieval or prompt assembly
      expect(mockRetrievalEngine.retrieve).not.toHaveBeenCalled();
      expect(mockPromptAssembler.assembleRAGPrompt).not.toHaveBeenCalled();
    });

    test('should handle low confidence retrieval', async () => {
      // Mock low confidence retrieval
      const mockRetrievalResult = {
        chunks: [],
        metadata: { confidenceScore: 0.1 },
        strategy: 'vector_only',
        queryAnalysis: { queryType: 'general' }
      };
      
      mockRetrievalEngine.retrieve.mockResolvedValue(mockRetrievalResult);
      
      // Mock database operations
      ragChatService.db = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      
      const result = await ragChatService.generateResponse(
        'Unrelated query',
        'test-session',
        { useKnowledgeBase: true }
      );
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.message).toContain('not finding specific information');
    });

    test('should handle OpenAI API errors gracefully', async () => {
      // Mock retrieval success
      mockRetrievalEngine.retrieve.mockResolvedValue({
        chunks: [{ chunk_id: 'test', content: 'test' }],
        metadata: { confidenceScore: 0.8 }
      });
      
      mockPromptAssembler.assembleRAGPrompt.mockResolvedValue({
        prompt: { system: 'test', user: 'test' },
        citations: []
      });
      
      // Mock OpenAI error
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error')
      );
      
      // Mock database operations
      ragChatService.db = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      
      const result = await ragChatService.generateResponse('test', 'test-session');
      
      expect(result.error.occurred).toBe(true);
      expect(result.error.message).toContain('API Error');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.confidenceLevel).toBe('very_low');
    });
  });

  describe('callOpenAIChat', () => {
    test('should call OpenAI API with correct parameters', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Test response' },
          finish_reason: 'stop'
        }],
        model: 'gpt-4',
        usage: { total_tokens: 100 }
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const prompt = {
        system: 'System prompt',
        user: 'User prompt'
      };
      
      const result = await ragChatService.callOpenAIChat(prompt);
      
      expect(result).toEqual({
        content: 'Test response',
        model: 'gpt-4',
        usage: { total_tokens: 100 },
        finishReason: 'stop'
      });
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'User prompt' }
          ],
          max_tokens: expect.any(Number),
          temperature: expect.any(Number)
        })
      );
    });

    test('should handle array of messages format', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Test response' },
          finish_reason: 'stop'
        }],
        model: 'gpt-4',
        usage: { total_tokens: 100 }
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const messages = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'User 1' },
        { role: 'assistant', content: 'Assistant 1' },
        { role: 'user', content: 'User 2' }
      ];
      
      const result = await ragChatService.callOpenAIChat({ combined: messages });
      
      expect(result.content).toBe('Test response');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: messages
        })
      );
    });
  });

  describe('extractAndValidateCitations', () => {
    test('should extract citations from response text', async () => {
      const responseText = 'According to the Fund Guide (Guide 1, p.12), you need to follow steps.';
      const availableCitations = [
        { source: 'Fund Guide', page: 12, chunk_id: 'test-1' }
      ];
      const retrievedChunks = [
        { chunk_id: 'test-1', citation: { source: 'Fund Guide', page: 12 } }
      ];
      
      const result = await ragChatService.extractAndValidateCitations(
        responseText,
        availableCitations,
        retrievedChunks
      );
      
      expect(result).toBeDefined();
      expect(result.totalFound).toBeGreaterThan(0);
      expect(result.validCitations).toBeDefined();
      expect(result.invalidCitations).toBeDefined();
    });

    test('should handle text without citations', async () => {
      const responseText = 'This is a response without any citations.';
      
      const result = await ragChatService.extractAndValidateCitations(
        responseText,
        [],
        []
      );
      
      expect(result.totalFound).toBe(0);
      expect(result.validCitations).toEqual([]);
      expect(result.invalidCitations).toEqual([]);
    });
  });

  describe('calculateResponseConfidence', () => {
    test('should calculate confidence based on multiple factors', () => {
      const retrievalConfidence = 0.8;
      const gptResponse = { finishReason: 'stop' };
      const extractedCitations = {
        validCitations: [{ text: 'citation1' }],
        citationCoverage: 0.9
      };
      const queryAnalysis = { complexity: 'simple' };
      
      const confidence = ragChatService.calculateResponseConfidence(
        retrievalConfidence,
        gptResponse,
        extractedCitations,
        queryAnalysis
      );
      
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
      expect(confidence).toBeGreaterThan(retrievalConfidence * 0.5); // Should be boosted
    });

    test('should penalize incomplete responses', () => {
      const retrievalConfidence = 0.8;
      const gptResponse = { finishReason: 'length' }; // Incomplete
      const extractedCitations = { validCitations: [], citationCoverage: 0 };
      const queryAnalysis = { complexity: 'complex' };
      
      const confidence = ragChatService.calculateResponseConfidence(
        retrievalConfidence,
        gptResponse,
        extractedCitations,
        queryAnalysis
      );
      
      expect(confidence).toBeLessThan(retrievalConfidence);
    });
  });

  describe('prepareSources', () => {
    test('should prepare unique sources from chunks', () => {
      const retrievedChunks = [
        {
          chunk_id: 'chunk1',
          citation: { source: 'Guide 1', page: 1, section: 'Intro' },
          relevance_score: 0.9,
          content_type: 'text'
        },
        {
          chunk_id: 'chunk2',
          citation: { source: 'Guide 1', page: 1, section: 'Intro' }, // Duplicate
          relevance_score: 0.8,
          content_type: 'text'
        },
        {
          chunk_id: 'chunk3',
          citation: { source: 'Guide 2', page: 5, section: 'Advanced' },
          relevance_score: 0.7,
          content_type: 'procedure'
        }
      ];
      
      const sources = ragChatService.prepareSources(retrievedChunks);
      
      expect(sources).toHaveLength(2); // Should deduplicate
      expect(sources[0].relevance_score).toBeGreaterThanOrEqual(sources[1].relevance_score); // Should be sorted
      expect(sources[0]).toHaveProperty('title');
      expect(sources[0]).toHaveProperty('page');
      expect(sources[0]).toHaveProperty('section');
    });

    test('should handle empty chunks array', () => {
      const sources = ragChatService.prepareSources([]);
      expect(sources).toEqual([]);
    });
  });

  describe('getConversationContext', () => {
    test('should retrieve conversation context from database', async () => {
      const mockConversation = {
        messages: JSON.stringify([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]),
        message_count: 2,
        last_activity: new Date(),
        metadata: {}
      };
      
      ragChatService.db = {
        query: jest.fn().mockResolvedValue({ rows: [mockConversation] })
      };
      
      const context = await ragChatService.getConversationContext('test-session');
      
      expect(context).toBeDefined();
      expect(context.messageHistory).toHaveLength(2);
      expect(context.messageCount).toBe(2);
      expect(context.previousTopics).toBeDefined();
    });

    test('should handle missing conversation gracefully', async () => {
      ragChatService.db = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      
      const context = await ragChatService.getConversationContext('new-session');
      
      expect(context).toBeDefined();
      expect(context.messageHistory).toEqual([]);
      expect(context.messageCount).toBe(0);
      expect(context.previousTopics).toEqual([]);
    });
  });

  describe('testService', () => {
    test('should run service test successfully', async () => {
      // Mock successful response generation
      ragChatService.generateResponse = jest.fn().mockResolvedValue({
        message: 'Test response',
        useKnowledgeBase: true,
        confidence: 0.8,
        citations: [{ source: 'Test' }],
        sources: [{ title: 'Test Guide' }],
        qualityIndicators: { hasRelevantSources: true },
        retrievalMetadata: { strategy: 'hybrid' },
        generationMetadata: { model: 'gpt-4', tokensUsed: { total_tokens: 100 } }
      });
      
      const testResult = await ragChatService.testService();
      
      expect(testResult.success).toBe(true);
      expect(testResult).toHaveProperty('query');
      expect(testResult).toHaveProperty('processingTime');
      expect(testResult).toHaveProperty('confidence');
      expect(testResult).toHaveProperty('citationCount');
    });

    test('should handle service test failure', async () => {
      ragChatService.generateResponse = jest.fn().mockRejectedValue(
        new Error('Service error')
      );
      
      const testResult = await ragChatService.testService();
      
      expect(testResult.success).toBe(false);
      expect(testResult).toHaveProperty('error');
    });
  });

  describe('getServiceStats', () => {
    test('should return service statistics', async () => {
      ragChatService.db = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{
              total_interactions: 100,
              rag_interactions: 80,
              error_interactions: 5,
              avg_response_time: 2500,
              avg_confidence: 0.75,
              recent_interactions: 20
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_conversations: 50,
              avg_messages_per_conversation: 4.2,
              active_conversations: 10
            }]
          })
      };
      
      const stats = await ragChatService.getServiceStats();
      
      expect(stats).toBeDefined();
      expect(stats.interactions).toBeDefined();
      expect(stats.performance).toBeDefined();
      expect(stats.conversations).toBeDefined();
      expect(stats.serviceConfig).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
      ragChatService.db = {
        query: jest.fn().mockRejectedValue(new Error('DB Error'))
      };
      
      const stats = await ragChatService.getServiceStats();
      
      expect(stats).toBeNull();
    });
  });
});

// Helper function to create mock chunks
function createMockChunk(id, content, similarity = 0.8) {
  return {
    chunk_id: id,
    content: content,
    similarity_score: similarity,
    citation: {
      source: 'Test Guide',
      page: 1,
      section: 'Test Section'
    },
    quality_score: 0.8,
    content_type: 'text'
  };
}
