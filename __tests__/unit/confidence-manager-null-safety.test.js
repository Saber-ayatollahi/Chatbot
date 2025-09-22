/**
 * Confidence Manager Null Safety Tests
 * Critical Issue #3 - Verify proper null/undefined handling
 */

const ConfidenceManager = require('../../services/ConfidenceManager');

// Mock logger to prevent console spam during tests
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock config
jest.mock('../../config/environment', () => ({
  getConfig: () => ({
    get: (key) => {
      const configs = {
        'rag.confidence.highThreshold': 0.8,
        'rag.confidence.mediumThreshold': 0.6,
        'rag.confidence.lowThreshold': 0.4,
        'rag.confidence.minimumThreshold': 0.2
      };
      return configs[key];
    }
  })
}));

// Mock database
jest.mock('../../config/database', () => ({
  getDatabase: () => ({
    isReady: () => true,
    initialize: jest.fn()
  })
}));

describe('ConfidenceManager Null Safety', () => {
  let confidenceManager;

  beforeEach(() => {
    confidenceManager = new ConfidenceManager();
  });

  describe('CRITICAL: Retrieval Confidence Null Handling', () => {
    test('should handle null retrievalData gracefully', async () => {
      const result = confidenceManager.calculateRetrievalConfidence(null);
      
      expect(result.score).toBe(0);
      expect(result.details.error).toBe('Invalid retrievalData');
      expect(result.issues).toContain('Invalid input data');
    });

    test('should handle undefined retrievalData gracefully', async () => {
      const result = confidenceManager.calculateRetrievalConfidence(undefined);
      
      expect(result.score).toBe(0);
      expect(result.details.error).toBe('Invalid retrievalData');
      expect(result.issues).toContain('Invalid input data');
    });

    test('should handle empty retrievalData object', async () => {
      const result = confidenceManager.calculateRetrievalConfidence({});
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.details.topSimilarity).toBe(0);
      expect(result.details.averageSimilarity).toBe(0);
      expect(result.details.sourceQuality).toBe(0.5); // Default quality
    });

    test('should handle null chunks array', async () => {
      const retrievalData = { chunks: null };
      const result = confidenceManager.calculateRetrievalConfidence(retrievalData);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.details.topSimilarity).toBe(0);
      expect(result.details.averageSimilarity).toBe(0);
    });

    test('should handle chunks with missing similarity_score', async () => {
      const retrievalData = {
        chunks: [
          { content: 'test content 1' }, // No similarity_score
          { similarity_score: null },     // Null similarity_score
          { similarity_score: 0.8 },      // Valid similarity_score
          { similarity_score: NaN },      // NaN similarity_score
          { similarity_score: 'invalid' } // Invalid type
        ]
      };
      
      const result = confidenceManager.calculateRetrievalConfidence(retrievalData);
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.details.topSimilarity).toBe(0); // First chunk has no valid score
      expect(result.details.averageSimilarity).toBe(0.8); // Only one valid chunk
    });

    test('should handle chunks with missing quality_score', async () => {
      const retrievalData = {
        chunks: [
          { similarity_score: 0.9 }, // No quality_score
          { similarity_score: 0.8, quality_score: null }, // Null quality_score
          { similarity_score: 0.7, quality_score: 0.5 },  // Valid quality_score
          { similarity_score: 0.6, quality_score: NaN }   // NaN quality_score
        ]
      };
      
      const result = confidenceManager.calculateRetrievalConfidence(retrievalData);
      
      expect(result.details.sourceQuality).toBe(0.5); // Only one valid quality score
    });

    test('should handle chunks with missing citation/source info', async () => {
      const retrievalData = {
        chunks: [
          { similarity_score: 0.9 }, // No citation or filename
          { similarity_score: 0.8, citation: null }, // Null citation
          { similarity_score: 0.7, citation: { source: 'Guide 1' } }, // Valid citation
          { similarity_score: 0.6, filename: 'guide2.pdf' } // Valid filename
        ]
      };
      
      const result = confidenceManager.calculateRetrievalConfidence(retrievalData);
      
      expect(result.details.diversityScore).toBeGreaterThan(0);
      // Should find 2 unique sources: 'Guide 1' and 'guide2.pdf'
      expect(result.details.diversityScore).toBe(Math.min(2 / 3, 1));
    });
  });

  describe('CRITICAL: Content Confidence Null Handling', () => {
    test('should handle null contentData gracefully', async () => {
      const result = confidenceManager.calculateContentConfidence(null);
      
      expect(result.score).toBe(0);
      expect(result.details.error).toBe('Invalid contentData');
      expect(result.issues).toContain('Invalid input data');
    });

    test('should handle undefined contentData gracefully', async () => {
      const result = confidenceManager.calculateContentConfidence(undefined);
      
      expect(result.score).toBe(0);
      expect(result.details.error).toBe('Invalid contentData');
    });

    test('should handle empty contentData object', async () => {
      const result = confidenceManager.calculateContentConfidence({});
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.details.citationPresence).toBe(0);
      expect(result.details.citationAccuracy).toBe(0);
      expect(result.details.responseCompleteness).toBe(0);
    });

    test('should handle null citations array', async () => {
      const contentData = { citations: null };
      const result = confidenceManager.calculateContentConfidence(contentData);
      
      expect(result.details.citationPresence).toBe(0);
      expect(result.details.citationAccuracy).toBe(0);
    });

    test('should handle invalid citation objects', async () => {
      const contentData = {
        citations: [
          null,                          // Null citation
          undefined,                     // Undefined citation
          'invalid',                     // String instead of object
          { isValid: true },            // Valid citation
          { isValid: false },           // Invalid citation
          { isValid: null },            // Null isValid
          { someOtherField: 'value' }   // Missing isValid
        ]
      };
      
      const result = confidenceManager.calculateContentConfidence(contentData);
      
      expect(result.details.citationAccuracy).toBe(1 / 7); // Only 1 valid out of 7
    });

    test('should handle null response text', async () => {
      const contentData = { response: null };
      const result = confidenceManager.calculateContentConfidence(contentData);
      
      expect(result.details.responseCompleteness).toBe(0);
      expect(result.details.coherenceScore).toBeGreaterThanOrEqual(0);
    });

    test('should handle non-string response', async () => {
      const contentData = { response: 12345 }; // Number instead of string
      const result = confidenceManager.calculateContentConfidence(contentData);
      
      expect(result.details.responseCompleteness).toBe(0);
      expect(result.details.coherenceScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CRITICAL: Context Confidence Null Handling', () => {
    test('should handle null contextData gracefully', async () => {
      const result = confidenceManager.calculateContextConfidence(null);
      
      // Should not crash and return reasonable defaults
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing queryAnalysis', async () => {
      const contextData = {}; // No queryAnalysis
      const result = confidenceManager.calculateContextConfidence(contextData);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.details.queryClarity).toBeGreaterThanOrEqual(0);
    });

    test('should handle null queryAnalysis', async () => {
      const contextData = { queryAnalysis: null };
      const result = confidenceManager.calculateContextConfidence(contextData);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CRITICAL: Generation Confidence Null Handling', () => {
    test('should handle null generationData gracefully', async () => {
      const result = confidenceManager.calculateGenerationConfidence(null);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing tokensUsed', async () => {
      const generationData = {}; // No tokensUsed
      const result = confidenceManager.calculateGenerationConfidence(generationData);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.details.tokenUtilization).toBeGreaterThanOrEqual(0);
    });

    test('should handle null tokensUsed', async () => {
      const generationData = { tokensUsed: null };
      const result = confidenceManager.calculateGenerationConfidence(generationData);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CRITICAL: Overall Confidence Calculation', () => {
    test('should handle all null inputs gracefully', async () => {
      const result = await confidenceManager.calculateConfidence(null, null, null, null);
      
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
      expect(result.confidenceLevel).toBeDefined();
      expect(result.components).toBeDefined();
    });

    test('should handle mixed valid and invalid inputs', async () => {
      const retrievalData = { chunks: [{ similarity_score: 0.8, quality_score: 0.7 }] };
      const contentData = null; // Invalid
      const contextData = { queryAnalysis: { complexity: 'simple' } };
      const generationData = null; // Invalid
      
      const result = await confidenceManager.calculateConfidence(
        retrievalData, 
        contentData, 
        contextData, 
        generationData
      );
      
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.components.retrieval.score).toBeGreaterThan(0);
      expect(result.components.content.score).toBe(0); // Should handle null gracefully
    });
  });

  describe('Error Recovery', () => {
    test('should not throw exceptions on malformed data', async () => {
      const malformedData = {
        chunks: [
          { similarity_score: Infinity },
          { similarity_score: -Infinity },
          { quality_score: 'not a number' },
          { citation: { source: null } }
        ]
      };
      
      expect(() => {
        confidenceManager.calculateRetrievalConfidence(malformedData);
      }).not.toThrow();
    });

    test('should handle circular references gracefully', async () => {
      const circularData = { chunks: [] };
      circularData.chunks.push(circularData); // Create circular reference
      
      expect(() => {
        confidenceManager.calculateRetrievalConfidence(circularData);
      }).not.toThrow();
    });
  });
});
