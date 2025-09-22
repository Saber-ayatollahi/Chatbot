const { initializeDatabase } = require('./config/database');

async function examineChunks() {
  const db = await initializeDatabase();
  
  // Check the promising chunks
  const chunkIds = [
    'd570babf-6dd3-4143-9aae-491bc4b93193', // "Creating Funds and Updates"
    '0e37b70a-7cb9-4952-ac66-36a1e051eb13'  // Good description chunk
  ];
  
  for (const chunkId of chunkIds) {
    const result = await db.query('SELECT chunk_id, heading, content FROM kb_chunks WHERE chunk_id = $1', [chunkId]);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('CHUNK:', row.chunk_id);
      console.log('HEADING:', row.heading);
      console.log('CONTENT:');
      console.log(row.content);
      console.log('\n' + '='.repeat(80) + '\n');
    }
  }
  
  process.exit(0);
}

examineChunks();

