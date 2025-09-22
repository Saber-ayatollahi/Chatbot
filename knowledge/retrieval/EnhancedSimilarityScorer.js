/**
 * Enhanced Similarity Scorer Module
 * Advanced scoring system that considers content type, instructional value, and context
 * Addresses the issue of table of contents ranking higher than actual instructions
 */

const ContentTypeAnalyzer = require('../analysis/ContentTypeAnalyzer');
const logger = require('../../utils/logger');

class EnhancedSimilarityScorer {
  constructor() {
    this.contentAnalyzer = new ContentTypeAnalyzer();
    
    // Scoring weights for different factors
    this.scoringWeights = {
      vectorSimilarity: 0.4,      // Base vector similarity
      contentTypeMatch: 0.25,     // How well content type matches query type
      instructionalValue: 0.2,    // Value for instructional queries
      qualityScore: 0.1,          // Content quality
      contextualRelevance: 0.05   // Additional contextual factors
    };

    // Query type patterns
    this.queryTypePatterns = {
      procedure: /(?:how\s+to|steps?\s+to|process\s+for|procedure|guide|tutorial|walkthrough|create|setup|configure)/i,
      definition: /(?:what\s+is|define|definition\s+of|meaning\s+of|explain)/i,
      comparison: /(?:difference\s+between|compare|versus|vs\.?|better|best)/i,
      list: /(?:list|enumerate|what\s+are|types?\s+of|kinds?\s+of)/i,
      example: /(?:example|sample|instance|demonstrate|show\s+me)/i,
      troubleshooting: /(?:error|problem|issue|fix|solve|troubleshoot|debug)/i
    };

    // Content type penalties and boosts
    this.contentTypeModifiers = {
      // For procedural queries (how to create fund)
      procedure: {
        instructions: 2.5,        // MASSIVE boost for instruction content
        examples: 1.2,            // Boost for examples
        definitions: 0.8,         // Slight penalty for definitions
        tableOfContents: 0.1,     // SEVERE penalty for TOC
        faq: 1.0,                 // Neutral for FAQ
        text: 0.7                 // Penalty for generic text
      },
      
      // For definition queries (what is X)
      definition: {
        definitions: 1.4,         // Major boost for definitions
        text: 1.0,                // Neutral for text
        instructions: 0.7,        // Penalty for instructions
        examples: 0.8,            // Slight penalty for examples
        tableOfContents: 0.3,     // Major penalty for TOC
        faq: 0.9                  // Slight penalty for FAQ
      },
      
      // For list queries (what are the types)
      list: {
        instructions: 1.2,        // Boost for instructions (often contain lists)
        examples: 1.1,            // Boost for examples
        tableOfContents: 0.6,     // Moderate penalty for TOC
        definitions: 0.8,         // Slight penalty for definitions
        text: 0.9,                // Slight penalty for generic text
        faq: 1.0                  // Neutral for FAQ
      }
    };

    // Additional boost factors
    this.boostFactors = {
      // Length-based boosts (longer content often more detailed)
      contentLength: {
        veryShort: 0.8,    // < 200 chars
        short: 0.9,        // 200-500 chars
        medium: 1.0,       // 500-1500 chars
        long: 1.1,         // 1500-3000 chars
        veryLong: 1.2      // > 3000 chars
      },
      
      // Step-based boosts (step-by-step content)
      stepCount: {
        none: 1.0,         // No steps
        few: 1.1,          // 1-2 steps
        some: 1.2,         // 3-5 steps
        many: 1.3          // 6+ steps
      },
      
      // Action word density boosts
      actionWordDensity: {
        none: 1.0,         // No action words
        low: 1.05,         // 1-2 action words
        medium: 1.1,       // 3-5 action words
        high: 1.15         // 6+ action words
      }
    };
  }

  /**
   * Enhanced scoring that considers content type and instructional value
   * @param {Array} chunks - Chunks with basic similarity scores
   * @param {string} query - Original user query
   * @param {Object} context - Additional context
   * @returns {Array} Chunks with enhanced scores
   */
  async enhanceChunkScores(chunks, query, context = {}) {
    try {
      logger.info(`🎯 Enhancing scores for ${chunks.length} chunks`);
      
      // Analyze query type
      const queryType = this.analyzeQueryType(query);
      logger.info(`📊 Query type detected: ${queryType}`);
      
      // Process each chunk
      const enhancedChunks = await Promise.all(
        chunks.map(chunk => this.enhanceChunkScore(chunk, query, queryType, context))
      );
      
      // Sort by enhanced score
      const sortedChunks = enhancedChunks.sort((a, b) => 
        b.enhanced_score - a.enhanced_score
      );
      
      // Log scoring details for top chunks
      this.logScoringDetails(sortedChunks.slice(0, 5), queryType);
      
      return sortedChunks;
      
    } catch (error) {
      logger.error('❌ Enhanced scoring failed:', error.message);
      // Fallback to original similarity scores
      return chunks.sort((a, b) => 
        (b.similarity_score || 0) - (a.similarity_score || 0)
      );
    }
  }

  /**
   * Enhance individual chunk score
   */
  async enhanceChunkScore(chunk, query, queryType, context) {
    try {
      // Analyze chunk content type
      const contentAnalysis = this.contentAnalyzer.analyzeContent(
        chunk.content,
        chunk.heading,
        chunk.metadata
      );
      
      // Base similarity score
      const baseSimilarity = chunk.similarity_score || 0.5;
      
      // Content type matching score
      const contentTypeScore = this.calculateContentTypeScore(
        contentAnalysis.contentType,
        queryType,
        contentAnalysis
      );
      
      // Instructional value score (important for "how to" queries)
      const instructionalScore = this.calculateInstructionalScore(
        contentAnalysis,
        queryType,
        query
      );
      
      // Quality and length boosts
      const qualityBoosts = this.calculateQualityBoosts(
        chunk,
        contentAnalysis
      );
      
      // Contextual relevance
      const contextualScore = this.calculateContextualRelevance(
        chunk,
        query,
        context
      );
      
      // Calculate weighted enhanced score
      const enhancedScore = 
        baseSimilarity * this.scoringWeights.vectorSimilarity +
        contentTypeScore * this.scoringWeights.contentTypeMatch +
        instructionalScore * this.scoringWeights.instructionalValue +
        qualityBoosts * this.scoringWeights.qualityScore +
        contextualScore * this.scoringWeights.contextualRelevance;
      
      // Apply final normalization and bounds
      const finalScore = Math.max(0, Math.min(1, enhancedScore));
      
      return {
        ...chunk,
        enhanced_score: finalScore,
        content_type: contentAnalysis.contentType, // Add content type directly to chunk
        content_analysis: contentAnalysis,
        scoring_details: {
          base_similarity: baseSimilarity,
          content_type_score: contentTypeScore,
          instructional_score: instructionalScore,
          quality_boosts: qualityBoosts,
          contextual_score: contextualScore,
          query_type: queryType
        }
      };
      
    } catch (error) {
      logger.warn(`⚠️ Failed to enhance score for chunk ${chunk.chunk_id}:`, error.message);
      return {
        ...chunk,
        enhanced_score: chunk.similarity_score || 0.5,
        scoring_error: error.message
      };
    }
  }

  /**
   * Analyze query type from user input
   */
  analyzeQueryType(query) {
    const queryLower = query.toLowerCase();
    
    for (const [type, pattern] of Object.entries(this.queryTypePatterns)) {
      if (pattern.test(queryLower)) {
        return type;
      }
    }
    
    return 'general'; // Default type
  }

  /**
   * Calculate content type matching score
   */
  calculateContentTypeScore(contentType, queryType, contentAnalysis) {
    // Get base modifier for content type vs query type
    const modifier = this.contentTypeModifiers[queryType]?.[contentType] || 1.0;
    
    // Additional penalties for table of contents on procedural queries
    if (queryType === 'procedure' && contentAnalysis.isTableOfContents) {
      return 0.1; // Very low score for TOC on "how to" queries
    }
    
    // Additional boosts for high instructional value on procedural queries
    if (queryType === 'procedure' && contentAnalysis.instructionalValue > 0.8) {
      return Math.min(1.0, modifier * 1.2);
    }
    
    // Boost for high-confidence content type detection
    if (contentAnalysis.confidence > 0.8) {
      return Math.min(1.0, modifier * 1.1);
    }
    
    return Math.min(1.0, modifier);
  }

  /**
   * Calculate instructional value score
   */
  calculateInstructionalScore(contentAnalysis, queryType, query) {
    let score = contentAnalysis.instructionalValue || 0.5;
    
    // Major boost for procedural queries with high instructional value
    if (queryType === 'procedure') {
      if (contentAnalysis.isInstructional) {
        score *= 1.5;
      }
      
      // Penalty for table of contents
      if (contentAnalysis.isTableOfContents) {
        score *= 0.2;
      }
      
      // Boost for step-by-step content
      const stepCount = contentAnalysis.detailedAnalysis?.instructions?.stepCount || 0;
      if (stepCount > 1) {
        score *= (1 + stepCount * 0.1);
      }
    }
    
    // Check for specific query terms that indicate need for detailed instructions
    const detailWords = ['detailed', 'step by step', 'complete', 'comprehensive', 'full'];
    const hasDetailRequest = detailWords.some(word => 
      query.toLowerCase().includes(word)
    );
    
    if (hasDetailRequest && contentAnalysis.isInstructional) {
      score *= 1.3;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate quality and length boosts
   */
  calculateQualityBoosts(chunk, contentAnalysis) {
    let boost = chunk.quality_score || 0.5;
    
    // Content length boost
    const contentLength = chunk.content?.length || 0;
    if (contentLength > 3000) {
      boost *= this.boostFactors.contentLength.veryLong;
    } else if (contentLength > 1500) {
      boost *= this.boostFactors.contentLength.long;
    } else if (contentLength > 500) {
      boost *= this.boostFactors.contentLength.medium;
    } else if (contentLength > 200) {
      boost *= this.boostFactors.contentLength.short;
    } else {
      boost *= this.boostFactors.contentLength.veryShort;
    }
    
    // Step count boost
    const stepCount = contentAnalysis.detailedAnalysis?.instructions?.stepCount || 0;
    if (stepCount >= 6) {
      boost *= this.boostFactors.stepCount.many;
    } else if (stepCount >= 3) {
      boost *= this.boostFactors.stepCount.some;
    } else if (stepCount >= 1) {
      boost *= this.boostFactors.stepCount.few;
    }
    
    // Action word density boost
    const actionWordCount = contentAnalysis.detailedAnalysis?.instructions?.actionWordCount || 0;
    if (actionWordCount >= 6) {
      boost *= this.boostFactors.actionWordDensity.high;
    } else if (actionWordCount >= 3) {
      boost *= this.boostFactors.actionWordDensity.medium;
    } else if (actionWordCount >= 1) {
      boost *= this.boostFactors.actionWordDensity.low;
    }
    
    return Math.min(1.0, boost);
  }

  /**
   * Calculate contextual relevance
   */
  calculateContextualRelevance(chunk, query, context) {
    let relevance = 0.5;
    
    // Boost for recent content (if timestamp available)
    if (chunk.created_at) {
      const age = Date.now() - new Date(chunk.created_at).getTime();
      const daysSinceCreation = age / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreation < 30) {
        relevance += 0.1;
      } else if (daysSinceCreation < 90) {
        relevance += 0.05;
      }
    }
    
    // Boost for source reliability (if available)
    if (chunk.source_title && chunk.source_title.toLowerCase().includes('guide')) {
      relevance += 0.1;
    }
    
    // Boost for chunks with good metadata
    if (chunk.metadata && Object.keys(chunk.metadata).length > 0) {
      relevance += 0.05;
    }
    
    return Math.min(1.0, relevance);
  }

  /**
   * Log scoring details for debugging
   */
  logScoringDetails(topChunks, queryType) {
    logger.info(`🏆 Top ${topChunks.length} chunks after enhanced scoring:`);
    
    topChunks.forEach((chunk, index) => {
      const details = chunk.scoring_details || {};
      const analysis = chunk.content_analysis || {};
      
      logger.info(`   ${index + 1}. Score: ${chunk.enhanced_score.toFixed(3)} | ` +
        `Type: ${analysis.contentType} | ` +
        `Instructional: ${analysis.isInstructional} | ` +
        `TOC: ${analysis.isTableOfContents} | ` +
        `Length: ${chunk.content?.length || 0}`);
      
      if (details.base_similarity !== undefined) {
        logger.info(`      Base: ${details.base_similarity.toFixed(3)} | ` +
          `ContentType: ${details.content_type_score.toFixed(3)} | ` +
          `Instructional: ${details.instructional_score.toFixed(3)} | ` +
          `Quality: ${details.quality_boosts.toFixed(3)}`);
      }
    });
  }

  /**
   * Get scoring configuration for different query types
   */
  getQueryTypeConfig(queryType) {
    const configs = {
      procedure: {
        prioritizeInstructions: true,
        penalizeTableOfContents: true,
        boostStepByStep: true,
        requireActionWords: true
      },
      definition: {
        prioritizeDefinitions: true,
        allowTableOfContents: false,
        boostExplanations: true,
        requireClearDefinition: true
      },
      list: {
        prioritizeLists: true,
        allowTableOfContents: true,
        boostEnumeration: true,
        requireStructuredContent: true
      }
    };
    
    return configs[queryType] || configs.procedure; // Default to procedure config
  }
}

module.exports = EnhancedSimilarityScorer;
