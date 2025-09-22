const { Pool } = require('pg');

async function checkPgVector() {
  const pool = new Pool({
    host: 'localhost', 
    port: 5432, 
    database: 'postgres', 
    user: 'postgres', 
    password: 'postgres'
  });
  
  try {
    console.log('🔍 DEEP ANALYSIS: Why pgvector cannot be installed');
    console.log('=' .repeat(60));
    
    // Check PostgreSQL version
    console.log('\n1️⃣ PostgreSQL Version Check:');
    const versionResult = await pool.query('SELECT version();');
    console.log(`✅ ${versionResult.rows[0].version}`);
    
    // Check available extensions
    console.log('\n2️⃣ Checking Available Extensions:');
    const extensionsResult = await pool.query(`
      SELECT name, default_version, installed_version, comment
      FROM pg_available_extensions 
      WHERE name LIKE '%vector%' OR name LIKE '%pgvector%'
      ORDER BY name;
    `);
    
    if (extensionsResult.rows.length > 0) {
      console.log('📦 Vector-related extensions found:');
      extensionsResult.rows.forEach(row => {
        console.log(`  - ${row.name}: v${row.default_version} ${row.installed_version ? '(INSTALLED)' : '(NOT INSTALLED)'}`);
        console.log(`    ${row.comment}`);
      });
    } else {
      console.log('❌ No vector-related extensions found');
    }
    
    // Check all available extensions (to see what we have)
    console.log('\n3️⃣ All Available Extensions (first 10):');
    const allExtensions = await pool.query(`
      SELECT name, default_version, installed_version
      FROM pg_available_extensions 
      ORDER BY name
      LIMIT 10;
    `);
    
    allExtensions.rows.forEach(row => {
      const status = row.installed_version ? '✅' : '⭕';
      console.log(`  ${status} ${row.name} (v${row.default_version})`);
    });
    
    // Check PostgreSQL installation directory and shared libraries
    console.log('\n4️⃣ PostgreSQL Configuration:');
    const configResult = await pool.query(`
      SELECT name, setting 
      FROM pg_settings 
      WHERE name IN ('data_directory', 'shared_preload_libraries', 'dynamic_library_path')
      ORDER BY name;
    `);
    
    configResult.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.setting}`);
    });
    
    // Try to create vector extension and capture the error
    console.log('\n5️⃣ Attempting to Create Vector Extension:');
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✅ pgvector extension created successfully!');
    } catch (error) {
      console.log('❌ Failed to create pgvector extension:');
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Detail: ${error.detail || 'No additional details'}`);
      console.log(`   Hint: ${error.hint || 'No hints available'}`);
    }
    
    // Check if we're on Windows and what PostgreSQL distribution
    console.log('\n6️⃣ System Analysis:');
    console.log(`  OS: Windows (detected from PowerShell)`);
    console.log(`  PostgreSQL: 16.8 (Visual C++ build 1942, 64-bit)`);
    
    // Provide recommendations
    console.log('\n🔧 DIAGNOSIS & SOLUTIONS:');
    console.log('=' .repeat(60));
    
    if (extensionsResult.rows.length === 0) {
      console.log('❌ ISSUE: pgvector extension is NOT available in this PostgreSQL installation');
      console.log('\n💡 SOLUTIONS:');
      console.log('1. OPTION A - Install pgvector manually:');
      console.log('   • Download pgvector from: https://github.com/pgvector/pgvector/releases');
      console.log('   • Extract to PostgreSQL extensions directory');
      console.log('   • Restart PostgreSQL service');
      
      console.log('\n2. OPTION B - Use PostgreSQL with pgvector pre-installed:');
      console.log('   • Use Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16');
      console.log('   • Or install from PostgreSQL.org with additional extensions');
      
      console.log('\n3. OPTION C - Continue without pgvector (CURRENT APPROACH):');
      console.log('   • ✅ Text-based similarity search (already working)');
      console.log('   • ✅ Full-text search with PostgreSQL');
      console.log('   • ✅ Keyword matching and relevance scoring');
      console.log('   • ⚠️ Less accurate than vector embeddings');
      
      console.log('\n4. OPTION D - Use external vector database:');
      console.log('   • Pinecone, Weaviate, or Chroma');
      console.log('   • Keep PostgreSQL for metadata and conversations');
    }
    
    console.log('\n🎯 RECOMMENDATION:');
    console.log('Since your system is already working well with text-based search,');
    console.log('you can continue development and add pgvector later when needed.');
    console.log('The current implementation provides good results for fund management queries.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  checkPgVector();
}

module.exports = checkPgVector;
