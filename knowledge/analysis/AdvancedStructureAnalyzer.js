/**
 * Advanced Structure Analyzer
 * Deep document hierarchy analysis and structure preservation
 * Production-ready with comprehensive error handling and performance optimization
 */

const logger = require('../../utils/logger');
const { performance } = require('perf_hooks');

class AdvancedStructureAnalyzer {
  constructor(options = {}) {
    this.options = {
      // Heading detection configuration
      headingDetection: {
        patterns: {
          // Markdown-style headings
          markdown: /^(#{1,6})\s+(.+)$/gm,
          // Numbered headings
          numbered: /^(\d+(?:\.\d+)*\.?)\s+(.+)$/gm,
          // All caps headings (short lines)
          allCaps: /^([A-Z][A-Z\s]{2,50})$/gm,
          // Underlined headings
          underlined: /^(.+)\n[-=]{3,}$/gm,
          // Step headings
          steps: /^(Step\s+\d+[:.]?)\s*(.*)$/gim,
          // Section headings
          sections: /^(Section\s+\d+[:.]?)\s*(.*)$/gim
        },
        minHeadingLength: 3,
        maxHeadingLength: 100,
        contextLines: 2 // Lines to check around potential headings
      },
      
      // Section detection configuration
      sectionDetection: {
        minSectionLength: 50,
        maxSectionLength: 10000,
        sectionBoundaryPatterns: [
          /^(Introduction|Overview|Getting Started)/i,
          /^(Prerequisites|Requirements)/i,
          /^(Installation|Setup)/i,
          /^(Configuration|Settings)/i,
          /^(Usage|How to Use)/i,
          /^(Examples|Sample)/i,
          /^(Troubleshooting|Problems)/i,
          /^(FAQ|Questions)/i,
          /^(Appendix|Reference)/i,
          /^(Glossary|Terms)/i
        ]
      },
      
      // Hierarchy analysis configuration
      hierarchyAnalysis: {
        maxDepth: 6,
        minChildSections: 1,
        enableCrossReferences: true,
        detectNavigationStructure: true
      },
      
      // Content structure patterns
      contentPatterns: {
        lists: {
          bulleted: /^[\s]*[-*+]\s+(.+)$/gm,
          numbered: /^[\s]*\d+[.)]\s+(.+)$/gm,
          lettered: /^[\s]*[a-zA-Z][.)]\s+(.+)$/gm
        },
        tables: {
          simple: /\|.*\|/gm,
          markdown: /^\|.*\|$/gm,
          aligned: /^[\s]*\w+[\s]*\|[\s]*\w+/gm
        },
        codeBlocks: {
          fenced: /```[\s\S]*?```/gm,
          indented: /^(    |\t).*$/gm
        },
        definitions: {
          colonSeparated: /^([^:\n]+):\s*(.+)$/gm,
          dashSeparated: /^([^-\n]+)\s*-\s*(.+)$/gm,
          parenthetical: /(\w+)\s*\(([^)]+)\)/gm
        }
      },
      
      // Performance optimization
      performance: {
        enableCaching: true,
        maxCacheSize: 1000,
        cacheTimeout: 3600000, // 1 hour
        enableParallelProcessing: true,
        chunkSize: 1000 // Lines to process in parallel chunks
      },
      
      ...options
    };

    // Initialize caches and state
    this.structureCache = new Map();
    this.headingCache = new Map();
    this.performanceMetrics = {
      analysisCount: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Main structure analysis method
   * @param {string} content - Document content to analyze
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Comprehensive structure analysis result
   */
  async analyzeDocumentStructure(content, metadata = {}) {
    const startTime = performance.now();
    
    try {
      logger.info('🏗️ Starting advanced structure analysis...');
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(content, metadata);
      
      // Check cache
      if (this.options.performance.enableCaching && this.structureCache.has(cacheKey)) {
        logger.debug('📋 Using cached structure analysis');
        this.performanceMetrics.cacheHitRate++;
        return this.structureCache.get(cacheKey);
      }
      
      // Perform comprehensive structure analysis
      const analysisResult = await this.performComprehensiveStructureAnalysis(content, metadata);
      
      // Cache result
      if (this.options.performance.enableCaching) {
        this.cacheResult(cacheKey, analysisResult);
      }
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);
      
      logger.info(`✅ Structure analysis completed in ${Math.round(processingTime)}ms`);
      
      return {
        ...analysisResult,
        processingTime,
        cacheKey
      };
      
    } catch (error) {
      logger.error('❌ Structure analysis failed:', error);
      return this.generateFallbackStructure(content, error);
    }
  }

  /**
   * Perform comprehensive structure analysis
   * @param {string} content - Document content
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Analysis result
   */
  async performComprehensiveStructureAnalysis(content, metadata) {
    // Step 1: Preprocess content
    const preprocessedContent = this.preprocessContent(content);
    
    // Step 2: Extract document elements in parallel
    const [
      headingAnalysis,
      sectionAnalysis,
      contentStructureAnalysis,
      hierarchyAnalysis
    ] = await Promise.all([
      this.analyzeHeadings(preprocessedContent),
      this.analyzeSections(preprocessedContent),
      this.analyzeContentStructure(preprocessedContent),
      this.analyzeHierarchy(preprocessedContent)
    ]);
    
    // Step 3: Cross-reference analysis
    const crossReferenceAnalysis = await this.analyzeCrossReferences(
      preprocessedContent,
      headingAnalysis,
      sectionAnalysis
    );
    
    // Step 4: Navigation structure analysis
    const navigationAnalysis = await this.analyzeNavigationStructure(
      headingAnalysis,
      sectionAnalysis,
      crossReferenceAnalysis
    );
    
    // Step 5: Quality assessment
    const qualityAssessment = this.assessStructureQuality(
      headingAnalysis,
      sectionAnalysis,
      contentStructureAnalysis,
      hierarchyAnalysis
    );
    
    // Step 6: Generate processing recommendations
    const processingRecommendations = this.generateProcessingRecommendations(
      headingAnalysis,
      sectionAnalysis,
      qualityAssessment
    );
    
    return {
      // Core structure elements
      headings: headingAnalysis.headings,
      sections: sectionAnalysis.sections,
      hierarchy: hierarchyAnalysis.hierarchy,
      
      // Content structure
      lists: contentStructureAnalysis.lists,
      tables: contentStructureAnalysis.tables,
      codeBlocks: contentStructureAnalysis.codeBlocks,
      definitions: contentStructureAnalysis.definitions,
      
      // Relationships and navigation
      crossReferences: crossReferenceAnalysis.references,
      navigationStructure: navigationAnalysis.structure,
      
      // Quality and characteristics
      qualityMetrics: qualityAssessment.metrics,
      structureCharacteristics: qualityAssessment.characteristics,
      
      // Processing guidance
      processingRecommendations: processingRecommendations,
      
      // Metadata
      analysisMetadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        structureComplexity: qualityAssessment.complexity,
        hasWellDefinedStructure: qualityAssessment.isWellStructured,
        recommendedChunkingStrategy: processingRecommendations.chunkingStrategy
      }
    };
  }

  /**
   * Analyze document headings
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Heading analysis result
   */
  async analyzeHeadings(content) {
    try {
      const headings = [];
      const lines = content.split('\n');
      
      // Apply heading detection patterns
      for (const [patternName, pattern] of Object.entries(this.options.headingDetection.patterns)) {
        const matches = [...content.matchAll(pattern)];
        
        for (const match of matches) {
          const heading = this.processHeadingMatch(match, patternName, lines);
          if (heading && this.validateHeading(heading)) {
            headings.push(heading);
          }
        }
      }
      
      // Remove duplicates and sort by position
      const uniqueHeadings = this.deduplicateHeadings(headings);
      const sortedHeadings = uniqueHeadings.sort((a, b) => a.position - b.position);
      
      // Assign levels and hierarchy
      const hierarchicalHeadings = this.assignHeadingLevels(sortedHeadings);
      
      // Analyze heading patterns
      const headingPatterns = this.analyzeHeadingPatterns(hierarchicalHeadings);
      
      return {
        headings: hierarchicalHeadings,
        count: hierarchicalHeadings.length,
        patterns: headingPatterns,
        hasConsistentStructure: headingPatterns.isConsistent,
        maxDepth: Math.max(...hierarchicalHeadings.map(h => h.level), 0)
      };
      
    } catch (error) {
      logger.error('❌ Heading analysis failed:', error);
      return {
        headings: [],
        count: 0,
        patterns: {},
        hasConsistentStructure: false,
        maxDepth: 0
      };
    }
  }

  /**
   * Analyze document sections
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Section analysis result
   */
  async analyzeSections(content) {
    try {
      const sections = [];
      const lines = content.split('\n');
      
      // Detect section boundaries
      const boundaries = this.detectSectionBoundaries(lines);
      
      // Create sections from boundaries
      for (let i = 0; i < boundaries.length; i++) {
        const startBoundary = boundaries[i];
        const endBoundary = boundaries[i + 1] || { lineIndex: lines.length - 1 };
        
        const section = this.createSection(
          lines,
          startBoundary,
          endBoundary,
          i
        );
        
        if (this.validateSection(section)) {
          sections.push(section);
        }
      }
      
      // Analyze section characteristics
      const sectionCharacteristics = this.analyzeSectionCharacteristics(sections);
      
      return {
        sections,
        count: sections.length,
        characteristics: sectionCharacteristics,
        averageLength: sections.length > 0 
          ? sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length 
          : 0
      };
      
    } catch (error) {
      logger.error('❌ Section analysis failed:', error);
      return {
        sections: [],
        count: 0,
        characteristics: {},
        averageLength: 0
      };
    }
  }

  /**
   * Analyze content structure (lists, tables, etc.)
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Content structure analysis result
   */
  async analyzeContentStructure(content) {
    try {
      const structure = {
        lists: this.extractLists(content),
        tables: this.extractTables(content),
        codeBlocks: this.extractCodeBlocks(content),
        definitions: this.extractDefinitions(content)
      };
      
      // Analyze structure patterns
      const patterns = this.analyzeStructurePatterns(structure);
      
      return {
        ...structure,
        patterns,
        hasRichStructure: this.hasRichStructure(structure),
        structureComplexity: this.calculateStructureComplexity(structure)
      };
      
    } catch (error) {
      logger.error('❌ Content structure analysis failed:', error);
      return {
        lists: [],
        tables: [],
        codeBlocks: [],
        definitions: [],
        patterns: {},
        hasRichStructure: false,
        structureComplexity: 0
      };
    }
  }

  /**
   * Analyze document hierarchy
   * @param {string} content - Preprocessed content
   * @returns {Promise<Object>} Hierarchy analysis result
   */
  async analyzeHierarchy(content) {
    try {
      // This will be enhanced with heading analysis results
      const lines = content.split('\n');
      const hierarchyElements = [];
      
      // Detect hierarchical patterns
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const hierarchyElement = this.detectHierarchyElement(line, i);
        
        if (hierarchyElement) {
          hierarchyElements.push(hierarchyElement);
        }
      }
      
      // Build hierarchy tree
      const hierarchyTree = this.buildHierarchyTree(hierarchyElements);
      
      // Analyze hierarchy characteristics
      const characteristics = this.analyzeHierarchyCharacteristics(hierarchyTree);
      
      return {
        hierarchy: hierarchyTree,
        elements: hierarchyElements,
        characteristics,
        depth: characteristics.maxDepth,
        isWellStructured: characteristics.isWellStructured
      };
      
    } catch (error) {
      logger.error('❌ Hierarchy analysis failed:', error);
      return {
        hierarchy: {},
        elements: [],
        characteristics: {},
        depth: 0,
        isWellStructured: false
      };
    }
  }

  /**
   * Analyze cross-references between content elements
   * @param {string} content - Document content
   * @param {Object} headingAnalysis - Heading analysis result
   * @param {Object} sectionAnalysis - Section analysis result
   * @returns {Promise<Object>} Cross-reference analysis result
   */
  async analyzeCrossReferences(content, headingAnalysis, sectionAnalysis) {
    try {
      const references = [];
      
      // Detect references to headings
      for (const heading of headingAnalysis.headings) {
        const headingRefs = this.findReferencesToHeading(content, heading);
        references.push(...headingRefs);
      }
      
      // Detect references to sections
      for (const section of sectionAnalysis.sections) {
        const sectionRefs = this.findReferencesToSection(content, section);
        references.push(...sectionRefs);
      }
      
      // Detect generic cross-references
      const genericRefs = this.findGenericCrossReferences(content);
      references.push(...genericRefs);
      
      // Analyze reference patterns
      const referencePatterns = this.analyzeReferencePatterns(references);
      
      return {
        references,
        count: references.length,
        patterns: referencePatterns,
        hasExtensiveCrossReferencing: references.length > 5
      };
      
    } catch (error) {
      logger.error('❌ Cross-reference analysis failed:', error);
      return {
        references: [],
        count: 0,
        patterns: {},
        hasExtensiveCrossReferencing: false
      };
    }
  }

  /**
   * Analyze navigation structure
   * @param {Object} headingAnalysis - Heading analysis result
   * @param {Object} sectionAnalysis - Section analysis result
   * @param {Object} crossReferenceAnalysis - Cross-reference analysis result
   * @returns {Promise<Object>} Navigation analysis result
   */
  async analyzeNavigationStructure(headingAnalysis, sectionAnalysis, crossReferenceAnalysis) {
    try {
      // Build navigation tree from headings
      const navigationTree = this.buildNavigationTree(headingAnalysis.headings);
      
      // Identify navigation patterns
      const navigationPatterns = this.identifyNavigationPatterns(
        navigationTree,
        sectionAnalysis.sections,
        crossReferenceAnalysis.references
      );
      
      // Generate navigation recommendations
      const recommendations = this.generateNavigationRecommendations(
        navigationTree,
        navigationPatterns
      );
      
      return {
        structure: navigationTree,
        patterns: navigationPatterns,
        recommendations,
        hasGoodNavigation: navigationPatterns.isWellStructured
      };
      
    } catch (error) {
      logger.error('❌ Navigation analysis failed:', error);
      return {
        structure: {},
        patterns: {},
        recommendations: [],
        hasGoodNavigation: false
      };
    }
  }

  /**
   * Assess overall structure quality
   * @param {Object} headingAnalysis - Heading analysis
   * @param {Object} sectionAnalysis - Section analysis
   * @param {Object} contentStructureAnalysis - Content structure analysis
   * @param {Object} hierarchyAnalysis - Hierarchy analysis
   * @returns {Object} Quality assessment result
   */
  assessStructureQuality(headingAnalysis, sectionAnalysis, contentStructureAnalysis, hierarchyAnalysis) {
    try {
      const metrics = {
        headingQuality: this.assessHeadingQuality(headingAnalysis),
        sectionQuality: this.assessSectionQuality(sectionAnalysis),
        hierarchyQuality: this.assessHierarchyQuality(hierarchyAnalysis),
        contentStructureQuality: this.assessContentStructureQuality(contentStructureAnalysis)
      };
      
      // Calculate overall quality score
      const overallQuality = Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length;
      
      // Determine characteristics
      const characteristics = {
        isWellStructured: overallQuality >= 0.7,
        hasGoodHeadings: metrics.headingQuality >= 0.6,
        hasGoodSections: metrics.sectionQuality >= 0.6,
        hasGoodHierarchy: metrics.hierarchyQuality >= 0.6,
        hasRichContent: metrics.contentStructureQuality >= 0.6
      };
      
      // Calculate complexity
      const complexity = this.calculateOverallComplexity(
        headingAnalysis,
        sectionAnalysis,
        hierarchyAnalysis
      );
      
      return {
        metrics,
        overallQuality,
        characteristics,
        complexity,
        isWellStructured: characteristics.isWellStructured
      };
      
    } catch (error) {
      logger.error('❌ Structure quality assessment failed:', error);
      return {
        metrics: {},
        overallQuality: 0.3,
        characteristics: { isWellStructured: false },
        complexity: 0.5,
        isWellStructured: false
      };
    }
  }

  /**
   * Generate processing recommendations based on structure analysis
   * @param {Object} headingAnalysis - Heading analysis
   * @param {Object} sectionAnalysis - Section analysis
   * @param {Object} qualityAssessment - Quality assessment
   * @returns {Object} Processing recommendations
   */
  generateProcessingRecommendations(headingAnalysis, sectionAnalysis, qualityAssessment) {
    try {
      const recommendations = {
        chunkingStrategy: 'adaptive_semantic', // Default
        preserveStructure: true,
        enhanceHeadings: false,
        processingPriority: 'normal',
        specialHandling: []
      };
      
      // Determine optimal chunking strategy
      if (qualityAssessment.characteristics.hasGoodHierarchy) {
        recommendations.chunkingStrategy = 'hierarchical_semantic';
      } else if (qualityAssessment.characteristics.hasGoodSections) {
        recommendations.chunkingStrategy = 'section_based';
      } else if (headingAnalysis.hasConsistentStructure) {
        recommendations.chunkingStrategy = 'heading_based';
      }
      
      // Heading enhancement recommendations
      if (headingAnalysis.count < 3 || !headingAnalysis.hasConsistentStructure) {
        recommendations.enhanceHeadings = true;
        recommendations.specialHandling.push('heading_enhancement');
      }
      
      // Processing priority based on structure quality
      if (qualityAssessment.overallQuality >= 0.8) {
        recommendations.processingPriority = 'high';
      } else if (qualityAssessment.overallQuality <= 0.4) {
        recommendations.processingPriority = 'low';
        recommendations.specialHandling.push('quality_improvement');
      }
      
      // Special handling for specific patterns
      if (sectionAnalysis.characteristics.hasStepByStep) {
        recommendations.specialHandling.push('procedure_preservation');
      }
      
      if (sectionAnalysis.characteristics.hasDefinitions) {
        recommendations.specialHandling.push('definition_enhancement');
      }
      
      return recommendations;
      
    } catch (error) {
      logger.error('❌ Processing recommendation generation failed:', error);
      return {
        chunkingStrategy: 'adaptive_semantic',
        preserveStructure: true,
        enhanceHeadings: false,
        processingPriority: 'normal',
        specialHandling: []
      };
    }
  }

  // Helper methods for structure analysis

  /**
   * Preprocess content for analysis
   */
  preprocessContent(content) {
    // Normalize line endings
    let processed = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove excessive blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    // Trim lines
    processed = processed.split('\n').map(line => line.trimRight()).join('\n');
    
    return processed;
  }

  /**
   * Process heading match from regex
   */
  processHeadingMatch(match, patternName, lines) {
    try {
      const fullMatch = match[0];
      const position = match.index;
      
      // Find line number
      const beforeMatch = match.input.substring(0, position);
      const lineNumber = beforeMatch.split('\n').length - 1;
      
      let level = 1;
      let text = '';
      
      switch (patternName) {
        case 'markdown':
          level = match[1].length; // Number of # characters
          text = match[2].trim();
          break;
        case 'numbered':
          level = match[1].split('.').length;
          text = match[2].trim();
          break;
        case 'allCaps':
          level = 2; // Assume level 2 for all caps
          text = match[1].trim();
          break;
        case 'steps':
        case 'sections':
          level = 3; // Steps and sections are typically level 3
          text = match[1] + (match[2] ? ' ' + match[2] : '');
          break;
        default:
          text = fullMatch.trim();
      }
      
      return {
        text: text,
        level: Math.min(level, this.options.hierarchyAnalysis.maxDepth),
        position: position,
        lineNumber: lineNumber,
        pattern: patternName,
        originalMatch: fullMatch
      };
      
    } catch (error) {
      logger.debug('Failed to process heading match:', error);
      return null;
    }
  }

  /**
   * Validate heading
   */
  validateHeading(heading) {
    return heading.text.length >= this.options.headingDetection.minHeadingLength &&
           heading.text.length <= this.options.headingDetection.maxHeadingLength &&
           heading.text.trim().length > 0;
  }

  /**
   * Remove duplicate headings
   */
  deduplicateHeadings(headings) {
    const seen = new Set();
    return headings.filter(heading => {
      const key = `${heading.text}_${heading.position}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Assign hierarchical levels to headings
   */
  assignHeadingLevels(headings) {
    // This is a simplified implementation
    // In a full implementation, this would analyze the document structure more deeply
    return headings.map((heading, index) => ({
      ...heading,
      id: `heading_${index}`,
      children: [],
      parent: null
    }));
  }

  /**
   * Generate cache key for structure analysis
   */
  generateCacheKey(content, metadata) {
    const contentHash = require('crypto')
      .createHash('md5')
      .update(content.substring(0, 1000)) // Use first 1KB for hash
      .digest('hex');
    
    return `structure_${contentHash}_${JSON.stringify(metadata)}`;
  }

  /**
   * Cache analysis result
   */
  cacheResult(cacheKey, result) {
    if (this.structureCache.size >= this.options.performance.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.structureCache.keys().next().value;
      this.structureCache.delete(firstKey);
    }
    
    this.structureCache.set(cacheKey, {
      ...result,
      cachedAt: Date.now()
    });
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(processingTime) {
    this.performanceMetrics.analysisCount++;
    
    const totalTime = this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.analysisCount - 1) + processingTime;
    this.performanceMetrics.averageProcessingTime = totalTime / this.performanceMetrics.analysisCount;
  }

  /**
   * Generate fallback structure for errors
   */
  generateFallbackStructure(content, error) {
    return {
      headings: [],
      sections: [],
      hierarchy: {},
      lists: [],
      tables: [],
      codeBlocks: [],
      definitions: [],
      crossReferences: [],
      navigationStructure: {},
      qualityMetrics: {
        overallQuality: 0.1,
        characteristics: { isWellStructured: false }
      },
      processingRecommendations: {
        chunkingStrategy: 'simple_text',
        preserveStructure: false,
        processingPriority: 'low'
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
      cacheSize: this.structureCache.size,
      cacheHitRate: this.performanceMetrics.cacheHitRate / Math.max(this.performanceMetrics.analysisCount, 1)
    };
  }

  /**
   * Detect section boundaries (helper method)
   */
  detectSectionBoundaries(lines) {
    const boundaries = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check against section boundary patterns
      for (const pattern of this.options.sectionDetection.sectionBoundaryPatterns) {
        if (pattern.test(line)) {
          boundaries.push({
            lineIndex: i,
            text: line,
            type: 'section_start'
          });
          break;
        }
      }
    }
    
    return boundaries;
  }

  /**
   * Create section (helper method)
   */
  createSection(lines, startBoundary, endBoundary, index) {
    const sectionLines = lines.slice(startBoundary.lineIndex, endBoundary.lineIndex);
    const content = sectionLines.join('\n').trim();
    
    return {
      id: `section_${index}`,
      heading: startBoundary.text,
      content: content,
      startLine: startBoundary.lineIndex,
      endLine: endBoundary.lineIndex - 1,
      lineCount: sectionLines.length,
      wordCount: content.split(/\s+/).length,
      type: this.classifySectionType(content)
    };
  }

  /**
   * Validate section (helper method)
   */
  validateSection(section) {
    return section.content.length >= this.options.sectionDetection.minSectionLength &&
           section.content.length <= this.options.sectionDetection.maxSectionLength &&
           section.wordCount >= 5;
  }

  /**
   * Analyze section characteristics (helper method)
   */
  analyzeSectionCharacteristics(sections) {
    const characteristics = {
      hasStepByStep: false,
      hasDefinitions: false,
      hasProcedures: false,
      hasExamples: false,
      averageLength: 0,
      totalSections: sections.length
    };
    
    if (sections.length === 0) return characteristics;
    
    let totalLength = 0;
    
    for (const section of sections) {
      totalLength += section.content.length;
      
      // Check for step-by-step content
      if (/step\s+\d+/gi.test(section.content)) {
        characteristics.hasStepByStep = true;
      }
      
      // Check for definitions
      if (/\w+\s+(?:is|are|means?)/gi.test(section.content)) {
        characteristics.hasDefinitions = true;
      }
      
      // Check for procedures
      if (/(navigate|click|select|choose)/gi.test(section.content)) {
        characteristics.hasProcedures = true;
      }
      
      // Check for examples
      if (/example|for instance|such as/gi.test(section.content)) {
        characteristics.hasExamples = true;
      }
    }
    
    characteristics.averageLength = totalLength / sections.length;
    
    return characteristics;
  }

  /**
   * Classify section type (helper method)
   */
  classifySectionType(content) {
    if (/step\s+\d+/gi.test(content)) return 'procedural';
    if (/\?/g.test(content)) return 'faq';
    if (/definition|means|refers to/gi.test(content)) return 'conceptual';
    if (/example|instance/gi.test(content)) return 'example';
    if (/warning|caution|important/gi.test(content)) return 'warning';
    
    return 'general';
  }

  /**
   * Extract lists (helper method)
   */
  extractLists(content) {
    const lists = [];
    
    // Extract bulleted lists
    const bulletMatches = [...content.matchAll(this.options.contentPatterns.lists.bulleted)];
    if (bulletMatches.length > 0) {
      lists.push({
        type: 'bulleted',
        items: bulletMatches.map(match => match[1]),
        count: bulletMatches.length
      });
    }
    
    // Extract numbered lists
    const numberedMatches = [...content.matchAll(this.options.contentPatterns.lists.numbered)];
    if (numberedMatches.length > 0) {
      lists.push({
        type: 'numbered',
        items: numberedMatches.map(match => match[1]),
        count: numberedMatches.length
      });
    }
    
    return lists;
  }

  /**
   * Extract tables (helper method)
   */
  extractTables(content) {
    const tables = [];
    
    const tableMatches = [...content.matchAll(this.options.contentPatterns.tables.simple)];
    if (tableMatches.length > 2) { // At least 3 rows to be considered a table
      tables.push({
        type: 'simple',
        rowCount: tableMatches.length,
        content: tableMatches.map(match => match[0])
      });
    }
    
    return tables;
  }

  /**
   * Extract code blocks (helper method)
   */
  extractCodeBlocks(content) {
    const codeBlocks = [];
    
    const fencedMatches = [...content.matchAll(this.options.contentPatterns.codeBlocks.fenced)];
    codeBlocks.push(...fencedMatches.map(match => ({
      type: 'fenced',
      content: match[0],
      language: 'unknown'
    })));
    
    return codeBlocks;
  }

  /**
   * Extract definitions (helper method)
   */
  extractDefinitions(content) {
    const definitions = [];
    
    const colonMatches = [...content.matchAll(this.options.contentPatterns.definitions.colonSeparated)];
    definitions.push(...colonMatches.map(match => ({
      type: 'colon_separated',
      term: match[1].trim(),
      definition: match[2].trim()
    })));
    
    return definitions;
  }

  /**
   * Analyze structure patterns (helper method)
   */
  analyzeStructurePatterns(structure) {
    return {
      hasLists: structure.lists.length > 0,
      hasTables: structure.tables.length > 0,
      hasCodeBlocks: structure.codeBlocks.length > 0,
      hasDefinitions: structure.definitions.length > 0,
      complexity: this.calculateStructureComplexity(structure)
    };
  }

  /**
   * Has rich structure (helper method)
   */
  hasRichStructure(structure) {
    const elementCount = structure.lists.length + 
                       structure.tables.length + 
                       structure.codeBlocks.length + 
                       structure.definitions.length;
    
    return elementCount >= 2;
  }

  /**
   * Calculate structure complexity (helper method)
   */
  calculateStructureComplexity(structure) {
    let complexity = 0;
    
    complexity += structure.lists?.length || 0;
    complexity += (structure.tables?.length || 0) * 2; // Tables are more complex
    complexity += structure.codeBlocks?.length || 0;
    complexity += structure.definitions?.length || 0;
    
    return Math.min(complexity / 10, 1.0); // Normalize to 0-1
  }

  /**
   * Detect hierarchy element (helper method)
   */
  detectHierarchyElement(line, lineIndex) {
    // Check for numbered headings
    const numberedMatch = line.match(/^(\d+(?:\.\d+)*\.?)\s+(.+)$/);
    if (numberedMatch) {
      const level = numberedMatch[1].split('.').length;
      return {
        type: 'numbered_heading',
        level: level,
        text: numberedMatch[2],
        lineIndex: lineIndex
      };
    }
    
    // Check for step elements
    const stepMatch = line.match(/^(Step\s+\d+[:.]?)\s*(.*)$/i);
    if (stepMatch) {
      return {
        type: 'step',
        level: 3,
        text: stepMatch[0],
        lineIndex: lineIndex
      };
    }
    
    return null;
  }

  /**
   * Build hierarchy tree (helper method)
   */
  buildHierarchyTree(elements) {
    const tree = {
      root: {
        children: [],
        level: 0
      }
    };
    
    let currentParent = tree.root;
    
    for (const element of elements) {
      const node = {
        ...element,
        children: [],
        parent: currentParent
      };
      
      currentParent.children.push(node);
      
      if (element.type === 'numbered_heading') {
        currentParent = node;
      }
    }
    
    return tree;
  }

  /**
   * Analyze hierarchy characteristics (helper method)
   */
  analyzeHierarchyCharacteristics(hierarchyTree) {
    const characteristics = {
      maxDepth: 0,
      totalNodes: 0,
      isWellStructured: false
    };
    
    const calculateDepth = (node, depth = 0) => {
      characteristics.totalNodes++;
      characteristics.maxDepth = Math.max(characteristics.maxDepth, depth);
      
      for (const child of node.children || []) {
        calculateDepth(child, depth + 1);
      }
    };
    
    if (hierarchyTree.root) {
      calculateDepth(hierarchyTree.root);
    }
    
    characteristics.isWellStructured = characteristics.maxDepth >= 2 && characteristics.totalNodes >= 3;
    
    return characteristics;
  }

  /**
   * Find references to heading (helper method)
   */
  findReferencesToHeading(content, heading) {
    const references = [];
    const headingText = heading.text.toLowerCase();
    
    // Simple reference detection
    const seePattern = new RegExp(`see\\s+.*?${headingText}`, 'gi');
    const matches = [...content.matchAll(seePattern)];
    
    references.push(...matches.map(match => ({
      type: 'heading_reference',
      source: match[0],
      target: heading.text,
      position: match.index
    })));
    
    return references;
  }

  /**
   * Find references to section (helper method)
   */
  findReferencesToSection(content, section) {
    // Simplified implementation
    return [];
  }

  /**
   * Find generic cross-references (helper method)
   */
  findGenericCrossReferences(content) {
    const references = [];
    
    // Find "see also" references
    const seeAlsoMatches = [...content.matchAll(/see also[:\s]+([^.]+)/gi)];
    references.push(...seeAlsoMatches.map(match => ({
      type: 'see_also',
      content: match[1].trim(),
      position: match.index
    })));
    
    return references;
  }

  /**
   * Analyze reference patterns (helper method)
   */
  analyzeReferencePatterns(references) {
    const patterns = {
      totalReferences: references.length,
      typeDistribution: {},
      hasExtensiveReferencing: references.length > 5
    };
    
    for (const ref of references) {
      patterns.typeDistribution[ref.type] = (patterns.typeDistribution[ref.type] || 0) + 1;
    }
    
    return patterns;
  }

  /**
   * Build navigation tree (helper method)
   */
  buildNavigationTree(headings) {
    const tree = { children: [] };
    const stack = [tree];
    
    for (const heading of headings) {
      const node = {
        ...heading,
        children: []
      };
      
      // Find appropriate parent based on level
      while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    
    return tree;
  }

  /**
   * Identify navigation patterns (helper method)
   */
  identifyNavigationPatterns(navigationTree, sections, references) {
    return {
      hasHierarchicalStructure: navigationTree.children.length > 0,
      maxDepth: this.calculateTreeDepth(navigationTree),
      hasCrossReferences: references.length > 0,
      isWellStructured: navigationTree.children.length >= 2
    };
  }

  /**
   * Calculate tree depth (helper method)
   */
  calculateTreeDepth(tree, depth = 0) {
    if (!tree.children || tree.children.length === 0) {
      return depth;
    }
    
    return Math.max(...tree.children.map(child => this.calculateTreeDepth(child, depth + 1)));
  }

  /**
   * Generate navigation recommendations (helper method)
   */
  generateNavigationRecommendations(navigationTree, patterns) {
    const recommendations = [];
    
    if (!patterns.hasHierarchicalStructure) {
      recommendations.push('Add hierarchical headings for better navigation');
    }
    
    if (patterns.maxDepth < 2) {
      recommendations.push('Consider adding sub-sections for better organization');
    }
    
    if (!patterns.hasCrossReferences) {
      recommendations.push('Add cross-references between related sections');
    }
    
    return recommendations;
  }

  /**
   * Assess heading quality (helper method)
   */
  assessHeadingQuality(headingAnalysis) {
    let score = 0.5;
    
    if (headingAnalysis.count > 0) score += 0.2;
    if (headingAnalysis.hasConsistentStructure) score += 0.2;
    if (headingAnalysis.maxDepth >= 2) score += 0.1;
    
    return Math.min(1, score);
  }

  /**
   * Assess section quality (helper method)
   */
  assessSectionQuality(sectionAnalysis) {
    let score = 0.5;
    
    if (sectionAnalysis.count > 0) score += 0.2;
    if (sectionAnalysis.characteristics.hasStepByStep) score += 0.1;
    if (sectionAnalysis.characteristics.hasDefinitions) score += 0.1;
    if (sectionAnalysis.averageLength > 100) score += 0.1;
    
    return Math.min(1, score);
  }

  /**
   * Assess hierarchy quality (helper method)
   */
  assessHierarchyQuality(hierarchyAnalysis) {
    let score = 0.5;
    
    if (hierarchyAnalysis.isWellStructured) score += 0.3;
    if (hierarchyAnalysis.depth >= 2) score += 0.2;
    
    return Math.min(1, score);
  }

  /**
   * Assess content structure quality (helper method)
   */
  assessContentStructureQuality(contentStructureAnalysis) {
    let score = 0.5;
    
    if (contentStructureAnalysis.hasRichStructure) score += 0.3;
    if (contentStructureAnalysis.lists?.length > 0) score += 0.1;
    if (contentStructureAnalysis.definitions?.length > 0) score += 0.1;
    
    return Math.min(1, score);
  }

  /**
   * Calculate overall complexity (helper method)
   */
  calculateOverallComplexity(headingAnalysis, sectionAnalysis, hierarchyAnalysis) {
    let complexity = 0;
    
    complexity += headingAnalysis.maxDepth / 6; // Normalize to 0-1
    complexity += sectionAnalysis.count / 10; // Normalize to 0-1
    complexity += hierarchyAnalysis.depth / 5; // Normalize to 0-1
    
    return Math.min(complexity / 3, 1.0);
  }

  /**
   * Analyze heading patterns (helper method)
   */
  analyzeHeadingPatterns(headings) {
    const patterns = {
      isConsistent: true,
      levelDistribution: {},
      hasGoodHierarchy: false
    };
    
    // Analyze level distribution
    for (const heading of headings) {
      patterns.levelDistribution[heading.level] = (patterns.levelDistribution[heading.level] || 0) + 1;
    }
    
    // Check for good hierarchy (multiple levels)
    patterns.hasGoodHierarchy = Object.keys(patterns.levelDistribution).length >= 2;
    
    return patterns;
  }

  /**
   * Determine heading level (helper method)
   */
  determineHeadingLevel(headingText) {
    // Simple heuristic for heading level
    if (headingText.length < 20) return 1;
    if (headingText.length < 40) return 2;
    return 3;
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.structureCache.clear();
    this.headingCache.clear();
    logger.info('🧹 Structure analyzer caches cleared');
  }
}

module.exports = AdvancedStructureAnalyzer;
