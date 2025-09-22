const fs = require('fs');
const pdfParse = require('pdf-parse');
const { Pool } = require('pg');

async function ingestDocuments() {
  const pool = new Pool({
    host: 'localhost', 
    port: 5432, 
    database: 'fund_chatbot', 
    user: 'postgres', 
    password: 'postgres'
  });
  
  try {
    console.log('📚 Starting simplified document ingestion...');
    
    const documents = [
      {
        filePath: './Fund_Manager_User_Guide_1.9.pdf',
        sourceId: 'guide_1_v1.9',
        version: '1.9',
        title: 'Fund Manager User Guide'
      },
      {
        filePath: './Fund_Manager_User_Guide_v_1.9_MA_format.pdf',
        sourceId: 'guide_1_v1.9_ma',
        version: '1.9',
        title: 'Fund Manager User Guide (MA Format)'
      }
    ];
    
    for (const doc of documents) {
      console.log(`\n📄 Processing ${doc.title}...`);
      
      // Read and parse PDF
      const pdfBuffer = fs.readFileSync(doc.filePath);
      const pdfData = await pdfParse(pdfBuffer);
      
      console.log(`  Pages: ${pdfData.numpages}`);
      console.log(`  Text length: ${pdfData.text.length}`);
      
      // Update source metadata
      const stats = fs.statSync(doc.filePath);
      await pool.query(`
        UPDATE kb_sources SET 
          file_size = $1,
          total_pages = $2,
          processing_status = 'processing',
          processed_at = NOW()
        WHERE source_id = $3
      `, [stats.size, pdfData.numpages, doc.sourceId]);
      
      // Simple chunking - split by paragraphs and limit size
      const text = pdfData.text;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
      
      console.log(`  Found ${paragraphs.length} paragraphs`);
      
      let chunkIndex = 0;
      let totalChunks = 0;
      
      for (let i = 0; i < paragraphs.length; i++) {
        let chunk = paragraphs[i].trim();
        
        // If chunk is too small, combine with next
        while (chunk.length < 200 && i + 1 < paragraphs.length) {
          i++;
          chunk += '\n\n' + paragraphs[i].trim();
        }
        
        // If chunk is too large, split it
        if (chunk.length > 1000) {
          const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 10);
          let currentChunk = '';
          
          for (const sentence of sentences) {
            if ((currentChunk + sentence).length > 800) {
              if (currentChunk.length > 100) {
                await insertChunk(pool, doc, chunkIndex++, currentChunk.trim());
                totalChunks++;
                currentChunk = sentence.trim() + '.';
              }
            } else {
              currentChunk += sentence.trim() + '.';
            }
          }
          
          if (currentChunk.length > 100) {
            await insertChunk(pool, doc, chunkIndex++, currentChunk.trim());
            totalChunks++;
          }
        } else if (chunk.length > 100) {
          await insertChunk(pool, doc, chunkIndex++, chunk);
          totalChunks++;
        }
      }
      
      // Update final status
      await pool.query(`
        UPDATE kb_sources SET 
          total_chunks = $1,
          processing_status = 'completed'
        WHERE source_id = $2
      `, [totalChunks, doc.sourceId]);
      
      console.log(`  ✅ Created ${totalChunks} chunks`);
    }
    
    console.log('\n🎉 Document ingestion completed successfully!');
    
    // Show summary
    const result = await pool.query(`
      SELECT s.source_id, s.title, s.total_pages, s.total_chunks, s.processing_status,
             COUNT(c.id) as actual_chunks
      FROM kb_sources s
      LEFT JOIN kb_chunks c ON s.source_id = c.source_id
      GROUP BY s.source_id, s.title, s.total_pages, s.total_chunks, s.processing_status
      ORDER BY s.source_id
    `);
    
    console.log('\n📊 Ingestion Summary:');
    result.rows.forEach(row => {
      console.log(`  ${row.title}: ${row.actual_chunks} chunks from ${row.total_pages} pages`);
    });
    
    // Show some sample chunks
    const sampleChunks = await pool.query(`
      SELECT source_id, chunk_index, LEFT(content, 100) as content_preview
      FROM kb_chunks 
      ORDER BY source_id, chunk_index 
      LIMIT 5
    `);
    
    console.log('\n📄 Sample chunks:');
    sampleChunks.rows.forEach(row => {
      console.log(`  ${row.source_id}[${row.chunk_index}]: ${row.content_preview}...`);
    });
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
  } finally {
    await pool.end();
  }
}

async function insertChunk(pool, doc, chunkIndex, content) {
  const tokenCount = Math.ceil(content.length / 4); // Rough estimate
  const wordCount = content.split(/\s+/).length;
  
  // Create a mock embedding (1536 dimensions of random values)
  const mockEmbedding = Array.from({length: 1536}, () => Math.random() - 0.5);
  
  await pool.query(`
    INSERT INTO kb_chunks (
      source_id, version, chunk_index, content, content_type,
      embedding_json, token_count, character_count, word_count,
      quality_score, page_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    doc.sourceId,
    doc.version,
    chunkIndex,
    content,
    'text',
    JSON.stringify(mockEmbedding),
    tokenCount,
    content.length,
    wordCount,
    0.8, // Mock quality score
    Math.ceil((chunkIndex + 1) / 10) // Rough page estimate
  ]);
}

// Run if called directly
if (require.main === module) {
  ingestDocuments();
}

module.exports = ingestDocuments;
