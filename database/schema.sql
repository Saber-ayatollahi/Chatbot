-- Fund Management Chatbot - Complete Database Schema
-- Phase 1: Foundation & Infrastructure Setup
-- PostgreSQL 15+ with pgvector extension required

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS kb_chunks CASCADE;
DROP TABLE IF EXISTS kb_sources CASCADE;
DROP TABLE IF EXISTS ingestion_jobs CASCADE;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_kb_chunks_embedding_l2;
DROP INDEX IF EXISTS idx_kb_chunks_source_id;
DROP INDEX IF EXISTS idx_kb_chunks_chunk_index;
DROP INDEX IF EXISTS idx_kb_chunks_page_number;
DROP INDEX IF EXISTS idx_kb_chunks_quality_score;
DROP INDEX IF EXISTS idx_kb_chunks_created_at;
DROP INDEX IF EXISTS idx_kb_sources_processing_status;
DROP INDEX IF EXISTS idx_kb_sources_document_type;
DROP INDEX IF EXISTS idx_conversations_session_id;
DROP INDEX IF EXISTS idx_conversations_created_at;
DROP INDEX IF EXISTS idx_feedback_conversation_id;
DROP INDEX IF EXISTS idx_feedback_rating;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;

-- Knowledge base sources table
CREATE TABLE kb_sources (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(100) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity
    version VARCHAR(20) NOT NULL,
    document_type VARCHAR(50) NOT NULL DEFAULT 'pdf',
    title TEXT,
    author TEXT,
    creation_date DATE,
    total_pages INTEGER,
    total_chunks INTEGER DEFAULT 0,
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Knowledge base chunks table with vector embeddings
CREATE TABLE kb_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    source_id VARCHAR(100) NOT NULL REFERENCES kb_sources(source_id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    chunk_index INTEGER NOT NULL,
    heading TEXT,
    subheading TEXT,
    page_number INTEGER,
    page_range INTEGER[], -- [start_page, end_page] for chunks spanning multiple pages
    section_path TEXT[], -- hierarchical path like ['Chapter 1', 'Section 1.1', 'Subsection 1.1.1']
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- text, table, list, code, etc.
    embedding vector(3072), -- OpenAI text-embedding-3-large dimension (updated)
    embedding_json TEXT, -- Fallback JSON storage for embeddings when vector type unavailable
    token_count INTEGER NOT NULL,
    character_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    quality_score FLOAT DEFAULT 0.0, -- 0-1 score for chunk quality
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT valid_page_number CHECK (page_number > 0),
    CONSTRAINT valid_token_count CHECK (token_count > 0),
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
    CONSTRAINT unique_source_chunk UNIQUE (source_id, version, chunk_index)
);

-- Conversations table for persistent chat storage
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100), -- for future user management
    conversation_title TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    conversation_status VARCHAR(20) DEFAULT 'active', -- active, archived, deleted
    conversation_type VARCHAR(50) DEFAULT 'fund_creation', -- fund_creation, general_inquiry, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_message_count CHECK (message_count >= 0),
    CONSTRAINT valid_total_tokens CHECK (total_tokens >= 0)
);

-- Feedback table for user ratings and comments
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    feedback_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    session_id VARCHAR(100) NOT NULL REFERENCES conversations(session_id) ON DELETE CASCADE,
    message_id VARCHAR(100) NOT NULL,
    user_query TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    rating INTEGER CHECK (rating IN (-1, 1)), -- -1 for thumbs down, 1 for thumbs up
    feedback_text TEXT,
    feedback_categories TEXT[], -- ['accuracy', 'helpfulness', 'clarity', etc.]
    suggestions TEXT,
    retrieved_chunks JSONB, -- chunks that were used for the response
    citations JSONB, -- citations that were provided
    response_quality_score FLOAT,
    response_time_ms INTEGER,
    confidence_score FLOAT,
    user_agent TEXT,
    ip_address_hash VARCHAR(64), -- hashed IP for privacy
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_response_time CHECK (response_time_ms > 0),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT valid_quality_score CHECK (response_quality_score >= 0.0 AND response_quality_score <= 1.0)
);

-- Comprehensive audit logs table for compliance
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    audit_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- query, feedback, admin_action, etc.
    user_query TEXT NOT NULL,
    user_query_hash VARCHAR(64), -- SHA-256 hash of original query for deduplication
    retrieved_chunks JSONB NOT NULL DEFAULT '[]',
    citations JSONB NOT NULL DEFAULT '[]',
    final_response TEXT NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    embedding_model VARCHAR(50) NOT NULL,
    prompt_template_version VARCHAR(20) NOT NULL,
    response_time_ms INTEGER NOT NULL,
    confidence_score FLOAT,
    retrieval_score FLOAT, -- average similarity score of retrieved chunks
    token_usage JSONB, -- {prompt_tokens: X, completion_tokens: Y, total_tokens: Z}
    api_costs JSONB, -- {embedding_cost: X, completion_cost: Y, total_cost: Z}
    user_agent TEXT,
    ip_address_hash VARCHAR(64), -- hashed IP for privacy compliance
    request_headers JSONB,
    error_details JSONB, -- if any errors occurred
    compliance_flags TEXT[], -- flags for compliance review
    reviewed_by VARCHAR(100), -- admin who reviewed if flagged
    review_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, flagged, escalated
    review_notes TEXT,
    retention_date DATE, -- when this record should be purged
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_response_time CHECK (response_time_ms > 0),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT valid_retrieval_score CHECK (retrieval_score >= 0.0 AND retrieval_score <= 1.0)
);

-- Ingestion jobs table for tracking document processing
CREATE TABLE ingestion_jobs (
    id SERIAL PRIMARY KEY,
    job_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    source_id VARCHAR(100) NOT NULL REFERENCES kb_sources(source_id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- initial_ingestion, update, reprocessing
    job_status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
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
    processing_stats JSONB, -- detailed processing statistics
    configuration JSONB, -- job configuration parameters
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT valid_chunks_processed CHECK (chunks_processed >= 0),
    CONSTRAINT valid_chunks_failed CHECK (chunks_failed >= 0),
    CONSTRAINT valid_embeddings_generated CHECK (embeddings_generated >= 0)
);

-- Embedding cache table for caching OpenAI embeddings
CREATE TABLE embedding_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of model + text
    text_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of original text
    embedding vector(3072) NOT NULL, -- Cached embedding vector
    model VARCHAR(50) NOT NULL, -- Model used for embedding
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    
    -- Constraints
    CONSTRAINT valid_token_count CHECK (token_count >= 0)
);

-- Validation reports table for quality validation results
CREATE TABLE validation_reports (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(100) UNIQUE NOT NULL REFERENCES kb_sources(source_id) ON DELETE CASCADE,
    validation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    overall_score FLOAT NOT NULL,
    quality_grade VARCHAR(20) NOT NULL,
    total_chunks INTEGER NOT NULL,
    issues_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    recommendations_count INTEGER DEFAULT 0,
    validation_results JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_overall_score CHECK (overall_score >= 0 AND overall_score <= 100),
    CONSTRAINT valid_total_chunks CHECK (total_chunks >= 0),
    CONSTRAINT valid_issues_count CHECK (issues_count >= 0),
    CONSTRAINT valid_warnings_count CHECK (warnings_count >= 0),
    CONSTRAINT valid_recommendations_count CHECK (recommendations_count >= 0)
);

-- Performance optimization indexes
-- Vector similarity search indexes
CREATE INDEX idx_kb_chunks_embedding ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_kb_chunks_embedding_l2 ON kb_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Source and version indexes
CREATE INDEX idx_kb_chunks_source_version ON kb_chunks (source_id, version);
CREATE INDEX idx_kb_chunks_source_id ON kb_chunks (source_id);
CREATE INDEX idx_kb_chunks_version ON kb_chunks (version);
CREATE INDEX idx_kb_chunks_chunk_id ON kb_chunks (chunk_id);

-- Content search indexes
CREATE INDEX idx_kb_chunks_content_gin ON kb_chunks USING gin (to_tsvector('english', content));
CREATE INDEX idx_kb_chunks_heading_gin ON kb_chunks USING gin (to_tsvector('english', heading));
CREATE INDEX idx_kb_chunks_page_number ON kb_chunks (page_number);

-- Conversation indexes
CREATE INDEX idx_conversations_session ON conversations (session_id);
CREATE INDEX idx_conversations_user_id ON conversations (user_id);
CREATE INDEX idx_conversations_last_activity ON conversations (last_activity);
CREATE INDEX idx_conversations_status ON conversations (conversation_status);

-- Feedback indexes
CREATE INDEX idx_feedback_session ON feedback (session_id);
CREATE INDEX idx_feedback_message_id ON feedback (message_id);
CREATE INDEX idx_feedback_rating ON feedback (rating);
CREATE INDEX idx_feedback_created ON feedback (created_at);

-- Audit log indexes for compliance queries
CREATE INDEX idx_audit_logs_session ON audit_logs (session_id);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at);
CREATE INDEX idx_audit_logs_interaction_type ON audit_logs (interaction_type);
CREATE INDEX idx_audit_logs_review_status ON audit_logs (review_status);
CREATE INDEX idx_audit_logs_retention_date ON audit_logs (retention_date);
CREATE INDEX idx_audit_logs_query_hash ON audit_logs (user_query_hash);

-- Ingestion job indexes
CREATE INDEX idx_ingestion_jobs_source_id ON ingestion_jobs (source_id);
CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs (job_status);
CREATE INDEX idx_ingestion_jobs_created ON ingestion_jobs (created_at);

-- Embedding cache indexes
CREATE INDEX idx_embedding_cache_key ON embedding_cache (cache_key);
CREATE INDEX idx_embedding_cache_text_hash ON embedding_cache (text_hash);
CREATE INDEX idx_embedding_cache_model ON embedding_cache (model);
CREATE INDEX idx_embedding_cache_created ON embedding_cache (created_at);
CREATE INDEX idx_embedding_cache_accessed ON embedding_cache (accessed_at);

-- Validation reports indexes
CREATE INDEX idx_validation_reports_source_id ON validation_reports (source_id);
CREATE INDEX idx_validation_reports_timestamp ON validation_reports (validation_timestamp);
CREATE INDEX idx_validation_reports_score ON validation_reports (overall_score);
CREATE INDEX idx_validation_reports_grade ON validation_reports (quality_grade);

-- Full-text search indexes
CREATE INDEX idx_audit_logs_query_gin ON audit_logs USING gin (to_tsvector('english', user_query));
CREATE INDEX idx_feedback_text_gin ON feedback USING gin (to_tsvector('english', feedback_text));

-- Composite indexes for common queries
CREATE INDEX idx_kb_chunks_source_page ON kb_chunks (source_id, page_number);
CREATE INDEX idx_kb_chunks_quality_tokens ON kb_chunks (quality_score DESC, token_count);
CREATE INDEX idx_audit_logs_session_created ON audit_logs (session_id, created_at);
CREATE INDEX idx_feedback_session_rating ON feedback (session_id, rating, created_at);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_kb_sources_updated_at BEFORE UPDATE ON kb_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kb_chunks_updated_at BEFORE UPDATE ON kb_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ingestion_jobs_updated_at BEFORE UPDATE ON ingestion_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate retention date based on data type
CREATE OR REPLACE FUNCTION calculate_retention_date(interaction_type TEXT)
RETURNS DATE AS $$
BEGIN
    CASE interaction_type
        WHEN 'query' THEN RETURN CURRENT_DATE + INTERVAL '1 year';
        WHEN 'feedback' THEN RETURN CURRENT_DATE + INTERVAL '2 years';
        WHEN 'admin_action' THEN RETURN CURRENT_DATE + INTERVAL '7 years';
        ELSE RETURN CURRENT_DATE + INTERVAL '1 year';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set retention date
CREATE OR REPLACE FUNCTION set_retention_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.retention_date = calculate_retention_date(NEW.interaction_type);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_audit_logs_retention_date BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION set_retention_date();

-- Views for common queries
CREATE VIEW active_conversations AS
SELECT 
    session_id,
    conversation_title,
    message_count,
    last_activity,
    conversation_type,
    created_at
FROM conversations 
WHERE conversation_status = 'active'
ORDER BY last_activity DESC;

CREATE VIEW kb_source_stats AS
SELECT 
    s.source_id,
    s.filename,
    s.version,
    s.total_pages,
    s.processing_status,
    COUNT(c.id) as chunk_count,
    AVG(c.quality_score) as avg_quality_score,
    SUM(c.token_count) as total_tokens,
    MIN(c.created_at) as first_chunk_created,
    MAX(c.updated_at) as last_chunk_updated
FROM kb_sources s
LEFT JOIN kb_chunks c ON s.source_id = c.source_id
GROUP BY s.source_id, s.filename, s.version, s.total_pages, s.processing_status;

CREATE VIEW feedback_summary AS
SELECT 
    DATE(created_at) as feedback_date,
    COUNT(*) as total_feedback,
    COUNT(CASE WHEN rating = 1 THEN 1 END) as positive_feedback,
    COUNT(CASE WHEN rating = -1 THEN 1 END) as negative_feedback,
    ROUND(AVG(CASE WHEN rating = 1 THEN 1.0 ELSE 0.0 END) * 100, 2) as satisfaction_percentage,
    AVG(response_time_ms) as avg_response_time,
    AVG(confidence_score) as avg_confidence_score
FROM feedback 
GROUP BY DATE(created_at)
ORDER BY feedback_date DESC;

-- Security: Row Level Security (RLS) policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create roles for different access levels
CREATE ROLE chatbot_app;
CREATE ROLE compliance_officer;
CREATE ROLE system_admin;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON kb_sources, kb_chunks TO chatbot_app;
GRANT SELECT, INSERT, UPDATE ON conversations TO chatbot_app;
GRANT SELECT, INSERT ON feedback, audit_logs TO chatbot_app;
GRANT SELECT, INSERT, UPDATE ON ingestion_jobs TO chatbot_app;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO compliance_officer;
GRANT UPDATE (review_status, review_notes, reviewed_by, reviewed_at) ON audit_logs TO compliance_officer;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO system_admin;

-- Initial configuration data
INSERT INTO kb_sources (source_id, filename, file_path, file_size, file_hash, version, document_type, title) VALUES
('guide_1_v1.9', 'Fund_Manager_User_Guide_1.9.pdf', './Fund_Manager_User_Guide_1.9.pdf', 0, '', '1.9', 'pdf', 'Fund Manager User Guide'),
('guide_1_v1.9_ma', 'Fund_Manager_User_Guide_v_1.9_MA_format.pdf', './Fund_Manager_User_Guide_v_1.9_MA_format.pdf', 0, '', '1.9', 'pdf', 'Fund Manager User Guide (MA Format)')
ON CONFLICT (source_id) DO NOTHING;

-- Performance statistics and monitoring
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT,
    total_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins - n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) + pg_indexes_size(schemaname||'.'||tablename)) as total_size
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old audit logs (compliance with retention policies)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE retention_date < CURRENT_DATE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO audit_logs (
        session_id, 
        interaction_type, 
        user_query, 
        final_response, 
        model_version, 
        embedding_model, 
        prompt_template_version, 
        response_time_ms
    ) VALUES (
        'system', 
        'cleanup', 
        'Automated cleanup of old audit logs', 
        format('Deleted %s old audit log records', deleted_count), 
        'system', 
        'system', 
        '1.0', 
        0
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job for cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs();');

COMMENT ON TABLE kb_sources IS 'Stores metadata about knowledge base source documents';
COMMENT ON TABLE kb_chunks IS 'Stores processed text chunks with vector embeddings for similarity search';
COMMENT ON TABLE conversations IS 'Stores persistent chat conversations with full message history';
COMMENT ON TABLE feedback IS 'Stores user feedback and ratings for response quality tracking';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all interactions for compliance and monitoring';
COMMENT ON TABLE ingestion_jobs IS 'Tracks document processing jobs and their status';

-- Database initialization complete
SELECT 'Database schema created successfully with all tables, indexes, and functions' as status;
