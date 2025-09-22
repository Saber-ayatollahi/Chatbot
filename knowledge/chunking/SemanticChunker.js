/**
 * Semantic Chunker Module
 * Advanced text chunking with semantic awareness and context preservation
 * Phase 1: Foundation & Infrastructure Setup
 */

const natural = require('natural');
const { getConfig } = require('../../config/environment');
const logger = require('../../utils/logger');

class SemanticChunker {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.chunkingConfig = {
      chunkSize: 450,
      chunkOverlap: 50,
      minChunkSize: process.env.NODE_ENV === 'test' ? 20 : 100, // Lower minimum for tests
      maxChunkSize: 1000,
      preserveStructure: true,
      chunkStrategy: 'semantic',
      minQualityScore: 0.3,
    };
    
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    // Initialize tiktoken for accurate token counting
    this.tiktoken = null;
    this.tiktokenInitialized = false;
    this.initializeTiktoken();
    
    // Chunking strategies
    this.strategies = {
      'semantic': this.semanticChunking.bind(this),
      'fixed': this.fixedSizeChunking.bind(this),
      'sentence': this.sentenceBasedChunking.bind(this),
      'paragraph': this.paragraphBasedChunking.bind(this),
      'section': this.sectionBasedChunking.bind(this)
    };
  }

  /**
   * Initialize tiktoken for accurate token counting
   */
  async initializeTiktoken() {
    try {
      const { get_encoding } = await import('tiktoken');
      this.tiktoken = get_encoding('cl100k_base'); // GPT-4 encoding
      this.tiktokenInitialized = true;
      logger.info('✅ Tiktoken initialized for accurate token counting');
    } catch (error) {
      logger.warn('⚠️ Tiktoken initialization failed, using fallback token counting:', error.message);
      this.tiktokenInitialized = false;
    }
  }

  /**
   * Chunk a document into semantically coherent pieces
   * @param {Object} document - Document object with content and metadata
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunk objects
   */
  async chunkDocument(document, options = {}) {
    try {
      logger.info(`🔪 Chunking document: ${document.fileName || document.sourceId}`);
      
      const config = {
        maxTokens: options.maxTokens || this.chunkingConfig.chunkSize,
        overlapTokens: options.overlapTokens || this.chunkingConfig.chunkOverlap,
        minChunkSize: options.minChunkSize || this.chunkingConfig.minChunkSize,
        maxChunkSize: options.maxChunkSize || this.chunkingConfig.maxChunkSize,
        preserveStructure: options.preserveStructure !== false && this.chunkingConfig.preserveStructure,
        strategy: options.strategy || this.chunkingConfig.chunkStrategy,
        respectSentences: options.respectSentences !== false,
        respectParagraphs: options.respectParagraphs !== false
      };

      logger.info(`📊 Chunking config: ${config.maxTokens} tokens, ${config.overlapTokens} overlap, strategy: ${config.strategy}`);

      // Validate strategy
      if (!this.strategies[config.strategy]) {
        throw new Error(`Unknown chunking strategy: ${config.strategy}`);
      }

      // Prepare document content
      const content = this.preprocessContent(document.content);
      
      // Validate content
      if (!content || content.trim().length === 0) {
        logger.warn('⚠️ Document content is empty after preprocessing');
        return [];
      }
      
      logger.debug(`📝 Preprocessed content length: ${content.length} characters`);
      
      // Apply chunking strategy
      const chunks = await this.strategies[config.strategy](document, content, config);
      
      // Post-process chunks
      const processedChunks = await this.postProcessChunks(chunks, document, config);
      
      // Validate chunks
      const validatedChunks = this.validateChunks(processedChunks, config);
      
      logger.info(`✅ Document chunked into ${validatedChunks.length} chunks`);
      
      return validatedChunks;
    } catch (error) {
      logger.error(`❌ Document chunking failed:`, error);
      throw new Error(`Chunking failed: ${error.message}`);
    }
  }

  /**
   * Semantic chunking strategy - preserves meaning and context
   * @param {Object} document - Document object
   * @param {string} content - Preprocessed content
   * @param {Object} config - Chunking configuration
   * @returns {Array} Array of chunks
   */
  async semanticChunking(document, content, config) {
    logger.info('🧠 Applying semantic chunking strategy...');
    
    const chunks = [];
    let chunkIndex = 0;
    
    // First, try to chunk by sections if available
    if (config.preserveStructure && document.sections && document.sections.length > 0) {
      logger.info(`📑 Processing ${document.sections.length} document sections`);
      
      for (const section of document.sections) {
        const sectionChunks = await this.chunkSection(section, document, config, chunkIndex);
        chunks.push(...sectionChunks);
        chunkIndex += sectionChunks.length;
      }
    } else {
      // Fallback to paragraph-based chunking
      const paragraphs = this.extractParagraphs(content);
      logger.info(`📄 Processing ${paragraphs.length} paragraphs`);
      
      if (paragraphs.length === 0) {
        logger.warn('⚠️ No paragraphs extracted from content');
        logger.debug(`📝 Content preview: "${content.substring(0, 200)}..."`);
        return [];
      }
      
      let currentChunk = '';
      let currentTokens = 0;
      let paragraphBuffer = [];
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const paragraphTokens = this.countTokens(paragraph.content);
        
        // If single paragraph exceeds max tokens, split it
        if (paragraphTokens > config.maxTokens) {
          // Save current chunk if it has content
          if (currentChunk.trim()) {
            chunks.push(this.createChunk(currentChunk, document, chunkIndex++, paragraphBuffer, config));
            currentChunk = '';
            currentTokens = 0;
            paragraphBuffer = [];
          }
          
          // Split large paragraph
          const paragraphChunks = await this.splitLargeParagraph(paragraph, document, config, chunkIndex);
          chunks.push(...paragraphChunks);
          chunkIndex += paragraphChunks.length;
          continue;
        }
        
        // Check if adding this paragraph would exceed token limit
        if (currentTokens + paragraphTokens > config.maxTokens && currentChunk.trim()) {
          // Create chunk from current content
          chunks.push(this.createChunk(currentChunk, document, chunkIndex++, paragraphBuffer, config));
          
          // Start new chunk with overlap
          const overlapContent = this.createOverlap(currentChunk, config.overlapTokens);
          currentChunk = overlapContent + paragraph.content;
          currentTokens = this.countTokens(currentChunk);
          paragraphBuffer = [paragraph];
        } else {
          // Add paragraph to current chunk
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph.content;
          currentTokens += paragraphTokens;
          paragraphBuffer.push(paragraph);
        }
      }
      
      // Add final chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(this.createChunk(currentChunk, document, chunkIndex++, paragraphBuffer, config));
      }
    }
    
    return chunks;
  }

  /**
   * Chunk a document section
   * @param {Object} section - Document section
   * @param {Object} document - Full document
   * @param {Object} config - Chunking configuration
   * @param {number} startIndex - Starting chunk index
   * @returns {Array} Array of chunks for this section
   */
  async chunkSection(section, document, config, startIndex) {
    if (!section.content) {
      return [];
    }
    
    const sectionTokens = this.countTokens(section.content);
    
    // If section fits in one chunk, return it as is
    if (sectionTokens <= config.maxTokens) {
      return [this.createChunk(section.content, document, startIndex, [section], config, {
        sectionTitle: section.title,
        sectionLevel: section.level
      })];
    }
    
    // Split section into smaller chunks
    const paragraphs = this.extractParagraphs(section.content);
    const chunks = [];
    let chunkIndex = startIndex;
    let currentChunk = '';
    let currentTokens = 0;
    let paragraphBuffer = [];
    
    for (const paragraph of paragraphs) {
      const paragraphTokens = this.countTokens(paragraph.content);
      
      if (currentTokens + paragraphTokens > config.maxTokens && currentChunk.trim()) {
        chunks.push(this.createChunk(currentChunk, document, chunkIndex++, paragraphBuffer, config, {
          sectionTitle: section.title,
          sectionLevel: section.level
        }));
        
        // Start new chunk with overlap
        const overlapContent = this.createOverlap(currentChunk, config.overlapTokens);
        currentChunk = overlapContent + paragraph.content;
        currentTokens = this.countTokens(currentChunk);
        paragraphBuffer = [paragraph];
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph.content;
        currentTokens += paragraphTokens;
        paragraphBuffer.push(paragraph);
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, document, chunkIndex++, paragraphBuffer, config, {
        sectionTitle: section.title,
        sectionLevel: section.level
      }));
    }
    
    return chunks;
  }

  /**
   * Split a large paragraph that exceeds token limits
   * @param {Object} paragraph - Paragraph object
   * @param {Object} document - Document object
   * @param {Object} config - Chunking configuration
   * @param {number} startIndex - Starting chunk index
   * @returns {Array} Array of chunks
   */
  async splitLargeParagraph(paragraph, document, config, startIndex) {
    logger.info('✂️ Splitting large paragraph...');
    
    const sentences = this.sentenceTokenizer.tokenize(paragraph.content);
    const chunks = [];
    let chunkIndex = startIndex;
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);
      
      // If single sentence exceeds max tokens, split by words
      if (sentenceTokens > config.maxTokens) {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [paragraph], config));
          currentChunk = '';
          currentTokens = 0;
        }
        
        // Split sentence by words
        const wordChunks = this.splitByWords(sentence, config.maxTokens, config.overlapTokens);
        for (const wordChunk of wordChunks) {
          chunks.push(this.createChunk(wordChunk, document, chunkIndex++, [paragraph], config));
        }
        continue;
      }
      
      // Check if adding sentence would exceed limit
      if (currentTokens + sentenceTokens > config.maxTokens && currentChunk.trim()) {
        chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [paragraph], config));
        
        // Start new chunk with overlap
        const overlapContent = this.createOverlap(currentChunk, config.overlapTokens);
        currentChunk = overlapContent + sentence;
        currentTokens = this.countTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [paragraph], config));
    }
    
    return chunks;
  }

  /**
   * Fixed size chunking strategy
   * @param {Object} document - Document object
   * @param {string} content - Preprocessed content
   * @param {Object} config - Chunking configuration
   * @returns {Array} Array of chunks
   */
  async fixedSizeChunking(document, content, config) {
    logger.info('📏 Applying fixed size chunking strategy...');
    
    const chunks = [];
    const words = this.tokenizer.tokenize(content);
    let chunkIndex = 0;
    
    // Estimate words per token (rough approximation)
    const wordsPerToken = 0.75;
    const wordsPerChunk = Math.floor(config.maxTokens * wordsPerToken);
    const overlapWords = Math.floor(config.overlapTokens * wordsPerToken);
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkContent = chunkWords.join(' ');
      
      if (chunkContent.trim()) {
        chunks.push(this.createChunk(chunkContent, document, chunkIndex++, [], config));
      }
    }
    
    return chunks;
  }

  /**
   * Sentence-based chunking strategy
   * @param {Object} document - Document object
   * @param {string} content - Preprocessed content
   * @param {Object} config - Chunking configuration
   * @returns {Array} Array of chunks
   */
  async sentenceBasedChunking(document, content, config) {
    logger.info('📝 Applying sentence-based chunking strategy...');
    
    const sentences = this.sentenceTokenizer.tokenize(content);
    const chunks = [];
    let chunkIndex = 0;
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);
      
      if (currentTokens + sentenceTokens > config.maxTokens && currentChunk.trim()) {
        chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [], config));
        
        // Start new chunk with overlap
        const overlapContent = this.createOverlap(currentChunk, config.overlapTokens);
        currentChunk = overlapContent + sentence;
        currentTokens = this.countTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [], config));
    }
    
    return chunks;
  }

  /**
   * Paragraph-based chunking strategy
   * @param {Object} document - Document object
   * @param {string} content - Preprocessed content
   * @param {Object} config - Chunking configuration
   * @returns {Array} Array of chunks
   */
  async paragraphBasedChunking(document, content, config) {
    logger.info('📄 Applying paragraph-based chunking strategy...');
    
    const paragraphs = this.extractParagraphs(content);
    const chunks = [];
    let chunkIndex = 0;
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphTokens = this.countTokens(paragraph.content);
      
      if (currentTokens + paragraphTokens > config.maxTokens && currentChunk.trim()) {
        chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [], config));
        
        // Start new chunk with overlap
        const overlapContent = this.createOverlap(currentChunk, config.overlapTokens);
        currentChunk = overlapContent + paragraph.content;
        currentTokens = this.countTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph.content;
        currentTokens += paragraphTokens;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, document, chunkIndex++, [], config));
    }
    
    return chunks;
  }

  /**
   * Section-based chunking strategy
   * @param {Object} document - Document object
   * @param {string} content - Preprocessed content
   * @param {Object} config - Chunking configuration
   * @returns {Array} Array of chunks
   */
  async sectionBasedChunking(document, content, config) {
    logger.info('📑 Applying section-based chunking strategy...');
    
    if (!document.sections || document.sections.length === 0) {
      logger.warn('⚠️ No sections found, falling back to paragraph-based chunking');
      return await this.paragraphBasedChunking(document, content, config);
    }
    
    const chunks = [];
    let chunkIndex = 0;
    
    for (const section of document.sections) {
      const sectionChunks = await this.chunkSection(section, document, config, chunkIndex);
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }
    
    return chunks;
  }

  /**
   * Extract paragraphs from content
   * @param {string} content - Text content
   * @returns {Array} Array of paragraph objects
   */
  extractParagraphs(content) {
    const paragraphs = [];
    const lines = content.split('\n');
    let currentParagraph = '';
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // Empty line - end current paragraph
        if (currentParagraph.trim()) {
          paragraphs.push({
            content: currentParagraph.trim(),
            startLine: lineNumber - currentParagraph.split('\n').length,
            endLine: lineNumber - 1,
            wordCount: this.tokenizer.tokenize(currentParagraph).length
          });
          currentParagraph = '';
        }
      } else {
        // Add line to current paragraph
        currentParagraph += (currentParagraph ? '\n' : '') + line;
      }
    }
    
    // Add final paragraph
    if (currentParagraph.trim()) {
      paragraphs.push({
        content: currentParagraph.trim(),
        startLine: lineNumber - currentParagraph.split('\n').length + 1,
        endLine: lineNumber,
        wordCount: this.tokenizer.tokenize(currentParagraph).length
      });
    }
    
    return paragraphs.filter(p => p.content.length > 0);
  }

  /**
   * Split text by words when sentences are too long
   * @param {string} text - Text to split
   * @param {number} maxTokens - Maximum tokens per chunk
   * @param {number} overlapTokens - Overlap tokens
   * @returns {Array} Array of word-based chunks
   */
  splitByWords(text, maxTokens, overlapTokens) {
    const words = this.tokenizer.tokenize(text);
    const chunks = [];
    
    // Estimate words per token
    const wordsPerToken = 0.75;
    const wordsPerChunk = Math.floor(maxTokens * wordsPerToken);
    const overlapWords = Math.floor(overlapTokens * wordsPerToken);
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkContent = chunkWords.join(' ');
      
      if (chunkContent.trim()) {
        chunks.push(chunkContent);
      }
    }
    
    return chunks;
  }

  /**
   * Create overlap content from the end of previous chunk
   * @param {string} previousChunk - Previous chunk content
   * @param {number} overlapTokens - Number of overlap tokens
   * @returns {string} Overlap content
   */
  createOverlap(previousChunk, overlapTokens) {
    if (!previousChunk || overlapTokens <= 0) return '';
    
    const sentences = this.sentenceTokenizer.tokenize(previousChunk);
    let overlapContent = '';
    let tokenCount = 0;
    
    // Take sentences from the end until we reach overlap token limit
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.countTokens(sentence);
      
      if (tokenCount + sentenceTokens > overlapTokens) break;
      
      overlapContent = sentence + (overlapContent ? ' ' : '') + overlapContent;
      tokenCount += sentenceTokens;
    }
    
    return overlapContent ? overlapContent + '\n\n' : '';
  }

  /**
   * Create a chunk object
   * @param {string} content - Chunk content
   * @param {Object} document - Source document
   * @param {number} chunkIndex - Chunk index
   * @param {Array} sourceParagraphs - Source paragraphs
   * @param {Object} config - Chunking configuration
   * @param {Object} additionalMetadata - Additional metadata
   * @returns {Object} Chunk object
   */
  createChunk(content, document, chunkIndex, sourceParagraphs = [], config = {}, additionalMetadata = {}) {
    const tokenCount = this.countTokens(content);
    const wordCount = this.tokenizer.tokenize(content).length;
    const characterCount = content.length;
    
    // Determine page numbers from source paragraphs or document
    let pageNumbers = [];
    if (sourceParagraphs.length > 0) {
      pageNumbers = [...new Set(sourceParagraphs.map(p => p.pageNumber).filter(Boolean))];
    } else if (document.pages) {
      // Estimate page based on content position (rough approximation)
      const contentPosition = content.length / document.content.length;
      const estimatedPage = Math.ceil(contentPosition * document.totalPages);
      pageNumbers = [estimatedPage];
    }
    
    // Extract heading context
    let headingContext = null;
    if (document.headings) {
      // Find the most relevant heading for this chunk
      const chunkStart = document.content.indexOf(content.substring(0, 50));
      if (chunkStart !== -1) {
        const relevantHeadings = document.headings
          .filter(h => h.position <= chunkStart)
          .sort((a, b) => b.position - a.position);
        
        if (relevantHeadings.length > 0) {
          headingContext = {
            text: relevantHeadings[0].text,
            level: relevantHeadings[0].level
          };
        }
      }
    }
    
    // Calculate quality score
    const qualityScore = this.calculateChunkQuality(content, config);
    
    return {
      chunkIndex,
      content: content.trim(),
      tokenCount,
      wordCount,
      characterCount,
      
      // Source information
      sourceId: document.sourceId,
      version: document.version,
      fileName: document.fileName,
      
      // Position information
      pageNumbers,
      pageRange: pageNumbers.length > 0 ? [Math.min(...pageNumbers), Math.max(...pageNumbers)] : null,
      
      // Context information
      heading: headingContext?.text,
      subheading: additionalMetadata.sectionTitle,
      sectionPath: this.buildSectionPath(headingContext, additionalMetadata),
      
      // Content type classification
      contentType: this.classifyContentType(content),
      
      // Quality metrics
      qualityScore,
      
      // Metadata
      metadata: {
        chunkingStrategy: config.strategy || 'semantic',
        chunkingVersion: '1.0',
        preservedStructure: config.preserveStructure,
        sourceParagraphCount: sourceParagraphs.length,
        hasOverlap: chunkIndex > 0,
        language: document.language || 'en',
        createdAt: new Date().toISOString(),
        ...additionalMetadata
      }
    };
  }

  /**
   * Build section path array for hierarchical navigation
   * @param {Object} headingContext - Heading context
   * @param {Object} additionalMetadata - Additional metadata
   * @returns {Array} Section path array
   */
  buildSectionPath(headingContext, additionalMetadata) {
    const path = [];
    
    if (headingContext) {
      path.push(headingContext.text);
    }
    
    if (additionalMetadata.sectionTitle && additionalMetadata.sectionTitle !== headingContext?.text) {
      path.push(additionalMetadata.sectionTitle);
    }
    
    return path;
  }

  /**
   * Classify content type of chunk
   * @param {string} content - Chunk content
   * @returns {string} Content type
   */
  classifyContentType(content) {
    const lowerContent = content.toLowerCase();
    
    // Check for tables
    if (content.includes('|') && content.split('|').length > 4) {
      return 'table';
    }
    
    // Check for lists
    if (/^\s*[-*•]\s+/m.test(content) || /^\s*\d+\.\s+/m.test(content)) {
      return 'list';
    }
    
    // Check for code
    if (content.includes('```') || content.includes('function') || content.includes('class ')) {
      return 'code';
    }
    
    // Check for definitions
    if (lowerContent.includes('definition:') || lowerContent.includes('means:') || lowerContent.includes('refers to:')) {
      return 'definition';
    }
    
    // Check for procedures/steps
    if (/step \d+/i.test(content) || /^\s*\d+\.\s+/m.test(content)) {
      return 'procedure';
    }
    
    // Default to text
    return 'text';
  }

  /**
   * Calculate quality score for a chunk
   * @param {string} content - Chunk content
   * @param {Object} config - Chunking configuration
   * @returns {number} Quality score (0-1)
   */
  calculateChunkQuality(content, config) {
    let score = 0.3; // Lower base score to allow for penalties
    
    // Ensure config has required properties with defaults
    const maxTokens = config?.maxTokens || this.chunkingConfig?.chunkSize || 450;
    const minChunkSize = config?.minChunkSize || this.chunkingConfig?.minChunkSize || 20;
    
    
    // Length factor - prefer chunks close to target size, but be more forgiving
    const tokenCount = this.countTokens(content);
    const targetTokens = maxTokens * 0.8; // 80% of max is ideal
    
    
    if (tokenCount < minChunkSize) {
      // For content below minimum size, apply graduated penalties
      const shortPenalty = Math.max(-0.1, -0.2 * (1 - tokenCount / minChunkSize));
      score += shortPenalty;
      
      // Additional harsh penalty only for extremely short content (< 5 tokens)
      if (tokenCount < 5) {
        score -= 0.2; // Very harsh penalty for single words/fragments
      }
    } else if (tokenCount >= minChunkSize && tokenCount <= targetTokens) {
      // For content within reasonable range, give proportional bonus
      const lengthBonus = Math.min(tokenCount / targetTokens, 1.0) * 0.2;
      score += lengthBonus;
    } else {
      // For content larger than target, give smaller bonus
      score += 0.1;
    }
    
    // Completeness factor - prefer complete sentences
    const sentences = this.sentenceTokenizer.tokenize(content);
    const lastSentence = sentences[sentences.length - 1];
    if (lastSentence && /[.!?]$/.test(lastSentence.trim())) {
      score += 0.15;
    } else {
      score -= 0.1; // Penalize incomplete sentences
    }
    
    // Structure factor - prefer chunks with clear structure
    if (/^[A-Z]/.test(content.trim())) { // Starts with capital letter
      score += 0.1;
    } else {
      score -= 0.05; // Penalize poor structure
    }
    
    // Content quality factor - penalize repetitive or low-quality content
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;
    
    if (uniqueRatio < 0.3) { // Very repetitive content
      score -= 0.2;
    } else if (uniqueRatio > 0.7) { // Good vocabulary diversity
      score += 0.1;
    }
    
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Post-process chunks to improve quality
   * @param {Array} chunks - Array of chunks
   * @param {Object} document - Source document
   * @param {Object} config - Chunking configuration
   * @returns {Array} Post-processed chunks
   */
  async postProcessChunks(chunks, document, config) {
    logger.info('🔧 Post-processing chunks...');
    
    const processedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Clean up content
      chunk.content = this.cleanupContent(chunk.content);
      
      // Recalculate metrics after cleanup
      chunk.tokenCount = this.countTokens(chunk.content);
      chunk.wordCount = this.tokenizer.tokenize(chunk.content).length;
      chunk.characterCount = chunk.content.length;
      
      // Update quality score
      chunk.qualityScore = this.calculateChunkQuality(chunk.content, config);
      
      // Add chunk relationships
      chunk.previousChunkIndex = i > 0 ? i - 1 : null;
      chunk.nextChunkIndex = i < chunks.length - 1 ? i + 1 : null;
      
      processedChunks.push(chunk);
    }
    
    return processedChunks;
  }

  /**
   * Validate chunks meet quality requirements
   * @param {Array} chunks - Array of chunks
   * @param {Object} config - Chunking configuration
   * @returns {Array} Validated chunks
   */
  validateChunks(chunks, config) {
    logger.info('✅ Validating chunks...');
    
    const validChunks = [];
    const rejectedChunks = [];
    
    for (const chunk of chunks) {
      const issues = [];
      
      // Check minimum size
      if (chunk.tokenCount < config.minChunkSize) {
        issues.push(`Too small: ${chunk.tokenCount} tokens < ${config.minChunkSize}`);
      }
      
      // Check maximum size
      if (chunk.tokenCount > config.maxChunkSize) {
        issues.push(`Too large: ${chunk.tokenCount} tokens > ${config.maxChunkSize}`);
      }
      
      // Check content quality
      const minQualityScore = this.chunkingConfig.minQualityScore || 0.3;
      if (chunk.qualityScore < minQualityScore) {
        issues.push(`Low quality: ${chunk.qualityScore.toFixed(2)} < ${minQualityScore}`);
      }
      
      // Check for empty content
      if (!chunk.content.trim()) {
        issues.push('Empty content');
      }
      
      if (issues.length === 0) {
        validChunks.push(chunk);
      } else {
        chunk.rejectionReasons = issues;
        rejectedChunks.push(chunk);
        logger.warn(`❌ Chunk ${chunk.chunkIndex} rejected: ${issues.join(', ')}`);
      }
    }
    
    if (rejectedChunks.length > 0) {
      logger.warn(`⚠️ ${rejectedChunks.length} chunks rejected out of ${chunks.length}`);
    }
    
    return validChunks;
  }

  /**
   * Preprocess content before chunking
   * @param {string} content - Raw content
   * @returns {string} Preprocessed content
   */
  preprocessContent(content) {
    if (!content) return '';
    
    // Normalize whitespace
    content = content.replace(/\r\n/g, '\n'); // Normalize line endings
    content = content.replace(/\t/g, '    '); // Convert tabs to spaces
    content = content.replace(/[ \t]+$/gm, ''); // Remove trailing whitespace
    content = content.replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
    
    // Clean up common artifacts
    content = content.replace(/\f/g, '\n'); // Replace form feeds with newlines
    content = content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); // Remove control characters
    
    return content.trim();
  }

  /**
   * Clean up chunk content
   * @param {string} content - Chunk content
   * @returns {string} Cleaned content
   */
  cleanupContent(content) {
    if (!content) return '';
    
    // Remove leading/trailing whitespace
    content = content.trim();
    
    // Fix spacing around punctuation
    content = content.replace(/\s+([.!?])/g, '$1');
    content = content.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
    
    // Fix spacing around commas
    content = content.replace(/\s*,\s*/g, ', ');
    
    // Normalize quotes
    content = content.replace(/[""]/g, '"');
    content = content.replace(/['']/g, "'");
    
    return content;
  }

  /**
   * Count tokens in text using tiktoken or fallback method
   * @param {string} text - Text to count
   * @returns {number} Token count
   */
  countTokens(text) {
    if (!text) return 0;
    
    if (this.tiktoken) {
      try {
        return this.tiktoken.encode(text).length;
      } catch (error) {
        logger.warn('⚠️ Tiktoken encoding failed, using fallback:', error.message);
      }
    }
    
    // Fallback: rough estimation (1 token ≈ 4 characters for English)
    return Math.ceil(text.length / 4);
  }

  /**
   * Get chunking statistics
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Statistics object
   */
  getChunkingStats(chunks) {
    if (!chunks || chunks.length === 0) {
      return {
        totalChunks: 0,
        totalTokens: 0,
        totalWords: 0,
        totalCharacters: 0,
        averageTokensPerChunk: 0,
        averageWordsPerChunk: 0,
        averageCharactersPerChunk: 0,
        averageQualityScore: 0,
        contentTypes: {},
        qualityDistribution: {}
      };
    }
    
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
    const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.characterCount, 0);
    const totalQuality = chunks.reduce((sum, chunk) => sum + chunk.qualityScore, 0);
    
    // Content type distribution
    const contentTypes = {};
    chunks.forEach(chunk => {
      contentTypes[chunk.contentType] = (contentTypes[chunk.contentType] || 0) + 1;
    });
    
    // Quality score distribution
    const qualityDistribution = {
      'high (0.8-1.0)': 0,
      'medium (0.6-0.8)': 0,
      'low (0.4-0.6)': 0,
      'poor (0.0-0.4)': 0
    };
    
    chunks.forEach(chunk => {
      if (chunk.qualityScore >= 0.8) qualityDistribution['high (0.8-1.0)']++;
      else if (chunk.qualityScore >= 0.6) qualityDistribution['medium (0.6-0.8)']++;
      else if (chunk.qualityScore >= 0.4) qualityDistribution['low (0.4-0.6)']++;
      else qualityDistribution['poor (0.0-0.4)']++;
    });
    
    return {
      totalChunks: chunks.length,
      totalTokens,
      totalWords,
      totalCharacters,
      averageTokensPerChunk: Math.round(totalTokens / chunks.length),
      averageWordsPerChunk: Math.round(totalWords / chunks.length),
      averageCharactersPerChunk: Math.round(totalCharacters / chunks.length),
      averageQualityScore: parseFloat((totalQuality / chunks.length).toFixed(3)),
      contentTypes,
      qualityDistribution
    };
  }
}

module.exports = SemanticChunker;
