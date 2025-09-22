/**
 * Smart Chunk Selector
 * Pre-filters and optimizes chunks before token-heavy processing
 */

const logger = require('../utils/logger');

class SmartChunkSelector {
  constructor(options = {}) {
    this.options = {
      // Relevance thresholds
      minRelevanceScore: options.minRelevanceScore || 0.3,
      highRelevanceThreshold: options.highRelevanceThreshold || 0.7,
      
      // Quality thresholds
      minQualityScore: options.minQualityScore || 0.4,
      highQualityThreshold: options.highQualityThreshold || 0.8,
      
      // Content optimization
      maxChunkLength: options.maxChunkLength || 1000,
      minChunkLength: options.minChunkLength || 50,
      
      // Diversity settings
      maxChunksPerSource: options.maxChunksPerSource || 3,
      maxChunksPerPage: options.maxChunksPerPage || 2,
      
      // Token budgeting
      tokenBudgetRatio: options.tokenBudgetRatio || 0.7, // Use 70% of budget for chunks
      
      ...options
    };
    
    this.stats = {
      totalProcessed: 0,
      totalFiltered: 0,
      totalOptimized: 0,
      averageReduction: 0
    };
  }

  /**
   * Select and optimize chunks based on query and token budget
   * @param {Array} chunks - Raw chunks from retrieval
   * @param {string} query - User query
   * @param {Object} options - Selection options
   * @returns {Object} Optimized chunk selection
   */
  async selectOptimalChunks(chunks, query, options = {}) {
    const startTime = Date.now();

    const {
      tokenBudget = 1500,
      maxChunks = 5,
      complexity = 'standard',
      prioritizeQuality = true
    } = options;

    try {
      logger.info(`dY" Smart chunk selection: ${chunks.length} chunks, budget: ${tokenBudget} tokens`);

      // Step 1: Initial filtering
      const filteredChunks = this.applyInitialFilters(chunks, query);

      // Step 2: Score and rank chunks
      const scoredChunks = this.scoreChunks(filteredChunks, query, options);

      // Step 3: Apply diversity constraints
      const diversifiedChunks = this.applyDiversityConstraints(scoredChunks, options);

      // Step 4: Optimize for token budget
      const optimizedChunks = this.optimizeForTokenBudget(
        diversifiedChunks,
        tokenBudget,
        maxChunks,
        complexity
      );

      // Step 5: Final content optimization
      const finalChunks = this.optimizeChunkContent(optimizedChunks, tokenBudget);

      const processingTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(chunks.length, finalChunks.length, processingTime);

      const result = {
        chunks: finalChunks,
        originalCount: chunks.length,
        selectedCount: finalChunks.length,
        estimatedTokens: this.estimateTokenUsage(finalChunks),
        tokenBudget,
        utilizationRatio: this.estimateTokenUsage(finalChunks) / tokenBudget,
        processingTime,
        optimizations: {
          filtered: chunks.length - filteredChunks.length,
          diversified: filteredChunks.length - diversifiedChunks.length,
          budgetOptimized: diversifiedChunks.length - optimizedChunks.length,
          contentOptimized: optimizedChunks.length - finalChunks.length
        }
      };

      logger.info(`�o. Chunk selection completed: ${result.selectedCount}/${result.originalCount} chunks, ${result.estimatedTokens} tokens`);

      return result;

    } catch (error) {
      logger.error('�?O Smart chunk selection failed:', error);

      // Fallback: return first N chunks with basic filtering
      const fallbackChunks = chunks
        .filter(chunk => chunk.content && chunk.content.length > this.options.minChunkLength)
        .slice(0, maxChunks);

      return {
        chunks: fallbackChunks,
        originalCount: chunks.length,
        selectedCount: fallbackChunks.length,
        estimatedTokens: this.estimateTokenUsage(fallbackChunks),
        tokenBudget,
        processingTime: Date.now() - startTime,
        fallback: true,
        error: error.message
      };
    }
  }

  /**
   * Apply initial quality and relevance filters
   * @param {Array} chunks - Raw chunks
   * @param {string} query - User query
   * @returns {Array} Filtered chunks
   */
  applyInitialFilters(chunks, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return chunks.filter(chunk => {
      // Filter by quality score
      if (chunk.quality_score && chunk.quality_score < this.options.minQualityScore) {
        return false;
      }
      
      // Filter by relevance score
      if (chunk.relevance_score && chunk.relevance_score < this.options.minRelevanceScore) {
        return false;
      }
      
      // Filter by content length
      if (!chunk.content || 
          chunk.content.length < this.options.minChunkLength ||
          chunk.content.length > this.options.maxChunkLength * 3) {
        return false;
      }
      
      // Filter by query relevance (basic keyword matching)
      const contentLower = chunk.content.toLowerCase();
      const matchingWords = queryWords.filter(word => contentLower.includes(word));
      const relevanceRatio = matchingWords.length / queryWords.length;
      
      if (relevanceRatio < 0.1) { // At least 10% of query words should match
        return false;
      }
      
      return true;
    });
  }

  /**
   * Score chunks based on multiple factors
   * @param {Array} chunks - Filtered chunks
   * @param {string} query - User query
   * @param {Object} options - Scoring options
   * @returns {Array} Scored and sorted chunks
   */
  scoreChunks(chunks, query, options) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    const scoredChunks = chunks.map(chunk => {
      const contentLower = chunk.content.toLowerCase();
      
      // Base relevance score (from retrieval)
      const baseRelevance = chunk.relevance_score || chunk.similarity_score || 0.5;
      
      // Quality score
      const qualityScore = chunk.quality_score || 0.5;
      
      // Keyword density score
      const matchingWords = queryWords.filter(word => contentLower.includes(word));
      const keywordDensity = matchingWords.length / queryWords.length;
      
      // Content length optimization score
      const optimalLength = 500; // Optimal chunk length
      const lengthScore = 1 - Math.abs(chunk.content.length - optimalLength) / optimalLength;
      const normalizedLengthScore = Math.max(0.1, Math.min(1.0, lengthScore));
      
      // Heading bonus
      const headingBonus = chunk.heading ? 0.1 : 0;
      
      // Page number penalty (prefer earlier pages)
      const pageNumber = chunk.page_number || 1;
      const pagePenalty = Math.max(0, (pageNumber - 1) * 0.02);
      
      // Calculate composite score
      const compositeScore = (
        baseRelevance * 0.4 +
        qualityScore * 0.25 +
        keywordDensity * 0.2 +
        normalizedLengthScore * 0.1 +
        headingBonus
      ) - pagePenalty;
      
      return {
        ...chunk,
        compositeScore: Math.max(0, Math.min(1, compositeScore)),
        keywordDensity,
        lengthScore: normalizedLengthScore
      };
    });
    
    // Sort by composite score (descending)
    return scoredChunks.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Apply diversity constraints to avoid redundancy
   * @param {Array} chunks - Scored chunks
   * @param {Object} options - Diversity options
   * @returns {Array} Diversified chunks
   */
  applyDiversityConstraints(chunks, options) {
    const sourceCount = {};
    const pageCount = {};
    const diversifiedChunks = [];
    
    for (const chunk of chunks) {
      const sourceId = chunk.source_id || 'unknown';
      const pageKey = `${sourceId}_${chunk.page_number || 1}`;
      
      // Check source diversity
      const currentSourceCount = sourceCount[sourceId] || 0;
      if (currentSourceCount >= this.options.maxChunksPerSource) {
        continue;
      }
      
      // Check page diversity
      const currentPageCount = pageCount[pageKey] || 0;
      if (currentPageCount >= this.options.maxChunksPerPage) {
        continue;
      }
      
      // Add chunk and update counters
      diversifiedChunks.push(chunk);
      sourceCount[sourceId] = currentSourceCount + 1;
      pageCount[pageKey] = currentPageCount + 1;
    }
    
    return diversifiedChunks;
  }

  /**
   * Optimize chunk selection for token budget
   * @param {Array} chunks - Diversified chunks
   * @param {number} tokenBudget - Available token budget
   * @param {number} maxChunks - Maximum number of chunks
   * @param {string} complexity - Query complexity
   * @returns {Array} Budget-optimized chunks
   */
  optimizeForTokenBudget(chunks, tokenBudget, maxChunks, complexity) {
    // Allocate token budget for chunks (reserve some for prompt/response)
    const chunkTokenBudget = Math.floor(tokenBudget * this.options.tokenBudgetRatio);
    
    const optimizedChunks = [];
    let currentTokens = 0;
    
    for (const chunk of chunks) {
      if (optimizedChunks.length >= maxChunks) {
        break;
      }
      
      const chunkTokens = this.estimateChunkTokens(chunk);
      
      if (currentTokens + chunkTokens <= chunkTokenBudget) {
        optimizedChunks.push(chunk);
        currentTokens += chunkTokens;
      } else {
        // Try to fit a truncated version
        const remainingTokens = chunkTokenBudget - currentTokens;
        if (remainingTokens > 100) { // Minimum viable chunk size
          const truncatedChunk = this.truncateChunk(chunk, remainingTokens);
          if (truncatedChunk) {
            optimizedChunks.push(truncatedChunk);
            break;
          }
        }
      }
    }
    
    return optimizedChunks;
  }

  /**
   * Optimize individual chunk content
   * @param {Array} chunks - Budget-optimized chunks
   * @param {number} tokenBudget - Token budget
   * @returns {Array} Content-optimized chunks
   */
  optimizeChunkContent(chunks, tokenBudget) {
    return chunks.map(chunk => {
      // If chunk is already optimized (has condensedContent), use it
      if (chunk.condensedContent) {
        return chunk;
      }
      
      // Apply basic content optimization
      let optimizedContent = chunk.content;
      
      // Remove excessive whitespace
      optimizedContent = optimizedContent.replace(/\s+/g, ' ').trim();
      
      // Remove redundant phrases
      optimizedContent = this.removeRedundantPhrases(optimizedContent);
      
      // If still too long, apply smart truncation
      const estimatedTokens = this.estimateContentTokens(optimizedContent);
      if (estimatedTokens > 300) { // Max tokens per chunk
        optimizedContent = this.smartTruncate(optimizedContent, 300);
      }
      
      return {
        ...chunk,
        content: optimizedContent,
        originalContent: chunk.content,
        optimized: true
      };
    });
  }

  /**
   * Remove redundant phrases from content
   * @param {string} content - Original content
   * @returns {string} Cleaned content
   */
  removeRedundantPhrases(content) {
    // Common redundant phrases in fund management documents
    const redundantPhrases = [
      'as mentioned above',
      'as stated previously',
      'it should be noted that',
      'it is important to note',
      'please note that',
      'for more information',
      'additional details can be found'
    ];
    
    let cleaned = content;
    redundantPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /**
   * Smart truncation that preserves meaning
   * @param {string} content - Content to truncate
   * @param {number} maxTokens - Maximum tokens
   * @returns {string} Truncated content
   */
  smartTruncate(content, maxTokens) {
    const maxChars = maxTokens * 4; // Rough conversion
    
    if (content.length <= maxChars) {
      return content;
    }
    
    // Try to truncate at sentence boundary
    const sentences = content.split(/[.!?]+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      const potential = truncated + sentence + '.';
      if (potential.length > maxChars) {
        break;
      }
      truncated = potential;
    }
    
    // If no complete sentences fit, truncate at word boundary
    if (truncated.length < maxChars * 0.5) {
      const words = content.split(/\s+/);
      truncated = '';
      
      for (const word of words) {
        const potential = truncated + ' ' + word;
        if (potential.length > maxChars) {
          break;
        }
        truncated = potential;
      }
    }
    
    return truncated.trim() + (truncated.length < content.length ? '...' : '');
  }

  /**
   * Truncate chunk to fit token limit
   * @param {Object} chunk - Chunk to truncate
   * @param {number} tokenLimit - Token limit
   * @returns {Object|null} Truncated chunk or null if not viable
   */
  truncateChunk(chunk, tokenLimit) {
    const maxChars = tokenLimit * 4; // Rough conversion
    
    if (chunk.content.length <= maxChars) {
      return chunk;
    }
    
    const truncatedContent = this.smartTruncate(chunk.content, tokenLimit);
    
    if (truncatedContent.length < 100) { // Too small to be useful
      return null;
    }
    
    return {
      ...chunk,
      content: truncatedContent,
      originalContent: chunk.content,
      truncated: true
    };
  }

  /**
   * Estimate token usage for chunks
   * @param {Array} chunks - Chunks to estimate
   * @returns {number} Estimated tokens
   */
  estimateTokenUsage(chunks) {
    return chunks.reduce((total, chunk) => {
      return total + this.estimateChunkTokens(chunk);
    }, 0);
  }

  /**
   * Estimate tokens for a single chunk
   * @param {Object} chunk - Chunk to estimate
   * @returns {number} Estimated tokens
   */
  estimateChunkTokens(chunk) {
    const content = chunk.condensedContent || chunk.content || '';
    return this.estimateContentTokens(content);
  }

  /**
   * Estimate tokens for content string
   * @param {string} content - Content to estimate
   * @returns {number} Estimated tokens
   */
  estimateContentTokens(content) {
    // Rough estimation: 4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Update selection statistics
   * @param {number} originalCount - Original chunk count
   * @param {number} selectedCount - Selected chunk count
   * @param {number} processingTime - Processing time
   */
  updateStats(originalCount, selectedCount, processingTime) {
    this.stats.totalProcessed += originalCount;
    this.stats.totalFiltered += originalCount - selectedCount;
    this.stats.totalOptimized += selectedCount;
    
    const reductionRatio = (originalCount - selectedCount) / originalCount;
    this.stats.averageReduction = (this.stats.averageReduction + reductionRatio) / 2;
  }

  /**
   * Get selection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      averageReductionPercentage: Math.round(this.stats.averageReduction * 100)
    };
  }
}

module.exports = SmartChunkSelector;

