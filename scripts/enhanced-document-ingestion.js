#!/usr/bin/env node

/**
 * Enhanced Document Ingestion System
 * 
 * Uses improved hierarchical chunking with the existing infrastructure
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { initializeDatabase, closeDatabase } = require('../config/database');
const HierarchicalSemanticChunker = require('../knowledge/chunking/HierarchicalSemanticChunker');

class EnhancedDocumentIngestion {
  constructor() {
    this.stagingPath = path.join(__dirname, '../knowledge_base/staging');
    this.documentsPath = path.join(__dirname, '../knowledge_base/documents');
    this.backupsPath = path.join(__dirname, '../knowledge_base/backups');
    
    this.db = null;
    this.hierarchicalChunker = null;
    
    this.stats = {
      documentsProcessed: 0,
      chunksGenerated: 0,
      totalProcessingTime: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.supportedFormats = ['.pdf', '.docx', '.txt', '.md'];
  }

  async initialize() {
    logger.info('🚀 Initializing Enhanced Document Ingestion System');
    
    try {
      // Initialize database
      this.db = await initializeDatabase();
      logger.info('✅ Database connection established');
      
      // Initialize hierarchical chunker
      this.hierarchicalChunker = new HierarchicalSemanticChunker({
        scales: {
          document: { maxTokens: 8000, minTokens: 4000, overlap: 500 },
          section: { maxTokens: 2000, minTokens: 500, overlap: 100 },
          paragraph: { maxTokens: 500, minTokens: 100, overlap: 50 },
          sentence: { maxTokens: 150, minTokens: 20, overlap: 10 }
        },
        semanticCoherence: {
          enableSemanticBoundaryDetection: true,
          sentenceSimilarityThreshold: 0.7,
          paragraphSimilarityThreshold: 0.6
        },
        contextPreservation: {
          hierarchicalOverlap: true,
          parentChildRelationships: true,
          narrativeFlowPreservation: true
        }
      });
      logger.info('✅ Hierarchical Semantic Chunker initialized');
      
      // Ensure directories exist
      this.ensureDirectories();
      
      logger.info('✅ Enhanced Document Ingestion System ready');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Enhanced Document Ingestion System:', error);
      throw error;
    }
  }

  ensureDirectories() {
    const dirs = [this.stagingPath, this.documentsPath, this.backupsPath];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`📁 Created directory: ${dir}`);
      }
    });
  }

  async getStagingDocuments() {
    try {
      const files = fs.readdirSync(this.stagingPath);
      const documents = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      });
      
      logger.info(`📋 Found ${documents.length} documents in staging folder`);
      documents.forEach(doc => logger.info(`  📄 ${doc}`));
      
      return documents;
    } catch (error) {
      logger.error('❌ Error reading staging folder:', error);
      return [];
    }
  }

  async clearExistingData() {
    logger.info('🗑️ Clearing existing document data...');
    
    try {
      // Clear existing chunks and embeddings
      await this.db.query('DELETE FROM kb_chunks');
      await this.db.query('DELETE FROM kb_sources');
      await this.db.query('DELETE FROM embedding_cache');
      
      logger.info('✅ Existing data cleared');
    } catch (error) {
      logger.error('❌ Error clearing existing data:', error);
      throw error;
    }
  }

  async processDocument(filename) {
    const startTime = Date.now();
    logger.info(`\n📄 Processing document: ${filename}`);
    logger.info('─'.repeat(60));
    
    try {
      const filePath = path.join(this.stagingPath, filename);
      const fileStats = fs.statSync(filePath);
      
      logger.info(`📊 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Step 1: Extract text content
      logger.info('🔍 Step 1: Extracting text content...');
      const content = await this.extractTextContent(filePath);
      
      if (!content || content.trim().length === 0) {
        throw new Error('No text content extracted from document');
      }
      
      logger.info(`✅ Extracted ${content.length} characters`);
      
      // Step 2: Create document record
      logger.info('🔍 Step 2: Creating document record...');
      const documentId = await this.createDocumentRecord(filename, content, fileStats);
      logger.info(`✅ Document record created: ${documentId}`);
      
      // Step 3: Enhanced hierarchical chunking
      logger.info('🔍 Step 3: Performing enhanced hierarchical chunking...');
      const chunks = await this.hierarchicalChunker.chunkDocument(content, {
        documentId: documentId,
        filename: filename,
        preserveStructure: true,
        enableQualityAssessment: true
      });
      
      logger.info(`✅ Generated ${chunks.length} hierarchical chunks`);
      
      // Step 4: Generate embeddings using existing system
      logger.info('🔍 Step 4: Generating embeddings...');
      const embeddedChunks = await this.generateEmbeddings(chunks);
      logger.info(`✅ Generated embeddings for ${embeddedChunks.length} chunks`);
      
      // Step 5: Store in database with enhanced metadata
      logger.info('🔍 Step 5: Storing chunks with enhanced metadata...');
      await this.storeEnhancedChunks(embeddedChunks, documentId);
      logger.info(`✅ Stored ${embeddedChunks.length} chunks with enhanced metadata`);
      
      // Step 6: Move to documents folder
      logger.info('🔍 Step 6: Moving document to processed folder...');
      const processedPath = path.join(this.documentsPath, filename);
      fs.copyFileSync(filePath, processedPath);
      fs.unlinkSync(filePath);
      logger.info(`✅ Document moved to: ${processedPath}`);
      
      const processingTime = Date.now() - startTime;
      this.stats.documentsProcessed++;
      this.stats.chunksGenerated += chunks.length;
      this.stats.totalProcessingTime += processingTime;
      
      logger.info(`✅ Document processed successfully in ${processingTime}ms`);
      logger.info(`📊 Quality Score: ${this.calculateAverageQuality(chunks).toFixed(3)}`);
      
      return {
        success: true,
        documentId,
        chunksGenerated: chunks.length,
        processingTime,
        qualityScore: this.calculateAverageQuality(chunks)
      };
      
    } catch (error) {
      this.stats.errors++;
      logger.error(`❌ Error processing document ${filename}:`, error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  async extractTextContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.txt':
        case '.md':
          return fs.readFileSync(filePath, 'utf8');
          
        case '.pdf':
          // Use existing PDF extraction logic
          const { extractTextFromPDF } = require('../services/documentLoader');
          return await extractTextFromPDF(filePath);
          
        case '.docx':
          // Use existing DOCX extraction logic
          const { extractTextFromDOCX } = require('../services/documentLoader');
          return await extractTextFromDOCX(filePath);
          
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      logger.error(`❌ Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  async createDocumentRecord(filename, content, fileStats) {
    try {
      const result = await this.db.query(`
        INSERT INTO kb_sources (
          source_name, source_type, file_path, content_preview,
          file_size, created_at, updated_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
        RETURNING source_id
      `, [
        filename,
        path.extname(filename).toLowerCase().substring(1),
        filename,
        content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        fileStats.size,
        JSON.stringify({
          originalPath: filename,
          processingMethod: 'enhanced-hierarchical-chunking',
          processingVersion: '2.0',
          features: ['hierarchical-relationships', 'quality-assessment', 'semantic-boundaries']
        })
      ]);
      
      return result.rows[0].source_id;
    } catch (error) {
      logger.error('❌ Error creating document record:', error);
      throw error;
    }
  }

  async generateEmbeddings(chunks) {
    // Use existing embedding generation logic
    const { generateEmbedding } = require('../services/embeddingService');
    const embeddedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.debug(`🔮 Generating embedding for chunk ${i + 1}/${chunks.length}`);
      
      try {
        const embedding = await generateEmbedding(chunk.content);
        embeddedChunks.push({
          ...chunk,
          embedding: embedding
        });
      } catch (error) {
        logger.error(`❌ Error generating embedding for chunk ${i + 1}:`, error);
        embeddedChunks.push(chunk);
      }
    }
    
    return embeddedChunks;
  }

  async storeEnhancedChunks(chunks, documentId) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        await this.db.query(`
          INSERT INTO kb_chunks (
            source_id, chunk_id, content, content_vector, 
            chunk_index, token_count, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          documentId,
          chunk.id,
          chunk.content,
          chunk.embedding ? JSON.stringify(chunk.embedding) : null,
          i,
          chunk.tokenCount || 0,
          JSON.stringify({
            scale: chunk.scale,
            qualityScore: chunk.qualityScore,
            hierarchicalLevel: chunk.hierarchicalLevel,
            parentChunkId: chunk.parentId,
            childChunkIds: chunk.childIds || [],
            previousChunkId: chunk.previousId,
            nextChunkId: chunk.nextId,
            semanticBoundaries: chunk.semanticBoundaries,
            processingMethod: 'enhanced-hierarchical-chunking-v2',
            contextPreservation: true,
            qualityAssessment: true
          })
        ]);
        
        logger.debug(`✅ Stored chunk ${i + 1}/${chunks.length} with enhanced metadata`);
        
      } catch (error) {
        logger.error(`❌ Error storing chunk ${i + 1}:`, error);
        throw error;
      }
    }
  }

  calculateAverageQuality(chunks) {
    if (!chunks || chunks.length === 0) return 0;
    
    const totalQuality = chunks.reduce((sum, chunk) => {
      return sum + (chunk.qualityScore || 0);
    }, 0);
    
    return totalQuality / chunks.length;
  }

  async generateProcessingReport() {
    const totalTime = Date.now() - this.stats.startTime;
    
    logger.info('\n📊 ENHANCED DOCUMENT INGESTION REPORT');
    logger.info('═'.repeat(60));
    logger.info(`📄 Documents Processed: ${this.stats.documentsProcessed}`);
    logger.info(`🧩 Chunks Generated: ${this.stats.chunksGenerated}`);
    logger.info(`⏱️ Total Processing Time: ${totalTime}ms`);
    logger.info(`⚡ Average Time per Document: ${this.stats.documentsProcessed > 0 ? Math.round(this.stats.totalProcessingTime / this.stats.documentsProcessed) : 0}ms`);
    logger.info(`❌ Errors: ${this.stats.errors}`);
    logger.info(`✅ Success Rate: ${this.stats.documentsProcessed > 0 ? Math.round((this.stats.documentsProcessed - this.stats.errors) / this.stats.documentsProcessed * 100) : 0}%`);
    logger.info('═'.repeat(60));
    
    // Store processing report
    const reportPath = path.join(this.backupsPath, `enhanced-ingestion-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: this.stats,
      processingMethod: 'enhanced-hierarchical-chunking-v2',
      features: ['hierarchical-relationships', 'quality-assessment', 'semantic-boundaries']
    }, null, 2));
    
    logger.info(`📋 Report saved to: ${reportPath}`);
  }

  async run() {
    try {
      await this.initialize();
      
      const documents = await this.getStagingDocuments();
      
      if (documents.length === 0) {
        logger.warn('⚠️ No documents found in staging folder');
        return;
      }
      
      logger.info(`\n🚀 Starting enhanced ingestion of ${documents.length} documents`);
      logger.info('Using: Enhanced Hierarchical Semantic Chunking');
      logger.info('═'.repeat(60));
      
      // Clear existing data
      await this.clearExistingData();
      
      // Process each document
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        logger.info(`\n📋 Processing ${i + 1}/${documents.length}: ${document}`);
        
        const result = await this.processDocument(document);
        
        if (result.success) {
          logger.info(`✅ ${document} processed successfully`);
        } else {
          logger.error(`❌ ${document} failed: ${result.error}`);
        }
      }
      
      // Generate final report
      await this.generateProcessingReport();
      
      logger.info('\n🎉 Enhanced document ingestion completed!');
      
    } catch (error) {
      logger.error('💥 Enhanced document ingestion failed:', error);
      throw error;
    } finally {
      if (this.db) {
        await closeDatabase();
      }
    }
  }
}

// Main execution
async function main() {
  const ingestion = new EnhancedDocumentIngestion();
  
  try {
    await ingestion.run();
    process.exit(0);
  } catch (error) {
    logger.error('💥 Ingestion process failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = EnhancedDocumentIngestion;
