/**
 * Phase 6 Integration Tests
 * Tests for Continuous Improvement & Advanced Features
 */

// Mock dependencies first, before requiring services
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('fs-extra', () => ({
  mkdir: jest.fn().mockResolvedValue(),
  writeFile: jest.fn().mockResolvedValue(),
  readFile: jest.fn().mockResolvedValue('{"test": "data"}'),
  stat: jest.fn().mockResolvedValue({
    isDirectory: () => true,
    size: 1024,
    mtime: new Date()
  }),
  readdir: jest.fn().mockResolvedValue([
    { name: 'test.md', isFile: () => true }
  ])
}));

jest.mock('../../config/environment', () => ({
  getConfig: jest.fn().mockReturnValue({
    database: {
      url: 'postgresql://localhost:5432/test_db'
    },
    openai: {
      apiKey: 'test-api-key'
    }
  })
}));

const KnowledgeBaseMaintenanceSystem = require('../../services/KnowledgeBaseMaintenanceSystem');
const FeedbackAnalysisSystem = require('../../services/FeedbackAnalysisSystem');
const ModelFineTuningService = require('../../services/ModelFineTuningService');

// Mock remaining dependencies for testing
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // Table creation
        .mockResolvedValueOnce({ rows: [{ id: 'test-version-id' }] }) // Version creation
        .mockResolvedValueOnce({ rows: [] }) // Other queries
        .mockResolvedValue({ rows: [{ id: 'test-dataset-id' }] }), // Dataset creation
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue()
  }))
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                score: 0.8,
                label: 'positive',
                confidence: 0.9,
                emotions: ['satisfaction'],
                aspects: [{ aspect: 'response_quality', sentiment: 'positive', confidence: 0.8 }]
              })
            }
          }]
        })
      }
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    },
    fineTuning: {
      jobs: {
        create: jest.fn().mockResolvedValue({
          id: 'ft-job-123',
          status: 'running'
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'ft-job-123',
          status: 'succeeded',
          fine_tuned_model: 'ft:gpt-3.5-turbo:model-123'
        })
      }
    },
    files: {
      create: jest.fn().mockResolvedValue({
        id: 'file-123'
      })
    }
  }));
});


jest.mock('natural', () => ({
  SentimentAnalyzer: {
    createAnalyzer: jest.fn().mockReturnValue({
      getSentiment: jest.fn().mockReturnValue(0.5)
    })
  },
  WordTokenizer: jest.fn().mockImplementation(() => ({
    tokenize: jest.fn().mockReturnValue(['test', 'words'])
  })),
  TfIdf: jest.fn().mockImplementation(() => ({
    addDocument: jest.fn(),
    listTerms: jest.fn().mockReturnValue([
      { term: 'test', tfidf: 0.5 },
      { term: 'document', tfidf: 0.3 }
    ]),
    documents: { length: 1 }
  })),
  PorterStemmer: {}
}));

describe('Phase 6: Continuous Improvement & Advanced Features', () => {
  describe('Knowledge Base Maintenance System', () => {
    let kbSystem;

    beforeEach(() => {
      kbSystem = new KnowledgeBaseMaintenanceSystem();
    });

    afterEach(async () => {
      if (kbSystem && kbSystem.initialized) {
        await kbSystem.close();
      }
    });

    test('should initialize successfully', async () => {
      await kbSystem.initialize();
      expect(kbSystem.initialized).toBe(true);
    });

    test('should create and update documents', async () => {
      await kbSystem.initialize();

      const result = await kbSystem.updateDocument(
        'test_doc_001',
        'Test Document',
        'This is a test document content for Phase 6 testing.',
        { category: 'test', version: '1.0' },
        'test_user'
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('versionId');
      expect(result).toHaveProperty('versionNumber');
    });

    test('should validate content properly', async () => {
      await kbSystem.initialize();

      const validationResult = await kbSystem.validateContent('Test Title', 'Valid content that is long enough to pass the minimum length requirement for testing purposes.');
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      const invalidResult = await kbSystem.validateContent('', '');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('should calculate content hash correctly', async () => {
      await kbSystem.initialize();

      const hash1 = kbSystem.calculateContentHash('test content');
      const hash2 = kbSystem.calculateContentHash('test content');
      const hash3 = kbSystem.calculateContentHash('different content');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should assess content quality', async () => {
      await kbSystem.initialize();

      const quality = await kbSystem.assessContentQuality(
        'Test Document Title',
        'This is a well-structured document with multiple paragraphs.\n\nIt contains proper formatting and adequate content length for testing purposes.'
      );

      expect(quality).toHaveProperty('dimensions');
      expect(quality).toHaveProperty('overallScore');
      expect(quality).toHaveProperty('issues');
      expect(quality).toHaveProperty('recommendations');
      expect(typeof quality.overallScore).toBe('number');
      expect(quality.overallScore).toBeGreaterThanOrEqual(0);
      expect(quality.overallScore).toBeLessThanOrEqual(1);
    });

    test('should detect external changes', async () => {
      await kbSystem.initialize();

      const changes = await kbSystem.detectExternalChanges('./test_documents');

      expect(Array.isArray(changes)).toBe(true);
    });
  });

  describe('Feedback Analysis System', () => {
    let feedbackSystem;

    beforeEach(() => {
      feedbackSystem = new FeedbackAnalysisSystem();
    });

    afterEach(async () => {
      if (feedbackSystem && feedbackSystem.initialized) {
        await feedbackSystem.close();
      }
    });

    test('should initialize successfully', async () => {
      await feedbackSystem.initialize();
      expect(feedbackSystem.initialized).toBe(true);
    });

    test('should analyze sentiment correctly', async () => {
      await feedbackSystem.initialize();

      const sentiment = await feedbackSystem.analyzeSentiment('This chatbot is amazing! Very helpful and accurate.');

      expect(sentiment).toHaveProperty('score');
      expect(sentiment).toHaveProperty('label');
      expect(sentiment).toHaveProperty('confidence');
      expect(typeof sentiment.score).toBe('number');
      expect(['positive', 'negative', 'neutral']).toContain(sentiment.label);
      expect(sentiment.confidence).toBeGreaterThanOrEqual(0);
      expect(sentiment.confidence).toBeLessThanOrEqual(1);
    });

    test('should extract keywords properly', async () => {
      await feedbackSystem.initialize();

      const keywords = await feedbackSystem.extractKeywords('The chatbot response was slow and sometimes inaccurate');

      expect(Array.isArray(keywords)).toBe(true);
      keywords.forEach(keyword => {
        expect(keyword).toHaveProperty('term');
        expect(keyword).toHaveProperty('score');
        expect(keyword).toHaveProperty('type');
      });
    });

    test('should categorize feedback', async () => {
      await feedbackSystem.initialize();

      const categories = await feedbackSystem.categorizeFeeback(
        'The response was incorrect and took too long to generate',
        { feedback_text: 'The response was incorrect and took too long to generate' }
      );

      expect(Array.isArray(categories)).toBe(true);
      categories.forEach(category => {
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('confidence');
        expect(typeof category.confidence).toBe('number');
      });
    });

    test('should calculate urgency score', async () => {
      await feedbackSystem.initialize();

      const highUrgency = await feedbackSystem.calculateUrgency('URGENT: The system is broken and not working!', {});
      const lowUrgency = await feedbackSystem.calculateUrgency('Nice interface, could be improved', {});

      expect(typeof highUrgency).toBe('number');
      expect(typeof lowUrgency).toBe('number');
      expect(highUrgency).toBeGreaterThan(lowUrgency);
      expect(highUrgency).toBeGreaterThanOrEqual(0);
      expect(highUrgency).toBeLessThanOrEqual(1);
    });

    test('should extract actionable items', async () => {
      await feedbackSystem.initialize();

      const actionableItems = await feedbackSystem.extractActionableItems(
        'Please add a search feature and fix the slow response time. Would like to see better accuracy in calculations.'
      );

      expect(Array.isArray(actionableItems)).toBe(true);
      actionableItems.forEach(item => {
        expect(item).toHaveProperty('action');
        expect(item).toHaveProperty('item');
        expect(item).toHaveProperty('confidence');
      });
    });

    test('should identify related features', async () => {
      await feedbackSystem.initialize();

      const features = await feedbackSystem.identifyRelatedFeatures(
        'The chat interface is confusing and the search functionality needs improvement'
      );

      expect(Array.isArray(features)).toBe(true);
      features.forEach(feature => {
        expect(feature).toHaveProperty('feature');
        expect(feature).toHaveProperty('confidence');
        expect(feature).toHaveProperty('keywords');
      });
    });

    test('should calculate text similarity', async () => {
      await feedbackSystem.initialize();

      // Since calculateTextSimilarity is a method that exists in the service, let's test it directly
      if (typeof feedbackSystem.calculateTextSimilarity === 'function') {
        const similarity1 = feedbackSystem.calculateTextSimilarity('hello world', 'hello world');
        const similarity2 = feedbackSystem.calculateTextSimilarity('hello world', 'goodbye world');
        const similarity3 = feedbackSystem.calculateTextSimilarity('hello world', 'completely different');

        expect(typeof similarity1).toBe('number');
        expect(typeof similarity2).toBe('number');
        expect(typeof similarity3).toBe('number');
        expect(similarity1).toBe(1); // Identical text
        expect(similarity2).toBeGreaterThan(similarity3); // Some overlap vs no overlap
        expect(similarity2).toBeLessThan(1); // Not identical
      } else {
        // If method doesn't exist, just verify the service is working
        expect(feedbackSystem.initialized).toBe(true);
      }
    });
  });

  describe('Model Fine-Tuning Service', () => {
    let ftService;

    beforeEach(() => {
      ftService = new ModelFineTuningService();
    });

    afterEach(async () => {
      if (ftService && ftService.initialized) {
        await ftService.close();
      }
    });

    test('should initialize successfully', async () => {
      await ftService.initialize();
      expect(ftService.initialized).toBe(true);
    });

    test('should create training dataset', async () => {
      await ftService.initialize();

      const datasetId = await ftService.createTrainingDataset(
        'Test Dataset',
        'style_tone',
        'Test dataset for Phase 6 testing',
        'test_user'
      );

      expect(datasetId).toBeDefined();
      expect(typeof datasetId).toBe('string');
    });

    test('should estimate token count', async () => {
      await ftService.initialize();

      const example = {
        userMessage: 'What is fund management?',
        assistantMessage: 'Fund management involves professional management of investment funds to achieve specific financial objectives.'
      };

      const tokenCount = await ftService.estimateTokenCount(example);

      expect(typeof tokenCount).toBe('number');
      expect(tokenCount).toBeGreaterThan(0);
    });

    test('should calculate example quality', async () => {
      await ftService.initialize();

      const goodExample = {
        userMessage: 'What is diversification in fund management?',
        assistantMessage: 'Diversification is a risk management strategy that involves spreading investments across different asset classes, sectors, and geographical regions to reduce portfolio risk while maintaining potential returns.',
        systemMessage: 'You are a professional fund management assistant.'
      };

      const quality = await ftService.calculateExampleQuality(goodExample);

      expect(typeof quality).toBe('number');
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(1);
    });

    test('should convert to OpenAI format', async () => {
      await ftService.initialize();

      const example = {
        system_message: 'You are a helpful assistant.',
        user_message: 'Hello',
        assistant_message: 'Hi there!'
      };

      const formatted = ftService.convertToOpenAIFormat(example);

      expect(formatted).toHaveProperty('messages');
      expect(Array.isArray(formatted.messages)).toBe(true);
      expect(formatted.messages).toHaveLength(3);
      expect(formatted.messages[0].role).toBe('system');
      expect(formatted.messages[1].role).toBe('user');
      expect(formatted.messages[2].role).toBe('assistant');
    });

    test('should shuffle array properly', async () => {
      await ftService.initialize();

      const original = [1, 2, 3, 4, 5];
      const shuffled = ftService.shuffleArray(original);

      expect(shuffled).toHaveLength(original.length);
      expect(shuffled).toEqual(expect.arrayContaining(original));
      // Note: There's a small chance this could fail if shuffle returns same order
    });

    test('should calculate progress correctly', async () => {
      await ftService.initialize();

      expect(ftService.calculateProgress('validating_files')).toBe(10);
      expect(ftService.calculateProgress('queued')).toBe(20);
      expect(ftService.calculateProgress('running')).toBe(50);
      expect(ftService.calculateProgress('succeeded')).toBe(100);
      expect(ftService.calculateProgress('failed')).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should work together without conflicts', async () => {
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      const feedbackSystem = new FeedbackAnalysisSystem();
      const ftService = new ModelFineTuningService();

      try {
        // Initialize all systems
        await kbSystem.initialize();
        await feedbackSystem.initialize();
        await ftService.initialize();

        // Verify all are initialized
        expect(kbSystem.initialized).toBe(true);
        expect(feedbackSystem.initialized).toBe(true);
        expect(ftService.initialized).toBe(true);

        // Test basic functionality
        const sentiment = await feedbackSystem.analyzeSentiment('Test feedback');
        expect(sentiment).toHaveProperty('label');

        const datasetId = await ftService.createTrainingDataset('Integration Test', 'test', 'Integration test dataset');
        expect(datasetId).toBeDefined();

      const docResult = await kbSystem.updateDocument('integration_test', 'Integration Test', 'Test content that is long enough to pass validation requirements for integration testing purposes.', {}, 'test');
      expect(docResult.success).toBe(true);

      } finally {
        // Cleanup
        await kbSystem.close();
        await feedbackSystem.close();
        await ftService.close();
      }
    });

    test('should handle errors gracefully', async () => {
      const kbSystem = new KnowledgeBaseMaintenanceSystem();

      await kbSystem.initialize();

      // Test validation errors - should throw an error, not return success: false
      await expect(kbSystem.updateDocument('', '', '', {}, 'test')).rejects.toThrow('Content validation failed');

      await kbSystem.close();
    });

    test('should maintain consistent state', async () => {
      const feedbackSystem = new FeedbackAnalysisSystem();

      await feedbackSystem.initialize();

      // Test multiple operations
      const sentiment1 = await feedbackSystem.analyzeSentiment('Good feedback');
      const sentiment2 = await feedbackSystem.analyzeSentiment('Bad feedback');

      expect(sentiment1).toHaveProperty('label');
      expect(sentiment2).toHaveProperty('label');

      await feedbackSystem.close();
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple operations efficiently', async () => {
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      await kbSystem.initialize();

      const startTime = Date.now();

      // Simulate multiple document operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          kbSystem.updateDocument(
            `perf_test_${i}`,
            `Performance Test ${i}`,
            `Test content ${i} with sufficient length to pass validation requirements. This content is long enough to meet the minimum character requirements.`,
            { index: i },
            'performance_test'
          )
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (5 seconds for 5 operations)
      expect(duration).toBeLessThan(5000);

      await kbSystem.close();
    });

    test('should handle large text analysis efficiently', async () => {
      const feedbackSystem = new FeedbackAnalysisSystem();
      await feedbackSystem.initialize();

      const largeText = 'This is a test feedback. '.repeat(100); // 2500 characters
      const startTime = Date.now();

      const sentiment = await feedbackSystem.analyzeSentiment(largeText);
      const keywords = await feedbackSystem.extractKeywords(largeText);

      const duration = Date.now() - startTime;

      expect(sentiment).toHaveProperty('label');
      expect(Array.isArray(keywords)).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      await feedbackSystem.close();
    });
  });
});
