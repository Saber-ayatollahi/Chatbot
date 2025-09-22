/**
 * DocumentLoader Unit Tests
 * Comprehensive tests for PDF and document processing
 * Phase 1: Foundation & Infrastructure Setup
 */

const DocumentLoader = require('../../knowledge/loaders/DocumentLoader');
const fs = require('fs-extra');
const path = require('path');

// Mock dependencies
jest.mock('../../config/environment', () => ({
  getConfig: jest.fn()
}));
jest.mock('../../utils/logger');

describe('DocumentLoader', () => {
  let documentLoader;
  let mockConfig;

  beforeEach(() => {
    // Mock configuration
    mockConfig = {
      get: jest.fn((key) => {
        const config = {
          'documents.maxFileSize': 100, // 100 bytes for testing file size validation
          'documents.allowedTypes': ['pdf', 'docx', 'txt', 'md'],
          'documents.processingTimeout': 300000,
          'documents.enableOCR': false,
          'documents.ocrLanguage': 'eng'
        };
        return config[key];
      }),
      // Add direct properties for fallback access
      documents: {
        maxFileSize: 100,
        allowedTypes: ['pdf', 'docx', 'txt', 'md'],
        processingTimeout: 300000,
        enableOCR: false,
        ocrLanguage: 'eng'
      }
    };

    const { getConfig } = require('../../config/environment');
    getConfig.mockReturnValue(mockConfig);
    
    documentLoader = new DocumentLoader();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with supported file types', () => {
      expect(documentLoader.supportedTypes).toBeDefined();
      expect(documentLoader.supportedTypes['application/pdf']).toBeDefined();
      expect(documentLoader.supportedTypes['text/plain']).toBeDefined();
    });

    it('should have configuration loaded', () => {
      expect(documentLoader.config).toBeDefined();
      expect(mockConfig.get).toHaveBeenCalled();
    });
  });

  describe('validateDocument', () => {
    it('should validate existing file successfully', async () => {
      // Create a temporary test file
      const testFile = path.join(__dirname, 'test.pdf');
      await fs.writeFile(testFile, 'test content');

      const validation = await documentLoader.validateDocument(testFile);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Cleanup
      await fs.remove(testFile);
    });

    it('should fail validation for non-existent file', async () => {
      const validation = await documentLoader.validateDocument('/non/existent/file.pdf');

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File does not exist');
    });

    it('should fail validation for oversized file', async () => {
      // Mock a large file
      mockConfig.get.mockImplementation((key) => {
        if (key === 'documents.maxFileSize') return 100; // 100 bytes
        return null;
      });
      
      // Create new DocumentLoader with updated config
      const { getConfig } = require('../../config/environment');
      getConfig.mockReturnValue(mockConfig);
      const testLoader = new DocumentLoader();

      const testFile = path.join(__dirname, 'large-test.pdf');
      await fs.writeFile(testFile, 'a'.repeat(200)); // 200 bytes

      const validation = await testLoader.validateDocument(testFile);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('exceeds maximum'))).toBe(true);

      // Cleanup
      await fs.remove(testFile);
    });

    it('should fail validation for empty file', async () => {
      const testFile = path.join(__dirname, 'empty-test.pdf');
      await fs.writeFile(testFile, '');

      const validation = await documentLoader.validateDocument(testFile);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File is empty');

      // Cleanup
      await fs.remove(testFile);
    });
  });

  describe('loadTXT', () => {
    it('should load plain text file successfully', async () => {
      const testContent = 'This is a test document.\n\nIt has multiple paragraphs.\n\nAnd some structure.';
      const buffer = Buffer.from(testContent, 'utf8');

      const result = await documentLoader.loadTXT(buffer, '/test/file.txt');

      expect(result.text).toBe(testContent);
      expect(result.totalPages).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].content).toBe(testContent);
      expect(result.headings).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    it('should handle empty text file', async () => {
      const buffer = Buffer.from('', 'utf8');

      const result = await documentLoader.loadTXT(buffer, '/test/empty.txt');

      expect(result.text).toBe('');
      expect(result.totalPages).toBe(1);
    });
  });

  describe('extractDocumentStructure', () => {
    it('should extract headings from text', () => {
      const text = `# Main Heading
      
      Some content here.
      
      ## Sub Heading
      
      More content.
      
      ### Another Heading
      
      Final content.`;

      const structure = documentLoader.extractDocumentStructure(text);

      expect(structure.headings).toHaveLength(3);
      expect(structure.headings[0].text).toBe('Main Heading');
      expect(structure.headings[0].level).toBe(1);
      expect(structure.headings[1].text).toBe('Sub Heading');
      expect(structure.headings[1].level).toBe(2);
    });

    it('should extract numbered headings', () => {
      const text = `1. First Section
      
      Content for first section.
      
      1.1 Subsection
      
      Subsection content.
      
      2. Second Section
      
      Content for second section.`;

      const structure = documentLoader.extractDocumentStructure(text);

      expect(structure.headings.length).toBeGreaterThan(0);
      expect(structure.sections.length).toBeGreaterThan(0);
    });

    it('should handle text without headings', () => {
      const text = 'This is just plain text without any headings or structure.';

      const structure = documentLoader.extractDocumentStructure(text);

      expect(structure.headings).toHaveLength(0);
      expect(structure.sections).toHaveLength(0);
    });
  });

  describe('extractTables', () => {
    it('should extract pipe-separated tables', () => {
      const text = `Some text before.
      
      | Column 1 | Column 2 | Column 3 |
      | Value 1  | Value 2  | Value 3  |
      | Value 4  | Value 5  | Value 6  |
      
      Some text after.`;

      const tables = documentLoader.extractTables(text);

      expect(tables).toHaveLength(1);
      expect(tables[0].content).toContain('Column 1');
      expect(tables[0].separatorType).toBe('|');
      expect(tables[0].rowCount).toBe(3);
    });

    it('should extract tab-separated tables', () => {
      const text = `Header1\tHeader2\tHeader3
      Value1\tValue2\tValue3
      Value4\tValue5\tValue6`;

      const tables = documentLoader.extractTables(text);

      expect(tables).toHaveLength(1);
      expect(tables[0].separatorType).toBe('\t');
    });

    it('should handle text without tables', () => {
      const text = 'This is just regular text without any tabular data.';

      const tables = documentLoader.extractTables(text);

      expect(tables).toHaveLength(0);
    });
  });

  describe('extractLinks', () => {
    it('should extract HTTP URLs', () => {
      const text = 'Visit https://example.com for more information. Also check http://test.org.';

      const links = documentLoader.extractLinks(text);

      expect(links).toHaveLength(2);
      expect(links[0].url).toBe('https://example.com');
      expect(links[0].type).toBe('url');
      expect(links[1].url).toBe('http://test.org');
    });

    it('should extract email addresses', () => {
      const text = 'Contact us at support@example.com or admin@test.org for help.';

      const links = documentLoader.extractLinks(text);

      expect(links).toHaveLength(2);
      expect(links[0].url).toBe('support@example.com');
      expect(links[0].type).toBe('email');
      expect(links[1].url).toBe('admin@test.org');
      expect(links[1].type).toBe('email');
    });

    it('should extract www URLs', () => {
      const text = 'Visit www.example.com for more details.';

      const links = documentLoader.extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0].url).toBe('www.example.com');
      expect(links[0].type).toBe('url');
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(documentLoader.countWords('Hello world')).toBe(2);
      expect(documentLoader.countWords('This is a test sentence.')).toBe(5);
      expect(documentLoader.countWords('')).toBe(0);
      expect(documentLoader.countWords('   ')).toBe(0);
      expect(documentLoader.countWords('One')).toBe(1);
    });

    it('should handle special characters and punctuation', () => {
      expect(documentLoader.countWords('Hello, world! How are you?')).toBe(5);
      expect(documentLoader.countWords('test@example.com')).toBe(1);
    });

    it('should handle null and undefined', () => {
      expect(documentLoader.countWords(null)).toBe(0);
      expect(documentLoader.countWords(undefined)).toBe(0);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score for good content', () => {
      const documentContent = {
        text: 'This is a well-structured document with multiple paragraphs and good content. It contains various types of information and maintains good quality throughout.',
        headings: [
          { text: 'Main Heading', level: 1 },
          { text: 'Sub Heading', level: 2 }
        ],
        tables: [
          { content: 'Table content' }
        ]
      };

      const score = documentLoader.calculateQualityScore(documentContent);

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should calculate lower score for poor content', () => {
      const documentContent = {
        text: 'Short text.',
        headings: [],
        tables: []
      };

      const score = documentLoader.calculateQualityScore(documentContent);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(0.7);
    });

    it('should handle empty content', () => {
      const documentContent = {
        text: '',
        headings: [],
        tables: []
      };

      const score = documentLoader.calculateQualityScore(documentContent);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('detectLanguage', () => {
    it('should detect English text', () => {
      const text = 'This is an English text with common English words like the, and, or, but, in, on, at, to, for, of, with, by.';

      const language = documentLoader.detectLanguage(text);

      expect(language).toBe('en');
    });

    it('should default to English for ambiguous text', () => {
      const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit.';

      const language = documentLoader.detectLanguage(text);

      expect(language).toBe('en');
    });

    it('should handle empty text', () => {
      const language = documentLoader.detectLanguage('');

      expect(language).toBe('en');
    });
  });

  describe('getSupportedTypes', () => {
    it('should return array of supported MIME types', () => {
      const types = documentLoader.getSupportedTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('application/pdf');
      expect(types).toContain('text/plain');
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Mock fs.pathExists to throw an error
      const originalPathExists = fs.pathExists;
      fs.pathExists = jest.fn().mockRejectedValue(new Error('File system error'));

      const validation = await documentLoader.validateDocument('/test/file.pdf');

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Validation error'))).toBe(true);

      // Restore original function
      fs.pathExists = originalPathExists;
    });

    it('should handle invalid file paths', async () => {
      const validation = await documentLoader.validateDocument('');

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('integration scenarios', () => {
    it('should process a complete document workflow', async () => {
      // Reset mock to default configuration for integration test
      mockConfig.get.mockImplementation((key) => {
        const config = {
          'documents.maxFileSize': 50 * 1024 * 1024, // 50MB default
          'documents.allowedTypes': ['pdf', 'docx', 'txt', 'md'],
          'documents.processingTimeout': 300000,
          'documents.enableOCR': false,
          'documents.ocrLanguage': 'eng'
        };
        return config[key];
      });
      
      // Create fresh DocumentLoader with default config
      const { getConfig } = require('../../config/environment');
      getConfig.mockReturnValue(mockConfig);
      const integrationLoader = new DocumentLoader();
      
      const testContent = `# Fund Management Guide

This is a comprehensive guide for fund management.

## Section 1: Getting Started

To get started with fund management, follow these steps:

1. Create a new fund
2. Set up the hierarchy
3. Configure rollforward settings

## Section 2: Advanced Features

| Feature | Description | Status |
| ------- | ----------- | ------ |
| Analytics | Advanced reporting | Active |
| Compliance | Regulatory compliance | Active |

For more information, visit https://example.com or contact support@example.com.

### Subsection 2.1: Configuration

Additional configuration details here.`;

      const testFile = path.join(__dirname, 'integration-test.txt');
      await fs.writeFile(testFile, testContent);

      try {
        const document = await integrationLoader.loadDocument(testFile, 'test-source', '1.0');

        // Verify document structure
        expect(document.sourceId).toBe('test-source');
        expect(document.version).toBe('1.0');
        expect(document.content).toBe(testContent);
        expect(document.totalPages).toBe(1);
        expect(document.characterCount).toBe(testContent.length);
        expect(document.wordCount).toBeGreaterThan(0);

        // Verify extracted elements
        expect(document.headings.length).toBeGreaterThan(0);
        expect(document.sections.length).toBeGreaterThan(0);

        // Verify metadata
        expect(document.fileName).toBe('integration-test.txt');
        expect(document.qualityScore).toBeGreaterThan(0);
        expect(document.metadata).toBeDefined();
        expect(document.metadata.processingTimestamp).toBeDefined();

      } finally {
        // Cleanup
        await fs.remove(testFile);
      }
    });
  });
});
