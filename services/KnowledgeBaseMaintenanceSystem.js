/**
 * Knowledge Base Maintenance System
 * Automated system for maintaining, updating, and versioning knowledge base content
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const OpenAI = require('openai');
const natural = require('natural');

class KnowledgeBaseMaintenanceSystem {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
    this.openai = new OpenAI({
      apiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY
    });
    
    // Version control settings
    this.versioningEnabled = true;
    this.maxVersionsToKeep = 10;
    this.autoBackupEnabled = true;
    
    // Change detection settings
    this.changeDetectionEnabled = true;
    this.similarityThreshold = 0.85; // For detecting similar content
    this.significantChangeThreshold = 0.3; // For detecting significant changes
    
    // Content quality settings
    this.qualityCheckEnabled = true;
    this.minContentLength = 50;
    this.maxContentLength = 10000;
    
    // Update types
    this.updateTypes = {
      CONTENT_UPDATE: 'content_update',
      NEW_DOCUMENT: 'new_document',
      DOCUMENT_REMOVAL: 'document_removal',
      METADATA_UPDATE: 'metadata_update',
      STRUCTURE_CHANGE: 'structure_change',
      CORRECTION: 'correction',
      ENHANCEMENT: 'enhancement'
    };
    
    // Update status
    this.updateStatus = {
      PENDING: 'pending',
      UNDER_REVIEW: 'under_review',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      IMPLEMENTED: 'implemented',
      ROLLED_BACK: 'rolled_back'
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the knowledge base maintenance system
   */
  async initialize() {
    try {
      await this.ensureTablesExist();
      await this.createDirectoryStructure();
      await this.loadConfiguration();
      
      this.initialized = true;
      logger.info('KnowledgeBaseMaintenanceSystem initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize KnowledgeBaseMaintenanceSystem:', error);
      throw error;
    }
  }

  /**
   * Ensure required database tables exist
   */
  async ensureTablesExist() {
    const client = await this.pool.connect();
    
    try {
      // Create knowledge base versions table
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
          embedding_vector VECTOR(1536), -- For OpenAI embeddings
          UNIQUE(document_id, version_number)
        );

        CREATE INDEX IF NOT EXISTS idx_kb_versions_document_id ON knowledge_base_versions (document_id);
        CREATE INDEX IF NOT EXISTS idx_kb_versions_current ON knowledge_base_versions (document_id, is_current);
        CREATE INDEX IF NOT EXISTS idx_kb_versions_created_at ON knowledge_base_versions (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_kb_versions_content_hash ON knowledge_base_versions (content_hash);
      `);

      // Create change detection table
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
          detection_method VARCHAR(50), -- automatic, manual, scheduled
          reviewed_by VARCHAR(100),
          review_status VARCHAR(30) DEFAULT 'pending',
          review_notes TEXT,
          auto_approved BOOLEAN DEFAULT false
        );

        CREATE INDEX IF NOT EXISTS idx_kb_changes_document_id ON knowledge_base_changes (document_id);
        CREATE INDEX IF NOT EXISTS idx_kb_changes_detected_at ON knowledge_base_changes (detected_at DESC);
        CREATE INDEX IF NOT EXISTS idx_kb_changes_review_status ON knowledge_base_changes (review_status);
      `);

      // Create content quality assessments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base_quality_assessments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          version_id UUID REFERENCES knowledge_base_versions(id),
          assessment_type VARCHAR(50) NOT NULL, -- automated, manual, peer_review
          quality_dimensions JSONB NOT NULL, -- accuracy, completeness, clarity, etc.
          overall_score FLOAT NOT NULL,
          issues_found JSONB,
          recommendations JSONB,
          assessed_by VARCHAR(100) NOT NULL,
          assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          assessment_notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_kb_quality_version_id ON knowledge_base_quality_assessments (version_id);
        CREATE INDEX IF NOT EXISTS idx_kb_quality_assessed_at ON knowledge_base_quality_assessments (assessed_at DESC);
      `);

      // Create update workflow table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base_update_workflow (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          update_request_id UUID NOT NULL,
          workflow_step VARCHAR(50) NOT NULL, -- submission, review, approval, implementation
          step_status VARCHAR(30) NOT NULL,
          assigned_to VARCHAR(100),
          step_data JSONB,
          started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          next_step VARCHAR(50)
        );

        CREATE INDEX IF NOT EXISTS idx_kb_workflow_request_id ON knowledge_base_update_workflow (update_request_id);
        CREATE INDEX IF NOT EXISTS idx_kb_workflow_step ON knowledge_base_update_workflow (workflow_step, step_status);
      `);

      // Create content synchronization tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base_sync_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id VARCHAR(255) NOT NULL,
          source_system VARCHAR(100) NOT NULL, -- file_system, cms, api
          source_path VARCHAR(500) NOT NULL,
          last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          sync_status VARCHAR(30) NOT NULL, -- success, failed, partial
          sync_details JSONB,
          next_sync_at TIMESTAMP WITH TIME ZONE,
          sync_frequency VARCHAR(50), -- hourly, daily, weekly, manual
          error_count INTEGER DEFAULT 0,
          last_error TEXT,
          UNIQUE(document_id, source_system)
        );

        CREATE INDEX IF NOT EXISTS idx_kb_sync_document_id ON knowledge_base_sync_status (document_id);
        CREATE INDEX IF NOT EXISTS idx_kb_sync_next_sync ON knowledge_base_sync_status (next_sync_at);
        CREATE INDEX IF NOT EXISTS idx_kb_sync_status ON knowledge_base_sync_status (sync_status);
      `);

      logger.info('Knowledge base maintenance database tables ensured');

    } finally {
      client.release();
    }
  }

  /**
   * Create necessary directory structure
   */
  async createDirectoryStructure() {
    const directories = [
      'knowledge_base',
      'knowledge_base/documents',
      'knowledge_base/versions',
      'knowledge_base/backups',
      'knowledge_base/staging',
      'knowledge_base/archives',
      'knowledge_base/temp'
    ];

    for (const dir of directories) {
      const fullPath = path.join(process.cwd(), dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          logger.error(`Failed to create directory ${dir}:`, error);
        }
      }
    }

    logger.info('Knowledge base directory structure created');
  }

  /**
   * Load system configuration
   */
  async loadConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'knowledge_base', 'config.json');
      
      try {
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Override default settings with loaded config
        this.versioningEnabled = config.versioningEnabled ?? this.versioningEnabled;
        this.maxVersionsToKeep = config.maxVersionsToKeep ?? this.maxVersionsToKeep;
        this.autoBackupEnabled = config.autoBackupEnabled ?? this.autoBackupEnabled;
        this.changeDetectionEnabled = config.changeDetectionEnabled ?? this.changeDetectionEnabled;
        this.qualityCheckEnabled = config.qualityCheckEnabled ?? this.qualityCheckEnabled;
        
        logger.info('Knowledge base configuration loaded from file');
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Create default configuration file
          await this.saveConfiguration();
          logger.info('Default knowledge base configuration created');
        } else {
          throw error;
        }
      }

    } catch (error) {
      logger.error('Failed to load configuration:', error);
      // Continue with default settings
    }
  }

  /**
   * Save current configuration
   */
  async saveConfiguration() {
    try {
      const config = {
        versioningEnabled: this.versioningEnabled,
        maxVersionsToKeep: this.maxVersionsToKeep,
        autoBackupEnabled: this.autoBackupEnabled,
        changeDetectionEnabled: this.changeDetectionEnabled,
        qualityCheckEnabled: this.qualityCheckEnabled,
        similarityThreshold: this.similarityThreshold,
        significantChangeThreshold: this.significantChangeThreshold,
        minContentLength: this.minContentLength,
        maxContentLength: this.maxContentLength,
        lastUpdated: new Date().toISOString()
      };

      const configPath = path.join(process.cwd(), 'knowledge_base', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
      logger.info('Knowledge base configuration saved');

    } catch (error) {
      logger.error('Failed to save configuration:', error);
    }
  }

  /**
   * Add or update a document in the knowledge base
   */
  async updateDocument(documentId, title, content, metadata = {}, createdBy = 'system', changeType = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Updating knowledge base document: ${documentId}`);

      // Validate input
      const validationResult = await this.validateContent(title, content);
      if (!validationResult.valid) {
        throw new Error(`Content validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Get current version if exists
      const currentVersion = await this.getCurrentVersion(documentId);
      
      // Calculate content hash
      const contentHash = this.calculateContentHash(title + content);
      
      // Check if content has actually changed
      if (currentVersion && currentVersion.content_hash === contentHash) {
        logger.info(`No changes detected for document ${documentId}`);
        return {
          success: true,
          message: 'No changes detected',
          versionId: currentVersion.id,
          versionNumber: currentVersion.version_number
        };
      }

      // Determine change type if not provided
      if (!changeType) {
        changeType = currentVersion ? this.updateTypes.CONTENT_UPDATE : this.updateTypes.NEW_DOCUMENT;
      }

      // Create new version
      const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;
      const newVersion = await this.createVersion(
        documentId,
        newVersionNumber,
        title,
        content,
        metadata,
        contentHash,
        createdBy,
        changeType,
        currentVersion?.id
      );

      // Detect and record changes
      if (currentVersion) {
        await this.detectAndRecordChanges(currentVersion, newVersion);
      }

      // Perform quality assessment
      if (this.qualityCheckEnabled) {
        await this.performQualityAssessment(newVersion.id, 'automated', 'system');
      }

      // Update current version flag
      await this.setCurrentVersion(documentId, newVersion.id);

      // Create backup if enabled
      if (this.autoBackupEnabled) {
        await this.createBackup(newVersion.id);
      }

      // Clean up old versions
      await this.cleanupOldVersions(documentId);

      // Update embeddings for retrieval
      await this.updateEmbeddings(newVersion.id, content);

      logger.info(`Document ${documentId} updated successfully`, {
        versionNumber: newVersionNumber,
        changeType,
        contentHash
      });

      return {
        success: true,
        versionId: newVersion.id,
        versionNumber: newVersionNumber,
        changeType,
        contentHash
      };

    } catch (error) {
      logger.error(`Failed to update document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new version record
   */
  async createVersion(documentId, versionNumber, title, content, metadata, contentHash, createdBy, changeType, parentVersionId) {
    const client = await this.pool.connect();
    
    try {
      // Generate change summary
      const changeSummary = await this.generateChangeSummary(title, content, changeType, parentVersionId);
      
      // Calculate quality score
      const qualityScore = await this.calculateQualityScore(title, content);
      
      const query = `
        INSERT INTO knowledge_base_versions (
          document_id, version_number, title, content, metadata,
          content_hash, created_by, change_summary, change_type,
          parent_version_id, is_current, quality_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const values = [
        documentId,
        versionNumber,
        title,
        content,
        JSON.stringify(metadata),
        contentHash,
        createdBy,
        changeSummary,
        changeType,
        parentVersionId,
        false, // Will be set to true later
        qualityScore
      ];
      
      const result = await client.query(query, values);
      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Get current version of a document
   */
  async getCurrentVersion(documentId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM knowledge_base_versions 
        WHERE document_id = $1 AND is_current = true
        ORDER BY version_number DESC
        LIMIT 1
      `;
      
      const result = await client.query(query, [documentId]);
      return result.rows[0] || null;

    } finally {
      client.release();
    }
  }

  /**
   * Set current version flag
   */
  async setCurrentVersion(documentId, versionId) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Clear current flag for all versions of this document
      await client.query(
        'UPDATE knowledge_base_versions SET is_current = false WHERE document_id = $1',
        [documentId]
      );
      
      // Set current flag for the new version
      await client.query(
        'UPDATE knowledge_base_versions SET is_current = true WHERE id = $1',
        [versionId]
      );
      
      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Detect and record changes between versions
   */
  async detectAndRecordChanges(oldVersion, newVersion) {
    try {
      const changes = await this.analyzeChanges(oldVersion, newVersion);
      
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO knowledge_base_changes (
          document_id, change_type, old_version_id, new_version_id,
          change_summary, change_details, similarity_score, significance_score,
          detection_method
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      
      const values = [
        newVersion.document_id,
        newVersion.change_type,
        oldVersion.id,
        newVersion.id,
        changes.summary,
        JSON.stringify(changes.details),
        changes.similarityScore,
        changes.significanceScore,
        'automatic'
      ];
      
      const result = await client.query(query, values);
      client.release();
      
      logger.info('Changes recorded', {
        changeId: result.rows[0].id,
        documentId: newVersion.document_id,
        similarityScore: changes.similarityScore,
        significanceScore: changes.significanceScore
      });

    } catch (error) {
      logger.error('Failed to detect and record changes:', error);
    }
  }

  /**
   * Analyze changes between two versions
   */
  async analyzeChanges(oldVersion, newVersion) {
    try {
      const changes = {
        summary: '',
        details: {},
        similarityScore: 0,
        significanceScore: 0
      };

      // Calculate text similarity
      const oldText = oldVersion.title + ' ' + oldVersion.content;
      const newText = newVersion.title + ' ' + newVersion.content;
      
      changes.similarityScore = this.calculateTextSimilarity(oldText, newText);
      changes.significanceScore = 1 - changes.similarityScore;

      // Analyze specific changes
      const titleChanged = oldVersion.title !== newVersion.title;
      const contentChanged = oldVersion.content !== newVersion.content;
      const metadataChanged = JSON.stringify(oldVersion.metadata) !== JSON.stringify(newVersion.metadata);

      changes.details = {
        titleChanged,
        contentChanged,
        metadataChanged,
        oldLength: oldVersion.content.length,
        newLength: newVersion.content.length,
        lengthChange: newVersion.content.length - oldVersion.content.length,
        wordCountChange: this.getWordCount(newVersion.content) - this.getWordCount(oldVersion.content)
      };

      // Generate summary
      const summaryParts = [];
      if (titleChanged) summaryParts.push('title updated');
      if (contentChanged) {
        if (changes.details.lengthChange > 100) {
          summaryParts.push('content significantly expanded');
        } else if (changes.details.lengthChange < -100) {
          summaryParts.push('content significantly reduced');
        } else {
          summaryParts.push('content modified');
        }
      }
      if (metadataChanged) summaryParts.push('metadata updated');

      changes.summary = summaryParts.join(', ') || 'minor changes';

      // Use AI for more detailed analysis if significant changes
      if (changes.significanceScore > this.significantChangeThreshold) {
        const aiAnalysis = await this.analyzeChangesWithAI(oldVersion, newVersion);
        if (aiAnalysis) {
          changes.details.aiAnalysis = aiAnalysis;
          if (aiAnalysis.summary) {
            changes.summary = aiAnalysis.summary;
          }
        }
      }

      return changes;

    } catch (error) {
      logger.error('Failed to analyze changes:', error);
      return {
        summary: 'analysis failed',
        details: { error: error.message },
        similarityScore: 0.5,
        significanceScore: 0.5
      };
    }
  }

  /**
   * Use AI to analyze changes between versions
   */
  async analyzeChangesWithAI(oldVersion, newVersion) {
    try {
      const prompt = `
        Analyze the changes between these two versions of a fund management document:
        
        OLD VERSION:
        Title: ${oldVersion.title}
        Content: ${oldVersion.content.substring(0, 1000)}...
        
        NEW VERSION:
        Title: ${newVersion.title}
        Content: ${newVersion.content.substring(0, 1000)}...
        
        Please provide:
        1. A concise summary of the main changes
        2. The type of changes (factual updates, structural changes, additions, deletions, corrections)
        3. The significance level (minor, moderate, major)
        4. Any potential impact on users
        
        Respond with JSON:
        {
          "summary": "brief description of changes",
          "changeTypes": ["type1", "type2"],
          "significance": "minor|moderate|major",
          "impact": "description of potential user impact",
          "recommendations": ["recommendation1", "recommendation2"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      logger.error('AI change analysis failed:', error);
      return null;
    }
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  calculateTextSimilarity(text1, text2) {
    try {
      const words1 = new Set(text1.toLowerCase().split(/\s+/));
      const words2 = new Set(text2.toLowerCase().split(/\s+/));
      
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;

    } catch (error) {
      logger.error('Failed to calculate text similarity:', error);
      return 0.5;
    }
  }

  /**
   * Perform quality assessment on a version
   */
  async performQualityAssessment(versionId, assessmentType = 'automated', assessedBy = 'system') {
    try {
      const version = await this.getVersionById(versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      const assessment = await this.assessContentQuality(version.title, version.content);
      
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO knowledge_base_quality_assessments (
          version_id, assessment_type, quality_dimensions, overall_score,
          issues_found, recommendations, assessed_by, assessment_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      const values = [
        versionId,
        assessmentType,
        JSON.stringify(assessment.dimensions),
        assessment.overallScore,
        JSON.stringify(assessment.issues),
        JSON.stringify(assessment.recommendations),
        assessedBy,
        assessment.notes
      ];
      
      const result = await client.query(query, values);
      client.release();
      
      // Update quality score in version record
      await this.updateVersionQualityScore(versionId, assessment.overallScore);
      
      logger.info('Quality assessment completed', {
        assessmentId: result.rows[0].id,
        versionId,
        overallScore: assessment.overallScore
      });
      
      return result.rows[0].id;

    } catch (error) {
      logger.error('Failed to perform quality assessment:', error);
      throw error;
    }
  }

  /**
   * Assess content quality
   */
  async assessContentQuality(title, content) {
    try {
      const assessment = {
        dimensions: {},
        overallScore: 0,
        issues: [],
        recommendations: [],
        notes: ''
      };

      // Length assessment
      assessment.dimensions.length = this.assessLength(content);
      if (content.length < this.minContentLength) {
        assessment.issues.push('Content is too short');
        assessment.recommendations.push('Expand content to provide more comprehensive information');
      } else if (content.length > this.maxContentLength) {
        assessment.issues.push('Content is too long');
        assessment.recommendations.push('Consider breaking into smaller sections');
      }

      // Readability assessment
      assessment.dimensions.readability = this.assessReadability(content);
      if (assessment.dimensions.readability < 0.6) {
        assessment.issues.push('Content may be difficult to read');
        assessment.recommendations.push('Simplify language and sentence structure');
      }

      // Structure assessment
      assessment.dimensions.structure = this.assessStructure(content);
      if (assessment.dimensions.structure < 0.7) {
        assessment.issues.push('Content structure could be improved');
        assessment.recommendations.push('Add clear headings and organize content logically');
      }

      // Completeness assessment (basic)
      assessment.dimensions.completeness = this.assessCompleteness(title, content);
      if (assessment.dimensions.completeness < 0.6) {
        assessment.issues.push('Content may be incomplete');
        assessment.recommendations.push('Review and add missing information');
      }

      // Use AI for more comprehensive assessment
      const aiAssessment = await this.assessQualityWithAI(title, content);
      if (aiAssessment) {
        assessment.dimensions.aiAccuracy = aiAssessment.accuracy || 0.8;
        assessment.dimensions.aiClarity = aiAssessment.clarity || 0.8;
        assessment.dimensions.aiRelevance = aiAssessment.relevance || 0.8;
        
        if (aiAssessment.issues) {
          assessment.issues.push(...aiAssessment.issues);
        }
        if (aiAssessment.recommendations) {
          assessment.recommendations.push(...aiAssessment.recommendations);
        }
        if (aiAssessment.notes) {
          assessment.notes = aiAssessment.notes;
        }
      }

      // Calculate overall score
      const scores = Object.values(assessment.dimensions);
      assessment.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      return assessment;

    } catch (error) {
      logger.error('Failed to assess content quality:', error);
      return {
        dimensions: { error: 0.5 },
        overallScore: 0.5,
        issues: ['Quality assessment failed'],
        recommendations: ['Manual review recommended'],
        notes: `Assessment error: ${error.message}`
      };
    }
  }

  /**
   * Use AI to assess content quality
   */
  async assessQualityWithAI(title, content) {
    try {
      const prompt = `
        Assess the quality of this fund management document content:
        
        Title: ${title}
        Content: ${content.substring(0, 2000)}...
        
        Please evaluate:
        1. Accuracy - Is the information correct and up-to-date?
        2. Clarity - Is the content clear and easy to understand?
        3. Relevance - Is the content relevant to fund management?
        4. Completeness - Does it adequately cover the topic?
        
        Identify any issues and provide recommendations for improvement.
        
        Respond with JSON:
        {
          "accuracy": 0.0-1.0,
          "clarity": 0.0-1.0,
          "relevance": 0.0-1.0,
          "completeness": 0.0-1.0,
          "issues": ["issue1", "issue2"],
          "recommendations": ["rec1", "rec2"],
          "notes": "additional observations"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 600
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      logger.error('AI quality assessment failed:', error);
      return null;
    }
  }

  /**
   * Basic quality assessment methods
   */
  assessLength(content) {
    const length = content.length;
    if (length < this.minContentLength) return 0.3;
    if (length > this.maxContentLength) return 0.7;
    return 1.0;
  }

  assessReadability(content) {
    try {
      // Simple readability assessment based on sentence and word length
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const words = content.split(/\s+/).filter(w => w.length > 0);
      
      const avgWordsPerSentence = words.length / sentences.length;
      const avgCharsPerWord = words.reduce((sum, word) => sum + word.length, 0) / words.length;
      
      // Simple scoring (lower is better for readability)
      let score = 1.0;
      if (avgWordsPerSentence > 20) score -= 0.2;
      if (avgWordsPerSentence > 30) score -= 0.2;
      if (avgCharsPerWord > 6) score -= 0.2;
      if (avgCharsPerWord > 8) score -= 0.2;
      
      return Math.max(0, score);

    } catch (error) {
      return 0.7; // Default score
    }
  }

  assessStructure(content) {
    try {
      // Check for headings, lists, and paragraphs
      let score = 0.5; // Base score
      
      // Check for headings
      if (content.includes('#') || content.match(/^[A-Z][^.]*:$/m)) {
        score += 0.2;
      }
      
      // Check for lists
      if (content.includes('- ') || content.includes('1. ') || content.includes('• ')) {
        score += 0.1;
      }
      
      // Check for paragraph breaks
      const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
      if (paragraphs.length > 1) {
        score += 0.2;
      }
      
      return Math.min(1.0, score);

    } catch (error) {
      return 0.7; // Default score
    }
  }

  assessCompleteness(title, content) {
    try {
      // Basic completeness check based on content length relative to title
      const titleWords = title.split(/\s+/).length;
      const contentWords = content.split(/\s+/).length;
      
      // Expect at least 20 words of content per word in title
      const expectedMinWords = titleWords * 20;
      
      if (contentWords >= expectedMinWords * 2) return 1.0;
      if (contentWords >= expectedMinWords) return 0.8;
      if (contentWords >= expectedMinWords * 0.5) return 0.6;
      return 0.4;

    } catch (error) {
      return 0.7; // Default score
    }
  }

  /**
   * Update embeddings for a version
   */
  async updateEmbeddings(versionId, content) {
    try {
      // Generate embedding using OpenAI
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: content.substring(0, 8000), // Limit to avoid token limits
      });

      const embedding = response.data[0].embedding;
      
      // Update version record with embedding
      const client = await this.pool.connect();
      await client.query(
        'UPDATE knowledge_base_versions SET embedding_vector = $1 WHERE id = $2',
        [JSON.stringify(embedding), versionId]
      );
      client.release();
      
      logger.info('Embeddings updated for version', { versionId });

    } catch (error) {
      logger.error('Failed to update embeddings:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Create backup of a version
   */
  async createBackup(versionId) {
    try {
      const version = await this.getVersionById(versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      const backupDir = path.join(process.cwd(), 'knowledge_base', 'backups');
      const backupFilename = `${version.document_id}_v${version.version_number}_${Date.now()}.json`;
      const backupPath = path.join(backupDir, backupFilename);
      
      const backupData = {
        version,
        createdAt: new Date().toISOString(),
        backupType: 'automatic'
      };
      
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      
      // Update version record with backup path
      const client = await this.pool.connect();
      await client.query(
        'UPDATE knowledge_base_versions SET file_path = $1 WHERE id = $2',
        [backupPath, versionId]
      );
      client.release();
      
      logger.info('Backup created', { versionId, backupPath });

    } catch (error) {
      logger.error('Failed to create backup:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Clean up old versions
   */
  async cleanupOldVersions(documentId) {
    try {
      if (!this.versioningEnabled || this.maxVersionsToKeep <= 0) {
        return;
      }

      const client = await this.pool.connect();
      
      // Get all versions for this document, ordered by version number desc
      const versionsQuery = `
        SELECT id, version_number, is_current
        FROM knowledge_base_versions
        WHERE document_id = $1
        ORDER BY version_number DESC
      `;
      
      const versionsResult = await client.query(versionsQuery, [documentId]);
      const versions = versionsResult.rows;
      
      // Keep the current version plus maxVersionsToKeep - 1 older versions
      const versionsToKeep = this.maxVersionsToKeep;
      const versionsToDelete = versions.slice(versionsToKeep);
      
      if (versionsToDelete.length === 0) {
        client.release();
        return;
      }

      // Don't delete the current version
      const safeToDelete = versionsToDelete.filter(v => !v.is_current);
      
      if (safeToDelete.length > 0) {
        const versionIds = safeToDelete.map(v => v.id);
        
        // Delete from quality assessments first (foreign key constraint)
        await client.query(
          'DELETE FROM knowledge_base_quality_assessments WHERE version_id = ANY($1)',
          [versionIds]
        );
        
        // Delete from changes table
        await client.query(
          'DELETE FROM knowledge_base_changes WHERE old_version_id = ANY($1) OR new_version_id = ANY($1)',
          [versionIds]
        );
        
        // Delete versions
        await client.query(
          'DELETE FROM knowledge_base_versions WHERE id = ANY($1)',
          [versionIds]
        );
        
        logger.info('Old versions cleaned up', {
          documentId,
          deletedCount: safeToDelete.length
        });
      }
      
      client.release();

    } catch (error) {
      logger.error('Failed to cleanup old versions:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Detect changes in external sources
   */
  async detectExternalChanges(sourcePath, documentId = null) {
    try {
      logger.info('Detecting external changes', { sourcePath, documentId });

      const changes = [];
      
      if (documentId) {
        // Check specific document
        const change = await this.checkDocumentForChanges(sourcePath, documentId);
        if (change) {
          changes.push(change);
        }
      } else {
        // Scan directory for changes
        const directoryChanges = await this.scanDirectoryForChanges(sourcePath);
        changes.push(...directoryChanges);
      }

      // Process detected changes
      for (const change of changes) {
        await this.processDetectedChange(change);
      }

      logger.info('External change detection completed', {
        changesDetected: changes.length
      });

      return changes;

    } catch (error) {
      logger.error('Failed to detect external changes:', error);
      throw error;
    }
  }

  /**
   * Check a specific document for changes
   */
  async checkDocumentForChanges(sourcePath, documentId) {
    try {
      // Get current version from database
      const currentVersion = await this.getCurrentVersion(documentId);
      
      // Read file from source
      const fileContent = await fs.readFile(sourcePath, 'utf8');
      const fileStats = await fs.stat(sourcePath);
      
      // Parse file content (assuming it's a structured format)
      const parsedContent = await this.parseFileContent(fileContent, sourcePath);
      
      if (!currentVersion) {
        // New document
        return {
          type: 'new_document',
          documentId,
          sourcePath,
          title: parsedContent.title,
          content: parsedContent.content,
          metadata: {
            ...parsedContent.metadata,
            fileSize: fileStats.size,
            lastModified: fileStats.mtime.toISOString()
          }
        };
      }

      // Check if content has changed
      const newContentHash = this.calculateContentHash(parsedContent.title + parsedContent.content);
      
      if (currentVersion.content_hash !== newContentHash) {
        return {
          type: 'content_update',
          documentId,
          sourcePath,
          title: parsedContent.title,
          content: parsedContent.content,
          metadata: {
            ...parsedContent.metadata,
            fileSize: fileStats.size,
            lastModified: fileStats.mtime.toISOString()
          },
          oldVersion: currentVersion
        };
      }

      return null; // No changes

    } catch (error) {
      logger.error(`Failed to check document ${documentId} for changes:`, error);
      return {
        type: 'error',
        documentId,
        sourcePath,
        error: error.message
      };
    }
  }

  /**
   * Scan directory for changes
   */
  async scanDirectoryForChanges(directoryPath) {
    try {
      const changes = [];
      const files = await fs.readdir(directoryPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && this.isSupportedFile(file.name)) {
          const filePath = path.join(directoryPath, file.name);
          const documentId = this.extractDocumentId(file.name);
          
          const change = await this.checkDocumentForChanges(filePath, documentId);
          if (change) {
            changes.push(change);
          }
        }
      }
      
      return changes;

    } catch (error) {
      logger.error('Failed to scan directory for changes:', error);
      return [];
    }
  }

  /**
   * Process detected change
   */
  async processDetectedChange(change) {
    try {
      switch (change.type) {
        case 'new_document':
          await this.updateDocument(
            change.documentId,
            change.title,
            change.content,
            change.metadata,
            'external_sync',
            this.updateTypes.NEW_DOCUMENT
          );
          break;
          
        case 'content_update':
          await this.updateDocument(
            change.documentId,
            change.title,
            change.content,
            change.metadata,
            'external_sync',
            this.updateTypes.CONTENT_UPDATE
          );
          break;
          
        case 'error':
          logger.error(`Change processing error for ${change.documentId}:`, change.error);
          break;
      }
      
      // Update sync status
      await this.updateSyncStatus(change.documentId, change.sourcePath, 'success');

    } catch (error) {
      logger.error('Failed to process detected change:', error);
      await this.updateSyncStatus(change.documentId, change.sourcePath, 'failed', error.message);
    }
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(documentId, sourcePath, status, errorMessage = null) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO knowledge_base_sync_status (
          document_id, source_system, source_path, sync_status,
          sync_details, error_count, last_error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (document_id, source_system) DO UPDATE SET
          last_sync_at = CURRENT_TIMESTAMP,
          sync_status = EXCLUDED.sync_status,
          sync_details = EXCLUDED.sync_details,
          error_count = CASE WHEN EXCLUDED.sync_status = 'failed' 
                           THEN knowledge_base_sync_status.error_count + 1 
                           ELSE 0 END,
          last_error = EXCLUDED.last_error
      `;
      
      const values = [
        documentId,
        'file_system',
        sourcePath,
        status,
        JSON.stringify({ lastSync: new Date().toISOString() }),
        status === 'failed' ? 1 : 0,
        errorMessage
      ];
      
      await client.query(query, values);
      client.release();

    } catch (error) {
      logger.error('Failed to update sync status:', error);
    }
  }

  /**
   * Helper methods
   */

  calculateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async validateContent(title, content) {
    const errors = [];
    
    if (!title || title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (!content || content.trim().length === 0) {
      errors.push('Content is required');
    }
    
    if (content && content.length < this.minContentLength) {
      errors.push(`Content too short (minimum ${this.minContentLength} characters)`);
    }
    
    if (content && content.length > this.maxContentLength) {
      errors.push(`Content too long (maximum ${this.maxContentLength} characters)`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async generateChangeSummary(title, content, changeType, parentVersionId) {
    try {
      if (!parentVersionId) {
        return `New document: ${title}`;
      }
      
      const parentVersion = await this.getVersionById(parentVersionId);
      if (!parentVersion) {
        return `Updated document: ${title}`;
      }
      
      const changes = [];
      if (parentVersion.title !== title) {
        changes.push('title updated');
      }
      
      const lengthChange = content.length - parentVersion.content.length;
      if (lengthChange > 100) {
        changes.push('content expanded');
      } else if (lengthChange < -100) {
        changes.push('content reduced');
      } else if (lengthChange !== 0) {
        changes.push('content modified');
      }
      
      return changes.length > 0 ? changes.join(', ') : 'minor updates';

    } catch (error) {
      return `Updated: ${title}`;
    }
  }

  async calculateQualityScore(title, content) {
    try {
      // Basic quality scoring
      let score = 0.5; // Base score
      
      // Length factor
      if (content.length >= this.minContentLength && content.length <= this.maxContentLength) {
        score += 0.2;
      }
      
      // Structure factor
      if (content.includes('\n\n') || content.includes('# ')) {
        score += 0.1;
      }
      
      // Title relevance (very basic)
      const titleWords = title.toLowerCase().split(/\s+/);
      const contentLower = content.toLowerCase();
      const titleWordsInContent = titleWords.filter(word => contentLower.includes(word)).length;
      score += (titleWordsInContent / titleWords.length) * 0.2;
      
      return Math.min(1.0, score);

    } catch (error) {
      return 0.7; // Default score
    }
  }

  async getVersionById(versionId) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM knowledge_base_versions WHERE id = $1',
        [versionId]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async updateVersionQualityScore(versionId, qualityScore) {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE knowledge_base_versions SET quality_score = $1 WHERE id = $2',
        [qualityScore, versionId]
      );
    } finally {
      client.release();
    }
  }

  getWordCount(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  parseFileContent(content, filePath) {
    // Basic parser - could be extended for different file formats
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.md':
        return this.parseMarkdown(content);
      case '.txt':
        return this.parsePlainText(content);
      case '.json':
        return this.parseJSON(content);
      default:
        return this.parsePlainText(content);
    }
  }

  parseMarkdown(content) {
    const lines = content.split('\n');
    let title = '';
    let mainContent = content;
    
    // Extract title from first heading
    for (const line of lines) {
      if (line.startsWith('# ')) {
        title = line.substring(2).trim();
        break;
      }
    }
    
    return {
      title: title || 'Untitled',
      content: mainContent,
      metadata: { format: 'markdown' }
    };
  }

  parsePlainText(content) {
    const lines = content.split('\n');
    const title = lines[0]?.trim() || 'Untitled';
    
    return {
      title,
      content,
      metadata: { format: 'plain_text' }
    };
  }

  parseJSON(content) {
    try {
      const data = JSON.parse(content);
      return {
        title: data.title || 'Untitled',
        content: data.content || JSON.stringify(data, null, 2),
        metadata: { ...data.metadata, format: 'json' }
      };
    } catch (error) {
      return {
        title: 'JSON Document',
        content,
        metadata: { format: 'json', parseError: error.message }
      };
    }
  }

  isSupportedFile(filename) {
    const supportedExtensions = ['.md', '.txt', '.json'];
    const ext = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  extractDocumentId(filename) {
    // Remove extension and use as document ID
    return path.basename(filename, path.extname(filename));
  }

  /**
   * Get document history
   */
  async getDocumentHistory(documentId, limit = 10) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          v.*,
          qa.overall_score as quality_score,
          c.change_summary as change_details
        FROM knowledge_base_versions v
        LEFT JOIN knowledge_base_quality_assessments qa ON v.id = qa.version_id
        LEFT JOIN knowledge_base_changes c ON v.id = c.new_version_id
        WHERE v.document_id = $1
        ORDER BY v.version_number DESC
        LIMIT $2
      `;
      
      const result = await client.query(query, [documentId, limit]);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get quality assessment for a version
   */
  async getQualityAssessment(versionId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM knowledge_base_quality_assessments 
        WHERE version_id = $1 
        ORDER BY assessed_at DESC 
        LIMIT 1
      `;
      
      const result = await client.query(query, [versionId]);
      return result.rows[0] || null;

    } finally {
      client.release();
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStatistics() {
    const client = await this.pool.connect();
    
    try {
      const stats = {};
      
      // Document counts
      const docCountQuery = `
        SELECT 
          COUNT(DISTINCT document_id) as total_documents,
          COUNT(*) as total_versions,
          AVG(quality_score) as avg_quality_score
        FROM knowledge_base_versions
      `;
      const docCountResult = await client.query(docCountQuery);
      stats.documents = docCountResult.rows[0];
      
      // Recent changes
      const recentChangesQuery = `
        SELECT COUNT(*) as recent_changes
        FROM knowledge_base_changes
        WHERE detected_at >= NOW() - INTERVAL '7 days'
      `;
      const recentChangesResult = await client.query(recentChangesQuery);
      stats.recentChanges = parseInt(recentChangesResult.rows[0].recent_changes);
      
      // Quality distribution
      const qualityDistQuery = `
        SELECT 
          CASE 
            WHEN quality_score >= 0.8 THEN 'high'
            WHEN quality_score >= 0.6 THEN 'medium'
            ELSE 'low'
          END as quality_level,
          COUNT(*) as count
        FROM knowledge_base_versions
        WHERE is_current = true AND quality_score IS NOT NULL
        GROUP BY quality_level
      `;
      const qualityDistResult = await client.query(qualityDistQuery);
      stats.qualityDistribution = qualityDistResult.rows;
      
      // Sync status
      const syncStatusQuery = `
        SELECT sync_status, COUNT(*) as count
        FROM knowledge_base_sync_status
        GROUP BY sync_status
      `;
      const syncStatusResult = await client.query(syncStatusQuery);
      stats.syncStatus = syncStatusResult.rows;
      
      return stats;

    } finally {
      client.release();
    }
  }

  /**
   * Close and cleanup
   */
  async close() {
    await this.pool.end();
    this.initialized = false;
    logger.info('KnowledgeBaseMaintenanceSystem closed');
  }
}

module.exports = KnowledgeBaseMaintenanceSystem;
