#!/usr/bin/env node

const { initializeDatabase, closeDatabase } = require('../config/database');

async function checkTables() {
  try {
    const db = await initializeDatabase();
    
    console.log('🔍 Checking database tables...');
    
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tables found:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    await closeDatabase();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTables();
