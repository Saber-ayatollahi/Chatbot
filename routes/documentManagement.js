/**
 * Document Management API Routes
 * Provides endpoints for document management, file system scanning, and database comparison
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getDatabase } = require('../config/database');

/**
 * Get all documents from knowledge base folder and compare with database
 */
router.get('/documents/status', async (req, res) => {
  try {
    console.log('📊 Fetching document status comparison...');
    const db = getDatabase();
    
    // Define knowledge base paths - scan both documents and archives folders
    const documentsPath = path.join(__dirname, '..', 'knowledge_base', 'documents');
    const archivesPath = path.join(__dirname, '..', 'knowledge_base', 'archives');
    
    // Scan file system for documents
    const fileSystemDocs = [];
    
    // Scan documents folder (original files - these are the primary files to show)
    try {
      await fs.access(documentsPath);
      const documentsFiles = await scanDirectoryRecursively(documentsPath);
      for (const file of documentsFiles) {
        file.location = 'documents';
        file.isProcessed = false; // Will be determined by database check
        fileSystemDocs.push(file);
      }
    } catch (error) {
      console.warn(`⚠️ Could not access ${documentsPath}:`, error.message);
    }
    
    // Note: Archive folder contains processed copies with timestamps/IDs
    // These are not shown in UI to avoid duplicates - originals remain in documents folder
    
    // Get database documents
    const dbQuery = `
      SELECT 
        s.source_id,
        s.filename,
        s.file_path,
        s.file_size,
        s.file_hash,
        s.version,
        s.document_type,
        s.title,
        s.processing_status,
        s.total_chunks,
        s.created_at,
        s.updated_at,
        s.processed_at,
        s.metadata,
        COALESCE(chunk_stats.actual_chunks, 0) as actual_chunks,
        chunk_stats.avg_quality_score,
        job_stats.last_processing_completed,
        job_stats.last_job_status,
        job_stats.last_processing_stats
      FROM kb_sources s
      LEFT JOIN (
        SELECT 
          source_id,
          COUNT(*) as actual_chunks,
          AVG(quality_score) as avg_quality_score
        FROM kb_chunks 
        GROUP BY source_id
      ) chunk_stats ON s.source_id = chunk_stats.source_id
      LEFT JOIN (
        SELECT DISTINCT ON (source_id)
          source_id,
          completed_at as last_processing_completed,
          job_status as last_job_status,
          processing_stats as last_processing_stats
        FROM ingestion_jobs 
        ORDER BY source_id, created_at DESC
      ) job_stats ON s.source_id = job_stats.source_id
      ORDER BY s.updated_at DESC
    `;
    
    const dbResult = await db.query(dbQuery);
    const dbDocs = dbResult.rows;
    
    // Compare and merge data
    const documentStatus = await compareDocuments(fileSystemDocs, dbDocs);
    
    // Get processing statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN job_status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN job_status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN job_status = 'running' THEN 1 END) as running_jobs,
        COUNT(CASE WHEN job_status = 'pending' THEN 1 END) as pending_jobs,
        AVG(CASE WHEN job_status = 'completed' THEN chunks_processed END) as avg_chunks_per_doc,
        AVG(CASE WHEN job_status = 'completed' THEN 
          EXTRACT(EPOCH FROM (completed_at - started_at)) END) as avg_processing_time_seconds
      FROM ingestion_jobs 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;
    
    const statsResult = await db.query(statsQuery);
    const processingStats = statsResult.rows[0];
    
    console.log(`✅ Found ${fileSystemDocs.length} files in filesystem, ${dbDocs.length} in database`);
    
    res.json({
      success: true,
      data: {
        documents: documentStatus,
        summary: {
          totalFilesInFileSystem: fileSystemDocs.length,
          totalDocumentsInDatabase: dbDocs.length,
          processedDocuments: documentStatus.filter(d => d.status === 'processed').length,
          unprocessedDocuments: documentStatus.filter(d => d.status === 'unprocessed').length,
          modifiedDocuments: documentStatus.filter(d => d.status === 'modified').length,
          missingFiles: documentStatus.filter(d => d.status === 'missing_file').length,
          orphanedRecords: documentStatus.filter(d => d.status === 'orphaned').length
        },
        processingStats: {
          totalJobs: parseInt(processingStats.total_jobs) || 0,
          completedJobs: parseInt(processingStats.completed_jobs) || 0,
          failedJobs: parseInt(processingStats.failed_jobs) || 0,
          runningJobs: parseInt(processingStats.running_jobs) || 0,
          pendingJobs: parseInt(processingStats.pending_jobs) || 0,
          avgChunksPerDoc: parseFloat(processingStats.avg_chunks_per_doc) || 0,
          avgProcessingTimeSeconds: parseFloat(processingStats.avg_processing_time_seconds) || 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching document status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document status',
      details: error.message
    });
  }
});

/**
 * Get detailed information about a specific document
 */
router.get('/documents/:sourceId/details', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const db = getDatabase();
    
    console.log(`📄 Fetching details for document: ${sourceId}`);
    
    // Get document details
    const docQuery = `
      SELECT 
        s.*,
        COUNT(c.id) as total_chunks,
        AVG(c.quality_score) as avg_quality_score,
        MIN(c.created_at) as first_chunk_created,
        MAX(c.updated_at) as last_chunk_updated
      FROM kb_sources s
      LEFT JOIN kb_chunks c ON s.source_id = c.source_id
      WHERE s.source_id = $1
      GROUP BY s.source_id
    `;
    
    const docResult = await db.query(docQuery, [sourceId]);
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    const document = docResult.rows[0];
    
    // Get processing jobs for this document
    const jobsQuery = `
      SELECT 
        job_id,
        job_type,
        job_status,
        started_at,
        completed_at,
        progress_percentage,
        current_step,
        chunks_processed,
        chunks_failed,
        embeddings_generated,
        error_message,
        processing_stats,
        configuration
      FROM ingestion_jobs
      WHERE source_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const jobsResult = await db.query(jobsQuery, [sourceId]);
    const processingJobs = jobsResult.rows;
    
    // Get chunk details
    const chunksQuery = `
      SELECT 
        chunk_id,
        chunk_index,
        heading,
        page_number,
        token_count,
        quality_score,
        scale,
        created_at,
        metadata
      FROM kb_chunks
      WHERE source_id = $1
      ORDER BY chunk_index
      LIMIT 50
    `;
    
    const chunksResult = await db.query(chunksQuery, [sourceId]);
    const chunks = chunksResult.rows;
    
    // Get validation report if exists
    const validationQuery = `
      SELECT 
        validation_timestamp,
        overall_score,
        quality_grade,
        total_chunks,
        issues_count,
        warnings_count,
        recommendations_count,
        validation_results
      FROM validation_reports
      WHERE source_id = $1
      ORDER BY validation_timestamp DESC
      LIMIT 1
    `;
    
    const validationResult = await db.query(validationQuery, [sourceId]);
    const validationReport = validationResult.rows[0] || null;
    
    res.json({
      success: true,
      data: {
        document,
        processingJobs,
        chunks: chunks.map(chunk => ({
          ...chunk,
          metadata: typeof chunk.metadata === 'string' ? JSON.parse(chunk.metadata) : chunk.metadata
        })),
        validationReport: validationReport ? {
          ...validationReport,
          validation_results: typeof validationReport.validation_results === 'string' 
            ? JSON.parse(validationReport.validation_results) 
            : validationReport.validation_results
        } : null
      }
    });
    
  } catch (error) {
    console.error(`❌ Error fetching document details for ${req.params.sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document details',
      details: error.message
    });
  }
});

/**
 * Trigger reprocessing of a document
 */
router.post('/documents/:sourceId/reprocess', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { method = 'advanced', force = false } = req.body;
    
    console.log(`🔄 Triggering reprocessing for document: ${sourceId}`);
    
    const db = getDatabase();
    
    // Check if document exists
    const docQuery = 'SELECT * FROM kb_sources WHERE source_id = $1';
    const docResult = await db.query(docQuery, [sourceId]);
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    const document = docResult.rows[0];
    
    // Check if there's already a running job
    if (!force) {
      const runningJobQuery = `
        SELECT job_id FROM ingestion_jobs 
        WHERE source_id = $1 AND job_status IN ('pending', 'running')
        ORDER BY created_at DESC LIMIT 1
      `;
      const runningJobResult = await db.query(runningJobQuery, [sourceId]);
      
      if (runningJobResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Document is already being processed',
          jobId: runningJobResult.rows[0].job_id
        });
      }
    }
    
    // Create new ingestion job with proper UUID
    const { v4: uuidv4 } = require('uuid');
    const jobId = uuidv4();
    const insertJobQuery = `
      INSERT INTO ingestion_jobs (
        job_id, source_id, job_type, job_status, configuration, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const jobConfig = {
      method,
      enableHierarchicalChunking: method === 'advanced',
      enableMultiScaleEmbeddings: method === 'advanced',
      enableQualityValidation: true,
      reprocessing: true,
      triggeredBy: 'user_request'
    };
    
    const jobResult = await db.query(insertJobQuery, [
      jobId,
      sourceId,
      'reprocessing',
      'pending',
      JSON.stringify(jobConfig),
      new Date()
    ]);
    
    const newJob = jobResult.rows[0];
    
    // Here you would typically trigger the actual processing
    // For now, we'll just return the job information
    
    res.json({
      success: true,
      message: 'Reprocessing job created successfully',
      data: {
        jobId: newJob.job_id,
        sourceId,
        status: newJob.job_status,
        configuration: jobConfig
      }
    });
    
  } catch (error) {
    console.error(`❌ Error triggering reprocessing for ${req.params.sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger reprocessing',
      details: error.message
    });
  }
});

/**
 * Delete a document and all its associated data
 */
router.delete('/documents/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { deleteFile = false } = req.body;
    
    console.log(`🗑️ Deleting document: ${sourceId}`);
    
    const db = getDatabase();
    
    // Start transaction
    const result = await db.transaction(async (transactionDb) => {
      // Get document info before deletion
      const docQuery = 'SELECT * FROM kb_sources WHERE source_id = $1';
      const docResult = await transactionDb.query(docQuery, [sourceId]);
      
      if (docResult.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      const document = docResult.rows[0];
      
      // Delete in correct order due to foreign key constraints
      console.log(`🗑️ Deleting validation reports for ${sourceId}...`);
      const validationResult = await transactionDb.query('DELETE FROM validation_reports WHERE source_id = $1', [sourceId]);
      console.log(`🗑️ Deleted ${validationResult.rowCount} validation reports`);
      
      console.log(`🗑️ Deleting ingestion jobs for ${sourceId}...`);
      const jobsResult = await transactionDb.query('DELETE FROM ingestion_jobs WHERE source_id = $1', [sourceId]);
      console.log(`🗑️ Deleted ${jobsResult.rowCount} ingestion jobs`);
      
      console.log(`🗑️ Deleting chunks for ${sourceId}...`);
      const chunksResult = await transactionDb.query('DELETE FROM kb_chunks WHERE source_id = $1', [sourceId]);
      console.log(`🗑️ Deleted ${chunksResult.rowCount} chunks`);
      
      console.log(`🗑️ Deleting source record for ${sourceId}...`);
      const sourceResult = await transactionDb.query('DELETE FROM kb_sources WHERE source_id = $1', [sourceId]);
      console.log(`🗑️ Deleted ${sourceResult.rowCount} source record`);
      
      // Optionally delete the physical file
      if (deleteFile && document.file_path) {
        try {
          const fullPath = path.resolve(document.file_path);
          await fs.unlink(fullPath);
          console.log(`🗑️ Deleted physical file: ${fullPath}`);
        } catch (fileError) {
          console.warn(`⚠️ Could not delete physical file: ${fileError.message}`);
        }
      }
      
      return {
        success: true,
        message: 'Document deleted successfully',
        data: {
          sourceId,
          filename: document.filename,
          fileDeleted: deleteFile,
          deletedRecords: {
            validationReports: validationResult.rowCount,
            ingestionJobs: jobsResult.rowCount,
            chunks: chunksResult.rowCount,
            sources: sourceResult.rowCount
          }
        }
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error(`❌ Error deleting document ${req.params.sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      details: error.message
    });
  }
});

/**
 * Clean up orphaned database records (documents that exist in database but not in filesystem)
 */
router.post('/documents/cleanup-orphaned', async (req, res) => {
  try {
    console.log('🧹 Starting cleanup of orphaned database records...');
    
    const db = getDatabase();
    
    // Get all documents from database
    const dbDocsQuery = `
      SELECT source_id, filename, file_path 
      FROM kb_sources 
      ORDER BY created_at DESC
    `;
    
    const dbResult = await db.query(dbDocsQuery);
    const dbDocs = dbResult.rows;
    
    const orphanedDocs = [];
    const validDocs = [];
    
    // Check each database document against filesystem
    for (const doc of dbDocs) {
      try {
        await fs.access(doc.file_path);
        validDocs.push(doc);
      } catch (error) {
        // File doesn't exist - this is an orphaned record
        orphanedDocs.push(doc);
      }
    }
    
    console.log(`📊 Found ${orphanedDocs.length} orphaned records out of ${dbDocs.length} total`);
    
    if (orphanedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No orphaned records found',
        data: {
          totalDocuments: dbDocs.length,
          orphanedDocuments: 0,
          validDocuments: validDocs.length,
          deletedRecords: []
        }
      });
    }
    
    // Delete orphaned records
    const deletedRecords = [];
    
    for (const orphanedDoc of orphanedDocs) {
      try {
        console.log(`🗑️ Cleaning up orphaned record: ${orphanedDoc.source_id} (${orphanedDoc.filename})`);
        
        const result = await db.transaction(async (transactionDb) => {
          // Delete in correct order due to foreign key constraints
          const validationResult = await transactionDb.query('DELETE FROM validation_reports WHERE source_id = $1', [orphanedDoc.source_id]);
          const jobsResult = await transactionDb.query('DELETE FROM ingestion_jobs WHERE source_id = $1', [orphanedDoc.source_id]);
          const chunksResult = await transactionDb.query('DELETE FROM kb_chunks WHERE source_id = $1', [orphanedDoc.source_id]);
          const sourceResult = await transactionDb.query('DELETE FROM kb_sources WHERE source_id = $1', [orphanedDoc.source_id]);
          
          return {
            sourceId: orphanedDoc.source_id,
            filename: orphanedDoc.filename,
            deletedRecords: {
              validationReports: validationResult.rowCount,
              ingestionJobs: jobsResult.rowCount,
              chunks: chunksResult.rowCount,
              sources: sourceResult.rowCount
            }
          };
        });
        
        deletedRecords.push(result);
        console.log(`✅ Cleaned up orphaned record: ${orphanedDoc.source_id}`);
        
      } catch (error) {
        console.error(`❌ Failed to clean up orphaned record ${orphanedDoc.source_id}:`, error.message);
      }
    }
    
    console.log(`✅ Cleanup completed. Removed ${deletedRecords.length} orphaned records`);
    
    res.json({
      success: true,
      message: `Successfully cleaned up ${deletedRecords.length} orphaned records`,
      data: {
        totalDocuments: dbDocs.length,
        orphanedDocuments: orphanedDocs.length,
        validDocuments: validDocs.length,
        deletedRecords
      }
    });
    
  } catch (error) {
    console.error('❌ Error during orphaned records cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup orphaned records',
      details: error.message
    });
  }
});

/**
 * Get processing statistics and analytics
 */
router.get('/analytics/processing-stats', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const db = getDatabase();
    
    console.log(`📈 Fetching processing analytics for ${timeRange}...`);
    
    // Calculate time interval
    let interval;
    switch (timeRange) {
      case '7d':
        interval = '7 days';
        break;
      case '30d':
        interval = '30 days';
        break;
      case '90d':
        interval = '90 days';
        break;
      default:
        interval = '30 days';
    }
    
    // Get processing statistics
    const statsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN job_status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN job_status = 'failed' THEN 1 END) as failed_jobs,
        AVG(CASE WHEN job_status = 'completed' THEN chunks_processed END) as avg_chunks,
        AVG(CASE WHEN job_status = 'completed' THEN 
          EXTRACT(EPOCH FROM (completed_at - started_at)) END) as avg_processing_time
      FROM ingestion_jobs
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const statsResult = await db.query(statsQuery);
    const dailyStats = statsResult.rows;
    
    // Get quality metrics
    const qualityQuery = `
      SELECT 
        AVG(quality_score) as avg_quality,
        MIN(quality_score) as min_quality,
        MAX(quality_score) as max_quality,
        COUNT(*) as total_chunks,
        COUNT(CASE WHEN quality_score >= 0.8 THEN 1 END) as high_quality_chunks,
        COUNT(CASE WHEN quality_score < 0.5 THEN 1 END) as low_quality_chunks
      FROM kb_chunks c
      JOIN kb_sources s ON c.source_id = s.source_id
      WHERE s.created_at >= NOW() - INTERVAL '${interval}'
    `;
    
    const qualityResult = await db.query(qualityQuery);
    const qualityMetrics = qualityResult.rows[0];
    
    // Get method distribution
    const methodQuery = `
      SELECT 
        configuration->>'method' as method,
        COUNT(*) as count,
        AVG(CASE WHEN job_status = 'completed' THEN chunks_processed END) as avg_chunks
      FROM ingestion_jobs
      WHERE created_at >= NOW() - INTERVAL '${interval}'
        AND configuration IS NOT NULL
      GROUP BY configuration->>'method'
    `;
    
    const methodResult = await db.query(methodQuery);
    const methodDistribution = methodResult.rows;
    
    res.json({
      success: true,
      data: {
        timeRange,
        dailyStats: dailyStats.map(stat => ({
          date: stat.date,
          totalJobs: parseInt(stat.total_jobs),
          completedJobs: parseInt(stat.completed_jobs),
          failedJobs: parseInt(stat.failed_jobs),
          avgChunks: parseFloat(stat.avg_chunks) || 0,
          avgProcessingTime: parseFloat(stat.avg_processing_time) || 0
        })),
        qualityMetrics: {
          avgQuality: parseFloat(qualityMetrics.avg_quality) || 0,
          minQuality: parseFloat(qualityMetrics.min_quality) || 0,
          maxQuality: parseFloat(qualityMetrics.max_quality) || 0,
          totalChunks: parseInt(qualityMetrics.total_chunks) || 0,
          highQualityChunks: parseInt(qualityMetrics.high_quality_chunks) || 0,
          lowQualityChunks: parseInt(qualityMetrics.low_quality_chunks) || 0
        },
        methodDistribution: methodDistribution.map(method => ({
          method: method.method || 'unknown',
          count: parseInt(method.count),
          avgChunks: parseFloat(method.avg_chunks) || 0
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching processing analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch processing analytics',
      details: error.message
    });
  }
});

// Helper functions

/**
 * Recursively scan directory for documents
 */
async function scanDirectoryRecursively(dirPath, relativePath = '') {
  const files = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectoryRecursively(fullPath, relPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Check if it's a document file
        const ext = path.extname(entry.name).toLowerCase();
        if (['.pdf', '.docx', '.doc', '.txt', '.md'].includes(ext)) {
          try {
            const stats = await fs.stat(fullPath);
            // Calculate hash from actual file content (consistent with ingestion process)
            const fileBuffer = await fs.readFile(fullPath);
            const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            
            files.push({
              filename: entry.name,
              filePath: fullPath,
              relativePath: relPath,
              fileSize: stats.size,
              fileHash,
              lastModified: stats.mtime,
              documentType: ext.substring(1), // Remove the dot
              isDirectory: false
            });
          } catch (error) {
            console.warn(`⚠️ Could not process file ${fullPath}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not read directory ${dirPath}:`, error.message);
  }
  
  return files;
}

/**
 * Compare filesystem documents with database records
 */
async function compareDocuments(fileSystemDocs, dbDocs) {
  const results = [];
  const dbDocsByPath = new Map();
  const dbDocsByHash = new Map();
  const dbDocsByFilename = new Map();
  
  // Index database documents by path, hash, and filename
  // For filename indexing, prioritize completed records and most recent
  dbDocs.forEach(doc => {
    dbDocsByPath.set(doc.file_path, doc);
    if (doc.file_hash) {
      dbDocsByHash.set(doc.file_hash, doc);
    }
    // Index by filename, prioritizing completed status and most recent
    if (doc.filename) {
      const existing = dbDocsByFilename.get(doc.filename);
      if (!existing || 
          (doc.processing_status === 'completed' && existing.processing_status !== 'completed') ||
          (doc.processing_status === existing.processing_status && new Date(doc.updated_at) > new Date(existing.updated_at))) {
        dbDocsByFilename.set(doc.filename, doc);
      }
    }
  });
  
  // Process filesystem documents
  for (const fsDoc of fileSystemDocs) {
    const dbDoc = dbDocsByPath.get(fsDoc.filePath) || 
                  dbDocsByHash.get(fsDoc.fileHash) || 
                  dbDocsByFilename.get(fsDoc.filename);
    
    if (!dbDoc) {
      // File exists but not in database
      results.push({
        ...fsDoc,
        status: 'unprocessed',
        sourceId: null,
        processingStatus: null,
        totalChunks: 0,
        avgQualityScore: null,
        lastProcessed: null,
        processingMethod: null
      });
    } else {
      // File exists in both places
      let status = 'processed';
      
      // Check if file has been modified since processing
      if (fsDoc.fileHash !== dbDoc.file_hash) {
        status = 'modified';
      } else if (dbDoc.processing_status !== 'completed') {
        // File exists but processing not completed
        status = 'unprocessed';
      }
      
      results.push({
        ...fsDoc,
        status,
        sourceId: dbDoc.source_id,
        processingStatus: dbDoc.processing_status,
        totalChunks: parseInt(dbDoc.actual_chunks) || 0,
        avgQualityScore: parseFloat(dbDoc.avg_quality_score) || null,
        lastProcessed: dbDoc.processed_at,
        processingMethod: dbDoc.last_job_status || 'unknown',
        version: dbDoc.version,
        title: dbDoc.title,
        lastJobStatus: dbDoc.last_job_status,
        lastProcessingCompleted: dbDoc.last_processing_completed,
        processingStats: dbDoc.last_processing_stats,
        processingDetails: {
          jobType: dbDoc.last_job_status,
          completedAt: dbDoc.last_processing_completed,
          configuration: dbDoc.last_processing_stats?.configuration || {},
          statistics: dbDoc.last_processing_stats || {}
        }
      });
    }
  }
  
  // Find orphaned database records (files that no longer exist)
  for (const dbDoc of dbDocs) {
    const fsDoc = fileSystemDocs.find(f => 
      f.filePath === dbDoc.file_path || 
      f.fileHash === dbDoc.file_hash ||
      f.filename === dbDoc.filename
    );
    
    if (!fsDoc) {
      results.push({
        filename: dbDoc.filename,
        filePath: dbDoc.file_path,
        relativePath: dbDoc.file_path,
        fileSize: dbDoc.file_size,
        fileHash: dbDoc.file_hash,
        lastModified: null,
        documentType: dbDoc.document_type,
        isDirectory: false,
        status: 'missing_file',
        sourceId: dbDoc.source_id,
        processingStatus: dbDoc.processing_status,
        totalChunks: parseInt(dbDoc.actual_chunks) || 0,
        avgQualityScore: parseFloat(dbDoc.avg_quality_score) || null,
        lastProcessed: dbDoc.processed_at,
        processingMethod: dbDoc.metadata?.processingMethod || 'unknown',
        version: dbDoc.version,
        title: dbDoc.title
      });
    }
  }
  
  return results.sort((a, b) => {
    // Sort by status priority, then by filename
    const statusPriority = {
      'modified': 1,
      'unprocessed': 2,
      'missing_file': 3,
      'processed': 4
    };
    
    const aPriority = statusPriority[a.status] || 5;
    const bPriority = statusPriority[b.status] || 5;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    return a.filename.localeCompare(b.filename);
  });
}

/**
 * Get detailed chunk information for a specific document
 */
router.get('/documents/:sourceId/chunks', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { page = 1, limit = 50, sortBy = 'chunk_index', sortOrder = 'ASC' } = req.query;
    
    console.log(`📊 Fetching detailed chunk information for ${sourceId}...`);
    const db = getDatabase();
    
    // Validate sort parameters
    const validSortFields = ['chunk_index', 'created_at', 'quality_score', 'token_count', 'page_number'];
    const validSortOrders = ['ASC', 'DESC'];
    
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'chunk_index';
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get detailed chunk information with processing metadata
    const chunksQuery = `
      SELECT 
        c.chunk_id,
        c.chunk_index,
        c.heading,
        c.subheading,
        c.page_number,
        c.page_range,
        c.section_path,
        c.content,
        c.content_type,
        c.token_count,
        c.character_count,
        c.word_count,
        c.language,
        c.quality_score,
        c.metadata as chunk_metadata,
        c.created_at,
        c.updated_at,
        s.filename,
        s.document_type,
        s.title as document_title,
        j.job_type,
        j.configuration as processing_config,
        j.processing_stats,
        j.started_at as processing_started,
        j.completed_at as processing_completed
      FROM kb_chunks c
      JOIN kb_sources s ON c.source_id = s.source_id
      LEFT JOIN LATERAL (
        SELECT DISTINCT ON (source_id) 
          job_type, configuration, processing_stats, started_at, completed_at
        FROM ingestion_jobs 
        WHERE source_id = c.source_id AND job_status = 'completed'
        ORDER BY source_id, completed_at DESC
      ) j ON true
      WHERE c.source_id = $1
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT $2 OFFSET $3
    `;
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_chunks
      FROM kb_chunks 
      WHERE source_id = $1
    `;
    
    // Get processing method details
    const processingQuery = `
      SELECT 
        job_type,
        job_status,
        configuration,
        processing_stats,
        started_at,
        completed_at,
        chunks_processed,
        embeddings_generated,
        EXTRACT(EPOCH FROM (completed_at - started_at)) as processing_time_seconds
      FROM ingestion_jobs
      WHERE source_id = $1 AND job_status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `;
    
    const [chunksResult, countResult, processingResult] = await Promise.all([
      db.query(chunksQuery, [sourceId, parseInt(limit), offset]),
      db.query(countQuery, [sourceId]),
      db.query(processingQuery, [sourceId])
    ]);
    
    const chunks = chunksResult.rows;
    const totalChunks = parseInt(countResult.rows[0]?.total_chunks || 0);
    const processingInfo = processingResult.rows[0] || null;
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalChunks / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;
    
    // Process chunks to include detailed metadata
    const processedChunks = chunks.map(chunk => ({
      chunkId: chunk.chunk_id,
      chunkIndex: chunk.chunk_index,
      heading: chunk.heading,
      subheading: chunk.subheading,
      pageNumber: chunk.page_number,
      pageRange: chunk.page_range,
      sectionPath: chunk.section_path,
      content: chunk.content,
      contentType: chunk.content_type,
      tokenCount: chunk.token_count,
      characterCount: chunk.character_count,
      wordCount: chunk.word_count,
      language: chunk.language,
      qualityScore: parseFloat(chunk.quality_score) || 0,
      chunkMetadata: chunk.chunk_metadata || {},
      createdAt: chunk.created_at,
      updatedAt: chunk.updated_at,
      document: {
        filename: chunk.filename,
        documentType: chunk.document_type,
        title: chunk.document_title
      },
      processing: {
        jobType: chunk.job_type,
        config: chunk.processing_config || {},
        stats: chunk.processing_stats || {},
        startedAt: chunk.processing_started,
        completedAt: chunk.processing_completed
      }
    }));
    
    console.log(`✅ Retrieved ${chunks.length} chunks (page ${page}/${totalPages})`);
    
    res.json({
      success: true,
      data: {
        chunks: processedChunks,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalChunks,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        sorting: {
          sortBy: safeSortBy,
          sortOrder: safeSortOrder
        },
        processing: processingInfo ? {
          method: processingInfo.job_type,
          status: processingInfo.job_status,
          configuration: processingInfo.configuration || {},
          statistics: processingInfo.processing_stats || {},
          timing: {
            startedAt: processingInfo.started_at,
            completedAt: processingInfo.completed_at,
            processingTimeSeconds: parseFloat(processingInfo.processing_time_seconds) || 0
          },
          metrics: {
            chunksProcessed: processingInfo.chunks_processed || 0,
            embeddingsGenerated: processingInfo.embeddings_generated || 0
          }
        } : null
      }
    });
    
  } catch (error) {
    console.error(`❌ Error fetching chunk details for ${req.params.sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chunk details',
      details: error.message
    });
  }
});

/**
 * Get chunk analytics and statistics for a document
 */
router.get('/documents/:sourceId/analytics', async (req, res) => {
  try {
    const { sourceId } = req.params;
    console.log(`📈 Fetching chunk analytics for ${sourceId}...`);
    const db = getDatabase();
    
    // Get comprehensive chunk analytics
    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_chunks,
        AVG(quality_score) as avg_quality_score,
        MIN(quality_score) as min_quality_score,
        MAX(quality_score) as max_quality_score,
        AVG(token_count) as avg_token_count,
        MIN(token_count) as min_token_count,
        MAX(token_count) as max_token_count,
        AVG(character_count) as avg_character_count,
        SUM(token_count) as total_tokens,
        SUM(character_count) as total_characters,
        COUNT(DISTINCT page_number) as total_pages_with_chunks,
        COUNT(CASE WHEN quality_score >= 0.8 THEN 1 END) as high_quality_chunks,
        COUNT(CASE WHEN quality_score >= 0.6 AND quality_score < 0.8 THEN 1 END) as medium_quality_chunks,
        COUNT(CASE WHEN quality_score < 0.6 THEN 1 END) as low_quality_chunks,
        COUNT(CASE WHEN content_type = 'text' THEN 1 END) as text_chunks,
        COUNT(CASE WHEN content_type = 'table' THEN 1 END) as table_chunks,
        COUNT(CASE WHEN content_type = 'list' THEN 1 END) as list_chunks,
        COUNT(CASE WHEN heading IS NOT NULL THEN 1 END) as chunks_with_headings,
        MIN(created_at) as first_chunk_created,
        MAX(created_at) as last_chunk_created
      FROM kb_chunks 
      WHERE source_id = $1
    `;
    
    // Get quality distribution by page
    const pageQualityQuery = `
      SELECT 
        page_number,
        COUNT(*) as chunks_count,
        AVG(quality_score) as avg_quality,
        AVG(token_count) as avg_tokens
      FROM kb_chunks 
      WHERE source_id = $1 AND page_number IS NOT NULL
      GROUP BY page_number
      ORDER BY page_number
    `;
    
    // Get content type distribution
    const contentTypeQuery = `
      SELECT 
        content_type,
        COUNT(*) as count,
        AVG(quality_score) as avg_quality,
        AVG(token_count) as avg_tokens
      FROM kb_chunks 
      WHERE source_id = $1
      GROUP BY content_type
      ORDER BY count DESC
    `;
    
    // Get recent processing history
    const historyQuery = `
      SELECT 
        job_id,
        job_type,
        job_status,
        configuration,
        processing_stats,
        chunks_processed,
        embeddings_generated,
        started_at,
        completed_at,
        EXTRACT(EPOCH FROM (completed_at - started_at)) as processing_time_seconds
      FROM ingestion_jobs
      WHERE source_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const [analyticsResult, pageQualityResult, contentTypeResult, historyResult] = await Promise.all([
      db.query(analyticsQuery, [sourceId]),
      db.query(pageQualityQuery, [sourceId]),
      db.query(contentTypeQuery, [sourceId]),
      db.query(historyQuery, [sourceId])
    ]);
    
    const analytics = analyticsResult.rows[0];
    const pageQuality = pageQualityResult.rows;
    const contentTypes = contentTypeResult.rows;
    const processingHistory = historyResult.rows;
    
    console.log(`✅ Generated analytics for ${analytics.total_chunks} chunks`);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalChunks: parseInt(analytics.total_chunks),
          totalTokens: parseInt(analytics.total_tokens),
          totalCharacters: parseInt(analytics.total_characters),
          totalPagesWithChunks: parseInt(analytics.total_pages_with_chunks),
          chunksWithHeadings: parseInt(analytics.chunks_with_headings),
          firstChunkCreated: analytics.first_chunk_created,
          lastChunkCreated: analytics.last_chunk_created
        },
        quality: {
          average: parseFloat(analytics.avg_quality_score) || 0,
          minimum: parseFloat(analytics.min_quality_score) || 0,
          maximum: parseFloat(analytics.max_quality_score) || 0,
          distribution: {
            high: parseInt(analytics.high_quality_chunks), // >= 0.8
            medium: parseInt(analytics.medium_quality_chunks), // 0.6-0.8
            low: parseInt(analytics.low_quality_chunks) // < 0.6
          }
        },
        tokens: {
          average: parseFloat(analytics.avg_token_count) || 0,
          minimum: parseInt(analytics.min_token_count) || 0,
          maximum: parseInt(analytics.max_token_count) || 0,
          total: parseInt(analytics.total_tokens)
        },
        characters: {
          average: parseFloat(analytics.avg_character_count) || 0,
          total: parseInt(analytics.total_characters)
        },
        contentTypes: contentTypes.map(ct => ({
          type: ct.content_type,
          count: parseInt(ct.count),
          avgQuality: parseFloat(ct.avg_quality) || 0,
          avgTokens: parseFloat(ct.avg_tokens) || 0
        })),
        pageQuality: pageQuality.map(pq => ({
          pageNumber: parseInt(pq.page_number),
          chunksCount: parseInt(pq.chunks_count),
          avgQuality: parseFloat(pq.avg_quality) || 0,
          avgTokens: parseFloat(pq.avg_tokens) || 0
        })),
        processingHistory: processingHistory.map(ph => ({
          jobId: ph.job_id,
          jobType: ph.job_type,
          status: ph.job_status,
          configuration: ph.configuration || {},
          statistics: ph.processing_stats || {},
          metrics: {
            chunksProcessed: ph.chunks_processed || 0,
            embeddingsGenerated: ph.embeddings_generated || 0
          },
          timing: {
            startedAt: ph.started_at,
            completedAt: ph.completed_at,
            processingTimeSeconds: parseFloat(ph.processing_time_seconds) || 0
          }
        }))
      }
    });
    
  } catch (error) {
    console.error(`❌ Error fetching analytics for ${req.params.sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chunk analytics',
      details: error.message
    });
  }
});

module.exports = router;
