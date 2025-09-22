-- Install pgvector extension
-- Run this with: psql -h localhost -U postgres -d fund_chatbot -f scripts/install-pgvector.sql

-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Test vector functionality
SELECT vector_dims('[1,2,3]'::vector) as test_dims;
