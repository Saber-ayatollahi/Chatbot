/**
 * Embedding Generator Module
 * Advanced OpenAI embeddings generation with batch processing and caching
 * Phase 1: Foundation & Infrastructure Setup
 */

const OpenAI = require('openai');
const crypto = require('crypto');
const { getConfig } = require('../../config/environment');
const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

class EmbeddingGenerator {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.openai = null;
    this.rateLimiter = new RateLimiter();
    this.cache = new Map();
    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client
   */
  initializeOpenAI() {
    try {
      // Check if API key is available and valid
      const apiKey = this.config.get('openai.apiKey');
      if (!apiKey || apiKey === 'placeholder' || apiKey.length < 10) {
        logger.warn('⚠️ OpenAI API key not configured - Embeddings will be disabled');
        this.openai = null;
        return;
      }
      
      this.openai = new OpenAI({
        apiKey: apiKey,
        organization: this.config.get('openai.organization'),
        project: this.config.get('openai.project'),
        timeout: this.config.get('openai.requestTimeout'),
        maxRetries: this.config.get('openai.maxRetries')
      });
      
      logger.info('✅ OpenAI client initialized for embeddings');
    } catch (error) {
      logger.error('❌ Failed to initialize OpenAI client:', error);
      logger.warn('⚠️ Continuing without OpenAI embeddings');
      this.openai = null;
    }
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
   * Generate embedding for a single chunk (wrapper for backward compatibility)
   * @param {string} text - Text to generate embedding for
   * @param {Object} options - Configuration options
   * @returns {Array} Embedding vector
   */
  async generateEmbedding(text, options = {}) {
    const chunks = [{ content: text, chunkIndex: 0 }];
    const results = await this.generateEmbeddings(chunks, options);
    return results[0]?.embedding || null;
  }

  /**
   * Generate embeddings for an array of text chunks
   * @param {Array} chunks - Array of chunk objects
   * @param {Object} options - Generation options
   * @returns {Array} Array of chunks with embeddings
   */
  async generateEmbeddings(chunks, options = {}) {
    try {
      await this.initializeDatabase();
      
      const config = {
        batchSize: options.batchSize || this.config.get('embedding.batchSize'),
        useCache: options.useCache !== false && this.config.get('embedding.enableCache'),
        model: options.model || this.config.get('openai.embeddingModel') || 'text-embedding-3-large',
        retryAttempts: options.retryAttempts || 3,
        retryDelay: options.retryDelay || 1000,
        validateDimensions: options.validateDimensions !== false
      };

      logger.info(`🔮 Generating embeddings for ${chunks.length} chunks using ${config.model}`);
      logger.info(`📊 Batch size: ${config.batchSize}, Cache enabled: ${config.useCache}`);

      const startTime = Date.now();
      let processedChunks = 0;
      let cacheHits = 0;
      let apiCalls = 0;
      let totalTokens = 0;

      // Process chunks in batches
      const results = [];
      for (let i = 0; i < chunks.length; i += config.batchSize) {
        const batch = chunks.slice(i, i + config.batchSize);
        
        logger.info(`🔄 Processing batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(chunks.length / config.batchSize)}`);
        
        const batchResults = await this.processBatch(batch, config);
        results.push(...batchResults);
        
        // Update statistics
        processedChunks += batch.length;
        cacheHits += batchResults.filter(r => r.fromCache).length;
        apiCalls += batchResults.filter(r => !r.fromCache).length > 0 ? 1 : 0;
        totalTokens += batchResults.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
        
        // Progress logging
        const progress = Math.round((processedChunks / chunks.length) * 100);
        logger.info(`📈 Progress: ${progress}% (${processedChunks}/${chunks.length})`);
        
        // Rate limiting delay between batches
        if (i + config.batchSize < chunks.length) {
          await this.rateLimiter.waitIfNeeded();
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Log final statistics
      logger.info('✅ Embedding generation completed');
      logger.info(`📊 Statistics:`);
      logger.info(`  - Total chunks: ${chunks.length}`);
      logger.info(`  - Processing time: ${processingTime}ms`);
      logger.info(`  - Cache hits: ${cacheHits}`);
      logger.info(`  - API calls: ${apiCalls}`);
      logger.info(`  - Total tokens: ${totalTokens}`);
      logger.info(`  - Average time per chunk: ${Math.round(processingTime / chunks.length)}ms`);

      // Validate results
      await this.validateEmbeddingResults(results, config);

      return results;
    } catch (error) {
      logger.error('❌ Embedding generation failed:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Process a batch of chunks
   * @param {Array} batch - Batch of chunks
   * @param {Object} config - Configuration
   * @returns {Array} Processed batch results
   */
  async processBatch(batch, config) {
    const results = [];
    const textsToEmbed = [];
    const chunkMap = new Map();

    // Check cache and prepare texts for embedding
    for (const chunk of batch) {
      const cacheKey = this.generateCacheKey(chunk.content, config.model);
      
      if (config.useCache) {
        // Check memory cache first
        const cachedEmbedding = this.cache.get(cacheKey);
        if (cachedEmbedding) {
          results.push({
            ...chunk,
            embedding: cachedEmbedding.embedding,
            embeddingModel: config.model,
            fromCache: true,
            cacheType: 'memory'
          });
          continue;
        }

        // Check database cache
        const dbCachedEmbedding = await this.getCachedEmbedding(cacheKey);
        if (dbCachedEmbedding) {
          // Store in memory cache for future use
          this.cache.set(cacheKey, dbCachedEmbedding);
          
          results.push({
            ...chunk,
            embedding: dbCachedEmbedding.embedding,
            embeddingModel: config.model,
            fromCache: true,
            cacheType: 'database'
          });
          continue;
        }
      }

      // Add to texts that need embedding
      textsToEmbed.push(chunk.content);
      chunkMap.set(chunk.content, chunk);
    }

    // Generate embeddings for uncached texts
    if (textsToEmbed.length > 0) {
      logger.info(`🔮 Generating embeddings for ${textsToEmbed.length} new texts`);
      
      const embeddings = await this.callOpenAIEmbeddings(textsToEmbed, config);
      
      // Process results and cache them
      for (let i = 0; i < textsToEmbed.length; i++) {
        const text = textsToEmbed[i];
        const chunk = chunkMap.get(text);
        const embedding = embeddings[i];
        
        const result = {
          ...chunk,
          embedding: embedding.embedding,
          embeddingModel: config.model,
          tokenCount: embedding.tokenCount,
          fromCache: false
        };
        
        results.push(result);
        
        // Cache the embedding
        if (config.useCache) {
          await this.cacheEmbedding(text, embedding.embedding, config.model);
        }
      }
    }

    return results;
  }

  /**
   * Call OpenAI embeddings API
   * @param {Array} texts - Array of texts to embed
   * @param {Object} config - Configuration
   * @returns {Array} Array of embedding objects
   */
  async callOpenAIEmbeddings(texts, config) {
    let attempt = 0;
    const maxAttempts = config.retryAttempts;

    while (attempt < maxAttempts) {
      try {
        logger.info(`🌐 Calling OpenAI API (attempt ${attempt + 1}/${maxAttempts})`);
        
        const startTime = Date.now();
        
        const response = await this.openai.embeddings.create({
          model: config.model,
          input: texts,
          encoding_format: 'float'
        });

        const apiTime = Date.now() - startTime;
        logger.info(`✅ OpenAI API call successful (${apiTime}ms)`);

        // Process response
        const embeddings = response.data.map((item, index) => ({
          embedding: item.embedding,
          tokenCount: this.estimateTokenCount(texts[index]),
          index: item.index
        }));

        // Update rate limiter
        this.rateLimiter.recordRequest(response.usage?.total_tokens || 0);

        return embeddings;
      } catch (error) {
        attempt++;
        logger.error(`❌ OpenAI API call failed (attempt ${attempt}/${maxAttempts}):`, error.message);

        if (attempt >= maxAttempts) {
          throw new Error(`OpenAI API failed after ${maxAttempts} attempts: ${error.message}`);
        }

        // Handle specific error types
        if (error.status === 429) {
          // Rate limit exceeded
          const delay = Math.min(config.retryDelay * Math.pow(2, attempt), 60000); // Exponential backoff, max 60s
          logger.warn(`⏳ Rate limit exceeded, waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (error.status >= 500) {
          // Server error
          const delay = config.retryDelay * attempt;
          logger.warn(`🔄 Server error, waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Client error - don't retry
          throw error;
        }
      }
    }
  }

  /**
   * Generate cache key for embedding
   * @param {string} text - Text content
   * @param {string} model - Model name
   * @returns {string} Cache key
   */
  generateCacheKey(text, model) {
    const content = `${model}:${text}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached embedding from database
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached embedding or null
   */
  async getCachedEmbedding(cacheKey) {
    try {
      const result = await this.db.query(`
        SELECT embedding, model, created_at
        FROM embedding_cache 
        WHERE cache_key = $1 
        AND created_at > NOW() - INTERVAL '${this.config.get('embedding.cacheTTL')} seconds'
      `, [cacheKey]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          embedding: Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding),
          model: row.model,
          cachedAt: row.created_at
        };
      }

      return null;
    } catch (error) {
      logger.warn('⚠️ Failed to get cached embedding:', error.message);
      return null;
    }
  }

  /**
   * Cache embedding in database and memory
   * @param {string} text - Original text
   * @param {Array} embedding - Embedding vector
   * @param {string} model - Model name
   */
  async cacheEmbedding(text, embedding, model) {
    try {
      const cacheKey = this.generateCacheKey(text, model);
      
      // Store in database
      await this.db.query(`
        INSERT INTO embedding_cache (cache_key, text_hash, embedding, model, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (cache_key) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          model = EXCLUDED.model,
          created_at = EXCLUDED.created_at
      `, [
        cacheKey,
        crypto.createHash('sha256').update(text).digest('hex'),
        JSON.stringify(embedding),
        model
      ]);

      // Store in memory cache
      this.cache.set(cacheKey, { embedding, model });

      // Limit memory cache size
      if (this.cache.size > 10000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to cache embedding:', error.message);
    }
  }

  /**
   * Estimate token count for text (fallback method)
   * @param {string} text - Text to count
   * @returns {number} Estimated token count
   */
  estimateTokenCount(text) {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate embedding results
   * @param {Array} results - Embedding results
   * @param {Object} config - Configuration
   */
  async validateEmbeddingResults(results, config) {
    logger.info('🔍 Validating embedding results...');
    
    const issues = [];
    const expectedDimension = this.config.get('vector.dimension');

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      // Check if embedding exists
      if (!result.embedding) {
        issues.push(`Chunk ${i}: Missing embedding`);
        continue;
      }

      // Check embedding dimension
      const embedding = Array.isArray(result.embedding) ? result.embedding : JSON.parse(result.embedding);
      if (config.validateDimensions && embedding.length !== expectedDimension) {
        issues.push(`Chunk ${i}: Invalid dimension ${embedding.length}, expected ${expectedDimension}`);
      }

      // Check for NaN or infinite values
      const hasInvalidValues = embedding.some(val => !isFinite(val));
      if (hasInvalidValues) {
        issues.push(`Chunk ${i}: Contains NaN or infinite values`);
      }

      // Check embedding magnitude (should be normalized for cosine similarity)
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (Math.abs(magnitude - 1.0) > 0.1) {
        logger.warn(`⚠️ Chunk ${i}: Embedding not normalized (magnitude: ${magnitude.toFixed(4)})`);
      }
    }

    if (issues.length > 0) {
      logger.error('❌ Embedding validation failed:');
      issues.forEach(issue => logger.error(`  - ${issue}`));
      throw new Error(`Embedding validation failed: ${issues.length} issues found`);
    }

    logger.info('✅ Embedding validation passed');
  }

  /**
   * Store embeddings in database
   * @param {Array} chunksWithEmbeddings - Chunks with embeddings
   * @returns {Array} Array of stored chunk IDs
   */
  async storeEmbeddings(chunksWithEmbeddings) {
    try {
      await this.initializeDatabase();
      
      logger.info(`💾 Storing ${chunksWithEmbeddings.length} embeddings in database...`);
      
      const storedIds = [];
      
      await this.db.transaction(async (client) => {
        for (const chunk of chunksWithEmbeddings) {
          const result = await client.query(`
            INSERT INTO kb_chunks (
              source_id, version, chunk_index, heading, subheading, page_number, page_range,
              section_path, content, content_type, embedding, token_count, character_count,
              word_count, language, quality_score, metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            ) RETURNING id, chunk_id
          `, [
            chunk.sourceId,
            chunk.version,
            chunk.chunkIndex,
            chunk.heading,
            chunk.subheading,
            chunk.pageNumbers?.[0] || null,
            chunk.pageRange,
            chunk.sectionPath,
            chunk.content,
            chunk.contentType,
            JSON.stringify(chunk.embedding),
            chunk.tokenCount,
            chunk.characterCount,
            chunk.wordCount,
            chunk.metadata?.language || 'en',
            chunk.qualityScore,
            JSON.stringify(chunk.metadata)
          ]);
          
          storedIds.push({
            id: result.rows[0].id,
            chunkId: result.rows[0].chunk_id,
            chunkIndex: chunk.chunkIndex
          });
        }
      });
      
      logger.info(`✅ Successfully stored ${storedIds.length} embeddings`);
      return storedIds;
    } catch (error) {
      logger.error('❌ Failed to store embeddings:', error);
      throw new Error(`Embedding storage failed: ${error.message}`);
    }
  }

  /**
   * Update source statistics after embedding generation
   * @param {string} sourceId - Source ID
   * @param {number} totalChunks - Total number of chunks
   */
  async updateSourceStats(sourceId, totalChunks) {
    try {
      await this.initializeDatabase();
      
      await this.db.query(`
        UPDATE kb_sources 
        SET 
          total_chunks = $2,
          processing_status = 'completed',
          processed_at = NOW()
        WHERE source_id = $1
      `, [sourceId, totalChunks]);
      
      logger.info(`📊 Updated source stats for ${sourceId}: ${totalChunks} chunks`);
    } catch (error) {
      logger.warn('⚠️ Failed to update source stats:', error.message);
    }
  }

  /**
   * Get embedding generation statistics
   * @returns {Object} Statistics object
   */
  async getEmbeddingStats() {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(DISTINCT source_id) as total_sources,
          AVG(token_count) as avg_tokens,
          AVG(quality_score) as avg_quality,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_chunks
        FROM kb_chunks
      `);
      
      const cacheResult = await this.db.query(`
        SELECT 
          COUNT(*) as cached_embeddings,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_cache
        FROM embedding_cache
      `);
      
      return {
        totalChunks: parseInt(result.rows[0].total_chunks),
        totalSources: parseInt(result.rows[0].total_sources),
        averageTokens: parseFloat(result.rows[0].avg_tokens) || 0,
        averageQuality: parseFloat(result.rows[0].avg_quality) || 0,
        recentChunks: parseInt(result.rows[0].recent_chunks),
        cachedEmbeddings: parseInt(cacheResult.rows[0].cached_embeddings),
        recentCacheEntries: parseInt(cacheResult.rows[0].recent_cache),
        memoryCacheSize: this.cache.size
      };
    } catch (error) {
      logger.error('❌ Failed to get embedding stats:', error);
      return null;
    }
  }

  /**
   * Clean up old cache entries
   * @param {number} maxAge - Maximum age in seconds
   */
  async cleanupCache(maxAge = null) {
    try {
      maxAge = maxAge || this.config.get('embedding.cacheTTL');
      
      const result = await this.db.query(`
        DELETE FROM embedding_cache 
        WHERE created_at < NOW() - INTERVAL '${maxAge} seconds'
      `);
      
      logger.info(`🧹 Cleaned up ${result.rowCount} old cache entries`);
      
      // Clear memory cache
      this.cache.clear();
      
      return result.rowCount;
    } catch (error) {
      logger.error('❌ Cache cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Test embedding generation with a sample text
   * @param {string} sampleText - Sample text to test
   * @returns {Object} Test result
   */
  async testEmbeddingGeneration(sampleText = 'This is a test for embedding generation.') {
    try {
      logger.info('🧪 Testing embedding generation...');
      
      const startTime = Date.now();
      
      const response = await this.openai.embeddings.create({
        model: this.config.get('openai.embeddingModel') || 'text-embedding-3-large',
        input: [sampleText],
        encoding_format: 'float'
      });
      
      const endTime = Date.now();
      const embedding = response.data[0].embedding;
      
      const result = {
        success: true,
        responseTime: endTime - startTime,
        embeddingDimension: embedding.length,
        expectedDimension: this.config.get('vector.dimension'),
        model: this.config.get('openai.embeddingModel') || 'text-embedding-3-large',
        tokensUsed: response.usage?.total_tokens || 0,
        sampleMagnitude: Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      };
      
      logger.info('✅ Embedding generation test passed');
      logger.info(`📊 Test results: ${result.responseTime}ms, ${result.embeddingDimension}D, ${result.tokensUsed} tokens`);
      
      return result;
    } catch (error) {
      logger.error('❌ Embedding generation test failed:', error);
      return {
        success: false,
        error: error.message,
        model: this.config.get('openai.embeddingModel')
      };
    }
  }
}

/**
 * Rate Limiter for OpenAI API calls
 */
class RateLimiter {
  constructor() {
    this.requests = [];
    this.tokens = [];
    this.maxRequestsPerMinute = 60; // Conservative limit
    this.maxTokensPerMinute = 150000; // Conservative limit
  }

  /**
   * Record a request for rate limiting
   * @param {number} tokenCount - Number of tokens used
   */
  recordRequest(tokenCount = 0) {
    const now = Date.now();
    this.requests.push(now);
    this.tokens.push({ timestamp: now, count: tokenCount });
    
    // Clean old entries (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    this.tokens = this.tokens.filter(entry => entry.timestamp > oneMinuteAgo);
  }

  /**
   * Check if we need to wait before making another request
   * @returns {number} Milliseconds to wait, or 0 if no wait needed
   */
  getWaitTime() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Count recent requests and tokens
    const recentRequests = this.requests.filter(time => time > oneMinuteAgo).length;
    const recentTokens = this.tokens
      .filter(entry => entry.timestamp > oneMinuteAgo)
      .reduce((sum, entry) => sum + entry.count, 0);
    
    // Check request limit
    if (recentRequests >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      return Math.max(0, oldestRequest + 60000 - now);
    }
    
    // Check token limit
    if (recentTokens >= this.maxTokensPerMinute) {
      const oldestToken = Math.min(...this.tokens.map(entry => entry.timestamp));
      return Math.max(0, oldestToken + 60000 - now);
    }
    
    return 0;
  }

  /**
   * Wait if needed to respect rate limits
   */
  async waitIfNeeded() {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      logger.info(`⏳ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

module.exports = EmbeddingGenerator;
