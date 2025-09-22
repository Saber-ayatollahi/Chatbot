/**
 * Confidence Manager Unit Tests
 * Testing confidence scoring and fallback mechanisms
 */

const ConfidenceManager = require('../../services/ConfidenceManager');
const { getConfig } = require('../../config/environment');

// Mock dependencies
jest.mock('../../config/environment');
jest.mock('../../config/database');

describe('ConfidenceManager', () => {
  let confidenceManager;
  let mockConfig;

  beforeEach(() => {
    // Mock configuration
    mockConfig = {
      get: jest.fn((key) => {
        const config = {
          'rag.confidence.highThreshold': 0.8,
          'rag.confidence.mediumThreshold': 0.6,
          'rag.confidence.lowThreshold': 0.4,
          'rag.confidence.minimumThreshold': 0.2
        };
        return config[key];
      })
    };
    
    getConfig.mockReturnValue(mockConfig);
    
    confidenceManager = new ConfidenceManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateConfidence', () => {
    test('should calculate comprehensive confidence score', async () => {
      const mockData = {
        retrievalData: {
          chunks: [
            { similarity_score: 0.9, quality_score: 0.8 },
            { similarity_score: 0.8, quality_score: 0.7 }
          ]
        },
        contentData: {
          response: 'This is a comprehensive response with proper citations (Test Guide, p.1).',
          citations: [
            { isValid: true, source: 'Test Guide', page: 1 }
          ]
        },
        contextData: {
          queryAnalysis: {
            hasQuestionWords: true,
            complexity: 'simple',
            entities: ['fund', 'nav'],
            keywords: ['fund', 'creation'],
            wordCount: 6
          }
        },
        generationData: {
          model: 'gpt-4',
          finishReason: 'stop',
          temperature: 0.3,
          responseLength: 100,
          tokensUsed: {
            prompt_tokens: 500,
            completion_tokens: 100,
            total_tokens: 600
          }
        }
      };

      const assessment = await confidenceManager.calculateConfidence(
        mockData.retrievalData,
        mockData.contentData,
        mockData.contextData,
        mockData.generationData
      );

      expect(assessment).toBeDefined();
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(assessment.overallConfidence).toBeLessThanOrEqual(1);
      expect(assessment.confidenceLevel).toBeDefined();
      expect(assessment.qualityIndicator).toBeDefined();
      expect(assessment.components).toBeDefined();
      expect(assessment.components.retrieval).toBeDefined();
      expect(assessment.components.content).toBeDefined();
      expect(assessment.components.context).toBeDefined();
      expect(assessment.components.generation).toBeDefined();
    });

    test('should handle missing or incomplete data gracefully', async () => {
      const minimalData = {
        retrievalData: { chunks: [] },
        contentData: { response: '', citations: [] },
        contextData: { queryAnalysis: {} },
        generationData: {}
      };

      const assessment = await confidenceManager.calculateConfidence(
        minimalData.retrievalData,
        minimalData.contentData,
        minimalData.contextData,
        minimalData.generationData
      );

      expect(assessment).toBeDefined();
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(assessment.overallConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateRetrievalConfidence', () => {
    test('should calculate retrieval confidence correctly', () => {
      const retrievalData = {
        chunks: [
          { 
            similarity_score: 0.9, 
            quality_score: 0.8,
            citation: { source: 'Guide 1' },
            filename: 'guide1.pdf'
          },
          { 
            similarity_score: 0.8, 
            quality_score: 0.7,
            citation: { source: 'Guide 2' },
            filename: 'guide2.pdf'
          }
        ]
      };

      const result = confidenceManager.calculateRetrievalConfidence(retrievalData);

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.details).toBeDefined();
      expect(result.details.topSimilarity).toBe(0.9);
      expect(result.details.averageSimilarity).toBeCloseTo(0.85, 2);
      expect(result.details.diversityScore).toBeGreaterThan(0);
    });

    test('should handle empty chunks', () => {
      const retrievalData = { chunks: [] };
      
      const result = confidenceManager.calculateRetrievalConfidence(retrievalData);
      
      expect(result.score).toBe(0);
      expect(result.details.topSimilarity).toBe(0);
      expect(result.details.averageSimilarity).toBe(0);
    });
  });

  describe('calculateContentConfidence', () => {
    test('should calculate content confidence with citations', () => {
      const contentData = {
        response: 'This is a detailed response with proper citations (Guide 1, p.5) and good structure.',
        citations: [
          { isValid: true, source: 'Guide 1', page: 5 },
          { isValid: true, source: 'Guide 2', page: 10 }
        ]
      };

      const result = confidenceManager.calculateContentConfidence(contentData);

      expect(result.score).toBeGreaterThan(0);
      expect(result.details.citationPresence).toBeGreaterThan(0);
      expect(result.details.citationAccuracy).toBe(1); // All citations valid
      expect(result.details.responseCompleteness).toBeGreaterThan(0);
    });

    test('should penalize poor citation quality', () => {
      const contentData = {
        response: 'Short response',
        citations: [
          { isValid: false, source: 'Unknown' },
          { isValid: true, source: 'Guide 1' }
        ]
      };

      const result = confidenceManager.calculateContentConfidence(contentData);

      expect(result.details.citationAccuracy).toBe(0.5); // 50% valid
      expect(result.score).toBeLessThan(1);
    });
  });

  describe('calculateContextConfidence', () => {
    test('should calculate context confidence based on query analysis', () => {
      const contextData = {
        queryAnalysis: {
          hasQuestionWords: true,
          complexity: 'simple',
          entities: ['fund', 'nav'],
          keywords: ['fund', 'creation', 'process'],
          wordCount: 8
        },
        conversationHistory: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' }
        ]
      };

      const result = confidenceManager.calculateContextConfidence(contextData);

      expect(result.score).toBeGreaterThan(0);
      expect(result.details.queryClarity).toBeGreaterThan(0.5);
      expect(result.details.domainRelevance).toBeGreaterThan(0);
      expect(result.details.conversationContext).toBe(0.8); // Has conversation history
    });

    test('should handle complex queries with lower confidence', () => {
      const contextData = {
        queryAnalysis: {
          hasQuestionWords: false,
          complexity: 'complex',
          entities: [],
          keywords: [],
          wordCount: 25
        }
      };

      const result = confidenceManager.calculateContextConfidence(contextData);

      expect(result.details.queryComplexity).toBe(0.5); // Complex query penalty
      expect(result.details.domainRelevance).toBe(0); // No relevant entities
    });
  });

  describe('calculateGenerationConfidence', () => {
    test('should calculate generation confidence for GPT-4', () => {
      const generationData = {
        model: 'gpt-4',
        finishReason: 'stop',
        temperature: 0.3,
        responseLength: 250,
        tokensUsed: {
          prompt_tokens: 500,
          completion_tokens: 100,
          total_tokens: 600
        }
      };

      const result = confidenceManager.calculateGenerationConfidence(generationData);

      expect(result.score).toBeGreaterThan(0);
      expect(result.details.modelConfidence).toBeGreaterThan(0.7); // GPT-4 boost
      expect(result.details.finishReason).toBe(1); // Complete response
      expect(result.details.responseLength).toBe(1); // Appropriate length
    });

    test('should penalize incomplete responses', () => {
      const generationData = {
        model: 'gpt-3.5-turbo',
        finishReason: 'length',
        temperature: 0.8,
        responseLength: 10,
        tokensUsed: {}
      };

      const result = confidenceManager.calculateGenerationConfidence(generationData);

      expect(result.details.finishReason).toBe(0.7); // Length cutoff penalty
      expect(result.details.responseLength).toBe(0.7); // Too short
    });
  });

  describe('getConfidenceLevel', () => {
    test('should return correct confidence levels', () => {
      expect(confidenceManager.getConfidenceLevel(0.9)).toBe('high');
      expect(confidenceManager.getConfidenceLevel(0.7)).toBe('medium');
      expect(confidenceManager.getConfidenceLevel(0.5)).toBe('low');
      expect(confidenceManager.getConfidenceLevel(0.3)).toBe('very_low');
    });
  });

  describe('getQualityIndicator', () => {
    test('should return appropriate quality indicators', () => {
      const excellent = confidenceManager.getQualityIndicator(0.95);
      expect(excellent.level).toBe('excellent');
      expect(excellent.description).toContain('Highly confident');

      const poor = confidenceManager.getQualityIndicator(0.3);
      expect(poor.level).toBe('poor');
      expect(poor.description).toContain('Poor confidence');
    });
  });

  describe('identifyConfidenceIssues', () => {
    test('should identify multiple confidence issues', () => {
      const confidenceData = {
        retrieval: { score: 0.3, details: {} },
        content: { 
          score: 0.4, 
          details: { citationAccuracy: 0.5, citationPresence: 0.2 } 
        },
        context: { 
          score: 0.5, 
          details: { queryClarity: 0.3, domainRelevance: 0.2 } 
        },
        generation: { 
          score: 0.6, 
          details: { finishReason: 0.5, modelConfidence: 0.8 } 
        },
        overall: 0.4
      };

      const issues = confidenceManager.identifyConfidenceIssues(confidenceData);

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0);
      
      const issueTypes = issues.map(issue => issue.type);
      expect(issueTypes).toContain('low_retrieval_confidence');
      expect(issueTypes).toContain('poor_citation_quality');
      expect(issueTypes).toContain('query_ambiguity');
    });

    test('should return no issues for high confidence', () => {
      const confidenceData = {
        retrieval: { score: 0.9, details: {} },
        content: { 
          score: 0.9, 
          details: { citationAccuracy: 0.9, citationPresence: 0.8 } 
        },
        context: { 
          score: 0.8, 
          details: { queryClarity: 0.8, domainRelevance: 0.7 } 
        },
        generation: { 
          score: 0.9, 
          details: { finishReason: 1.0, modelConfidence: 0.9 } 
        },
        overall: 0.9
      };

      const issues = confidenceManager.identifyConfidenceIssues(confidenceData);

      expect(issues).toHaveLength(0);
    });
  });

  describe('applyFallbackStrategy', () => {
    test('should apply low retrieval confidence fallback', async () => {
      const context = {
        query: 'How do I create a fund?',
        originalResponse: 'Limited information available.',
        originalConfidence: 0.3
      };

      const fallback = await confidenceManager.applyFallbackStrategy(
        'low_retrieval_confidence',
        context
      );

      expect(fallback).toBeDefined();
      expect(fallback.strategy).toBe('low_retrieval_confidence');
      expect(fallback.message).toContain('limited relevant information');
      expect(fallback.suggestions).toBeDefined();
      expect(Array.isArray(fallback.suggestions)).toBe(true);
    });

    test('should apply no relevant sources fallback', async () => {
      const context = { query: 'Unrelated topic' };

      const fallback = await confidenceManager.applyFallbackStrategy(
        'no_relevant_sources',
        context
      );

      expect(fallback.strategy).toBe('no_relevant_sources');
      expect(fallback.message).toContain('couldn\'t find specific information');
      expect(fallback.confidence).toBeLessThan(0.5);
    });

    test('should apply poor citation quality fallback', async () => {
      const context = {
        originalResponse: 'This is a response with poor citations.',
        originalConfidence: 0.6
      };

      const fallback = await confidenceManager.applyFallbackStrategy(
        'poor_citation_quality',
        context
      );

      expect(fallback.strategy).toBe('poor_citation_quality');
      expect(fallback.message).toContain(context.originalResponse);
      expect(fallback.message).toContain('citations in this response may not be fully accurate');
      expect(fallback.confidence).toBeLessThan(context.originalConfidence);
    });

    test('should apply query ambiguity fallback', async () => {
      const context = { query: 'Ambiguous question' };

      const fallback = await confidenceManager.applyFallbackStrategy(
        'query_ambiguity',
        context
      );

      expect(fallback.strategy).toBe('query_ambiguity');
      expect(fallback.message).toContain('could be interpreted in several ways');
      expect(fallback.clarificationOptions).toBeDefined();
    });

    test('should handle unknown strategy with system error fallback', async () => {
      const context = { query: 'Test query' };

      const fallback = await confidenceManager.applyFallbackStrategy(
        'unknown_strategy',
        context
      );

      expect(fallback.strategy).toBe('system_error');
      expect(fallback.confidence).toBe(0.1);
      expect(fallback.error).toBe(true);
    });
  });

  describe('calculateReliabilityMetrics', () => {
    test('should calculate comprehensive reliability metrics', () => {
      const data = {
        retrievalData: {
          chunks: [
            { quality_score: 0.9, citation: { source: 'Guide 1' } },
            { quality_score: 0.8, citation: { source: 'Guide 2' } }
          ]
        },
        contentData: {
          response: 'Comprehensive response with good citations.',
          citations: [
            { isValid: true },
            { isValid: true }
          ],
          coherenceScore: 0.8
        },
        contextData: {},
        generationData: {}
      };

      const metrics = confidenceManager.calculateReliabilityMetrics(data);

      expect(metrics).toBeDefined();
      expect(metrics.sourceReliability).toBeGreaterThan(0);
      expect(metrics.informationCompleteness).toBeGreaterThan(0);
      expect(metrics.responseConsistency).toBeGreaterThan(0);
      expect(metrics.citationReliability).toBe(1); // All citations valid
      expect(metrics.overallReliability).toBeGreaterThan(0);
    });

    test('should handle empty data gracefully', () => {
      const data = {
        retrievalData: { chunks: [] },
        contentData: { response: '', citations: [] },
        contextData: {},
        generationData: {}
      };

      const metrics = confidenceManager.calculateReliabilityMetrics(data);

      expect(metrics.sourceReliability).toBe(0);
      expect(metrics.citationReliability).toBe(0);
      expect(metrics.overallReliability).toBeGreaterThanOrEqual(0);
    });
  });

  describe('testConfidenceManager', () => {
    test('should run comprehensive test successfully', async () => {
      const testResult = await confidenceManager.testConfidenceManager();

      expect(testResult.success).toBe(true);
      expect(testResult.processingTime).toBeGreaterThan(0);
      expect(testResult.confidenceAssessment).toBeDefined();
      expect(testResult.testScenarios).toBeDefined();
      expect(testResult.testScenarios.lowConfidence).toBeDefined();
      expect(testResult.testScenarios.noSources).toBeDefined();
      expect(testResult.testScenarios.poorCitations).toBeDefined();
    });

    test('should handle test with custom data', async () => {
      const customData = {
        retrievalData: { chunks: [] },
        contentData: { response: 'Custom test', citations: [] },
        contextData: { queryAnalysis: { complexity: 'complex' } },
        generationData: { finishReason: 'length' }
      };

      const testResult = await confidenceManager.testConfidenceManager(customData);

      expect(testResult.success).toBe(true);
      expect(testResult.confidenceAssessment.overallConfidence).toBeLessThan(0.8);
    });
  });

  describe('Query Analysis Helpers', () => {
    test('should calculate query clarity correctly', () => {
      const clearQuery = {
        hasQuestionWords: true,
        intent: ['definition'],
        entities: ['fund', 'nav'],
        wordCount: 6
      };

      const clarity = confidenceManager.calculateQueryClarity(clearQuery);
      expect(clarity).toBeGreaterThan(0.5);

      const unclearQuery = {
        hasQuestionWords: false,
        intent: [],
        entities: [],
        wordCount: 2
      };

      const lowClarity = confidenceManager.calculateQueryClarity(unclearQuery);
      expect(lowClarity).toBeLessThan(clarity);
    });

    test('should calculate domain relevance correctly', () => {
      const relevantQuery = {
        entities: ['fund', 'portfolio'],
        keywords: ['nav', 'investment', 'compliance']
      };

      const relevance = confidenceManager.calculateDomainRelevance(relevantQuery);
      expect(relevance).toBeGreaterThan(0);

      const irrelevantQuery = {
        entities: ['weather', 'sports'],
        keywords: ['temperature', 'game']
      };

      const lowRelevance = confidenceManager.calculateDomainRelevance(irrelevantQuery);
      expect(lowRelevance).toBe(0);
    });
  });

  describe('Coherence Scoring', () => {
    test('should score coherent text highly', () => {
      const coherentText = 'Fund creation is a multi-step process. First, you need to define the fund structure. Additionally, you must establish compliance procedures. Therefore, proper planning is essential.';
      
      const score = confidenceManager.calculateCoherenceScore(coherentText);
      expect(score).toBeGreaterThan(0.5);
    });

    test('should score incoherent text lowly', () => {
      const incoherentText = 'fund fund fund create create process process step step';
      
      const score = confidenceManager.calculateCoherenceScore(incoherentText);
      expect(score).toBeLessThan(0.8);
    });

    test('should handle empty or very short text', () => {
      expect(confidenceManager.calculateCoherenceScore('')).toBe(0);
      expect(confidenceManager.calculateCoherenceScore('short')).toBe(0);
    });
  });
});
