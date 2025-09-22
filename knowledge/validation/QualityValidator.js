/**
 * Quality Validator Module
 * Comprehensive quality validation and reporting for ingested content
 * Phase 1: Foundation & Infrastructure Setup
 */

const natural = require('natural');
const { getConfig } = require('../../config/environment');
const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

class QualityValidator {
  constructor() {
    this.config = getConfig();
    this.db = null;
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.wordTokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Quality thresholds
    this.thresholds = {
      minQualityScore: this.config.get('documentProcessing.filtering.minQualityScore') || 0.3,
      minTokenCount: this.config.get('documentProcessing.chunking.minChunkSize') || 100,
      maxTokenCount: this.config.get('documentProcessing.chunking.maxChunkSize') || 600,
      minReadabilityScore: 30, // Flesch Reading Ease
      maxDuplicateThreshold: 0.9, // Cosine similarity threshold for duplicates
      minContentDiversity: 0.3, // Unique words / total words ratio
      maxEmptyChunkRatio: 0.05 // Maximum 5% empty chunks allowed
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
   * Validate ingested document quality
   * @param {string} sourceId - Source ID to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation report
   */
  async validateDocumentQuality(sourceId, options = {}) {
    try {
      await this.initializeDatabase();
      
      logger.info(`🔍 Starting quality validation for source: ${sourceId}`);
      
      const validationOptions = {
        includeChunkAnalysis: options.includeChunkAnalysis !== false,
        includeContentAnalysis: options.includeContentAnalysis !== false,
        includeDuplicateDetection: options.includeDuplicateDetection !== false,
        includeEmbeddingAnalysis: options.includeEmbeddingAnalysis !== false,
        generateRecommendations: options.generateRecommendations !== false,
        ...options
      };

      // Get source information
      const sourceInfo = await this.getSourceInfo(sourceId);
      if (!sourceInfo) {
        throw new Error(`Source ${sourceId} not found`);
      }

      // Get all chunks for the source
      const chunks = await this.getSourceChunks(sourceId);
      if (chunks.length === 0) {
        throw new Error(`No chunks found for source ${sourceId}`);
      }

      logger.info(`📊 Validating ${chunks.length} chunks for ${sourceId}`);

      // Perform validation checks
      const validationResults = {
        sourceId,
        sourceInfo,
        totalChunks: chunks.length,
        validationTimestamp: new Date().toISOString(),
        validationOptions,
        
        // Individual validation results
        basicMetrics: await this.validateBasicMetrics(chunks),
        contentQuality: validationOptions.includeContentAnalysis ? await this.validateContentQuality(chunks) : null,
        chunkAnalysis: validationOptions.includeChunkAnalysis ? await this.validateChunkStructure(chunks) : null,
        duplicateAnalysis: validationOptions.includeDuplicateDetection ? await this.detectDuplicates(chunks) : null,
        embeddingAnalysis: validationOptions.includeEmbeddingAnalysis ? await this.validateEmbeddings(chunks) : null,
        
        // Overall assessment
        overallScore: 0,
        qualityGrade: 'Unknown',
        issues: [],
        warnings: [],
        recommendations: []
      };

      // Calculate overall score and generate recommendations
      this.calculateOverallScore(validationResults);
      
      if (validationOptions.generateRecommendations) {
        this.generateRecommendations(validationResults);
      }

      // Store validation results
      await this.storeValidationResults(validationResults);

      logger.info(`✅ Quality validation completed for ${sourceId}`);
      logger.info(`📊 Overall score: ${validationResults.overallScore.toFixed(2)}/100 (${validationResults.qualityGrade})`);

      return validationResults;
    } catch (error) {
      logger.error('❌ Quality validation failed:', error);
      throw new Error(`Quality validation failed: ${error.message}`);
    }
  }

  /**
   * Validate basic metrics
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Basic metrics validation
   */
  async validateBasicMetrics(chunks) {
    const metrics = {
      totalChunks: chunks.length,
      totalTokens: chunks.reduce((sum, chunk) => sum + chunk.token_count, 0),
      totalCharacters: chunks.reduce((sum, chunk) => sum + chunk.character_count, 0),
      totalWords: chunks.reduce((sum, chunk) => sum + chunk.word_count, 0),
      
      averageTokens: 0,
      averageCharacters: 0,
      averageWords: 0,
      averageQuality: 0,
      
      tokenDistribution: {
        underMin: 0,
        optimal: 0,
        overMax: 0
      },
      
      qualityDistribution: {
        high: 0,    // >= 0.8
        medium: 0,  // 0.6 - 0.8
        low: 0,     // 0.4 - 0.6
        poor: 0     // < 0.4
      },
      
      emptyChunks: 0,
      issues: [],
      warnings: []
    };

    if (chunks.length > 0) {
      metrics.averageTokens = Math.round(metrics.totalTokens / chunks.length);
      metrics.averageCharacters = Math.round(metrics.totalCharacters / chunks.length);
      metrics.averageWords = Math.round(metrics.totalWords / chunks.length);
      metrics.averageQuality = parseFloat((chunks.reduce((sum, chunk) => sum + chunk.quality_score, 0) / chunks.length).toFixed(3));
    }

    // Analyze token distribution
    chunks.forEach(chunk => {
      if (chunk.token_count < this.thresholds.minTokenCount) {
        metrics.tokenDistribution.underMin++;
      } else if (chunk.token_count > this.thresholds.maxTokenCount) {
        metrics.tokenDistribution.overMax++;
      } else {
        metrics.tokenDistribution.optimal++;
      }

      // Quality distribution
      if (chunk.quality_score >= 0.8) {
        metrics.qualityDistribution.high++;
      } else if (chunk.quality_score >= 0.6) {
        metrics.qualityDistribution.medium++;
      } else if (chunk.quality_score >= 0.4) {
        metrics.qualityDistribution.low++;
      } else {
        metrics.qualityDistribution.poor++;
      }

      // Empty chunks
      if (!chunk.content || chunk.content.trim().length === 0) {
        metrics.emptyChunks++;
      }
    });

    // Generate issues and warnings
    const emptyChunkRatio = metrics.emptyChunks / chunks.length;
    if (emptyChunkRatio > this.thresholds.maxEmptyChunkRatio) {
      metrics.issues.push(`High empty chunk ratio: ${(emptyChunkRatio * 100).toFixed(1)}% (threshold: ${(this.thresholds.maxEmptyChunkRatio * 100).toFixed(1)}%)`);
    }

    if (metrics.tokenDistribution.underMin > chunks.length * 0.2) {
      metrics.warnings.push(`${metrics.tokenDistribution.underMin} chunks (${((metrics.tokenDistribution.underMin / chunks.length) * 100).toFixed(1)}%) are below minimum token count`);
    }

    if (metrics.tokenDistribution.overMax > chunks.length * 0.1) {
      metrics.warnings.push(`${metrics.tokenDistribution.overMax} chunks (${((metrics.tokenDistribution.overMax / chunks.length) * 100).toFixed(1)}%) exceed maximum token count`);
    }

    if (metrics.averageQuality < this.thresholds.minQualityScore) {
      metrics.issues.push(`Average quality score ${metrics.averageQuality} is below threshold ${this.thresholds.minQualityScore}`);
    }

    return metrics;
  }

  /**
   * Validate content quality
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Content quality validation
   */
  async validateContentQuality(chunks) {
    const contentAnalysis = {
      languageConsistency: await this.analyzeLanguageConsistency(chunks),
      readabilityScores: await this.analyzeReadability(chunks),
      contentDiversity: await this.analyzeContentDiversity(chunks),
      structuralElements: await this.analyzeStructuralElements(chunks),
      topicCoherence: await this.analyzeTopicCoherence(chunks),
      issues: [],
      warnings: []
    };

    // Generate issues based on analysis
    if (contentAnalysis.languageConsistency.inconsistentChunks > chunks.length * 0.1) {
      contentAnalysis.issues.push(`High language inconsistency: ${contentAnalysis.languageConsistency.inconsistentChunks} chunks`);
    }

    if (contentAnalysis.readabilityScores.averageScore < this.thresholds.minReadabilityScore) {
      contentAnalysis.warnings.push(`Low average readability score: ${contentAnalysis.readabilityScores.averageScore.toFixed(1)}`);
    }

    if (contentAnalysis.contentDiversity.averageDiversity < this.thresholds.minContentDiversity) {
      contentAnalysis.warnings.push(`Low content diversity: ${contentAnalysis.contentDiversity.averageDiversity.toFixed(3)}`);
    }

    return contentAnalysis;
  }

  /**
   * Validate chunk structure
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Chunk structure validation
   */
  async validateChunkStructure(chunks) {
    const structureAnalysis = {
      chunkTypes: {},
      headingCoverage: 0,
      sectionPathAnalysis: {},
      pageDistribution: {},
      overlappingChunks: 0,
      orphanedChunks: 0,
      issues: [],
      warnings: []
    };

    // Analyze chunk types
    chunks.forEach(chunk => {
      const type = chunk.content_type || 'unknown';
      structureAnalysis.chunkTypes[type] = (structureAnalysis.chunkTypes[type] || 0) + 1;

      // Count chunks with headings
      if (chunk.heading) {
        structureAnalysis.headingCoverage++;
      }

      // Analyze section paths
      if (chunk.section_path && chunk.section_path.length > 0) {
        const pathKey = chunk.section_path.join(' > ');
        structureAnalysis.sectionPathAnalysis[pathKey] = (structureAnalysis.sectionPathAnalysis[pathKey] || 0) + 1;
      } else {
        structureAnalysis.orphanedChunks++;
      }

      // Analyze page distribution
      if (chunk.page_number) {
        structureAnalysis.pageDistribution[chunk.page_number] = (structureAnalysis.pageDistribution[chunk.page_number] || 0) + 1;
      }
    });

    structureAnalysis.headingCoverage = (structureAnalysis.headingCoverage / chunks.length) * 100;

    // Generate warnings
    if (structureAnalysis.headingCoverage < 50) {
      structureAnalysis.warnings.push(`Low heading coverage: ${structureAnalysis.headingCoverage.toFixed(1)}%`);
    }

    if (structureAnalysis.orphanedChunks > chunks.length * 0.2) {
      structureAnalysis.warnings.push(`High number of orphaned chunks: ${structureAnalysis.orphanedChunks}`);
    }

    return structureAnalysis;
  }

  /**
   * Detect duplicate chunks
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Duplicate detection results
   */
  async detectDuplicates(chunks) {
    const duplicateAnalysis = {
      exactDuplicates: [],
      nearDuplicates: [],
      duplicateCount: 0,
      duplicateRatio: 0,
      issues: [],
      warnings: []
    };

    // Create content hashes for exact duplicate detection
    const contentHashes = new Map();
    
    chunks.forEach((chunk, index) => {
      const contentHash = this.hashContent(chunk.content);
      
      if (contentHashes.has(contentHash)) {
        duplicateAnalysis.exactDuplicates.push({
          chunk1Index: contentHashes.get(contentHash),
          chunk2Index: index,
          similarity: 1.0,
          type: 'exact'
        });
      } else {
        contentHashes.set(contentHash, index);
      }
    });

    // Near-duplicate detection using simple text similarity
    // Note: In production, you might want to use more sophisticated methods
    for (let i = 0; i < chunks.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 50, chunks.length); j++) { // Limit comparisons for performance
        const similarity = this.calculateTextSimilarity(chunks[i].content, chunks[j].content);
        
        if (similarity > this.thresholds.maxDuplicateThreshold && similarity < 1.0) {
          duplicateAnalysis.nearDuplicates.push({
            chunk1Index: i,
            chunk2Index: j,
            similarity: similarity,
            type: 'near'
          });
        }
      }
    }

    duplicateAnalysis.duplicateCount = duplicateAnalysis.exactDuplicates.length + duplicateAnalysis.nearDuplicates.length;
    duplicateAnalysis.duplicateRatio = duplicateAnalysis.duplicateCount / chunks.length;

    // Generate issues
    if (duplicateAnalysis.exactDuplicates.length > 0) {
      duplicateAnalysis.issues.push(`Found ${duplicateAnalysis.exactDuplicates.length} exact duplicate chunks`);
    }

    if (duplicateAnalysis.duplicateRatio > 0.1) {
      duplicateAnalysis.warnings.push(`High duplicate ratio: ${(duplicateAnalysis.duplicateRatio * 100).toFixed(1)}%`);
    }

    return duplicateAnalysis;
  }

  /**
   * Validate embeddings
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Embedding validation results
   */
  async validateEmbeddings(chunks) {
    const embeddingAnalysis = {
      totalEmbeddings: 0,
      missingEmbeddings: 0,
      invalidEmbeddings: 0,
      dimensionConsistency: true,
      averageMagnitude: 0,
      magnitudeDistribution: {
        normalized: 0,
        underNormalized: 0,
        overNormalized: 0
      },
      issues: [],
      warnings: []
    };

    const expectedDimension = this.config.get('vector.dimension');
    let totalMagnitude = 0;
    let validEmbeddings = 0;

    chunks.forEach(chunk => {
      if (!chunk.embedding) {
        embeddingAnalysis.missingEmbeddings++;
        return;
      }

      embeddingAnalysis.totalEmbeddings++;

      // Parse embedding if it's a string
      let embedding;
      try {
        embedding = typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : chunk.embedding;
      } catch (error) {
        embeddingAnalysis.invalidEmbeddings++;
        return;
      }

      // Check dimension
      if (embedding.length !== expectedDimension) {
        embeddingAnalysis.dimensionConsistency = false;
        embeddingAnalysis.invalidEmbeddings++;
        return;
      }

      // Check for invalid values
      const hasInvalidValues = embedding.some(val => !isFinite(val));
      if (hasInvalidValues) {
        embeddingAnalysis.invalidEmbeddings++;
        return;
      }

      // Calculate magnitude
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      totalMagnitude += magnitude;
      validEmbeddings++;

      // Categorize magnitude (embeddings should be normalized)
      if (Math.abs(magnitude - 1.0) < 0.1) {
        embeddingAnalysis.magnitudeDistribution.normalized++;
      } else if (magnitude < 0.9) {
        embeddingAnalysis.magnitudeDistribution.underNormalized++;
      } else {
        embeddingAnalysis.magnitudeDistribution.overNormalized++;
      }
    });

    if (validEmbeddings > 0) {
      embeddingAnalysis.averageMagnitude = totalMagnitude / validEmbeddings;
    }

    // Generate issues
    if (embeddingAnalysis.missingEmbeddings > 0) {
      embeddingAnalysis.issues.push(`${embeddingAnalysis.missingEmbeddings} chunks missing embeddings`);
    }

    if (embeddingAnalysis.invalidEmbeddings > 0) {
      embeddingAnalysis.issues.push(`${embeddingAnalysis.invalidEmbeddings} chunks have invalid embeddings`);
    }

    if (!embeddingAnalysis.dimensionConsistency) {
      embeddingAnalysis.issues.push(`Embedding dimension inconsistency detected`);
    }

    if (embeddingAnalysis.magnitudeDistribution.normalized / embeddingAnalysis.totalEmbeddings < 0.8) {
      embeddingAnalysis.warnings.push(`Many embeddings are not properly normalized`);
    }

    return embeddingAnalysis;
  }

  /**
   * Analyze language consistency
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Language consistency analysis
   */
  async analyzeLanguageConsistency(chunks) {
    const languages = {};
    let inconsistentChunks = 0;

    chunks.forEach(chunk => {
      const language = chunk.language || 'unknown';
      languages[language] = (languages[language] || 0) + 1;
    });

    const primaryLanguage = Object.keys(languages).reduce((a, b) => languages[a] > languages[b] ? a : b);
    
    chunks.forEach(chunk => {
      if (chunk.language && chunk.language !== primaryLanguage) {
        inconsistentChunks++;
      }
    });

    return {
      languages,
      primaryLanguage,
      inconsistentChunks,
      consistencyRatio: (chunks.length - inconsistentChunks) / chunks.length
    };
  }

  /**
   * Analyze readability
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Readability analysis
   */
  async analyzeReadability(chunks) {
    const readabilityScores = [];
    
    chunks.forEach(chunk => {
      if (chunk.content && chunk.content.trim()) {
        const score = this.calculateFleschReadingEase(chunk.content);
        readabilityScores.push(score);
      }
    });

    const averageScore = readabilityScores.length > 0 
      ? readabilityScores.reduce((sum, score) => sum + score, 0) / readabilityScores.length 
      : 0;

    return {
      averageScore,
      minScore: Math.min(...readabilityScores),
      maxScore: Math.max(...readabilityScores),
      scoreDistribution: this.categorizeReadabilityScores(readabilityScores)
    };
  }

  /**
   * Analyze content diversity
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Content diversity analysis
   */
  async analyzeContentDiversity(chunks) {
    const diversityScores = [];
    
    chunks.forEach(chunk => {
      if (chunk.content && chunk.content.trim()) {
        const words = this.wordTokenizer.tokenize(chunk.content.toLowerCase());
        const uniqueWords = new Set(words).size;
        const diversity = words.length > 0 ? uniqueWords / words.length : 0;
        diversityScores.push(diversity);
      }
    });

    const averageDiversity = diversityScores.length > 0 
      ? diversityScores.reduce((sum, score) => sum + score, 0) / diversityScores.length 
      : 0;

    return {
      averageDiversity,
      minDiversity: Math.min(...diversityScores),
      maxDiversity: Math.max(...diversityScores),
      lowDiversityChunks: diversityScores.filter(score => score < this.thresholds.minContentDiversity).length
    };
  }

  /**
   * Analyze structural elements
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Structural elements analysis
   */
  async analyzeStructuralElements(chunks) {
    const elements = {
      hasHeadings: 0,
      hasTables: 0,
      hasLists: 0,
      hasCode: 0,
      hasDefinitions: 0,
      hasProcedures: 0
    };

    chunks.forEach(chunk => {
      if (chunk.heading) elements.hasHeadings++;
      
      const contentType = chunk.content_type || '';
      switch (contentType) {
        case 'table': elements.hasTables++; break;
        case 'list': elements.hasLists++; break;
        case 'code': elements.hasCode++; break;
        case 'definition': elements.hasDefinitions++; break;
        case 'procedure': elements.hasProcedures++; break;
      }
    });

    return {
      ...elements,
      structuralRichness: Object.values(elements).reduce((sum, count) => sum + (count > 0 ? 1 : 0), 0) / Object.keys(elements).length
    };
  }

  /**
   * Analyze topic coherence
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Topic coherence analysis
   */
  async analyzeTopicCoherence(chunks) {
    // Simple topic coherence based on word overlap between adjacent chunks
    let coherenceScores = [];
    
    for (let i = 0; i < chunks.length - 1; i++) {
      const chunk1Words = new Set(this.wordTokenizer.tokenize(chunks[i].content.toLowerCase()));
      const chunk2Words = new Set(this.wordTokenizer.tokenize(chunks[i + 1].content.toLowerCase()));
      
      const intersection = new Set([...chunk1Words].filter(word => chunk2Words.has(word)));
      const union = new Set([...chunk1Words, ...chunk2Words]);
      
      const coherence = union.size > 0 ? intersection.size / union.size : 0;
      coherenceScores.push(coherence);
    }

    const averageCoherence = coherenceScores.length > 0 
      ? coherenceScores.reduce((sum, score) => sum + score, 0) / coherenceScores.length 
      : 0;

    return {
      averageCoherence,
      minCoherence: Math.min(...coherenceScores),
      maxCoherence: Math.max(...coherenceScores),
      lowCoherenceTransitions: coherenceScores.filter(score => score < 0.1).length
    };
  }

  /**
   * Calculate overall quality score
   * @param {Object} validationResults - Validation results object
   */
  calculateOverallScore(validationResults) {
    let totalScore = 0;
    let weightSum = 0;

    // Basic metrics (weight: 30%)
    if (validationResults.basicMetrics) {
      const basicScore = this.calculateBasicMetricsScore(validationResults.basicMetrics);
      totalScore += basicScore * 0.3;
      weightSum += 0.3;
    }

    // Content quality (weight: 25%)
    if (validationResults.contentQuality) {
      const contentScore = this.calculateContentQualityScore(validationResults.contentQuality);
      totalScore += contentScore * 0.25;
      weightSum += 0.25;
    }

    // Chunk structure (weight: 20%)
    if (validationResults.chunkAnalysis) {
      const structureScore = this.calculateStructureScore(validationResults.chunkAnalysis);
      totalScore += structureScore * 0.2;
      weightSum += 0.2;
    }

    // Duplicate analysis (weight: 15%)
    if (validationResults.duplicateAnalysis) {
      const duplicateScore = this.calculateDuplicateScore(validationResults.duplicateAnalysis);
      totalScore += duplicateScore * 0.15;
      weightSum += 0.15;
    }

    // Embedding quality (weight: 10%)
    if (validationResults.embeddingAnalysis) {
      const embeddingScore = this.calculateEmbeddingScore(validationResults.embeddingAnalysis);
      totalScore += embeddingScore * 0.1;
      weightSum += 0.1;
    }

    validationResults.overallScore = weightSum > 0 ? (totalScore / weightSum) * 100 : 0;
    validationResults.qualityGrade = this.getQualityGrade(validationResults.overallScore);
  }

  /**
   * Calculate basic metrics score
   * @param {Object} basicMetrics - Basic metrics
   * @returns {number} Score (0-1)
   */
  calculateBasicMetricsScore(basicMetrics) {
    let score = 0.5; // Base score

    // Quality score factor
    if (basicMetrics.averageQuality >= 0.8) score += 0.3;
    else if (basicMetrics.averageQuality >= 0.6) score += 0.2;
    else if (basicMetrics.averageQuality >= 0.4) score += 0.1;

    // Token distribution factor
    const optimalRatio = basicMetrics.tokenDistribution.optimal / basicMetrics.totalChunks;
    score += optimalRatio * 0.2;

    // Penalty for issues
    score -= basicMetrics.issues.length * 0.1;
    score -= basicMetrics.warnings.length * 0.05;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate content quality score
   * @param {Object} contentQuality - Content quality metrics
   * @returns {number} Score (0-1)
   */
  calculateContentQualityScore(contentQuality) {
    let score = 0.5; // Base score

    // Language consistency
    score += contentQuality.languageConsistency.consistencyRatio * 0.2;

    // Readability
    if (contentQuality.readabilityScores.averageScore >= 60) score += 0.2;
    else if (contentQuality.readabilityScores.averageScore >= 30) score += 0.1;

    // Content diversity
    score += Math.min(contentQuality.contentDiversity.averageDiversity * 2, 0.2);

    // Structural richness
    score += contentQuality.structuralElements.structuralRichness * 0.1;

    // Penalty for issues
    score -= contentQuality.issues.length * 0.1;
    score -= contentQuality.warnings.length * 0.05;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate structure score
   * @param {Object} chunkAnalysis - Chunk analysis
   * @returns {number} Score (0-1)
   */
  calculateStructureScore(chunkAnalysis) {
    let score = 0.5; // Base score

    // Heading coverage
    score += (chunkAnalysis.headingCoverage / 100) * 0.3;

    // Orphaned chunks penalty
    const orphanRatio = chunkAnalysis.orphanedChunks / Object.keys(chunkAnalysis.chunkTypes).length;
    score -= orphanRatio * 0.2;

    // Content type diversity
    const typeCount = Object.keys(chunkAnalysis.chunkTypes).length;
    score += Math.min(typeCount / 5, 0.2);

    // Penalty for warnings
    score -= chunkAnalysis.warnings.length * 0.05;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate duplicate score
   * @param {Object} duplicateAnalysis - Duplicate analysis
   * @returns {number} Score (0-1)
   */
  calculateDuplicateScore(duplicateAnalysis) {
    let score = 1.0; // Start with perfect score

    // Penalty for exact duplicates
    score -= duplicateAnalysis.exactDuplicates.length * 0.1;

    // Penalty for near duplicates
    score -= duplicateAnalysis.nearDuplicates.length * 0.05;

    // Additional penalty for high duplicate ratio
    if (duplicateAnalysis.duplicateRatio > 0.2) {
      score -= 0.3;
    } else if (duplicateAnalysis.duplicateRatio > 0.1) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate embedding score
   * @param {Object} embeddingAnalysis - Embedding analysis
   * @returns {number} Score (0-1)
   */
  calculateEmbeddingScore(embeddingAnalysis) {
    let score = 0.5; // Base score

    // Completeness
    const completenessRatio = embeddingAnalysis.totalEmbeddings / (embeddingAnalysis.totalEmbeddings + embeddingAnalysis.missingEmbeddings);
    score += completenessRatio * 0.3;

    // Validity
    const validityRatio = (embeddingAnalysis.totalEmbeddings - embeddingAnalysis.invalidEmbeddings) / embeddingAnalysis.totalEmbeddings;
    score += validityRatio * 0.2;

    // Normalization
    const normalizedRatio = embeddingAnalysis.magnitudeDistribution.normalized / embeddingAnalysis.totalEmbeddings;
    score += normalizedRatio * 0.2;

    // Penalty for issues
    score -= embeddingAnalysis.issues.length * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get quality grade from score
   * @param {number} score - Overall score (0-100)
   * @returns {string} Quality grade
   */
  getQualityGrade(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Generate recommendations based on validation results
   * @param {Object} validationResults - Validation results
   */
  generateRecommendations(validationResults) {
    const recommendations = [];

    // Basic metrics recommendations
    if (validationResults.basicMetrics) {
      const metrics = validationResults.basicMetrics;
      
      if (metrics.tokenDistribution.underMin > metrics.totalChunks * 0.2) {
        recommendations.push({
          type: 'chunking',
          priority: 'medium',
          issue: 'Many chunks are below minimum token count',
          recommendation: 'Consider increasing chunk size or improving chunking strategy to create more substantial chunks'
        });
      }

      if (metrics.averageQuality < 0.6) {
        recommendations.push({
          type: 'quality',
          priority: 'high',
          issue: 'Low average quality score',
          recommendation: 'Review document preprocessing and chunking parameters to improve content quality'
        });
      }
    }

    // Content quality recommendations
    if (validationResults.contentQuality) {
      const content = validationResults.contentQuality;
      
      if (content.readabilityScores.averageScore < 30) {
        recommendations.push({
          type: 'readability',
          priority: 'medium',
          issue: 'Low readability scores',
          recommendation: 'Consider simplifying language or improving document structure for better readability'
        });
      }

      if (content.contentDiversity.averageDiversity < 0.3) {
        recommendations.push({
          type: 'diversity',
          priority: 'low',
          issue: 'Low content diversity',
          recommendation: 'Review if the document contains sufficient variety in vocabulary and concepts'
        });
      }
    }

    // Duplicate recommendations
    if (validationResults.duplicateAnalysis) {
      const duplicates = validationResults.duplicateAnalysis;
      
      if (duplicates.exactDuplicates.length > 0) {
        recommendations.push({
          type: 'duplicates',
          priority: 'high',
          issue: `Found ${duplicates.exactDuplicates.length} exact duplicate chunks`,
          recommendation: 'Remove duplicate chunks to improve storage efficiency and search quality'
        });
      }

      if (duplicates.duplicateRatio > 0.1) {
        recommendations.push({
          type: 'duplicates',
          priority: 'medium',
          issue: 'High duplicate content ratio',
          recommendation: 'Review chunking strategy to reduce overlap and improve content uniqueness'
        });
      }
    }

    // Embedding recommendations
    if (validationResults.embeddingAnalysis) {
      const embeddings = validationResults.embeddingAnalysis;
      
      if (embeddings.missingEmbeddings > 0) {
        recommendations.push({
          type: 'embeddings',
          priority: 'high',
          issue: `${embeddings.missingEmbeddings} chunks missing embeddings`,
          recommendation: 'Re-run embedding generation for chunks with missing embeddings'
        });
      }

      if (embeddings.invalidEmbeddings > 0) {
        recommendations.push({
          type: 'embeddings',
          priority: 'high',
          issue: `${embeddings.invalidEmbeddings} chunks have invalid embeddings`,
          recommendation: 'Regenerate embeddings for chunks with invalid embedding vectors'
        });
      }
    }

    validationResults.recommendations = recommendations;
  }

  /**
   * Helper methods
   */

  /**
   * Get source information
   * @param {string} sourceId - Source ID
   * @returns {Object|null} Source information
   */
  async getSourceInfo(sourceId) {
    const result = await this.db.query(`
      SELECT * FROM kb_sources WHERE source_id = $1
    `, [sourceId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get source chunks
   * @param {string} sourceId - Source ID
   * @returns {Array} Array of chunks
   */
  async getSourceChunks(sourceId) {
    const result = await this.db.query(`
      SELECT * FROM kb_chunks WHERE source_id = $1 ORDER BY chunk_index
    `, [sourceId]);
    
    return result.rows;
  }

  /**
   * Store validation results
   * @param {Object} validationResults - Validation results
   */
  async storeValidationResults(validationResults) {
    try {
      await this.db.query(`
        INSERT INTO validation_reports (
          source_id, validation_timestamp, overall_score, quality_grade,
          total_chunks, issues_count, warnings_count, recommendations_count,
          validation_results
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (source_id) DO UPDATE SET
          validation_timestamp = EXCLUDED.validation_timestamp,
          overall_score = EXCLUDED.overall_score,
          quality_grade = EXCLUDED.quality_grade,
          total_chunks = EXCLUDED.total_chunks,
          issues_count = EXCLUDED.issues_count,
          warnings_count = EXCLUDED.warnings_count,
          recommendations_count = EXCLUDED.recommendations_count,
          validation_results = EXCLUDED.validation_results
      `, [
        validationResults.sourceId,
        validationResults.validationTimestamp,
        validationResults.overallScore,
        validationResults.qualityGrade,
        validationResults.totalChunks,
        validationResults.issues.length,
        validationResults.warnings.length,
        validationResults.recommendations.length,
        JSON.stringify(validationResults)
      ]);
    } catch (error) {
      // Table might not exist yet - this is optional functionality
      logger.warn('Could not store validation results:', error.message);
    }
  }

  /**
   * Hash content for duplicate detection
   * @param {string} content - Content to hash
   * @returns {string} Content hash
   */
  hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content.trim().toLowerCase()).digest('hex');
  }

  /**
   * Calculate text similarity using Jaccard similarity
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(this.wordTokenizer.tokenize(text1.toLowerCase()));
    const words2 = new Set(this.wordTokenizer.tokenize(text2.toLowerCase()));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate Flesch Reading Ease score
   * @param {string} text - Text to analyze
   * @returns {number} Flesch Reading Ease score
   */
  calculateFleschReadingEase(text) {
    const sentences = this.sentenceTokenizer.tokenize(text);
    const words = this.wordTokenizer.tokenize(text);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  /**
   * Count syllables in a word (simple approximation)
   * @param {string} word - Word to count syllables
   * @returns {number} Syllable count
   */
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent 'e'
    if (word.endsWith('e')) {
      count--;
    }
    
    return Math.max(1, count);
  }

  /**
   * Categorize readability scores
   * @param {Array} scores - Array of readability scores
   * @returns {Object} Score distribution
   */
  categorizeReadabilityScores(scores) {
    const categories = {
      'very_easy': 0,    // 90-100
      'easy': 0,         // 80-90
      'fairly_easy': 0,  // 70-80
      'standard': 0,     // 60-70
      'fairly_difficult': 0, // 50-60
      'difficult': 0,    // 30-50
      'very_difficult': 0 // 0-30
    };
    
    scores.forEach(score => {
      if (score >= 90) categories.very_easy++;
      else if (score >= 80) categories.easy++;
      else if (score >= 70) categories.fairly_easy++;
      else if (score >= 60) categories.standard++;
      else if (score >= 50) categories.fairly_difficult++;
      else if (score >= 30) categories.difficult++;
      else categories.very_difficult++;
    });
    
    return categories;
  }
}

module.exports = QualityValidator;
