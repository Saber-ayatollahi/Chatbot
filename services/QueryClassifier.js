/**
 * Advanced Query Classifier
 * Multi-layer system for detecting and classifying queries to optimize token usage
 */

const logger = require('../utils/logger');

class QueryClassifier {
  constructor() {
    // System query patterns - expanded and comprehensive
    this.systemPatterns = {
      // Direct keywords - made more specific to avoid false positives
      keywords: [
        'health check', 'health test', 'health status',
        'system status', 'system check', 'system test',
        'service test', 'service status', 'service check',
        'ping', 'pong', 'uptime', 'alive',
        'ready', 'readiness', 'liveness', 'probe'
      ],
      
      // Session ID patterns - made more specific to avoid false positives
      sessionPatterns: [
        'health-test', 'health-check', 'health_test', 'health_check',
        'system-test', 'system-check', 'system_test', 'system_check',
        'status-test', 'status-check', 'status_test', 'status_check',
        'monitor-', 'monitoring-', 'uptime-', 'probe-',
        'health-session', 'system-session', 'monitor-session'
      ],
      
      // User agent patterns (for monitoring tools)
      userAgents: [
        'monitoring', 'uptime', 'health-check', 'pingdom',
        'newrelic', 'datadog', 'nagios', 'zabbix',
        'prometheus', 'grafana', 'statuspage'
      ],
      
      // Exact matches (case insensitive) - only very specific system words
      exactMatches: [
        'ping', 'pong', 'alive', 'ready', 'ok', 'up'
      ]
    };
    
    // FAQ patterns for common questions
    this.faqPatterns = {
      greetings: [
        'hello', 'hi', 'hey', 'good morning', 'good afternoon',
        'good evening', 'how are you', 'what\'s up'
      ],
      
      simple: [
        'what is', 'what are', 'how to', 'can you',
        'do you', 'are you', 'will you', 'help me'
      ],
      
      common: [
        'fund creation', 'create fund', 'new fund',
        'portfolio management', 'asset allocation',
        'risk management', 'compliance'
      ]
    };
    
    // Query complexity indicators
    this.complexityIndicators = {
      simple: {
        maxWords: 5,
        patterns: ['what is', 'how to', 'can you', 'do you']
      },
      
      standard: {
        maxWords: 15,
        patterns: ['explain', 'describe', 'tell me about', 'show me']
      },
      
      complex: {
        patterns: ['analyze', 'compare', 'evaluate', 'calculate', 'detailed']
      }
    };
  }

  /**
   * Classify query into appropriate processing category
   * @param {string} query - User query
   * @param {string} sessionId - Session identifier
   * @param {Object} context - Additional context (user agent, etc.)
   * @returns {Object} Classification result
   */
  classifyQuery(query, sessionId = '', context = {}) {
    const startTime = Date.now();
    
    try {
      const queryLower = query.toLowerCase().trim();
      const sessionLower = sessionId.toLowerCase();
      const userAgent = (context.userAgent || '').toLowerCase();
      
      // Step 1: Check for system queries (highest priority)
      if (this.isSystemQuery(queryLower, sessionLower, userAgent)) {
        return {
          type: 'SYSTEM',
          confidence: 1.0,
          reasoning: 'Detected system/health check query',
          tokenBudget: 0,
          processingTime: Date.now() - startTime,
          skipRAG: true,
          cacheKey: `system:${this.generateCacheKey(query)}`
        };
      }
      
      // Step 2: Check for FAQ queries
      const faqResult = this.checkFAQQuery(queryLower);
      if (faqResult.isFAQ) {
        return {
          type: 'FAQ',
          subtype: faqResult.category,
          confidence: faqResult.confidence,
          reasoning: `FAQ query detected: ${faqResult.category}`,
          tokenBudget: 200,
          processingTime: Date.now() - startTime,
          skipRAG: false,
          useCache: true,
          cacheKey: `faq:${this.generateCacheKey(query)}`,
          cacheTTL: 86400 // 24 hours
        };
      }
      
      // Step 3: Determine complexity and token budget
      const complexity = this.analyzeComplexity(queryLower);
      
      return {
        type: 'USER',
        complexity: complexity.level,
        confidence: 0.8,
        reasoning: `User query - ${complexity.level} complexity`,
        tokenBudget: complexity.tokenBudget,
        processingTime: Date.now() - startTime,
        skipRAG: false,
        useCache: complexity.level === 'simple',
        cacheKey: complexity.level === 'simple' ? `simple:${this.generateCacheKey(query)}` : null,
        cacheTTL: complexity.level === 'simple' ? 3600 : 0, // 1 hour for simple queries
        maxChunks: complexity.maxChunks
      };
      
    } catch (error) {
      logger.error('❌ Query classification failed:', error);
      
      // Fallback classification
      return {
        type: 'USER',
        complexity: 'standard',
        confidence: 0.5,
        reasoning: 'Fallback classification due to error',
        tokenBudget: 1500,
        processingTime: Date.now() - startTime,
        skipRAG: false,
        useCache: false,
        error: error.message
      };
    }
  }

  /**
   * Enhanced system query detection
   * @param {string} queryLower - Lowercase query
   * @param {string} sessionLower - Lowercase session ID
   * @param {string} userAgent - User agent string
   * @returns {boolean} True if system query
   */
  isSystemQuery(queryLower, sessionLower, userAgent) {
    // Check exact matches first (fastest)
    if (this.systemPatterns.exactMatches.includes(queryLower)) {
      return true;
    }
    
    // Check keyword patterns
    const hasSystemKeyword = this.systemPatterns.keywords.some(keyword => 
      queryLower.includes(keyword)
    );
    
    if (hasSystemKeyword) {
      return true;
    }
    
    // Check session patterns
    const hasSystemSession = this.systemPatterns.sessionPatterns.some(pattern =>
      sessionLower.includes(pattern)
    );
    
    if (hasSystemSession) {
      return true;
    }
    
    // Check user agent patterns
    const hasSystemUserAgent = this.systemPatterns.userAgents.some(pattern =>
      userAgent.includes(pattern)
    );
    
    if (hasSystemUserAgent) {
      return true;
    }
    
    // Check for very short queries that are likely system checks
    // Only catch single words that are clearly system-related
    if (queryLower.length <= 6 && /^[a-z]+$/.test(queryLower)) {
      const systemWords = ['ping', 'pong', 'test', 'check', 'status', 'health', 'up', 'ok'];
      if (systemWords.includes(queryLower)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if query matches FAQ patterns
   * @param {string} queryLower - Lowercase query
   * @returns {Object} FAQ analysis result
   */
  checkFAQQuery(queryLower) {
    // Check greetings
    const isGreeting = this.faqPatterns.greetings.some(greeting =>
      queryLower.includes(greeting)
    );
    
    if (isGreeting) {
      return {
        isFAQ: true,
        category: 'greeting',
        confidence: 0.9
      };
    }
    
    // Check simple patterns
    const hasSimplePattern = this.faqPatterns.simple.some(pattern =>
      queryLower.startsWith(pattern)
    );
    
    if (hasSimplePattern && queryLower.split(/\s+/).length <= 8) {
      return {
        isFAQ: true,
        category: 'simple',
        confidence: 0.8
      };
    }
    
    // Check common fund management questions
    const hasCommonPattern = this.faqPatterns.common.some(pattern =>
      queryLower.includes(pattern)
    );
    
    if (hasCommonPattern) {
      return {
        isFAQ: true,
        category: 'common',
        confidence: 0.7
      };
    }
    
    return {
      isFAQ: false,
      category: null,
      confidence: 0
    };
  }

  /**
   * Analyze query complexity and determine appropriate resources
   * @param {string} queryLower - Lowercase query
   * @returns {Object} Complexity analysis
   */
  analyzeComplexity(queryLower) {
    const words = queryLower.split(/\s+/);
    const wordCount = words.length;
    
    // Check for complexity indicators
    const hasComplexPatterns = this.complexityIndicators.complex.patterns.some(pattern =>
      queryLower.includes(pattern)
    );
    
    if (hasComplexPatterns || wordCount > 20) {
      return {
        level: 'complex',
        tokenBudget: 2000,
        maxChunks: 8,
        reasoning: 'Complex patterns or long query detected'
      };
    }
    
    const hasStandardPatterns = this.complexityIndicators.standard.patterns.some(pattern =>
      queryLower.includes(pattern)
    );
    
    if (hasStandardPatterns || wordCount > this.complexityIndicators.standard.maxWords) {
      return {
        level: 'standard',
        tokenBudget: 1500,
        maxChunks: 5,
        reasoning: 'Standard complexity patterns detected'
      };
    }
    
    if (wordCount <= this.complexityIndicators.simple.maxWords) {
      const hasSimplePatterns = this.complexityIndicators.simple.patterns.some(pattern =>
        queryLower.includes(pattern)
      );
      
      if (hasSimplePatterns) {
        return {
          level: 'simple',
          tokenBudget: 800,
          maxChunks: 3,
          reasoning: 'Simple query patterns detected'
        };
      }
    }
    
    // Default to standard
    return {
      level: 'standard',
      tokenBudget: 1500,
      maxChunks: 5,
      reasoning: 'Default standard classification'
    };
  }

  /**
   * Generate cache key for query
   * @param {string} query - Original query
   * @returns {string} Cache key
   */
  generateCacheKey(query) {
    // Normalize query for caching
    const normalized = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    return normalized;
  }

  /**
   * Get classification statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      systemPatterns: {
        keywords: this.systemPatterns.keywords.length,
        sessionPatterns: this.systemPatterns.sessionPatterns.length,
        userAgents: this.systemPatterns.userAgents.length,
        exactMatches: this.systemPatterns.exactMatches.length
      },
      faqPatterns: {
        greetings: this.faqPatterns.greetings.length,
        simple: this.faqPatterns.simple.length,
        common: this.faqPatterns.common.length
      }
    };
  }
}

module.exports = QueryClassifier;
