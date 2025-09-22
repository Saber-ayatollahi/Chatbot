/**
 * Data Retention Manager
 * Automated data lifecycle management and retention policy enforcement
 */

const { Pool } = require('pg');
const cron = require('node-cron');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const AuditLogger = require('./AuditLogger');

class DataRetentionManager {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({
      connectionString: this.config.database.url,
      max: 10,
    });
    this.auditLogger = new AuditLogger();
    this.policies = new Map();
    this.scheduledJobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize data retention manager
   */
  async initialize() {
    try {
      await this.loadRetentionPolicies();
      await this.scheduleRetentionJobs();
      this.isInitialized = true;
      
      logger.info('Data Retention Manager initialized successfully', {
        policiesCount: this.policies.size,
        scheduledJobs: this.scheduledJobs.size,
      });

    } catch (error) {
      logger.error('Failed to initialize Data Retention Manager:', error);
      throw error;
    }
  }

  /**
   * Load retention policies from database
   */
  async loadRetentionPolicies() {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM data_retention_policies 
        WHERE active = TRUE
        ORDER BY policy_name
      `;

      const result = await client.query(query);
      
      this.policies.clear();
      result.rows.forEach(policy => {
        this.policies.set(policy.policy_name, {
          id: policy.id,
          name: policy.policy_name,
          dataType: policy.data_type,
          retentionDays: policy.retention_days,
          autoDelete: policy.auto_delete,
          archiveBeforeDelete: policy.archive_before_delete,
          archiveLocation: policy.archive_location,
          conditions: policy.conditions || {},
          complianceRequirement: policy.compliance_requirement,
          lastApplied: policy.last_applied,
          createdAt: policy.created_at,
        });
      });

      logger.info(`Loaded ${this.policies.size} retention policies`);

    } finally {
      client.release();
    }
  }

  /**
   * Schedule automated retention jobs
   */
  async scheduleRetentionJobs() {
    // Clear existing scheduled jobs
    this.scheduledJobs.forEach((job, name) => {
      job.stop();
      this.scheduledJobs.delete(name);
    });

    // Schedule daily cleanup job at 2 AM
    const dailyCleanupJob = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled data retention cleanup');
      try {
        await this.runAutomatedCleanup();
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
      }
    }, { scheduled: false });

    this.scheduledJobs.set('daily_cleanup', dailyCleanupJob);

    // Schedule policy refresh job every 6 hours
    const policyRefreshJob = cron.schedule('0 */6 * * *', async () => {
      logger.info('Refreshing retention policies');
      try {
        await this.loadRetentionPolicies();
      } catch (error) {
        logger.error('Policy refresh failed:', error);
      }
    }, { scheduled: false });

    this.scheduledJobs.set('policy_refresh', policyRefreshJob);

    // Start all jobs
    this.scheduledJobs.forEach((job, name) => {
      job.start();
      logger.info(`Started scheduled job: ${name}`);
    });
  }

  /**
   * Run automated cleanup based on retention policies
   */
  async runAutomatedCleanup() {
    const startTime = Date.now();
    const results = {
      totalProcessed: 0,
      totalDeleted: 0,
      totalArchived: 0,
      errors: [],
      policyResults: {},
    };

    logger.info('Starting automated data retention cleanup');

    try {
      for (const [policyName, policy] of this.policies) {
        if (!policy.autoDelete) {
          logger.info(`Skipping policy ${policyName} (auto-delete disabled)`);
          continue;
        }

        logger.info(`Processing retention policy: ${policyName}`);

        try {
          const policyResult = await this.applyRetentionPolicy(policy);
          results.policyResults[policyName] = policyResult;
          results.totalProcessed += policyResult.processed;
          results.totalDeleted += policyResult.deleted;
          results.totalArchived += policyResult.archived;

          // Update last applied timestamp
          await this.updatePolicyLastApplied(policy.id);

        } catch (error) {
          logger.error(`Error applying policy ${policyName}:`, error);
          results.errors.push({
            policy: policyName,
            error: error.message,
          });
        }
      }

      const executionTime = Date.now() - startTime;
      
      logger.info('Automated cleanup completed', {
        executionTime: `${executionTime}ms`,
        totalProcessed: results.totalProcessed,
        totalDeleted: results.totalDeleted,
        totalArchived: results.totalArchived,
        errors: results.errors.length,
      });

      // Log cleanup operation
      await this.logCleanupOperation(results, executionTime);

      return {
        ...results,
        executionTime,
      };

    } catch (error) {
      logger.error('Automated cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Apply a specific retention policy
   */
  async applyRetentionPolicy(policy) {
    const client = await this.pool.connect();
    const result = {
      policy: policy.name,
      processed: 0,
      deleted: 0,
      archived: 0,
      errors: [],
    };

    try {
      await client.query('BEGIN');

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      logger.info(`Applying policy ${policy.name} for data before ${cutoffDate.toISOString()}`);

      // Get records to process based on data type
      const recordsQuery = this.buildRetentionQuery(policy, cutoffDate);
      const recordsResult = await client.query(recordsQuery.query, recordsQuery.params);
      
      result.processed = recordsResult.rows.length;

      if (result.processed === 0) {
        logger.info(`No records found for policy ${policy.name}`);
        await client.query('COMMIT');
        return result;
      }

      logger.info(`Found ${result.processed} records to process for policy ${policy.name}`);

      // Archive records if required
      if (policy.archiveBeforeDelete) {
        const archiveResult = await this.archiveRecords(client, policy, recordsResult.rows);
        result.archived = archiveResult.archived;
        result.errors.push(...archiveResult.errors);
      }

      // Delete expired records
      const deleteResult = await this.deleteExpiredRecords(client, policy, recordsResult.rows);
      result.deleted = deleteResult.deleted;
      result.errors.push(...deleteResult.errors);

      // Log anonymization for audit trail
      await this.logDataAnonymization(client, policy, recordsResult.rows, 'deletion');

      await client.query('COMMIT');

      logger.info(`Policy ${policy.name} applied successfully`, {
        processed: result.processed,
        deleted: result.deleted,
        archived: result.archived,
        errors: result.errors.length,
      });

      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error applying policy ${policy.name}:`, error);
      result.errors.push(error.message);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Build retention query based on policy and data type
   */
  buildRetentionQuery(policy, cutoffDate) {
    const baseQueries = {
      audit_logs: {
        query: `
          SELECT id, session_id, created_at, retention_until
          FROM audit_logs
          WHERE (retention_until < $1 OR (retention_until IS NULL AND created_at < $2))
          ORDER BY created_at
          LIMIT 10000
        `,
        params: [cutoffDate.toISOString(), cutoffDate.toISOString()],
      },
      audit_pii_details: {
        query: `
          SELECT apd.id, apd.audit_log_id, apd.created_at
          FROM audit_pii_details apd
          JOIN audit_logs al ON apd.audit_log_id = al.id
          WHERE al.created_at < $1
          ORDER BY apd.created_at
          LIMIT 10000
        `,
        params: [cutoffDate.toISOString()],
      },
      audit_session_stats: {
        query: `
          SELECT id, session_id, created_at, last_interaction
          FROM audit_session_stats
          WHERE last_interaction < $1
          ORDER BY last_interaction
          LIMIT 10000
        `,
        params: [cutoffDate.toISOString()],
      },
      audit_errors: {
        query: `
          SELECT id, session_id, created_at, resolved
          FROM audit_errors
          WHERE created_at < $1 AND (resolved = TRUE OR created_at < $2)
          ORDER BY created_at
          LIMIT 10000
        `,
        params: [
          cutoffDate.toISOString(),
          new Date(cutoffDate.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString(), // 30 days older for unresolved
        ],
      },
      admin_access_logs: {
        query: `
          SELECT id, user_id, created_at, action
          FROM admin_access_logs
          WHERE created_at < $1
          ORDER BY created_at
          LIMIT 10000
        `,
        params: [cutoffDate.toISOString()],
      },
    };

    const baseQuery = baseQueries[policy.dataType];
    if (!baseQuery) {
      throw new Error(`Unknown data type for retention: ${policy.dataType}`);
    }

    // Apply additional conditions from policy
    if (policy.conditions && Object.keys(policy.conditions).length > 0) {
      // This would be expanded based on specific condition requirements
      logger.info(`Policy ${policy.name} has additional conditions:`, policy.conditions);
    }

    return baseQuery;
  }

  /**
   * Archive records before deletion
   */
  async archiveRecords(client, policy, records) {
    const result = {
      archived: 0,
      errors: [],
    };

    if (!policy.archiveLocation) {
      result.errors.push('Archive location not specified');
      return result;
    }

    try {
      // Create archive table name
      const archiveTable = `archived_${policy.dataType}`;
      
      // Ensure archive table exists
      await this.ensureArchiveTable(client, policy.dataType, archiveTable);

      // Archive records in batches
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        try {
          await this.archiveBatch(client, policy.dataType, archiveTable, batch);
          result.archived += batch.length;
        } catch (error) {
          logger.error(`Error archiving batch for ${policy.name}:`, error);
          result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        }
      }

      logger.info(`Archived ${result.archived} records for policy ${policy.name}`);

    } catch (error) {
      logger.error(`Error archiving records for ${policy.name}:`, error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Ensure archive table exists
   */
  async ensureArchiveTable(client, dataType, archiveTable) {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${archiveTable} (
        LIKE ${dataType} INCLUDING ALL
      )
    `;
    
    await client.query(createTableQuery);

    // Add archival timestamp if it doesn't exist
    const addColumnQuery = `
      ALTER TABLE ${archiveTable} 
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `;
    
    await client.query(addColumnQuery);
  }

  /**
   * Archive a batch of records
   */
  async archiveBatch(client, dataType, archiveTable, batch) {
    if (batch.length === 0) return;

    // Get column names for the source table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name != 'archived_at'
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await client.query(columnsQuery, [dataType]);
    const columns = columnsResult.rows.map(row => row.column_name);

    // Build insert query
    const placeholders = batch.map((_, index) => {
      const start = index * columns.length + 1;
      const end = start + columns.length - 1;
      return `(${Array.from({ length: columns.length }, (_, i) => `$${start + i}`).join(', ')})`;
    }).join(', ');

    const insertQuery = `
      INSERT INTO ${archiveTable} (${columns.join(', ')})
      SELECT ${columns.join(', ')} FROM ${dataType}
      WHERE id = ANY($1)
    `;

    const ids = batch.map(record => record.id);
    await client.query(insertQuery, [ids]);
  }

  /**
   * Delete expired records
   */
  async deleteExpiredRecords(client, policy, records) {
    const result = {
      deleted: 0,
      errors: [],
    };

    if (records.length === 0) {
      return result;
    }

    try {
      // Delete records in batches
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const ids = batch.map(record => record.id);
        
        try {
          const deleteQuery = `DELETE FROM ${policy.dataType} WHERE id = ANY($1)`;
          const deleteResult = await client.query(deleteQuery, [ids]);
          result.deleted += deleteResult.rowCount;
        } catch (error) {
          logger.error(`Error deleting batch for ${policy.name}:`, error);
          result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        }
      }

      logger.info(`Deleted ${result.deleted} records for policy ${policy.name}`);

    } catch (error) {
      logger.error(`Error deleting records for ${policy.name}:`, error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Log data anonymization operation
   */
  async logDataAnonymization(client, policy, records, anonymizationType) {
    if (records.length === 0) return;

    try {
      const logEntries = records.map(record => [
        policy.dataType,
        record.id,
        anonymizationType,
        JSON.stringify(['*']), // All fields affected
        'retention_expired',
        'system',
        'automatic',
        null, // verification_hash would be computed if needed
        false, // not reversible
        new Date().toISOString(),
      ]);

      const query = `
        INSERT INTO data_anonymization_log (
          table_name, record_id, anonymization_type, fields_affected,
          reason, processed_by, processing_method, verification_hash,
          reversible, processed_at
        ) VALUES ${logEntries.map((_, i) => `(${Array.from({ length: 10 }, (_, j) => `$${i * 10 + j + 1}`).join(', ')})`).join(', ')}
      `;

      const params = logEntries.flat();
      await client.query(query, params);

    } catch (error) {
      logger.error('Error logging data anonymization:', error);
    }
  }

  /**
   * Update policy last applied timestamp
   */
  async updatePolicyLastApplied(policyId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE data_retention_policies 
        SET last_applied = NOW(), updated_at = NOW()
        WHERE id = $1
      `;
      
      await client.query(query, [policyId]);
    } catch (error) {
      logger.error('Error updating policy last applied:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Log cleanup operation
   */
  async logCleanupOperation(results, executionTime) {
    try {
      const logEntry = {
        sessionId: 'system',
        query: 'Data retention cleanup',
        response: `Processed ${results.totalProcessed} records, deleted ${results.totalDeleted}, archived ${results.totalArchived}`,
        confidenceScore: 1.0,
        responseTime: executionTime,
        retrievedChunks: [],
        citations: [],
        sources: [],
        userAgent: 'DataRetentionManager/1.0',
        ipAddress: '127.0.0.1',
        messageId: `cleanup_${Date.now()}`,
      };

      await this.auditLogger.logInteraction(logEntry);

    } catch (error) {
      logger.error('Error logging cleanup operation:', error);
    }
  }

  /**
   * Manual cleanup execution
   */
  async runCleanup(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      policyNames = null,
      dryRun = false,
      maxRecords = 10000,
    } = options;

    logger.info('Starting manual data retention cleanup', {
      policyNames,
      dryRun,
      maxRecords,
    });

    const results = {
      totalProcessed: 0,
      totalDeleted: 0,
      totalArchived: 0,
      errors: [],
      policyResults: {},
      dryRun,
    };

    try {
      const policiesToApply = policyNames 
        ? Array.from(this.policies.entries()).filter(([name]) => policyNames.includes(name))
        : Array.from(this.policies.entries());

      for (const [policyName, policy] of policiesToApply) {
        logger.info(`Processing retention policy: ${policyName}`);

        try {
          let policyResult;
          if (dryRun) {
            policyResult = await this.simulateRetentionPolicy(policy, maxRecords);
          } else {
            policyResult = await this.applyRetentionPolicy(policy);
          }

          results.policyResults[policyName] = policyResult;
          results.totalProcessed += policyResult.processed;
          results.totalDeleted += policyResult.deleted;
          results.totalArchived += policyResult.archived;
          results.errors.push(...policyResult.errors);

        } catch (error) {
          logger.error(`Error processing policy ${policyName}:`, error);
          results.errors.push({
            policy: policyName,
            error: error.message,
          });
        }
      }

      return results;

    } catch (error) {
      logger.error('Manual cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Simulate retention policy application (dry run)
   */
  async simulateRetentionPolicy(policy, maxRecords) {
    const client = await this.pool.connect();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const recordsQuery = this.buildRetentionQuery(policy, cutoffDate);
      recordsQuery.query = recordsQuery.query.replace(/LIMIT \d+/, `LIMIT ${maxRecords}`);
      
      const recordsResult = await client.query(recordsQuery.query, recordsQuery.params);

      return {
        policy: policy.name,
        processed: recordsResult.rows.length,
        deleted: recordsResult.rows.length, // Would be deleted
        archived: policy.archiveBeforeDelete ? recordsResult.rows.length : 0,
        errors: [],
        simulation: true,
      };

    } finally {
      client.release();
    }
  }

  /**
   * Get retention policies
   */
  async getPolicies() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return Array.from(this.policies.values());
  }

  /**
   * Create new retention policy
   */
  async createPolicy(policyData) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO data_retention_policies (
          policy_name, data_type, retention_days, auto_delete,
          archive_before_delete, archive_location, conditions,
          description, compliance_requirement, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        policyData.name,
        policyData.dataType,
        policyData.retentionDays,
        policyData.autoDelete !== false,
        policyData.archiveBeforeDelete === true,
        policyData.archiveLocation,
        JSON.stringify(policyData.conditions || {}),
        policyData.description,
        policyData.complianceRequirement,
        policyData.createdBy,
      ];

      const result = await client.query(query, values);
      
      // Reload policies
      await this.loadRetentionPolicies();
      
      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Update retention policy
   */
  async updatePolicy(policyId, updateData) {
    const client = await this.pool.connect();
    
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(updateData).forEach(([key, value]) => {
        if (key === 'conditions') {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        } else if (key !== 'id') {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(policyId);

      const query = `
        UPDATE data_retention_policies 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Policy not found');
      }

      // Reload policies
      await this.loadRetentionPolicies();
      
      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Delete retention policy
   */
  async deletePolicy(policyId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE data_retention_policies 
        SET active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [policyId]);
      
      if (result.rows.length === 0) {
        throw new Error('Policy not found');
      }

      // Reload policies
      await this.loadRetentionPolicies();
      
      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Get retention statistics
   */
  async getRetentionStats() {
    const client = await this.pool.connect();
    
    try {
      const stats = {};

      // Get stats for each data type
      const dataTypes = ['audit_logs', 'audit_pii_details', 'audit_session_stats', 'audit_errors', 'admin_access_logs'];
      
      for (const dataType of dataTypes) {
        const query = `
          SELECT 
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days') as records_30_days,
            COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') as records_90_days,
            COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '365 days') as records_1_year,
            MIN(created_at) as oldest_record,
            MAX(created_at) as newest_record
          FROM ${dataType}
        `;

        try {
          const result = await client.query(query);
          stats[dataType] = result.rows[0];
        } catch (error) {
          logger.warn(`Error getting stats for ${dataType}:`, error.message);
          stats[dataType] = { error: error.message };
        }
      }

      // Get archive stats if archive tables exist
      for (const dataType of dataTypes) {
        const archiveTable = `archived_${dataType}`;
        const query = `
          SELECT 
            COUNT(*) as archived_records,
            MIN(archived_at) as oldest_archive,
            MAX(archived_at) as newest_archive
          FROM ${archiveTable}
        `;

        try {
          const result = await client.query(query);
          stats[`${dataType}_archived`] = result.rows[0];
        } catch (error) {
          // Archive table doesn't exist or is empty
          stats[`${dataType}_archived`] = { archived_records: 0 };
        }
      }

      return stats;

    } finally {
      client.release();
    }
  }

  /**
   * Start scheduled jobs
   */
  startScheduledJobs() {
    this.scheduledJobs.forEach((job, name) => {
      if (!job.running) {
        job.start();
        logger.info(`Started scheduled job: ${name}`);
      }
    });
  }

  /**
   * Stop scheduled jobs
   */
  stopScheduledJobs() {
    this.scheduledJobs.forEach((job, name) => {
      if (job.running) {
        job.stop();
        logger.info(`Stopped scheduled job: ${name}`);
      }
    });
  }

  /**
   * Close database connections and stop jobs
   */
  async close() {
    this.stopScheduledJobs();
    await this.pool.end();
    logger.info('Data Retention Manager closed');
  }
}

module.exports = DataRetentionManager;
