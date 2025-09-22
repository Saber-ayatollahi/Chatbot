/**
 * SemanticChunker Unit Tests
 * Comprehensive tests for text chunking functionality
 * Phase 1: Foundation & Infrastructure Setup
 */

const SemanticChunker = require('../../knowledge/chunking/SemanticChunker');

// Mock dependencies
jest.mock('../../config/environment');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('SemanticChunker', () => {
  let chunker;
  let mockConfig;
  let mockDocument;

  beforeEach(() => {
    // Mock configuration
    mockConfig = {
      get: jest.fn((key) => {
        const config = {
          'documentProcessing.chunking.chunkSize': 450,
          'documentProcessing.chunking.chunkOverlap': 50,
          'documentProcessing.chunking.minChunkSize': 100,
          'documentProcessing.chunking.maxChunkSize': 600,
          'documentProcessing.chunking.preserveStructure': true,
          'documentProcessing.chunking.chunkStrategy': 'semantic',
          'documentProcessing.filtering.minQualityScore': 0.3
        };
        return config[key];
      })
    };

    const { getConfig } = require('../../config/environment');
    getConfig.mockReturnValue(mockConfig);
    
    chunker = new SemanticChunker();

    // Mock document
    mockDocument = {
      sourceId: 'test-source',
      version: '1.0',
      fileName: 'test-document.txt',
      content: `# Fund Management Guide

This is a comprehensive guide for fund management. It covers all the essential aspects of managing investment funds.

## Section 1: Getting Started

To get started with fund management, you need to understand the basic concepts and procedures.

### 1.1 Fund Creation

Creating a new fund involves several steps:

1. Define the fund objectives
2. Set up the legal structure
3. Establish the investment strategy
4. Configure compliance settings

## Section 2: Portfolio Management

Portfolio management is a critical aspect of fund management. It involves making investment decisions and managing risk.

### 2.1 Asset Allocation

Asset allocation determines how investments are distributed across different asset classes.

### 2.2 Risk Management

Risk management involves identifying, assessing, and mitigating potential risks.`,
      sections: [
        {
          title: 'Fund Management Guide',
          level: 1,
          content: 'This is a comprehensive guide for fund management. It covers all the essential aspects of managing investment funds.',
          startPosition: 0,
          endPosition: 100
        },
        {
          title: 'Getting Started',
          level: 2,
          content: 'To get started with fund management, you need to understand the basic concepts and procedures.',
          startPosition: 100,
          endPosition: 200
        }
      ],
      headings: [
        { text: 'Fund Management Guide', level: 1, position: 0 },
        { text: 'Getting Started', level: 2, position: 100 },
        { text: 'Fund Creation', level: 3, position: 150 }
      ],
      language: 'en'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(chunker.config).toBeDefined();
      expect(chunker.tokenizer).toBeDefined();
      expect(chunker.sentenceTokenizer).toBeDefined();
      expect(chunker.strategies).toBeDefined();
    });

    it('should have all chunking strategies available', () => {
      expect(chunker.strategies.semantic).toBeDefined();
      expect(chunker.strategies.fixed).toBeDefined();
      expect(chunker.strategies.sentence).toBeDefined();
      expect(chunker.strategies.paragraph).toBeDefined();
      expect(chunker.strategies.section).toBeDefined();
    });
  });

  describe('chunkDocument', () => {
    it('should chunk document with default settings', async () => {
      const chunks = await chunker.chunkDocument(mockDocument);

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      // Verify chunk structure
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('chunkIndex');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('tokenCount');
        expect(chunk).toHaveProperty('wordCount');
        expect(chunk).toHaveProperty('characterCount');
        expect(chunk).toHaveProperty('sourceId');
        expect(chunk).toHaveProperty('version');
        expect(chunk).toHaveProperty('qualityScore');
        expect(chunk).toHaveProperty('metadata');
        
        expect(chunk.sourceId).toBe('test-source');
        expect(chunk.version).toBe('1.0');
        expect(typeof chunk.content).toBe('string');
        expect(chunk.content.trim().length).toBeGreaterThan(0);
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.qualityScore).toBeGreaterThanOrEqual(0);
        expect(chunk.qualityScore).toBeLessThanOrEqual(1);
      });
    });

    it('should respect token limits', async () => {
      const options = {
        maxTokens: 200,
        overlapTokens: 20
      };

      const chunks = await chunker.chunkDocument(mockDocument, options);

      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(options.maxTokens);
      });
    });

    it('should handle different chunking strategies', async () => {
      const strategies = ['semantic', 'fixed', 'sentence', 'paragraph'];

      for (const strategy of strategies) {
        const options = { strategy };
        const chunks = await chunker.chunkDocument(mockDocument, options);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].metadata.chunkingStrategy).toBe(strategy);
      }
    });

    it('should preserve structure when enabled', async () => {
      const options = { preserveStructure: true };
      const chunks = await chunker.chunkDocument(mockDocument, options);

      // Should have some chunks with headings
      const chunksWithHeadings = chunks.filter(chunk => chunk.heading);
      expect(chunksWithHeadings.length).toBeGreaterThan(0);
    });

    it('should handle empty document', async () => {
      const emptyDocument = {
        ...mockDocument,
        content: '',
        sections: [],
        headings: []
      };

      const chunks = await chunker.chunkDocument(emptyDocument);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('extractParagraphs', () => {
    it('should extract paragraphs correctly', () => {
      const content = `First paragraph with some content.

Second paragraph with different content.

Third paragraph with more information.`;

      const paragraphs = chunker.extractParagraphs(content);

      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0].content).toContain('First paragraph');
      expect(paragraphs[1].content).toContain('Second paragraph');
      expect(paragraphs[2].content).toContain('Third paragraph');
      
      paragraphs.forEach(paragraph => {
        expect(paragraph).toHaveProperty('startLine');
        expect(paragraph).toHaveProperty('endLine');
        expect(paragraph).toHaveProperty('wordCount');
      });
    });

    it('should handle single paragraph', () => {
      const content = 'This is a single paragraph without line breaks.';
      const paragraphs = chunker.extractParagraphs(content);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].content).toBe(content);
    });

    it('should handle empty content', () => {
      const paragraphs = chunker.extractParagraphs('');
      expect(paragraphs).toHaveLength(0);
    });

    it('should handle content with multiple empty lines', () => {
      const content = `First paragraph.



Second paragraph after multiple empty lines.`;

      const paragraphs = chunker.extractParagraphs(content);
      expect(paragraphs).toHaveLength(2);
    });
  });

  describe('createChunk', () => {
    it('should create chunk with all required properties', () => {
      const content = 'This is test content for chunk creation.';
      const chunkIndex = 0;
      const sourceParagraphs = [];
      const config = { strategy: 'semantic' };

      const chunk = chunker.createChunk(content, mockDocument, chunkIndex, sourceParagraphs, config);

      expect(chunk.chunkIndex).toBe(0);
      expect(chunk.content).toBe(content);
      expect(chunk.sourceId).toBe(mockDocument.sourceId);
      expect(chunk.version).toBe(mockDocument.version);
      expect(chunk.fileName).toBe(mockDocument.fileName);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.wordCount).toBeGreaterThan(0);
      expect(chunk.characterCount).toBe(content.length);
      expect(chunk.qualityScore).toBeGreaterThanOrEqual(0);
      expect(chunk.qualityScore).toBeLessThanOrEqual(1);
      expect(chunk.contentType).toBeDefined();
      expect(chunk.metadata).toBeDefined();
      expect(chunk.metadata.chunkingStrategy).toBe('semantic');
    });

    it('should classify content types correctly', () => {
      const testCases = [
        { content: '| Column 1 | Column 2 |\n| Value 1 | Value 2 |', expectedType: 'table' },
        { content: '- Item 1\n- Item 2\n- Item 3', expectedType: 'list' },
        { content: '1. First item\n2. Second item', expectedType: 'list' },
        { content: 'function test() { return true; }', expectedType: 'code' },
        { content: 'Definition: This term means...', expectedType: 'definition' },
        { content: 'Step 1: Do this\nStep 2: Do that', expectedType: 'procedure' },
        { content: 'This is regular text content.', expectedType: 'text' }
      ];

      testCases.forEach(({ content, expectedType }) => {
        const chunk = chunker.createChunk(content, mockDocument, 0, [], {});
        expect(chunk.contentType).toBe(expectedType);
      });
    });
  });

  describe('calculateChunkQuality', () => {
    it('should calculate higher quality for well-structured content', () => {
      const goodContent = 'This is a well-structured paragraph with complete sentences. It contains meaningful information and follows proper grammar rules. The content is comprehensive and informative.';
      const config = { maxTokens: 450, minChunkSize: 100 };

      const score = chunker.calculateChunkQuality(goodContent, config);

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should calculate lower quality for poor content', () => {
      const poorContent = 'Short.';
      const config = { maxTokens: 450, minChunkSize: 100 };

      const score = chunker.calculateChunkQuality(poorContent, config);

      expect(score).toBeLessThan(0.5);
    });

    it('should penalize very short content', () => {
      const shortContent = 'Too short';
      const config = { maxTokens: 450, minChunkSize: 100 };

      const score = chunker.calculateChunkQuality(shortContent, config);

      expect(score).toBeLessThan(0.4);
    });

    it('should reward complete sentences', () => {
      const completeContent = 'This is a complete sentence with proper punctuation.';
      const incompleteContent = 'This is incomplete';
      const config = { maxTokens: 450, minChunkSize: 50 };

      const completeScore = chunker.calculateChunkQuality(completeContent, config);
      const incompleteScore = chunker.calculateChunkQuality(incompleteContent, config);

      expect(completeScore).toBeGreaterThan(incompleteScore);
    });
  });

  describe('countTokens', () => {
    it('should count tokens approximately', () => {
      const text = 'This is a test sentence with multiple words.';
      const tokenCount = chunker.countTokens(text);

      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });

    it('should handle empty text', () => {
      expect(chunker.countTokens('')).toBe(0);
      expect(chunker.countTokens(null)).toBe(0);
      expect(chunker.countTokens(undefined)).toBe(0);
    });

    it('should provide reasonable estimates', () => {
      const shortText = 'Hello world';
      const longText = 'This is a much longer text with many more words and characters that should result in a higher token count.';

      const shortTokens = chunker.countTokens(shortText);
      const longTokens = chunker.countTokens(longText);

      expect(longTokens).toBeGreaterThan(shortTokens);
    });
  });

  describe('validateChunks', () => {
    it('should validate good chunks', () => {
      const goodChunks = [
        {
          chunkIndex: 0,
          content: 'This is a good chunk with sufficient content and proper structure.',
          tokenCount: 200,
          qualityScore: 0.8
        },
        {
          chunkIndex: 1,
          content: 'Another good chunk with meaningful content and appropriate length.',
          tokenCount: 180,
          qualityScore: 0.7
        }
      ];

      const config = {
        minChunkSize: 100,
        maxChunkSize: 600
      };

      const validChunks = chunker.validateChunks(goodChunks, config);

      expect(validChunks).toHaveLength(2);
      expect(validChunks[0].chunkIndex).toBe(0);
      expect(validChunks[1].chunkIndex).toBe(1);
    });

    it('should reject chunks that are too small', () => {
      const chunks = [
        {
          chunkIndex: 0,
          content: 'Too small',
          tokenCount: 50,
          qualityScore: 0.8
        }
      ];

      const config = {
        minChunkSize: 100,
        maxChunkSize: 600
      };

      const validChunks = chunker.validateChunks(chunks, config);

      expect(validChunks).toHaveLength(0);
    });

    it('should reject chunks that are too large', () => {
      const chunks = [
        {
          chunkIndex: 0,
          content: 'Very long content that exceeds the maximum token limit',
          tokenCount: 700,
          qualityScore: 0.8
        }
      ];

      const config = {
        minChunkSize: 100,
        maxChunkSize: 600
      };

      const validChunks = chunker.validateChunks(chunks, config);

      expect(validChunks).toHaveLength(0);
    });

    it('should reject low quality chunks', () => {
      const chunks = [
        {
          chunkIndex: 0,
          content: 'Content with low quality score',
          tokenCount: 200,
          qualityScore: 0.2
        }
      ];

      const config = {
        minChunkSize: 100,
        maxChunkSize: 600
      };

      // Mock the config to return a higher minimum quality score
      mockConfig.get.mockImplementation((key) => {
        if (key === 'documentProcessing.filtering.minQualityScore') return 0.5;
        return 0.3;
      });

      const validChunks = chunker.validateChunks(chunks, config);

      expect(validChunks).toHaveLength(0);
    });

    it('should reject empty chunks', () => {
      const chunks = [
        {
          chunkIndex: 0,
          content: '',
          tokenCount: 0,
          qualityScore: 0.5
        }
      ];

      const config = {
        minChunkSize: 100,
        maxChunkSize: 600
      };

      const validChunks = chunker.validateChunks(chunks, config);

      expect(validChunks).toHaveLength(0);
    });
  });

  describe('getChunkingStats', () => {
    it('should calculate statistics for chunks', () => {
      const chunks = [
        {
          tokenCount: 200,
          wordCount: 150,
          characterCount: 800,
          qualityScore: 0.8,
          contentType: 'text'
        },
        {
          tokenCount: 180,
          wordCount: 140,
          characterCount: 750,
          qualityScore: 0.7,
          contentType: 'text'
        },
        {
          tokenCount: 220,
          wordCount: 160,
          characterCount: 900,
          qualityScore: 0.9,
          contentType: 'table'
        }
      ];

      const stats = chunker.getChunkingStats(chunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.totalTokens).toBe(600);
      expect(stats.totalWords).toBe(450);
      expect(stats.totalCharacters).toBe(2450);
      expect(stats.averageTokensPerChunk).toBe(200);
      expect(stats.averageWordsPerChunk).toBe(150);
      expect(stats.averageCharactersPerChunk).toBe(Math.round(2450 / 3));
      expect(stats.averageQualityScore).toBeCloseTo(0.8, 1);
      expect(stats.contentTypes.text).toBe(2);
      expect(stats.contentTypes.table).toBe(1);
    });

    it('should handle empty chunks array', () => {
      const stats = chunker.getChunkingStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.averageTokensPerChunk).toBe(0);
      expect(stats.averageQualityScore).toBe(0);
    });

    it('should handle null/undefined input', () => {
      const stats1 = chunker.getChunkingStats(null);
      const stats2 = chunker.getChunkingStats(undefined);

      expect(stats1.totalChunks).toBe(0);
      expect(stats2.totalChunks).toBe(0);
    });
  });

  describe('preprocessContent', () => {
    it('should normalize whitespace', () => {
      const content = 'Text with\r\nWindows line endings\tand tabs   and trailing spaces   ';
      const processed = chunker.preprocessContent(content);

      expect(processed).not.toContain('\r\n');
      expect(processed).not.toContain('\t');
      expect(processed).not.toMatch(/   $/m); // No trailing spaces
    });

    it('should limit consecutive newlines', () => {
      const content = 'Paragraph 1\n\n\n\n\nParagraph 2';
      const processed = chunker.preprocessContent(content);

      expect(processed).toBe('Paragraph 1\n\nParagraph 2');
    });

    it('should remove control characters', () => {
      const content = 'Text with\u0000control\u0001characters\u0002';
      const processed = chunker.preprocessContent(content);

      expect(processed).toBe('Text withcontrolcharacters');
    });

    it('should handle empty content', () => {
      expect(chunker.preprocessContent('')).toBe('');
      expect(chunker.preprocessContent(null)).toBe('');
      expect(chunker.preprocessContent(undefined)).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle invalid strategy', async () => {
      const options = { strategy: 'invalid-strategy' };

      await expect(chunker.chunkDocument(mockDocument, options))
        .rejects.toThrow('Unknown chunking strategy');
    });

    it('should handle malformed document', async () => {
      const malformedDocument = {
        sourceId: 'test',
        version: '1.0',
        content: null // Invalid content
      };

      const result = await chunker.chunkDocument(malformedDocument);
      
      // Should handle gracefully by returning empty array
      expect(result).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex document with multiple sections', async () => {
      const complexDocument = {
        sourceId: 'test-complex-source',
        version: '1.0',
        fileName: 'complex-test-document.txt',
        content: `# Main Title

Introduction paragraph with some content.

## Chapter 1: Getting Started

### 1.1 Prerequisites

Before you begin, ensure you have:
- Required software installed
- Proper permissions
- Network access

### 1.2 Installation

Follow these steps:

1. Download the installer
2. Run the installation wizard
3. Configure the settings

## Chapter 2: Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Port    | 8080  | Server port |
| Host    | localhost | Server host |

For more information, visit https://example.com.

## Conclusion

This concludes the documentation.`
      };

      // Use smaller chunk size to ensure multiple chunks
      const options = {
        maxTokens: 100, // Small token limit to force multiple chunks
        overlapTokens: 10
      };
      const chunks = await chunker.chunkDocument(complexDocument, options);

      // Verify multiple chunks and content types
      expect(chunks.length).toBeGreaterThan(1);
      const contentTypes = new Set(chunks.map(chunk => chunk.contentType));
      expect(contentTypes.size).toBeGreaterThan(1);
      
      // Verify chunk continuity
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
        expect(chunks[i].nextChunkIndex).toBe(i + 1);
        expect(chunks[i + 1].previousChunkIndex).toBe(i);
      }

      // Content types already verified above
    });
  });
});
