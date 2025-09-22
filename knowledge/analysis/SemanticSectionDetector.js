/**
 * Semantic Section Detector
 * Advanced content type classification and purpose identification
 * Production-ready with machine learning-inspired pattern recognition
 */

const logger = require('../../utils/logger');
const { performance } = require('perf_hooks');

class SemanticSectionDetector {
  constructor(options = {}) {
    this.options = {
      // Content type detection patterns
      contentTypes: {
        procedural: {
          patterns: [
            /step\s+\d+/gi,
            /first[,\s]/gi,
            /second[,\s]/gi,
            /third[,\s]/gi,
            /next[,\s]/gi,
            /then[,\s]/gi,
            /finally[,\s]/gi,
            /navigate\s+to/gi,
            /click\s+(?:on\s+)?the/gi,
            /select\s+/gi,
            /choose\s+/gi,
            /enter\s+/gi,
            /follow\s+these\s+steps/gi,
            /to\s+\w+[,\s]/gi
          ],
          keywords: [
            'procedure', 'process', 'method', 'workflow', 'instruction',
            'guide', 'tutorial', 'walkthrough', 'setup', 'configuration'
          ],
          weight: 1.0,
          minConfidence: 0.6
        },
        
        conceptual: {
          patterns: [
            /\w+\s+(?:is|are|means?|refers?\s+to)/gi,
            /definition\s*:/gi,
            /defined\s+as/gi,
            /concept\s+of/gi,
            /understanding\s+/gi,
            /overview\s+of/gi,
            /introduction\s+to/gi,
            /what\s+(?:is|are)/gi,
            /explanation\s+of/gi
          ],
          keywords: [
            'concept', 'definition', 'explanation', 'theory', 'principle',
            'overview', 'introduction', 'background', 'fundamentals', 'basics'
          ],
          weight: 0.9,
          minConfidence: 0.5
        },
        
        reference: {
          patterns: [
            /table\s+\d+/gi,
            /figure\s+\d+/gi,
            /appendix\s+[a-z]/gi,
            /see\s+(?:table|figure|appendix)/gi,
            /reference\s+/gi,
            /specification\s+/gi,
            /parameter\s+/gi,
            /\|\s*\w+\s*\|/gi, // Table patterns
            /^\s*\w+\s*:\s*\w+/gm // Key-value pairs
          ],
          keywords: [
            'reference', 'specification', 'parameter', 'table', 'figure',
            'appendix', 'index', 'glossary', 'list', 'catalog'
          ],
          weight: 0.8,
          minConfidence: 0.4
        },
        
        troubleshooting: {
          patterns: [
            /error\s+/gi,
            /problem\s+/gi,
            /issue\s+/gi,
            /solution\s+/gi,
            /fix\s+/gi,
            /resolve\s+/gi,
            /troubleshoot/gi,
            /if\s+you\s+encounter/gi,
            /common\s+problems/gi,
            /known\s+issues/gi,
            /symptom\s+/gi,
            /cause\s+/gi
          ],
          keywords: [
            'troubleshooting', 'problem', 'issue', 'error', 'bug',
            'solution', 'fix', 'resolve', 'debug', 'diagnose'
          ],
          weight: 0.9,
          minConfidence: 0.6
        },
        
        faq: {
          patterns: [
            /\?/g,
            /^q\d*[:.]/gim,
            /^a\d*[:.]/gim,
            /question\s*\d*/gi,
            /answer\s*\d*/gi,
            /frequently\s+asked/gi,
            /common\s+questions/gi,
            /how\s+(?:do|can|to)/gi,
            /what\s+(?:is|are|does)/gi,
            /why\s+(?:is|are|does)/gi,
            /when\s+(?:is|are|does)/gi,
            /where\s+(?:is|are|can)/gi
          ],
          keywords: [
            'faq', 'question', 'answer', 'frequently', 'common',
            'ask', 'inquiry', 'query', 'help', 'support'
          ],
          weight: 0.8,
          minConfidence: 0.5
        },
        
        example: {
          patterns: [
            /example\s*\d*/gi,
            /for\s+example/gi,
            /such\s+as/gi,
            /instance\s+/gi,
            /sample\s+/gi,
            /demonstration\s+/gi,
            /illustration\s+/gi,
            /case\s+study/gi,
            /use\s+case/gi,
            /scenario\s+/gi
          ],
          keywords: [
            'example', 'sample', 'demonstration', 'illustration', 'case',
            'scenario', 'instance', 'specimen', 'model', 'template'
          ],
          weight: 0.7,
          minConfidence: 0.4
        },
        
        warning: {
          patterns: [
            /warning\s*[!:]/gi,
            /caution\s*[!:]/gi,
            /important\s*[!:]/gi,
            /note\s*[!:]/gi,
            /attention\s*[!:]/gi,
            /danger\s*[!:]/gi,
            /alert\s*[!:]/gi,
            /be\s+careful/gi,
            /do\s+not/gi,
            /avoid\s+/gi,
            /never\s+/gi
          ],
          keywords: [
            'warning', 'caution', 'important', 'note', 'attention',
            'danger', 'alert', 'critical', 'essential', 'vital'
          ],
          weight: 0.9,
          minConfidence: 0.7
        }
      },
      
      // Fund management specific patterns
      fundManagementPatterns: {
        fundCreation: {
          patterns: [
            /creat\w*\s+(?:a\s+)?fund/gi,
            /new\s+fund/gi,
            /fund\s+setup/gi,
            /establish\w*\s+fund/gi,
            /fund\s+initialization/gi,
            /fund\s+configuration/gi
          ],
          keywords: [
            'create', 'establish', 'setup', 'initialize', 'configure',
            'new', 'launch', 'start', 'begin', 'initiate'
          ],
          weight: 1.0
        },
        
        fundUpdate: {
          patterns: [
            /fund\s+update/gi,
            /updat\w*\s+(?:a\s+)?fund/gi,
            /modif\w*\s+fund/gi,
            /edit\w*\s+fund/gi,
            /chang\w*\s+fund/gi,
            /fund\s+maintenance/gi
          ],
          keywords: [
            'update', 'modify', 'edit', 'change', 'maintain',
            'revise', 'adjust', 'alter', 'amend', 'refresh'
          ],
          weight: 1.0
        },
        
        fundTypes: {
          patterns: [
            /fund\s+type/gi,
            /type\s+of\s+fund/gi,
            /fund\s+categor/gi,
            /fund\s+classification/gi,
            /different\s+funds/gi,
            /various\s+funds/gi
          ],
          keywords: [
            'type', 'category', 'classification', 'kind', 'variety',
            'different', 'various', 'multiple', 'several', 'diverse'
          ],
          weight: 0.9
        },
        
        navigation: {
          patterns: [
            /navigate\s+to/gi,
            /go\s+to/gi,
            /access\s+/gi,
            /open\s+/gi,
            /click\s+/gi,
            /select\s+/gi,
            /choose\s+/gi,
            /find\s+/gi,
            /locate\s+/gi
          ],
          keywords: [
            'navigate', 'access', 'open', 'click', 'select',
            'choose', 'find', 'locate', 'reach', 'visit'
          ],
          weight: 0.8
        }
      },
      
      // Content quality indicators
      qualityIndicators: {
        minLength: 50,
        maxLength: 10000,
        minSentences: 2,
        optimalSentences: 5,
        minWords: 10,
        optimalWords: 100
      },
      
      // Performance settings
      performance: {
        enableCaching: true,
        maxCacheSize: 500,
        enableParallelProcessing: true,
        batchSize: 100
      },
      
      ...options
    };

    // Initialize state
    this.detectionCache = new Map();
    this.performanceMetrics = {
      detectionsPerformed: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      typeDistribution: {}
    };
    
    // Compile patterns for better performance
    this.compiledPatterns = this.compilePatterns();
  }

  /**
   * Main semantic section detection method
   * @param {string} content - Content to analyze
   * @param {Object} context - Additional context (headings, structure, etc.)
   * @returns {Promise<Object>} Detection result with type, confidence, and characteristics
   */
  async detectSectionType(content, context = {}) {
    const startTime = performance.now();
    
    try {
      // Validate input parameters
      if (content === null || content === undefined) {
        logger.warn('⚠️ Null or undefined content provided to semantic detection');
        return this.generateFallbackResult('', new Error('Null or undefined content'));
      }
      
      // Ensure content is a string
      content = String(content || '');
      
      logger.debug('🔍 Detecting semantic section type...');
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(content, context);
      
      // Check cache
      if (this.options.performance.enableCaching && this.detectionCache.has(cacheKey)) {
        logger.debug('📋 Using cached section detection');
        this.performanceMetrics.cacheHitRate++;
        return this.detectionCache.get(cacheKey);
      }
      
      // Perform comprehensive detection
      const detectionResult = await this.performComprehensiveDetection(content, context);
      
      // Cache result
      if (this.options.performance.enableCaching) {
        this.cacheResult(cacheKey, detectionResult);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      this.updateMetrics(detectionResult, processingTime);
      
      logger.debug(`✅ Section type detected: ${detectionResult.primaryType} (${Math.round(detectionResult.confidence * 100)}% confidence)`);
      
      return {
        ...detectionResult,
        processingTime
      };
      
    } catch (error) {
      logger.error('❌ Semantic section detection failed:', error);
      return this.generateFallbackResult(content, error);
    }
  }

  /**
   * Perform comprehensive semantic detection
   * @param {string} content - Content to analyze
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Detection result
   */
  async performComprehensiveDetection(content, context) {
    // Step 1: Content preprocessing
    const preprocessedContent = this.preprocessContent(content);
    
    // Step 2: Pattern-based detection
    const patternResults = await this.performPatternBasedDetection(preprocessedContent);
    
    // Step 3: Keyword-based detection
    const keywordResults = await this.performKeywordBasedDetection(preprocessedContent);
    
    // Step 4: Fund management specific detection
    const fundManagementResults = await this.performFundManagementDetection(preprocessedContent);
    
    // Step 5: Structural analysis
    const structuralResults = await this.performStructuralAnalysis(preprocessedContent, context);
    
    // Step 6: Content quality assessment
    const qualityAssessment = this.assessContentQuality(preprocessedContent);
    
    // Step 7: Combine results and determine final classification
    const combinedResults = this.combineDetectionResults(
      patternResults,
      keywordResults,
      fundManagementResults,
      structuralResults,
      qualityAssessment
    );
    
    // Step 8: Generate detailed characteristics
    const characteristics = this.generateContentCharacteristics(
      preprocessedContent,
      combinedResults,
      context
    );
    
    return {
      // Primary classification
      primaryType: combinedResults.primaryType,
      secondaryTypes: combinedResults.secondaryTypes,
      confidence: combinedResults.confidence,
      
      // Fund management specific
      fundManagementRelevance: fundManagementResults.relevance,
      fundManagementTypes: fundManagementResults.types,
      
      // Detailed scores
      typeScores: combinedResults.allScores,
      
      // Content characteristics
      characteristics: characteristics,
      
      // Quality indicators
      qualityMetrics: qualityAssessment,
      
      // Processing metadata
      processingMetadata: {
        contentLength: content.length,
        wordCount: this.countWords(preprocessedContent),
        sentenceCount: this.countSentences(preprocessedContent),
        hasStructure: structuralResults.hasStructure,
        complexity: this.assessComplexity(preprocessedContent, characteristics)
      }
    };
  }

  /**
   * Perform pattern-based detection
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Pattern detection results
   */
  async performPatternBasedDetection(content) {
    try {
      const scores = {};
      
      for (const [typeName, typeConfig] of Object.entries(this.options.contentTypes)) {
        let score = 0;
        let matchCount = 0;
        
        // Apply patterns
        for (const pattern of typeConfig.patterns) {
          const matches = content.match(pattern);
          if (matches) {
            matchCount += matches.length;
            score += matches.length * 0.1; // Each match adds 0.1 to score
          }
        }
        
        // Normalize score based on content length
        const normalizedScore = Math.min(score / (content.length / 1000), 1.0);
        
        scores[typeName] = {
          score: normalizedScore * typeConfig.weight,
          matchCount: matchCount,
          confidence: normalizedScore >= typeConfig.minConfidence ? normalizedScore : 0
        };
      }
      
      return {
        scores,
        bestMatch: this.findBestMatch(scores),
        totalMatches: Object.values(scores).reduce((sum, s) => sum + s.matchCount, 0)
      };
      
    } catch (error) {
      logger.error('❌ Pattern-based detection failed:', error);
      return { scores: {}, bestMatch: null, totalMatches: 0 };
    }
  }

  /**
   * Perform keyword-based detection
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Keyword detection results
   */
  async performKeywordBasedDetection(content) {
    try {
      const contentLower = content.toLowerCase();
      const scores = {};
      
      for (const [typeName, typeConfig] of Object.entries(this.options.contentTypes)) {
        let score = 0;
        let keywordCount = 0;
        
        // Check for keywords
        for (const keyword of typeConfig.keywords) {
          const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = contentLower.match(keywordRegex);
          if (matches) {
            keywordCount += matches.length;
            score += matches.length * 0.05; // Each keyword match adds 0.05
          }
        }
        
        // Normalize score
        const normalizedScore = Math.min(score, 1.0);
        
        scores[typeName] = {
          score: normalizedScore * typeConfig.weight,
          keywordCount: keywordCount,
          confidence: normalizedScore
        };
      }
      
      return {
        scores,
        bestMatch: this.findBestMatch(scores),
        totalKeywords: Object.values(scores).reduce((sum, s) => sum + s.keywordCount, 0)
      };
      
    } catch (error) {
      logger.error('❌ Keyword-based detection failed:', error);
      return { scores: {}, bestMatch: null, totalKeywords: 0 };
    }
  }

  /**
   * Perform fund management specific detection
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Fund management detection results
   */
  async performFundManagementDetection(content) {
    try {
      const contentLower = content.toLowerCase();
      const scores = {};
      const detectedTypes = [];
      
      for (const [categoryName, categoryConfig] of Object.entries(this.options.fundManagementPatterns)) {
        let score = 0;
        let matchCount = 0;
        
        // Apply patterns
        for (const pattern of categoryConfig.patterns) {
          const matches = content.match(pattern);
          if (matches) {
            matchCount += matches.length;
            score += matches.length * 0.2;
          }
        }
        
        // Apply keywords
        for (const keyword of categoryConfig.keywords) {
          const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = contentLower.match(keywordRegex);
          if (matches) {
            matchCount += matches.length;
            score += matches.length * 0.1;
          }
        }
        
        const normalizedScore = Math.min(score, 1.0) * categoryConfig.weight;
        
        scores[categoryName] = {
          score: normalizedScore,
          matchCount: matchCount,
          confidence: normalizedScore
        };
        
        if (normalizedScore > 0.3) {
          detectedTypes.push({
            type: categoryName,
            confidence: normalizedScore,
            matchCount: matchCount
          });
        }
      }
      
      // Calculate overall fund management relevance
      const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
      const relevance = Math.min(totalScore / Object.keys(scores).length, 1.0);
      
      return {
        scores,
        types: detectedTypes.sort((a, b) => b.confidence - a.confidence),
        relevance: relevance,
        isFundManagementContent: relevance > 0.2
      };
      
    } catch (error) {
      logger.error('❌ Fund management detection failed:', error);
      return {
        scores: {},
        types: [],
        relevance: 0,
        isFundManagementContent: false
      };
    }
  }

  /**
   * Perform structural analysis
   * @param {string} content - Preprocessed content
   * @param {Object} context - Structural context
   * @returns {Promise<Object>} Structural analysis results
   */
  async performStructuralAnalysis(content, context) {
    try {
      const lines = content.split('\n');
      const structure = {
        hasNumberedSteps: this.hasNumberedSteps(lines),
        hasBulletPoints: this.hasBulletPoints(lines),
        hasQuestions: this.hasQuestions(lines),
        hasCodeBlocks: this.hasCodeBlocks(content),
        hasTables: this.hasTables(content),
        hasDefinitionLists: this.hasDefinitionLists(lines),
        hasHeadings: context.headings && context.headings.length > 0,
        lineCount: lines.length,
        avgLineLength: lines.reduce((sum, line) => sum + line.length, 0) / lines.length
      };
      
      // Determine structural type based on patterns
      let structuralType = 'unstructured';
      
      if (structure.hasNumberedSteps) {
        structuralType = 'procedural';
      } else if (structure.hasQuestions) {
        structuralType = 'faq';
      } else if (structure.hasTables) {
        structuralType = 'reference';
      } else if (structure.hasDefinitionLists) {
        structuralType = 'conceptual';
      } else if (structure.hasBulletPoints) {
        structuralType = 'list_based';
      }
      
      return {
        structure,
        structuralType,
        hasStructure: Object.values(structure).some(v => v === true),
        structureComplexity: this.calculateStructuralComplexity(structure)
      };
      
    } catch (error) {
      logger.error('❌ Structural analysis failed:', error);
      return {
        structure: {},
        structuralType: 'unstructured',
        hasStructure: false,
        structureComplexity: 0
      };
    }
  }

  /**
   * Assess content quality
   * @param {string} content - Content to assess
   * @returns {Object} Quality assessment
   */
  assessContentQuality(content) {
    try {
      const wordCount = this.countWords(content);
      const sentenceCount = this.countSentences(content);
      const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);
      
      const metrics = {
        length: {
          score: this.scoreLengthQuality(content.length),
          value: content.length
        },
        wordCount: {
          score: this.scoreWordCountQuality(wordCount),
          value: wordCount
        },
        sentenceCount: {
          score: this.scoreSentenceCountQuality(sentenceCount),
          value: sentenceCount
        },
        readability: {
          score: this.scoreReadabilityQuality(avgWordsPerSentence),
          value: avgWordsPerSentence
        },
        structure: {
          score: this.scoreStructureQuality(content),
          value: this.hasBasicStructure(content)
        }
      };
      
      // Calculate overall quality
      const overallQuality = Object.values(metrics).reduce((sum, metric) => sum + metric.score, 0) / Object.keys(metrics).length;
      
      return {
        metrics,
        overallQuality,
        isHighQuality: overallQuality >= 0.7,
        qualityLevel: this.getQualityLevel(overallQuality)
      };
      
    } catch (error) {
      logger.error('❌ Content quality assessment failed:', error);
      return {
        metrics: {},
        overallQuality: 0.3,
        isHighQuality: false,
        qualityLevel: 'low'
      };
    }
  }

  /**
   * Combine detection results
   * @param {Object} patternResults - Pattern detection results
   * @param {Object} keywordResults - Keyword detection results
   * @param {Object} fundManagementResults - Fund management detection results
   * @param {Object} structuralResults - Structural analysis results
   * @param {Object} qualityAssessment - Quality assessment
   * @returns {Object} Combined results
   */
  combineDetectionResults(patternResults, keywordResults, fundManagementResults, structuralResults, qualityAssessment) {
    try {
      const combinedScores = {};
      
      // Combine pattern and keyword scores
      for (const typeName of Object.keys(this.options.contentTypes)) {
        const patternScore = patternResults.scores[typeName]?.score || 0;
        const keywordScore = keywordResults.scores[typeName]?.score || 0;
        
        // Weighted combination (patterns are more important)
        combinedScores[typeName] = (patternScore * 0.7) + (keywordScore * 0.3);
      }
      
      // Boost scores based on structural analysis
      if (structuralResults.structuralType && combinedScores[structuralResults.structuralType]) {
        combinedScores[structuralResults.structuralType] *= 1.2;
      }
      
      // Apply quality boost
      const qualityMultiplier = 0.8 + (qualityAssessment.overallQuality * 0.4);
      for (const typeName in combinedScores) {
        combinedScores[typeName] *= qualityMultiplier;
      }
      
      // Find primary and secondary types
      const sortedTypes = Object.entries(combinedScores)
        .sort(([,a], [,b]) => b - a)
        .filter(([,score]) => score > 0.1);
      
      const primaryType = sortedTypes.length > 0 ? sortedTypes[0][0] : 'unknown';
      const primaryScore = sortedTypes.length > 0 ? sortedTypes[0][1] : 0.1;
      
      const secondaryTypes = sortedTypes.slice(1, 3).map(([type, score]) => ({
        type,
        confidence: Math.min(score, 1.0)
      }));
      
      return {
        primaryType,
        confidence: Math.min(primaryScore, 1.0),
        secondaryTypes,
        allScores: combinedScores
      };
      
    } catch (error) {
      logger.error('❌ Result combination failed:', error);
      return {
        primaryType: 'unknown',
        confidence: 0.1,
        secondaryTypes: [],
        allScores: {}
      };
    }
  }

  /**
   * Generate content characteristics
   * @param {string} content - Content
   * @param {Object} results - Detection results
   * @param {Object} context - Context
   * @returns {Object} Content characteristics
   */
  generateContentCharacteristics(content, results, context) {
    try {
      // Safety checks for results object
      const allScores = results.allScores || {};
      const fundManagementTypes = results.fundManagementTypes || [];
      const primaryType = results.primaryType || 'unknown';
      const confidence = results.confidence || 0;
      
      return {
        // Content type characteristics
        isProcedural: primaryType === 'procedural' || (allScores.procedural || 0) > 0.5,
        isConceptual: primaryType === 'conceptual' || (allScores.conceptual || 0) > 0.5,
        isReference: primaryType === 'reference' || (allScores.reference || 0) > 0.5,
        isTroubleshooting: primaryType === 'troubleshooting' || (allScores.troubleshooting || 0) > 0.5,
        isFAQ: primaryType === 'faq' || (allScores.faq || 0) > 0.5,
        
        // Content features
        hasStepByStep: this.hasStepByStepContent(content),
        hasDefinitions: this.hasDefinitions(content),
        hasExamples: this.hasExamples(content),
        hasWarnings: this.hasWarnings(content),
        hasQuestions: this.hasQuestions(content.split('\n')),
        
        // Fund management specific
        isFundCreationContent: fundManagementTypes.some(t => t.type === 'fundCreation'),
        isFundUpdateContent: fundManagementTypes.some(t => t.type === 'fundUpdate'),
        isFundTypesContent: fundManagementTypes.some(t => t.type === 'fundTypes'),
        hasNavigationInstructions: fundManagementTypes.some(t => t.type === 'navigation'),
        
        // Processing hints
        requiresSpecialHandling: confidence < 0.4 || primaryType === 'unknown',
        recommendedChunkingStrategy: this.recommendChunkingStrategy(results, content),
        preserveSequence: primaryType === 'procedural' || this.hasStepByStepContent(content),
        enhanceDefinitions: primaryType === 'conceptual' || this.hasDefinitions(content)
      };
      
    } catch (error) {
      logger.error('❌ Characteristic generation failed:', error);
      return {
        isProcedural: false,
        isConceptual: false,
        isReference: false,
        requiresSpecialHandling: true,
        recommendedChunkingStrategy: 'simple'
      };
    }
  }

  // Helper methods

  /**
   * Preprocess content for analysis
   */
  preprocessContent(content) {
    // Normalize whitespace
    let processed = content.replace(/\s+/g, ' ').trim();
    
    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return processed;
  }

  /**
   * Count words in content
   */
  countWords(content) {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in content
   */
  countSentences(content) {
    return content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
  }

  /**
   * Check for step-by-step content
   */
  hasStepByStepContent(content) {
    const stepPatterns = [
      /step\s+\d+/gi,
      /\d+\.\s+/g,
      /(first|second|third|fourth|fifth)[,\s]/gi,
      /(next|then|finally)[,\s]/gi
    ];
    
    return stepPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for definitions
   */
  hasDefinitions(content) {
    const definitionPatterns = [
      /\w+\s+(?:is|are|means?|refers?\s+to)/gi,
      /definition\s*:/gi,
      /defined\s+as/gi
    ];
    
    return definitionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for examples
   */
  hasExamples(content) {
    const examplePatterns = [
      /example\s*\d*/gi,
      /for\s+example/gi,
      /such\s+as/gi,
      /instance/gi
    ];
    
    return examplePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for warnings
   */
  hasWarnings(content) {
    const warningPatterns = [
      /warning\s*[!:]/gi,
      /caution\s*[!:]/gi,
      /important\s*[!:]/gi,
      /note\s*[!:]/gi
    ];
    
    return warningPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Recommend chunking strategy based on detection results
   */
  recommendChunkingStrategy(results, content) {
    if (results.primaryType === 'procedural' || this.hasStepByStepContent(content)) {
      return 'procedure_preserving';
    } else if (results.primaryType === 'faq') {
      return 'qa_pair_preserving';
    } else if (results.primaryType === 'reference') {
      return 'structure_preserving';
    } else if (results.primaryType === 'conceptual') {
      return 'definition_preserving';
    } else {
      return 'semantic_adaptive';
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(content, context) {
    const contentHash = require('crypto')
      .createHash('md5')
      .update(content.substring(0, 500))
      .digest('hex');
    
    // Create a safe context object without circular references
    const safeContext = this.createSafeContext(context);
    
    return `semantic_${contentHash}_${JSON.stringify(safeContext)}`;
  }

  /**
   * Create a safe context object without circular references
   */
  createSafeContext(context) {
    if (!context || typeof context !== 'object') {
      return {};
    }

    try {
      // Create a safe copy of context without circular references
      const safeContext = {};
      
      // Copy primitive values and safe objects
      for (const [key, value] of Object.entries(context)) {
        if (value === null || value === undefined) {
          safeContext[key] = value;
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          safeContext[key] = value;
        } else if (Array.isArray(value)) {
          // For arrays, only include primitive values or safe objects
          safeContext[key] = value.map(item => {
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
              return item;
            } else if (typeof item === 'object' && item !== null) {
              return this.extractSafeProperties(item);
            }
            return '[Object]';
          });
        } else if (typeof value === 'object') {
          // For objects, only include safe properties
          if (key === 'documentType' || key === 'processingOptions' || key === 'metadata' || key === 'structure') {
            safeContext[key] = this.extractSafeProperties(value);
          } else {
            // Skip potentially circular objects like 'children', 'parent', etc.
            safeContext[key] = '[Object]';
          }
        }
      }
      
      return safeContext;
    } catch (error) {
      logger.warn('⚠️ Failed to create safe context for semantic detection, using minimal context');
      return { type: 'unknown' };
    }
  }

  /**
   * Extract safe properties from an object
   */
  extractSafeProperties(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const safe = {};
    const allowedKeys = ['type', 'confidence', 'strategy', 'quality', 'size', 'length', 'count', 'primaryType', 'secondaryTypes'];
    
    for (const key of allowedKeys) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          safe[key] = value;
        } else if (Array.isArray(value)) {
          // Only include primitive array elements
          safe[key] = value.filter(item => 
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
          );
        }
      }
    }
    
    return safe;
  }

  /**
   * Cache detection result
   */
  cacheResult(cacheKey, result) {
    if (this.detectionCache.size >= this.options.performance.maxCacheSize) {
      const firstKey = this.detectionCache.keys().next().value;
      this.detectionCache.delete(firstKey);
    }
    
    this.detectionCache.set(cacheKey, {
      ...result,
      cachedAt: Date.now()
    });
  }

  /**
   * Update performance metrics
   */
  updateMetrics(result, processingTime) {
    this.performanceMetrics.detectionsPerformed++;
    
    // Update average processing time
    const totalTime = this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.detectionsPerformed - 1) + processingTime;
    this.performanceMetrics.averageProcessingTime = totalTime / this.performanceMetrics.detectionsPerformed;
    
    // Update type distribution
    const primaryType = result.primaryType;
    if (!this.performanceMetrics.typeDistribution[primaryType]) {
      this.performanceMetrics.typeDistribution[primaryType] = 0;
    }
    this.performanceMetrics.typeDistribution[primaryType]++;
  }

  /**
   * Generate fallback result
   */
  generateFallbackResult(content, error) {
    return {
      primaryType: 'unknown',
      secondaryTypes: [],
      confidence: 0.1,
      fundManagementRelevance: 0,
      fundManagementTypes: [],
      typeScores: {},
      characteristics: {
        requiresSpecialHandling: true,
        recommendedChunkingStrategy: 'simple'
      },
      qualityMetrics: {
        overallQuality: 0.3,
        isHighQuality: false
      },
      error: error.message,
      fallback: true
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      cacheSize: this.detectionCache.size,
      cacheHitRate: this.performanceMetrics.cacheHitRate / Math.max(this.performanceMetrics.detectionsPerformed, 1)
    };
  }

  /**
   * Compile patterns for better performance
   */
  compilePatterns() {
    const compiled = {};
    
    // Compile content type patterns
    for (const [typeName, typeConfig] of Object.entries(this.options.contentTypes)) {
      compiled[typeName] = {
        patterns: typeConfig.patterns.map(pattern => new RegExp(pattern.source, pattern.flags)),
        keywords: typeConfig.keywords,
        weight: typeConfig.weight,
        minConfidence: typeConfig.minConfidence
      };
    }
    
    // Compile fund management patterns
    compiled.fundManagement = {};
    for (const [categoryName, categoryConfig] of Object.entries(this.options.fundManagementPatterns)) {
      compiled.fundManagement[categoryName] = {
        patterns: categoryConfig.patterns.map(pattern => new RegExp(pattern.source, pattern.flags)),
        keywords: categoryConfig.keywords,
        weight: categoryConfig.weight
      };
    }
    
    return compiled;
  }

  /**
   * Find best match (helper method)
   */
  findBestMatch(scores) {
    let bestType = null;
    let bestScore = 0;
    
    for (const [type, scoreData] of Object.entries(scores)) {
      if (scoreData.score > bestScore) {
        bestScore = scoreData.score;
        bestType = type;
      }
    }
    
    return bestType ? { type: bestType, score: bestScore } : null;
  }

  /**
   * Has numbered steps (helper method)
   */
  hasNumberedSteps(lines) {
    return lines.some(line => /^\s*\d+[.)]\s+/.test(line));
  }

  /**
   * Has bullet points (helper method)
   */
  hasBulletPoints(lines) {
    return lines.some(line => /^\s*[-*+]\s+/.test(line));
  }

  /**
   * Has questions (helper method)
   */
  hasQuestions(lines) {
    return lines.some(line => line.includes('?'));
  }

  /**
   * Has code blocks (helper method)
   */
  hasCodeBlocks(content) {
    return /```[\s\S]*?```/.test(content) || /^(    |\t).*$/m.test(content);
  }

  /**
   * Has tables (helper method)
   */
  hasTables(content) {
    return /\|.*\|/.test(content);
  }

  /**
   * Has definition lists (helper method)
   */
  hasDefinitionLists(lines) {
    return lines.some(line => /^[^:\n]+:\s*[^:\n]+$/.test(line));
  }

  /**
   * Calculate structural complexity (helper method)
   */
  calculateStructuralComplexity(structure) {
    let complexity = 0;
    
    if (structure.hasNumberedSteps) complexity += 2;
    if (structure.hasBulletPoints) complexity += 1;
    if (structure.hasQuestions) complexity += 1;
    if (structure.hasCodeBlocks) complexity += 2;
    if (structure.hasTables) complexity += 2;
    if (structure.hasDefinitionLists) complexity += 1;
    
    return Math.min(complexity / 10, 1.0);
  }

  /**
   * Score length quality (helper method)
   */
  scoreLengthQuality(length) {
    if (length < this.options.qualityIndicators.minLength) return 0.2;
    if (length > this.options.qualityIndicators.maxLength) return 0.3;
    if (length > 500) return 1.0;
    if (length > 200) return 0.8;
    return 0.6;
  }

  /**
   * Score word count quality (helper method)
   */
  scoreWordCountQuality(wordCount) {
    if (wordCount < this.options.qualityIndicators.minWords) return 0.2;
    if (wordCount > this.options.qualityIndicators.optimalWords) return 1.0;
    if (wordCount > 50) return 0.8;
    return 0.6;
  }

  /**
   * Score sentence count quality (helper method)
   */
  scoreSentenceCountQuality(sentenceCount) {
    if (sentenceCount < this.options.qualityIndicators.minSentences) return 0.3;
    if (sentenceCount >= this.options.qualityIndicators.optimalSentences) return 1.0;
    if (sentenceCount >= 3) return 0.8;
    return 0.6;
  }

  /**
   * Score readability quality (helper method)
   */
  scoreReadabilityQuality(avgWordsPerSentence) {
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) return 1.0;
    if (avgWordsPerSentence >= 8 && avgWordsPerSentence <= 25) return 0.8;
    if (avgWordsPerSentence >= 5 && avgWordsPerSentence <= 30) return 0.6;
    return 0.4;
  }

  /**
   * Score structure quality (helper method)
   */
  scoreStructureQuality(content) {
    if (this.hasBasicStructure(content)) return 1.0;
    return 0.5;
  }

  /**
   * Has basic structure (helper method)
   */
  hasBasicStructure(content) {
    return /\n\s*\n/.test(content) || // Has paragraphs
           /^\s*[-*+]\s+/m.test(content) || // Has lists
           /^\s*\d+[.)]\s+/m.test(content) || // Has numbered items
           /[.!?]\s+[A-Z]/.test(content); // Has proper sentences
  }

  /**
   * Get quality level (helper method)
   */
  getQualityLevel(overallQuality) {
    if (overallQuality >= 0.8) return 'excellent';
    if (overallQuality >= 0.6) return 'good';
    if (overallQuality >= 0.4) return 'fair';
    return 'poor';
  }

  /**
   * Assess complexity (helper method)
   */
  assessComplexity(content, characteristics) {
    let complexity = 0.5; // Base complexity
    
    // Content length factor
    if (content.length > 1000) complexity += 0.2;
    if (content.length > 2000) complexity += 0.1;
    
    // Characteristic factors
    if (characteristics.isProcedural) complexity += 0.1;
    if (characteristics.hasStepByStep) complexity += 0.1;
    if (characteristics.hasDefinitions) complexity += 0.1;
    
    return Math.min(1.0, complexity);
  }

  /**
   * Check for step-by-step content
   */
  hasStepByStepContent(content) {
    const stepPatterns = [
      /step\s+\d+/gi,
      /^\s*\d+\.\s+/gm,
      /first[,\s]/gi,
      /second[,\s]/gi,
      /third[,\s]/gi,
      /next[,\s]/gi,
      /then[,\s]/gi,
      /finally[,\s]/gi
    ];
    
    return stepPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Recommend chunking strategy based on detection results
   */
  recommendChunkingStrategy(results, content) {
    try {
      // Base strategy on primary type
      switch (results.primaryType) {
        case 'procedural':
          return this.hasStepByStepContent(content) ? 'step_by_step' : 'hierarchical';
        case 'faq':
          return 'qa_pairs';
        case 'conceptual':
          return this.hasDefinitions(content) ? 'definition_based' : 'semantic';
        case 'reference':
          return 'structured';
        case 'troubleshooting':
          return 'problem_solution';
        case 'example':
          return 'example_based';
        default:
          return 'semantic';
      }
    } catch (error) {
      return 'simple';
    }
  }

  /**
   * Perform structural analysis
   */
  async performStructuralAnalysis(content, context) {
    try {
      logger.debug('🏗️ Performing structural analysis...');
      
      const structure = {
        hasHeadings: /^#+\s/.test(content) || (context.headings && context.headings.length > 0),
        hasList: /^\s*[-*+]\s|\d+\.\s/m.test(content),
        hasQuestions: /\?/g.test(content),
        hasSteps: /step\s+\d+|^\s*\d+\.\s/gmi.test(content),
        hasCodeBlocks: /```|`[^`]+`/.test(content),
        hasTables: /\|.*\|/.test(content)
      };
      
      return {
        structure,
        confidence: 0.7,
        characteristics: structure
      };
      
    } catch (error) {
      logger.error('❌ Structural analysis failed:', error);
      return {
        structure: {},
        confidence: 0.1,
        characteristics: {},
        error: error.message
      };
    }
  }

  /**
   * Assess content quality
   */
  assessContentQuality(content) {
    try {
      const wordCount = content.split(/\s+/).length;
      const sentenceCount = content.split(/[.!?]+/).length;
      const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);
      
      let qualityScore = 0.5;
      
      // Length factor
      if (wordCount > 50) qualityScore += 0.2;
      if (wordCount > 200) qualityScore += 0.1;
      
      // Structure factor
      if (avgWordsPerSentence > 8 && avgWordsPerSentence < 25) qualityScore += 0.1;
      
      // Content richness
      if (/[A-Z][a-z]+/.test(content)) qualityScore += 0.1; // Proper capitalization
      
      return {
        score: Math.min(qualityScore, 1.0),
        wordCount,
        sentenceCount,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10
      };
      
    } catch (error) {
      logger.error('❌ Content quality assessment failed:', error);
      return {
        score: 0.1,
        wordCount: 0,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        error: error.message
      };
    }
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.detectionCache.clear();
    logger.info('🧹 Semantic section detector caches cleared');
  }
}

module.exports = SemanticSectionDetector;
