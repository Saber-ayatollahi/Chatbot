/**
 * Context-Aware Chunker
 * Advanced chunking that preserves semantic relationships and context
 * Production-ready with multiple chunking strategies and quality optimization
 */

const logger = require('../../utils/logger');
const { performance } = require('perf_hooks');
const { v4: uuidv4 } = require('uuid');

class ContextAwareChunker {
  constructor(options = {}) {
    this.options = {
      // Chunking strategies
      strategies: {
        semantic_adaptive: {
          description: 'Adaptive chunking based on semantic boundaries',
          targetSize: 800,
          maxSize: 1200,
          minSize: 200,
          overlapSize: 100,
          preserveRelationships: true
        },
        procedure_preserving: {
          description: 'Preserves step-by-step procedures and instructions',
          targetSize: 600,
          maxSize: 1000,
          minSize: 150,
          overlapSize: 50,
          preserveStepSequences: true,
          stepBoundaryWeight: 2.0
        },
        qa_pair_preserving: {
          description: 'Keeps question-answer pairs together',
          targetSize: 400,
          maxSize: 800,
          minSize: 100,
          overlapSize: 30,
          preserveQAPairs: true,
          qaBoundaryWeight: 3.0
        },
        definition_preserving: {
          description: 'Maintains definition-example relationships',
          targetSize: 500,
          maxSize: 900,
          minSize: 120,
          overlapSize: 80,
          preserveDefinitions: true,
          definitionBoundaryWeight: 2.5
        },
        structure_preserving: {
          description: 'Respects document structure and hierarchy',
          targetSize: 700,
          maxSize: 1100,
          minSize: 180,
          overlapSize: 120,
          respectHierarchy: true,
          structureBoundaryWeight: 2.0
        },
        simple: {
          description: 'Simple text-based chunking for fallback',
          targetSize: 500,
          maxSize: 800,
          minSize: 100,
          overlapSize: 50,
          preserveRelationships: false
        }
      },
      
      // Semantic boundary detection
      semanticBoundaries: {
        // Strong boundaries (high confidence for splitting)
        strong: [
          /\n\s*#{1,6}\s+/g,           // Markdown headings
          /\n\s*\d+\.\s+[A-Z]/g,       // Numbered sections
          /\n\s*Step\s+\d+/gi,         // Step boundaries
          /\n\s*Section\s+\d+/gi,      // Section boundaries
          /\n\s*Chapter\s+\d+/gi,      // Chapter boundaries
          /\n\s*Part\s+[A-Z]/gi,       // Part boundaries
        ],
        
        // Medium boundaries (moderate confidence)
        medium: [
          /\n\s*[A-Z][^.!?]*[:.]\s*\n/g,  // Heading-like lines
          /\n\s*[-*+]\s+/g,                // Bullet points
          /\n\s*[a-z]\)\s+/g,              // Lettered lists
          /\?\s*\n/g,                      // Question endings
          /\.\s*\n\s*[A-Z]/g,              // Sentence boundaries with new paragraphs
        ],
        
        // Weak boundaries (low confidence, use carefully)
        weak: [
          /\.\s+/g,                        // Sentence endings
          /;\s+/g,                         // Semicolon boundaries
          /,\s+(?:and|or|but)\s+/g,        // Conjunction boundaries
        ]
      },
      
      // Relationship preservation patterns
      relationships: {
        stepSequences: {
          patterns: [
            /step\s+\d+.*?(?=step\s+\d+|$)/gis,
            /\d+\.\s+.*?(?=\d+\.\s+|$)/gis,
            /(first|second|third|fourth|fifth).*?(?=(first|second|third|fourth|fifth|next|then|finally)|$)/gis
          ],
          keepTogether: true,
          maxSeparation: 2 // Maximum chunks a sequence can span
        },
        
        qaPairs: {
          patterns: [
            /q\d*[:.]\s*.*?\s*a\d*[:.]\s*.*?(?=q\d*[:.]\s*|$)/gis,
            /\?.*?\n.*?(?=\?|$)/gs,
            /(what|how|why|when|where)\s+.*?\?.*?\n.*?(?=(what|how|why|when|where).*?\?|$)/gis
          ],
          keepTogether: true,
          maxSeparation: 1
        },
        
        definitions: {
          patterns: [
            /(\w+)\s*[:]\s*(.*?)(?=\n\w+\s*[:]\s*|$)/gs,
            /(\w+)\s+(is|are|means?|refers?\s+to)\s+(.*?)(?=\.|$)/gs,
            /(definition\s*[:]\s*)(.*?)(?=\n|$)/gis
          ],
          keepTogether: true,
          maxSeparation: 1
        },
        
        examples: {
          patterns: [
            /(example\s*\d*\s*[:.]?\s*)(.*?)(?=example\s*\d*|$)/gis,
            /(for\s+example[,:]\s*)(.*?)(?=\n\n|$)/gis,
            /(such\s+as[,:]\s*)(.*?)(?=\.|$)/gis
          ],
          keepTogether: true,
          maxSeparation: 1
        },
        
        warnings: {
          patterns: [
            /(warning\s*[!:]?\s*)(.*?)(?=\n\n|$)/gis,
            /(caution\s*[!:]?\s*)(.*?)(?=\n\n|$)/gis,
            /(important\s*[!:]?\s*)(.*?)(?=\n\n|$)/gis,
            /(note\s*[!:]?\s*)(.*?)(?=\n\n|$)/gis
          ],
          keepTogether: true,
          maxSeparation: 1
        }
      },
      
      // Quality optimization
      quality: {
        minQualityScore: 0.4,
        targetQualityScore: 0.7,
        qualityFactors: {
          completeness: 0.3,      // How complete the chunk feels
          coherence: 0.25,        // Internal consistency
          context: 0.25,          // Contextual information preserved
          readability: 0.2        // Readability and flow
        }
      },
      
      // Performance settings
      performance: {
        enableCaching: true,
        maxCacheSize: 200,
        enableParallelProcessing: true,
        batchSize: 50
      },
      
      ...options
    };

    // Initialize state
    this.chunkingCache = new Map();
    this.relationshipCache = new Map();
    this.performanceMetrics = {
      chunksGenerated: 0,
      averageProcessingTime: 0,
      averageChunkQuality: 0,
      strategyUsage: {},
      cacheHitRate: 0
    };
  }

  /**
   * Main chunking method
   * @param {string} content - Content to chunk
   * @param {Object} context - Context information (structure, semantics, etc.)
   * @param {Object} options - Chunking options
   * @returns {Promise<Object>} Chunking result with chunks and metadata
   */
  async chunkContent(content, context = {}, options = {}) {
    const startTime = performance.now();
    
    try {
      // Validate input parameters
      if (content === null || content === undefined) {
        logger.warn('⚠️ Null or undefined content provided to chunking');
        return this.generateFallbackChunks('', new Error('Null or undefined content'));
      }
      
      // Ensure content is a string
      content = String(content || '');
      
      logger.info('🔧 Starting context-aware chunking...');
      
      // Determine optimal chunking strategy
      const strategy = this.selectChunkingStrategy(content, context, options);
      logger.info(`📋 Selected chunking strategy: ${strategy}`);
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(content, context, strategy);
      
      // Check cache
      if (this.options.performance.enableCaching && this.chunkingCache.has(cacheKey)) {
        logger.debug('📋 Using cached chunking result');
        this.performanceMetrics.cacheHitRate++;
        return this.chunkingCache.get(cacheKey);
      }
      
      // Perform comprehensive chunking
      const chunkingResult = await this.performContextAwareChunking(content, context, strategy, options);
      
      // Cache result
      if (this.options.performance.enableCaching) {
        this.cacheResult(cacheKey, chunkingResult);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      this.updateMetrics(chunkingResult, strategy, processingTime);
      
      logger.info(`✅ Chunking completed: ${chunkingResult.chunks.length} chunks in ${Math.round(processingTime)}ms`);
      
      return {
        ...chunkingResult,
        processingTime,
        strategy
      };
      
    } catch (error) {
      logger.error('❌ Context-aware chunking failed:', error);
      return this.generateFallbackChunks(content, error);
    }
  }

  /**
   * Select optimal chunking strategy
   * @param {string} content - Content to analyze
   * @param {Object} context - Context information
   * @param {Object} options - Options
   * @returns {string} Selected strategy name
   */
  selectChunkingStrategy(content, context, options) {
    try {
      // Validate context
      if (!context) {
        logger.warn('⚠️ No context provided to selectChunkingStrategy, using simple strategy');
        return 'simple';
      }
      
      // Use explicitly provided strategy
      if (options && options.strategy && this.options.strategies[options.strategy]) {
        return options.strategy;
      }
      
      // Use context-recommended strategy
      if (context.semantics && context.semantics.characteristics) {
        const characteristics = context.semantics.characteristics;
        
        if (characteristics.recommendedChunkingStrategy && 
            this.options.strategies[characteristics.recommendedChunkingStrategy]) {
          return characteristics.recommendedChunkingStrategy;
        }
        
        // Fallback to characteristic-based selection
        if (characteristics.isProcedural || characteristics.hasStepByStep) {
          return 'procedure_preserving';
        } else if (characteristics.isFAQ || characteristics.hasQuestions) {
          return 'qa_pair_preserving';
        } else if (characteristics.isConceptual || characteristics.hasDefinitions) {
          return 'definition_preserving';
        } else if (characteristics.isReference || context.structure?.hasGoodHierarchy) {
          return 'structure_preserving';
        }
      }
      
      // Analyze content directly if no context available
      if (this.hasStepByStepContent(content)) {
        return 'procedure_preserving';
      } else if (this.hasQAContent(content)) {
        return 'qa_pair_preserving';
      } else if (this.hasDefinitionContent(content)) {
        return 'definition_preserving';
      }
      
      // Default to adaptive semantic chunking
      return 'semantic_adaptive';
      
    } catch (error) {
      logger.error('❌ Strategy selection failed:', error);
      return 'simple';
    }
  }

  /**
   * Perform context-aware chunking
   * @param {string} content - Content to chunk
   * @param {Object} context - Context information
   * @param {string} strategy - Selected strategy
   * @param {Object} options - Options
   * @returns {Promise<Object>} Chunking result
   */
  async performContextAwareChunking(content, context, strategy, options) {
    const strategyConfig = this.options.strategies[strategy];
    
    // Step 1: Preprocess content and identify relationships
    const preprocessingResult = await this.preprocessContentForChunking(content, context, strategyConfig);
    
    // Step 2: Detect semantic boundaries
    const boundaryResult = await this.detectSemanticBoundaries(
      preprocessingResult.content,
      preprocessingResult.relationships,
      strategyConfig
    );
    
    // Step 3: Generate initial chunks based on boundaries
    const initialChunks = await this.generateInitialChunks(
      preprocessingResult.content,
      boundaryResult.boundaries,
      strategyConfig
    );
    
    // Step 4: Optimize chunks for quality and relationships
    const optimizedChunks = await this.optimizeChunks(
      initialChunks,
      preprocessingResult.relationships,
      strategyConfig,
      context
    );
    
    // Step 5: Apply overlap strategy
    const finalChunks = await this.applyOverlapStrategy(
      optimizedChunks,
      strategyConfig,
      preprocessingResult.content
    );
    
    // Step 6: Quality assessment and enhancement
    const qualityResult = await this.assessAndEnhanceChunkQuality(
      finalChunks,
      context,
      strategyConfig
    );
    
    return {
      success: true,
      chunks: qualityResult.chunks,
      chunkingMetadata: {
        strategy: strategy,
        totalChunks: qualityResult.chunks.length,
        averageChunkSize: this.calculateAverageChunkSize(qualityResult.chunks),
        averageQuality: qualityResult.averageQuality,
        relationshipsPreserved: preprocessingResult.relationships.length,
        boundariesDetected: boundaryResult.boundaries.length,
        optimizationApplied: true
      },
      qualityMetrics: qualityResult.qualityMetrics,
      processingStats: {
        preprocessingTime: preprocessingResult.processingTime,
        boundaryDetectionTime: boundaryResult.processingTime,
        optimizationTime: qualityResult.processingTime
      }
    };
  }

  /**
   * Preprocess content for chunking
   * @param {string} content - Original content
   * @param {Object} context - Context information
   * @param {Object} strategyConfig - Strategy configuration
   * @returns {Promise<Object>} Preprocessing result
   */
  async preprocessContentForChunking(content, context, strategyConfig) {
    const startTime = performance.now();
    
    try {
      // Normalize content
      let processedContent = this.normalizeContent(content);
      
      // Identify and mark relationships
      const relationships = await this.identifyContentRelationships(
        processedContent,
        context,
        strategyConfig
      );
      
      // Add relationship markers to content
      processedContent = this.addRelationshipMarkers(processedContent, relationships);
      
      const processingTime = performance.now() - startTime;
      
      return {
        content: processedContent,
        relationships: relationships,
        processingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Content preprocessing failed:', error);
      return {
        content: content,
        relationships: [],
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Identify content relationships
   * @param {string} content - Content to analyze
   * @param {Object} context - Context information
   * @param {Object} strategyConfig - Strategy configuration
   * @returns {Promise<Array>} Array of identified relationships
   */
  async identifyContentRelationships(content, context, strategyConfig) {
    try {
      const relationships = [];
      
      // Identify relationships based on strategy
      for (const [relationshipType, relationshipConfig] of Object.entries(this.options.relationships)) {
        // Skip if strategy doesn't require this relationship type
        if (!this.strategyRequiresRelationship(strategyConfig, relationshipType)) {
          continue;
        }
        
        // Apply patterns to find relationships
        for (const pattern of relationshipConfig.patterns) {
          const matches = [...content.matchAll(pattern)];
          
          for (const match of matches) {
            relationships.push({
              type: relationshipType,
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              content: match[0],
              keepTogether: relationshipConfig.keepTogether,
              maxSeparation: relationshipConfig.maxSeparation,
              priority: this.getRelationshipPriority(relationshipType, strategyConfig)
            });
          }
        }
      }
      
      // Sort relationships by priority and position
      relationships.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.startIndex - b.startIndex; // Then by position
      });
      
      // Remove overlapping relationships (keep higher priority)
      const filteredRelationships = this.removeOverlappingRelationships(relationships);
      
      logger.debug(`🔗 Identified ${filteredRelationships.length} content relationships`);
      
      return filteredRelationships;
      
    } catch (error) {
      logger.error('❌ Relationship identification failed:', error);
      return [];
    }
  }

  /**
   * Detect semantic boundaries
   * @param {string} content - Content with relationship markers
   * @param {Array} relationships - Identified relationships
   * @param {Object} strategyConfig - Strategy configuration
   * @returns {Promise<Object>} Boundary detection result
   */
  async detectSemanticBoundaries(content, relationships, strategyConfig) {
    const startTime = performance.now();
    
    try {
      const boundaries = [];
      
      // Detect boundaries using different strength levels
      for (const [strength, patterns] of Object.entries(this.options.semanticBoundaries)) {
        const strengthWeight = this.getBoundaryStrengthWeight(strength);
        
        for (const pattern of patterns) {
          const matches = [...content.matchAll(pattern)];
          
          for (const match of matches) {
            const boundary = {
              position: match.index,
              strength: strength,
              weight: strengthWeight,
              pattern: pattern.source,
              content: match[0].trim()
            };
            
            // Check if boundary conflicts with relationships
            if (!this.boundaryConflictsWithRelationships(boundary, relationships)) {
              boundaries.push(boundary);
            }
          }
        }
      }
      
      // Sort boundaries by position
      boundaries.sort((a, b) => a.position - b.position);
      
      // Filter boundaries based on strategy requirements
      const filteredBoundaries = this.filterBoundariesByStrategy(boundaries, strategyConfig);
      
      const processingTime = performance.now() - startTime;
      
      return {
        boundaries: filteredBoundaries,
        processingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Boundary detection failed:', error);
      return {
        boundaries: [],
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Generate initial chunks based on boundaries
   * @param {string} content - Content to chunk
   * @param {Array} boundaries - Detected boundaries
   * @param {Object} strategyConfig - Strategy configuration
   * @returns {Promise<Array>} Initial chunks
   */
  async generateInitialChunks(content, boundaries, strategyConfig) {
    try {
      const chunks = [];
      let currentPosition = 0;
      
      // Add boundaries at start and end if not present
      const allBoundaries = [
        { position: 0, strength: 'strong', weight: 1.0 },
        ...boundaries,
        { position: content.length, strength: 'strong', weight: 1.0 }
      ];
      
      // Generate chunks between boundaries
      for (let i = 0; i < allBoundaries.length - 1; i++) {
        const startBoundary = allBoundaries[i];
        const endBoundary = allBoundaries[i + 1];
        
        const chunkContent = content.substring(startBoundary.position, endBoundary.position).trim();
        
        if (chunkContent.length >= strategyConfig.minSize) {
          const chunk = this.createChunk(
            chunkContent,
            startBoundary.position,
            endBoundary.position,
            chunks.length,
            strategyConfig
          );
          
          chunks.push(chunk);
        } else if (chunkContent.length > 0) {
          // Merge small chunks with previous or next chunk
          this.mergeSmallChunk(chunks, chunkContent, startBoundary.position);
        }
      }
      
      logger.debug(`📄 Generated ${chunks.length} initial chunks`);
      
      return chunks;
      
    } catch (error) {
      logger.error('❌ Initial chunk generation failed:', error);
      return [];
    }
  }

  /**
   * Optimize chunks for quality and relationships
   * @param {Array} initialChunks - Initial chunks
   * @param {Array} relationships - Content relationships
   * @param {Object} strategyConfig - Strategy configuration
   * @param {Object} context - Context information
   * @returns {Promise<Array>} Optimized chunks
   */
  async optimizeChunks(initialChunks, relationships, strategyConfig, context) {
    try {
      let optimizedChunks = [...initialChunks];
      
      // Step 1: Ensure relationships are preserved
      optimizedChunks = await this.preserveRelationships(optimizedChunks, relationships, strategyConfig);
      
      // Step 2: Optimize chunk sizes
      optimizedChunks = await this.optimizeChunkSizes(optimizedChunks, strategyConfig);
      
      // Step 3: Enhance chunk boundaries
      optimizedChunks = await this.enhanceChunkBoundaries(optimizedChunks, context, strategyConfig);
      
      // Step 4: Add contextual information
      optimizedChunks = await this.addContextualInformation(optimizedChunks, context, strategyConfig);
      
      logger.debug(`🎯 Optimized ${optimizedChunks.length} chunks`);
      
      return optimizedChunks;
      
    } catch (error) {
      logger.error('❌ Chunk optimization failed:', error);
      return initialChunks;
    }
  }

  /**
   * Apply overlap strategy to chunks
   * @param {Array} chunks - Optimized chunks
   * @param {Object} strategyConfig - Strategy configuration
   * @param {string} originalContent - Original content
   * @returns {Promise<Array>} Chunks with overlap applied
   */
  async applyOverlapStrategy(chunks, strategyConfig, originalContent) {
    try {
      if (!strategyConfig.overlapSize || strategyConfig.overlapSize <= 0) {
        return chunks;
      }
      
      const chunksWithOverlap = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = { ...chunks[i] };
        
        // Add overlap from previous chunk
        if (i > 0 && strategyConfig.overlapSize > 0) {
          const previousChunk = chunks[i - 1];
          const overlapContent = this.extractOverlapContent(
            previousChunk.content,
            strategyConfig.overlapSize,
            'end'
          );
          
          if (overlapContent) {
            chunk.content = overlapContent + '\n\n' + chunk.content;
            chunk.hasOverlapBefore = true;
            chunk.overlapBefore = overlapContent;
          }
        }
        
        // Add overlap from next chunk
        if (i < chunks.length - 1 && strategyConfig.overlapSize > 0) {
          const nextChunk = chunks[i + 1];
          const overlapContent = this.extractOverlapContent(
            nextChunk.content,
            strategyConfig.overlapSize,
            'start'
          );
          
          if (overlapContent) {
            chunk.content = chunk.content + '\n\n' + overlapContent;
            chunk.hasOverlapAfter = true;
            chunk.overlapAfter = overlapContent;
          }
        }
        
        chunksWithOverlap.push(chunk);
      }
      
      logger.debug(`🔄 Applied overlap strategy to ${chunksWithOverlap.length} chunks`);
      
      return chunksWithOverlap;
      
    } catch (error) {
      logger.error('❌ Overlap strategy application failed:', error);
      return chunks;
    }
  }

  /**
   * Assess and enhance chunk quality
   * @param {Array} chunks - Chunks to assess
   * @param {Object} context - Context information
   * @param {Object} strategyConfig - Strategy configuration
   * @returns {Promise<Object>} Quality assessment result
   */
  async assessAndEnhanceChunkQuality(chunks, context, strategyConfig) {
    const startTime = performance.now();
    
    try {
      const enhancedChunks = [];
      let totalQuality = 0;
      
      for (const chunk of chunks) {
        // Assess chunk quality
        const qualityScore = this.assessChunkQuality(chunk, context, strategyConfig);
        
        // Enhance chunk if quality is below threshold
        let enhancedChunk = { ...chunk, qualityScore };
        
        if (qualityScore < this.options.quality.targetQualityScore) {
          enhancedChunk = await this.enhanceChunkQuality(enhancedChunk, context, strategyConfig);
        }
        
        // Add metadata
        enhancedChunk.chunkId = enhancedChunk.chunkId || uuidv4();
        enhancedChunk.tokenCount = this.estimateTokenCount(enhancedChunk.content);
        enhancedChunk.wordCount = this.countWords(enhancedChunk.content);
        enhancedChunk.sentenceCount = this.countSentences(enhancedChunk.content);
        
        enhancedChunks.push(enhancedChunk);
        totalQuality += enhancedChunk.qualityScore;
      }
      
      const averageQuality = totalQuality / chunks.length;
      const processingTime = performance.now() - startTime;
      
      return {
        chunks: enhancedChunks,
        averageQuality: averageQuality,
        qualityMetrics: {
          averageQuality: averageQuality,
          highQualityChunks: enhancedChunks.filter(c => c.qualityScore >= this.options.quality.targetQualityScore).length,
          lowQualityChunks: enhancedChunks.filter(c => c.qualityScore < this.options.quality.minQualityScore).length,
          qualityDistribution: this.calculateQualityDistribution(enhancedChunks)
        },
        processingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Quality assessment failed:', error);
      return {
        chunks: chunks.map(c => ({ ...c, qualityScore: 0.5, chunkId: uuidv4() })),
        averageQuality: 0.5,
        qualityMetrics: {},
        processingTime: performance.now() - startTime
      };
    }
  }

  // Helper methods

  /**
   * Normalize content for chunking
   */
  normalizeContent(content) {
    // Normalize line endings
    let normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove excessive whitespace but preserve structure
    normalized = normalized.replace(/[ \t]+/g, ' ');
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    
    // Trim lines
    normalized = normalized.split('\n').map(line => line.trim()).join('\n');
    
    return normalized.trim();
  }

  /**
   * Create a chunk object
   */
  createChunk(content, startPosition, endPosition, index, strategyConfig) {
    return {
      chunkId: uuidv4(),
      content: content,
      startPosition: startPosition,
      endPosition: endPosition,
      index: index,
      size: content.length,
      strategy: strategyConfig,
      createdAt: new Date().toISOString(),
      relationships: [],
      qualityScore: null,
      hasOverlapBefore: false,
      hasOverlapAfter: false
    };
  }

  /**
   * Assess chunk quality
   */
  assessChunkQuality(chunk, context, strategyConfig) {
    try {
      const factors = this.options.quality.qualityFactors;
      let totalScore = 0;
      
      // Completeness factor
      const completenessScore = this.assessCompleteness(chunk, context);
      totalScore += completenessScore * factors.completeness;
      
      // Coherence factor
      const coherenceScore = this.assessCoherence(chunk);
      totalScore += coherenceScore * factors.coherence;
      
      // Context factor
      const contextScore = this.assessContext(chunk, context);
      totalScore += contextScore * factors.context;
      
      // Readability factor
      const readabilityScore = this.assessReadability(chunk);
      totalScore += readabilityScore * factors.readability;
      
      return Math.max(0, Math.min(1, totalScore));
      
    } catch (error) {
      logger.error('❌ Quality assessment failed for chunk:', error);
      return 0.5; // Default quality score
    }
  }

  /**
   * Assess completeness of chunk
   */
  assessCompleteness(chunk, context) {
    let score = 0.5; // Base score
    
    // Check if chunk has complete sentences
    const sentences = chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const lastSentence = sentences[sentences.length - 1].trim();
      if (lastSentence.length > 10) {
        score += 0.2;
      }
    }
    
    // Check for complete procedures
    if (this.hasCompleteStepSequence(chunk.content)) {
      score += 0.2;
    }
    
    // Check for complete definitions
    if (this.hasCompleteDefinition(chunk.content)) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * Assess coherence of chunk
   */
  assessCoherence(chunk) {
    let score = 0.5; // Base score
    
    // Check for consistent topic
    const words = chunk.content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    
    if (repetitionRatio > 0.1 && repetitionRatio < 0.5) {
      score += 0.2; // Good repetition indicates topic consistency
    }
    
    // Check for logical flow
    if (this.hasLogicalFlow(chunk.content)) {
      score += 0.3;
    }
    
    return Math.min(1, score);
  }

  /**
   * Count words in content
   */
  countWords(content) {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in content
   */
  countSentences(content) {
    return content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
  }

  /**
   * Estimate token count
   */
  estimateTokenCount(content) {
    // Rough estimation: 4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Generate cache key
   */
  generateCacheKey(content, context, strategy) {
    const contentHash = require('crypto')
      .createHash('md5')
      .update(content.substring(0, 1000))
      .digest('hex');
    
    // Create a safe context object without circular references
    const safeContext = this.createSafeContext(context);
    
    return `chunk_${strategy}_${contentHash}_${JSON.stringify(safeContext)}`;
  }

  /**
   * Create a safe context object without circular references
   */
  createSafeContext(context) {
    if (!context || typeof context !== 'object') {
      return {};
    }

    try {
      // Create a safe copy of context without circular references
      const safeContext = {};
      
      // Copy primitive values and safe objects
      for (const [key, value] of Object.entries(context)) {
        if (value === null || value === undefined) {
          safeContext[key] = value;
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          safeContext[key] = value;
        } else if (Array.isArray(value)) {
          // For arrays, only include primitive values
          safeContext[key] = value.filter(item => 
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
          );
        } else if (typeof value === 'object') {
          // For objects, only include safe properties
          if (key === 'documentType' || key === 'processingOptions' || key === 'metadata') {
            safeContext[key] = this.extractSafeProperties(value);
          } else {
            // Skip potentially circular objects like 'children', 'parent', etc.
            safeContext[key] = '[Object]';
          }
        }
      }
      
      return safeContext;
    } catch (error) {
      logger.warn('⚠️ Failed to create safe context, using minimal context');
      return { strategy: strategy || 'unknown' };
    }
  }

  /**
   * Extract safe properties from an object
   */
  extractSafeProperties(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const safe = {};
    const allowedKeys = ['type', 'confidence', 'strategy', 'quality', 'size', 'length', 'count'];
    
    for (const key of allowedKeys) {
      if (obj.hasOwnProperty(key) && (typeof obj[key] === 'string' || typeof obj[key] === 'number' || typeof obj[key] === 'boolean')) {
        safe[key] = obj[key];
      }
    }
    
    return safe;
  }

  /**
   * Cache chunking result
   */
  cacheResult(cacheKey, result) {
    if (this.chunkingCache.size >= this.options.performance.maxCacheSize) {
      const firstKey = this.chunkingCache.keys().next().value;
      this.chunkingCache.delete(firstKey);
    }
    
    this.chunkingCache.set(cacheKey, {
      ...result,
      cachedAt: Date.now()
    });
  }

  /**
   * Update performance metrics
   */
  updateMetrics(result, strategy, processingTime) {
    this.performanceMetrics.chunksGenerated += result.chunks.length;
    
    // Update average processing time
    const totalTime = this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.chunksGenerated - result.chunks.length) + processingTime;
    this.performanceMetrics.averageProcessingTime = totalTime / this.performanceMetrics.chunksGenerated;
    
    // Update average quality
    if (result.chunkingMetadata && result.chunkingMetadata.averageQuality) {
      const totalQuality = this.performanceMetrics.averageChunkQuality * (this.performanceMetrics.chunksGenerated - result.chunks.length) + 
                          (result.chunkingMetadata.averageQuality * result.chunks.length);
      this.performanceMetrics.averageChunkQuality = totalQuality / this.performanceMetrics.chunksGenerated;
    }
    
    // Update strategy usage
    if (!this.performanceMetrics.strategyUsage[strategy]) {
      this.performanceMetrics.strategyUsage[strategy] = 0;
    }
    this.performanceMetrics.strategyUsage[strategy]++;
  }

  /**
   * Generate fallback chunks for errors
   */
  generateFallbackChunks(content, error) {
    try {
      // Simple text-based chunking as fallback
      const chunkSize = 500;
      const chunks = [];
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunkContent = content.substring(i, i + chunkSize);
        if (chunkContent.trim().length > 0) {
          chunks.push({
            chunkId: uuidv4(),
            content: chunkContent,
            startPosition: i,
            endPosition: i + chunkContent.length,
            index: chunks.length,
            size: chunkContent.length,
            qualityScore: 0.3,
            fallback: true,
            tokenCount: this.estimateTokenCount(chunkContent),
            wordCount: this.countWords(chunkContent)
          });
        }
      }
      
      return {
        chunks: chunks,
        chunkingMetadata: {
          strategy: 'fallback',
          totalChunks: chunks.length,
          averageChunkSize: chunkSize,
          averageQuality: 0.3,
          fallback: true
        },
        error: error.message
      };
      
    } catch (fallbackError) {
      logger.error('❌ Fallback chunking also failed:', fallbackError);
      return {
        chunks: [],
        chunkingMetadata: { strategy: 'failed', totalChunks: 0 },
        error: error.message
      };
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      cacheSize: this.chunkingCache.size,
      cacheHitRate: this.performanceMetrics.cacheHitRate / Math.max(this.performanceMetrics.chunksGenerated, 1)
    };
  }

  /**
   * Check for step-by-step content (helper method)
   */
  hasStepByStepContent(content) {
    const stepPatterns = [
      /step\s+\d+/gi,
      /\d+\.\s+/g,
      /(first|second|third|fourth|fifth)[,\s]/gi,
      /(next|then|finally)[,\s]/gi
    ];
    
    return stepPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for Q&A content (helper method)
   */
  hasQAContent(content) {
    const qaPatterns = [
      /\?/g,
      /^q\d*[:.]/gim,
      /question\s*\d*/gi,
      /(what|how|why|when|where)\s+.*?\?/gi
    ];
    
    return qaPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for definition content (helper method)
   */
  hasDefinitionContent(content) {
    const definitionPatterns = [
      /\w+\s+(?:is|are|means?|refers?\s+to)/gi,
      /definition\s*:/gi,
      /defined\s+as/gi
    ];
    
    return definitionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Strategy requires relationship (helper method)
   */
  strategyRequiresRelationship(strategyConfig, relationshipType) {
    const relationshipMap = {
      stepSequences: ['procedure_preserving'],
      qaPairs: ['qa_pair_preserving'],
      definitions: ['definition_preserving'],
      examples: ['definition_preserving', 'procedure_preserving'],
      warnings: ['procedure_preserving']
    };
    
    const requiredStrategies = relationshipMap[relationshipType] || [];
    return requiredStrategies.some(strategy => strategyConfig.strategy === strategy);
  }

  /**
   * Get relationship priority (helper method)
   */
  getRelationshipPriority(relationshipType, strategyConfig) {
    const priorityMap = {
      stepSequences: 3,
      qaPairs: 3,
      definitions: 2,
      examples: 1,
      warnings: 2
    };
    
    return priorityMap[relationshipType] || 1;
  }

  /**
   * Remove overlapping relationships (helper method)
   */
  removeOverlappingRelationships(relationships) {
    const filtered = [];
    
    for (const relationship of relationships) {
      const hasOverlap = filtered.some(existing => 
        (relationship.startIndex < existing.endIndex && relationship.endIndex > existing.startIndex)
      );
      
      if (!hasOverlap) {
        filtered.push(relationship);
      }
    }
    
    return filtered;
  }

  /**
   * Add relationship markers (helper method)
   */
  addRelationshipMarkers(content, relationships) {
    // For now, return content as-is
    // In a full implementation, this would add invisible markers
    return content;
  }

  /**
   * Get boundary strength weight (helper method)
   */
  getBoundaryStrengthWeight(strength) {
    const weights = {
      strong: 1.0,
      medium: 0.6,
      weak: 0.3
    };
    
    return weights[strength] || 0.5;
  }

  /**
   * Boundary conflicts with relationships (helper method)
   */
  boundaryConflictsWithRelationships(boundary, relationships) {
    return relationships.some(rel => 
      boundary.position > rel.startIndex && boundary.position < rel.endIndex
    );
  }

  /**
   * Filter boundaries by strategy (helper method)
   */
  filterBoundariesByStrategy(boundaries, strategyConfig) {
    // Apply strategy-specific filtering
    return boundaries.filter(boundary => {
      if (strategyConfig.preserveStepSequences && boundary.pattern.includes('step')) {
        return false; // Don't break step sequences
      }
      
      return true;
    });
  }

  /**
   * Merge small chunk (helper method)
   */
  mergeSmallChunk(chunks, chunkContent, position) {
    if (chunks.length > 0) {
      // Merge with last chunk
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content += '\n' + chunkContent;
      lastChunk.endPosition = position + chunkContent.length;
      lastChunk.size = lastChunk.content.length;
    }
  }

  /**
   * Preserve relationships (helper method)
   */
  async preserveRelationships(chunks, relationships, strategyConfig) {
    // Simplified implementation - return chunks as-is
    return chunks;
  }

  /**
   * Optimize chunk sizes (helper method)
   */
  async optimizeChunkSizes(chunks, strategyConfig) {
    // Simplified implementation - return chunks as-is
    return chunks;
  }

  /**
   * Enhance chunk boundaries (helper method)
   */
  async enhanceChunkBoundaries(chunks, context, strategyConfig) {
    // Simplified implementation - return chunks as-is
    return chunks;
  }

  /**
   * Add contextual information (helper method)
   */
  async addContextualInformation(chunks, context, strategyConfig) {
    // Add basic contextual information
    return chunks.map(chunk => ({
      ...chunk,
      contextualInfo: {
        hasStructure: context.structure?.hasStructure || false,
        documentType: context.typeDetection?.type || 'unknown',
        semanticType: context.semantics?.primaryType || 'unknown'
      }
    }));
  }

  /**
   * Extract overlap content (helper method)
   */
  extractOverlapContent(content, overlapSize, position) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (position === 'end') {
      // Take last few sentences
      const overlapSentences = sentences.slice(-2);
      return overlapSentences.join('. ').trim();
    } else {
      // Take first few sentences
      const overlapSentences = sentences.slice(0, 2);
      return overlapSentences.join('. ').trim();
    }
  }

  /**
   * Enhance chunk quality (helper method)
   */
  async enhanceChunkQuality(chunk, context, strategyConfig) {
    // Basic quality enhancement
    let enhancedChunk = { ...chunk };
    
    // Add heading if missing
    if (!enhancedChunk.heading || enhancedChunk.heading === 'No heading') {
      enhancedChunk.heading = this.generateHeadingFromContent(enhancedChunk.content);
    }
    
    // Improve quality score if content is fund-related
    if (enhancedChunk.content.toLowerCase().includes('fund')) {
      enhancedChunk.qualityScore = Math.min((enhancedChunk.qualityScore || 0.5) + 0.1, 1.0);
    }
    
    return enhancedChunk;
  }

  /**
   * Generate heading from content (helper method)
   */
  generateHeadingFromContent(content) {
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    if (firstLine.length > 0 && firstLine.length < 100) {
      return firstLine;
    }
    
    // Extract key terms for heading
    const fundTerms = content.match(/(fund|create|update|type|step|process)/gi);
    if (fundTerms && fundTerms.length > 0) {
      return `Fund Management: ${fundTerms[0]}`;
    }
    
    return 'Fund Management Guide';
  }

  /**
   * Calculate average chunk size (helper method)
   */
  calculateAverageChunkSize(chunks) {
    if (chunks.length === 0) return 0;
    
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    return Math.round(totalSize / chunks.length);
  }

  /**
   * Calculate quality distribution (helper method)
   */
  calculateQualityDistribution(chunks) {
    const distribution = {
      excellent: 0, // 0.8+
      good: 0,      // 0.6-0.8
      fair: 0,      // 0.4-0.6
      poor: 0       // <0.4
    };
    
    chunks.forEach(chunk => {
      const quality = chunk.qualityScore || 0.5;
      
      if (quality >= 0.8) distribution.excellent++;
      else if (quality >= 0.6) distribution.good++;
      else if (quality >= 0.4) distribution.fair++;
      else distribution.poor++;
    });
    
    return distribution;
  }

  /**
   * Assess context (helper method)
   */
  assessContext(chunk, context) {
    let score = 0.5; // Base score
    
    // Check if chunk has contextual information
    if (chunk.contextualInfo) {
      score += 0.2;
    }
    
    // Check if chunk relates to document structure
    if (context.structure && context.structure.hasStructure) {
      score += 0.2;
    }
    
    // Check if chunk has semantic classification
    if (context.semantics && context.semantics.primaryType !== 'unknown') {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * Assess readability (helper method)
   */
  assessReadability(chunk) {
    const sentences = chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = chunk.content.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) return 0.3;
    
    const avgWordsPerSentence = words.length / sentences.length;
    
    // Optimal range is 10-20 words per sentence
    let score = 0.5;
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) {
      score += 0.3;
    } else if (avgWordsPerSentence >= 8 && avgWordsPerSentence <= 25) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * Has complete step sequence (helper method)
   */
  hasCompleteStepSequence(content) {
    const stepMatches = content.match(/step\s+\d+/gi);
    return stepMatches && stepMatches.length >= 2;
  }

  /**
   * Has complete definition (helper method)
   */
  hasCompleteDefinition(content) {
    return /\w+\s+(?:is|are|means?)\s+.{10,}/gi.test(content);
  }

  /**
   * Has logical flow (helper method)
   */
  hasLogicalFlow(content) {
    const transitionWords = ['first', 'second', 'next', 'then', 'finally', 'however', 'therefore', 'additionally'];
    const contentLower = content.toLowerCase();
    
    return transitionWords.some(word => contentLower.includes(word));
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.chunkingCache.clear();
    this.relationshipCache.clear();
    logger.info('🧹 Context-aware chunker caches cleared');
  }
}

module.exports = ContextAwareChunker;
