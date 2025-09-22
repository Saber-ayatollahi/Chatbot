#!/usr/bin/env node

/**
 * Simple Re-ingestion Script
 * 
 * Uses the existing system to re-ingest documents from staging folder
 */

const path = require('path');
const fs = require('fs-extra');
const { initializeConfig } = require('../config/environment');
const { initializeDatabase, closeDatabase } = require('../config/database');
const logger = require('../utils/logger');

async function main() {
  try {
    console.log('🚀 Starting simple document re-ingestion...');
    console.log('═'.repeat(60));
    
    // Initialize configuration and database
    const config = initializeConfig();
    const db = await initializeDatabase();
    
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
    
    // Use the existing enhanced ingestion script
    console.log('🔄 Running existing enhanced ingestion...');
    
    const { spawn } = require('child_process');
    
    const ingestionProcess = spawn('node', ['scripts/enhancedIngestion.js'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    ingestionProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Enhanced ingestion completed successfully!');
        
        // Move processed files
        console.log('📁 Moving processed files...');
        documents.forEach(async (filename) => {
          try {
            const sourcePath = path.join(stagingPath, filename);
            const targetPath = path.join(documentsPath, filename);
            
            if (await fs.pathExists(sourcePath)) {
              await fs.ensureDir(documentsPath);
              await fs.move(sourcePath, targetPath, { overwrite: true });
              console.log(`  ✅ Moved: ${filename}`);
            }
          } catch (error) {
            console.log(`  ❌ Failed to move ${filename}: ${error.message}`);
          }
        });
        
        console.log('\n🎉 Document re-ingestion completed!');
        console.log('🚀 Your documents have been processed and are ready for use!');
        
      } else {
        console.error(`\n❌ Enhanced ingestion failed with code: ${code}`);
      }
      
      process.exit(code);
    });
    
    ingestionProcess.on('error', (error) => {
      console.error('❌ Failed to start enhanced ingestion:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('💥 Re-ingestion failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
