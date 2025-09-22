const { Pool } = require('pg');

class SimpleRAGSystem {
  constructor() {
    this.pool = new Pool({
      host: 'localhost', 
      port: 5432, 
      database: 'fund_chatbot', 
      user: 'postgres', 
      password: 'postgres'
    });
  }

  async retrieveRelevantChunks(query, limit = 5) {
    try {
      // Enhanced text search with multiple strategies
      const searchTerms = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 2);
      
      // Strategy 1: Full-text search
      let result = await this.pool.query(`
        SELECT 
          source_id,
          chunk_index,
          content,
          page_number,
          ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as relevance_score,
          'fulltext' as search_type
        FROM kb_chunks
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
        ORDER BY relevance_score DESC
        LIMIT $2
      `, [query, limit]);
      
      // Strategy 2: If no results, try keyword search
      if (result.rows.length === 0 && searchTerms.length > 0) {
        const keywordQuery = searchTerms.map(term => `content ILIKE '%${term}%'`).join(' OR ');
        result = await this.pool.query(`
          SELECT 
            source_id,
            chunk_index,
            content,
            page_number,
            0.5 as relevance_score,
            'keyword' as search_type
          FROM kb_chunks
          WHERE ${keywordQuery}
          ORDER BY chunk_index
          LIMIT $1
        `, [limit]);
      }
      
      // Strategy 3: If still no results, try broader search
      if (result.rows.length === 0) {
        const broadTerms = ['fund', 'create', 'setup', 'manage', 'process'];
        const broadQuery = broadTerms.map(term => `content ILIKE '%${term}%'`).join(' OR ');
        result = await this.pool.query(`
          SELECT 
            source_id,
            chunk_index,
            content,
            page_number,
            0.3 as relevance_score,
            'broad' as search_type
          FROM kb_chunks
          WHERE ${broadQuery}
          ORDER BY chunk_index
          LIMIT $1
        `, [limit]);
      }
      
      return result.rows;
    } catch (error) {
      console.error('❌ Retrieval failed:', error);
      return [];
    }
  }

  async generateResponse(query, retrievedChunks) {
    if (retrievedChunks.length === 0) {
      return {
        message: `I apologize, but I couldn't find specific information about "${query}" in the Fund Management User Guides. Could you please rephrase your question or ask about fund creation, management, or related topics?`,
        confidence: 0.1,
        sources: []
      };
    }

    // Create context from retrieved chunks
    const context = retrievedChunks.map((chunk, index) => 
      `[Source ${index + 1} - ${chunk.source_id}, Page ${chunk.page_number}]: ${chunk.content}`
    ).join('\n\n');

    // Simple response generation based on context
    let response = `Based on the Fund Management User Guides, here's what I found regarding "${query}":\n\n`;
    
    // Extract key information from the most relevant chunk
    const topChunk = retrievedChunks[0];
    const sentences = topChunk.content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const relevantSentences = sentences.slice(0, 3).map(s => s.trim()).join('. ') + '.';
    
    response += relevantSentences;
    
    // Add citations
    const sources = retrievedChunks.map(chunk => ({
      source_id: chunk.source_id,
      page: chunk.page_number,
      chunk_index: chunk.chunk_index
    }));
    
    response += `\n\n**Sources:**\n`;
    sources.forEach((source, index) => {
      response += `- Guide ${source.source_id === 'guide_1_v1.9' ? '1' : '2'}, Page ${source.page} [${source.source_id}:${source.chunk_index}]\n`;
    });
    
    return {
      message: response,
      confidence: Math.min(0.9, retrievedChunks[0].relevance_score + 0.3),
      sources: sources,
      retrievedChunks: retrievedChunks.length
    };
  }

  async processQuery(query) {
    console.log(`\n🤖 Processing query: "${query}"`);
    
    const startTime = Date.now();
    
    // Step 1: Retrieve relevant chunks
    console.log('🔍 Retrieving relevant content...');
    const chunks = await this.retrieveRelevantChunks(query);
    console.log(`  Found ${chunks.length} relevant chunks using ${chunks[0]?.search_type || 'no'} search`);
    
    // Step 2: Generate response
    console.log('📝 Generating response...');
    const response = await this.generateResponse(query, chunks);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Response generated in ${processingTime}ms`);
    console.log(`📊 Confidence: ${(response.confidence * 100).toFixed(1)}%`);
    console.log(`📄 Sources: ${response.sources.length}`);
    
    return {
      ...response,
      processingTime
    };
  }

  async close() {
    await this.pool.end();
  }
}

async function testRAGSystem() {
  const rag = new SimpleRAGSystem();
  
  try {
    console.log('🤖 Testing RAG System with Fund Management User Guides');
    console.log('=' .repeat(60));
    
    const testQueries = [
      'How do I create a new fund?',
      'What are the mandatory fields for fund setup?',
      'How does NAV calculation work?',
      'What is the fund creation process?',
      'How do I manage fund hierarchy?',
      'What types of funds are available?'
    ];
    
    for (const query of testQueries) {
      const result = await rag.processQuery(query);
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 RESPONSE:');
      console.log(result.message);
      console.log('\n' + '-'.repeat(40));
    }
    
    // Test conversation context
    console.log('\n🔄 Testing follow-up questions...');
    const followUp = await rag.processQuery('Can you tell me more about fund types?');
    console.log('\n📋 FOLLOW-UP RESPONSE:');
    console.log(followUp.message);
    
  } catch (error) {
    console.error('❌ RAG system test failed:', error);
  } finally {
    await rag.close();
  }
}

// Run if called directly
if (require.main === module) {
  testRAGSystem();
}

module.exports = { SimpleRAGSystem, testRAGSystem };
