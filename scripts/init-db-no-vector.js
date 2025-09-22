#!/usr/bin/env node

/**
 * Initialize Database Without Vector Support
 * Fallback initialization for systems without pgvector
 */

require('dotenv').config();
const { DatabaseConfig } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function initializeDatabaseNoVector() {
  console.log('🚀 Initializing database without vector support...');
  
  let db;
  try {
    db = new DatabaseConfig();
    await db.initialize();
    
    console.log('📄 Loading fallback schema...');
    const schemaPath = path.join(__dirname, '../database/schema-no-vector.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🔄 Executing schema...');
    await db.transaction(async (transactionDb) => {
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`📄 Executing ${statements.length} schema statements...`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement) {
          try {
            await transactionDb.query(statement);
            console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
          } catch (error) {
            // Ignore "already exists" errors for idempotent operations
            if (!error.message.includes('already exists') && 
                !error.message.includes('does not exist')) {
              console.error(`❌ Statement ${i + 1} failed:`, error.message);
              throw error;
            } else {
              console.log(`⚠️ Statement ${i + 1} skipped (${error.message.includes('already exists') ? 'already exists' : 'safe to ignore'})`);
            }
          }
        }
      }
    });
    
    console.log('✅ Database schema initialized successfully (no vector support)');
    
    // Verify tables were created
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    console.log('\n🎯 Next steps:');
    console.log('1. Install pgvector extension for full vector search capability');
    console.log('2. Run: npm run ingest to process User Guide documents');
    console.log('3. Test the system: npm run health');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabaseNoVector();
}

module.exports = { initializeDatabaseNoVector };
