-- Fund Management Chatbot - Database Schema (No Vector Support)
-- Fallback schema for systems without pgvector extension

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS kb_chunks CASCADE;
DROP TABLE IF EXISTS kb_sources CASCADE;
DROP TABLE IF EXISTS ingestion_jobs CASCADE;
DROP TABLE IF EXISTS embedding_cache CASCADE;

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

-- Knowledge base chunks table without vector embeddings (fallback mode)
CREATE TABLE kb_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
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
    -- embedding vector(3072), -- Disabled - requires pgvector extension
    embedding_text TEXT, -- Fallback: store embedding as text
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
    feedback_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
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
    audit_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
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
    job_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
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

-- Embedding cache table for caching OpenAI embeddings (text fallback)
CREATE TABLE embedding_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of model + text
    text_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of original text
    embedding_text TEXT NOT NULL, -- Cached embedding as text (fallback)
    model VARCHAR(50) NOT NULL, -- Model used for embedding
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    
    -- Constraints
    CONSTRAINT valid_token_count CHECK (token_count >= 0)
);

-- Performance optimization indexes (without vector indexes)
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

-- Initial configuration data
INSERT INTO kb_sources (source_id, filename, file_path, file_size, file_hash, version, document_type, title) VALUES
('guide_1_v1.9', 'Fund_Manager_User_Guide_1.9.pdf', './Fund_Manager_User_Guide_1.9.pdf', 0, '', '1.9', 'pdf', 'Fund Manager User Guide'),
('guide_1_v1.9_ma', 'Fund_Manager_User_Guide_v_1.9_MA_format.pdf', './Fund_Manager_User_Guide_v_1.9_MA_format.pdf', 0, '', '1.9', 'pdf', 'Fund Manager User Guide (MA Format)')
ON CONFLICT (source_id) DO NOTHING;

-- Database initialization complete
SELECT 'Database schema created successfully (no vector support)' as status;
