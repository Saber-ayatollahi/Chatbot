const { Pool } = require('pg');

async function testRetrieval() {
  const pool = new Pool({
    host: 'localhost', 
    port: 5432, 
    database: 'fund_chatbot', 
    user: 'postgres', 
    password: 'postgres'
  });
  
  try {
    console.log('🔍 Testing retrieval system...');
    
    // Test queries
    const testQueries = [
      'How do I create a new fund?',
      'What are the mandatory fields for fund creation?',
      'How do I set up NAV calculation?',
      'What is rollforward process?',
      'How do I manage portfolio hierarchy?'
    ];
    
    for (const query of testQueries) {
      console.log(`\n❓ Query: "${query}"`);
      
      // Simple text-based retrieval using full-text search
      const result = await pool.query(`
        SELECT 
          source_id,
          chunk_index,
          LEFT(content, 200) as content_preview,
          ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as relevance_score
        FROM kb_chunks
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
        ORDER BY relevance_score DESC
        LIMIT 3
      `, [query]);
      
      if (result.rows.length > 0) {
        console.log(`  📄 Found ${result.rows.length} relevant chunks:`);
        result.rows.forEach((row, index) => {
          console.log(`    ${index + 1}. [${row.source_id}:${row.chunk_index}] Score: ${row.relevance_score.toFixed(3)}`);
          console.log(`       ${row.content_preview}...`);
        });
      } else {
        console.log('  ❌ No relevant chunks found');
      }
    }
    
    // Test direct content search
    console.log('\n🔎 Testing direct content search...');
    const contentSearch = await pool.query(`
      SELECT 
        source_id,
        chunk_index,
        LEFT(content, 150) as content_preview
      FROM kb_chunks
      WHERE content ILIKE '%fund%' AND content ILIKE '%create%'
      LIMIT 5
    `);
    
    console.log(`Found ${contentSearch.rows.length} chunks mentioning fund creation:`);
    contentSearch.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. [${row.source_id}:${row.chunk_index}] ${row.content_preview}...`);
    });
    
  } catch (error) {
    console.error('❌ Retrieval test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testRetrieval();
}

module.exports = testRetrieval;
