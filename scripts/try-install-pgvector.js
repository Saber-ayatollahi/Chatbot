#!/usr/bin/env node

/**
 * Try to Install pgvector Extension
 * Attempts to install pgvector if available in PostgreSQL
 */

require('dotenv').config();
const { DatabaseConfig } = require('../config/database');

async function tryInstallPgvector() {
  console.log('🔧 Attempting to install pgvector extension...');
  
  let db;
  try {
    db = new DatabaseConfig();
    await db.initialize();
    
    // Check if pgvector is available
    console.log('📋 Checking available extensions...');
    const availableExtensions = await db.query(`
      SELECT name, comment 
      FROM pg_available_extensions 
      WHERE name = 'vector'
    `);
    
    if (availableExtensions.rows.length === 0) {
      console.log('❌ pgvector extension not available in this PostgreSQL installation');
      console.log('\n📖 Installation Options:');
      console.log('1. Install from PostgreSQL Extensions (if available)');
      console.log('2. Download from: https://github.com/pgvector/pgvector');
      console.log('3. Use Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16');
      console.log('\n💡 For now, the system will continue in fallback mode');
      return false;
    }
    
    console.log('✅ pgvector extension is available');
    console.log('📦 Extension info:', availableExtensions.rows[0]);
    
    // Try to install the extension
    console.log('🔧 Installing pgvector extension...');
    await db.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Verify installation
    const installedExtensions = await db.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `);
    
    if (installedExtensions.rows.length > 0) {
      console.log('🎉 pgvector extension installed successfully!');
      console.log('📊 Version:', installedExtensions.rows[0].extversion);
      
      // Test vector functionality
      console.log('🧪 Testing vector operations...');
      
      try {
        await db.query("SELECT vector_dims('[1,2,3]'::vector) as dims");
        console.log('✅ Vector dimensions function working');
        
        await db.query("SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector as distance");
        console.log('✅ Vector distance operations working');
        
        await db.query("SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector as cosine_distance");
        console.log('✅ Cosine similarity operations working');
        
        console.log('\n🎯 pgvector is fully functional!');
        console.log('🔄 Restart your application to use full vector search capabilities');
        
        return true;
      } catch (testError) {
        console.log('⚠️ pgvector installed but some operations failed:', testError.message);
        return false;
      }
    } else {
      console.log('❌ pgvector extension installation failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to install pgvector:', error.message);
    
    if (error.message.includes('permission denied')) {
      console.log('\n💡 Permission issue. Try running as database administrator:');
      console.log('   psql -U postgres -d fund_chatbot -c "CREATE EXTENSION vector;"');
    } else if (error.message.includes('could not open extension control file')) {
      console.log('\n💡 pgvector not installed on system. Install it first:');
      console.log('   See: https://github.com/pgvector/pgvector#installation');
    }
    
    return false;
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  tryInstallPgvector().then(success => {
    if (success) {
      console.log('\n🎉 SUCCESS: pgvector is ready to use!');
      process.exit(0);
    } else {
      console.log('\n⚠️ FALLBACK: System will continue without pgvector');
      process.exit(1);
    }
  });
}

module.exports = { tryInstallPgvector };
