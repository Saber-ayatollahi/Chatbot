/**
 * Test RAG Service Directly
 * Test the RAG service components directly
 */

const VectorRetriever = require('../knowledge/retrieval/VectorRetriever');
const RetrievalEngine = require('../knowledge/retrieval/RetrievalEngine');
const { getConfig } = require('../config/environment');

async function testRAGService() {
  try {
    console.log('🔍 Testing RAG service components...');
    
    const config = getConfig();
    const query = "What are the mandatory fields for fund creation?";
    
    // Test VectorRetriever directly
    console.log('\n1️⃣ Testing VectorRetriever directly:');
    const vectorRetriever = new VectorRetriever();
    const vectorResults = await vectorRetriever.retrieveRelevantChunks(query, {
      topK: 5,
      similarityThreshold: 0.5,
      enableReranking: false,
      enableHybridSearch: false
    });
    
    console.log(`📊 VectorRetriever found ${vectorResults.length} chunks`);
    vectorResults.forEach((chunk, index) => {
      console.log(`  ${index + 1}. ${chunk.source_id}[${chunk.chunk_index}] (similarity: ${chunk.similarity_score?.toFixed(3) || 'N/A'})`);
    });
    
    // Test RetrievalEngine
    console.log('\n2️⃣ Testing RetrievalEngine:');
    const retrievalEngine = new RetrievalEngine();
    const engineResults = await retrievalEngine.retrieveContext(query, {
      strategy: 'vector_only',
      maxChunks: 5,
      similarityThreshold: 0.5
    });
    
    console.log(`📊 RetrievalEngine found ${engineResults.chunks?.length || 0} chunks`);
    if (engineResults.chunks) {
      engineResults.chunks.forEach((chunk, index) => {
        console.log(`  ${index + 1}. ${chunk.source_id}[${chunk.chunk_index}] (similarity: ${chunk.similarity_score?.toFixed(3) || 'N/A'})`);
      });
    }
    
    console.log('\n📋 Configuration used:');
    console.log(`  Similarity threshold: ${config.get('vector.similarityThreshold')}`);
    console.log(`  Max retrieved chunks: ${config.get('vector.maxRetrievedChunks')}`);
    console.log(`  Enable reranking: ${config.get('rag.retrieval.rerank')}`);
    console.log(`  Enable hybrid search: ${config.get('rag.retrieval.enableHybridSearch')}`);
    
  } catch (error) {
    console.error('❌ RAG service test failed:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  testRAGService().catch(console.error);
}

module.exports = testRAGService;
