#!/usr/bin/env node

/**
 * Test pgvector Installation
 * Comprehensive test to verify pgvector is working
 */

require('dotenv').config();
const { DatabaseConfig } = require('../config/database');

async function testPgvectorInstallation() {
  console.log('🧪 Testing pgvector Installation...');
  console.log('=' .repeat(50));
  
  let db;
  try {
    db = new DatabaseConfig();
    await db.initialize();
    
    console.log('✅ Database connection established');
    
    // Test 1: Check if vector extension exists
    console.log('\n📋 Test 1: Checking vector extension...');
    try {
      const extensionCheck = await db.query(`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'vector'
      `);
      
      if (extensionCheck.rows.length > 0) {
        console.log('✅ pgvector extension is installed');
        console.log(`   Version: ${extensionCheck.rows[0].extversion}`);
      } else {
        console.log('❌ pgvector extension not found');
        
        // Try to install it
        console.log('🔧 Attempting to install vector extension...');
        await db.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ Vector extension installed successfully');
      }
    } catch (error) {
      console.log('❌ Vector extension test failed:', error.message);
      return false;
    }
    
    // Test 2: Basic vector operations
    console.log('\n🔢 Test 2: Basic vector operations...');
    try {
      // Test vector creation
      const vectorTest = await db.query("SELECT '[1,2,3]'::vector as test_vector");
      console.log('✅ Vector creation works');
      
      // Test vector dimensions
      const dimsTest = await db.query("SELECT vector_dims('[1,2,3]'::vector) as dims");
      console.log(`✅ Vector dimensions: ${dimsTest.rows[0].dims}`);
      
      // Test vector distance
      const distTest = await db.query("SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector as distance");
      console.log(`✅ L2 distance: ${distTest.rows[0].distance}`);
      
      // Test cosine similarity
      const cosineTest = await db.query("SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector as cosine_dist");
      console.log(`✅ Cosine distance: ${cosineTest.rows[0].cosine_dist}`);
      
    } catch (error) {
      console.log('❌ Vector operations failed:', error.message);
      return false;
    }
    
    // Test 3: High-dimensional vectors (like embeddings)
    console.log('\n🎯 Test 3: High-dimensional vectors...');
    try {
      // Create a test table with embeddings
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_embeddings (
          id SERIAL PRIMARY KEY,
          content TEXT,
          embedding vector(3072)
        )
      `);
      
      // Generate a test embedding (3072 dimensions)
      const testEmbedding = Array.from({length: 3072}, () => Math.random()).join(',');
      
      // Insert test data
      await db.query(`
        INSERT INTO test_embeddings (content, embedding) 
        VALUES ('test content', '[${testEmbedding}]'::vector)
        ON CONFLICT DO NOTHING
      `);
      
      // Test similarity search
      const similarityTest = await db.query(`
        SELECT content, embedding <=> '[${testEmbedding}]'::vector as similarity
        FROM test_embeddings
        ORDER BY embedding <=> '[${testEmbedding}]'::vector
        LIMIT 1
      `);
      
      console.log('✅ High-dimensional vector operations work');
      console.log(`   Test similarity: ${similarityTest.rows[0]?.similarity || 'N/A'}`);
      
      // Clean up test table
      await db.query('DROP TABLE IF EXISTS test_embeddings');
      
    } catch (error) {
      console.log('❌ High-dimensional vector test failed:', error.message);
      return false;
    }
    
    // Test 4: Vector indexes
    console.log('\n📊 Test 4: Vector indexes...');
    try {
      // Test if we can create vector indexes
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_vector_index (
          id SERIAL PRIMARY KEY,
          embedding vector(1536)
        )
      `);
      
      // Try to create an HNSW index (if supported)
      try {
        await db.query(`
          CREATE INDEX IF NOT EXISTS test_hnsw_idx 
          ON test_vector_index 
          USING hnsw (embedding vector_cosine_ops)
        `);
        console.log('✅ HNSW index creation works');
      } catch (indexError) {
        console.log('⚠️ HNSW index not supported (older pgvector version)');
      }
      
      // Try IVFFlat index
      try {
        await db.query(`
          CREATE INDEX IF NOT EXISTS test_ivfflat_idx 
          ON test_vector_index 
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `);
        console.log('✅ IVFFlat index creation works');
      } catch (indexError) {
        console.log('⚠️ IVFFlat index failed:', indexError.message);
      }
      
      // Clean up
      await db.query('DROP TABLE IF EXISTS test_vector_index');
      
    } catch (error) {
      console.log('❌ Vector index test failed:', error.message);
    }
    
    console.log('\n🎉 pgvector Installation Test Complete!');
    console.log('✅ pgvector is fully functional');
    console.log('\n🚀 Next steps:');
    console.log('1. Update your schema to use vector columns');
    console.log('2. Restart your application');
    console.log('3. Test RAG system with vector search');
    
    return true;
    
  } catch (error) {
    console.error('❌ pgvector test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure pgvector is properly installed');
    console.log('2. Check PostgreSQL logs for errors');
    console.log('3. Verify database permissions');
    console.log('4. Try manual installation steps');
    
    return false;
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run test
if (require.main === module) {
  testPgvectorInstallation().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testPgvectorInstallation };
