/**
 * Retrieval Engine Module
 * Advanced retrieval engine with multiple strategies, reranking, and filtering
 * Phase 2: Retrieval & Prompting System
 */

const VectorRetriever = require('./VectorRetriever');
const EnhancedSimilarityScorer = require('./EnhancedSimilarityScorer');
const { getConfig } = require('../../config/environment');
const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

class RetrievalEngine {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.vectorRetriever = new VectorRetriever();
    this.enhancedScorer = new EnhancedSimilarityScorer();
    
    // Retrieval strategies
    this.strategies = {
      'vector_only': this.vectorOnlyRetrieval.bind(this),
      'hybrid': this.hybridRetrieval.bind(this),
      'contextual': this.contextualRetrieval.bind(this),
      'multi_query': this.multiQueryRetrieval.bind(this),
      'hierarchical': this.hierarchicalRetrieval.bind(this),
      'advanced_multi_feature': this.advancedMultiFeatureRetrieval.bind(this)
    };
    
    // Advanced reranking models
    this.rerankingModels = {
      'similarity_based': this.similarityBasedReranking.bind(this),
      'relevance_based': this.relevanceBasedReranking.bind(this),
      'context_aware': this.contextAwareReranking.bind(this),
      'user_preference': this.userPreferenceReranking.bind(this)
    };
    
    // Query analysis patterns
    this.queryPatterns = {
      'definition': /(?:what is|define|definition of|meaning of)/i,
      'procedure': /(?:how to|steps to|process for|procedure)/i,
      'comparison': /(?:difference between|compare|versus|vs)/i,
      'list': /(?:list|enumerate|what are)/i,
      'example': /(?:example|instance|sample)/i,
      'troubleshooting': /(?:error|problem|issue|fix|solve)/i
    };
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    if (!this.db) {
      this.db = getDatabase();
      if (!this.db.isReady()) {
        await this.db.initialize();
      }
    }
  }

  /**
   * Main retrieval method with strategy selection
   * @param {string} query - User query
   * @param {Object} context - Conversation context
   * @param {Object} options - Retrieval options
   * @returns {Object} Retrieval results
   */
  async retrieve(query, context = {}, options = {}) {
    try {
      await this.initializeDatabase();
      
      const startTime = Date.now();
      logger.info(`🔍 Starting advanced retrieval for: "${query.substring(0, 100)}..."`);
      
      // Analyze query to determine optimal strategy
      const queryAnalysis = this.analyzeQuery(query, context);
      logger.info(`📊 Query analysis:`, queryAnalysis);
      
      // Select retrieval strategy
      let strategy = options.strategy || this.selectOptimalStrategy(queryAnalysis);
      logger.info(`🎯 Selected strategy: ${strategy}`);
      
      // Execute retrieval strategy
      if (!this.strategies[strategy]) {
        logger.warn(`⚠️ Strategy '${strategy}' not found, falling back to 'hybrid'`);
        strategy = 'hybrid';
      }
      
      const retrievalResults = await this.strategies[strategy](query, context, {
        ...options,
        queryAnalysis
      });
      
      // Apply advanced reranking
      let rerankingModel = options.rerankingModel || this.selectRerankingModel(queryAnalysis);
      
      // Check if reranking model exists
      if (!this.rerankingModels[rerankingModel]) {
        logger.warn(`⚠️ Reranking model '${rerankingModel}' not found, falling back to 'similarity_based'`);
        rerankingModel = 'similarity_based';
      }
      
      const rerankedResults = await this.rerankingModels[rerankingModel](
        query, 
        retrievalResults.chunks, 
        { ...context, queryAnalysis }
      );
      
      // Apply post-processing filters
      const finalResults = await this.applyPostProcessingFilters(
        query,
        rerankedResults,
        { ...options, queryAnalysis }
      );
      
      const totalTime = Date.now() - startTime;
      
      const result = {
        query,
        strategy,
        rerankingModel,
        queryAnalysis,
        chunks: finalResults,
        metadata: {
          totalRetrievalTime: totalTime,
          chunksRetrieved: finalResults.length,
          averageRelevanceScore: finalResults.length > 0 
            ? finalResults.reduce((sum, chunk) => sum + chunk.relevance_score, 0) / finalResults.length 
            : 0,
          confidenceScore: this.calculateRetrievalConfidence(finalResults, queryAnalysis),
          retrievalStrategy: strategy,
          rerankingModel: rerankingModel,
          timestamp: new Date().toISOString()
        }
      };
      
      logger.info(`✅ Advanced retrieval completed: ${finalResults.length} chunks in ${totalTime}ms`);
      logger.info(`📊 Confidence: ${result.metadata.confidenceScore.toFixed(3)}, Avg relevance: ${result.metadata.averageRelevanceScore.toFixed(3)}`);
      
      return result;
    } catch (error) {
      logger.error('❌ Advanced retrieval failed:', error);
      throw new Error(`Advanced retrieval failed: ${error.message}`);
    }
  }

  /**
   * Analyze query to understand intent and characteristics
   * @param {string} query - User query
   * @param {Object} context - Conversation context
   * @returns {Object} Query analysis
   */
  analyzeQuery(query, context) {
    const analysis = {
      originalQuery: query,
      queryLength: query.length,
      wordCount: query.split(/\s+/).length,
      hasQuestionWords: /\b(what|how|when|where|why|which|who)\b/i.test(query),
      queryType: 'general',
      complexity: 'simple',
      domain: 'fund_management',
      intent: [],
      entities: [],
      keywords: [],
      contextual: {
        hasContext: Object.keys(context).length > 0,
        conversationLength: context.messageHistory?.length || 0,
        previousTopics: context.previousTopics || []
      }
    };
    
    // Detect query patterns
    for (const [pattern, regex] of Object.entries(this.queryPatterns)) {
      if (regex.test(query)) {
        analysis.intent.push(pattern);
      }
    }
    
    // Determine primary query type
    if (analysis.intent.length > 0) {
      analysis.queryType = analysis.intent[0];
    }
    
    // Assess complexity
    if (analysis.wordCount > 15 || analysis.intent.length > 2) {
      analysis.complexity = 'complex';
    } else if (analysis.wordCount > 8 || analysis.intent.length > 1) {
      analysis.complexity = 'moderate';
    }
    
    // Extract keywords (simple approach)
    analysis.keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'how', 'when', 'where', 'why', 'which', 'who', 'the', 'and', 'or', 'but', 'for', 'with'].includes(word));
    
    // Extract fund management entities
    const fundEntities = [
      'fund', 'portfolio', 'investment', 'nav', 'asset', 'security', 'risk',
      'compliance', 'audit', 'rollforward', 'hierarchy', 'valuation', 'performance'
    ];
    
    analysis.entities = fundEntities.filter(entity => 
      query.toLowerCase().includes(entity)
    );
    
    return analysis;
  }

  /**
   * Select optimal retrieval strategy based on query analysis
   * @param {Object} queryAnalysis - Query analysis results
   * @returns {string} Selected strategy
   */
  selectOptimalStrategy(queryAnalysis) {
    // Strategy selection logic
    if (queryAnalysis.complexity === 'complex' || queryAnalysis.intent.length > 2) {
      return 'multi_query';
    }
    
    if (queryAnalysis.queryType === 'procedure' || queryAnalysis.queryType === 'list') {
      return 'hierarchical';
    }
    
    if (queryAnalysis.contextual.hasContext && queryAnalysis.contextual.conversationLength > 2) {
      return 'contextual';
    }
    
    if (queryAnalysis.entities.length > 0 || queryAnalysis.keywords.length > 1) {
      return 'hybrid';
    }
    
    return 'vector_only';
  }

  /**
   * Select reranking model based on query analysis
   * @param {Object} queryAnalysis - Query analysis results
   * @returns {string} Selected reranking model
   */
  selectRerankingModel(queryAnalysis) {
    if (queryAnalysis.contextual.hasContext) {
      return 'context_aware';
    }
    
    if (queryAnalysis.queryType === 'definition' || queryAnalysis.queryType === 'comparison') {
      return 'relevance_based';
    }
    
    return 'similarity_based';
  }

  /**
   * Vector-only retrieval strategy
   * @param {string} query - User query
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Object} Retrieval results
   */
  async vectorOnlyRetrieval(query, context, options) {
    logger.info('🎯 Executing vector-only retrieval');
    
    const chunks = await this.vectorRetriever.retrieveRelevantChunks(query, {
      topK: options.topK || 10,
      similarityThreshold: options.similarityThreshold || 0.5,
      enableReranking: false, // We'll do our own reranking
      enableHybridSearch: false
    });
    
    return {
      strategy: 'vector_only',
      chunks: chunks,
      metadata: {
        searchType: 'pure_vector',
        chunksFound: chunks.length
      }
    };
  }

  /**
   * Hybrid retrieval strategy (vector + text search)
   * @param {string} query - User query
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Object} Retrieval results
   */
  async hybridRetrieval(query, context, options) {
    logger.info('🎯 Executing hybrid retrieval');
    
    const chunks = await this.vectorRetriever.retrieveRelevantChunks(query, {
      topK: options.topK || 15,
      similarityThreshold: options.similarityThreshold || 0.5,
      enableReranking: false,
      enableHybridSearch: true
    });
    
    return {
      strategy: 'hybrid',
      chunks: chunks,
      metadata: {
        searchType: 'vector_plus_text',
        chunksFound: chunks.length
      }
    };
  }

  /**
   * Contextual retrieval strategy (considers conversation context)
   * @param {string} query - User query
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Object} Retrieval results
   */
  async contextualRetrieval(query, context, options) {
    logger.info('🎯 Executing contextual retrieval');
    
    // Expand query with context
    let expandedQuery = query;
    if (context.previousTopics && context.previousTopics.length > 0) {
      expandedQuery += ' ' + context.previousTopics.slice(-2).join(' ');
    }
    
    if (context.currentTopic) {
      expandedQuery += ' ' + context.currentTopic;
    }
    
    logger.info(`📝 Expanded query: "${expandedQuery}"`);
    
    const chunks = await this.vectorRetriever.retrieveRelevantChunks(expandedQuery, {
      topK: options.topK || 12,
      similarityThreshold: options.similarityThreshold || 0.5,
      enableReranking: false,
      enableHybridSearch: true
    });
    
    return {
      strategy: 'contextual',
      chunks: chunks,
      metadata: {
        searchType: 'context_aware',
        originalQuery: query,
        expandedQuery: expandedQuery,
        chunksFound: chunks.length
      }
    };
  }

  /**
   * Multi-query retrieval strategy (breaks complex queries into parts)
   * @param {string} query - User query
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Object} Retrieval results
   */
  async multiQueryRetrieval(query, context, options) {
    logger.info('🎯 Executing multi-query retrieval');
    
    // Break down complex query into sub-queries
    const subQueries = this.decomposeQuery(query, options.queryAnalysis);
    logger.info(`📋 Generated ${subQueries.length} sub-queries:`, subQueries);
    
    const allChunks = [];
    const subQueryResults = [];
    
    for (const subQuery of subQueries) {
      const chunks = await this.vectorRetriever.retrieveRelevantChunks(subQuery, {
        topK: Math.ceil((options.topK || 15) / subQueries.length),
        similarityThreshold: options.similarityThreshold || 0.5,
        enableReranking: false,
        enableHybridSearch: true
      });
      
      subQueryResults.push({
        query: subQuery,
        chunks: chunks.length
      });
      
      allChunks.push(...chunks);
    }
    
    // Remove duplicates based on chunk_id
    const uniqueChunks = [];
    const seenChunkIds = new Set();
    
    for (const chunk of allChunks) {
      if (!seenChunkIds.has(chunk.chunk_id)) {
        seenChunkIds.add(chunk.chunk_id);
        uniqueChunks.push(chunk);
      }
    }
    
    logger.info(`📊 Multi-query results: ${allChunks.length} total, ${uniqueChunks.length} unique`);
    
    return {
      strategy: 'multi_query',
      chunks: uniqueChunks,
      metadata: {
        searchType: 'multi_query',
        subQueries: subQueryResults,
        totalChunks: allChunks.length,
        uniqueChunks: uniqueChunks.length
      }
    };
  }

  /**
   * Hierarchical retrieval strategy (considers document structure)
   * @param {string} query - User query
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Object} Retrieval results
   */
  async hierarchicalRetrieval(query, context, options) {
    logger.info('🎯 Executing hierarchical retrieval');
    
    // First, get initial chunks
    const initialChunks = await this.vectorRetriever.retrieveRelevantChunks(query, {
      topK: options.topK || 10,
      similarityThreshold: options.similarityThreshold || 0.5,
      enableReranking: false,
      enableHybridSearch: true
    });
    
    // Then, get related chunks from the same sections
    const relatedChunks = [];
    for (const chunk of initialChunks.slice(0, 3)) { // Top 3 chunks
      const sectionChunks = await this.getRelatedChunksFromSection(
        chunk.source_id,
        chunk.section_path,
        chunk.chunk_id
      );
      relatedChunks.push(...sectionChunks);
    }
    
    // Combine and deduplicate
    const allChunks = [...initialChunks, ...relatedChunks];
    const uniqueChunks = [];
    const seenChunkIds = new Set();
    
    for (const chunk of allChunks) {
      if (!seenChunkIds.has(chunk.chunk_id)) {
        seenChunkIds.add(chunk.chunk_id);
        uniqueChunks.push(chunk);
      }
    }
    
    logger.info(`📊 Hierarchical results: ${initialChunks.length} initial, ${relatedChunks.length} related, ${uniqueChunks.length} unique`);
    
    return {
      strategy: 'hierarchical',
      chunks: uniqueChunks,
      metadata: {
        searchType: 'hierarchical',
        initialChunks: initialChunks.length,
        relatedChunks: relatedChunks.length,
        uniqueChunks: uniqueChunks.length
      }
    };
  }

  /**
   * Advanced Multi-Feature Retrieval Strategy
   * Combines multiple retrieval approaches with enhanced scoring
   * @param {string} query - Search query
   * @param {Object} context - Search context
   * @param {Object} options - Retrieval options
   * @returns {Object} Retrieval results
   */
  async advancedMultiFeatureRetrieval(query, context, options) {
    logger.info('🚀 Executing advanced multi-feature retrieval');
    
    try {
      // Step 1: Parallel retrieval using multiple strategies
      const maxResults = options.maxResults || options.topK || 10;
      const [vectorResults, hybridResults, contextualResults] = await Promise.all([
        this.vectorOnlyRetrieval(query, context, { ...options, topK: Math.ceil(maxResults / 2) }),
        this.hybridRetrieval(query, context, { ...options, topK: Math.ceil(maxResults / 2) }),
        this.contextualRetrieval(query, context, { ...options, topK: Math.ceil(maxResults / 3) })
      ]);
      
      // Step 2: Combine all results
      const allChunks = [
        ...vectorResults.chunks,
        ...hybridResults.chunks,
        ...contextualResults.chunks
      ];
      
      // Step 3: Deduplicate by chunk_id
      const uniqueChunks = [];
      const seenChunkIds = new Set();
      
      for (const chunk of allChunks) {
        if (!seenChunkIds.has(chunk.chunk_id)) {
          seenChunkIds.add(chunk.chunk_id);
          uniqueChunks.push(chunk);
        }
      }
      
      // Step 4: Apply enhanced scoring with multi-feature analysis
      const enhancedChunks = await this.enhancedScorer.enhanceChunkScores(
        uniqueChunks,
        query,
        { ...context, queryAnalysis: options.queryAnalysis }
      );
      
      // Step 5: Apply additional multi-feature scoring
      const multiFeatureChunks = enhancedChunks.map(chunk => {
        let multiFeatureScore = chunk.enhanced_score || chunk.similarity_score || 0.5;
        
        // Boost based on multiple strategies finding the same chunk
        let strategyBoost = 0;
        if (vectorResults.chunks.some(c => c.chunk_id === chunk.chunk_id)) strategyBoost += 0.1;
        if (hybridResults.chunks.some(c => c.chunk_id === chunk.chunk_id)) strategyBoost += 0.1;
        if (contextualResults.chunks.some(c => c.chunk_id === chunk.chunk_id)) strategyBoost += 0.1;
        
        // Apply consensus boost (multiple strategies agreeing)
        multiFeatureScore += strategyBoost;
        
        // Quality and recency factors
        const qualityBoost = (chunk.quality_score || 0.5) * 0.1;
        multiFeatureScore += qualityBoost;
        
        // Content type relevance for procedural queries
        if (options.queryAnalysis?.queryType === 'procedure' && chunk.content_type === 'instruction') {
          multiFeatureScore += 0.2;
        }
        
        // Ensure score stays within bounds
        multiFeatureScore = Math.max(0.01, Math.min(1.0, multiFeatureScore));
        
        return {
          ...chunk,
          multi_feature_score: multiFeatureScore,
          strategy_consensus: strategyBoost,
          quality_boost: qualityBoost
        };
      });
      
      // Step 6: Sort by multi-feature score and limit results
      const finalChunks = multiFeatureChunks
        .sort((a, b) => b.multi_feature_score - a.multi_feature_score)
        .slice(0, maxResults);
      
      logger.info(`🎯 Advanced multi-feature results: ${finalChunks.length} chunks from ${uniqueChunks.length} candidates`);
      
      return {
        strategy: 'advanced_multi_feature',
        chunks: finalChunks,
        metadata: {
          searchType: 'advanced_multi_feature',
          totalCandidates: uniqueChunks.length,
          vectorResults: vectorResults.chunks.length,
          hybridResults: hybridResults.chunks.length,
          contextualResults: contextualResults.chunks.length,
          enhancedScoring: true,
          consensusScoring: true
        }
      };
      
    } catch (error) {
      logger.error('❌ Advanced multi-feature retrieval failed:', error);
      // Fallback to hybrid retrieval
      logger.warn('⚠️ Falling back to hybrid retrieval');
      return await this.hybridRetrieval(query, context, options);
    }
  }

  /**
   * Decompose complex query into sub-queries
   * @param {string} query - Original query
   * @param {Object} queryAnalysis - Query analysis
   * @returns {Array} Array of sub-queries
   */
  decomposeQuery(query, queryAnalysis) {
    const subQueries = [query]; // Always include original
    
    // Extract key concepts for separate queries
    if (queryAnalysis.entities.length > 1) {
      queryAnalysis.entities.forEach(entity => {
        subQueries.push(`${entity} in fund management`);
      });
    }
    
    // Create intent-specific queries
    if (queryAnalysis.intent.includes('procedure')) {
      subQueries.push('steps process procedure');
    }
    
    if (queryAnalysis.intent.includes('definition')) {
      subQueries.push('definition meaning explanation');
    }
    
    // Limit to reasonable number of sub-queries
    return subQueries.slice(0, 4);
  }

  /**
   * Get related chunks from the same document section
   * @param {string} sourceId - Source document ID
   * @param {Array} sectionPath - Section path
   * @param {string} excludeChunkId - Chunk ID to exclude
   * @returns {Array} Related chunks
   */
  async getRelatedChunksFromSection(sourceId, sectionPath, excludeChunkId) {
    try {
      if (!sectionPath || sectionPath.length === 0) {
        return [];
      }
      
      const query = `
        SELECT 
          c.id,
          c.chunk_id,
          c.source_id,
          c.version,
          c.chunk_index,
          c.content,
          c.heading,
          c.subheading,
          c.page_number,
          c.page_range,
          c.section_path,
          c.content_type,
          c.token_count,
          c.quality_score,
          c.metadata,
          s.filename,
          s.title as source_title
        FROM kb_chunks c
        JOIN kb_sources s ON c.source_id = s.source_id
        WHERE c.source_id = $1
          AND c.chunk_id != $2
          AND c.section_path && $3
          AND s.processing_status = 'completed'
        ORDER BY c.chunk_index
        LIMIT 5
      `;
      
      const result = await this.db.query(query, [sourceId, excludeChunkId, sectionPath]);
      
      return result.rows.map(row => ({
        ...row,
        similarity_score: 0.8, // High similarity for same section
        section_path: row.section_path || [],
        page_range: row.page_range || [],
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        citation: {
          source: row.source_title || row.filename,
          page: row.page_number,
          section: row.heading || row.subheading,
          chunk_id: row.chunk_id
        }
      }));
    } catch (error) {
      logger.warn('⚠️ Failed to get related chunks from section:', error.message);
      return [];
    }
  }

  /**
   * Similarity-based reranking with enhanced content-aware scoring
   * @param {string} query - Original query
   * @param {Array} chunks - Chunks to rerank
   * @param {Object} context - Context
   * @returns {Array} Reranked chunks
   */
  async similarityBasedReranking(query, chunks, context) {
    logger.info('🔄 Applying enhanced similarity-based reranking');
    
    try {
      // Use enhanced scorer for content-aware ranking
      const enhancedChunks = await this.enhancedScorer.enhanceChunkScores(
        chunks, 
        query, 
        context
      );
      
      // Map enhanced scores to relevance scores for compatibility
      return enhancedChunks.map(chunk => ({
        ...chunk,
        relevance_score: chunk.enhanced_score || chunk.similarity_score || 0.5
      }));
      
    } catch (error) {
      logger.warn('⚠️ Enhanced scoring failed, falling back to basic similarity:', error.message);
      
      // Fallback to basic similarity scoring
      return chunks
        .map(chunk => ({
          ...chunk,
          relevance_score: chunk.similarity_score || chunk.rerank_score || 0.5
        }))
        .sort((a, b) => b.relevance_score - a.relevance_score);
    }
  }

  /**
   * Relevance-based reranking with enhanced content analysis
   * @param {string} query - Original query
   * @param {Array} chunks - Chunks to rerank
   * @param {Object} context - Context
   * @returns {Array} Reranked chunks
   */
  async relevanceBasedReranking(query, chunks, context) {
    logger.info('🔄 Applying enhanced relevance-based reranking');
    
    try {
      // Use enhanced scorer for comprehensive relevance analysis
      const enhancedChunks = await this.enhancedScorer.enhanceChunkScores(
        chunks, 
        query, 
        context
      );
      
      // Additional term frequency analysis for relevance-based queries
      const queryWords = new Set(
        query.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2)
      );
      
      return enhancedChunks.map(chunk => {
        // Calculate term frequency relevance
        const chunkWords = chunk.content.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/);
        
        const termFrequency = [...queryWords].reduce((score, term) => {
          const occurrences = chunkWords.filter(word => word.includes(term)).length;
          return score + (occurrences / chunkWords.length);
        }, 0);
        
        // Combine enhanced score with term frequency
        const combinedScore = 
          (chunk.enhanced_score || chunk.similarity_score || 0.5) * 0.8 +
          termFrequency * 0.2;
        
        return {
          ...chunk,
          relevance_score: combinedScore,
          term_frequency: termFrequency,
          enhanced_score: chunk.enhanced_score
        };
      }).sort((a, b) => b.relevance_score - a.relevance_score);
      
    } catch (error) {
      logger.warn('⚠️ Enhanced relevance scoring failed, falling back to basic:', error.message);
      
      // Fallback to basic relevance scoring
      const queryWords = new Set(
        query.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2)
      );
      
      return chunks
        .map(chunk => {
          const chunkWords = chunk.content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/);
          
          const termFrequency = [...queryWords].reduce((score, term) => {
            const occurrences = chunkWords.filter(word => word.includes(term)).length;
            return score + (occurrences / chunkWords.length);
          }, 0);
          
          const contentTypeBoost = this.getContentTypeRelevance(
            chunk.content_type,
            context.queryAnalysis?.queryType
          );
          
          const qualityBoost = chunk.quality_score * 0.2;
          
          const relevanceScore = 
            (chunk.similarity_score || 0.5) * 0.6 +
            termFrequency * 0.3 +
            contentTypeBoost * 0.05 +
            qualityBoost * 0.05;
          
          return {
            ...chunk,
            relevance_score: relevanceScore,
            term_frequency: termFrequency,
            content_type_boost: contentTypeBoost
          };
        })
        .sort((a, b) => b.relevance_score - a.relevance_score);
    }
  }

  /**
   * Context-aware reranking
   * @param {string} query - Original query
   * @param {Array} chunks - Chunks to rerank
   * @param {Object} context - Context
   * @returns {Array} Reranked chunks
   */
  async contextAwareReranking(query, chunks, context) {
    logger.info('🔄 Applying enhanced context-aware reranking');
    
    try {
      // Use enhanced scorer as base
      const enhancedChunks = await this.enhancedScorer.enhanceChunkScores(
        chunks, 
        query, 
        context
      );
      
      const previousTopics = context.previousTopics || [];
      const currentTopic = context.currentTopic || '';
      
      return enhancedChunks.map(chunk => {
        let contextRelevance = 0;
        
        // Boost chunks related to previous topics
        if (previousTopics.length > 0) {
          const topicRelevance = previousTopics.reduce((score, topic) => {
            return score + (chunk.content.toLowerCase().includes(topic.toLowerCase()) ? 0.1 : 0);
          }, 0);
          contextRelevance += topicRelevance;
        }
        
        // Boost chunks related to current topic
        if (currentTopic && chunk.content.toLowerCase().includes(currentTopic.toLowerCase())) {
          contextRelevance += 0.15;
        }
        
        // Boost chunks from same section as previously relevant chunks
        if (context.previouslyRelevantSections) {
          const sectionMatch = context.previouslyRelevantSections.some(section =>
            chunk.section_path && chunk.section_path.includes(section)
          );
          if (sectionMatch) {
            contextRelevance += 0.1;
          }
        }
        
        // Combine enhanced score with context relevance
        const relevanceScore = 
          (chunk.enhanced_score || chunk.similarity_score || 0.5) * 0.8 +
          contextRelevance * 0.2;
        
        return {
          ...chunk,
          relevance_score: relevanceScore,
          context_relevance: contextRelevance,
          enhanced_score: chunk.enhanced_score
        };
      }).sort((a, b) => b.relevance_score - a.relevance_score);
      
    } catch (error) {
      logger.warn('⚠️ Enhanced context-aware scoring failed, falling back to basic:', error.message);
      
      // Fallback to basic context-aware scoring
      const previousTopics = context.previousTopics || [];
      const currentTopic = context.currentTopic || '';
      
      return chunks
        .map(chunk => {
          let contextRelevance = 0;
          
          if (previousTopics.length > 0) {
            const topicRelevance = previousTopics.reduce((score, topic) => {
              return score + (chunk.content.toLowerCase().includes(topic.toLowerCase()) ? 0.1 : 0);
            }, 0);
            contextRelevance += topicRelevance;
          }
          
          if (currentTopic && chunk.content.toLowerCase().includes(currentTopic.toLowerCase())) {
            contextRelevance += 0.15;
          }
          
          if (context.previouslyRelevantSections) {
            const sectionMatch = context.previouslyRelevantSections.some(section =>
              chunk.section_path && chunk.section_path.includes(section)
            );
            if (sectionMatch) {
              contextRelevance += 0.1;
            }
          }
          
          const relevanceScore = 
            (chunk.similarity_score || 0.5) * 0.7 +
            contextRelevance * 0.3;
          
          return {
            ...chunk,
            relevance_score: relevanceScore,
            context_relevance: contextRelevance
          };
        }).sort((a, b) => b.relevance_score - a.relevance_score);
    }
  }

  /**
   * User preference reranking (placeholder for future ML model)
   * @param {string} query - Original query
   * @param {Array} chunks - Chunks to rerank
   * @param {Object} context - Context
   * @returns {Array} Reranked chunks
   */
  async userPreferenceReranking(query, chunks, context) {
    logger.info('🔄 Applying user preference reranking');
    
    // For now, use similarity-based reranking
    // In the future, this could use a trained model based on user feedback
    return await this.similarityBasedReranking(query, chunks, context);
  }

  /**
   * Get content type relevance boost
   * @param {string} contentType - Content type
   * @param {string} queryType - Query type
   * @returns {number} Relevance boost
   */
  getContentTypeRelevance(contentType, queryType) {
    const relevanceMatrix = {
      'procedure': {
        'procedure': 1.0,
        'list': 0.8,
        'text': 0.6,
        'table': 0.4
      },
      'definition': {
        'text': 1.0,
        'definition': 0.9,
        'table': 0.5,
        'list': 0.3
      },
      'list': {
        'list': 1.0,
        'table': 0.8,
        'procedure': 0.6,
        'text': 0.4
      },
      'comparison': {
        'table': 1.0,
        'text': 0.8,
        'list': 0.6,
        'procedure': 0.3
      }
    };
    
    return relevanceMatrix[queryType]?.[contentType] || 0.5;
  }

  /**
   * Apply post-processing filters
   * @param {string} query - Original query
   * @param {Array} chunks - Chunks to filter
   * @param {Object} options - Filter options
   * @returns {Array} Filtered chunks
   */
  async applyPostProcessingFilters(query, chunks, options) {
    logger.info(`🔧 Applying post-processing filters to ${chunks.length} chunks`);
    
    let filteredChunks = [...chunks];
    
    // Remove low-quality chunks
    const minQuality = options.minQualityScore || 0.3;
    filteredChunks = filteredChunks.filter(chunk => chunk.quality_score >= minQuality);
    
    // Remove very short chunks for complex queries
    if (options.queryAnalysis?.complexity === 'complex') {
      filteredChunks = filteredChunks.filter(chunk => chunk.token_count >= 50);
    }
    
    // Ensure diversity in content types
    if (options.ensureContentTypeDiversity) {
      filteredChunks = this.ensureContentTypeDiversity(filteredChunks);
    }
    
    // Limit final results
    const maxResults = options.maxResults || this.config.get('vector.maxRetrievedChunks') || 5;
    filteredChunks = filteredChunks.slice(0, maxResults);
    
    logger.info(`✅ Post-processing complete: ${chunks.length} → ${filteredChunks.length} chunks`);
    
    return filteredChunks;
  }

  /**
   * Ensure diversity in content types
   * @param {Array} chunks - Input chunks
   * @returns {Array} Diversified chunks
   */
  ensureContentTypeDiversity(chunks) {
    const diverseChunks = [];
    const contentTypeCounts = {};
    const maxPerType = 2;
    
    for (const chunk of chunks) {
      const contentType = chunk.content_type || 'text';
      const currentCount = contentTypeCounts[contentType] || 0;
      
      if (currentCount < maxPerType) {
        diverseChunks.push(chunk);
        contentTypeCounts[contentType] = currentCount + 1;
      }
    }
    
    // If we don't have enough diverse chunks, add remaining chunks
    if (diverseChunks.length < 3) {
      for (const chunk of chunks) {
        if (!diverseChunks.find(c => c.chunk_id === chunk.chunk_id)) {
          diverseChunks.push(chunk);
          if (diverseChunks.length >= 5) break;
        }
      }
    }
    
    return diverseChunks;
  }

  /**
   * Calculate retrieval confidence score
   * @param {Array} chunks - Retrieved chunks
   * @param {Object} queryAnalysis - Query analysis
   * @returns {number} Confidence score (0-1)
   */
  calculateRetrievalConfidence(chunks, queryAnalysis) {
    if (chunks.length === 0) return 0;
    
    // Base confidence on top chunk similarity
    const topSimilarity = chunks[0]?.relevance_score || chunks[0]?.similarity_score || 0;
    
    // Boost confidence if we have multiple relevant chunks
    const multipleChunksBoost = Math.min(chunks.length / 3, 1) * 0.1;
    
    // Boost confidence for high-quality chunks
    const avgQuality = chunks.reduce((sum, chunk) => sum + chunk.quality_score, 0) / chunks.length;
    const qualityBoost = avgQuality * 0.1;
    
    // Reduce confidence for complex queries with simple results
    let complexityPenalty = 0;
    if (queryAnalysis.complexity === 'complex' && chunks.length < 3) {
      complexityPenalty = 0.1;
    }
    
    const confidence = Math.min(
      topSimilarity + multipleChunksBoost + qualityBoost - complexityPenalty,
      1.0
    );
    
    return Math.max(confidence, 0);
  }

  /**
   * Get retrieval engine statistics
   * @returns {Object} Statistics
   */
  async getEngineStats() {
    try {
      const vectorStats = await this.vectorRetriever.getRetrievalStats();
      
      return {
        ...vectorStats,
        availableStrategies: Object.keys(this.strategies),
        availableRerankingModels: Object.keys(this.rerankingModels),
        queryPatterns: Object.keys(this.queryPatterns),
        engineVersion: '2.0'
      };
    } catch (error) {
      logger.error('❌ Failed to get engine stats:', error);
      return null;
    }
  }

  /**
   * Test retrieval engine
   * @param {string} testQuery - Test query
   * @param {Object} testContext - Test context
   * @returns {Object} Test results
   */
  async testEngine(testQuery = 'How do I create a new fund?', testContext = {}) {
    try {
      logger.info(`🧪 Testing retrieval engine with query: "${testQuery}"`);
      
      const startTime = Date.now();
      const result = await this.retrieve(testQuery, testContext, {
        maxResults: 3
      });
      const totalTime = Date.now() - startTime;
      
      const testResults = {
        success: true,
        query: testQuery,
        strategy: result.strategy,
        rerankingModel: result.rerankingModel,
        retrievalTime: totalTime,
        chunksRetrieved: result.chunks.length,
        confidenceScore: result.metadata.confidenceScore,
        averageRelevance: result.metadata.averageRelevanceScore,
        queryAnalysis: result.queryAnalysis,
        topChunk: result.chunks.length > 0 ? {
          relevance: result.chunks[0].relevance_score,
          similarity: result.chunks[0].similarity_score,
          source: result.chunks[0].citation?.source,
          contentType: result.chunks[0].content_type,
          preview: result.chunks[0].content.substring(0, 150) + '...'
        } : null
      };
      
      logger.info(`✅ Engine test completed: ${result.chunks.length} chunks, confidence: ${result.metadata.confidenceScore.toFixed(3)}`);
      
      return testResults;
    } catch (error) {
      logger.error('❌ Engine test failed:', error);
      return {
        success: false,
        error: error.message,
        query: testQuery
      };
    }
  }
}

module.exports = RetrievalEngine;
