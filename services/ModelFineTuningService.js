/**
 * Model Fine-Tuning Service
 * Optional service for fine-tuning LLM models for improved style, tone, and domain-specific responses
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const OpenAI = require('openai');
const crypto = require('crypto');

class ModelFineTuningService {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
    this.openai = new OpenAI({
      apiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY
    });
    
    // Fine-tuning settings
    this.fineTuningConfig = {
      baseModel: 'gpt-3.5-turbo-1106', // Base model for fine-tuning
      maxTrainingExamples: 10000,
      minTrainingExamples: 50,
      validationSplit: 0.2,
      maxTokensPerExample: 4096,
      trainingEpochs: 3,
      learningRateMultiplier: 0.1,
      batchSize: 1,
      promptLossWeight: 0.01
    };
    
    // Training data categories
    this.trainingCategories = {
      STYLE_TONE: 'style_tone',
      DOMAIN_KNOWLEDGE: 'domain_knowledge',
      RESPONSE_FORMAT: 'response_format',
      CONVERSATION_FLOW: 'conversation_flow',
      COMPLIANCE_LANGUAGE: 'compliance_language',
      ERROR_HANDLING: 'error_handling'
    };
    
    // Fine-tuning job statuses
    this.jobStatuses = {
      PENDING: 'pending',
      RUNNING: 'running',
      SUCCEEDED: 'succeeded',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    };
    
    // Model deployment statuses
    this.deploymentStatuses = {
      STAGING: 'staging',
      PRODUCTION: 'production',
      ARCHIVED: 'archived'
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the fine-tuning service
   */
  async initialize() {
    try {
      await this.ensureTablesExist();
      await this.createDirectoryStructure();
      await this.loadFineTuningConfig();
      
      this.initialized = true;
      logger.info('ModelFineTuningService initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize ModelFineTuningService:', error);
      throw error;
    }
  }

  /**
   * Ensure required database tables exist
   */
  async ensureTablesExist() {
    const client = await this.pool.connect();
    
    try {
      // Create training datasets table
      await client.query(`
        CREATE TABLE IF NOT EXISTS fine_tuning_datasets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dataset_name VARCHAR(200) NOT NULL,
          dataset_description TEXT,
          category VARCHAR(50) NOT NULL,
          source_type VARCHAR(50) NOT NULL, -- manual, conversation_logs, feedback, synthetic
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

      // Create training examples table
      await client.query(`
        CREATE TABLE IF NOT EXISTS fine_tuning_examples (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dataset_id UUID NOT NULL REFERENCES fine_tuning_datasets(id),
          example_type VARCHAR(20) NOT NULL, -- training, validation
          system_message TEXT,
          user_message TEXT NOT NULL,
          assistant_message TEXT NOT NULL,
          context JSONB, -- Additional context like conversation history
          quality_score FLOAT,
          token_count INTEGER,
          source_reference VARCHAR(200), -- Reference to original source (conversation_id, feedback_id, etc.)
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_ft_examples_dataset_id ON fine_tuning_examples (dataset_id);
        CREATE INDEX IF NOT EXISTS idx_ft_examples_type ON fine_tuning_examples (example_type);
        CREATE INDEX IF NOT EXISTS idx_ft_examples_quality ON fine_tuning_examples (quality_score DESC);
        CREATE INDEX IF NOT EXISTS idx_ft_examples_active ON fine_tuning_examples (is_active);
      `);

      // Create fine-tuning jobs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS fine_tuning_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_name VARCHAR(200) NOT NULL,
          openai_job_id VARCHAR(100), -- OpenAI's job ID
          base_model VARCHAR(100) NOT NULL,
          dataset_id UUID NOT NULL REFERENCES fine_tuning_datasets(id),
          hyperparameters JSONB NOT NULL,
          job_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          progress_percentage FLOAT DEFAULT 0.0,
          training_file_id VARCHAR(100), -- OpenAI file ID for training data
          validation_file_id VARCHAR(100), -- OpenAI file ID for validation data
          fine_tuned_model VARCHAR(100), -- Resulting fine-tuned model ID
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

      // Create model deployments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS model_deployments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deployment_name VARCHAR(200) NOT NULL,
          fine_tuning_job_id UUID NOT NULL REFERENCES fine_tuning_jobs(id),
          model_id VARCHAR(100) NOT NULL, -- Fine-tuned model ID
          deployment_status VARCHAR(30) NOT NULL DEFAULT 'staging',
          deployment_config JSONB NOT NULL,
          performance_metrics JSONB,
          a_b_test_config JSONB, -- Configuration for A/B testing
          traffic_percentage FLOAT DEFAULT 0.0, -- Percentage of traffic to route to this model
          deployed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT true
        );

        CREATE INDEX IF NOT EXISTS idx_model_deployments_status ON model_deployments (deployment_status, is_active);
        CREATE INDEX IF NOT EXISTS idx_model_deployments_job ON model_deployments (fine_tuning_job_id);
        CREATE INDEX IF NOT EXISTS idx_model_deployments_model ON model_deployments (model_id);
      `);

      // Create model performance tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS model_performance_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deployment_id UUID NOT NULL REFERENCES model_deployments(id),
          metric_type VARCHAR(50) NOT NULL, -- response_quality, user_satisfaction, response_time, etc.
          metric_value FLOAT NOT NULL,
          measurement_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
          measurement_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
          sample_size INTEGER,
          confidence_interval JSONB, -- {lower: 0.85, upper: 0.95}
          comparison_baseline FLOAT, -- Baseline model performance for comparison
          statistical_significance FLOAT, -- p-value if applicable
          measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_model_performance_deployment ON model_performance_metrics (deployment_id);
        CREATE INDEX IF NOT EXISTS idx_model_performance_type ON model_performance_metrics (metric_type, measured_at DESC);
        CREATE INDEX IF NOT EXISTS idx_model_performance_period ON model_performance_metrics (measurement_period_start, measurement_period_end);
      `);

      logger.info('Fine-tuning database tables ensured');

    } finally {
      client.release();
    }
  }

  /**
   * Create necessary directory structure
   */
  async createDirectoryStructure() {
    const directories = [
      'fine_tuning',
      'fine_tuning/datasets',
      'fine_tuning/training_files',
      'fine_tuning/models',
      'fine_tuning/exports',
      'fine_tuning/backups'
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

    logger.info('Fine-tuning directory structure created');
  }

  /**
   * Load fine-tuning configuration
   */
  async loadFineTuningConfig() {
    try {
      const configPath = path.join(process.cwd(), 'fine_tuning', 'config.json');
      
      try {
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Override default settings with loaded config
        this.fineTuningConfig = { ...this.fineTuningConfig, ...config };
        
        logger.info('Fine-tuning configuration loaded from file');
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Create default configuration file
          await this.saveFineTuningConfig();
          logger.info('Default fine-tuning configuration created');
        } else {
          throw error;
        }
      }

    } catch (error) {
      logger.error('Failed to load fine-tuning configuration:', error);
      // Continue with default settings
    }
  }

  /**
   * Save fine-tuning configuration
   */
  async saveFineTuningConfig() {
    try {
      const configPath = path.join(process.cwd(), 'fine_tuning', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(this.fineTuningConfig, null, 2));
      
      logger.info('Fine-tuning configuration saved');

    } catch (error) {
      logger.error('Failed to save fine-tuning configuration:', error);
    }
  }

  /**
   * Create a new training dataset
   */
  async createTrainingDataset(datasetName, category, description, createdBy = 'system') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Creating training dataset: ${datasetName}`);

      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO fine_tuning_datasets (
          dataset_name, dataset_description, category, source_type, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const values = [datasetName, description, category, 'manual', createdBy];
      const result = await client.query(query, values);
      
      client.release();
      
      const datasetId = result.rows[0].id;
      
      logger.info(`Training dataset created successfully`, { datasetId, datasetName });
      
      return datasetId;

    } catch (error) {
      logger.error(`Failed to create training dataset:`, error);
      throw error;
    }
  }

  /**
   * Add training examples to a dataset
   */
  async addTrainingExamples(datasetId, examples, createdBy = 'system') {
    try {
      logger.info(`Adding ${examples.length} training examples to dataset ${datasetId}`);

      const client = await this.pool.connect();
      
      await client.query('BEGIN');
      
      try {
        for (const example of examples) {
          // Validate example format
          if (!example.userMessage || !example.assistantMessage) {
            throw new Error('Training example must have userMessage and assistantMessage');
          }
          
          // Calculate token count
          const tokenCount = await this.estimateTokenCount(example);
          
          if (tokenCount > this.fineTuningConfig.maxTokensPerExample) {
            logger.warn(`Example exceeds max tokens (${tokenCount}), skipping`);
            continue;
          }
          
          // Calculate quality score
          const qualityScore = await this.calculateExampleQuality(example);
          
          const query = `
            INSERT INTO fine_tuning_examples (
              dataset_id, example_type, system_message, user_message, 
              assistant_message, context, quality_score, token_count, 
              source_reference, created_by, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;
          
          const values = [
            datasetId,
            example.type || 'training',
            example.systemMessage || null,
            example.userMessage,
            example.assistantMessage,
            JSON.stringify(example.context || {}),
            qualityScore,
            tokenCount,
            example.sourceReference || null,
            createdBy,
            JSON.stringify(example.metadata || {})
          ];
          
          await client.query(query, values);
        }
        
        // Update dataset statistics
        await this.updateDatasetStatistics(datasetId, client);
        
        await client.query('COMMIT');
        
        logger.info(`Successfully added training examples to dataset ${datasetId}`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`Failed to add training examples:`, error);
      throw error;
    }
  }

  /**
   * Generate training data from conversation logs
   */
  async generateTrainingDataFromConversations(datasetId, options = {}) {
    try {
      logger.info(`Generating training data from conversations for dataset ${datasetId}`);

      const {
        minRating = 4, // Only use highly-rated conversations
        maxExamples = 1000,
        lookbackDays = 90,
        includeContext = true
      } = options;

      const client = await this.pool.connect();
      
      // Get high-quality conversations
      const conversationsQuery = `
        SELECT 
          c.id, c.messages, c.user_id, c.created_at,
          uf.rating, uf.feedback_text
        FROM conversations c
        LEFT JOIN user_feedback uf ON c.id = uf.conversation_id
        WHERE c.created_at >= NOW() - INTERVAL '${lookbackDays} days'
          AND (uf.rating IS NULL OR uf.rating >= $1)
          AND jsonb_array_length(c.messages) >= 2
        ORDER BY uf.rating DESC NULLS LAST, c.created_at DESC
        LIMIT $2
      `;
      
      const conversationsResult = await client.query(conversationsQuery, [minRating, maxExamples]);
      client.release();
      
      const trainingExamples = [];
      
      for (const conversation of conversationsResult.rows) {
        const messages = conversation.messages || [];
        
        // Extract user-assistant pairs
        for (let i = 0; i < messages.length - 1; i++) {
          const userMessage = messages[i];
          const assistantMessage = messages[i + 1];
          
          if (userMessage.role === 'user' && assistantMessage.role === 'assistant') {
            const example = {
              type: 'training',
              systemMessage: 'You are an intelligent fund management assistant. Provide accurate, helpful, and professional responses.',
              userMessage: userMessage.content,
              assistantMessage: assistantMessage.content,
              context: includeContext ? {
                conversationId: conversation.id,
                rating: conversation.rating,
                feedback: conversation.feedback_text,
                messageIndex: i
              } : {},
              sourceReference: conversation.id,
              metadata: {
                generatedFrom: 'conversation_logs',
                originalRating: conversation.rating
              }
            };
            
            trainingExamples.push(example);
          }
        }
      }
      
      // Add examples to dataset
      if (trainingExamples.length > 0) {
        await this.addTrainingExamples(datasetId, trainingExamples, 'conversation_generator');
      }
      
      logger.info(`Generated ${trainingExamples.length} training examples from conversations`);
      
      return trainingExamples.length;

    } catch (error) {
      logger.error('Failed to generate training data from conversations:', error);
      throw error;
    }
  }

  /**
   * Generate synthetic training data
   */
  async generateSyntheticTrainingData(datasetId, category, count = 100, createdBy = 'system') {
    try {
      logger.info(`Generating ${count} synthetic training examples for category ${category}`);

      const syntheticExamples = [];
      
      // Generate examples in batches to avoid rate limits
      const batchSize = 10;
      const batches = Math.ceil(count / batchSize);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchCount = Math.min(batchSize, count - (batch * batchSize));
        const batchExamples = await this.generateSyntheticBatch(category, batchCount);
        syntheticExamples.push(...batchExamples);
        
        // Small delay between batches to respect rate limits
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Add examples to dataset
      if (syntheticExamples.length > 0) {
        await this.addTrainingExamples(datasetId, syntheticExamples, createdBy);
      }
      
      logger.info(`Generated ${syntheticExamples.length} synthetic training examples`);
      
      return syntheticExamples.length;

    } catch (error) {
      logger.error('Failed to generate synthetic training data:', error);
      throw error;
    }
  }

  /**
   * Generate a batch of synthetic examples
   */
  async generateSyntheticBatch(category, count) {
    try {
      const prompt = this.getSyntheticDataPrompt(category, count);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000
      });
      
      const generatedData = JSON.parse(response.choices[0].message.content);
      
      return generatedData.examples.map(example => ({
        type: 'training',
        systemMessage: example.systemMessage || 'You are an intelligent fund management assistant.',
        userMessage: example.userMessage,
        assistantMessage: example.assistantMessage,
        context: { category },
        metadata: {
          generatedFrom: 'synthetic_ai',
          category,
          generatedAt: new Date().toISOString()
        }
      }));

    } catch (error) {
      logger.error('Failed to generate synthetic batch:', error);
      return [];
    }
  }

  /**
   * Get synthetic data generation prompt
   */
  getSyntheticDataPrompt(category, count) {
    const categoryPrompts = {
      [this.trainingCategories.STYLE_TONE]: `
        Generate ${count} training examples for a fund management chatbot with a professional, helpful, and clear communication style.
        Focus on examples that demonstrate proper tone, language formality, and professional terminology.
      `,
      [this.trainingCategories.DOMAIN_KNOWLEDGE]: `
        Generate ${count} training examples about fund management, investment strategies, portfolio management, and related financial concepts.
        Include accurate domain-specific information and terminology.
      `,
      [this.trainingCategories.RESPONSE_FORMAT]: `
        Generate ${count} training examples that demonstrate proper response formatting, including structured answers, bullet points, and clear organization.
      `,
      [this.trainingCategories.COMPLIANCE_LANGUAGE]: `
        Generate ${count} training examples that demonstrate appropriate compliance language, disclaimers, and regulatory considerations for fund management.
      `,
      [this.trainingCategories.ERROR_HANDLING]: `
        Generate ${count} training examples showing how to handle unclear questions, missing information, and error scenarios professionally.
      `
    };

    const basePrompt = categoryPrompts[category] || `Generate ${count} training examples for a fund management chatbot.`;
    
    return `
      ${basePrompt}
      
      Each example should have:
      - systemMessage: A system prompt (optional)
      - userMessage: A realistic user question or request
      - assistantMessage: A high-quality, professional response
      
      Ensure examples are diverse, realistic, and of high quality.
      
      Respond with JSON:
      {
        "examples": [
          {
            "systemMessage": "You are an intelligent fund management assistant.",
            "userMessage": "What is the difference between active and passive fund management?",
            "assistantMessage": "Active and passive fund management represent two distinct investment approaches..."
          }
        ]
      }
    `;
  }

  /**
   * Prepare dataset for fine-tuning
   */
  async prepareDatasetForTraining(datasetId) {
    try {
      logger.info(`Preparing dataset ${datasetId} for training`);

      const client = await this.pool.connect();
      
      // Get dataset info
      const datasetQuery = 'SELECT * FROM fine_tuning_datasets WHERE id = $1';
      const datasetResult = await client.query(datasetQuery, [datasetId]);
      const dataset = datasetResult.rows[0];
      
      if (!dataset) {
        throw new Error('Dataset not found');
      }
      
      // Get all examples
      const examplesQuery = `
        SELECT * FROM fine_tuning_examples 
        WHERE dataset_id = $1 AND is_active = true
        ORDER BY quality_score DESC, created_at DESC
      `;
      const examplesResult = await client.query(examplesQuery, [datasetId]);
      const examples = examplesResult.rows;
      
      client.release();
      
      if (examples.length < this.fineTuningConfig.minTrainingExamples) {
        throw new Error(`Insufficient training examples. Need at least ${this.fineTuningConfig.minTrainingExamples}, have ${examples.length}`);
      }
      
      // Split into training and validation
      const shuffled = this.shuffleArray([...examples]);
      const validationCount = Math.floor(examples.length * this.fineTuningConfig.validationSplit);
      const trainingCount = examples.length - validationCount;
      
      const trainingExamples = shuffled.slice(0, trainingCount);
      const validationExamples = shuffled.slice(trainingCount);
      
      // Convert to OpenAI format
      const trainingData = trainingExamples.map(ex => this.convertToOpenAIFormat(ex));
      const validationData = validationExamples.map(ex => this.convertToOpenAIFormat(ex));
      
      // Save training files
      const trainingFilePath = path.join(process.cwd(), 'fine_tuning', 'training_files', `${datasetId}_training.jsonl`);
      const validationFilePath = path.join(process.cwd(), 'fine_tuning', 'training_files', `${datasetId}_validation.jsonl`);
      
      await this.saveJSONLFile(trainingFilePath, trainingData);
      await this.saveJSONLFile(validationFilePath, validationData);
      
      // Update dataset statistics
      await this.updateDatasetCounts(datasetId, trainingCount, validationCount);
      
      logger.info(`Dataset prepared for training`, {
        datasetId,
        trainingExamples: trainingCount,
        validationExamples: validationCount,
        trainingFilePath,
        validationFilePath
      });
      
      return {
        trainingFilePath,
        validationFilePath,
        trainingCount,
        validationCount
      };

    } catch (error) {
      logger.error(`Failed to prepare dataset for training:`, error);
      throw error;
    }
  }

  /**
   * Start a fine-tuning job
   */
  async startFineTuningJob(datasetId, jobName, hyperparameters = {}, createdBy = 'system') {
    try {
      logger.info(`Starting fine-tuning job: ${jobName} for dataset ${datasetId}`);

      // Prepare dataset
      const datasetPrep = await this.prepareDatasetForTraining(datasetId);
      
      // Upload training files to OpenAI
      const trainingFileId = await this.uploadFileToOpenAI(datasetPrep.trainingFilePath, 'fine-tune');
      const validationFileId = await this.uploadFileToOpenAI(datasetPrep.validationFilePath, 'fine-tune');
      
      // Merge hyperparameters with defaults
      const finalHyperparameters = {
        ...this.fineTuningConfig,
        ...hyperparameters
      };
      
      // Create fine-tuning job on OpenAI
      const openaiJob = await this.openai.fineTuning.jobs.create({
        training_file: trainingFileId,
        validation_file: validationFileId,
        model: finalHyperparameters.baseModel,
        hyperparameters: {
          n_epochs: finalHyperparameters.trainingEpochs,
          batch_size: finalHyperparameters.batchSize,
          learning_rate_multiplier: finalHyperparameters.learningRateMultiplier
        },
        suffix: jobName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 18) // OpenAI suffix requirements
      });
      
      // Store job in database
      const jobId = await this.storeFineTuningJob({
        jobName,
        openaiJobId: openaiJob.id,
        baseModel: finalHyperparameters.baseModel,
        datasetId,
        hyperparameters: finalHyperparameters,
        trainingFileId,
        validationFileId,
        createdBy
      });
      
      logger.info(`Fine-tuning job started successfully`, {
        jobId,
        openaiJobId: openaiJob.id,
        trainingFileId,
        validationFileId
      });
      
      return {
        jobId,
        openaiJobId: openaiJob.id,
        status: openaiJob.status
      };

    } catch (error) {
      logger.error(`Failed to start fine-tuning job:`, error);
      throw error;
    }
  }

  /**
   * Monitor fine-tuning job progress
   */
  async monitorFineTuningJob(jobId) {
    try {
      const client = await this.pool.connect();
      
      const jobQuery = 'SELECT * FROM fine_tuning_jobs WHERE id = $1';
      const jobResult = await client.query(jobQuery, [jobId]);
      const job = jobResult.rows[0];
      
      client.release();
      
      if (!job) {
        throw new Error('Fine-tuning job not found');
      }
      
      if (!job.openai_job_id) {
        throw new Error('No OpenAI job ID found');
      }
      
      // Get job status from OpenAI
      const openaiJob = await this.openai.fineTuning.jobs.retrieve(job.openai_job_id);
      
      // Update job status in database
      await this.updateJobStatus(jobId, {
        status: openaiJob.status,
        fineTunedModel: openaiJob.fine_tuned_model,
        trainingMetrics: openaiJob.trained_tokens ? { trainedTokens: openaiJob.trained_tokens } : null,
        errorMessage: openaiJob.error?.message || null
      });
      
      logger.info(`Fine-tuning job status updated`, {
        jobId,
        status: openaiJob.status,
        fineTunedModel: openaiJob.fine_tuned_model
      });
      
      return {
        jobId,
        status: openaiJob.status,
        fineTunedModel: openaiJob.fine_tuned_model,
        progress: this.calculateProgress(openaiJob.status),
        error: openaiJob.error?.message
      };

    } catch (error) {
      logger.error(`Failed to monitor fine-tuning job:`, error);
      throw error;
    }
  }

  /**
   * Deploy a fine-tuned model
   */
  async deployModel(jobId, deploymentName, deploymentConfig = {}, createdBy = 'system') {
    try {
      logger.info(`Deploying model from job ${jobId} as ${deploymentName}`);

      const client = await this.pool.connect();
      
      // Get job details
      const jobQuery = 'SELECT * FROM fine_tuning_jobs WHERE id = $1 AND job_status = $2';
      const jobResult = await client.query(jobQuery, [jobId, this.jobStatuses.SUCCEEDED]);
      const job = jobResult.rows[0];
      
      if (!job) {
        throw new Error('Fine-tuning job not found or not completed successfully');
      }
      
      if (!job.fine_tuned_model) {
        throw new Error('No fine-tuned model available');
      }
      
      // Create deployment record
      const deploymentQuery = `
        INSERT INTO model_deployments (
          deployment_name, fine_tuning_job_id, model_id, 
          deployment_status, deployment_config, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const deploymentValues = [
        deploymentName,
        jobId,
        job.fine_tuned_model,
        this.deploymentStatuses.STAGING,
        JSON.stringify(deploymentConfig),
        createdBy
      ];
      
      const deploymentResult = await client.query(deploymentQuery, deploymentValues);
      const deploymentId = deploymentResult.rows[0].id;
      
      client.release();
      
      logger.info(`Model deployed successfully`, {
        deploymentId,
        deploymentName,
        modelId: job.fine_tuned_model
      });
      
      return {
        deploymentId,
        modelId: job.fine_tuned_model,
        status: this.deploymentStatuses.STAGING
      };

    } catch (error) {
      logger.error(`Failed to deploy model:`, error);
      throw error;
    }
  }

  /**
   * Evaluate model performance
   */
  async evaluateModelPerformance(deploymentId, evaluationConfig = {}) {
    try {
      logger.info(`Evaluating performance for deployment ${deploymentId}`);

      const {
        testDatasetId = null,
        sampleSize = 100,
        evaluationMetrics = ['response_quality', 'relevance', 'consistency']
      } = evaluationConfig;

      const client = await this.pool.connect();
      
      // Get deployment details
      const deploymentQuery = 'SELECT * FROM model_deployments WHERE id = $1';
      const deploymentResult = await client.query(deploymentQuery, [deploymentId]);
      const deployment = deploymentResult.rows[0];
      
      if (!deployment) {
        throw new Error('Deployment not found');
      }
      
      // Get test data
      let testExamples;
      if (testDatasetId) {
        const testQuery = `
          SELECT * FROM fine_tuning_examples 
          WHERE dataset_id = $1 AND example_type = 'validation' AND is_active = true
          ORDER BY RANDOM()
          LIMIT $2
        `;
        const testResult = await client.query(testQuery, [testDatasetId, sampleSize]);
        testExamples = testResult.rows;
      } else {
        // Use general evaluation dataset
        testExamples = await this.getGeneralEvaluationData(sampleSize);
      }
      
      client.release();
      
      if (testExamples.length === 0) {
        throw new Error('No test examples available for evaluation');
      }
      
      // Run evaluation
      const results = await this.runModelEvaluation(deployment.model_id, testExamples, evaluationMetrics);
      
      // Store performance metrics
      await this.storePerformanceMetrics(deploymentId, results);
      
      logger.info(`Model performance evaluation completed`, {
        deploymentId,
        testExamples: testExamples.length,
        averageScore: results.averageScore
      });
      
      return results;

    } catch (error) {
      logger.error(`Failed to evaluate model performance:`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  async estimateTokenCount(example) {
    // Simple token estimation (actual implementation would use tiktoken)
    const text = (example.systemMessage || '') + example.userMessage + example.assistantMessage;
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }

  async calculateExampleQuality(example) {
    // Basic quality scoring based on length, completeness, etc.
    let score = 0.5;
    
    // Length factors
    if (example.assistantMessage.length > 50) score += 0.1;
    if (example.assistantMessage.length > 200) score += 0.1;
    
    // Completeness
    if (example.systemMessage) score += 0.1;
    
    // Basic coherence check (very simple)
    if (example.assistantMessage.includes('.') && example.assistantMessage.split('.').length > 1) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  async updateDatasetStatistics(datasetId, client) {
    const statsQuery = `
      UPDATE fine_tuning_datasets SET
        total_examples = (
          SELECT COUNT(*) FROM fine_tuning_examples 
          WHERE dataset_id = $1 AND is_active = true
        ),
        training_examples = (
          SELECT COUNT(*) FROM fine_tuning_examples 
          WHERE dataset_id = $1 AND example_type = 'training' AND is_active = true
        ),
        validation_examples = (
          SELECT COUNT(*) FROM fine_tuning_examples 
          WHERE dataset_id = $1 AND example_type = 'validation' AND is_active = true
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await client.query(statsQuery, [datasetId]);
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  convertToOpenAIFormat(example) {
    const messages = [];
    
    if (example.system_message) {
      messages.push({ role: 'system', content: example.system_message });
    }
    
    messages.push({ role: 'user', content: example.user_message });
    messages.push({ role: 'assistant', content: example.assistant_message });
    
    return { messages };
  }

  async saveJSONLFile(filePath, data) {
    const content = data.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile(filePath, content, 'utf8');
  }

  async uploadFileToOpenAI(filePath, purpose) {
    const fileStream = await fs.readFile(filePath);
    
    const file = await this.openai.files.create({
      file: fileStream,
      purpose: purpose
    });
    
    return file.id;
  }

  async storeFineTuningJob(jobData) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO fine_tuning_jobs (
          job_name, openai_job_id, base_model, dataset_id, hyperparameters,
          training_file_id, validation_file_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      const values = [
        jobData.jobName,
        jobData.openaiJobId,
        jobData.baseModel,
        jobData.datasetId,
        JSON.stringify(jobData.hyperparameters),
        jobData.trainingFileId,
        jobData.validationFileId,
        jobData.createdBy
      ];
      
      const result = await client.query(query, values);
      return result.rows[0].id;

    } finally {
      client.release();
    }
  }

  async updateJobStatus(jobId, updates) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE fine_tuning_jobs SET
          job_status = $2,
          fine_tuned_model = $3,
          training_metrics = $4,
          error_message = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      const values = [
        jobId,
        updates.status,
        updates.fineTunedModel || null,
        updates.trainingMetrics ? JSON.stringify(updates.trainingMetrics) : null,
        updates.errorMessage || null
      ];
      
      await client.query(query, values);

    } finally {
      client.release();
    }
  }

  async updateDatasetCounts(datasetId, trainingCount, validationCount) {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE fine_tuning_datasets SET training_examples = $2, validation_examples = $3 WHERE id = $1',
        [datasetId, trainingCount, validationCount]
      );
    } finally {
      client.release();
    }
  }

  calculateProgress(status) {
    const progressMap = {
      'validating_files': 10,
      'queued': 20,
      'running': 50,
      'succeeded': 100,
      'failed': 0,
      'cancelled': 0
    };
    
    return progressMap[status] || 0;
  }

  async getGeneralEvaluationData(sampleSize) {
    // This would return a general evaluation dataset
    // For now, return empty array
    return [];
  }

  async runModelEvaluation(modelId, testExamples, metrics) {
    // This would run actual evaluation against the model
    // For now, return mock results
    return {
      averageScore: 0.85,
      metrics: {
        response_quality: 0.87,
        relevance: 0.83,
        consistency: 0.85
      },
      sampleSize: testExamples.length
    };
  }

  async storePerformanceMetrics(deploymentId, results) {
    const client = await this.pool.connect();
    
    try {
      for (const [metricType, value] of Object.entries(results.metrics)) {
        const query = `
          INSERT INTO model_performance_metrics (
            deployment_id, metric_type, metric_value, 
            measurement_period_start, measurement_period_end, sample_size
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        const now = new Date();
        const values = [
          deploymentId,
          metricType,
          value,
          now,
          now,
          results.sampleSize
        ];
        
        await client.query(query, values);
      }

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
    logger.info('ModelFineTuningService closed');
  }
}

module.exports = ModelFineTuningService;
