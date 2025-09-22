-- Migration 005: Add Advanced Hierarchical Document Processing Columns
-- Adds columns required for hierarchical semantic chunking and multi-scale embeddings

-- Add hierarchical relationship columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'parent_chunk_id') THEN
        ALTER TABLE kb_chunks ADD COLUMN parent_chunk_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'child_chunk_ids') THEN
        ALTER TABLE kb_chunks ADD COLUMN child_chunk_ids TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'sibling_chunk_ids') THEN
        ALTER TABLE kb_chunks ADD COLUMN sibling_chunk_ids TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'scale') THEN
        ALTER TABLE kb_chunks ADD COLUMN scale VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'node_id') THEN
        ALTER TABLE kb_chunks ADD COLUMN node_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'hierarchy_path') THEN
        ALTER TABLE kb_chunks ADD COLUMN hierarchy_path TEXT[];
    END IF;
END $$;

-- Add multi-scale embedding columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'contextual_embedding') THEN
        ALTER TABLE kb_chunks ADD COLUMN contextual_embedding vector(3072);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'hierarchical_embedding') THEN
        ALTER TABLE kb_chunks ADD COLUMN hierarchical_embedding vector(3072);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'semantic_embedding') THEN
        ALTER TABLE kb_chunks ADD COLUMN semantic_embedding vector(3072);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'semantic_boundaries') THEN
        ALTER TABLE kb_chunks ADD COLUMN semantic_boundaries INTEGER[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'processing_version') THEN
        ALTER TABLE kb_chunks ADD COLUMN processing_version VARCHAR(20) DEFAULT '2.0';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'chunk_quality_metrics') THEN
        ALTER TABLE kb_chunks ADD COLUMN chunk_quality_metrics JSONB;
    END IF;
END $$;

-- Add indexes for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_chunks_parent_id ON kb_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_scale ON kb_chunks(scale);
CREATE INDEX IF NOT EXISTS idx_chunks_node_id ON kb_chunks(node_id);
CREATE INDEX IF NOT EXISTS idx_chunks_processing_version ON kb_chunks(processing_version);

-- Add indexes for multi-scale embeddings
CREATE INDEX IF NOT EXISTS idx_chunks_contextual_embedding ON kb_chunks USING ivfflat (contextual_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_hierarchical_embedding ON kb_chunks USING ivfflat (hierarchical_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_semantic_embedding ON kb_chunks USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 100);

-- Add GIN index for hierarchy path array searches
CREATE INDEX IF NOT EXISTS idx_chunks_hierarchy_path ON kb_chunks USING gin (hierarchy_path);

-- Add constraints for data integrity
ALTER TABLE kb_chunks ADD CONSTRAINT IF NOT EXISTS chk_scale_values 
  CHECK (scale IS NULL OR scale IN ('document', 'section', 'paragraph', 'sentence'));

-- Add foreign key constraint for parent-child relationships
ALTER TABLE kb_chunks ADD CONSTRAINT IF NOT EXISTS fk_parent_chunk 
  FOREIGN KEY (parent_chunk_id) REFERENCES kb_chunks(chunk_id) ON DELETE SET NULL;

-- Update existing chunks to have processing version
UPDATE kb_chunks SET processing_version = '1.0' WHERE processing_version IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN kb_chunks.parent_chunk_id IS 'ID of parent chunk in hierarchical structure';
COMMENT ON COLUMN kb_chunks.child_chunk_ids IS 'Array of child chunk IDs';
COMMENT ON COLUMN kb_chunks.sibling_chunk_ids IS 'Array of sibling chunk IDs at same hierarchical level';
COMMENT ON COLUMN kb_chunks.scale IS 'Hierarchical scale: document, section, paragraph, sentence';
COMMENT ON COLUMN kb_chunks.node_id IS 'Unique node identifier in document hierarchy';
COMMENT ON COLUMN kb_chunks.hierarchy_path IS 'Path from document root to this chunk';
COMMENT ON COLUMN kb_chunks.contextual_embedding IS 'Embedding with surrounding context';
COMMENT ON COLUMN kb_chunks.hierarchical_embedding IS 'Embedding with hierarchical position info';
COMMENT ON COLUMN kb_chunks.semantic_embedding IS 'Domain-optimized semantic embedding';
COMMENT ON COLUMN kb_chunks.semantic_boundaries IS 'Detected semantic boundary positions';
COMMENT ON COLUMN kb_chunks.processing_version IS 'Version of processing pipeline used';
COMMENT ON COLUMN kb_chunks.chunk_quality_metrics IS 'Detailed quality assessment metrics';

-- Create view for hierarchical chunk relationships
CREATE OR REPLACE VIEW chunk_hierarchy AS
SELECT 
  c.chunk_id,
  c.source_id,
  c.scale,
  c.node_id,
  c.hierarchy_path,
  c.parent_chunk_id,
  p.content as parent_content,
  c.child_chunk_ids,
  c.quality_score,
  c.processing_version
FROM kb_chunks c
LEFT JOIN kb_chunks p ON c.parent_chunk_id = p.chunk_id
WHERE c.processing_version = '2.0';

-- Create function to get chunk with full hierarchical context
CREATE OR REPLACE FUNCTION get_chunk_with_context(target_chunk_id VARCHAR(100))
RETURNS TABLE (
  chunk_id VARCHAR(100),
  content TEXT,
  parent_content TEXT,
  child_contents TEXT[],
  sibling_contents TEXT[],
  hierarchy_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    -- Base case: target chunk
    SELECT 
      c.chunk_id,
      c.content,
      c.parent_chunk_id,
      c.child_chunk_ids,
      c.sibling_chunk_ids,
      c.hierarchy_path,
      0 as level
    FROM kb_chunks c
    WHERE c.chunk_id = target_chunk_id
    
    UNION ALL
    
    -- Recursive case: parent chunks
    SELECT 
      p.chunk_id,
      p.content,
      p.parent_chunk_id,
      p.child_chunk_ids,
      p.sibling_chunk_ids,
      p.hierarchy_path,
      h.level + 1
    FROM kb_chunks p
    JOIN hierarchy h ON p.chunk_id = h.parent_chunk_id
    WHERE h.level < 3 -- Limit recursion depth
  )
  SELECT 
    h.chunk_id,
    h.content,
    (SELECT content FROM kb_chunks WHERE chunk_id = h.parent_chunk_id) as parent_content,
    (SELECT ARRAY(SELECT content FROM kb_chunks WHERE chunk_id = ANY(h.child_chunk_ids))) as child_contents,
    (SELECT ARRAY(SELECT content FROM kb_chunks WHERE chunk_id = ANY(h.sibling_chunk_ids))) as sibling_contents,
    h.level as hierarchy_level
  FROM hierarchy h
  WHERE h.chunk_id = target_chunk_id;
END;
$$ LANGUAGE plpgsql;

-- Migration complete
SELECT 'Migration 005: Advanced hierarchical columns added successfully' as status;
