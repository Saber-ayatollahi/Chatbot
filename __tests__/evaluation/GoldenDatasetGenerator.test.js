/**
 * Tests for GoldenDatasetGenerator
 */

const fs = require('fs').promises;
const path = require('path');
const GoldenDatasetGenerator = require('../../evaluation/GoldenDatasetGenerator');

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../knowledge/loaders/DocumentLoader');
jest.mock('../../knowledge/chunking/SemanticChunker');
jest.mock('openai');

const mockDocumentLoader = {
  loadPDF: jest.fn(),
};

const mockSemanticChunker = {
  chunkText: jest.fn(),
};

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('../../knowledge/loaders/DocumentLoader', () => {
  return jest.fn().mockImplementation(() => mockDocumentLoader);
});

jest.mock('../../knowledge/chunking/SemanticChunker', () => {
  return jest.fn().mockImplementation(() => mockSemanticChunker);
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

describe('GoldenDatasetGenerator', () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new GoldenDatasetGenerator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateGoldenDataset', () => {
    it('should generate a complete dataset', async () => {
      // Mock document loading
      mockDocumentLoader.loadPDF.mockResolvedValue({
        sourceId: 'test_guide',
        version: '1.9',
        content: 'Test document content about fund creation and NAV calculations.',
        metadata: { pages: 100 },
      });

      // Mock chunking
      mockSemanticChunker.chunkText.mockResolvedValue([
        {
          id: 'chunk_1',
          content: 'Fund creation process requires specific mandatory fields including Fund Name, Fund Type, and Currency. The step-by-step procedure involves navigating to the Fund Creation screen and entering these required values in the designated fields.',
          index: 0,
        },
        {
          id: 'chunk_2',
          content: 'NAV calculation method involves dividing total net assets by outstanding shares. This process requires accessing the NAV calculation screen, entering the required financial values, and following the step-by-step procedure to generate accurate results.',
          index: 1,
        },
      ]);

      // Mock OpenAI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              {
                question: 'What are the required fields for fund creation?',
                expected_answer: 'The required fields are Fund Name, Fund Type, and Currency.',
                expected_citations: ['Test Guide, p.1'],
                category: 'fund_creation',
                difficulty: 'easy',
                question_type: 'factual',
              },
              {
                question: 'How is NAV calculated?',
                expected_answer: 'NAV is calculated by dividing total net assets by outstanding shares.',
                expected_citations: ['Test Guide, p.2'],
                category: 'nav_calculation',
                difficulty: 'medium',
                question_type: 'procedural',
              },
            ]),
          },
        }],
      });

      // Mock fs.writeFile
      const mockWriteFile = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      const mockMkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue();

      const userGuidePaths = ['test_guide.pdf'];
      const outputPath = '/tmp/test_dataset.jsonl';

      const result = await generator.generateGoldenDataset(userGuidePaths, outputPath);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify standard Q&A pairs
      const standardPairs = result.filter(pair => !pair.test_type || pair.test_type === 'standard');
      expect(standardPairs.length).toBeGreaterThan(0);

      // Verify edge cases were created
      const edgeCases = result.filter(pair => pair.test_type && pair.test_type !== 'standard');
      expect(edgeCases.length).toBeGreaterThan(0);

      // Verify file operations
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledTimes(3); // JSONL, JSON, and summary

      mockWriteFile.mockRestore();
      mockMkdir.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      mockDocumentLoader.loadPDF.mockRejectedValue(new Error('Failed to load PDF'));

      const userGuidePaths = ['invalid_guide.pdf'];
      const outputPath = '/tmp/test_dataset.jsonl';

      await expect(generator.generateGoldenDataset(userGuidePaths, outputPath))
        .rejects
        .toThrow('Failed to load PDF');
    });
  });

  describe('isHighQualityChunk', () => {
    it('should identify high-quality chunks', () => {
      const goodChunk = {
        content: 'To create a new fund, navigate to the Fund Creation screen and complete the required fields including Fund Name, Fund Type, and Currency. The Close Date field is optional.',
      };

      const document = { sourceId: 'test' };

      const result = generator.isHighQualityChunk(goodChunk, document);
      expect(result).toBe(true);
    });

    it('should reject low-quality chunks', () => {
      const badChunk = {
        content: 'See section 5.',
      };

      const document = { sourceId: 'test' };

      const result = generator.isHighQualityChunk(badChunk, document);
      expect(result).toBe(false);
    });

    it('should reject short chunks', () => {
      const shortChunk = {
        content: 'Short text',
      };

      const document = { sourceId: 'test' };

      const result = generator.isHighQualityChunk(shortChunk, document);
      expect(result).toBe(false);
    });

    it('should reject generic chunks', () => {
      const genericChunk = {
        content: 'Please refer to the table of contents for more information about this topic.',
      };

      const document = { sourceId: 'test' };

      const result = generator.isHighQualityChunk(genericChunk, document);
      expect(result).toBe(false);
    });
  });

  describe('categorizeChunk', () => {
    it('should categorize fund creation content', () => {
      const chunk = {
        content: 'To create a new fund, you must complete the fund creation wizard.',
      };

      const result = generator.categorizeChunk(chunk);
      expect(result).toBe('fund_creation');
    });

    it('should categorize NAV calculation content', () => {
      const chunk = {
        content: 'The net asset value (NAV) is calculated daily using the closing prices.',
      };

      const result = generator.categorizeChunk(chunk);
      expect(result).toBe('nav_calculation');
    });

    it('should categorize compliance content', () => {
      const chunk = {
        content: 'All funds must comply with regulatory requirements and reporting standards.',
      };

      const result = generator.categorizeChunk(chunk);
      expect(result).toBe('compliance');
    });

    it('should categorize reporting content', () => {
      const chunk = {
        content: 'Monthly performance reports must be generated by the 5th business day.',
      };

      const result = generator.categorizeChunk(chunk);
      expect(result).toBe('reporting');
    });

    it('should default to general category', () => {
      const chunk = {
        content: 'This is some general information about the system.',
      };

      const result = generator.categorizeChunk(chunk);
      expect(result).toBe('general');
    });
  });

  describe('assessDifficulty', () => {
    it('should assess easy difficulty for short content', () => {
      const chunk = {
        content: 'Fund Name is a required field.',
      };

      const result = generator.assessDifficulty(chunk);
      expect(result).toBe('easy');
    });

    it('should assess medium difficulty for moderate content', () => {
      const chunk = {
        content: 'To calculate NAV, you need to determine the total net assets of the fund by adding all asset values and subtracting any liabilities, then divide by the number of outstanding shares.',
      };

      const result = generator.assessDifficulty(chunk);
      expect(result).toBe('medium');
    });

    it('should assess hard difficulty for long content', () => {
      const longContent = 'This is a very long piece of content that describes a complex process with multiple steps and considerations. '.repeat(20);
      const chunk = { content: longContent };

      const result = generator.assessDifficulty(chunk);
      expect(result).toBe('hard');
    });
  });

  describe('createOutOfScopeQuestions', () => {
    it('should create out-of-scope questions', () => {
      const result = generator.createOutOfScopeQuestions();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      result.forEach(question => {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('expected_answer');
        expect(question).toHaveProperty('test_type', 'out_of_scope');
        expect(question).toHaveProperty('expected_behavior');
      });
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score for good pairs', () => {
      const goodPair = {
        question: 'What are the mandatory fields for fund creation?',
        expected_answer: 'The mandatory fields are Fund Name, Fund Type, and Currency. These must be completed before proceeding.',
        expected_citations: ['Guide 1, p.12'],
      };

      const result = generator.calculateQualityScore(goodPair);
      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThanOrEqual(1.0);
    });

    it('should calculate lower quality score for poor pairs', () => {
      const poorPair = {
        question: 'What?',
        expected_answer: 'Yes.',
        expected_citations: [],
      };

      const result = generator.calculateQualityScore(poorPair);
      expect(result).toBeLessThan(0.7);
    });
  });

  describe('generateDatasetSummary', () => {
    it('should generate comprehensive summary', () => {
      const dataset = [
        {
          category: 'fund_creation',
          difficulty: 'easy',
          test_type: 'standard',
          quality_score: 0.9,
        },
        {
          category: 'nav_calculation',
          difficulty: 'medium',
          test_type: 'standard',
          quality_score: 0.8,
        },
        {
          category: 'general',
          difficulty: 'hard',
          test_type: 'edge_case',
          quality_score: 0.6,
        },
      ];

      const result = generator.generateDatasetSummary(dataset);

      expect(result).toHaveProperty('total_pairs', 3);
      expect(result).toHaveProperty('generation_date');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('difficulties');
      expect(result).toHaveProperty('test_types');
      expect(result).toHaveProperty('quality_distribution');

      expect(result.categories).toEqual({
        fund_creation: 1,
        nav_calculation: 1,
        general: 1,
      });

      expect(result.difficulties).toEqual({
        easy: 1,
        medium: 1,
        hard: 1,
      });

      expect(result.test_types).toEqual({
        standard: 2,
        edge_case: 1,
      });

      expect(result.quality_distribution.high).toBe(2);
      expect(result.quality_distribution.medium).toBe(1);
      expect(result.quality_distribution.low).toBe(0);
    });
  });
});
