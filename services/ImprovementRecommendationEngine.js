/**
 * Improvement Recommendation Engine
 * Generates actionable recommendations based on feedback analysis and system performance
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const OpenAI = require('openai');

class ImprovementRecommendationEngine {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
    this.openai = new OpenAI({
      apiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY
    });
    
    // Recommendation types
    this.recommendationTypes = {
      CONTENT_UPDATE: 'content_update',
      SYSTEM_OPTIMIZATION: 'system_optimization',
      UI_IMPROVEMENT: 'ui_improvement',
      PROCESS_CHANGE: 'process_change',
      TRAINING_NEEDED: 'training_needed',
      TECHNICAL_FIX: 'technical_fix',
      FEATURE_REQUEST: 'feature_request',
      PERFORMANCE_TUNING: 'performance_tuning'
    };
    
    // Priority levels
    this.priorities = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low'
    };
    
    // Impact categories
    this.impactCategories = {
      USER_SATISFACTION: 'user_satisfaction',
      SYSTEM_PERFORMANCE: 'system_performance',
      CONTENT_QUALITY: 'content_quality',
      OPERATIONAL_EFFICIENCY: 'operational_efficiency',
      COMPLIANCE: 'compliance',
      COST_REDUCTION: 'cost_reduction'
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the recommendation engine
   */
  async initialize() {
    try {
      await this.ensureTablesExist();
      await this.loadRecommendationRules();
      
      this.initialized = true;
      logger.info('ImprovementRecommendationEngine initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize ImprovementRecommendationEngine:', error);
      throw error;
    }
  }

  /**
   * Ensure required database tables exist
   */
  async ensureTablesExist() {
    const client = await this.pool.connect();
    
    try {
      // Create recommendation rules table
      await client.query(`
        CREATE TABLE IF NOT EXISTS recommendation_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT NOT NULL,
          condition_type VARCHAR(50) NOT NULL, -- feedback_pattern, performance_metric, error_rate
          conditions JSONB NOT NULL,
          recommendation_template JSONB NOT NULL,
          priority VARCHAR(20) NOT NULL,
          impact_category VARCHAR(50) NOT NULL,
          effort_estimate INTEGER, -- hours
          success_metrics JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_recommendation_rules_condition_type ON recommendation_rules (condition_type);
        CREATE INDEX IF NOT EXISTS idx_recommendation_rules_priority ON recommendation_rules (priority);
        CREATE INDEX IF NOT EXISTS idx_recommendation_rules_active ON recommendation_rules (is_active);
      `);

      // Create recommendation execution tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS recommendation_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recommendation_id UUID REFERENCES improvement_recommendations(id),
          execution_type VARCHAR(50) NOT NULL, -- manual, automated, scheduled
          executed_by VARCHAR(100),
          execution_status VARCHAR(30) NOT NULL, -- started, in_progress, completed, failed
          start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP WITH TIME ZONE,
          execution_notes TEXT,
          before_metrics JSONB,
          after_metrics JSONB,
          success_score FLOAT, -- 0-1 based on success metrics
          lessons_learned TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_recommendation_executions_status ON recommendation_executions (execution_status);
        CREATE INDEX IF NOT EXISTS idx_recommendation_executions_recommendation_id ON recommendation_executions (recommendation_id);
      `);

      // Create recommendation impact tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS recommendation_impacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recommendation_id UUID REFERENCES improvement_recommendations(id),
          impact_category VARCHAR(50) NOT NULL,
          metric_name VARCHAR(100) NOT NULL,
          baseline_value FLOAT NOT NULL,
          target_value FLOAT,
          current_value FLOAT,
          measurement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          improvement_percentage FLOAT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_recommendation_impacts_category ON recommendation_impacts (impact_category);
        CREATE INDEX IF NOT EXISTS idx_recommendation_impacts_recommendation_id ON recommendation_impacts (recommendation_id);
      `);

      // Create recommendation templates table
      await client.query(`
        CREATE TABLE IF NOT EXISTS recommendation_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_name VARCHAR(100) UNIQUE NOT NULL,
          category VARCHAR(50) NOT NULL,
          title_template TEXT NOT NULL,
          description_template TEXT NOT NULL,
          action_items JSONB NOT NULL,
          success_criteria JSONB NOT NULL,
          estimated_effort_hours INTEGER,
          required_skills TEXT[],
          dependencies TEXT[],
          risk_level VARCHAR(20) DEFAULT 'medium',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_recommendation_templates_category ON recommendation_templates (category);
        CREATE INDEX IF NOT EXISTS idx_recommendation_templates_active ON recommendation_templates (is_active);
      `);

      logger.info('Recommendation engine database tables ensured');

    } finally {
      client.release();
    }
  }

  /**
   * Load recommendation rules and templates
   */
  async loadRecommendationRules() {
    try {
      await this.insertDefaultRules();
      await this.insertDefaultTemplates();
      
      // Load rules from database
      const client = await this.pool.connect();
      const rulesResult = await client.query('SELECT * FROM recommendation_rules WHERE is_active = true');
      const templatesResult = await client.query('SELECT * FROM recommendation_templates WHERE is_active = true');
      client.release();
      
      this.rules = rulesResult.rows;
      this.templates = templatesResult.rows;
      
      logger.info('Recommendation rules and templates loaded', {
        rulesCount: this.rules.length,
        templatesCount: this.templates.length
      });

    } catch (error) {
      logger.error('Failed to load recommendation rules:', error);
      throw error;
    }
  }

  /**
   * Insert default recommendation rules
   */
  async insertDefaultRules() {
    const client = await this.pool.connect();
    
    const defaultRules = [
      {
        rule_name: 'high_negative_feedback_accuracy',
        description: 'Triggers when accuracy feedback becomes consistently negative',
        condition_type: 'feedback_pattern',
        conditions: {
          category: 'accuracy',
          negative_threshold: 5,
          time_window_days: 7,
          severity_threshold: 'medium'
        },
        recommendation_template: {
          type: this.recommendationTypes.CONTENT_UPDATE,
          priority: this.priorities.HIGH,
          impact: this.impactCategories.CONTENT_QUALITY
        },
        priority: this.priorities.HIGH,
        impact_category: this.impactCategories.CONTENT_QUALITY,
        effort_estimate: 24,
        success_metrics: {
          accuracy_feedback_improvement: 0.3,
          negative_feedback_reduction: 0.5
        }
      },
      {
        rule_name: 'slow_response_time',
        description: 'Triggers when response times exceed acceptable thresholds',
        condition_type: 'performance_metric',
        conditions: {
          metric: 'average_response_time',
          threshold: 5000, // milliseconds
          time_window_minutes: 60,
          consecutive_violations: 3
        },
        recommendation_template: {
          type: this.recommendationTypes.PERFORMANCE_TUNING,
          priority: this.priorities.HIGH,
          impact: this.impactCategories.SYSTEM_PERFORMANCE
        },
        priority: this.priorities.HIGH,
        impact_category: this.impactCategories.SYSTEM_PERFORMANCE,
        effort_estimate: 16,
        success_metrics: {
          response_time_improvement: 0.4,
          user_satisfaction_increase: 0.2
        }
      },
      {
        rule_name: 'high_error_rate',
        description: 'Triggers when system error rates exceed normal levels',
        condition_type: 'error_rate',
        conditions: {
          error_threshold: 0.05, // 5% error rate
          time_window_hours: 2,
          error_types: ['system_error', 'timeout', 'api_error']
        },
        recommendation_template: {
          type: this.recommendationTypes.TECHNICAL_FIX,
          priority: this.priorities.CRITICAL,
          impact: this.impactCategories.SYSTEM_PERFORMANCE
        },
        priority: this.priorities.CRITICAL,
        impact_category: this.impactCategories.SYSTEM_PERFORMANCE,
        effort_estimate: 8,
        success_metrics: {
          error_rate_reduction: 0.8,
          system_stability_improvement: 0.5
        }
      },
      {
        rule_name: 'poor_citation_feedback',
        description: 'Triggers when citation quality feedback is consistently poor',
        condition_type: 'feedback_pattern',
        conditions: {
          category: 'citations',
          negative_threshold: 3,
          time_window_days: 14,
          rating_threshold: 2
        },
        recommendation_template: {
          type: this.recommendationTypes.SYSTEM_OPTIMIZATION,
          priority: this.priorities.MEDIUM,
          impact: this.impactCategories.CONTENT_QUALITY
        },
        priority: this.priorities.MEDIUM,
        impact_category: this.impactCategories.CONTENT_QUALITY,
        effort_estimate: 12,
        success_metrics: {
          citation_quality_improvement: 0.4,
          user_trust_increase: 0.3
        }
      },
      {
        rule_name: 'ui_usability_issues',
        description: 'Triggers when user experience feedback indicates usability problems',
        condition_type: 'feedback_pattern',
        conditions: {
          category: 'user_experience',
          negative_threshold: 4,
          time_window_days: 10,
          themes: ['confusing_interface', 'navigation_issues', 'poor_design']
        },
        recommendation_template: {
          type: this.recommendationTypes.UI_IMPROVEMENT,
          priority: this.priorities.MEDIUM,
          impact: this.impactCategories.USER_SATISFACTION
        },
        priority: this.priorities.MEDIUM,
        impact_category: this.impactCategories.USER_SATISFACTION,
        effort_estimate: 32,
        success_metrics: {
          ui_satisfaction_improvement: 0.5,
          task_completion_rate_increase: 0.3
        }
      },
      {
        rule_name: 'incomplete_responses',
        description: 'Triggers when users consistently report incomplete responses',
        condition_type: 'feedback_pattern',
        conditions: {
          category: 'completeness',
          negative_threshold: 6,
          time_window_days: 7,
          keywords: ['incomplete', 'missing', 'more_detail']
        },
        recommendation_template: {
          type: this.recommendationTypes.CONTENT_UPDATE,
          priority: this.priorities.HIGH,
          impact: this.impactCategories.CONTENT_QUALITY
        },
        priority: this.priorities.HIGH,
        impact_category: this.impactCategories.CONTENT_QUALITY,
        effort_estimate: 20,
        success_metrics: {
          completeness_satisfaction: 0.4,
          follow_up_question_reduction: 0.3
        }
      }
    ];

    for (const rule of defaultRules) {
      try {
        await client.query(`
          INSERT INTO recommendation_rules (
            rule_name, description, condition_type, conditions,
            recommendation_template, priority, impact_category,
            effort_estimate, success_metrics
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (rule_name) DO UPDATE SET
            description = EXCLUDED.description,
            conditions = EXCLUDED.conditions,
            recommendation_template = EXCLUDED.recommendation_template,
            updated_at = CURRENT_TIMESTAMP
        `, [
          rule.rule_name,
          rule.description,
          rule.condition_type,
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.recommendation_template),
          rule.priority,
          rule.impact_category,
          rule.effort_estimate,
          JSON.stringify(rule.success_metrics)
        ]);
      } catch (error) {
        logger.error(`Failed to insert rule ${rule.rule_name}:`, error);
      }
    }

    client.release();
    logger.info('Default recommendation rules inserted');
  }

  /**
   * Insert default recommendation templates
   */
  async insertDefaultTemplates() {
    const client = await this.pool.connect();
    
    const defaultTemplates = [
      {
        template_name: 'accuracy_improvement',
        category: this.recommendationTypes.CONTENT_UPDATE,
        title_template: 'Improve Accuracy in {category} Responses',
        description_template: 'Address {issue_count} accuracy issues identified in {category} feedback over the past {timeframe}',
        action_items: [
          'Review and validate content accuracy in knowledge base',
          'Update outdated information with current data',
          'Implement content review workflow with subject matter experts',
          'Add accuracy validation checks to content pipeline',
          'Create process for regular content audits'
        ],
        success_criteria: [
          'Reduce negative accuracy feedback by 50%',
          'Improve average accuracy rating to 4.0+',
          'Decrease fact-checking related support tickets by 30%'
        ],
        estimated_effort_hours: 24,
        required_skills: ['content_management', 'domain_expertise', 'quality_assurance'],
        dependencies: ['knowledge_base_access', 'subject_matter_expert_availability'],
        risk_level: 'medium'
      },
      {
        template_name: 'performance_optimization',
        category: this.recommendationTypes.PERFORMANCE_TUNING,
        title_template: 'Optimize {component} Performance',
        description_template: 'Improve system performance to address {metric_name} issues affecting user experience',
        action_items: [
          'Profile system performance to identify bottlenecks',
          'Optimize database queries and indexing',
          'Implement caching strategies for frequently accessed data',
          'Review and optimize API response times',
          'Monitor and tune system resource usage'
        ],
        success_criteria: [
          'Reduce average response time by 40%',
          'Achieve 95% of requests under 3 seconds',
          'Improve system throughput by 25%'
        ],
        estimated_effort_hours: 16,
        required_skills: ['system_optimization', 'database_tuning', 'performance_monitoring'],
        dependencies: ['system_access', 'monitoring_tools', 'testing_environment'],
        risk_level: 'medium'
      },
      {
        template_name: 'ui_enhancement',
        category: this.recommendationTypes.UI_IMPROVEMENT,
        title_template: 'Enhance User Interface for {area}',
        description_template: 'Improve user experience based on {feedback_count} usability feedback items',
        action_items: [
          'Conduct user experience research and testing',
          'Redesign problematic interface components',
          'Improve navigation and information architecture',
          'Implement accessibility best practices',
          'Create user-friendly help and guidance features'
        ],
        success_criteria: [
          'Increase user satisfaction rating by 30%',
          'Improve task completion rate by 25%',
          'Reduce user support requests by 20%'
        ],
        estimated_effort_hours: 32,
        required_skills: ['ui_design', 'user_experience', 'frontend_development'],
        dependencies: ['design_tools', 'user_testing_resources', 'development_environment'],
        risk_level: 'low'
      },
      {
        template_name: 'technical_fix',
        category: this.recommendationTypes.TECHNICAL_FIX,
        title_template: 'Resolve {issue_type} Technical Issues',
        description_template: 'Fix critical technical issues causing {error_rate}% error rate',
        action_items: [
          'Investigate root cause of technical issues',
          'Implement fixes for identified problems',
          'Add error handling and recovery mechanisms',
          'Improve system monitoring and alerting',
          'Create incident response procedures'
        ],
        success_criteria: [
          'Reduce error rate to under 1%',
          'Eliminate critical system failures',
          'Improve system uptime to 99.9%'
        ],
        estimated_effort_hours: 8,
        required_skills: ['system_debugging', 'error_handling', 'monitoring'],
        dependencies: ['system_logs', 'debugging_tools', 'testing_environment'],
        risk_level: 'high'
      },
      {
        template_name: 'content_expansion',
        category: this.recommendationTypes.CONTENT_UPDATE,
        title_template: 'Expand Content Coverage for {topic_area}',
        description_template: 'Address content gaps identified through {source} analysis',
        action_items: [
          'Identify specific content gaps and missing information',
          'Research and develop comprehensive content for missing areas',
          'Review and update existing content for completeness',
          'Implement content quality assurance processes',
          'Create content maintenance and update schedules'
        ],
        success_criteria: [
          'Increase content coverage by 40%',
          'Reduce "information not found" responses by 60%',
          'Improve completeness satisfaction rating to 4.2+'
        ],
        estimated_effort_hours: 40,
        required_skills: ['content_creation', 'research', 'domain_expertise'],
        dependencies: ['content_management_system', 'subject_matter_experts', 'approval_workflow'],
        risk_level: 'low'
      },
      {
        template_name: 'system_integration',
        category: this.recommendationTypes.FEATURE_REQUEST,
        title_template: 'Integrate with {system_name} System',
        description_template: 'Implement integration to improve {benefit_area} capabilities',
        action_items: [
          'Analyze integration requirements and specifications',
          'Design integration architecture and data flows',
          'Implement secure API connections and data exchange',
          'Test integration functionality and performance',
          'Create monitoring and maintenance procedures'
        ],
        success_criteria: [
          'Successfully integrate with target system',
          'Achieve 99% data synchronization accuracy',
          'Reduce manual data entry by 80%'
        ],
        estimated_effort_hours: 60,
        required_skills: ['system_integration', 'api_development', 'data_mapping'],
        dependencies: ['target_system_access', 'api_documentation', 'security_approval'],
        risk_level: 'high'
      }
    ];

    for (const template of defaultTemplates) {
      try {
        await client.query(`
          INSERT INTO recommendation_templates (
            template_name, category, title_template, description_template,
            action_items, success_criteria, estimated_effort_hours,
            required_skills, dependencies, risk_level
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (template_name) DO UPDATE SET
            category = EXCLUDED.category,
            title_template = EXCLUDED.title_template,
            description_template = EXCLUDED.description_template,
            action_items = EXCLUDED.action_items,
            success_criteria = EXCLUDED.success_criteria,
            updated_at = CURRENT_TIMESTAMP
        `, [
          template.template_name,
          template.category,
          template.title_template,
          template.description_template,
          JSON.stringify(template.action_items),
          JSON.stringify(template.success_criteria),
          template.estimated_effort_hours,
          template.required_skills,
          template.dependencies,
          template.risk_level
        ]);
      } catch (error) {
        logger.error(`Failed to insert template ${template.template_name}:`, error);
      }
    }

    client.release();
    logger.info('Default recommendation templates inserted');
  }

  /**
   * Generate recommendations based on current system state
   */
  async generateRecommendations(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        timeframe = '7 days',
        includeExecuted = false,
        maxRecommendations = 20,
        priorityFilter = null,
        categoryFilter = null
      } = options;

      logger.info('Generating improvement recommendations', { 
        timeframe, 
        maxRecommendations,
        priorityFilter,
        categoryFilter
      });

      const recommendations = [];
      
      // Evaluate each rule against current system state
      for (const rule of this.rules) {
        try {
          const ruleEvaluation = await this.evaluateRule(rule, timeframe);
          
          if (ruleEvaluation.triggered) {
            const recommendation = await this.createRecommendationFromRule(
              rule, 
              ruleEvaluation.context
            );
            
            if (recommendation) {
              recommendations.push(recommendation);
            }
          }
        } catch (error) {
          logger.error(`Failed to evaluate rule ${rule.rule_name}:`, error);
        }
      }

      // Generate AI-powered recommendations
      const aiRecommendations = await this.generateAIRecommendations(timeframe);
      recommendations.push(...aiRecommendations);

      // Filter and prioritize recommendations
      let filteredRecommendations = recommendations;
      
      if (priorityFilter) {
        filteredRecommendations = filteredRecommendations.filter(
          rec => rec.priority === priorityFilter
        );
      }
      
      if (categoryFilter) {
        filteredRecommendations = filteredRecommendations.filter(
          rec => rec.category === categoryFilter
        );
      }

      // Remove duplicates and existing recommendations
      const uniqueRecommendations = await this.deduplicateRecommendations(
        filteredRecommendations, 
        includeExecuted
      );

      // Prioritize and limit results
      const prioritizedRecommendations = this.prioritizeRecommendations(uniqueRecommendations);
      const finalRecommendations = prioritizedRecommendations.slice(0, maxRecommendations);

      // Store recommendations in database
      const storedRecommendations = [];
      for (const rec of finalRecommendations) {
        try {
          const storedId = await this.storeRecommendation(rec);
          storedRecommendations.push({ ...rec, id: storedId });
        } catch (error) {
          logger.error('Failed to store recommendation:', error);
        }
      }

      const result = {
        generatedAt: new Date().toISOString(),
        timeframe,
        totalEvaluated: this.rules.length,
        totalTriggered: recommendations.length,
        totalUnique: uniqueRecommendations.length,
        totalStored: storedRecommendations.length,
        recommendations: storedRecommendations,
        summary: this.generateRecommendationSummary(storedRecommendations)
      };

      logger.info('Recommendations generated successfully', {
        totalStored: storedRecommendations.length,
        criticalCount: storedRecommendations.filter(r => r.priority === 'critical').length,
        highCount: storedRecommendations.filter(r => r.priority === 'high').length
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate recommendations:', error);
      throw error;
    }
  }

  /**
   * Evaluate a specific rule against current system state
   */
  async evaluateRule(rule, timeframe) {
    try {
      const { condition_type, conditions } = rule;
      
      switch (condition_type) {
        case 'feedback_pattern':
          return await this.evaluateFeedbackPattern(conditions, timeframe);
        case 'performance_metric':
          return await this.evaluatePerformanceMetric(conditions, timeframe);
        case 'error_rate':
          return await this.evaluateErrorRate(conditions, timeframe);
        default:
          logger.warn(`Unknown condition type: ${condition_type}`);
          return { triggered: false, context: {} };
      }

    } catch (error) {
      logger.error(`Failed to evaluate rule ${rule.rule_name}:`, error);
      return { triggered: false, context: {} };
    }
  }

  /**
   * Evaluate feedback pattern conditions
   */
  async evaluateFeedbackPattern(conditions, timeframe) {
    try {
      const client = await this.pool.connect();
      
      const timeframeDays = parseInt(timeframe.split(' ')[0]);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);
      
      const query = `
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN fa.sentiment_score < -0.1 OR uf.rating <= 2 THEN 1 END) as negative_feedback,
          AVG(fa.sentiment_score) as avg_sentiment,
          AVG(uf.rating) as avg_rating,
          array_agg(DISTINCT fa.themes) as all_themes,
          array_agg(DISTINCT fa.keywords) as all_keywords
        FROM user_feedback uf
        JOIN feedback_analysis fa ON uf.id = fa.feedback_id
        WHERE fa.category = $1 
        AND uf.created_at >= $2
        ${conditions.severity_threshold ? 'AND fa.severity >= $3' : ''}
      `;
      
      const params = [conditions.category, startDate.toISOString()];
      if (conditions.severity_threshold) {
        params.push(conditions.severity_threshold);
      }
      
      const result = await client.query(query, params);
      client.release();
      
      if (result.rows.length === 0) {
        return { triggered: false, context: {} };
      }
      
      const data = result.rows[0];
      const negativeFeedback = parseInt(data.negative_feedback);
      const totalFeedback = parseInt(data.total_feedback);
      
      // Check if conditions are met
      let triggered = false;
      const context = {
        category: conditions.category,
        totalFeedback,
        negativeFeedback,
        avgSentiment: parseFloat(data.avg_sentiment),
        avgRating: parseFloat(data.avg_rating),
        timeframe,
        themes: data.all_themes ? data.all_themes.flat().filter(Boolean) : [],
        keywords: data.all_keywords ? data.all_keywords.flat().filter(Boolean) : []
      };
      
      // Check negative threshold
      if (conditions.negative_threshold && negativeFeedback >= conditions.negative_threshold) {
        triggered = true;
      }
      
      // Check rating threshold
      if (conditions.rating_threshold && parseFloat(data.avg_rating) <= conditions.rating_threshold) {
        triggered = true;
      }
      
      // Check theme patterns
      if (conditions.themes && conditions.themes.length > 0) {
        const hasMatchingThemes = conditions.themes.some(theme => 
          context.themes.includes(theme)
        );
        if (hasMatchingThemes) {
          triggered = true;
        }
      }
      
      // Check keyword patterns
      if (conditions.keywords && conditions.keywords.length > 0) {
        const hasMatchingKeywords = conditions.keywords.some(keyword => 
          context.keywords.includes(keyword)
        );
        if (hasMatchingKeywords) {
          triggered = true;
        }
      }
      
      return { triggered, context };

    } catch (error) {
      logger.error('Failed to evaluate feedback pattern:', error);
      return { triggered: false, context: {} };
    }
  }

  /**
   * Evaluate performance metric conditions
   */
  async evaluatePerformanceMetric(conditions, timeframe) {
    try {
      // This would integrate with your performance monitoring system
      // For now, we'll simulate with basic database queries
      
      const client = await this.pool.connect();
      
      const timeframeMinutes = conditions.time_window_minutes || 60;
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - timeframeMinutes);
      
      let query, params;
      
      switch (conditions.metric) {
        case 'average_response_time':
          query = `
            SELECT AVG(response_time_ms) as avg_response_time,
                   COUNT(*) as total_requests,
                   COUNT(CASE WHEN response_time_ms > $2 THEN 1 END) as slow_requests
            FROM audit_logs 
            WHERE created_at >= $1 AND response_time_ms IS NOT NULL
          `;
          params = [startTime.toISOString(), conditions.threshold];
          break;
          
        case 'error_rate':
          query = `
            SELECT 
              COUNT(*) as total_requests,
              COUNT(CASE WHEN metadata->>'error' IS NOT NULL THEN 1 END) as error_requests
            FROM audit_logs 
            WHERE created_at >= $1
          `;
          params = [startTime.toISOString()];
          break;
          
        default:
          return { triggered: false, context: {} };
      }
      
      const result = await client.query(query, params);
      client.release();
      
      if (result.rows.length === 0) {
        return { triggered: false, context: {} };
      }
      
      const data = result.rows[0];
      let triggered = false;
      const context = {
        metric: conditions.metric,
        timeframe: `${timeframeMinutes} minutes`,
        threshold: conditions.threshold
      };
      
      if (conditions.metric === 'average_response_time') {
        const avgResponseTime = parseFloat(data.avg_response_time);
        context.currentValue = avgResponseTime;
        context.totalRequests = parseInt(data.total_requests);
        context.slowRequests = parseInt(data.slow_requests);
        
        if (avgResponseTime > conditions.threshold) {
          triggered = true;
        }
      } else if (conditions.metric === 'error_rate') {
        const totalRequests = parseInt(data.total_requests);
        const errorRequests = parseInt(data.error_requests);
        const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;
        
        context.currentValue = errorRate;
        context.totalRequests = totalRequests;
        context.errorRequests = errorRequests;
        
        if (errorRate > conditions.threshold) {
          triggered = true;
        }
      }
      
      return { triggered, context };

    } catch (error) {
      logger.error('Failed to evaluate performance metric:', error);
      return { triggered: false, context: {} };
    }
  }

  /**
   * Evaluate error rate conditions
   */
  async evaluateErrorRate(conditions, timeframe) {
    try {
      const client = await this.pool.connect();
      
      const timeframeHours = conditions.time_window_hours || 2;
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - timeframeHours);
      
      const query = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN metadata->>'error' IS NOT NULL THEN 1 END) as total_errors,
          COUNT(CASE WHEN metadata->>'error_type' = ANY($2) THEN 1 END) as matching_errors
        FROM audit_logs 
        WHERE created_at >= $1
      `;
      
      const params = [startTime.toISOString(), conditions.error_types || []];
      const result = await client.query(query, params);
      client.release();
      
      if (result.rows.length === 0) {
        return { triggered: false, context: {} };
      }
      
      const data = result.rows[0];
      const totalRequests = parseInt(data.total_requests);
      const totalErrors = parseInt(data.total_errors);
      const matchingErrors = parseInt(data.matching_errors);
      
      const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
      const matchingErrorRate = totalRequests > 0 ? matchingErrors / totalRequests : 0;
      
      const context = {
        timeframe: `${timeframeHours} hours`,
        totalRequests,
        totalErrors,
        matchingErrors,
        errorRate,
        matchingErrorRate,
        threshold: conditions.error_threshold,
        errorTypes: conditions.error_types
      };
      
      const triggered = errorRate > conditions.error_threshold || 
                       matchingErrorRate > (conditions.error_threshold * 0.5);
      
      return { triggered, context };

    } catch (error) {
      logger.error('Failed to evaluate error rate:', error);
      return { triggered: false, context: {} };
    }
  }

  /**
   * Create recommendation from triggered rule
   */
  async createRecommendationFromRule(rule, context) {
    try {
      const template = this.findMatchingTemplate(rule.recommendation_template.type);
      
      if (!template) {
        logger.warn(`No template found for type: ${rule.recommendation_template.type}`);
        return null;
      }
      
      // Generate recommendation using template
      const recommendation = {
        title: this.interpolateTemplate(template.title_template, context),
        description: this.interpolateTemplate(template.description_template, context),
        category: rule.recommendation_template.type,
        priority: rule.priority,
        impactCategory: rule.impact_category,
        effortEstimate: rule.effort_estimate,
        actionItems: template.action_items,
        successCriteria: template.success_criteria,
        requiredSkills: template.required_skills,
        dependencies: template.dependencies,
        riskLevel: template.risk_level,
        sourceRule: rule.rule_name,
        context,
        createdBy: 'recommendation_engine',
        confidenceScore: this.calculateConfidenceScore(rule, context),
        impactScore: this.calculateImpactScore(rule, context),
        urgencyScore: this.calculateUrgencyScore(rule, context)
      };
      
      return recommendation;

    } catch (error) {
      logger.error('Failed to create recommendation from rule:', error);
      return null;
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  async generateAIRecommendations(timeframe) {
    try {
      // Get recent system data for AI analysis
      const systemData = await this.getSystemAnalysisData(timeframe);
      
      if (!systemData || Object.keys(systemData).length === 0) {
        return [];
      }
      
      const prompt = `
        Analyze the following fund management chatbot system data and generate improvement recommendations:
        
        System Performance Data:
        ${JSON.stringify(systemData, null, 2)}
        
        Please generate 2-3 specific, actionable improvement recommendations based on this data.
        
        For each recommendation, provide:
        {
          "title": "Clear, specific title",
          "description": "Detailed description of the issue and proposed solution",
          "category": "content_update|system_optimization|ui_improvement|technical_fix|feature_request",
          "priority": "critical|high|medium|low",
          "impactCategory": "user_satisfaction|system_performance|content_quality|operational_efficiency",
          "effortEstimate": estimated_hours_as_number,
          "actionItems": ["specific", "actionable", "steps"],
          "successCriteria": ["measurable", "success", "metrics"],
          "confidenceScore": 0.0-1.0,
          "reasoning": "explanation of why this recommendation is important"
        }
        
        Respond with a JSON array of recommendations.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      const aiRecommendations = JSON.parse(response.choices[0].message.content);
      
      // Enhance AI recommendations with additional metadata
      const enhancedRecommendations = aiRecommendations.map(rec => ({
        ...rec,
        sourceRule: 'ai_generated',
        createdBy: 'openai_gpt4',
        riskLevel: 'medium',
        impactScore: rec.confidenceScore * this.priorityToScore(rec.priority),
        urgencyScore: this.priorityToScore(rec.priority) * 0.8,
        requiredSkills: this.inferRequiredSkills(rec.category),
        dependencies: this.inferDependencies(rec.category)
      }));
      
      logger.info('AI recommendations generated', { count: enhancedRecommendations.length });
      
      return enhancedRecommendations;

    } catch (error) {
      logger.error('Failed to generate AI recommendations:', error);
      return [];
    }
  }

  /**
   * Get system data for AI analysis
   */
  async getSystemAnalysisData(timeframe) {
    try {
      const client = await this.pool.connect();
      
      const timeframeDays = parseInt(timeframe.split(' ')[0]);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);
      
      // Get feedback summary
      const feedbackQuery = `
        SELECT 
          fa.category,
          COUNT(*) as total_feedback,
          AVG(uf.rating) as avg_rating,
          AVG(fa.sentiment_score) as avg_sentiment,
          COUNT(CASE WHEN fa.severity IN ('high', 'critical') THEN 1 END) as high_severity_count
        FROM user_feedback uf
        JOIN feedback_analysis fa ON uf.id = fa.feedback_id
        WHERE uf.created_at >= $1
        GROUP BY fa.category
      `;
      
      const feedbackResult = await client.query(feedbackQuery, [startDate.toISOString()]);
      
      // Get performance metrics
      const performanceQuery = `
        SELECT 
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) as total_interactions,
          COUNT(CASE WHEN metadata->>'error' IS NOT NULL THEN 1 END) as error_count
        FROM audit_logs
        WHERE created_at >= $1
      `;
      
      const performanceResult = await client.query(performanceQuery, [startDate.toISOString()]);
      
      // Get recent recommendations
      const recommendationsQuery = `
        SELECT category, priority, status, COUNT(*) as count
        FROM improvement_recommendations
        WHERE created_at >= $1
        GROUP BY category, priority, status
      `;
      
      const recommendationsResult = await client.query(recommendationsQuery, [startDate.toISOString()]);
      
      client.release();
      
      const systemData = {
        timeframe,
        feedbackSummary: feedbackResult.rows,
        performance: performanceResult.rows[0] || {},
        recentRecommendations: recommendationsResult.rows,
        analysisDate: new Date().toISOString()
      };
      
      return systemData;

    } catch (error) {
      logger.error('Failed to get system analysis data:', error);
      return {};
    }
  }

  /**
   * Helper methods for recommendation processing
   */

  findMatchingTemplate(type) {
    return this.templates.find(template => 
      template.category === type || template.template_name.includes(type)
    );
  }

  interpolateTemplate(template, context) {
    let result = template;
    
    // Replace common placeholders
    const replacements = {
      '{category}': context.category || 'system',
      '{issue_count}': context.negativeFeedback || context.totalErrors || 'multiple',
      '{timeframe}': context.timeframe || '7 days',
      '{metric_name}': context.metric || 'performance',
      '{component}': this.inferComponent(context),
      '{area}': context.category || 'general',
      '{feedback_count}': context.totalFeedback || 'several',
      '{issue_type}': context.errorTypes ? context.errorTypes.join(', ') : 'system',
      '{error_rate}': context.errorRate ? (context.errorRate * 100).toFixed(1) : '5',
      '{topic_area}': context.category || 'general',
      '{source}': 'feedback analysis',
      '{system_name}': 'external',
      '{benefit_area}': context.impactCategory || 'operational'
    };
    
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    return result;
  }

  inferComponent(context) {
    if (context.category === 'accuracy') return 'Knowledge Base';
    if (context.category === 'speed') return 'Response System';
    if (context.category === 'citations') return 'Citation Engine';
    if (context.category === 'user_experience') return 'User Interface';
    return 'System';
  }

  calculateConfidenceScore(rule, context) {
    let confidence = 0.7; // Base confidence
    
    // Increase confidence based on data quality
    if (context.totalFeedback > 10) confidence += 0.1;
    if (context.totalRequests > 100) confidence += 0.1;
    
    // Increase confidence based on severity
    if (context.negativeFeedback > 5) confidence += 0.1;
    if (context.errorRate > 0.1) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  calculateImpactScore(rule, context) {
    const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    const baseScore = priorityScores[rule.priority] || 2;
    
    // Adjust based on context
    let multiplier = 1.0;
    if (context.negativeFeedback > 10) multiplier += 0.3;
    if (context.errorRate > 0.05) multiplier += 0.4;
    if (context.avgSentiment < -0.5) multiplier += 0.2;
    
    return baseScore * multiplier;
  }

  calculateUrgencyScore(rule, context) {
    let urgency = this.priorityToScore(rule.priority);
    
    // Increase urgency based on trends
    if (context.errorRate > 0.1) urgency += 1;
    if (context.avgSentiment < -0.3) urgency += 0.5;
    
    return Math.min(urgency, 4.0);
  }

  priorityToScore(priority) {
    const scores = { critical: 4, high: 3, medium: 2, low: 1 };
    return scores[priority] || 2;
  }

  inferRequiredSkills(category) {
    const skillMap = {
      'content_update': ['content_management', 'domain_expertise'],
      'system_optimization': ['system_administration', 'performance_tuning'],
      'ui_improvement': ['ui_design', 'frontend_development'],
      'technical_fix': ['debugging', 'system_administration'],
      'feature_request': ['full_stack_development', 'system_design'],
      'performance_tuning': ['performance_optimization', 'database_tuning']
    };
    
    return skillMap[category] || ['general_development'];
  }

  inferDependencies(category) {
    const dependencyMap = {
      'content_update': ['content_management_system', 'subject_matter_experts'],
      'system_optimization': ['system_access', 'monitoring_tools'],
      'ui_improvement': ['design_tools', 'user_testing'],
      'technical_fix': ['system_logs', 'debugging_tools'],
      'feature_request': ['development_environment', 'testing_resources'],
      'performance_tuning': ['performance_monitoring', 'database_access']
    };
    
    return dependencyMap[category] || ['development_resources'];
  }

  async deduplicateRecommendations(recommendations, includeExecuted) {
    try {
      if (!includeExecuted) {
        // Get existing recommendations to avoid duplicates
        const client = await this.pool.connect();
        const existingQuery = `
          SELECT title, category, status 
          FROM improvement_recommendations 
          WHERE status IN ('pending', 'in_progress', 'under_review')
        `;
        const existingResult = await client.query(existingQuery);
        client.release();
        
        const existingTitles = new Set(existingResult.rows.map(row => row.title.toLowerCase()));
        
        recommendations = recommendations.filter(rec => 
          !existingTitles.has(rec.title.toLowerCase())
        );
      }
      
      // Remove duplicates within current batch
      const seen = new Set();
      const unique = [];
      
      for (const rec of recommendations) {
        const key = `${rec.category}-${rec.title.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(rec);
        }
      }
      
      return unique;

    } catch (error) {
      logger.error('Failed to deduplicate recommendations:', error);
      return recommendations;
    }
  }

  prioritizeRecommendations(recommendations) {
    return recommendations.sort((a, b) => {
      // Primary sort by priority
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by impact score
      const impactDiff = (b.impactScore || 0) - (a.impactScore || 0);
      if (impactDiff !== 0) return impactDiff;
      
      // Tertiary sort by confidence score
      return (b.confidenceScore || 0) - (a.confidenceScore || 0);
    });
  }

  async storeRecommendation(recommendation) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO improvement_recommendations (
          title, description, category, priority, impact_score,
          effort_estimate, affected_components, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      
      const values = [
        recommendation.title,
        recommendation.description,
        recommendation.category,
        recommendation.priority,
        recommendation.impactScore,
        recommendation.effortEstimate,
        recommendation.actionItems || [],
        'pending'
      ];
      
      const result = await client.query(query, values);
      client.release();
      
      return result.rows[0].id;

    } catch (error) {
      logger.error('Failed to store recommendation:', error);
      throw error;
    }
  }

  generateRecommendationSummary(recommendations) {
    const summary = {
      total: recommendations.length,
      byPriority: {},
      byCategory: {},
      totalEffort: 0,
      avgConfidence: 0,
      avgImpact: 0
    };
    
    recommendations.forEach(rec => {
      // Count by priority
      summary.byPriority[rec.priority] = (summary.byPriority[rec.priority] || 0) + 1;
      
      // Count by category
      summary.byCategory[rec.category] = (summary.byCategory[rec.category] || 0) + 1;
      
      // Sum totals
      summary.totalEffort += rec.effortEstimate || 0;
      summary.avgConfidence += rec.confidenceScore || 0;
      summary.avgImpact += rec.impactScore || 0;
    });
    
    // Calculate averages
    if (recommendations.length > 0) {
      summary.avgConfidence = summary.avgConfidence / recommendations.length;
      summary.avgImpact = summary.avgImpact / recommendations.length;
    }
    
    return summary;
  }

  /**
   * Execute a recommendation
   */
  async executeRecommendation(recommendationId, executionType = 'manual', executedBy = 'system') {
    try {
      const client = await this.pool.connect();
      
      // Get recommendation details
      const recQuery = 'SELECT * FROM improvement_recommendations WHERE id = $1';
      const recResult = await client.query(recQuery, [recommendationId]);
      
      if (recResult.rows.length === 0) {
        throw new Error('Recommendation not found');
      }
      
      const recommendation = recResult.rows[0];
      
      // Record execution start
      const executionQuery = `
        INSERT INTO recommendation_executions (
          recommendation_id, execution_type, executed_by, execution_status,
          start_time, before_metrics
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
        RETURNING id
      `;
      
      const beforeMetrics = await this.captureMetrics(recommendation);
      const executionValues = [
        recommendationId,
        executionType,
        executedBy,
        'started',
        JSON.stringify(beforeMetrics)
      ];
      
      const executionResult = await client.query(executionQuery, executionValues);
      const executionId = executionResult.rows[0].id;
      
      // Update recommendation status
      await client.query(
        'UPDATE improvement_recommendations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['in_progress', recommendationId]
      );
      
      client.release();
      
      logger.info('Recommendation execution started', {
        recommendationId,
        executionId,
        executedBy
      });
      
      return {
        executionId,
        status: 'started',
        recommendation,
        beforeMetrics
      };

    } catch (error) {
      logger.error('Failed to execute recommendation:', error);
      throw error;
    }
  }

  /**
   * Complete recommendation execution
   */
  async completeRecommendationExecution(executionId, status = 'completed', notes = '', lessonsLearned = '') {
    try {
      const client = await this.pool.connect();
      
      // Get execution details
      const execQuery = 'SELECT * FROM recommendation_executions WHERE id = $1';
      const execResult = await client.query(execQuery, [executionId]);
      
      if (execResult.rows.length === 0) {
        throw new Error('Execution not found');
      }
      
      const execution = execResult.rows[0];
      
      // Capture after metrics
      const recQuery = 'SELECT * FROM improvement_recommendations WHERE id = $1';
      const recResult = await client.query(recQuery, [execution.recommendation_id]);
      const recommendation = recResult.rows[0];
      
      const afterMetrics = await this.captureMetrics(recommendation);
      const successScore = this.calculateSuccessScore(
        JSON.parse(execution.before_metrics),
        afterMetrics,
        recommendation
      );
      
      // Update execution record
      await client.query(`
        UPDATE recommendation_executions 
        SET execution_status = $1, end_time = CURRENT_TIMESTAMP,
            execution_notes = $2, after_metrics = $3, success_score = $4,
            lessons_learned = $5
        WHERE id = $6
      `, [status, notes, JSON.stringify(afterMetrics), successScore, lessonsLearned, executionId]);
      
      // Update recommendation status
      const newStatus = status === 'completed' ? 'completed' : 
                       status === 'failed' ? 'pending' : 'in_progress';
      
      await client.query(
        'UPDATE improvement_recommendations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, execution.recommendation_id]
      );
      
      // Record impact measurements
      if (status === 'completed') {
        await this.recordImpactMeasurements(execution.recommendation_id, afterMetrics);
      }
      
      client.release();
      
      logger.info('Recommendation execution completed', {
        executionId,
        status,
        successScore
      });
      
      return {
        executionId,
        status,
        successScore,
        afterMetrics
      };

    } catch (error) {
      logger.error('Failed to complete recommendation execution:', error);
      throw error;
    }
  }

  /**
   * Capture current system metrics
   */
  async captureMetrics(recommendation) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        category: recommendation.category
      };
      
      const client = await this.pool.connect();
      
      // Capture category-specific metrics
      switch (recommendation.category) {
        case 'content_update':
        case 'system_optimization':
          // Get recent feedback metrics
          const feedbackQuery = `
            SELECT 
              AVG(uf.rating) as avg_rating,
              AVG(fa.sentiment_score) as avg_sentiment,
              COUNT(*) as total_feedback
            FROM user_feedback uf
            JOIN feedback_analysis fa ON uf.id = fa.feedback_id
            WHERE uf.created_at >= NOW() - INTERVAL '7 days'
            AND fa.category = $1
          `;
          
          const feedbackResult = await client.query(feedbackQuery, [recommendation.category]);
          if (feedbackResult.rows.length > 0) {
            metrics.avgRating = parseFloat(feedbackResult.rows[0].avg_rating) || 0;
            metrics.avgSentiment = parseFloat(feedbackResult.rows[0].avg_sentiment) || 0;
            metrics.totalFeedback = parseInt(feedbackResult.rows[0].total_feedback) || 0;
          }
          break;
          
        case 'performance_tuning':
        case 'technical_fix':
          // Get performance metrics
          const perfQuery = `
            SELECT 
              AVG(response_time_ms) as avg_response_time,
              COUNT(*) as total_requests,
              COUNT(CASE WHEN metadata->>'error' IS NOT NULL THEN 1 END) as error_count
            FROM audit_logs
            WHERE created_at >= NOW() - INTERVAL '1 hour'
          `;
          
          const perfResult = await client.query(perfQuery);
          if (perfResult.rows.length > 0) {
            metrics.avgResponseTime = parseFloat(perfResult.rows[0].avg_response_time) || 0;
            metrics.totalRequests = parseInt(perfResult.rows[0].total_requests) || 0;
            metrics.errorCount = parseInt(perfResult.rows[0].error_count) || 0;
            metrics.errorRate = metrics.totalRequests > 0 ? 
              metrics.errorCount / metrics.totalRequests : 0;
          }
          break;
      }
      
      client.release();
      return metrics;

    } catch (error) {
      logger.error('Failed to capture metrics:', error);
      return { timestamp: new Date().toISOString(), error: error.message };
    }
  }

  /**
   * Calculate success score based on before/after metrics
   */
  calculateSuccessScore(beforeMetrics, afterMetrics, recommendation) {
    try {
      let successScore = 0.5; // Default neutral score
      
      // Compare relevant metrics based on recommendation category
      if (beforeMetrics.avgRating && afterMetrics.avgRating) {
        const ratingImprovement = afterMetrics.avgRating - beforeMetrics.avgRating;
        successScore += ratingImprovement * 0.3; // Weight rating improvement
      }
      
      if (beforeMetrics.avgSentiment && afterMetrics.avgSentiment) {
        const sentimentImprovement = afterMetrics.avgSentiment - beforeMetrics.avgSentiment;
        successScore += sentimentImprovement * 0.2; // Weight sentiment improvement
      }
      
      if (beforeMetrics.errorRate && afterMetrics.errorRate) {
        const errorReduction = beforeMetrics.errorRate - afterMetrics.errorRate;
        successScore += errorReduction * 0.4; // Weight error reduction highly
      }
      
      if (beforeMetrics.avgResponseTime && afterMetrics.avgResponseTime) {
        const responseTimeImprovement = (beforeMetrics.avgResponseTime - afterMetrics.avgResponseTime) / beforeMetrics.avgResponseTime;
        successScore += responseTimeImprovement * 0.3; // Weight response time improvement
      }
      
      // Clamp score between 0 and 1
      return Math.max(0, Math.min(1, successScore));

    } catch (error) {
      logger.error('Failed to calculate success score:', error);
      return 0.5;
    }
  }

  /**
   * Record impact measurements
   */
  async recordImpactMeasurements(recommendationId, afterMetrics) {
    try {
      const client = await this.pool.connect();
      
      // Record various impact measurements
      const impacts = [];
      
      if (afterMetrics.avgRating) {
        impacts.push({
          category: 'user_satisfaction',
          metric: 'average_rating',
          value: afterMetrics.avgRating
        });
      }
      
      if (afterMetrics.avgSentiment) {
        impacts.push({
          category: 'user_satisfaction',
          metric: 'average_sentiment',
          value: afterMetrics.avgSentiment
        });
      }
      
      if (afterMetrics.errorRate !== undefined) {
        impacts.push({
          category: 'system_performance',
          metric: 'error_rate',
          value: afterMetrics.errorRate
        });
      }
      
      if (afterMetrics.avgResponseTime) {
        impacts.push({
          category: 'system_performance',
          metric: 'response_time',
          value: afterMetrics.avgResponseTime
        });
      }
      
      // Store impact measurements
      for (const impact of impacts) {
        await client.query(`
          INSERT INTO recommendation_impacts (
            recommendation_id, impact_category, metric_name, current_value
          ) VALUES ($1, $2, $3, $4)
        `, [recommendationId, impact.category, impact.metric, impact.value]);
      }
      
      client.release();
      
      logger.info('Impact measurements recorded', {
        recommendationId,
        impactCount: impacts.length
      });

    } catch (error) {
      logger.error('Failed to record impact measurements:', error);
    }
  }

  /**
   * Get recommendation execution status
   */
  async getExecutionStatus(recommendationId) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT 
          re.*,
          ir.title,
          ir.category,
          ir.priority
        FROM recommendation_executions re
        JOIN improvement_recommendations ir ON re.recommendation_id = ir.id
        WHERE re.recommendation_id = $1
        ORDER BY re.start_time DESC
      `;
      
      const result = await client.query(query, [recommendationId]);
      client.release();
      
      return result.rows;

    } catch (error) {
      logger.error('Failed to get execution status:', error);
      throw error;
    }
  }

  /**
   * Get recommendation impact analysis
   */
  async getImpactAnalysis(recommendationId) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT 
          impact_category,
          metric_name,
          baseline_value,
          target_value,
          current_value,
          improvement_percentage,
          measurement_date
        FROM recommendation_impacts
        WHERE recommendation_id = $1
        ORDER BY measurement_date DESC
      `;
      
      const result = await client.query(query, [recommendationId]);
      client.release();
      
      return result.rows;

    } catch (error) {
      logger.error('Failed to get impact analysis:', error);
      throw error;
    }
  }

  /**
   * Close and cleanup
   */
  async close() {
    await this.pool.end();
    this.initialized = false;
    logger.info('ImprovementRecommendationEngine closed');
  }
}

module.exports = ImprovementRecommendationEngine;
