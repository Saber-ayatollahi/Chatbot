/**
 * Data Lifecycle Manager
 * Manages data retention, archival, and deletion policies
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const EncryptionManager = require('./EncryptionManager');

class DataLifecycleManager {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.lifecycleConfig = this.config?.dataLifecycle || {
      timezone: 'UTC',
      dailyCleanupTime: '0 2 * * *', // 2 AM daily
      weeklyArchivalTime: '0 3 * * 0', // 3 AM on Sundays
      defaultRetentionDays: 365,
      archiveDirectory: './backups/archives',
    };
    
    const connectionString = this.config?.database?.url || 
                            process.env.DATABASE_URL || 
                            'postgresql://postgres:@localhost:5432/fund_chatbot';
    
    this.pool = new Pool({ connectionString: connectionString });
    this.encryptionManager = new EncryptionManager();
    this.scheduledJobs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the data lifecycle manager
   */
  async initialize() {
    try {
      await this.encryptionManager.initialize();
      await this.loadRetentionPolicies();
      await this.scheduleCleanupJobs();
      
      this.initialized = true;
      logger.info('Data Lifecycle Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Data Lifecycle Manager:', error);
      throw error;
    }
  }

  /**
   * Load retention policies from database
   */
  async loadRetentionPolicies() {
    try {
      const client = await this.pool.connect();
      const query = 'SELECT * FROM data_retention_policies ORDER BY table_name';
      const result = await client.query(query);
      client.release();

      this.retentionPolicies = new Map();
      
      // Robust handling of query results
      const policies = result?.rows || [];
      for (const policy of policies) {
        this.retentionPolicies.set(policy.table_name, {
          retentionDays: policy.retention_days,
          lastCleanupRun: policy.last_cleanup_run,
          createdAt: policy.created_at,
          updatedAt: policy.updated_at,
        });
      }

      logger.info(`Loaded ${this.retentionPolicies.size} retention policies`, {
        policies: Array.from(this.retentionPolicies.keys()),
      });

    } catch (error) {
      logger.error('Failed to load retention policies:', error);
      throw error;
    }
  }

  /**
   * Schedule automated cleanup jobs
   */
  async scheduleCleanupJobs() {
    try {
      // Daily cleanup at 2 AM
      const dailyCleanup = cron.schedule('0 2 * * *', async () => {
        logger.info('Starting scheduled daily cleanup');
        await this.runDataCleanup();
      }, {
        scheduled: false,
        timezone: this.lifecycleConfig.timezone,
      });

      // Weekly archival on Sundays at 3 AM
      const weeklyArchival = cron.schedule('0 3 * * 0', async () => {
        logger.info('Starting scheduled weekly archival');
        await this.runDataArchival();
      }, {
        scheduled: false,
        timezone: this.lifecycleConfig.timezone,
      });

      // Monthly compliance report on 1st of each month at 4 AM
      const monthlyReport = cron.schedule('0 4 1 * *', async () => {
        logger.info('Starting scheduled monthly compliance report');
        await this.generateComplianceReport();
      }, {
        scheduled: false,
        timezone: this.lifecycleConfig.timezone,
      });

      this.scheduledJobs.set('dailyCleanup', dailyCleanup);
      this.scheduledJobs.set('weeklyArchival', weeklyArchival);
      this.scheduledJobs.set('monthlyReport', monthlyReport);

      // Start all jobs
      for (const [jobName, job] of this.scheduledJobs.entries()) {
        job.start();
        logger.info(`Scheduled job started: ${jobName}`);
      }

    } catch (error) {
      logger.error('Failed to schedule cleanup jobs:', error);
      throw error;
    }
  }

  /**
   * Run data cleanup based on retention policies
   */
  async runDataCleanup() {
    const cleanupResults = {
      startTime: new Date(),
      tablesProcessed: 0,
      recordsDeleted: 0,
      errors: [],
      success: true,
    };

    try {
      logger.info('Starting data cleanup process');

      for (const [tableName, policy] of this.retentionPolicies.entries()) {
        try {
          const deletedCount = await this.cleanupTable(tableName, policy.retentionDays);
          
          cleanupResults.tablesProcessed++;
          cleanupResults.recordsDeleted += deletedCount;
          
          // Update last cleanup run timestamp
          await this.updateLastCleanupRun(tableName);
          
          logger.info(`Cleanup completed for table: ${tableName}`, {
            table: tableName,
            deletedRecords: deletedCount,
            retentionDays: policy.retentionDays,
          });

        } catch (error) {
          cleanupResults.errors.push({
            table: tableName,
            error: error.message,
          });
          
          logger.error(`Cleanup failed for table: ${tableName}`, error);
        }
      }

      cleanupResults.endTime = new Date();
      cleanupResults.duration = cleanupResults.endTime - cleanupResults.startTime;
      cleanupResults.success = cleanupResults.errors.length === 0;

      logger.info('Data cleanup process completed', cleanupResults);
      
      return cleanupResults;

    } catch (error) {
      cleanupResults.success = false;
      cleanupResults.errors.push({ error: error.message });
      
      logger.error('Data cleanup process failed:', error);
      return cleanupResults;
    }
  }

  /**
   * Clean up specific table based on retention policy
   */
  async cleanupTable(tableName, retentionDays) {
    try {
      const client = await this.pool.connect();
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let query;
      let values;

      // Handle different table structures
      switch (tableName) {
        case 'audit_logs':
          query = 'DELETE FROM audit_logs WHERE created_at < $1';
          values = [cutoffDate.toISOString()];
          break;
          
        case 'conversations':
          query = 'DELETE FROM conversations WHERE created_at < $1';
          values = [cutoffDate.toISOString()];
          break;
          
        case 'chat_sessions':
          query = 'DELETE FROM chat_sessions WHERE created_at < $1';
          values = [cutoffDate.toISOString()];
          break;
          
        case 'embeddings':
          // For embeddings, we might want to keep them longer
          // or have a different cleanup strategy
          query = 'DELETE FROM embeddings WHERE created_at < $1 AND is_archived = true';
          values = [cutoffDate.toISOString()];
          break;
          
        default:
          // Generic cleanup for tables with created_at column
          query = `DELETE FROM ${tableName} WHERE created_at < $1`;
          values = [cutoffDate.toISOString()];
      }

      const result = await client.query(query, values);
      client.release();
      
      return result.rowCount || 0;

    } catch (error) {
      logger.error(`Failed to cleanup table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update last cleanup run timestamp
   */
  async updateLastCleanupRun(tableName) {
    try {
      const client = await this.pool.connect();
      const query = `
        UPDATE data_retention_policies 
        SET last_cleanup_run = CURRENT_TIMESTAMP 
        WHERE table_name = $1
      `;
      await client.query(query, [tableName]);
      client.release();

    } catch (error) {
      logger.error(`Failed to update last cleanup run for ${tableName}:`, error);
    }
  }

  /**
   * Archive old data to encrypted storage
   */
  async runDataArchival() {
    const archivalResults = {
      startTime: new Date(),
      tablesProcessed: 0,
      recordsArchived: 0,
      archiveFiles: [],
      errors: [],
      success: true,
    };

    try {
      logger.info('Starting data archival process');

      // Create archive directory
      const archiveDir = path.join(process.cwd(), 'archives', 
        new Date().getFullYear().toString(),
        (new Date().getMonth() + 1).toString().padStart(2, '0')
      );
      
      await fs.mkdir(archiveDir, { recursive: true });

      // Archive audit logs older than 90 days but newer than retention period
      const auditArchiveResult = await this.archiveAuditLogs(archiveDir);
      archivalResults.recordsArchived += auditArchiveResult.recordCount;
      archivalResults.archiveFiles.push(auditArchiveResult.filePath);

      // Archive conversations older than 30 days
      const conversationArchiveResult = await this.archiveConversations(archiveDir);
      archivalResults.recordsArchived += conversationArchiveResult.recordCount;
      archivalResults.archiveFiles.push(conversationArchiveResult.filePath);

      archivalResults.endTime = new Date();
      archivalResults.duration = archivalResults.endTime - archivalResults.startTime;
      archivalResults.success = archivalResults.errors.length === 0;

      logger.info('Data archival process completed', archivalResults);
      
      return archivalResults;

    } catch (error) {
      archivalResults.success = false;
      archivalResults.errors.push({ error: error.message });
      
      logger.error('Data archival process failed:', error);
      return archivalResults;
    }
  }

  /**
   * Archive audit logs
   */
  async archiveAuditLogs(archiveDir) {
    try {
      const client = await this.pool.connect();
      
      // Get audit logs older than 90 days but newer than 365 days (retention period)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 90);
      
      const query = `
        SELECT * FROM audit_logs 
        WHERE created_at >= $1 AND created_at < $2
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [startDate.toISOString(), endDate.toISOString()]);
      client.release();

      // Robust handling of query results
      const rows = result?.rows || [];
      if (rows.length === 0) {
        logger.info('No audit logs to archive');
        return { recordCount: 0, filePath: null };
      }

      // Encrypt and save archive
      const archiveData = {
        metadata: {
          table: 'audit_logs',
          recordCount: rows.length,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          archivedAt: new Date().toISOString(),
        },
        records: rows,
      };

      const encryptedArchive = this.encryptionManager.encrypt(archiveData, 'audit');
      const fileName = `audit_logs_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.enc`;
      const filePath = path.join(archiveDir, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(encryptedArchive, null, 2));
      
      // Mark records as archived (optional - add archived flag to schema)
      // await this.markRecordsAsArchived('audit_logs', rows.map(r => r.id));

      logger.info(`Archived ${rows.length} audit log records to ${filePath}`);
      
      return { recordCount: rows.length, filePath };

    } catch (error) {
      logger.error('Failed to archive audit logs:', error);
      throw error;
    }
  }

  /**
   * Archive conversations
   */
  async archiveConversations(archiveDir) {
    try {
      const client = await this.pool.connect();
      
      // Get conversations older than 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      const query = `
        SELECT * FROM conversations 
        WHERE created_at < $1
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [cutoffDate.toISOString()]);
      client.release();

      // Robust handling of query results
      const rows = result?.rows || [];
      if (rows.length === 0) {
        logger.info('No conversations to archive');
        return { recordCount: 0, filePath: null };
      }

      // Encrypt and save archive
      const archiveData = {
        metadata: {
          table: 'conversations',
          recordCount: rows.length,
          cutoffDate: cutoffDate.toISOString(),
          archivedAt: new Date().toISOString(),
        },
        records: rows,
      };

      const encryptedArchive = this.encryptionManager.encrypt(archiveData, 'session');
      const fileName = `conversations_${cutoffDate.toISOString().split('T')[0]}.enc`;
      const filePath = path.join(archiveDir, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(encryptedArchive, null, 2));
      
      logger.info(`Archived ${rows.length} conversation records to ${filePath}`);
      
      return { recordCount: rows.length, filePath };

    } catch (error) {
      logger.error('Failed to archive conversations:', error);
      throw error;
    }
  }

  /**
   * Restore data from archive
   */
  async restoreFromArchive(archiveFilePath, options = {}) {
    try {
      logger.info(`Starting data restoration from: ${archiveFilePath}`);

      // Read and decrypt archive
      const archiveContent = await fs.readFile(archiveFilePath, 'utf8');
      const encryptedData = JSON.parse(archiveContent);
      
      let keyType = 'audit';
      if (archiveFilePath.includes('conversations')) {
        keyType = 'session';
      }
      
      const decryptedData = this.encryptionManager.decrypt(encryptedData, keyType);
      
      if (!decryptedData.metadata || !decryptedData.records) {
        throw new Error('Invalid archive format');
      }

      const { metadata, records } = decryptedData;
      
      // Validate archive integrity
      if (records.length !== metadata.recordCount) {
        throw new Error('Archive integrity check failed: record count mismatch');
      }

      if (options.dryRun) {
        logger.info('Dry run - would restore:', {
          table: metadata.table,
          recordCount: metadata.recordCount,
          archiveDate: metadata.archivedAt,
        });
        return { success: true, dryRun: true, recordCount: metadata.recordCount };
      }

      // Restore records to database
      const client = await this.pool.connect();
      let restoredCount = 0;

      try {
        await client.query('BEGIN');

        for (const record of records) {
          // Remove id to avoid conflicts, let database generate new ones
          const { id, ...recordData } = record;
          
          const columns = Object.keys(recordData);
          const values = Object.values(recordData);
          const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
          
          const insertQuery = `
            INSERT INTO ${metadata.table} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          
          await client.query(insertQuery, values);
          restoredCount++;
        }

        await client.query('COMMIT');
        
        logger.info(`Successfully restored ${restoredCount} records from archive`);
        
        return {
          success: true,
          recordCount: restoredCount,
          table: metadata.table,
          archiveDate: metadata.archivedAt,
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to restore from archive:', error);
      throw error;
    }
  }

  /**
   * Get data lifecycle statistics
   */
  async getLifecycleStats() {
    try {
      const stats = {
        retentionPolicies: Array.from(this.retentionPolicies.entries()).map(([table, policy]) => ({
          table,
          retentionDays: policy.retentionDays,
          lastCleanupRun: policy.lastCleanupRun,
        })),
        scheduledJobs: Array.from(this.scheduledJobs.keys()),
        tableStats: {},
      };

      // Get current record counts for each table
      const client = await this.pool.connect();
      
      for (const tableName of this.retentionPolicies.keys()) {
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
          const result = await client.query(countQuery);
          
          const ageQuery = `
            SELECT 
              MIN(created_at) as oldest_record,
              MAX(created_at) as newest_record
            FROM ${tableName}
          `;
          const ageResult = await client.query(ageQuery);
          
          stats.tableStats[tableName] = {
            totalRecords: parseInt(result?.rows?.[0]?.count || 0, 10),
            oldestRecord: ageResult?.rows?.[0]?.oldest_record || null,
            newestRecord: ageResult?.rows?.[0]?.newest_record || null,
          };

        } catch (error) {
          stats.tableStats[tableName] = { error: error.message };
        }
      }
      
      client.release();
      
      return stats;

    } catch (error) {
      logger.error('Failed to get lifecycle stats:', error);
      throw error;
    }
  }

  /**
   * Update retention policy
   */
  async updateRetentionPolicy(tableName, retentionDays) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        UPDATE data_retention_policies 
        SET retention_days = $1, updated_at = CURRENT_TIMESTAMP
        WHERE table_name = $2
      `;
      
      const result = await client.query(query, [retentionDays, tableName]);
      client.release();

      if (result.rowCount === 0) {
        // Insert new policy if it doesn't exist
        const insertQuery = `
          INSERT INTO data_retention_policies (table_name, retention_days)
          VALUES ($1, $2)
        `;
        
        const insertClient = await this.pool.connect();
        await insertClient.query(insertQuery, [tableName, retentionDays]);
        insertClient.release();
      }

      // Update in-memory cache
      const existingPolicy = this.retentionPolicies.get(tableName) || {};
      this.retentionPolicies.set(tableName, {
        ...existingPolicy,
        retentionDays,
        updatedAt: new Date(),
      });

      logger.info(`Updated retention policy for ${tableName}: ${retentionDays} days`);
      
      return { success: true, tableName, retentionDays };

    } catch (error) {
      logger.error(`Failed to update retention policy for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport() {
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          end: new Date().toISOString(),
        },
        dataLifecycle: await this.getLifecycleStats(),
        cleanupHistory: await this.getCleanupHistory(),
        archiveStats: await this.getArchiveStats(),
        complianceStatus: 'COMPLIANT', // This could be calculated based on various factors
      };

      // Save report
      const reportDir = path.join(process.cwd(), 'reports', 'compliance');
      await fs.mkdir(reportDir, { recursive: true });
      
      const fileName = `compliance_report_${new Date().toISOString().split('T')[0]}.json`;
      const filePath = path.join(reportDir, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(report, null, 2));
      
      logger.info(`Generated compliance report: ${filePath}`);
      
      return { success: true, reportPath: filePath, report };

    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Get cleanup history
   */
  async getCleanupHistory() {
    try {
      const client = await this.pool.connect();
      const query = `
        SELECT table_name, last_cleanup_run, retention_days
        FROM data_retention_policies
        WHERE last_cleanup_run IS NOT NULL
        ORDER BY last_cleanup_run DESC
      `;
      
      const result = await client.query(query);
      client.release();
      
      return result?.rows || [];

    } catch (error) {
      logger.error('Failed to get cleanup history:', error);
      return [];
    }
  }

  /**
   * Get archive statistics
   */
  async getArchiveStats() {
    try {
      const archiveDir = path.join(process.cwd(), 'archives');
      const stats = {
        totalArchives: 0,
        totalSize: 0,
        archivesByYear: {},
      };

      try {
        const years = await fs.readdir(archiveDir);
        
        for (const year of years) {
          const yearPath = path.join(archiveDir, year);
          const yearStat = await fs.stat(yearPath);
          
          if (yearStat.isDirectory()) {
            stats.archivesByYear[year] = {
              months: {},
              totalFiles: 0,
              totalSize: 0,
            };
            
            const months = await fs.readdir(yearPath);
            
            for (const month of months) {
              const monthPath = path.join(yearPath, month);
              const monthStat = await fs.stat(monthPath);
              
              if (monthStat.isDirectory()) {
                const files = await fs.readdir(monthPath);
                let monthSize = 0;
                
                for (const file of files) {
                  const filePath = path.join(monthPath, file);
                  const fileStat = await fs.stat(filePath);
                  monthSize += fileStat.size;
                }
                
                stats.archivesByYear[year].months[month] = {
                  fileCount: files.length,
                  size: monthSize,
                };
                
                stats.archivesByYear[year].totalFiles += files.length;
                stats.archivesByYear[year].totalSize += monthSize;
                stats.totalArchives += files.length;
                stats.totalSize += monthSize;
              }
            }
          }
        }

      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Archive directory doesn't exist yet
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get archive stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Perform manual cleanup for specific table
   */
  async manualCleanup(tableName, options = {}) {
    try {
      let policy = this.retentionPolicies.get(tableName);
      
      // If no policy exists, create a default one for common tables
      if (!policy) {
        const defaultRetentionDays = this.lifecycleConfig.defaultRetentionDays;
        
        if (['audit_logs', 'kb_chunks', 'conversations'].includes(tableName)) {
          policy = {
            retentionDays: defaultRetentionDays,
            lastCleanupRun: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          // Store the default policy
          this.retentionPolicies.set(tableName, policy);
          
          logger.info(`Created default retention policy for table: ${tableName} (${defaultRetentionDays} days)`);
        } else {
          throw new Error(`No retention policy found for table: ${tableName}`);
        }
      }

      const retentionDays = options.retentionDays || policy.retentionDays;
      
      if (options.dryRun) {
        // Count records that would be deleted
        const client = await this.pool.connect();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE created_at < $1`;
        const result = await client.query(countQuery, [cutoffDate.toISOString()]);
        client.release();
        
        return {
          dryRun: true,
          tableName,
          recordsToDelete: parseInt(result?.rows?.[0]?.count || 0, 10),
          cutoffDate: cutoffDate.toISOString(),
        };
      }

      const deletedCount = await this.cleanupTable(tableName, retentionDays);
      await this.updateLastCleanupRun(tableName);
      
      return {
        success: true,
        tableName,
        deletedRecords: deletedCount,
        retentionDays,
      };

    } catch (error) {
      logger.error(`Manual cleanup failed for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopScheduledJobs() {
    for (const [jobName, job] of this.scheduledJobs.entries()) {
      job.stop();
      logger.info(`Stopped scheduled job: ${jobName}`);
    }
  }

  /**
   * Start all scheduled jobs
   */
  startScheduledJobs() {
    for (const [jobName, job] of this.scheduledJobs.entries()) {
      job.start();
      logger.info(`Started scheduled job: ${jobName}`);
    }
  }

  /**
   * Close and cleanup
   */
  async close() {
    this.stopScheduledJobs();
    await this.pool.end();
    await this.encryptionManager.close();
    
    this.initialized = false;
    logger.info('Data Lifecycle Manager closed');
  }
}

module.exports = DataLifecycleManager;
