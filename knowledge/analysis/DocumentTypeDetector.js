/**
 * Document Type Detector
 * Intelligent document classification and processing strategy selection
 * Production-ready with comprehensive error handling and logging
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// Document processing dependencies with graceful fallbacks
let mammoth = null;
let pdfParse = null;
let htmlToText = null;

try {
  mammoth = require('mammoth');
} catch (error) {
  logger.warn('⚠️ mammoth not available - DOCX processing will be limited');
}

try {
  pdfParse = require('pdf-parse');
} catch (error) {
  logger.warn('⚠️ pdf-parse not available - PDF processing will be limited');
}

try {
  htmlToText = require('html-to-text');
} catch (error) {
  logger.warn('⚠️ html-to-text not available - HTML processing will be limited');
}

class DocumentTypeDetector {
  constructor(options = {}) {
    this.options = {
      // Detection confidence thresholds
      confidenceThresholds: {
        high: 0.8,
        medium: 0.6,
        low: 0.4
      },
      
      // Document type patterns
      typePatterns: {
        userGuide: {
          titlePatterns: [/user\s+guide/i, /manual/i, /handbook/i],
          contentPatterns: [/step\s+\d+/i, /how\s+to/i, /instructions/i, /procedure/i],
          structurePatterns: [/table\s+of\s+contents/i, /introduction/i, /getting\s+started/i],
          weight: 1.0
        },
        quickStart: {
          titlePatterns: [/quick\s+start/i, /getting\s+started/i, /setup/i],
          contentPatterns: [/step\s+\d+/i, /first/i, /begin/i, /start/i],
          structurePatterns: [/prerequisites/i, /requirements/i],
          weight: 0.9
        },
        technicalSpec: {
          titlePatterns: [/specification/i, /technical/i, /api/i, /reference/i],
          contentPatterns: [/parameter/i, /function/i, /method/i, /class/i],
          structurePatterns: [/syntax/i, /examples/i, /parameters/i],
          weight: 0.8
        },
        faq: {
          titlePatterns: [/faq/i, /frequently\s+asked/i, /questions/i],
          contentPatterns: [/\?/g, /question/i, /answer/i, /q:/i, /a:/i],
          structurePatterns: [/q\d+/i, /question\s+\d+/i],
          weight: 0.7
        },
        troubleshooting: {
          titlePatterns: [/troubleshoot/i, /problem/i, /issue/i, /error/i],
          contentPatterns: [/error/i, /problem/i, /solution/i, /fix/i, /resolve/i],
          structurePatterns: [/symptom/i, /cause/i, /resolution/i],
          weight: 0.6
        }
      },
      
      // Format detection patterns
      formatPatterns: {
        docx: {
          extensions: ['.docx', '.doc'],
          mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          signatures: ['PK\x03\x04']
        },
        pdf: {
          extensions: ['.pdf'],
          mimeTypes: ['application/pdf'],
          signatures: ['%PDF-']
        },
        pptx: {
          extensions: ['.pptx', '.ppt'],
          mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
          signatures: ['PK\x03\x04']
        },
        xlsx: {
          extensions: ['.xlsx', '.xls'],
          mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          signatures: ['PK\x03\x04']
        },
        html: {
          extensions: ['.html', '.htm'],
          mimeTypes: ['text/html'],
          signatures: ['<!DOCTYPE', '<html', '<HTML']
        },
        markdown: {
          extensions: ['.md', '.markdown'],
          mimeTypes: ['text/markdown', 'text/x-markdown'],
          signatures: ['#', '##', '###']
        }
      },
      
      // Content analysis options
      contentAnalysis: {
        sampleSize: 5000, // First 5KB for analysis
        minConfidenceForClassification: 0.4,
        enableDeepAnalysis: true,
        cacheResults: true
      },
      
      ...options
    };

    // Initialize caches
    this.analysisCache = new Map();
    this.hashCache = new Map();
    
    // Statistics tracking
    this.stats = {
      documentsAnalyzed: 0,
      typeDistribution: {},
      averageConfidence: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Main document type detection method
   * @param {string} filePath - Path to the document file
   * @param {Object} metadata - Optional metadata about the document
   * @returns {Promise<Object>} Detection result with type, confidence, and processing strategy
   */
  async detectDocumentType(filePath, metadata = {}) {
    const startTime = Date.now();
    
    try {
      logger.info(`🔍 Analyzing document type: ${path.basename(filePath)}`);
      
      // Generate document hash for caching
      const documentHash = await this.generateDocumentHash(filePath);
      
      // Check cache first
      if (this.options.contentAnalysis.cacheResults && this.analysisCache.has(documentHash)) {
        logger.debug(`📋 Using cached analysis for ${path.basename(filePath)}`);
        this.stats.cacheHitRate++;
        return this.analysisCache.get(documentHash);
      }
      
      // Perform comprehensive analysis
      const analysisResult = await this.performComprehensiveAnalysis(filePath, metadata);
      
      // Cache result if enabled
      if (this.options.contentAnalysis.cacheResults) {
        this.analysisCache.set(documentHash, analysisResult);
      }
      
      // Update statistics
      this.updateStatistics(analysisResult);
      
      const processingTime = Date.now() - startTime;
      logger.info(`✅ Document type detected: ${analysisResult.type} (${Math.round(analysisResult.confidence * 100)}% confidence) in ${processingTime}ms`);
      
      return {
        ...analysisResult,
        processingTime,
        documentHash
      };
      
    } catch (error) {
      logger.error(`❌ Document type detection failed for ${filePath}:`, error);
      
      // Return fallback result
      return this.generateFallbackResult(filePath, error);
    }
  }

  /**
   * Perform comprehensive document analysis
   * @param {string} filePath - Path to the document
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Analysis result
   */
  async performComprehensiveAnalysis(filePath, metadata) {
    // Step 1: Format detection
    const formatResult = await this.detectFormat(filePath);
    
    // Step 2: Content extraction and analysis
    const contentResult = await this.analyzeContent(filePath, formatResult.format);
    
    // Step 3: Structure analysis
    const structureResult = await this.analyzeStructure(contentResult.content, contentResult.metadata);
    
    // Step 4: Type classification
    const typeResult = await this.classifyDocumentType(
      contentResult.content,
      structureResult,
      formatResult,
      metadata
    );
    
    // Step 5: Processing strategy selection
    const strategyResult = await this.selectProcessingStrategy(typeResult, formatResult, structureResult);
    
    return {
      // Core identification
      type: typeResult.type,
      subtype: typeResult.subtype,
      confidence: typeResult.confidence,
      
      // Format information
      format: formatResult.format,
      formatConfidence: formatResult.confidence,
      
      // Content characteristics
      contentCharacteristics: contentResult.characteristics,
      structureCharacteristics: structureResult.characteristics,
      
      // Processing recommendations
      processingStrategy: strategyResult.strategy,
      processingOptions: strategyResult.options,
      
      // Quality indicators
      qualityIndicators: {
        hasStructure: structureResult.hasStructure,
        hasHeadings: structureResult.hasHeadings,
        hasProcedures: contentResult.hasProcedures,
        hasDefinitions: contentResult.hasDefinitions,
        contentQuality: contentResult.quality
      },
      
      // Metadata
      metadata: {
        fileSize: formatResult.fileSize,
        estimatedWordCount: contentResult.wordCount,
        estimatedReadingTime: Math.ceil(contentResult.wordCount / 200), // 200 WPM
        language: contentResult.language || 'en',
        complexity: this.assessComplexity(contentResult, structureResult)
      }
    };
  }

  /**
   * Detect document format
   * @param {string} filePath - Path to the document
   * @returns {Promise<Object>} Format detection result
   */
  async detectFormat(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath).toLowerCase();
      
      // Read file signature
      const buffer = await fs.readFile(filePath);
      const signature = buffer.slice(0, 10).toString();
      
      // Detect format based on extension and signature
      for (const [format, patterns] of Object.entries(this.options.formatPatterns)) {
        let confidence = 0;
        
        // Check extension
        if (patterns.extensions.includes(extension)) {
          confidence += 0.6;
        }
        
        // Check signature
        if (patterns.signatures.some(sig => signature.startsWith(sig))) {
          confidence += 0.4;
        }
        
        if (confidence >= 0.6) {
          return {
            format,
            confidence,
            fileSize: stats.size,
            extension,
            signature: signature.slice(0, 4)
          };
        }
      }
      
      // Fallback to extension-based detection
      const fallbackFormat = this.detectFormatByExtension(extension);
      return {
        format: fallbackFormat || 'unknown',
        confidence: fallbackFormat ? 0.3 : 0.1,
        fileSize: stats.size,
        extension,
        signature: signature.slice(0, 4)
      };
      
    } catch (error) {
      logger.error(`❌ Format detection failed:`, error);
      return {
        format: 'unknown',
        confidence: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Analyze document content
   * @param {string} filePath - Path to the document
   * @param {string} format - Detected format
   * @returns {Promise<Object>} Content analysis result
   */
  async analyzeContent(filePath, format) {
    try {
      // Extract text content based on format
      const textContent = await this.extractTextContent(filePath, format);
      
      // Analyze content sample
      const sampleContent = textContent.slice(0, this.options.contentAnalysis.sampleSize);
      
      // Perform content analysis
      const characteristics = {
        wordCount: this.countWords(textContent),
        sentenceCount: this.countSentences(textContent),
        paragraphCount: this.countParagraphs(textContent),
        hasStepByStep: this.detectStepByStep(sampleContent),
        hasProcedures: this.detectProcedures(sampleContent),
        hasDefinitions: this.detectDefinitions(sampleContent),
        hasQuestions: this.detectQuestions(sampleContent),
        hasTechnicalTerms: this.detectTechnicalTerms(sampleContent),
        hasCodeExamples: this.detectCodeExamples(sampleContent)
      };
      
      // Assess content quality
      const quality = this.assessContentQuality(textContent, characteristics);
      
      // Detect language
      const language = this.detectLanguage(sampleContent);
      
      return {
        content: textContent,
        sampleContent,
        characteristics,
        quality,
        language,
        wordCount: characteristics.wordCount
      };
      
    } catch (error) {
      logger.error(`❌ Content analysis failed:`, error);
      return {
        content: '',
        characteristics: {},
        quality: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Analyze document structure
   * @param {string} content - Document content
   * @param {Object} metadata - Content metadata
   * @returns {Promise<Object>} Structure analysis result
   */
  async analyzeStructure(content, metadata) {
    try {
      const lines = content.split('\n');
      
      // Detect headings
      const headings = this.detectHeadings(lines);
      
      // Detect sections
      const sections = this.detectSections(lines, headings);
      
      // Detect lists
      const lists = this.detectLists(lines);
      
      // Detect tables
      const tables = this.detectTables(content);
      
      // Analyze document hierarchy
      const hierarchy = this.analyzeHierarchy(headings, sections);
      
      const characteristics = {
        hasStructure: headings.length > 0 || sections.length > 0,
        hasHeadings: headings.length > 0,
        hasSections: sections.length > 0,
        hasLists: lists.length > 0,
        hasTables: tables.length > 0,
        hasHierarchy: hierarchy.depth > 1,
        structureComplexity: this.calculateStructureComplexity(headings, sections, lists, tables)
      };
      
      return {
        characteristics,
        headings,
        sections,
        lists,
        tables,
        hierarchy,
        hasStructure: characteristics.hasStructure,
        hasHeadings: characteristics.hasHeadings
      };
      
    } catch (error) {
      logger.error(`❌ Structure analysis failed:`, error);
      return {
        characteristics: { hasStructure: false, hasHeadings: false },
        headings: [],
        sections: [],
        lists: [],
        tables: [],
        hierarchy: { depth: 0 },
        hasStructure: false,
        hasHeadings: false
      };
    }
  }

  /**
   * Classify document type based on analysis
   * @param {string} content - Document content
   * @param {Object} structureResult - Structure analysis result
   * @param {Object} formatResult - Format detection result
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Type classification result
   */
  async classifyDocumentType(content, structureResult, formatResult, metadata) {
    try {
      const scores = {};
      
      // Calculate scores for each document type
      for (const [typeName, typeConfig] of Object.entries(this.options.typePatterns)) {
        let score = 0;
        
        // Title pattern matching
        const titleScore = this.calculateTitleScore(metadata.filename || '', typeConfig.titlePatterns);
        score += titleScore * 0.3;
        
        // Content pattern matching
        const contentScore = this.calculateContentScore(content, typeConfig.contentPatterns);
        score += contentScore * 0.4;
        
        // Structure pattern matching
        const structureScore = this.calculateStructureScore(structureResult, typeConfig.structurePatterns);
        score += structureScore * 0.3;
        
        // Apply type weight
        score *= typeConfig.weight;
        
        scores[typeName] = score;
      }
      
      // Find best match
      const bestMatch = Object.entries(scores).reduce((best, [type, score]) => 
        score > best.score ? { type, score } : best, 
        { type: 'unknown', score: 0 }
      );
      
      // Determine subtype based on content characteristics
      const subtype = this.determineSubtype(bestMatch.type, content, structureResult);
      
      // Normalize confidence
      const confidence = Math.min(bestMatch.score, 1.0);
      
      return {
        type: confidence >= this.options.contentAnalysis.minConfidenceForClassification ? bestMatch.type : 'unknown',
        subtype,
        confidence,
        allScores: scores,
        reasoning: this.generateClassificationReasoning(bestMatch, scores, structureResult)
      };
      
    } catch (error) {
      logger.error(`❌ Document type classification failed:`, error);
      return {
        type: 'unknown',
        subtype: null,
        confidence: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Select optimal processing strategy
   * @param {Object} typeResult - Type classification result
   * @param {Object} formatResult - Format detection result
   * @param {Object} structureResult - Structure analysis result
   * @returns {Promise<Object>} Processing strategy result
   */
  async selectProcessingStrategy(typeResult, formatResult, structureResult) {
    try {
      const strategies = {
        userGuide: {
          strategy: 'procedure_optimized',
          options: {
            preserveStepSequences: true,
            enhanceInstructions: true,
            extractProcedures: true,
            chunkingStrategy: 'semantic_with_procedures'
          }
        },
        quickStart: {
          strategy: 'step_by_step_optimized',
          options: {
            preserveStepSequences: true,
            enhanceGettingStarted: true,
            prioritizeEarlyContent: true,
            chunkingStrategy: 'sequential_with_context'
          }
        },
        technicalSpec: {
          strategy: 'reference_optimized',
          options: {
            preserveStructure: true,
            enhanceDefinitions: true,
            extractApiElements: true,
            chunkingStrategy: 'hierarchical_with_references'
          }
        },
        faq: {
          strategy: 'qa_optimized',
          options: {
            preserveQuestionAnswerPairs: true,
            enhanceQuestions: true,
            groupRelatedQAs: true,
            chunkingStrategy: 'qa_pair_preservation'
          }
        },
        troubleshooting: {
          strategy: 'problem_solution_optimized',
          options: {
            preserveProblemSolutionPairs: true,
            enhanceTroubleshooting: true,
            extractSymptomCauseSolution: true,
            chunkingStrategy: 'problem_solution_grouping'
          }
        },
        unknown: {
          strategy: 'general_purpose',
          options: {
            adaptiveProcessing: true,
            conservativeChunking: true,
            basicEnhancement: true,
            chunkingStrategy: 'adaptive_semantic'
          }
        }
      };
      
      const baseStrategy = strategies[typeResult.type] || strategies.unknown;
      
      // Customize strategy based on format and structure
      const customizedOptions = this.customizeStrategyOptions(
        baseStrategy.options,
        formatResult,
        structureResult,
        typeResult
      );
      
      return {
        strategy: baseStrategy.strategy,
        options: customizedOptions,
        reasoning: this.generateStrategyReasoning(typeResult, formatResult, structureResult)
      };
      
    } catch (error) {
      logger.error(`❌ Processing strategy selection failed:`, error);
      return {
        strategy: 'general_purpose',
        options: { adaptiveProcessing: true },
        error: error.message
      };
    }
  }

  // Helper methods for content analysis

  /**
   * Extract text content based on format
   */
  async extractTextContent(filePath, format) {
    // This would integrate with format-specific parsers
    // For now, return placeholder - will be implemented with actual parsers
    try {
      switch (format) {
        case 'docx':
          return await this.extractDocxText(filePath);
        case 'pdf':
          return await this.extractPdfText(filePath);
        case 'html':
          return await this.extractHtmlText(filePath);
        case 'markdown':
          return await this.extractMarkdownText(filePath);
        default:
          // Fallback to reading as text
          return await fs.readFile(filePath, 'utf-8');
      }
    } catch (error) {
      logger.error(`❌ Text extraction failed for format ${format}:`, error);
      return '';
    }
  }

  /**
   * Extract text from DOCX files
   */
  async extractDocxText(filePath) {
    try {
      if (!mammoth) {
        logger.warn('⚠️ mammoth not available - using fallback text extraction for DOCX');
        // Fallback: return basic file info for analysis
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: Microsoft Word Document`;
      }
      
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch (error) {
      logger.error('❌ DOCX text extraction failed:', error);
      // Fallback: return basic file info
      try {
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: Microsoft Word Document (extraction failed)`;
      } catch (fallbackError) {
        return '';
      }
    }
  }

  /**
   * Extract text from PDF files
   */
  async extractPdfText(filePath) {
    try {
      if (!pdfParse) {
        logger.warn('⚠️ pdf-parse not available - using fallback text extraction for PDF');
        // Fallback: return basic file info for analysis
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: PDF Document`;
      }
      
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text || '';
    } catch (error) {
      logger.error('❌ PDF text extraction failed:', error);
      // Fallback: return basic file info
      try {
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: PDF Document (extraction failed)`;
      } catch (fallbackError) {
        return '';
      }
    }
  }

  /**
   * Extract text from HTML files
   */
  async extractHtmlText(filePath) {
    try {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      
      if (!htmlToText) {
        logger.warn('⚠️ html-to-text not available - using basic HTML text extraction');
        // Fallback: basic HTML tag removal
        return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      
      const { convert } = htmlToText;
      return convert(htmlContent);
    } catch (error) {
      logger.error('❌ HTML text extraction failed:', error);
      // Fallback: return basic file info
      try {
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: HTML Document (extraction failed)`;
      } catch (fallbackError) {
        return '';
      }
    }
  }

  /**
   * Extract text from Markdown files
   */
  async extractMarkdownText(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // Remove markdown formatting for plain text analysis
      return content.replace(/[#*_`\[\]()]/g, '');
    } catch (error) {
      logger.error('❌ Markdown text extraction failed:', error);
      return '';
    }
  }

  /**
   * Assess document complexity
   * @param {Object} contentResult - Content analysis result
   * @param {Object} structureResult - Structure analysis result
   * @returns {string} Complexity level (simple, moderate, complex)
   */
  assessComplexity(contentResult, structureResult) {
    try {
      let complexityScore = 0;
      
      // Word count factor
      if (contentResult.wordCount > 10000) {
        complexityScore += 3;
      } else if (contentResult.wordCount > 5000) {
        complexityScore += 2;
      } else if (contentResult.wordCount > 1000) {
        complexityScore += 1;
      }
      
      // Structure complexity
      if (structureResult.hasHeadings) {
        complexityScore += 1;
      }
      if (structureResult.hasStructure) {
        complexityScore += 1;
      }
      
      // Content type complexity
      if (contentResult.hasProcedures) {
        complexityScore += 1;
      }
      if (contentResult.hasDefinitions) {
        complexityScore += 1;
      }
      
      // Determine complexity level
      if (complexityScore >= 5) {
        return 'complex';
      } else if (complexityScore >= 3) {
        return 'moderate';
      } else {
        return 'simple';
      }
    } catch (error) {
      logger.warn('⚠️ Complexity assessment failed:', error);
      return 'moderate'; // Default fallback
    }
  }

  /**
   * Detect step-by-step content
   */
  detectStepByStep(content) {
    const stepPatterns = [
      /step\s+\d+/gi,
      /\d+\.\s+/g,
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
   * Detect procedural content
   */
  detectProcedures(content) {
    const procedurePatterns = [
      /navigate\s+to/gi,
      /click\s+(?:on\s+)?the/gi,
      /select\s+/gi,
      /choose\s+/gi,
      /enter\s+/gi,
      /type\s+/gi,
      /press\s+/gi,
      /follow\s+these\s+steps/gi
    ];
    
    return procedurePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect definitions
   */
  detectDefinitions(content) {
    const definitionPatterns = [
      /\w+\s+(?:is|are|means?|refers?\s+to)/gi,
      /definition\s*:/gi,
      /defined\s+as/gi,
      /\w+\s*:\s*[A-Z]/g
    ];
    
    return definitionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect questions
   */
  detectQuestions(content) {
    const questionPatterns = [
      /\?/g,
      /^q\d*[:.]/gim,
      /question\s*\d*/gi,
      /how\s+(?:do|can|to)/gi,
      /what\s+(?:is|are|does)/gi,
      /why\s+(?:is|are|does)/gi,
      /when\s+(?:is|are|does)/gi,
      /where\s+(?:is|are|can)/gi
    ];
    
    const questionCount = questionPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
    
    return questionCount > 2; // Threshold for question-heavy content
  }

  /**
   * Detect technical terms
   */
  detectTechnicalTerms(content) {
    const technicalPatterns = [
      /API/gi,
      /function/gi,
      /method/gi,
      /parameter/gi,
      /variable/gi,
      /class/gi,
      /object/gi,
      /array/gi,
      /string/gi,
      /integer/gi,
      /boolean/gi,
      /null/gi,
      /undefined/gi
    ];
    
    return technicalPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect code examples
   */
  detectCodeExamples(content) {
    const codePatterns = [
      /```[\s\S]*?```/g,
      /`[^`]+`/g,
      /^\s*[\w\$_]+\s*\(/gm,
      /^\s*[\w\$_]+\s*=/gm,
      /^\s*if\s*\(/gm,
      /^\s*for\s*\(/gm,
      /^\s*while\s*\(/gm
    ];
    
    return codePatterns.some(pattern => pattern.test(content));
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
   * Count paragraphs in content
   */
  countParagraphs(content) {
    return content.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0).length;
  }

  /**
   * Assess content quality
   */
  assessContentQuality(content, characteristics) {
    let quality = 0.5; // Base quality
    
    // Length factor
    const wordCount = characteristics.wordCount;
    if (wordCount > 100) quality += 0.1;
    if (wordCount > 500) quality += 0.1;
    if (wordCount > 1000) quality += 0.1;
    
    // Structure factor
    if (characteristics.hasStepByStep) quality += 0.1;
    if (characteristics.hasProcedures) quality += 0.1;
    if (characteristics.hasDefinitions) quality += 0.1;
    
    // Readability factor
    const avgWordsPerSentence = wordCount / characteristics.sentenceCount;
    if (avgWordsPerSentence > 10 && avgWordsPerSentence < 25) quality += 0.1;
    
    return Math.min(1.0, quality);
  }

  /**
   * Detect language (basic implementation)
   */
  detectLanguage(content) {
    // Simple English detection - could be enhanced with proper language detection library
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = content.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(word => englishWords.includes(word)).length;
    const englishRatio = englishWordCount / Math.min(words.length, 100);
    
    return englishRatio > 0.1 ? 'en' : 'unknown';
  }

  /**
   * Generate document hash for caching
   */
  async generateDocumentHash(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const hashInput = `${filePath}_${stats.size}_${stats.mtime.getTime()}`;
      return crypto.createHash('md5').update(hashInput).digest('hex');
    } catch (error) {
      return crypto.createHash('md5').update(filePath).digest('hex');
    }
  }

  /**
   * Update statistics
   */
  updateStatistics(result) {
    this.stats.documentsAnalyzed++;
    
    if (!this.stats.typeDistribution[result.type]) {
      this.stats.typeDistribution[result.type] = 0;
    }
    this.stats.typeDistribution[result.type]++;
    
    // Update average confidence
    const totalConfidence = this.stats.averageConfidence * (this.stats.documentsAnalyzed - 1) + result.confidence;
    this.stats.averageConfidence = totalConfidence / this.stats.documentsAnalyzed;
  }

  /**
   * Generate fallback result for errors
   */
  generateFallbackResult(filePath, error) {
    return {
      type: 'unknown',
      subtype: null,
      confidence: 0.1,
      format: this.detectFormatByExtension(path.extname(filePath)),
      formatConfidence: 0.3,
      processingStrategy: 'general_purpose',
      processingOptions: { adaptiveProcessing: true },
      error: error.message,
      fallback: true
    };
  }

  /**
   * Detect format by extension (fallback)
   */
  detectFormatByExtension(extension) {
    const extensionMap = {
      '.docx': 'docx',
      '.doc': 'docx',
      '.pdf': 'pdf',
      '.pptx': 'pptx',
      '.ppt': 'pptx',
      '.xlsx': 'xlsx',
      '.xls': 'xlsx',
      '.html': 'html',
      '.htm': 'html',
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.txt': 'text'
    };
    
    return extensionMap[extension.toLowerCase()] || 'unknown';
  }

  /**
   * Detect headings in document lines
   * @param {Array} lines - Document lines
   * @returns {Array} Detected headings
   */
  detectHeadings(lines) {
    const headings = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Markdown-style headings
      if (/^#{1,6}\s+/.test(line)) {
        const level = line.match(/^(#{1,6})/)[1].length;
        headings.push({
          text: line.replace(/^#{1,6}\s+/, ''),
          level,
          lineNumber: i + 1,
          type: 'markdown'
        });
      }
      
      // Title case headings (likely headings if they're short and capitalized)
      else if (line.length > 0 && line.length < 100 && 
               /^[A-Z][^.!?]*$/.test(line) && 
               !line.includes(',')) {
        headings.push({
          text: line,
          level: 1,
          lineNumber: i + 1,
          type: 'title'
        });
      }
    }
    
    return headings;
  }

  /**
   * Detect sections in document
   * @param {Array} lines - Document lines
   * @param {Array} headings - Detected headings
   * @returns {Array} Detected sections
   */
  detectSections(lines, headings) {
    const sections = [];
    
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextHeading = headings[i + 1];
      
      const startLine = heading.lineNumber;
      const endLine = nextHeading ? nextHeading.lineNumber - 1 : lines.length;
      
      const sectionLines = lines.slice(startLine, endLine);
      const content = sectionLines.join('\n').trim();
      
      if (content.length > 0) {
        sections.push({
          title: heading.text,
          level: heading.level,
          startLine,
          endLine,
          content,
          wordCount: content.split(/\s+/).length
        });
      }
    }
    
    return sections;
  }

  /**
   * Detect lists in document
   * @param {Array} lines - Document lines
   * @returns {Array} Detected lists
   */
  detectLists(lines) {
    const lists = [];
    let currentList = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Bullet lists
      if (/^[-*+]\s+/.test(line)) {
        if (!currentList || currentList.type !== 'bullet') {
          if (currentList) lists.push(currentList);
          currentList = {
            type: 'bullet',
            startLine: i + 1,
            items: []
          };
        }
        currentList.items.push({
          text: line.replace(/^[-*+]\s+/, ''),
          lineNumber: i + 1
        });
      }
      
      // Numbered lists
      else if (/^\d+\.\s+/.test(line)) {
        if (!currentList || currentList.type !== 'numbered') {
          if (currentList) lists.push(currentList);
          currentList = {
            type: 'numbered',
            startLine: i + 1,
            items: []
          };
        }
        currentList.items.push({
          text: line.replace(/^\d+\.\s+/, ''),
          lineNumber: i + 1
        });
      }
      
      // End current list if we hit a non-list line
      else if (line.length > 0 && currentList) {
        currentList.endLine = i;
        lists.push(currentList);
        currentList = null;
      }
    }
    
    // Add final list if exists
    if (currentList) {
      currentList.endLine = lines.length;
      lists.push(currentList);
    }
    
    return lists;
  }

  /**
   * Detect tables in document content
   * @param {string} content - Document content
   * @returns {Array} Detected tables
   */
  detectTables(content) {
    const tables = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Simple table detection (pipe-separated)
      if (line.includes('|') && line.split('|').length >= 3) {
        const columns = line.split('|').map(col => col.trim()).filter(col => col.length > 0);
        
        if (columns.length >= 2) {
          tables.push({
            lineNumber: i + 1,
            columns: columns.length,
            content: line
          });
        }
      }
    }
    
    return tables;
  }

  /**
   * Analyze document hierarchy
   * @param {Array} headings - Detected headings
   * @param {Array} sections - Detected sections
   * @returns {Object} Hierarchy analysis
   */
  analyzeHierarchy(headings, sections) {
    const levels = headings.map(h => h.level);
    const uniqueLevels = [...new Set(levels)];
    
    return {
      depth: uniqueLevels.length,
      maxLevel: Math.max(...levels, 0),
      minLevel: Math.min(...levels, 1),
      hasNestedStructure: uniqueLevels.length > 1,
      sectionCount: sections.length,
      averageSectionLength: sections.length > 0 
        ? sections.reduce((sum, s) => sum + s.wordCount, 0) / sections.length 
        : 0
    };
  }

  /**
   * Calculate structure complexity score
   * @param {Array} headings - Detected headings
   * @param {Array} sections - Detected sections
   * @param {Array} lists - Detected lists
   * @param {Array} tables - Detected tables
   * @returns {number} Complexity score (0-1)
   */
  calculateStructureComplexity(headings, sections, lists, tables) {
    let score = 0;
    
    // Heading complexity
    if (headings.length > 0) {
      score += Math.min(headings.length / 10, 0.3);
    }
    
    // Section complexity
    if (sections.length > 0) {
      score += Math.min(sections.length / 8, 0.25);
    }
    
    // List complexity
    if (lists.length > 0) {
      const totalListItems = lists.reduce((sum, list) => sum + list.items.length, 0);
      score += Math.min(totalListItems / 20, 0.2);
    }
    
    // Table complexity
    if (tables.length > 0) {
      score += Math.min(tables.length / 5, 0.25);
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Get detection statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheSize: this.analysisCache.size,
      cacheHitRate: this.stats.cacheHitRate / Math.max(this.stats.documentsAnalyzed, 1)
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.analysisCache.clear();
    this.hashCache.clear();
    logger.info('🧹 Document type detector caches cleared');
  }

  /**
   * Calculate title score for document type classification
   * @param {string} content - Document content
   * @param {Object} metadata - Document metadata
   * @returns {number} Title score (0-1)
   */
  calculateTitleScore(content, metadata = {}) {
    try {
      const filename = metadata.filename || '';
      const title = metadata.title || '';
      
      let score = 0;
      
      // Check filename patterns
      for (const [type, patterns] of Object.entries(this.options.typePatterns)) {
        for (const pattern of patterns.titlePatterns || []) {
          if (pattern.test(filename) || pattern.test(title)) {
            score = Math.max(score, patterns.weight * 0.8);
          }
        }
      }
      
      // Check content for title indicators
      const lines = content.split('\n').slice(0, 10); // Check first 10 lines
      for (const line of lines) {
        for (const [type, patterns] of Object.entries(this.options.typePatterns)) {
          for (const pattern of patterns.titlePatterns || []) {
            if (pattern.test(line)) {
              score = Math.max(score, patterns.weight * 0.6);
            }
          }
        }
      }
      
      return Math.min(score, 1.0);
    } catch (error) {
      logger.warn('⚠️ Title score calculation failed:', error.message);
      return 0.1;
    }
  }

  /**
   * Customize strategy options based on document characteristics
   * @param {Object} typeResult - Type classification result
   * @param {Object} formatResult - Format detection result
   * @param {Object} structureResult - Structure analysis result
   * @returns {Object} Customized strategy options
   */
  customizeStrategyOptions(typeResult, formatResult, structureResult) {
    try {
      const options = {
        adaptiveProcessing: true,
        chunkingStrategy: 'semantic',
        qualityThreshold: 0.5
      };
      
      // Customize based on document type
      switch (typeResult.type) {
        case 'userGuide':
          options.chunkingStrategy = 'hierarchical';
          options.preserveStructure = true;
          options.qualityThreshold = 0.6;
          break;
          
        case 'faq':
          options.chunkingStrategy = 'qa_pairs';
          options.preserveQuestions = true;
          options.qualityThreshold = 0.7;
          break;
          
        case 'technicalSpec':
          options.chunkingStrategy = 'technical';
          options.preserveCodeBlocks = true;
          options.qualityThreshold = 0.8;
          break;
          
        default:
          options.chunkingStrategy = 'general';
          break;
      }
      
      // Customize based on structure complexity
      if (structureResult.characteristics && structureResult.characteristics.hasStructure) {
        options.preserveHierarchy = true;
        options.respectSectionBoundaries = true;
      }
      
      // Customize based on format
      if (formatResult.format === 'docx') {
        options.preserveFormatting = true;
        options.extractTables = true;
      }
      
      return options;
    } catch (error) {
      logger.warn('⚠️ Strategy options customization failed:', error.message);
      return { adaptiveProcessing: true };
    }
  }

  /**
   * Classify document type based on content and structure
   * @param {string} content - Document content
   * @param {Object} structureResult - Structure analysis result
   * @param {Object} formatResult - Format detection result
   * @param {Object} metadata - Document metadata
   * @returns {Object} Classification result
   */
  async classifyDocumentType(content, structureResult, formatResult, metadata = {}) {
    try {
      logger.debug('🔍 Classifying document type...');
      
      let bestType = 'unknown';
      let bestScore = 0;
      let bestSubtype = null;
      
      // Calculate scores for each document type
      for (const [type, patterns] of Object.entries(this.options.typePatterns)) {
        let score = 0;
        
        // Title score
        const titleScore = this.calculateTitleScore(content, { 
          filename: metadata.filename || '',
          title: metadata.title || ''
        });
        score += titleScore * 0.3;
        
        // Content pattern score
        for (const pattern of patterns.contentPatterns || []) {
          const matches = content.match(pattern);
          if (matches) {
            score += (matches.length / 100) * patterns.weight * 0.4;
          }
        }
        
        // Structure pattern score
        for (const pattern of patterns.structurePatterns || []) {
          if (pattern.test(content)) {
            score += patterns.weight * 0.3;
          }
        }
        
        // Apply type-specific bonuses
        if (type === 'userGuide' && content.toLowerCase().includes('user guide')) {
          score += 0.2;
        }
        if (type === 'faq' && content.includes('?')) {
          const questionCount = (content.match(/\?/g) || []).length;
          score += Math.min(questionCount / 20, 0.2);
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestType = type;
        }
      }
      
      // Determine confidence
      let confidence = Math.min(bestScore, 1.0);
      
      // Apply confidence thresholds
      if (confidence >= this.options.confidenceThresholds.high) {
        confidence = Math.min(confidence, 0.95);
      } else if (confidence >= this.options.confidenceThresholds.medium) {
        confidence = Math.min(confidence, 0.75);
      } else if (confidence >= this.options.confidenceThresholds.low) {
        confidence = Math.min(confidence, 0.55);
      } else {
        bestType = 'unknown';
        confidence = 0.1;
      }
      
      logger.debug(`📊 Document classified as: ${bestType} (confidence: ${confidence.toFixed(2)})`);
      
      return {
        type: bestType,
        subtype: bestSubtype,
        confidence: confidence,
        scores: { titleScore: this.calculateTitleScore(content, metadata) }
      };
      
    } catch (error) {
      logger.error('❌ Document type classification failed:', error);
      return {
        type: 'unknown',
        subtype: null,
        confidence: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Select processing strategy based on document analysis
   * @param {Object} typeResult - Type classification result
   * @param {Object} formatResult - Format detection result
   * @param {Object} structureResult - Structure analysis result
   * @returns {Object} Processing strategy
   */
  async selectProcessingStrategy(typeResult, formatResult, structureResult) {
    try {
      logger.debug('🎯 Selecting processing strategy...');
      
      let strategy = 'general_purpose';
      
      // Select strategy based on document type
      switch (typeResult.type) {
        case 'userGuide':
          strategy = 'hierarchical_processing';
          break;
        case 'faq':
          strategy = 'qa_extraction';
          break;
        case 'technicalSpec':
          strategy = 'technical_documentation';
          break;
        case 'quickStart':
          strategy = 'step_by_step_processing';
          break;
        case 'troubleshooting':
          strategy = 'problem_solution_extraction';
          break;
        default:
          strategy = 'general_purpose';
          break;
      }
      
      // Customize strategy options
      const options = this.customizeStrategyOptions(typeResult, formatResult, structureResult);
      
      logger.debug(`🎯 Selected strategy: ${strategy}`);
      
      return {
        strategy: strategy,
        options: options,
        confidence: typeResult.confidence
      };
      
    } catch (error) {
      logger.error('❌ Processing strategy selection failed:', error);
      return {
        strategy: 'general_purpose',
        options: { adaptiveProcessing: true },
        error: error.message
      };
    }
  }
}

module.exports = DocumentTypeDetector;
