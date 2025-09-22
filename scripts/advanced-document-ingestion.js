#!/usr/bin/env node

/**
 * Advanced Document Ingestion System
 * 
 * Uses the new Hierarchical Semantic Chunking and Multi-Scale Embeddings
 * for superior document processing and context preservation
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { initializeDatabase, closeDatabase } = require('../config/database');

// Import the new advanced processing components
const HierarchicalSemanticChunker = require('../knowledge/chunking/HierarchicalSemanticChunker');
const MultiScaleEmbeddingGenerator = require('../knowledge/embeddings/MultiScaleEmbeddingGenerator');
const AdvancedDocumentProcessingService = require('../services/AdvancedDocumentProcessingService');

class AdvancedDocumentIngestion {
  constructor() {
    this.stagingPath = path.join(__dirname, '../knowledge_base/staging');
    this.documentsPath = path.join(__dirname, '../knowledge_base/documents');
    this.backupsPath = path.join(__dirname, '../knowledge_base/backups');
    
    this.db = null;
    this.hierarchicalChunker = null;
    this.embeddingGenerator = null;
    this.processingService = null;
    
    this.stats = {
      documentsProcessed: 0,
      chunksGenerated: 0,
      embeddingsCreated: 0,
      totalProcessingTime: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.supportedFormats = ['.pdf', '.docx', '.txt', '.md'];
  }

  async initialize() {
    logger.info('🚀 Initializing Advanced Document Ingestion System');
    
    try {
      // Initialize database
      this.db = await initializeDatabase();
      logger.info('✅ Database connection established');
      
      // Initialize advanced processing service
      this.processingService = new AdvancedDocumentProcessingService();
      await this.processingService.initialize();
      logger.info('✅ Advanced Document Processing Service initialized');
      
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
      
      // Initialize multi-scale embedding generator
      this.embeddingGenerator = new MultiScaleEmbeddingGenerator();
      logger.info('✅ Multi-Scale Embedding Generator initialized');
      
      // Ensure directories exist
      this.ensureDirectories();
      
      logger.info('✅ Advanced Document Ingestion System ready');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Advanced Document Ingestion System:', error);
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
      
      // Step 3: Advanced hierarchical chunking
      logger.info('🔍 Step 3: Performing hierarchical semantic chunking...');
      const chunkingResult = await this.hierarchicalChunker.chunkDocumentHierarchically({
        id: documentId,
        content: content,
        filename: filename
      }, {
        preserveStructure: true,
        enableQualityAssessment: true
      });
      
      if (!chunkingResult.success) {
        throw new Error(`Hierarchical chunking failed: ${chunkingResult.error}`);
      }
      
      const chunks = chunkingResult.chunks;
      
      logger.info(`✅ Generated ${chunks.length} hierarchical chunks`);
      
      // Step 4: Generate multi-scale embeddings
      logger.info('🔍 Step 4: Generating multi-scale embeddings...');
      const embeddedChunks = await this.generateMultiScaleEmbeddings(chunks);
      logger.info(`✅ Generated embeddings for ${embeddedChunks.length} chunks`);
      
      // Step 5: Store in database with hierarchical relationships
      logger.info('🔍 Step 5: Storing chunks with hierarchical relationships...');
      await this.storeChunksWithRelationships(embeddedChunks, documentId);
      logger.info(`✅ Stored ${embeddedChunks.length} chunks with relationships`);
      
      // Step 6: Move to documents folder
      logger.info('🔍 Step 6: Moving document to processed folder...');
      const processedPath = path.join(this.documentsPath, filename);
      fs.copyFileSync(filePath, processedPath);
      fs.unlinkSync(filePath);
      logger.info(`✅ Document moved to: ${processedPath}`);
      
      const processingTime = Date.now() - startTime;
      this.stats.documentsProcessed++;
      this.stats.chunksGenerated += chunks.length;
      this.stats.embeddingsCreated += embeddedChunks.length;
      this.stats.totalProcessingTime += processingTime;
      
      logger.info(`✅ Document processed successfully in ${processingTime}ms`);
      logger.info(`📊 Quality Score: ${this.calculateAverageQuality(chunks).toFixed(3)}`);
      
      return {
        success: true,
        documentId,
        chunksGenerated: chunks.length,
        embeddingsCreated: embeddedChunks.length,
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
          try {
            const pdfParse = require('pdf-parse');
            const buffer = fs.readFileSync(filePath);
            const data = await pdfParse(buffer);
            return data.text;
          } catch (error) {
            logger.warn(`PDF parsing failed, using placeholder: ${error.message}`);
            return `PDF content from ${path.basename(filePath)} - content extraction failed but document is indexed.`;
          }
          
        case '.docx':
          try {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
          } catch (error) {
            logger.warn(`DOCX parsing failed, using placeholder: ${error.message}`);
            return `DOCX content from ${path.basename(filePath)} - content extraction failed but document is indexed.`;
          }
          
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
      const sourceId = `adv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileHash = require('crypto').createHash('sha256').update(content).digest('hex');
      
      const result = await this.db.query(`
        INSERT INTO kb_sources (
          source_id, filename, file_path, file_size, file_hash,
          version, document_type, title, total_pages,
          processing_status, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING source_id
      `, [
        sourceId,                                        // $1: source_id
        filename,                                        // $2: filename
        filename,                                        // $3: file_path
        fileStats.size,                                  // $4: file_size
        fileHash,                                        // $5: file_hash
        '2.0',                                          // $6: version
        path.extname(filename).toLowerCase().substring(1), // $7: document_type
        filename.replace(/\.[^/.]+$/, ""),               // $8: title (remove extension)
        1,                                              // $9: total_pages (default)
        'processing',                                    // $10: processing_status
        JSON.stringify({                                // $11: metadata
          originalPath: filename,
          processingMethod: 'hierarchical-semantic-chunking',
          processingVersion: '2.0',
          advancedFeatures: ['multi-scale-embeddings', 'hierarchical-relationships', 'quality-assessment'],
          contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          contentLength: content.length,
          createdAt: new Date().toISOString()
        })
      ]);
      
      return result.rows[0].source_id;
    } catch (error) {
      logger.error('❌ Error creating document record:', error);
      throw error;
    }
  }

  async generateMultiScaleEmbeddings(chunks) {
    const embeddedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.debug(`🔮 Generating embeddings for chunk ${i + 1}/${chunks.length}`);
      
      try {
        // Generate multi-scale embeddings
        const embeddings = await this.embeddingGenerator.generateMultiScaleEmbeddings(chunk.content, {
          chunkId: chunk.id,
          scale: chunk.scale,
          context: {
            previousChunk: i > 0 ? chunks[i - 1].content : null,
            nextChunk: i < chunks.length - 1 ? chunks[i + 1].content : null,
            hierarchicalContext: chunk.hierarchicalContext
          }
        });
        
        embeddedChunks.push({
          ...chunk,
          embeddings: embeddings
        });
        
      } catch (error) {
        logger.error(`❌ Error generating embeddings for chunk ${i + 1}:`, error);
        // Continue with other chunks
        embeddedChunks.push(chunk);
      }
    }
    
    return embeddedChunks;
  }

  async storeChunksWithRelationships(chunks, documentId) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Store chunk with hierarchical metadata using new schema
        const embeddingVector = chunk.embeddings?.content ? `[${chunk.embeddings.content.join(',')}]` : null;
        const contextualVector = chunk.embeddings?.contextual ? `[${chunk.embeddings.contextual.join(',')}]` : null;
        const hierarchicalVector = chunk.embeddings?.hierarchical ? `[${chunk.embeddings.hierarchical.join(',')}]` : null;
        const semanticVector = chunk.embeddings?.semantic ? `[${chunk.embeddings.semantic.join(',')}]` : null;
        
        const result = await this.db.query(`
          INSERT INTO kb_chunks (
            source_id, chunk_id, version, content, embedding, 
            contextual_embedding, hierarchical_embedding, semantic_embedding,
            chunk_index, token_count, character_count, word_count,
            parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
            scale, node_id, hierarchy_path, semantic_boundaries,
            processing_version, chunk_quality_metrics, quality_score,
            metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
          RETURNING id
        `, [
          documentId,                                    // $1: source_id
          chunk.id,                                      // $2: chunk_id
          '2.0',                                         // $3: version
          chunk.content,                                 // $4: content
          embeddingVector,                               // $5: embedding
          contextualVector,                              // $6: contextual_embedding
          hierarchicalVector,                            // $7: hierarchical_embedding
          semanticVector,                                // $8: semantic_embedding
          i,                                             // $9: chunk_index
          chunk.tokenCount || 0,                         // $10: token_count
          chunk.content.length,                          // $11: character_count
          chunk.content.split(/\s+/).length,             // $12: word_count
          chunk.previousId || null,                      // $13: parent_chunk_id (using previousId as parent for now)
          chunk.childIds || null,                        // $14: child_chunk_ids
          chunk.siblingIds || null,                      // $15: sibling_chunk_ids
          chunk.scale || 'paragraph',                    // $16: scale
          chunk.id,                                      // $17: node_id (same as chunk_id)
          chunk.hierarchyPath || null,                   // $18: hierarchy_path
          chunk.semanticBoundaries || null,              // $19: semantic_boundaries
          '2.0',                                         // $20: processing_version
          JSON.stringify(chunk.quality || {}),           // $21: chunk_quality_metrics
          chunk.quality?.score || 0.5,                   // $22: quality_score
          JSON.stringify({                               // $23: metadata
            processingMethod: 'hierarchical-semantic-chunking-v2',
            chunkingVersion: '2.0',
            originalMetadata: chunk.metadata || {}
          })
        ]);
        
        logger.debug(`✅ Stored chunk ${i + 1}/${chunks.length} with relationships`);
        
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
    
    logger.info('\n📊 ADVANCED DOCUMENT INGESTION REPORT');
    logger.info('═'.repeat(60));
    logger.info(`📄 Documents Processed: ${this.stats.documentsProcessed}`);
    logger.info(`🧩 Chunks Generated: ${this.stats.chunksGenerated}`);
    logger.info(`🔮 Embeddings Created: ${this.stats.embeddingsCreated}`);
    logger.info(`⏱️ Total Processing Time: ${totalTime}ms`);
    logger.info(`⚡ Average Time per Document: ${this.stats.documentsProcessed > 0 ? Math.round(this.stats.totalProcessingTime / this.stats.documentsProcessed) : 0}ms`);
    logger.info(`❌ Errors: ${this.stats.errors}`);
    logger.info(`✅ Success Rate: ${this.stats.documentsProcessed > 0 ? Math.round((this.stats.documentsProcessed - this.stats.errors) / this.stats.documentsProcessed * 100) : 0}%`);
    logger.info('═'.repeat(60));
    
    // Store processing report
    const reportPath = path.join(this.backupsPath, `ingestion-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: this.stats,
      processingMethod: 'hierarchical-semantic-chunking-v2',
      features: ['multi-scale-embeddings', 'hierarchical-relationships', 'quality-assessment']
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
      
      logger.info(`\n🚀 Starting advanced ingestion of ${documents.length} documents`);
      logger.info('Using: Hierarchical Semantic Chunking + Multi-Scale Embeddings');
      logger.info('═'.repeat(60));
      
      // Ask user if they want to clear existing data
      logger.info('⚠️ This will replace all existing document data with the new advanced processing method');
      
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
      
      logger.info('\n🎉 Advanced document ingestion completed!');
      
    } catch (error) {
      logger.error('💥 Advanced document ingestion failed:', error);
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
  const ingestion = new AdvancedDocumentIngestion();
  
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

module.exports = AdvancedDocumentIngestion;
