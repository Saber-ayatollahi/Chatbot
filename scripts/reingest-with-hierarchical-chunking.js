#!/usr/bin/env node

/**
 * Re-ingest Documents with Hierarchical Chunking
 * 
 * Uses the existing ingestion pipeline but replaces the chunker with
 * the new HierarchicalSemanticChunker for better document understanding
 */

const path = require('path');
const fs = require('fs-extra');
const { initializeConfig } = require('../config/environment');
const { initializeDatabase, closeDatabase } = require('../config/database');
const IngestionPipeline = require('../knowledge/ingestion/IngestionPipeline');
const HierarchicalSemanticChunker = require('../knowledge/chunking/HierarchicalSemanticChunker');
const logger = require('../utils/logger');

class HierarchicalIngestionPipeline extends IngestionPipeline {
  constructor() {
    super();
    
    // Replace the default chunker with our hierarchical one
    this.chunker = new HierarchicalSemanticChunker({
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
    
    logger.info('🔧 Hierarchical Ingestion Pipeline initialized with enhanced chunking');
  }

  /**
   * Override the chunk document method to use hierarchical chunking
   */
  async chunkDocument(document, options = {}) {
    logger.info('🧩 Using Hierarchical Semantic Chunking...');
    
    const chunks = await this.chunker.chunkDocument(document.content, {
      documentId: document.sourceId,
      filename: document.filename,
      preserveStructure: true,
      enableQualityAssessment: true,
      ...options
    });
    
    // Enhance chunks with document metadata
    const enhancedChunks = chunks.map((chunk, index) => ({
      ...chunk,
      sourceId: document.sourceId,
      documentVersion: document.version,
      chunkIndex: index,
      originalFilename: document.filename,
      processingMethod: 'hierarchical-semantic-chunking-v2'
    }));
    
    logger.info(`✅ Generated ${enhancedChunks.length} hierarchical chunks`);
    logger.info(`📊 Average quality score: ${this.calculateAverageQuality(enhancedChunks).toFixed(3)}`);
    
    return enhancedChunks;
  }

  calculateAverageQuality(chunks) {
    if (!chunks || chunks.length === 0) return 0;
    
    const totalQuality = chunks.reduce((sum, chunk) => {
      return sum + (chunk.qualityScore || 0);
    }, 0);
    
    return totalQuality / chunks.length;
  }
}

async function main() {
  try {
    console.log('🚀 Starting document re-ingestion with Hierarchical Chunking...');
    console.log('═'.repeat(70));
    
    // Initialize configuration and database
    const config = initializeConfig();
    const db = await initializeDatabase();
    
    // Initialize enhanced ingestion pipeline
    const pipeline = new HierarchicalIngestionPipeline();
    
    // Get documents from staging folder
    const stagingPath = path.join(__dirname, '../knowledge_base/staging');
    const documentsPath = path.join(__dirname, '../knowledge_base/documents');
    
    if (!await fs.pathExists(stagingPath)) {
      throw new Error(`Staging folder not found: ${stagingPath}`);
    }
    
    const files = await fs.readdir(stagingPath);
    const supportedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const documents = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });
    
    if (documents.length === 0) {
      console.log('⚠️ No documents found in staging folder');
      return;
    }
    
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
    
    // Process each document
    const results = [];
    
    for (let i = 0; i < documents.length; i++) {
      const filename = documents[i];
      const filePath = path.join(stagingPath, filename);
      const sourceId = `doc_${i + 1}_${path.parse(filename).name}`;
      const version = '2.0';
      
      console.log(`📋 Processing ${i + 1}/${documents.length}: ${filename}`);
      console.log('─'.repeat(50));
      
      try {
        const result = await pipeline.ingestDocument(filePath, sourceId, version, {
          chunkingOptions: {
            preserveStructure: true,
            enableQualityAssessment: true,
            hierarchicalProcessing: true
          },
          embeddingOptions: {
            model: 'text-embedding-3-large',
            dimensions: 3072
          }
        });
        
        results.push({
          filename,
          success: true,
          ...result
        });
        
        console.log(`✅ ${filename} processed successfully`);
        console.log(`   📊 Chunks: ${result.totalChunks}, Quality: ${result.averageQuality?.toFixed(3) || 'N/A'}`);
        
        // Move processed file to documents folder
        const processedPath = path.join(documentsPath, filename);
        await fs.ensureDir(documentsPath);
        await fs.move(filePath, processedPath, { overwrite: true });
        console.log(`   📁 Moved to: ${processedPath}`);
        
      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        results.push({
          filename,
          success: false,
          error: error.message
        });
      }
      
      console.log('');
    }
    
    // Generate summary report
    console.log('📊 INGESTION SUMMARY REPORT');
    console.log('═'.repeat(70));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`📄 Total Documents: ${results.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📈 Success Rate: ${Math.round((successful.length / results.length) * 100)}%`);
    
    if (successful.length > 0) {
      const totalChunks = successful.reduce((sum, r) => sum + (r.totalChunks || 0), 0);
      const avgQuality = successful.reduce((sum, r) => sum + (r.averageQuality || 0), 0) / successful.length;
      
      console.log(`🧩 Total Chunks Generated: ${totalChunks}`);
      console.log(`📊 Average Quality Score: ${avgQuality.toFixed(3)}`);
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Documents:');
      failed.forEach(f => console.log(`   • ${f.filename}: ${f.error}`));
    }
    
    console.log('═'.repeat(70));
    console.log('🎉 Document re-ingestion with Hierarchical Chunking completed!');
    console.log('');
    console.log('✨ Your documents now feature:');
    console.log('   🔹 Hierarchical Semantic Chunking (4 scales)');
    console.log('   🔹 Enhanced Context Preservation');
    console.log('   🔹 Quality Assessment and Scoring');
    console.log('   🔹 Semantic Boundary Detection');
    console.log('   🔹 Parent-Child Relationships');
    console.log('');
    console.log('🚀 The system is ready with improved document understanding!');
    
  } catch (error) {
    console.error('💥 Ingestion failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { HierarchicalIngestionPipeline };
