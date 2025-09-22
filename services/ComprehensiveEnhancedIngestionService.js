/**
 * Comprehensive Enhanced Ingestion Service
 * Master orchestrator integrating all advanced components
 * Production-ready with full error handling, monitoring, and optimization
 */

const DocumentTypeDetector = require('../knowledge/analysis/DocumentTypeDetector');
const AdvancedStructureAnalyzer = require('../knowledge/analysis/AdvancedStructureAnalyzer');
const SemanticSectionDetector = require('../knowledge/analysis/SemanticSectionDetector');
const ContextAwareChunker = require('../knowledge/chunking/ContextAwareChunker');
const MultiFormatProcessor = require('../knowledge/processing/MultiFormatProcessor');
const IntelligentContentFilter = require('../knowledge/processing/IntelligentContentFilter');
const EmbeddingGenerator = require('../knowledge/embeddings/EmbeddingGenerator');
const { getDatabase } = require('../config/database');
const { getConfig } = require('../config/environment');
const logger = require('../utils/logger');
const { performance } = require('perf_hooks');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class ComprehensiveEnhancedIngestionService {
  constructor(options = {}) {
    this.config = getConfig();
    this.db = getDatabase();
    
    this.options = {
      // Pipeline configuration
      pipeline: {
        enableDocumentTypeDetection: true,
        enableStructureAnalysis: true,
        enableSemanticDetection: true,
        enableContentFiltering: true,
        enableContextAwareChunking: true,
        enableQualityValidation: true,
        enableRealTimeMonitoring: true
      },
      
      // Processing strategies
      strategies: {
        adaptive: true,
        fallbackEnabled: true,
        parallelProcessing: false, // Disabled for memory management
        batchProcessing: true,
        batchSize: 3
      },
      
      // Quality thresholds
      quality: {
        minDocumentQuality: 0.4,
        minChunkQuality: 0.4,
        targetChunkQuality: 0.7,
        enableQualityEnhancement: true,
        rejectLowQuality: false
      },
      
      // Performance optimization
      performance: {
        enableCaching: true,
        enableMetrics: true,
        enableProfiling: true,
        memoryThreshold: 0.8,
        timeoutMs: 300000 // 5 minutes
      },
      
      // Error handling
      errorHandling: {
        enableRetries: true,
        maxRetries: 3,
        retryDelayMs: 1000,
        enableFallback: true,
        continueOnError: true
      },
      
      ...options
    };

    // Initialize components
    this.initializeComponents();
    
    // Initialize state
    this.processingStats = {
      documentsProcessed: 0,
      chunksGenerated: 0,
      averageProcessingTime: 0,
      averageQuality: 0,
      errorRate: 0,
      componentPerformance: {}
    };
    
    this.activeJobs = new Map();
    this.processingQueue = [];
  }

  /**
   * Initialize all processing components
   */
  initializeComponents() {
    try {
      this.documentTypeDetector = new DocumentTypeDetector({
        enableCaching: this.options.performance.enableCaching
      });
      
      this.structureAnalyzer = new AdvancedStructureAnalyzer({
        enableCaching: this.options.performance.enableCaching
      });
      
      this.semanticDetector = new SemanticSectionDetector({
        enableCaching: this.options.performance.enableCaching
      });
      
      this.contextAwareChunker = new ContextAwareChunker({
        enableCaching: this.options.performance.enableCaching
      });
      
      this.multiFormatProcessor = new MultiFormatProcessor({
        enableCaching: this.options.performance.enableCaching
      });
      
      this.contentFilter = new IntelligentContentFilter({
        enableCaching: this.options.performance.enableCaching
      });
      
      this.embeddingGenerator = new EmbeddingGenerator();
      
      logger.info('✅ All ingestion components initialized successfully');
      
    } catch (error) {
      logger.error('❌ Component initialization failed:', error);
      throw new Error(`Failed to initialize ingestion components: ${error.message}`);
    }
  }

  /**
   * Main document ingestion method
   * @param {string} filePath - Path to document file
   * @param {string} sourceId - Source identifier
   * @param {string} version - Document version
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Comprehensive ingestion result
   */
  async ingestDocument(filePath, sourceId, version, options = {}) {
    const startTime = performance.now();
    const jobId = uuidv4();
    
    try {
      logger.info(`🚀 Starting comprehensive ingestion: ${path.basename(filePath)}`);
      
      // Create job tracking
      const job = this.createJobTracking(jobId, filePath, sourceId, version, options);
      this.activeJobs.set(jobId, job);
      
      // Initialize database if needed
      await this.initializeDatabase();
      
      // Execute comprehensive processing pipeline
      const result = await this.executeProcessingPipeline(filePath, sourceId, version, job, options);
      
      // Store results in database
      const storageResult = await this.storeProcessingResults(result, sourceId, version, job);
      
      // Update job completion
      const processingTime = performance.now() - startTime;
      await this.completeJob(jobId, processingTime, storageResult);
      
      // Update statistics
      this.updateProcessingStats(result, processingTime);
      
      logger.info(`✅ Comprehensive ingestion completed in ${Math.round(processingTime)}ms`);
      
      return {
        success: true,
        jobId: jobId,
        sourceId: sourceId,
        version: version,
        processingTime: processingTime,
        chunksGenerated: result.chunks.length,
        averageQuality: (result.qualityMetrics && result.qualityMetrics.averageQuality) || 0.5,
        pipelineResults: result.pipelineResults,
        storageResult: storageResult,
        metadata: {
          filePath: filePath,
          fileName: path.basename(filePath),
          processedAt: new Date().toISOString(),
          pipelineVersion: '2.0.0'
        }
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      await this.handleJobError(jobId, error, processingTime);
      
      logger.error(`❌ Comprehensive ingestion failed for ${filePath}:`, error);
      
      // Return error result
      return {
        success: false,
        jobId: jobId,
        error: error.message,
        processingTime: processingTime,
        fallbackApplied: await this.attemptFallbackProcessing(filePath, sourceId, version, error)
      };
      
    } finally {
      // Cleanup
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Execute the comprehensive processing pipeline
   * @param {string} filePath - Path to document
   * @param {string} sourceId - Source identifier
   * @param {string} version - Version
   * @param {Object} job - Job tracking object
   * @param {Object} options - Options
   * @returns {Promise<Object>} Pipeline execution result
   */
  async executeProcessingPipeline(filePath, sourceId, version, job, options) {
    const pipelineResults = {};
    
    try {
      // Stage 1: Document Type Detection
      await this.updateJobProgress(job.id, 10, 'Detecting document type');
      pipelineResults.typeDetection = await this.executeTypeDetection(filePath, options);
      
      // Stage 2: Multi-Format Processing
      await this.updateJobProgress(job.id, 20, 'Processing document format');
      pipelineResults.formatProcessing = await this.executeFormatProcessing(
        filePath, 
        pipelineResults.typeDetection, 
        options
      );
      
      // Stage 3: Content Filtering
      await this.updateJobProgress(job.id, 30, 'Filtering content');
      pipelineResults.contentFiltering = await this.executeContentFiltering(
        pipelineResults.formatProcessing.content,
        pipelineResults.typeDetection,
        options
      );
      
      // Stage 4: Structure Analysis
      await this.updateJobProgress(job.id, 45, 'Analyzing document structure');
      pipelineResults.structureAnalysis = await this.executeStructureAnalysis(
        pipelineResults.contentFiltering.content,
        pipelineResults.formatProcessing.metadata,
        options
      );
      
      // Stage 5: Semantic Detection
      await this.updateJobProgress(job.id, 60, 'Detecting semantic sections');
      pipelineResults.semanticDetection = await this.executeSemanticDetection(
        pipelineResults.contentFiltering.content,
        {
          structure: pipelineResults.structureAnalysis,
          typeDetection: pipelineResults.typeDetection
        },
        options
      );
      
      // Stage 6: Context-Aware Chunking
      await this.updateJobProgress(job.id, 75, 'Generating context-aware chunks');
      pipelineResults.chunking = await this.executeContextAwareChunking(
        pipelineResults.contentFiltering.content,
        {
          structure: pipelineResults.structureAnalysis,
          semantics: pipelineResults.semanticDetection,
          typeDetection: pipelineResults.typeDetection
        },
        options
      );
      
      // Stage 7: Quality Enhancement
      await this.updateJobProgress(job.id, 80, 'Enhancing chunk quality');
      pipelineResults.qualityEnhancement = await this.executeQualityEnhancement(
        pipelineResults.chunking.chunks,
        pipelineResults,
        options
      );
      
      // Stage 8: Embedding Generation
      await this.updateJobProgress(job.id, 90, 'Generating embeddings');
      pipelineResults.embeddingGeneration = await this.executeEmbeddingGeneration(
        pipelineResults.qualityEnhancement.chunks,
        pipelineResults,
        options
      );
      
      // Stage 9: Final Validation
      await this.updateJobProgress(job.id, 95, 'Validating results');
      const validationResult = await this.executeFinalValidation(pipelineResults, options);
      
      return {
        chunks: pipelineResults.embeddingGeneration.chunks,
        qualityMetrics: pipelineResults.qualityEnhancement.qualityMetrics,
        pipelineResults: pipelineResults,
        validationResult: validationResult,
        processingMetadata: {
          stagesCompleted: Object.keys(pipelineResults).length,
          pipelineVersion: '2.0.0',
          componentsUsed: this.getComponentsUsed(pipelineResults)
        }
      };
      
    } catch (error) {
      logger.error('❌ Pipeline execution failed:', error);
      throw new Error(`Pipeline execution failed at stage: ${error.stage || 'unknown'} - ${error.message}`);
    }
  }

  /**
   * Execute document type detection
   */
  async executeTypeDetection(filePath, options) {
    try {
      if (!this.options.pipeline.enableDocumentTypeDetection) {
        return { type: 'unknown', confidence: 0.5, skipped: true };
      }
      
      const startTime = performance.now();
      const result = await this.documentTypeDetector.detectDocumentType(filePath, options.metadata || {});
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('typeDetection', processingTime);
      
      logger.debug(`📋 Document type: ${result.type} (${Math.round(result.confidence * 100)}%)`);
      
      return {
        ...result,
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Type detection failed:', error);
      return {
        type: 'unknown',
        confidence: 0.1,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Execute multi-format processing
   */
  async executeFormatProcessing(filePath, typeDetection, options) {
    try {
      const startTime = performance.now();
      const result = await this.multiFormatProcessor.processDocument(filePath, {
        ...options.formatOptions,
        detectedType: typeDetection.type
      });
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('formatProcessing', processingTime);
      
      logger.debug(`📄 Format processed: ${result.format} (${result.content.length} chars)`);
      
      return {
        ...result,
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Format processing failed:', error);
      throw new Error(`Format processing failed: ${error.message}`);
    }
  }

  /**
   * Execute content filtering
   */
  async executeContentFiltering(content, typeDetection, options) {
    try {
      if (!this.options.pipeline.enableContentFiltering) {
        return { content: content, skipped: true };
      }
      
      const startTime = performance.now();
      const result = await this.contentFilter.filterContent(content, {
        documentType: typeDetection.type,
        ...options.filterOptions
      });
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('contentFiltering', processingTime);
      
      logger.debug(`🧹 Content filtered: ${result.filteringStats.reductionPercentage}% reduction`);
      
      return {
        ...result,
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Content filtering failed:', error);
      return {
        content: content,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Execute structure analysis
   */
  async executeStructureAnalysis(content, metadata, options) {
    try {
      if (!this.options.pipeline.enableStructureAnalysis) {
        return { hasStructure: false, skipped: true };
      }
      
      const startTime = performance.now();
      const result = await this.structureAnalyzer.analyzeDocumentStructure(content, metadata);
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('structureAnalysis', processingTime);
      
      logger.debug(`🏗️ Structure analyzed: ${result.headings.length} headings, ${result.sections.length} sections`);
      
      return {
        ...result,
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Structure analysis failed:', error);
      return {
        hasStructure: false,
        headings: [],
        sections: [],
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Execute semantic detection
   */
  async executeSemanticDetection(content, context, options) {
    try {
      // Validate and normalize options
      if (!options) {
        logger.warn('⚠️ No options provided to executeSemanticDetection, using defaults');
        options = {};
      }
      
      if (!this.options.pipeline.enableSemanticDetection) {
        return { primaryType: 'unknown', confidence: 0.5, skipped: true };
      }
      
      const startTime = performance.now();
      const result = await this.semanticDetector.detectSectionType(content, context);
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('semanticDetection', processingTime);
      
      logger.debug(`🏷️ Semantic type: ${result.primaryType} (${Math.round(result.confidence * 100)}%)`);
      
      return {
        ...result,
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Semantic detection failed:', error);
      return {
        primaryType: 'unknown',
        confidence: 0.1,
        characteristics: {},
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Execute context-aware chunking
   */
  async executeContextAwareChunking(content, context, options) {
    try {
      // Validate and normalize options
      if (!options) {
        logger.warn('⚠️ No options provided to executeContextAwareChunking, using defaults');
        options = {};
      }
      
      // Validate and normalize context
      if (!context) {
        logger.warn('⚠️ No context provided to executeContextAwareChunking, using default context');
        context = { strategy: 'simple', documentType: 'unknown' };
      }
      
      if (!this.options.pipeline.enableContextAwareChunking) {
        // Fallback to simple chunking
        return await this.executeSimpleChunking(content, options);
      }
      
      const startTime = performance.now();
      // Ensure chunkingOptions exists
      const chunkingOptions = options.chunkingOptions || {};
      const result = await this.contextAwareChunker.chunkContent(content, context, chunkingOptions);
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('contextAwareChunking', processingTime);
      
      // Safe access to chunkingMetadata
      const avgQuality = result.chunkingMetadata?.averageQuality || 0;
      logger.debug(`🔧 Chunks generated: ${result.chunks?.length || 0} (avg quality: ${Math.round(avgQuality * 100)}%)`);
      
      return {
        ...result,
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Context-aware chunking failed:', error);
      
      // Fallback to simple chunking
      logger.info('🔄 Falling back to simple chunking');
      return await this.executeSimpleChunking(content, options);
    }
  }

  /**
   * Execute quality enhancement
   */
  async executeQualityEnhancement(chunks, pipelineResults, options) {
    try {
      if (!this.options.quality.enableQualityEnhancement) {
        return { 
          chunks: chunks.map(c => ({ ...c, qualityScore: 0.5 })),
          qualityMetrics: { averageQuality: 0.5, skipped: true }
        };
      }
      
      const startTime = performance.now();
      const enhancedChunks = [];
      let totalQuality = 0;
      
      for (const chunk of chunks) {
        const enhancedChunk = await this.enhanceChunkQuality(chunk, pipelineResults, options);
        enhancedChunks.push(enhancedChunk);
        totalQuality += enhancedChunk.qualityScore || 0.5;
      }
      
      const averageQuality = totalQuality / chunks.length;
      const processingTime = performance.now() - startTime;
      
      this.updateComponentPerformance('qualityEnhancement', processingTime);
      
      logger.debug(`⭐ Quality enhanced: ${Math.round(averageQuality * 100)}% average quality`);
      
      return {
        chunks: enhancedChunks,
        qualityMetrics: {
          averageQuality: averageQuality,
          highQualityChunks: enhancedChunks.filter(c => c.qualityScore >= this.options.quality.targetChunkQuality).length,
          lowQualityChunks: enhancedChunks.filter(c => c.qualityScore < this.options.quality.minChunkQuality).length
        },
        componentProcessingTime: processingTime
      };
      
    } catch (error) {
      logger.error('❌ Quality enhancement failed:', error);
      return {
        chunks: chunks.map(c => ({ ...c, qualityScore: 0.5 })),
        qualityMetrics: { averageQuality: 0.5, error: error.message },
        fallback: true
      };
    }
  }

  /**
   * Execute final validation
   */
  async executeFinalValidation(pipelineResults, options) {
    try {
      const validation = {
        isValid: true,
        warnings: [],
        errors: [],
        recommendations: []
      };
      
      // Validate chunks
      const chunks = pipelineResults.qualityEnhancement.chunks;
      if (chunks.length === 0) {
        validation.errors.push('No chunks generated');
        validation.isValid = false;
      }
      
      // Validate quality
      const avgQuality = pipelineResults.qualityEnhancement.qualityMetrics.averageQuality;
      if (avgQuality < this.options.quality.minDocumentQuality) {
        validation.warnings.push(`Low average quality: ${Math.round(avgQuality * 100)}%`);
      }
      
      // Validate content
      const totalContent = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      if (totalContent < 100) {
        validation.warnings.push('Very little content extracted');
      }
      
      // Generate recommendations
      if (avgQuality < 0.6) {
        validation.recommendations.push('Consider reprocessing with different settings');
      }
      
      if (chunks.length > 100) {
        validation.recommendations.push('Consider using larger chunk sizes');
      }
      
      return validation;
      
    } catch (error) {
      logger.error('❌ Final validation failed:', error);
      return {
        isValid: false,
        errors: [error.message],
        warnings: [],
        recommendations: []
      };
    }
  }

  /**
   * Store processing results in database
   */
  async storeProcessingResults(result, sourceId, version, job) {
    try {
      logger.info('💾 Storing processing results in database...');
      
      const storageStartTime = performance.now();
      
      // Ensure source record exists (create or update)
      await this.db.query(`
        INSERT INTO kb_sources (
          source_id, version, filename, file_path, file_size, 
          document_type, processing_status, total_chunks, metadata, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (source_id) DO UPDATE SET
          processing_status = EXCLUDED.processing_status,
          total_chunks = EXCLUDED.total_chunks,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        sourceId,
        version,
        job.filePath ? path.basename(job.filePath) : 'unknown',
        job.filePath || '',
        0, // file_size - we'll calculate this if needed
        'docx', // document_type - required field
        'completed',
        result.chunks.length,
        JSON.stringify({
          ...result.processingMetadata,
          averageQuality: (result.qualityMetrics && result.qualityMetrics.averageQuality) || 0.5,
          processingMethod: 'comprehensive_enhanced',
          jobId: job.id
        })
      ]);
      
      // Store chunks
      let storedChunks = 0;
      for (const chunk of result.chunks) {
        try {
          // Prepare embedding for storage
          const embeddingVector = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
          
          await this.db.query(`
            INSERT INTO kb_chunks (
              chunk_id, source_id, version, content, heading,
              quality_score, token_count, chunk_index,
              content_type, metadata, character_count, word_count,
              embedding, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
          `, [
            chunk.chunkId || uuidv4(),
            sourceId,
            version,
            chunk.content,
            chunk.heading || this.extractHeadingFromContent(chunk.content),
            chunk.qualityScore || 0.5,
            chunk.tokenCount || this.estimateTokenCount(chunk.content),
            chunk.index || storedChunks,
            chunk.contentType || 'general',
            JSON.stringify({
              classification: chunk.classification || {},
              processingMetadata: chunk.processingMetadata || {},
              enhanced: true,
              enhancementFactors: chunk.enhancementFactors || {},
              embeddingMetadata: chunk.embeddingMetadata || {}
            }),
            chunk.content ? chunk.content.length : 0, // character_count
            chunk.content ? chunk.content.split(/\s+/).filter(word => word.length > 0).length : 0, // word_count
            embeddingVector // embedding as PostgreSQL vector
          ]);
          
          storedChunks++;
          
        } catch (chunkError) {
          logger.error(`❌ Failed to store chunk ${chunk.chunkId}:`, chunkError);
        }
      }
      
      const storageTime = performance.now() - storageStartTime;
      
      logger.info(`✅ Stored ${storedChunks}/${result.chunks.length} chunks in ${Math.round(storageTime)}ms`);
      
      return {
        success: true,
        chunksStored: storedChunks,
        storageTime: storageTime,
        sourceUpdated: true
      };
      
    } catch (error) {
      logger.error('❌ Failed to store processing results:', error);
      return {
        success: false,
        error: error.message,
        chunksStored: 0
      };
    }
  }

  // Helper methods

  /**
   * Create job tracking
   */
  createJobTracking(jobId, filePath, sourceId, version, options) {
    return {
      id: jobId,
      filePath: filePath,
      sourceId: sourceId,
      version: version,
      options: options,
      startTime: Date.now(),
      status: 'running',
      progress: 0,
      currentStage: 'initializing'
    };
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId, progress, stage) {
    try {
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.progress = progress;
        job.currentStage = stage;
        job.lastUpdate = Date.now();
      }
      
      // Update database if available
      if (this.db) {
        await this.db.query(`
          UPDATE ingestion_jobs 
          SET progress_percentage = $1, current_step = $2, updated_at = NOW()
          WHERE job_id = $3
        `, [progress, stage, jobId]);
      }
      
    } catch (error) {
      logger.debug('Failed to update job progress:', error);
    }
  }

  /**
   * Complete job
   */
  async completeJob(jobId, processingTime, result) {
    try {
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.processingTime = processingTime;
        job.result = result;
      }
      
      // Update database
      if (this.db) {
        await this.db.query(`
          UPDATE ingestion_jobs
          SET job_status = 'completed', progress_percentage = 100,
              completed_at = NOW(), processing_stats = $1, updated_at = NOW()
          WHERE job_id = $2
        `, [JSON.stringify({processingTime, result}), jobId]);
      }
      
    } catch (error) {
      logger.error('Failed to complete job:', error);
    }
  }

  /**
   * Handle job error
   */
  async handleJobError(jobId, error, processingTime) {
    try {
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.processingTime = processingTime;
      }
      
      // Update database
      if (this.db) {
        await this.db.query(`
          UPDATE ingestion_jobs 
          SET status = 'failed', error_message = $1,
              processing_time = $2, updated_at = NOW()
          WHERE job_id = $3
        `, [error.message, processingTime, jobId]);
      }
      
    } catch (dbError) {
      logger.error('Failed to handle job error:', dbError);
    }
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    try {
      if (!this.db) {
        this.db = getDatabase();
      }
      
      if (this.db && !this.db.isReady()) {
        await this.db.initialize();
      }
      
    } catch (error) {
      logger.warn('⚠️ Database initialization failed:', error);
      this.db = null;
    }
  }

  /**
   * Update component performance metrics
   */
  updateComponentPerformance(component, processingTime) {
    if (!this.processingStats.componentPerformance[component]) {
      this.processingStats.componentPerformance[component] = {
        totalTime: 0,
        callCount: 0,
        averageTime: 0
      };
    }
    
    const stats = this.processingStats.componentPerformance[component];
    stats.totalTime += processingTime;
    stats.callCount++;
    stats.averageTime = stats.totalTime / stats.callCount;
  }

  /**
   * Update processing statistics
   */
  updateProcessingStats(result, processingTime) {
    this.processingStats.documentsProcessed++;
    this.processingStats.chunksGenerated += result.chunks.length;
    
    // Update average processing time
    const totalTime = this.processingStats.averageProcessingTime * (this.processingStats.documentsProcessed - 1) + processingTime;
    this.processingStats.averageProcessingTime = totalTime / this.processingStats.documentsProcessed;
    
    // Update average quality
    const currentQuality = (result.qualityMetrics && result.qualityMetrics.averageQuality) || 0.5;
    const totalQuality = this.processingStats.averageQuality * (this.processingStats.documentsProcessed - 1) + currentQuality;
    this.processingStats.averageQuality = totalQuality / this.processingStats.documentsProcessed;
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.processingStats,
      activeJobs: this.activeJobs.size,
      queueSize: this.processingQueue.length,
      componentStats: {
        documentTypeDetector: this.documentTypeDetector.getStatistics(),
        structureAnalyzer: this.structureAnalyzer.getPerformanceStats(),
        semanticDetector: this.semanticDetector.getPerformanceStats(),
        contextAwareChunker: this.contextAwareChunker.getPerformanceStats(),
        multiFormatProcessor: this.multiFormatProcessor.getPerformanceStats()
      }
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.documentTypeDetector.clearCaches();
    this.structureAnalyzer.clearCaches();
    this.semanticDetector.clearCaches();
    this.contextAwareChunker.clearCaches();
    this.multiFormatProcessor.clearCaches();
    
    logger.info('🧹 All component caches cleared');
  }

  /**
   * Estimate token count (helper method)
   */
  estimateTokenCount(content) {
    return Math.ceil(content.length / 4);
  }

  /**
   * Execute simple chunking (fallback method)
   */
  async executeSimpleChunking(content, options) {
    try {
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
            qualityScore: 0.4,
            strategy: 'simple_fallback'
          });
        }
      }
      
      return {
        chunks: chunks,
        chunkingMetadata: {
          strategy: 'simple_fallback',
          totalChunks: chunks.length,
          averageChunkSize: chunkSize,
          averageQuality: 0.4
        }
      };
      
    } catch (error) {
      logger.error('❌ Simple chunking failed:', error);
      return {
        chunks: [],
        chunkingMetadata: { strategy: 'failed', totalChunks: 0 }
      };
    }
  }

  /**
   * Enhance chunk quality (helper method)
   */
  async enhanceChunkQuality(chunk, pipelineResults, options) {
    try {
      let enhancedChunk = { ...chunk };
      
      // Calculate quality score based on multiple factors
      let qualityScore = 0.5; // Base score
      
      // Content length factor
      if (enhancedChunk.content.length > 100) qualityScore += 0.1;
      if (enhancedChunk.content.length > 300) qualityScore += 0.1;
      
      // Fund relevance factor
      if (enhancedChunk.content.toLowerCase().includes('fund')) {
        qualityScore += 0.2;
      }
      
      // Structure factor
      if (pipelineResults.structureAnalysis && pipelineResults.structureAnalysis.hasStructure) {
        qualityScore += 0.1;
      }
      
      // Semantic factor
      if (pipelineResults.semanticDetection && pipelineResults.semanticDetection.confidence > 0.6) {
        qualityScore += 0.1;
      }
      
      enhancedChunk.qualityScore = Math.min(1.0, qualityScore);
      
      // Add heading if missing
      if (!enhancedChunk.heading || enhancedChunk.heading === 'No heading') {
        enhancedChunk.heading = this.extractHeadingFromContent(enhancedChunk.content);
      }
      
      // Add metadata
      enhancedChunk.processingMetadata = {
        enhanced: true,
        enhancementFactors: {
          contentLength: enhancedChunk.content.length,
          fundRelevant: enhancedChunk.content.toLowerCase().includes('fund'),
          hasStructure: pipelineResults.structureAnalysis?.hasStructure || false,
          semanticConfidence: pipelineResults.semanticDetection?.confidence || 0
        }
      };
      
      return enhancedChunk;
      
    } catch (error) {
      logger.error('❌ Chunk quality enhancement failed:', error);
      return { ...chunk, qualityScore: 0.5 };
    }
  }

  /**
   * Attempt fallback processing
   */
  async attemptFallbackProcessing(filePath, sourceId, version, originalError) {
    try {
      logger.info('🔄 Attempting fallback processing...');
      
      // Try simple text extraction
      const fs = require('fs').promises;
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (content.length > 0) {
        // Simple chunking
        const fallbackResult = await this.executeSimpleChunking(content, {});
        
        // Store with fallback flag
        await this.storeProcessingResults({
          chunks: fallbackResult.chunks,
          qualityMetrics: { averageQuality: 0.3 },
          processingMetadata: { fallback: true, originalError: originalError.message }
        }, sourceId, version, { id: 'fallback' });
        
        return {
          success: true,
          method: 'simple_text_extraction',
          chunksGenerated: fallbackResult.chunks.length
        };
      }
      
      return { success: false, reason: 'No content extracted' };
      
    } catch (error) {
      logger.error('❌ Fallback processing also failed:', error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Execute embedding generation stage
   */
  async executeEmbeddingGeneration(chunks, pipelineResults, options) {
    const startTime = performance.now();
    
    try {
      logger.info('🎯 Generating embeddings for chunks...');
      
      if (!this.embeddingGenerator) {
        throw new Error('EmbeddingGenerator not initialized');
      }
      
      // Use the batch embedding generation method
      const embeddingResult = await this.embeddingGenerator.generateEmbeddings(chunks, {
        batchSize: 10,
        useCache: true,
        validateDimensions: true
      });
      
      const processingTime = performance.now() - startTime;
      const embeddingsGenerated = embeddingResult.filter(chunk => chunk.embedding).length;
      
      logger.info(`✅ Embedding generation completed: ${embeddingsGenerated}/${chunks.length} embeddings in ${Math.round(processingTime)}ms`);
      
      return {
        chunks: embeddingResult,
        embeddingsGenerated: embeddingsGenerated,
        processingTime: processingTime,
        metadata: {
          totalChunks: chunks.length,
          successfulEmbeddings: embeddingsGenerated,
          failedEmbeddings: chunks.length - embeddingsGenerated,
          averageTimePerEmbedding: processingTime / chunks.length
        }
      };
      
    } catch (error) {
      logger.error('❌ Embedding generation failed:', error);
      
      // Return chunks without embeddings as fallback
      return {
        chunks: chunks,
        embeddingsGenerated: 0,
        processingTime: performance.now() - startTime,
        error: error.message,
        fallbackApplied: true
      };
    }
  }

  /**
   * Get components used (helper method)
   */
  getComponentsUsed(pipelineResults) {
    const components = [];
    
    if (pipelineResults.typeDetection && !pipelineResults.typeDetection.skipped) {
      components.push('DocumentTypeDetector');
    }
    
    if (pipelineResults.formatProcessing) {
      components.push('MultiFormatProcessor');
    }
    
    if (pipelineResults.contentFiltering && !pipelineResults.contentFiltering.skipped) {
      components.push('IntelligentContentFilter');
    }
    
    if (pipelineResults.structureAnalysis && !pipelineResults.structureAnalysis.skipped) {
      components.push('AdvancedStructureAnalyzer');
    }
    
    if (pipelineResults.semanticDetection && !pipelineResults.semanticDetection.skipped) {
      components.push('SemanticSectionDetector');
    }
    
    if (pipelineResults.chunking) {
      components.push('ContextAwareChunker');
    }
    
    return components;
  }

  /**
   * Extract heading from content (helper method)
   */
  extractHeadingFromContent(content) {
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    if (firstLine.length > 0 && firstLine.length < 100) {
      return firstLine;
    }
    
    return 'Fund Management Guide';
  }
}

module.exports = ComprehensiveEnhancedIngestionService;
