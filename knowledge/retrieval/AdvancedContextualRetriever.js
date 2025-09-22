/**
 * Advanced Contextual Retriever
 * Multi-strategy retrieval with context expansion and lost-in-middle mitigation
 * Part of Advanced Document Processing Implementation
 */

const { getDatabase } = require('../../config/database');
const OpenAI = require('openai');
const { getConfig } = require('../../config/environment');

class AdvancedContextualRetriever {
  constructor(options = {}) {
    this.config = getConfig();
    this.db = getDatabase();
    this.initialized = false;
    
    // Initialize OpenAI client with graceful handling for missing API key
    const apiKey = this.config.get('openai.apiKey');
    if (apiKey && apiKey !== 'placeholder' && apiKey.length > 10) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('âš ï¸ OpenAI API key not configured - Advanced retrieval will use basic methods');
      this.openai = null;
    }

    this.options = {
      strategies: ['vector_only', 'hybrid', 'multi_scale', 'contextual', 'advanced_multi_feature'],
      contextExpansion: {
        hierarchicalExpansion: true,
        semanticExpansion: true,
        temporalExpansion: true
      },
      lostInMiddleMitigation: {
        enabled: true,
        reorderingStrategy: 'relevance_based',
        chunkInterleaving: true
      },
      qualityOptimization: {
        coherenceScoring: true,
        redundancyReduction: true,
        complementarityMaximization: true
      },
      advancedFeatures: {
        hierarchicalChunking: true,
        multiScaleEmbeddings: true,
        semanticBoundaryDetection: true,
        parentChildRelationships: true,
        siblingRelationships: true,
        domainOptimization: true,
        qualityValidation: true
      },
      ...options
    };

    this.retrievalStats = {
      totalQueries: 0,
      averageRetrievalTime: 0,
      strategyUsage: {},
      qualityScores: []
    };
  }

  /**
   * Initialize the advanced retriever
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize database connection if needed
      if (this.db && !this.db.isReady()) {
        await this.db.initialize();
      }

      // Test OpenAI connection if available
      if (this.openai) {
        console.log('ðŸš€ Advanced retriever initialized with OpenAI support');
      } else {
        console.log('ðŸ”„ Advanced retriever initialized in basic mode (no OpenAI)');
      }

      this.initialized = true;
      this.isInitialized = true;
    } catch (error) {
      console.warn('âš ï¸ Advanced retriever initialization failed:', error.message);
      // Continue in basic mode
      this.initialized = true;
      this.isInitialized = true;
    }
  }

  /**
   * Check if query is a system/health check query that shouldn't consume tokens
   * @param {string} query - Query to check
   * @returns {boolean} True if system query
   */
  isSystemQuery(query) {
    const systemKeywords = [
      'health check',
      'system status',
      'service test',
      'ping',
      'status check',
      'health test'
    ];
    
    const queryLower = query.toLowerCase();
    return systemKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Main retrieval method with advanced context
   */
  async retrieveWithAdvancedContext(query, context = {}, options = {}) {
    const config = { ...this.options, ...options };
    
    console.log(`ðŸ” Starting advanced contextual retrieval for query: "${query.substring(0, 50)}..."`);
    const startTime = Date.now();
    this.retrievalStats.totalQueries++;

    try {
      // Check if this is a system query - return empty results to avoid token usage
      if (this.isSystemQuery(query)) {
        console.log('ðŸ”§ System query detected, returning empty results to avoid token usage');
        return {
          chunks: [],
          confidence: 1.0,
          averageRelevance: 0,
          strategy: 'system_bypass',
          retrievalTime: Date.now() - startTime,
          systemQuery: true
        };
      }
      
      // Step 1: Generate query embedding (if available)
      let queryEmbedding = null;
      let embeddingAvailable = false;

      try {
        queryEmbedding = await this.generateQueryEmbedding(query, context);
        embeddingAvailable = Array.isArray(queryEmbedding);
      } catch (embeddingError) {
        console.warn('dY"? Embedding generation failed, falling back to text search:', embeddingError.message);
      }

      if (!embeddingAvailable) {
        console.warn('dY"? Contextual embeddings unavailable - using text search fallback');
        const fallbackLimit = config.maxResults || config.maxChunks || 5;
        const fallbackResult = await this.performTextSearchFallback(query, fallbackLimit);
        const retrievalTime = Date.now() - startTime;
        this.retrievalStats.strategyUsage.fallback_text = (this.retrievalStats.strategyUsage.fallback_text || 0) + 1;
        this.updateRetrievalStats(retrievalTime, { qualityScore: fallbackResult.metadata.qualityScore });

        return {
          chunks: fallbackResult.chunks,
          metadata: {
            retrievalTime,
            totalChunks: fallbackResult.chunks.length,
            averageRelevance: fallbackResult.metadata.averageRelevance,
            strategiesUsed: fallbackResult.metadata.strategiesUsed,
            contextExpansion: null,
            qualityScore: fallbackResult.metadata.qualityScore,
            fallbackApplied: true,
            fallbackReason: fallbackResult.metadata.fallbackReason
          }
        };
      }

      // Step 2: Execute multi-strategy retrieval
      const retrievalResults = await this.executeMultiStrategyRetrieval(
        query, 
        queryEmbedding, 
        context, 
        config
      );

      // Step 3: Apply context expansion
      const expandedResults = await this.applyContextExpansion(
        retrievalResults, 
        query, 
        context, 
        config
      );

      // Step 4: Apply lost-in-middle mitigation
      const optimizedResults = await this.applyLostInMiddleMitigation(
        expandedResults, 
        query, 
        config
      );

      // Step 5: Apply quality optimization
      const finalResults = await this.applyQualityOptimization(
        optimizedResults, 
        query, 
        config
      );

      const retrievalTime = Date.now() - startTime;
      this.updateRetrievalStats(retrievalTime, finalResults);

      console.log(`�o. Advanced retrieval completed in ${retrievalTime}ms`);
      console.log(`dY"S Retrieved ${finalResults.chunks.length} chunks with average relevance ${finalResults.averageRelevance.toFixed(3)}`);

      return {
        chunks: finalResults.chunks,
        metadata: {
          retrievalTime,
          totalChunks: finalResults.chunks.length,
          averageRelevance: finalResults.averageRelevance,
          strategiesUsed: finalResults.strategiesUsed,
          contextExpansion: finalResults.contextExpansion,
          qualityScore: finalResults.qualityScore
        }
      };
    } catch (error) {
      console.error('âŒ Advanced retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Generate query embedding with context
   */
  async generateQueryEmbedding(query, context) {
    console.log('ðŸŽ¯ Generating contextual query embedding...');
    
    // Check if OpenAI is available
    if (!this.openai) {
      console.warn('âš ï¸ OpenAI not available - using fallback query processing');
      return null;
    }
    
    let contextualQuery = query;
    
    // Add conversation context
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentContext = context.conversationHistory
        .slice(-3)
        .map(msg => msg.content)
        .join(' ');
      contextualQuery = `Context: ${recentContext}\n\nQuery: ${query}`;
    }
    
    // Add domain context
    if (context.domain) {
      contextualQuery = `Domain: ${context.domain}\n\n${contextualQuery}`;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.get('openai.embeddingModel'),
        input: contextualQuery
      });

      console.log('âœ… Query embedding generated');
      return response.data[0].embedding;
    } catch (error) {
      console.error('âŒ Failed to generate query embedding:', error);
      throw error;
    }
  }

  /**
   * Execute multi-strategy retrieval
   */
  async executeMultiStrategyRetrieval(query, queryEmbedding, context, config) {
    console.log('ðŸ”„ Executing multi-strategy retrieval...');
    
    const allResults = [];
    const strategiesUsed = [];

    for (const strategy of config.strategies) {
      try {
        console.log(`ðŸ“‹ Executing ${strategy} strategy...`);
        const strategyResults = await this.executeRetrievalStrategy(
          strategy, 
          query, 
          queryEmbedding, 
          context, 
          config
        );
        
        if (strategyResults && strategyResults.length > 0) {
          allResults.push(...strategyResults);
          strategiesUsed.push(strategy);
          
          // Update strategy usage stats
          this.retrievalStats.strategyUsage[strategy] = 
            (this.retrievalStats.strategyUsage[strategy] || 0) + 1;
        }
      } catch (error) {
        console.warn(`âš ï¸ Strategy ${strategy} failed:`, error.message);
      }
    }

    // Deduplicate results
    const uniqueResults = this.deduplicateResults(allResults);
    
    console.log(`âœ… Multi-strategy retrieval completed: ${uniqueResults.length} unique chunks`);
    return {
      chunks: uniqueResults,
      strategiesUsed
    };
  }

  /**
   * Execute specific retrieval strategy
   */
  async executeRetrievalStrategy(strategy, query, queryEmbedding, context, config) {
    const maxResults = config.maxResults || 10;
    
    switch (strategy) {
      case 'vector_only':
        return await this.vectorOnlyRetrieval(queryEmbedding, maxResults);
      
      case 'hybrid':
        return await this.hybridRetrieval(query, queryEmbedding, maxResults);
      
      case 'multi_scale':
        return await this.multiScaleRetrieval(queryEmbedding, maxResults);
      
      case 'contextual':
        return await this.contextualRetrieval(query, queryEmbedding, context, maxResults);
      
      case 'advanced_multi_feature':
        return await this.advancedMultiFeatureRetrieval(query, queryEmbedding, context, maxResults);
      
      default:
        console.warn(`âš ï¸ Unknown retrieval strategy: ${strategy}`);
        return [];
    }
  }

  /**
   * Vector-only retrieval
   */
  async vectorOnlyRetrieval(queryEmbedding, maxResults) {
    const query = `
      SELECT 
        chunk_id, source_id, version, chunk_index, content, heading,
        page_number, token_count, quality_score, metadata,
        parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
        scale, node_id, hierarchy_path,
        1 - (embedding <=> $1::vector) as similarity_score
      FROM kb_chunks 
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    try {
      // Convert embedding array to PostgreSQL vector format
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const result = await this.db.query(query, [vectorString, maxResults]);
      return result.rows.map(row => ({
        ...row,
        retrievalStrategy: 'vector_only'
      }));
    } catch (error) {
      console.error('âŒ Vector-only retrieval failed:', error);
      return [];
    }
  }

  /**
   * Hybrid retrieval (vector + text search)
   */
  async hybridRetrieval(queryText, queryEmbedding, maxResults) {
    const query = `
      SELECT 
        chunk_id, source_id, version, chunk_index, content, heading,
        page_number, token_count, quality_score, metadata,
        parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
        scale, node_id, hierarchy_path,
        (1 - (embedding <=> $1::vector)) * 0.7 + 
        (ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) * 0.3) as hybrid_score
      FROM kb_chunks 
      WHERE embedding IS NOT NULL
        AND (to_tsvector('english', content) @@ plainto_tsquery('english', $2)
             OR embedding <=> $1::vector < 0.5)
      ORDER BY hybrid_score DESC
      LIMIT $3
    `;

    try {
      // Convert embedding array to PostgreSQL vector format
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const result = await this.db.query(query, [vectorString, queryText, maxResults]);
      return result.rows.map(row => ({
        ...row,
        similarity_score: row.hybrid_score,
        retrievalStrategy: 'hybrid'
      }));
    } catch (error) {
      console.error('âŒ Hybrid retrieval failed:', error);
      return [];
    }
  }

  /**
   * Multi-scale retrieval
   */
  async multiScaleRetrieval(queryEmbedding, maxResults) {
    const scales = ['document', 'section', 'paragraph'];
    const resultsPerScale = Math.ceil(maxResults / scales.length);
    const allResults = [];

    for (const scale of scales) {
      const query = `
        SELECT 
          chunk_id, source_id, version, chunk_index, content, heading,
          page_number, token_count, quality_score, metadata,
          parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
          scale, node_id, hierarchy_path,
          1 - (embedding <=> $1::vector) as similarity_score
        FROM kb_chunks 
        WHERE embedding IS NOT NULL AND scale = $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;

      try {
        // Convert embedding array to PostgreSQL vector format
        const vectorString = `[${queryEmbedding.join(',')}]`;
        const result = await this.db.query(query, [vectorString, scale, resultsPerScale]);
        const scaleResults = result.rows.map(row => ({
          ...row,
          retrievalStrategy: 'multi_scale',
          scaleBoost: scale === 'section' ? 1.1 : 1.0
        }));
        allResults.push(...scaleResults);
      } catch (error) {
        console.warn(`âš ï¸ Multi-scale retrieval failed for scale ${scale}:`, error.message);
      }
    }

    return allResults.slice(0, maxResults);
  }

  /**
   * Advanced Multi-Feature Retrieval
   * Combines all advanced features: hierarchical chunking, multi-scale embeddings,
   * semantic boundaries, parent-child relationships, quality validation, etc.
   */
    async advancedMultiFeatureRetrieval(queryText, queryEmbedding, context, maxResults) {
      console.log('ðŸš€ Executing advanced multi-feature retrieval...');
      
      const query = `
        WITH ranked_chunks AS (
          SELECT 
            c.chunk_id, c.source_id, c.version, c.chunk_index, c.content, c.heading,
            c.page_number, c.token_count, c.character_count, c.word_count, 
            c.quality_score, c.metadata, c.created_at, c.updated_at,
            
            -- Enhanced vector similarity with content type weighting
            CASE 
              WHEN c.metadata->>'content_type' = 'heading' THEN (1 - (embedding <=> $1::vector)) * 1.1
              WHEN c.metadata->>'content_type' = 'summary' THEN (1 - (embedding <=> $1::vector)) * 1.0  
              WHEN c.metadata->>'content_type' = 'table' THEN (1 - (embedding <=> $1::vector)) * 0.9
              ELSE (1 - (embedding <=> $1::vector)) * 0.8
            END as vector_score,
            
            -- Text search with domain-specific ranking
            ts_rank_cd(
              to_tsvector('english', COALESCE(c.heading, '') || ' ' || c.content), 
              plainto_tsquery('english', $2),
              32  -- Cover density ranking
            ) as text_score,
            
            -- Quality-based scoring (favor high-quality chunks)
            CASE 
              WHEN c.quality_score >= 0.8 THEN c.quality_score * 1.2
              WHEN c.quality_score >= 0.6 THEN c.quality_score * 1.0
              ELSE c.quality_score * 0.8
            END as quality_boost,
            
            -- Position-based scoring (favor chunks from different pages)
            CASE 
              WHEN c.page_number IS NOT NULL THEN 0.05  -- Slight boost for chunks with page info
              ELSE 0.0
            END as position_boost,
            
            -- Content length optimization
            CASE 
              WHEN c.character_count BETWEEN 200 AND 1500 THEN 0.1  -- Optimal length chunks
              WHEN c.character_count BETWEEN 100 AND 200 THEN 0.05   -- Short but acceptable
              WHEN c.character_count > 1500 THEN -0.05  -- Penalize very long chunks
              ELSE -0.1  -- Penalize very short chunks
            END as length_optimization,
            
            -- Semantic boundary detection (favor chunks with clear boundaries)
            CASE 
              WHEN c.heading IS NOT NULL AND length(c.heading) > 0 THEN 0.1
              WHEN c.metadata->>'semantic_boundary' = 'true' THEN 0.15
              ELSE 0.0
            END as boundary_boost
            
          FROM kb_chunks c
          JOIN kb_sources s ON c.source_id = s.source_id
          WHERE c.embedding IS NOT NULL
            AND c.quality_score > 0.3  -- Quality validation threshold
            AND s.processing_status = 'completed'  -- Only completed documents
            AND (
              -- Vector similarity threshold
              c.embedding <=> $1::vector < 0.6
              OR 
              -- Text search match
              to_tsvector('english', COALESCE(c.heading, '') || ' ' || c.content) @@ plainto_tsquery('english', $2)
            )
        ),
        scored_chunks AS (
          SELECT *,
            -- Combined advanced scoring
            (
              vector_score * 0.4 +           -- Vector similarity (40%)
              text_score * 0.2 +             -- Text search (20%)
              quality_boost * 0.15 +         -- Quality score (15%)
              position_boost * 0.1 +         -- Position diversity (10%)
              length_optimization * 0.1 +    -- Content optimization (10%)
              boundary_boost * 0.05          -- Semantic boundaries (5%)
            ) as advanced_score
          FROM ranked_chunks
        ),
        diversified_results AS (
          SELECT DISTINCT ON (source_id, page_number, chunk_index) *
          FROM scored_chunks
          ORDER BY source_id, page_number, chunk_index, advanced_score DESC
        )
        SELECT 
          chunk_id, source_id, version, chunk_index, content, heading,
          page_number, token_count, character_count, word_count, quality_score, 
          metadata, created_at, updated_at,
          advanced_score as similarity_score,
          vector_score, text_score, quality_boost, position_boost, 
          length_optimization, boundary_boost
        FROM diversified_results
        ORDER BY advanced_score DESC
        LIMIT $3
      `;

    try {
      // Convert embedding array to PostgreSQL vector format
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const result = await this.db.query(query, [vectorString, queryText, maxResults]);
      
      const enhancedResults = result.rows.map(row => ({
        ...row,
        retrievalStrategy: 'advanced_multi_feature',
        advancedFeatures: {
          vectorScore: parseFloat(row.vector_score || 0),
          textScore: parseFloat(row.text_score || 0),
          qualityBoost: parseFloat(row.quality_boost || 0),
          positionBoost: parseFloat(row.position_boost || 0),
          lengthOptimization: parseFloat(row.length_optimization || 0),
          boundaryBoost: parseFloat(row.boundary_boost || 0)
        }
      }));

      console.log(`âœ… Advanced multi-feature retrieval completed: ${enhancedResults.length} chunks with enhanced scoring`);
      return enhancedResults;
      
    } catch (error) {
      console.error('âŒ Advanced multi-feature retrieval failed:', error);
      // Fallback to hybrid retrieval
      console.log('ðŸ”„ Falling back to hybrid retrieval...');
      return await this.hybridRetrieval(queryText, queryEmbedding, maxResults);
    }
  }

  /**
   * Contextual retrieval
   */
  async contextualRetrieval(queryText, queryEmbedding, context, maxResults) {
    // Build contextual filters
    const filters = [];
    // Convert embedding array to PostgreSQL vector format
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const params = [vectorString];
    let paramIndex = 2;

    // Add source filtering if specified
    if (context.sourceIds && context.sourceIds.length > 0) {
      filters.push(`source_id = ANY($${paramIndex})`);
      params.push(context.sourceIds);
      paramIndex++;
    }

    // Add quality filtering
    filters.push(`quality_score >= $${paramIndex}`);
    params.push(context.minQualityScore || 0.5);
    paramIndex++;

    const whereClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';

    const query = `
      SELECT 
        chunk_id, source_id, version, chunk_index, content, heading,
        page_number, token_count, quality_score, metadata,
        parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
        scale, node_id, hierarchy_path,
        1 - (embedding <=> $1::vector) as similarity_score
      FROM kb_chunks 
      WHERE embedding IS NOT NULL ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIndex}
    `;

    params.push(maxResults);

    try {
      const result = await this.db.query(query, params);
      return result.rows.map(row => ({
        ...row,
        retrievalStrategy: 'contextual'
      }));
    } catch (error) {
      console.error('âŒ Contextual retrieval failed:', error);
      return [];
    }
  }

  /**
   * Apply context expansion
   */
  async applyContextExpansion(retrievalResults, query, context, config) {
    if (!config.contextExpansion) {
      return retrievalResults;
    }

    console.log('ðŸ”„ Applying context expansion...');
    const expandedChunks = [...retrievalResults.chunks];

    // Hierarchical expansion
    if (config.contextExpansion.hierarchicalExpansion) {
      const hierarchicalChunks = await this.expandHierarchicalContext(retrievalResults.chunks);
      expandedChunks.push(...hierarchicalChunks);
    }

    // Semantic expansion
    if (config.contextExpansion.semanticExpansion) {
      const semanticChunks = await this.expandSemanticContext(retrievalResults.chunks, query);
      expandedChunks.push(...semanticChunks);
    }

    // Deduplicate expanded results
    const uniqueExpandedChunks = this.deduplicateResults(expandedChunks);

    console.log(`âœ… Context expansion completed: ${uniqueExpandedChunks.length} chunks`);
    return {
      ...retrievalResults,
      chunks: uniqueExpandedChunks,
      contextExpansion: {
        hierarchicalExpansion: config.contextExpansion.hierarchicalExpansion,
        semanticExpansion: config.contextExpansion.semanticExpansion,
        originalCount: retrievalResults.chunks.length,
        expandedCount: uniqueExpandedChunks.length
      }
    };
  }

  /**
   * Expand hierarchical context
   */
  async expandHierarchicalContext(chunks) {
    const expandedChunks = [];
    
    for (const chunk of chunks) {
      // Add parent chunks
      if (chunk.parent_chunk_id) {
        try {
          const parentQuery = `
            SELECT * FROM kb_chunks WHERE chunk_id = $1
          `;
          const parentResult = await this.db.query(parentQuery, [chunk.parent_chunk_id]);
          if (parentResult.rows.length > 0) {
            expandedChunks.push({
              ...parentResult.rows[0],
              expansionType: 'parent',
              similarity_score: chunk.similarity_score * 0.8
            });
          }
        } catch (error) {
          console.warn(`âš ï¸ Failed to expand parent context for ${chunk.chunk_id}`);
        }
      }

      // Add child chunks
      if (chunk.child_chunk_ids && chunk.child_chunk_ids.length > 0) {
        try {
          const childQuery = `
            SELECT * FROM kb_chunks WHERE chunk_id = ANY($1)
          `;
          const childResult = await this.db.query(childQuery, [chunk.child_chunk_ids]);
          for (const childChunk of childResult.rows) {
            expandedChunks.push({
              ...childChunk,
              expansionType: 'child',
              similarity_score: chunk.similarity_score * 0.9
            });
          }
        } catch (error) {
          console.warn(`âš ï¸ Failed to expand child context for ${chunk.chunk_id}`);
        }
      }
    }

    return expandedChunks;
  }

  /**
   * Expand semantic context by finding semantically related chunks
   */
  async expandSemanticContext(chunks, query) {
    try {
      console.log('ðŸ” Expanding semantic context...');
      
      if (chunks.length === 0) return [];
      
      const expandedChunks = [];
      const queryKeywords = this.extractKeywords(query);
      
      // For each retrieved chunk, find semantically related chunks
      for (const chunk of chunks) {
        const chunkKeywords = this.extractKeywords(chunk.content);
        const combinedKeywords = [...new Set([...queryKeywords, ...chunkKeywords])];
        
        // Find chunks with semantic similarity
        const semanticMatches = await this.findSemanticallySimilarChunks(
          chunk, 
          combinedKeywords, 
          chunks
        );
        
        expandedChunks.push(...semanticMatches);
      }
      
      // Remove duplicates and chunks already in original set
      const existingIds = new Set(chunks.map(c => c.chunk_id));
      const uniqueExpanded = expandedChunks.filter(chunk => 
        !existingIds.has(chunk.chunk_id)
      );
      
      // Limit expansion to prevent context overflow
      const maxExpansion = Math.min(uniqueExpanded.length, 3);
      const finalExpanded = uniqueExpanded.slice(0, maxExpansion);
      
      console.log(`âœ… Semantic expansion: ${finalExpanded.length} additional chunks found`);
      return finalExpanded;
      
    } catch (error) {
      console.warn('âš ï¸ Semantic context expansion failed:', error.message);
      return [];
    }
  }

  /**
   * Extract keywords from text for semantic matching
   */
  extractKeywords(text) {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Return unique keywords
    return [...new Set(words)];
  }

  /**
   * Find semantically similar chunks using keyword overlap and content similarity
   */
  async findSemanticallySimilarChunks(targetChunk, keywords, excludeChunks) {
    const excludeIds = new Set(excludeChunks.map(c => c.chunk_id));
    
    // Build semantic search query
    const keywordQuery = keywords.slice(0, 10).join(' | '); // Limit keywords
    
    const query = `
      SELECT 
        chunk_id, source_id, version, chunk_index, content, heading,
        page_number, token_count, quality_score, metadata,
        parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
        scale, node_id, hierarchy_path,
        ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as semantic_score
      FROM kb_chunks 
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
        AND chunk_id != $2
        AND quality_score >= 0.4
      ORDER BY semantic_score DESC
      LIMIT 10
    `;

    try {
      const result = await this.db.query(query, [keywordQuery, targetChunk.chunk_id]);
      
      // Filter out excluded chunks and calculate additional similarity
      const candidates = result.rows
        .filter(row => !excludeIds.has(row.chunk_id))
        .map(row => ({
          ...row,
          expansionType: 'semantic',
          similarity_score: this.calculateContentSimilarity(targetChunk.content, row.content),
          semantic_relevance: row.semantic_score
        }))
        .filter(chunk => chunk.similarity_score > 0.2) // Minimum similarity threshold
        .sort((a, b) => (b.similarity_score + b.semantic_relevance) - (a.similarity_score + a.semantic_relevance));
      
      return candidates.slice(0, 2); // Limit to top 2 matches per chunk
      
    } catch (error) {
      console.warn('âš ï¸ Database query failed in semantic expansion:', error.message);
      return [];
    }
  }

  /**
   * Apply lost-in-middle mitigation
   */
  async applyLostInMiddleMitigation(retrievalResults, query, config) {
    if (!config.lostInMiddleMitigation.enabled) {
      return retrievalResults;
    }

    console.log('ðŸ”„ Applying lost-in-middle mitigation...');
    
    let reorderedChunks = [...retrievalResults.chunks];

    if (config.lostInMiddleMitigation.reorderingStrategy === 'relevance_based') {
      reorderedChunks = this.reorderByRelevance(reorderedChunks);
    }

    if (config.lostInMiddleMitigation.chunkInterleaving) {
      reorderedChunks = this.interleaveChunks(reorderedChunks);
    }

    console.log('âœ… Lost-in-middle mitigation applied');
    return {
      ...retrievalResults,
      chunks: reorderedChunks
    };
  }

  /**
   * Reorder chunks by relevance to avoid lost-in-middle
   */
  reorderByRelevance(chunks) {
    // Sort by similarity score and interleave high-relevance chunks
    const sortedChunks = chunks.sort((a, b) => b.similarity_score - a.similarity_score);
    
    const reordered = [];
    const highRelevance = sortedChunks.filter(c => c.similarity_score > 0.8);
    const mediumRelevance = sortedChunks.filter(c => c.similarity_score <= 0.8 && c.similarity_score > 0.6);
    const lowRelevance = sortedChunks.filter(c => c.similarity_score <= 0.6);

    // Interleave high relevance chunks at beginning and end
    for (let i = 0; i < Math.max(highRelevance.length, mediumRelevance.length, lowRelevance.length); i++) {
      if (i < highRelevance.length) reordered.push(highRelevance[i]);
      if (i < mediumRelevance.length) reordered.push(mediumRelevance[i]);
      if (i < lowRelevance.length) reordered.push(lowRelevance[i]);
    }

    return reordered;
  }

  /**
   * Interleave chunks to prevent clustering
   */
  interleaveChunks(chunks) {
    // Group chunks by source and interleave
    const chunksBySource = {};
    
    for (const chunk of chunks) {
      if (!chunksBySource[chunk.source_id]) {
        chunksBySource[chunk.source_id] = [];
      }
      chunksBySource[chunk.source_id].push(chunk);
    }

    const interleaved = [];
    const sources = Object.keys(chunksBySource);
    const maxLength = Math.max(...Object.values(chunksBySource).map(arr => arr.length));

    for (let i = 0; i < maxLength; i++) {
      for (const source of sources) {
        if (chunksBySource[source][i]) {
          interleaved.push(chunksBySource[source][i]);
        }
      }
    }

    return interleaved;
  }

  /**
   * Apply quality optimization
   */
  async applyQualityOptimization(retrievalResults, query, config) {
    if (!config.qualityOptimization) {
      return retrievalResults;
    }

    console.log('ðŸ”„ Applying quality optimization...');
    
    let optimizedChunks = [...retrievalResults.chunks];

    // Apply coherence scoring
    if (config.qualityOptimization.coherenceScoring) {
      optimizedChunks = this.applyCoherenceScoring(optimizedChunks, query);
    }

    // Apply redundancy reduction
    if (config.qualityOptimization.redundancyReduction) {
      optimizedChunks = this.reduceRedundancy(optimizedChunks);
    }

    // Apply complementarity maximization
    if (config.qualityOptimization.complementarityMaximization) {
      optimizedChunks = this.maximizeComplementarity(optimizedChunks);
    }

    const qualityScore = this.calculateOverallQuality(optimizedChunks);

    console.log(`âœ… Quality optimization completed (score: ${qualityScore.toFixed(3)})`);
    return {
      ...retrievalResults,
      chunks: optimizedChunks,
      qualityScore,
      averageRelevance: optimizedChunks.reduce((sum, c) => sum + c.similarity_score, 0) / optimizedChunks.length
    };
  }

  // Helper methods
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      if (seen.has(result.chunk_id)) {
        return false;
      }
      seen.add(result.chunk_id);
      return true;
    });
  }

  applyCoherenceScoring(chunks, query) {
    // Simple coherence scoring based on content similarity
    return chunks.map(chunk => ({
      ...chunk,
      coherenceScore: this.calculateCoherenceScore(chunk, query)
    }));
  }

  calculateCoherenceScore(chunk, query) {
    // Simple heuristic - in practice would use more sophisticated NLP
    const queryWords = query.toLowerCase().split(/\s+/);
    const chunkWords = chunk.content.toLowerCase().split(/\s+/);
    const overlap = queryWords.filter(word => chunkWords.includes(word)).length;
    return overlap / queryWords.length;
  }

  reduceRedundancy(chunks) {
    // Remove highly similar chunks
    const filtered = [];
    
    for (const chunk of chunks) {
      const isDuplicate = filtered.some(existing => 
        this.calculateContentSimilarity(chunk.content, existing.content) > 0.9
      );
      
      if (!isDuplicate) {
        filtered.push(chunk);
      }
    }
    
    return filtered;
  }

  calculateContentSimilarity(content1, content2) {
    // Simple Jaccard similarity
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  maximizeComplementarity(chunks) {
    if (chunks.length <= 1) return chunks;
    
    console.log('ðŸ”„ Maximizing chunk complementarity...');
    
    try {
      // Calculate complementarity matrix
      const complementarityMatrix = this.buildComplementarityMatrix(chunks);
      
      // Select chunks that maximize information diversity
      const selectedChunks = this.selectComplementaryChunks(chunks, complementarityMatrix);
      
      console.log(`âœ… Complementarity optimization: ${selectedChunks.length}/${chunks.length} chunks selected`);
      return selectedChunks;
      
    } catch (error) {
      console.warn('âš ï¸ Complementarity maximization failed:', error.message);
      return chunks; // Return original chunks on error
    }
  }

  /**
   * Build complementarity matrix between chunks
   */
  buildComplementarityMatrix(chunks) {
    const matrix = [];
    
    for (let i = 0; i < chunks.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < chunks.length; j++) {
        if (i === j) {
          matrix[i][j] = 0; // No complementarity with self
        } else {
          matrix[i][j] = this.calculateComplementarityScore(chunks[i], chunks[j]);
        }
      }
    }
    
    return matrix;
  }

  /**
   * Calculate complementarity score between two chunks
   */
  calculateComplementarityScore(chunk1, chunk2) {
    let score = 0;
    
    // 1. Content diversity (40% weight) - lower similarity = higher complementarity
    const contentSimilarity = this.calculateContentSimilarity(chunk1.content, chunk2.content);
    const contentDiversity = 1 - contentSimilarity;
    score += contentDiversity * 0.4;
    
    // 2. Source diversity (20% weight)
    const sourceDiversity = chunk1.source_id !== chunk2.source_id ? 1 : 0;
    score += sourceDiversity * 0.2;
    
    // 3. Scale diversity (20% weight)
    const scaleDiversity = chunk1.scale !== chunk2.scale ? 1 : 0;
    score += scaleDiversity * 0.2;
    
    // 4. Topic diversity (20% weight)
    const topicDiversity = this.calculateTopicDiversity(chunk1, chunk2);
    score += topicDiversity * 0.2;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate topic diversity between chunks
   */
  calculateTopicDiversity(chunk1, chunk2) {
    // Extract key topics from headings and content
    const topics1 = this.extractTopics(chunk1);
    const topics2 = this.extractTopics(chunk2);
    
    if (topics1.length === 0 || topics2.length === 0) return 0.5;
    
    const commonTopics = topics1.filter(topic => topics2.includes(topic));
    const totalTopics = new Set([...topics1, ...topics2]).size;
    
    // Higher diversity when fewer common topics
    return 1 - (commonTopics.length / totalTopics);
  }

  /**
   * Extract topics from chunk content and metadata
   */
  extractTopics(chunk) {
    const topics = [];
    
    // Extract from heading
    if (chunk.heading) {
      const headingWords = chunk.heading.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
      topics.push(...headingWords);
    }
    
    // Extract from content (first few sentences for topic identification)
    const contentPreview = chunk.content.substring(0, 200).toLowerCase();
    const contentWords = contentPreview
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);
    
    // Look for domain-specific terms
    const domainTerms = [
      'fund', 'investment', 'portfolio', 'nav', 'compliance', 'audit',
      'valuation', 'performance', 'risk', 'allocation', 'management'
    ];
    
    const foundTerms = domainTerms.filter(term => 
      contentPreview.includes(term) || (chunk.heading && chunk.heading.toLowerCase().includes(term))
    );
    
    topics.push(...foundTerms);
    
    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Select chunks that maximize complementarity using greedy algorithm
   */
  selectComplementaryChunks(chunks, complementarityMatrix) {
    if (chunks.length <= 3) return chunks; // Keep all if few chunks
    
    const selected = [];
    const available = chunks.map((_, index) => index);
    
    // Start with highest quality chunk
    const startIndex = chunks.reduce((maxIdx, chunk, idx) => 
      chunk.similarity_score > chunks[maxIdx].similarity_score ? idx : maxIdx, 0
    );
    
    selected.push(startIndex);
    available.splice(available.indexOf(startIndex), 1);
    
    // Greedily select chunks that maximize complementarity
    while (selected.length < Math.min(chunks.length, 5) && available.length > 0) {
      let bestIndex = -1;
      let bestScore = -1;
      
      for (const candidateIdx of available) {
        // Calculate average complementarity with already selected chunks
        const avgComplementarity = selected.reduce((sum, selectedIdx) => 
          sum + complementarityMatrix[candidateIdx][selectedIdx], 0
        ) / selected.length;
        
        // Combine complementarity with original relevance
        const combinedScore = avgComplementarity * 0.7 + chunks[candidateIdx].similarity_score * 0.3;
        
        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestIndex = candidateIdx;
        }
      }
      
      if (bestIndex >= 0) {
        selected.push(bestIndex);
        available.splice(available.indexOf(bestIndex), 1);
      } else {
        break; // No more good candidates
      }
    }
    
    // Return selected chunks in original relevance order
    return selected
      .sort((a, b) => chunks[b].similarity_score - chunks[a].similarity_score)
      .map(index => ({
        ...chunks[index],
        complementarityRank: selected.indexOf(index) + 1
      }));
  }

  async performTextSearchFallback(query, limit = 5) {
    if (!this.db) {
      console.warn('dY"? Database not available for text search fallback');
      return {
        chunks: [],
        metadata: {
          strategiesUsed: ['text_search_fallback'],
          averageRelevance: 0,
          qualityScore: 0,
          fallbackReason: 'embedding_unavailable_no_database'
        }
      };
    }

    const sanitizedQuery = (query || '').trim();
    if (!sanitizedQuery) {
      return {
        chunks: [],
        metadata: {
          strategiesUsed: ['text_search_fallback'],
          averageRelevance: 0,
          qualityScore: 0,
          fallbackReason: 'empty_query'
        }
      };
    }

    const tsQueryInput = sanitizedQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').trim() || sanitizedQuery;
    const textSearchSql = `
      SELECT 
        chunk_id, source_id, version, chunk_index, content, heading,
        page_number, token_count, quality_score, metadata,
        parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
        scale, node_id, hierarchy_path,
        ts_rank(
          to_tsvector('english', COALESCE(heading, '') || ' ' || content),
          plainto_tsquery('english', $1)
        ) AS text_rank
      FROM kb_chunks 
      WHERE to_tsvector('english', COALESCE(heading, '') || ' ' || content)
            @@ plainto_tsquery('english', $1)
      ORDER BY text_rank DESC
      LIMIT $2
    `;

    let rows = [];
    try {
      const result = await this.db.query(textSearchSql, [tsQueryInput, limit]);
      rows = result.rows;
    } catch (error) {
      console.warn('dY"? Text search fallback query failed:', error.message);
    }

    if (!rows || rows.length === 0) {
      const likeSql = `
        SELECT 
          chunk_id, source_id, version, chunk_index, content, heading,
          page_number, token_count, quality_score, metadata,
          parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
          scale, node_id, hierarchy_path,
          0.05 AS partial_match_score
        FROM kb_chunks
        WHERE content ILIKE '%' || $1 || '%' OR heading ILIKE '%' || $1 || '%'
        LIMIT $2
      `;
      try {
        const result = await this.db.query(likeSql, [sanitizedQuery, limit]);
        rows = result.rows;
      } catch (likeError) {
        console.warn('dY"? Partial text fallback failed:', likeError.message);
      }
    }

    const normalized = (rows || []).map(row => {
      const relevance = typeof row.text_rank === 'number'
        ? row.text_rank
        : (typeof row.partial_match_score === 'number' ? row.partial_match_score : 0);
      return {
        ...row,
        similarity_score: relevance,
        retrievalStrategy: 'text_search_fallback'
      };
    });

    const averageRelevance = normalized.length > 0
      ? normalized.reduce((sum, chunk) => sum + (chunk.similarity_score || 0), 0) / normalized.length
      : 0;
    const qualityScore = Math.min(0.9, averageRelevance || 0);

    return {
      chunks: normalized,
      metadata: {
        strategiesUsed: ['text_search_fallback'],
        averageRelevance,
        qualityScore,
        confidenceScore: qualityScore,
        fallbackReason: 'embedding_unavailable'
      }
    };
  }
  calculateOverallQuality(chunks) {
    if (chunks.length === 0) return 0;
    
    const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity_score, 0) / chunks.length;
    const avgQuality = chunks.reduce((sum, c) => sum + (c.quality_score || 0.5), 0) / chunks.length;
    
    return (avgSimilarity + avgQuality) / 2;
  }

  updateRetrievalStats(retrievalTime, results) {
    this.retrievalStats.averageRetrievalTime = 
      (this.retrievalStats.averageRetrievalTime * (this.retrievalStats.totalQueries - 1) + retrievalTime) / 
      this.retrievalStats.totalQueries;
    
    if (results.qualityScore) {
      this.retrievalStats.qualityScores.push(results.qualityScore);
    }
  }

  /**
   * Get retrieval engine statistics
   */
  async getEngineStats() {
    const totalChunksQuery = 'SELECT COUNT(*) as total FROM kb_chunks WHERE embedding IS NOT NULL';
    const avgQualityQuery = 'SELECT AVG(quality_score) as avg_quality FROM kb_chunks WHERE quality_score IS NOT NULL';
    
    try {
      const [totalResult, qualityResult] = await Promise.all([
        this.db.query(totalChunksQuery),
        this.db.query(avgQualityQuery)
      ]);

      return {
        availableStrategies: this.options.strategies,
        totalChunks: parseInt(totalResult.rows[0].total),
        averageQuality: parseFloat(qualityResult.rows[0].avg_quality) || 0,
        retrievalStats: this.retrievalStats,
        contextExpansion: this.options.contextExpansion,
        lostInMiddleMitigation: this.options.lostInMiddleMitigation
      };
    } catch (error) {
      console.error('âŒ Failed to get engine stats:', error);
      return {
        availableStrategies: this.options.strategies,
        totalChunks: 0,
        averageQuality: 0,
        retrievalStats: this.retrievalStats
      };
    }
  }
}

module.exports = AdvancedContextualRetriever;

