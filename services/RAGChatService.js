/**
 * RAG Chat Service Module
 * Complete RAG-enabled chat service with GPT-4 integration
 * Phase 2: Retrieval & Prompting System
 */

const OpenAI = require('openai');
const RetrievalEngine = require('../knowledge/retrieval/RetrievalEngine');
const AdvancedContextualRetriever = require('../knowledge/retrieval/AdvancedContextualRetriever');
const PromptAssembler = require('../knowledge/prompting/PromptAssembler');
const ChunkPreprocessor = require('../knowledge/preprocessing/ChunkPreprocessor');
const QueryClassifier = require('./QueryClassifier');
const SmartChunkSelector = require('./SmartChunkSelector');
const TokenBudgetManager = require('./TokenBudgetManager');
const { getConfig } = require('../config/environment');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

class RAGChatService {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.openai = null;
    this.retrievalEngine = new RetrievalEngine();
    this.advancedRetriever = new AdvancedContextualRetriever();
    this.promptAssembler = new PromptAssembler();
    this.chunkPreprocessor = new ChunkPreprocessor({
      maxTokensPerChunk: 200,
      maxTotalTokens: 1500,
      preserveKeyPhrases: true,
      extractNumbers: true
    });
    
    // Phase 1 Token Optimization Systems
    this.queryClassifier = new QueryClassifier();
    this.smartChunkSelector = new SmartChunkSelector({
      minRelevanceScore: 0.3,
      minQualityScore: 0.4,
      maxChunksPerSource: 3,
      tokenBudgetRatio: 0.7
    });
    this.tokenBudgetManager = new TokenBudgetManager({
      baseBudgets: {
        simple: 800,
        standard: 1500,
        complex: 2500,
        system: 0
      }
    });
    
    this.useAdvancedRetrieval = true; // Use enhanced RetrievalEngine with content-aware ranking
    
    // Service configuration
    this.serviceConfig = {
      useKnowledgeBase: true,
      maxRetries: this.config.get('openai.maxRetries') || 3,
      requestTimeout: this.config.get('openai.requestTimeout') || 30000,
      confidenceThreshold: this.config.get('rag.response.confidenceThreshold') || 0.6,
      maxTokens: this.config.get('rag.response.maxTokens') || 1000,
      temperature: this.config.get('rag.response.temperature') || 0.3,
      enableCitationValidation: this.config.get('rag.response.enableCitationValidation') !== false
    };
    
    // Response quality thresholds
    this.qualityThresholds = {
      highConfidence: 0.8,
      mediumConfidence: 0.6,
      lowConfidence: 0.4
    };
    
    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client with graceful error handling
   */
  initializeOpenAI() {
    try {
      const apiKey = this.config.get('openai.apiKey');
      const environment = this.config.get('app.environment');
      
      // Check for valid API key
      if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'placeholder' || apiKey.length < 10) {
        if (environment === 'development') {
          logger.warn('⚠️ OpenAI API key not configured - AI features disabled in development mode');
          this.openai = null;
          this.serviceConfig.useKnowledgeBase = false;
          return;
        } else {
          throw new Error('OpenAI API key is required but not configured. Please set OPENAI_API_KEY environment variable.');
        }
      }
      
      this.openai = new OpenAI({
        apiKey: apiKey,
        organization: this.config.get('openai.organization'),
        project: this.config.get('openai.project'),
        timeout: this.serviceConfig.requestTimeout,
        maxRetries: this.serviceConfig.maxRetries
      });
      
      logger.info('✅ OpenAI client initialized for RAG chat service');
    } catch (error) {
      logger.error('❌ Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    try {
      if (!this.db) {
        this.db = getDatabase();
        if (this.db && !this.db.isReady()) {
          await this.db.initialize();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Database initialization failed, using mock mode:', error.message);
      logger.warn('⚠️ Database error details:', {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
      
      // In test environment or development without database, continue without database
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        this.db = null;
        logger.info('🔄 Continuing in mock mode without database');
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate RAG-enhanced response
   * @param {string} userQuery - User's question
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Generation options
   * @returns {Object} Complete response with citations and metadata
   */
  async generateResponse(userQuery, sessionId, options = {}) {
    const startTime = Date.now();
    
    // Phase 1 Token Optimization: Classify query and determine processing path
    const classification = this.queryClassifier.classifyQuery(userQuery, sessionId, {
      userAgent: options.userAgent,
      timestamp: new Date(),
      queryLength: userQuery.length
    });
    
    logger.info(`🎯 Query classified as: ${classification.type} (${classification.complexity || 'N/A'}) - Confidence: ${classification.confidence}`);
    
    // Handle system queries immediately (0 tokens)
    if (classification.type === 'SYSTEM') {
      logger.info('🔧 System query detected - bypassing all token usage');
      return this.generateSystemResponse(userQuery, sessionId, classification);
    }
    
    // Calculate optimal token budget
    const budgetResult = this.tokenBudgetManager.calculateBudget(classification, {
      conversationHistory: options.conversationHistory,
      expectedConfidence: options.expectedConfidence,
      queryLength: userQuery.length,
      userType: options.userType
    });
    
    logger.info(`💰 Token budget allocated: ${budgetResult.totalBudget} tokens (${budgetResult.allocation.chunks} for chunks)`);
    
    // Store classification and budget for later use
    options._classification = classification;
    options._budget = budgetResult;
    
    // Check if OpenAI is available
    if (!this.openai) {
      logger.warn('⚠️ OpenAI not available - generating fallback response');
      return {
        message: "I apologize, but the AI service is currently not available. Please ensure the OpenAI API key is properly configured.",
        useKnowledgeBase: false,
        confidence: 0.1,
        confidenceLevel: 'very_low',
        sources: [],
        citations: [],
        qualityIndicators: {
          hasRelevantSources: false,
          citationsPresent: false,
          confidenceAboveThreshold: false,
          responseComplete: true
        },
        processingMetadata: {
          processingTime: Date.now() - startTime,
          fallbackReason: 'openai_unavailable'
        }
      };
    }
    
    try {
      // Validate inputs
      if (!userQuery || typeof userQuery !== 'string') {
        throw new Error('Invalid user query provided');
      }
      if (!sessionId) {
        throw new Error('Session ID is required');
      }
      
      await this.initializeDatabase();
      
      logger.info(`🤖 Generating RAG response for session: ${sessionId}`);
      logger.info(`❓ Query: "${userQuery.substring(0, 100)}..."`);
      logger.debug(`🔧 RAG Service Options:`, {
        useKnowledgeBase: options.useKnowledgeBase !== false,
        maxTokens: options.maxTokens || this.serviceConfig.maxTokens,
        temperature: options.temperature || this.serviceConfig.temperature,
        sessionId: sessionId
      });
      
      // Get conversation context
      const conversationContext = await this.getConversationContext(sessionId, options);
      logger.debug(`💬 Conversation context loaded:`, {
        messageCount: conversationContext?.messages?.length || 0,
        hasContext: !!conversationContext
      });
      
      // Determine if we should use knowledge base
      const useKB = options.useKnowledgeBase !== false && this.serviceConfig.useKnowledgeBase;
      
      let response;
      if (useKB) {
        response = await this.generateKnowledgeBasedResponse(
          userQuery, 
          sessionId, 
          conversationContext, 
          options
        );
      } else {
        response = await this.generateStandardResponse(
          userQuery, 
          sessionId, 
          conversationContext, 
          options
        );
      }
      
      // Store conversation and audit log (if database is available)
      if (this.db) {
        try {
          await Promise.all([
            this.storeConversationTurn(sessionId, userQuery, response),
            this.logInteraction(sessionId, userQuery, response, Date.now() - startTime)
          ]);
        } catch (dbError) {
          logger.warn('⚠️ Failed to store conversation data:', dbError.message);
          // Continue without storing - don't fail the response
        }
      } else {
        logger.debug('📝 Skipping conversation storage - database not available');
      }
      
      const totalTime = Date.now() - startTime;
      logger.info(`✅ RAG response generated in ${totalTime}ms`);
      
      return {
        ...response,
        sessionId,
        timestamp: new Date().toISOString(),
        totalProcessingTime: totalTime
      };
      
    } catch (error) {
      logger.error('❌ RAG response generation failed:', error.message || 'Unknown error');
      logger.error('❌ Error stack:', error.stack || 'No stack trace available');
      logger.error('❌ Error details:', {
        name: error.name || 'UnknownError',
        code: error.code || 'NO_CODE',
        severity: error.severity || 'unknown',
        detail: error.detail || 'No additional details',
        hint: error.hint || 'No hints available',
        query: userQuery ? userQuery.substring(0, 100) : 'No query provided',
        sessionId: sessionId || 'No session ID',
        errorType: typeof error,
        errorConstructor: error.constructor?.name || 'Unknown'
      });
      
      // Log the error
      try {
        await this.logError(sessionId, userQuery, error, Date.now() - startTime);
      } catch (logError) {
        logger.error('❌ Failed to log error to database:', logError.message);
      }
      
      // Return fallback response
      return this.generateFallbackResponse(userQuery, sessionId, error);
    }
  }

  /**
   * Generate knowledge-based response using RAG
   * @param {string} userQuery - User query
   * @param {string} sessionId - Session ID
   * @param {Object} conversationContext - Conversation context
   * @param {Object} options - Options
   * @returns {Object} Knowledge-based response
   */
  async generateKnowledgeBasedResponse(userQuery, sessionId, conversationContext, options) {
    logger.info('🔍 Generating knowledge-based response');
    logger.debug('🔍 Knowledge-based response parameters:', {
      query: userQuery.substring(0, 200),
      sessionId: sessionId,
      maxChunks: options.maxChunks || 5,
      retrievalStrategy: options.retrievalStrategy || 'default'
    });
    
    // Step 1: Retrieve relevant chunks using advanced retrieval if enabled
    const retrievalStartTime = Date.now();
    logger.debug('📚 Starting knowledge retrieval...');
    
    let retrievalResult;
    console.log('🔍 DEBUG: useAdvancedRetrieval flag:', this.useAdvancedRetrieval);
    if (this.useAdvancedRetrieval) {
      logger.info('🚀 Using Advanced Contextual Retrieval');
      await this.advancedRetriever.initialize();
      
      retrievalResult = await this.advancedRetriever.retrieveWithAdvancedContext(
        userQuery, 
        conversationContext, 
        {
          maxChunks: options.maxChunks || 5,
          strategy: options.retrievalStrategy || 'advanced_multi_feature',
          threshold: options.threshold || 0.5,
          ...options.retrievalOptions
        }
      );
      
      // Convert to expected format
      retrievalResult = {
        chunks: retrievalResult.chunks || [],
        confidence: retrievalResult.confidence || 0.5,
        avgRelevance: retrievalResult.averageRelevance || 0.5,
        strategy: retrievalResult.strategy || 'hybrid',
        metadata: {
          confidenceScore: retrievalResult.confidence || 0.5,
          retrievalTime: retrievalResult.retrievalTime || 0
        },
        queryAnalysis: {
          complexity: 'medium',
          entities: [],
          queryType: 'general'
        }
      };
    } else {
      logger.info('📚 Using Enhanced Retrieval Engine');
      console.log('🔍 DEBUG: About to call enhanced retrieval engine...');
      console.log('🔍 DEBUG: Query:', userQuery);
      console.log('🔍 DEBUG: Options:', {
        maxResults: options.maxChunks || 5,
        strategy: options.retrievalStrategy,
        rerankingModel: options.rerankingModel
      });
      
      retrievalResult = await this.retrievalEngine.retrieve(
        userQuery,
        conversationContext,
        {
          maxResults: options.maxChunks || 5,
          strategy: options.retrievalStrategy || 'hybrid',
          rerankingModel: options.rerankingModel || 'similarity_based',
          ...options.retrievalOptions
        }
      );
      
      console.log('🔍 DEBUG: Retrieval result:', {
        strategy: retrievalResult.strategy,
        chunksFound: retrievalResult.chunks?.length || 0,
        processingTime: retrievalResult.processingTime
      });
    }
    
    const retrievalTime = Date.now() - retrievalStartTime;
    
    logger.info(`📄 Retrieved ${retrievalResult.chunks.length} chunks in ${retrievalTime}ms`);
    logger.debug('📄 Retrieval results:', {
      chunkCount: retrievalResult.chunks.length,
      confidence: retrievalResult.confidence,
      avgRelevance: retrievalResult.avgRelevance,
      strategy: retrievalResult.strategy,
      retrievalTime: retrievalTime
    });
    
    // Log chunk details in debug mode
    if (retrievalResult.chunks.length > 0) {
      logger.debug('📋 Retrieved chunks summary:', 
        retrievalResult.chunks.map((chunk, index) => ({
          index: index + 1,
          source: chunk.source_id,
          page: chunk.page_number,
          relevance: chunk.relevance_score,
          contentPreview: chunk.content.substring(0, 100) + '...'
        }))
      );
    }
    
    // Step 2: Smart chunk selection and optimization
    logger.info('🔧 Starting smart chunk selection and optimization...');
    
    const classification = options._classification;
    const budgetResult = options._budget;
    
    // Apply smart chunk selection
    const chunkSelectionResult = await this.smartChunkSelector.selectOptimalChunks(
      retrievalResult.chunks,
      userQuery,
      {
        tokenBudget: budgetResult.allocation.chunks,
        maxChunks: classification.maxChunks || options.maxChunks || 5,
        complexity: classification.complexity,
        prioritizeQuality: true
      }
    );
    
    logger.info(`🎯 Smart selection: ${chunkSelectionResult.selectedCount}/${chunkSelectionResult.originalCount} chunks, ${chunkSelectionResult.estimatedTokens} tokens`);
    
    // Apply local preprocessing to selected chunks
    const preprocessingResult = await this.chunkPreprocessor.preprocessChunks(
      chunkSelectionResult.chunks,
      userQuery,
      {
        maxTotalTokens: budgetResult.allocation.chunks,
        preserveContext: true
      }
    );
    
    logger.info(`📊 Token optimization: ${preprocessingResult.originalTokens} → ${preprocessingResult.optimizedTokens} tokens (${preprocessingResult.reductionPercentage}% reduction)`);
    
    // Update retrieval result with optimized chunks
    retrievalResult.chunks = preprocessingResult.processedChunks;
    retrievalResult.condensedContent = preprocessingResult.condensedContent;
    retrievalResult.tokenOptimization = {
      originalTokens: preprocessingResult.originalTokens,
      optimizedTokens: preprocessingResult.optimizedTokens,
      reductionPercentage: preprocessingResult.reductionPercentage,
      processingTime: preprocessingResult.processingTime,
      chunkSelection: {
        originalCount: chunkSelectionResult.originalCount,
        selectedCount: chunkSelectionResult.selectedCount,
        selectionRatio: chunkSelectionResult.selectedCount / chunkSelectionResult.originalCount,
        optimizations: chunkSelectionResult.optimizations
      }
    };
    
    // Step 3: Check retrieval confidence
    const retrievalConfidence = retrievalResult.metadata.confidenceScore;
    if (retrievalConfidence < this.serviceConfig.confidenceThreshold) {
      logger.warn(`⚠️ Low retrieval confidence: ${retrievalConfidence.toFixed(3)}`);
      
      if (options.fallbackOnLowConfidence !== false) {
        return await this.handleLowConfidenceRetrieval(
          userQuery, 
          sessionId, 
          retrievalResult, 
          conversationContext
        );
      }
    }
    
    // Step 4: Assemble prompt with citations (using condensed content)
    const promptStartTime = Date.now();
    const promptResult = await this.promptAssembler.assembleRAGPrompt(
      userQuery,
      retrievalResult.chunks,
      conversationContext.messageHistory || [],
      {
        templateType: options.templateType,
        citationFormat: options.citationFormat || 'inline',
        queryAnalysis: retrievalResult.queryAnalysis,
        ...options.promptOptions
      }
    );
    const promptTime = Date.now() - promptStartTime;
    
    // Ensure promptResult and metadata exist before accessing properties
    const estimatedTokens = promptResult?.metadata?.estimatedTokens || 0;
    logger.info(`📝 Prompt assembled in ${promptTime}ms (~${estimatedTokens} tokens)`);
    
    // Step 4: Generate response with GPT-4
    const generationStartTime = Date.now();
    const gptResponse = await this.callOpenAIChat(promptResult?.prompt || { system: '', user: userQuery }, options);
    const generationTime = Date.now() - generationStartTime;
    
    logger.info(`🤖 GPT-4 response generated in ${generationTime}ms`);
    
    // Step 5: Extract and validate citations
    const citationStartTime = Date.now();
    const extractedCitations = await this.extractAndValidateCitations(
      gptResponse.content,
      promptResult?.citations || [],
      retrievalResult.chunks
    );
    const citationTime = Date.now() - citationStartTime;
    
    // Step 6: Calculate response confidence
    const responseConfidence = this.calculateResponseConfidence(
      retrievalConfidence,
      gptResponse,
      extractedCitations,
      retrievalResult.queryAnalysis
    );
    
    // Ensure confidence is a valid number (fix NaN issue)
    const validConfidence = isNaN(responseConfidence) ? 0.5 : responseConfidence;
    console.log('🔍 DEBUG: Response confidence:', responseConfidence, '-> valid:', validConfidence);
    
    // Step 7: Prepare final response
    const finalResponse = {
      message: gptResponse.content,
      useKnowledgeBase: true,
      confidence: validConfidence,
      confidenceLevel: this.getConfidenceLevel(validConfidence),
      
      // Citations and sources
      citations: extractedCitations.validCitations,
      sources: this.prepareSources(retrievalResult.chunks),
      retrievedChunks: retrievalResult.chunks, // Add the missing retrievedChunks field
      
      // Retrieval metadata
      retrievalMetadata: {
        strategy: retrievalResult.strategy,
        rerankingModel: retrievalResult.rerankingModel,
        chunksRetrieved: retrievalResult.chunks.length,
        retrievalConfidence: retrievalConfidence,
        retrievalTime: retrievalTime,
        queryAnalysis: retrievalResult.queryAnalysis
      },
      
      // Token optimization metadata (Phase 1 Enhanced)
      tokenOptimization: retrievalResult.tokenOptimization || {
        originalTokens: 0,
        optimizedTokens: 0,
        reductionPercentage: 0,
        processingTime: 0
      },
      
      // Phase 1 optimization metadata
      queryClassification: {
        type: options._classification?.type,
        complexity: options._classification?.complexity,
        confidence: options._classification?.confidence,
        reasoning: options._classification?.reasoning,
        tokenBudget: options._budget?.totalBudget,
        processingTime: options._classification?.processingTime
      },
      
      budgetAllocation: {
        totalBudget: options._budget?.totalBudget,
        allocation: options._budget?.allocation,
        reasoning: options._budget?.reasoning,
        utilizationRatio: retrievalResult.tokenOptimization?.optimizedTokens && options._budget?.totalBudget ? 
          (retrievalResult.tokenOptimization.optimizedTokens / options._budget.totalBudget).toFixed(3) : 0
      },
      
      // Prompt metadata
      promptMetadata: {
        templateType: promptResult?.metadata?.templateType || 'standard',
        citationFormat: promptResult?.metadata?.citationFormat || 'inline',
        estimatedTokens: promptResult?.metadata?.estimatedTokens || 0,
        promptTime: promptTime
      },
      
      // Generation metadata
      generationMetadata: {
        model: gptResponse.model,
        tokensUsed: gptResponse.usage,
        generationTime: generationTime,
        temperature: this.serviceConfig.temperature
      },
      
      // Citation metadata
      citationMetadata: {
        totalCitations: extractedCitations.totalFound,
        validCitations: extractedCitations.validCitations.length,
        invalidCitations: extractedCitations.invalidCitations.length,
        citationTime: citationTime
      },
      
      // Quality indicators
      qualityIndicators: {
        hasRelevantSources: retrievalResult.chunks.length > 0,
        citationsPresent: extractedCitations.validCitations.length > 0,
        confidenceAboveThreshold: validConfidence >= this.serviceConfig.confidenceThreshold,
        responseComplete: gptResponse.finishReason === 'stop'
      }
    };
    
    // Add warnings if needed
    if (validConfidence < this.qualityThresholds.mediumConfidence) {
      finalResponse.warnings = ['Response confidence is below recommended threshold'];
    }
    
    if (extractedCitations.invalidCitations.length > 0) {
      finalResponse.warnings = finalResponse.warnings || [];
      finalResponse.warnings.push('Some citations could not be validated');
    }
    
    return finalResponse;
  }

  /**
   * Generate standard response without knowledge base
   * @param {string} userQuery - User query
   * @param {string} sessionId - Session ID
   * @param {Object} conversationContext - Conversation context
   * @param {Object} options - Options
   * @returns {Object} Standard response
   */
  async generateStandardResponse(userQuery, sessionId, conversationContext, options) {
    logger.info('💬 Generating standard response (no knowledge base)');
    
    // Prepare conversation messages
    const messages = [
      {
        role: 'system',
        content: this.getStandardSystemPrompt()
      }
    ];
    
    // Add conversation history
    if (conversationContext.messageHistory && conversationContext.messageHistory.length > 0) {
      const recentHistory = conversationContext.messageHistory.slice(-6); // Last 6 messages
      messages.push(...recentHistory);
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      content: userQuery
    });
    
    // Generate response
    const gptResponse = await this.callOpenAIChat({ combined: messages }, options);
    
    return {
      message: gptResponse.content,
      useKnowledgeBase: false,
      confidence: 0.7, // Default confidence for standard responses
      confidenceLevel: 'medium',
      citations: [],
      sources: [],
      generationMetadata: {
        model: gptResponse.model,
        tokensUsed: gptResponse.usage,
        temperature: this.serviceConfig.temperature
      },
      qualityIndicators: {
        hasRelevantSources: false,
        citationsPresent: false,
        confidenceAboveThreshold: true,
        responseComplete: gptResponse.finishReason === 'stop'
      }
    };
  }

  /**
   * Call OpenAI Chat API
   * @param {Object} prompt - Prompt object or messages array
   * @param {Object} options - API options
   * @returns {Object} API response
   */
  async callOpenAIChat(prompt, options = {}) {
    const messages = Array.isArray(prompt.combined) ? prompt.combined : [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ];
    
    const apiOptions = {
      model: options.model || this.config.get('openai.chatModel') || 'gpt-4o',
      messages: messages,
      max_tokens: options.maxTokens || this.serviceConfig.maxTokens,
      temperature: options.temperature || this.serviceConfig.temperature,
      top_p: options.topP || this.config.get('openai.topP') || 1.0,
      frequency_penalty: options.frequencyPenalty || this.config.get('openai.frequencyPenalty') || 0.0,
      presence_penalty: options.presencePenalty || this.config.get('openai.presencePenalty') || 0.0
    };
    
    logger.info(`🌐 Calling OpenAI API: ${apiOptions.model}`);
    logger.debug('🔧 OpenAI API parameters:', {
      model: apiOptions.model,
      maxTokens: apiOptions.max_tokens,
      temperature: apiOptions.temperature,
      messageCount: apiOptions.messages.length,
      systemPromptLength: apiOptions.messages[0]?.content?.length || 0,
      userQueryLength: apiOptions.messages[apiOptions.messages.length - 1]?.content?.length || 0
    });
    
    const apiStartTime = Date.now();
    const response = await this.openai.chat.completions.create(apiOptions);
    const apiTime = Date.now() - apiStartTime;
    
    logger.debug('✅ OpenAI API response received:', {
      model: response.model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      responseTime: apiTime,
      finishReason: response.choices[0]?.finish_reason
    });
    
    return {
      content: response.choices[0].message.content,
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason
    };
  }

  /**
   * Handle low confidence retrieval
   * @param {string} userQuery - User query
   * @param {string} sessionId - Session ID
   * @param {Object} retrievalResult - Retrieval result
   * @param {Object} conversationContext - Context
   * @returns {Object} Response for low confidence
   */
  async handleLowConfidenceRetrieval(userQuery, sessionId, retrievalResult, conversationContext) {
    logger.info('🔄 Handling low confidence retrieval');
    
    const confidence = retrievalResult.metadata.confidenceScore;
    
    if (confidence < this.qualityThresholds.lowConfidence) {
      // Very low confidence - suggest clarification
      return {
        message: `I'm not finding specific information about "${userQuery}" in the Fund Management User Guides. Could you please:

1. Rephrase your question with more specific terms
2. Provide additional context about what you're looking for
3. Check if your question relates to fund creation, portfolio management, compliance, or another specific area

I'm here to help with fund management questions based on our official documentation.`,
        useKnowledgeBase: true,
        confidence: confidence,
        confidenceLevel: 'low',
        citations: [],
        sources: [],
        retrievalMetadata: retrievalResult.metadata,
        qualityIndicators: {
          hasRelevantSources: false,
          citationsPresent: false,
          confidenceAboveThreshold: false,
          responseComplete: true
        },
        suggestions: this.generateQuerySuggestions(userQuery, retrievalResult.queryAnalysis)
      };
    } else {
      // Medium-low confidence - provide partial answer with caveats
      const promptResult = await this.promptAssembler.assembleRAGPrompt(
        userQuery,
        retrievalResult.chunks,
        conversationContext.messageHistory || [],
        { templateType: 'standard' }
      );
      
      // Modify prompt to indicate uncertainty
      const uncertaintyPrompt = {
        system: (promptResult?.prompt?.system || '') + '\n\nIMPORTANT: The retrieved context may not fully address the user\'s question. If the information is incomplete or uncertain, clearly state this in your response and suggest what additional information might be needed.',
        user: promptResult?.prompt?.user || userQuery
      };
      
      const gptResponse = await this.callOpenAIChat(uncertaintyPrompt);
      const extractedCitations = await this.extractAndValidateCitations(
        gptResponse.content,
        promptResult?.citations || [],
        retrievalResult.chunks
      );
      
      return {
        message: gptResponse.content,
        useKnowledgeBase: true,
        confidence: confidence,
        confidenceLevel: 'low',
        citations: extractedCitations.validCitations,
        sources: this.prepareSources(retrievalResult.chunks),
        retrievalMetadata: retrievalResult.metadata,
        generationMetadata: {
          model: gptResponse.model,
          tokensUsed: gptResponse.usage
        },
        qualityIndicators: {
          hasRelevantSources: retrievalResult.chunks.length > 0,
          citationsPresent: extractedCitations.validCitations.length > 0,
          confidenceAboveThreshold: false,
          responseComplete: gptResponse.finishReason === 'stop'
        },
        warnings: ['Response based on limited relevant information from the knowledge base']
      };
    }
  }

  /**
   * Extract and validate citations from response
   * @param {string} responseContent - GPT response content
   * @param {Array} availableCitations - Available citations from prompt
   * @param {Array} retrievedChunks - Retrieved chunks
   * @returns {Object} Citation extraction result
   */
  async extractAndValidateCitations(responseContent, availableCitations, retrievedChunks) {
    logger.info('📋 Extracting and validating citations');
    
    // Extract citations from response using various patterns
    const citationPatterns = [
      /\(Guide [^,]+, p\.\d+\)/g,
      /\(Source: [^,]+, Page: \d+[^)]*\)/g,
      /\[[^\]]+, p\.\d+\]/g,
      /\[\d+\]/g
    ];
    
    const foundCitations = [];
    let totalFound = 0;
    
    citationPatterns.forEach(pattern => {
      const matches = responseContent.match(pattern) || [];
      foundCitations.push(...matches);
      totalFound += matches.length;
    });
    
    // Validate citations against available sources
    const validCitations = [];
    const invalidCitations = [];
    
    for (const citation of foundCitations) {
      const isValid = this.validateCitation(citation, availableCitations, retrievedChunks);
      
      if (isValid.valid) {
        validCitations.push({
          text: citation,
          source: isValid.source,
          page: isValid.page,
          chunk_id: isValid.chunk_id,
          position: responseContent.indexOf(citation)
        });
      } else {
        invalidCitations.push({
          text: citation,
          reason: isValid.reason
        });
      }
    }
    
    logger.info(`📊 Citations: ${totalFound} found, ${validCitations.length} valid, ${invalidCitations.length} invalid`);
    
    return {
      totalFound,
      validCitations,
      invalidCitations,
      citationCoverage: totalFound > 0 ? validCitations.length / totalFound : 0
    };
  }

  /**
   * Validate a single citation
   * @param {string} citation - Citation text
   * @param {Array} availableCitations - Available citations
   * @param {Array} retrievedChunks - Retrieved chunks
   * @returns {Object} Validation result
   */
  validateCitation(citation, availableCitations, retrievedChunks) {
    // Try to match against available citations
    for (const availableCitation of availableCitations) {
      if (citation.includes(availableCitation.source) && 
          citation.includes(availableCitation.page.toString())) {
        return {
          valid: true,
          source: availableCitation.source,
          page: availableCitation.page,
          chunk_id: availableCitation.chunk_id
        };
      }
    }
    
    // Try to match against chunk information
    for (const chunk of retrievedChunks) {
      const sourceName = chunk.citation?.source || chunk.filename;
      const pageNumber = chunk.citation?.page || chunk.page_number;
      
      if (citation.includes(sourceName) && citation.includes(pageNumber?.toString())) {
        return {
          valid: true,
          source: sourceName,
          page: pageNumber,
          chunk_id: chunk.chunk_id
        };
      }
    }
    
    return {
      valid: false,
      reason: 'Citation does not match any retrieved sources'
    };
  }

  /**
   * Calculate response confidence score
   * @param {number} retrievalConfidence - Retrieval confidence
   * @param {Object} gptResponse - GPT response
   * @param {Object} extractedCitations - Extracted citations
   * @param {Object} queryAnalysis - Query analysis
   * @returns {number} Response confidence (0-1)
   */
  calculateResponseConfidence(retrievalConfidence, gptResponse, extractedCitations, queryAnalysis) {
    let confidence = retrievalConfidence * 0.6; // Base on retrieval confidence
    
    // Boost for proper citations
    if (extractedCitations.validCitations.length > 0) {
      confidence += 0.2 * Math.min(extractedCitations.citationCoverage, 1);
    }
    
    // Boost for complete response
    if (gptResponse.finishReason === 'stop') {
      confidence += 0.1;
    }
    
    // Adjust based on query complexity
    if (queryAnalysis?.complexity === 'simple') {
      confidence += 0.05;
    } else if (queryAnalysis?.complexity === 'complex') {
      confidence -= 0.05;
    }
    
    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get confidence level description
   * @param {number} confidence - Confidence score
   * @returns {string} Confidence level
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.qualityThresholds.highConfidence) return 'high';
    if (confidence >= this.qualityThresholds.mediumConfidence) return 'medium';
    if (confidence >= this.qualityThresholds.lowConfidence) return 'low';
    return 'very_low';
  }

  /**
   * Prepare sources for response
   * @param {Array} retrievedChunks - Retrieved chunks
   * @returns {Array} Prepared sources
   */
  prepareSources(retrievedChunks) {
    const sources = [];
    const seenSources = new Set();
    
    retrievedChunks.forEach(chunk => {
      const sourceKey = `${chunk.citation?.source || chunk.filename}_${chunk.citation?.page || chunk.page_number}`;
      
      if (!seenSources.has(sourceKey)) {
        seenSources.add(sourceKey);
        sources.push({
          title: chunk.citation?.source || chunk.filename,
          page: chunk.citation?.page || chunk.page_number,
          section: chunk.citation?.section || chunk.heading,
          relevance_score: chunk.relevance_score || chunk.similarity_score,
          content_type: chunk.content_type,
          chunk_id: chunk.chunk_id
        });
      }
    });
    
    return sources.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  }

  /**
   * Generate query suggestions for low confidence scenarios
   * @param {string} originalQuery - Original query
   * @param {Object} queryAnalysis - Query analysis
   * @returns {Array} Query suggestions
   */
  generateQuerySuggestions(originalQuery, queryAnalysis) {
    const suggestions = [];
    
    // Add domain-specific suggestions
    if (queryAnalysis?.entities?.length === 0) {
      suggestions.push('Try including specific fund management terms like "NAV", "portfolio", "compliance", or "rollforward"');
    }
    
    if (queryAnalysis?.queryType === 'general') {
      suggestions.push('Be more specific about what aspect of fund management you\'re asking about');
    }
    
    // Add common topic suggestions
    suggestions.push('Ask about fund creation steps');
    suggestions.push('Ask about compliance requirements');
    suggestions.push('Ask about portfolio management procedures');
    suggestions.push('Ask about NAV calculation methods');
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Get conversation context
   * @param {string} sessionId - Session ID
   * @param {Object} options - Options
   * @returns {Object} Conversation context
   */
  async getConversationContext(sessionId, options = {}) {
    try {
      // If no database is available, return empty context
      if (!this.db) {
        logger.debug('📝 No database available for conversation context');
        return {
          messageHistory: [],
          messageCount: 0,
          previousTopics: [],
          currentTopic: null
        };
      }
      
      const result = await this.db.query(`
        SELECT messages, message_count, last_activity, metadata
        FROM conversations 
        WHERE session_id = $1
      `, [sessionId]);
      
      if (result.rows.length === 0) {
        return {
          messageHistory: [],
          messageCount: 0,
          previousTopics: [],
          currentTopic: null
        };
      }
      
      const conversation = result.rows[0];
      const messages = typeof conversation.messages === 'string' 
        ? JSON.parse(conversation.messages) 
        : conversation.messages;
      
      // Extract topics from recent messages
      const recentMessages = messages.slice(-10);
      const previousTopics = this.extractTopicsFromMessages(recentMessages);
      
      return {
        messageHistory: messages,
        messageCount: conversation.message_count,
        lastActivity: conversation.last_activity,
        previousTopics: previousTopics,
        currentTopic: previousTopics[previousTopics.length - 1] || null,
        metadata: conversation.metadata
      };
    } catch (error) {
      logger.warn('⚠️ Failed to get conversation context:', error.message);
      return {
        messageHistory: [],
        messageCount: 0,
        previousTopics: [],
        currentTopic: null
      };
    }
  }

  /**
   * Extract topics from messages
   * @param {Array} messages - Message array
   * @returns {Array} Extracted topics
   */
  extractTopicsFromMessages(messages) {
    const topics = [];
    const fundTerms = [
      'fund creation', 'portfolio', 'nav', 'compliance', 'audit', 'rollforward',
      'hierarchy', 'valuation', 'performance', 'risk management', 'asset allocation'
    ];
    
    messages.forEach(message => {
      if (message.role === 'user') {
        const content = message.content.toLowerCase();
        fundTerms.forEach(term => {
          if (content.includes(term) && !topics.includes(term)) {
            topics.push(term);
          }
        });
      }
    });
    
    return topics;
  }

  /**
   * Store conversation turn
   * @param {string} sessionId - Session ID
   * @param {string} userQuery - User query
   * @param {Object} response - Generated response
   */
  async storeConversationTurn(sessionId, userQuery, response) {
    try {
      if (!this.db) {
        logger.debug('📝 Skipping conversation storage - database not available');
        return;
      }
      
      const userMessage = {
        role: 'user',
        content: userQuery,
        timestamp: new Date().toISOString()
      };
      
      const assistantMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        metadata: {
          useKnowledgeBase: response.useKnowledgeBase,
          confidence: response.confidence,
          citationCount: response.citations?.length || 0
        }
      };
      
      await this.db.query(`
        INSERT INTO conversations (session_id, messages, message_count, last_activity, metadata)
        VALUES ($1, $2, 2, NOW(), $3)
        ON CONFLICT (session_id) DO UPDATE SET
          messages = conversations.messages || $2,
          message_count = conversations.message_count + 2,
          last_activity = NOW(),
          updated_at = NOW()
      `, [
        sessionId,
        JSON.stringify([userMessage, assistantMessage]),
        JSON.stringify({ lastResponseType: response.useKnowledgeBase ? 'rag' : 'standard' })
      ]);
      
    } catch (error) {
      logger.warn('⚠️ Failed to store conversation turn:', error.message);
    }
  }

  /**
   * Log interaction for audit
   * @param {string} sessionId - Session ID
   * @param {string} userQuery - User query
   * @param {Object} response - Generated response
   * @param {number} processingTime - Processing time in ms
   */
  async logInteraction(sessionId, userQuery, response, processingTime) {
    try {
      if (!this.db) {
        logger.debug('📝 Skipping audit logging - database not available');
        return;
      }
      
      await this.db.query(`
        INSERT INTO audit_logs (
          session_id, interaction_type, user_query, retrieved_chunks, citations,
          final_response, model_version, embedding_model, prompt_template_version,
          response_time_ms, confidence_score, token_usage, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        sessionId,
        'rag_query',
        userQuery,
        JSON.stringify(response.sources || []),
        JSON.stringify(response.citations || []),
        response.message,
        response.generationMetadata?.model || 'gpt-4',
        this.config.get('openai.embeddingModel'),
        '2.0',
        processingTime,
        response.confidence,
        JSON.stringify(response.generationMetadata?.tokensUsed || {}),
        JSON.stringify({
          useKnowledgeBase: response.useKnowledgeBase,
          confidenceLevel: response.confidenceLevel,
          retrievalStrategy: response.retrievalMetadata?.strategy,
          templateType: response.promptMetadata?.templateType
        })
      ]);
      
    } catch (error) {
      logger.warn('⚠️ Failed to log interaction:', error.message);
    }
  }

  /**
   * Log error for audit
   * @param {string} sessionId - Session ID
   * @param {string} userQuery - User query
   * @param {Error} error - Error object
   * @param {number} processingTime - Processing time in ms
   */
  async logError(sessionId, userQuery, error, processingTime) {
    try {
      if (!this.db) {
        logger.debug('📝 Skipping error logging - database not available');
        return;
      }
      
      await this.db.query(`
        INSERT INTO audit_logs (
          session_id, interaction_type, user_query, final_response,
          response_time_ms, error_details, metadata, model_version,
          embedding_model, prompt_template_version, retrieved_chunks, citations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        sessionId,
        'rag_error',
        userQuery,
        'Error occurred during response generation',
        processingTime,
        JSON.stringify({
          error: error.message,
          stack: error.stack,
          name: error.name
        }),
        JSON.stringify({ errorType: 'rag_generation_error' }),
        'gpt-4', // Default model version for error cases
        this.config.get('openai.embeddingModel') || 'text-embedding-3-large',
        '2.0', // Default prompt template version
        JSON.stringify([]), // Empty retrieved chunks for error cases
        JSON.stringify([]) // Empty citations for error cases
      ]);
      
    } catch (logError) {
      logger.error('❌ Failed to log error:', logError.message);
    }
  }

  /**
   * Generate fallback response for errors
   * @param {string} userQuery - User query
   * @param {string} sessionId - Session ID
   * @param {Error} error - Original error
   * @returns {Object} Fallback response
   */
  generateFallbackResponse(userQuery, sessionId, error) {
    logger.info('🔄 Generating fallback response due to error');
    
    return {
      message: `I apologize, but I'm experiencing technical difficulties processing your request about "${userQuery}". Please try again in a moment, or rephrase your question. If the issue persists, please contact support.`,
      useKnowledgeBase: false,
      confidence: 0.1,
      confidenceLevel: 'very_low',
      citations: [],
      sources: [],
      error: {
        occurred: true,
        type: error.name,
        message: error.message
      },
      qualityIndicators: {
        hasRelevantSources: false,
        citationsPresent: false,
        confidenceAboveThreshold: false,
        responseComplete: true
      },
      sessionId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get standard system prompt for non-RAG responses
   * @returns {string} System prompt
   */
  getStandardSystemPrompt() {
    return `You are an intelligent assistant for a Fund Management system. Your role is to guide users through fund management processes and answer questions about investment fund operations.

You should provide helpful, accurate information about:
- Fund creation and setup processes
- Portfolio management principles
- Compliance and regulatory requirements
- NAV calculation and valuation
- Risk management practices
- Reporting and analytics

Always maintain a professional tone and provide practical, actionable guidance. If you're unsure about specific regulatory requirements or technical details, recommend consulting with compliance teams or official documentation.`;
  }

  /**
   * Test RAG chat service
   * @param {string} testQuery - Test query
   * @param {string} testSessionId - Test session ID
   * @returns {Object} Test results
   */
  async testService(testQuery = 'How do I create a new fund?', testSessionId = 'test-session') {
    try {
      logger.info(`🧪 Testing RAG chat service with query: "${testQuery}"`);
      
      const startTime = Date.now();
      const response = await this.generateResponse(testQuery, testSessionId, {
        maxChunks: 3
      });
      const totalTime = Date.now() - startTime;
      
      const testResults = {
        success: true,
        query: testQuery,
        sessionId: testSessionId,
        processingTime: totalTime,
        useKnowledgeBase: response.useKnowledgeBase,
        confidence: response.confidence,
        confidenceLevel: response.confidenceLevel,
        citationCount: response.citations?.length || 0,
        sourceCount: response.sources?.length || 0,
        responseLength: response.message?.length || 0,
        qualityIndicators: response.qualityIndicators,
        retrievalStrategy: response.retrievalMetadata?.strategy,
        model: response.generationMetadata?.model,
        tokensUsed: response.generationMetadata?.tokensUsed?.total_tokens || 0
      };
      
      logger.info(`✅ RAG service test completed: ${response.useKnowledgeBase ? 'RAG' : 'Standard'} response in ${totalTime}ms`);
      
      return testResults;
    } catch (error) {
      logger.error('❌ RAG service test failed:', error);
      return {
        success: false,
        error: error.message,
        query: testQuery,
        sessionId: testSessionId
      };
    }
  }

  /**
   * Check if query is a system/health check query that shouldn't consume tokens
   * @param {string} userQuery - User query
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if system query
   */
  isSystemQuery(userQuery, sessionId) {
    const systemKeywords = [
      'health check',
      'system status',
      'service test',
      'ping',
      'status check',
      'health test'
    ];
    
    const systemSessionPatterns = [
      'health-test-session',
      'system-test',
      'health-check',
      'status-check'
    ];
    
    const queryLower = userQuery.toLowerCase();
    const isSystemKeyword = systemKeywords.some(keyword => queryLower.includes(keyword));
    const isSystemSession = systemSessionPatterns.some(pattern => sessionId.includes(pattern));
    
    return isSystemKeyword || isSystemSession;
  }

  /**
   * Generate system response without consuming tokens
   * @param {string} userQuery - User query
   * @param {string} sessionId - Session ID
   * @param {Object} classification - Query classification result
   * @returns {Object} System response
   */
  async generateSystemResponse(userQuery, sessionId, classification) {
    const stats = await this.getServiceStats();
    
    // Generate appropriate system response based on query
    let message;
    const queryLower = userQuery.toLowerCase();
    
    if (queryLower.includes('health') || queryLower.includes('status')) {
      message = `System Health: ${stats.ragEnabled ? '✅ Operational' : '⚠️ Limited'}. OpenAI: ${stats.openaiConfigured ? '✅ Connected' : '❌ Disconnected'}. Database: ${stats.databaseConfigured ? '✅ Connected' : '❌ Disconnected'}.`;
    } else if (queryLower === 'ping') {
      message = 'pong';
    } else if (queryLower === 'test') {
      message = 'System test successful';
    } else {
      message = `System operational. Query classified as: ${classification.reasoning}`;
    }
    
    return {
      message: message,
      useKnowledgeBase: false,
      confidence: 1.0,
      confidenceLevel: 'system',
      sources: [],
      citations: [],
      systemResponse: true,
      tokenUsage: { total: 0, prompt: 0, completion: 0 },
      
      // Phase 1 optimization metadata
      queryClassification: {
        type: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        processingTime: classification.processingTime
      },
      
      tokenOptimization: {
        originalTokens: 0,
        optimizedTokens: 0,
        reductionPercentage: 100,
        processingTime: 0,
        systemBypass: true
      },
      
      qualityIndicators: {
        hasRelevantSources: false,
        citationsPresent: false,
        confidenceAboveThreshold: true,
        responseComplete: true
      },
      
      processingMetadata: {
        totalTime: classification.processingTime || 0,
        systemQuery: true,
        tokensUsed: 0,
        classification: classification.type,
        optimizationApplied: true
      }
    };
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  async getServiceStats() {
    try {
      // Check if OpenAI is available
      if (!this.openai) {
        return {
          openaiConfigured: false,
          databaseConfigured: this.db ? true : false,
          ragEnabled: false,
          environment: this.config.get('app.environment'),
          fallbackMode: true
        };
      }
      
      // Initialize database if needed
      if (!this.db) {
        try {
          await this.initializeDatabase();
        } catch (dbError) {
          logger.warn('⚠️ Database not available for service stats:', dbError.message);
          return {
            openaiConfigured: true,
            databaseConfigured: false,
            ragEnabled: false,
            environment: this.config.get('app.environment'),
            fallbackMode: true,
            databaseError: dbError.message
          };
        }
      }
      
      const stats = await this.db.query(`
        SELECT 
          COUNT(*) as total_interactions,
          COUNT(*) FILTER (WHERE interaction_type = 'rag_query') as rag_interactions,
          COUNT(*) FILTER (WHERE interaction_type = 'rag_error') as error_interactions,
          AVG(response_time_ms) as avg_response_time,
          AVG(confidence_score) as avg_confidence,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_interactions
        FROM audit_logs
        WHERE interaction_type IN ('rag_query', 'rag_error')
      `);
      
      const conversationStats = await this.db.query(`
        SELECT 
          COUNT(*) as total_conversations,
          AVG(message_count) as avg_messages_per_conversation,
          COUNT(*) FILTER (WHERE last_activity > NOW() - INTERVAL '24 hours') as active_conversations
        FROM conversations
      `);
      
      return {
        // Health check fields (required by health endpoint)
        openaiConfigured: !!this.openai,
        databaseConfigured: !!this.db,
        ragEnabled: !!(this.openai && this.db),
        environment: this.config.get('app.environment'),
        fallbackMode: false,
        
        // Detailed statistics
        interactions: {
          total: parseInt(stats.rows[0].total_interactions),
          rag: parseInt(stats.rows[0].rag_interactions),
          errors: parseInt(stats.rows[0].error_interactions),
          recent: parseInt(stats.rows[0].recent_interactions)
        },
        performance: {
          averageResponseTime: parseFloat(stats.rows[0].avg_response_time) || 0,
          averageConfidence: parseFloat(stats.rows[0].avg_confidence) || 0
        },
        conversations: {
          total: parseInt(conversationStats.rows[0].total_conversations),
          averageLength: parseFloat(conversationStats.rows[0].avg_messages_per_conversation) || 0,
          active: parseInt(conversationStats.rows[0].active_conversations)
        },
        serviceConfig: this.serviceConfig,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Failed to get service stats:', error.message);
      logger.error('❌ Service stats error stack:', error.stack);
      logger.error('❌ Service stats error details:', {
        name: error.name,
        code: error.code,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint
      });
      return {
        // Health check fields (required by health endpoint)
        openaiConfigured: !!this.openai,
        databaseConfigured: !!this.db,
        ragEnabled: false, // Set to false due to error
        environment: this.config.get('app.environment'),
        fallbackMode: true,
        
        // Error details
        error: error.message,
        errorType: error.name || 'UnknownError',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = RAGChatService;
