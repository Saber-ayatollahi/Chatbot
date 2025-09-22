/**
 * Confidence Manager Module
 * Advanced confidence scoring and fallback mechanisms for RAG responses
 * Phase 2: Retrieval & Prompting System
 */

const { getConfig } = require('../config/environment');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

class ConfidenceManager {
  constructor() {
    this.config = getConfig();
    this.db = null;
    
    // Confidence thresholds
    this.thresholds = {
      high: this.config.get('rag.confidence.highThreshold') || 0.8,
      medium: this.config.get('rag.confidence.mediumThreshold') || 0.6,
      low: this.config.get('rag.confidence.lowThreshold') || 0.4,
      minimum: this.config.get('rag.confidence.minimumThreshold') || 0.2
    };
    
    // Confidence factors and weights
    this.confidenceFactors = {
      retrieval: {
        weight: 0.35,
        factors: {
          topSimilarity: 0.4,
          averageSimilarity: 0.2,
          chunkCount: 0.15,
          sourceQuality: 0.15,
          diversityScore: 0.1
        }
      },
      content: {
        weight: 0.25,
        factors: {
          citationPresence: 0.3,
          citationAccuracy: 0.3,
          responseCompleteness: 0.2,
          coherenceScore: 0.2
        }
      },
      context: {
        weight: 0.2,
        factors: {
          queryClarity: 0.3,
          queryComplexity: 0.2,
          domainRelevance: 0.3,
          conversationContext: 0.2
        }
      },
      generation: {
        weight: 0.2,
        factors: {
          modelConfidence: 0.4,
          responseLength: 0.2,
          finishReason: 0.2,
          tokenUtilization: 0.2
        }
      }
    };
    
    // Fallback strategies
    this.fallbackStrategies = {
      'low_retrieval_confidence': this.handleLowRetrievalConfidence.bind(this),
      'no_relevant_sources': this.handleNoRelevantSources.bind(this),
      'poor_citation_quality': this.handlePoorCitationQuality.bind(this),
      'incomplete_response': this.handleIncompleteResponse.bind(this),
      'query_ambiguity': this.handleQueryAmbiguity.bind(this),
      'system_error': this.handleSystemError.bind(this)
    };
    
    // Response quality indicators
    this.qualityIndicators = {
      'excellent': { min: 0.9, description: 'Highly confident, comprehensive answer with strong citations' },
      'good': { min: 0.75, description: 'Good confidence with reliable sources and citations' },
      'acceptable': { min: 0.6, description: 'Acceptable answer with some uncertainty or limited sources' },
      'uncertain': { min: 0.4, description: 'Uncertain answer, may require clarification or additional sources' },
      'poor': { min: 0.2, description: 'Poor confidence, significant limitations in available information' },
      'unreliable': { min: 0, description: 'Unreliable answer, recommend seeking alternative sources' }
    };
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    if (!this.db) {
      this.db = getDatabase();
      if (!this.db.isReady()) {
        await this.db.initialize();
      }
    }
  }

  /**
   * Calculate comprehensive confidence score
   * @param {Object} retrievalData - Retrieval results and metadata
   * @param {Object} contentData - Content analysis data
   * @param {Object} contextData - Query and conversation context
   * @param {Object} generationData - Generation metadata
   * @returns {Object} Comprehensive confidence assessment
   */
  async calculateConfidence(retrievalData, contentData, contextData, generationData) {
    try {
      logger.info('🎯 Calculating comprehensive confidence score');
      
      const startTime = performance.now();
      
      // Calculate individual confidence components
      const retrievalConfidence = this.calculateRetrievalConfidence(retrievalData);
      const contentConfidence = this.calculateContentConfidence(contentData);
      const contextConfidence = this.calculateContextConfidence(contextData);
      const generationConfidence = this.calculateGenerationConfidence(generationData);
      
      // Calculate weighted overall confidence
      const overallConfidence = 
        retrievalConfidence.score * this.confidenceFactors.retrieval.weight +
        contentConfidence.score * this.confidenceFactors.content.weight +
        contextConfidence.score * this.confidenceFactors.context.weight +
        generationConfidence.score * this.confidenceFactors.generation.weight;
      
      // Determine confidence level and quality indicator
      const confidenceLevel = this.getConfidenceLevel(overallConfidence);
      const qualityIndicator = this.getQualityIndicator(overallConfidence);
      
      // Identify potential issues and fallback strategies
      const issues = this.identifyConfidenceIssues({
        retrieval: retrievalConfidence,
        content: contentConfidence,
        context: contextConfidence,
        generation: generationConfidence,
        overall: overallConfidence
      });
      
      // Calculate reliability metrics
      const reliabilityMetrics = this.calculateReliabilityMetrics({
        retrievalData,
        contentData,
        contextData,
        generationData,
        overallConfidence
      });
      
      const processingTime = performance.now() - startTime;
      
      const confidenceAssessment = {
        overallConfidence,
        confidenceLevel,
        qualityIndicator,
        
        // Component scores
        components: {
          retrieval: retrievalConfidence,
          content: contentConfidence,
          context: contextConfidence,
          generation: generationConfidence
        },
        
        // Issues and recommendations
        issues,
        recommendedActions: this.getRecommendedActions(issues, overallConfidence),
        fallbackStrategies: this.identifyFallbackStrategies(issues),
        
        // Reliability metrics
        reliability: reliabilityMetrics,
        
        // Metadata
        metadata: {
          calculationTime: processingTime,
          timestamp: new Date().toISOString(),
          thresholds: this.thresholds,
          weights: this.confidenceFactors
        }
      };
      
      logger.info(`✅ Confidence calculated: ${overallConfidence.toFixed(3)} (${confidenceLevel}) in ${processingTime}ms`);
      
      return confidenceAssessment;
    } catch (error) {
      logger.error('❌ Confidence calculation failed:', error);
      throw new Error(`Confidence calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate retrieval confidence
   * @param {Object} retrievalData - Retrieval data
   * @returns {Object} Retrieval confidence assessment
   */
  calculateRetrievalConfidence(retrievalData) {
    const factors = this.confidenceFactors.retrieval.factors;
    let score = 0;
    const details = {};
    
    // Validate input data
    if (!retrievalData || typeof retrievalData !== 'object') {
      logger.warn('⚠️ Invalid retrievalData provided to confidence calculation');
      return { score: 0, details: { error: 'Invalid retrievalData' }, issues: ['Invalid input data'] };
    }
    
    // Ensure chunks is a valid array and track if chunks were explicitly provided
    const chunksExplicitlyProvided = retrievalData.hasOwnProperty('chunks');
    const chunks = Array.isArray(retrievalData.chunks) ? retrievalData.chunks : [];
    
    // Top similarity score with proper validation
    const topChunk = chunks[0];
    const topSimilarity = (topChunk && typeof topChunk.similarity_score === 'number' && !isNaN(topChunk.similarity_score)) 
      ? topChunk.similarity_score 
      : 0;
    details.topSimilarity = topSimilarity;
    score += topSimilarity * factors.topSimilarity;
    
    // Average similarity across chunks with null safety
    const validChunks = chunks.filter(chunk => 
      chunk && 
      typeof chunk.similarity_score === 'number' && 
      !isNaN(chunk.similarity_score)
    );
    
    const avgSimilarity = validChunks.length > 0 
      ? validChunks.reduce((sum, chunk) => sum + chunk.similarity_score, 0) / validChunks.length
      : 0;
    details.averageSimilarity = avgSimilarity;
    score += avgSimilarity * factors.averageSimilarity;
    
    // Chunk count factor (more chunks can indicate better coverage)
    const chunkCountScore = Math.min(chunks.length / 5, 1); // Normalize to 5 chunks
    details.chunkCount = chunkCountScore;
    score += chunkCountScore * factors.chunkCount;
    
    // Source quality (based on chunk quality scores) with null safety
    const chunksWithQuality = chunks.filter(chunk => 
      chunk && 
      typeof chunk.quality_score === 'number' && 
      !isNaN(chunk.quality_score)
    );
    
    const avgQuality = chunksWithQuality.length > 0
      ? chunksWithQuality.reduce((sum, chunk) => sum + chunk.quality_score, 0) / chunksWithQuality.length
      : (chunksExplicitlyProvided && chunks.length === 0) ? 0 : 0.5; // 0 for explicit empty array, 0.5 for missing chunks
    details.sourceQuality = avgQuality;
    score += avgQuality * factors.sourceQuality;
    
    // Diversity score (different sources/sections) with null safety
    const sourcesSet = new Set();
    chunks.forEach(chunk => {
      if (chunk) {
        const source = chunk.citation?.source || chunk.filename || chunk.source_title || 'unknown';
        if (source && source !== 'unknown') {
          sourcesSet.add(source);
        }
      }
    });
    
    const diversityScore = Math.min(sourcesSet.size / 3, 1); // Normalize to 3 sources
    details.diversityScore = diversityScore;
    score += diversityScore * factors.diversityScore;
    
    return {
      score: Math.min(score, 1),
      details,
      issues: this.identifyRetrievalIssues(details, chunks)
    };
  }

  /**
   * Calculate content confidence
   * @param {Object} contentData - Content analysis data
   * @returns {Object} Content confidence assessment
   */
  calculateContentConfidence(contentData) {
    const factors = this.confidenceFactors.content.factors;
    let score = 0;
    const details = {};
    
    // Validate input data
    if (!contentData || typeof contentData !== 'object') {
      logger.warn('⚠️ Invalid contentData provided to confidence calculation');
      return { score: 0, details: { error: 'Invalid contentData' }, issues: ['Invalid input data'] };
    }
    
    // Citation presence with null safety
    const citations = Array.isArray(contentData.citations) ? contentData.citations : [];
    const citationCount = citations.length;
    const citationPresence = Math.min(citationCount / 3, 1); // Normalize to 3 citations
    details.citationPresence = citationPresence;
    score += citationPresence * factors.citationPresence;
    
    // Citation accuracy with null safety
    const validCitations = citations.filter(c => 
      c && 
      typeof c === 'object' && 
      c.isValid === true
    ).length;
    
    const citationAccuracy = citationCount > 0 ? validCitations / citationCount : 0;
    details.citationAccuracy = citationAccuracy;
    score += citationAccuracy * factors.citationAccuracy;
    
    // Response completeness (based on response length) with null safety
    const response = contentData.response;
    const responseLength = (typeof response === 'string') ? response.length : 0;
    const completeness = Math.min(responseLength / 500, 1); // Normalize to 500 chars
    details.responseCompleteness = completeness;
    score += completeness * factors.responseCompleteness;
    
    // Coherence score (simple heuristic based on sentence structure) with null safety
    const responseText = (typeof response === 'string') ? response : '';
    const coherenceScore = this.calculateCoherenceScore(responseText);
    details.coherenceScore = coherenceScore;
    score += coherenceScore * factors.coherenceScore;
    
    return {
      score: Math.min(score, 1),
      details,
      issues: this.identifyContentIssues(details, contentData)
    };
  }

  /**
   * Calculate context confidence
   * @param {Object} contextData - Context data
   * @returns {Object} Context confidence assessment
   */
  calculateContextConfidence(contextData) {
    const factors = this.confidenceFactors.context.factors;
    let score = 0;
    const details = {};
    
    // Query clarity (based on query analysis)
    const queryAnalysis = contextData?.queryAnalysis || {};
    const clarityScore = this.calculateQueryClarity(queryAnalysis);
    details.queryClarity = clarityScore;
    score += clarityScore * factors.queryClarity;
    
    // Query complexity (simpler queries generally have higher confidence)
    const complexityScore = queryAnalysis.complexity === 'simple' ? 1 : 
                           queryAnalysis.complexity === 'moderate' ? 0.7 : 0.5;
    details.queryComplexity = complexityScore;
    score += complexityScore * factors.queryComplexity;
    
    // Domain relevance (fund management terms and entities)
    const domainRelevance = this.calculateDomainRelevance(queryAnalysis);
    details.domainRelevance = domainRelevance;
    score += domainRelevance * factors.domainRelevance;
    
    // Conversation context (previous interactions can help)
    const conversationScore = contextData?.conversationHistory?.length > 0 ? 0.8 : 0.5;
    details.conversationContext = conversationScore;
    score += conversationScore * factors.conversationContext;
    
    return {
      score: Math.min(score, 1),
      details,
      issues: this.identifyContextIssues(details, contextData)
    };
  }

  /**
   * Calculate generation confidence
   * @param {Object} generationData - Generation metadata
   * @returns {Object} Generation confidence assessment
   */
  calculateGenerationConfidence(generationData) {
    const factors = this.confidenceFactors.generation.factors;
    let score = 0;
    const details = {};
    
    // Model confidence (based on model type and parameters)
    const modelConfidence = this.calculateModelConfidence(generationData);
    details.modelConfidence = modelConfidence;
    score += modelConfidence * factors.modelConfidence;
    
    // Response length appropriateness
    const responseLength = generationData?.responseLength || 0;
    const lengthScore = responseLength > 50 && responseLength < 2000 ? 1 : 0.7;
    details.responseLength = lengthScore;
    score += lengthScore * factors.responseLength;
    
    // Finish reason (complete responses are better)
    const finishReason = generationData?.finishReason || 'unknown';
    const finishScore = finishReason === 'stop' ? 1 : 
                       finishReason === 'length' ? 0.7 : 0.5;
    details.finishReason = finishScore;
    score += finishScore * factors.finishReason;
    
    // Token utilization efficiency
    const tokenUsage = generationData?.tokensUsed || {};
    const utilizationScore = this.calculateTokenUtilization(tokenUsage);
    details.tokenUtilization = utilizationScore;
    score += utilizationScore * factors.tokenUtilization;
    
    return {
      score: Math.min(score, 1),
      details,
      issues: this.identifyGenerationIssues(details, generationData)
    };
  }

  /**
   * Calculate query clarity score
   * @param {Object} queryAnalysis - Query analysis
   * @returns {number} Clarity score
   */
  calculateQueryClarity(queryAnalysis) {
    let clarity = 0.5; // Base score
    
    // Boost for specific question words
    if (queryAnalysis.hasQuestionWords) clarity += 0.2;
    
    // Boost for clear intent
    if (queryAnalysis.intent && queryAnalysis.intent.length > 0) clarity += 0.2;
    
    // Boost for domain entities
    if (queryAnalysis.entities && queryAnalysis.entities.length > 0) clarity += 0.1;
    
    // Penalty for very short or very long queries
    const wordCount = queryAnalysis.wordCount || 0;
    if (wordCount < 3 || wordCount > 30) clarity -= 0.1;
    
    return Math.max(0, Math.min(1, clarity));
  }

  /**
   * Calculate domain relevance score
   * @param {Object} queryAnalysis - Query analysis
   * @returns {number} Domain relevance score
   */
  calculateDomainRelevance(queryAnalysis) {
    const fundTerms = [
      'fund', 'portfolio', 'nav', 'investment', 'asset', 'security',
      'compliance', 'audit', 'rollforward', 'hierarchy', 'valuation',
      'performance', 'risk', 'allocation', 'manager'
    ];
    
    const entities = queryAnalysis.entities || [];
    const keywords = queryAnalysis.keywords || [];
    
    const relevantTerms = [...entities, ...keywords].filter(term =>
      fundTerms.some(fundTerm => term.toLowerCase().includes(fundTerm))
    );
    
    return Math.min(relevantTerms.length / 3, 1); // Normalize to 3 terms
  }

  /**
   * Calculate model confidence
   * @param {Object} generationData - Generation data
   * @returns {number} Model confidence score
   */
  calculateModelConfidence(generationData) {
    const model = generationData?.model || '';
    const temperature = generationData?.temperature || 0.3;
    
    let confidence = 0.7; // Base confidence
    
    // Boost for GPT-4 models
    if (model.includes('gpt-4')) confidence += 0.2;
    
    // Adjust for temperature (lower temperature = higher confidence)
    confidence += (1 - temperature) * 0.1;
    
    return Math.min(confidence, 1);
  }

  /**
   * Calculate token utilization score
   * @param {Object} tokenUsage - Token usage data
   * @returns {number} Utilization score
   */
  calculateTokenUtilization(tokenUsage) {
    const promptTokens = tokenUsage.prompt_tokens || 0;
    const completionTokens = tokenUsage.completion_tokens || 0;
    const totalTokens = tokenUsage.total_tokens || promptTokens + completionTokens;
    
    if (totalTokens === 0) return 0.5;
    
    // Good utilization is when completion tokens are reasonable relative to prompt
    const ratio = completionTokens / promptTokens;
    
    if (ratio > 0.1 && ratio < 2) return 1; // Good ratio
    if (ratio > 0.05 && ratio < 3) return 0.8; // Acceptable ratio
    return 0.6; // Poor ratio
  }

  /**
   * Calculate coherence score for text
   * @param {string} text - Text to analyze
   * @returns {number} Coherence score
   */
  calculateCoherenceScore(text) {
    if (!text || text.length < 10) return 0;
    
    let score = 0.5; // Base score
    
    // Check for proper sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length > 0) score += 0.2;
    
    // Check for transition words
    const transitionWords = ['however', 'therefore', 'additionally', 'furthermore', 'moreover', 'consequently'];
    const hasTransitions = transitionWords.some(word => text.toLowerCase().includes(word));
    if (hasTransitions) score += 0.1;
    
    // Check for consistent terminology
    const fundTerms = ['fund', 'portfolio', 'nav', 'investment'];
    const termCount = fundTerms.filter(term => text.toLowerCase().includes(term)).length;
    if (termCount > 1) score += 0.1;
    
    // Penalty for very repetitive text
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) score -= 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get confidence level description
   * @param {number} confidence - Confidence score
   * @returns {string} Confidence level
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.thresholds.high) return 'high';
    if (confidence >= this.thresholds.medium) return 'medium';
    if (confidence >= this.thresholds.low) return 'low';
    return 'very_low';
  }

  /**
   * Get quality indicator
   * @param {number} confidence - Confidence score
   * @returns {Object} Quality indicator
   */
  getQualityIndicator(confidence) {
    for (const [level, indicator] of Object.entries(this.qualityIndicators)) {
      if (confidence >= indicator.min) {
        return {
          level,
          description: indicator.description,
          score: confidence
        };
      }
    }
    
    return {
      level: 'unreliable',
      description: this.qualityIndicators.unreliable.description,
      score: confidence
    };
  }

  /**
   * Identify confidence issues
   * @param {Object} confidenceData - All confidence data
   * @returns {Array} Identified issues
   */
  identifyConfidenceIssues(confidenceData) {
    const issues = [];
    
    // Check retrieval issues
    if (confidenceData.retrieval.score < this.thresholds.medium) {
      issues.push({
        type: 'low_retrieval_confidence',
        severity: 'medium',
        description: 'Retrieved sources have low relevance to the query',
        component: 'retrieval',
        score: confidenceData.retrieval.score
      });
    }
    
    // Check content issues
    if (confidenceData.content.details.citationAccuracy < 0.7) {
      issues.push({
        type: 'poor_citation_quality',
        severity: 'medium',
        description: 'Citations are missing or inaccurate',
        component: 'content',
        score: confidenceData.content.details.citationAccuracy
      });
    }
    
    // Check context issues
    if (confidenceData.context.details.queryClarity < 0.5) {
      issues.push({
        type: 'query_ambiguity',
        severity: 'low',
        description: 'Query is unclear or ambiguous',
        component: 'context',
        score: confidenceData.context.details.queryClarity
      });
    }
    
    // Check generation issues
    if (confidenceData.generation.details.finishReason < 0.8) {
      issues.push({
        type: 'incomplete_response',
        severity: 'medium',
        description: 'Response may be incomplete or truncated',
        component: 'generation',
        score: confidenceData.generation.details.finishReason
      });
    }
    
    // Check overall confidence
    if (confidenceData.overall < this.thresholds.minimum) {
      issues.push({
        type: 'system_error',
        severity: 'high',
        description: 'Overall confidence is critically low',
        component: 'overall',
        score: confidenceData.overall
      });
    }
    
    return issues;
  }

  /**
   * Identify retrieval issues
   * @param {Object} details - Retrieval details
   * @param {Array} chunks - Retrieved chunks
   * @returns {Array} Issues
   */
  identifyRetrievalIssues(details, chunks) {
    const issues = [];
    
    if (chunks.length === 0) {
      issues.push('No relevant sources found');
    } else if (details.topSimilarity < 0.7) {
      issues.push('Low similarity scores for retrieved sources');
    }
    
    if (details.diversityScore < 0.3) {
      issues.push('Limited source diversity');
    }
    
    if (details.sourceQuality < 0.6) {
      issues.push('Low quality source documents');
    }
    
    return issues;
  }

  /**
   * Identify content issues
   * @param {Object} details - Content details
   * @param {Object} contentData - Content data
   * @returns {Array} Issues
   */
  identifyContentIssues(details, contentData) {
    const issues = [];
    
    if (details.citationPresence < 0.3) {
      issues.push('Insufficient citations in response');
    }
    
    if (details.citationAccuracy < 0.7) {
      issues.push('Inaccurate or invalid citations');
    }
    
    if (details.responseCompleteness < 0.5) {
      issues.push('Response appears incomplete');
    }
    
    if (details.coherenceScore < 0.6) {
      issues.push('Response lacks coherence or structure');
    }
    
    return issues;
  }

  /**
   * Identify context issues
   * @param {Object} details - Context details
   * @param {Object} contextData - Context data
   * @returns {Array} Issues
   */
  identifyContextIssues(details, contextData) {
    const issues = [];
    
    if (details.queryClarity < 0.5) {
      issues.push('Query is unclear or ambiguous');
    }
    
    if (details.domainRelevance < 0.4) {
      issues.push('Query may be outside fund management domain');
    }
    
    if (details.queryComplexity < 0.6) {
      issues.push('Query is highly complex and may require clarification');
    }
    
    return issues;
  }

  /**
   * Identify generation issues
   * @param {Object} details - Generation details
   * @param {Object} generationData - Generation data
   * @returns {Array} Issues
   */
  identifyGenerationIssues(details, generationData) {
    const issues = [];
    
    if (details.finishReason < 0.8) {
      issues.push('Response generation was interrupted or incomplete');
    }
    
    if (details.responseLength < 0.5) {
      issues.push('Response is unusually short');
    }
    
    if (details.modelConfidence < 0.7) {
      issues.push('Model confidence is below optimal levels');
    }
    
    return issues;
  }

  /**
   * Get recommended actions based on issues
   * @param {Array} issues - Identified issues
   * @param {number} overallConfidence - Overall confidence score
   * @returns {Array} Recommended actions
   */
  getRecommendedActions(issues, overallConfidence) {
    const actions = [];
    
    if (overallConfidence < this.thresholds.minimum) {
      actions.push({
        priority: 'high',
        action: 'Consider rephrasing the query or seeking alternative sources',
        reason: 'Confidence is critically low'
      });
    }
    
    issues.forEach(issue => {
      switch (issue.type) {
        case 'low_retrieval_confidence':
          actions.push({
            priority: 'medium',
            action: 'Try using more specific keywords or alternative phrasing',
            reason: 'Improve source relevance'
          });
          break;
          
        case 'poor_citation_quality':
          actions.push({
            priority: 'medium',
            action: 'Verify information with original source documents',
            reason: 'Citations may be inaccurate'
          });
          break;
          
        case 'query_ambiguity':
          actions.push({
            priority: 'low',
            action: 'Provide more context or clarify the question',
            reason: 'Query interpretation may be uncertain'
          });
          break;
          
        case 'incomplete_response':
          actions.push({
            priority: 'medium',
            action: 'Request continuation or ask follow-up questions',
            reason: 'Response may be incomplete'
          });
          break;
      }
    });
    
    return actions;
  }

  /**
   * Identify fallback strategies
   * @param {Array} issues - Identified issues
   * @returns {Array} Fallback strategies
   */
  identifyFallbackStrategies(issues) {
    const strategies = [];
    
    issues.forEach(issue => {
      if (this.fallbackStrategies[issue.type]) {
        strategies.push({
          type: issue.type,
          strategy: issue.type,
          severity: issue.severity,
          description: `Apply ${issue.type} fallback strategy`
        });
      }
    });
    
    return strategies;
  }

  /**
   * Calculate reliability metrics
   * @param {Object} data - All assessment data
   * @returns {Object} Reliability metrics
   */
  calculateReliabilityMetrics(data) {
    const metrics = {
      sourceReliability: 0,
      informationCompleteness: 0,
      responseConsistency: 0,
      citationReliability: 0,
      overallReliability: 0
    };
    
    // Source reliability (based on source quality and diversity)
    const chunks = data.retrievalData?.chunks || [];
    if (chunks.length > 0) {
      const avgQuality = chunks.reduce((sum, chunk) => sum + (chunk.quality_score || 0.5), 0) / chunks.length;
      const uniqueSources = new Set(chunks.map(chunk => chunk.citation?.source || chunk.filename));
      metrics.sourceReliability = (avgQuality + Math.min(uniqueSources.size / 3, 1)) / 2;
    }
    
    // Information completeness (based on response length and citations)
    const responseLength = data.contentData?.response?.length || 0;
    const citationCount = data.contentData?.citations?.length || 0;
    metrics.informationCompleteness = Math.min(
      (responseLength / 500) * 0.7 + (citationCount / 3) * 0.3,
      1
    );
    
    // Response consistency (based on coherence and citation accuracy)
    const coherence = data.contentData?.coherenceScore || 0.5;
    const citationAccuracy = data.contentData?.citations?.length > 0 
      ? data.contentData.citations.filter(c => c.isValid).length / data.contentData.citations.length
      : 0;
    metrics.responseConsistency = (coherence + citationAccuracy) / 2;
    
    // Citation reliability
    metrics.citationReliability = citationAccuracy;
    
    // Overall reliability
    metrics.overallReliability = (
      metrics.sourceReliability * 0.3 +
      metrics.informationCompleteness * 0.25 +
      metrics.responseConsistency * 0.25 +
      metrics.citationReliability * 0.2
    );
    
    return metrics;
  }

  // Fallback strategy implementations
  
  /**
   * Handle low retrieval confidence
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async handleLowRetrievalConfidence(context) {
    logger.info('🔄 Applying low retrieval confidence fallback');
    
    return {
      strategy: 'low_retrieval_confidence',
      message: `I found limited relevant information for your query "${context.query}". The available sources may not fully address your question. Would you like to:

1. Rephrase your question with more specific terms
2. Ask about a related topic that I can better assist with
3. Provide additional context about what you're looking for

I'm here to help with fund management questions based on our documentation.`,
      suggestions: [
        'Try using more specific fund management terminology',
        'Break down complex questions into simpler parts',
        'Ask about specific processes like fund creation or NAV calculation'
      ],
      confidence: 0.3,
      useKnowledgeBase: false
    };
  }

  /**
   * Handle no relevant sources
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async handleNoRelevantSources(context) {
    logger.info('🔄 Applying no relevant sources fallback');
    
    return {
      strategy: 'no_relevant_sources',
      message: `I couldn't find specific information about "${context.query}" in our Fund Management documentation. This might be because:

1. The topic isn't covered in our current knowledge base
2. Different terminology might be used in our documentation
3. The question might be outside the scope of fund management

Can you help me understand what specific aspect of fund management you're asking about?`,
      suggestions: [
        'Ask about fund creation processes',
        'Ask about compliance requirements',
        'Ask about NAV calculations',
        'Ask about portfolio management'
      ],
      confidence: 0.2,
      useKnowledgeBase: false
    };
  }

  /**
   * Handle poor citation quality
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async handlePoorCitationQuality(context) {
    logger.info('🔄 Applying poor citation quality fallback');
    
    return {
      strategy: 'poor_citation_quality',
      message: context.originalResponse + `

**Note:** Some citations in this response may not be fully accurate. Please verify important information by consulting the original Fund Management User Guide documents directly.`,
      warnings: ['Citation accuracy is below optimal levels'],
      confidence: Math.max(context.originalConfidence - 0.2, 0.1),
      useKnowledgeBase: true
    };
  }

  /**
   * Handle incomplete response
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async handleIncompleteResponse(context) {
    logger.info('🔄 Applying incomplete response fallback');
    
    return {
      strategy: 'incomplete_response',
      message: context.originalResponse + `

**Note:** This response may be incomplete. Would you like me to:
1. Continue with more details on this topic
2. Focus on a specific aspect of your question
3. Provide additional related information`,
      suggestions: [
        'Ask for more details on specific steps',
        'Request examples or clarifications',
        'Ask follow-up questions'
      ],
      confidence: Math.max(context.originalConfidence - 0.1, 0.2),
      useKnowledgeBase: true
    };
  }

  /**
   * Handle query ambiguity
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async handleQueryAmbiguity(context) {
    logger.info('🔄 Applying query ambiguity fallback');
    
    return {
      strategy: 'query_ambiguity',
      message: `Your question "${context.query}" could be interpreted in several ways. To provide the most accurate answer, could you clarify:

1. Are you asking about a specific fund management process?
2. Do you need information about compliance or regulatory requirements?
3. Are you looking for step-by-step procedures or general information?

This will help me give you more precise guidance from our Fund Management documentation.`,
      clarificationOptions: [
        'Fund creation and setup',
        'Portfolio management',
        'Compliance and audit',
        'NAV calculation',
        'Risk management'
      ],
      confidence: 0.4,
      useKnowledgeBase: false
    };
  }

  /**
   * Handle system error
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async handleSystemError(context) {
    logger.info('🔄 Applying system error fallback');
    
    return {
      strategy: 'system_error',
      message: `I apologize, but I'm experiencing difficulties processing your request about "${context.query}". This might be due to:

1. Technical issues with the knowledge base
2. Complexity of the query requiring manual review
3. Temporary system limitations

Please try again in a moment, or contact support if the issue persists. For urgent fund management questions, please consult your Fund Management User Guide directly.`,
      confidence: 0.1,
      useKnowledgeBase: false,
      error: true
    };
  }

  /**
   * Apply fallback strategy
   * @param {string} strategyType - Type of fallback strategy
   * @param {Object} context - Context data
   * @returns {Object} Fallback response
   */
  async applyFallbackStrategy(strategyType, context) {
    try {
      logger.info(`🔄 Applying fallback strategy: ${strategyType}`);
      
      if (this.fallbackStrategies[strategyType]) {
        return await this.fallbackStrategies[strategyType](context);
      } else {
        logger.warn(`⚠️ Unknown fallback strategy: ${strategyType}`);
        return await this.handleSystemError(context);
      }
    } catch (error) {
      logger.error('❌ Fallback strategy failed:', error);
      return await this.handleSystemError({ ...context, error: error.message });
    }
  }

  /**
   * Test confidence manager
   * @param {Object} testData - Test data
   * @returns {Object} Test results
   */
  async testConfidenceManager(testData = {}) {
    try {
      logger.info('🧪 Testing confidence manager');
      
      const defaultTestData = {
        retrievalData: {
          chunks: [
            { similarity_score: 0.85, quality_score: 0.9, citation: { source: 'Test Guide', page: 1 } },
            { similarity_score: 0.75, quality_score: 0.8, citation: { source: 'Test Guide', page: 2 } }
          ]
        },
        contentData: {
          response: 'This is a test response with proper citations (Test Guide, p.1) and structure.',
          citations: [
            { isValid: true, source: 'Test Guide', page: 1 },
            { isValid: true, source: 'Test Guide', page: 2 }
          ]
        },
        contextData: {
          queryAnalysis: {
            hasQuestionWords: true,
            intent: ['definition'],
            entities: ['fund', 'nav'],
            complexity: 'simple',
            wordCount: 8
          }
        },
        generationData: {
          model: 'gpt-4',
          finishReason: 'stop',
          temperature: 0.3,
          responseLength: 100,
          tokensUsed: { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 }
        }
      };
      
      const data = { ...defaultTestData, ...testData };
      
      const startTime = performance.now();
      const assessment = await this.calculateConfidence(
        data.retrievalData,
        data.contentData,
        data.contextData,
        data.generationData
      );
      const processingTime = performance.now() - startTime;
      
      const testResults = {
        success: true,
        processingTime,
        confidenceAssessment: assessment,
        testScenarios: {
          lowConfidence: await this.testLowConfidenceScenario(),
          noSources: await this.testNoSourcesScenario(),
          poorCitations: await this.testPoorCitationsScenario()
        }
      };
      
      logger.info(`✅ Confidence manager test completed in ${processingTime}ms`);
      logger.info(`📊 Overall confidence: ${assessment.overallConfidence.toFixed(3)} (${assessment.confidenceLevel})`);
      
      return testResults;
    } catch (error) {
      logger.error('❌ Confidence manager test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test low confidence scenario
   */
  async testLowConfidenceScenario() {
    const lowConfidenceData = {
      retrievalData: { chunks: [{ similarity_score: 0.3, quality_score: 0.4 }] },
      contentData: { response: 'Short response', citations: [] },
      contextData: { queryAnalysis: { complexity: 'complex', wordCount: 25 } },
      generationData: { finishReason: 'length', temperature: 0.8 }
    };
    
    return await this.calculateConfidence(
      lowConfidenceData.retrievalData,
      lowConfidenceData.contentData,
      lowConfidenceData.contextData,
      lowConfidenceData.generationData
    );
  }

  /**
   * Test no sources scenario
   */
  async testNoSourcesScenario() {
    return await this.applyFallbackStrategy('no_relevant_sources', {
      query: 'test query with no sources'
    });
  }

  /**
   * Test poor citations scenario
   */
  async testPoorCitationsScenario() {
    return await this.applyFallbackStrategy('poor_citation_quality', {
      originalResponse: 'Test response with poor citations',
      originalConfidence: 0.6
    });
  }
}

module.exports = ConfidenceManager;
