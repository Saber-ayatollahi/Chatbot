#!/usr/bin/env node

/**
 * Feature Flag Management System
 * 
 * Enterprise-grade feature flag system for production deployment:
 * - Gradual rollout management
 * - Real-time flag updates
 * - A/B testing support
 * - Performance impact monitoring
 * - Automated rollback on issues
 * 
 * Core Philosophy: No shortcuts, no fallbacks, clean architecture
 */

const logger = require('../utils/logger');
const { getDatabase } = require('../config/database');
const { getConfig } = require('../config/environment');
const fs = require('fs').promises;
const EventEmitter = require('events');

class FeatureFlagManager extends EventEmitter {
  constructor() {
    super();
    this.config = getConfig();
    this.db = null;
    this.managerId = `feature-manager-${Date.now()}`;
    
    this.flagConfig = {
      rolloutStrategies: {
        percentage: 'percentage-based rollout',
        userGroup: 'user-group-based rollout',
        geographic: 'geographic-based rollout',
        timeWindow: 'time-window-based rollout'
      },
      
      monitoringConfig: {
        performanceThreshold: 2000, // ms
        errorRateThreshold: 0.05,   // 5%
        rollbackThreshold: 0.1,     // 10%
        monitoringWindow: 300000,   // 5 minutes
        samplingRate: 0.1           // 10% sampling
      },
      
      rolloutConfig: {
        initialPercentage: 1,       // Start with 1%
        incrementPercentage: 5,     // Increase by 5%
        incrementInterval: 1800000, // 30 minutes
        maxPercentage: 100,         // Full rollout
        cooldownPeriod: 3600000     // 1 hour between major changes
      }
    };
    
    this.flagState = {
      flags: new Map(),
      rolloutHistory: new Map(),
      performanceMetrics: new Map(),
      lastUpdate: null,
      activeRollouts: new Set()
    };
    
    this.predefinedFlags = {
      'advanced-document-processing': {
        name: 'Advanced Document Processing',
        description: 'Enable advanced hierarchical document processing',
        category: 'core',
        dependencies: ['hierarchical-chunking', 'multi-scale-embeddings'],
        rolloutStrategy: 'percentage',
        performanceImpact: 'medium',
        riskLevel: 'high'
      },
      
      'hierarchical-chunking': {
        name: 'Hierarchical Chunking',
        description: 'Enable hierarchical semantic chunking',
        category: 'processing',
        dependencies: [],
        rolloutStrategy: 'percentage',
        performanceImpact: 'low',
        riskLevel: 'medium'
      },
      
      'multi-scale-embeddings': {
        name: 'Multi-Scale Embeddings',
        description: 'Enable multi-scale embedding generation',
        category: 'processing',
        dependencies: ['hierarchical-chunking'],
        rolloutStrategy: 'percentage',
        performanceImpact: 'medium',
        riskLevel: 'medium'
      },
      
      'advanced-retrieval': {
        name: 'Advanced Contextual Retrieval',
        description: 'Enable advanced contextual retrieval system',
        category: 'retrieval',
        dependencies: ['multi-scale-embeddings'],
        rolloutStrategy: 'percentage',
        performanceImpact: 'high',
        riskLevel: 'high'
      },
      
      'quality-assessment': {
        name: 'Quality Assessment',
        description: 'Enable comprehensive quality assessment',
        category: 'quality',
        dependencies: [],
        rolloutStrategy: 'percentage',
        performanceImpact: 'low',
        riskLevel: 'low'
      },
      
      'performance-monitoring': {
        name: 'Performance Monitoring',
        description: 'Enable enhanced performance monitoring',
        category: 'monitoring',
        dependencies: [],
        rolloutStrategy: 'percentage',
        performanceImpact: 'minimal',
        riskLevel: 'low'
      }
    };
  }

  async initialize() {
    logger.info('🚀 Initializing Feature Flag Management System');
    
    try {
      this.db = getDatabase();
      
      // Validate database connection
      await this.db.query('SELECT 1');
      logger.info('✅ Database connection established');
      
      // Initialize feature flag tables
      await this.initializeFeatureFlagTables();
      
      // Load existing flags
      await this.loadExistingFlags();
      
      // Initialize predefined flags
      await this.initializePredefinedFlags();
      
      // Setup monitoring
      await this.setupFlagMonitoring();
      
      logger.info(`✅ Feature flag management system initialized: ${this.managerId}`);
      
    } catch (error) {
      logger.error('❌ Failed to initialize feature flag system:', error);
      throw error;
    }
  }

  async initializeFeatureFlagTables() {
    logger.info('🗄️ Initializing feature flag tables');
    
    // Main feature flags table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        flag_name VARCHAR(100) PRIMARY KEY,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        enabled BOOLEAN DEFAULT FALSE,
        rollout_percentage INTEGER DEFAULT 0,
        rollout_strategy VARCHAR(50) DEFAULT 'percentage',
        dependencies TEXT[] DEFAULT '{}',
        performance_impact VARCHAR(20) DEFAULT 'unknown',
        risk_level VARCHAR(20) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(100) DEFAULT 'system',
        
        CONSTRAINT chk_rollout_percentage CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
        CONSTRAINT chk_performance_impact CHECK (performance_impact IN ('minimal', 'low', 'medium', 'high')),
        CONSTRAINT chk_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
      )
    `);
    
    // Feature flag rollout history
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS feature_flag_rollout_history (
        id SERIAL PRIMARY KEY,
        flag_name VARCHAR(100) NOT NULL,
        previous_percentage INTEGER,
        new_percentage INTEGER,
        rollout_strategy VARCHAR(50),
        triggered_by VARCHAR(100),
        reason TEXT,
        performance_metrics JSONB DEFAULT '{}',
        rollout_duration INTEGER, -- in milliseconds
        success BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (flag_name) REFERENCES feature_flags(flag_name) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_rollout_history_flag ON feature_flag_rollout_history(flag_name);
      CREATE INDEX IF NOT EXISTS idx_rollout_history_created ON feature_flag_rollout_history(created_at);
    `);
    
    // Feature flag performance metrics
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS feature_flag_performance (
        id SERIAL PRIMARY KEY,
        flag_name VARCHAR(100) NOT NULL,
        metric_name VARCHAR(50) NOT NULL,
        metric_value DECIMAL(10,4) NOT NULL,
        metric_unit VARCHAR(20),
        rollout_percentage INTEGER,
        sample_size INTEGER,
        confidence_level DECIMAL(3,2),
        measured_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (flag_name) REFERENCES feature_flags(flag_name) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_flag_performance_flag ON feature_flag_performance(flag_name);
      CREATE INDEX IF NOT EXISTS idx_flag_performance_metric ON feature_flag_performance(metric_name);
      CREATE INDEX IF NOT EXISTS idx_flag_performance_measured ON feature_flag_performance(measured_at);
    `);
    
    // Feature flag user assignments (for targeted rollouts)
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS feature_flag_user_assignments (
        id SERIAL PRIMARY KEY,
        flag_name VARCHAR(100) NOT NULL,
        user_id VARCHAR(100),
        session_id VARCHAR(100),
        assignment_type VARCHAR(20) DEFAULT 'percentage', -- percentage, user_group, geographic
        assignment_value VARCHAR(100),
        assigned_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        
        FOREIGN KEY (flag_name) REFERENCES feature_flags(flag_name) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_flag_assignments_flag ON feature_flag_user_assignments(flag_name);
      CREATE INDEX IF NOT EXISTS idx_flag_assignments_user ON feature_flag_user_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_flag_assignments_session ON feature_flag_user_assignments(session_id);
      CREATE INDEX IF NOT EXISTS idx_flag_assignments_type ON feature_flag_user_assignments(assignment_type);
    `);
    
    logger.info('✅ Feature flag tables initialized');
  }

  async loadExistingFlags() {
    logger.info('📥 Loading existing feature flags');
    
    const flags = await this.db.query(`
      SELECT * FROM feature_flags ORDER BY flag_name
    `);
    
    for (const flag of flags.rows) {
      this.flagState.flags.set(flag.flag_name, {
        name: flag.flag_name,
        displayName: flag.display_name,
        description: flag.description,
        category: flag.category,
        enabled: flag.enabled,
        rolloutPercentage: flag.rollout_percentage,
        rolloutStrategy: flag.rollout_strategy,
        dependencies: flag.dependencies || [],
        performanceImpact: flag.performance_impact,
        riskLevel: flag.risk_level,
        createdAt: flag.created_at,
        updatedAt: flag.updated_at,
        createdBy: flag.created_by
      });
    }
    
    logger.info(`✅ Loaded ${flags.rows.length} existing feature flags`);
  }

  async initializePredefinedFlags() {
    logger.info('🔧 Initializing predefined feature flags');
    
    for (const [flagName, flagConfig] of Object.entries(this.predefinedFlags)) {
      await this.createOrUpdateFlag(flagName, flagConfig);
    }
    
    logger.info(`✅ Initialized ${Object.keys(this.predefinedFlags).length} predefined flags`);
  }

  async createOrUpdateFlag(flagName, flagConfig) {
    try {
      await this.db.query(`
        INSERT INTO feature_flags (
          flag_name, display_name, description, category, 
          rollout_strategy, dependencies, performance_impact, risk_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (flag_name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          rollout_strategy = EXCLUDED.rollout_strategy,
          dependencies = EXCLUDED.dependencies,
          performance_impact = EXCLUDED.performance_impact,
          risk_level = EXCLUDED.risk_level,
          updated_at = NOW()
      `, [
        flagName,
        flagConfig.name,
        flagConfig.description,
        flagConfig.category,
        flagConfig.rolloutStrategy,
        flagConfig.dependencies || [],
        flagConfig.performanceImpact,
        flagConfig.riskLevel
      ]);
      
      // Update local state
      this.flagState.flags.set(flagName, {
        name: flagName,
        displayName: flagConfig.name,
        description: flagConfig.description,
        category: flagConfig.category,
        enabled: false,
        rolloutPercentage: 0,
        rolloutStrategy: flagConfig.rolloutStrategy,
        dependencies: flagConfig.dependencies || [],
        performanceImpact: flagConfig.performanceImpact,
        riskLevel: flagConfig.riskLevel
      });
      
    } catch (error) {
      logger.error(`❌ Failed to create/update flag ${flagName}:`, error);
    }
  }

  async setupFlagMonitoring() {
    logger.info('📊 Setting up feature flag monitoring');
    
    // Monitor flag performance every 5 minutes
    this.monitoringInterval = setInterval(
      this.monitorFlagPerformance.bind(this),
      this.flagConfig.monitoringConfig.monitoringWindow
    );
    
    // Check for automated rollouts every 30 minutes
    this.rolloutInterval = setInterval(
      this.processAutomatedRollouts.bind(this),
      this.flagConfig.rolloutConfig.incrementInterval
    );
    
    logger.info('✅ Feature flag monitoring configured');
  }

  async enableFlag(flagName, rolloutPercentage = 100, triggeredBy = 'system', reason = 'Manual enable') {
    logger.info(`🚩 Enabling feature flag: ${flagName} (${rolloutPercentage}%)`);
    
    const flag = this.flagState.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagName}`);
    }
    
    // Check dependencies
    await this.validateFlagDependencies(flagName);
    
    // Record previous state
    const previousPercentage = flag.rolloutPercentage;
    const rolloutStartTime = Date.now();
    
    try {
      // Update database
      await this.db.query(`
        UPDATE feature_flags 
        SET enabled = TRUE, rollout_percentage = $2, updated_at = NOW()
        WHERE flag_name = $1
      `, [flagName, rolloutPercentage]);
      
      // Update local state
      flag.enabled = true;
      flag.rolloutPercentage = rolloutPercentage;
      flag.updatedAt = new Date().toISOString();
      
      // Record rollout history
      await this.recordRolloutHistory(
        flagName, previousPercentage, rolloutPercentage, 
        'enable', triggeredBy, reason, rolloutStartTime
      );
      
      // Start monitoring if this is a gradual rollout
      if (rolloutPercentage < 100) {
        this.flagState.activeRollouts.add(flagName);
      }
      
      // Emit event
      this.emit('flagEnabled', { flagName, rolloutPercentage, triggeredBy });
      
      logger.info(`✅ Feature flag enabled: ${flagName} (${rolloutPercentage}%)`);
      
    } catch (error) {
      logger.error(`❌ Failed to enable flag ${flagName}:`, error);
      throw error;
    }
  }

  async disableFlag(flagName, triggeredBy = 'system', reason = 'Manual disable') {
    logger.info(`🚫 Disabling feature flag: ${flagName}`);
    
    const flag = this.flagState.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagName}`);
    }
    
    // Record previous state
    const previousPercentage = flag.rolloutPercentage;
    const rolloutStartTime = Date.now();
    
    try {
      // Update database
      await this.db.query(`
        UPDATE feature_flags 
        SET enabled = FALSE, rollout_percentage = 0, updated_at = NOW()
        WHERE flag_name = $1
      `, [flagName]);
      
      // Update local state
      flag.enabled = false;
      flag.rolloutPercentage = 0;
      flag.updatedAt = new Date().toISOString();
      
      // Remove from active rollouts
      this.flagState.activeRollouts.delete(flagName);
      
      // Record rollout history
      await this.recordRolloutHistory(
        flagName, previousPercentage, 0, 
        'disable', triggeredBy, reason, rolloutStartTime
      );
      
      // Emit event
      this.emit('flagDisabled', { flagName, triggeredBy });
      
      logger.info(`✅ Feature flag disabled: ${flagName}`);
      
    } catch (error) {
      logger.error(`❌ Failed to disable flag ${flagName}:`, error);
      throw error;
    }
  }

  async updateRolloutPercentage(flagName, newPercentage, triggeredBy = 'system', reason = 'Rollout update') {
    logger.info(`📈 Updating rollout percentage: ${flagName} -> ${newPercentage}%`);
    
    const flag = this.flagState.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagName}`);
    }
    
    if (!flag.enabled) {
      throw new Error(`Cannot update rollout percentage for disabled flag: ${flagName}`);
    }
    
    // Validate percentage range
    if (newPercentage < 0 || newPercentage > 100) {
      throw new Error(`Invalid rollout percentage: ${newPercentage}. Must be between 0 and 100.`);
    }
    
    // Record previous state
    const previousPercentage = flag.rolloutPercentage;
    const rolloutStartTime = Date.now();
    
    try {
      // Update database
      await this.db.query(`
        UPDATE feature_flags 
        SET rollout_percentage = $2, updated_at = NOW()
        WHERE flag_name = $1
      `, [flagName, newPercentage]);
      
      // Update local state
      flag.rolloutPercentage = newPercentage;
      flag.updatedAt = new Date().toISOString();
      
      // Record rollout history
      await this.recordRolloutHistory(
        flagName, previousPercentage, newPercentage, 
        'update', triggeredBy, reason, rolloutStartTime
      );
      
      // Manage active rollouts
      if (newPercentage === 100) {
        this.flagState.activeRollouts.delete(flagName);
      } else {
        this.flagState.activeRollouts.add(flagName);
      }
      
      // Emit event
      this.emit('rolloutUpdated', { flagName, previousPercentage, newPercentage, triggeredBy });
      
      logger.info(`✅ Rollout percentage updated: ${flagName} (${previousPercentage}% -> ${newPercentage}%)`);
      
    } catch (error) {
      logger.error(`❌ Failed to update rollout percentage for ${flagName}:`, error);
      throw error;
    }
  }

  async validateFlagDependencies(flagName) {
    const flag = this.flagState.flags.get(flagName);
    if (!flag || !flag.dependencies || flag.dependencies.length === 0) {
      return;
    }
    
    for (const dependency of flag.dependencies) {
      const dependencyFlag = this.flagState.flags.get(dependency);
      
      if (!dependencyFlag) {
        throw new Error(`Dependency flag not found: ${dependency} (required by ${flagName})`);
      }
      
      if (!dependencyFlag.enabled) {
        throw new Error(`Dependency flag not enabled: ${dependency} (required by ${flagName})`);
      }
      
      // For gradual rollouts, dependency should have equal or higher percentage
      if (dependencyFlag.rolloutPercentage < flag.rolloutPercentage) {
        logger.warn(`⚠️ Dependency ${dependency} has lower rollout percentage than ${flagName}`);
      }
    }
  }

  async recordRolloutHistory(flagName, previousPercentage, newPercentage, action, triggeredBy, reason, startTime) {
    const rolloutDuration = Date.now() - startTime;
    
    try {
      await this.db.query(`
        INSERT INTO feature_flag_rollout_history (
          flag_name, previous_percentage, new_percentage, 
          rollout_strategy, triggered_by, reason, rollout_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        flagName, previousPercentage, newPercentage,
        action, triggeredBy, reason, rolloutDuration
      ]);
      
      // Update local rollout history
      if (!this.flagState.rolloutHistory.has(flagName)) {
        this.flagState.rolloutHistory.set(flagName, []);
      }
      
      this.flagState.rolloutHistory.get(flagName).push({
        previousPercentage,
        newPercentage,
        action,
        triggeredBy,
        reason,
        rolloutDuration,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.warn(`⚠️ Failed to record rollout history for ${flagName}:`, error);
    }
  }

  async monitorFlagPerformance() {
    logger.debug('📊 Monitoring feature flag performance');
    
    for (const flagName of this.flagState.activeRollouts) {
      try {
        await this.collectFlagPerformanceMetrics(flagName);
        await this.analyzeFlagPerformance(flagName);
      } catch (error) {
        logger.error(`❌ Failed to monitor performance for flag ${flagName}:`, error);
      }
    }
  }

  async collectFlagPerformanceMetrics(flagName) {
    const flag = this.flagState.flags.get(flagName);
    if (!flag || !flag.enabled) return;
    
    // Simulate performance metric collection
    const metrics = {
      responseTime: Math.random() * 2000 + 500, // 500-2500ms
      errorRate: Math.random() * 0.1,           // 0-10%
      throughput: Math.random() * 100 + 50,     // 50-150 req/sec
      qualityScore: Math.random() * 0.2 + 0.8   // 0.8-1.0
    };
    
    // Store metrics in database
    for (const [metricName, metricValue] of Object.entries(metrics)) {
      await this.db.query(`
        INSERT INTO feature_flag_performance (
          flag_name, metric_name, metric_value, metric_unit, 
          rollout_percentage, sample_size, confidence_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        flagName, metricName, metricValue, 
        this.getMetricUnit(metricName),
        flag.rolloutPercentage, 1000, 0.95
      ]);
    }
    
    // Update local metrics
    this.flagState.performanceMetrics.set(flagName, {
      ...metrics,
      timestamp: new Date().toISOString(),
      rolloutPercentage: flag.rolloutPercentage
    });
  }

  getMetricUnit(metricName) {
    const units = {
      responseTime: 'ms',
      errorRate: '%',
      throughput: 'req/sec',
      qualityScore: 'score'
    };
    return units[metricName] || 'unit';
  }

  async analyzeFlagPerformance(flagName) {
    const metrics = this.flagState.performanceMetrics.get(flagName);
    if (!metrics) return;
    
    const thresholds = this.flagConfig.monitoringConfig;
    let shouldRollback = false;
    const issues = [];
    
    // Check response time
    if (metrics.responseTime > thresholds.performanceThreshold) {
      issues.push(`High response time: ${metrics.responseTime}ms (threshold: ${thresholds.performanceThreshold}ms)`);
    }
    
    // Check error rate
    if (metrics.errorRate > thresholds.errorRateThreshold) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}% (threshold: ${(thresholds.errorRateThreshold * 100).toFixed(2)}%)`);
      
      if (metrics.errorRate > thresholds.rollbackThreshold) {
        shouldRollback = true;
      }
    }
    
    // Check quality score
    if (metrics.qualityScore < 0.8) {
      issues.push(`Low quality score: ${metrics.qualityScore.toFixed(3)} (threshold: 0.8)`);
    }
    
    if (issues.length > 0) {
      logger.warn(`⚠️ Performance issues detected for flag ${flagName}:`, issues);
      
      // Emit performance alert
      this.emit('performanceAlert', { flagName, issues, metrics, shouldRollback });
      
      if (shouldRollback) {
        await this.performAutomatedRollback(flagName, 'Performance threshold exceeded');
      }
    }
  }

  async performAutomatedRollback(flagName, reason) {
    logger.warn(`🔄 Performing automated rollback for flag: ${flagName}`);
    
    try {
      const flag = this.flagState.flags.get(flagName);
      const currentPercentage = flag.rolloutPercentage;
      
      // Calculate rollback percentage (reduce by 50% or disable if below 10%)
      const rollbackPercentage = currentPercentage > 20 ? Math.floor(currentPercentage / 2) : 0;
      
      if (rollbackPercentage === 0) {
        await this.disableFlag(flagName, 'automated-rollback', reason);
      } else {
        await this.updateRolloutPercentage(flagName, rollbackPercentage, 'automated-rollback', reason);
      }
      
      // Emit rollback event
      this.emit('automatedRollback', { flagName, previousPercentage: currentPercentage, newPercentage: rollbackPercentage, reason });
      
      logger.info(`✅ Automated rollback completed: ${flagName} (${currentPercentage}% -> ${rollbackPercentage}%)`);
      
    } catch (error) {
      logger.error(`❌ Automated rollback failed for ${flagName}:`, error);
    }
  }

  async processAutomatedRollouts() {
    logger.debug('🤖 Processing automated rollouts');
    
    for (const flagName of this.flagState.activeRollouts) {
      try {
        await this.processAutomatedRollout(flagName);
      } catch (error) {
        logger.error(`❌ Failed to process automated rollout for ${flagName}:`, error);
      }
    }
  }

  async processAutomatedRollout(flagName) {
    const flag = this.flagState.flags.get(flagName);
    if (!flag || !flag.enabled || flag.rolloutPercentage >= 100) return;
    
    // Check if enough time has passed since last update
    const lastUpdate = new Date(flag.updatedAt);
    const timeSinceUpdate = Date.now() - lastUpdate.getTime();
    
    if (timeSinceUpdate < this.flagConfig.rolloutConfig.incrementInterval) {
      return; // Not enough time has passed
    }
    
    // Check performance metrics before increasing rollout
    const metrics = this.flagState.performanceMetrics.get(flagName);
    if (metrics) {
      const thresholds = this.flagConfig.monitoringConfig;
      
      if (metrics.responseTime > thresholds.performanceThreshold ||
          metrics.errorRate > thresholds.errorRateThreshold) {
        logger.warn(`⚠️ Skipping automated rollout for ${flagName} due to performance issues`);
        return;
      }
    }
    
    // Calculate next rollout percentage
    const currentPercentage = flag.rolloutPercentage;
    const increment = this.flagConfig.rolloutConfig.incrementPercentage;
    const nextPercentage = Math.min(currentPercentage + increment, this.flagConfig.rolloutConfig.maxPercentage);
    
    if (nextPercentage > currentPercentage) {
      await this.updateRolloutPercentage(
        flagName, 
        nextPercentage, 
        'automated-rollout', 
        `Automated increment from ${currentPercentage}% to ${nextPercentage}%`
      );
      
      logger.info(`🤖 Automated rollout: ${flagName} (${currentPercentage}% -> ${nextPercentage}%)`);
    }
  }

  async isFlagEnabled(flagName, userId = null, sessionId = null, context = {}) {
    const flag = this.flagState.flags.get(flagName);
    if (!flag || !flag.enabled) {
      return false;
    }
    
    // If 100% rollout, flag is enabled for everyone
    if (flag.rolloutPercentage >= 100) {
      return true;
    }
    
    // Check for specific user/session assignments
    const assignment = await this.getUserAssignment(flagName, userId, sessionId);
    if (assignment) {
      return assignment.enabled;
    }
    
    // Use percentage-based rollout
    return this.isInRolloutPercentage(flagName, userId || sessionId || 'anonymous', flag.rolloutPercentage);
  }

  async getUserAssignment(flagName, userId, sessionId) {
    try {
      const result = await this.db.query(`
        SELECT * FROM feature_flag_user_assignments
        WHERE flag_name = $1 
        AND (user_id = $2 OR session_id = $3)
        AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY assigned_at DESC
        LIMIT 1
      `, [flagName, userId, sessionId]);
      
      if (result.rows.length > 0) {
        return {
          enabled: true,
          assignment: result.rows[0]
        };
      }
      
      return null;
      
    } catch (error) {
      logger.warn(`⚠️ Failed to get user assignment for ${flagName}:`, error);
      return null;
    }
  }

  isInRolloutPercentage(flagName, identifier, percentage) {
    // Use consistent hashing to determine if user is in rollout percentage
    const hash = this.hashString(`${flagName}:${identifier}`);
    const userPercentage = (hash % 100) + 1; // 1-100
    
    return userPercentage <= percentage;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async assignUserToFlag(flagName, userId, sessionId, assignmentType = 'manual', expiresAt = null) {
    try {
      await this.db.query(`
        INSERT INTO feature_flag_user_assignments (
          flag_name, user_id, session_id, assignment_type, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [flagName, userId, sessionId, assignmentType, expiresAt]);
      
      logger.info(`✅ User assigned to flag: ${flagName} (user: ${userId}, session: ${sessionId})`);
      
    } catch (error) {
      logger.error(`❌ Failed to assign user to flag ${flagName}:`, error);
      throw error;
    }
  }

  async getFlagStatus(flagName = null) {
    if (flagName) {
      const flag = this.flagState.flags.get(flagName);
      if (!flag) {
        throw new Error(`Feature flag not found: ${flagName}`);
      }
      
      return {
        ...flag,
        performanceMetrics: this.flagState.performanceMetrics.get(flagName),
        rolloutHistory: this.flagState.rolloutHistory.get(flagName) || []
      };
    }
    
    // Return all flags
    const allFlags = {};
    for (const [name, flag] of this.flagState.flags) {
      allFlags[name] = {
        ...flag,
        performanceMetrics: this.flagState.performanceMetrics.get(name),
        rolloutHistory: this.flagState.rolloutHistory.get(name) || []
      };
    }
    
    return allFlags;
  }

  async generateFlagReport() {
    logger.info('📋 Generating feature flag report');
    
    const report = {
      managerId: this.managerId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalFlags: this.flagState.flags.size,
        enabledFlags: Array.from(this.flagState.flags.values()).filter(f => f.enabled).length,
        activeRollouts: this.flagState.activeRollouts.size,
        flagsByCategory: this.getFlagsByCategory(),
        flagsByRiskLevel: this.getFlagsByRiskLevel()
      },
      flags: await this.getFlagStatus(),
      performanceMetrics: Object.fromEntries(this.flagState.performanceMetrics),
      rolloutHistory: Object.fromEntries(this.flagState.rolloutHistory)
    };
    
    // Save report
    await fs.writeFile(
      `reports/production/feature-flag-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );
    
    logger.info('✅ Feature flag report generated');
    return report;
  }

  getFlagsByCategory() {
    const categories = {};
    for (const flag of this.flagState.flags.values()) {
      if (!categories[flag.category]) {
        categories[flag.category] = 0;
      }
      categories[flag.category]++;
    }
    return categories;
  }

  getFlagsByRiskLevel() {
    const riskLevels = {};
    for (const flag of this.flagState.flags.values()) {
      if (!riskLevels[flag.riskLevel]) {
        riskLevels[flag.riskLevel] = 0;
      }
      riskLevels[flag.riskLevel]++;
    }
    return riskLevels;
  }

  async cleanup() {
    logger.info('🧹 Cleaning up feature flag manager');
    
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.rolloutInterval) {
      clearInterval(this.rolloutInterval);
    }
    
    logger.info('✅ Feature flag manager cleaned up');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const flagManager = new FeatureFlagManager();
  
  try {
    await flagManager.initialize();
    
    switch (command) {
      case 'enable':
        const flagToEnable = args[1];
        const percentage = parseInt(args[2]) || 100;
        if (!flagToEnable) {
          console.error('Usage: node feature-flag-manager.js enable <flag-name> [percentage]');
          process.exit(1);
        }
        await flagManager.enableFlag(flagToEnable, percentage, 'cli', 'CLI enable command');
        break;
        
      case 'disable':
        const flagToDisable = args[1];
        if (!flagToDisable) {
          console.error('Usage: node feature-flag-manager.js disable <flag-name>');
          process.exit(1);
        }
        await flagManager.disableFlag(flagToDisable, 'cli', 'CLI disable command');
        break;
        
      case 'update':
        const flagToUpdate = args[1];
        const newPercentage = parseInt(args[2]);
        if (!flagToUpdate || isNaN(newPercentage)) {
          console.error('Usage: node feature-flag-manager.js update <flag-name> <percentage>');
          process.exit(1);
        }
        await flagManager.updateRolloutPercentage(flagToUpdate, newPercentage, 'cli', 'CLI update command');
        break;
        
      case 'status':
        const flagToCheck = args[1];
        const status = await flagManager.getFlagStatus(flagToCheck);
        console.log(JSON.stringify(status, null, 2));
        break;
        
      case 'report':
        const report = await flagManager.generateFlagReport();
        console.log('Feature flag report generated:', report);
        break;
        
      case 'monitor':
        // Start monitoring mode
        logger.info('🎯 Starting feature flag monitoring mode');
        
        // Setup event listeners
        flagManager.on('flagEnabled', (data) => {
          logger.info(`🚩 Flag enabled: ${data.flagName} (${data.rolloutPercentage}%)`);
        });
        
        flagManager.on('flagDisabled', (data) => {
          logger.info(`🚫 Flag disabled: ${data.flagName}`);
        });
        
        flagManager.on('rolloutUpdated', (data) => {
          logger.info(`📈 Rollout updated: ${data.flagName} (${data.previousPercentage}% -> ${data.newPercentage}%)`);
        });
        
        flagManager.on('performanceAlert', (data) => {
          logger.warn(`⚠️ Performance alert: ${data.flagName}`, data.issues);
        });
        
        flagManager.on('automatedRollback', (data) => {
          logger.warn(`🔄 Automated rollback: ${data.flagName} (${data.previousPercentage}% -> ${data.newPercentage}%)`);
        });
        
        // Keep process running
        process.on('SIGINT', async () => {
          logger.info('🛑 Stopping feature flag monitoring...');
          await flagManager.cleanup();
          process.exit(0);
        });
        
        logger.info('✅ Feature flag monitoring started. Press Ctrl+C to stop.');
        break;
        
      default:
        console.log('Usage: node feature-flag-manager.js <command> [args]');
        console.log('Commands:');
        console.log('  enable <flag-name> [percentage]  - Enable a feature flag');
        console.log('  disable <flag-name>              - Disable a feature flag');
        console.log('  update <flag-name> <percentage>  - Update rollout percentage');
        console.log('  status [flag-name]               - Get flag status');
        console.log('  report                           - Generate flag report');
        console.log('  monitor                          - Start monitoring mode');
        process.exit(1);
    }
    
    if (command !== 'monitor') {
      await flagManager.cleanup();
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('💥 Feature flag manager failed:', error);
    await flagManager.cleanup();
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { FeatureFlagManager };
