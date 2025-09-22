#!/usr/bin/env node

/**
 * Phase 4 Performance Optimization Script
 * 
 * Comprehensive database performance optimization for the new hierarchical schema
 * 
 * Features:
 * - Advanced indexing strategies
 * - Query optimization
 * - Statistics collection and analysis
 * - Performance monitoring
 * - Automated tuning recommendations
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../config/database');

class Phase4PerformanceOptimizer {
  constructor() {
    this.db = null;
    this.optimizationId = `phase4-perf-${Date.now()}`;
    this.performanceMetrics = {
      beforeOptimization: {},
      afterOptimization: {},
      improvements: {},
      recommendations: []
    };
    
    this.optimizationConfig = {
      enableAdvancedIndexing: true,
      enableStatisticsUpdate: true,
      enableQueryOptimization: true,
      enableVacuumAnalyze: true,
      enablePartitioning: false, // Advanced feature for large datasets
      enableConnectionPooling: true,
      enableQueryPlanAnalysis: true
    };
  }

  async initialize() {
    logger.info('🚀 Initializing Phase 4 Performance Optimization');
    
    try {
      this.db = getDatabase();
      
      // Validate database connection
      await this.db.query('SELECT 1');
      logger.info('✅ Database connection established');
      
      // Collect baseline performance metrics
      await this.collectBaselineMetrics();
      
      logger.info('📊 Baseline performance metrics collected');
      
    } catch (error) {
      logger.error('❌ Failed to initialize performance optimization:', error);
      throw error;
    }
  }

  async executeOptimization() {
    const startTime = Date.now();
    logger.info('🔧 Starting Phase 4 performance optimization');
    
    try {
      // Step 1: Advanced indexing optimization
      if (this.optimizationConfig.enableAdvancedIndexing) {
        await this.optimizeIndexes();
      }
      
      // Step 2: Update table statistics
      if (this.optimizationConfig.enableStatisticsUpdate) {
        await this.updateTableStatistics();
      }
      
      // Step 3: Query optimization
      if (this.optimizationConfig.enableQueryOptimization) {
        await this.optimizeQueries();
      }
      
      // Step 4: Vacuum and analyze
      if (this.optimizationConfig.enableVacuumAnalyze) {
        await this.performVacuumAnalyze();
      }
      
      // Step 5: Connection pool optimization
      if (this.optimizationConfig.enableConnectionPooling) {
        await this.optimizeConnectionPool();
      }
      
      // Step 6: Query plan analysis
      if (this.optimizationConfig.enableQueryPlanAnalysis) {
        await this.analyzeQueryPlans();
      }
      
      // Step 7: Collect post-optimization metrics
      await this.collectPostOptimizationMetrics();
      
      // Step 8: Generate performance report
      await this.generatePerformanceReport();
      
      const optimizationTime = Date.now() - startTime;
      logger.info(`✅ Performance optimization completed in ${optimizationTime}ms`);
      
    } catch (error) {
      logger.error('❌ Performance optimization failed:', error);
      throw error;
    }
  }

  async collectBaselineMetrics() {
    logger.info('📊 Collecting baseline performance metrics');
    
    try {
      // Table sizes and row counts
      const tableSizes = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          most_common_vals,
          most_common_freqs,
          histogram_bounds
        FROM pg_stats 
        WHERE schemaname = 'public' 
        AND tablename IN ('kb_chunks', 'documents', 'chunk_relationships', 'embedding_quality_metrics')
      `);
      
      // Index usage statistics
      const indexStats = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);
      
      // Table access statistics
      const tableStats = await this.db.query(`
        SELECT 
          schemaname,
          relname,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_tup_hot_upd,
          n_live_tup,
          n_dead_tup,
          vacuum_count,
          autovacuum_count,
          analyze_count,
          autoanalyze_count
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
      `);
      
      // Query performance for common operations
      const queryPerformance = await this.measureQueryPerformance();
      
      this.performanceMetrics.beforeOptimization = {
        tableSizes: tableSizes.rows,
        indexStats: indexStats.rows,
        tableStats: tableStats.rows,
        queryPerformance,
        timestamp: new Date().toISOString()
      };
      
      logger.info('✅ Baseline metrics collected');
      
    } catch (error) {
      logger.error('❌ Failed to collect baseline metrics:', error);
      throw error;
    }
  }

  async measureQueryPerformance() {
    const queries = [
      {
        name: 'hierarchical_chunk_retrieval',
        query: `
          SELECT c.*, p.content as parent_content
          FROM kb_chunks c
          LEFT JOIN kb_chunks p ON c.parent_chunk_id = p.chunk_id
          WHERE c.document_id = $1
          ORDER BY c.sequence_order
          LIMIT 10
        `,
        params: ['test-doc-id']
      },
      {
        name: 'quality_based_search',
        query: `
          SELECT chunk_id, content, quality_score, coherence_score
          FROM kb_chunks
          WHERE quality_score > $1
          ORDER BY quality_score DESC
          LIMIT 20
        `,
        params: [0.7]
      },
      {
        name: 'embedding_similarity_search',
        query: `
          SELECT chunk_id, content, (content_embedding <=> $1::vector) as similarity
          FROM kb_chunks
          WHERE content_embedding IS NOT NULL
          ORDER BY content_embedding <=> $1::vector
          LIMIT 10
        `,
        params: [Array(3072).fill(0.1)] // Dummy embedding
      },
      {
        name: 'relationship_traversal',
        query: `
          SELECT cr.*, c1.content as source_content, c2.content as target_content
          FROM chunk_relationships cr
          JOIN kb_chunks c1 ON cr.source_chunk_id = c1.chunk_id
          JOIN kb_chunks c2 ON cr.target_chunk_id = c2.chunk_id
          WHERE cr.relationship_type = $1
          LIMIT 15
        `,
        params: ['parent']
      }
    ];
    
    const results = {};
    
    for (const queryTest of queries) {
      try {
        const startTime = Date.now();
        await this.db.query(queryTest.query, queryTest.params);
        const executionTime = Date.now() - startTime;
        
        results[queryTest.name] = {
          executionTime,
          query: queryTest.query,
          params: queryTest.params
        };
        
      } catch (error) {
        logger.warn(`⚠️ Query performance test failed for ${queryTest.name}:`, error.message);
        results[queryTest.name] = {
          executionTime: -1,
          error: error.message
        };
      }
    }
    
    return results;
  }

  async optimizeIndexes() {
    logger.info('🔍 Optimizing database indexes');
    
    try {
      // Analyze index usage and create missing indexes
      const missingIndexes = await this.identifyMissingIndexes();
      
      for (const indexDef of missingIndexes) {
        try {
          logger.info(`Creating index: ${indexDef.name}`);
          await this.db.query(indexDef.sql);
          logger.info(`✅ Created index: ${indexDef.name}`);
        } catch (error) {
          logger.warn(`⚠️ Failed to create index ${indexDef.name}:`, error.message);
        }
      }
      
      // Optimize existing indexes
      await this.optimizeExistingIndexes();
      
      // Remove unused indexes
      await this.removeUnusedIndexes();
      
      logger.info('✅ Index optimization completed');
      
    } catch (error) {
      logger.error('❌ Index optimization failed:', error);
      throw error;
    }
  }

  async identifyMissingIndexes() {
    const missingIndexes = [];
    
    // Analyze query patterns and suggest indexes
    const queryAnalysis = await this.db.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public' 
      AND tablename IN ('kb_chunks', 'documents', 'chunk_relationships')
      AND n_distinct > 100
      ORDER BY n_distinct DESC
    `);
    
    // Composite indexes for common query patterns
    missingIndexes.push(
      {
        name: 'idx_chunks_document_quality_composite',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_document_quality_composite 
              ON kb_chunks(document_id, quality_score DESC, sequence_order) 
              WHERE quality_score > 0.5`
      },
      {
        name: 'idx_chunks_hierarchy_composite',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_hierarchy_composite 
              ON kb_chunks(parent_chunk_id, hierarchy_level, sequence_order) 
              WHERE parent_chunk_id IS NOT NULL`
      },
      {
        name: 'idx_chunks_embedding_quality_composite',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_embedding_quality_composite 
              ON kb_chunks(quality_score, coherence_score) 
              WHERE content_embedding IS NOT NULL AND quality_score > 0.6`
      },
      {
        name: 'idx_relationships_type_strength_composite',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_type_strength_composite 
              ON chunk_relationships(relationship_type, relationship_strength DESC, source_chunk_id)`
      },
      {
        name: 'idx_quality_metrics_composite',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_composite 
              ON embedding_quality_metrics(embedding_type, quality_score DESC, validation_status)`
      }
    );
    
    // Partial indexes for specific use cases
    missingIndexes.push(
      {
        name: 'idx_chunks_high_quality_partial',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_high_quality_partial 
              ON kb_chunks(document_id, sequence_order) 
              WHERE quality_score > 0.8 AND coherence_score > 0.7`
      },
      {
        name: 'idx_chunks_recent_partial',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_recent_partial 
              ON kb_chunks(created_at DESC, document_id) 
              WHERE created_at > NOW() - INTERVAL '30 days'`
      }
    );
    
    // Expression indexes for computed values
    missingIndexes.push(
      {
        name: 'idx_chunks_content_length_expr',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_content_length_expr 
              ON kb_chunks(LENGTH(content)) 
              WHERE LENGTH(content) > 100`
      },
      {
        name: 'idx_chunks_token_density_expr',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_token_density_expr 
              ON kb_chunks((token_count::float / GREATEST(LENGTH(content), 1))) 
              WHERE token_count > 0 AND LENGTH(content) > 0`
      }
    );
    
    return missingIndexes;
  }

  async optimizeExistingIndexes() {
    logger.info('🔧 Optimizing existing indexes');
    
    try {
      // Reindex heavily used indexes
      const heavyIndexes = await this.db.query(`
        SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
        AND idx_scan > 1000
        ORDER BY idx_scan DESC
      `);
      
      for (const index of heavyIndexes.rows) {
        try {
          logger.info(`Reindexing: ${index.indexname}`);
          await this.db.query(`REINDEX INDEX CONCURRENTLY ${index.indexname}`);
          logger.info(`✅ Reindexed: ${index.indexname}`);
        } catch (error) {
          logger.warn(`⚠️ Failed to reindex ${index.indexname}:`, error.message);
        }
      }
      
    } catch (error) {
      logger.warn('⚠️ Existing index optimization had issues:', error);
    }
  }

  async removeUnusedIndexes() {
    logger.info('🗑️ Identifying unused indexes');
    
    try {
      // Find indexes with very low usage
      const unusedIndexes = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
        AND idx_scan < 10
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE '%_unique%'
        ORDER BY idx_scan ASC
      `);
      
      // Log unused indexes but don't drop them automatically
      if (unusedIndexes.rows.length > 0) {
        logger.warn('⚠️ Found potentially unused indexes:');
        for (const index of unusedIndexes.rows) {
          logger.warn(`  - ${index.indexname} (scans: ${index.idx_scan})`);
          this.performanceMetrics.recommendations.push({
            type: 'unused_index',
            index: index.indexname,
            table: index.tablename,
            scans: index.idx_scan,
            recommendation: 'Consider dropping if confirmed unused in production'
          });
        }
      }
      
    } catch (error) {
      logger.warn('⚠️ Unused index analysis failed:', error);
    }
  }

  async updateTableStatistics() {
    logger.info('📈 Updating table statistics');
    
    try {
      const tables = ['kb_chunks', 'documents', 'chunk_relationships', 'embedding_quality_metrics', 'semantic_boundaries'];
      
      for (const table of tables) {
        logger.info(`Analyzing table: ${table}`);
        await this.db.query(`ANALYZE ${table}`);
        logger.info(`✅ Analyzed: ${table}`);
      }
      
      // Update extended statistics for multi-column correlations
      await this.createExtendedStatistics();
      
      logger.info('✅ Table statistics updated');
      
    } catch (error) {
      logger.error('❌ Table statistics update failed:', error);
      throw error;
    }
  }

  async createExtendedStatistics() {
    const extendedStats = [
      {
        name: 'kb_chunks_quality_hierarchy_stats',
        sql: `CREATE STATISTICS IF NOT EXISTS kb_chunks_quality_hierarchy_stats 
              ON quality_score, hierarchy_level, sequence_order 
              FROM kb_chunks`
      },
      {
        name: 'kb_chunks_document_embedding_stats',
        sql: `CREATE STATISTICS IF NOT EXISTS kb_chunks_document_embedding_stats 
              ON document_id, scale_type, processing_pipeline 
              FROM kb_chunks`
      },
      {
        name: 'relationships_type_strength_stats',
        sql: `CREATE STATISTICS IF NOT EXISTS relationships_type_strength_stats 
              ON relationship_type, relationship_strength 
              FROM chunk_relationships`
      }
    ];
    
    for (const stat of extendedStats) {
      try {
        await this.db.query(stat.sql);
        await this.db.query(`ANALYZE`); // Update the new statistics
        logger.info(`✅ Created extended statistics: ${stat.name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to create extended statistics ${stat.name}:`, error.message);
      }
    }
  }

  async optimizeQueries() {
    logger.info('🔍 Optimizing common queries');
    
    try {
      // Create optimized views for common query patterns
      await this.createOptimizedViews();
      
      // Create stored procedures for complex operations
      await this.createOptimizedProcedures();
      
      logger.info('✅ Query optimization completed');
      
    } catch (error) {
      logger.error('❌ Query optimization failed:', error);
      throw error;
    }
  }

  async createOptimizedViews() {
    const optimizedViews = [
      {
        name: 'v_high_quality_chunks_optimized',
        sql: `
          CREATE OR REPLACE VIEW v_high_quality_chunks_optimized AS
          SELECT 
            c.chunk_id,
            c.document_id,
            c.content,
            c.quality_score,
            c.coherence_score,
            c.hierarchy_level,
            c.sequence_order,
            c.parent_chunk_id,
            p.content as parent_content,
            c.token_count,
            c.scale_type,
            CASE 
              WHEN c.content_embedding IS NOT NULL THEN 'content'
              WHEN c.contextual_embedding IS NOT NULL THEN 'contextual'
              WHEN c.hierarchical_embedding IS NOT NULL THEN 'hierarchical'
              WHEN c.semantic_embedding IS NOT NULL THEN 'semantic'
              ELSE 'none'
            END as available_embedding_type,
            c.created_at,
            c.updated_at
          FROM kb_chunks c
          LEFT JOIN kb_chunks p ON c.parent_chunk_id = p.chunk_id
          WHERE c.quality_score > 0.6 
          AND c.coherence_score > 0.5
        `
      },
      {
        name: 'v_document_hierarchy_optimized',
        sql: `
          CREATE OR REPLACE VIEW v_document_hierarchy_optimized AS
          WITH RECURSIVE hierarchy AS (
            -- Root chunks (no parent)
            SELECT 
              chunk_id,
              document_id,
              content,
              hierarchy_level,
              sequence_order,
              parent_chunk_id,
              ARRAY[chunk_id] as hierarchy_path,
              0 as depth
            FROM kb_chunks
            WHERE parent_chunk_id IS NULL
            
            UNION ALL
            
            -- Child chunks
            SELECT 
              c.chunk_id,
              c.document_id,
              c.content,
              c.hierarchy_level,
              c.sequence_order,
              c.parent_chunk_id,
              h.hierarchy_path || c.chunk_id,
              h.depth + 1
            FROM kb_chunks c
            JOIN hierarchy h ON c.parent_chunk_id = h.chunk_id
            WHERE h.depth < 10 -- Prevent infinite recursion
          )
          SELECT * FROM hierarchy
          ORDER BY document_id, hierarchy_level, sequence_order
        `
      },
      {
        name: 'v_embedding_quality_summary_optimized',
        sql: `
          CREATE OR REPLACE VIEW v_embedding_quality_summary_optimized AS
          SELECT 
            c.chunk_id,
            c.document_id,
            c.quality_score as chunk_quality,
            c.coherence_score as chunk_coherence,
            COALESCE(eq_content.quality_score, 0) as content_embedding_quality,
            COALESCE(eq_contextual.quality_score, 0) as contextual_embedding_quality,
            COALESCE(eq_hierarchical.quality_score, 0) as hierarchical_embedding_quality,
            COALESCE(eq_semantic.quality_score, 0) as semantic_embedding_quality,
            (
              COALESCE(c.quality_score, 0) + 
              COALESCE(c.coherence_score, 0) + 
              COALESCE(eq_content.quality_score, 0) + 
              COALESCE(eq_contextual.quality_score, 0) + 
              COALESCE(eq_hierarchical.quality_score, 0) + 
              COALESCE(eq_semantic.quality_score, 0)
            ) / 6.0 as overall_quality_score,
            c.token_count,
            c.hierarchy_level,
            c.scale_type
          FROM kb_chunks c
          LEFT JOIN embedding_quality_metrics eq_content 
            ON c.chunk_id = eq_content.chunk_id AND eq_content.embedding_type = 'content'
          LEFT JOIN embedding_quality_metrics eq_contextual 
            ON c.chunk_id = eq_contextual.chunk_id AND eq_contextual.embedding_type = 'contextual'
          LEFT JOIN embedding_quality_metrics eq_hierarchical 
            ON c.chunk_id = eq_hierarchical.chunk_id AND eq_hierarchical.embedding_type = 'hierarchical'
          LEFT JOIN embedding_quality_metrics eq_semantic 
            ON c.chunk_id = eq_semantic.chunk_id AND eq_semantic.embedding_type = 'semantic'
          WHERE c.quality_score > 0
        `
      }
    ];
    
    for (const view of optimizedViews) {
      try {
        await this.db.query(view.sql);
        logger.info(`✅ Created optimized view: ${view.name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to create view ${view.name}:`, error.message);
      }
    }
  }

  async createOptimizedProcedures() {
    const procedures = [
      {
        name: 'get_chunk_with_context',
        sql: `
          CREATE OR REPLACE FUNCTION get_chunk_with_context(
            chunk_id_param VARCHAR(100),
            context_window INTEGER DEFAULT 2
          )
          RETURNS TABLE (
            chunk_id VARCHAR(100),
            content TEXT,
            quality_score DECIMAL(5,4),
            hierarchy_level INTEGER,
            sequence_order INTEGER,
            context_type VARCHAR(20)
          ) AS $$
          BEGIN
            RETURN QUERY
            WITH target_chunk AS (
              SELECT c.document_id, c.sequence_order, c.hierarchy_level
              FROM kb_chunks c
              WHERE c.chunk_id = chunk_id_param
            )
            SELECT 
              c.chunk_id,
              c.content,
              c.quality_score,
              c.hierarchy_level,
              c.sequence_order,
              CASE 
                WHEN c.chunk_id = chunk_id_param THEN 'target'
                WHEN c.sequence_order < tc.sequence_order THEN 'before'
                ELSE 'after'
              END as context_type
            FROM kb_chunks c
            CROSS JOIN target_chunk tc
            WHERE c.document_id = tc.document_id
            AND c.sequence_order BETWEEN 
              tc.sequence_order - context_window AND 
              tc.sequence_order + context_window
            ORDER BY c.sequence_order;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'find_similar_chunks_optimized',
        sql: `
          CREATE OR REPLACE FUNCTION find_similar_chunks_optimized(
            query_embedding vector(3072),
            embedding_type_param VARCHAR(50) DEFAULT 'content',
            similarity_threshold DECIMAL(3,2) DEFAULT 0.7,
            quality_threshold DECIMAL(3,2) DEFAULT 0.5,
            max_results INTEGER DEFAULT 10
          )
          RETURNS TABLE (
            chunk_id VARCHAR(100),
            similarity_score DECIMAL(5,4),
            quality_score DECIMAL(5,4),
            content TEXT,
            document_id VARCHAR(100),
            hierarchy_level INTEGER
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              c.chunk_id,
              CASE embedding_type_param
                WHEN 'content' THEN (1 - (c.content_embedding <=> query_embedding))::DECIMAL(5,4)
                WHEN 'contextual' THEN (1 - (c.contextual_embedding <=> query_embedding))::DECIMAL(5,4)
                WHEN 'hierarchical' THEN (1 - (c.hierarchical_embedding <=> query_embedding))::DECIMAL(5,4)
                WHEN 'semantic' THEN (1 - (c.semantic_embedding <=> query_embedding))::DECIMAL(5,4)
                ELSE 0.0
              END as similarity_score,
              c.quality_score,
              c.content,
              c.document_id,
              c.hierarchy_level
            FROM kb_chunks c
            WHERE 
              c.quality_score >= quality_threshold
              AND CASE embedding_type_param
                WHEN 'content' THEN c.content_embedding IS NOT NULL AND (1 - (c.content_embedding <=> query_embedding)) >= similarity_threshold
                WHEN 'contextual' THEN c.contextual_embedding IS NOT NULL AND (1 - (c.contextual_embedding <=> query_embedding)) >= similarity_threshold
                WHEN 'hierarchical' THEN c.hierarchical_embedding IS NOT NULL AND (1 - (c.hierarchical_embedding <=> query_embedding)) >= similarity_threshold
                WHEN 'semantic' THEN c.semantic_embedding IS NOT NULL AND (1 - (c.semantic_embedding <=> query_embedding)) >= similarity_threshold
                ELSE false
              END
            ORDER BY similarity_score DESC, c.quality_score DESC
            LIMIT max_results;
          END;
          $$ LANGUAGE plpgsql;
        `
      }
    ];
    
    for (const proc of procedures) {
      try {
        await this.db.query(proc.sql);
        logger.info(`✅ Created optimized procedure: ${proc.name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to create procedure ${proc.name}:`, error.message);
      }
    }
  }

  async performVacuumAnalyze() {
    logger.info('🧹 Performing vacuum and analyze operations');
    
    try {
      const tables = ['kb_chunks', 'documents', 'chunk_relationships', 'embedding_quality_metrics', 'semantic_boundaries'];
      
      for (const table of tables) {
        logger.info(`Vacuuming and analyzing: ${table}`);
        
        // Vacuum to reclaim space and update statistics
        await this.db.query(`VACUUM (ANALYZE, VERBOSE) ${table}`);
        
        logger.info(`✅ Vacuumed and analyzed: ${table}`);
      }
      
      // Full database vacuum for system catalogs
      logger.info('Performing full database maintenance');
      await this.db.query('VACUUM (ANALYZE)');
      
      logger.info('✅ Vacuum and analyze completed');
      
    } catch (error) {
      logger.error('❌ Vacuum and analyze failed:', error);
      throw error;
    }
  }

  async optimizeConnectionPool() {
    logger.info('🔗 Optimizing connection pool settings');
    
    try {
      // Get current connection statistics
      const connectionStats = await this.db.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      
      const stats = connectionStats.rows[0];
      
      // Log current connection pool status
      logger.info('📊 Current connection statistics:', {
        total: parseInt(stats.total_connections),
        active: parseInt(stats.active_connections),
        idle: parseInt(stats.idle_connections),
        idleInTransaction: parseInt(stats.idle_in_transaction)
      });
      
      // Provide recommendations for connection pool optimization
      this.performanceMetrics.recommendations.push({
        type: 'connection_pool',
        currentStats: stats,
        recommendations: [
          'Consider setting max_connections based on workload',
          'Monitor idle connections and set appropriate timeouts',
          'Use connection pooling (PgBouncer) for high-concurrency applications',
          'Set shared_buffers to 25% of available RAM',
          'Configure work_mem based on concurrent query complexity'
        ]
      });
      
      logger.info('✅ Connection pool analysis completed');
      
    } catch (error) {
      logger.warn('⚠️ Connection pool optimization analysis failed:', error);
    }
  }

  async analyzeQueryPlans() {
    logger.info('📋 Analyzing query execution plans');
    
    try {
      const criticalQueries = [
        {
          name: 'hierarchical_retrieval',
          query: `
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT c.*, p.content as parent_content
            FROM kb_chunks c
            LEFT JOIN kb_chunks p ON c.parent_chunk_id = p.chunk_id
            WHERE c.document_id = 'sample-doc'
            AND c.quality_score > 0.6
            ORDER BY c.sequence_order
            LIMIT 20
          `
        },
        {
          name: 'embedding_similarity',
          query: `
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT chunk_id, content, (content_embedding <=> '[${Array(3072).fill(0.1).join(',')}]'::vector) as distance
            FROM kb_chunks
            WHERE content_embedding IS NOT NULL
            AND quality_score > 0.5
            ORDER BY content_embedding <=> '[${Array(3072).fill(0.1).join(',')}]'::vector
            LIMIT 10
          `
        },
        {
          name: 'relationship_traversal',
          query: `
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT cr.*, c1.content as source_content, c2.content as target_content
            FROM chunk_relationships cr
            JOIN kb_chunks c1 ON cr.source_chunk_id = c1.chunk_id
            JOIN kb_chunks c2 ON cr.target_chunk_id = c2.chunk_id
            WHERE cr.relationship_type = 'parent'
            AND cr.relationship_strength > 0.8
            LIMIT 25
          `
        }
      ];
      
      const queryPlans = {};
      
      for (const queryTest of criticalQueries) {
        try {
          const result = await this.db.query(queryTest.query);
          queryPlans[queryTest.name] = {
            plan: result.rows[0]['QUERY PLAN'],
            analysis: this.analyzeExecutionPlan(result.rows[0]['QUERY PLAN'])
          };
          
          logger.info(`✅ Analyzed query plan: ${queryTest.name}`);
          
        } catch (error) {
          logger.warn(`⚠️ Failed to analyze query plan for ${queryTest.name}:`, error.message);
          queryPlans[queryTest.name] = { error: error.message };
        }
      }
      
      this.performanceMetrics.queryPlans = queryPlans;
      
      logger.info('✅ Query plan analysis completed');
      
    } catch (error) {
      logger.warn('⚠️ Query plan analysis failed:', error);
    }
  }

  analyzeExecutionPlan(plan) {
    const analysis = {
      totalCost: 0,
      totalTime: 0,
      indexScans: 0,
      sequentialScans: 0,
      recommendations: []
    };
    
    try {
      if (plan && plan[0]) {
        const rootNode = plan[0];
        analysis.totalCost = rootNode['Total Cost'] || 0;
        analysis.totalTime = rootNode['Actual Total Time'] || 0;
        
        // Recursively analyze plan nodes
        this.analyzePlanNode(rootNode, analysis);
      }
      
    } catch (error) {
      logger.warn('⚠️ Plan analysis error:', error);
    }
    
    return analysis;
  }

  analyzePlanNode(node, analysis) {
    if (!node) return;
    
    // Count scan types
    if (node['Node Type']) {
      if (node['Node Type'].includes('Index Scan')) {
        analysis.indexScans++;
      } else if (node['Node Type'].includes('Seq Scan')) {
        analysis.sequentialScans++;
        analysis.recommendations.push(`Sequential scan detected on ${node['Relation Name'] || 'unknown table'} - consider adding index`);
      }
    }
    
    // Analyze child plans
    if (node['Plans']) {
      for (const childPlan of node['Plans']) {
        this.analyzePlanNode(childPlan, analysis);
      }
    }
  }

  async collectPostOptimizationMetrics() {
    logger.info('📊 Collecting post-optimization performance metrics');
    
    try {
      // Collect the same metrics as baseline for comparison
      const tableSizes = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public' 
        AND tablename IN ('kb_chunks', 'documents', 'chunk_relationships', 'embedding_quality_metrics')
      `);
      
      const indexStats = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);
      
      const tableStats = await this.db.query(`
        SELECT 
          schemaname,
          relname,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_live_tup,
          n_dead_tup
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
      `);
      
      const queryPerformance = await this.measureQueryPerformance();
      
      this.performanceMetrics.afterOptimization = {
        tableSizes: tableSizes.rows,
        indexStats: indexStats.rows,
        tableStats: tableStats.rows,
        queryPerformance,
        timestamp: new Date().toISOString()
      };
      
      // Calculate improvements
      this.calculatePerformanceImprovements();
      
      logger.info('✅ Post-optimization metrics collected');
      
    } catch (error) {
      logger.error('❌ Failed to collect post-optimization metrics:', error);
      throw error;
    }
  }

  calculatePerformanceImprovements() {
    const before = this.performanceMetrics.beforeOptimization.queryPerformance;
    const after = this.performanceMetrics.afterOptimization.queryPerformance;
    
    const improvements = {};
    
    for (const queryName in before) {
      if (after[queryName] && before[queryName].executionTime > 0 && after[queryName].executionTime > 0) {
        const beforeTime = before[queryName].executionTime;
        const afterTime = after[queryName].executionTime;
        const improvement = ((beforeTime - afterTime) / beforeTime) * 100;
        
        improvements[queryName] = {
          beforeTime,
          afterTime,
          improvementPercent: parseFloat(improvement.toFixed(2)),
          status: improvement > 0 ? 'improved' : 'degraded'
        };
      }
    }
    
    this.performanceMetrics.improvements = improvements;
  }

  async generatePerformanceReport() {
    logger.info('📋 Generating performance optimization report');
    
    try {
      const report = {
        optimizationId: this.optimizationId,
        timestamp: new Date().toISOString(),
        summary: {
          totalOptimizations: 0,
          indexesCreated: 0,
          viewsCreated: 0,
          proceduresCreated: 0,
          overallImprovement: 0
        },
        metrics: this.performanceMetrics,
        recommendations: this.performanceMetrics.recommendations
      };
      
      // Calculate summary statistics
      const improvements = Object.values(this.performanceMetrics.improvements || {});
      if (improvements.length > 0) {
        const avgImprovement = improvements.reduce((sum, imp) => sum + imp.improvementPercent, 0) / improvements.length;
        report.summary.overallImprovement = parseFloat(avgImprovement.toFixed(2));
      }
      
      // Save report to file
      const fs = require('fs').promises;
      const reportPath = `reports/phase4-performance-optimization-${this.optimizationId}.json`;
      
      await fs.mkdir('reports', { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`✅ Performance report saved to: ${reportPath}`);
      
      // Log summary
      this.logPerformanceSummary(report);
      
    } catch (error) {
      logger.error('❌ Failed to generate performance report:', error);
      throw error;
    }
  }

  logPerformanceSummary(report) {
    logger.info('📊 PHASE 4 PERFORMANCE OPTIMIZATION SUMMARY');
    logger.info('=============================================');
    logger.info(`Optimization ID: ${report.optimizationId}`);
    logger.info(`Overall Improvement: ${report.summary.overallImprovement}%`);
    logger.info('');
    
    logger.info('🚀 Query Performance Improvements:');
    for (const [queryName, improvement] of Object.entries(report.metrics.improvements || {})) {
      const status = improvement.status === 'improved' ? '✅' : '⚠️';
      logger.info(`  ${status} ${queryName}: ${improvement.beforeTime}ms → ${improvement.afterTime}ms (${improvement.improvementPercent}%)`);
    }
    
    logger.info('');
    logger.info('💡 Key Recommendations:');
    for (const rec of report.recommendations.slice(0, 5)) {
      logger.info(`  • ${rec.type}: ${rec.recommendation || 'See detailed report'}`);
    }
    
    logger.info('=============================================');
  }
}

// Main execution
async function main() {
  const optimizer = new Phase4PerformanceOptimizer();
  
  try {
    await optimizer.initialize();
    await optimizer.executeOptimization();
    
    logger.info('🎉 Phase 4 performance optimization completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('💥 Phase 4 performance optimization failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { Phase4PerformanceOptimizer };
