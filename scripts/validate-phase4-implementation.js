#!/usr/bin/env node

/**
 * Phase 4 Implementation Validation Script
 * 
 * Comprehensive validation of all Phase 4 components including:
 * - Schema migration validation
 * - Data integrity verification
 * - Performance benchmarking
 * - Feature functionality testing
 * - Rollback capability testing
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Phase4Validator {
  constructor() {
    this.db = null;
    this.validationId = `phase4-validation-${Date.now()}`;
    this.testResults = {
      schemaValidation: { passed: 0, failed: 0, tests: [] },
      dataIntegrity: { passed: 0, failed: 0, tests: [] },
      performance: { passed: 0, failed: 0, tests: [] },
      functionality: { passed: 0, failed: 0, tests: [] },
      rollback: { passed: 0, failed: 0, tests: [] }
    };
    
    this.validationConfig = {
      enableSchemaValidation: true,
      enableDataIntegrityTests: true,
      enablePerformanceTests: true,
      enableFunctionalityTests: true,
      enableRollbackTests: false, // Dangerous - only enable in staging
      performanceThresholds: {
        maxQueryTime: 1000, // ms
        minIndexUsage: 0.8,
        maxSequentialScans: 5
      }
    };
  }

  async initialize() {
    logger.info('🚀 Initializing Phase 4 Implementation Validation');
    
    try {
      this.db = getDatabase();
      
      // Validate database connection
      await this.db.query('SELECT 1');
      logger.info('✅ Database connection established');
      
      // Log validation start
      await this.logValidationStart();
      
    } catch (error) {
      logger.error('❌ Failed to initialize validation:', error);
      throw error;
    }
  }

  async executeValidation() {
    const startTime = Date.now();
    logger.info('🔍 Starting Phase 4 implementation validation');
    
    try {
      // Step 1: Schema validation
      if (this.validationConfig.enableSchemaValidation) {
        await this.validateSchema();
      }
      
      // Step 2: Data integrity validation
      if (this.validationConfig.enableDataIntegrityTests) {
        await this.validateDataIntegrity();
      }
      
      // Step 3: Performance validation
      if (this.validationConfig.enablePerformanceTests) {
        await this.validatePerformance();
      }
      
      // Step 4: Functionality validation
      if (this.validationConfig.enableFunctionalityTests) {
        await this.validateFunctionality();
      }
      
      // Step 5: Rollback validation (if enabled)
      if (this.validationConfig.enableRollbackTests) {
        await this.validateRollbackCapability();
      }
      
      const validationTime = Date.now() - startTime;
      
      // Generate validation report
      await this.generateValidationReport(validationTime);
      
      // Log validation completion
      await this.logValidationCompletion(validationTime);
      
      logger.info(`✅ Phase 4 validation completed in ${validationTime}ms`);
      
    } catch (error) {
      logger.error('❌ Phase 4 validation failed:', error);
      await this.logValidationError(error);
      throw error;
    }
  }

  async validateSchema() {
    logger.info('🏗️ Validating schema migration');
    
    // Test 1: Verify new columns exist
    await this.runTest('schemaValidation', 'New Columns Existence', async () => {
      const requiredColumns = [
        { table: 'kb_chunks', column: 'parent_chunk_id' },
        { table: 'kb_chunks', column: 'hierarchy_level' },
        { table: 'kb_chunks', column: 'quality_score' },
        { table: 'kb_chunks', column: 'content_embedding' },
        { table: 'kb_chunks', column: 'contextual_embedding' },
        { table: 'kb_chunks', column: 'hierarchical_embedding' },
        { table: 'kb_chunks', column: 'semantic_embedding' },
        { table: 'documents', column: 'chunk_count' },
        { table: 'documents', column: 'average_quality' }
      ];
      
      for (const { table, column } of requiredColumns) {
        const result = await this.db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);
        
        if (result.rows.length === 0) {
          throw new Error(`Missing column ${column} in table ${table}`);
        }
      }
      
      logger.info(`✅ All ${requiredColumns.length} required columns exist`);
    });
    
    // Test 2: Verify new tables exist
    await this.runTest('schemaValidation', 'New Tables Existence', async () => {
      const requiredTables = [
        'chunk_relationships',
        'document_processing_history',
        'embedding_quality_metrics',
        'semantic_boundaries'
      ];
      
      for (const table of requiredTables) {
        const result = await this.db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        
        if (result.rows.length === 0) {
          throw new Error(`Missing table ${table}`);
        }
      }
      
      logger.info(`✅ All ${requiredTables.length} required tables exist`);
    });
    
    // Test 3: Verify indexes exist
    await this.runTest('schemaValidation', 'Index Existence', async () => {
      const criticalIndexes = [
        'idx_chunks_parent_id',
        'idx_chunks_hierarchy_level',
        'idx_chunks_quality_score',
        'idx_chunks_content_embedding',
        'idx_relationships_source_chunk',
        'idx_quality_metrics_chunk'
      ];
      
      let existingIndexes = 0;
      
      for (const indexName of criticalIndexes) {
        const result = await this.db.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' AND indexname = $1
        `, [indexName]);
        
        if (result.rows.length > 0) {
          existingIndexes++;
        }
      }
      
      if (existingIndexes < criticalIndexes.length * 0.8) {
        throw new Error(`Only ${existingIndexes}/${criticalIndexes.length} critical indexes exist`);
      }
      
      logger.info(`✅ ${existingIndexes}/${criticalIndexes.length} critical indexes exist`);
    });
    
    // Test 4: Verify constraints exist
    await this.runTest('schemaValidation', 'Constraint Validation', async () => {
      const constraints = await this.db.query(`
        SELECT constraint_name, table_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name IN ('kb_chunks', 'chunk_relationships', 'embedding_quality_metrics')
        AND constraint_type = 'CHECK'
      `);
      
      if (constraints.rows.length < 5) {
        throw new Error(`Only ${constraints.rows.length} check constraints found, expected at least 5`);
      }
      
      logger.info(`✅ ${constraints.rows.length} check constraints validated`);
    });
    
    // Test 5: Verify triggers exist
    await this.runTest('schemaValidation', 'Trigger Validation', async () => {
      const triggers = await this.db.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND event_object_table IN ('kb_chunks', 'documents')
      `);
      
      if (triggers.rows.length < 2) {
        throw new Error(`Only ${triggers.rows.length} triggers found, expected at least 2`);
      }
      
      logger.info(`✅ ${triggers.rows.length} triggers validated`);
    });
    
    // Test 6: Verify views exist
    await this.runTest('schemaValidation', 'View Validation', async () => {
      const views = await this.db.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
      `);
      
      if (views.rows.length < 3) {
        throw new Error(`Only ${views.rows.length} views found, expected at least 3`);
      }
      
      logger.info(`✅ ${views.rows.length} views validated`);
    });
    
    // Test 7: Verify functions exist
    await this.runTest('schemaValidation', 'Function Validation', async () => {
      const functions = await this.db.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_name IN (
          'get_chunk_hierarchy_path',
          'calculate_document_quality',
          'find_similar_chunks_multi_scale'
        )
      `);
      
      if (functions.rows.length < 3) {
        throw new Error(`Only ${functions.rows.length} required functions found, expected 3`);
      }
      
      logger.info(`✅ ${functions.rows.length} required functions validated`);
    });
  }

  async validateDataIntegrity() {
    logger.info('🔒 Validating data integrity');
    
    // Test 1: Hierarchical relationship consistency
    await this.runTest('dataIntegrity', 'Hierarchical Consistency', async () => {
      // Check for orphaned parent references
      const orphanedParents = await this.db.query(`
        SELECT COUNT(*) as count
        FROM kb_chunks c1
        WHERE c1.parent_chunk_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM kb_chunks c2 
          WHERE c2.chunk_id = c1.parent_chunk_id
        )
      `);
      
      const orphanCount = parseInt(orphanedParents.rows[0].count);
      if (orphanCount > 0) {
        throw new Error(`Found ${orphanCount} chunks with orphaned parent references`);
      }
      
      // Check for circular references
      const circularRefs = await this.db.query(`
        WITH RECURSIVE hierarchy_check AS (
          SELECT chunk_id, parent_chunk_id, 1 as level, ARRAY[chunk_id] as path
          FROM kb_chunks
          WHERE parent_chunk_id IS NOT NULL
          
          UNION ALL
          
          SELECT h.chunk_id, c.parent_chunk_id, h.level + 1, h.path || c.chunk_id
          FROM hierarchy_check h
          JOIN kb_chunks c ON h.parent_chunk_id = c.chunk_id
          WHERE h.level < 10 AND NOT c.chunk_id = ANY(h.path)
        )
        SELECT COUNT(*) as count
        FROM hierarchy_check
        WHERE chunk_id = ANY(path[2:])
      `);
      
      const circularCount = parseInt(circularRefs.rows[0].count);
      if (circularCount > 0) {
        throw new Error(`Found ${circularCount} circular references in hierarchy`);
      }
      
      logger.info('✅ Hierarchical relationships are consistent');
    });
    
    // Test 2: Quality score validation
    await this.runTest('dataIntegrity', 'Quality Score Validation', async () => {
      const invalidQuality = await this.db.query(`
        SELECT COUNT(*) as count
        FROM kb_chunks
        WHERE quality_score < 0 OR quality_score > 1
        OR coherence_score < 0 OR coherence_score > 1
      `);
      
      const invalidCount = parseInt(invalidQuality.rows[0].count);
      if (invalidCount > 0) {
        throw new Error(`Found ${invalidCount} chunks with invalid quality scores`);
      }
      
      logger.info('✅ Quality scores are within valid range');
    });
    
    // Test 3: Embedding dimension consistency
    await this.runTest('dataIntegrity', 'Embedding Dimension Consistency', async () => {
      const embeddingChecks = [
        { type: 'content_embedding', column: 'content_embedding' },
        { type: 'contextual_embedding', column: 'contextual_embedding' },
        { type: 'hierarchical_embedding', column: 'hierarchical_embedding' },
        { type: 'semantic_embedding', column: 'semantic_embedding' }
      ];
      
      for (const { type, column } of embeddingChecks) {
        const dimensionCheck = await this.db.query(`
          SELECT COUNT(*) as count
          FROM kb_chunks
          WHERE ${column} IS NOT NULL
          AND array_length(${column}::float[], 1) != 3072
        `);
        
        const invalidDimensions = parseInt(dimensionCheck.rows[0].count);
        if (invalidDimensions > 0) {
          throw new Error(`Found ${invalidDimensions} ${type} embeddings with invalid dimensions`);
        }
      }
      
      logger.info('✅ Embedding dimensions are consistent');
    });
    
    // Test 4: Relationship symmetry
    await this.runTest('dataIntegrity', 'Relationship Symmetry', async () => {
      const asymmetricRelationships = await this.db.query(`
        SELECT COUNT(*) as count
        FROM chunk_relationships cr1
        WHERE cr1.relationship_type = 'parent'
        AND NOT EXISTS (
          SELECT 1 FROM chunk_relationships cr2
          WHERE cr2.source_chunk_id = cr1.target_chunk_id
          AND cr2.target_chunk_id = cr1.source_chunk_id
          AND cr2.relationship_type = 'child'
        )
      `);
      
      const asymmetricCount = parseInt(asymmetricRelationships.rows[0].count);
      if (asymmetricCount > 0) {
        throw new Error(`Found ${asymmetricCount} asymmetric parent-child relationships`);
      }
      
      logger.info('✅ Relationship symmetry is maintained');
    });
    
    // Test 5: Document statistics accuracy
    await this.runTest('dataIntegrity', 'Document Statistics Accuracy', async () => {
      const inaccurateStats = await this.db.query(`
        SELECT COUNT(*) as count
        FROM documents d
        WHERE EXISTS (
          SELECT 1 FROM (
            SELECT 
              document_id,
              COUNT(*) as actual_chunk_count,
              AVG(quality_score) as actual_avg_quality
            FROM kb_chunks
            WHERE document_id = d.id
            GROUP BY document_id
          ) stats
          WHERE ABS(stats.actual_chunk_count - COALESCE(d.chunk_count, 0)) > 0
          OR ABS(stats.actual_avg_quality - COALESCE(d.average_quality, 0)) > 0.01
        )
      `);
      
      const inaccurateCount = parseInt(inaccurateStats.rows[0].count);
      if (inaccurateCount > 0) {
        logger.warn(`⚠️ Found ${inaccurateCount} documents with inaccurate statistics`);
        // This is a warning, not a failure, as statistics might be updated asynchronously
      } else {
        logger.info('✅ Document statistics are accurate');
      }
    });
  }

  async validatePerformance() {
    logger.info('⚡ Validating performance');
    
    // Test 1: Query performance benchmarks
    await this.runTest('performance', 'Query Performance Benchmarks', async () => {
      const performanceTests = [
        {
          name: 'hierarchical_retrieval',
          query: `
            SELECT c.*, p.content as parent_content
            FROM kb_chunks c
            LEFT JOIN kb_chunks p ON c.parent_chunk_id = p.chunk_id
            WHERE c.document_id = (SELECT id FROM documents LIMIT 1)
            ORDER BY c.sequence_order
            LIMIT 20
          `,
          maxTime: this.validationConfig.performanceThresholds.maxQueryTime
        },
        {
          name: 'quality_based_search',
          query: `
            SELECT chunk_id, content, quality_score
            FROM kb_chunks
            WHERE quality_score > 0.7
            ORDER BY quality_score DESC
            LIMIT 25
          `,
          maxTime: this.validationConfig.performanceThresholds.maxQueryTime
        },
        {
          name: 'relationship_traversal',
          query: `
            SELECT cr.*, c1.content as source_content
            FROM chunk_relationships cr
            JOIN kb_chunks c1 ON cr.source_chunk_id = c1.chunk_id
            WHERE cr.relationship_type = 'parent'
            LIMIT 30
          `,
          maxTime: this.validationConfig.performanceThresholds.maxQueryTime
        }
      ];
      
      for (const test of performanceTests) {
        const startTime = Date.now();
        await this.db.query(test.query);
        const executionTime = Date.now() - startTime;
        
        if (executionTime > test.maxTime) {
          throw new Error(`Query ${test.name} took ${executionTime}ms, exceeds threshold of ${test.maxTime}ms`);
        }
        
        logger.info(`✅ Query ${test.name}: ${executionTime}ms (threshold: ${test.maxTime}ms)`);
      }
    });
    
    // Test 2: Index usage validation
    await this.runTest('performance', 'Index Usage Validation', async () => {
      const indexUsage = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('kb_chunks', 'chunk_relationships', 'embedding_quality_metrics')
        AND idx_scan > 0
        ORDER BY idx_scan DESC
      `);
      
      const totalIndexes = await this.db.query(`
        SELECT COUNT(*) as count
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('kb_chunks', 'chunk_relationships', 'embedding_quality_metrics')
      `);
      
      const usedIndexes = indexUsage.rows.length;
      const totalCount = parseInt(totalIndexes.rows[0].count);
      const usageRatio = usedIndexes / totalCount;
      
      if (usageRatio < this.validationConfig.performanceThresholds.minIndexUsage) {
        throw new Error(`Index usage ratio ${usageRatio.toFixed(2)} below threshold ${this.validationConfig.performanceThresholds.minIndexUsage}`);
      }
      
      logger.info(`✅ Index usage: ${usedIndexes}/${totalCount} indexes used (${(usageRatio * 100).toFixed(1)}%)`);
    });
    
    // Test 3: Sequential scan analysis
    await this.runTest('performance', 'Sequential Scan Analysis', async () => {
      const seqScans = await this.db.query(`
        SELECT 
          schemaname,
          relname,
          seq_scan,
          seq_tup_read,
          idx_scan
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        AND relname IN ('kb_chunks', 'chunk_relationships', 'embedding_quality_metrics')
        AND seq_scan > ${this.validationConfig.performanceThresholds.maxSequentialScans}
        ORDER BY seq_scan DESC
      `);
      
      if (seqScans.rows.length > 0) {
        const warnings = seqScans.rows.map(row => 
          `${row.relname}: ${row.seq_scan} sequential scans`
        );
        logger.warn(`⚠️ High sequential scan counts detected: ${warnings.join(', ')}`);
        // This is a warning, not a failure
      } else {
        logger.info('✅ Sequential scan counts are within acceptable limits');
      }
    });
  }

  async validateFunctionality() {
    logger.info('🔧 Validating functionality');
    
    // Test 1: Hierarchical path function
    await this.runTest('functionality', 'Hierarchical Path Function', async () => {
      // Get a chunk with a parent
      const chunkWithParent = await this.db.query(`
        SELECT chunk_id
        FROM kb_chunks
        WHERE parent_chunk_id IS NOT NULL
        LIMIT 1
      `);
      
      if (chunkWithParent.rows.length === 0) {
        logger.warn('⚠️ No chunks with parents found, skipping hierarchical path test');
        return;
      }
      
      const chunkId = chunkWithParent.rows[0].chunk_id;
      const pathResult = await this.db.query(`
        SELECT get_chunk_hierarchy_path($1) as path
      `, [chunkId]);
      
      const path = pathResult.rows[0].path;
      if (!path || path.length === 0) {
        throw new Error('Hierarchical path function returned empty result');
      }
      
      logger.info(`✅ Hierarchical path function working: ${path.length} levels`);
    });
    
    // Test 2: Document quality calculation function
    await this.runTest('functionality', 'Document Quality Function', async () => {
      const document = await this.db.query(`
        SELECT id FROM documents LIMIT 1
      `);
      
      if (document.rows.length === 0) {
        throw new Error('No documents found for quality calculation test');
      }
      
      const documentId = document.rows[0].id;
      const qualityResult = await this.db.query(`
        SELECT calculate_document_quality($1) as quality
      `, [documentId]);
      
      const quality = parseFloat(qualityResult.rows[0].quality);
      if (isNaN(quality) || quality < 0 || quality > 1) {
        throw new Error(`Invalid quality score returned: ${quality}`);
      }
      
      logger.info(`✅ Document quality function working: ${quality.toFixed(3)}`);
    });
    
    // Test 3: Multi-scale similarity search function
    await this.runTest('functionality', 'Multi-Scale Similarity Function', async () => {
      // Create a dummy embedding vector
      const dummyEmbedding = Array(3072).fill(0.1);
      
      const similarityResult = await this.db.query(`
        SELECT * FROM find_similar_chunks_multi_scale($1::vector, 'content', 0.5, 10)
      `, [dummyEmbedding]);
      
      // The function should execute without error, even if no results
      logger.info(`✅ Multi-scale similarity function working: ${similarityResult.rows.length} results`);
    });
    
    // Test 4: View functionality
    await this.runTest('functionality', 'View Functionality', async () => {
      const views = [
        'v_hierarchical_chunks',
        'v_document_processing_summary',
        'v_quality_metrics_summary'
      ];
      
      for (const viewName of views) {
        try {
          const result = await this.db.query(`SELECT COUNT(*) as count FROM ${viewName} LIMIT 1`);
          logger.info(`✅ View ${viewName} accessible: ${result.rows[0].count} rows`);
        } catch (error) {
          throw new Error(`View ${viewName} not accessible: ${error.message}`);
        }
      }
    });
    
    // Test 5: Trigger functionality
    await this.runTest('functionality', 'Trigger Functionality', async () => {
      // Test chunk hash update trigger
      const testChunkId = uuidv4();
      const testContent = 'Test content for trigger validation';
      
      // Insert test chunk
      await this.db.query(`
        INSERT INTO kb_chunks (chunk_id, document_id, content, token_count)
        VALUES ($1, 'test-doc', $2, 10)
      `, [testChunkId, testContent]);
      
      // Check if hash was generated
      const hashResult = await this.db.query(`
        SELECT chunk_hash FROM kb_chunks WHERE chunk_id = $1
      `, [testChunkId]);
      
      if (!hashResult.rows[0].chunk_hash) {
        throw new Error('Chunk hash trigger did not execute');
      }
      
      // Clean up test data
      await this.db.query(`DELETE FROM kb_chunks WHERE chunk_id = $1`, [testChunkId]);
      
      logger.info('✅ Trigger functionality validated');
    });
  }

  async validateRollbackCapability() {
    logger.info('🔄 Validating rollback capability (DANGEROUS - staging only)');
    
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️ Skipping rollback validation in production environment');
      return;
    }
    
    // Test 1: Rollback script syntax validation
    await this.runTest('rollback', 'Rollback Script Syntax', async () => {
      const fs = require('fs').promises;
      
      try {
        const rollbackScript = await fs.readFile('database/migration_004_rollback.sql', 'utf8');
        
        if (!rollbackScript.includes('DROP TRIGGER') || 
            !rollbackScript.includes('DROP FUNCTION') ||
            !rollbackScript.includes('DROP VIEW')) {
          throw new Error('Rollback script appears incomplete');
        }
        
        logger.info('✅ Rollback script syntax appears valid');
        
      } catch (error) {
        throw new Error(`Rollback script validation failed: ${error.message}`);
      }
    });
    
    // Test 2: Backup table existence
    await this.runTest('rollback', 'Backup Table Validation', async () => {
      const backupTables = await this.db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%_backup_phase4'
      `);
      
      if (backupTables.rows.length < 2) {
        throw new Error(`Only ${backupTables.rows.length} backup tables found, expected at least 2`);
      }
      
      logger.info(`✅ ${backupTables.rows.length} backup tables validated`);
    });
  }

  async runTest(category, testName, testFunction) {
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      
      this.testResults[category].passed++;
      this.testResults[category].tests.push({
        name: testName,
        status: 'passed',
        duration: duration,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults[category].failed++;
      this.testResults[category].tests.push({
        name: testName,
        status: 'failed',
        duration: duration,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      logger.error(`❌ ${testName} failed: ${error.message}`);
    }
  }

  async generateValidationReport(validationTime) {
    logger.info('📋 Generating validation report');
    
    try {
      const report = {
        validationId: this.validationId,
        timestamp: new Date().toISOString(),
        validationTime: validationTime,
        summary: {
          totalTests: 0,
          totalPassed: 0,
          totalFailed: 0,
          overallStatus: 'passed',
          categories: {}
        },
        testResults: this.testResults,
        recommendations: []
      };
      
      // Calculate summary statistics
      for (const [category, results] of Object.entries(this.testResults)) {
        report.summary.totalTests += results.tests.length;
        report.summary.totalPassed += results.passed;
        report.summary.totalFailed += results.failed;
        
        report.summary.categories[category] = {
          passed: results.passed,
          failed: results.failed,
          total: results.tests.length,
          status: results.failed === 0 ? 'passed' : 'failed'
        };
        
        if (results.failed > 0) {
          report.summary.overallStatus = 'failed';
        }
      }
      
      // Generate recommendations based on failures
      this.generateRecommendations(report);
      
      // Save report to file
      const fs = require('fs').promises;
      const reportPath = `reports/phase4-validation-${this.validationId}.json`;
      
      await fs.mkdir('reports', { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`✅ Validation report saved to: ${reportPath}`);
      
      // Log summary
      this.logValidationSummary(report);
      
      return report;
      
    } catch (error) {
      logger.error('❌ Failed to generate validation report:', error);
      throw error;
    }
  }

  generateRecommendations(report) {
    const recommendations = [];
    
    // Check for schema validation failures
    if (report.summary.categories.schemaValidation?.failed > 0) {
      recommendations.push({
        category: 'schema',
        priority: 'high',
        message: 'Schema validation failures detected. Review migration script execution.',
        action: 'Re-run migration script or check for partial migration issues'
      });
    }
    
    // Check for data integrity failures
    if (report.summary.categories.dataIntegrity?.failed > 0) {
      recommendations.push({
        category: 'data_integrity',
        priority: 'high',
        message: 'Data integrity issues detected. Data migration may be incomplete.',
        action: 'Run data migration script and validate relationships'
      });
    }
    
    // Check for performance issues
    if (report.summary.categories.performance?.failed > 0) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        message: 'Performance issues detected. Consider optimization.',
        action: 'Run performance optimization script and review query plans'
      });
    }
    
    // Check for functionality failures
    if (report.summary.categories.functionality?.failed > 0) {
      recommendations.push({
        category: 'functionality',
        priority: 'high',
        message: 'Functionality tests failed. Core features may not work correctly.',
        action: 'Review function definitions and trigger implementations'
      });
    }
    
    report.recommendations = recommendations;
  }

  logValidationSummary(report) {
    logger.info('📊 PHASE 4 VALIDATION SUMMARY');
    logger.info('==============================');
    logger.info(`Validation ID: ${report.validationId}`);
    logger.info(`Overall Status: ${report.summary.overallStatus.toUpperCase()}`);
    logger.info(`Total Tests: ${report.summary.totalTests}`);
    logger.info(`Passed: ${report.summary.totalPassed}`);
    logger.info(`Failed: ${report.summary.totalFailed}`);
    logger.info(`Validation Time: ${report.validationTime}ms`);
    logger.info('');
    
    logger.info('📋 Category Results:');
    for (const [category, results] of Object.entries(report.summary.categories)) {
      const status = results.status === 'passed' ? '✅' : '❌';
      logger.info(`  ${status} ${category}: ${results.passed}/${results.total} passed`);
    }
    
    if (report.recommendations.length > 0) {
      logger.info('');
      logger.info('💡 Recommendations:');
      for (const rec of report.recommendations) {
        logger.info(`  • [${rec.priority.toUpperCase()}] ${rec.message}`);
        logger.info(`    Action: ${rec.action}`);
      }
    }
    
    logger.info('==============================');
  }

  async logValidationStart() {
    try {
      await this.db.query(`
        INSERT INTO document_processing_history (
          document_id, processing_version, processing_config, 
          started_at, status, processing_metadata
        ) VALUES ($1, $2, $3, NOW(), $4, $5)
      `, [
        this.validationId,
        '2.0',
        JSON.stringify(this.validationConfig),
        'processing',
        JSON.stringify({
          validationType: 'phase4-implementation-validation',
          validationCategories: Object.keys(this.testResults)
        })
      ]);
      
    } catch (error) {
      logger.warn('⚠️ Failed to log validation start:', error);
    }
  }

  async logValidationCompletion(validationTime) {
    try {
      const summary = {
        totalTests: Object.values(this.testResults).reduce((sum, cat) => sum + cat.tests.length, 0),
        totalPassed: Object.values(this.testResults).reduce((sum, cat) => sum + cat.passed, 0),
        totalFailed: Object.values(this.testResults).reduce((sum, cat) => sum + cat.failed, 0)
      };
      
      await this.db.query(`
        UPDATE document_processing_history 
        SET 
          completed_at = NOW(),
          status = $2,
          processing_time_ms = $3,
          chunks_generated = $4,
          error_count = $5,
          processing_metadata = $6
        WHERE document_id = $1 AND processing_version = '2.0'
      `, [
        this.validationId,
        summary.totalFailed === 0 ? 'completed' : 'failed',
        validationTime,
        summary.totalTests,
        summary.totalFailed,
        JSON.stringify({
          validationType: 'phase4-implementation-validation',
          summary: summary,
          testResults: this.testResults,
          completedAt: new Date().toISOString()
        })
      ]);
      
    } catch (error) {
      logger.warn('⚠️ Failed to log validation completion:', error);
    }
  }

  async logValidationError(error) {
    try {
      await this.db.query(`
        UPDATE document_processing_history 
        SET 
          completed_at = NOW(),
          status = 'failed',
          error_count = 1,
          processing_metadata = $2
        WHERE document_id = $1 AND processing_version = '2.0'
      `, [
        this.validationId,
        JSON.stringify({
          validationType: 'phase4-implementation-validation',
          error: error.message,
          testResults: this.testResults,
          failedAt: new Date().toISOString()
        })
      ]);
      
    } catch (logError) {
      logger.warn('⚠️ Failed to log validation error:', logError);
    }
  }
}

// Main execution
async function main() {
  const validator = new Phase4Validator();
  
  try {
    await validator.initialize();
    await validator.executeValidation();
    
    const totalFailed = Object.values(validator.testResults).reduce((sum, cat) => sum + cat.failed, 0);
    
    if (totalFailed === 0) {
      logger.info('🎉 Phase 4 validation completed successfully!');
      process.exit(0);
    } else {
      logger.error(`💥 Phase 4 validation failed with ${totalFailed} test failures!`);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('💥 Phase 4 validation crashed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { Phase4Validator };
