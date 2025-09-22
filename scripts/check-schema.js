const {initializeDatabase, closeDatabase} = require('../config/database');

async function checkSchema() {
  const db = await initializeDatabase();
  
  console.log('📊 Checking database schema...');
  
  // Check kb_chunks columns
  const chunksResult = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'kb_chunks' 
    ORDER BY ordinal_position
  `);
  
  console.log('\n🧩 KB_CHUNKS table columns:');
  chunksResult.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
  
  // Check kb_sources columns
  const sourcesResult = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'kb_sources' 
    ORDER BY ordinal_position
  `);
  
  console.log('\n📄 KB_SOURCES table columns:');
  sourcesResult.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
  
  await closeDatabase();
}

checkSchema().catch(console.error);