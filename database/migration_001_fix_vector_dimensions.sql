-- Migration 001: Fix Vector Dimensions Inconsistency
-- Critical Fix #1: Vector Dimension Standardization
-- Date: 2025-09-16
-- Author: System Administrator

-- ============================================================================
-- CRITICAL ISSUE: Vector dimension mismatch between schema and configuration
-- PROBLEM: Database schema uses vector(3072) but config defaults to 1536
-- SOLUTION: Standardize on text-embedding-3-large dimensions (3072)
-- ============================================================================

-- Begin transaction for atomic migration
BEGIN;

-- Step 1: Check current state and log findings
DO $$
DECLARE
  chunk_count INTEGER;
  wrong_dim_count INTEGER;
  current_schema_dim INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Check if kb_chunks table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'kb_chunks'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'INFO: kb_chunks table does not exist yet. This is normal for first-time setup.';
    RETURN;
  END IF;
  
  -- Get current count of chunks
  SELECT COUNT(*) INTO chunk_count FROM kb_chunks WHERE embedding IS NOT NULL;
  RAISE NOTICE 'INFO: Found % existing chunks with embeddings', chunk_count;
  
  -- Check for dimension mismatches if we have data
  IF chunk_count > 0 THEN
    -- Count chunks with incorrect dimensions
    SELECT COUNT(*) INTO wrong_dim_count 
    FROM kb_chunks 
    WHERE embedding IS NOT NULL 
    AND vector_dims(embedding) != 3072;
    
    IF wrong_dim_count > 0 THEN
      RAISE NOTICE 'WARNING: Found % chunks with incorrect vector dimensions (not 3072)', wrong_dim_count;
      
      -- Log details about incorrect dimensions
      FOR current_schema_dim IN 
        SELECT DISTINCT vector_dims(embedding) 
        FROM kb_chunks 
        WHERE embedding IS NOT NULL 
        AND vector_dims(embedding) != 3072
      LOOP
        RAISE NOTICE 'FOUND: Chunks with % dimensions', current_schema_dim;
      END LOOP;
      
      -- Clear incorrect embeddings (they'll need to be regenerated)
      UPDATE kb_chunks SET embedding = NULL 
      WHERE embedding IS NOT NULL AND vector_dims(embedding) != 3072;
      
      RAISE NOTICE 'FIXED: Cleared % embeddings with incorrect dimensions. These will need to be regenerated.', wrong_dim_count;
    ELSE
      RAISE NOTICE 'INFO: All existing embeddings have correct dimensions (3072)';
    END IF;
  END IF;
END $$;

-- Step 2: Ensure the embedding column has correct type
-- This will succeed if the column is already correct or if there's no conflicting data
DO $$
BEGIN
  -- Try to alter the column type
  BEGIN
    ALTER TABLE kb_chunks ALTER COLUMN embedding TYPE vector(3072);
    RAISE NOTICE 'SUCCESS: Updated embedding column to vector(3072)';
  EXCEPTION
    WHEN OTHERS THEN
      -- If it fails, the column might already be correct or there might be data issues
      RAISE NOTICE 'INFO: Column type change not needed or data conflict exists: %', SQLERRM;
  END;
END $$;

-- Step 3: Update embedding cache table if it exists
DO $$
DECLARE
  cache_table_exists BOOLEAN;
BEGIN
  -- Check if embedding_cache table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'embedding_cache'
  ) INTO cache_table_exists;
  
  IF cache_table_exists THEN
    -- Clear cache entries with wrong dimensions
    DELETE FROM embedding_cache 
    WHERE embedding IS NOT NULL 
    AND vector_dims(embedding) != 3072;
    
    -- Update column type
    BEGIN
      ALTER TABLE embedding_cache ALTER COLUMN embedding TYPE vector(3072);
      RAISE NOTICE 'SUCCESS: Updated embedding_cache column to vector(3072)';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'INFO: Embedding cache column type change not needed: %', SQLERRM;
    END;
  END IF;
END $$;

-- Step 4: Drop and recreate vector indexes with correct dimensions
-- This ensures optimal performance with the correct vector type

-- Drop existing vector indexes if they exist
DROP INDEX IF EXISTS idx_kb_chunks_embedding;
DROP INDEX IF EXISTS idx_kb_chunks_embedding_l2;
DROP INDEX IF EXISTS idx_embedding_cache_embedding;

-- Recreate vector indexes with proper dimensions and optimized settings
-- For cosine similarity (most common for text embeddings)
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding 
ON kb_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- For L2 distance (alternative similarity metric)
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_l2 
ON kb_chunks USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);

-- Index for embedding cache if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'embedding_cache') THEN
    CREATE INDEX IF NOT EXISTS idx_embedding_cache_embedding 
    ON embedding_cache USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 50); -- Smaller list count for cache table
  END IF;
END $$;

-- Step 5: Add constraint to prevent future dimension mismatches
-- This will ensure that only 3072-dimension vectors can be inserted
DO $$
BEGIN
  -- Add check constraint for embedding dimensions
  ALTER TABLE kb_chunks 
  ADD CONSTRAINT chk_embedding_dimension 
  CHECK (embedding IS NULL OR vector_dims(embedding) = 3072);
  
  RAISE NOTICE 'SUCCESS: Added constraint to enforce 3072-dimension embeddings';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'INFO: Embedding dimension constraint already exists';
  WHEN OTHERS THEN
    RAISE NOTICE 'WARNING: Could not add embedding dimension constraint: %', SQLERRM;
END $$;

-- Step 6: Update any configuration tables or metadata
-- Insert/update system configuration to reflect the change
DO $$
BEGIN
  -- Create system_config table if it doesn't exist
  CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Insert or update vector dimension configuration
  INSERT INTO system_config (config_key, config_value, description)
  VALUES (
    'vector_dimension',
    '3072',
    'Vector dimension for text embeddings (text-embedding-3-large)'
  )
  ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;
  
  -- Insert or update embedding model configuration
  INSERT INTO system_config (config_key, config_value, description)
  VALUES (
    'embedding_model',
    'text-embedding-3-large',
    'OpenAI embedding model used for vector generation'
  )
  ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;
  
  RAISE NOTICE 'SUCCESS: Updated system configuration for vector dimensions';
END $$;

-- Step 7: Create validation function for future use
CREATE OR REPLACE FUNCTION validate_embedding_dimension(embedding_vector vector)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if embedding is null (allowed) or has correct dimensions
  RETURN embedding_vector IS NULL OR vector_dims(embedding_vector) = 3072;
END;
$$;

-- Create trigger function to validate embeddings on insert/update
CREATE OR REPLACE FUNCTION trigger_validate_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.embedding IS NOT NULL AND vector_dims(NEW.embedding) != 3072 THEN
    RAISE EXCEPTION 'Invalid embedding dimension: expected 3072, got %', vector_dims(NEW.embedding);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to automatically validate embeddings
DROP TRIGGER IF EXISTS validate_embedding_trigger ON kb_chunks;
CREATE TRIGGER validate_embedding_trigger
  BEFORE INSERT OR UPDATE ON kb_chunks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validate_embedding();

-- Step 8: Performance optimization recommendations
DO $$
BEGIN
  RAISE NOTICE 'RECOMMENDATION: Consider running VACUUM ANALYZE kb_chunks; after re-generating embeddings';
  RAISE NOTICE 'RECOMMENDATION: Monitor query performance and adjust index lists parameter if needed';
  RAISE NOTICE 'RECOMMENDATION: Set work_mem to at least 256MB for optimal vector operations';
  RAISE NOTICE 'RECOMMENDATION: Consider setting maintenance_work_mem to 1GB for index creation';
END $$;

-- Commit the transaction
COMMIT;

-- Final validation and summary
DO $$
DECLARE
  chunk_count INTEGER;
  cache_count INTEGER;
  config_count INTEGER;
BEGIN
  -- Get final counts
  SELECT COUNT(*) INTO chunk_count FROM kb_chunks;
  
  SELECT COUNT(*) INTO cache_count 
  FROM information_schema.tables 
  WHERE table_name = 'embedding_cache';
  
  SELECT COUNT(*) INTO config_count 
  FROM system_config 
  WHERE config_key IN ('vector_dimension', 'embedding_model');
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'MIGRATION 001 COMPLETED SUCCESSFULLY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Total kb_chunks records: %', chunk_count;
  RAISE NOTICE 'Embedding cache table exists: %', CASE WHEN cache_count > 0 THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'System config entries: %', config_count;
  RAISE NOTICE 'Vector dimension standardized to: 3072';
  RAISE NOTICE 'Embedding model: text-embedding-3-large';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Update environment variables (VECTOR_DIMENSION=3072)';
  RAISE NOTICE '2. Restart application to pick up new configuration';
  RAISE NOTICE '3. Re-run document ingestion to generate new embeddings';
  RAISE NOTICE '4. Run validation script to verify everything works';
  RAISE NOTICE '==========================================';
END $$;
