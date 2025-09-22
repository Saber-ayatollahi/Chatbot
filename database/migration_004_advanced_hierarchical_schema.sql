-- =====================================================
-- Advanced Document Processing - Phase 4 Schema Migration
-- Migration 004: Hierarchical Relationships & Multi-Scale Support
-- 
-- Purpose: Implement comprehensive hierarchical document structure
--          with multi-scale embeddings and advanced relationships
-- 
-- Risk Level: HIGH - Critical schema changes
-- Rollback: Available via migration_004_rollback.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. BACKUP EXISTING DATA
-- =====================================================

-- Create backup table for existing chunks
CREATE TABLE IF NOT EXISTS kb_chunks_backup_phase4 AS 
SELECT * FROM kb_chunks;

-- Create backup table for existing documents
CREATE TABLE IF NOT EXISTS documents_backup_phase4 AS 
SELECT * FROM documents;

-- Log migration start
INSERT INTO migration_log (migration_id, description, started_at, status)
VALUES ('004', 'Advanced Hierarchical Schema Migration', NOW(), 'STARTED');

-- =====================================================
-- 2. ADVANCED HIERARCHICAL COLUMNS
-- =====================================================

-- Add hierarchical relationship columns
ALTER TABLE kb_chunks 
ADD COLUMN IF NOT EXISTS parent_chunk_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS child_chunk_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sibling_chunk_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hierarchy_path TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS scale_type VARCHAR(20) DEFAULT 'paragraph',
ADD COLUMN IF NOT EXISTS node_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS sequence_order INTEGER DEFAULT 0;

-- Add multi-scale embedding support
ALTER TABLE kb_chunks
ADD COLUMN IF NOT EXISTS content_embedding vector(3072),
ADD COLUMN IF NOT EXISTS contextual_embedding vector(3072),
ADD COLUMN IF NOT EXISTS hierarchical_embedding vector(3072),
ADD COLUMN IF NOT EXISTS semantic_embedding vector(3072);

-- Add quality and processing metadata
ALTER TABLE kb_chunks
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS coherence_score DECIMAL(5,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS semantic_boundaries JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS chunk_statistics JSONB DEFAULT '{}';

-- Add temporal and versioning support
ALTER TABLE kb_chunks
ADD COLUMN IF NOT EXISTS version_id VARCHAR(50) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS processing_pipeline VARCHAR(100) DEFAULT 'hierarchical-semantic',
ADD COLUMN IF NOT EXISTS chunk_hash VARCHAR(64);

-- =====================================================
-- 3. DOCUMENT ENHANCEMENT
-- =====================================================

-- Enhance documents table for advanced processing
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS document_structure JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS processing_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS hierarchical_summary JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_quality DECIMAL(5,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS processing_version VARCHAR(20) DEFAULT '2.0';

-- =====================================================
-- 4. NEW TABLES FOR ADVANCED FEATURES
-- =====================================================

-- Chunk relationships table for complex hierarchies
CREATE TABLE IF NOT EXISTS chunk_relationships (
    id SERIAL PRIMARY KEY,
    source_chunk_id VARCHAR(100) NOT NULL,
    target_chunk_id VARCHAR(100) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL, -- parent, child, sibling, reference, citation
    relationship_strength DECIMAL(3,2) DEFAULT 1.0,
    relationship_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_source_chunk FOREIGN KEY (source_chunk_id) REFERENCES kb_chunks(chunk_id) ON DELETE CASCADE,
    CONSTRAINT fk_target_chunk FOREIGN KEY (target_chunk_id) REFERENCES kb_chunks(chunk_id) ON DELETE CASCADE,
    CONSTRAINT unique_relationship UNIQUE (source_chunk_id, target_chunk_id, relationship_type)
);

-- Document processing history
CREATE TABLE IF NOT EXISTS document_processing_history (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(100) NOT NULL,
    processing_version VARCHAR(20) NOT NULL,
    processing_config JSONB NOT NULL,
    chunks_generated INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    quality_score DECIMAL(5,4) DEFAULT 0.0,
    error_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    processing_metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed, cancelled
    
    CONSTRAINT fk_document_history FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Embedding quality metrics
CREATE TABLE IF NOT EXISTS embedding_quality_metrics (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(100) NOT NULL,
    embedding_type VARCHAR(50) NOT NULL, -- content, contextual, hierarchical, semantic
    quality_score DECIMAL(5,4) NOT NULL,
    dimensionality INTEGER NOT NULL,
    norm_value DECIMAL(10,8),
    sparsity_ratio DECIMAL(5,4),
    validation_status VARCHAR(20) DEFAULT 'valid',
    validation_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_chunk_quality FOREIGN KEY (chunk_id) REFERENCES kb_chunks(chunk_id) ON DELETE CASCADE,
    CONSTRAINT unique_chunk_embedding_type UNIQUE (chunk_id, embedding_type)
);

-- Semantic boundary detection results
CREATE TABLE IF NOT EXISTS semantic_boundaries (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(100) NOT NULL,
    boundary_type VARCHAR(50) NOT NULL, -- sentence, paragraph, section, topic
    boundary_position INTEGER NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    boundary_metadata JSONB DEFAULT '{}',
    detected_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_chunk_boundary FOREIGN KEY (chunk_id) REFERENCES kb_chunks(chunk_id) ON DELETE CASCADE
);

-- =====================================================
-- 5. PERFORMANCE INDEXES
-- =====================================================

-- Hierarchical relationship indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_parent_id ON kb_chunks(parent_chunk_id) WHERE parent_chunk_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_hierarchy_level ON kb_chunks(hierarchy_level);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_scale_type ON kb_chunks(scale_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_node_id ON kb_chunks(node_id) WHERE node_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_sequence_order ON kb_chunks(sequence_order);

-- Quality and processing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_quality_score ON kb_chunks(quality_score) WHERE quality_score > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_coherence_score ON kb_chunks(coherence_score) WHERE coherence_score > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_version_id ON kb_chunks(version_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_processing_pipeline ON kb_chunks(processing_pipeline);

-- Multi-scale embedding indexes (using HNSW for vector similarity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_content_embedding ON kb_chunks USING hnsw (content_embedding vector_cosine_ops) WHERE content_embedding IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_contextual_embedding ON kb_chunks USING hnsw (contextual_embedding vector_cosine_ops) WHERE contextual_embedding IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_hierarchical_embedding ON kb_chunks USING hnsw (hierarchical_embedding vector_cosine_ops) WHERE hierarchical_embedding IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_semantic_embedding ON kb_chunks USING hnsw (semantic_embedding vector_cosine_ops) WHERE semantic_embedding IS NOT NULL;

-- Document enhancement indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_chunk_count ON documents(chunk_count) WHERE chunk_count > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_total_tokens ON documents(total_tokens) WHERE total_tokens > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_average_quality ON documents(average_quality) WHERE average_quality > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_processing_version ON documents(processing_version);

-- Relationship table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_source_chunk ON chunk_relationships(source_chunk_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_target_chunk ON chunk_relationships(target_chunk_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_type ON chunk_relationships(relationship_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_strength ON chunk_relationships(relationship_strength) WHERE relationship_strength > 0.5;

-- Processing history indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_document ON document_processing_history(document_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_version ON document_processing_history(processing_version);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_status ON document_processing_history(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_started ON document_processing_history(started_at);

-- Quality metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_chunk ON embedding_quality_metrics(chunk_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_type ON embedding_quality_metrics(embedding_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_score ON embedding_quality_metrics(quality_score) WHERE quality_score > 0.5;

-- Semantic boundaries indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boundaries_chunk ON semantic_boundaries(chunk_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boundaries_type ON semantic_boundaries(boundary_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boundaries_confidence ON semantic_boundaries(confidence_score) WHERE confidence_score > 0.7;

-- =====================================================
-- 6. ADVANCED CONSTRAINTS AND TRIGGERS
-- =====================================================

-- Ensure hierarchy consistency
ALTER TABLE kb_chunks 
ADD CONSTRAINT chk_hierarchy_level_positive CHECK (hierarchy_level >= 0),
ADD CONSTRAINT chk_quality_score_range CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
ADD CONSTRAINT chk_coherence_score_range CHECK (coherence_score >= 0.0 AND coherence_score <= 1.0);

-- Ensure document metrics consistency
ALTER TABLE documents
ADD CONSTRAINT chk_chunk_count_positive CHECK (chunk_count >= 0),
ADD CONSTRAINT chk_total_tokens_positive CHECK (total_tokens >= 0),
ADD CONSTRAINT chk_average_quality_range CHECK (average_quality >= 0.0 AND average_quality <= 1.0);

-- Relationship strength validation
ALTER TABLE chunk_relationships
ADD CONSTRAINT chk_relationship_strength_range CHECK (relationship_strength >= 0.0 AND relationship_strength <= 1.0);

-- Quality metrics validation
ALTER TABLE embedding_quality_metrics
ADD CONSTRAINT chk_quality_score_range CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
ADD CONSTRAINT chk_dimensionality_positive CHECK (dimensionality > 0),
ADD CONSTRAINT chk_sparsity_ratio_range CHECK (sparsity_ratio >= 0.0 AND sparsity_ratio <= 1.0);

-- Semantic boundary validation
ALTER TABLE semantic_boundaries
ADD CONSTRAINT chk_boundary_position_positive CHECK (boundary_position >= 0),
ADD CONSTRAINT chk_confidence_score_range CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

-- =====================================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update chunk hash
CREATE OR REPLACE FUNCTION update_chunk_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.chunk_hash = encode(sha256(NEW.content::bytea), 'hex');
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for chunk hash updates
DROP TRIGGER IF EXISTS trigger_update_chunk_hash ON kb_chunks;
CREATE TRIGGER trigger_update_chunk_hash
    BEFORE INSERT OR UPDATE OF content ON kb_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_chunk_hash();

-- Function to update document statistics
CREATE OR REPLACE FUNCTION update_document_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update document chunk count and quality metrics
    UPDATE documents 
    SET 
        chunk_count = (
            SELECT COUNT(*) 
            FROM kb_chunks 
            WHERE document_id = NEW.document_id
        ),
        total_tokens = (
            SELECT COALESCE(SUM(token_count), 0) 
            FROM kb_chunks 
            WHERE document_id = NEW.document_id
        ),
        average_quality = (
            SELECT COALESCE(AVG(quality_score), 0.0) 
            FROM kb_chunks 
            WHERE document_id = NEW.document_id AND quality_score > 0
        ),
        updated_at = NOW()
    WHERE id = NEW.document_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for document statistics updates
DROP TRIGGER IF EXISTS trigger_update_document_stats ON kb_chunks;
CREATE TRIGGER trigger_update_document_stats
    AFTER INSERT OR UPDATE OR DELETE ON kb_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_document_statistics();

-- Function to maintain relationship consistency
CREATE OR REPLACE FUNCTION maintain_chunk_relationships()
RETURNS TRIGGER AS $$
BEGIN
    -- When a chunk is deleted, clean up relationships
    IF TG_OP = 'DELETE' THEN
        DELETE FROM chunk_relationships 
        WHERE source_chunk_id = OLD.chunk_id OR target_chunk_id = OLD.chunk_id;
        RETURN OLD;
    END IF;
    
    -- When parent_chunk_id is updated, maintain bidirectional relationships
    IF TG_OP = 'UPDATE' AND NEW.parent_chunk_id IS DISTINCT FROM OLD.parent_chunk_id THEN
        -- Remove old parent relationship
        IF OLD.parent_chunk_id IS NOT NULL THEN
            DELETE FROM chunk_relationships 
            WHERE source_chunk_id = NEW.chunk_id 
            AND target_chunk_id = OLD.parent_chunk_id 
            AND relationship_type = 'parent';
        END IF;
        
        -- Add new parent relationship
        IF NEW.parent_chunk_id IS NOT NULL THEN
            INSERT INTO chunk_relationships (source_chunk_id, target_chunk_id, relationship_type, relationship_strength)
            VALUES (NEW.chunk_id, NEW.parent_chunk_id, 'parent', 1.0)
            ON CONFLICT (source_chunk_id, target_chunk_id, relationship_type) DO NOTHING;
            
            -- Add reciprocal child relationship
            INSERT INTO chunk_relationships (source_chunk_id, target_chunk_id, relationship_type, relationship_strength)
            VALUES (NEW.parent_chunk_id, NEW.chunk_id, 'child', 1.0)
            ON CONFLICT (source_chunk_id, target_chunk_id, relationship_type) DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for relationship maintenance
DROP TRIGGER IF EXISTS trigger_maintain_relationships ON kb_chunks;
CREATE TRIGGER trigger_maintain_relationships
    AFTER INSERT OR UPDATE OR DELETE ON kb_chunks
    FOR EACH ROW
    EXECUTE FUNCTION maintain_chunk_relationships();

-- =====================================================
-- 8. VIEWS FOR ENHANCED QUERYING
-- =====================================================

-- Hierarchical chunk view with full relationship data
CREATE OR REPLACE VIEW v_hierarchical_chunks AS
SELECT 
    c.*,
    p.chunk_id as parent_chunk_text,
    p.content as parent_content,
    ARRAY(
        SELECT child.chunk_id 
        FROM kb_chunks child 
        WHERE child.parent_chunk_id = c.chunk_id
    ) as actual_child_ids,
    COALESCE(c.quality_score, 0.0) as normalized_quality,
    COALESCE(c.coherence_score, 0.0) as normalized_coherence,
    CASE 
        WHEN c.content_embedding IS NOT NULL THEN 'content'
        WHEN c.contextual_embedding IS NOT NULL THEN 'contextual'
        WHEN c.hierarchical_embedding IS NOT NULL THEN 'hierarchical'
        WHEN c.semantic_embedding IS NOT NULL THEN 'semantic'
        ELSE 'none'
    END as primary_embedding_type
FROM kb_chunks c
LEFT JOIN kb_chunks p ON c.parent_chunk_id = p.chunk_id;

-- Document processing summary view
CREATE OR REPLACE VIEW v_document_processing_summary AS
SELECT 
    d.*,
    h.processing_version as latest_processing_version,
    h.processing_time_ms as latest_processing_time,
    h.quality_score as latest_quality_score,
    h.chunks_generated as latest_chunks_generated,
    h.completed_at as latest_processing_date,
    COALESCE(chunk_stats.total_chunks, 0) as actual_chunk_count,
    COALESCE(chunk_stats.avg_quality, 0.0) as actual_avg_quality,
    COALESCE(chunk_stats.avg_tokens, 0.0) as avg_tokens_per_chunk
FROM documents d
LEFT JOIN LATERAL (
    SELECT * FROM document_processing_history 
    WHERE document_id = d.id 
    ORDER BY completed_at DESC 
    LIMIT 1
) h ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_chunks,
        AVG(quality_score) as avg_quality,
        AVG(token_count) as avg_tokens
    FROM kb_chunks 
    WHERE document_id = d.id
) chunk_stats ON true;

-- Quality metrics summary view
CREATE OR REPLACE VIEW v_quality_metrics_summary AS
SELECT 
    c.chunk_id,
    c.document_id,
    c.quality_score as chunk_quality,
    c.coherence_score as chunk_coherence,
    COALESCE(eq_content.quality_score, 0.0) as content_embedding_quality,
    COALESCE(eq_contextual.quality_score, 0.0) as contextual_embedding_quality,
    COALESCE(eq_hierarchical.quality_score, 0.0) as hierarchical_embedding_quality,
    COALESCE(eq_semantic.quality_score, 0.0) as semantic_embedding_quality,
    (
        COALESCE(c.quality_score, 0.0) + 
        COALESCE(c.coherence_score, 0.0) + 
        COALESCE(eq_content.quality_score, 0.0) + 
        COALESCE(eq_contextual.quality_score, 0.0) + 
        COALESCE(eq_hierarchical.quality_score, 0.0) + 
        COALESCE(eq_semantic.quality_score, 0.0)
    ) / 6.0 as overall_quality_score
FROM kb_chunks c
LEFT JOIN embedding_quality_metrics eq_content ON c.chunk_id = eq_content.chunk_id AND eq_content.embedding_type = 'content'
LEFT JOIN embedding_quality_metrics eq_contextual ON c.chunk_id = eq_contextual.chunk_id AND eq_contextual.embedding_type = 'contextual'
LEFT JOIN embedding_quality_metrics eq_hierarchical ON c.chunk_id = eq_hierarchical.chunk_id AND eq_hierarchical.embedding_type = 'hierarchical'
LEFT JOIN embedding_quality_metrics eq_semantic ON c.chunk_id = eq_semantic.chunk_id AND eq_semantic.embedding_type = 'semantic';

-- =====================================================
-- 9. FUNCTIONS FOR ADVANCED OPERATIONS
-- =====================================================

-- Function to get chunk hierarchy path
CREATE OR REPLACE FUNCTION get_chunk_hierarchy_path(chunk_id_param VARCHAR(100))
RETURNS TEXT[] AS $$
DECLARE
    path TEXT[] := ARRAY[]::TEXT[];
    current_chunk_id VARCHAR(100) := chunk_id_param;
    parent_id VARCHAR(100);
    max_depth INTEGER := 10; -- Prevent infinite loops
    current_depth INTEGER := 0;
BEGIN
    WHILE current_chunk_id IS NOT NULL AND current_depth < max_depth LOOP
        path := array_prepend(current_chunk_id, path);
        
        SELECT parent_chunk_id INTO parent_id
        FROM kb_chunks 
        WHERE chunk_id = current_chunk_id;
        
        current_chunk_id := parent_id;
        current_depth := current_depth + 1;
    END LOOP;
    
    RETURN path;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate document quality score
CREATE OR REPLACE FUNCTION calculate_document_quality(document_id_param VARCHAR(100))
RETURNS DECIMAL(5,4) AS $$
DECLARE
    quality_score DECIMAL(5,4);
BEGIN
    SELECT 
        COALESCE(
            (
                AVG(c.quality_score) * 0.4 +
                AVG(c.coherence_score) * 0.3 +
                AVG(eq.quality_score) * 0.3
            ), 
            0.0
        )
    INTO quality_score
    FROM kb_chunks c
    LEFT JOIN embedding_quality_metrics eq ON c.chunk_id = eq.chunk_id
    WHERE c.document_id = document_id_param;
    
    RETURN COALESCE(quality_score, 0.0);
END;
$$ LANGUAGE plpgsql;

-- Function to find similar chunks across all embedding types
CREATE OR REPLACE FUNCTION find_similar_chunks_multi_scale(
    query_embedding vector(3072),
    embedding_type_param VARCHAR(50) DEFAULT 'content',
    similarity_threshold DECIMAL(3,2) DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    chunk_id VARCHAR(100),
    similarity_score DECIMAL(5,4),
    embedding_type VARCHAR(50),
    content TEXT,
    quality_score DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.chunk_id,
        CASE embedding_type_param
            WHEN 'content' THEN (c.content_embedding <=> query_embedding)::DECIMAL(5,4)
            WHEN 'contextual' THEN (c.contextual_embedding <=> query_embedding)::DECIMAL(5,4)
            WHEN 'hierarchical' THEN (c.hierarchical_embedding <=> query_embedding)::DECIMAL(5,4)
            WHEN 'semantic' THEN (c.semantic_embedding <=> query_embedding)::DECIMAL(5,4)
            ELSE 0.0
        END as similarity_score,
        embedding_type_param as embedding_type,
        c.content,
        COALESCE(c.quality_score, 0.0) as quality_score
    FROM kb_chunks c
    WHERE 
        CASE embedding_type_param
            WHEN 'content' THEN c.content_embedding IS NOT NULL AND (c.content_embedding <=> query_embedding) >= similarity_threshold
            WHEN 'contextual' THEN c.contextual_embedding IS NOT NULL AND (c.contextual_embedding <=> query_embedding) >= similarity_threshold
            WHEN 'hierarchical' THEN c.hierarchical_embedding IS NOT NULL AND (c.hierarchical_embedding <=> query_embedding) >= similarity_threshold
            WHEN 'semantic' THEN c.semantic_embedding IS NOT NULL AND (c.semantic_embedding <=> query_embedding) >= similarity_threshold
            ELSE false
        END
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. MIGRATION COMPLETION
-- =====================================================

-- Update migration log
UPDATE migration_log 
SET 
    completed_at = NOW(), 
    status = 'COMPLETED',
    notes = 'Advanced hierarchical schema migration completed successfully'
WHERE migration_id = '004';

-- Create migration summary
INSERT INTO migration_log (migration_id, description, started_at, completed_at, status, notes)
VALUES (
    '004-summary', 
    'Phase 4 Migration Summary', 
    NOW(), 
    NOW(), 
    'COMPLETED',
    jsonb_build_object(
        'tables_modified', ARRAY['kb_chunks', 'documents'],
        'tables_created', ARRAY['chunk_relationships', 'document_processing_history', 'embedding_quality_metrics', 'semantic_boundaries'],
        'indexes_created', 25,
        'triggers_created', 3,
        'views_created', 3,
        'functions_created', 3,
        'constraints_added', 12
    )::text
);

COMMIT;

-- =====================================================
-- MIGRATION COMPLETED SUCCESSFULLY
-- =====================================================
