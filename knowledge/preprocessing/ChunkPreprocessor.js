/**
 * Local Chunk Preprocessor
 * Reduces token usage by preprocessing chunks locally before sending to LLM
 */

class ChunkPreprocessor {
  constructor(options = {}) {
    this.maxTokensPerChunk = options.maxTokensPerChunk || 200;
    this.maxTotalTokens = options.maxTotalTokens || 1500;
    this.preserveKeyPhrases = options.preserveKeyPhrases ?? true;
    this.extractNumbers = options.extractNumbers ?? true;
    this.logger = require('../../utils/logger');
  }

  /**
   * Preprocess chunks to reduce token usage while preserving key information
   */
  async preprocessChunks(chunks, query, options = {}) {
    const startTime = Date.now();
    
    try {
      // Step 1: Extract key information from each chunk
      const processedChunks = chunks.map(chunk => this.extractKeyInformation(chunk, query));
      
      // Step 2: Rank chunks by relevance to query
      const rankedChunks = this.rankChunksByRelevance(processedChunks, query);
      
      // Step 3: Smart truncation to fit token budget
      const optimizedChunks = this.optimizeTokenUsage(rankedChunks, options);
      
      // Step 4: Create final condensed content
      const finalContent = this.createCondensedContent(optimizedChunks, query);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info(`ðŸ”§ Local preprocessing completed in ${processingTime}ms`);
      this.logger.info(`ðŸ“Š Token reduction: ${this.estimateTokens(chunks)} â†’ ${this.estimateTokens([{content: finalContent}])} tokens`);
      
      return {
        condensedContent: finalContent,
        processedChunks: optimizedChunks,
        originalTokens: this.estimateTokens(chunks),
        optimizedTokens: this.estimateTokens([{content: finalContent}]),
        reductionPercentage: this.calculateReduction(chunks, finalContent),
        processingTime
      };
      
    } catch (error) {
      this.logger.error('âŒ Chunk preprocessing failed:', error);
      // Fallback: return original chunks with basic truncation
      return this.fallbackProcessing(chunks);
    }
  }

  /**
   * Extract key information from a single chunk
   */
  extractKeyInformation(chunk, query) {
    const content = chunk.content || '';
    const heading = chunk.heading || '';
    
    // Extract key phrases related to the query
    const keyPhrases = this.extractKeyPhrases(content, query);
    
    // Extract numbers, percentages, dates
    const numericalData = this.extractNumericalData(content);
    
    // Extract sentences most relevant to query
    const relevantSentences = this.extractRelevantSentences(content, query);
    
    // Create condensed version
    const condensedContent = this.createCondensedVersion(
      heading,
      keyPhrases,
      numericalData,
      relevantSentences
    );
    
    return {
      ...chunk,
      originalContent: content,
      condensedContent,
      keyPhrases,
      numericalData,
      relevantSentences,
      relevanceScore: this.calculateRelevanceScore(content, query)
    };
  }

  /**
   * Extract key phrases related to the query
   */
  extractKeyPhrases(content, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const sentences = content.split(/[.!?]+/);
    const keyPhrases = [];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = queryWords.filter(word => lowerSentence.includes(word)).length;
      
      if (matchCount > 0) {
        // Extract phrases around query words
        queryWords.forEach(word => {
          if (lowerSentence.includes(word)) {
            const wordIndex = lowerSentence.indexOf(word);
            const start = Math.max(0, wordIndex - 50);
            const end = Math.min(sentence.length, wordIndex + 100);
            const phrase = sentence.substring(start, end).trim();
            if (phrase.length > 10) {
              keyPhrases.push(phrase);
            }
          }
        });
      }
    });
    
    return [...new Set(keyPhrases)].slice(0, 3); // Top 3 unique phrases
  }

  /**
   * Extract numerical data (percentages, amounts, dates)
   */
  extractNumericalData(content) {
    const numericalData = [];
    
    // Extract percentages
    const percentages = content.match(/\d+\.?\d*\s*%/g) || [];
    numericalData.push(...percentages);
    
    // Extract monetary amounts
    const amounts = content.match(/[$â‚¬Â£Â¥]\s*\d+(?:,\d{3})*(?:\.\d{2})?/g) || [];
    numericalData.push(...amounts);
    
    // Extract years
    const years = content.match(/\b(19|20)\d{2}\b/g) || [];
    numericalData.push(...years);
    
    // Extract large numbers
    const largeNumbers = content.match(/\b\d{1,3}(?:,\d{3})+\b/g) || [];
    numericalData.push(...largeNumbers);
    
    return [...new Set(numericalData)].slice(0, 5); // Top 5 unique numbers
  }

  /**
   * Extract sentences most relevant to the query
   */
  extractRelevantSentences(content, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = queryWords.filter(word => lowerSentence.includes(word)).length;
      const wordCount = sentence.split(/\s+/).length;
      
      return {
        sentence: sentence.trim(),
        score: matchCount / Math.sqrt(wordCount), // Relevance vs length
        matchCount
      };
    });
    
    return scoredSentences
      .filter(s => s.matchCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(s => s.sentence);
  }

  /**
   * Create condensed version of chunk content
   */
  createCondensedVersion(heading, keyPhrases, numericalData, relevantSentences) {
    const parts = [];
    
    if (heading) {
      parts.push(`[${heading}]`);
    }
    
    if (relevantSentences.length > 0) {
      parts.push(relevantSentences.join(' '));
    }
    
    if (keyPhrases.length > 0) {
      parts.push(`Key points: ${keyPhrases.join('; ')}`);
    }
    
    if (numericalData.length > 0) {
      parts.push(`Data: ${numericalData.join(', ')}`);
    }
    
    return parts.join(' | ').substring(0, this.maxTokensPerChunk * 4); // Rough token limit
  }

  /**
   * Rank chunks by relevance to query
   */
  rankChunksByRelevance(chunks, query) {
    return chunks.sort((a, b) => {
      const scoreA = a.relevanceScore + (a.similarity_score || 0);
      const scoreB = b.relevanceScore + (b.similarity_score || 0);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate relevance score for content vs query
   */
  calculateRelevanceScore(content, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    queryWords.forEach(word => {
      const occurrences = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += occurrences;
    });
    
    return score / content.length * 1000; // Normalize by content length
  }

  /**
   * Optimize token usage while preserving most important information
   */
  optimizeTokenUsage(rankedChunks, options = {}) {
    const maxTokens = options.maxTotalTokens || this.maxTotalTokens;
    const optimizedChunks = [];
    let currentTokens = 0;
    
    for (const chunk of rankedChunks) {
      const chunkTokens = this.estimateTokens([{content: chunk.condensedContent}]);
      
      if (currentTokens + chunkTokens <= maxTokens) {
        optimizedChunks.push(chunk);
        currentTokens += chunkTokens;
      } else {
        // Try to fit a truncated version
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 50) {
          const truncatedContent = this.truncateToTokenLimit(chunk.condensedContent, remainingTokens);
          optimizedChunks.push({
            ...chunk,
            condensedContent: truncatedContent,
            truncated: true
          });
        }
        break;
      }
    }
    
    return optimizedChunks;
  }

  /**
   * Create final condensed content for LLM
   */
  createCondensedContent(optimizedChunks, query) {
    const sections = optimizedChunks.map((chunk, index) => {
      const source = chunk.source_id ? `[Source: ${chunk.source_id.substring(0, 8)}]` : '';
      const page = chunk.page_number ? `[Page: ${chunk.page_number}]` : '';
      const metadata = [source, page].filter(Boolean).join(' ');
      
      return `${index + 1}. ${metadata} ${chunk.condensedContent}`;
    });
    
    return sections.join('\n\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(chunks) {
    const totalContent = chunks.map(c => c.content || c.condensedContent || '').join(' ');
    return Math.ceil(totalContent.length / 4); // Rough estimate: 4 chars per token
  }

  /**
   * Truncate content to fit token limit
   */
  truncateToTokenLimit(content, tokenLimit) {
    const charLimit = tokenLimit * 4; // Rough conversion
    if (content.length <= charLimit) return content;
    
    // Try to truncate at sentence boundary
    const truncated = content.substring(0, charLimit);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > charLimit * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Calculate token reduction percentage
   */
  calculateReduction(originalChunks, finalContent) {
    const originalTokens = this.estimateTokens(originalChunks);
    const finalTokens = this.estimateTokens([{content: finalContent}]);
    return Math.round((1 - finalTokens / originalTokens) * 100);
  }

  /**
   * Fallback processing if main preprocessing fails
   */
  fallbackProcessing(chunks) {
    const fallbackContent = chunks
      .slice(0, 3)
      .map(chunk => chunk.content.substring(0, 300))
      .join('\n\n');
    
    return {
      condensedContent: fallbackContent,
      processedChunks: chunks.slice(0, 3),
      originalTokens: this.estimateTokens(chunks),
      optimizedTokens: this.estimateTokens([{content: fallbackContent}]),
      reductionPercentage: 50,
      processingTime: 0,
      fallback: true
    };
  }
}

module.exports = ChunkPreprocessor;

