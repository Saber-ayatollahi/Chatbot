/**
 * Enhanced Document Processing Service
 * Incorporates all context retrieval fixes into the ingestion pipeline
 * Ensures high-quality data from the start, eliminating need for post-processing fixes
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const { getConfig } = require('../config/environment');

// Document processing dependencies with graceful fallbacks
let mammoth = null;
let pdfParse = null;

try {
  mammoth = require('mammoth');
} catch (error) {
  console.warn('⚠️ mammoth not available - DOCX processing will be limited');
}

try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('⚠️ pdf-parse not available - PDF processing will be limited');
}

class EnhancedDocumentProcessingService {
  constructor(options = {}) {
    this.config = getConfig();
    this.db = getDatabase();
    
    this.options = {
      // Document parsing options
      documentParsing: {
        preserveStructure: true,
        extractHeadings: true,
        removeJunkContent: true,
        detectSections: true
      },
      
      // Content filtering options
      contentFiltering: {
        removeTableOfContents: true,
        removeCopyrightNotices: true,
        removeIntroductionSections: true,
        minContentLength: 100,
        maxContentLength: 10000
      },
      
      // Chunking strategy
      chunkingStrategy: {
        respectDocumentStructure: true,
        preserveHeadings: true,
        semanticBoundaries: true,
        optimalChunkSize: 800,
        overlapSize: 100
      },
      
      // Quality validation
      qualityValidation: {
        enableRealTimeValidation: true,
        minQualityScore: 0.4,
        contentRelevanceCheck: true,
        duplicateDetection: true
      },
      
      // Content classification
      contentClassification: {
        enableAutoClassification: true,
        detectStepByStep: true,
        detectDefinitions: true,
        detectProcedures: true
      },
      
      ...options
    };

    // Content filters for junk removal
    this.junkPatterns = [
      /Table of [Cc]ontents/gi,
      /© \w+/gi,
      /www\.\w+\.com/gi,
      /Press release/gi,
      /Confidential Information - Do Not Redistribute/gi,
      /^Introduction\s*\.{3,}/gi,
      /^\.{3,}/gi
    ];

    // Heading patterns for structure detection
    this.headingPatterns = [
      /^(Creating Funds?|Fund Creation)/gi,
      /^(Fund Update|Updating)/gi,
      /^(Fund Types?|Types of Funds?)/gi,
      /^(Step \d+[:.]?)/gi,
      /^(Hierarchy|Roll [Ff]orward|Security [Cc]ontext)/gi
    ];

    // Content classification patterns
    this.classificationPatterns = {
      stepByStep: /Step \d+|First|Second|Third|Next|Finally|Then/gi,
      procedure: /navigate to|click|button|select|choose|enter/gi,
      definition: /is defined as|means|refers to|is a|are a/gi,
      fundCreation: /create.*fund|fund.*creat|new fund|fund setup/gi,
      fundUpdate: /fund update|update.*fund|updating/gi
    };
  }

  /**
   * Enhanced document processing pipeline
   */
  async processDocument(filePath, sourceId, version, options = {}) {
    const config = { ...this.options, ...options };
    console.log(`🚀 Enhanced processing for: ${sourceId}`);
    
    const startTime = Date.now();
    const jobId = await this.createJobRecord(sourceId, 'enhanced_ingestion', config);

    try {
      // Step 1: Enhanced document parsing with structure preservation
      await this.updateJobProgress(jobId, 10, 'Parsing document with structure preservation');
      const parsedDocument = await this.parseDocumentWithStructure(filePath, sourceId);
      
      // Step 2: Intelligent content filtering
      await this.updateJobProgress(jobId, 25, 'Filtering junk content');
      const filteredContent = await this.filterJunkContent(parsedDocument);
      
      // Step 3: Smart heading extraction and section detection
      await this.updateJobProgress(jobId, 40, 'Extracting headings and detecting sections');
      const structuredDocument = await this.extractDocumentStructure(filteredContent);
      
      // Step 4: Quality-aware semantic chunking
      await this.updateJobProgress(jobId, 60, 'Generating quality-aware chunks');
      const chunks = await this.generateQualityAwareChunks(structuredDocument, config);
      
      // Step 5: Content classification and enhancement
      await this.updateJobProgress(jobId, 75, 'Classifying and enhancing content');
      const enhancedChunks = await this.classifyAndEnhanceChunks(chunks);
      
      // Step 6: Real-time quality validation
      await this.updateJobProgress(jobId, 85, 'Validating chunk quality');
      const validatedChunks = await this.validateChunkQuality(enhancedChunks, config);
      
      // Step 7: Store with enhanced metadata
      await this.updateJobProgress(jobId, 95, 'Storing with enhanced metadata');
      const storageResult = await this.storeEnhancedChunks(validatedChunks, sourceId, version);
      
      const processingTime = Date.now() - startTime;
      await this.completeJob(jobId, processingTime, storageResult);
      
      console.log(`✅ Enhanced processing completed in ${processingTime}ms`);
      console.log(`📊 Generated ${validatedChunks.length} high-quality chunks`);
      
      return {
        success: true,
        chunksGenerated: validatedChunks.length,
        processingTime,
        qualityStats: storageResult.qualityStats
      };
      
    } catch (error) {
      console.error(`❌ Enhanced processing failed:`, error);
      await this.failJob(jobId, error);
      throw error;
    }
  }

  /**
   * Enhanced document parsing with structure preservation
   */
  async parseDocumentWithStructure(filePath, sourceId) {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    console.log(`📄 Parsing ${fileExtension} with structure preservation...`);
    
    try {
      if (fileExtension === '.docx') {
        return await this.parseDocxWithStructure(filePath);
      } else if (fileExtension === '.pdf') {
        return await this.parsePdfWithStructure(filePath);
      } else {
        // Fallback to text parsing
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          content,
          structure: { headings: [], sections: [] },
          metadata: { sourceType: 'text', hasStructure: false }
        };
      }
    } catch (error) {
      console.error(`❌ Document parsing failed:`, error);
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }

  /**
   * Enhanced .docx parsing with heading extraction
   */
  async parseDocxWithStructure(filePath) {
    try {
      if (!mammoth) {
        console.warn('⚠️ mammoth not available - using fallback DOCX processing');
        // Fallback: return basic file info
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return {
          content: `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: Microsoft Word Document (mammoth not available)`,
          structure: { headings: [], sections: [] },
          metadata: {
            sourceType: 'docx',
            hasStructure: false,
            parsingMessages: [],
            fallback: true,
            error: 'mammoth not available'
          }
        };
      }
      
      // Use mammoth for better .docx parsing with style preservation
      const result = await mammoth.convertToHtml(filePath, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:fresh"
        ]
      });
      
      const htmlContent = result.value;
      const messages = result.messages;
      
      // Extract structure from HTML
      const structure = this.extractStructureFromHtml(htmlContent);
      
      // Convert HTML to clean text while preserving structure markers
      const cleanContent = this.htmlToStructuredText(htmlContent);
      
      return {
        content: cleanContent,
        structure: structure,
        metadata: {
          sourceType: 'docx',
          hasStructure: true,
          parsingMessages: messages,
          headingCount: structure.headings.length
        }
      };
      
    } catch (error) {
      console.error(`❌ DOCX parsing failed:`, error);
      // Fallback to basic text extraction
      return await this.fallbackTextExtraction(filePath);
    }
  }

  /**
   * Enhanced PDF parsing with layout analysis
   */
  async parsePdfWithStructure(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer, {
        // Options for better text extraction
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });
      
      const content = pdfData.text;
      
      // Analyze PDF structure
      const structure = this.analyzeTextStructure(content);
      
      return {
        content: content,
        structure: structure,
        metadata: {
          sourceType: 'pdf',
          hasStructure: structure.headings.length > 0,
          pageCount: pdfData.numpages,
          headingCount: structure.headings.length
        }
      };
      
    } catch (error) {
      console.error(`❌ PDF parsing failed:`, error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  /**
   * Intelligent junk content filtering
   */
  async filterJunkContent(parsedDocument) {
    console.log('🧹 Filtering junk content...');
    
    let content = parsedDocument.content;
    let removedSections = [];
    
    // Remove junk patterns
    for (const pattern of this.junkPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        removedSections.push(...matches);
        content = content.replace(pattern, '');
      }
    }
    
    // Remove table of contents sections
    content = this.removeTableOfContents(content);
    
    // Remove copyright and legal notices
    content = this.removeCopyrightNotices(content);
    
    // Clean up excessive whitespace
    content = content.replace(/\s+/g, ' ').trim();
    
    console.log(`   🗑️ Removed ${removedSections.length} junk patterns`);
    
    return {
      ...parsedDocument,
      content: content,
      filteringStats: {
        removedSections: removedSections.length,
        originalLength: parsedDocument.content.length,
        filteredLength: content.length,
        reductionPercentage: Math.round((1 - content.length / parsedDocument.content.length) * 100)
      }
    };
  }

  /**
   * Smart heading extraction and section detection
   */
  async extractDocumentStructure(filteredDocument) {
    console.log('📚 Extracting document structure...');
    
    const content = filteredDocument.content;
    const headings = [];
    const sections = [];
    
    // Extract headings using multiple strategies
    const lines = content.split('\n');
    let currentSection = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.length === 0) continue;
      
      // Check if line is a heading
      const headingInfo = this.detectHeading(line, i);
      
      if (headingInfo) {
        headings.push(headingInfo);
        
        // Close previous section
        if (currentSection) {
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          heading: headingInfo.text,
          level: headingInfo.level,
          startLine: i,
          endLine: null,
          type: this.classifyHeadingType(headingInfo.text)
        };
      }
    }
    
    // Close final section
    if (currentSection) {
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }
    
    console.log(`   📝 Extracted ${headings.length} headings and ${sections.length} sections`);
    
    return {
      ...filteredDocument,
      structure: {
        ...filteredDocument.structure,
        headings: headings,
        sections: sections,
        lines: lines
      }
    };
  }

  /**
   * Quality-aware semantic chunking
   */
  async generateQualityAwareChunks(structuredDocument, config) {
    console.log('🔧 Generating quality-aware chunks...');
    
    const chunks = [];
    const sections = structuredDocument.structure.sections;
    const lines = structuredDocument.structure.lines;
    
    for (const section of sections) {
      const sectionContent = lines.slice(section.startLine, section.endLine + 1).join('\n');
      
      // Skip if section is too short
      if (sectionContent.length < config.contentFiltering.minContentLength) {
        continue;
      }
      
      // Generate chunks for this section
      const sectionChunks = await this.chunkSectionWithQuality(
        sectionContent, 
        section, 
        config.chunkingStrategy
      );
      
      chunks.push(...sectionChunks);
    }
    
    console.log(`   📄 Generated ${chunks.length} quality-aware chunks`);
    return chunks;
  }

  /**
   * Chunk a section while preserving quality and context
   */
  async chunkSectionWithQuality(content, section, chunkingConfig) {
    const chunks = [];
    const sentences = this.splitIntoSentences(content);
    
    let currentChunk = {
      content: '',
      sentences: [],
      tokenCount: 0
    };
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      // Check if adding this sentence would exceed optimal chunk size
      if (currentChunk.tokenCount + sentenceTokens > chunkingConfig.optimalChunkSize && 
          currentChunk.content.length > 0) {
        
        // Finalize current chunk
        const chunk = this.finalizeChunk(currentChunk, section);
        if (this.isChunkQualityAcceptable(chunk)) {
          chunks.push(chunk);
        }
        
        // Start new chunk with overlap
        currentChunk = this.startNewChunkWithOverlap(currentChunk, chunkingConfig.overlapSize);
      }
      
      // Add sentence to current chunk
      currentChunk.content += (currentChunk.content ? ' ' : '') + sentence;
      currentChunk.sentences.push(sentence);
      currentChunk.tokenCount += sentenceTokens;
    }
    
    // Finalize last chunk
    if (currentChunk.content.length > 0) {
      const chunk = this.finalizeChunk(currentChunk, section);
      if (this.isChunkQualityAcceptable(chunk)) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Content classification and enhancement
   */
  async classifyAndEnhanceChunks(chunks) {
    console.log('🏷️ Classifying and enhancing chunks...');
    
    const enhancedChunks = [];
    
    for (const chunk of chunks) {
      const enhanced = {
        ...chunk,
        classification: this.classifyChunkContent(chunk.content),
        enhancement: this.enhanceChunkMetadata(chunk)
      };
      
      enhancedChunks.push(enhanced);
    }
    
    console.log(`   🎯 Enhanced ${enhancedChunks.length} chunks with classifications`);
    return enhancedChunks;
  }

  /**
   * Classify chunk content type
   */
  classifyChunkContent(content) {
    const classification = {
      types: [],
      confidence: 0,
      primaryType: null
    };
    
    // Check for different content types
    const typeScores = {};
    
    for (const [type, pattern] of Object.entries(this.classificationPatterns)) {
      const matches = content.match(pattern);
      typeScores[type] = matches ? matches.length : 0;
    }
    
    // Determine primary type and confidence
    const maxScore = Math.max(...Object.values(typeScores));
    if (maxScore > 0) {
      classification.primaryType = Object.keys(typeScores).find(key => typeScores[key] === maxScore);
      classification.confidence = Math.min(maxScore / 10, 1.0); // Normalize to 0-1
      classification.types = Object.keys(typeScores).filter(key => typeScores[key] > 0);
    }
    
    return classification;
  }

  /**
   * Real-time quality validation
   */
  async validateChunkQuality(chunks, config) {
    console.log('✅ Validating chunk quality...');
    
    const validatedChunks = [];
    let rejectedCount = 0;
    
    for (const chunk of chunks) {
      const qualityScore = this.calculateChunkQuality(chunk);
      
      // Safety check - ensure qualityScore is a valid number
      if (typeof qualityScore !== 'number' || isNaN(qualityScore)) {
        console.warn('⚠️ Invalid quality score returned, skipping chunk');
        rejectedCount++;
        continue;
      }
      
      if (qualityScore >= config.qualityValidation.minQualityScore) {
        chunk.qualityScore = qualityScore;
        validatedChunks.push(chunk);
      } else {
        rejectedCount++;
        console.log(`   ⚠️ Rejected low-quality chunk (score: ${qualityScore.toFixed(2)})`);
      }
    }
    
    console.log(`   📊 Validated ${validatedChunks.length} chunks, rejected ${rejectedCount}`);
    return validatedChunks;
  }

  /**
   * Calculate chunk quality score
   */
  calculateChunkQuality(chunk) {
    // Validate input
    if (!chunk || typeof chunk !== 'object') {
      console.warn('⚠️ Invalid chunk object passed to calculateChunkQuality');
      return 0.1; // Return minimum quality for invalid chunks
    }
    
    if (!chunk.content || typeof chunk.content !== 'string') {
      console.warn('⚠️ Chunk missing content property');
      return 0.1; // Return minimum quality for chunks without content
    }
    
    let score = 0.5; // Base score
    
    try {
      // Content length factor
      const lengthFactor = Math.min(chunk.content.length / 500, 1.0);
      score += lengthFactor * 0.2;
      
      // Heading presence
      if (chunk.heading && chunk.heading !== 'No heading') {
        score += 0.2;
      }
      
      // Content type relevance
      if (chunk.classification && chunk.classification.primaryType && 
          typeof chunk.classification.confidence === 'number') {
        score += chunk.classification.confidence * 0.2;
      }
      
      // Fund-related content bonus
      if (chunk.content.toLowerCase().includes('fund')) {
        score += 0.1;
      }
      
      // Penalize very short content
      if (chunk.content.length < 100) {
        score -= 0.3;
      }
      
      const finalScore = Math.max(0, Math.min(1, score));
      
      // Ensure we return a valid number
      if (typeof finalScore !== 'number' || isNaN(finalScore)) {
        console.warn('⚠️ Quality calculation resulted in invalid score, returning default');
        return 0.5;
      }
      
      return finalScore;
      
    } catch (error) {
      console.error('❌ Error calculating chunk quality:', error);
      return 0.1; // Return minimum quality on error
    }
  }

  /**
   * Store enhanced chunks with metadata
   */
  async storeEnhancedChunks(chunks, sourceId, version) {
    console.log('💾 Storing enhanced chunks...');
    
    const qualityStats = {
      totalChunks: chunks.length,
      averageQuality: 0,
      typeDistribution: {},
      headingCoverage: 0
    };
    
    let totalQuality = 0;
    let chunksWithHeadings = 0;
    
    for (const chunk of chunks) {
      // Calculate stats
      totalQuality += chunk.qualityScore || 0;
      if (chunk.heading && chunk.heading !== 'No heading') {
        chunksWithHeadings++;
      }
      
      // Track type distribution
      if (chunk.classification && chunk.classification.primaryType) {
        const type = chunk.classification.primaryType;
        qualityStats.typeDistribution[type] = (qualityStats.typeDistribution[type] || 0) + 1;
      }
      
      // Store chunk in database
      await this.db.query(`
        INSERT INTO kb_chunks (
          chunk_id, source_id, version, content, heading, 
          quality_score, token_count, chunk_index, 
          content_type, classification_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, [
        chunk.chunkId || uuidv4(),
        sourceId,
        version,
        chunk.content,
        chunk.heading || 'Fund Management Guide',
        chunk.qualityScore || 0.5,
        chunk.tokenCount || this.estimateTokenCount(chunk.content),
        chunk.index || 0,
        chunk.classification?.primaryType || 'general',
        JSON.stringify(chunk.classification || {}),
      ]);
    }
    
    // Calculate final stats
    qualityStats.averageQuality = totalQuality / chunks.length;
    qualityStats.headingCoverage = chunksWithHeadings / chunks.length;
    
    // Update source status to completed
    await this.db.query(`
      UPDATE kb_sources 
      SET processing_status = 'completed', 
          total_chunks = $1,
          average_quality = $2,
          updated_at = NOW()
      WHERE source_id = $3
    `, [chunks.length, qualityStats.averageQuality, sourceId]);
    
    console.log(`   📊 Stored ${chunks.length} chunks with ${Math.round(qualityStats.averageQuality * 100)}% avg quality`);
    
    return { success: true, qualityStats };
  }

  // Helper methods
  detectHeading(line, lineIndex) {
    // Check various heading patterns
    for (const pattern of this.headingPatterns) {
      if (pattern.test(line)) {
        return {
          text: line,
          level: this.determineHeadingLevel(line),
          lineIndex: lineIndex,
          pattern: pattern.source
        };
      }
    }
    
    // Check for formatting-based headings (all caps, short lines, etc.)
    if (line.length < 100 && line === line.toUpperCase() && line.split(' ').length < 8) {
      return {
        text: line,
        level: 2,
        lineIndex: lineIndex,
        pattern: 'formatting'
      };
    }
    
    return null;
  }

  classifyHeadingType(headingText) {
    const text = headingText.toLowerCase();
    
    if (text.includes('creat') && text.includes('fund')) return 'fund_creation';
    if (text.includes('update')) return 'fund_update';
    if (text.includes('type')) return 'fund_types';
    if (text.includes('step')) return 'procedure_step';
    if (text.includes('hierarchy')) return 'fund_hierarchy';
    
    return 'general';
  }

  // Additional helper methods...
  removeTableOfContents(content) {
    // Remove table of contents sections
    return content.replace(/Table of [Cc]ontents[\s\S]*?(?=\n\n|\n[A-Z])/gi, '');
  }

  removeCopyrightNotices(content) {
    // Remove copyright and legal notices
    return content.replace(/©.*?(?=\n\n|\n[A-Z])/gi, '')
                 .replace(/Confidential Information.*?(?=\n\n|\n[A-Z])/gi, '');
  }

  splitIntoSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  }

  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  // Job management methods
  async createJobRecord(sourceId, jobType, config) {
    const jobId = uuidv4();
    await this.db.query(`
      INSERT INTO ingestion_jobs (job_id, source_id, job_type, status, config, created_at)
      VALUES ($1, $2, $3, 'running', $4, NOW())
    `, [jobId, sourceId, jobType, JSON.stringify(config)]);
    return jobId;
  }

  async updateJobProgress(jobId, progress, status) {
    await this.db.query(`
      UPDATE ingestion_jobs 
      SET progress = $1, status = $2, updated_at = NOW()
      WHERE job_id = $3
    `, [progress, status, jobId]);
  }

  async completeJob(jobId, processingTime, result) {
    await this.db.query(`
      UPDATE ingestion_jobs 
      SET status = 'completed', progress = 100, 
          processing_time = $1, result = $2, updated_at = NOW()
      WHERE job_id = $3
    `, [processingTime, JSON.stringify(result), jobId]);
  }

  async failJob(jobId, error) {
    await this.db.query(`
      UPDATE ingestion_jobs 
      SET status = 'failed', error_message = $1, updated_at = NOW()
      WHERE job_id = $2
    `, [error.message, jobId]);
  }
}

module.exports = EnhancedDocumentProcessingService;
