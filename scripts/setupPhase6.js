#!/usr/bin/env node

/**
 * Phase 6 Setup Script
 * Sets up the Continuous Improvement and Advanced Features phase
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

class Phase6Setup {
  constructor() {
    this.dbConfig = {
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    };
    this.pool = new Pool(this.dbConfig);
    this.setupSteps = [
      'Database Schema Extensions',
      'Knowledge Base Maintenance System',
      'Feedback Analysis System',
      'Model Fine-Tuning Service',
      'Configuration Files',
      'Directory Structure',
      'Sample Data',
      'Integration Tests'
    ];
  }

  async run() {
    try {
      log('\n🚀 Setting up Phase 6: Continuous Improvement & Advanced Features', 'cyan');
      log('=' .repeat(70), 'cyan');

      for (let i = 0; i < this.setupSteps.length; i++) {
        const step = this.setupSteps[i];
        log(`\n📋 Step ${i + 1}/${this.setupSteps.length}: ${step}`, 'blue');
        
        switch (step) {
          case 'Database Schema Extensions':
            await this.setupDatabaseSchemas();
            break;
          case 'Knowledge Base Maintenance System':
            await this.setupKnowledgeBaseSystem();
            break;
          case 'Feedback Analysis System':
            await this.setupFeedbackAnalysisSystem();
            break;
          case 'Model Fine-Tuning Service':
            await this.setupModelFineTuningService();
            break;
          case 'Configuration Files':
            await this.setupConfigurationFiles();
            break;
          case 'Directory Structure':
            await this.setupDirectoryStructure();
            break;
          case 'Sample Data':
            await this.setupSampleData();
            break;
          case 'Integration Tests':
            await this.runIntegrationTests();
            break;
        }
        
        log(`✅ ${step} completed successfully`, 'green');
      }

      log('\n🎉 Phase 6 setup completed successfully!', 'green');
      log('\nNext steps:', 'yellow');
      log('1. Run: npm run validate:phase6', 'yellow');
      log('2. Test knowledge base maintenance: npm run kb:sync', 'yellow');
      log('3. Test feedback analysis: npm run feedback:analyze', 'yellow');
      log('4. Review fine-tuning capabilities: npm run ft:status', 'yellow');

    } catch (error) {
      log(`\n❌ Setup failed: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }

  async setupDatabaseSchemas() {
    const client = await this.pool.connect();
    
    try {
      log('  📊 Creating knowledge base maintenance tables...', 'yellow');
      
      // Knowledge Base Versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id VARCHAR(255) NOT NULL,
          version_number INTEGER NOT NULL,
          title VARCHAR(500) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          content_hash VARCHAR(64) NOT NULL,
          file_path VARCHAR(500),
          file_size INTEGER,
          created_by VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          change_summary TEXT,
          change_type VARCHAR(50),
          parent_version_id UUID,
          is_current BOOLEAN DEFAULT false,
          quality_score FLOAT,
          embedding_vector VECTOR(1536),
          UNIQUE(document_id, version_number)
        );

        CREATE INDEX IF NOT EXISTS idx_kb_versions_document_id ON knowledge_base_versions (document_id);
        CREATE INDEX IF NOT EXISTS idx_kb_versions_current ON knowledge_base_versions (document_id, is_current);
        CREATE INDEX IF NOT EXISTS idx_kb_versions_created_at ON knowledge_base_versions (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_kb_versions_content_hash ON knowledge_base_versions (content_hash);
      `);

      // Knowledge Base Changes table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base_changes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id VARCHAR(255) NOT NULL,
          change_type VARCHAR(50) NOT NULL,
          old_version_id UUID REFERENCES knowledge_base_versions(id),
          new_version_id UUID REFERENCES knowledge_base_versions(id),
          change_summary TEXT NOT NULL,
          change_details JSONB,
          similarity_score FLOAT,
          significance_score FLOAT,
          detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          detection_method VARCHAR(50),
          reviewed_by VARCHAR(100),
          review_status VARCHAR(30) DEFAULT 'pending',
          review_notes TEXT,
          auto_approved BOOLEAN DEFAULT false
        );

        CREATE INDEX IF NOT EXISTS idx_kb_changes_document_id ON knowledge_base_changes (document_id);
        CREATE INDEX IF NOT EXISTS idx_kb_changes_detected_at ON knowledge_base_changes (detected_at DESC);
        CREATE INDEX IF NOT EXISTS idx_kb_changes_review_status ON knowledge_base_changes (review_status);
      `);

      log('  📈 Creating feedback analysis tables...', 'yellow');
      
      // Feedback Analysis table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          feedback_id UUID NOT NULL REFERENCES user_feedback(id),
          sentiment_score FLOAT NOT NULL,
          sentiment_label VARCHAR(20) NOT NULL,
          confidence_score FLOAT NOT NULL,
          categories JSONB NOT NULL,
          keywords JSONB NOT NULL,
          topics JSONB NOT NULL,
          urgency_score FLOAT NOT NULL,
          complexity_score FLOAT NOT NULL,
          actionable_items JSONB,
          related_features JSONB,
          embedding_vector VECTOR(1536),
          analysis_metadata JSONB,
          analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          analyzed_by VARCHAR(50) DEFAULT 'system'
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback_id ON feedback_analysis (feedback_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis (sentiment_label, sentiment_score);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed_at ON feedback_analysis (analyzed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_urgency ON feedback_analysis (urgency_score DESC);
      `);

      // Feedback Clusters table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_clusters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cluster_name VARCHAR(200) NOT NULL,
          cluster_description TEXT,
          cluster_keywords JSONB NOT NULL,
          cluster_center VECTOR(1536),
          cluster_size INTEGER NOT NULL,
          dominant_sentiment VARCHAR(20),
          avg_urgency_score FLOAT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_clusters_created_at ON feedback_clusters (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feedback_clusters_size ON feedback_clusters (cluster_size DESC);
        CREATE INDEX IF NOT EXISTS idx_feedback_clusters_active ON feedback_clusters (is_active);
      `);

      log('  🤖 Creating fine-tuning tables...', 'yellow');
      
      // Fine-tuning Datasets table
      await client.query(`
        CREATE TABLE IF NOT EXISTS fine_tuning_datasets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dataset_name VARCHAR(200) NOT NULL,
          dataset_description TEXT,
          category VARCHAR(50) NOT NULL,
          source_type VARCHAR(50) NOT NULL,
          total_examples INTEGER NOT NULL DEFAULT 0,
          training_examples INTEGER NOT NULL DEFAULT 0,
          validation_examples INTEGER NOT NULL DEFAULT 0,
          dataset_path VARCHAR(500),
          dataset_hash VARCHAR(64),
          quality_score FLOAT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_ft_datasets_category ON fine_tuning_datasets (category);
        CREATE INDEX IF NOT EXISTS idx_ft_datasets_created_at ON fine_tuning_datasets (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ft_datasets_active ON fine_tuning_datasets (is_active);
      `);

      // Fine-tuning Jobs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS fine_tuning_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_name VARCHAR(200) NOT NULL,
          openai_job_id VARCHAR(100),
          base_model VARCHAR(100) NOT NULL,
          dataset_id UUID NOT NULL REFERENCES fine_tuning_datasets(id),
          hyperparameters JSONB NOT NULL,
          job_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          progress_percentage FLOAT DEFAULT 0.0,
          training_file_id VARCHAR(100),
          validation_file_id VARCHAR(100),
          fine_tuned_model VARCHAR(100),
          training_metrics JSONB,
          validation_metrics JSONB,
          error_message TEXT,
          estimated_completion_time TIMESTAMP WITH TIME ZONE,
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100) NOT NULL,
          cost_estimate FLOAT,
          actual_cost FLOAT
        );

        CREATE INDEX IF NOT EXISTS idx_ft_jobs_status ON fine_tuning_jobs (job_status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ft_jobs_openai_id ON fine_tuning_jobs (openai_job_id);
        CREATE INDEX IF NOT EXISTS idx_ft_jobs_dataset ON fine_tuning_jobs (dataset_id);
      `);

      log('  ✅ Database schemas created successfully', 'green');

    } finally {
      client.release();
    }
  }

  async setupKnowledgeBaseSystem() {
    log('  📚 Initializing Knowledge Base Maintenance System...', 'yellow');
    
    try {
      const KnowledgeBaseMaintenanceSystem = require('../services/KnowledgeBaseMaintenanceSystem');
      const kbSystem = new KnowledgeBaseMaintenanceSystem();
      
      await kbSystem.initialize();
      await kbSystem.close();
      
      log('  ✅ Knowledge Base Maintenance System initialized', 'green');
    } catch (error) {
      log(`  ⚠️  Knowledge Base system initialization error: ${error.message}`, 'yellow');
      // Don't fail setup, just log warning
    }
  }

  async setupFeedbackAnalysisSystem() {
    log('  🔍 Initializing Feedback Analysis System...', 'yellow');
    
    try {
      const FeedbackAnalysisSystem = require('../services/FeedbackAnalysisSystem');
      const feedbackSystem = new FeedbackAnalysisSystem();
      
      await feedbackSystem.initialize();
      await feedbackSystem.close();
      
      log('  ✅ Feedback Analysis System initialized', 'green');
    } catch (error) {
      log(`  ⚠️  Feedback Analysis system initialization error: ${error.message}`, 'yellow');
      // Don't fail setup, just log warning
    }
  }

  async setupModelFineTuningService() {
    log('  🎯 Initializing Model Fine-Tuning Service...', 'yellow');
    
    try {
      const ModelFineTuningService = require('../services/ModelFineTuningService');
      const fineTuningService = new ModelFineTuningService();
      
      await fineTuningService.initialize();
      await fineTuningService.close();
      
      log('  ✅ Model Fine-Tuning Service initialized', 'green');
    } catch (error) {
      log(`  ⚠️  Fine-tuning service initialization error: ${error.message}`, 'yellow');
      // Don't fail setup, just log warning
    }
  }

  async setupConfigurationFiles() {
    log('  ⚙️  Creating configuration files...', 'yellow');
    
    // Knowledge Base configuration
    const kbConfig = {
      versioningEnabled: true,
      maxVersionsToKeep: 10,
      autoBackupEnabled: true,
      changeDetectionEnabled: true,
      qualityCheckEnabled: true,
      similarityThreshold: 0.85,
      significantChangeThreshold: 0.3,
      minContentLength: 50,
      maxContentLength: 10000,
      lastUpdated: new Date().toISOString()
    };

    await this.ensureDirectoryExists('knowledge_base');
    await fs.writeFile(
      path.join(process.cwd(), 'knowledge_base', 'config.json'),
      JSON.stringify(kbConfig, null, 2)
    );

    // Fine-tuning configuration
    const ftConfig = {
      baseModel: 'gpt-3.5-turbo-1106',
      maxTrainingExamples: 10000,
      minTrainingExamples: 50,
      validationSplit: 0.2,
      maxTokensPerExample: 4096,
      trainingEpochs: 3,
      learningRateMultiplier: 0.1,
      batchSize: 1,
      promptLossWeight: 0.01,
      lastUpdated: new Date().toISOString()
    };

    await this.ensureDirectoryExists('fine_tuning');
    await fs.writeFile(
      path.join(process.cwd(), 'fine_tuning', 'config.json'),
      JSON.stringify(ftConfig, null, 2)
    );

    log('  ✅ Configuration files created', 'green');
  }

  async setupDirectoryStructure() {
    log('  📁 Creating directory structure...', 'yellow');
    
    const directories = [
      'knowledge_base/documents',
      'knowledge_base/versions',
      'knowledge_base/backups',
      'knowledge_base/staging',
      'knowledge_base/archives',
      'knowledge_base/temp',
      'fine_tuning/datasets',
      'fine_tuning/training_files',
      'fine_tuning/models',
      'fine_tuning/exports',
      'fine_tuning/backups',
      'feedback_analysis/clusters',
      'feedback_analysis/trends',
      'feedback_analysis/reports'
    ];

    for (const dir of directories) {
      await this.ensureDirectoryExists(dir);
    }

    log('  ✅ Directory structure created', 'green');
  }

  async setupSampleData() {
    log('  📊 Creating sample data...', 'yellow');
    
    // Sample knowledge base document
    const sampleDoc = {
      title: 'Fund Management Best Practices',
      content: `# Fund Management Best Practices

## Overview
This document outlines the key best practices for effective fund management.

## Key Principles
1. **Diversification**: Spread investments across different asset classes
2. **Risk Management**: Implement proper risk controls and monitoring
3. **Performance Tracking**: Regular monitoring of fund performance
4. **Compliance**: Ensure all activities comply with regulatory requirements

## Investment Strategies
- Active management for growth opportunities
- Passive management for stable returns
- Hybrid approaches combining both strategies

## Risk Controls
- Position limits and concentration rules
- Regular stress testing and scenario analysis
- Independent risk monitoring and reporting`,
      metadata: {
        version: '1.0',
        author: 'Fund Management Team',
        category: 'best_practices',
        tags: ['fund_management', 'investment', 'risk', 'compliance']
      }
    };

    await this.ensureDirectoryExists('knowledge_base/documents');
    await fs.writeFile(
      path.join(process.cwd(), 'knowledge_base', 'documents', 'fund_management_best_practices.md'),
      `# ${sampleDoc.title}\n\n${sampleDoc.content}`
    );

    // Sample fine-tuning training data
    const sampleTrainingData = [
      {
        systemMessage: 'You are an intelligent fund management assistant. Provide accurate, helpful, and professional responses.',
        userMessage: 'What is diversification in fund management?',
        assistantMessage: 'Diversification in fund management is the practice of spreading investments across different asset classes, sectors, and geographical regions to reduce risk. By not putting all investments in one area, fund managers can minimize the impact of poor performance in any single investment on the overall portfolio. This helps achieve more stable returns over time while managing downside risk.'
      },
      {
        systemMessage: 'You are an intelligent fund management assistant. Provide accurate, helpful, and professional responses.',
        userMessage: 'How do you calculate fund performance?',
        assistantMessage: 'Fund performance is typically calculated using several key metrics: 1) Total Return: (Ending Value - Beginning Value + Distributions) / Beginning Value × 100. 2) Annualized Return: For multi-year periods, calculated as ((Ending Value/Beginning Value)^(1/years)) - 1. 3) Risk-adjusted returns using metrics like Sharpe Ratio, which compares excess return to volatility. Performance should always be compared to relevant benchmarks and peer funds to provide proper context.'
      }
    ];

    await fs.writeFile(
      path.join(process.cwd(), 'fine_tuning', 'sample_training_data.json'),
      JSON.stringify(sampleTrainingData, null, 2)
    );

    log('  ✅ Sample data created', 'green');
  }

  async runIntegrationTests() {
    log('  🧪 Running integration tests...', 'yellow');
    
    try {
      // Test database connections
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      log('    ✅ Database connection test passed', 'green');

      // Test service imports
      try {
        require('../services/KnowledgeBaseMaintenanceSystem');
        log('    ✅ Knowledge Base Maintenance System import test passed', 'green');
      } catch (error) {
        log(`    ❌ Knowledge Base Maintenance System import failed: ${error.message}`, 'red');
      }

      try {
        require('../services/FeedbackAnalysisSystem');
        log('    ✅ Feedback Analysis System import test passed', 'green');
      } catch (error) {
        log(`    ❌ Feedback Analysis System import failed: ${error.message}`, 'red');
      }

      try {
        require('../services/ModelFineTuningService');
        log('    ✅ Model Fine-Tuning Service import test passed', 'green');
      } catch (error) {
        log(`    ❌ Model Fine-Tuning Service import failed: ${error.message}`, 'red');
      }

      log('  ✅ Integration tests completed', 'green');

    } catch (error) {
      log(`  ❌ Integration tests failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async ensureDirectoryExists(dirPath) {
    const fullPath = path.join(process.cwd(), dirPath);
    try {
      await fs.mkdir(fullPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new Phase6Setup();
  setup.run();
}

module.exports = Phase6Setup;
