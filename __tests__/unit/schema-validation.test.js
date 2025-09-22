/**
 * Schema-Code Alignment Tests
 * Critical Issue #2 - Verify all database queries use correct field names
 */

const fs = require('fs');
const path = require('path');

describe('Schema-Code Alignment', () => {
  let schemaContent;

  beforeAll(() => {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    schemaContent = fs.readFileSync(schemaPath, 'utf8');
  });

  describe('CRITICAL: Field Name Consistency', () => {
    test('kb_sources table should have all required fields', () => {
      // Extract kb_sources table definition
      const sourcesTableMatch = schemaContent.match(
        /CREATE TABLE kb_sources \(([\s\S]*?)\);/
      );
      
      expect(sourcesTableMatch).toBeTruthy();
      const sourcesTable = sourcesTableMatch[1];

      // Verify critical fields exist
      const requiredFields = [
        'source_id',
        'filename',
        'title',           // Used in VectorRetriever.js
        'author',
        'processing_status'
      ];

      requiredFields.forEach(field => {
        expect(sourcesTable).toMatch(new RegExp(`\\b${field}\\b`));
      });
    });

    test('kb_chunks table should have all required fields', () => {
      // Extract kb_chunks table definition
      const chunksTableMatch = schemaContent.match(
        /CREATE TABLE kb_chunks \(([\s\S]*?)\);/
      );
      
      expect(chunksTableMatch).toBeTruthy();
      const chunksTable = chunksTableMatch[1];

      // Verify critical fields exist
      const requiredFields = [
        'chunk_id',        // Used throughout RAG system
        'source_id',
        'content',
        'embedding',       // Critical for vector search
        'page_number',     // Used in citations
        'quality_score',   // Used in confidence calculation
        'token_count',
        'similarity_score' // This is computed, not stored
      ];

      // Check stored fields (similarity_score is computed)
      const storedFields = requiredFields.filter(f => f !== 'similarity_score');
      storedFields.forEach(field => {
        expect(chunksTable).toMatch(new RegExp(`\\b${field}\\b`));
      });
    });

    test('vector dimension should match configuration', () => {
      // Check vector dimension in schema
      const vectorMatch = schemaContent.match(/embedding vector\((\d+)\)/);
      expect(vectorMatch).toBeTruthy();
      
      const schemaDimension = parseInt(vectorMatch[1]);
      expect(schemaDimension).toBe(3072); // OpenAI text-embedding-3-large dimension
    });
  });

  describe('CRITICAL: Query Field References', () => {
    test('VectorRetriever queries should use correct field names', () => {
      const VectorRetriever = require('../../knowledge/retrieval/VectorRetriever');
      const retrieverCode = fs.readFileSync(
        path.join(__dirname, '../../knowledge/retrieval/VectorRetriever.js'),
        'utf8'
      );

      // Check that queries reference existing fields
      const queryFields = [
        's.title as source_title',  // Should work - title exists
        'c.chunk_id',              // Should work - chunk_id exists
        'c.page_number',           // Should work - page_number exists
        'c.quality_score',         // Should work - quality_score exists
        'c.embedding_json'         // Should work - embedding_json exists
      ];

      queryFields.forEach(field => {
        expect(retrieverCode).toContain(field);
      });
    });

    test('Citation structure should match chunk data structure', () => {
      const RAGChatService = require('../../services/RAGChatService');
      const ragCode = fs.readFileSync(
        path.join(__dirname, '../../services/RAGChatService.js'),
        'utf8'
      );

      // Check citation field access patterns
      const citationPatterns = [
        'chunk.citation?.source',   // Safe optional chaining
        'chunk.citation?.page',     // Safe optional chaining
        'chunk.page_number',        // Direct field access
        'chunk.chunk_id'            // Direct field access
      ];

      citationPatterns.forEach(pattern => {
        expect(ragCode).toContain(pattern);
      });
    });
  });

  describe('Data Type Consistency', () => {
    test('UUID fields should be handled correctly', () => {
      // chunk_id is UUID in schema
      const chunksTableMatch = schemaContent.match(
        /chunk_id UUID DEFAULT uuid_generate_v4\(\)/
      );
      expect(chunksTableMatch).toBeTruthy();
    });

    test('JSONB fields should be handled correctly', () => {
      // metadata is JSONB in schema
      const metadataMatch = schemaContent.match(/metadata JSONB/);
      expect(metadataMatch).toBeTruthy();
    });

    test('vector fields should have correct dimension', () => {
      // embedding should be vector(3072)
      const vectorMatch = schemaContent.match(/embedding vector\(3072\)/);
      expect(vectorMatch).toBeTruthy();
    });
  });

  describe('Index Alignment', () => {
    test('vector indexes should exist for similarity search', () => {
      const vectorIndexes = [
        'idx_kb_chunks_embedding',
        'idx_kb_chunks_embedding_l2'
      ];

      vectorIndexes.forEach(indexName => {
        expect(schemaContent).toMatch(new RegExp(`CREATE INDEX.*${indexName}`));
      });
    });

    test('foreign key relationships should be properly indexed', () => {
      const foreignKeyIndexes = [
        'idx_kb_chunks_source_id',
        'idx_conversations_session'
      ];

      foreignKeyIndexes.forEach(indexName => {
        expect(schemaContent).toMatch(new RegExp(`CREATE INDEX.*${indexName}`));
      });
    });
  });

  describe('CRITICAL: Constraint Validation', () => {
    test('required constraints should exist', () => {
      const constraints = [
        'valid_chunk_index',
        'valid_page_number', 
        'valid_token_count',
        'valid_quality_score'
      ];

      constraints.forEach(constraint => {
        expect(schemaContent).toMatch(new RegExp(`CONSTRAINT ${constraint}`));
      });
    });

    test('foreign key constraints should exist', () => {
      // Check that kb_chunks references kb_sources
      expect(schemaContent).toMatch(
        /source_id.*REFERENCES kb_sources\(source_id\)/
      );
    });
  });
});
