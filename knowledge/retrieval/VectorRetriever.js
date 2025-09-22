/**
 * Vector Retriever Module
 * Advanced vector similarity search with pgvector, reranking, and filtering
 * Phase 2: Retrieval & Prompting System
 */

const { getConfig } = require('../../config/environment');
const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

class VectorRetriever {
  constructor() {
    this.config = getConfig();
    this.db = null;
    
    // Retrieval configuration
    this.defaultConfig = {
      topK: this.config.get('rag.retrieval.topK') || 10,
      similarityThreshold: this.config.get('vector.similarityThreshold') || 0.5,
      maxRetrievedChunks: this.config.get('vector.maxRetrievedChunks') || 5,
      enableReranking: this.config.get('rag.retrieval.rerank') !== false,
      enableHybridSearch: this.config.get('rag.retrieval.enableHybridSearch') !== false,
      diversityThreshold: this.config.get('rag.retrieval.diversityThreshold') || 0.8,
      similarityMetric: this.config.get('vector.similarityMetric') || 'cosine'
    };
    
    // Reranking weights
    this.rerankingWeights = {
      vectorSimilarity: 0.6,
      textSimilarity: 0.2,
      qualityScore: 0.1,
      recency: 0.05,
      sourceReliability: 0.05
    };
  }

  /**
   * Initialize database connection and check pgvector availability
   */
  async initializeDatabase() {
    if (!this.db) {
      this.db = getDatabase();
      if (!this.db.isReady()) {
        await this.db.initialize();
      }
      await this.checkPgVectorAvailability();
    }
  }

  /**
   * Check if pgvector extension is available
   */
  async checkPgVectorAvailability() {
    try {
      const result = await this.db.query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_pgvector"
      );
      
      if (!result.rows[0].has_pgvector) {
        const error = new Error(
          'PGVECTOR_NOT_INSTALLED: pgvector extension is required for vector similarity search. ' +
          'Please install pgvector extension in PostgreSQL before using RAG functionality. ' +
          'Installation instructions: https://github.com/pgvector/pgvector#installation'
        );
        error.code = 'PGVECTOR_NOT_INSTALLED';
        throw error;
      }
      
      logger.info('✅ pgvector extension is available');
    } catch (error) {
      if (error.code === 'PGVECTOR_NOT_INSTALLED') {
        throw error;
      }
      
      // If we can't check, assume it's not available
      const pgvectorError = new Error(
        'PGVECTOR_CHECK_FAILED: Unable to verify pgvector extension availability. ' +
        'Please ensure pgvector is properly installed and the database connection is working. ' +
        'Error: ' + error.message
      );
      pgvectorError.code = 'PGVECTOR_CHECK_FAILED';
      throw pgvectorError;
    }
  }

  /**
   * Generate embedding for query using OpenAI
   * @param {string} query - Search query
   * @returns {Array} Query embedding vector
   */
  async generateQueryEmbedding(query) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: this.config.get('openai.apiKey'),
        organization: this.config.get('openai.organization'),
        timeout: this.config.get('openai.requestTimeout')
      });

      logger.info(`🔮 Generating query embedding for: "${query.substring(0, 50)}..."`);
      
      const startTime = Date.now();
      const embeddingModel = this.config.get('openai.embeddingModel') || 'text-embedding-3-large';
      
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: query,
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;
      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ Query embedding generated in ${processingTime}ms (${embedding.length}D)`);
      
      return embedding;
    } catch (error) {
      logger.error('❌ Failed to generate query embedding:', error);
      throw new Error(`Query embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve relevant chunks using vector similarity search
   * @param {string} query - Search query
   * @param {Object} options - Retrieval options
   * @returns {Array} Array of relevant chunks with scores
   */
  async retrieveRelevantChunks(query, options = {}) {
    try {
      await this.initializeDatabase();
      
      const config = {
        ...this.defaultConfig,
        ...options
      };

      logger.info(`🔍 Retrieving chunks for query: "${query.substring(0, 100)}..."`);
      logger.info(`📊 Config: topK=${config.topK}, threshold=${config.similarityThreshold}, rerank=${config.enableReranking}`);

      const startTime = Date.now();
      
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Perform vector similarity search
      let chunks;
      if (config.enableHybridSearch) {
        chunks = await this.hybridSearch(query, queryEmbedding, config);
      } else {
        chunks = await this.vectorSearch(queryEmbedding, config);
      }
      
      // Apply similarity threshold filtering
      chunks = chunks.filter(chunk => chunk.similarity_score >= config.similarityThreshold);
      
      if (chunks.length === 0) {
        logger.warn('⚠️ No chunks found above similarity threshold');
        return [];
      }
      
      logger.info(`📄 Found ${chunks.length} chunks above threshold`);
      
      // Apply reranking if enabled
      if (config.enableReranking && chunks.length > 1) {
        chunks = await this.rerankChunks(query, chunks, config);
      }
      
      // Apply diversity filtering
      if (config.diversityThreshold < 1.0) {
        chunks = this.applyDiversityFiltering(chunks, config.diversityThreshold);
      }
      
      // Limit to max retrieved chunks
      chunks = chunks.slice(0, config.maxRetrievedChunks);
      
      // Enhance chunks with additional metadata
      chunks = await this.enhanceChunksWithMetadata(chunks);
      
      const totalTime = Date.now() - startTime;
      logger.info(`✅ Retrieved ${chunks.length} chunks in ${totalTime}ms`);
      
      return chunks;
    } catch (error) {
      logger.error('❌ Chunk retrieval failed:', error);
      throw new Error(`Chunk retrieval failed: ${error.message}`);
    }
  }

  /**
   * Perform pure vector similarity search
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {Object} config - Search configuration
   * @returns {Array} Search results
   */
  async vectorSearch(queryEmbedding, config) {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
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
        c.character_count,
        c.word_count,
        c.quality_score,
        c.language,
        c.metadata,
        c.created_at,
        c.embedding,
        s.filename,
        s.title as source_title,
        s.author,
        -- Calculate similarity score based on metric
        CASE 
          WHEN $2 = 'cosine' THEN 1 - (embedding <=> $1::vector)
          WHEN $2 = 'l2' THEN 1 / (1 + (embedding <-> $1::vector))
          WHEN $2 = 'inner_product' THEN embedding <#> $1::vector
          ELSE 1 - (embedding <=> $1::vector)
        END as similarity_score
      FROM kb_chunks c
      JOIN kb_sources s ON c.source_id = s.source_id
      WHERE s.processing_status = 'completed'
      ORDER BY 
        CASE 
          WHEN $2 = 'cosine' THEN embedding <=> $1::vector
          WHEN $2 = 'l2' THEN embedding <-> $1::vector
          WHEN $2 = 'inner_product' THEN (embedding <#> $1::vector) * -1
          ELSE embedding <=> $1::vector
        END
      LIMIT $3
    `;
    
    const result = await this.db.query(query, [embeddingStr, config.similarityMetric, config.topK]);
    
    return result.rows.map(row => ({
      ...row,
      similarity_score: parseFloat(row.similarity_score),
      section_path: row.section_path || [],
      page_range: row.page_range || [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    }));
  }

  /**
   * Perform hybrid search combining vector and text search
   * @param {string} query - Original query text
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {Object} config - Search configuration
   * @returns {Array} Hybrid search results
   */
  async hybridSearch(query, queryEmbedding, config) {
    logger.info('🔄 Performing hybrid search (vector + text)');
    
    // Prepare query for full-text search
    const textQuery = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .join(' & ');
    
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const hybridQuery = `
      WITH vector_results AS (
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
          c.character_count,
          c.word_count,
          c.quality_score,
          c.language,
          c.metadata,
              c.created_at,
              c.embedding,
              s.filename,
          s.title as source_title,
          s.author,
          CASE 
            WHEN $2 = 'cosine' THEN 1 - (embedding <=> $1::vector)
            WHEN $2 = 'l2' THEN 1 / (1 + (embedding <-> $1::vector))
            WHEN $2 = 'inner_product' THEN embedding <#> $1::vector
            ELSE 1 - (embedding <=> $1::vector)
          END as vector_similarity,
          0.0 as text_similarity
        FROM kb_chunks c
        JOIN kb_sources s ON c.source_id = s.source_id
        WHERE s.processing_status = 'completed'
        ORDER BY 
          CASE 
            WHEN $2 = 'cosine' THEN embedding <=> $1::vector
            WHEN $2 = 'l2' THEN embedding <-> $1::vector
            WHEN $2 = 'inner_product' THEN (embedding <#> $1::vector) * -1
            ELSE embedding <=> $1::vector
          END
        LIMIT $3
      ),
      text_results AS (
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
          c.character_count,
          c.word_count,
          c.quality_score,
          c.language,
          c.metadata,
              c.created_at,
              c.embedding,
              s.filename,
          s.title as source_title,
          s.author,
          0.0 as vector_similarity,
          ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $4)) as text_similarity
        FROM kb_chunks c
        JOIN kb_sources s ON c.source_id = s.source_id
        WHERE s.processing_status = 'completed'
          AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $4)
        ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $4)) DESC
        LIMIT $3
      )
      SELECT DISTINCT
        COALESCE(v.id, t.id) as id,
        COALESCE(v.chunk_id, t.chunk_id) as chunk_id,
        COALESCE(v.source_id, t.source_id) as source_id,
        COALESCE(v.version, t.version) as version,
        COALESCE(v.chunk_index, t.chunk_index) as chunk_index,
        COALESCE(v.content, t.content) as content,
        COALESCE(v.heading, t.heading) as heading,
        COALESCE(v.subheading, t.subheading) as subheading,
        COALESCE(v.page_number, t.page_number) as page_number,
        COALESCE(v.page_range, t.page_range) as page_range,
        COALESCE(v.section_path, t.section_path) as section_path,
        COALESCE(v.content_type, t.content_type) as content_type,
        COALESCE(v.token_count, t.token_count) as token_count,
        COALESCE(v.character_count, t.character_count) as character_count,
        COALESCE(v.word_count, t.word_count) as word_count,
        COALESCE(v.quality_score, t.quality_score) as quality_score,
        COALESCE(v.language, t.language) as language,
        COALESCE(v.metadata, t.metadata) as metadata,
        COALESCE(v.created_at, t.created_at) as created_at,
        COALESCE(v.filename, t.filename) as filename,
        COALESCE(v.source_title, t.source_title) as source_title,
        COALESCE(v.author, t.author) as author,
        GREATEST(COALESCE(v.vector_similarity, 0), COALESCE(t.vector_similarity, 0)) as vector_similarity,
        GREATEST(COALESCE(v.text_similarity, 0), COALESCE(t.text_similarity, 0)) as text_similarity,
        -- Combined similarity score (weighted average)
        (0.7 * GREATEST(COALESCE(v.vector_similarity, 0), COALESCE(t.vector_similarity, 0)) + 
         0.3 * GREATEST(COALESCE(v.text_similarity, 0), COALESCE(t.text_similarity, 0))) as similarity_score
      FROM vector_results v
      FULL OUTER JOIN text_results t ON v.chunk_id = t.chunk_id
      ORDER BY similarity_score DESC
      LIMIT $3
    `;
    
    const result = await this.db.query(hybridQuery, [embeddingStr, config.similarityMetric, config.topK, query]);
    
    return result.rows.map(row => ({
      ...row,
      similarity_score: parseFloat(row.similarity_score),
      vector_similarity: parseFloat(row.vector_similarity),
      text_similarity: parseFloat(row.text_similarity),
      section_path: row.section_path || [],
      page_range: row.page_range || [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    }));
  }

  /**
   * Rerank chunks using multiple signals
   * @param {string} query - Original query
   * @param {Array} chunks - Initial chunks
   * @param {Object} config - Configuration
   * @returns {Array} Reranked chunks
   */
  async rerankChunks(query, chunks, config) {
    logger.info(`🔄 Reranking ${chunks.length} chunks`);
    
    const queryWords = new Set(
      query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );
    
    const rerankedChunks = chunks.map(chunk => {
      // Calculate text similarity (Jaccard similarity)
      const chunkWords = new Set(
        chunk.content.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2)
      );
      
      const intersection = new Set([...queryWords].filter(word => chunkWords.has(word)));
      const union = new Set([...queryWords, ...chunkWords]);
      const textSimilarity = union.size > 0 ? intersection.size / union.size : 0;
      
      // Calculate recency score (newer chunks get slight boost)
      const daysSinceCreation = (Date.now() - new Date(chunk.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (daysSinceCreation / 365)); // Decay over a year
      
      // Source reliability score (based on source metadata)
      const sourceReliability = chunk.source_title && chunk.source_title.toLowerCase().includes('guide') ? 1.0 : 0.8;
      
      // Calculate final reranking score
      const rerankScore = 
        this.rerankingWeights.vectorSimilarity * chunk.similarity_score +
        this.rerankingWeights.textSimilarity * textSimilarity +
        this.rerankingWeights.qualityScore * chunk.quality_score +
        this.rerankingWeights.recency * recencyScore +
        this.rerankingWeights.sourceReliability * sourceReliability;
      
      return {
        ...chunk,
        text_similarity: textSimilarity,
        recency_score: recencyScore,
        source_reliability: sourceReliability,
        rerank_score: rerankScore,
        original_rank: chunks.indexOf(chunk)
      };
    });
    
    // Sort by reranking score
    rerankedChunks.sort((a, b) => b.rerank_score - a.rerank_score);
    
    logger.info(`✅ Reranking completed, top chunk score: ${rerankedChunks[0]?.rerank_score.toFixed(3)}`);
    
    return rerankedChunks;
  }

  /**
   * Apply diversity filtering to avoid similar chunks
   * @param {Array} chunks - Input chunks
   * @param {number} diversityThreshold - Similarity threshold for diversity
   * @returns {Array} Filtered chunks
   */
  applyDiversityFiltering(chunks, diversityThreshold) {
    if (chunks.length <= 1) return chunks;
    
    logger.info(`🎯 Applying diversity filtering (threshold: ${diversityThreshold})`);
    
    const diverseChunks = [chunks[0]]; // Always include the top chunk
    
    for (let i = 1; i < chunks.length; i++) {
      const candidate = chunks[i];
      let isDiverse = true;
      
      // Check similarity with already selected chunks
      for (const selected of diverseChunks) {
        const similarity = this.calculateTextSimilarity(candidate.content, selected.content);
        if (similarity > diversityThreshold) {
          isDiverse = false;
          break;
        }
      }
      
      if (isDiverse) {
        diverseChunks.push(candidate);
      }
    }
    
    logger.info(`📊 Diversity filtering: ${chunks.length} → ${diverseChunks.length} chunks`);
    
    return diverseChunks;
  }

  /**
   * Calculate text similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(
      text1.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );
    
    const words2 = new Set(
      text2.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Enhance chunks with additional metadata
   * @param {Array} chunks - Input chunks
   * @returns {Array} Enhanced chunks
   */
  async enhanceChunksWithMetadata(chunks) {
    return chunks.map(chunk => ({
      ...chunk,
      // Add citation information
      citation: {
        source: chunk.source_title || chunk.filename,
        page: chunk.page_number,
        section: chunk.heading || chunk.subheading,
        chunk_id: chunk.chunk_id
      },
      
      // Add context information
      context: {
        section_path: chunk.section_path,
        content_type: chunk.content_type,
        token_count: chunk.token_count,
        quality_score: chunk.quality_score
      },
      
      // Add retrieval metadata
      retrieval_metadata: {
        similarity_score: chunk.similarity_score,
        vector_similarity: chunk.vector_similarity,
        text_similarity: chunk.text_similarity,
        rerank_score: chunk.rerank_score,
        original_rank: chunk.original_rank,
        retrieved_at: new Date().toISOString()
      }
    }));
  }

  /**
   * Search with filters
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @param {Object} options - Search options
   * @returns {Array} Filtered search results
   */
  async searchWithFilters(query, filters = {}, options = {}) {
    try {
      await this.initializeDatabase();
      
      logger.info(`🔍 Searching with filters:`, filters);
      
      const config = { ...this.defaultConfig, ...options };
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Build WHERE clause for filters
      const whereConditions = ['s.processing_status = \'completed\''];
      const queryParams = [`[${queryEmbedding.join(',')}]`, config.similarityMetric];
      let paramIndex = 3;
      
      if (filters.sourceIds && filters.sourceIds.length > 0) {
        whereConditions.push(`c.source_id = ANY($${paramIndex})`);
        queryParams.push(filters.sourceIds);
        paramIndex++;
      }
      
      if (filters.contentTypes && filters.contentTypes.length > 0) {
        whereConditions.push(`c.content_type = ANY($${paramIndex})`);
        queryParams.push(filters.contentTypes);
        paramIndex++;
      }
      
      if (filters.minQualityScore) {
        whereConditions.push(`c.quality_score >= $${paramIndex}`);
        queryParams.push(filters.minQualityScore);
        paramIndex++;
      }
      
      if (filters.pageNumbers && filters.pageNumbers.length > 0) {
        whereConditions.push(`c.page_number = ANY($${paramIndex})`);
        queryParams.push(filters.pageNumbers);
        paramIndex++;
      }
      
      if (filters.language) {
        whereConditions.push(`c.language = $${paramIndex}`);
        queryParams.push(filters.language);
        paramIndex++;
      }
      
      // Add topK parameter
      queryParams.push(config.topK);
      
      const filteredQuery = `
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
          c.character_count,
          c.word_count,
          c.quality_score,
          c.language,
          c.metadata,
              c.created_at,
              c.embedding,
              s.filename,
          s.title as source_title,
          s.author,
          CASE 
            WHEN $2 = 'cosine' THEN 1 - (embedding <=> $1::vector)
            WHEN $2 = 'l2' THEN 1 / (1 + (embedding <-> $1::vector))
            WHEN $2 = 'inner_product' THEN embedding <#> $1::vector
            ELSE 1 - (embedding <=> $1::vector)
          END as similarity_score
        FROM kb_chunks c
        JOIN kb_sources s ON c.source_id = s.source_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          CASE 
            WHEN $2 = 'cosine' THEN embedding <=> $1::vector
            WHEN $2 = 'l2' THEN embedding <-> $1::vector
            WHEN $2 = 'inner_product' THEN (embedding <#> $1::vector) * -1
            ELSE embedding <=> $1::vector
          END
        LIMIT $${paramIndex}
      `;
      
      const result = await this.db.query(filteredQuery, queryParams);
      
      let chunks = result.rows.map(row => ({
        ...row,
        similarity_score: parseFloat(row.similarity_score),
        section_path: row.section_path || [],
        page_range: row.page_range || [],
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }));
      
      // Apply similarity threshold
      chunks = chunks.filter(chunk => chunk.similarity_score >= config.similarityThreshold);
      
      // Apply reranking if enabled
      if (config.enableReranking && chunks.length > 1) {
        chunks = await this.rerankChunks(query, chunks, config);
      }
      
      // Limit results
      chunks = chunks.slice(0, config.maxRetrievedChunks);
      
      // Enhance with metadata
      chunks = await this.enhanceChunksWithMetadata(chunks);
      
      logger.info(`✅ Filtered search returned ${chunks.length} chunks`);
      
      return chunks;
    } catch (error) {
      logger.error('❌ Filtered search failed:', error);
      throw new Error(`Filtered search failed: ${error.message}`);
    }
  }

  /**
   * Get retrieval statistics
   * @returns {Object} Retrieval statistics
   */
  async getRetrievalStats() {
    try {
      await this.initializeDatabase();
      
      const stats = await this.db.query(`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(DISTINCT source_id) as total_sources,
          AVG(quality_score) as avg_quality,
          AVG(token_count) as avg_tokens,
          COUNT(*) FILTER (WHERE content_type = 'text') as text_chunks,
          COUNT(*) FILTER (WHERE content_type = 'table') as table_chunks,
          COUNT(*) FILTER (WHERE content_type = 'list') as list_chunks,
          COUNT(*) FILTER (WHERE content_type = 'procedure') as procedure_chunks
        FROM kb_chunks c
        JOIN kb_sources s ON c.source_id = s.source_id
        WHERE s.processing_status = 'completed'
      `);
      
      return {
        totalChunks: parseInt(stats.rows[0].total_chunks),
        totalSources: parseInt(stats.rows[0].total_sources),
        averageQuality: parseFloat(stats.rows[0].avg_quality) || 0,
        averageTokens: parseFloat(stats.rows[0].avg_tokens) || 0,
        contentTypeDistribution: {
          text: parseInt(stats.rows[0].text_chunks),
          table: parseInt(stats.rows[0].table_chunks),
          list: parseInt(stats.rows[0].list_chunks),
          procedure: parseInt(stats.rows[0].procedure_chunks)
        }
      };
    } catch (error) {
      logger.error('❌ Failed to get retrieval stats:', error);
      return null;
    }
  }

  /**
   * Test retrieval system
   * @param {string} testQuery - Test query
   * @returns {Object} Test results
   */
  async testRetrieval(testQuery = 'What are the steps for fund creation?') {
    try {
      logger.info(`🧪 Testing retrieval system with query: "${testQuery}"`);
      
      const startTime = Date.now();
      const chunks = await this.retrieveRelevantChunks(testQuery, {
        topK: 5,
        enableReranking: true,
        enableHybridSearch: true
      });
      const totalTime = Date.now() - startTime;
      
      const testResults = {
        success: true,
        query: testQuery,
        retrievalTime: totalTime,
        chunksRetrieved: chunks.length,
        averageSimilarity: chunks.length > 0 
          ? chunks.reduce((sum, chunk) => sum + chunk.similarity_score, 0) / chunks.length 
          : 0,
        topChunk: chunks.length > 0 ? {
          similarity: chunks[0].similarity_score,
          source: chunks[0].citation.source,
          page: chunks[0].citation.page,
          contentPreview: chunks[0].content.substring(0, 200) + '...'
        } : null,
        contentTypes: chunks.reduce((acc, chunk) => {
          acc[chunk.content_type] = (acc[chunk.content_type] || 0) + 1;
          return acc;
        }, {})
      };
      
      logger.info(`✅ Retrieval test completed: ${chunks.length} chunks in ${totalTime}ms`);
      
      return testResults;
    } catch (error) {
      logger.error('❌ Retrieval test failed:', error);
      return {
        success: false,
        error: error.message,
        query: testQuery
      };
    }
  }
}

module.exports = VectorRetriever;
