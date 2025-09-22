/**
 * Intelligent Content Filter
 * Advanced content filtering and junk removal for document processing
 */

class IntelligentContentFilter {
  constructor(options = {}) {
    this.options = {
      // Junk content patterns
      junkPatterns: {
        tableOfContents: /Table of [Cc]ontents[\s\S]*?(?=\n\n|\n[A-Z])/gi,
        copyrightNotices: /©.*?(?=\n\n|\n[A-Z])/gi,
        confidentialNotices: /Confidential Information.*?(?=\n\n|\n[A-Z])/gi,
        websiteUrls: /www\.\w+\.com/gi,
        pressRelease: /Press release/gi,
        introductionDots: /^Introduction\s*\.{3,}/gim,
        excessiveDots: /^\.{3,}/gim,
        pageNumbers: /^\s*\d+\s*$/gim,
        emptyLines: /^\s*$/gim
      },
      
      // Content quality thresholds
      qualityThresholds: {
        minLength: 50,
        maxLength: 10000,
        minWords: 10,
        maxConsecutiveSpaces: 3
      },
      
      // Fund management specific filters
      fundManagementFilters: {
        preserveFundTerms: true,
        enhanceStepByStep: true,
        preserveDefinitions: true
      },
      
      ...options
    };

    // Patterns for content that should be preserved
    this.preservePatterns = [
      /Creating.*Fund/gi,
      /Fund.*Update/gi,
      /Step \d+/gi,
      /Navigate to/gi,
      /Click.*button/gi
    ];

    // Patterns for enhanced fund management content
    this.fundEnhancementPatterns = {
      stepByStep: /Step \d+[:.]?\s*(.*?)(?=Step \d+|$)/gis,
      procedures: /(Navigate to|Click|Select|Choose|Enter).*?(?=\.|$)/gi,
      definitions: /(.*?)\s+(?:is|means|refers to|are)\s+(.*?)(?=\.|$)/gi,
      fundCreation: /(create.*fund|fund.*creat|new fund|fund setup)/gi
    };
  }

  /**
   * Main content filtering method
   */
  async filterContent(content, metadata = {}) {
    console.log('🧹 Applying intelligent content filtering...');
    
    let filteredContent = content;
    const filteringStats = {
      originalLength: content.length,
      removedPatterns: [],
      enhancedSections: [],
      qualityIssues: []
    };

    // Step 1: Remove junk patterns
    filteredContent = this.removeJunkPatterns(filteredContent, filteringStats);
    
    // Step 2: Clean formatting issues
    filteredContent = this.cleanFormatting(filteredContent, filteringStats);
    
    // Step 3: Enhance fund management content
    filteredContent = this.enhanceFundContent(filteredContent, filteringStats);
    
    // Step 4: Validate content quality
    const qualityValidation = this.validateContentQuality(filteredContent);
    
    filteringStats.finalLength = filteredContent.length;
    filteringStats.reductionPercentage = content.length > 0 ? Math.round((1 - filteredContent.length / content.length) * 100) : 0;
    filteringStats.qualityScore = qualityValidation.score || 0;
    
    const qualityPercentage = (qualityValidation.score && !isNaN(qualityValidation.score)) ? Math.round(qualityValidation.score * 100) : 0;
    console.log(`   📊 Filtered content: ${filteringStats.reductionPercentage}% reduction, quality: ${qualityPercentage}%`);
    
    return {
      content: filteredContent,
      filteringStats: filteringStats,
      qualityValidation: qualityValidation
    };
  }

  /**
   * Remove junk patterns from content
   */
  removeJunkPatterns(content, stats) {
    let filtered = content;
    
    for (const [patternName, pattern] of Object.entries(this.options.junkPatterns)) {
      const matches = filtered.match(pattern);
      if (matches && matches.length > 0) {
        // Check if this content should be preserved
        const shouldPreserve = this.shouldPreserveContent(matches.join(' '));
        
        if (!shouldPreserve) {
          filtered = filtered.replace(pattern, '');
          stats.removedPatterns.push({
            pattern: patternName,
            matchCount: matches.length,
            examples: matches.slice(0, 3) // Keep first 3 examples
          });
        }
      }
    }
    
    return filtered;
  }

  /**
   * Check if content should be preserved despite matching junk patterns
   */
  shouldPreserveContent(content) {
    return this.preservePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Clean formatting issues
   */
  cleanFormatting(content, stats) {
    let cleaned = content;
    
    // Remove excessive whitespace
    const originalSpaces = cleaned.match(/\s+/g)?.length || 0;
    cleaned = cleaned.replace(/\s+/g, ' ');
    const finalSpaces = cleaned.match(/\s+/g)?.length || 0;
    
    if (originalSpaces > finalSpaces) {
      stats.enhancedSections.push({
        type: 'whitespace_cleanup',
        reduction: originalSpaces - finalSpaces
      });
    }
    
    // Remove multiple consecutive newlines
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Clean up punctuation spacing
    cleaned = cleaned.replace(/\s+([.!?])/g, '$1');
    cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
    
    // Trim and normalize
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  /**
   * Enhance fund management specific content
   */
  enhanceFundContent(content, stats) {
    let enhanced = content;
    
    if (this.options.fundManagementFilters.enhanceStepByStep) {
      enhanced = this.enhanceStepByStepContent(enhanced, stats);
    }
    
    if (this.options.fundManagementFilters.preserveDefinitions) {
      enhanced = this.enhanceDefinitions(enhanced, stats);
    }
    
    return enhanced;
  }

  /**
   * Enhance step-by-step content formatting
   */
  enhanceStepByStepContent(content, stats) {
    const stepMatches = content.match(this.fundEnhancementPatterns.stepByStep);
    
    if (stepMatches && stepMatches.length > 0) {
      stats.enhancedSections.push({
        type: 'step_by_step_enhancement',
        stepsFound: stepMatches.length
      });
      
      // Ensure proper formatting for steps
      let enhanced = content;
      stepMatches.forEach((step, index) => {
        const cleanStep = step.trim();
        if (cleanStep.length > 10) {
          // Ensure step starts on new line and is properly formatted
          const formattedStep = cleanStep.replace(/^(Step \d+)[:.]?\s*/, '$1: ');
          enhanced = enhanced.replace(step, '\n\n' + formattedStep + '\n');
        }
      });
      
      return enhanced;
    }
    
    return content;
  }

  /**
   * Enhance definition formatting
   */
  enhanceDefinitions(content, stats) {
    const definitionMatches = content.match(this.fundEnhancementPatterns.definitions);
    
    if (definitionMatches && definitionMatches.length > 0) {
      stats.enhancedSections.push({
        type: 'definition_enhancement',
        definitionsFound: definitionMatches.length
      });
      
      // Format definitions for better readability
      let enhanced = content;
      definitionMatches.forEach(definition => {
        const parts = definition.split(/\s+(?:is|means|refers to|are)\s+/);
        if (parts.length === 2) {
          const term = parts[0].trim();
          const meaning = parts[1].trim();
          const formattedDefinition = `**${term}**: ${meaning}`;
          enhanced = enhanced.replace(definition, formattedDefinition);
        }
      });
      
      return enhanced;
    }
    
    return content;
  }

  /**
   * Validate content quality
   */
  validateContentQuality(content) {
    const validation = {
      score: 0.5,
      issues: [],
      strengths: []
    };
    
    // Length validation
    if (content.length < this.options.qualityThresholds.minLength) {
      validation.issues.push('Content too short');
      validation.score -= 0.3;
    } else if (content.length > this.options.qualityThresholds.maxLength) {
      validation.issues.push('Content too long');
      validation.score -= 0.1;
    } else {
      validation.strengths.push('Appropriate length');
      validation.score += 0.1;
    }
    
    // Word count validation
    const wordCount = content.split(/\s+/).length;
    if (wordCount < this.options.qualityThresholds.minWords) {
      validation.issues.push('Too few words');
      validation.score -= 0.2;
    } else {
      validation.strengths.push('Adequate word count');
      validation.score += 0.1;
    }
    
    // Fund management relevance
    const fundRelevance = this.calculateFundRelevance(content);
    validation.score += fundRelevance * 0.3;
    
    if (fundRelevance > 0.5) {
      validation.strengths.push('High fund management relevance');
    }
    
    // Structural quality
    const structuralQuality = this.assessStructuralQuality(content);
    validation.score += structuralQuality * 0.2;
    
    // Ensure score is between 0 and 1
    validation.score = Math.max(0, Math.min(1, validation.score));
    
    return validation;
  }

  /**
   * Calculate fund management relevance score
   */
  calculateFundRelevance(content) {
    const fundTerms = [
      'fund', 'create', 'update', 'allocation', 'portfolio', 
      'nav', 'valuation', 'hierarchy', 'step', 'process'
    ];
    
    const contentLower = content.toLowerCase();
    const relevantTerms = fundTerms.filter(term => contentLower.includes(term));
    
    return relevantTerms.length / fundTerms.length;
  }

  /**
   * Assess structural quality of content
   */
  assessStructuralQuality(content) {
    let score = 0.5;
    
    // Check for proper sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length > 2) {
      score += 0.2;
    }
    
    // Check for step-by-step content
    if (/Step \d+/gi.test(content)) {
      score += 0.2;
    }
    
    // Check for procedural language
    if (/(navigate|click|select|choose|enter)/gi.test(content)) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * Get filtering statistics
   */
  getFilteringReport(stats) {
    return {
      summary: {
        originalLength: stats.originalLength,
        finalLength: stats.finalLength,
        reductionPercentage: stats.reductionPercentage,
        qualityScore: stats.qualityScore
      },
      removedContent: stats.removedPatterns,
      enhancements: stats.enhancedSections,
      qualityIssues: stats.qualityIssues
    };
  }
}

module.exports = IntelligentContentFilter;
