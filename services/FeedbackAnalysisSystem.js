/**
 * Feedback Analysis and Improvement System
 * Automated analysis of user feedback with clustering, trend analysis, and improvement recommendations
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const OpenAI = require('openai');
const natural = require('natural');

class FeedbackAnalysisSystem {
  constructor() {
    this.config = getConfig();
    this.pool = new Pool({ 
      connectionString: this.config.database?.url || process.env.DATABASE_URL || 'postgresql://localhost:5432/fund_chatbot'
    });
    this.openai = new OpenAI({
      apiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY
    });
    
    // Analysis settings
    this.sentimentThreshold = {
      positive: 0.6,
      negative: -0.3
    };
    
    this.clusteringSettings = {
      minClusterSize: 3,
      maxClusters: 10,
      similarityThreshold: 0.7
    };
    
    this.trendAnalysisSettings = {
      minDataPoints: 10,
      trendPeriodDays: 30,
      significanceThreshold: 0.05
    };
    
    // Feedback categories
    this.feedbackCategories = {
      ACCURACY: 'accuracy',
      RELEVANCE: 'relevance',
      COMPLETENESS: 'completeness',
      CLARITY: 'clarity',
      SPEED: 'speed',
      USABILITY: 'usability',
      FEATURE_REQUEST: 'feature_request',
      BUG_REPORT: 'bug_report',
      GENERAL: 'general'
    };
    
    // Priority levels for improvements
    this.priorityLevels = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low'
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the feedback analysis system
   */
  async initialize() {
    try {
      await this.ensureTablesExist();
      await this.loadAnalysisModels();
      
      this.initialized = true;
      logger.info('FeedbackAnalysisSystem initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize FeedbackAnalysisSystem:', error);
      throw error;
    }
  }

  /**
   * Ensure required database tables exist
   */
  async ensureTablesExist() {
    const client = await this.pool.connect();
    
    try {
      // Create feedback analysis table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          feedback_id UUID NOT NULL REFERENCES user_feedback(id),
          sentiment_score FLOAT NOT NULL,
          sentiment_label VARCHAR(20) NOT NULL, -- positive, negative, neutral
          confidence_score FLOAT NOT NULL,
          categories JSONB NOT NULL, -- Array of detected categories with confidence
          keywords JSONB NOT NULL, -- Extracted keywords and phrases
          topics JSONB NOT NULL, -- Identified topics and themes
          urgency_score FLOAT NOT NULL,
          complexity_score FLOAT NOT NULL,
          actionable_items JSONB, -- Specific actionable items extracted
          related_features JSONB, -- Features/areas mentioned in feedback
          embedding_vector VECTOR(1536), -- For similarity analysis
          analysis_metadata JSONB,
          analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          analyzed_by VARCHAR(50) DEFAULT 'system'
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback_id ON feedback_analysis (feedback_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis (sentiment_label, sentiment_score);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed_at ON feedback_analysis (analyzed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feedback_analysis_urgency ON feedback_analysis (urgency_score DESC);
      `);

      // Create feedback clusters table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_clusters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cluster_name VARCHAR(200) NOT NULL,
          cluster_description TEXT,
          cluster_keywords JSONB NOT NULL,
          cluster_center VECTOR(1536), -- Centroid of the cluster
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

      // Create cluster membership table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_cluster_membership (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          feedback_analysis_id UUID NOT NULL REFERENCES feedback_analysis(id),
          cluster_id UUID NOT NULL REFERENCES feedback_clusters(id),
          similarity_score FLOAT NOT NULL,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(feedback_analysis_id, cluster_id)
        );

        CREATE INDEX IF NOT EXISTS idx_cluster_membership_feedback ON feedback_cluster_membership (feedback_analysis_id);
        CREATE INDEX IF NOT EXISTS idx_cluster_membership_cluster ON feedback_cluster_membership (cluster_id);
        CREATE INDEX IF NOT EXISTS idx_cluster_membership_similarity ON feedback_cluster_membership (similarity_score DESC);
      `);

      // Create trend analysis table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback_trends (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trend_type VARCHAR(50) NOT NULL, -- sentiment, category, keyword, cluster
          trend_subject VARCHAR(200) NOT NULL, -- What the trend is about
          time_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
          time_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
          trend_direction VARCHAR(20) NOT NULL, -- increasing, decreasing, stable
          trend_strength FLOAT NOT NULL, -- 0.0 to 1.0
          statistical_significance FLOAT, -- p-value if applicable
          data_points INTEGER NOT NULL,
          trend_data JSONB NOT NULL, -- Time series data
          trend_summary TEXT,
          detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_significant BOOLEAN DEFAULT false
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_trends_type ON feedback_trends (trend_type, trend_subject);
        CREATE INDEX IF NOT EXISTS idx_feedback_trends_period ON feedback_trends (time_period_start, time_period_end);
        CREATE INDEX IF NOT EXISTS idx_feedback_trends_significance ON feedback_trends (is_significant, trend_strength DESC);
      `);

      // Create improvement recommendations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS improvement_recommendations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recommendation_type VARCHAR(50) NOT NULL, -- feature, fix, enhancement, process
          title VARCHAR(300) NOT NULL,
          description TEXT NOT NULL,
          rationale TEXT NOT NULL,
          priority_level VARCHAR(20) NOT NULL,
          estimated_impact FLOAT, -- 0.0 to 1.0
          estimated_effort FLOAT, -- 0.0 to 1.0 (relative scale)
          affected_areas JSONB, -- Areas of the system affected
          supporting_feedback_ids JSONB, -- Feedback that supports this recommendation
          supporting_clusters JSONB, -- Clusters that support this recommendation
          supporting_trends JSONB, -- Trends that support this recommendation
          implementation_notes JSONB,
          status VARCHAR(30) DEFAULT 'pending', -- pending, approved, in_progress, completed, rejected
          assigned_to VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          implemented_at TIMESTAMP WITH TIME ZONE,
          implementation_notes_text TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_improvement_recs_priority ON improvement_recommendations (priority_level, estimated_impact DESC);
        CREATE INDEX IF NOT EXISTS idx_improvement_recs_status ON improvement_recommendations (status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_improvement_recs_type ON improvement_recommendations (recommendation_type);
      `);

      logger.info('Feedback analysis database tables ensured');

    } finally {
      client.release();
    }
  }

  /**
   * Load analysis models and configurations
   */
  async loadAnalysisModels() {
    try {
      // Initialize sentiment analyzer
      this.sentimentAnalyzer = natural.SentimentAnalyzer.createAnalyzer(
        'English',
        natural.PorterStemmer,
        'afinn'
      );
      
      // Initialize tokenizer
      this.tokenizer = new natural.WordTokenizer();
      
      // Load or create keyword extraction model
      this.tfidf = new natural.TfIdf();
      
      logger.info('Analysis models loaded successfully');

    } catch (error) {
      logger.error('Failed to load analysis models:', error);
      throw error;
    }
  }

  /**
   * Analyze a single piece of feedback
   */
  async analyzeFeedback(feedbackId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Analyzing feedback: ${feedbackId}`);

      // Get feedback data
      const feedback = await this.getFeedbackById(feedbackId);
      if (!feedback) {
        throw new Error('Feedback not found');
      }

      // Perform comprehensive analysis
      const analysis = await this.performComprehensiveAnalysis(feedback);
      
      // Store analysis results
      const analysisId = await this.storeAnalysisResults(feedbackId, analysis);
      
      // Update clustering
      await this.updateClustering(analysisId, analysis);
      
      logger.info(`Feedback analysis completed`, {
        feedbackId,
        analysisId,
        sentiment: analysis.sentiment.label,
        urgency: analysis.urgency
      });

      return {
        analysisId,
        sentiment: analysis.sentiment,
        categories: analysis.categories,
        urgency: analysis.urgency,
        actionableItems: analysis.actionableItems
      };

    } catch (error) {
      logger.error(`Failed to analyze feedback ${feedbackId}:`, error);
      throw error;
    }
  }

  /**
   * Perform comprehensive analysis on feedback
   */
  async performComprehensiveAnalysis(feedback) {
    try {
      const text = `${feedback.feedback_text} ${feedback.context || ''}`.trim();
      
      const analysis = {
        sentiment: await this.analyzeSentiment(text),
        categories: await this.categorizeFeeback(text, feedback),
        keywords: await this.extractKeywords(text),
        topics: await this.identifyTopics(text),
        urgency: await this.calculateUrgency(text, feedback),
        complexity: await this.calculateComplexity(text),
        actionableItems: await this.extractActionableItems(text),
        relatedFeatures: await this.identifyRelatedFeatures(text),
        embedding: await this.generateEmbedding(text)
      };

      return analysis;

    } catch (error) {
      logger.error('Failed to perform comprehensive analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze sentiment of feedback text
   */
  async analyzeSentiment(text) {
    try {
      // Use natural library for basic sentiment
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      const score = this.sentimentAnalyzer.getSentiment(tokens);
      
      // Normalize score to -1 to 1 range
      const normalizedScore = Math.max(-1, Math.min(1, score));
      
      // Determine label
      let label = 'neutral';
      if (normalizedScore >= this.sentimentThreshold.positive) {
        label = 'positive';
      } else if (normalizedScore <= this.sentimentThreshold.negative) {
        label = 'negative';
      }

      // Use AI for more nuanced sentiment analysis
      const aiSentiment = await this.analyzeSentimentWithAI(text);
      
      return {
        score: aiSentiment?.score || normalizedScore,
        label: aiSentiment?.label || label,
        confidence: aiSentiment?.confidence || Math.abs(normalizedScore),
        emotions: aiSentiment?.emotions || [],
        aspects: aiSentiment?.aspects || []
      };

    } catch (error) {
      logger.error('Failed to analyze sentiment:', error);
      return {
        score: 0,
        label: 'neutral',
        confidence: 0.5,
        emotions: [],
        aspects: []
      };
    }
  }

  /**
   * Use AI for advanced sentiment analysis
   */
  async analyzeSentimentWithAI(text) {
    try {
      const prompt = `
        Analyze the sentiment of this user feedback about a fund management chatbot:
        
        "${text}"
        
        Provide a detailed sentiment analysis including:
        1. Overall sentiment score (-1.0 to 1.0)
        2. Sentiment label (positive, negative, neutral)
        3. Confidence level (0.0 to 1.0)
        4. Specific emotions detected
        5. Sentiment aspects (what specific aspects are positive/negative)
        
        Respond with JSON:
        {
          "score": -1.0 to 1.0,
          "label": "positive|negative|neutral",
          "confidence": 0.0 to 1.0,
          "emotions": ["emotion1", "emotion2"],
          "aspects": [
            {"aspect": "response_quality", "sentiment": "positive", "confidence": 0.8},
            {"aspect": "speed", "sentiment": "negative", "confidence": 0.6}
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 400
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      logger.error('AI sentiment analysis failed:', error);
      return null;
    }
  }

  /**
   * Categorize feedback into predefined categories
   */
  async categorizeFeeback(text, feedback) {
    try {
      const categories = [];
      const textLower = text.toLowerCase();
      
      // Rule-based categorization
      const categoryRules = {
        [this.feedbackCategories.ACCURACY]: ['wrong', 'incorrect', 'inaccurate', 'mistake', 'error'],
        [this.feedbackCategories.RELEVANCE]: ['irrelevant', 'off-topic', 'not related', 'unrelated'],
        [this.feedbackCategories.COMPLETENESS]: ['incomplete', 'missing', 'partial', 'more detail'],
        [this.feedbackCategories.CLARITY]: ['confusing', 'unclear', 'hard to understand', 'vague'],
        [this.feedbackCategories.SPEED]: ['slow', 'fast', 'quick', 'delay', 'timeout'],
        [this.feedbackCategories.USABILITY]: ['difficult', 'easy', 'user-friendly', 'interface'],
        [this.feedbackCategories.FEATURE_REQUEST]: ['would like', 'please add', 'suggestion', 'feature'],
        [this.feedbackCategories.BUG_REPORT]: ['bug', 'broken', 'not working', 'crash', 'freeze']
      };

      for (const [category, keywords] of Object.entries(categoryRules)) {
        const matches = keywords.filter(keyword => textLower.includes(keyword));
        if (matches.length > 0) {
          categories.push({
            category,
            confidence: Math.min(1.0, matches.length * 0.3),
            keywords: matches
          });
        }
      }

      // Use AI for more sophisticated categorization
      const aiCategories = await this.categorizeWithAI(text);
      if (aiCategories) {
        categories.push(...aiCategories);
      }

      // Remove duplicates and sort by confidence
      const uniqueCategories = this.deduplicateCategories(categories);
      
      return uniqueCategories.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      logger.error('Failed to categorize feedback:', error);
      return [{ category: this.feedbackCategories.GENERAL, confidence: 0.5, keywords: [] }];
    }
  }

  /**
   * Use AI for advanced categorization
   */
  async categorizeWithAI(text) {
    try {
      const prompt = `
        Categorize this user feedback about a fund management chatbot into relevant categories:
        
        "${text}"
        
        Available categories: accuracy, relevance, completeness, clarity, speed, usability, feature_request, bug_report, general
        
        For each relevant category, provide a confidence score (0.0 to 1.0).
        
        Respond with JSON array:
        [
          {"category": "accuracy", "confidence": 0.8, "reasoning": "user mentions incorrect information"},
          {"category": "speed", "confidence": 0.6, "reasoning": "user mentions response time"}
        ]
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      logger.error('AI categorization failed:', error);
      return null;
    }
  }

  /**
   * Extract keywords from feedback text
   */
  async extractKeywords(text) {
    try {
      // Add text to TF-IDF
      this.tfidf.addDocument(text.toLowerCase());
      
      // Get TF-IDF scores
      const keywords = [];
      const docIndex = this.tfidf.documents.length - 1;
      
      this.tfidf.listTerms(docIndex).forEach(item => {
        if (item.term.length > 2 && item.tfidf > 0.1) { // Filter short words and low scores
          keywords.push({
            term: item.term,
            score: item.tfidf,
            type: 'tfidf'
          });
        }
      });

      // Extract noun phrases and entities
      const entities = await this.extractEntities(text);
      keywords.push(...entities);

      // Sort by score and return top keywords
      return keywords.sort((a, b) => b.score - a.score).slice(0, 20);

    } catch (error) {
      logger.error('Failed to extract keywords:', error);
      return [];
    }
  }

  /**
   * Extract entities and noun phrases
   */
  async extractEntities(text) {
    try {
      const entities = [];
      
      // Simple noun phrase extraction using patterns
      const nounPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
      
      nounPhrases.forEach(phrase => {
        entities.push({
          term: phrase.toLowerCase(),
          score: 0.7,
          type: 'noun_phrase'
        });
      });

      // Extract technical terms (simple pattern matching)
      const technicalTerms = text.match(/\b(?:API|UI|UX|database|server|response|query|search|fund|portfolio|investment)\b/gi) || [];
      
      technicalTerms.forEach(term => {
        entities.push({
          term: term.toLowerCase(),
          score: 0.8,
          type: 'technical_term'
        });
      });

      return entities;

    } catch (error) {
      logger.error('Failed to extract entities:', error);
      return [];
    }
  }

  /**
   * Identify topics in feedback
   */
  async identifyTopics(text) {
    try {
      // Simple topic identification using keyword clustering
      const keywords = await this.extractKeywords(text);
      
      const topics = [];
      
      // Group related keywords into topics
      const topicGroups = {
        'response_quality': ['accurate', 'correct', 'wrong', 'right', 'information', 'answer'],
        'user_experience': ['easy', 'difficult', 'confusing', 'clear', 'interface', 'design'],
        'performance': ['slow', 'fast', 'speed', 'delay', 'timeout', 'response time'],
        'functionality': ['feature', 'function', 'capability', 'option', 'tool'],
        'content': ['information', 'data', 'content', 'knowledge', 'documentation']
      };

      const textLower = text.toLowerCase();
      
      for (const [topic, relatedWords] of Object.entries(topicGroups)) {
        const matches = relatedWords.filter(word => textLower.includes(word));
        if (matches.length > 0) {
          topics.push({
            topic,
            confidence: Math.min(1.0, matches.length * 0.25),
            keywords: matches
          });
        }
      }

      return topics.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      logger.error('Failed to identify topics:', error);
      return [];
    }
  }

  /**
   * Calculate urgency score
   */
  async calculateUrgency(text, feedback) {
    try {
      let urgency = 0.3; // Base urgency
      
      const textLower = text.toLowerCase();
      
      // Urgency indicators
      const urgencyKeywords = {
        critical: 1.0,
        urgent: 0.9,
        asap: 0.9,
        immediately: 0.9,
        broken: 0.8,
        'not working': 0.8,
        crash: 0.8,
        error: 0.7,
        bug: 0.7,
        problem: 0.6,
        issue: 0.5,
        slow: 0.4
      };

      for (const [keyword, score] of Object.entries(urgencyKeywords)) {
        if (textLower.includes(keyword)) {
          urgency = Math.max(urgency, score);
        }
      }

      // Consider feedback rating if available
      if (feedback.rating !== undefined && feedback.rating !== null) {
        if (feedback.rating <= 2) urgency += 0.3;
        else if (feedback.rating <= 3) urgency += 0.1;
      }

      // Consider sentiment
      const sentiment = await this.analyzeSentiment(text);
      if (sentiment.label === 'negative' && sentiment.score < -0.5) {
        urgency += 0.2;
      }

      return Math.min(1.0, urgency);

    } catch (error) {
      logger.error('Failed to calculate urgency:', error);
      return 0.5;
    }
  }

  /**
   * Calculate complexity score
   */
  async calculateComplexity(text) {
    try {
      let complexity = 0.3; // Base complexity
      
      // Text length factor
      const wordCount = text.split(/\s+/).length;
      if (wordCount > 100) complexity += 0.2;
      if (wordCount > 200) complexity += 0.2;
      
      // Technical terms
      const technicalTerms = (text.match(/\b(?:API|database|server|algorithm|integration|configuration|authentication)\b/gi) || []).length;
      complexity += Math.min(0.3, technicalTerms * 0.1);
      
      // Multiple topics/categories
      const topics = await this.identifyTopics(text);
      if (topics.length > 2) complexity += 0.1;
      if (topics.length > 4) complexity += 0.1;
      
      return Math.min(1.0, complexity);

    } catch (error) {
      logger.error('Failed to calculate complexity:', error);
      return 0.5;
    }
  }

  /**
   * Extract actionable items from feedback
   */
  async extractActionableItems(text) {
    try {
      const actionableItems = [];
      
      // Pattern matching for common actionable phrases
      const actionPatterns = [
        /please (add|include|implement|fix|update|change|improve) (.+?)(?:[.!?]|$)/gi,
        /would like to (see|have|get) (.+?)(?:[.!?]|$)/gi,
        /should (add|include|implement|fix|update|change|improve) (.+?)(?:[.!?]|$)/gi,
        /need to (add|include|implement|fix|update|change|improve) (.+?)(?:[.!?]|$)/gi,
        /suggestion:? (.+?)(?:[.!?]|$)/gi
      ];

      for (const pattern of actionPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const action = match[1] || 'implement';
          const item = match[2] || match[1];
          
          if (item && item.trim().length > 3) {
            actionableItems.push({
              action: action.toLowerCase(),
              item: item.trim(),
              confidence: 0.8,
              source: 'pattern_matching'
            });
          }
        }
      }

      // Use AI for more sophisticated extraction
      const aiItems = await this.extractActionableItemsWithAI(text);
      if (aiItems) {
        actionableItems.push(...aiItems);
      }

      return this.deduplicateActionableItems(actionableItems);

    } catch (error) {
      logger.error('Failed to extract actionable items:', error);
      return [];
    }
  }

  /**
   * Use AI to extract actionable items
   */
  async extractActionableItemsWithAI(text) {
    try {
      const prompt = `
        Extract actionable items from this user feedback about a fund management chatbot:
        
        "${text}"
        
        For each actionable item, identify:
        1. The specific action requested (fix, add, improve, etc.)
        2. What needs to be acted upon
        3. Confidence level (0.0 to 1.0)
        
        Respond with JSON array:
        [
          {
            "action": "improve",
            "item": "response accuracy for fund calculations",
            "confidence": 0.9,
            "source": "ai_extraction"
          }
        ]
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      logger.error('AI actionable item extraction failed:', error);
      return null;
    }
  }

  /**
   * Identify features/areas mentioned in feedback
   */
  async identifyRelatedFeatures(text) {
    try {
      const features = [];
      const textLower = text.toLowerCase();
      
      // Feature mapping
      const featureMap = {
        'chat_interface': ['chat', 'interface', 'ui', 'user interface', 'conversation'],
        'search_functionality': ['search', 'find', 'query', 'lookup'],
        'response_generation': ['response', 'answer', 'reply', 'generation'],
        'knowledge_base': ['knowledge', 'information', 'data', 'content'],
        'fund_calculations': ['calculation', 'math', 'compute', 'fund', 'portfolio'],
        'authentication': ['login', 'auth', 'authentication', 'signin'],
        'performance': ['speed', 'performance', 'slow', 'fast', 'delay'],
        'accuracy': ['accurate', 'correct', 'wrong', 'mistake', 'error']
      };

      for (const [feature, keywords] of Object.entries(featureMap)) {
        const matches = keywords.filter(keyword => textLower.includes(keyword));
        if (matches.length > 0) {
          features.push({
            feature,
            confidence: Math.min(1.0, matches.length * 0.3),
            keywords: matches
          });
        }
      }

      return features.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      logger.error('Failed to identify related features:', error);
      return [];
    }
  }

  /**
   * Generate embedding for feedback text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text.substring(0, 8000), // Limit to avoid token limits
      });

      return response.data[0].embedding;

    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Store analysis results in database
   */
  async storeAnalysisResults(feedbackId, analysis) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO feedback_analysis (
          feedback_id, sentiment_score, sentiment_label, confidence_score,
          categories, keywords, topics, urgency_score, complexity_score,
          actionable_items, related_features, embedding_vector, analysis_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;
      
      const values = [
        feedbackId,
        analysis.sentiment.score,
        analysis.sentiment.label,
        analysis.sentiment.confidence,
        JSON.stringify(analysis.categories),
        JSON.stringify(analysis.keywords),
        JSON.stringify(analysis.topics),
        analysis.urgency,
        analysis.complexity,
        JSON.stringify(analysis.actionableItems),
        JSON.stringify(analysis.relatedFeatures),
        analysis.embedding ? JSON.stringify(analysis.embedding) : null,
        JSON.stringify({
          emotions: analysis.sentiment.emotions,
          aspects: analysis.sentiment.aspects
        })
      ];
      
      const result = await client.query(query, values);
      return result.rows[0].id;

    } finally {
      client.release();
    }
  }

  /**
   * Update clustering with new analysis
   */
  async updateClustering(analysisId, analysis) {
    try {
      if (!analysis.embedding) {
        logger.warn('No embedding available for clustering');
        return;
      }

      // Find similar existing clusters
      const similarClusters = await this.findSimilarClusters(analysis.embedding);
      
      if (similarClusters.length > 0) {
        // Assign to most similar cluster
        const bestCluster = similarClusters[0];
        await this.assignToCluster(analysisId, bestCluster.id, bestCluster.similarity);
        await this.updateClusterStats(bestCluster.id);
      } else {
        // Check if we should create a new cluster
        const recentSimilarAnalyses = await this.findSimilarAnalyses(analysis.embedding, analysisId);
        
        if (recentSimilarAnalyses.length >= this.clusteringSettings.minClusterSize - 1) {
          // Create new cluster
          const clusterId = await this.createNewCluster(analysis, [analysisId, ...recentSimilarAnalyses.map(a => a.id)]);
          logger.info('Created new feedback cluster', { clusterId, size: recentSimilarAnalyses.length + 1 });
        }
      }

    } catch (error) {
      logger.error('Failed to update clustering:', error);
    }
  }

  /**
   * Find similar existing clusters
   */
  async findSimilarClusters(embedding) {
    const client = await this.pool.connect();
    
    try {
      // Use cosine similarity to find similar clusters
      const query = `
        SELECT 
          id, cluster_name, cluster_size,
          (cluster_center <=> $1::vector) as distance
        FROM feedback_clusters 
        WHERE is_active = true
        ORDER BY distance
        LIMIT 5
      `;
      
      const result = await client.query(query, [JSON.stringify(embedding)]);
      
      return result.rows
        .filter(row => (1 - row.distance) >= this.clusteringSettings.similarityThreshold)
        .map(row => ({
          id: row.id,
          name: row.cluster_name,
          size: row.cluster_size,
          similarity: 1 - row.distance
        }));

    } finally {
      client.release();
    }
  }

  /**
   * Find similar analyses for potential new cluster
   */
  async findSimilarAnalyses(embedding, currentAnalysisId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          id, feedback_id,
          (embedding_vector <=> $1::vector) as distance
        FROM feedback_analysis 
        WHERE id != $2 
          AND embedding_vector IS NOT NULL
          AND analyzed_at >= NOW() - INTERVAL '30 days'
        ORDER BY distance
        LIMIT 20
      `;
      
      const result = await client.query(query, [JSON.stringify(embedding), currentAnalysisId]);
      
      return result.rows
        .filter(row => (1 - row.distance) >= this.clusteringSettings.similarityThreshold)
        .map(row => ({
          id: row.id,
          feedbackId: row.feedback_id,
          similarity: 1 - row.distance
        }));

    } finally {
      client.release();
    }
  }

  /**
   * Assign analysis to cluster
   */
  async assignToCluster(analysisId, clusterId, similarity) {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `INSERT INTO feedback_cluster_membership (feedback_analysis_id, cluster_id, similarity_score)
         VALUES ($1, $2, $3)
         ON CONFLICT (feedback_analysis_id, cluster_id) DO UPDATE SET
         similarity_score = EXCLUDED.similarity_score`,
        [analysisId, clusterId, similarity]
      );

    } finally {
      client.release();
    }
  }

  /**
   * Update cluster statistics
   */
  async updateClusterStats(clusterId) {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `UPDATE feedback_clusters SET
         cluster_size = (
           SELECT COUNT(*) FROM feedback_cluster_membership 
           WHERE cluster_id = $1
         ),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [clusterId]
      );

    } finally {
      client.release();
    }
  }

  /**
   * Create new cluster
   */
  async createNewCluster(analysis, analysisIds) {
    const client = await this.pool.connect();
    
    try {
      // Generate cluster name and description
      const clusterInfo = await this.generateClusterInfo(analysisIds);
      
      const query = `
        INSERT INTO feedback_clusters (
          cluster_name, cluster_description, cluster_keywords,
          cluster_center, cluster_size, dominant_sentiment, avg_urgency_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        clusterInfo.name,
        clusterInfo.description,
        JSON.stringify(clusterInfo.keywords),
        JSON.stringify(analysis.embedding),
        analysisIds.length,
        analysis.sentiment.label,
        analysis.urgency
      ];
      
      const result = await client.query(query, values);
      const clusterId = result.rows[0].id;
      
      // Assign all analyses to this cluster
      for (const analysisId of analysisIds) {
        await this.assignToCluster(analysisId, clusterId, 0.9);
      }
      
      return clusterId;

    } finally {
      client.release();
    }
  }

  /**
   * Generate cluster information
   */
  async generateClusterInfo(analysisIds) {
    try {
      // Get analysis data for cluster members
      const analyses = await this.getAnalysesById(analysisIds);
      
      // Extract common keywords and topics
      const allKeywords = analyses.flatMap(a => a.keywords || []);
      const keywordCounts = {};
      
      allKeywords.forEach(kw => {
        const term = kw.term || kw;
        keywordCounts[term] = (keywordCounts[term] || 0) + 1;
      });
      
      const topKeywords = Object.entries(keywordCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([term, count]) => ({ term, count }));
      
      // Generate name based on top keywords
      const name = topKeywords.slice(0, 3).map(kw => kw.term).join(' & ');
      
      // Generate description
      const description = `Cluster of ${analyses.length} feedback items related to ${name}`;
      
      return {
        name: name || 'General Feedback',
        description,
        keywords: topKeywords
      };

    } catch (error) {
      logger.error('Failed to generate cluster info:', error);
      return {
        name: 'New Cluster',
        description: 'Automatically generated cluster',
        keywords: []
      };
    }
  }

  /**
   * Analyze trends in feedback data
   */
  async analyzeTrends(options = {}) {
    try {
      logger.info('Analyzing feedback trends');

      const {
        timeWindow = 30, // days
        trendTypes = ['sentiment', 'category', 'urgency'],
        minDataPoints = this.trendAnalysisSettings.minDataPoints
      } = options;

      const trends = [];
      
      for (const trendType of trendTypes) {
        const trendData = await this.analyzeTrendType(trendType, timeWindow, minDataPoints);
        trends.push(...trendData);
      }
      
      // Store significant trends
      for (const trend of trends) {
        if (trend.isSignificant) {
          await this.storeTrend(trend);
        }
      }
      
      logger.info(`Trend analysis completed, found ${trends.filter(t => t.isSignificant).length} significant trends`);
      
      return trends;

    } catch (error) {
      logger.error('Failed to analyze trends:', error);
      throw error;
    }
  }

  /**
   * Analyze specific trend type
   */
  async analyzeTrendType(trendType, timeWindow, minDataPoints) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (timeWindow * 24 * 60 * 60 * 1000));
      
      const trendData = await this.getTrendData(trendType, startDate, endDate);
      
      if (trendData.length < minDataPoints) {
        return [];
      }
      
      const trends = [];
      
      switch (trendType) {
        case 'sentiment':
          trends.push(...this.analyzeSentimentTrends(trendData, startDate, endDate));
          break;
        case 'category':
          trends.push(...this.analyzeCategoryTrends(trendData, startDate, endDate));
          break;
        case 'urgency':
          trends.push(...this.analyzeUrgencyTrends(trendData, startDate, endDate));
          break;
        case 'cluster':
          trends.push(...this.analyzeClusterTrends(trendData, startDate, endDate));
          break;
      }
      
      return trends;

    } catch (error) {
      logger.error(`Failed to analyze ${trendType} trends:`, error);
      return [];
    }
  }

  /**
   * Analyze sentiment trends
   */
  analyzeSentimentTrends(data, startDate, endDate) {
    try {
      const trends = [];
      
      // Group by time periods (daily)
      const dailyData = this.groupByDay(data);
      const sentimentScores = Object.values(dailyData).map(day => 
        day.reduce((sum, item) => sum + item.sentiment_score, 0) / day.length
      );
      
      if (sentimentScores.length < 3) return trends;
      
      // Calculate trend
      const trendStats = this.calculateTrendStatistics(sentimentScores);
      
      trends.push({
        type: 'sentiment',
        subject: 'overall_sentiment',
        startDate,
        endDate,
        direction: trendStats.direction,
        strength: trendStats.strength,
        significance: trendStats.significance,
        dataPoints: sentimentScores.length,
        data: dailyData,
        summary: `Sentiment trend: ${trendStats.direction} (strength: ${trendStats.strength.toFixed(2)})`,
        isSignificant: trendStats.significance < this.trendAnalysisSettings.significanceThreshold
      });
      
      return trends;

    } catch (error) {
      logger.error('Failed to analyze sentiment trends:', error);
      return [];
    }
  }

  /**
   * Calculate trend statistics
   */
  calculateTrendStatistics(values) {
    if (values.length < 2) {
      return { direction: 'stable', strength: 0, significance: 1.0 };
    }
    
    // Simple linear regression for trend detection
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for significance
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    
    // Determine direction and strength
    const strength = Math.abs(slope);
    let direction = 'stable';
    
    if (slope > 0.01) direction = 'increasing';
    else if (slope < -0.01) direction = 'decreasing';
    
    // Simple significance test (could be improved with proper statistical tests)
    const significance = 1 - rSquared;
    
    return {
      direction,
      strength,
      significance,
      slope,
      rSquared
    };
  }

  /**
   * Group data by day
   */
  groupByDay(data) {
    const grouped = {};
    
    data.forEach(item => {
      const date = new Date(item.analyzed_at).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });
    
    return grouped;
  }

  /**
   * Generate improvement recommendations
   */
  async generateImprovementRecommendations(options = {}) {
    try {
      logger.info('Generating improvement recommendations');

      const {
        lookbackDays = 30,
        minFeedbackCount = 5,
        includeAIRecommendations = true
      } = options;

      const recommendations = [];
      
      // Analyze recent feedback patterns
      const patterns = await this.analyzeRecentPatterns(lookbackDays);
      
      // Generate recommendations from patterns
      for (const pattern of patterns) {
        const recs = await this.generateRecommendationsFromPattern(pattern);
        recommendations.push(...recs);
      }
      
      // Get AI-powered recommendations if enabled
      if (includeAIRecommendations) {
        const aiRecs = await this.generateAIRecommendations(patterns);
        recommendations.push(...aiRecs);
      }
      
      // Prioritize and deduplicate recommendations
      const finalRecommendations = this.prioritizeRecommendations(recommendations);
      
      // Store recommendations
      for (const rec of finalRecommendations) {
        await this.storeRecommendation(rec);
      }
      
      logger.info(`Generated ${finalRecommendations.length} improvement recommendations`);
      
      return finalRecommendations;

    } catch (error) {
      logger.error('Failed to generate improvement recommendations:', error);
      throw error;
    }
  }

  /**
   * Analyze recent feedback patterns
   */
  async analyzeRecentPatterns(lookbackDays) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          fa.*,
          uf.rating,
          uf.feedback_text,
          uf.created_at as feedback_created_at
        FROM feedback_analysis fa
        JOIN user_feedback uf ON fa.feedback_id = uf.id
        WHERE fa.analyzed_at >= NOW() - INTERVAL '${lookbackDays} days'
        ORDER BY fa.analyzed_at DESC
      `;
      
      const result = await client.query(query);
      const analyses = result.rows;
      
      const patterns = {
        negativeSentiment: analyses.filter(a => a.sentiment_label === 'negative'),
        highUrgency: analyses.filter(a => a.urgency_score > 0.7),
        commonCategories: this.findCommonCategories(analyses),
        frequentIssues: this.findFrequentIssues(analyses),
        clusterInsights: await this.getClusterInsights(lookbackDays)
      };
      
      return patterns;

    } finally {
      client.release();
    }
  }

  /**
   * Find common categories in feedback
   */
  findCommonCategories(analyses) {
    const categoryCount = {};
    
    analyses.forEach(analysis => {
      const categories = analysis.categories || [];
      categories.forEach(cat => {
        const category = cat.category || cat;
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
    });
    
    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([category, count]) => ({ category, count, percentage: count / analyses.length }));
  }

  /**
   * Find frequent issues mentioned in feedback
   */
  findFrequentIssues(analyses) {
    const issueCount = {};
    
    analyses.forEach(analysis => {
      const actionableItems = analysis.actionable_items || [];
      actionableItems.forEach(item => {
        const issue = item.item || item;
        issueCount[issue] = (issueCount[issue] || 0) + 1;
      });
    });
    
    return Object.entries(issueCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count, percentage: count / analyses.length }));
  }

  /**
   * Get cluster insights
   */
  async getClusterInsights(lookbackDays) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          fc.*,
          COUNT(fcm.feedback_analysis_id) as recent_feedback_count
        FROM feedback_clusters fc
        LEFT JOIN feedback_cluster_membership fcm ON fc.id = fcm.cluster_id
        LEFT JOIN feedback_analysis fa ON fcm.feedback_analysis_id = fa.id
        WHERE fc.is_active = true 
          AND (fa.analyzed_at >= NOW() - INTERVAL '${lookbackDays} days' OR fa.analyzed_at IS NULL)
        GROUP BY fc.id
        ORDER BY recent_feedback_count DESC, fc.cluster_size DESC
        LIMIT 10
      `;
      
      const result = await client.query(query);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Store recommendation in database
   */
  async storeRecommendation(recommendation) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO improvement_recommendations (
          recommendation_type, title, description, rationale, priority_level,
          estimated_impact, estimated_effort, affected_areas,
          supporting_feedback_ids, supporting_clusters, supporting_trends,
          implementation_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      
      const values = [
        recommendation.type,
        recommendation.title,
        recommendation.description,
        recommendation.rationale,
        recommendation.priority,
        recommendation.estimatedImpact,
        recommendation.estimatedEffort,
        JSON.stringify(recommendation.affectedAreas || []),
        JSON.stringify(recommendation.supportingFeedbackIds || []),
        JSON.stringify(recommendation.supportingClusters || []),
        JSON.stringify(recommendation.supportingTrends || []),
        JSON.stringify(recommendation.implementationNotes || {})
      ];
      
      const result = await client.query(query, values);
      return result.rows[0].id;

    } finally {
      client.release();
    }
  }

  /**
   * Helper methods for deduplication
   */
  deduplicateCategories(categories) {
    const unique = new Map();
    
    categories.forEach(cat => {
      const key = cat.category;
      if (!unique.has(key) || unique.get(key).confidence < cat.confidence) {
        unique.set(key, cat);
      }
    });
    
    return Array.from(unique.values());
  }

  deduplicateActionableItems(items) {
    const unique = new Map();
    
    items.forEach(item => {
      const key = `${item.action}_${item.item.toLowerCase()}`;
      if (!unique.has(key) || unique.get(key).confidence < item.confidence) {
        unique.set(key, item);
      }
    });
    
    return Array.from(unique.values());
  }

  prioritizeRecommendations(recommendations) {
    // Sort by impact and priority
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        return (b.estimatedImpact || 0) - (a.estimatedImpact || 0);
      })
      .slice(0, 20); // Limit to top 20 recommendations
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(feedbackId) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM user_feedback WHERE id = $1',
        [feedbackId]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get analyses by IDs
   */
  async getAnalysesById(analysisIds) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM feedback_analysis WHERE id = ANY($1)',
        [analysisIds]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get trend data for analysis
   */
  async getTrendData(trendType, startDate, endDate) {
    const client = await this.pool.connect();
    
    try {
      let query = '';
      
      switch (trendType) {
        case 'sentiment':
          query = `
            SELECT sentiment_score, sentiment_label, analyzed_at
            FROM feedback_analysis
            WHERE analyzed_at BETWEEN $1 AND $2
            ORDER BY analyzed_at
          `;
          break;
        case 'urgency':
          query = `
            SELECT urgency_score, analyzed_at
            FROM feedback_analysis
            WHERE analyzed_at BETWEEN $1 AND $2
            ORDER BY analyzed_at
          `;
          break;
        default:
          return [];
      }
      
      const result = await client.query(query, [startDate, endDate]);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Store trend in database
   */
  async storeTrend(trend) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO feedback_trends (
          trend_type, trend_subject, time_period_start, time_period_end,
          trend_direction, trend_strength, statistical_significance,
          data_points, trend_data, trend_summary, is_significant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
      
      const values = [
        trend.type,
        trend.subject,
        trend.startDate,
        trend.endDate,
        trend.direction,
        trend.strength,
        trend.significance,
        trend.dataPoints,
        JSON.stringify(trend.data),
        trend.summary,
        trend.isSignificant
      ];
      
      const result = await client.query(query, values);
      return result.rows[0].id;

    } finally {
      client.release();
    }
  }

  /**
   * Generate AI recommendations (placeholder - implement based on patterns)
   */
  async generateAIRecommendations(patterns) {
    // This would use AI to generate sophisticated recommendations
    // For now, return empty array
    return [];
  }

  /**
   * Generate recommendations from pattern (placeholder)
   */
  async generateRecommendationsFromPattern(pattern) {
    // This would analyze patterns and generate specific recommendations
    // For now, return empty array
    return [];
  }

  /**
   * Analyze category trends (placeholder)
   */
  analyzeCategoryTrends(data, startDate, endDate) {
    return [];
  }

  /**
   * Analyze urgency trends (placeholder)
   */
  analyzeUrgencyTrends(data, startDate, endDate) {
    return [];
  }

  /**
   * Analyze cluster trends (placeholder)
   */
  analyzeClusterTrends(data, startDate, endDate) {
    return [];
  }

  /**
   * Close and cleanup
   */
  async close() {
    await this.pool.end();
    this.initialized = false;
    logger.info('FeedbackAnalysisSystem closed');
  }
}

module.exports = FeedbackAnalysisSystem;
