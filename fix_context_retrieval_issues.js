/**
 * Fix Context Retrieval Issues
 * 
 * This script addresses the root causes of incomplete context retrieval
 * identified in the Fund Management chatbot system.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class ContextRetrievalFixer {
  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'fund_chatbot',
      user: 'postgres',
      password: 'postgres'
    });
  }

  async fixContextRetrievalIssues() {
    console.log('🔧 FIXING CONTEXT RETRIEVAL ISSUES');
    console.log('=' + '='.repeat(50));
    console.log('');

    try {
      // 1. Update processing status for stuck documents
      await this.fixProcessingStatus();
      
      // 2. Improve chunk quality by removing problematic content
      await this.cleanupProblematicChunks();
      
      // 3. Add proper headings and structure to chunks
      await this.enhanceChunkStructure();
      
      // 4. Create better search indexes
      await this.createBetterSearchIndexes();
      
      // 5. Generate summary report
      await this.generateFixReport();
      
      console.log('\n✅ Context retrieval fixes completed successfully!');
      
    } catch (error) {
      console.error('❌ Error during fix process:', error);
      throw error;
    }
  }

  async fixProcessingStatus() {
    console.log('📋 Step 1: Fixing processing status for stuck documents...');
    
    // Update processing status from 'processing' to 'completed' for documents that have chunks
    const result = await this.pool.query(`
      UPDATE kb_sources 
      SET processing_status = 'completed', 
          updated_at = NOW()
      WHERE processing_status = 'processing' 
        AND source_id IN (
          SELECT DISTINCT source_id 
          FROM kb_chunks 
          WHERE content IS NOT NULL 
            AND LENGTH(content) > 100
        )
    `);
    
    console.log(`   ✅ Updated ${result.rowCount} document(s) to completed status`);
  }

  async cleanupProblematicChunks() {
    console.log('🧹 Step 2: Cleaning up problematic chunks...');
    
    // Remove chunks with minimal content or just table of contents
    const deleteResult = await this.pool.query(`
      DELETE FROM kb_chunks 
      WHERE LENGTH(content) < 100 
         OR content LIKE '%Table of contents%'
         OR content LIKE '%Introduction%'
         OR content ~ '^[.]{3,}'
         OR content LIKE '%© RiskFirst%www.riskfirst.com%'
    `);
    
    console.log(`   🗑️ Removed ${deleteResult.rowCount} problematic chunk(s)`);
    
    // Update remaining chunks to improve content quality
    const updateResult = await this.pool.query(`
      UPDATE kb_chunks 
      SET content = TRIM(REGEXP_REPLACE(content, '\\s+', ' ', 'g')),
          updated_at = NOW()
      WHERE content IS NOT NULL
    `);
    
    console.log(`   🔧 Cleaned content for ${updateResult.rowCount} chunk(s)`);
  }

  async enhanceChunkStructure() {
    console.log('📚 Step 3: Enhancing chunk structure and headings...');
    
    // Extract and set proper headings for fund creation chunks
    await this.pool.query(`
      UPDATE kb_chunks 
      SET heading = 'Creating Funds and Updates',
          updated_at = NOW()
      WHERE content LIKE '%Creating Funds and Updates%'
         OR content LIKE '%Creating a Fund%'
         OR content LIKE '%fund update%'
    `);
    
    // Set headings for fund update chunks
    await this.pool.query(`
      UPDATE kb_chunks 
      SET heading = 'Fund Updates',
          updated_at = NOW()
      WHERE content LIKE '%fund update holds information%'
         OR content LIKE '%To create a fund update%'
    `);
    
    // Set headings for fund types
    await this.pool.query(`
      UPDATE kb_chunks 
      SET heading = 'Fund Types',
          updated_at = NOW()
      WHERE content LIKE '%Fund of Funds%'
         AND content LIKE '%Leveraged%'
         AND content LIKE '%Sensitivities%'
    `);
    
    console.log('   ✅ Enhanced chunk structure with proper headings');
  }

  async createBetterSearchIndexes() {
    console.log('🔍 Step 4: Creating better search indexes...');
    
    try {
      // Create full-text search index
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_kb_chunks_fts 
        ON kb_chunks USING gin(to_tsvector('english', content))
      `);
      
      // Create index for fund-related searches
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_kb_chunks_fund_search 
        ON kb_chunks USING gin(to_tsvector('english', 
          COALESCE(heading, '') || ' ' || content))
      `);
      
      // Create index for quality and relevance scoring
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_kb_chunks_quality 
        ON kb_chunks (quality_score DESC, LENGTH(content) DESC)
      `);
      
      console.log('   ✅ Created optimized search indexes');
      
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ℹ️ Search indexes already exist');
      } else {
        throw error;
      }
    }
  }

  async generateFixReport() {
    console.log('📊 Step 5: Generating fix report...');
    
    // Get updated statistics
    const stats = await this.pool.query(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(*) FILTER (WHERE heading IS NOT NULL) as chunks_with_headings,
        COUNT(*) FILTER (WHERE LENGTH(content) > 500) as substantial_chunks,
        AVG(quality_score) as avg_quality,
        COUNT(DISTINCT source_id) as total_sources
      FROM kb_chunks
    `);
    
    const s = stats.rows[0];
    
    // Test fund creation search
    const fundCreationTest = await this.pool.query(`
      SELECT COUNT(*) as fund_creation_chunks
      FROM kb_chunks 
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'create fund')
         OR to_tsvector('english', content) @@ plainto_tsquery('english', 'fund update')
    `);
    
    const testResult = fundCreationTest.rows[0];
    
    console.log('\n📈 FIX REPORT:');
    console.log('=' + '='.repeat(30));
    console.log(`📚 Total Chunks: ${s.total_chunks}`);
    console.log(`📝 Chunks with Headings: ${s.chunks_with_headings}`);
    console.log(`📄 Substantial Chunks (>500 chars): ${s.substantial_chunks}`);
    console.log(`🎯 Average Quality: ${s.avg_quality ? (s.avg_quality * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`📋 Total Sources: ${s.total_sources}`);
    console.log(`🔍 Fund Creation Searchable Chunks: ${testResult.fund_creation_chunks}`);
    
    // Test actual retrieval
    const retrievalTest = await this.pool.query(`
      SELECT chunk_id, heading, 
             SUBSTRING(content, 1, 200) as content_preview,
             ts_rank(to_tsvector('english', content), 
                     plainto_tsquery('english', 'how to create fund')) as rank
      FROM kb_chunks 
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'how to create fund')
      ORDER BY rank DESC
      LIMIT 3
    `);
    
    if (retrievalTest.rows.length > 0) {
      console.log('\n✅ RETRIEVAL TEST RESULTS:');
      retrievalTest.rows.forEach((chunk, index) => {
        console.log(`${index + 1}. ${chunk.heading || 'No heading'} (Rank: ${chunk.rank.toFixed(4)})`);
        console.log(`   Preview: ${chunk.content_preview}...`);
      });
    } else {
      console.log('\n❌ RETRIEVAL TEST: No results found for "how to create fund"');
    }
  }

  async close() {
    await this.pool.end();
  }
}

// Create improved prompt template for fund management queries
const improvedPromptTemplate = `
You are an expert Fund Management Assistant with access to authoritative User Guides. Your role is to provide accurate, helpful guidance based solely on the retrieved context from official fund management documentation.

INSTRUCTIONS:
1. Answer based ONLY on the provided context from the Fund Management User Guides
2. Always include proper citations in the format shown in the context sections
3. If the context doesn't contain sufficient information to fully answer the question, clearly state this limitation
4. Provide practical, actionable guidance when appropriate
5. Use professional language suitable for fund management professionals
6. Structure your response clearly with headings or bullet points when helpful
7. Never hallucinate or invent information not present in the provided context

RESPONSE REQUIREMENTS:
- Direct answer to the user's query
- Proper citations for each piece of information
- Clear indication if information is incomplete or unavailable
- Professional tone appropriate for financial services
- Actionable next steps when relevant

RETRIEVED CONTEXT FROM FUND MANAGEMENT GUIDES:
{context}

USER QUERY: {query}

Please provide a comprehensive answer based on the retrieved context above. Remember to:
1. Base your answer ONLY on the provided context from the Fund Management Guides
2. Include proper citations for all information using the format shown in the context
3. If the context doesn't contain sufficient information to answer the question, clearly state this limitation
4. Provide practical, actionable guidance when appropriate
5. Use professional language suitable for fund management professionals

Your response:
`;

// Main execution
async function main() {
  const fixer = new ContextRetrievalFixer();
  
  try {
    await fixer.fixContextRetrievalIssues();
    
    // Save improved prompt template
    fs.writeFileSync(
      path.join(__dirname, 'improved_prompt_template.txt'), 
      improvedPromptTemplate
    );
    console.log('\n📝 Saved improved prompt template to improved_prompt_template.txt');
    
  } catch (error) {
    console.error('❌ Fix process failed:', error);
    process.exit(1);
  } finally {
    await fixer.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ContextRetrievalFixer, improvedPromptTemplate };
