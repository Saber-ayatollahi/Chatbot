-- Temporary schema without pgvector for initial setup
-- Fund Management Chatbot - Database Schema (No Vector)

-- Enable required extensions (excluding vector for now)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS kb_chunks CASCADE;
DROP TABLE IF EXISTS kb_sources CASCADE;
DROP TABLE IF EXISTS ingestion_jobs CASCADE;

-- Knowledge base sources table
CREATE TABLE kb_sources (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(100) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    version VARCHAR(20) NOT NULL,
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
);

-- Knowledge base chunks table (without vector for now)
CREATE TABLE kb_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    source_id VARCHAR(100) NOT NULL REFERENCES kb_sources(source_id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    chunk_index INTEGER NOT NULL,
    heading TEXT,
    subheading TEXT,
    page_number INTEGER,
    page_range INTEGER[],
    section_path TEXT[],
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text',
    -- embedding vector(1536), -- Commented out for now
    embedding_json TEXT, -- Store as JSON string temporarily
    token_count INTEGER NOT NULL,
    character_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    quality_score FLOAT DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT valid_page_number CHECK (page_number > 0),
    CONSTRAINT valid_token_count CHECK (token_count > 0),
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
    CONSTRAINT unique_source_chunk UNIQUE (source_id, version, chunk_index)
);

-- Conversations table
CREATE TABLE conversations (
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
);

-- Feedback table
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    feedback_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    session_id VARCHAR(100) NOT NULL REFERENCES conversations(session_id) ON DELETE CASCADE,
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
);

-- Audit logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    audit_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
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
);

-- Ingestion jobs table
CREATE TABLE ingestion_jobs (
    id SERIAL PRIMARY KEY,
    job_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    source_id VARCHAR(100) NOT NULL REFERENCES kb_sources(source_id) ON DELETE CASCADE,
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
);

-- Basic indexes (without vector indexes)
CREATE INDEX idx_kb_chunks_source_version ON kb_chunks (source_id, version);
CREATE INDEX idx_kb_chunks_source_id ON kb_chunks (source_id);
CREATE INDEX idx_kb_chunks_version ON kb_chunks (version);
CREATE INDEX idx_kb_chunks_chunk_id ON kb_chunks (chunk_id);
CREATE INDEX idx_kb_chunks_content_gin ON kb_chunks USING gin (to_tsvector('english', content));
CREATE INDEX idx_kb_chunks_heading_gin ON kb_chunks USING gin (to_tsvector('english', heading));
CREATE INDEX idx_kb_chunks_page_number ON kb_chunks (page_number);

CREATE INDEX idx_conversations_session ON conversations (session_id);
CREATE INDEX idx_conversations_user_id ON conversations (user_id);
CREATE INDEX idx_conversations_last_activity ON conversations (last_activity);
CREATE INDEX idx_conversations_status ON conversations (conversation_status);

CREATE INDEX idx_feedback_session ON feedback (session_id);
CREATE INDEX idx_feedback_message_id ON feedback (message_id);
CREATE INDEX idx_feedback_rating ON feedback (rating);
CREATE INDEX idx_feedback_created ON feedback (created_at);

CREATE INDEX idx_audit_logs_session ON audit_logs (session_id);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at);
CREATE INDEX idx_audit_logs_interaction_type ON audit_logs (interaction_type);
CREATE INDEX idx_audit_logs_review_status ON audit_logs (review_status);

CREATE INDEX idx_ingestion_jobs_source_id ON ingestion_jobs (source_id);
CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs (job_status);
CREATE INDEX idx_ingestion_jobs_created ON ingestion_jobs (created_at);

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

SELECT 'Database schema created successfully without vector extension' as status;
