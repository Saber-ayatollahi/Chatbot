/**
 * Debug Query Script
 * Find out exactly what query is causing the error
 */

const VectorRetriever = require('../knowledge/retrieval/VectorRetriever');
const { getConfig } = require('../config/environment');

async function debugQuery() {
  try {
    console.log('🔍 Debugging VectorRetriever queries...');
    
    const retriever = new VectorRetriever();
    await retriever.initializeDatabase();
    
    // Test with a simple query
    const testQuery = "What are the mandatory fields for fund creation?";
    
    console.log('🧪 Testing retrieveRelevantChunks...');
    const result = await retriever.retrieveRelevantChunks(testQuery, {
      topK: 5,
      similarityThreshold: 0.5,
      enableReranking: false,
      enableHybridSearch: false
    });
    
    console.log(`✅ Retrieved ${result.length} chunks successfully`);
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

debugQuery().catch(console.error);
