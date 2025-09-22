#!/usr/bin/env node

const { initializeDatabase, closeDatabase } = require('../config/database');

async function checkStatus() {
  try {
    const db = await initializeDatabase();
    
    const sources = await db.query('SELECT source_name, source_type, file_size FROM kb_sources');
    const chunks = await db.query('SELECT COUNT(*) as count FROM kb_chunks');
    const embeddings = await db.query('SELECT COUNT(*) as count FROM kb_chunks WHERE content_vector IS NOT NULL');
    
    console.log('📊 KNOWLEDGE BASE STATUS');
    console.log('═'.repeat(40));
    console.log(`📄 Sources: ${sources.rows.length}`);
    
    sources.rows.forEach(s => {
      const sizeMB = (s.file_size / 1024 / 1024).toFixed(2);
      console.log(`  • ${s.source_name} (${s.source_type}, ${sizeMB}MB)`);
    });
    
    console.log(`🧩 Total Chunks: ${chunks.rows[0].count}`);
    console.log(`🔮 Chunks with Embeddings: ${embeddings.rows[0].count}`);
    
    if (chunks.rows[0].count > 0) {
      const sampleChunk = await db.query('SELECT content FROM kb_chunks LIMIT 1');
      console.log(`📝 Sample chunk preview: "${sampleChunk.rows[0].content.substring(0, 100)}..."`);
    }
    
    await closeDatabase();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStatus();
