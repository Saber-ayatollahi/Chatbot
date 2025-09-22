/**
 * Citation Manager Module
 * Comprehensive citation extraction, validation, and formatting system
 * Phase 2: Retrieval & Prompting System
 */

const { getConfig } = require('../../config/environment');
const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

class CitationManager {
  constructor() {
    this.config = getConfig();
    this.db = null;
    
    // Citation patterns for different formats
    this.citationPatterns = {
      'inline': [
        /\(Guide\s+([^,]+),\s*p\.(\d+)\)/gi,
        /\(([^,]+),\s*p\.(\d+)\)/gi,
        /\(Source:\s*([^,]+),\s*Page:\s*(\d+)[^)]*\)/gi
      ],
      'academic': [
        /\[([^,]+),\s*p\.(\d+)\]/gi,
        /\[([^\]]+)\s+(\d{4})\]/gi
      ],
      'numbered': [
        /\[(\d+)\]/gi
      ],
      'footnote': [
        /\^(\d+)/gi
      ]
    };
    
    // Source name normalization patterns
    this.sourceNormalization = {
      'fund_manager_user_guide': 'Fund Manager User Guide',
      'user_guide': 'User Guide',
      'guide': 'Guide',
      'manual': 'Manual',
      'documentation': 'Documentation'
    };
    
    // Citation quality metrics
    this.qualityMetrics = {
      hasSource: 0.3,
      hasPage: 0.3,
      hasSection: 0.2,
      isValidated: 0.2
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
   * Extract citations from response text
   * @param {string} responseText - Response text to analyze
   * @param {Array} availableSources - Available source chunks
   * @param {Object} options - Extraction options
   * @returns {Object} Citation extraction results
   */
  async extractCitations(responseText, availableSources = [], options = {}) {
    try {
      logger.info('📋 Extracting citations from response text');
      
      const extractionResults = {
        totalCitations: 0,
        extractedCitations: [],
        validatedCitations: [],
        invalidCitations: [],
        citationMap: new Map(),
        qualityScore: 0,
        coverage: 0
      };
      
      // Extract citations using all patterns
      const allCitations = this.extractAllCitationPatterns(responseText);
      extractionResults.totalCitations = allCitations.length;
      extractionResults.extractedCitations = allCitations;
      
      logger.info(`📊 Found ${allCitations.length} potential citations`);
      
      if (allCitations.length === 0) {
        return extractionResults;
      }
      
      // Validate citations against available sources
      const validationResults = await this.validateCitations(allCitations, availableSources);
      extractionResults.validatedCitations = validationResults.valid;
      extractionResults.invalidCitations = validationResults.invalid;
      
      // Create citation map for easy lookup
      extractionResults.citationMap = this.createCitationMap(validationResults.valid);
      
      // Calculate quality metrics
      extractionResults.qualityScore = this.calculateCitationQuality(validationResults.valid, allCitations);
      extractionResults.coverage = this.calculateCitationCoverage(responseText, validationResults.valid);
      
      logger.info(`✅ Citation extraction complete: ${validationResults.valid.length} valid, ${validationResults.invalid.length} invalid`);
      
      return extractionResults;
    } catch (error) {
      logger.error('❌ Citation extraction failed:', error);
      throw new Error(`Citation extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract citations using all patterns
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted citations
   */
  extractAllCitationPatterns(text) {
    const citations = [];
    let citationId = 1;
    
    // Try each pattern type
    Object.entries(this.citationPatterns).forEach(([format, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        
        while ((match = regex.exec(text)) !== null) {
          const citation = this.parseCitationMatch(match, format, citationId++);
          if (citation) {
            citation.position = match.index;
            citation.fullMatch = match[0];
            citations.push(citation);
          }
        }
      });
    });
    
    // Sort by position in text
    citations.sort((a, b) => a.position - b.position);
    
    // Remove duplicates (same position)
    const uniqueCitations = [];
    const seenPositions = new Set();
    
    citations.forEach(citation => {
      if (!seenPositions.has(citation.position)) {
        seenPositions.add(citation.position);
        uniqueCitations.push(citation);
      }
    });
    
    return uniqueCitations;
  }

  /**
   * Parse citation match into structured format
   * @param {Array} match - Regex match array
   * @param {string} format - Citation format
   * @param {number} id - Citation ID
   * @returns {Object} Parsed citation
   */
  parseCitationMatch(match, format, id) {
    const citation = {
      id: id,
      format: format,
      rawText: match[0],
      source: null,
      page: null,
      section: null,
      number: null,
      isValid: false
    };
    
    switch (format) {
      case 'inline':
        if (match[1] && match[2]) {
          citation.source = this.normalizeSourceName(match[1]);
          citation.page = parseInt(match[2]);
        }
        break;
        
      case 'academic':
        if (match[1] && match[2]) {
          citation.source = this.normalizeSourceName(match[1]);
          citation.page = parseInt(match[2]) || null;
        }
        break;
        
      case 'numbered':
        if (match[1]) {
          citation.number = parseInt(match[1]);
        }
        break;
        
      case 'footnote':
        if (match[1]) {
          citation.number = parseInt(match[1]);
        }
        break;
    }
    
    return citation;
  }

  /**
   * Validate citations against available sources
   * @param {Array} citations - Extracted citations
   * @param {Array} availableSources - Available source chunks
   * @returns {Object} Validation results
   */
  async validateCitations(citations, availableSources) {
    logger.info(`🔍 Validating ${citations.length} citations against ${availableSources.length} sources`);
    
    const validCitations = [];
    const invalidCitations = [];
    
    for (const citation of citations) {
      const validationResult = await this.validateSingleCitation(citation, availableSources);
      
      if (validationResult.isValid) {
        validCitations.push({
          ...citation,
          ...validationResult,
          isValid: true
        });
      } else {
        invalidCitations.push({
          ...citation,
          isValid: false,
          validationErrors: validationResult.errors
        });
      }
    }
    
    return {
      valid: validCitations,
      invalid: invalidCitations
    };
  }

  /**
   * Validate a single citation
   * @param {Object} citation - Citation to validate
   * @param {Array} availableSources - Available sources
   * @returns {Object} Validation result
   */
  async validateSingleCitation(citation, availableSources) {
    const validation = {
      isValid: false,
      matchedSource: null,
      matchedChunk: null,
      confidence: 0,
      errors: []
    };
    
    // For numbered citations, try to match by position
    if (citation.format === 'numbered' || citation.format === 'footnote') {
      const sourceIndex = citation.number - 1;
      if (sourceIndex >= 0 && sourceIndex < availableSources.length) {
        const matchedSource = availableSources[sourceIndex];
        validation.isValid = true;
        validation.matchedSource = matchedSource;
        validation.matchedChunk = matchedSource;
        validation.confidence = 0.9;
        
        // Update citation with source info
        citation.source = matchedSource.citation?.source || matchedSource.filename;
        citation.page = matchedSource.citation?.page || matchedSource.page_number;
        citation.section = matchedSource.citation?.section || matchedSource.heading;
      } else {
        validation.errors.push('Citation number out of range');
      }
      
      return validation;
    }
    
    // For text-based citations, match by source and page
    if (citation.source && citation.page) {
      const matches = availableSources.filter(source => {
        const sourceName = source.citation?.source || source.filename || '';
        const sourcePage = source.citation?.page || source.page_number;
        
        return this.sourceNamesMatch(citation.source, sourceName) && 
               citation.page === sourcePage;
      });
      
      if (matches.length > 0) {
        const bestMatch = matches[0]; // Take first match
        validation.isValid = true;
        validation.matchedSource = bestMatch;
        validation.matchedChunk = bestMatch;
        validation.confidence = 0.95;
        
        // Enhance citation with matched info
        citation.section = bestMatch.citation?.section || bestMatch.heading;
        citation.chunkId = bestMatch.chunk_id;
      } else {
        validation.errors.push('No matching source found');
      }
    } else if (citation.source && !citation.page) {
      // Try to match by source name only
      const matches = availableSources.filter(source => {
        const sourceName = source.citation?.source || source.filename || '';
        return this.sourceNamesMatch(citation.source, sourceName);
      });
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        validation.isValid = true;
        validation.matchedSource = bestMatch;
        validation.matchedChunk = bestMatch;
        validation.confidence = 0.7; // Lower confidence without page
        
        // Update citation with matched page
        citation.page = bestMatch.citation?.page || bestMatch.page_number;
        citation.section = bestMatch.citation?.section || bestMatch.heading;
        citation.chunkId = bestMatch.chunk_id;
      } else {
        validation.errors.push('No matching source found');
      }
    } else {
      validation.errors.push('Insufficient citation information');
    }
    
    return validation;
  }

  /**
   * Check if source names match
   * @param {string} citationSource - Source from citation
   * @param {string} availableSource - Source from available chunks
   * @returns {boolean} Whether sources match
   */
  sourceNamesMatch(citationSource, availableSource) {
    if (!citationSource || !availableSource) return false;
    
    const normalize = (name) => name.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const normalizedCitation = normalize(citationSource);
    const normalizedAvailable = normalize(availableSource);
    
    // Exact match
    if (normalizedCitation === normalizedAvailable) return true;
    
    // Partial match (one contains the other)
    if (normalizedCitation.includes(normalizedAvailable) || 
        normalizedAvailable.includes(normalizedCitation)) return true;
    
    // Check for common abbreviations
    const commonAbbreviations = {
      'guide': ['user guide', 'manual', 'documentation'],
      'user guide': ['guide', 'manual'],
      'fund manager': ['fm', 'fund mgr'],
      'user': ['usr']
    };
    
    for (const [abbrev, expansions] of Object.entries(commonAbbreviations)) {
      if (normalizedCitation.includes(abbrev) && 
          expansions.some(exp => normalizedAvailable.includes(exp))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Create citation map for easy lookup
   * @param {Array} validCitations - Valid citations
   * @returns {Map} Citation map
   */
  createCitationMap(validCitations) {
    const citationMap = new Map();
    
    validCitations.forEach(citation => {
      const key = `${citation.source}_${citation.page}`;
      if (!citationMap.has(key)) {
        citationMap.set(key, []);
      }
      citationMap.get(key).push(citation);
    });
    
    return citationMap;
  }

  /**
   * Calculate citation quality score
   * @param {Array} validCitations - Valid citations
   * @param {Array} allCitations - All extracted citations
   * @returns {number} Quality score (0-1)
   */
  calculateCitationQuality(validCitations, allCitations) {
    if (allCitations.length === 0) return 0;
    
    let qualityScore = 0;
    
    // Base score on validation rate
    const validationRate = validCitations.length / allCitations.length;
    qualityScore += validationRate * 0.5;
    
    // Bonus for complete citations (source + page)
    const completeCitations = validCitations.filter(c => c.source && c.page);
    const completenessRate = completeCitations.length / validCitations.length;
    qualityScore += completenessRate * 0.3;
    
    // Bonus for section information
    const sectionalCitations = validCitations.filter(c => c.section);
    const sectionRate = sectionalCitations.length / validCitations.length;
    qualityScore += sectionRate * 0.2;
    
    return Math.min(qualityScore, 1.0);
  }

  /**
   * Calculate citation coverage in text
   * @param {string} text - Response text
   * @param {Array} validCitations - Valid citations
   * @returns {number} Coverage score (0-1)
   */
  calculateCitationCoverage(text, validCitations) {
    if (validCitations.length === 0) return 0;
    
    // Simple heuristic: count sentences with citations
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const sentencesWithCitations = sentences.filter(sentence => 
      validCitations.some(citation => sentence.includes(citation.rawText))
    );
    
    return sentencesWithCitations.length / sentences.length;
  }

  /**
   * Format citations for display
   * @param {Array} citations - Citations to format
   * @param {string} format - Target format
   * @param {Object} options - Formatting options
   * @returns {Array} Formatted citations
   */
  formatCitations(citations, format = 'inline', options = {}) {
    logger.info(`📝 Formatting ${citations.length} citations in ${format} format`);
    
    return citations.map((citation, index) => {
      const formatted = this.formatSingleCitation(citation, format, index + 1, options);
      return {
        ...citation,
        formatted: formatted,
        displayOrder: index + 1
      };
    });
  }

  /**
   * Format a single citation
   * @param {Object} citation - Citation to format
   * @param {string} format - Target format
   * @param {number} number - Citation number
   * @param {Object} options - Formatting options
   * @returns {string} Formatted citation
   */
  formatSingleCitation(citation, format, number, options = {}) {
    const source = citation.source || 'Unknown Source';
    const page = citation.page || 'N/A';
    const section = citation.section || '';
    
    switch (format) {
      case 'inline':
        if (section && options.includeSection) {
          return `(${source}, p.${page}, ${section})`;
        }
        return `(${source}, p.${page})`;
        
      case 'detailed':
        const parts = [`Source: ${source}`, `Page: ${page}`];
        if (section) parts.push(`Section: ${section}`);
        return `(${parts.join(', ')})`;
        
      case 'academic':
        return `[${source}, p.${page}]`;
        
      case 'numbered':
        return `[${number}]`;
        
      case 'footnote':
        return `^${number}`;
        
      case 'apa':
        return `(${source}, p. ${page})`;
        
      case 'mla':
        return `(${source} ${page})`;
        
      default:
        return `(${source}, p.${page})`;
    }
  }

  /**
   * Generate citation bibliography
   * @param {Array} citations - Citations to include
   * @param {string} style - Bibliography style
   * @returns {Array} Bibliography entries
   */
  generateBibliography(citations, style = 'standard') {
    logger.info(`📚 Generating bibliography for ${citations.length} citations`);
    
    // Group citations by source
    const sourceGroups = new Map();
    
    citations.forEach(citation => {
      const sourceKey = citation.source || 'Unknown Source';
      if (!sourceGroups.has(sourceKey)) {
        sourceGroups.set(sourceKey, {
          source: sourceKey,
          pages: new Set(),
          sections: new Set(),
          citations: []
        });
      }
      
      const group = sourceGroups.get(sourceKey);
      if (citation.page) group.pages.add(citation.page);
      if (citation.section) group.sections.add(citation.section);
      group.citations.push(citation);
    });
    
    // Generate bibliography entries
    const bibliography = [];
    
    sourceGroups.forEach((group, source) => {
      const entry = this.formatBibliographyEntry(group, style);
      bibliography.push(entry);
    });
    
    return bibliography.sort((a, b) => a.source.localeCompare(b.source));
  }

  /**
   * Format bibliography entry
   * @param {Object} group - Citation group
   * @param {string} style - Bibliography style
   * @returns {Object} Bibliography entry
   */
  formatBibliographyEntry(group, style) {
    const pages = Array.from(group.pages).sort((a, b) => a - b);
    const sections = Array.from(group.sections);
    
    let formatted = '';
    
    switch (style) {
      case 'standard':
        formatted = `${group.source}`;
        if (pages.length > 0) {
          formatted += `, pages ${this.formatPageRange(pages)}`;
        }
        if (sections.length > 0) {
          formatted += `, sections: ${sections.join(', ')}`;
        }
        break;
        
      case 'detailed':
        formatted = `${group.source}\n`;
        if (pages.length > 0) {
          formatted += `  Pages referenced: ${this.formatPageRange(pages)}\n`;
        }
        if (sections.length > 0) {
          formatted += `  Sections: ${sections.join(', ')}\n`;
        }
        formatted += `  Citations: ${group.citations.length}`;
        break;
        
      default:
        formatted = group.source;
    }
    
    return {
      source: group.source,
      formatted: formatted,
      pages: pages,
      sections: sections,
      citationCount: group.citations.length
    };
  }

  /**
   * Format page range
   * @param {Array} pages - Page numbers
   * @returns {string} Formatted page range
   */
  formatPageRange(pages) {
    if (pages.length === 0) return '';
    if (pages.length === 1) return pages[0].toString();
    
    // Group consecutive pages
    const ranges = [];
    let start = pages[0];
    let end = pages[0];
    
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === end + 1) {
        end = pages[i];
      } else {
        if (start === end) {
          ranges.push(start.toString());
        } else {
          ranges.push(`${start}-${end}`);
        }
        start = end = pages[i];
      }
    }
    
    // Add final range
    if (start === end) {
      ranges.push(start.toString());
    } else {
      ranges.push(`${start}-${end}`);
    }
    
    return ranges.join(', ');
  }

  /**
   * Normalize source name
   * @param {string} sourceName - Raw source name
   * @returns {string} Normalized source name
   */
  normalizeSourceName(sourceName) {
    if (!sourceName) return 'Unknown Source';
    
    let normalized = sourceName.trim();
    
    // Remove file extensions
    normalized = normalized.replace(/\.(pdf|doc|docx|txt)$/i, '');
    
    // Replace underscores and hyphens with spaces
    normalized = normalized.replace(/[_-]/g, ' ');
    
    // Apply normalization patterns
    for (const [pattern, replacement] of Object.entries(this.sourceNormalization)) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(normalized)) {
        normalized = replacement;
        break;
      }
    }
    
    // Capitalize words
    normalized = normalized.replace(/\b\w+/g, word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    
    return normalized;
  }

  /**
   * Validate citation format consistency
   * @param {string} text - Text to analyze
   * @returns {Object} Format consistency analysis
   */
  analyzeCitationConsistency(text) {
    const analysis = {
      formats: {},
      totalCitations: 0,
      consistencyScore: 0,
      recommendedFormat: null,
      issues: []
    };
    
    // Count citations by format
    Object.entries(this.citationPatterns).forEach(([format, patterns]) => {
      let count = 0;
      patterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        count += matches.length;
      });
      
      if (count > 0) {
        analysis.formats[format] = count;
        analysis.totalCitations += count;
      }
    });
    
    // Determine consistency
    const formatCounts = Object.values(analysis.formats);
    if (formatCounts.length === 0) {
      analysis.consistencyScore = 1; // No citations = consistent
    } else if (formatCounts.length === 1) {
      analysis.consistencyScore = 1; // Single format = consistent
      analysis.recommendedFormat = Object.keys(analysis.formats)[0];
    } else {
      // Multiple formats - calculate consistency
      const maxCount = Math.max(...formatCounts);
      analysis.consistencyScore = maxCount / analysis.totalCitations;
      analysis.recommendedFormat = Object.keys(analysis.formats).find(
        format => analysis.formats[format] === maxCount
      );
      
      analysis.issues.push('Multiple citation formats detected');
    }
    
    return analysis;
  }

  /**
   * Get citation statistics
   * @param {Array} citations - Citations to analyze
   * @returns {Object} Citation statistics
   */
  getCitationStatistics(citations) {
    const stats = {
      total: citations.length,
      valid: 0,
      invalid: 0,
      withSource: 0,
      withPage: 0,
      withSection: 0,
      formats: {},
      sources: {},
      averageConfidence: 0,
      qualityScore: 0
    };
    
    if (citations.length === 0) return stats;
    
    let totalConfidence = 0;
    
    citations.forEach(citation => {
      if (citation.isValid) stats.valid++;
      else stats.invalid++;
      
      if (citation.source) stats.withSource++;
      if (citation.page) stats.withPage++;
      if (citation.section) stats.withSection++;
      
      // Count formats
      stats.formats[citation.format] = (stats.formats[citation.format] || 0) + 1;
      
      // Count sources
      if (citation.source) {
        stats.sources[citation.source] = (stats.sources[citation.source] || 0) + 1;
      }
      
      // Add to confidence total
      totalConfidence += citation.confidence || 0;
    });
    
    stats.averageConfidence = totalConfidence / citations.length;
    stats.qualityScore = this.calculateCitationQuality(
      citations.filter(c => c.isValid), 
      citations
    );
    
    return stats;
  }

  /**
   * Test citation manager
   * @param {string} testText - Test text with citations
   * @param {Array} testSources - Test sources
   * @returns {Object} Test results
   */
  async testCitationManager(testText, testSources = []) {
    try {
      logger.info('🧪 Testing citation manager');
      
      const defaultTestText = `According to the Fund Manager User Guide (Guide 1, p.12), fund creation requires several steps. The NAV calculation process is detailed in the documentation (Source: User Guide, Page: 25, Section: NAV Calculation). Additional information can be found in [Guide 1, p.30] and reference [1].`;
      
      const defaultTestSources = [
        {
          chunk_id: 'test-1',
          citation: { source: 'Fund Manager User Guide', page: 12, section: 'Fund Creation' },
          filename: 'guide1.pdf'
        },
        {
          chunk_id: 'test-2', 
          citation: { source: 'User Guide', page: 25, section: 'NAV Calculation' },
          filename: 'guide1.pdf'
        },
        {
          chunk_id: 'test-3',
          citation: { source: 'Fund Manager User Guide', page: 30, section: 'Advanced Topics' },
          filename: 'guide1.pdf'
        }
      ];
      
      const text = testText || defaultTestText;
      const sources = testSources.length > 0 ? testSources : defaultTestSources;
      
      const startTime = Date.now();
      const results = await this.extractCitations(text, sources);
      const processingTime = Date.now() - startTime;
      
      const testResults = {
        success: true,
        processingTime,
        inputText: text,
        sourcesProvided: sources.length,
        extractionResults: {
          totalCitations: results.totalCitations,
          validCitations: results.validatedCitations.length,
          invalidCitations: results.invalidCitations.length,
          qualityScore: results.qualityScore,
          coverage: results.coverage
        },
        formattedCitations: this.formatCitations(results.validatedCitations, 'inline'),
        bibliography: this.generateBibliography(results.validatedCitations),
        statistics: this.getCitationStatistics([...results.validatedCitations, ...results.invalidCitations])
      };
      
      logger.info(`✅ Citation manager test completed in ${processingTime}ms`);
      
      return testResults;
    } catch (error) {
      logger.error('❌ Citation manager test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CitationManager;
