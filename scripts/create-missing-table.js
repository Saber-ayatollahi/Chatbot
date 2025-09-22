#!/usr/bin/env node

/**
 * Create Missing Tables
 * Simple script to create the missing embedding_cache table
 */

require('dotenv').config();
const { DatabaseConfig } = require('../config/database');

async function createMissingTables() {
  console.log('🔧 Creating missing tables...');
  
  let db;
  try {
    db = new DatabaseConfig();
    await db.initialize();
    
    // Create embedding_cache table without vector support
    console.log('📄 Creating embedding_cache table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
          id SERIAL PRIMARY KEY,
          cache_key VARCHAR(64) UNIQUE NOT NULL,
          text_hash VARCHAR(64) NOT NULL,
          embedding_text TEXT NOT NULL,
          model VARCHAR(50) NOT NULL,
          token_count INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          access_count INTEGER DEFAULT 1,
          
          CONSTRAINT valid_token_count CHECK (token_count >= 0)
      );
    `);
    
    console.log('📊 Creating indexes for embedding_cache...');
    await db.query(`CREATE INDEX IF NOT EXISTS idx_embedding_cache_key ON embedding_cache (cache_key);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_embedding_cache_text_hash ON embedding_cache (text_hash);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_embedding_cache_model ON embedding_cache (model);`);
    
    console.log('✅ Missing tables created successfully');
    
    // Verify the table exists
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'embedding_cache'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ embedding_cache table verified');
    } else {
      console.log('❌ embedding_cache table not found');
    }
    
  } catch (error) {
    console.error('❌ Failed to create missing tables:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  createMissingTables();
}

module.exports = { createMissingTables };
