/**
 * Database Migration Script
 * Applies schema changes to the database
 */

const { DatabaseConfig } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔄 Starting database migration...');
  
  const db = new DatabaseConfig();
  
  try {
    await db.initialize();
    console.log('✅ Database connection established');
    
    // Add embedding_json column if it doesn't exist
    console.log('📝 Adding embedding_json column...');
    await db.query(`
      ALTER TABLE kb_chunks 
      ADD COLUMN IF NOT EXISTS embedding_json TEXT;
    `);
    console.log('✅ embedding_json column added');
    
    // Apply any other migrations from migration files
    const migrationDir = path.join(__dirname, '../database');
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter(file => file.startsWith('migration_') && file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      console.log(`📝 Applying migration: ${file}`);
      const migrationSQL = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      
      try {
        // Execute the entire migration file as one statement for complex SQL
        await db.query(migrationSQL);
        console.log(`✅ Migration ${file} applied`);
      } catch (error) {
        console.warn(`⚠️ Migration ${file} failed (may already be applied): ${error.message}`);
        // Continue with other migrations
      }
    }
    
    console.log('🎉 Database migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
