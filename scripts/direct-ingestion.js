#!/usr/bin/env node

/**
 * Direct Document Ingestion
 * 
 * Directly processes documents from staging folder using the existing system
 */

const path = require('path');
const fs = require('fs-extra');
const { initializeDatabase, closeDatabase } = require('../config/database');
const logger = require('../utils/logger');

async function processDocumentsDirectly() {
  let db;
  
  try {
    console.log('🚀 Starting direct document ingestion...');
    console.log('═'.repeat(60));
    
    // Initialize database
    db = await initializeDatabase();
    
    // Get documents from staging folder
    const stagingPath = path.join(__dirname, '../knowledge_base/staging');
    const files = await fs.readdir(stagingPath);
    const supportedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const documents = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });
    
    console.log(`📋 Found ${documents.length} documents to process:`);
    documents.forEach(doc => console.log(`  📄 ${doc}`));
    console.log('');
    
    // Clear existing data
    console.log('🗑️ Clearing existing document data...');
    await db.query('DELETE FROM kb_chunks');
    await db.query('DELETE FROM kb_sources');
    await db.query('DELETE FROM embedding_cache');
    console.log('✅ Existing data cleared');
    console.log('');
    
    // Process each document using the existing enhanced ingestion system
    for (let i = 0; i < documents.length; i++) {
      const filename = documents[i];
      const filePath = path.join(stagingPath, filename);
      
      console.log(`📋 Processing ${i + 1}/${documents.length}: ${filename}`);
      console.log('─'.repeat(50));
      
      try {
        // Use the existing enhanced ingestion system but with correct file paths
        const EnhancedIngestionSystem = require('./enhancedIngestion');
        const ingestionSystem = new EnhancedIngestionSystem();
        
        // Process the document
        await ingestionSystem.processDocument(filePath, filename);
        
        console.log(`✅ ${filename} processed successfully`);
        
      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
      }
      
      console.log('');
    }
    
    // Check final status
    const sources = await db.query('SELECT COUNT(*) as count FROM kb_sources');
    const chunks = await db.query('SELECT COUNT(*) as count FROM kb_chunks');
    const embeddings = await db.query('SELECT COUNT(*) as count FROM kb_chunks WHERE content_vector IS NOT NULL');
    
    console.log('📊 INGESTION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`📄 Sources processed: ${sources.rows[0].count}`);
    console.log(`🧩 Total chunks: ${chunks.rows[0].count}`);
    console.log(`🔮 Chunks with embeddings: ${embeddings.rows[0].count}`);
    console.log('═'.repeat(60));
    
    if (sources.rows[0].count > 0) {
      console.log('🎉 Document ingestion completed successfully!');
      console.log('🚀 Your documents are now ready for enhanced querying!');
    } else {
      console.log('⚠️ No documents were successfully processed.');
    }
    
  } catch (error) {
    console.error('💥 Direct ingestion failed:', error);
    process.exit(1);
  } finally {
    if (db) {
      await closeDatabase();
    }
  }
}

// Enhanced Ingestion System class (simplified version)
class EnhancedIngestionSystem {
  constructor() {
    this.db = null;
  }
  
  async initialize() {
    if (!this.db) {
      const { getDatabase } = require('../config/database');
      this.db = getDatabase();
    }
  }
  
  async processDocument(filePath, filename) {
    await this.initialize();
    
    // Extract text content
    const content = await this.extractText(filePath);
    if (!content || content.trim().length === 0) {
      throw new Error('No text content extracted');
    }
    
    console.log(`  📄 Extracted ${content.length} characters`);
    
    // Create source record
    const sourceId = await this.createSource(filename, filePath, content);
    console.log(`  📝 Created source: ${sourceId}`);
    
    // Create chunks (simple chunking for now)
    const chunks = this.createChunks(content, sourceId);
    console.log(`  🧩 Created ${chunks.length} chunks`);
    
    // Generate embeddings and store chunks
    await this.storeChunksWithEmbeddings(chunks);
    console.log(`  🔮 Generated embeddings and stored chunks`);
    
    return { sourceId, chunksCount: chunks.length };
  }
  
  async extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.txt' || ext === '.md') {
      return fs.readFileSync(filePath, 'utf8');
    }
    
    if (ext === '.pdf') {
      // Use pdf-parse for PDF extraction
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }
    
    if (ext === '.docx') {
      // Use mammoth for DOCX extraction
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    
    throw new Error(`Unsupported file type: ${ext}`);
  }
  
  async createSource(filename, filePath, content) {
    const stats = fs.statSync(filePath);
    const sourceId = `src_${Date.now()}_${path.parse(filename).name}`;
    
    await this.db.query(`
      INSERT INTO kb_sources (
        source_id, source_name, source_type, file_path, 
        content_preview, file_size, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `, [
      sourceId,
      filename,
      path.extname(filename).toLowerCase().substring(1),
      filePath,
      content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      stats.size
    ]);
    
    return sourceId;
  }
  
  createChunks(content, sourceId) {
    // Simple chunking - split by paragraphs and limit size
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks = [];
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      // Split large paragraphs
      if (paragraph.length > 1000) {
        const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > 800) {
            if (currentChunk.trim()) {
              chunks.push({
                id: `${sourceId}_chunk_${chunkIndex++}`,
                sourceId,
                content: currentChunk.trim(),
                chunkIndex: chunkIndex - 1
              });
            }
            currentChunk = sentence.trim();
          } else {
            currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
          }
        }
        
        if (currentChunk.trim()) {
          chunks.push({
            id: `${sourceId}_chunk_${chunkIndex++}`,
            sourceId,
            content: currentChunk.trim(),
            chunkIndex: chunkIndex - 1
          });
        }
      } else {
        chunks.push({
          id: `${sourceId}_chunk_${chunkIndex++}`,
          sourceId,
          content: paragraph.trim(),
          chunkIndex: chunkIndex - 1
        });
      }
    }
    
    return chunks;
  }
  
  async storeChunksWithEmbeddings(chunks) {
    const OpenAI = require('openai');
    const { getConfig } = require('../config/environment');
    
    const config = getConfig();
    const openai = new OpenAI({
      apiKey: config.get('openai.apiKey')
    });
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: chunk.content,
          encoding_format: 'float'
        });
        
        const embedding = response.data[0].embedding;
        
        // Store chunk with embedding
        await this.db.query(`
          INSERT INTO kb_chunks (
            source_id, chunk_id, content, content_vector, 
            chunk_index, token_count, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          chunk.sourceId,
          chunk.id,
          chunk.content,
          JSON.stringify(embedding),
          chunk.chunkIndex,
          Math.ceil(chunk.content.length / 4) // Rough token estimate
        ]);
        
      } catch (error) {
        console.warn(`  ⚠️ Failed to generate embedding for chunk ${i + 1}: ${error.message}`);
        
        // Store chunk without embedding
        await this.db.query(`
          INSERT INTO kb_chunks (
            source_id, chunk_id, content, chunk_index, 
            token_count, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          chunk.sourceId,
          chunk.id,
          chunk.content,
          chunk.chunkIndex,
          Math.ceil(chunk.content.length / 4)
        ]);
      }
    }
  }
}

if (require.main === module) {
  processDocumentsDirectly();
}

module.exports = { EnhancedIngestionSystem };
