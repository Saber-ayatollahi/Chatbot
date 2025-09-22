/**
 * Test Direct Similarity Search
 * Test the vector similarity search directly in the database
 */

const { getDatabase } = require('../config/database');
const { getConfig } = require('../config/environment');
const OpenAI = require('openai');

async function testDirectSimilarity() {
  let db = null;
  
  try {
    console.log('🔍 Testing direct similarity search...');
    
    // Initialize
    const config = getConfig();
    db = getDatabase();
    await db.initialize();
    
    const openai = new OpenAI({
      apiKey: config.get('openai.apiKey')
    });
    
    const query = "What are the mandatory fields for fund creation?";
    
    // Generate embedding for the query
    console.log('🔮 Generating query embedding...');
    const embeddingResponse = await openai.embeddings.create({
      model: config.get('openai.embeddingModel') || 'text-embedding-3-large',
      input: query
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log(`✅ Query embedding generated (${queryEmbedding.length}D)`);
    
    // Test direct database query
    console.log('🔍 Testing direct database query...');
    const directResult = await db.query(`
      SELECT 
        source_id,
        chunk_index,
        heading,
        page_number,
        LEFT(content, 150) as content_preview,
        token_count,
        quality_score,
        (1 - (embedding_json::vector <=> $1::vector)) as similarity
      FROM kb_chunks 
      WHERE embedding_json IS NOT NULL
      ORDER BY embedding_json::vector <=> $1::vector
      LIMIT 10
    `, [JSON.stringify(queryEmbedding)]);
    
    console.log(`📊 Found ${directResult.rows.length} chunks:`);
    directResult.rows.forEach((chunk, index) => {
      console.log(`  ${index + 1}. ${chunk.source_id}[${chunk.chunk_index}] (similarity: ${chunk.similarity.toFixed(3)})`);
      console.log(`     Heading: ${chunk.heading || 'None'}`);
      console.log(`     Page: ${chunk.page_number || 'Unknown'}`);
      console.log(`     Preview: "${chunk.content_preview}..."`);
      console.log('');
    });
    
    // Check similarity threshold
    const threshold = config.get('vector.similarityThreshold') || 0.7;
    console.log(`📏 Similarity threshold: ${threshold}`);
    
    const aboveThreshold = directResult.rows.filter(chunk => chunk.similarity >= threshold);
    console.log(`📊 Chunks above threshold: ${aboveThreshold.length}`);
    
    if (aboveThreshold.length === 0) {
      console.log('⚠️ No chunks above similarity threshold. Consider lowering the threshold.');
      console.log('💡 Suggested threshold based on results:', Math.max(0.3, directResult.rows[0]?.similarity - 0.1));
    }
    
  } catch (error) {
    console.error('❌ Direct similarity test failed:', error.message);
    throw error;
  } finally {
    if (db) {
      await db.close();
    }
  }
}

if (require.main === module) {
  testDirectSimilarity().catch(console.error);
}

module.exports = testDirectSimilarity;
