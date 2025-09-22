#!/usr/bin/env node

/**
 * Simple Database Initialization
 * Initialize database with minimal schema for testing
 */

require('dotenv').config();
const { getDatabase } = require('../config/database');

async function initializeSimpleDatabase() {
  console.log('🚀 Initializing simple database for testing...');
  
  let db;
  try {
    db = getDatabase();
    await db.initialize();
    
    console.log('🔄 Creating basic tables...');
    
    // Create tables one by one to avoid transaction issues
    const tables = [
      {
        name: 'kb_sources',
        sql: `
          CREATE TABLE IF NOT EXISTS kb_sources (
            id SERIAL PRIMARY KEY,
            source_id VARCHAR(100) UNIQUE NOT NULL,
            filename VARCHAR(255) NOT NULL,
            file_path TEXT NOT NULL,
            file_size BIGINT NOT NULL DEFAULT 0,
            file_hash VARCHAR(64) NOT NULL DEFAULT '',
            version VARCHAR(20) NOT NULL DEFAULT '1.0',
            document_type VARCHAR(50) NOT NULL DEFAULT 'pdf',
            title TEXT,
            author TEXT,
            creation_date DATE,
            total_pages INTEGER,
            total_chunks INTEGER DEFAULT 0,
            processing_status VARCHAR(20) DEFAULT 'pending',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP WITH TIME ZONE
          )
        `
      },
      {
        name: 'kb_chunks',
        sql: `
          CREATE TABLE IF NOT EXISTS kb_chunks (
            id SERIAL PRIMARY KEY,
            chunk_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
            source_id VARCHAR(100) NOT NULL,
            version VARCHAR(20) NOT NULL DEFAULT '1.0',
            chunk_index INTEGER NOT NULL DEFAULT 0,
            heading TEXT,
            subheading TEXT,
            page_number INTEGER,
            page_range INTEGER[],
            section_path TEXT[],
            content TEXT NOT NULL,
            content_type VARCHAR(50) DEFAULT 'text',
            embedding_text TEXT,
            token_count INTEGER NOT NULL DEFAULT 0,
            character_count INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            language VARCHAR(10) DEFAULT 'en',
            quality_score FLOAT DEFAULT 0.0,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0),
            CONSTRAINT valid_token_count CHECK (token_count >= 0),
            CONSTRAINT valid_quality_score CHECK (quality_score >= 0.0 AND quality_score <= 1.0)
          )
        `
      },
      {
        name: 'conversations',
        sql: `
          CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(100) UNIQUE NOT NULL,
            user_id VARCHAR(100),
            conversation_title TEXT,
            messages JSONB NOT NULL DEFAULT '[]',
            message_count INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            conversation_status VARCHAR(20) DEFAULT 'active',
            conversation_type VARCHAR(50) DEFAULT 'fund_creation',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT valid_message_count CHECK (message_count >= 0),
            CONSTRAINT valid_total_tokens CHECK (total_tokens >= 0)
          )
        `
      },
      {
        name: 'feedback',
        sql: `
          CREATE TABLE IF NOT EXISTS feedback (
            id SERIAL PRIMARY KEY,
            feedback_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
            session_id VARCHAR(100) NOT NULL,
            message_id VARCHAR(100) NOT NULL,
            user_query TEXT NOT NULL,
            assistant_response TEXT NOT NULL,
            rating INTEGER CHECK (rating IN (-1, 1)),
            feedback_text TEXT,
            feedback_categories TEXT[],
            suggestions TEXT,
            retrieved_chunks JSONB,
            citations JSONB,
            response_quality_score FLOAT,
            response_time_ms INTEGER,
            confidence_score FLOAT,
            user_agent TEXT,
            ip_address_hash VARCHAR(64),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT valid_response_time CHECK (response_time_ms > 0),
            CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
            CONSTRAINT valid_quality_score CHECK (response_quality_score >= 0.0 AND response_quality_score <= 1.0)
          )
        `
      },
      {
        name: 'audit_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            audit_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
            session_id VARCHAR(100) NOT NULL,
            interaction_type VARCHAR(50) NOT NULL,
            user_query TEXT NOT NULL,
            user_query_hash VARCHAR(64),
            retrieved_chunks JSONB NOT NULL DEFAULT '[]',
            citations JSONB NOT NULL DEFAULT '[]',
            final_response TEXT NOT NULL,
            model_version VARCHAR(50) NOT NULL,
            embedding_model VARCHAR(50) NOT NULL,
            prompt_template_version VARCHAR(20) NOT NULL,
            response_time_ms INTEGER NOT NULL,
            confidence_score FLOAT,
            retrieval_score FLOAT,
            token_usage JSONB,
            api_costs JSONB,
            user_agent TEXT,
            ip_address_hash VARCHAR(64),
            request_headers JSONB,
            error_details JSONB,
            compliance_flags TEXT[],
            reviewed_by VARCHAR(100),
            review_status VARCHAR(20) DEFAULT 'pending',
            review_notes TEXT,
            retention_date DATE,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP WITH TIME ZONE,
            
            CONSTRAINT valid_response_time CHECK (response_time_ms > 0),
            CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
            CONSTRAINT valid_retrieval_score CHECK (retrieval_score >= 0.0 AND retrieval_score <= 1.0)
          )
        `
      },
      {
        name: 'ingestion_jobs',
        sql: `
          CREATE TABLE IF NOT EXISTS ingestion_jobs (
            id SERIAL PRIMARY KEY,
            job_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
            source_id VARCHAR(100) NOT NULL,
            job_type VARCHAR(50) NOT NULL,
            job_status VARCHAR(20) DEFAULT 'pending',
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            progress_percentage INTEGER DEFAULT 0,
            current_step VARCHAR(100),
            total_steps INTEGER,
            chunks_processed INTEGER DEFAULT 0,
            chunks_failed INTEGER DEFAULT 0,
            embeddings_generated INTEGER DEFAULT 0,
            error_message TEXT,
            error_details JSONB,
            processing_stats JSONB,
            configuration JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
            CONSTRAINT valid_chunks_processed CHECK (chunks_processed >= 0),
            CONSTRAINT valid_chunks_failed CHECK (chunks_failed >= 0),
            CONSTRAINT valid_embeddings_generated CHECK (embeddings_generated >= 0)
          )
        `
      },
      {
        name: 'embedding_cache',
        sql: `
          CREATE TABLE IF NOT EXISTS embedding_cache (
            id SERIAL PRIMARY KEY,
            cache_key VARCHAR(64) UNIQUE NOT NULL,
            text_hash VARCHAR(64) NOT NULL,
            embedding_text TEXT NOT NULL,
            model VARCHAR(50) NOT NULL,
            token_count INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            access_count INTEGER DEFAULT 1,
            
            CONSTRAINT valid_token_count CHECK (token_count >= 0)
          )
        `
      }
    ];

    // Create each table
    for (const table of tables) {
      try {
        await db.query(table.sql);
        console.log(`✅ Table '${table.name}' created successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Table '${table.name}' already exists`);
        } else {
          console.error(`❌ Failed to create table '${table.name}':`, error.message);
          throw error;
        }
      }
    }

    // Create indexes
    console.log('🔄 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_kb_chunks_source_id ON kb_chunks (source_id)',
      'CREATE INDEX IF NOT EXISTS idx_kb_chunks_version ON kb_chunks (version)',
      'CREATE INDEX IF NOT EXISTS idx_kb_chunks_chunk_id ON kb_chunks (chunk_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback (session_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs (session_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source_id ON ingestion_jobs (source_id)',
      'CREATE INDEX IF NOT EXISTS idx_embedding_cache_key ON embedding_cache (cache_key)'
    ];

    for (const index of indexes) {
      try {
        await db.query(index);
        console.log('✅ Index created');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn('⚠️ Index creation warning:', error.message);
        }
      }
    }

    // Insert sample data
    console.log('🔄 Inserting sample data...');
    try {
      await db.query(`
        INSERT INTO kb_sources (source_id, filename, file_path, file_size, file_hash, version, document_type, title) 
        VALUES 
          ('guide_1_v1.9', 'Fund_Manager_User_Guide_1.9.pdf', './Fund_Manager_User_Guide_1.9.pdf', 0, '', '1.9', 'pdf', 'Fund Manager User Guide'),
          ('guide_1_v1.9_ma', 'Fund_Manager_User_Guide_v_1.9_MA_format.pdf', './Fund_Manager_User_Guide_v_1.9_MA_format.pdf', 0, '', '1.9', 'pdf', 'Fund Manager User Guide (MA Format)')
        ON CONFLICT (source_id) DO NOTHING
      `);
      console.log('✅ Sample data inserted');
    } catch (error) {
      console.warn('⚠️ Sample data insertion warning:', error.message);
    }

    // Verify tables were created
    const tables_result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Database tables:');
    tables_result.rows.forEach(row => console.log(`  ✅ ${row.table_name}`));
    
    console.log('\n🎯 Database initialization completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run validate:env');
    console.log('2. Run: npm run test:critical');
    console.log('3. Start the application: npm start');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initializeSimpleDatabase();
}

module.exports = { initializeSimpleDatabase };
