/**
 * Document Ingestion Script
 * Ingest User Guide documents into the knowledge base
 * Phase 1: Foundation & Infrastructure Setup
 */

const path = require('path');
const fs = require('fs-extra');
const { initializeConfig } = require('../config/environment');
const { initializeDatabase } = require('../config/database');
const IngestionPipeline = require('../knowledge/ingestion/IngestionPipeline');
const QualityValidator = require('../knowledge/validation/QualityValidator');
const logger = require('../utils/logger');

async function main() {
  try {
    console.log('📚 Starting document ingestion...');
    
    // Initialize configuration and database
    const config = initializeConfig();
    const db = await initializeDatabase();
    
    // Initialize ingestion pipeline
    const pipeline = new IngestionPipeline();
    const validator = new QualityValidator();
    
    // Define documents to ingest
    const documents = [
      {
        filePath: './knowledge_base/documents/Fund_Manager_User_Guide_1.9.pdf',
        sourceId: 'guide_1_v1.9',
        version: '1.9'
      },
      {
        filePath: './knowledge_base/documents/Fund Manager User Guide 1.9.docx',
        sourceId: 'guide_1_v1.9_docx',
        version: '1.9'
      }
    ];
    
    // Validate files exist
    for (const doc of documents) {
      if (!await fs.pathExists(doc.filePath)) {
        throw new Error(`Document not found: ${doc.filePath}`);
      }
    }
    
    console.log(`📄 Found ${documents.length} documents to ingest`);
    
    // Ingestion options
    const options = {
      chunkingOptions: {
        strategy: 'semantic',
        maxTokens: 450,
        overlapTokens: 50,
        preserveStructure: true
      },
      embeddingOptions: {
        batchSize: 100,
        useCache: true,
        validateDimensions: true
      },
      stopOnError: false,
      delayBetweenDocuments: 1000 // 1 second delay
    };
    
    // Perform batch ingestion
    console.log('🔄 Starting batch ingestion...');
    const batchResult = await pipeline.ingestDocumentBatch(documents, options);
    
    // Display results
    console.log('\n📊 Ingestion Results:');
    console.log(`✅ Success: ${batchResult.successCount}/${batchResult.totalDocuments} documents`);
    console.log(`❌ Failures: ${batchResult.failureCount}/${batchResult.totalDocuments} documents`);
    console.log(`📄 Total chunks: ${batchResult.summary.totalChunks}`);
    console.log(`🔮 Total embeddings: ${batchResult.summary.totalEmbeddings}`);
    console.log(`⏱️ Total time: ${batchResult.processingTime}ms`);
    console.log(`📈 Average time per document: ${batchResult.averageTimePerDocument}ms`);
    
    // Show individual results
    console.log('\n📋 Individual Results:');
    batchResult.results.forEach((result, index) => {
      const doc = documents[index];
      if (result.success) {
        console.log(`✅ ${doc.sourceId}: ${result.chunks.total} chunks, quality: ${result.chunks.averageQuality}`);
      } else {
        console.log(`❌ ${doc.sourceId}: ${result.error}`);
      }
    });
    
    // Show errors if any
    if (batchResult.errors.length > 0) {
      console.log('\n❌ Errors:');
      batchResult.errors.forEach(error => {
        console.log(`  - ${error.sourceId}: ${error.error}`);
      });
    }
    
    // Perform quality validation on successful ingestions
    console.log('\n🔍 Performing quality validation...');
    for (const result of batchResult.results) {
      if (result.success) {
        try {
          console.log(`\n📊 Validating ${result.sourceId}...`);
          const validation = await validator.validateDocumentQuality(result.sourceId);
          
          console.log(`  Overall Score: ${validation.overallScore.toFixed(1)}/100 (${validation.qualityGrade})`);
          console.log(`  Total Chunks: ${validation.totalChunks}`);
          console.log(`  Issues: ${validation.issues.length}`);
          console.log(`  Warnings: ${validation.warnings.length}`);
          console.log(`  Recommendations: ${validation.recommendations.length}`);
          
          if (validation.issues.length > 0) {
            console.log('  🚨 Issues:');
            validation.issues.forEach(issue => console.log(`    - ${issue}`));
          }
          
          if (validation.recommendations.length > 0) {
            console.log('  💡 Top Recommendations:');
            validation.recommendations.slice(0, 3).forEach(rec => {
              console.log(`    - [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
            });
          }
        } catch (validationError) {
          console.log(`  ⚠️ Validation failed: ${validationError.message}`);
        }
      }
    }
    
    // Final summary
    console.log('\n🎉 Document ingestion completed!');
    console.log('📈 Next steps:');
    console.log('  1. Review validation reports for any issues');
    console.log('  2. Test retrieval functionality');
    console.log('  3. Begin Phase 2 implementation');
    
    // Close database connection
    await db.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Document ingestion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
