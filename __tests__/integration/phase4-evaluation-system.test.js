/**
 * Integration Tests for Phase 4 Evaluation System
 * Tests the complete evaluation and testing framework
 */

const path = require('path');
const fs = require('fs').promises;
// Mock OpenAI to prevent real API calls
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([{
              question: 'What fields are required for fund creation?',
              expected_answer: 'Fund Name, Fund Type, and Currency are required.',
              expected_citations: ['Test Guide, p.1'],
              category: 'fund_creation',
              difficulty: 'easy',
            }])
          }
        }]
      })
    }
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

const GoldenDatasetGenerator = require('../../evaluation/GoldenDatasetGenerator');
const RegressionTester = require('../../evaluation/RegressionTester');
const ABTestingFramework = require('../../evaluation/ABTestingFramework');
const PerformanceBenchmarker = require('../../evaluation/PerformanceBenchmarker');

// Mock external dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/RAGChatService');
jest.mock('../../knowledge/loaders/DocumentLoader');
jest.mock('../../knowledge/chunking/SemanticChunker');
jest.mock('openai');

// Mock implementations
const mockRAGChatService = {
  generateResponse: jest.fn().mockResolvedValue({
    message: 'Test response',
    confidence: 0.85,
    citations: ['Test citation'],
    sources: ['Test source'],
    processingTime: 150,
  }),
  openai: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Test response' }
          }]
        }),
      },
    },
  },
  defaultOptions: {},
  promptAssembler: { templates: {} },
  confidenceManager: { thresholds: {} },
};

const mockDocumentLoader = {
  loadPDF: jest.fn(),
};

const mockSemanticChunker = {
  chunkText: jest.fn(),
};


// Setup mocks
jest.mock('../../services/RAGChatService', () => {
  return jest.fn().mockImplementation(() => mockRAGChatService);
});

jest.mock('../../knowledge/loaders/DocumentLoader', () => {
  return jest.fn().mockImplementation(() => mockDocumentLoader);
});

jest.mock('../../knowledge/chunking/SemanticChunker', () => {
  return jest.fn().mockImplementation(() => mockSemanticChunker);
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

describe('Phase 4 Evaluation System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup common mocks
    mockDocumentLoader.loadPDF.mockResolvedValue({
      sourceId: 'test_guide',
      version: '1.9',
      content: 'Test document content about fund creation and NAV calculations.',
      metadata: { pages: 100 },
    });

    mockSemanticChunker.chunkText.mockResolvedValue([
      {
        id: 'chunk_1',
        content: 'Fund creation requires Fund Name, Fund Type, and Currency fields.',
        index: 0,
      },
      {
        id: 'chunk_2',
        content: 'NAV calculation involves dividing total net assets by outstanding shares.',
        index: 1,
      },
    ]);

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            {
              question: 'What fields are required for fund creation?',
              expected_answer: 'Fund Name, Fund Type, and Currency are required.',
              expected_citations: ['Test Guide, p.1'],
              category: 'fund_creation',
              difficulty: 'easy',
              question_type: 'factual',
            },
          ]),
        },
      }],
    });

    mockRAGChatService.generateResponse.mockResolvedValue({
      message: 'Fund creation requires Fund Name, Fund Type, and Currency fields.',
      confidence: 0.9,
      citations: [{ source: 'Test Guide', page: 1 }],
      sources: [{ id: 'test', title: 'Test Guide' }],
      retrievalMetadata: { vectorSearchTime: 100 },
      generationMetadata: { generationTime: 500 },
    });
  });

  describe('Complete Evaluation Pipeline', () => {
    it('should run end-to-end evaluation workflow', async () => {
      // Mock file operations
      const mockMkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue();
      const mockWriteFile = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      const mockReadFile = jest.spyOn(fs, 'readFile').mockImplementation((filePath) => {
        if (filePath.includes('golden_dataset')) {
          return Promise.resolve(JSON.stringify([
            {
              id: 'test1',
              question: 'What fields are required for fund creation?',
              expected_answer: 'Fund Name, Fund Type, and Currency are required.',
              expected_citations: ['Test Guide, p.1'],
              category: 'fund_creation',
              difficulty: 'easy',
            },
          ]));
        }
        return Promise.resolve('[]');
      });

      try {
        // Step 1: Generate golden dataset
        console.log('🎯 Step 1: Generating golden dataset...');
        const generator = new GoldenDatasetGenerator();
        const dataset = await generator.generateGoldenDataset(
          ['test_guide.pdf'],
          'test_dataset.jsonl'
        );

        expect(dataset).toBeDefined();
        expect(Array.isArray(dataset)).toBe(true);
        expect(dataset.length).toBeGreaterThan(0);

        // Step 2: Run regression tests
        console.log('🧪 Step 2: Running regression tests...');
        const tester = new RegressionTester();
        
        // Mock the evaluation method to return consistent results
        jest.spyOn(tester, 'evaluateResponse').mockResolvedValue({
          passed: true,
          accuracy: 0.9,
          citationPrecision: 0.95,
          citationRecall: 0.85,
          confidenceAlignment: 0.88,
        });

        const regressionResults = await tester.runEvaluationSuite('test_dataset.jsonl', {
          batchSize: 5,
        });

        expect(regressionResults).toBeDefined();
        expect(regressionResults.metrics.accuracy).toBeGreaterThan(0.8);
        expect(regressionResults.report.summary.passRate).toBeGreaterThan(0.8);

        // Step 3: Run performance benchmarks
        console.log('🏃‍♂️ Step 3: Running performance benchmarks...');
        const benchmarker = new PerformanceBenchmarker();
        
        const benchmarkResults = await benchmarker.runBenchmark({
          iterations: 5, // Reduced for testing
          concurrencyLevels: [1, 2],
          warmupIterations: 1,
          includeMemoryProfiling: false, // Simplified for testing
        });

        expect(benchmarkResults).toBeDefined();
        expect(benchmarkResults.analysis.performance.averageResponseTime).toBeGreaterThan(0);
        expect(benchmarkResults.analysis.performance.successRate).toBeGreaterThan(0);

        // Step 4: Run A/B tests
        console.log('🧪 Step 4: Running A/B tests...');
        const abFramework = new ABTestingFramework();
        
        const experiment = abFramework.defineExperiment('test_experiment', {
          name: 'Test Experiment',
          description: 'Test A/B experiment',
          variants: [
            {
              id: 'control',
              name: 'Control',
              description: 'Control variant',
              config: { maxChunks: 3 },
            },
            {
              id: 'treatment',
              name: 'Treatment',
              description: 'Treatment variant',
              config: { maxChunks: 5 },
            },
          ],
          testDataset: 'test_dataset.jsonl',
          sampleSize: 10,
        });

        const abResults = await abFramework.runExperiment('test_experiment', {
          batchSize: 2,
        });

        expect(abResults).toBeDefined();
        expect(abResults.variantResults).toHaveLength(2);
        expect(abResults.analysis.summary.bestVariant).toBeDefined();

        console.log('✅ Complete evaluation pipeline executed successfully!');

        // Verify integration points
        expect(mockMkdir).toHaveBeenCalled();
        expect(mockWriteFile).toHaveBeenCalled();

      } finally {
        // Cleanup mocks
        mockMkdir.mockRestore();
        mockWriteFile.mockRestore();
        mockReadFile.mockRestore();
      }
    }, 30000); // 30 second timeout for integration test

    it('should handle errors gracefully in pipeline', async () => {
      // Mock file operations to fail
      const mockMkdir = jest.spyOn(fs, 'mkdir').mockRejectedValue(new Error('Permission denied'));
      
      try {
        const generator = new GoldenDatasetGenerator();
        
        await expect(generator.generateGoldenDataset(
          ['test_guide.pdf'],
          'test_dataset.jsonl'
        )).rejects.toThrow();

      } finally {
        mockMkdir.mockRestore();
      }
    });
  });

  describe('Cross-Component Integration', () => {
    it('should share data between evaluation components', async () => {
      const mockReadFile = jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify([
        {
          id: 'shared_test',
          question: 'What is NAV?',
          expected_answer: 'Net Asset Value',
          category: 'nav_calculation',
          difficulty: 'medium',
        },
      ]));

      const mockWriteFile = jest.spyOn(fs, 'writeFile').mockResolvedValue();

      try {
        // Create dataset
        const generator = new GoldenDatasetGenerator();
        const dataset = await generator.generateGoldenDataset(
          ['test_guide.pdf'],
          'shared_dataset.jsonl'
        );

        // Use dataset in regression testing
        const tester = new RegressionTester();
        jest.spyOn(tester, 'evaluateResponse').mockResolvedValue({
          passed: true,
          accuracy: 0.85,
          citationPrecision: 0.9,
          citationRecall: 0.8,
          confidenceAlignment: 0.82,
        });

        const results = await tester.runEvaluationSuite('shared_dataset.jsonl');

        // Use same dataset in A/B testing
        const abFramework = new ABTestingFramework();
        const experiment = abFramework.defineExperiment('shared_test', {
          name: 'Shared Dataset Test',
          description: 'Test using shared dataset',
          variants: [
            { id: 'v1', name: 'Variant 1', config: { maxChunks: 3 } },
            { id: 'v2', name: 'Variant 2', config: { maxChunks: 5 } },
          ],
          testDataset: 'shared_dataset.jsonl',
          sampleSize: 5,
        });

        const abResults = await abFramework.runExperiment('shared_test');

        // Verify both components used the same data structure
        expect(results.metrics.totalTests).toBeGreaterThan(0);
        expect(abResults.variantResults[0].results.length).toBeGreaterThan(0);

      } finally {
        mockReadFile.mockRestore();
        mockWriteFile.mockRestore();
      }
    });
  });

  describe('Quality Gates Integration', () => {
    it('should enforce quality gates across evaluation components', async () => {
      // Mock low-quality results
      const mockEvaluateResponse = jest.fn().mockResolvedValue({
        passed: false,
        accuracy: 0.6, // Below 85% threshold
        citationPrecision: 0.7, // Below 90% threshold
        citationRecall: 0.5, // Below 80% threshold
        confidenceAlignment: 0.6,
      });

      const tester = new RegressionTester();
      jest.spyOn(tester, 'evaluateResponse').mockImplementation(mockEvaluateResponse);

      const mockReadFile = jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify([
        {
          id: 'quality_test',
          question: 'Test question?',
          expected_answer: 'Test answer',
          category: 'general',
          difficulty: 'easy',
        },
      ]));

      try {
        const results = await tester.runEvaluationSuite('quality_test.jsonl');

        // Verify quality gates detect issues
        expect(results.metrics.accuracy).toBeLessThan(0.85);
        expect(results.metrics.citationPrecision).toBeLessThan(0.90);
        expect(results.report.recommendations.length).toBeGreaterThan(0);

        // Check for accuracy recommendation
        const accuracyRec = results.report.recommendations.find(rec => rec.type === 'accuracy');
        expect(accuracyRec).toBeDefined();
        expect(accuracyRec.priority).toBe('high');

      } finally {
        mockReadFile.mockRestore();
      }
    });

    it('should pass quality gates with good performance', async () => {
      // Mock high-quality results
      const mockEvaluateResponse = jest.fn().mockResolvedValue({
        passed: true,
        accuracy: 0.95, // Above 85% threshold
        citationPrecision: 0.98, // Above 90% threshold
        citationRecall: 0.92, // Above 80% threshold
        confidenceAlignment: 0.93,
      });

      const tester = new RegressionTester();
      jest.spyOn(tester, 'evaluateResponse').mockImplementation(mockEvaluateResponse);

      const mockReadFile = jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify([
        {
          id: 'quality_test',
          question: 'Test question?',
          expected_answer: 'Test answer',
          category: 'general',
          difficulty: 'easy',
        },
      ]));

      try {
        const results = await tester.runEvaluationSuite('quality_test.jsonl');

        // Verify quality gates are satisfied
        expect(results.metrics.accuracy).toBeGreaterThanOrEqual(0.85);
        expect(results.metrics.citationPrecision).toBeGreaterThanOrEqual(0.90);
        expect(results.metrics.citationRecall).toBeGreaterThanOrEqual(0.80);
        expect(results.report.summary.passRate).toBeGreaterThan(0.8);

      } finally {
        mockReadFile.mockRestore();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a larger mock dataset
      const largeDataset = Array.from({ length: 50 }, (_, i) => ({
        id: `test_${i}`,
        question: `Test question ${i}?`,
        expected_answer: `Test answer ${i}`,
        category: i % 2 === 0 ? 'fund_creation' : 'nav_calculation',
        difficulty: ['easy', 'medium', 'hard'][i % 3],
      }));

      const mockReadFile = jest.spyOn(fs, 'readFile').mockImplementation((filePath) => {
        if (filePath.includes('large_dataset')) {
          return Promise.resolve(JSON.stringify(largeDataset));
        }
        return Promise.resolve('[]');
      });

      const mockEvaluateResponse = jest.fn().mockResolvedValue({
        passed: true,
        accuracy: 0.9,
        citationPrecision: 0.95,
        citationRecall: 0.85,
        confidenceAlignment: 0.88,
      });

      try {
        const tester = new RegressionTester();
        jest.spyOn(tester, 'evaluateResponse').mockImplementation(mockEvaluateResponse);

        const startTime = Date.now();
        const results = await tester.runEvaluationSuite('large_dataset.jsonl', {
          batchSize: 10,
        });
        const duration = Date.now() - startTime;

        // Verify it handles large dataset
        expect(results.metrics.totalTests).toBe(50);
        expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
        
        // Verify batch processing worked
        expect(mockEvaluateResponse).toHaveBeenCalledTimes(50);

      } finally {
        mockReadFile.mockRestore();
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from partial failures', async () => {
      const mockReadFile = jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify([
        { id: 'test1', question: 'Q1?', expected_answer: 'A1' },
        { id: 'test2', question: 'Q2?', expected_answer: 'A2' },
        { id: 'test3', question: 'Q3?', expected_answer: 'A3' },
      ]));

      // Mock some failures and some successes
      mockRAGChatService.generateResponse
        .mockResolvedValueOnce({
          message: 'Answer 1',
          confidence: 0.9,
          citations: [],
          sources: [],
        })
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          message: 'Answer 3',
          confidence: 0.8,
          citations: [],
          sources: [],
        });

      try {
        const tester = new RegressionTester();
        jest.spyOn(tester, 'evaluateResponse').mockResolvedValue({
          passed: true,
          accuracy: 0.85,
          citationPrecision: 0.9,
          citationRecall: 0.8,
          confidenceAlignment: 0.82,
        });

        const results = await tester.runEvaluationSuite('test_dataset.jsonl');

        // Should have processed all tests, even with one failure
        expect(results.metrics.totalTests).toBe(3);
        expect(results.metrics.passedTests).toBe(2); // 2 successful, 1 failed
        expect(results.metrics.failedTests).toBe(1);

      } finally {
        mockReadFile.mockRestore();
      }
    });
  });
});
