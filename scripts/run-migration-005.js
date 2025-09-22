#!/usr/bin/env node

/**
 * Run Migration 005: Add Advanced Hierarchical Columns
 * Adds columns required for hierarchical semantic chunking and multi-scale embeddings
 */

const { initializeDatabase, closeDatabase } = require('../config/database');
const logger = require('../utils/logger');

async function runMigration() {
  let db;
  
  try {
    console.log('🔄 Starting Migration 005: Advanced Hierarchical Columns');
    console.log('═'.repeat(60));
    
    // Initialize database
    db = await initializeDatabase();
    console.log('✅ Database connected');
    
    // Check current schema
    const currentColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'kb_chunks' 
      ORDER BY column_name
    `);
    
    console.log('📋 Current kb_chunks columns:', currentColumns.rows.map(r => r.column_name).join(', '));
    
    // Add hierarchical relationship columns
    console.log('\n🔧 Adding hierarchical relationship columns...');
    
    const hierarchicalColumns = [
      { name: 'parent_chunk_id', type: 'VARCHAR(100)', description: 'ID of parent chunk in hierarchical structure' },
      { name: 'child_chunk_ids', type: 'TEXT[]', description: 'Array of child chunk IDs' },
      { name: 'sibling_chunk_ids', type: 'TEXT[]', description: 'Array of sibling chunk IDs at same hierarchical level' },
      { name: 'scale', type: 'VARCHAR(20)', description: 'Hierarchical scale: document, section, paragraph, sentence' },
      { name: 'node_id', type: 'VARCHAR(100)', description: 'Unique node identifier in document hierarchy' },
      { name: 'hierarchy_path', type: 'TEXT[]', description: 'Path from document root to this chunk' }
    ];
    
    for (const col of hierarchicalColumns) {
      try {
        const exists = await db.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'kb_chunks' AND column_name = $1
        `, [col.name]);
        
        if (exists.rows.length === 0) {
          await db.query(`ALTER TABLE kb_chunks ADD COLUMN ${col.name} ${col.type}`);
          console.log(`  ✅ Added column: ${col.name} (${col.type})`);
        } else {
          console.log(`  ⚠️ Column already exists: ${col.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to add column ${col.name}:`, error.message);
      }
    }
    
    // Add multi-scale embedding columns
    console.log('\n🔧 Adding multi-scale embedding columns...');
    
    const embeddingColumns = [
      { name: 'contextual_embedding', type: 'vector(3072)', description: 'Embedding with surrounding context' },
      { name: 'hierarchical_embedding', type: 'vector(3072)', description: 'Embedding with hierarchical position info' },
      { name: 'semantic_embedding', type: 'vector(3072)', description: 'Domain-optimized semantic embedding' }
    ];
    
    for (const col of embeddingColumns) {
      try {
        const exists = await db.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'kb_chunks' AND column_name = $1
        `, [col.name]);
        
        if (exists.rows.length === 0) {
          await db.query(`ALTER TABLE kb_chunks ADD COLUMN ${col.name} ${col.type}`);
          console.log(`  ✅ Added column: ${col.name} (${col.type})`);
        } else {
          console.log(`  ⚠️ Column already exists: ${col.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to add column ${col.name}:`, error.message);
      }
    }
    
    // Add metadata columns
    console.log('\n🔧 Adding metadata columns...');
    
    const metadataColumns = [
      { name: 'semantic_boundaries', type: 'INTEGER[]', description: 'Detected semantic boundary positions' },
      { name: 'processing_version', type: 'VARCHAR(20) DEFAULT \'2.0\'', description: 'Version of processing pipeline used' },
      { name: 'chunk_quality_metrics', type: 'JSONB', description: 'Detailed quality assessment metrics' }
    ];
    
    for (const col of metadataColumns) {
      try {
        const exists = await db.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'kb_chunks' AND column_name = $1
        `, [col.name]);
        
        if (exists.rows.length === 0) {
          await db.query(`ALTER TABLE kb_chunks ADD COLUMN ${col.name} ${col.type}`);
          console.log(`  ✅ Added column: ${col.name} (${col.type})`);
        } else {
          console.log(`  ⚠️ Column already exists: ${col.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to add column ${col.name}:`, error.message);
      }
    }
    
    // Add indexes
    console.log('\n🔧 Adding indexes...');
    
    const indexes = [
      { name: 'idx_chunks_parent_id', column: 'parent_chunk_id', type: 'btree' },
      { name: 'idx_chunks_scale', column: 'scale', type: 'btree' },
      { name: 'idx_chunks_node_id', column: 'node_id', type: 'btree' },
      { name: 'idx_chunks_processing_version', column: 'processing_version', type: 'btree' },
      { name: 'idx_chunks_hierarchy_path', column: 'hierarchy_path', type: 'gin' }
    ];
    
    for (const idx of indexes) {
      try {
        const exists = await db.query(`
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'kb_chunks' AND indexname = $1
        `, [idx.name]);
        
        if (exists.rows.length === 0) {
          if (idx.type === 'gin') {
            await db.query(`CREATE INDEX ${idx.name} ON kb_chunks USING gin (${idx.column})`);
          } else {
            await db.query(`CREATE INDEX ${idx.name} ON kb_chunks (${idx.column})`);
          }
          console.log(`  ✅ Added index: ${idx.name} on ${idx.column}`);
        } else {
          console.log(`  ⚠️ Index already exists: ${idx.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to add index ${idx.name}:`, error.message);
      }
    }
    
    // Add vector indexes for multi-scale embeddings
    console.log('\n🔧 Adding vector indexes...');
    
    const vectorIndexes = [
      { name: 'idx_chunks_contextual_embedding', column: 'contextual_embedding' },
      { name: 'idx_chunks_hierarchical_embedding', column: 'hierarchical_embedding' },
      { name: 'idx_chunks_semantic_embedding', column: 'semantic_embedding' }
    ];
    
    for (const idx of vectorIndexes) {
      try {
        const exists = await db.query(`
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'kb_chunks' AND indexname = $1
        `, [idx.name]);
        
        if (exists.rows.length === 0) {
          await db.query(`CREATE INDEX ${idx.name} ON kb_chunks USING ivfflat (${idx.column} vector_cosine_ops) WITH (lists = 100)`);
          console.log(`  ✅ Added vector index: ${idx.name} on ${idx.column}`);
        } else {
          console.log(`  ⚠️ Vector index already exists: ${idx.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to add vector index ${idx.name}:`, error.message);
      }
    }
    
    // Update existing chunks to have processing version
    console.log('\n🔧 Updating existing chunks...');
    
    try {
      const updateResult = await db.query(`
        UPDATE kb_chunks 
        SET processing_version = '1.0' 
        WHERE processing_version IS NULL
      `);
      console.log(`  ✅ Updated ${updateResult.rowCount} existing chunks with processing_version = '1.0'`);
    } catch (error) {
      console.error('  ❌ Failed to update existing chunks:', error.message);
    }
    
    // Final schema check
    console.log('\n📋 Final schema verification...');
    
    const finalColumns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'kb_chunks' 
      AND column_name IN (
        'parent_chunk_id', 'child_chunk_ids', 'sibling_chunk_ids', 'scale', 
        'node_id', 'hierarchy_path', 'contextual_embedding', 'hierarchical_embedding', 
        'semantic_embedding', 'semantic_boundaries', 'processing_version', 'chunk_quality_metrics'
      )
      ORDER BY column_name
    `);
    
    console.log('📊 New columns added:');
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n✅ Migration 005 completed successfully!');
    console.log('🎉 Database is now ready for advanced hierarchical document processing');
    
  } catch (error) {
    console.error('❌ Migration 005 failed:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await closeDatabase();
    }
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
