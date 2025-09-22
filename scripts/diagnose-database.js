#!/usr/bin/env node

/**
 * Database Connection Diagnostic Script
 * Helps identify database connection issues
 */

require('dotenv').config();
const { DatabaseConfig } = require('../config/database');

async function diagnoseDatabaseIssues() {
  console.log('🔍 Diagnosing Database Connection Issues...');
  console.log('=' .repeat(50));
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log(`DB_HOST: ${process.env.DB_HOST || 'undefined'}`);
  console.log(`DB_PORT: ${process.env.DB_PORT || 'undefined'}`);
  console.log(`DB_NAME: ${process.env.DB_NAME || 'undefined'}`);
  console.log(`DB_USER: ${process.env.DB_USER || 'undefined'}`);
  console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? '[SET]' : 'undefined'}`);
  
  // Test database connection
  console.log('\n🔌 Testing Database Connection...');
  
  let db;
  try {
    db = new DatabaseConfig();
    console.log('✅ DatabaseConfig created successfully');
    
    // Try to initialize
    await db.initialize();
    console.log('✅ Database initialized successfully');
    
    // Test basic query
    const result = await db.query('SELECT 1 as test');
    console.log('✅ Basic query successful:', result.rows[0]);
    
    // Test pgvector extension
    try {
      await db.query("SELECT vector_dims('[1,2,3]'::vector) as dims");
      console.log('✅ pgvector extension working');
    } catch (vectorError) {
      console.log('⚠️ pgvector extension issue:', vectorError.message);
    }
    
    // Check if tables exist
    console.log('\n📊 Checking Database Tables...');
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length > 0) {
      console.log('✅ Found tables:');
      tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    } else {
      console.log('❌ No tables found - database not initialized');
      console.log('💡 Run: npm run db:init');
    }
    
    // Check kb_chunks table specifically
    try {
      const chunkCount = await db.query('SELECT COUNT(*) FROM kb_chunks');
      console.log(`📄 kb_chunks table: ${chunkCount.rows[0].count} records`);
    } catch (chunkError) {
      console.log('❌ kb_chunks table issue:', chunkError.message);
    }
    
    // Test pool stats
    const poolStats = db.getPoolStats();
    console.log('\n📊 Connection Pool Stats:');
    console.log(`Total connections: ${poolStats.totalCount}`);
    console.log(`Idle connections: ${poolStats.idleCount}`);
    console.log(`Waiting connections: ${poolStats.waitingCount}`);
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check if PostgreSQL is running');
    console.log('2. Verify connection credentials');
    console.log('3. Ensure database exists');
    console.log('4. Check pgvector extension installation');
    console.log('5. Run: npm run db:init');
    
    // Try to provide specific guidance based on error
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused - PostgreSQL likely not running');
      console.log('   Start PostgreSQL service');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Host not found - check DB_HOST setting');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication failed - check DB_USER and DB_PASSWORD');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n💡 Database does not exist - create it first');
      console.log(`   CREATE DATABASE ${process.env.DB_NAME || 'fund_chatbot'};`);
    }
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run diagnosis
diagnoseDatabaseIssues().catch(console.error);
