/**
 * COMPREHENSIVE RETRIEVAL DIAGNOSTIC SCRIPT
 * 
 * Purpose: Isolate and identify the exact root cause of 0 chunks retrieval
 * Approach: Test each component in isolation with verbose debugging
 * No shortcuts - thorough analysis at each layer
 */

const { Pool } = require('pg');
const { getConfig } = require('../config/environment');

// Enable comprehensive debugging
const DEBUG_MODE = true;

class DiagnosticLogger {
  static log(component, action, data, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${component}] ${action}:`;
    
    if (typeof data === 'object') {
      console.log(prefix, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, data);
    }
  }

  static error(component, action, error) {
    this.log(component, action, {
      message: error.message,
      stack: error.stack,
      code: error.code
    }, 'ERROR');
  }

  static success(component, action, data) {
    this.log(component, action, data, 'SUCCESS');
  }

  static warn(component, action, data) {
    this.log(component, action, data, 'WARN');
  }
}

class ComprehensiveRetrievalDiagnostic {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.testQuery = "how to create a fund";
    this.results = {
      databaseConnection: null,
      schemaValidation: null,
      dataIntegrity: null,
      embeddingGeneration: null,
      vectorRetrieval: null,
      ragService: null,
      overallStatus: null
    };
  }

  /**
   * PHASE 1: Database Connection & Schema Validation
   */
  async testDatabaseConnection() {
    DiagnosticLogger.log('DATABASE', 'Starting connection test', { testQuery: this.testQuery });
    
    try {
      this.db = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'chatbot_production',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
      });

      // Test basic connection
      const connectionTest = await this.db.query('SELECT NOW() as current_time, version() as pg_version');
      DiagnosticLogger.success('DATABASE', 'Connection established', {
        currentTime: connectionTest.rows[0].current_time,
        pgVersion: connectionTest.rows[0].pg_version.substring(0, 50)
      });

      // Test vector extension
      const vectorTest = await this.db.query('SELECT * FROM pg_extension WHERE extname = \'vector\'');
      if (vectorTest.rows.length === 0) {
        throw new Error('Vector extension not installed');
      }
      DiagnosticLogger.success('DATABASE', 'Vector extension verified', vectorTest.rows[0]);

      this.results.databaseConnection = { status: 'SUCCESS', details: 'Connection and vector extension verified' };
      return true;

    } catch (error) {
      DiagnosticLogger.error('DATABASE', 'Connection failed', error);
      this.results.databaseConnection = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * PHASE 2: Schema Validation - Verify table structure
   */
  async testSchemaValidation() {
    DiagnosticLogger.log('SCHEMA', 'Starting schema validation', {});
    
    try {
      // Check kb_chunks table exists
      const tableCheck = await this.db.query(`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'kb_chunks'
        ORDER BY ordinal_position
      `);

      if (tableCheck.rows.length === 0) {
        throw new Error('kb_chunks table does not exist');
      }

      DiagnosticLogger.success('SCHEMA', 'kb_chunks table structure', {
        totalColumns: tableCheck.rows.length,
        columns: tableCheck.rows.map(row => ({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable
        }))
      });

      // Specifically check for embedding column
      const embeddingColumn = tableCheck.rows.find(row => row.column_name === 'embedding');
      if (!embeddingColumn) {
        throw new Error('embedding column does not exist');
      }

      DiagnosticLogger.success('SCHEMA', 'Embedding column verified', {
        columnName: embeddingColumn.column_name,
        dataType: embeddingColumn.data_type
      });

      this.results.schemaValidation = { status: 'SUCCESS', details: 'All required columns exist' };
      return true;

    } catch (error) {
      DiagnosticLogger.error('SCHEMA', 'Validation failed', error);
      this.results.schemaValidation = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * PHASE 3: Data Integrity - Verify chunks and embeddings exist
   */
  async testDataIntegrity() {
    DiagnosticLogger.log('DATA', 'Starting data integrity check', {});
    
    try {
      // Check total chunks
      const totalChunks = await this.db.query('SELECT COUNT(*) as total FROM kb_chunks');
      const chunkCount = parseInt(totalChunks.rows[0].total);
      
      if (chunkCount === 0) {
        throw new Error('No chunks found in database');
      }

      DiagnosticLogger.success('DATA', 'Chunk count verified', { totalChunks: chunkCount });

      // Check embeddings
      const embeddingCheck = await this.db.query(`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(embedding) as chunks_with_embeddings,
          COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as non_null_embeddings
        FROM kb_chunks
      `);

      const embeddingStats = embeddingCheck.rows[0];
      DiagnosticLogger.success('DATA', 'Embedding statistics', {
        totalChunks: parseInt(embeddingStats.total_chunks),
        chunksWithEmbeddings: parseInt(embeddingStats.chunks_with_embeddings),
        nonNullEmbeddings: parseInt(embeddingStats.non_null_embeddings)
      });

      if (parseInt(embeddingStats.chunks_with_embeddings) === 0) {
        throw new Error('No chunks have embeddings');
      }

      // Check for fund-related content
      const fundContentCheck = await this.db.query(`
        SELECT 
          chunk_id,
          SUBSTRING(content, 1, 100) as content_preview,
          LENGTH(content) as content_length
        FROM kb_chunks 
        WHERE content ILIKE '%fund creation%' 
           OR content ILIKE '%create fund%'
           OR content ILIKE '%Creating a Fund%'
        ORDER BY content_length DESC
        LIMIT 5
      `);

      DiagnosticLogger.success('DATA', 'Fund-related content found', {
        matchingChunks: fundContentCheck.rows.length,
        samples: fundContentCheck.rows.map(row => ({
          chunkId: row.chunk_id,
          contentLength: row.content_length,
          preview: row.content_preview
        }))
      });

      this.results.dataIntegrity = { 
        status: 'SUCCESS', 
        details: {
          totalChunks: chunkCount,
          chunksWithEmbeddings: parseInt(embeddingStats.chunks_with_embeddings),
          fundRelatedChunks: fundContentCheck.rows.length
        }
      };
      return true;

    } catch (error) {
      DiagnosticLogger.error('DATA', 'Integrity check failed', error);
      this.results.dataIntegrity = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * PHASE 4: OpenAI Embedding Generation Test
   */
  async testEmbeddingGeneration() {
    DiagnosticLogger.log('EMBEDDING', 'Starting embedding generation test', { query: this.testQuery });
    
    try {
      const OpenAI = require('openai');
      
      // Check API key
      const apiKey = this.config.get('openai.apiKey');
      if (!apiKey || apiKey === 'placeholder' || apiKey.length < 10) {
        throw new Error('OpenAI API key not configured or invalid');
      }

      DiagnosticLogger.log('EMBEDDING', 'API key validated', { 
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 7) + '...'
      });

      const openai = new OpenAI({
        apiKey: apiKey,
        organization: this.config.get('openai.organization'),
        timeout: this.config.get('openai.requestTimeout') || 30000
      });

      const embeddingModel = this.config.get('openai.embeddingModel') || 'text-embedding-3-large';
      DiagnosticLogger.log('EMBEDDING', 'Generating embedding', { 
        model: embeddingModel,
        query: this.testQuery
      });

      const startTime = Date.now();
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: this.testQuery,
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;
      const generationTime = Date.now() - startTime;

      DiagnosticLogger.success('EMBEDDING', 'Generation successful', {
        embeddingLength: embedding.length,
        generationTime: generationTime,
        sampleValues: embedding.slice(0, 5),
        usage: response.usage
      });

      // Validate embedding format
      if (!Array.isArray(embedding)) {
        throw new Error('Embedding is not an array');
      }

      if (embedding.length === 0) {
        throw new Error('Embedding is empty');
      }

      if (embedding.some(val => !isFinite(val))) {
        throw new Error('Embedding contains invalid values');
      }

      this.results.embeddingGeneration = { 
        status: 'SUCCESS', 
        details: {
          embeddingLength: embedding.length,
          generationTime: generationTime,
          model: embeddingModel
        },
        embedding: embedding // Store for next phase
      };
      return true;

    } catch (error) {
      DiagnosticLogger.error('EMBEDDING', 'Generation failed', error);
      this.results.embeddingGeneration = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * PHASE 5: Direct Vector Database Query Test
   */
  async testVectorRetrieval() {
    DiagnosticLogger.log('VECTOR', 'Starting direct vector retrieval test', {});
    
    try {
      if (!this.results.embeddingGeneration || !this.results.embeddingGeneration.embedding) {
        throw new Error('No embedding available from previous phase');
      }

      const queryEmbedding = this.results.embeddingGeneration.embedding;
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      DiagnosticLogger.log('VECTOR', 'Executing vector similarity query', {
        embeddingLength: queryEmbedding.length,
        similarityMetric: 'cosine',
        topK: 10
      });

      // Test the exact query that VectorRetriever uses
      const vectorQuery = `
        WITH vector_results AS (
          SELECT
            c.id,
            c.chunk_id,
            c.source_id,
            c.version,
            c.chunk_index,
            c.content,
            c.heading,
            c.subheading,
            c.page_number,
            c.content_type,
            c.token_count,
            c.character_count,
            c.word_count,
            c.quality_score,
            c.language,
            c.metadata,
            c.created_at,
            c.embedding,
            s.filename,
            s.title as source_title,
            s.author,
            -- Calculate similarity score based on metric
            CASE 
              WHEN $2 = 'cosine' THEN 1 - (c.embedding <=> $1::vector)
              WHEN $2 = 'euclidean' THEN 1 / (1 + (c.embedding <-> $1::vector))
              WHEN $2 = 'dot_product' THEN c.embedding <#> $1::vector
              ELSE 1 - (c.embedding <=> $1::vector)
            END as similarity_score
          FROM kb_chunks c
          JOIN kb_sources s ON c.source_id = s.source_id
          WHERE c.embedding IS NOT NULL
            AND s.processing_status = 'completed'
          ORDER BY 
            CASE 
              WHEN $2 = 'cosine' THEN c.embedding <=> $1::vector
              WHEN $2 = 'euclidean' THEN c.embedding <-> $1::vector  
              WHEN $2 = 'dot_product' THEN c.embedding <#> $1::vector
              ELSE c.embedding <=> $1::vector
            END
          LIMIT $3
        )
        SELECT * FROM vector_results
        WHERE similarity_score > 0.1
        ORDER BY similarity_score DESC;
      `;

      const startTime = Date.now();
      const result = await this.db.query(vectorQuery, [embeddingStr, 'cosine', 10]);
      const queryTime = Date.now() - startTime;

      DiagnosticLogger.success('VECTOR', 'Query executed successfully', {
        queryTime: queryTime,
        totalResults: result.rows.length,
        topSimilarityScores: result.rows.slice(0, 3).map(row => ({
          chunkId: row.chunk_id,
          similarityScore: row.similarity_score,
          contentPreview: row.content.substring(0, 100)
        }))
      });

      if (result.rows.length === 0) {
        DiagnosticLogger.warn('VECTOR', 'No results returned', {
          possibleCauses: [
            'Similarity threshold too high',
            'Embedding mismatch',
            'No completed sources',
            'Vector calculation error'
          ]
        });

        // Test with lower threshold
        const lowThresholdQuery = vectorQuery.replace('WHERE similarity_score > 0.1', 'WHERE similarity_score > 0.01');
        const lowThresholdResult = await this.db.query(lowThresholdQuery, [embeddingStr, 'cosine', 10]);
        
        DiagnosticLogger.log('VECTOR', 'Low threshold test', {
          resultsWithLowThreshold: lowThresholdResult.rows.length
        });
      }

      this.results.vectorRetrieval = { 
        status: result.rows.length > 0 ? 'SUCCESS' : 'PARTIAL',
        details: {
          queryTime: queryTime,
          totalResults: result.rows.length,
          topResults: result.rows.slice(0, 3).map(row => ({
            chunkId: row.chunk_id,
            similarityScore: row.similarity_score,
            heading: row.heading,
            contentLength: row.content.length
          }))
        }
      };
      return result.rows.length > 0;

    } catch (error) {
      DiagnosticLogger.error('VECTOR', 'Retrieval test failed', error);
      this.results.vectorRetrieval = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * PHASE 6: VectorRetriever Class Test
   */
  async testVectorRetrieverClass() {
    DiagnosticLogger.log('VECTORRETRIEVER', 'Starting VectorRetriever class test', {});
    
    try {
      const VectorRetriever = require('../knowledge/retrieval/VectorRetriever');
      const vectorRetriever = new VectorRetriever();

      DiagnosticLogger.log('VECTORRETRIEVER', 'Initializing VectorRetriever', {});
      await vectorRetriever.initialize();

      DiagnosticLogger.log('VECTORRETRIEVER', 'Calling retrieveRelevantChunks', {
        query: this.testQuery,
        options: { topK: 5, similarityThreshold: 0.1 }
      });

      const startTime = Date.now();
      const chunks = await vectorRetriever.retrieveRelevantChunks(this.testQuery, {
        topK: 5,
        similarityThreshold: 0.1,
        enableReranking: false,
        enableHybridSearch: false
      });
      const retrievalTime = Date.now() - startTime;

      DiagnosticLogger.success('VECTORRETRIEVER', 'Retrieval completed', {
        retrievalTime: retrievalTime,
        chunksRetrieved: chunks.length,
        chunks: chunks.map(chunk => ({
          chunkId: chunk.chunk_id,
          similarityScore: chunk.similarity_score,
          heading: chunk.heading,
          contentLength: chunk.content?.length || 0
        }))
      });

      this.results.vectorRetrieverClass = {
        status: chunks.length > 0 ? 'SUCCESS' : 'FAILED',
        details: {
          retrievalTime: retrievalTime,
          chunksRetrieved: chunks.length
        }
      };

      return chunks.length > 0;

    } catch (error) {
      DiagnosticLogger.error('VECTORRETRIEVER', 'Class test failed', error);
      this.results.vectorRetrieverClass = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * PHASE 7: RAG Service Integration Test
   */
  async testRAGServiceIntegration() {
    DiagnosticLogger.log('RAGSERVICE', 'Starting RAG service integration test', {});
    
    try {
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      
      DiagnosticLogger.log('RAGSERVICE', 'Making API request', {
        endpoint: 'http://localhost:5000/api/chat/message',
        query: this.testQuery
      });

      const response = await fetch('http://localhost:5000/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: this.testQuery,
          sessionId: "diagnostic_test_session"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      DiagnosticLogger.success('RAGSERVICE', 'API response received', {
        statusCode: response.status,
        chunksRetrieved: result.retrievedChunks?.length || 0,
        processingTime: result.processingTime,
        responseLength: result.message?.length || 0
      });

      this.results.ragService = {
        status: result.retrievedChunks?.length > 0 ? 'SUCCESS' : 'FAILED',
        details: {
          chunksRetrieved: result.retrievedChunks?.length || 0,
          processingTime: result.processingTime,
          responseLength: result.message?.length || 0
        }
      };

      return result.retrievedChunks?.length > 0;

    } catch (error) {
      DiagnosticLogger.error('RAGSERVICE', 'Integration test failed', error);
      this.results.ragService = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  /**
   * Execute comprehensive diagnostic
   */
  async runComprehensiveDiagnostic() {
    console.log('\n🔍 STARTING COMPREHENSIVE RETRIEVAL DIAGNOSTIC');
    console.log('=' .repeat(80));
    
    const phases = [
      { name: 'Database Connection', method: 'testDatabaseConnection' },
      { name: 'Schema Validation', method: 'testSchemaValidation' },
      { name: 'Data Integrity', method: 'testDataIntegrity' },
      { name: 'Embedding Generation', method: 'testEmbeddingGeneration' },
      { name: 'Vector Retrieval', method: 'testVectorRetrieval' },
      { name: 'VectorRetriever Class', method: 'testVectorRetrieverClass' },
      { name: 'RAG Service Integration', method: 'testRAGServiceIntegration' }
    ];

    let overallSuccess = true;

    for (const phase of phases) {
      console.log(`\n📋 PHASE: ${phase.name}`);
      console.log('-'.repeat(40));
      
      try {
        const success = await this[phase.method]();
        if (!success) {
          overallSuccess = false;
          console.log(`❌ PHASE FAILED: ${phase.name}`);
        } else {
          console.log(`✅ PHASE PASSED: ${phase.name}`);
        }
      } catch (error) {
        overallSuccess = false;
        DiagnosticLogger.error('DIAGNOSTIC', `Phase ${phase.name} crashed`, error);
        console.log(`💥 PHASE CRASHED: ${phase.name}`);
      }
    }

    // Generate final report
    this.results.overallStatus = overallSuccess ? 'SUCCESS' : 'FAILED';
    this.generateFinalReport();

    if (this.db) {
      await this.db.end();
    }

    return overallSuccess;
  }

  /**
   * Generate comprehensive final report
   */
  generateFinalReport() {
    console.log('\n📊 COMPREHENSIVE DIAGNOSTIC REPORT');
    console.log('=' .repeat(80));

    Object.entries(this.results).forEach(([phase, result]) => {
      if (result) {
        const status = result.status === 'SUCCESS' ? '✅' : 
                      result.status === 'PARTIAL' ? '⚠️' : '❌';
        console.log(`${status} ${phase.toUpperCase()}: ${result.status}`);
        
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        
        if (result.details) {
          console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      }
    });

    console.log('\n🎯 ROOT CAUSE ANALYSIS:');
    
    // Analyze failure pattern
    const failedPhases = Object.entries(this.results)
      .filter(([_, result]) => result && result.status === 'FAILED')
      .map(([phase, _]) => phase);

    if (failedPhases.length === 0) {
      console.log('✅ All phases passed - system should be working');
    } else {
      console.log(`❌ Failed phases: ${failedPhases.join(', ')}`);
      
      if (failedPhases.includes('databaseConnection')) {
        console.log('🔍 ROOT CAUSE: Database connectivity issue');
      } else if (failedPhases.includes('embeddingGeneration')) {
        console.log('🔍 ROOT CAUSE: OpenAI API configuration issue');
      } else if (failedPhases.includes('vectorRetrieval')) {
        console.log('🔍 ROOT CAUSE: Vector similarity calculation issue');
      } else if (failedPhases.includes('vectorRetrieverClass')) {
        console.log('🔍 ROOT CAUSE: VectorRetriever class implementation issue');
      } else if (failedPhases.includes('ragService')) {
        console.log('🔍 ROOT CAUSE: RAG service integration issue');
      }
    }

    console.log('\n📋 RECOMMENDED NEXT STEPS:');
    failedPhases.forEach(phase => {
      console.log(`- Fix ${phase} before proceeding to next phase`);
    });
  }
}

// Execute diagnostic if run directly
if (require.main === module) {
  const diagnostic = new ComprehensiveRetrievalDiagnostic();
  diagnostic.runComprehensiveDiagnostic()
    .then(success => {
      console.log(`\n🏁 DIAGNOSTIC COMPLETE: ${success ? 'SUCCESS' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 DIAGNOSTIC CRASHED:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveRetrievalDiagnostic;
