/**
 * Enhanced Chat API with RAG Integration
 * Phase 2: Retrieval & Prompting System
 */

const express = require('express');
const RAGChatService = require('../services/RAGChatService');
const ConfidenceManager = require('../services/ConfidenceManager');
const CitationManager = require('../knowledge/citations/CitationManager');
const { getConfig } = require('../config/environment');
const logger = require('../utils/logger');
const router = express.Router();

// Initialize services
const ragChatService = new RAGChatService();
const confidenceManager = new ConfidenceManager();
const citationManager = new CitationManager();
const config = getConfig();

// Legacy system prompt for fallback mode
const LEGACY_SYSTEM_PROMPT = `You are an intelligent assistant for a Fund Management system, replacing a traditional wizard interface. Your role is to guide users through creating investment funds by collecting the following information conversationally:

## FUND CREATION PROCESS:

### 1. BASIC FUND INFORMATION:
- Fund Name (required)
- Fund Type (Sensitivities and Exposures, etc.)
- Base Unit (Market Value, etc.)
- Projection Method (Buy and Hold, etc.)
- Inferred Cash Method (Cash on Account, etc.)
- Currency (USD, EUR, etc.)
- Grouping (Asian equity, etc.)
- Open Date (format: MM/DD/YYYY)
- Close Date (optional, can be "Ongoing")

### 2. HIERARCHY STRUCTURE:
- Current hierarchy levels (e.g., ABC Investment Manager > test > dddd)
- Ability to add new hierarchy levels
- Selection from existing organizational units
- Picker name configuration

### 3. ROLLFORWARD CONFIGURATION:
- Rollforward Against Market Index selection
- Impact on daily valuations and monthly analytics

### 4. SECURITY CONTEXT:
- Fund visibility settings
- Access control configuration

## CONVERSATION GUIDELINES:
- Be conversational and helpful, not robotic
- Ask one question at a time to avoid overwhelming users
- Provide explanations for technical terms
- Suggest appropriate default values when possible
- Validate inputs and ask for clarification if needed
- Show progress through the process
- Summarize collected information before finalizing

## RESPONSE FORMAT:
- Keep responses concise but informative
- Use bullet points for options when appropriate
- Always indicate what step you're on (e.g., "Step 1 of 4: Basic Fund Information")
- Provide helpful context for each field

Start by greeting the user and asking for the fund name to begin the process.`;

// Store conversation history (in production, use database)
const conversations = new Map();

/**
 * Enhanced chat endpoint with RAG integration
 */
router.post('/message', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      message, 
      sessionId = 'default',
      useKnowledgeBase = true,
      options = {}
    } = req.body;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Valid message is required',
        code: 'INVALID_MESSAGE'
      });
    }

    // Check configuration
    if (!config.get('openai.apiKey')) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        code: 'MISSING_API_KEY'
      });
    }

    logger.info(`💬 Processing chat message for session: ${sessionId}`);
    logger.info(`📝 Message: "${message.substring(0, 100)}..."`);
    logger.info(`🔍 Use knowledge base: ${useKnowledgeBase}`);

    let response;
    let processingMetadata = {
      useRAG: useKnowledgeBase,
      sessionId,
      startTime,
      processingSteps: []
    };

    try {
      // Generate response using RAG service
      processingMetadata.processingSteps.push({ step: 'rag_generation', startTime: Date.now() });
      
      response = await ragChatService.generateResponse(message, sessionId, {
        useKnowledgeBase,
        ...options
      });
      
      processingMetadata.processingSteps.push({ 
        step: 'rag_generation', 
        endTime: Date.now(),
        success: true 
      });

      // If confidence is very low, apply fallback strategies
      if (response.confidence < confidenceManager.thresholds.minimum) {
        logger.warn(`⚠️ Very low confidence (${response.confidence.toFixed(3)}), applying fallback`);
        
        processingMetadata.processingSteps.push({ step: 'fallback_strategy', startTime: Date.now() });
        
        const fallbackResponse = await confidenceManager.applyFallbackStrategy(
          'low_retrieval_confidence',
          {
            query: message,
            originalResponse: response.message,
            originalConfidence: response.confidence
          }
        );
        
        // Merge fallback with original response
        response = {
          ...response,
          message: fallbackResponse.message,
          confidence: fallbackResponse.confidence,
          fallbackApplied: true,
          fallbackStrategy: fallbackResponse.strategy,
          suggestions: fallbackResponse.suggestions
        };
        
        processingMetadata.processingSteps.push({ 
          step: 'fallback_strategy', 
          endTime: Date.now(),
          strategy: fallbackResponse.strategy 
        });
      }

    } catch (ragError) {
      logger.error('❌ RAG service failed, falling back to legacy mode:', ragError);
      
      processingMetadata.processingSteps.push({ 
        step: 'rag_generation', 
        endTime: Date.now(),
        success: false,
        error: ragError.message 
      });

      // Fallback to legacy chat mode
      response = await generateLegacyResponse(message, sessionId);
      processingMetadata.useRAG = false;
      processingMetadata.fallbackReason = 'rag_service_error';
    }

    // Enhance response with additional metadata
    const totalProcessingTime = Date.now() - startTime;
    
    const enhancedResponse = {
      // Core response
      message: response.message,
      sessionId,
      timestamp: new Date().toISOString(),
      
      // RAG-specific data (if available)
      useKnowledgeBase: response.useKnowledgeBase || false,
      confidence: response.confidence || 0.5,
      confidenceLevel: response.confidenceLevel || 'medium',
      
      // Citations and sources
      citations: response.citations || [],
      sources: response.sources || [],
      retrievedChunks: response.retrievedChunks || [], // Add missing retrievedChunks field
      
      // Quality indicators
      qualityIndicators: response.qualityIndicators || {
        hasRelevantSources: false,
        citationsPresent: false,
        confidenceAboveThreshold: response.confidence >= 0.6,
        responseComplete: true
      },
      
      // Processing metadata
      processingTime: totalProcessingTime,
      processingMetadata: {
        ...processingMetadata,
        totalTime: totalProcessingTime,
        endTime: Date.now()
      },
      
      // Warnings and suggestions
      warnings: response.warnings || [],
      suggestions: response.suggestions || [],
      
      // Error handling
      fallbackApplied: response.fallbackApplied || false,
      error: response.error || null
    };

    // Add retrieval and generation metadata if available
    if (response.retrievalMetadata) {
      enhancedResponse.retrievalMetadata = response.retrievalMetadata;
    }
    
    if (response.generationMetadata) {
      enhancedResponse.generationMetadata = response.generationMetadata;
    }

    logger.info(`✅ Chat response generated in ${totalProcessingTime}ms`);
    logger.info(`📊 Confidence: ${response.confidence?.toFixed(3) || 'N/A'}, Citations: ${response.citations?.length || 0}`);

    // Store conversation in memory for history retrieval
    // Store as separate user and assistant messages for proper conversation flow
    const userEntry = {
      role: 'user',
      message: message,
      timestamp: new Date().toISOString()
    };
    
    const assistantEntry = {
      role: 'assistant',
      message: response.message,
      confidence: response.confidence,
      citations: response.citations || [],
      sources: response.sources || [],
      useKnowledgeBase,
      processingTime: totalProcessingTime,
      timestamp: new Date().toISOString()
    };
    
    // Get existing conversation or create new one
    const existingConversation = conversations.get(sessionId) || [];
    existingConversation.push(userEntry);
    existingConversation.push(assistantEntry);
    conversations.set(sessionId, existingConversation);
    
    logger.debug(`💾 Stored conversation entries for session ${sessionId} (total: ${existingConversation.length})`);

    res.json(enhancedResponse);

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;
    
    logger.error('❌ Chat API error:', error);
    
    // Determine error type and appropriate response
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'Failed to process message';
    
    if (error.code === 'insufficient_quota' || error.status === 429) {
      statusCode = 429;
      errorCode = 'QUOTA_EXCEEDED';
      errorMessage = 'OpenAI API quota exceeded. Please check your billing.';
    } else if (error.code === 'invalid_api_key' || error.status === 401) {
      statusCode = 401;
      errorCode = 'INVALID_API_KEY';
      errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      errorMessage = error.message;
    }

    // Generate emergency fallback response
    const fallbackMessage = await generateEmergencyFallback(req.body.message, error);

    res.status(statusCode).json({
      error: errorMessage,
      code: errorCode,
      sessionId: req.body.sessionId || 'default',
      timestamp: new Date().toISOString(),
      processingTime: totalProcessingTime,
      
      // Provide fallback response when possible
      fallbackResponse: fallbackMessage ? {
        message: fallbackMessage,
        useKnowledgeBase: false,
        confidence: 0.1,
        confidenceLevel: 'very_low',
        citations: [],
        sources: [],
        fallbackApplied: true,
        error: {
          occurred: true,
          type: errorCode,
          message: errorMessage
        }
      } : null,
      
      // Development details
      details: config.get('app.environment') === 'development' ? {
        originalError: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

/**
 * Generate legacy response (fallback mode)
 */
async function generateLegacyResponse(message, sessionId) {
  logger.info('🔄 Generating legacy response');
  
  // Demo mode responses for quota issues
  const demoResponses = {
    'hello': "Hello! I'm your Fund Management Assistant. I'll help you create a new investment fund. To get started, what would you like to name your fund?",
    'fund': "Great! Let's create your fund. I'll need some basic information:\n\n**Step 1: Fund Details**\n- Fund Name\n- Fund Type (e.g., Equity, Bond, Mixed)\n- Base Currency (USD, EUR, etc.)\n- Investment Strategy\n\nWhat would you like to name your fund?",
    'corporate': "Excellent! A corporate bond fund is a great choice. Let me gather the details:\n\n**Fund Name**: Corporate Bond USD\n**Fund Type**: Fixed Income - Corporate Bonds\n**Base Currency**: USD\n**Strategy**: Investment Grade Corporate Bonds\n\nNow, let's set up the hierarchy. What organization or manager should this fund be under?",
    'default': "I understand you want to create a fund. I'm currently running in legacy mode. Here's what I can help you with:\n\n**Fund Creation Process:**\n1. **Basic Info**: Name, type, currency, dates\n2. **Hierarchy**: Organizational structure\n3. **Rollforward**: Market index settings\n4. **Security**: Access controls\n\nPlease provide more specific information about what you'd like to know!"
  };

  const lowerMessage = message.toLowerCase();
  let demoResponse = demoResponses.default;
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    demoResponse = demoResponses.hello;
  } else if (lowerMessage.includes('fund') || lowerMessage.includes('create')) {
    demoResponse = demoResponses.fund;
  } else if (lowerMessage.includes('corporate') || lowerMessage.includes('bond')) {
    demoResponse = demoResponses.corporate;
  }

  return {
    message: demoResponse,
    useKnowledgeBase: false,
    confidence: 0.6,
    confidenceLevel: 'medium',
    citations: [],
    sources: [],
    qualityIndicators: {
      hasRelevantSources: false,
      citationsPresent: false,
      confidenceAboveThreshold: true,
      responseComplete: true
    },
    legacyMode: true
  };
}

/**
 * Generate emergency fallback response
 */
async function generateEmergencyFallback(message, error) {
  try {
    const errorType = error.code || error.name || 'unknown';
    
    const fallbackMessages = {
      'insufficient_quota': `I apologize, but I'm currently experiencing API quota limitations. For immediate assistance with "${message}", please:
1. Consult your Fund Management User Guide directly
2. Contact your system administrator
3. Try again later when quota is restored`,
      
      'invalid_api_key': `I'm experiencing authentication issues. For help with "${message}", please:
1. Check the Fund Management documentation
2. Contact technical support
3. Verify system configuration`,
      
      'default': `I apologize, but I'm experiencing technical difficulties processing your request about "${message}". Please:
1. Try rephrasing your question
2. Consult the Fund Management User Guide
3. Contact support if the issue persists`
    };
    
    return fallbackMessages[errorType] || fallbackMessages.default;
  } catch (fallbackError) {
    logger.error('❌ Emergency fallback failed:', fallbackError);
    return `I apologize, but I'm experiencing technical difficulties. Please consult your Fund Management documentation or contact support.`;
  }
}

/**
 * Enhanced conversation history endpoint
 */
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, includeMetadata = false } = req.query;
    
    logger.info(`📜 Retrieving conversation history for session: ${sessionId}`);
    
    // Try to get from RAG service first (database-backed)
    let conversation = [];
    let metadata = {};
    
    try {
      const ragStats = await ragChatService.getServiceStats();
      if (ragStats && ragStats.conversations) {
        metadata.totalConversations = ragStats.conversations.total;
        metadata.averageLength = ragStats.conversations.averageLength;
      }
    } catch (ragError) {
      logger.warn('⚠️ Could not get RAG conversation data:', ragError.message);
    }
    
    // Fallback to in-memory storage
    const memoryConversation = conversations.get(sessionId) || [];
    conversation = memoryConversation.slice(-parseInt(limit));
    
    const response = {
      conversation,
      sessionId,
      messageCount: conversation.length,
      timestamp: new Date().toISOString()
    };
    
    if (includeMetadata === 'true') {
      response.metadata = metadata;
    }
    
    res.json(response);
    
  } catch (error) {
    logger.error('❌ Failed to retrieve conversation history:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation history',
      sessionId: req.params.sessionId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Enhanced clear conversation endpoint
 */
router.delete('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`🗑️ Clearing conversation history for session: ${sessionId}`);
    
    // Clear from memory
    conversations.delete(sessionId);
    
    // Note: In production, this would also clear from database
    // await ragChatService.clearConversation(sessionId);
    
    res.json({
      message: 'Conversation history cleared successfully',
      sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Failed to clear conversation history:', error);
    res.status(500).json({
      error: 'Failed to clear conversation history',
      sessionId: req.params.sessionId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Enhanced health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '2.0',
      
      // Configuration checks
      configuration: {
        openaiConfigured: !!config.get('openai.apiKey'),
        databaseConfigured: !!config.get('database.host'),
        ragEnabled: true,
        environment: config.get('app.environment') || 'development'
      },
      
      // Service status
      services: {
        ragChatService: 'unknown',
        confidenceManager: 'unknown',
        citationManager: 'unknown',
        database: 'unknown'
      }
    };
    
    // Test RAG service (token-free health check)
    try {
      const ragStats = await ragChatService.getServiceStats();
      healthData.services.ragChatService = ragStats.openaiConfigured && ragStats.databaseConfigured ? 'healthy' : 'unhealthy';
      healthData.services.ragServiceDetails = {
        openaiConfigured: ragStats.openaiConfigured,
        databaseConfigured: ragStats.databaseConfigured,
        ragEnabled: ragStats.ragEnabled,
        environment: ragStats.environment
      };
    } catch (ragError) {
      healthData.services.ragChatService = 'error';
      logger.warn('⚠️ RAG service health check failed:', ragError.message || 'Unknown error');
    }
    
    // Test confidence manager
    try {
      const confidenceTest = await confidenceManager.testConfidenceManager();
      healthData.services.confidenceManager = confidenceTest.success ? 'healthy' : 'unhealthy';
    } catch (confError) {
      healthData.services.confidenceManager = 'error';
      logger.warn('⚠️ Confidence manager health check failed:', confError.message);
    }
    
    // Test citation manager
    try {
      const citationTest = await citationManager.testCitationManager();
      healthData.services.citationManager = citationTest.success ? 'healthy' : 'unhealthy';
    } catch (citError) {
      healthData.services.citationManager = 'error';
      logger.warn('⚠️ Citation manager health check failed:', citError.message);
    }
    
    // Overall health status
    const unhealthyServices = Object.values(healthData.services).filter(status => 
      status === 'unhealthy' || status === 'error'
    );
    
    if (unhealthyServices.length > 0) {
      healthData.status = 'DEGRADED';
      healthData.warnings = [`${unhealthyServices.length} service(s) are not healthy`];
    }
    
    const statusCode = healthData.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(healthData);
    
  } catch (error) {
    logger.error('❌ Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: config.get('app.environment') === 'development' ? error.message : undefined
    });
  }
});

/**
 * RAG system statistics endpoint
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('📊 Retrieving RAG system statistics');
    
    const stats = {
      timestamp: new Date().toISOString(),
      system: {
        version: '2.0',
        environment: config.get('app.environment'),
        uptime: process.uptime()
      }
    };
    
    // Get RAG service stats
    try {
      const ragStats = await ragChatService.getServiceStats();
      stats.ragService = ragStats;
    } catch (ragError) {
      logger.warn('⚠️ Failed to get RAG service stats:', ragError.message || 'Unknown error');
      stats.ragService = { 
        error: ragError.message || 'Unknown error',
        errorType: ragError.name || 'UnknownError',
        timestamp: new Date().toISOString()
      };
    }
    
    // Get retrieval engine stats
    try {
      const retrievalStats = await ragChatService.retrievalEngine.getEngineStats();
      stats.retrievalEngine = retrievalStats;
    } catch (retrievalError) {
      logger.warn('⚠️ Failed to get retrieval engine stats:', retrievalError.message || 'Unknown error');
      stats.retrievalEngine = { 
        error: retrievalError.message || 'Unknown error',
        errorType: retrievalError.name || 'UnknownError',
        timestamp: new Date().toISOString()
      };
    }
    
    res.json(stats);
    
  } catch (error) {
    logger.error('❌ Failed to get system statistics:', error);
    res.status(500).json({
      error: 'Failed to retrieve system statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test RAG system endpoint
 */
router.post('/test', async (req, res) => {
  try {
    const { 
      testQuery = 'How do I create a new fund?',
      testType = 'full',
      sessionId = 'test-session'
    } = req.body;
    
    logger.info(`🧪 Running RAG system test: ${testType}`);
    
    const testResults = {
      testType,
      testQuery,
      timestamp: new Date().toISOString(),
      results: {}
    };
    
    if (testType === 'full' || testType === 'rag') {
      const ragTest = await ragChatService.testService(testQuery, sessionId);
      testResults.results.ragService = ragTest;
    }
    
    if (testType === 'full' || testType === 'confidence') {
      const confidenceTest = await confidenceManager.testConfidenceManager();
      testResults.results.confidenceManager = confidenceTest;
    }
    
    if (testType === 'full' || testType === 'citations') {
      const citationTest = await citationManager.testCitationManager();
      testResults.results.citationManager = citationTest;
    }
    
    // Overall test success
    const allTests = Object.values(testResults.results);
    testResults.success = allTests.every(test => test.success);
    testResults.summary = {
      totalTests: allTests.length,
      passedTests: allTests.filter(test => test.success).length,
      failedTests: allTests.filter(test => !test.success).length
    };
    
    const statusCode = testResults.success ? 200 : 500;
    res.status(statusCode).json(testResults);
    
  } catch (error) {
    logger.error('❌ RAG system test failed:', error);
    res.status(500).json({
      error: 'RAG system test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Submit user feedback for a chat response
 * POST /api/chat/feedback
 */
router.post('/feedback', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      messageId,
      sessionId,
      rating,
      feedbackText,
      feedbackCategories,
      suggestions,
      userQuery,
      assistantResponse,
      retrievedChunks,
      citations,
      responseQualityScore,
      responseTimeMs,
      confidenceScore,
      metadata = {}
    } = req.body;

    // Input validation
    const validationErrors = [];
    
    if (!messageId || typeof messageId !== 'string') {
      validationErrors.push('messageId is required and must be a string');
    }
    
    if (!sessionId || typeof sessionId !== 'string') {
      validationErrors.push('sessionId is required and must be a string');
    }
    
    if (rating !== undefined && rating !== null) {
      if (![-1, 1].includes(rating)) {
        validationErrors.push('rating must be -1 (thumbs down) or 1 (thumbs up)');
      }
    }
    
    if (feedbackCategories && !Array.isArray(feedbackCategories)) {
      validationErrors.push('feedbackCategories must be an array');
    }
    
    if (responseQualityScore !== undefined && 
        (typeof responseQualityScore !== 'number' || 
         responseQualityScore < 0 || responseQualityScore > 1)) {
      validationErrors.push('responseQualityScore must be a number between 0 and 1');
    }
    
    if (confidenceScore !== undefined && 
        (typeof confidenceScore !== 'number' || 
         confidenceScore < 0 || confidenceScore > 1)) {
      validationErrors.push('confidenceScore must be a number between 0 and 1');
    }
    
    if (responseTimeMs !== undefined && 
        (typeof responseTimeMs !== 'number' || responseTimeMs <= 0)) {
      validationErrors.push('responseTimeMs must be a positive number');
    }

    if (validationErrors.length > 0) {
      logger.warn('📝 Feedback validation failed:', { 
        errors: validationErrors, 
        sessionId, 
        messageId 
      });
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Check if session exists using existing database configuration
    const { getDatabase } = require('../config/database');
    const db = getDatabase();

    logger.debug('🔍 Validating session exists for feedback', { sessionId, messageId });
    
    const sessionCheck = await db.query(
      'SELECT session_id FROM conversations WHERE session_id = $1 LIMIT 1',
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      logger.warn('⚠️ Feedback submitted for non-existent session:', { sessionId, messageId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get client IP and user agent for audit trail
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Hash IP address for privacy
    const crypto = require('crypto');
    const ipHash = crypto.createHash('sha256').update(clientIp + 'feedback_salt').digest('hex');

    // Check for duplicate feedback (same messageId)
    const duplicateCheck = await db.query(
      'SELECT feedback_id FROM feedback WHERE message_id = $1 AND session_id = $2',
      [messageId, sessionId]
    );

    let feedbackId;
    
    if (duplicateCheck.rows.length > 0) {
      // Update existing feedback
      logger.info('🔄 Updating existing feedback', { 
        sessionId, 
        messageId, 
        existingFeedbackId: duplicateCheck.rows[0].feedback_id 
      });
      
      const updateResult = await db.query(`
        UPDATE feedback SET
          rating = COALESCE($3, rating),
          feedback_text = COALESCE($4, feedback_text),
          feedback_categories = COALESCE($5, feedback_categories),
          suggestions = COALESCE($6, suggestions),
          user_query = COALESCE($7, user_query),
          assistant_response = COALESCE($8, assistant_response),
          retrieved_chunks = COALESCE($9, retrieved_chunks),
          citations = COALESCE($10, citations),
          response_quality_score = COALESCE($11, response_quality_score),
          response_time_ms = COALESCE($12, response_time_ms),
          confidence_score = COALESCE($13, confidence_score),
          user_agent = $14,
          ip_address_hash = $15,
          metadata = COALESCE($16, metadata),
          created_at = CURRENT_TIMESTAMP
        WHERE message_id = $1 AND session_id = $2
        RETURNING feedback_id
      `, [
        messageId, sessionId, rating, feedbackText, feedbackCategories,
        suggestions, userQuery, assistantResponse, 
        retrievedChunks ? JSON.stringify(retrievedChunks) : null,
        citations ? JSON.stringify(citations) : null,
        responseQualityScore, responseTimeMs, confidenceScore,
        userAgent, ipHash, JSON.stringify(metadata)
      ]);
      
      feedbackId = updateResult.rows[0].feedback_id;
      
    } else {
      // Insert new feedback
      logger.info('➕ Creating new feedback entry', { sessionId, messageId });
      
      const insertResult = await db.query(`
        INSERT INTO feedback (
          session_id, message_id, user_query, assistant_response,
          rating, feedback_text, feedback_categories, suggestions,
          retrieved_chunks, citations, response_quality_score,
          response_time_ms, confidence_score, user_agent,
          ip_address_hash, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING feedback_id
      `, [
        sessionId, messageId, userQuery || '', assistantResponse || '',
        rating, feedbackText, feedbackCategories,
        suggestions, 
        retrievedChunks ? JSON.stringify(retrievedChunks) : null,
        citations ? JSON.stringify(citations) : null,
        responseQualityScore, responseTimeMs, confidenceScore,
        userAgent, ipHash, JSON.stringify(metadata)
      ]);
      
      feedbackId = insertResult.rows[0].feedback_id;
    }

    const processingTime = Date.now() - startTime;
    
    logger.info('✅ Feedback processed successfully', {
      feedbackId,
      sessionId,
      messageId,
      rating,
      hasText: !!feedbackText,
      categories: feedbackCategories?.length || 0,
      processingTime: `${processingTime}ms`
    });

    // Log business event for analytics
    logger.logBusiness('feedback_submitted', {
      feedbackId,
      sessionId,
      messageId,
      rating,
      feedbackType: rating === 1 ? 'positive' : rating === -1 ? 'negative' : 'neutral',
      hasTextFeedback: !!feedbackText,
      hasSuggestions: !!suggestions,
      categoriesCount: feedbackCategories?.length || 0,
      processingTime
    });

    res.status(201).json({
      success: true,
      feedbackId,
      message: 'Feedback submitted successfully',
      processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('❌ Feedback submission failed:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.body?.sessionId,
      messageId: req.body?.messageId,
      processingTime: `${processingTime}ms`
    });

    // Log security event for potential abuse
    if (error.code === '23505') { // Unique constraint violation
      logger.logSecurity('duplicate_feedback_attempt', {
        sessionId: req.body?.sessionId,
        messageId: req.body?.messageId,
        ip: req.ip
      });
    }

    res.status(500).json({
      error: 'Failed to submit feedback',
      code: 'FEEDBACK_SUBMISSION_ERROR',
      details: config.get('app.environment') === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
