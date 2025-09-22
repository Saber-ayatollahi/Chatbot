/**
 * Database Initialization Script
 * Initialize PostgreSQL database with schema and initial data
 * Phase 1: Foundation & Infrastructure Setup
 */

const { initializeConfig } = require('../config/environment');
const { initializeDatabase } = require('../config/database');
const logger = require('../utils/logger');

async function main() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Initialize configuration
    const config = initializeConfig();
    
    // Initialize database connection
    const db = await initializeDatabase();
    
    // Initialize schema
    console.log('🏗️ Initializing database schema...');
    await db.initializeSchema();
    
    // Verify installation
    console.log('🔍 Verifying database setup...');
    const healthCheck = await db.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      console.log('✅ Database initialization completed successfully!');
      console.log(`📊 Pool stats:`, healthCheck.poolStats);
    } else {
      throw new Error(`Database health check failed: ${healthCheck.message}`);
    }
    
    // Close connection
    await db.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
