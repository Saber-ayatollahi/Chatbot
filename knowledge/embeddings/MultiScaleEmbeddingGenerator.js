/**
 * Multi-Scale Embedding Generator
 * Advanced embedding generation with contextual enrichment
 * Part of Advanced Document Processing Implementation
 */

const OpenAI = require('openai');
const { getConfig } = require('../../config/environment');

class MultiScaleEmbeddingGenerator {
  constructor(options = {}) {
    this.config = getConfig();
    
    // Initialize OpenAI client with graceful handling for missing API key
    const apiKey = this.config.get('openai.apiKey');
    if (apiKey && apiKey !== 'placeholder' && apiKey.length > 10) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('⚠️ OpenAI API key not configured - Multi-scale embeddings will be disabled');
      this.openai = null;
    }

    this.options = {
      embeddingTypes: ['content', 'contextual', 'hierarchical', 'semantic'],
      domainOptimization: {
        enabled: true,
        domain: 'fundManagement',
        keywordBoost: 1.2
      },
      qualityValidation: {
        enabled: true,
        minQualityScore: 0.6
      },
      embeddingCache: {
        enabled: true,
        maxSize: 1000
      },
      ...options
    };

    this.cache = new Map();
    this.domainKeywords = [
      'fund', 'investment', 'portfolio', 'asset', 'management', 'return',
      'risk', 'allocation', 'diversification', 'performance', 'benchmark',
      'equity', 'bond', 'derivative', 'hedge', 'mutual', 'etf', 'reit'
    ];
  }

  /**
   * Generate multi-scale embeddings for a chunk
   */
  async generateMultiScaleEmbeddings(chunk, options = {}) {
    const config = { ...this.options, ...options };
    
    console.log(`🎯 Generating multi-scale embeddings for chunk: ${chunk.id}`);
    const startTime = Date.now();

    try {
      const embeddings = {};
      
      // Generate embeddings for each requested type
      for (const embeddingType of config.embeddingTypes) {
        const embedding = await this.generateEmbeddingByType(chunk, embeddingType, config);
        if (embedding) {
          embeddings[embeddingType] = embedding;
        }
      }

      // Apply domain optimization if enabled
      if (config.domainOptimization.enabled) {
        await this.applyDomainOptimization(embeddings, chunk, config);
      }

      // Validate embedding quality
      if (config.qualityValidation.enabled) {
        const qualityScore = this.validateEmbeddingQuality(embeddings, chunk);
        if (qualityScore < config.qualityValidation.minQualityScore) {
          console.warn(`⚠️ Low quality embeddings for chunk ${chunk.id}: ${qualityScore}`);
        }
        embeddings.qualityScore = qualityScore;
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Multi-scale embeddings generated in ${processingTime}ms`);

      return {
        embeddings,
        metadata: {
          processingTime,
          embeddingTypes: Object.keys(embeddings),
          qualityScore: embeddings.qualityScore || 0.8
        }
      };

    } catch (error) {
      console.error(`❌ Failed to generate embeddings for chunk ${chunk.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate embedding by specific type
   */
  async generateEmbeddingByType(chunk, embeddingType, config) {
    console.log(`🔄 Generating ${embeddingType} embedding...`);

    // Check if OpenAI is available
    if (!this.openai) {
      console.warn(`⚠️ OpenAI not available - skipping ${embeddingType} embedding`);
      return null;
    }

    let textToEmbed = '';
    
    switch (embeddingType) {
      case 'content':
        textToEmbed = this.prepareContentText(chunk);
        break;
      case 'contextual':
        textToEmbed = this.prepareContextualText(chunk);
        break;
      case 'hierarchical':
        textToEmbed = this.prepareHierarchicalText(chunk);
        break;
      case 'semantic':
        textToEmbed = this.prepareSemanticText(chunk, config);
        break;
      default:
        console.warn(`⚠️ Unknown embedding type: ${embeddingType}`);
        return null;
    }

    if (!textToEmbed || textToEmbed.trim().length === 0) {
      console.warn(`⚠️ Empty text for ${embeddingType} embedding`);
      return null;
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(textToEmbed, embeddingType);
    if (config.embeddingCache.enabled && this.cache.has(cacheKey)) {
      console.log(`📋 Using cached ${embeddingType} embedding`);
      return this.cache.get(cacheKey);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.get('openai.embeddingModel'),
        input: textToEmbed
      });

      const embedding = response.data[0].embedding;
      
      // Cache the result
      if (config.embeddingCache.enabled) {
        this.cache.set(cacheKey, embedding);
        
        // Manage cache size
        if (this.cache.size > config.embeddingCache.maxSize) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }

      console.log(`✅ Generated ${embeddingType} embedding (${embedding.length} dimensions)`);
      return embedding;

    } catch (error) {
      console.error(`❌ Failed to generate ${embeddingType} embedding:`, error);
      return null;
    }
  }

  /**
   * Prepare content text for embedding
   */
  prepareContentText(chunk) {
    return chunk.content;
  }

  /**
   * Prepare contextual text (chunk + surrounding context)
   */
  prepareContextualText(chunk) {
    let contextualText = chunk.content;
    
    // Add heading context
    if (chunk.heading) {
      contextualText = `${chunk.heading}\n\n${contextualText}`;
    }

    // Add hierarchical context
    if (chunk.hierarchyPath && chunk.hierarchyPath.length > 1) {
      const pathContext = chunk.hierarchyPath.slice(0, -1).join(' > ');
      contextualText = `Context: ${pathContext}\n\n${contextualText}`;
    }

    // Add parent context if available
    if (chunk.parentContext) {
      contextualText = `${chunk.parentContext}\n\n${contextualText}`;
    }

    return contextualText;
  }

  /**
   * Prepare hierarchical text (title + structure information)
   */
  prepareHierarchicalText(chunk) {
    let hierarchicalText = '';
    
    // Add document structure information
    if (chunk.hierarchyPath) {
      hierarchicalText += `Document Structure: ${chunk.hierarchyPath.join(' > ')}\n\n`;
    }

    // Add scale information
    if (chunk.scale) {
      hierarchicalText += `Content Level: ${chunk.scale}\n\n`;
    }

    // Add heading
    if (chunk.heading) {
      hierarchicalText += `Section: ${chunk.heading}\n\n`;
    }

    // Add content
    hierarchicalText += chunk.content;

    // Add metadata context
    if (chunk.metadata) {
      const metadataText = Object.entries(chunk.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      hierarchicalText += `\n\nMetadata: ${metadataText}`;
    }

    return hierarchicalText;
  }

  /**
   * Prepare semantic text (keywords + domain concepts)
   */
  prepareSemanticText(chunk, config) {
    let semanticText = chunk.content;
    
    // Extract and emphasize domain keywords
    if (config.domainOptimization.enabled) {
      const foundKeywords = this.extractDomainKeywords(chunk.content);
      if (foundKeywords.length > 0) {
        semanticText = `Key Concepts: ${foundKeywords.join(', ')}\n\n${semanticText}`;
      }
    }

    // Add semantic annotations
    const semanticAnnotations = this.generateSemanticAnnotations(chunk);
    if (semanticAnnotations.length > 0) {
      semanticText += `\n\nSemantic Context: ${semanticAnnotations.join(', ')}`;
    }

    return semanticText;
  }

  /**
   * Extract domain-specific keywords
   */
  extractDomainKeywords(text) {
    const lowerText = text.toLowerCase();
    return this.domainKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Generate semantic annotations
   */
  generateSemanticAnnotations(chunk) {
    const annotations = [];
    
    // Content type annotation
    if (chunk.metadata && chunk.metadata.type) {
      annotations.push(`content_type:${chunk.metadata.type}`);
    }

    // Scale annotation
    if (chunk.scale) {
      annotations.push(`scale:${chunk.scale}`);
    }

    // Length annotation
    if (chunk.tokenCount) {
      if (chunk.tokenCount < 100) annotations.push('length:short');
      else if (chunk.tokenCount < 500) annotations.push('length:medium');
      else annotations.push('length:long');
    }

    // Structure annotation
    if (chunk.hierarchyPath && chunk.hierarchyPath.length > 2) {
      annotations.push('structure:nested');
    } else if (chunk.hierarchyPath && chunk.hierarchyPath.length > 1) {
      annotations.push('structure:sectioned');
    } else {
      annotations.push('structure:flat');
    }

    return annotations;
  }

  /**
   * Apply domain-specific optimization
   */
  async applyDomainOptimization(embeddings, chunk, config) {
    if (!config.domainOptimization.enabled) return;

    console.log('🎯 Applying advanced domain optimization...');
    
    const domainAnalysis = this.analyzeDomainContent(chunk.content, config.domainOptimization.domain);
    
    // Apply sophisticated domain optimization to each embedding type
    for (const [type, embedding] of Object.entries(embeddings)) {
      if (embedding && Array.isArray(embedding)) {
        this.applyDomainSpecificTransformation(embedding, domainAnalysis, type, config);
      }
    }

    console.log(`✅ Advanced domain optimization applied (relevance: ${domainAnalysis.relevanceScore.toFixed(3)})`);
  }

  /**
   * Analyze content for domain-specific characteristics
   */
  analyzeDomainContent(content, domain) {
    const analysis = {
      domainKeywords: [],
      conceptDensity: 0,
      technicalComplexity: 0,
      relevanceScore: 0,
      contentType: 'general'
    };

    // Domain-specific keyword sets
    const domainKeywordSets = {
      fundManagement: {
        core: ['fund', 'nav', 'portfolio', 'investment', 'asset', 'management'],
        technical: ['valuation', 'allocation', 'diversification', 'benchmark', 'performance'],
        regulatory: ['compliance', 'audit', 'regulation', 'sec', 'reporting'],
        financial: ['return', 'risk', 'yield', 'expense', 'fee', 'capital']
      }
    };

    const keywords = domainKeywordSets[domain] || domainKeywordSets.fundManagement;
    const lowerContent = content.toLowerCase();

    // Extract found keywords by category
    const foundKeywords = {
      core: keywords.core.filter(kw => lowerContent.includes(kw)),
      technical: keywords.technical.filter(kw => lowerContent.includes(kw)),
      regulatory: keywords.regulatory.filter(kw => lowerContent.includes(kw)),
      financial: keywords.financial.filter(kw => lowerContent.includes(kw))
    };

    analysis.domainKeywords = [
      ...foundKeywords.core,
      ...foundKeywords.technical,
      ...foundKeywords.regulatory,
      ...foundKeywords.financial
    ];

    // Calculate concept density (keywords per 100 words)
    const wordCount = content.split(/\s+/).length;
    analysis.conceptDensity = (analysis.domainKeywords.length / wordCount) * 100;

    // Calculate technical complexity based on keyword categories
    analysis.technicalComplexity = 
      (foundKeywords.technical.length * 0.4) +
      (foundKeywords.regulatory.length * 0.3) +
      (foundKeywords.financial.length * 0.2) +
      (foundKeywords.core.length * 0.1);

    // Determine content type
    if (foundKeywords.regulatory.length > 2) {
      analysis.contentType = 'regulatory';
    } else if (foundKeywords.technical.length > 3) {
      analysis.contentType = 'technical';
    } else if (foundKeywords.financial.length > 2) {
      analysis.contentType = 'financial';
    } else if (foundKeywords.core.length > 1) {
      analysis.contentType = 'core';
    }

    // Calculate overall relevance score
    analysis.relevanceScore = Math.min(1.0, 
      (analysis.domainKeywords.length * 0.1) + 
      (analysis.conceptDensity * 0.01) + 
      (analysis.technicalComplexity * 0.05)
    );

    return analysis;
  }

  /**
   * Apply domain-specific transformation to embedding
   */
  applyDomainSpecificTransformation(embedding, domainAnalysis, embeddingType, config) {
    const baseBoost = config.domainOptimization.keywordBoost;
    const relevanceMultiplier = 1 + (domainAnalysis.relevanceScore * 0.5);
    
    // Different transformation strategies based on embedding type and content type
    const transformationStrategy = this.getDomainTransformationStrategy(
      embeddingType, 
      domainAnalysis.contentType,
      domainAnalysis.relevanceScore
    );

    // Apply transformation based on strategy
    switch (transformationStrategy.method) {
      case 'selective_boost':
        this.applySelectiveBoost(embedding, transformationStrategy, relevanceMultiplier);
        break;
      case 'weighted_enhancement':
        this.applyWeightedEnhancement(embedding, transformationStrategy, domainAnalysis);
        break;
      case 'dimensional_focus':
        this.applyDimensionalFocus(embedding, transformationStrategy, domainAnalysis);
        break;
      default:
        this.applyBasicBoost(embedding, baseBoost * relevanceMultiplier);
    }
  }

  /**
   * Get domain transformation strategy based on content characteristics
   */
  getDomainTransformationStrategy(embeddingType, contentType, relevanceScore) {
    const strategies = {
      content: {
        regulatory: { method: 'selective_boost', dimensions: [0, 100, 200, 300], intensity: 1.3 },
        technical: { method: 'weighted_enhancement', focus: 'technical', intensity: 1.2 },
        financial: { method: 'dimensional_focus', dimensions: [400, 500, 600], intensity: 1.25 },
        core: { method: 'selective_boost', dimensions: [0, 50, 150, 250], intensity: 1.15 },
        general: { method: 'basic_boost', intensity: 1.1 }
      },
      contextual: {
        regulatory: { method: 'weighted_enhancement', focus: 'context', intensity: 1.2 },
        technical: { method: 'dimensional_focus', dimensions: [100, 300, 500], intensity: 1.2 },
        financial: { method: 'selective_boost', dimensions: [200, 400, 600], intensity: 1.2 },
        core: { method: 'weighted_enhancement', focus: 'general', intensity: 1.1 },
        general: { method: 'basic_boost', intensity: 1.05 }
      },
      hierarchical: {
        regulatory: { method: 'dimensional_focus', dimensions: [0, 200, 400], intensity: 1.15 },
        technical: { method: 'selective_boost', dimensions: [100, 200, 300], intensity: 1.15 },
        financial: { method: 'weighted_enhancement', focus: 'structure', intensity: 1.1 },
        core: { method: 'basic_boost', intensity: 1.1 },
        general: { method: 'basic_boost', intensity: 1.0 }
      },
      semantic: {
        regulatory: { method: 'weighted_enhancement', focus: 'semantic', intensity: 1.25 },
        technical: { method: 'weighted_enhancement', focus: 'semantic', intensity: 1.2 },
        financial: { method: 'selective_boost', dimensions: [300, 400, 500], intensity: 1.2 },
        core: { method: 'dimensional_focus', dimensions: [0, 100, 200], intensity: 1.15 },
        general: { method: 'basic_boost', intensity: 1.05 }
      }
    };

    return strategies[embeddingType]?.[contentType] || { method: 'basic_boost', intensity: 1.0 };
  }

  /**
   * Apply selective boost to specific dimensions
   */
  applySelectiveBoost(embedding, strategy, relevanceMultiplier) {
    const boostFactor = strategy.intensity * relevanceMultiplier;
    const dimensions = strategy.dimensions || [0, 100, 200, 300, 400];
    
    for (const dim of dimensions) {
      if (dim < embedding.length) {
        embedding[dim] *= boostFactor;
        
        // Apply gradual boost to neighboring dimensions
        for (let i = 1; i <= 5 && dim + i < embedding.length; i++) {
          const neighborBoost = boostFactor * (1 - i * 0.1);
          embedding[dim + i] *= neighborBoost;
        }
      }
    }
  }

  /**
   * Apply weighted enhancement based on content analysis
   */
  applyWeightedEnhancement(embedding, strategy, domainAnalysis) {
    const baseIntensity = strategy.intensity;
    const complexityBoost = 1 + (domainAnalysis.technicalComplexity * 0.1);
    const densityBoost = 1 + (domainAnalysis.conceptDensity * 0.01);
    
    const finalIntensity = baseIntensity * complexityBoost * densityBoost;
    
    // Apply enhancement in waves across the embedding
    const waveSize = Math.floor(embedding.length / 10);
    for (let wave = 0; wave < 10; wave++) {
      const start = wave * waveSize;
      const end = Math.min(start + waveSize, embedding.length);
      const waveIntensity = finalIntensity * (1 + Math.sin(wave) * 0.1);
      
      for (let i = start; i < end; i++) {
        embedding[i] *= waveIntensity;
      }
    }
  }

  /**
   * Apply dimensional focus enhancement
   */
  applyDimensionalFocus(embedding, strategy, domainAnalysis) {
    const focusDimensions = strategy.dimensions || [0, 200, 400, 600, 800];
    const intensity = strategy.intensity * (1 + domainAnalysis.relevanceScore);
    
    // Create focused enhancement regions
    for (const centerDim of focusDimensions) {
      if (centerDim < embedding.length) {
        const focusRadius = 25; // Focus on 50 dimensions around center
        
        for (let i = Math.max(0, centerDim - focusRadius); 
             i < Math.min(embedding.length, centerDim + focusRadius); i++) {
          const distance = Math.abs(i - centerDim);
          const focusStrength = intensity * Math.exp(-distance / 10); // Gaussian-like focus
          embedding[i] *= focusStrength;
        }
      }
    }
  }

  /**
   * Apply basic boost (fallback method)
   */
  applyBasicBoost(embedding, boostFactor) {
    const limitedBoost = Math.min(boostFactor, 1.5);
    for (let i = 0; i < Math.min(100, embedding.length); i++) {
      embedding[i] *= limitedBoost;
    }
  }

  /**
   * Validate embedding quality
   */
  validateEmbeddingQuality(embeddings, chunk) {
    let qualityScore = 0.5; // Base score
    
    // Check if all requested embedding types were generated
    const expectedTypes = this.options.embeddingTypes.length;
    const actualTypes = Object.keys(embeddings).filter(key => key !== 'qualityScore').length;
    qualityScore += (actualTypes / expectedTypes) * 0.3;

    // Check embedding dimensions
    for (const [type, embedding] of Object.entries(embeddings)) {
      if (embedding && Array.isArray(embedding) && embedding.length > 1000) {
        qualityScore += 0.05;
      }
    }

    // Check content quality
    if (chunk.content && chunk.content.length > 50) {
      qualityScore += 0.1;
    }

    // Check structure quality
    if (chunk.hierarchyPath && chunk.hierarchyPath.length > 1) {
      qualityScore += 0.05;
    }

    return Math.min(qualityScore, 1.0);
  }

  /**
   * Generate cache key for embedding
   */
  generateCacheKey(text, embeddingType) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256')
      .update(text + embeddingType)
      .digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Get embedding generation statistics
   */
  getEmbeddingStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.options.embeddingCache.maxSize,
      supportedTypes: this.options.embeddingTypes,
      domainKeywords: this.domainKeywords.length,
      domainOptimization: this.options.domainOptimization.enabled
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Embedding cache cleared');
  }

  /**
   * Batch generate embeddings for multiple chunks
   */
  async generateBatchEmbeddings(chunks, options = {}) {
    console.log(`🔄 Generating batch embeddings for ${chunks.length} chunks...`);
    const startTime = Date.now();

    const results = [];
    const batchSize = options.batchSize || 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchPromises = batch.map(chunk => 
        this.generateMultiScaleEmbeddings(chunk, options)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Batch processing failed for batch starting at ${i}:`, error);
        // Continue with next batch
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Batch embedding generation completed in ${processingTime}ms`);

    return {
      results,
      metadata: {
        totalChunks: chunks.length,
        successfulChunks: results.length,
        processingTime,
        averageTimePerChunk: processingTime / chunks.length
      }
    };
  }
}

module.exports = MultiScaleEmbeddingGenerator;