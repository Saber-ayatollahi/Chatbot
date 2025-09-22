/**
 * Tests for RegressionTester
 */

const fs = require('fs').promises;
const RegressionTester = require('../../evaluation/RegressionTester');

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/RAGChatService');

const mockRAGChatService = {
  generateResponse: jest.fn(),
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
};

jest.mock('../../services/RAGChatService', () => {
  return jest.fn().mockImplementation(() => mockRAGChatService);
});

describe('RegressionTester', () => {
  let tester;

  beforeEach(() => {
    jest.clearAllMocks();
    tester = new RegressionTester();
  });

  describe('loadTestDataset', () => {
    it('should load JSON dataset', async () => {
      const testData = [
        { id: 'test1', question: 'What is NAV?', expected_answer: 'Net Asset Value' },
        { id: 'test2', question: 'How to create fund?', expected_answer: 'Use the wizard' },
      ];

      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(testData));

      const result = await tester.loadTestDataset('test.json');

      expect(result).toEqual(testData);
      expect(fs.readFile).toHaveBeenCalledWith('test.json', 'utf8');
    });

    it('should load JSONL dataset', async () => {
      const testData = [
        { id: 'test1', question: 'What is NAV?', expected_answer: 'Net Asset Value' },
        { id: 'test2', question: 'How to create fund?', expected_answer: 'Use the wizard' },
      ];

      const jsonlContent = testData.map(item => JSON.stringify(item)).join('\n');
      jest.spyOn(fs, 'readFile').mockResolvedValue(jsonlContent);

      const result = await tester.loadTestDataset('test.jsonl');

      expect(result).toEqual(testData);
      expect(fs.readFile).toHaveBeenCalledWith('test.jsonl', 'utf8');
    });

    it('should handle file read errors', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'));

      await expect(tester.loadTestDataset('nonexistent.json'))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('runSingleTest', () => {
    it('should run a successful test', async () => {
      const testCase = {
        id: 'test1',
        question: 'What is NAV?',
        expected_answer: 'Net Asset Value is calculated by dividing total assets by shares.',
        expected_citations: ['Guide 1, p.10'],
        category: 'nav_calculation',
        difficulty: 'easy',
      };

      const mockResponse = {
        message: 'NAV stands for Net Asset Value, calculated by dividing total net assets by outstanding shares.',
        confidence: 0.92,
        citations: [
          { source: 'Guide 1', page: 10, text: 'NAV calculation method' }
        ],
        sources: [
          { id: 'guide1', title: 'Fund Management Guide' }
        ],
        retrievalMetadata: { vectorSearchTime: 120 },
      };

      mockRAGChatService.generateResponse.mockResolvedValue(mockResponse);

      // Mock the evaluation methods
      jest.spyOn(tester, 'evaluateResponse').mockResolvedValue({
        passed: true,
        accuracy: 0.95,
        citationPrecision: 1.0,
        citationRecall: 1.0,
        confidenceAlignment: 0.9,
      });

      const result = await tester.runSingleTest(testCase);

      expect(result).toMatchObject({
        testId: 'test1',
        question: 'What is NAV?',
        actualAnswer: mockResponse.message,
        passed: true,
        confidence: 0.92,
      });

      expect(mockRAGChatService.generateResponse).toHaveBeenCalledWith(
        'What is NAV?',
        'test_session_test1',
        expect.any(Object)
      );
    });

    it('should handle test failures', async () => {
      const testCase = {
        id: 'test1',
        question: 'What is NAV?',
        expected_answer: 'Net Asset Value',
      };

      mockRAGChatService.generateResponse.mockRejectedValue(new Error('API Error'));

      await expect(tester.runSingleTest(testCase))
        .rejects
        .toThrow('API Error');
    });
  });

  describe('evaluateAnswerAccuracy', () => {
    it('should evaluate answer accuracy using OpenAI', async () => {
      const expectedAnswer = 'NAV is calculated by dividing total net assets by outstanding shares.';
      const actualAnswer = 'Net Asset Value is computed by dividing the total assets by the number of shares.';

      mockRAGChatService.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: '0.85' }
        }]
      });

      const result = await tester.evaluateAnswerAccuracy(expectedAnswer, actualAnswer);

      expect(result).toBe(0.85);
      expect(mockRAGChatService.openai.chat.completions.create).toHaveBeenCalled();
    });

    it('should fallback to simple similarity on API error', async () => {
      const expectedAnswer = 'NAV calculation';
      const actualAnswer = 'NAV calculation method';

      mockRAGChatService.openai.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await tester.evaluateAnswerAccuracy(expectedAnswer, actualAnswer);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('evaluateCitations', () => {
    it('should evaluate citation precision and recall', () => {
      const expectedCitations = ['Guide 1', 'Guide 2'];
      const actualCitations = [
        { source: 'Guide 1', text: 'Citation 1' },
        { source: 'Guide 3', text: 'Citation 2' },
      ];

      const result = tester.evaluateCitations(expectedCitations, actualCitations);

      expect(result.precision).toBe(0.5); // 1 correct out of 2 actual
      expect(result.recall).toBe(0.5);    // 1 correct out of 2 expected
    });

    it('should handle no expected citations', () => {
      const expectedCitations = [];
      const actualCitations = [
        { source: 'Guide 1', text: 'Citation 1' },
      ];

      const result = tester.evaluateCitations(expectedCitations, actualCitations);

      expect(result.precision).toBe(1.0);
      expect(result.recall).toBe(1.0);
    });

    it('should handle no actual citations', () => {
      const expectedCitations = ['Guide 1'];
      const actualCitations = [];

      const result = tester.evaluateCitations(expectedCitations, actualCitations);

      expect(result.precision).toBe(0.0);
      expect(result.recall).toBe(0.0);
    });
  });

  describe('calculateBenchmarkMetrics', () => {
    it('should calculate comprehensive metrics', () => {
      const results = [
        {
          testId: 'test1',
          passed: true,
          evaluation: {
            accuracy: 0.9,
            citationPrecision: 0.8,
            citationRecall: 0.7,
            confidenceAlignment: 0.85,
          },
          responseTime: 1000,
          confidence: 0.9,
        },
        {
          testId: 'test2',
          passed: false,
          evaluation: {
            accuracy: 0.6,
            citationPrecision: 0.5,
            citationRecall: 0.4,
            confidenceAlignment: 0.6,
          },
          responseTime: 1500,
          confidence: 0.7,
        },
        {
          testId: 'test3',
          error: 'Failed',
        },
      ];

      const metrics = tester.calculateMetrics(results);

      expect(metrics.totalTests).toBe(3);
      expect(metrics.passedTests).toBe(1);
      expect(metrics.failedTests).toBe(2);
      expect(metrics.accuracy).toBeCloseTo(0.75); // (0.9 + 0.6) / 2
      expect(metrics.citationPrecision).toBeCloseTo(0.65); // (0.8 + 0.5) / 2
      expect(metrics.citationRecall).toBeCloseTo(0.55); // (0.7 + 0.4) / 2
      expect(metrics.averageResponseTime).toBeCloseTo(1250); // (1000 + 1500) / 2
    });

    it('should handle empty results', () => {
      const metrics = tester.calculateMetrics([]);

      expect(metrics.totalTests).toBe(0);
      expect(metrics.passedTests).toBe(0);
      expect(metrics.failedTests).toBe(0);
      expect(metrics.accuracy).toBe(0);
    });
  });

  describe('generateCategoryBreakdown', () => {
    it('should generate category performance breakdown', () => {
      const results = [
        { testCase: { category: 'fund_creation' }, passed: true },
        { testCase: { category: 'fund_creation' }, passed: false },
        { testCase: { category: 'nav_calculation' }, passed: true },
        { testCase: { category: 'nav_calculation' }, passed: true },
      ];

      const breakdown = tester.generateCategoryBreakdown(results);

      expect(breakdown).toEqual({
        fund_creation: {
          total: 2,
          passed: 1,
          failed: 1,
          passRate: 0.5,
        },
        nav_calculation: {
          total: 2,
          passed: 2,
          failed: 0,
          passRate: 1.0,
        },
      });
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on results', () => {
      const results = [
        { passed: false, evaluation: { accuracy: 0.6 } },
        { passed: false, evaluation: { accuracy: 0.7 } },
        { passed: true, evaluation: { accuracy: 0.9 } },
      ];

      const metrics = {
        accuracy: 0.73, // Below 85% threshold
        citationPrecision: 0.95,
        averageResponseTime: 2000,
      };

      const recommendations = tester.generateRecommendations(results, metrics);

      expect(recommendations.length).toBeGreaterThan(0);
      
      const accuracyRec = recommendations.find(rec => rec.type === 'accuracy');
      expect(accuracyRec).toBeDefined();
      expect(accuracyRec.priority).toBe('high');
    });
  });

  describe('determineTestPass', () => {
    it('should pass test meeting all thresholds', () => {
      const evaluation = {
        accuracy: 0.9,
        citationPrecision: 0.95,
        citationRecall: 0.85,
      };

      const testCase = { difficulty: 'medium' };

      const result = tester.determineTestPass(evaluation, testCase);
      expect(result).toBe(true);
    });

    it('should fail test not meeting accuracy threshold', () => {
      const evaluation = {
        accuracy: 0.7, // Below 85% threshold
        citationPrecision: 0.95,
        citationRecall: 0.85,
      };

      const testCase = { difficulty: 'medium' };

      const result = tester.determineTestPass(evaluation, testCase);
      expect(result).toBe(false);
    });

    it('should use different thresholds for hard tests', () => {
      const evaluation = {
        accuracy: 0.8, // Would fail for medium but pass for hard
        citationPrecision: 0.9,
        citationRecall: 0.75,
      };

      const hardTestCase = { difficulty: 'hard' };
      const mediumTestCase = { difficulty: 'medium' };

      expect(tester.determineTestPass(evaluation, hardTestCase)).toBe(true);
      expect(tester.determineTestPass(evaluation, mediumTestCase)).toBe(false);
    });
  });
});
