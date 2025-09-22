-- =====================================================
-- Advanced Document Processing - Phase 4 Schema Rollback
-- Rollback for Migration 004: Hierarchical Relationships & Multi-Scale Support
-- 
-- Purpose: Safely rollback all Phase 4 schema changes
-- Risk Level: HIGH - Critical rollback operation
-- =====================================================

BEGIN;

-- Log rollback start
INSERT INTO migration_log (migration_id, description, started_at, status)
VALUES ('004-rollback', 'Phase 4 Schema Rollback', NOW(), 'STARTED');

-- =====================================================
-- 1. DROP TRIGGERS (in reverse order)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_maintain_relationships ON kb_chunks;
DROP TRIGGER IF EXISTS trigger_update_document_stats ON kb_chunks;
DROP TRIGGER IF EXISTS trigger_update_chunk_hash ON kb_chunks;

-- =====================================================
-- 2. DROP FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS find_similar_chunks_multi_scale(vector(3072), VARCHAR(50), DECIMAL(3,2), INTEGER);
DROP FUNCTION IF EXISTS calculate_document_quality(VARCHAR(100));
DROP FUNCTION IF EXISTS get_chunk_hierarchy_path(VARCHAR(100));
DROP FUNCTION IF EXISTS maintain_chunk_relationships();
DROP FUNCTION IF EXISTS update_document_statistics();
DROP FUNCTION IF EXISTS update_chunk_hash();

-- =====================================================
-- 3. DROP VIEWS
-- =====================================================

DROP VIEW IF EXISTS v_quality_metrics_summary;
DROP VIEW IF EXISTS v_document_processing_summary;
DROP VIEW IF EXISTS v_hierarchical_chunks;

-- =====================================================
-- 4. DROP INDEXES (in reverse order)
-- =====================================================

-- Semantic boundaries indexes
DROP INDEX IF EXISTS idx_boundaries_confidence;
DROP INDEX IF EXISTS idx_boundaries_type;
DROP INDEX IF EXISTS idx_boundaries_chunk;

-- Quality metrics indexes
DROP INDEX IF EXISTS idx_quality_metrics_score;
DROP INDEX IF EXISTS idx_quality_metrics_type;
DROP INDEX IF EXISTS idx_quality_metrics_chunk;

-- Processing history indexes
DROP INDEX IF EXISTS idx_processing_history_started;
DROP INDEX IF EXISTS idx_processing_history_status;
DROP INDEX IF EXISTS idx_processing_history_version;
DROP INDEX IF EXISTS idx_processing_history_document;

-- Relationship table indexes
DROP INDEX IF EXISTS idx_relationships_strength;
DROP INDEX IF EXISTS idx_relationships_type;
DROP INDEX IF EXISTS idx_relationships_target_chunk;
DROP INDEX IF EXISTS idx_relationships_source_chunk;

-- Document enhancement indexes
DROP INDEX IF EXISTS idx_documents_processing_version;
DROP INDEX IF EXISTS idx_documents_average_quality;
DROP INDEX IF EXISTS idx_documents_total_tokens;
DROP INDEX IF EXISTS idx_documents_chunk_count;

-- Multi-scale embedding indexes
DROP INDEX IF EXISTS idx_chunks_semantic_embedding;
DROP INDEX IF EXISTS idx_chunks_hierarchical_embedding;
DROP INDEX IF EXISTS idx_chunks_contextual_embedding;
DROP INDEX IF EXISTS idx_chunks_content_embedding;

-- Quality and processing indexes
DROP INDEX IF EXISTS idx_chunks_processing_pipeline;
DROP INDEX IF EXISTS idx_chunks_version_id;
DROP INDEX IF EXISTS idx_chunks_coherence_score;
DROP INDEX IF EXISTS idx_chunks_quality_score;

-- Hierarchical relationship indexes
DROP INDEX IF EXISTS idx_chunks_sequence_order;
DROP INDEX IF EXISTS idx_chunks_node_id;
DROP INDEX IF EXISTS idx_chunks_scale_type;
DROP INDEX IF EXISTS idx_chunks_hierarchy_level;
DROP INDEX IF EXISTS idx_chunks_parent_id;

-- =====================================================
-- 5. DROP CONSTRAINTS
-- =====================================================

-- Semantic boundary validation
ALTER TABLE semantic_boundaries DROP CONSTRAINT IF EXISTS chk_confidence_score_range;
ALTER TABLE semantic_boundaries DROP CONSTRAINT IF EXISTS chk_boundary_position_positive;

-- Quality metrics validation
ALTER TABLE embedding_quality_metrics DROP CONSTRAINT IF EXISTS chk_sparsity_ratio_range;
ALTER TABLE embedding_quality_metrics DROP CONSTRAINT IF EXISTS chk_dimensionality_positive;
ALTER TABLE embedding_quality_metrics DROP CONSTRAINT IF EXISTS chk_quality_score_range;

-- Relationship strength validation
ALTER TABLE chunk_relationships DROP CONSTRAINT IF EXISTS chk_relationship_strength_range;

-- Document metrics consistency
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_average_quality_range;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_total_tokens_positive;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_chunk_count_positive;

-- Hierarchy consistency
ALTER TABLE kb_chunks DROP CONSTRAINT IF EXISTS chk_coherence_score_range;
ALTER TABLE kb_chunks DROP CONSTRAINT IF EXISTS chk_quality_score_range;
ALTER TABLE kb_chunks DROP CONSTRAINT IF EXISTS chk_hierarchy_level_positive;

-- =====================================================
-- 6. DROP NEW TABLES (in reverse dependency order)
-- =====================================================

DROP TABLE IF EXISTS semantic_boundaries;
DROP TABLE IF EXISTS embedding_quality_metrics;
DROP TABLE IF EXISTS document_processing_history;
DROP TABLE IF EXISTS chunk_relationships;

-- =====================================================
-- 7. REMOVE NEW COLUMNS FROM EXISTING TABLES
-- =====================================================

-- Remove columns from documents table
ALTER TABLE documents 
DROP COLUMN IF EXISTS processing_version,
DROP COLUMN IF EXISTS average_quality,
DROP COLUMN IF EXISTS total_tokens,
DROP COLUMN IF EXISTS chunk_count,
DROP COLUMN IF EXISTS hierarchical_summary,
DROP COLUMN IF EXISTS quality_metrics,
DROP COLUMN IF EXISTS processing_config,
DROP COLUMN IF EXISTS document_structure;

-- Remove columns from kb_chunks table (in reverse order)
ALTER TABLE kb_chunks
DROP COLUMN IF EXISTS chunk_hash,
DROP COLUMN IF EXISTS processing_pipeline,
DROP COLUMN IF EXISTS last_modified_by,
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS version_id,
DROP COLUMN IF EXISTS chunk_statistics,
DROP COLUMN IF EXISTS processing_metadata,
DROP COLUMN IF EXISTS semantic_boundaries,
DROP COLUMN IF EXISTS coherence_score,
DROP COLUMN IF EXISTS quality_score,
DROP COLUMN IF EXISTS semantic_embedding,
DROP COLUMN IF EXISTS hierarchical_embedding,
DROP COLUMN IF EXISTS contextual_embedding,
DROP COLUMN IF EXISTS content_embedding,
DROP COLUMN IF EXISTS sequence_order,
DROP COLUMN IF EXISTS node_id,
DROP COLUMN IF EXISTS scale_type,
DROP COLUMN IF EXISTS hierarchy_path,
DROP COLUMN IF EXISTS hierarchy_level,
DROP COLUMN IF EXISTS sibling_chunk_ids,
DROP COLUMN IF EXISTS child_chunk_ids,
DROP COLUMN IF EXISTS parent_chunk_id;

-- =====================================================
-- 8. RESTORE DATA FROM BACKUP (if needed)
-- =====================================================

-- Note: This section would restore data from backup tables if necessary
-- For safety, we keep the backup tables and let administrators decide
-- whether to restore data manually

-- =====================================================
-- 9. CLEANUP BACKUP TABLES (optional - commented out for safety)
-- =====================================================

-- Uncomment these lines only if you're certain the rollback was successful
-- and you want to remove the backup tables

-- DROP TABLE IF EXISTS documents_backup_phase4;
-- DROP TABLE IF EXISTS kb_chunks_backup_phase4;

-- =====================================================
-- 10. LOG ROLLBACK COMPLETION
-- =====================================================

-- Update migration log
UPDATE migration_log 
SET 
    completed_at = NOW(), 
    status = 'ROLLED_BACK',
    notes = 'Phase 4 schema changes successfully rolled back'
WHERE migration_id = '004-rollback';

-- Mark original migration as rolled back
UPDATE migration_log 
SET 
    status = 'ROLLED_BACK',
    notes = 'Migration rolled back on ' || NOW()::text
WHERE migration_id = '004';

COMMIT;

-- =====================================================
-- ROLLBACK COMPLETED SUCCESSFULLY
-- 
-- IMPORTANT NOTES:
-- 1. Backup tables are preserved for safety
-- 2. All new schema elements have been removed
-- 3. Original table structure has been restored
-- 4. Consider running VACUUM ANALYZE after rollback
-- =====================================================
