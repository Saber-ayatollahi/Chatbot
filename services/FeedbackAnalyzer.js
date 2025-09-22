/**
 * Feedback Analysis System
 * Automated feedback clustering, trend analysis, and improvement recommendations
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const natural = require('natural');
const OpenAI = require('openai');

class FeedbackAnalyzer {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
    this.openai = new OpenAI({
      apiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY
    });
    
    // Initialize NLP tools
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
    this.sentiment = new natural.SentimentAnalyzer('English', 
      natural.PorterStemmer, ['negation']);
    
    // Feedback categories
    this.categories = {
      ACCURACY: 'accuracy',
      RELEVANCE: 'relevance',
      COMPLETENESS: 'completeness',
      CLARITY: 'clarity',
      SPEED: 'speed',
      CITATIONS: 'citations',
      USER_EXPERIENCE: 'user_experience',
      TECHNICAL: 'technical',
      OTHER: 'other'
    };
    
    // Issue severity levels
    this.severityLevels = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low'
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the feedback analyzer
   */
  async initialize() {
    try {
      await this.ensureTablesExist();
      await this.loadTrainingData();
      
      this.initialized = true;
      logger.info('FeedbackAnalyzer initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize FeedbackAnalyzer:', error);
      throw error;
    }
  }

  /**
   * Ensure required database tables exist
   */
  async ensureTablesExist() {
    const client = await this.pool.connect();
    
    try {
      // Create feedback analysis tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          feedback_id UUID REFERENCES user_feedback(id),
          category VARCHAR(50) NOT NULL,
          subcategory VARCHAR(100),
          sentiment_score FLOAT,
          severity VARCHAR(20),
          keywords TEXT[],
          themes TEXT[],
          suggested_actions TEXT[],
          confidence_score FLOAT,
          analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          analyzer_version VARCHAR(20) DEFAULT '1.0'
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_category ON feedback_analysis (category);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_severity ON feedback_analysis (severity);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed_at ON feedback_analysis (analyzed_at DESC);
      `);

      // Create improvement recommendations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS improvement_recommendations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          category VARCHAR(50) NOT NULL,
          priority VARCHAR(20) NOT NULL,
          impact_score FLOAT,
          effort_estimate INTEGER, -- hours
          affected_components TEXT[],
          related_feedback_ids UUID[],
          status VARCHAR(30) DEFAULT 'pending',
          assigned_to VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP WITH TIME ZONE,
          implementation_notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_improvement_recommendations_priority ON improvement_recommendations (priority);
        CREATE INDEX IF NOT EXISTS idx_improvement_recommendations_status ON improvement_recommendations (status);
        CREATE INDEX IF NOT EXISTS idx_improvement_recommendations_category ON improvement_recommendations (category);
      `);

      // Create feedback trends table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_trends (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          period_start TIMESTAMP WITH TIME ZONE NOT NULL,
          period_end TIMESTAMP WITH TIME ZONE NOT NULL,
          category VARCHAR(50) NOT NULL,
          total_feedback INTEGER NOT NULL,
          positive_count INTEGER NOT NULL,
          negative_count INTEGER NOT NULL,
          neutral_count INTEGER NOT NULL,
          average_sentiment FLOAT,
          top_issues JSONB,
          improvement_areas JSONB,
          trend_direction VARCHAR(20), -- improving, declining, stable
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_trends_period ON feedback_trends (period_start, period_end);
        CREATE INDEX IF NOT EXISTS idx_feedback_trends_category ON feedback_trends (category);
      `);

      // Create knowledge base updates table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base_updates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          update_type VARCHAR(50) NOT NULL, -- content_update, new_document, correction
          source_document VARCHAR(255),
          section_affected VARCHAR(255),
          old_content TEXT,
          new_content TEXT,
          reason TEXT NOT NULL,
          related_feedback_ids UUID[],
          priority VARCHAR(20) NOT NULL,
          status VARCHAR(30) DEFAULT 'pending',
          reviewed_by VARCHAR(100),
          approved_by VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          implemented_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_knowledge_base_updates_status ON knowledge_base_updates (status);
        CREATE INDEX IF NOT EXISTS idx_knowledge_base_updates_priority ON knowledge_base_updates (priority);
      `);

      logger.info('Feedback analysis database tables ensured');

    } finally {
      client.release();
    }
  }

  /**
   * Load training data for classification
   */
  async loadTrainingData() {
    // Load pre-defined patterns and keywords for feedback classification
    this.classificationPatterns = {
      [this.categories.ACCURACY]: {
        keywords: ['wrong', 'incorrect', 'inaccurate', 'false', 'mistake', 'error', 'outdated'],
        phrases: ['not accurate', 'information is wrong', 'this is incorrect', 'outdated information']
      },
      [this.categories.RELEVANCE]: {
        keywords: ['irrelevant', 'unrelated', 'off-topic', 'not relevant', 'doesn\'t match'],
        phrases: ['not what I asked', 'doesn\'t answer my question', 'off topic']
      },
      [this.categories.COMPLETENESS]: {
        keywords: ['incomplete', 'missing', 'partial', 'more detail', 'explain more'],
        phrases: ['need more information', 'not complete', 'missing details']
      },
      [this.categories.CLARITY]: {
        keywords: ['confusing', 'unclear', 'complex', 'hard to understand', 'vague'],
        phrases: ['difficult to understand', 'not clear', 'too complex']
      },
      [this.categories.SPEED]: {
        keywords: ['slow', 'fast', 'quick', 'response time', 'performance'],
        phrases: ['takes too long', 'very slow', 'fast response']
      },
      [this.categories.CITATIONS]: {
        keywords: ['source', 'reference', 'citation', 'where from', 'document'],
        phrases: ['need source', 'where did this come from', 'missing references']
      },
      [this.categories.USER_EXPERIENCE]: {
        keywords: ['interface', 'design', 'usability', 'navigation', 'layout'],
        phrases: ['hard to use', 'user-friendly', 'good interface']
      },
      [this.categories.TECHNICAL]: {
        keywords: ['bug', 'error', 'crash', 'broken', 'not working'],
        phrases: ['technical issue', 'system error', 'doesn\'t work']
      }
    };

    logger.info('Feedback classification patterns loaded');
  }

  /**
   * Analyze feedback trends over a specified period
   */
  async analyzeFeedbackTrends(startDate, endDate, options = {}) {
    try {
      const { 
        includeCategories = Object.values(this.categories),
        groupBy = 'week', // day, week, month
        includeSubcategories = false 
      } = options;

      logger.info(`Analyzing feedback trends from ${startDate} to ${endDate}`);

      const client = await this.pool.connect();
      
      // Get all feedback in the specified period
      const feedbackQuery = `
        SELECT 
          f.*,
          fa.category,
          fa.subcategory,
          fa.sentiment_score,
          fa.severity,
          fa.keywords,
          fa.themes
        FROM user_feedback f
        LEFT JOIN feedback_analysis fa ON f.id = fa.feedback_id
        WHERE f.created_at >= $1 AND f.created_at <= $2
        ORDER BY f.created_at DESC
      `;
      
      const feedbackResult = await client.query(feedbackQuery, [startDate, endDate]);
      const feedbackData = feedbackResult.rows;
      
      client.release();

      // Group feedback by time periods
      const groupedFeedback = this.groupFeedbackByPeriod(feedbackData, groupBy);
      
      // Analyze trends for each period and category
      const trends = {};
      
      for (const [period, periodFeedback] of Object.entries(groupedFeedback)) {
        trends[period] = {};
        
        for (const category of includeCategories) {
          const categoryFeedback = periodFeedback.filter(f => f.category === category);
          
          if (categoryFeedback.length === 0) {
            trends[period][category] = {
              totalFeedback: 0,
              sentimentAnalysis: { positive: 0, negative: 0, neutral: 0 },
              averageSentiment: 0,
              topIssues: [],
              improvementAreas: []
            };
            continue;
          }

          // Calculate sentiment distribution
          const sentimentAnalysis = this.calculateSentimentDistribution(categoryFeedback);
          
          // Identify top issues
          const topIssues = this.identifyTopIssues(categoryFeedback);
          
          // Identify improvement areas
          const improvementAreas = this.identifyImprovementAreas(categoryFeedback);
          
          trends[period][category] = {
            totalFeedback: categoryFeedback.length,
            sentimentAnalysis,
            averageSentiment: sentimentAnalysis.averageScore,
            topIssues,
            improvementAreas,
            severityDistribution: this.calculateSeverityDistribution(categoryFeedback),
            commonKeywords: this.extractCommonKeywords(categoryFeedback),
            themes: this.extractCommonThemes(categoryFeedback)
          };
        }
      }

      // Calculate trend directions (improving, declining, stable)
      const trendDirections = this.calculateTrendDirections(trends);
      
      const analysis = {
        period: { start: startDate, end: endDate },
        groupBy,
        trends,
        trendDirections,
        summary: this.generateTrendSummary(trends, trendDirections),
        recommendations: await this.generateTrendRecommendations(trends, trendDirections)
      };

      // Store trend analysis
      await this.storeTrendAnalysis(analysis);
      
      logger.info('Feedback trend analysis completed', {
        periods: Object.keys(trends).length,
        categories: includeCategories.length
      });

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze feedback trends:', error);
      throw error;
    }
  }

  /**
   * Analyze individual feedback and categorize it
   */
  async analyzeFeedback(feedbackId, feedbackText, rating, metadata = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Analyzing feedback: ${feedbackId}`);

      // Classify feedback category
      const classification = await this.classifyFeedback(feedbackText, rating, metadata);
      
      // Perform sentiment analysis
      const sentimentAnalysis = await this.performSentimentAnalysis(feedbackText);
      
      // Extract keywords and themes
      const keywords = this.extractKeywords(feedbackText);
      const themes = await this.extractThemes(feedbackText, classification.category);
      
      // Determine severity
      const severity = this.determineSeverity(rating, sentimentAnalysis, classification);
      
      // Generate suggested actions
      const suggestedActions = await this.generateSuggestedActions(
        classification, sentimentAnalysis, keywords, themes, severity
      );
      
      const analysis = {
        feedbackId,
        category: classification.category,
        subcategory: classification.subcategory,
        sentimentScore: sentimentAnalysis.score,
        severity,
        keywords,
        themes,
        suggestedActions,
        confidenceScore: classification.confidence,
        metadata: {
          ...metadata,
          analysisTimestamp: new Date().toISOString(),
          analyzerVersion: '1.0'
        }
      };

      // Store analysis results
      await this.storeFeedbackAnalysis(analysis);
      
      logger.info('Feedback analysis completed', {
        feedbackId,
        category: classification.category,
        severity,
        confidenceScore: classification.confidence
      });

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze feedback:', error);
      throw error;
    }
  }

  /**
   * Classify feedback into categories
   */
  async classifyFeedback(feedbackText, rating, metadata = {}) {
    try {
      const text = feedbackText.toLowerCase();
      const tokens = this.tokenizer.tokenize(text);
      const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
      
      const scores = {};
      let maxScore = 0;
      let bestCategory = this.categories.OTHER;
      let subcategory = null;

      // Score against each category
      for (const [category, patterns] of Object.entries(this.classificationPatterns)) {
        let score = 0;
        
        // Check keywords
        for (const keyword of patterns.keywords) {
          if (text.includes(keyword.toLowerCase())) {
            score += 2;
          }
        }
        
        // Check phrases
        for (const phrase of patterns.phrases) {
          if (text.includes(phrase.toLowerCase())) {
            score += 3;
          }
        }
        
        // Consider rating
        if (rating <= 2 && category === this.categories.ACCURACY) {
          score += 1;
        }
        if (rating <= 2 && category === this.categories.RELEVANCE) {
          score += 1;
        }
        if (rating >= 4 && category === this.categories.USER_EXPERIENCE) {
          score += 1;
        }
        
        scores[category] = score;
        
        if (score > maxScore) {
          maxScore = score;
          bestCategory = category;
        }
      }

      // Use OpenAI for more sophisticated classification if confidence is low
      let confidence = maxScore / Math.max(1, tokens.length * 0.5);
      
      if (confidence < 0.6) {
        const aiClassification = await this.classifyWithAI(feedbackText, rating);
        if (aiClassification.confidence > confidence) {
          bestCategory = aiClassification.category;
          subcategory = aiClassification.subcategory;
          confidence = aiClassification.confidence;
        }
      }

      // Determine subcategory based on specific patterns
      if (!subcategory) {
        subcategory = this.determineSubcategory(bestCategory, feedbackText, rating);
      }

      return {
        category: bestCategory,
        subcategory,
        confidence: Math.min(confidence, 1.0),
        scores,
        method: confidence >= 0.6 ? 'rule_based' : 'ai_assisted'
      };

    } catch (error) {
      logger.error('Failed to classify feedback:', error);
      return {
        category: this.categories.OTHER,
        subcategory: null,
        confidence: 0.1,
        scores: {},
        method: 'fallback'
      };
    }
  }

  /**
   * Use OpenAI for advanced feedback classification
   */
  async classifyWithAI(feedbackText, rating) {
    try {
      const prompt = `
        Analyze the following user feedback for a fund management chatbot and classify it into one of these categories:
        
        Categories:
        - accuracy: Feedback about correctness of information
        - relevance: Feedback about how well the response matches the question
        - completeness: Feedback about missing information or incomplete responses
        - clarity: Feedback about how clear and understandable the response is
        - speed: Feedback about response time or performance
        - citations: Feedback about source references and documentation
        - user_experience: Feedback about interface, design, or usability
        - technical: Feedback about bugs, errors, or technical issues
        - other: Feedback that doesn't fit other categories
        
        User Rating: ${rating}/5
        Feedback Text: "${feedbackText}"
        
        Respond with a JSON object containing:
        {
          "category": "category_name",
          "subcategory": "specific_subcategory_if_applicable",
          "confidence": 0.0-1.0,
          "reasoning": "brief explanation"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        category: result.category,
        subcategory: result.subcategory,
        confidence: result.confidence,
        reasoning: result.reasoning
      };

    } catch (error) {
      logger.error('AI classification failed:', error);
      return {
        category: this.categories.OTHER,
        subcategory: null,
        confidence: 0.1,
        reasoning: 'AI classification failed'
      };
    }
  }

  /**
   * Perform sentiment analysis on feedback text
   */
  async performSentimentAnalysis(text) {
    try {
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
      
      // Use natural library for basic sentiment analysis
      const score = this.sentiment.getSentiment(stemmedTokens);
      
      // Normalize score to -1 to 1 range
      const normalizedScore = Math.max(-1, Math.min(1, score));
      
      // Classify sentiment
      let classification;
      if (normalizedScore > 0.1) {
        classification = 'positive';
      } else if (normalizedScore < -0.1) {
        classification = 'negative';
      } else {
        classification = 'neutral';
      }

      // Use OpenAI for more nuanced sentiment analysis if needed
      let confidence = Math.abs(normalizedScore);
      if (confidence < 0.3) {
        const aiSentiment = await this.analyzeSentimentWithAI(text);
        if (aiSentiment.confidence > confidence) {
          return aiSentiment;
        }
      }

      return {
        score: normalizedScore,
        classification,
        confidence,
        method: 'natural_lib'
      };

    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return {
        score: 0,
        classification: 'neutral',
        confidence: 0.1,
        method: 'fallback'
      };
    }
  }

  /**
   * Use OpenAI for advanced sentiment analysis
   */
  async analyzeSentimentWithAI(text) {
    try {
      const prompt = `
        Analyze the sentiment of this user feedback for a fund management chatbot:
        
        "${text}"
        
        Respond with a JSON object:
        {
          "score": -1.0 to 1.0 (negative to positive),
          "classification": "positive|negative|neutral",
          "confidence": 0.0-1.0,
          "emotions": ["frustrated", "satisfied", etc.],
          "reasoning": "brief explanation"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        score: result.score,
        classification: result.classification,
        confidence: result.confidence,
        emotions: result.emotions,
        reasoning: result.reasoning,
        method: 'openai'
      };

    } catch (error) {
      logger.error('AI sentiment analysis failed:', error);
      return {
        score: 0,
        classification: 'neutral',
        confidence: 0.1,
        method: 'fallback'
      };
    }
  }

  /**
   * Extract keywords from feedback text
   */
  extractKeywords(text) {
    try {
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      
      // Remove stop words
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
      ]);
      
      const keywords = tokens
        .filter(token => token.length > 2)
        .filter(token => !stopWords.has(token))
        .filter(token => /^[a-zA-Z]+$/.test(token))
        .map(token => this.stemmer.stem(token));
      
      // Count frequency and return most common keywords
      const frequency = {};
      keywords.forEach(keyword => {
        frequency[keyword] = (frequency[keyword] || 0) + 1;
      });
      
      return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([keyword]) => keyword);

    } catch (error) {
      logger.error('Keyword extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract themes from feedback text
   */
  async extractThemes(text, category) {
    try {
      const themes = [];
      
      // Category-specific theme extraction
      switch (category) {
        case this.categories.ACCURACY:
          if (text.includes('outdated')) themes.push('outdated_information');
          if (text.includes('wrong') || text.includes('incorrect')) themes.push('factual_errors');
          break;
          
        case this.categories.COMPLETENESS:
          if (text.includes('missing')) themes.push('missing_information');
          if (text.includes('more detail')) themes.push('insufficient_detail');
          break;
          
        case this.categories.CLARITY:
          if (text.includes('confusing')) themes.push('confusing_language');
          if (text.includes('complex')) themes.push('too_complex');
          break;
          
        case this.categories.SPEED:
          if (text.includes('slow')) themes.push('slow_response');
          if (text.includes('fast')) themes.push('fast_response');
          break;
      }
      
      return themes;

    } catch (error) {
      logger.error('Theme extraction failed:', error);
      return [];
    }
  }

  /**
   * Determine severity level of feedback
   */
  determineSeverity(rating, sentimentAnalysis, classification) {
    try {
      let severityScore = 0;
      
      // Rating-based scoring
      if (rating <= 1) severityScore += 4;
      else if (rating <= 2) severityScore += 3;
      else if (rating <= 3) severityScore += 1;
      
      // Sentiment-based scoring
      if (sentimentAnalysis.score <= -0.7) severityScore += 3;
      else if (sentimentAnalysis.score <= -0.3) severityScore += 2;
      else if (sentimentAnalysis.score <= -0.1) severityScore += 1;
      
      // Category-based scoring
      const criticalCategories = [
        this.categories.ACCURACY,
        this.categories.TECHNICAL
      ];
      
      if (criticalCategories.includes(classification.category)) {
        severityScore += 2;
      }
      
      // Determine final severity
      if (severityScore >= 7) return this.severityLevels.CRITICAL;
      if (severityScore >= 5) return this.severityLevels.HIGH;
      if (severityScore >= 3) return this.severityLevels.MEDIUM;
      return this.severityLevels.LOW;

    } catch (error) {
      logger.error('Severity determination failed:', error);
      return this.severityLevels.MEDIUM;
    }
  }

  /**
   * Generate suggested actions based on feedback analysis
   */
  async generateSuggestedActions(classification, sentimentAnalysis, keywords, themes, severity) {
    try {
      const actions = [];
      
      // Category-specific actions
      switch (classification.category) {
        case this.categories.ACCURACY:
          actions.push('Review and update knowledge base content');
          actions.push('Verify information accuracy with subject matter experts');
          if (themes.includes('outdated_information')) {
            actions.push('Update outdated documentation');
          }
          break;
          
        case this.categories.RELEVANCE:
          actions.push('Improve query understanding and matching');
          actions.push('Review retrieval algorithm parameters');
          actions.push('Enhance context awareness in responses');
          break;
          
        case this.categories.COMPLETENESS:
          actions.push('Expand knowledge base coverage');
          actions.push('Improve response completeness checking');
          actions.push('Add more detailed explanations');
          break;
          
        case this.categories.CLARITY:
          actions.push('Simplify language and explanations');
          actions.push('Improve response structure and formatting');
          actions.push('Add examples and clarifications');
          break;
          
        case this.categories.SPEED:
          actions.push('Optimize response generation performance');
          actions.push('Review and tune retrieval algorithms');
          actions.push('Consider caching frequently requested information');
          break;
          
        case this.categories.CITATIONS:
          actions.push('Improve citation accuracy and formatting');
          actions.push('Ensure all responses include proper source references');
          actions.push('Review citation generation logic');
          break;
          
        case this.categories.USER_EXPERIENCE:
          actions.push('Review and improve user interface design');
          actions.push('Enhance user interaction flows');
          actions.push('Conduct user experience testing');
          break;
          
        case this.categories.TECHNICAL:
          actions.push('Investigate and fix technical issues');
          actions.push('Review system logs for errors');
          actions.push('Perform system health checks');
          break;
      }
      
      // Severity-based actions
      if (severity === this.severityLevels.CRITICAL) {
        actions.unshift('Immediate attention required - escalate to development team');
      } else if (severity === this.severityLevels.HIGH) {
        actions.unshift('High priority - schedule for next sprint');
      }
      
      // Sentiment-based actions
      if (sentimentAnalysis.score <= -0.5) {
        actions.push('Follow up with user to understand concerns better');
        actions.push('Consider personal outreach for severe negative feedback');
      }
      
      return actions.slice(0, 5); // Limit to top 5 actions

    } catch (error) {
      logger.error('Failed to generate suggested actions:', error);
      return ['Review feedback and determine appropriate actions'];
    }
  }

  /**
   * Store feedback analysis results
   */
  async storeFeedbackAnalysis(analysis) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO feedback_analysis (
          feedback_id, category, subcategory, sentiment_score, severity,
          keywords, themes, suggested_actions, confidence_score, analyzer_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (feedback_id) DO UPDATE SET
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          sentiment_score = EXCLUDED.sentiment_score,
          severity = EXCLUDED.severity,
          keywords = EXCLUDED.keywords,
          themes = EXCLUDED.themes,
          suggested_actions = EXCLUDED.suggested_actions,
          confidence_score = EXCLUDED.confidence_score,
          analyzed_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      
      const values = [
        analysis.feedbackId,
        analysis.category,
        analysis.subcategory,
        analysis.sentimentScore,
        analysis.severity,
        analysis.keywords,
        analysis.themes,
        analysis.suggestedActions,
        analysis.confidenceScore,
        analysis.metadata.analyzerVersion
      ];
      
      const result = await client.query(query, values);
      client.release();
      
      logger.info('Feedback analysis stored', { 
        analysisId: result.rows[0].id,
        feedbackId: analysis.feedbackId 
      });
      
      return result.rows[0].id;

    } catch (error) {
      logger.error('Failed to store feedback analysis:', error);
      throw error;
    }
  }

  /**
   * Generate improvement recommendations based on feedback patterns
   */
  async generateImprovementPlan(timeframe = '30 days') {
    try {
      logger.info(`Generating improvement plan for the last ${timeframe}`);

      const endDate = new Date();
      const startDate = new Date();
      
      // Parse timeframe
      const timeframeParts = timeframe.split(' ');
      const amount = parseInt(timeframeParts[0]);
      const unit = timeframeParts[1];
      
      switch (unit) {
        case 'days':
          startDate.setDate(startDate.getDate() - amount);
          break;
        case 'weeks':
          startDate.setDate(startDate.getDate() - (amount * 7));
          break;
        case 'months':
          startDate.setMonth(startDate.getMonth() - amount);
          break;
      }

      // Analyze feedback trends
      const trends = await this.analyzeFeedbackTrends(
        startDate.toISOString(),
        endDate.toISOString(),
        { groupBy: 'week' }
      );

      // Get existing recommendations to avoid duplicates
      const existingRecommendations = await this.getActiveRecommendations();

      // Generate new recommendations
      const recommendations = [];
      
      for (const [category, categoryTrends] of Object.entries(trends.trends)) {
        if (category === 'summary') continue;
        
        // Analyze category trends across all periods
        const categoryData = Object.values(categoryTrends);
        const avgSentiment = categoryData.reduce((sum, period) => 
          sum + (period.averageSentiment || 0), 0) / categoryData.length;
        
        const totalNegativeFeedback = categoryData.reduce((sum, period) => 
          sum + period.sentimentAnalysis.negative, 0);
        
        const topIssues = this.consolidateTopIssues(categoryData);
        
        // Generate recommendations for categories with issues
        if (avgSentiment < -0.2 || totalNegativeFeedback > 5) {
          const categoryRecommendations = await this.generateCategoryRecommendations(
            category, avgSentiment, totalNegativeFeedback, topIssues
          );
          
          recommendations.push(...categoryRecommendations);
        }
      }

      // Prioritize recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(recommendations);

      // Store recommendations
      const storedRecommendations = [];
      for (const rec of prioritizedRecommendations) {
        // Check if similar recommendation already exists
        const isDuplicate = existingRecommendations.some(existing => 
          this.areSimilarRecommendations(existing, rec)
        );
        
        if (!isDuplicate) {
          const storedId = await this.storeRecommendation(rec);
          storedRecommendations.push({ ...rec, id: storedId });
        }
      }

      const improvementPlan = {
        generatedAt: new Date().toISOString(),
        timeframe: { start: startDate.toISOString(), end: endDate.toISOString() },
        summary: {
          totalRecommendations: storedRecommendations.length,
          criticalIssues: storedRecommendations.filter(r => r.priority === 'critical').length,
          highPriorityIssues: storedRecommendations.filter(r => r.priority === 'high').length,
          estimatedEffort: storedRecommendations.reduce((sum, r) => sum + r.effortEstimate, 0)
        },
        recommendations: storedRecommendations,
        trendAnalysis: trends.summary,
        actionPlan: this.generateActionPlan(storedRecommendations)
      };

      logger.info('Improvement plan generated', {
        totalRecommendations: storedRecommendations.length,
        criticalIssues: improvementPlan.summary.criticalIssues
      });

      return improvementPlan;

    } catch (error) {
      logger.error('Failed to generate improvement plan:', error);
      throw error;
    }
  }

  /**
   * Helper methods for feedback analysis
   */

  groupFeedbackByPeriod(feedbackData, groupBy) {
    const grouped = {};
    
    feedbackData.forEach(feedback => {
      const date = new Date(feedback.created_at);
      let periodKey;
      
      switch (groupBy) {
        case 'day':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          periodKey = date.toISOString().split('T')[0];
      }
      
      if (!grouped[periodKey]) {
        grouped[periodKey] = [];
      }
      grouped[periodKey].push(feedback);
    });
    
    return grouped;
  }

  calculateSentimentDistribution(feedbackList) {
    let positive = 0, negative = 0, neutral = 0;
    let totalScore = 0;
    
    feedbackList.forEach(feedback => {
      const score = feedback.sentiment_score || 0;
      totalScore += score;
      
      if (score > 0.1) positive++;
      else if (score < -0.1) negative++;
      else neutral++;
    });
    
    return {
      positive,
      negative,
      neutral,
      total: feedbackList.length,
      averageScore: feedbackList.length > 0 ? totalScore / feedbackList.length : 0
    };
  }

  calculateSeverityDistribution(feedbackList) {
    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    feedbackList.forEach(feedback => {
      const severity = feedback.severity || 'medium';
      distribution[severity]++;
    });
    
    return distribution;
  }

  extractCommonKeywords(feedbackList) {
    const allKeywords = [];
    
    feedbackList.forEach(feedback => {
      if (feedback.keywords) {
        allKeywords.push(...feedback.keywords);
      }
    });
    
    const frequency = {};
    allKeywords.forEach(keyword => {
      frequency[keyword] = (frequency[keyword] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  extractCommonThemes(feedbackList) {
    const allThemes = [];
    
    feedbackList.forEach(feedback => {
      if (feedback.themes) {
        allThemes.push(...feedback.themes);
      }
    });
    
    const frequency = {};
    allThemes.forEach(theme => {
      frequency[theme] = (frequency[theme] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
  }

  identifyTopIssues(feedbackList) {
    const issues = [];
    
    // Group by themes and severity
    const negativeFeeback = feedbackList.filter(f => 
      (f.sentiment_score || 0) < -0.1 || (f.rating || 3) <= 2
    );
    
    const themeGroups = {};
    negativeFeeback.forEach(feedback => {
      if (feedback.themes) {
        feedback.themes.forEach(theme => {
          if (!themeGroups[theme]) {
            themeGroups[theme] = [];
          }
          themeGroups[theme].push(feedback);
        });
      }
    });
    
    // Convert to issues with impact scores
    for (const [theme, feedbacks] of Object.entries(themeGroups)) {
      const avgSeverity = this.calculateAverageSeverity(feedbacks);
      const impactScore = feedbacks.length * avgSeverity;
      
      issues.push({
        theme,
        count: feedbacks.length,
        avgSeverity,
        impactScore,
        examples: feedbacks.slice(0, 3).map(f => ({
          id: f.id,
          text: f.feedback_text?.substring(0, 100) + '...',
          rating: f.rating
        }))
      });
    }
    
    return issues
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 5);
  }

  identifyImprovementAreas(feedbackList) {
    const areas = [];
    
    // Analyze positive feedback for what's working well
    const positiveFeeback = feedbackList.filter(f => 
      (f.sentiment_score || 0) > 0.1 && (f.rating || 3) >= 4
    );
    
    // Analyze negative feedback for what needs improvement
    const negativeFeeback = feedbackList.filter(f => 
      (f.sentiment_score || 0) < -0.1 || (f.rating || 3) <= 2
    );
    
    // Common improvement areas based on categories
    const categoryImprovements = {
      [this.categories.ACCURACY]: 'Improve information accuracy and currency',
      [this.categories.RELEVANCE]: 'Enhance query understanding and response relevance',
      [this.categories.COMPLETENESS]: 'Provide more comprehensive and detailed responses',
      [this.categories.CLARITY]: 'Simplify language and improve explanation clarity',
      [this.categories.SPEED]: 'Optimize response time and system performance',
      [this.categories.CITATIONS]: 'Improve source referencing and citation quality',
      [this.categories.USER_EXPERIENCE]: 'Enhance user interface and interaction design',
      [this.categories.TECHNICAL]: 'Address technical issues and system reliability'
    };
    
    // Count issues by category
    const categoryCount = {};
    negativeFeeback.forEach(feedback => {
      const category = feedback.category || this.categories.OTHER;
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    // Generate improvement areas
    for (const [category, count] of Object.entries(categoryCount)) {
      if (count >= 2) { // Only include categories with multiple complaints
        areas.push({
          area: categoryImprovements[category] || `Improve ${category} related issues`,
          category,
          issueCount: count,
          priority: count >= 5 ? 'high' : count >= 3 ? 'medium' : 'low'
        });
      }
    }
    
    return areas.sort((a, b) => b.issueCount - a.issueCount);
  }

  calculateAverageSeverity(feedbacks) {
    const severityScores = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };
    
    const totalScore = feedbacks.reduce((sum, feedback) => {
      return sum + (severityScores[feedback.severity] || 2);
    }, 0);
    
    return feedbacks.length > 0 ? totalScore / feedbacks.length : 2;
  }

  calculateTrendDirections(trends) {
    const directions = {};
    
    const periods = Object.keys(trends).sort();
    if (periods.length < 2) {
      return directions;
    }
    
    // Compare first and last periods for each category
    const firstPeriod = trends[periods[0]];
    const lastPeriod = trends[periods[periods.length - 1]];
    
    for (const category of Object.keys(firstPeriod)) {
      const firstSentiment = firstPeriod[category].averageSentiment;
      const lastSentiment = lastPeriod[category].averageSentiment;
      
      const change = lastSentiment - firstSentiment;
      
      if (change > 0.1) {
        directions[category] = 'improving';
      } else if (change < -0.1) {
        directions[category] = 'declining';
      } else {
        directions[category] = 'stable';
      }
    }
    
    return directions;
  }

  generateTrendSummary(trends, trendDirections) {
    const periods = Object.keys(trends);
    const categories = Object.keys(trendDirections);
    
    const improving = categories.filter(cat => trendDirections[cat] === 'improving').length;
    const declining = categories.filter(cat => trendDirections[cat] === 'declining').length;
    const stable = categories.filter(cat => trendDirections[cat] === 'stable').length;
    
    // Calculate overall metrics
    let totalFeedback = 0;
    let totalNegative = 0;
    let avgSentiment = 0;
    
    periods.forEach(period => {
      categories.forEach(category => {
        if (trends[period][category]) {
          totalFeedback += trends[period][category].totalFeedback;
          totalNegative += trends[period][category].sentimentAnalysis.negative;
          avgSentiment += trends[period][category].averageSentiment;
        }
      });
    });
    
    const totalDataPoints = periods.length * categories.length;
    avgSentiment = totalDataPoints > 0 ? avgSentiment / totalDataPoints : 0;
    
    return {
      totalFeedback,
      totalNegative,
      avgSentiment,
      trendDirections: {
        improving,
        declining,
        stable
      },
      overallTrend: improving > declining ? 'improving' : declining > improving ? 'declining' : 'stable',
      periodsAnalyzed: periods.length,
      categoriesAnalyzed: categories.length
    };
  }

  async generateTrendRecommendations(trends, trendDirections) {
    const recommendations = [];
    
    // Recommendations for declining categories
    for (const [category, direction] of Object.entries(trendDirections)) {
      if (direction === 'declining') {
        recommendations.push({
          type: 'urgent_attention',
          category,
          title: `Address declining satisfaction in ${category}`,
          description: `User satisfaction in ${category} is declining. Immediate investigation and action required.`,
          priority: 'high',
          estimatedEffort: 20
        });
      }
    }
    
    // Recommendations for consistently low-performing categories
    const periods = Object.keys(trends);
    for (const category of Object.keys(trendDirections)) {
      const avgSentiment = periods.reduce((sum, period) => {
        return sum + (trends[period][category]?.averageSentiment || 0);
      }, 0) / periods.length;
      
      if (avgSentiment < -0.3) {
        recommendations.push({
          type: 'performance_improvement',
          category,
          title: `Improve overall ${category} performance`,
          description: `Consistently low satisfaction scores in ${category}. Comprehensive review needed.`,
          priority: 'high',
          estimatedEffort: 40
        });
      }
    }
    
    return recommendations;
  }

  async storeTrendAnalysis(analysis) {
    try {
      const client = await this.pool.connect();
      
      for (const [period, periodData] of Object.entries(analysis.trends)) {
        for (const [category, categoryData] of Object.entries(periodData)) {
          const [periodStart, periodEnd] = this.parsePeriod(period, analysis.groupBy);
          
          await client.query(`
            INSERT INTO feedback_trends (
              period_start, period_end, category, total_feedback,
              positive_count, negative_count, neutral_count, average_sentiment,
              top_issues, improvement_areas, trend_direction
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (period_start, period_end, category) DO UPDATE SET
              total_feedback = EXCLUDED.total_feedback,
              positive_count = EXCLUDED.positive_count,
              negative_count = EXCLUDED.negative_count,
              neutral_count = EXCLUDED.neutral_count,
              average_sentiment = EXCLUDED.average_sentiment,
              top_issues = EXCLUDED.top_issues,
              improvement_areas = EXCLUDED.improvement_areas,
              trend_direction = EXCLUDED.trend_direction
          `, [
            periodStart,
            periodEnd,
            category,
            categoryData.totalFeedback,
            categoryData.sentimentAnalysis.positive,
            categoryData.sentimentAnalysis.negative,
            categoryData.sentimentAnalysis.neutral,
            categoryData.averageSentiment,
            JSON.stringify(categoryData.topIssues || []),
            JSON.stringify(categoryData.improvementAreas || []),
            analysis.trendDirections[category] || 'stable'
          ]);
        }
      }
      
      client.release();
      logger.info('Trend analysis stored successfully');

    } catch (error) {
      logger.error('Failed to store trend analysis:', error);
      throw error;
    }
  }

  parsePeriod(period, groupBy) {
    const date = new Date(period);
    let periodStart, periodEnd;
    
    switch (groupBy) {
      case 'day':
        periodStart = new Date(date);
        periodEnd = new Date(date);
        periodEnd.setDate(periodEnd.getDate() + 1);
        break;
      case 'week':
        periodStart = new Date(date);
        periodEnd = new Date(date);
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case 'month':
        periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
        periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        break;
      default:
        periodStart = new Date(date);
        periodEnd = new Date(date);
        periodEnd.setDate(periodEnd.getDate() + 1);
    }
    
    return [periodStart.toISOString(), periodEnd.toISOString()];
  }

  determineSubcategory(category, feedbackText, rating) {
    // Simple subcategory determination based on patterns
    const text = feedbackText.toLowerCase();
    
    switch (category) {
      case this.categories.ACCURACY:
        if (text.includes('outdated')) return 'outdated_information';
        if (text.includes('wrong') || text.includes('incorrect')) return 'factual_errors';
        if (text.includes('missing')) return 'missing_facts';
        return 'general_accuracy';
        
      case this.categories.CLARITY:
        if (text.includes('confusing')) return 'confusing_language';
        if (text.includes('complex') || text.includes('complicated')) return 'too_complex';
        if (text.includes('structure') || text.includes('format')) return 'poor_structure';
        return 'general_clarity';
        
      case this.categories.SPEED:
        if (text.includes('slow') || text.includes('takes long')) return 'slow_response';
        if (text.includes('timeout') || text.includes('hang')) return 'system_timeout';
        return 'general_performance';
        
      default:
        return null;
    }
  }

  async getActiveRecommendations() {
    try {
      const client = await this.pool.connect();
      const result = await client.query(`
        SELECT * FROM improvement_recommendations 
        WHERE status IN ('pending', 'in_progress', 'under_review')
        ORDER BY priority DESC, created_at DESC
      `);
      client.release();
      
      return result.rows;

    } catch (error) {
      logger.error('Failed to get active recommendations:', error);
      return [];
    }
  }

  consolidateTopIssues(categoryData) {
    const allIssues = [];
    
    categoryData.forEach(period => {
      if (period.topIssues) {
        allIssues.push(...period.topIssues);
      }
    });
    
    // Group by theme and consolidate
    const consolidated = {};
    allIssues.forEach(issue => {
      if (!consolidated[issue.theme]) {
        consolidated[issue.theme] = {
          theme: issue.theme,
          totalCount: 0,
          avgSeverity: 0,
          examples: []
        };
      }
      
      consolidated[issue.theme].totalCount += issue.count;
      consolidated[issue.theme].avgSeverity += issue.avgSeverity;
      consolidated[issue.theme].examples.push(...issue.examples);
    });
    
    // Calculate averages and sort
    return Object.values(consolidated)
      .map(issue => ({
        ...issue,
        avgSeverity: issue.avgSeverity / categoryData.length,
        examples: issue.examples.slice(0, 5) // Limit examples
      }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 10);
  }

  async generateCategoryRecommendations(category, avgSentiment, totalNegativeFeedback, topIssues) {
    const recommendations = [];
    
    // Base recommendation for category
    const basePriority = avgSentiment < -0.5 ? 'high' : 'medium';
    const baseEffort = topIssues.length * 8 + 16; // Base effort + issue complexity
    
    recommendations.push({
      title: `Improve ${category} satisfaction`,
      description: `Address ${totalNegativeFeedback} negative feedback instances in ${category} category`,
      category,
      priority: basePriority,
      impactScore: Math.abs(avgSentiment) * totalNegativeFeedback,
      effortEstimate: baseEffort,
      affectedComponents: this.getAffectedComponents(category),
      relatedFeedbackIds: [], // Would be populated with actual feedback IDs
      suggestedActions: this.generateCategorySuggestedActions(category, topIssues)
    });
    
    // Specific recommendations for top issues
    topIssues.slice(0, 3).forEach(issue => {
      recommendations.push({
        title: `Address ${issue.theme} issues`,
        description: `Resolve ${issue.totalCount} instances of ${issue.theme} problems`,
        category,
        priority: issue.avgSeverity >= 3 ? 'high' : 'medium',
        impactScore: issue.totalCount * issue.avgSeverity,
        effortEstimate: Math.min(issue.totalCount * 2, 20),
        affectedComponents: this.getAffectedComponents(category),
        relatedFeedbackIds: issue.examples.map(ex => ex.id),
        suggestedActions: this.generateIssueSuggestedActions(issue.theme, category)
      });
    });
    
    return recommendations;
  }

  getAffectedComponents(category) {
    const componentMap = {
      [this.categories.ACCURACY]: ['knowledge_base', 'retrieval_system', 'content_validation'],
      [this.categories.RELEVANCE]: ['query_processing', 'retrieval_algorithm', 'context_matching'],
      [this.categories.COMPLETENESS]: ['knowledge_base', 'response_generation', 'content_coverage'],
      [this.categories.CLARITY]: ['response_generation', 'language_processing', 'formatting'],
      [this.categories.SPEED]: ['retrieval_system', 'response_generation', 'caching'],
      [this.categories.CITATIONS]: ['citation_system', 'source_tracking', 'reference_formatting'],
      [this.categories.USER_EXPERIENCE]: ['frontend', 'ui_components', 'interaction_design'],
      [this.categories.TECHNICAL]: ['backend_systems', 'api_endpoints', 'error_handling']
    };
    
    return componentMap[category] || ['general_system'];
  }

  generateCategorySuggestedActions(category, topIssues) {
    const baseActions = {
      [this.categories.ACCURACY]: [
        'Review and update knowledge base content',
        'Implement content validation processes',
        'Set up regular accuracy audits'
      ],
      [this.categories.RELEVANCE]: [
        'Improve query understanding algorithms',
        'Enhance context matching logic',
        'Review retrieval parameters'
      ],
      [this.categories.COMPLETENESS]: [
        'Expand knowledge base coverage',
        'Implement completeness checking',
        'Add follow-up question suggestions'
      ],
      [this.categories.CLARITY]: [
        'Simplify response language',
        'Improve response structure',
        'Add examples and clarifications'
      ],
      [this.categories.SPEED]: [
        'Optimize retrieval algorithms',
        'Implement response caching',
        'Review system performance'
      ],
      [this.categories.CITATIONS]: [
        'Improve citation accuracy',
        'Enhance source tracking',
        'Review citation formatting'
      ],
      [this.categories.USER_EXPERIENCE]: [
        'Conduct UX research',
        'Improve interface design',
        'Enhance user flows'
      ],
      [this.categories.TECHNICAL]: [
        'Investigate technical issues',
        'Improve error handling',
        'Enhance system monitoring'
      ]
    };
    
    return baseActions[category] || ['Review and address category issues'];
  }

  generateIssueSuggestedActions(theme, category) {
    const themeActions = {
      'outdated_information': [
        'Update outdated content in knowledge base',
        'Implement content freshness monitoring',
        'Set up regular content review cycles'
      ],
      'factual_errors': [
        'Review and correct factual errors',
        'Implement fact-checking processes',
        'Add content validation steps'
      ],
      'confusing_language': [
        'Simplify complex language',
        'Add glossary definitions',
        'Improve explanation clarity'
      ],
      'slow_response': [
        'Optimize response generation',
        'Implement query caching',
        'Review system performance bottlenecks'
      ]
    };
    
    return themeActions[theme] || [`Address ${theme} issues in ${category}`];
  }

  prioritizeRecommendations(recommendations) {
    // Calculate priority scores
    const priorityScores = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };
    
    return recommendations
      .map(rec => ({
        ...rec,
        priorityScore: priorityScores[rec.priority] * (rec.impactScore || 1)
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  areSimilarRecommendations(existing, newRec) {
    // Simple similarity check based on category and title similarity
    if (existing.category !== newRec.category) {
      return false;
    }
    
    const titleSimilarity = this.calculateStringSimilarity(
      existing.title.toLowerCase(),
      newRec.title.toLowerCase()
    );
    
    return titleSimilarity > 0.7;
  }

  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  calculateEditDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async storeRecommendation(recommendation) {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO improvement_recommendations (
          title, description, category, priority, impact_score,
          effort_estimate, affected_components, related_feedback_ids,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      
      const values = [
        recommendation.title,
        recommendation.description,
        recommendation.category,
        recommendation.priority,
        recommendation.impactScore,
        recommendation.effortEstimate,
        recommendation.affectedComponents,
        recommendation.relatedFeedbackIds,
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

  generateActionPlan(recommendations) {
    const actionPlan = {
      immediate: [], // Critical and high priority items
      shortTerm: [], // Medium priority items for next sprint
      longTerm: [], // Low priority items for future consideration
      totalEffort: recommendations.reduce((sum, r) => sum + r.effortEstimate, 0)
    };
    
    recommendations.forEach(rec => {
      const item = {
        id: rec.id,
        title: rec.title,
        effort: rec.effortEstimate,
        impact: rec.impactScore,
        components: rec.affectedComponents
      };
      
      if (rec.priority === 'critical' || rec.priority === 'high') {
        actionPlan.immediate.push(item);
      } else if (rec.priority === 'medium') {
        actionPlan.shortTerm.push(item);
      } else {
        actionPlan.longTerm.push(item);
      }
    });
    
    return actionPlan;
  }

  /**
   * Get feedback analysis statistics
   */
  async getAnalysisStatistics(timeframe = '30 days') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeframe));

      const client = await this.pool.connect();
      
      const statsQuery = `
        SELECT 
          category,
          severity,
          COUNT(*) as count,
          AVG(sentiment_score) as avg_sentiment,
          AVG(confidence_score) as avg_confidence
        FROM feedback_analysis fa
        JOIN user_feedback uf ON fa.feedback_id = uf.id
        WHERE uf.created_at >= $1 AND uf.created_at <= $2
        GROUP BY category, severity
        ORDER BY category, severity
      `;
      
      const result = await client.query(statsQuery, [startDate.toISOString(), endDate.toISOString()]);
      client.release();
      
      const statistics = {
        timeframe: { start: startDate.toISOString(), end: endDate.toISOString() },
        totalAnalyzed: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        byCategory: {},
        bySeverity: {},
        overallSentiment: 0,
        overallConfidence: 0
      };
      
      // Process results
      let totalSentiment = 0;
      let totalConfidence = 0;
      let totalCount = 0;
      
      result.rows.forEach(row => {
        const { category, severity, count, avg_sentiment, avg_confidence } = row;
        const countNum = parseInt(count);
        
        // By category
        if (!statistics.byCategory[category]) {
          statistics.byCategory[category] = {
            total: 0,
            avgSentiment: 0,
            avgConfidence: 0,
            bySeverity: {}
          };
        }
        statistics.byCategory[category].total += countNum;
        statistics.byCategory[category].bySeverity[severity] = countNum;
        
        // By severity
        if (!statistics.bySeverity[severity]) {
          statistics.bySeverity[severity] = 0;
        }
        statistics.bySeverity[severity] += countNum;
        
        // Overall calculations
        totalSentiment += parseFloat(avg_sentiment) * countNum;
        totalConfidence += parseFloat(avg_confidence) * countNum;
        totalCount += countNum;
      });
      
      // Calculate averages
      statistics.overallSentiment = totalCount > 0 ? totalSentiment / totalCount : 0;
      statistics.overallConfidence = totalCount > 0 ? totalConfidence / totalCount : 0;
      
      // Calculate category averages
      Object.keys(statistics.byCategory).forEach(category => {
        const categoryData = statistics.byCategory[category];
        const categoryRows = result.rows.filter(row => row.category === category);
        
        let catSentiment = 0;
        let catConfidence = 0;
        let catTotal = 0;
        
        categoryRows.forEach(row => {
          const count = parseInt(row.count);
          catSentiment += parseFloat(row.avg_sentiment) * count;
          catConfidence += parseFloat(row.avg_confidence) * count;
          catTotal += count;
        });
        
        categoryData.avgSentiment = catTotal > 0 ? catSentiment / catTotal : 0;
        categoryData.avgConfidence = catTotal > 0 ? catConfidence / catTotal : 0;
      });
      
      return statistics;

    } catch (error) {
      logger.error('Failed to get analysis statistics:', error);
      throw error;
    }
  }

  /**
   * Close and cleanup
   */
  async close() {
    await this.pool.end();
    this.initialized = false;
    logger.info('FeedbackAnalyzer closed');
  }
}

module.exports = FeedbackAnalyzer;
