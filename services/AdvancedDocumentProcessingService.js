/**
 * Advanced Document Processing Service
 * End-to-end pipeline orchestration for advanced document processing
 * Part of Advanced Document Processing Implementation
 */

const HierarchicalSemanticChunker = require('../knowledge/chunking/HierarchicalSemanticChunker');
const MultiScaleEmbeddingGenerator = require('../knowledge/embeddings/MultiScaleEmbeddingGenerator');
const AdvancedContextualRetriever = require('../knowledge/retrieval/AdvancedContextualRetriever');
const { getDatabase } = require('../config/database');
const { getConfig } = require('../config/environment');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Document processing dependencies with graceful fallbacks
let mammoth = null;
let jszip = null;

try {
  mammoth = require('mammoth');
} catch (error) {
  console.warn('⚠️ mammoth not available - DOCX processing will be limited');
}

try {
  jszip = require('jszip');
} catch (error) {
  console.warn('⚠️ jszip not available - DOCX fallback processing will be limited');
}

class AdvancedDocumentProcessingService {
  constructor(options = {}) {
    this.config = getConfig();
    this.db = getDatabase();
    
    // Initialize components
    this.hierarchicalChunker = new HierarchicalSemanticChunker();
    this.embeddingGenerator = new MultiScaleEmbeddingGenerator();
    this.contextualRetriever = new AdvancedContextualRetriever();

    this.options = {
      enableHierarchicalChunking: true,
      enableMultiScaleEmbeddings: true,
      enableQualityValidation: true,
      batchProcessing: {
        enabled: true,
        batchSize: 5,
        parallelProcessing: true
      },
      qualityThresholds: {
        minChunkQuality: 0.4,
        minEmbeddingQuality: 0.6,
        minOverallQuality: 0.5
      },
      ...options
    };

    // Processing statistics
    this.processingStats = {
      documentsProcessed: 0,
      chunksGenerated: 0,
      embeddingsCreated: 0,
      averageProcessingTime: 0,
      averageQualityScore: 0,
      totalProcessingTime: 0,
      errorCount: 0
    };
  }

  /**
   * Process a single document with advanced pipeline
   */
  async processDocument(filePath, sourceId, version, options = {}) {
    const config = { ...this.options, ...options };
    
    console.log(`🚀 Starting advanced document processing for: ${sourceId}`);
    const startTime = Date.now();

    // Create job record for progress tracking
    const jobId = await this.createJobRecord(sourceId, 'initial_ingestion', config);

    try {
      // Step 1: Load and validate document
      await this.updateJobProgress(jobId, 10, 'Loading and validating document');
      const document = await this.loadDocument(filePath, sourceId, version);
      
      // Step 2: Generate hierarchical chunks
      await this.updateJobProgress(jobId, 30, 'Generating hierarchical chunks');
      const chunkingResult = await this.generateHierarchicalChunks(document, config);
      
      // Step 3: Generate multi-scale embeddings
      await this.updateJobProgress(jobId, 60, 'Generating multi-scale embeddings');
      const embeddingResult = await this.generateMultiScaleEmbeddings(chunkingResult.chunks, config);
      
      // Step 4: Store processed chunks in database
      await this.updateJobProgress(jobId, 80, 'Storing processed chunks');
      const storageResult = await this.storeProcessedChunks(
        embeddingResult.chunks, 
        sourceId, 
        version, 
        config
      );
      
      // Step 5: Validate processing quality
      await this.updateJobProgress(jobId, 90, 'Validating processing quality');
      const qualityResult = await this.validateProcessingQuality(storageResult, config);
      
      // Step 6: Update processing statistics
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime, qualityResult);

      // Complete job
      await this.completeJob(jobId, processingTime, qualityResult);

      console.log(`✅ Advanced document processing completed in ${processingTime}ms`);
      console.log(`📊 Generated ${storageResult.chunksStored} chunks with quality score ${qualityResult.overallQuality.toFixed(3)}`);

      return {
        success: true,
        sourceId,
        version,
        processingTime,
        chunksGenerated: chunkingResult.chunks.length,
        chunksStored: storageResult.chunksStored,
        embeddingsCreated: embeddingResult.totalEmbeddings,
        qualityScore: qualityResult.overallQuality,
        metadata: {
          chunkingMetadata: chunkingResult.metadata,
          embeddingMetadata: embeddingResult.metadata,
          storageMetadata: storageResult.metadata,
          qualityMetadata: qualityResult.metadata
        }
      };

    } catch (error) {
      console.error(`❌ Advanced document processing failed for ${sourceId}:`, error);
      this.processingStats.errorCount++;
      
      // Fail the job
      await this.failJob(jobId, error.message, { 
        sourceId, 
        version, 
        processingTime: Date.now() - startTime 
      });
      
      return {
        success: false,
        sourceId,
        version,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processDocumentBatch(documents, options = {}) {
    const config = { ...this.options, ...options };
    
    console.log(`🔄 Starting batch processing for ${documents.length} documents...`);
    const startTime = Date.now();

    const results = [];
    const batchSize = config.batchProcessing.batchSize;

    if (config.batchProcessing.parallelProcessing) {
      // Process in parallel batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
        
        const batchPromises = batch.map(doc => 
          this.processDocument(doc.filePath, doc.sourceId, doc.version, config)
        );

        try {
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          // Add delay between batches to manage resources
          if (i + batchSize < documents.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`❌ Batch processing failed for batch starting at ${i}:`, error);
        }
      }
    } else {
      // Process sequentially
      for (const doc of documents) {
        const result = await this.processDocument(doc.filePath, doc.sourceId, doc.version, config);
        results.push(result);
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const successfulResults = results.filter(r => r.success);
    
    console.log(`✅ Batch processing completed in ${totalProcessingTime}ms`);
    console.log(`📊 Successfully processed ${successfulResults.length}/${documents.length} documents`);

    return {
      totalDocuments: documents.length,
      successfulDocuments: successfulResults.length,
      failedDocuments: documents.length - successfulResults.length,
      totalProcessingTime,
      averageProcessingTime: totalProcessingTime / documents.length,
      results,
      summary: this.generateBatchSummary(results)
    };
  }

  /**
   * Load document from file path with multi-format support
   */
  async loadDocument(filePath, sourceId, version) {
    console.log(`📖 Loading document: ${filePath}`);
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      // Determine file type and load accordingly
      const fileExtension = path.extname(filePath).toLowerCase();
      let content = '';
      let metadata = {
        fileSize: stats.size,
        lastModified: stats.mtime,
        loadedAt: new Date(),
        fileType: fileExtension,
        processingMethod: 'unknown'
      };

      switch (fileExtension) {
        case '.pdf':
          const pdfResult = await this.loadPDFDocument(filePath);
          content = pdfResult.content;
          metadata = { ...metadata, ...pdfResult.metadata, processingMethod: 'pdf' };
          break;
          
        case '.docx':
          const docxResult = await this.loadDOCXDocument(filePath);
          content = docxResult.content;
          metadata = { ...metadata, ...docxResult.metadata, processingMethod: 'docx' };
          break;
          
        case '.txt':
        case '.md':
        case '.markdown':
          content = await fs.readFile(filePath, 'utf8');
          metadata.processingMethod = 'text';
          break;
          
        case '.json':
          const jsonContent = await fs.readFile(filePath, 'utf8');
          const jsonData = JSON.parse(jsonContent);
          content = this.extractTextFromJSON(jsonData);
          metadata.processingMethod = 'json';
          break;
          
        default:
          // Try to read as text, fallback for unknown formats
          try {
            content = await fs.readFile(filePath, 'utf8');
            metadata.processingMethod = 'text_fallback';
          } catch (textError) {
            throw new Error(`Unsupported file format: ${fileExtension}`);
          }
      }
      
      // Generate file hash for integrity
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      metadata.fileHash = hash;
      metadata.contentLength = content.length;
      metadata.wordCount = content.split(/\s+/).length;

      return {
        sourceId,
        version,
        filePath,
        content,
        title: this.extractTitleFromContent(content, filePath),
        metadata
      };
    } catch (error) {
      console.error(`❌ Failed to load document ${filePath}:`, error);
      throw new Error(`Document loading failed: ${error.message}`);
    }
  }

  /**
   * Load PDF document (basic implementation)
   */
  async loadPDFDocument(filePath) {
    try {
      // Try to use pdf-parse if available, otherwise fallback
      let pdfParse;
      try {
        pdfParse = require('pdf-parse');
      } catch (importError) {
        console.warn('⚠️ pdf-parse not available, using fallback PDF processing');
        return this.loadPDFDocumentFallback(filePath);
      }

      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      return {
        content: pdfData.text,
        metadata: {
          pageCount: pdfData.numpages,
          pdfInfo: pdfData.info,
          pdfMetadata: pdfData.metadata,
          processingLibrary: 'pdf-parse'
        }
      };
    } catch (error) {
      console.warn('⚠️ PDF parsing failed, trying fallback method:', error.message);
      return this.loadPDFDocumentFallback(filePath);
    }
  }

  /**
   * Fallback PDF processing (basic text extraction)
   */
  async loadPDFDocumentFallback(filePath) {
    // Basic fallback - try to extract any readable text
    try {
      const buffer = await fs.readFile(filePath);
      const text = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
      
      // Extract readable text using simple heuristics
      const extractedText = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      return {
        content: extractedText || 'PDF content could not be extracted',
        metadata: {
          processingLibrary: 'fallback',
          extractionMethod: 'basic_text_extraction',
          warning: 'Limited PDF extraction - install pdf-parse for better results'
        }
      };
    } catch (error) {
      return {
        content: `PDF processing failed: ${error.message}`,
        metadata: {
          processingLibrary: 'fallback',
          error: error.message
        }
      };
    }
  }

  /**
   * Load DOCX document (basic implementation)
   */
  async loadDOCXDocument(filePath) {
    try {
      // Try to use mammoth if available, otherwise fallback
      if (!mammoth) {
        console.warn('⚠️ mammoth not available, using fallback DOCX processing');
        return this.loadDOCXDocumentFallback(filePath);
      }

      const result = await mammoth.extractRawText({ path: filePath });
      
      return {
        content: result.value,
        metadata: {
          processingLibrary: 'mammoth',
          messages: result.messages,
          hasWarnings: result.messages.length > 0
        }
      };
    } catch (error) {
      console.warn('⚠️ DOCX parsing failed, trying fallback method:', error.message);
      return this.loadDOCXDocumentFallback(filePath);
    }
  }

  /**
   * Fallback DOCX processing (basic extraction)
   */
  async loadDOCXDocumentFallback(filePath) {
    try {
      if (!jszip) {
        throw new Error('jszip not available for fallback DOCX processing');
      }
      
      // DOCX files are ZIP archives - try basic extraction
      const buffer = await fs.readFile(filePath);
      const zip = await jszip.loadAsync(buffer);
      
      // Try to extract document.xml
      const documentXml = await zip.file('word/document.xml')?.async('string');
      
      if (documentXml) {
        // Basic XML text extraction
        const textContent = documentXml
          .replace(/<[^>]*>/g, ' ') // Remove XML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        return {
          content: textContent,
          metadata: {
            processingLibrary: 'jszip_fallback',
            extractionMethod: 'xml_text_extraction',
            warning: 'Basic DOCX extraction - install mammoth for better results'
          }
        };
      } else {
        throw new Error('Could not find document.xml in DOCX file');
      }
    } catch (error) {
      // Final fallback - return basic file info
      try {
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);
        return {
          content: `Document: ${filename}\nFile size: ${stats.size} bytes\nFormat: Microsoft Word Document (processing failed: ${error.message})`,
          metadata: {
            processingLibrary: 'fallback',
            error: error.message,
            filename,
            fileSize: stats.size
          }
        };
      } catch (fallbackError) {
        return {
          content: `DOCX processing failed: ${error.message}`,
          metadata: {
            processingLibrary: 'fallback',
            error: error.message
          }
        };
      }
    }
  }

  /**
   * Extract text from JSON data
   */
  extractTextFromJSON(jsonData) {
    const extractText = (obj, depth = 0) => {
      if (depth > 10) return ''; // Prevent infinite recursion
      
      if (typeof obj === 'string') {
        return obj + ' ';
      } else if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj.toString() + ' ';
      } else if (Array.isArray(obj)) {
        return obj.map(item => extractText(item, depth + 1)).join('');
      } else if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).map(value => extractText(value, depth + 1)).join('');
      }
      return '';
    };

    return extractText(jsonData).trim();
  }

  /**
   * Extract title from content or filename
   */
  extractTitleFromContent(content, filePath) {
    // Try to extract title from content
    const lines = content.split('\n').slice(0, 10); // Check first 10 lines
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for title patterns
      if (trimmed.match(/^#\s+(.+)$/)) {
        return trimmed.replace(/^#\s+/, ''); // Markdown title
      }
      if (trimmed.length > 5 && trimmed.length < 100 && 
          trimmed.match(/^[A-Z][^.!?]*$/) && 
          !trimmed.includes('  ')) {
        return trimmed; // Likely title
      }
    }
    
    // Fallback to filename
    const filename = path.basename(filePath, path.extname(filePath));
    return filename.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate hierarchical chunks
   */
  async generateHierarchicalChunks(document, config) {
    if (!config.enableHierarchicalChunking) {
      // Fallback to simple chunking
      return this.generateSimpleChunks(document);
    }

    console.log('🏗️ Generating hierarchical chunks...');
    
    try {
      const chunkingResult = await this.hierarchicalChunker.chunkDocumentHierarchically(
        document, 
        config
      );

      console.log(`✅ Generated ${chunkingResult.chunks.length} hierarchical chunks`);
      return chunkingResult;
    } catch (error) {
      console.error('❌ Hierarchical chunking failed:', error);
      console.log('🔄 Falling back to simple chunking...');
      return this.generateSimpleChunks(document);
    }
  }

  /**
   * Generate enhanced chunks as fallback with better algorithms
   */
  async generateSimpleChunks(document) {
    console.log('🔄 Using enhanced fallback chunking...');
    
    try {
      // Try multiple chunking strategies and pick the best one
      const strategies = [
        () => this.generateSemanticFallbackChunks(document),
        () => this.generateStructuralFallbackChunks(document),
        () => this.generateBasicFallbackChunks(document)
      ];

      let bestResult = null;
      let bestScore = 0;

      for (const strategy of strategies) {
        try {
          const result = await strategy();
          const score = this.evaluateFallbackQuality(result);
          
          if (score > bestScore) {
            bestScore = score;
            bestResult = result;
          }
        } catch (error) {
          console.warn('⚠️ Fallback strategy failed:', error.message);
        }
      }

      return bestResult || this.generateBasicFallbackChunks(document);
    } catch (error) {
      console.error('❌ All fallback strategies failed:', error);
      return this.generateBasicFallbackChunks(document);
    }
  }

  /**
   * Generate semantic-aware fallback chunks
   */
  async generateSemanticFallbackChunks(document) {
    const natural = require('natural');
    const sentenceTokenizer = new natural.SentenceTokenizer();
    const sentences = sentenceTokenizer.tokenize(document.content);
    const chunks = [];
    let chunkIndex = 0;

    // Group sentences by semantic similarity
    const sentenceGroups = this.groupSentencesBySimilarity(sentences);
    
    for (const group of sentenceGroups) {
      const content = group.join(' ');
      const tokenCount = this.estimateTokenCount(content);
      
      if (tokenCount >= 50 && tokenCount <= 800) {
        chunks.push({
          id: `semantic_fallback_${chunkIndex}`,
          content: content.trim(),
          scale: 'paragraph',
          tokenCount: tokenCount,
          qualityScore: this.calculateSemanticChunkQuality(content, group.length),
          metadata: {
            chunkingMethod: 'semantic_fallback',
            sentenceCount: group.length,
            semanticCoherence: this.calculateGroupCoherence(group)
          }
        });
        chunkIndex++;
      }
    }

    return {
      chunks,
      metadata: {
        chunkingMethod: 'semantic_fallback',
        totalChunks: chunks.length,
        averageQuality: chunks.reduce((sum, c) => sum + c.qualityScore, 0) / chunks.length
      }
    };
  }

  /**
   * Generate structure-aware fallback chunks
   */
  async generateStructuralFallbackChunks(document) {
    const chunks = [];
    let chunkIndex = 0;

    // Try to identify structural elements
    const structuralElements = this.identifyStructuralElements(document.content);
    
    for (const element of structuralElements) {
      const tokenCount = this.estimateTokenCount(element.content);
      
      if (tokenCount >= 30) {
        // Split large elements
        if (tokenCount > 600) {
          const subChunks = this.splitLargeElement(element);
          for (const subChunk of subChunks) {
            chunks.push({
              id: `structural_fallback_${chunkIndex}`,
              content: subChunk.content,
              scale: subChunk.scale || 'paragraph',
              tokenCount: this.estimateTokenCount(subChunk.content),
              qualityScore: this.calculateStructuralChunkQuality(subChunk, element),
              heading: element.heading,
              metadata: {
                chunkingMethod: 'structural_fallback',
                elementType: element.type,
                parentElement: element.heading
              }
            });
            chunkIndex++;
          }
        } else {
          chunks.push({
            id: `structural_fallback_${chunkIndex}`,
            content: element.content,
            scale: this.determineScale(element.type, tokenCount),
            tokenCount: tokenCount,
            qualityScore: this.calculateStructuralChunkQuality(element),
            heading: element.heading,
            metadata: {
              chunkingMethod: 'structural_fallback',
              elementType: element.type
            }
          });
          chunkIndex++;
        }
      }
    }

    return {
      chunks,
      metadata: {
        chunkingMethod: 'structural_fallback',
        totalChunks: chunks.length,
        structuralElements: structuralElements.length
      }
    };
  }

  /**
   * Generate basic fallback chunks (last resort)
   */
  generateBasicFallbackChunks(document) {
    const sentences = document.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.trim().length;
      if (currentChunk.length + sentenceLength > 800 && currentChunk) {
        chunks.push({
          id: `basic_fallback_${chunkIndex}`,
          content: currentChunk.trim(),
          scale: 'paragraph',
          tokenCount: this.estimateTokenCount(currentChunk),
          qualityScore: 0.5,
          metadata: {
            chunkingMethod: 'basic_fallback'
          }
        });
        currentChunk = sentence.trim();
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `basic_fallback_${chunkIndex}`,
        content: currentChunk.trim(),
        scale: 'paragraph',
        tokenCount: this.estimateTokenCount(currentChunk),
        qualityScore: 0.5,
        metadata: {
          chunkingMethod: 'basic_fallback'
        }
      });
    }

    return {
      chunks,
      metadata: {
        chunkingMethod: 'basic_fallback',
        totalChunks: chunks.length
      }
    };
  }

  // Helper methods for enhanced fallback chunking

  /**
   * Group sentences by semantic similarity
   */
  groupSentencesBySimilarity(sentences) {
    const groups = [];
    let currentGroup = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (currentGroup.length === 0) {
        currentGroup.push(sentence);
      } else {
        const similarity = this.calculateSentenceSimilarity(
          sentence, 
          currentGroup[currentGroup.length - 1]
        );
        
        if (similarity > 0.3 && currentGroup.join(' ').length < 600) {
          currentGroup.push(sentence);
        } else {
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
          }
          currentGroup = [sentence];
        }
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * Calculate similarity between sentences
   */
  calculateSentenceSimilarity(sentence1, sentence2) {
    const words1 = new Set(sentence1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(sentence2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Identify structural elements in content
   */
  identifyStructuralElements(content) {
    const elements = [];
    const lines = content.split('\n');
    let currentElement = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (this.isHeading(trimmedLine)) {
        if (currentElement && currentElement.content.trim()) {
          elements.push(currentElement);
        }
        currentElement = {
          type: 'section',
          heading: trimmedLine,
          content: ''
        };
      } else if (this.isList(trimmedLine)) {
        if (currentElement && currentElement.type !== 'list') {
          if (currentElement.content.trim()) {
            elements.push(currentElement);
          }
          currentElement = {
            type: 'list',
            heading: currentElement?.heading || 'List',
            content: trimmedLine
          };
        } else if (currentElement) {
          currentElement.content += '\n' + trimmedLine;
        }
      } else if (trimmedLine) {
        if (!currentElement) {
          currentElement = {
            type: 'paragraph',
            heading: null,
            content: trimmedLine
          };
        } else {
          currentElement.content += '\n' + trimmedLine;
        }
      }
    }
    
    if (currentElement && currentElement.content.trim()) {
      elements.push(currentElement);
    }
    
    return elements;
  }

  /**
   * Check if line is a heading
   */
  isHeading(line) {
    return line.match(/^#{1,6}\s/) || // Markdown headings
           line.match(/^[A-Z][A-Z\s]+$/) || // ALL CAPS
           line.match(/^\d+\.?\s+[A-Z]/) || // Numbered headings
           (line.length < 80 && line.match(/^[A-Z]/)); // Short lines starting with capital
  }

  /**
   * Check if line is a list item
   */
  isList(line) {
    return line.match(/^[-*+]\s/) || // Bullet points
           line.match(/^\d+\.\s/) || // Numbered lists
           line.match(/^[a-zA-Z]\.\s/); // Lettered lists
  }

  /**
   * Split large structural elements
   */
  splitLargeElement(element) {
    const sentences = element.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const subChunks = [];
    let currentContent = '';
    let subIndex = 0;
    
    for (const sentence of sentences) {
      if (currentContent.length + sentence.length > 500 && currentContent) {
        subChunks.push({
          content: currentContent.trim(),
          scale: 'paragraph',
          subIndex: subIndex++
        });
        currentContent = sentence.trim();
      } else {
        currentContent += (currentContent ? '. ' : '') + sentence.trim();
      }
    }
    
    if (currentContent.trim()) {
      subChunks.push({
        content: currentContent.trim(),
        scale: 'paragraph',
        subIndex: subIndex
      });
    }
    
    return subChunks;
  }

  /**
   * Determine appropriate scale based on element type and size
   */
  determineScale(elementType, tokenCount) {
    if (elementType === 'section' && tokenCount > 300) return 'section';
    if (tokenCount > 150) return 'paragraph';
    return 'sentence';
  }

  /**
   * Calculate quality score for semantic chunks
   */
  calculateSemanticChunkQuality(content, sentenceCount) {
    let quality = 0.5;
    
    // Sentence count quality
    if (sentenceCount >= 2 && sentenceCount <= 8) quality += 0.2;
    
    // Content length quality
    if (content.length >= 100 && content.length <= 600) quality += 0.2;
    
    // Coherence indicators
    if (content.includes('therefore') || content.includes('however') || content.includes('moreover')) {
      quality += 0.1;
    }
    
    return Math.min(quality, 1.0);
  }

  /**
   * Calculate quality score for structural chunks
   */
  calculateStructuralChunkQuality(element, parentElement = null) {
    let quality = 0.6; // Base quality for structural elements
    
    // Element type quality
    if (element.type === 'section') quality += 0.1;
    if (element.type === 'list') quality += 0.05;
    
    // Heading quality
    if (element.heading) quality += 0.1;
    
    // Parent relationship quality
    if (parentElement) quality += 0.05;
    
    return Math.min(quality, 1.0);
  }

  /**
   * Calculate group coherence for semantic groups
   */
  calculateGroupCoherence(sentences) {
    if (sentences.length <= 1) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < sentences.length - 1; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        totalSimilarity += this.calculateSentenceSimilarity(sentences[i], sentences[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Evaluate fallback chunking quality
   */
  evaluateFallbackQuality(result) {
    if (!result || !result.chunks || result.chunks.length === 0) return 0;
    
    const chunks = result.chunks;
    let score = 0;
    
    // Average quality score (40% weight)
    const avgQuality = chunks.reduce((sum, c) => sum + c.qualityScore, 0) / chunks.length;
    score += avgQuality * 0.4;
    
    // Chunk count appropriateness (30% weight)
    const chunkCountScore = chunks.length >= 3 && chunks.length <= 20 ? 1 : 0.5;
    score += chunkCountScore * 0.3;
    
    // Token distribution (20% weight)
    const tokenCounts = chunks.map(c => c.tokenCount);
    const avgTokens = tokenCounts.reduce((sum, t) => sum + t, 0) / tokenCounts.length;
    const tokenScore = avgTokens >= 50 && avgTokens <= 400 ? 1 : 0.5;
    score += tokenScore * 0.2;
    
    // Method sophistication (10% weight)
    const methodScore = result.metadata.chunkingMethod === 'semantic_fallback' ? 1 : 
                       result.metadata.chunkingMethod === 'structural_fallback' ? 0.8 : 0.6;
    score += methodScore * 0.1;
    
    return score;
  }

  /**
   * Estimate token count from text
   */
  estimateTokenCount(text) {
    // Simple estimation: ~1.3 tokens per word
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  /**
   * Generate multi-scale embeddings
   */
  async generateMultiScaleEmbeddings(chunks, config) {
    if (!config.enableMultiScaleEmbeddings) {
      return { chunks, totalEmbeddings: 0, metadata: { embeddingMethod: 'disabled' } };
    }

    console.log('🎯 Generating multi-scale embeddings...');
    
    try {
      const embeddingResult = await this.embeddingGenerator.generateBatchEmbeddings(
        chunks, 
        config
      );

      // Merge embedding results back into chunks
      const enrichedChunks = chunks.map((chunk, index) => {
        const embeddingData = embeddingResult.results[index];
        if (embeddingData && embeddingData.embeddings) {
          return {
            ...chunk,
            embeddings: embeddingData.embeddings,
            embeddingQuality: embeddingData.metadata.qualityScore
          };
        }
        return chunk;
      });

      console.log(`✅ Generated embeddings for ${enrichedChunks.length} chunks`);
      return {
        chunks: enrichedChunks,
        totalEmbeddings: embeddingResult.results.length,
        metadata: embeddingResult.metadata
      };
    } catch (error) {
      console.error('❌ Multi-scale embedding generation failed:', error);
      return { chunks, totalEmbeddings: 0, metadata: { embeddingMethod: 'failed', error: error.message } };
    }
  }

  /**
   * Store processed chunks in database
   */
  async storeProcessedChunks(chunks, sourceId, version, config) {
    console.log('💾 Storing processed chunks in database...');
    
    let chunksStored = 0;
    const errors = [];

    for (const chunk of chunks) {
      try {
        // Use primary embedding (content) for vector storage
        const primaryEmbedding = chunk.embeddings?.content || null;
        
        const insertQuery = `
          INSERT INTO kb_chunks (
            chunk_id, source_id, version, chunk_index, content, heading,
            token_count, character_count, word_count, quality_score, metadata, embedding,
            parent_chunk_id, child_chunk_ids, sibling_chunk_ids,
            scale, node_id, hierarchy_path,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18, $19, $20
          )
          ON CONFLICT (chunk_id) DO UPDATE SET
            content = EXCLUDED.content,
            character_count = EXCLUDED.character_count,
            word_count = EXCLUDED.word_count,
            quality_score = EXCLUDED.quality_score,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            updated_at = EXCLUDED.updated_at
        `;

        const values = [
          chunk.id || `${sourceId}_${chunksStored}`,
          sourceId,
          version,
          chunksStored,
          chunk.content,
          chunk.heading || null,
          chunk.tokenCount || 0,
          chunk.content ? chunk.content.length : 0, // character_count
          chunk.content ? chunk.content.split(/\s+/).filter(word => word.length > 0).length : 0, // word_count
          chunk.qualityScore || 0.5,
          JSON.stringify({
            ...chunk.metadata,
            embeddingTypes: chunk.embeddings ? Object.keys(chunk.embeddings) : [],
            embeddingQuality: chunk.embeddingQuality
          }),
          primaryEmbedding ? `[${primaryEmbedding.join(',')}]` : null,
          chunk.parentChunkId || null,
          chunk.childChunkIds || null,
          chunk.siblingChunkIds || null,
          chunk.scale || 'paragraph',
          chunk.nodeId || null,
          chunk.hierarchyPath || null,
          new Date(),
          new Date()
        ];

        await this.db.query(insertQuery, values);
        chunksStored++;
      } catch (error) {
        console.error(`❌ Failed to store chunk ${chunk.id}:`, error);
        errors.push({ chunkId: chunk.id, error: error.message });
      }
    }

    console.log(`✅ Stored ${chunksStored}/${chunks.length} chunks in database`);
    
    return {
      chunksStored,
      totalChunks: chunks.length,
      errors,
      metadata: {
        storageMethod: 'advanced',
        errorCount: errors.length
      }
    };
  }

  /**
   * Validate processing quality
   */
  async validateProcessingQuality(storageResult, config) {
    console.log('✅ Validating processing quality...');
    
    const qualityMetrics = {
      storageSuccessRate: storageResult.chunksStored / storageResult.totalChunks,
      errorRate: storageResult.errors.length / storageResult.totalChunks,
      overallQuality: 0
    };

    // Calculate overall quality score
    let qualityScore = 0.5; // Base score

    // Storage success contributes to quality
    qualityScore += qualityMetrics.storageSuccessRate * 0.3;

    // Low error rate contributes to quality
    qualityScore += (1 - qualityMetrics.errorRate) * 0.2;

    qualityMetrics.overallQuality = Math.min(qualityScore, 1.0);

    // Check if quality meets thresholds
    const qualityValidation = {
      meetsMinQuality: qualityMetrics.overallQuality >= config.qualityThresholds.minOverallQuality,
      qualityGrade: this.getQualityGrade(qualityMetrics.overallQuality),
      recommendations: this.generateQualityRecommendations(qualityMetrics)
    };

    console.log(`✅ Quality validation completed: ${qualityValidation.qualityGrade} (${qualityMetrics.overallQuality.toFixed(3)})`);

    return {
      ...qualityMetrics,
      validation: qualityValidation,
      metadata: {
        validationMethod: 'advanced',
        timestamp: new Date()
      }
    };
  }

  /**
   * Update processing statistics
   */
  updateProcessingStats(processingTime, qualityResult) {
    this.processingStats.documentsProcessed++;
    this.processingStats.totalProcessingTime += processingTime;
    this.processingStats.averageProcessingTime = 
      this.processingStats.totalProcessingTime / this.processingStats.documentsProcessed;
    
    // Update quality average
    const currentAvg = this.processingStats.averageQualityScore;
    const count = this.processingStats.documentsProcessed;
    this.processingStats.averageQualityScore = 
      (currentAvg * (count - 1) + qualityResult.overallQuality) / count;
  }

  /**
   * Generate batch processing summary
   */
  generateBatchSummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      totalDocuments: results.length,
      successfulDocuments: successful.length,
      failedDocuments: failed.length,
      successRate: successful.length / results.length,
      averageProcessingTime: successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length,
      averageQualityScore: successful.reduce((sum, r) => sum + r.qualityScore, 0) / successful.length,
      totalChunksGenerated: successful.reduce((sum, r) => sum + r.chunksGenerated, 0),
      totalEmbeddingsCreated: successful.reduce((sum, r) => sum + r.embeddingsCreated, 0)
    };
  }

  /**
   * Get quality grade from score
   */
  getQualityGrade(score) {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Good';
    if (score >= 0.7) return 'Fair';
    if (score >= 0.6) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Generate quality recommendations
   */
  generateQualityRecommendations(qualityMetrics) {
    const recommendations = [];

    if (qualityMetrics.storageSuccessRate < 0.9) {
      recommendations.push('Improve chunk storage reliability');
    }

    if (qualityMetrics.errorRate > 0.1) {
      recommendations.push('Investigate and reduce processing errors');
    }

    if (qualityMetrics.overallQuality < 0.7) {
      recommendations.push('Review and optimize processing pipeline');
    }

    return recommendations;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      embeddingStats: this.embeddingGenerator.getEmbeddingStats(),
      retrievalStats: this.contextualRetriever ? this.contextualRetriever.retrievalStats : null
    };
  }

  /**
   * Test the advanced processing pipeline
   */
  async testProcessingPipeline(testDocument = null) {
    console.log('🧪 Testing advanced processing pipeline...');
    
    const testDoc = testDocument || {
      sourceId: 'test_doc',
      version: '1.0',
      content: `
        # Test Document
        
        ## Introduction
        This is a test document for validating the advanced document processing pipeline.
        
        ## Fund Management Overview
        Fund management involves the strategic allocation of assets to maximize returns while minimizing risk.
        
        ### Investment Strategies
        Various investment strategies can be employed including diversification, hedging, and portfolio optimization.
        
        ## Conclusion
        Effective fund management requires comprehensive analysis and continuous monitoring.
      `,
      metadata: {
        title: 'Test Document',
        type: 'test'
      }
    };

    try {
      // Test hierarchical chunking
      const chunkingResult = await this.hierarchicalChunker.chunkDocumentHierarchically(testDoc);
      console.log(`✅ Chunking test: ${chunkingResult.chunks.length} chunks generated`);

      // Test embedding generation
      if (chunkingResult.chunks.length > 0) {
        const embeddingResult = await this.embeddingGenerator.generateMultiScaleEmbeddings(
          chunkingResult.chunks[0]
        );
        console.log(`✅ Embedding test: ${Object.keys(embeddingResult.embeddings).length} embedding types generated`);
      }

      // Test retrieval
      const retrievalResult = await this.contextualRetriever.retrieveWithAdvancedContext(
        'fund management strategies',
        { domain: 'fundManagement' },
        { maxResults: 5 }
      );
      console.log(`✅ Retrieval test: ${retrievalResult.chunks.length} chunks retrieved`);

      console.log('🎉 Advanced processing pipeline test completed successfully!');
      return {
        success: true,
        chunkingTest: { passed: true, chunksGenerated: chunkingResult.chunks.length },
        embeddingTest: { passed: true, embeddingTypes: chunkingResult.chunks.length > 0 ? Object.keys(embeddingResult.embeddings).length : 0 },
        retrievalTest: { passed: true, chunksRetrieved: retrievalResult.chunks.length }
      };

    } catch (error) {
      console.error('❌ Pipeline test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a job record for progress tracking
   */
  async createJobRecord(sourceId, jobType, config) {
    try {
      const result = await this.db.query(`
        INSERT INTO ingestion_jobs (
          source_id, job_type, job_status, started_at, 
          total_steps, configuration, progress_percentage, current_step
        ) VALUES ($1, $2, 'running', NOW(), 6, $3, 0, 'Initializing')
        RETURNING job_id
      `, [sourceId, jobType, JSON.stringify(config)]);
      
      const jobId = result.rows[0].job_id;
      console.log(`📝 Created job record: ${jobId}`);
      return jobId;
    } catch (error) {
      console.error('❌ Failed to create job record:', error);
      return null;
    }
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId, progressPercentage, currentStep, additionalData = {}) {
    if (!jobId) return;
    
    try {
      await this.db.query(`
        UPDATE ingestion_jobs 
        SET progress_percentage = $1, current_step = $2, updated_at = NOW(),
            chunks_processed = COALESCE($3, chunks_processed),
            embeddings_generated = COALESCE($4, embeddings_generated)
        WHERE job_id = $5
      `, [
        progressPercentage, 
        currentStep, 
        additionalData.chunksProcessed || null,
        additionalData.embeddingsGenerated || null,
        jobId
      ]);
      
      console.log(`📊 Job ${jobId}: ${progressPercentage}% - ${currentStep}`);
    } catch (error) {
      console.error('❌ Failed to update job progress:', error);
    }
  }

  /**
   * Complete job
   */
  async completeJob(jobId, processingTime, qualityResult) {
    if (!jobId) return;
    
    try {
      await this.db.query(`
        UPDATE ingestion_jobs 
        SET job_status = 'completed', completed_at = NOW(), progress_percentage = 100,
            current_step = 'Completed', processing_stats = $1, updated_at = NOW()
        WHERE job_id = $2
      `, [
        JSON.stringify({
          processingTimeMs: processingTime,
          qualityScore: qualityResult.overallQuality,
          chunksGenerated: qualityResult.totalChunks
        }),
        jobId
      ]);
      
      console.log(`✅ Job ${jobId} completed successfully`);
    } catch (error) {
      console.error('❌ Failed to complete job:', error);
    }
  }

  /**
   * Fail job
   */
  async failJob(jobId, errorMessage, errorDetails = {}) {
    if (!jobId) return;
    
    try {
      await this.db.query(`
        UPDATE ingestion_jobs 
        SET job_status = 'failed', completed_at = NOW(),
            current_step = 'Failed', error_message = $1, error_details = $2, updated_at = NOW()
        WHERE job_id = $3
      `, [errorMessage, JSON.stringify(errorDetails), jobId]);
      
      console.log(`❌ Job ${jobId} failed: ${errorMessage}`);
    } catch (error) {
      console.error('❌ Failed to update job failure:', error);
    }
  }
}

module.exports = AdvancedDocumentProcessingService;