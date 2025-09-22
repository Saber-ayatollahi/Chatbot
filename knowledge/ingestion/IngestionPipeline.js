/**
 * Ingestion Pipeline Module
 * Complete document ingestion pipeline with processing, chunking, and embedding
 * Phase 1: Foundation & Infrastructure Setup
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const DocumentLoader = require('../loaders/DocumentLoader');
const SemanticChunker = require('../chunking/SemanticChunker');
const EmbeddingGenerator = require('../embeddings/EmbeddingGenerator');
const ComprehensiveEnhancedIngestionService = require('../../services/ComprehensiveEnhancedIngestionService');
const { getConfig } = require('../../config/environment');
const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

class IngestionPipeline {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.documentLoader = new DocumentLoader();
    this.chunker = new SemanticChunker();
    this.embeddingGenerator = new EmbeddingGenerator();
    this.advancedProcessor = new ComprehensiveEnhancedIngestionService();
    this.currentJob = null;
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
   * Ingest a single document using advanced processing pipeline
   * @param {string} filePath - Path to the document file
   * @param {string} sourceId - Unique identifier for the source
   * @param {string} version - Version of the document
   * @param {Object} options - Ingestion options
   * @returns {Object} Ingestion result
   */
  async ingestDocumentAdvanced(filePath, sourceId, version, options = {}) {
    let jobId = null;
    
    try {
      await this.initializeDatabase();
      
      logger.info(`🚀 Starting ADVANCED document ingestion: ${filePath}`);
      logger.info(`📋 Source ID: ${sourceId}, Version: ${version}`);
      
      // Create ingestion job
      jobId = await this.createIngestionJob(sourceId, 'advanced_ingestion', options);
      this.currentJob = jobId;
      
      // Step 1: Validate document
      await this.updateJobProgress(jobId, 'validating_document', 10);
      const validation = await this.validateDocument(filePath);
      if (!validation.isValid) {
        throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Step 2: Process with advanced pipeline
      await this.updateJobProgress(jobId, 'advanced_processing', 20);
      
      // Build advanced processing configuration from options
      const advancedConfig = this.buildAdvancedProcessingConfig(options);
      
      const processingResult = await this.advancedProcessor.ingestDocument(
        filePath, 
        sourceId, 
        version, 
        advancedConfig
      );
      
      if (!processingResult.success) {
        throw new Error(`Advanced processing failed: ${processingResult.error}`);
      }
      
      // Step 3: Store source metadata
      await this.updateJobProgress(jobId, 'storing_source_metadata', 80);
      const document = await this.documentLoader.loadDocument(filePath, sourceId, version);
      await this.storeSourceMetadata(document);
      
      // Step 4: Update statistics
      await this.updateJobProgress(jobId, 'updating_statistics', 90);
      await this.embeddingGenerator.updateSourceStats(sourceId, processingResult.chunksGenerated);
      
      // Step 5: Complete job
      await this.updateJobProgress(jobId, 'completed', 100);
      await this.completeIngestionJob(jobId, {
        totalChunks: processingResult.chunksGenerated,
        storedChunks: processingResult.chunksStored,
        embeddingsCreated: processingResult.embeddingsCreated,
        qualityScore: processingResult.qualityScore,
        processingTime: processingResult.processingTime,
        processingMethod: 'advanced',
        advancedFeatures: {
          hierarchicalChunking: true,
          multiScaleEmbeddings: true,
          qualityValidation: true
        }
      });
      
      logger.info(`✅ Advanced ingestion completed successfully`);
      const qualityScore = processingResult.qualityScore || processingResult.overallQuality || 0;
      logger.info(`📊 Generated ${processingResult.chunksGenerated} chunks with quality score ${qualityScore.toFixed(3)}`);
      
      return {
        success: true,
        jobId,
        sourceId,
        version,
        totalChunks: processingResult.chunksGenerated,
        storedChunks: processingResult.chunksStored,
        embeddingsCreated: processingResult.embeddingsCreated,
        qualityScore: processingResult.qualityScore,
        processingTime: processingResult.processingTime,
        processingMethod: 'advanced'
      };
      
    } catch (error) {
      logger.error(`❌ Advanced ingestion failed for ${sourceId}:`, error);
      
      if (jobId) {
        await this.failIngestionJob(jobId, error.message);
      }
      
      return {
        success: false,
        error: error.message,
        sourceId,
        version,
        processingMethod: 'advanced'
      };
    } finally {
      this.currentJob = null;
    }
  }

  /**
   * Ingest a single document through the complete pipeline (legacy method)
   * @param {string} filePath - Path to the document file
   * @param {string} sourceId - Unique identifier for the source
   * @param {string} version - Version of the document
   * @param {Object} options - Ingestion options
   * @returns {Object} Ingestion result
   */
  async ingestDocument(filePath, sourceId, version, options = {}) {
    let jobId = null;
    
    try {
      await this.initializeDatabase();
      
      logger.info(`🚀 Starting document ingestion: ${filePath}`);
      logger.info(`📋 Source ID: ${sourceId}, Version: ${version}`);
      
      // Create ingestion job
      jobId = await this.createIngestionJob(sourceId, 'initial_ingestion', options);
      this.currentJob = jobId;
      
      // Step 1: Validate document
      await this.updateJobProgress(jobId, 'validating_document', 10);
      const validation = await this.validateDocument(filePath);
      if (!validation.isValid) {
        throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Step 2: Load and process document
      await this.updateJobProgress(jobId, 'loading_document', 20);
      const document = await this.documentLoader.loadDocument(filePath, sourceId, version);
      
      // Step 3: Store source metadata
      await this.updateJobProgress(jobId, 'storing_source_metadata', 30);
      await this.storeSourceMetadata(document);
      
      // Step 4: Chunk document
      await this.updateJobProgress(jobId, 'chunking_document', 40);
      const chunks = await this.chunker.chunkDocument(document, options.chunkingOptions);
      
      logger.info(`📄 Document chunked into ${chunks.length} chunks`);
      
      // Step 5: Generate embeddings
      await this.updateJobProgress(jobId, 'generating_embeddings', 60);
      const chunksWithEmbeddings = await this.embeddingGenerator.generateEmbeddings(chunks, options.embeddingOptions);
      
      // Step 6: Store chunks and embeddings
      await this.updateJobProgress(jobId, 'storing_chunks', 80);
      const storedChunks = await this.embeddingGenerator.storeEmbeddings(chunksWithEmbeddings);
      
      // Step 7: Update source statistics
      await this.updateJobProgress(jobId, 'updating_statistics', 90);
      await this.embeddingGenerator.updateSourceStats(sourceId, chunks.length);
      
      // Step 8: Complete job
      await this.updateJobProgress(jobId, 'completed', 100);
      await this.completeIngestionJob(jobId, {
        totalChunks: chunks.length,
        storedChunks: storedChunks.length,
        processingStats: this.getProcessingStats(document, chunks, chunksWithEmbeddings)
      });
      
      const result = {
        success: true,
        jobId,
        sourceId,
        version,
        document: {
          fileName: document.fileName,
          fileSize: document.fileSize,
          totalPages: document.totalPages,
          characterCount: document.characterCount,
          wordCount: document.wordCount
        },
        chunks: {
          total: chunks.length,
          stored: storedChunks.length,
          averageTokens: Math.round(chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length),
          averageQuality: parseFloat((chunks.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / chunks.length).toFixed(3))
        },
        embeddings: {
          model: this.config.get('openai.embeddingModel'),
          dimension: this.config.get('vector.dimension'),
          generated: chunksWithEmbeddings.length
        }
      };
      
      logger.info('✅ Document ingestion completed successfully');
      logger.info(`📊 Result: ${result.chunks.total} chunks, ${result.embeddings.generated} embeddings`);
      
      return result;
    } catch (error) {
      logger.error('❌ Document ingestion failed:', error);
      
      if (jobId) {
        await this.failIngestionJob(jobId, error.message, {
          stack: error.stack,
          filePath,
          sourceId,
          version
        });
      }
      
      throw new Error(`Document ingestion failed: ${error.message}`);
    }
  }

  /**
   * Ingest multiple documents in batch
   * @param {Array} documents - Array of document objects {filePath, sourceId, version}
   * @param {Object} options - Batch ingestion options
   * @returns {Object} Batch ingestion result
   */
  async ingestDocumentBatch(documents, options = {}) {
    try {
      logger.info(`📚 Starting batch ingestion of ${documents.length} documents`);
      
      const results = [];
      const errors = [];
      let successCount = 0;
      let failureCount = 0;
      
      const batchStartTime = Date.now();
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const progress = Math.round(((i + 1) / documents.length) * 100);
        
        logger.info(`📄 Processing document ${i + 1}/${documents.length} (${progress}%): ${doc.filePath}`);
        
        try {
          const result = await this.ingestDocument(doc.filePath, doc.sourceId, doc.version, {
            ...options,
            batchMode: true,
            batchIndex: i,
            batchTotal: documents.length
          });
          
          results.push(result);
          successCount++;
          
          logger.info(`✅ Document ${i + 1} completed successfully`);
        } catch (error) {
          const errorResult = {
            success: false,
            filePath: doc.filePath,
            sourceId: doc.sourceId,
            version: doc.version,
            error: error.message
          };
          
          results.push(errorResult);
          errors.push(errorResult);
          failureCount++;
          
          logger.error(`❌ Document ${i + 1} failed:`, error.message);
          
          // Continue with next document unless configured to stop on error
          if (options.stopOnError) {
            break;
          }
        }
        
        // Add delay between documents if configured
        if (options.delayBetweenDocuments && i < documents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, options.delayBetweenDocuments));
        }
      }
      
      const batchEndTime = Date.now();
      const totalTime = batchEndTime - batchStartTime;
      
      const batchResult = {
        success: successCount > 0,
        totalDocuments: documents.length,
        successCount,
        failureCount,
        results,
        errors,
        processingTime: totalTime,
        averageTimePerDocument: Math.round(totalTime / documents.length),
        summary: {
          totalChunks: results.filter(r => r.success).reduce((sum, r) => sum + r.chunks.total, 0),
          totalEmbeddings: results.filter(r => r.success).reduce((sum, r) => sum + r.embeddings.generated, 0)
        }
      };
      
      logger.info('📊 Batch ingestion completed');
      logger.info(`✅ Success: ${successCount}/${documents.length} documents`);
      logger.info(`❌ Failures: ${failureCount}/${documents.length} documents`);
      logger.info(`⏱️ Total time: ${totalTime}ms (avg: ${batchResult.averageTimePerDocument}ms per doc)`);
      
      return batchResult;
    } catch (error) {
      logger.error('❌ Batch ingestion failed:', error);
      throw new Error(`Batch ingestion failed: ${error.message}`);
    }
  }

  /**
   * Re-ingest a document (update existing)
   * @param {string} sourceId - Source ID to re-ingest
   * @param {string} filePath - New file path
   * @param {string} newVersion - New version
   * @param {Object} options - Re-ingestion options
   * @returns {Object} Re-ingestion result
   */
  async reingestDocument(sourceId, filePath, newVersion, options = {}) {
    try {
      logger.info(`🔄 Re-ingesting document: ${sourceId} -> ${newVersion}`);
      
      // Check if source exists
      const existingSource = await this.getSourceInfo(sourceId);
      if (!existingSource) {
        throw new Error(`Source ${sourceId} not found`);
      }
      
      // Archive old version if configured
      if (options.archiveOldVersion) {
        await this.archiveSourceVersion(sourceId, existingSource.version);
      }
      
      // Delete old chunks if configured
      if (options.replaceExisting) {
        await this.deleteSourceChunks(sourceId);
      }
      
      // Ingest new version
      const result = await this.ingestDocument(filePath, sourceId, newVersion, {
        ...options,
        reingest: true,
        previousVersion: existingSource.version
      });
      
      logger.info(`✅ Re-ingestion completed: ${sourceId} updated to ${newVersion}`);
      
      return result;
    } catch (error) {
      logger.error('❌ Re-ingestion failed:', error);
      throw new Error(`Re-ingestion failed: ${error.message}`);
    }
  }

  /**
   * Validate document before processing
   * @param {string} filePath - Path to document
   * @returns {Object} Validation result
   */
  async validateDocument(filePath) {
    try {
      // Use DocumentLoader validation
      const validation = await this.documentLoader.validateDocument(filePath);
      
      // Additional pipeline-specific validations
      if (validation.isValid) {
        // Check if file is already being processed
        const stats = await fs.stat(filePath);
        const fileHash = await this.calculateFileHash(filePath);
        
        const existingSource = await this.db.query(`
          SELECT source_id, processing_status 
          FROM kb_sources 
          WHERE file_hash = $1 AND processing_status IN ('processing', 'pending')
        `, [fileHash]);
        
        if (existingSource.rows.length > 0) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push(`File is already being processed (${existingSource.rows[0].source_id})`);
        }
      }
      
      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Calculate file hash for integrity checking
   * @param {string} filePath - Path to file
   * @returns {string} SHA-256 hash
   */
  async calculateFileHash(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Store source metadata in database
   * @param {Object} document - Document object
   */
  async storeSourceMetadata(document) {
    try {
      await this.db.query(`
        INSERT INTO kb_sources (
          source_id, filename, file_path, file_size, file_hash, version,
          document_type, title, author, creation_date, total_pages,
          processing_status, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'processing', $12
        )
        ON CONFLICT (source_id) DO UPDATE SET
          filename = EXCLUDED.filename,
          file_path = EXCLUDED.file_path,
          file_size = EXCLUDED.file_size,
          file_hash = EXCLUDED.file_hash,
          version = EXCLUDED.version,
          document_type = EXCLUDED.document_type,
          title = EXCLUDED.title,
          author = EXCLUDED.author,
          creation_date = EXCLUDED.creation_date,
          total_pages = EXCLUDED.total_pages,
          processing_status = 'processing',
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
      `, [
        document.sourceId,
        document.fileName,
        document.filePath,
        document.fileSize,
        document.fileHash,
        document.version,
        document.mimeType,
        document.title,
        document.author,
        document.creationDate,
        document.totalPages,
        JSON.stringify(document.metadata)
      ]);
      
      logger.info(`📝 Source metadata stored: ${document.sourceId}`);
    } catch (error) {
      logger.error('❌ Failed to store source metadata:', error);
      throw error;
    }
  }

  /**
   * Create ingestion job record
   * @param {string} sourceId - Source ID
   * @param {string} jobType - Job type
   * @param {Object} options - Job options
   * @returns {string} Job ID
   */
  async createIngestionJob(sourceId, jobType, options = {}) {
    try {
      const result = await this.db.query(`
        INSERT INTO ingestion_jobs (
          source_id, job_type, job_status, total_steps, configuration
        ) VALUES ($1, $2, 'pending', 8, $3)
        RETURNING job_id
      `, [sourceId, jobType, JSON.stringify(options)]);
      
      const jobId = result.rows[0].job_id;
      logger.info(`📋 Ingestion job created: ${jobId}`);
      
      return jobId;
    } catch (error) {
      logger.error('❌ Failed to create ingestion job:', error);
      throw error;
    }
  }

  /**
   * Update job progress
   * @param {string} jobId - Job ID
   * @param {string} currentStep - Current step
   * @param {number} progressPercentage - Progress percentage
   */
  async updateJobProgress(jobId, currentStep, progressPercentage) {
    try {
      await this.db.query(`
        UPDATE ingestion_jobs 
        SET 
          current_step = $2,
          progress_percentage = $3,
          job_status = CASE WHEN $3 >= 100 THEN 'completed' ELSE 'running' END,
          started_at = CASE WHEN started_at IS NULL THEN NOW() ELSE started_at END,
          updated_at = NOW()
        WHERE job_id = $1
      `, [jobId, currentStep, progressPercentage]);
      
      logger.info(`📈 Job progress: ${currentStep} (${progressPercentage}%)`);
    } catch (error) {
      logger.warn('⚠️ Failed to update job progress:', error.message);
    }
  }

  /**
   * Complete ingestion job
   * @param {string} jobId - Job ID
   * @param {Object} stats - Processing statistics
   */
  async completeIngestionJob(jobId, stats) {
    try {
      await this.db.query(`
        UPDATE ingestion_jobs 
        SET 
          job_status = 'completed',
          completed_at = NOW(),
          chunks_processed = $2,
          embeddings_generated = $3,
          processing_stats = $4,
          updated_at = NOW()
        WHERE job_id = $1
      `, [jobId, stats.totalChunks, stats.storedChunks, JSON.stringify(stats.processingStats)]);
      
      logger.info(`✅ Ingestion job completed: ${jobId}`);
    } catch (error) {
      logger.warn('⚠️ Failed to complete ingestion job:', error.message);
    }
  }

  /**
   * Fail ingestion job
   * @param {string} jobId - Job ID
   * @param {string} errorMessage - Error message
   * @param {Object} errorDetails - Error details
   */
  async failIngestionJob(jobId, errorMessage, errorDetails) {
    try {
      await this.db.query(`
        UPDATE ingestion_jobs 
        SET 
          job_status = 'failed',
          completed_at = NOW(),
          error_message = $2,
          error_details = $3,
          updated_at = NOW()
        WHERE job_id = $1
      `, [jobId, errorMessage, JSON.stringify(errorDetails)]);
      
      logger.error(`❌ Ingestion job failed: ${jobId} - ${errorMessage}`);
    } catch (error) {
      logger.warn('⚠️ Failed to update failed job:', error.message);
    }
  }

  /**
   * Get source information
   * @param {string} sourceId - Source ID
   * @returns {Object|null} Source information
   */
  async getSourceInfo(sourceId) {
    try {
      const result = await this.db.query(`
        SELECT * FROM kb_sources WHERE source_id = $1
      `, [sourceId]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('❌ Failed to get source info:', error);
      return null;
    }
  }

  /**
   * Delete chunks for a source
   * @param {string} sourceId - Source ID
   */
  async deleteSourceChunks(sourceId) {
    try {
      const result = await this.db.query(`
        DELETE FROM kb_chunks WHERE source_id = $1
      `, [sourceId]);
      
      logger.info(`🗑️ Deleted ${result.rowCount} chunks for source: ${sourceId}`);
    } catch (error) {
      logger.error('❌ Failed to delete source chunks:', error);
      throw error;
    }
  }

  /**
   * Archive source version
   * @param {string} sourceId - Source ID
   * @param {string} version - Version to archive
   */
  async archiveSourceVersion(sourceId, version) {
    try {
      // This is a placeholder - in production, you might move data to an archive table
      await this.db.query(`
        UPDATE kb_chunks 
        SET metadata = jsonb_set(metadata, '{archived}', 'true')
        WHERE source_id = $1 AND version = $2
      `, [sourceId, version]);
      
      logger.info(`📦 Archived version ${version} for source: ${sourceId}`);
    } catch (error) {
      logger.error('❌ Failed to archive source version:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   * @param {Object} document - Document object
   * @param {Array} chunks - Chunks array
   * @param {Array} chunksWithEmbeddings - Chunks with embeddings
   * @returns {Object} Processing statistics
   */
  getProcessingStats(document, chunks, chunksWithEmbeddings) {
    const chunkStats = this.chunker.getChunkingStats(chunks);
    
    return {
      document: {
        fileName: document.fileName,
        fileSize: document.fileSize,
        processingTime: document.processingTime,
        totalPages: document.totalPages,
        characterCount: document.characterCount,
        wordCount: document.wordCount,
        qualityScore: document.qualityScore
      },
      chunking: chunkStats,
      embeddings: {
        model: this.config.get('openai.embeddingModel'),
        dimension: this.config.get('vector.dimension'),
        generated: chunksWithEmbeddings.length,
        cached: chunksWithEmbeddings.filter(c => c.fromCache).length,
        apiCalls: chunksWithEmbeddings.filter(c => !c.fromCache).length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get ingestion job status
   * @param {string} jobId - Job ID
   * @returns {Object|null} Job status
   */
  async getJobStatus(jobId) {
    try {
      const result = await this.db.query(`
        SELECT 
          job_id,
          source_id,
          job_type,
          job_status,
          progress_percentage,
          current_step,
          started_at,
          completed_at,
          chunks_processed,
          embeddings_generated,
          error_message,
          processing_stats
        FROM ingestion_jobs 
        WHERE job_id = $1
      `, [jobId]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('❌ Failed to get job status:', error);
      return null;
    }
  }

  /**
   * List ingestion jobs
   * @param {Object} filters - Filter options
   * @returns {Array} Array of jobs
   */
  async listJobs(filters = {}) {
    try {
      let query = `
        SELECT 
          job_id,
          source_id,
          job_type,
          job_status,
          progress_percentage,
          current_step,
          started_at,
          completed_at,
          chunks_processed,
          embeddings_generated,
          error_message
        FROM ingestion_jobs
      `;
      
      const conditions = [];
      const params = [];
      
      if (filters.sourceId) {
        conditions.push(`source_id = $${params.length + 1}`);
        params.push(filters.sourceId);
      }
      
      if (filters.status) {
        conditions.push(`job_status = $${params.length + 1}`);
        params.push(filters.status);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ` ORDER BY created_at DESC`;
      
      if (filters.limit) {
        query += ` LIMIT ${parseInt(filters.limit)}`;
      }
      
      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('❌ Failed to list jobs:', error);
      return [];
    }
  }

  /**
   * Build advanced processing configuration from UI options
   * @param {Object} options - UI configuration options
   * @returns {Object} Advanced processing configuration
   */
  buildAdvancedProcessingConfig(options) {
    const defaultConfig = {
      enableHierarchicalChunking: true,
      enableMultiScaleEmbeddings: true,
      enableAdvancedRetrieval: true,
      enableQualityValidation: true,
      batchSize: 5
    };

    // Merge with provided options
    const config = { ...defaultConfig, ...options };

    // Build hierarchical chunking configuration
    if (config.enableHierarchicalChunking && config.hierarchicalChunkingOptions) {
      config.hierarchicalChunking = {
        enabled: true,
        scales: {
          document: { enabled: true, minTokens: 1000, maxTokens: 4000, targetTokens: 2000, overlapTokens: 200 },
          section: { enabled: true, minTokens: 300, maxTokens: 1200, targetTokens: 600, overlapTokens: 100 },
          paragraph: { enabled: true, minTokens: 100, maxTokens: 500, targetTokens: 250, overlapTokens: 50 },
          sentence: { enabled: true, minTokens: 20, maxTokens: 150, targetTokens: 75, overlapTokens: 10 }
        },
        semanticCoherence: {
          enabled: config.hierarchicalChunkingOptions.semanticBoundaryDetection || true,
          sentenceSimilarityThreshold: config.hierarchicalChunkingOptions.sentenceSimilarityThreshold || 0.3,
          paragraphSimilarityThreshold: 0.4,
          sectionSimilarityThreshold: 0.5
        },
        qualityThresholds: {
          minTokenCount: config.hierarchicalChunkingOptions.qualityThresholds?.minTokenCount || 50,
          maxTokenCount: config.hierarchicalChunkingOptions.qualityThresholds?.maxTokenCount || 800,
          minQualityScore: config.hierarchicalChunkingOptions.qualityThresholds?.minQualityScore || 0.6
        },
        hierarchicalRelationships: {
          enableParentChildLinks: config.hierarchicalChunkingOptions.enableParentChildLinks !== false,
          enableSiblingLinks: config.hierarchicalChunkingOptions.enableSiblingLinks !== false,
          enableCrossReferences: true
        }
      };
    }

    // Build multi-scale embedding configuration
    if (config.enableMultiScaleEmbeddings && config.multiScaleEmbeddingOptions) {
      config.multiScaleEmbeddings = {
        enabled: true,
        embeddingTypes: {
          content: config.multiScaleEmbeddingOptions.embeddingTypes?.content !== false,
          contextual: config.multiScaleEmbeddingOptions.embeddingTypes?.contextual !== false,
          hierarchical: config.multiScaleEmbeddingOptions.embeddingTypes?.hierarchical !== false,
          semantic: config.multiScaleEmbeddingOptions.embeddingTypes?.semantic !== false
        },
        domainOptimization: {
          enabled: config.multiScaleEmbeddingOptions.domainOptimization?.enabled !== false,
          domain: config.multiScaleEmbeddingOptions.domainOptimization?.domain || 'fundManagement',
          keywordBoost: config.multiScaleEmbeddingOptions.domainOptimization?.keywordBoost || 1.2,
          strategies: {
            selectiveBoost: true,
            weightedEnhancement: true,
            dimensionalFocus: true
          }
        },
        qualityValidation: {
          enabled: config.multiScaleEmbeddingOptions.qualityValidation?.enabled !== false,
          minQualityThreshold: config.multiScaleEmbeddingOptions.qualityValidation?.minQualityThreshold || 0.7,
          validateDimensions: true
        },
        caching: {
          enabled: true,
          maxCacheSize: 1000,
          cacheExpiration: 3600000 // 1 hour
        }
      };
    }

    // Build advanced retrieval configuration
    if (config.enableAdvancedRetrieval && config.advancedRetrievalOptions) {
      config.advancedRetrieval = {
        enabled: true,
        strategies: {
          vectorOnly: config.advancedRetrievalOptions.strategies?.vectorOnly !== false,
          hybrid: config.advancedRetrievalOptions.strategies?.hybrid !== false,
          multiScale: config.advancedRetrievalOptions.strategies?.multiScale !== false,
          contextual: config.advancedRetrievalOptions.strategies?.contextual !== false
        },
        contextExpansion: {
          enabled: config.advancedRetrievalOptions.contextExpansion?.enabled !== false,
          hierarchicalExpansion: config.advancedRetrievalOptions.contextExpansion?.hierarchicalExpansion !== false,
          semanticExpansion: config.advancedRetrievalOptions.contextExpansion?.semanticExpansion !== false,
          temporalExpansion: false,
          maxExpansionChunks: config.advancedRetrievalOptions.contextExpansion?.maxExpansionChunks || 3
        },
        lostInMiddleMitigation: {
          enabled: config.advancedRetrievalOptions.lostInMiddleMitigation?.enabled !== false,
          reorderByRelevance: config.advancedRetrievalOptions.lostInMiddleMitigation?.reorderByRelevance !== false,
          interleaveChunks: config.advancedRetrievalOptions.lostInMiddleMitigation?.interleaveChunks !== false,
          maxReorderDistance: 5
        },
        qualityOptimization: {
          enabled: config.advancedRetrievalOptions.qualityOptimization?.enabled !== false,
          coherenceScoring: config.advancedRetrievalOptions.qualityOptimization?.coherenceScoring !== false,
          redundancyReduction: config.advancedRetrievalOptions.qualityOptimization?.redundancyReduction !== false,
          complementarityMaximization: config.advancedRetrievalOptions.qualityOptimization?.complementarityMaximization !== false,
          minCoherenceScore: 0.6,
          maxRedundancyScore: 0.8
        }
      };
    }

    // Build quality thresholds
    config.qualityThresholds = {
      minChunkQuality: 0.6,
      minEmbeddingQuality: 0.7,
      minOverallQuality: 0.65,
      maxErrorRate: 0.1
    };

    // Build batch processing options
    config.batchProcessing = {
      enabled: true,
      batchSize: config.batchSize || 5,
      parallelProcessing: true,
      maxConcurrentJobs: 3,
      progressReporting: true
    };

    return config;
  }

  /**
   * Get ingestion pipeline statistics
   * @returns {Object} Pipeline statistics
   */
  async getPipelineStats() {
    try {
      const [jobStats, sourceStats, chunkStats] = await Promise.all([
        this.db.query(`
          SELECT 
            job_status,
            COUNT(*) as count,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
          FROM ingestion_jobs 
          GROUP BY job_status
        `),
        this.db.query(`
          SELECT 
            COUNT(*) as total_sources,
            COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_sources,
            COUNT(*) FILTER (WHERE processing_status = 'processing') as processing_sources,
            COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_sources
          FROM kb_sources
        `),
        this.db.query(`
          SELECT 
            COUNT(*) as total_chunks,
            AVG(token_count) as avg_tokens,
            AVG(quality_score) as avg_quality
          FROM kb_chunks
        `)
      ]);
      
      return {
        jobs: jobStats.rows.reduce((acc, row) => {
          acc[row.job_status] = {
            count: parseInt(row.count),
            averageDuration: parseFloat(row.avg_duration) || 0
          };
          return acc;
        }, {}),
        sources: sourceStats.rows[0],
        chunks: chunkStats.rows[0]
      };
    } catch (error) {
      logger.error('❌ Failed to get pipeline stats:', error);
      return null;
    }
  }
}

module.exports = IngestionPipeline;
