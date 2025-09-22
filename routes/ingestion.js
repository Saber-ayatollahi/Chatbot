/**
 * Ingestion Routes
 * API endpoints for document ingestion and advanced processing configuration
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

// Try to load multer, fallback if not available
let multer;
try {
  multer = require('multer');
} catch (error) {
  console.warn('⚠️ Multer not installed - file upload will be disabled');
  multer = null;
}
const IngestionPipeline = require('../knowledge/ingestion/IngestionPipeline');
const ComprehensiveEnhancedIngestionService = require('../services/ComprehensiveEnhancedIngestionService');
const logger = require('../utils/logger');
const { body, query, param, validationResult } = require('express-validator');

class IngestionRoutes {
  constructor() {
    this.pipeline = new IngestionPipeline();
    this.advancedProcessor = new ComprehensiveEnhancedIngestionService();
    this.initialized = false;
    this.db = null;
    
    // Configure multer for file uploads if available
    if (multer) {
      this.upload = multer({
        dest: 'uploads/temp/',
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB limit
          files: 10 // Max 10 files at once
        },
        fileFilter: (req, file, cb) => {
          const allowedTypes = ['.pdf', '.docx', '.txt', '.md', '.json'];
          const ext = path.extname(file.originalname).toLowerCase();
          if (allowedTypes.includes(ext)) {
            cb(null, true);
          } else {
            cb(new Error(`File type ${ext} not supported`), false);
          }
        }
      });
    } else {
      this.upload = {
        array: () => (req, res, next) => {
          res.status(501).json({
            success: false,
            error: 'File upload not available - multer not installed'
          });
        }
      };
    }
  }

  /**
   * Initialize ingestion routes
   */
  async initialize(database = null) {
    try {
      // Set up database connection
      if (database) {
        this.db = database;
      } else {
        // Fallback to getting database instance
        const { getDatabase } = require('../config/database');
        this.db = getDatabase();
      }
      
      this.setupRoutes();
      this.initialized = true;
      logger.info('Ingestion Routes initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Ingestion Routes:', error);
      throw error;
    }
  }

  /**
   * Setup all ingestion routes
   */
  setupRoutes() {
    // File upload endpoint
    router.post('/upload', 
      this.upload.array('files', 10),
      this.validateUpload.bind(this),
      this.handleFileUpload.bind(this)
    );

    // Start advanced processing
    router.post('/process/advanced',
      [
        body('filePath').notEmpty().withMessage('File path is required'),
        body('sourceId').notEmpty().withMessage('Source ID is required'),
        body('version').optional().isString(),
        body('config').optional().isObject()
      ],
      this.validateRequest.bind(this),
      this.handleAdvancedProcessing.bind(this)
    );

    // Start standard processing
    router.post('/process/standard',
      [
        body('filePath').notEmpty().withMessage('File path is required'),
        body('sourceId').notEmpty().withMessage('Source ID is required'),
        body('version').optional().isString(),
        body('options').optional().isObject()
      ],
      this.validateRequest.bind(this),
      this.handleStandardProcessing.bind(this)
    );

    // Batch processing
    router.post('/process/batch',
      [
        body('documents').isArray().withMessage('Documents array is required'),
        body('documents.*.filePath').notEmpty().withMessage('File path is required for each document'),
        body('documents.*.sourceId').notEmpty().withMessage('Source ID is required for each document'),
        body('config').optional().isObject()
      ],
      this.validateRequest.bind(this),
      this.handleBatchProcessing.bind(this)
    );

    // Get job status
    router.get('/jobs/:jobId',
      [param('jobId').notEmpty().withMessage('Job ID is required')],
      this.validateRequest.bind(this),
      this.getJobStatus.bind(this)
    );

    // List jobs
    router.get('/jobs',
      [
        query('sourceId').optional().isString(),
        query('status').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled']),
        query('limit').optional().isInt({ min: 1, max: 100 })
      ],
      this.validateRequest.bind(this),
      this.listJobs.bind(this)
    );

    // Cancel job
    router.post('/jobs/:jobId/cancel',
      [param('jobId').notEmpty().withMessage('Job ID is required')],
      this.validateRequest.bind(this),
      this.cancelJob.bind(this)
    );

    // Get pipeline statistics
    router.get('/stats',
      this.getPipelineStats.bind(this)
    );

    // Get advanced processing configuration templates
    router.get('/config/templates',
      this.getConfigTemplates.bind(this)
    );

    // Validate configuration
    router.post('/config/validate',
      [body('config').isObject().withMessage('Configuration object is required')],
      this.validateRequest.bind(this),
      this.validateConfiguration.bind(this)
    );

    // Test processing pipeline
    router.post('/test',
      [body('testDocument').optional().isObject()],
      this.validateRequest.bind(this),
      this.testPipeline.bind(this)
    );

    // List available files for ingestion
    router.get('/files/available',
      this.listAvailableFiles.bind(this)
    );

    // Run ingestion on existing files
    router.post('/files/ingest',
      [
        body('files').isArray().withMessage('Files array is required'),
        body('files.*.filePath').notEmpty().withMessage('File path is required for each file'),
        body('config').optional().isObject()
      ],
      this.validateRequest.bind(this),
      this.handleFileIngestion.bind(this)
    );
  }

  /**
   * Validate file upload
   */
  validateUpload(req, res, next) {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    next();
  }

  /**
   * Validate request parameters
   */
  validateRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(req, res) {
    try {
      const uploadResults = [];
      
      for (const file of req.files) {
        const uploadResult = {
          uploadId: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalName: file.originalname,
          filename: file.filename,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString()
        };
        
        uploadResults.push(uploadResult);
      }

      res.json({
        success: true,
        message: `${uploadResults.length} files uploaded successfully`,
        uploads: uploadResults
      });

    } catch (error) {
      logger.error('File upload failed:', error);
      res.status(500).json({
        success: false,
        error: 'File upload failed',
        message: error.message
      });
    }
  }

  /**
   * Handle advanced document processing
   */
  async handleAdvancedProcessing(req, res) {
    try {
      const { filePath, sourceId, version = '1.0', config = {} } = req.body;

      logger.info(`Starting advanced processing: ${sourceId}`);

      const result = await this.pipeline.ingestDocumentAdvanced(
        filePath,
        sourceId,
        version,
        config
      );

      res.json({
        success: true,
        message: 'Advanced processing started successfully',
        jobId: result.jobId,
        result
      });

    } catch (error) {
      logger.error('Advanced processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Advanced processing failed',
        message: error.message
      });
    }
  }

  /**
   * Handle standard document processing
   */
  async handleStandardProcessing(req, res) {
    try {
      const { filePath, sourceId, version = '1.0', options = {} } = req.body;

      logger.info(`Starting standard processing: ${sourceId}`);

      const result = await this.pipeline.ingestDocument(
        filePath,
        sourceId,
        version,
        options
      );

      res.json({
        success: true,
        message: 'Standard processing completed successfully',
        result
      });

    } catch (error) {
      logger.error('Standard processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Standard processing failed',
        message: error.message
      });
    }
  }

  /**
   * Handle batch processing
   */
  async handleBatchProcessing(req, res) {
    try {
      const { documents, config = { method: 'advanced' } } = req.body;
      
      // Ensure we always use the advanced method by default
      if (!config.method) {
        config.method = 'advanced';
      }
      
      // Apply confidence threshold if provided
      if (config.confidenceThreshold !== undefined) {
        process.env.CONFIDENCE_THRESHOLD = config.confidenceThreshold.toString();
        logger.info(`Applied confidence threshold: ${config.confidenceThreshold}`);
      }

      logger.info(`Starting batch processing: ${documents.length} documents`);

      const result = await this.pipeline.ingestDocumentBatch(documents, config);

      res.json({
        success: true,
        message: 'Batch processing completed',
        result
      });

    } catch (error) {
      logger.error('Batch processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Batch processing failed',
        message: error.message
      });
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const jobStatus = await this.pipeline.getJobStatus(jobId);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      res.json({
        success: true,
        job: jobStatus
      });

    } catch (error) {
      logger.error('Failed to get job status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status',
        message: error.message
      });
    }
  }

  /**
   * List jobs
   */
  async listJobs(req, res) {
    try {
      const filters = {
        sourceId: req.query.sourceId,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 50
      };

      const jobs = await this.pipeline.listJobs(filters);

      res.json({
        success: true,
        jobs,
        count: jobs.length
      });

    } catch (error) {
      logger.error('Failed to list jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list jobs',
        message: error.message
      });
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(req, res) {
    try {
      const { jobId } = req.params;
      
      // Implementation would depend on job management system
      // For now, just update job status
      await this.pipeline.failIngestionJob(jobId, 'Cancelled by user', { cancelled: true });

      res.json({
        success: true,
        message: 'Job cancelled successfully'
      });

    } catch (error) {
      logger.error('Failed to cancel job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel job',
        message: error.message
      });
    }
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(req, res) {
    try {
      const stats = await this.pipeline.getPipelineStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Failed to get pipeline stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pipeline stats',
        message: error.message
      });
    }
  }

  /**
   * Get configuration templates
   */
  async getConfigTemplates(req, res) {
    try {
      const templates = {
        advanced: {
          name: 'Advanced Processing',
          description: 'Full advanced document processing with all features enabled',
          config: {
            enableHierarchicalChunking: true,
            enableMultiScaleEmbeddings: true,
            enableAdvancedRetrieval: true,
            enableQualityValidation: true,
            hierarchicalChunkingOptions: {
              semanticBoundaryDetection: true,
              sentenceSimilarityThreshold: 0.3,
              enableParentChildLinks: true,
              enableSiblingLinks: true,
              qualityThresholds: {
                minTokenCount: 50,
                maxTokenCount: 800,
                minQualityScore: 0.6
              }
            },
            multiScaleEmbeddingOptions: {
              embeddingTypes: {
                content: true,
                contextual: true,
                hierarchical: true,
                semantic: true
              },
              domainOptimization: {
                enabled: true,
                domain: 'fundManagement',
                keywordBoost: 1.2
              },
              qualityValidation: {
                enabled: true,
                minQualityThreshold: 0.7
              }
            },
            advancedRetrievalOptions: {
              strategies: {
                vectorOnly: true,
                hybrid: true,
                multiScale: true,
                contextual: true
              },
              contextExpansion: {
                enabled: true,
                hierarchicalExpansion: true,
                semanticExpansion: true,
                maxExpansionChunks: 3
              },
              lostInMiddleMitigation: {
                enabled: true,
                reorderByRelevance: true,
                interleaveChunks: true
              },
              qualityOptimization: {
                enabled: true,
                coherenceScoring: true,
                redundancyReduction: true,
                complementarityMaximization: true
              }
            }
          }
        },
        standard: {
          name: 'Standard Processing',
          description: 'Standard document processing with basic features',
          config: {
            enableHierarchicalChunking: false,
            enableMultiScaleEmbeddings: false,
            enableAdvancedRetrieval: false,
            enableQualityValidation: true,
            batchSize: 5
          }
        },
        fast: {
          name: 'Fast Processing',
          description: 'Optimized for speed with minimal advanced features',
          config: {
            enableHierarchicalChunking: false,
            enableMultiScaleEmbeddings: false,
            enableAdvancedRetrieval: false,
            enableQualityValidation: false,
            batchSize: 10
          }
        }
      };

      res.json({
        success: true,
        templates
      });

    } catch (error) {
      logger.error('Failed to get config templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get config templates',
        message: error.message
      });
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(req, res) {
    try {
      const { config } = req.body;
      const validation = this.validateConfig(config);

      res.json({
        success: true,
        validation
      });

    } catch (error) {
      logger.error('Configuration validation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Configuration validation failed',
        message: error.message
      });
    }
  }

  /**
   * Test processing pipeline
   */
  async testPipeline(req, res) {
    try {
      const { testDocument } = req.body;
      const result = await this.advancedProcessor.testProcessingPipeline(testDocument);

      res.json({
        success: true,
        message: 'Pipeline test completed',
        result
      });

    } catch (error) {
      logger.error('Pipeline test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Pipeline test failed',
        message: error.message
      });
    }
  }

  /**
   * List available files for ingestion
   */
  async listAvailableFiles(req, res) {
    try {
      const documentsDir = path.join(process.cwd(), 'knowledge_base', 'documents');
      const archivesDir = path.join(process.cwd(), 'knowledge_base', 'archives');
      
      // Ensure directories exist
      await fs.ensureDir(documentsDir);
      await fs.ensureDir(archivesDir);
      
      const files = await fs.readdir(documentsDir);
      const availableFiles = [];
      
      for (const filename of files) {
        const filePath = path.join(documentsDir, filename);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const ext = path.extname(filename).toLowerCase();
          const allowedTypes = ['.pdf', '.docx', '.txt', '.md', '.json'];
          
          if (allowedTypes.includes(ext)) {
            availableFiles.push({
              filename,
              filePath,
              relativePath: path.join('knowledge_base', 'documents', filename),
              fileSize: stats.size,
              lastModified: stats.mtime.toISOString(),
              documentType: ext.substring(1), // Remove the dot
              status: 'available'
            });
          }
        }
      }
      
      res.json({
        success: true,
        files: availableFiles,
        count: availableFiles.length,
        documentsDirectory: documentsDir,
        archivesDirectory: archivesDir
      });

    } catch (error) {
      logger.error('Failed to list available files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list available files',
        message: error.message
      });
    }
  }

  /**
   * Handle file ingestion from existing files
   */
  async handleFileIngestion(req, res) {
    try {
      const { files, config = { method: 'advanced' } } = req.body;
      
      // Ensure we always use the advanced method by default
      if (!config.method) {
        config.method = 'advanced';
      }
      
      // Apply confidence threshold if provided
      if (config.confidenceThreshold !== undefined) {
        process.env.CONFIDENCE_THRESHOLD = config.confidenceThreshold.toString();
        logger.info(`Applied confidence threshold: ${config.confidenceThreshold}`);
      }
      
      const results = [];
      const archivesDir = path.join(process.cwd(), 'knowledge_base', 'archives');
      
      // Ensure archives directory exists
      await fs.ensureDir(archivesDir);
      
      logger.info(`Starting ingestion of ${files.length} files`);

      for (const fileInfo of files) {
        const { filePath } = fileInfo;
        const filename = path.basename(filePath);
        const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          // Check if file exists
          if (!await fs.pathExists(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }

          // Check if file is already processed by filename
          const existingFileQuery = 'SELECT source_id, processing_status FROM kb_sources WHERE filename = $1';
          const existingFileResult = await this.db.query(existingFileQuery, [filename]);
          
          if (existingFileResult.rows.length > 0) {
            const existingFile = existingFileResult.rows[0];
            if (existingFile.processing_status === 'completed') {
              throw new Error(`File "${filename}" is already processed (source_id: ${existingFile.source_id})`);
            }
          }

          // Get file stats for source record
          const stats = await fs.stat(filePath);
          const fileBuffer = await fs.readFile(filePath);
          const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          
          // Create document source record first using the existing database connection
          await this.createSourceRecord(sourceId, filename, filePath, stats.size, fileHash);

          // Start processing based on method
          let processingResult;
          if (config.method === 'advanced') {
            processingResult = await this.pipeline.ingestDocumentAdvanced(
              filePath,
              sourceId,
              '1.0',
              config
            );
          } else {
            processingResult = await this.pipeline.ingestDocument(
              filePath,
              sourceId,
              '1.0',
              config
            );
          }

          // If processing was successful, verify database storage before copying file
          let finalArchivePath = null;
          if (processingResult && (processingResult.success !== false)) {
            // Verify that chunks were actually stored in database
            const verificationQuery = 'SELECT COUNT(*) as chunk_count FROM kb_chunks WHERE source_id = $1';
            const verificationResult = await this.db.query(verificationQuery, [sourceId]);
            const actualChunks = parseInt(verificationResult.rows[0].chunk_count);
            
            if (actualChunks > 0) {
              // Copy file to archives with source ID and timestamp (leave original untouched)
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const ext = path.extname(filename);
              const nameWithoutExt = path.basename(filename, ext);
              const archivedFilename = `${nameWithoutExt}_${sourceId}_${timestamp}${ext}`;
              finalArchivePath = path.join(archivesDir, archivedFilename);
              
              await fs.copy(filePath, finalArchivePath);
              
              logger.info(`✅ Successfully processed and archived: ${filename} -> ${archivedFilename} (${actualChunks} chunks stored, original preserved)`);
            } else {
              throw new Error(`No chunks found in database for source ${sourceId}`);
            }
            
            results.push({
              filename,
              sourceId,
              status: 'success',
              originalPath: filePath,
              archivedPath: finalArchivePath,
              processingResult,
              jobId: processingResult.jobId || null
            });
            
            logger.info(`✅ Successfully processed and archived: ${filename}`);
          } else {
            throw new Error('Processing failed - no success result');
          }

        } catch (error) {
          logger.error(`❌ Failed to process ${filename}:`, error);
          results.push({
            filename,
            sourceId,
            status: 'error',
            originalPath: filePath,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      res.json({
        success: true,
        message: `Ingestion completed: ${successCount} successful, ${errorCount} failed`,
        results,
        summary: {
          total: files.length,
          successful: successCount,
          failed: errorCount
        }
      });

    } catch (error) {
      logger.error('File ingestion failed:', error);
      res.status(500).json({
        success: false,
        error: 'File ingestion failed',
        message: error.message
      });
    }
  }

  /**
   * Validate configuration object
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate basic structure
    if (typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { isValid: false, errors, warnings };
    }

    // Validate hierarchical chunking options
    if (config.enableHierarchicalChunking && config.hierarchicalChunkingOptions) {
      const hcOptions = config.hierarchicalChunkingOptions;
      
      if (hcOptions.sentenceSimilarityThreshold && 
          (hcOptions.sentenceSimilarityThreshold < 0 || hcOptions.sentenceSimilarityThreshold > 1)) {
        errors.push('Sentence similarity threshold must be between 0 and 1');
      }

      if (hcOptions.qualityThresholds) {
        const qt = hcOptions.qualityThresholds;
        if (qt.minTokenCount && qt.maxTokenCount && qt.minTokenCount >= qt.maxTokenCount) {
          errors.push('Min token count must be less than max token count');
        }
      }
    }

    // Validate multi-scale embedding options
    if (config.enableMultiScaleEmbeddings && config.multiScaleEmbeddingOptions) {
      const mseOptions = config.multiScaleEmbeddingOptions;
      
      if (mseOptions.embeddingTypes) {
        const enabledTypes = Object.values(mseOptions.embeddingTypes).filter(Boolean).length;
        if (enabledTypes === 0) {
          warnings.push('No embedding types enabled - at least one should be enabled');
        }
      }

      if (mseOptions.domainOptimization && mseOptions.domainOptimization.keywordBoost) {
        const boost = mseOptions.domainOptimization.keywordBoost;
        if (boost < 1 || boost > 2) {
          warnings.push('Keyword boost should typically be between 1.0 and 2.0');
        }
      }
    }

    // Validate advanced retrieval options
    if (config.enableAdvancedRetrieval && config.advancedRetrievalOptions) {
      const arOptions = config.advancedRetrievalOptions;
      
      if (arOptions.strategies) {
        const enabledStrategies = Object.values(arOptions.strategies).filter(Boolean).length;
        if (enabledStrategies === 0) {
          warnings.push('No retrieval strategies enabled - at least one should be enabled');
        }
      }

      if (arOptions.contextExpansion && arOptions.contextExpansion.maxExpansionChunks) {
        const maxChunks = arOptions.contextExpansion.maxExpansionChunks;
        if (maxChunks < 1 || maxChunks > 10) {
          warnings.push('Max expansion chunks should typically be between 1 and 10');
        }
      }
    }

    // Validate batch size
    if (config.batchSize && (config.batchSize < 1 || config.batchSize > 20)) {
      warnings.push('Batch size should typically be between 1 and 20');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations: this.generateConfigRecommendations(config)
    };
  }

  /**
   * Generate configuration recommendations
   */
  generateConfigRecommendations(config) {
    const recommendations = [];

    if (config.enableHierarchicalChunking && !config.enableMultiScaleEmbeddings) {
      recommendations.push('Consider enabling multi-scale embeddings for better hierarchical chunk representation');
    }

    if (config.enableMultiScaleEmbeddings && !config.enableAdvancedRetrieval) {
      recommendations.push('Enable advanced retrieval to fully utilize multi-scale embeddings');
    }

    if (config.enableAdvancedRetrieval && !config.advancedRetrievalOptions?.qualityOptimization?.enabled) {
      recommendations.push('Enable quality optimization for better retrieval results');
    }

    return recommendations;
  }

  /**
   * Create source record in database
   */
  async createSourceRecord(sourceId, filename, filePath, fileSize, fileHash) {
    const { Pool } = require('pg');
    const pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'fund_management_chatbot',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
    });

    const client = await pool.connect();
    try {
      // Insert source record
      const sourceQuery = `
        INSERT INTO kb_sources (
          source_id, filename, file_path, file_size, file_hash, version, 
          document_type, processing_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (source_id) DO UPDATE SET
          file_path = EXCLUDED.file_path,
          file_size = EXCLUDED.file_size,
          file_hash = EXCLUDED.file_hash,
          processing_status = 'pending',
          updated_at = NOW()
      `;
      
      const ext = path.extname(filename).substring(1).toLowerCase();
      await client.query(sourceQuery, [
        sourceId,
        filename,
        filePath,
        fileSize,
        fileHash,
        '1.0',
        ext,
        'pending'
      ]);
    } finally {
      client.release();
      await pool.end();
    }
  }

  /**
   * Get router instance
   */
  getRouter() {
    return router;
  }
}

// Create and export the routes instance
const ingestionRoutes = new IngestionRoutes();

module.exports = {
  IngestionRoutes,
  router,
  initialize: (database) => ingestionRoutes.initialize(database),
  getRouter: () => ingestionRoutes.getRouter()
};
