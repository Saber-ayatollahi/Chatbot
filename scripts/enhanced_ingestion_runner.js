/**
 * Enhanced Ingestion Runner
 * Script to run the enhanced document processing with all fixes built-in
 */

const EnhancedDocumentProcessingService = require('../services/EnhancedDocumentProcessingService');
const { getDatabase } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

class EnhancedIngestionRunner {
  constructor() {
    this.processingService = new EnhancedDocumentProcessingService();
    this.db = getDatabase();
  }

  /**
   * Run enhanced ingestion on all documents in knowledge_base/documents
   */
  async runEnhancedIngestion() {
    console.log('🚀 STARTING ENHANCED INGESTION WITH ALL FIXES');
    console.log('=' + '='.repeat(60));
    console.log('');

    try {
      // Initialize database connection
      await this.db.initialize();
      
      // Clear existing data (optional)
      const clearExisting = process.argv.includes('--clear');
      if (clearExisting) {
        await this.clearExistingData();
      }
      
      // Get documents to process
      const documentsPath = path.join(__dirname, '../knowledge_base/documents');
      const documents = await this.getDocumentsToProcess(documentsPath);
      
      console.log(`📚 Found ${documents.length} documents to process`);
      console.log('');
      
      // Process each document with enhanced pipeline
      const results = [];
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log(`📄 Processing ${i + 1}/${documents.length}: ${doc.filename}`);
        
        try {
          const result = await this.processDocumentWithEnhancements(doc);
          results.push(result);
          console.log(`✅ Completed: ${result.chunksGenerated} chunks, ${Math.round(result.qualityStats.averageQuality * 100)}% quality`);
        } catch (error) {
          console.error(`❌ Failed to process ${doc.filename}:`, error.message);
          results.push({ filename: doc.filename, error: error.message });
        }
        
        console.log('');
      }
      
      // Generate comprehensive report
      await this.generateIngestionReport(results);
      
      console.log('🎉 ENHANCED INGESTION COMPLETED SUCCESSFULLY!');
      
    } catch (error) {
      console.error('❌ Enhanced ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Clear existing knowledge base data
   */
  async clearExistingData() {
    console.log('🧹 Clearing existing knowledge base data...');
    
    await this.db.query('DELETE FROM kb_chunks');
    await this.db.query('DELETE FROM kb_sources');
    await this.db.query('DELETE FROM ingestion_jobs');
    
    console.log('   ✅ Cleared existing data');
    console.log('');
  }

  /**
   * Get documents to process from the documents directory
   */
  async getDocumentsToProcess(documentsPath) {
    const files = await fs.readdir(documentsPath);
    const documents = [];
    
    for (const filename of files) {
      const filePath = path.join(documentsPath, filename);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && this.isSupportedDocument(filename)) {
        documents.push({
          filename: filename,
          filePath: filePath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
    
    return documents.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  /**
   * Check if document type is supported
   */
  isSupportedDocument(filename) {
    const supportedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * Process document with enhanced pipeline
   */
  async processDocumentWithEnhancements(document) {
    // Create source record
    const sourceId = await this.createSourceRecord(document);
    
    // Process with enhanced service
    const result = await this.processingService.processDocument(
      document.filePath,
      sourceId,
      '1.0',
      {
        // Enhanced processing options
        documentParsing: {
          preserveStructure: true,
          extractHeadings: true,
          removeJunkContent: true,
          detectSections: true
        },
        contentFiltering: {
          removeTableOfContents: true,
          removeCopyrightNotices: true,
          removeIntroductionSections: true,
          minContentLength: 100
        },
        qualityValidation: {
          enableRealTimeValidation: true,
          minQualityScore: 0.4,
          contentRelevanceCheck: true
        }
      }
    );
    
    return {
      ...result,
      filename: document.filename,
      sourceId: sourceId
    };
  }

  /**
   * Create source record in database
   */
  async createSourceRecord(document) {
    const sourceId = `enh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.query(`
      INSERT INTO kb_sources (
        source_id, filename, file_path, file_size, 
        processing_status, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'processing', '1.0', NOW(), NOW())
    `, [
      sourceId,
      document.filename,
      document.filePath,
      document.size
    ]);
    
    return sourceId;
  }

  /**
   * Generate comprehensive ingestion report
   */
  async generateIngestionReport(results) {
    console.log('📊 ENHANCED INGESTION REPORT');
    console.log('=' + '='.repeat(40));
    
    const successfulResults = results.filter(r => !r.error);
    const failedResults = results.filter(r => r.error);
    
    // Overall statistics
    const totalChunks = successfulResults.reduce((sum, r) => sum + (r.chunksGenerated || 0), 0);
    const averageQuality = successfulResults.length > 0 
      ? successfulResults.reduce((sum, r) => sum + (r.qualityStats?.averageQuality || 0), 0) / successfulResults.length
      : 0;
    const totalProcessingTime = successfulResults.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    
    console.log(`📈 Overall Statistics:`);
    console.log(`   📚 Documents Processed: ${successfulResults.length}/${results.length}`);
    console.log(`   📄 Total Chunks Generated: ${totalChunks}`);
    console.log(`   ⭐ Average Quality Score: ${Math.round(averageQuality * 100)}%`);
    console.log(`   ⏱️ Total Processing Time: ${Math.round(totalProcessingTime / 1000)}s`);
    console.log('');
    
    // Successful documents
    if (successfulResults.length > 0) {
      console.log(`✅ Successfully Processed Documents:`);
      successfulResults.forEach(result => {
        console.log(`   📄 ${result.filename}: ${result.chunksGenerated} chunks (${Math.round((result.qualityStats?.averageQuality || 0) * 100)}% quality)`);
      });
      console.log('');
    }
    
    // Failed documents
    if (failedResults.length > 0) {
      console.log(`❌ Failed Documents:`);
      failedResults.forEach(result => {
        console.log(`   📄 ${result.filename}: ${result.error}`);
      });
      console.log('');
    }
    
    // Validate final knowledge base state
    await this.validateKnowledgeBaseState();
  }

  /**
   * Validate final knowledge base state
   */
  async validateKnowledgeBaseState() {
    console.log('🔍 Validating Knowledge Base State:');
    
    // Get final statistics
    const stats = await this.db.query(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(*) FILTER (WHERE heading IS NOT NULL AND heading != 'No heading') as chunks_with_headings,
        COUNT(*) FILTER (WHERE quality_score >= 0.4) as high_quality_chunks,
        AVG(quality_score) as avg_quality,
        COUNT(DISTINCT source_id) as total_sources
      FROM kb_chunks
    `);
    
    const s = stats.rows[0];
    
    console.log(`   📚 Total Chunks: ${s.total_chunks}`);
    console.log(`   📝 Chunks with Headings: ${s.chunks_with_headings} (${Math.round(s.chunks_with_headings/s.total_chunks*100)}%)`);
    console.log(`   ⭐ High Quality Chunks: ${s.high_quality_chunks} (${Math.round(s.high_quality_chunks/s.total_chunks*100)}%)`);
    console.log(`   🎯 Average Quality: ${Math.round(s.avg_quality * 100)}%`);
    console.log(`   📋 Total Sources: ${s.total_sources}`);
    
    // Test search functionality
    console.log('');
    console.log('🧪 Testing Search Functionality:');
    
    const testQueries = [
      'how to create a fund',
      'fund update process',
      'fund types available',
      'step by step guide'
    ];
    
    for (const query of testQueries) {
      const searchResult = await this.db.query(`
        SELECT COUNT(*) as matches
        FROM kb_chunks 
        WHERE to_tsvector('english', COALESCE(heading, '') || ' ' || content) 
              @@ plainto_tsquery('english', $1)
      `, [query]);
      
      console.log(`   "${query}": ${searchResult.rows[0].matches} matching chunks`);
    }
    
    console.log('');
    console.log('✅ Knowledge base validation completed!');
  }
}

// Main execution
async function main() {
  const runner = new EnhancedIngestionRunner();
  
  try {
    await runner.runEnhancedIngestion();
    process.exit(0);
  } catch (error) {
    console.error('❌ Enhanced ingestion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = EnhancedIngestionRunner;
