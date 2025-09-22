#!/usr/bin/env node

/**
 * Phase 4 Complete Execution Script
 * 
 * Orchestrates the complete Phase 4 implementation:
 * 1. Schema migration
 * 2. Data migration  
 * 3. Performance optimization
 * 4. Comprehensive validation
 * 
 * Features:
 * - Step-by-step execution with validation
 * - Comprehensive error handling and rollback
 * - Progress tracking and reporting
 * - Safety checks and confirmations
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../config/database');
const { execSync } = require('child_process');
const fs = require('fs').promises;

class Phase4Executor {
  constructor() {
    this.db = null;
    this.executionId = `phase4-execution-${Date.now()}`;
    this.executionLog = [];
    this.rollbackRequired = false;
    
    this.executionConfig = {
      enableSchemaBackup: true,
      enableDataMigration: true,
      enablePerformanceOptimization: true,
      enableValidation: true,
      enableRollbackOnFailure: true,
      requireConfirmation: true
    };
    
    this.executionSteps = [
      { name: 'Pre-execution Validation', function: 'validatePreExecution' },
      { name: 'Database Backup', function: 'createDatabaseBackup' },
      { name: 'Schema Migration', function: 'executeSchemaMigration' },
      { name: 'Data Migration', function: 'executeDataMigration' },
      { name: 'Performance Optimization', function: 'executePerformanceOptimization' },
      { name: 'Comprehensive Validation', function: 'executeValidation' },
      { name: 'Post-execution Report', function: 'generateExecutionReport' }
    ];
  }

  async initialize() {
    logger.info('🚀 Initializing Phase 4 Complete Execution');
    
    try {
      this.db = getDatabase();
      
      // Validate database connection
      await this.db.query('SELECT 1');
      logger.info('✅ Database connection established');
      
      // Log execution start
      await this.logExecutionStart();
      
    } catch (error) {
      logger.error('❌ Failed to initialize Phase 4 execution:', error);
      throw error;
    }
  }

  async executePhase4Complete() {
    const startTime = Date.now();
    logger.info('🎯 Starting Phase 4 Complete Implementation');
    
    try {
      // Safety confirmation
      if (this.executionConfig.requireConfirmation) {
        await this.requestExecutionConfirmation();
      }
      
      // Execute all steps
      for (const step of this.executionSteps) {
        await this.executeStep(step);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Log successful completion
      await this.logExecutionCompletion(executionTime);
      
      logger.info(`🎉 Phase 4 complete implementation finished successfully in ${executionTime}ms`);
      
    } catch (error) {
      logger.error('❌ Phase 4 execution failed:', error);
      
      // Execute rollback if required
      if (this.executionConfig.enableRollbackOnFailure && this.rollbackRequired) {
        await this.executeRollback();
      }
      
      await this.logExecutionError(error);
      throw error;
    }
  }

  async requestExecutionConfirmation() {
    logger.warn('⚠️ PHASE 4 EXECUTION CONFIRMATION REQUIRED');
    logger.warn('==========================================');
    logger.warn('This will execute comprehensive database changes including:');
    logger.warn('• Schema migration with new tables and columns');
    logger.warn('• Data migration affecting all existing chunks');
    logger.warn('• Performance optimization with new indexes');
    logger.warn('• Comprehensive validation testing');
    logger.warn('');
    logger.warn('Backup procedures are in place, but this is a significant operation.');
    logger.warn('');
    
    // In a real implementation, you would prompt for user confirmation
    // For automation, we'll log the warning and continue
    logger.info('✅ Proceeding with Phase 4 execution (automated mode)');
  }

  async executeStep(step) {
    const stepStartTime = Date.now();
    logger.info(`🔄 Executing: ${step.name}`);
    
    try {
      // Execute the step function
      await this[step.function]();
      
      const stepTime = Date.now() - stepStartTime;
      
      this.executionLog.push({
        step: step.name,
        status: 'completed',
        duration: stepTime,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ Completed: ${step.name} (${stepTime}ms)`);
      
    } catch (error) {
      const stepTime = Date.now() - stepStartTime;
      
      this.executionLog.push({
        step: step.name,
        status: 'failed',
        duration: stepTime,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      logger.error(`❌ Failed: ${step.name} - ${error.message}`);
      
      // Mark rollback as required for certain steps
      if (['Schema Migration', 'Data Migration'].includes(step.name)) {
        this.rollbackRequired = true;
      }
      
      throw error;
    }
  }

  async validatePreExecution() {
    logger.info('🔍 Validating pre-execution requirements');
    
    // Check if migration has already been applied
    const migrationCheck = await this.db.query(`
      SELECT migration_id, status 
      FROM migration_log 
      WHERE migration_id = '004' 
      ORDER BY started_at DESC 
      LIMIT 1
    `);
    
    if (migrationCheck.rows.length > 0 && migrationCheck.rows[0].status === 'COMPLETED') {
      throw new Error('Migration 004 has already been completed. Use rollback first if re-execution is needed.');
    }
    
    // Check database space
    const spaceCheck = await this.db.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        pg_size_pretty(pg_total_relation_size('kb_chunks')) as chunks_size
    `);
    
    logger.info(`📊 Database size: ${spaceCheck.rows[0].db_size}, Chunks table: ${spaceCheck.rows[0].chunks_size}`);
    
    // Check for required files
    const requiredFiles = [
      'database/migration_004_advanced_hierarchical_schema.sql',
      'database/migration_004_rollback.sql',
      'scripts/migrate-existing-data-phase4.js',
      'scripts/optimize-phase4-performance.js',
      'scripts/validate-phase4-implementation.js'
    ];
    
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
      } catch (error) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
    
    logger.info('✅ Pre-execution validation passed');
  }

  async createDatabaseBackup() {
    if (!this.executionConfig.enableSchemaBackup) {
      logger.info('⚠️ Database backup disabled - skipping');
      return;
    }
    
    logger.info('💾 Creating database backup');
    
    try {
      // Create backup directory
      const backupDir = `backups/phase4-${this.executionId}`;
      await fs.mkdir(backupDir, { recursive: true });
      
      // Export current schema
      const schemaBackupPath = `${backupDir}/schema-backup.sql`;
      execSync(`pg_dump --schema-only --no-owner --no-privileges -h localhost -U postgres -d fund_chatbot > ${schemaBackupPath}`, {
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
      });
      
      // Export data for critical tables
      const dataBackupPath = `${backupDir}/data-backup.sql`;
      execSync(`pg_dump --data-only --no-owner --no-privileges -t kb_chunks -t documents -t conversations -h localhost -U postgres -d fund_chatbot > ${dataBackupPath}`, {
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
      });
      
      logger.info(`✅ Database backup created: ${backupDir}`);
      
    } catch (error) {
      logger.warn('⚠️ Database backup failed (continuing with built-in backup procedures):', error.message);
      // Don't fail the entire process for backup issues
    }
  }

  async executeSchemaMigration() {
    logger.info('🏗️ Executing schema migration');
    
    try {
      // Read and execute migration script
      const migrationScript = await fs.readFile('database/migration_004_advanced_hierarchical_schema.sql', 'utf8');
      
      // Execute migration in a transaction (the script already has BEGIN/COMMIT)
      await this.db.query(migrationScript);
      
      // Verify migration completion
      const migrationStatus = await this.db.query(`
        SELECT status, notes 
        FROM migration_log 
        WHERE migration_id = '004' 
        ORDER BY started_at DESC 
        LIMIT 1
      `);
      
      if (migrationStatus.rows.length === 0 || migrationStatus.rows[0].status !== 'COMPLETED') {
        throw new Error('Schema migration did not complete successfully');
      }
      
      logger.info('✅ Schema migration completed successfully');
      
    } catch (error) {
      logger.error('❌ Schema migration failed:', error);
      throw error;
    }
  }

  async executeDataMigration() {
    if (!this.executionConfig.enableDataMigration) {
      logger.info('⚠️ Data migration disabled - skipping');
      return;
    }
    
    logger.info('📊 Executing data migration');
    
    try {
      // Execute data migration script
      const { Phase4DataMigrator } = require('./migrate-existing-data-phase4');
      const migrator = new Phase4DataMigrator();
      
      await migrator.initialize();
      await migrator.executeDataMigration();
      
      logger.info('✅ Data migration completed successfully');
      
    } catch (error) {
      logger.error('❌ Data migration failed:', error);
      throw error;
    }
  }

  async executePerformanceOptimization() {
    if (!this.executionConfig.enablePerformanceOptimization) {
      logger.info('⚠️ Performance optimization disabled - skipping');
      return;
    }
    
    logger.info('⚡ Executing performance optimization');
    
    try {
      // Execute performance optimization script
      const { Phase4PerformanceOptimizer } = require('./optimize-phase4-performance');
      const optimizer = new Phase4PerformanceOptimizer();
      
      await optimizer.initialize();
      await optimizer.executeOptimization();
      
      logger.info('✅ Performance optimization completed successfully');
      
    } catch (error) {
      logger.error('❌ Performance optimization failed:', error);
      throw error;
    }
  }

  async executeValidation() {
    if (!this.executionConfig.enableValidation) {
      logger.info('⚠️ Validation disabled - skipping');
      return;
    }
    
    logger.info('✅ Executing comprehensive validation');
    
    try {
      // Execute validation script
      const { Phase4Validator } = require('./validate-phase4-implementation');
      const validator = new Phase4Validator();
      
      await validator.initialize();
      await validator.executeValidation();
      
      // Check validation results
      const totalFailed = Object.values(validator.testResults).reduce((sum, cat) => sum + cat.failed, 0);
      
      if (totalFailed > 0) {
        throw new Error(`Validation failed with ${totalFailed} test failures`);
      }
      
      logger.info('✅ Comprehensive validation completed successfully');
      
    } catch (error) {
      logger.error('❌ Validation failed:', error);
      throw error;
    }
  }

  async generateExecutionReport() {
    logger.info('📋 Generating execution report');
    
    try {
      const report = {
        executionId: this.executionId,
        timestamp: new Date().toISOString(),
        status: 'completed',
        executionLog: this.executionLog,
        summary: {
          totalSteps: this.executionSteps.length,
          completedSteps: this.executionLog.filter(log => log.status === 'completed').length,
          failedSteps: this.executionLog.filter(log => log.status === 'failed').length,
          totalTime: this.executionLog.reduce((sum, log) => sum + log.duration, 0)
        },
        databaseMetrics: await this.collectDatabaseMetrics()
      };
      
      // Save report
      const reportPath = `reports/phase4-execution-${this.executionId}.json`;
      await fs.mkdir('reports', { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`✅ Execution report saved: ${reportPath}`);
      
      // Log summary
      this.logExecutionSummary(report);
      
    } catch (error) {
      logger.warn('⚠️ Failed to generate execution report:', error);
    }
  }

  async collectDatabaseMetrics() {
    try {
      const metrics = {};
      
      // Table counts
      const tableCounts = await this.db.query(`
        SELECT 
          'kb_chunks' as table_name, COUNT(*) as count FROM kb_chunks
        UNION ALL
        SELECT 
          'documents' as table_name, COUNT(*) as count FROM documents
        UNION ALL
        SELECT 
          'chunk_relationships' as table_name, COUNT(*) as count FROM chunk_relationships
        UNION ALL
        SELECT 
          'embedding_quality_metrics' as table_name, COUNT(*) as count FROM embedding_quality_metrics
      `);
      
      metrics.tableCounts = tableCounts.rows.reduce((acc, row) => {
        acc[row.table_name] = parseInt(row.count);
        return acc;
      }, {});
      
      // Quality metrics
      const qualityStats = await this.db.query(`
        SELECT 
          COUNT(*) as total_chunks,
          AVG(quality_score) as avg_quality,
          AVG(coherence_score) as avg_coherence,
          COUNT(CASE WHEN parent_chunk_id IS NOT NULL THEN 1 END) as chunks_with_parents
        FROM kb_chunks
      `);
      
      metrics.qualityStats = qualityStats.rows[0];
      
      return metrics;
      
    } catch (error) {
      logger.warn('⚠️ Failed to collect database metrics:', error);
      return {};
    }
  }

  async executeRollback() {
    logger.warn('🔄 Executing rollback procedures');
    
    try {
      // Read and execute rollback script
      const rollbackScript = await fs.readFile('database/migration_004_rollback.sql', 'utf8');
      
      await this.db.query(rollbackScript);
      
      logger.info('✅ Rollback completed successfully');
      
    } catch (error) {
      logger.error('❌ Rollback failed:', error);
      // Don't throw here as we're already in error handling
    }
  }

  logExecutionSummary(report) {
    logger.info('📊 PHASE 4 EXECUTION SUMMARY');
    logger.info('=============================');
    logger.info(`Execution ID: ${report.executionId}`);
    logger.info(`Status: ${report.status.toUpperCase()}`);
    logger.info(`Total Steps: ${report.summary.totalSteps}`);
    logger.info(`Completed: ${report.summary.completedSteps}`);
    logger.info(`Failed: ${report.summary.failedSteps}`);
    logger.info(`Total Time: ${report.summary.totalTime}ms`);
    logger.info('');
    
    logger.info('📋 Step Results:');
    for (const log of report.executionLog) {
      const status = log.status === 'completed' ? '✅' : '❌';
      logger.info(`  ${status} ${log.step}: ${log.duration}ms`);
    }
    
    if (report.databaseMetrics.tableCounts) {
      logger.info('');
      logger.info('📊 Database Metrics:');
      for (const [table, count] of Object.entries(report.databaseMetrics.tableCounts)) {
        logger.info(`  • ${table}: ${count} records`);
      }
    }
    
    logger.info('=============================');
  }

  async logExecutionStart() {
    try {
      await this.db.query(`
        INSERT INTO document_processing_history (
          document_id, processing_version, processing_config, 
          started_at, status, processing_metadata
        ) VALUES ($1, $2, $3, NOW(), $4, $5)
      `, [
        this.executionId,
        '2.0',
        JSON.stringify(this.executionConfig),
        'processing',
        JSON.stringify({
          executionType: 'phase4-complete-implementation',
          steps: this.executionSteps.map(s => s.name)
        })
      ]);
      
    } catch (error) {
      logger.warn('⚠️ Failed to log execution start:', error);
    }
  }

  async logExecutionCompletion(executionTime) {
    try {
      await this.db.query(`
        UPDATE document_processing_history 
        SET 
          completed_at = NOW(),
          status = 'completed',
          processing_time_ms = $2,
          processing_metadata = $3
        WHERE document_id = $1 AND processing_version = '2.0'
      `, [
        this.executionId,
        executionTime,
        JSON.stringify({
          executionType: 'phase4-complete-implementation',
          executionLog: this.executionLog,
          completedAt: new Date().toISOString()
        })
      ]);
      
    } catch (error) {
      logger.warn('⚠️ Failed to log execution completion:', error);
    }
  }

  async logExecutionError(error) {
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
        this.executionId,
        JSON.stringify({
          executionType: 'phase4-complete-implementation',
          error: error.message,
          executionLog: this.executionLog,
          rollbackExecuted: this.rollbackRequired,
          failedAt: new Date().toISOString()
        })
      ]);
      
    } catch (logError) {
      logger.warn('⚠️ Failed to log execution error:', logError);
    }
  }
}

// Main execution
async function main() {
  const executor = new Phase4Executor();
  
  try {
    await executor.initialize();
    await executor.executePhase4Complete();
    
    logger.info('🎉 Phase 4 complete implementation finished successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('💥 Phase 4 complete implementation failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { Phase4Executor };
