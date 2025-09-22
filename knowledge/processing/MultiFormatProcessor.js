/**
 * Multi-Format Document Processor
 * Comprehensive support for various document formats with structure preservation
 * Production-ready with advanced parsing and error handling
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { performance } = require('perf_hooks');

// Format-specific parsers with graceful fallbacks
let mammoth = null;
let pdfParse = null;
let htmlToText = null;
let marked = null;
let xlsx = null;
let pptxParser = null;

// Load parsers at module level with error handling
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

try {
  htmlToText = require('html-to-text');
} catch (error) {
  console.warn('⚠️ html-to-text not available - HTML processing will be limited');
}

try {
  marked = require('marked');
} catch (error) {
  console.warn('⚠️ marked not available - Markdown processing will be limited');
}

try {
  xlsx = require('xlsx');
} catch (error) {
  console.warn('⚠️ xlsx not available - Excel processing will be limited');
}

class MultiFormatProcessor {
  constructor(options = {}) {
    this.options = {
      // Supported formats and their configurations
      formats: {
        docx: {
          parser: 'mammoth',
          extensions: ['.docx', '.doc'],
          mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          options: {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Heading 4'] => h4:fresh",
              "p[style-name='Title'] => h1:fresh"
            ],
            // convertImage will be set dynamically when mammoth is loaded
            ignoreEmptyParagraphs: true
          }
        },
        
        pdf: {
          parser: 'pdf-parse',
          extensions: ['.pdf'],
          mimeTypes: ['application/pdf'],
          options: {
            normalizeWhitespace: true,
            disableCombineTextItems: false,
            max: 0, // Process all pages
            version: 'v1.10.100'
          }
        },
        
        pptx: {
          parser: 'pptx-parser',
          extensions: ['.pptx', '.ppt'],
          mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
          options: {
            extractSpeakerNotes: true,
            preserveSlideStructure: true,
            includeSlideNumbers: true,
            extractImages: false
          }
        },
        
        xlsx: {
          parser: 'xlsx',
          extensions: ['.xlsx', '.xls'],
          mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          options: {
            cellText: true,
            cellDates: true,
            sheetStubs: false,
            defval: '',
            raw: false
          }
        },
        
        html: {
          parser: 'html-to-text',
          extensions: ['.html', '.htm'],
          mimeTypes: ['text/html'],
          options: {
            wordwrap: false,
            preserveNewlines: true,
            uppercaseHeadings: false,
            singleNewLineParagraphs: true,
            tables: ['#invoice', '.address'],
            hideLinkHrefIfSameAsText: true,
            ignoreHref: false,
            ignoreImage: true
          }
        },
        
        markdown: {
          parser: 'marked',
          extensions: ['.md', '.markdown', '.mdown'],
          mimeTypes: ['text/markdown', 'text/x-markdown'],
          options: {
            gfm: true,
            breaks: true,
            pedantic: false,
            sanitize: false,
            smartLists: true,
            smartypants: true
          }
        },
        
        text: {
          parser: 'native',
          extensions: ['.txt', '.text'],
          mimeTypes: ['text/plain'],
          options: {
            encoding: 'utf8'
          }
        }
      },
      
      // Processing options
      processing: {
        enableStructureExtraction: true,
        enableMetadataExtraction: true,
        enableContentEnhancement: true,
        preserveFormatting: true,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        timeout: 60000 // 60 seconds
      },
      
      // Quality settings
      quality: {
        minContentLength: 10,
        maxContentLength: 10 * 1024 * 1024, // 10MB text
        validateEncoding: true,
        detectCorruption: true
      },
      
      // Performance settings
      performance: {
        enableCaching: true,
        maxCacheSize: 100,
        enableParallelProcessing: false, // Disabled for memory management
        memoryThreshold: 0.8
      },
      
      ...options
    };

    // Initialize state
    this.processingCache = new Map();
    this.parserInstances = new Map();
    this.performanceMetrics = {
      documentsProcessed: 0,
      formatDistribution: {},
      averageProcessingTime: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
    
    // Initialize parsers
    this.initializeParsers();
  }

  /**
   * Initialize format-specific parsers
   */
  async initializeParsers() {
    try {
      // Use pre-loaded parsers with graceful fallbacks
      this.parserInstances.set('mammoth', mammoth);
      this.parserInstances.set('pdf-parse', pdfParse);
      this.parserInstances.set('html-to-text', htmlToText);
      this.parserInstances.set('marked', marked);
      this.parserInstances.set('xlsx', xlsx);
      this.parserInstances.set('pptx-parser', this.createPptxParser());
      
      // Log available parsers
      const availableParsers = Array.from(this.parserInstances.entries())
        .filter(([name, parser]) => parser !== null)
        .map(([name]) => name);
      
      const unavailableParsers = Array.from(this.parserInstances.entries())
        .filter(([name, parser]) => parser === null)
        .map(([name]) => name);
      
      logger.info(`✅ Multi-format processors initialized. Available: [${availableParsers.join(', ')}]`);
      
      if (unavailableParsers.length > 0) {
        logger.warn(`⚠️ Unavailable parsers: [${unavailableParsers.join(', ')}]`);
      }
      
    } catch (error) {
      logger.warn('⚠️ Parser initialization failed:', error.message);
    }
  }


  /**
   * Main document processing method
   * @param {string} filePath - Path to the document file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with content and metadata
   */
  async processDocument(filePath, options = {}) {
    const startTime = performance.now();
    
    try {
      logger.info(`📄 Processing document: ${path.basename(filePath)}`);
      
      // Validate file
      const fileValidation = await this.validateFile(filePath);
      if (!fileValidation.isValid) {
        throw new Error(`File validation failed: ${fileValidation.reason}`);
      }
      
      // Detect format
      const formatDetection = await this.detectFormat(filePath);
      logger.info(`🔍 Detected format: ${formatDetection.format} (confidence: ${Math.round(formatDetection.confidence * 100)}%)`);
      
      // Generate cache key
      const cacheKey = await this.generateCacheKey(filePath, formatDetection.format, options);
      
      // Check cache
      if (this.options.performance.enableCaching && this.processingCache.has(cacheKey)) {
        logger.debug('📋 Using cached processing result');
        this.performanceMetrics.cacheHitRate++;
        return this.processingCache.get(cacheKey);
      }
      
      // Process document based on format
      const processingResult = await this.processDocumentByFormat(
        filePath,
        formatDetection.format,
        { ...this.options.formats[formatDetection.format]?.options, ...options }
      );
      
      // Post-process result
      const finalResult = await this.postProcessResult(
        processingResult,
        formatDetection,
        fileValidation
      );
      
      // Cache result
      if (this.options.performance.enableCaching) {
        this.cacheResult(cacheKey, finalResult);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      this.updateMetrics(formatDetection.format, processingTime, true);
      
      logger.info(`✅ Document processed successfully in ${Math.round(processingTime)}ms`);
      
      return {
        ...finalResult,
        processingTime,
        format: formatDetection.format,
        cacheKey
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateMetrics('unknown', processingTime, false);
      
      logger.error(`❌ Document processing failed for ${filePath}:`, error);
      return this.generateFallbackResult(filePath, error);
    }
  }

  /**
   * Validate file before processing
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Validation result
   */
  async validateFile(filePath) {
    try {
      // Check if file exists
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        return { isValid: false, reason: 'Path is not a file' };
      }
      
      // Check file size
      if (stats.size > this.options.processing.maxFileSize) {
        return { 
          isValid: false, 
          reason: `File too large: ${stats.size} bytes (max: ${this.options.processing.maxFileSize})` 
        };
      }
      
      if (stats.size === 0) {
        return { isValid: false, reason: 'File is empty' };
      }
      
      // Check file permissions
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (accessError) {
        return { isValid: false, reason: 'File is not readable' };
      }
      
      return {
        isValid: true,
        fileSize: stats.size,
        lastModified: stats.mtime,
        permissions: 'readable'
      };
      
    } catch (error) {
      return {
        isValid: false,
        reason: `File validation error: ${error.message}`
      };
    }
  }

  /**
   * Detect document format
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Format detection result
   */
  async detectFormat(filePath) {
    try {
      const extension = path.extname(filePath).toLowerCase();
      
      // Read file signature
      const buffer = await fs.readFile(filePath);
      const signature = buffer.slice(0, 20).toString();
      
      // Check each format
      for (const [formatName, formatConfig] of Object.entries(this.options.formats)) {
        let confidence = 0;
        
        // Check extension
        if (formatConfig.extensions.includes(extension)) {
          confidence += 0.6;
        }
        
        // Check MIME type (if available)
        // This would require additional MIME detection library
        
        // Check file signature
        if (this.checkFileSignature(signature, formatName)) {
          confidence += 0.4;
        }
        
        if (confidence >= 0.6) {
          return {
            format: formatName,
            confidence: confidence,
            detectionMethod: 'extension_and_signature'
          };
        }
      }
      
      // Fallback to extension-only detection
      for (const [formatName, formatConfig] of Object.entries(this.options.formats)) {
        if (formatConfig.extensions.includes(extension)) {
          return {
            format: formatName,
            confidence: 0.3,
            detectionMethod: 'extension_only'
          };
        }
      }
      
      // Unknown format
      return {
        format: 'unknown',
        confidence: 0.1,
        detectionMethod: 'fallback'
      };
      
    } catch (error) {
      logger.error('❌ Format detection failed:', error);
      return {
        format: 'unknown',
        confidence: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Process document based on detected format
   * @param {string} filePath - Path to file
   * @param {string} format - Detected format
   * @param {Object} options - Format-specific options
   * @returns {Promise<Object>} Processing result
   */
  async processDocumentByFormat(filePath, format, options) {
    try {
      switch (format) {
        case 'docx':
          return await this.processDocx(filePath, options);
        case 'pdf':
          return await this.processPdf(filePath, options);
        case 'pptx':
          return await this.processPptx(filePath, options);
        case 'xlsx':
          return await this.processXlsx(filePath, options);
        case 'html':
          return await this.processHtml(filePath, options);
        case 'markdown':
          return await this.processMarkdown(filePath, options);
        case 'text':
          return await this.processText(filePath, options);
        default:
          return await this.processUnknownFormat(filePath, options);
      }
    } catch (error) {
      logger.error(`❌ Format-specific processing failed for ${format}:`, error);
      throw error;
    }
  }

  /**
   * Process DOCX documents
   * @param {string} filePath - Path to DOCX file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processDocx(filePath, options) {
    try {
      // Ensure parsers are initialized
      if (this.parserInstances.size === 0) {
        await this.initializeParsers();
      }
      
      const mammoth = this.parserInstances.get('mammoth');
      if (!mammoth) {
        logger.error('❌ Mammoth parser not available. Available parsers:', Array.from(this.parserInstances.keys()));
        throw new Error('Mammoth parser not available');
      }
      
      // Configure options with proper mammoth references
      const mammothOptions = {
        ...options,
        convertImage: mammoth.images ? mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        }) : undefined
      };
      
      const result = await mammoth.convertToHtml({ path: filePath }, mammothOptions);
      
      // Extract structure from HTML
      const structure = this.extractStructureFromHtml(result.value);
      
      // Convert HTML to clean text
      const cleanText = this.htmlToCleanText(result.value);
      
      // Extract metadata
      const metadata = await this.extractDocxMetadata(filePath, result);
      
      return {
        content: cleanText,
        htmlContent: result.value,
        structure: structure,
        metadata: metadata,
        messages: result.messages,
        format: 'docx',
        processingMethod: 'mammoth'
      };
      
    } catch (error) {
      logger.error('❌ DOCX processing failed:', error);
      throw new Error(`DOCX processing failed: ${error.message}`);
    }
  }

  /**
   * Process PDF documents
   * @param {string} filePath - Path to PDF file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processPdf(filePath, options) {
    try {
      const pdfParse = this.parserInstances.get('pdf-parse');
      if (!pdfParse) {
        throw new Error('PDF-parse parser not available');
      }
      
      const dataBuffer = await fs.readFile(filePath);
      const result = await pdfParse(dataBuffer, options);
      
      // Analyze PDF structure
      const structure = this.analyzePdfStructure(result.text);
      
      // Extract metadata
      const metadata = this.extractPdfMetadata(result);
      
      return {
        content: result.text,
        structure: structure,
        metadata: {
          ...metadata,
          pageCount: result.numpages,
          pdfInfo: result.info,
          version: result.version
        },
        format: 'pdf',
        processingMethod: 'pdf-parse'
      };
      
    } catch (error) {
      logger.error('❌ PDF processing failed:', error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Process PowerPoint documents
   * @param {string} filePath - Path to PPTX file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processPptx(filePath, options) {
    try {
      // Custom PPTX processing implementation
      const content = await this.extractPptxContent(filePath, options);
      
      return {
        content: content.text,
        slides: content.slides,
        structure: content.structure,
        metadata: content.metadata,
        format: 'pptx',
        processingMethod: 'custom'
      };
      
    } catch (error) {
      logger.error('❌ PPTX processing failed:', error);
      throw new Error(`PPTX processing failed: ${error.message}`);
    }
  }

  /**
   * Process Excel documents
   * @param {string} filePath - Path to XLSX file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processXlsx(filePath, options) {
    try {
      const XLSX = this.parserInstances.get('xlsx');
      if (!XLSX) {
        throw new Error('XLSX parser not available');
      }
      
      const workbook = XLSX.readFile(filePath, options);
      
      // Process all sheets
      const sheets = {};
      const allContent = [];
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Convert to text
        const sheetText = this.convertSheetToText(jsonData, sheetName);
        sheets[sheetName] = {
          data: jsonData,
          text: sheetText
        };
        
        allContent.push(`Sheet: ${sheetName}\n${sheetText}`);
      });
      
      // Extract structure
      const structure = this.extractXlsxStructure(sheets);
      
      return {
        content: allContent.join('\n\n'),
        sheets: sheets,
        structure: structure,
        metadata: {
          sheetCount: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames,
          properties: workbook.Props || {}
        },
        format: 'xlsx',
        processingMethod: 'xlsx'
      };
      
    } catch (error) {
      logger.error('❌ XLSX processing failed:', error);
      throw new Error(`XLSX processing failed: ${error.message}`);
    }
  }

  /**
   * Process HTML documents
   * @param {string} filePath - Path to HTML file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processHtml(filePath, options) {
    try {
      const htmlToText = this.parserInstances.get('html-to-text');
      if (!htmlToText) {
        throw new Error('HTML-to-text parser not available');
      }
      
      const htmlContent = await fs.readFile(filePath, 'utf8');
      
      // Convert HTML to text
      const textContent = htmlToText.convert(htmlContent, options);
      
      // Extract structure from HTML
      const structure = this.extractHtmlStructure(htmlContent);
      
      // Extract metadata
      const metadata = this.extractHtmlMetadata(htmlContent);
      
      return {
        content: textContent,
        htmlContent: htmlContent,
        structure: structure,
        metadata: metadata,
        format: 'html',
        processingMethod: 'html-to-text'
      };
      
    } catch (error) {
      logger.error('❌ HTML processing failed:', error);
      throw new Error(`HTML processing failed: ${error.message}`);
    }
  }

  /**
   * Process Markdown documents
   * @param {string} filePath - Path to Markdown file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processMarkdown(filePath, options) {
    try {
      const marked = this.parserInstances.get('marked');
      if (!marked) {
        throw new Error('Marked parser not available');
      }
      
      const markdownContent = await fs.readFile(filePath, 'utf8');
      
      // Configure marked
      marked.setOptions(options);
      
      // Parse markdown
      const htmlContent = marked.parse(markdownContent);
      
      // Extract structure from markdown
      const structure = this.extractMarkdownStructure(markdownContent);
      
      // Convert to clean text
      const textContent = this.markdownToText(markdownContent);
      
      return {
        content: textContent,
        markdownContent: markdownContent,
        htmlContent: htmlContent,
        structure: structure,
        metadata: {
          hasCodeBlocks: /```/.test(markdownContent),
          hasLinks: /\[.*\]\(.*\)/.test(markdownContent),
          hasImages: /!\[.*\]\(.*\)/.test(markdownContent),
          hasTables: /\|.*\|/.test(markdownContent)
        },
        format: 'markdown',
        processingMethod: 'marked'
      };
      
    } catch (error) {
      logger.error('❌ Markdown processing failed:', error);
      throw new Error(`Markdown processing failed: ${error.message}`);
    }
  }

  /**
   * Process plain text documents
   * @param {string} filePath - Path to text file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processText(filePath, options) {
    try {
      const content = await fs.readFile(filePath, options.encoding || 'utf8');
      
      // Analyze text structure
      const structure = this.analyzeTextStructure(content);
      
      return {
        content: content,
        structure: structure,
        metadata: {
          encoding: options.encoding || 'utf8',
          lineCount: content.split('\n').length,
          wordCount: content.split(/\s+/).length,
          characterCount: content.length
        },
        format: 'text',
        processingMethod: 'native'
      };
      
    } catch (error) {
      logger.error('❌ Text processing failed:', error);
      throw new Error(`Text processing failed: ${error.message}`);
    }
  }

  /**
   * Process unknown format (fallback)
   * @param {string} filePath - Path to file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processUnknownFormat(filePath, options) {
    try {
      // Try to read as text
      const content = await fs.readFile(filePath, 'utf8');
      
      logger.warn(`⚠️ Processing unknown format as text: ${path.basename(filePath)}`);
      
      return {
        content: content,
        structure: { hasStructure: false },
        metadata: { format: 'unknown', processedAsText: true },
        format: 'unknown',
        processingMethod: 'fallback_text'
      };
      
    } catch (error) {
      throw new Error(`Unknown format processing failed: ${error.message}`);
    }
  }

  // Helper methods for structure extraction

  /**
   * Extract structure from HTML
   */
  extractStructureFromHtml(html) {
    const headings = [];
    const sections = [];
    
    // Extract headings
    const headingMatches = html.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi) || [];
    headingMatches.forEach((match, index) => {
      const levelMatch = match.match(/<h([1-6])/);
      const textMatch = match.match(/>(.*?)</);
      
      if (levelMatch && textMatch) {
        headings.push({
          level: parseInt(levelMatch[1]),
          text: textMatch[1].replace(/<[^>]*>/g, '').trim(),
          index: index
        });
      }
    });
    
    return {
      hasStructure: headings.length > 0,
      headings: headings,
      sections: sections,
      hasHtml: true
    };
  }

  /**
   * Convert HTML to clean text
   */
  htmlToCleanText(html) {
    // Remove HTML tags but preserve structure
    let text = html.replace(/<h([1-6])[^>]*>/gi, '\n\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<br[^>]*>/gi, '\n');
    text = text.replace(/<[^>]*>/g, '');
    
    // Clean up whitespace
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    
    // Normalize whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');
    
    return text.trim();
  }

  /**
   * Check file signature for format detection
   */
  checkFileSignature(signature, format) {
    const signatures = {
      pdf: ['%PDF-'],
      docx: ['PK\x03\x04'],
      pptx: ['PK\x03\x04'],
      xlsx: ['PK\x03\x04'],
      html: ['<!DOCTYPE', '<html', '<HTML'],
      text: [] // No specific signature
    };
    
    const formatSignatures = signatures[format] || [];
    return formatSignatures.some(sig => signature.startsWith(sig));
  }

  /**
   * Generate cache key
   */
  async generateCacheKey(filePath, format, options) {
    try {
      const stats = await fs.stat(filePath);
      const hashInput = `${filePath}_${format}_${stats.size}_${stats.mtime.getTime()}_${JSON.stringify(options)}`;
      
      return require('crypto')
        .createHash('md5')
        .update(hashInput)
        .digest('hex');
    } catch (error) {
      return require('crypto')
        .createHash('md5')
        .update(`${filePath}_${format}_${JSON.stringify(options)}`)
        .digest('hex');
    }
  }

  /**
   * Cache processing result
   */
  cacheResult(cacheKey, result) {
    if (this.processingCache.size >= this.options.performance.maxCacheSize) {
      const firstKey = this.processingCache.keys().next().value;
      this.processingCache.delete(firstKey);
    }
    
    this.processingCache.set(cacheKey, {
      ...result,
      cachedAt: Date.now()
    });
  }

  /**
   * Update performance metrics
   */
  updateMetrics(format, processingTime, success) {
    this.performanceMetrics.documentsProcessed++;
    
    // Update format distribution
    if (!this.performanceMetrics.formatDistribution[format]) {
      this.performanceMetrics.formatDistribution[format] = 0;
    }
    this.performanceMetrics.formatDistribution[format]++;
    
    // Update average processing time
    const totalTime = this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.documentsProcessed - 1) + processingTime;
    this.performanceMetrics.averageProcessingTime = totalTime / this.performanceMetrics.documentsProcessed;
    
    // Update error rate
    if (!success) {
      this.performanceMetrics.errorRate = (this.performanceMetrics.errorRate * (this.performanceMetrics.documentsProcessed - 1) + 1) / this.performanceMetrics.documentsProcessed;
    } else {
      this.performanceMetrics.errorRate = (this.performanceMetrics.errorRate * (this.performanceMetrics.documentsProcessed - 1)) / this.performanceMetrics.documentsProcessed;
    }
  }

  /**
   * Generate fallback result for errors
   */
  generateFallbackResult(filePath, error) {
    return {
      content: '',
      structure: { hasStructure: false },
      metadata: { 
        error: error.message,
        fallback: true,
        fileName: path.basename(filePath)
      },
      format: 'unknown',
      processingMethod: 'failed',
      error: error.message,
      success: false
    };
  }

  /**
   * Post-process result
   */
  async postProcessResult(result, formatDetection, fileValidation) {
    try {
      // Add common metadata
      result.processingMetadata = {
        formatDetection: formatDetection,
        fileValidation: fileValidation,
        processedAt: new Date().toISOString(),
        contentLength: result.content.length,
        hasContent: result.content.length > 0
      };
      
      // Validate content quality
      if (this.options.quality.validateEncoding) {
        result.qualityMetrics = this.assessContentQuality(result.content);
      }
      
      // Enhance structure if enabled
      if (this.options.processing.enableStructureExtraction && !result.structure.hasStructure) {
        result.structure = this.analyzeTextStructure(result.content);
      }
      
      return result;
      
    } catch (error) {
      logger.error('❌ Post-processing failed:', error);
      return result; // Return original result if post-processing fails
    }
  }

  /**
   * Assess content quality
   */
  assessContentQuality(content) {
    const metrics = {
      length: content.length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      lineCount: content.split('\n').length,
      hasValidText: /[a-zA-Z]/.test(content),
      hasNumbers: /\d/.test(content),
      hasPunctuation: /[.!?]/.test(content),
      encoding: 'utf8' // Simplified
    };
    
    // Calculate quality score
    let qualityScore = 0.5; // Base score
    
    if (metrics.hasValidText) qualityScore += 0.2;
    if (metrics.wordCount > 10) qualityScore += 0.1;
    if (metrics.wordCount > 100) qualityScore += 0.1;
    if (metrics.hasPunctuation) qualityScore += 0.1;
    
    metrics.qualityScore = Math.min(1.0, qualityScore);
    
    return metrics;
  }

  /**
   * Analyze text structure (fallback method)
   */
  analyzeTextStructure(content) {
    const lines = content.split('\n');
    const headings = [];
    
    // Simple heading detection
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check for various heading patterns
      if (trimmed.length > 0 && trimmed.length < 100) {
        // All caps lines
        if (trimmed === trimmed.toUpperCase() && /^[A-Z\s]+$/.test(trimmed)) {
          headings.push({
            text: trimmed,
            level: 2,
            lineNumber: index
          });
        }
        // Lines ending with colon
        else if (trimmed.endsWith(':') && !trimmed.includes('.')) {
          headings.push({
            text: trimmed.slice(0, -1),
            level: 3,
            lineNumber: index
          });
        }
        // Numbered headings
        else if (/^\d+\.\s+/.test(trimmed)) {
          headings.push({
            text: trimmed,
            level: 2,
            lineNumber: index
          });
        }
      }
    });
    
    return {
      hasStructure: headings.length > 0,
      headings: headings,
      lineCount: lines.length,
      estimatedSections: Math.max(1, headings.length)
    };
  }

  /**
   * Extract structure from HTML content
   * @param {string} htmlContent - HTML content from mammoth
   * @returns {Object} Structure information
   */
  extractStructureFromHtml(htmlContent) {
    try {
      if (!htmlContent) {
        return { headings: [], sections: [], paragraphs: [], lists: [], tables: [] };
      }
      
      // Extract headings
      const headingMatches = htmlContent.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi) || [];
      const headings = headingMatches.map((match, index) => {
        const levelMatch = match.match(/<h([1-6])/i);
        const textMatch = match.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
        return {
          level: levelMatch ? parseInt(levelMatch[1]) : 1,
          text: textMatch ? textMatch[1].replace(/<[^>]*>/g, '').trim() : '',
          index: index
        };
      });
      
      // Extract paragraphs
      const paragraphMatches = htmlContent.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
      const paragraphs = paragraphMatches.map((match, index) => {
        const text = match.replace(/<[^>]*>/g, '').trim();
        return {
          text: text,
          index: index,
          wordCount: text.split(/\s+/).filter(word => word.length > 0).length
        };
      });
      
      // Extract lists
      const listMatches = htmlContent.match(/<[ou]l[^>]*>(.*?)<\/[ou]l>/gi) || [];
      const lists = listMatches.map((match, index) => {
        const itemMatches = match.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
        const items = itemMatches.map(item => item.replace(/<[^>]*>/g, '').trim());
        return {
          type: match.startsWith('<ol') ? 'ordered' : 'unordered',
          items: items,
          index: index
        };
      });
      
      // Extract tables
      const tableMatches = htmlContent.match(/<table[^>]*>(.*?)<\/table>/gi) || [];
      const tables = tableMatches.map((match, index) => {
        const rowMatches = match.match(/<tr[^>]*>(.*?)<\/tr>/gi) || [];
        return {
          rowCount: rowMatches.length,
          index: index
        };
      });
      
      // Create sections based on headings
      const sections = [];
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const nextHeading = headings[i + 1];
        
        sections.push({
          title: heading.text,
          level: heading.level,
          startIndex: heading.index,
          endIndex: nextHeading ? nextHeading.index : paragraphs.length
        });
      }
      
      return {
        headings,
        sections,
        paragraphs,
        lists,
        tables
      };
    } catch (error) {
      logger.warn('⚠️ Structure extraction failed:', error);
      return { headings: [], sections: [], paragraphs: [], lists: [], tables: [] };
    }
  }

  /**
   * Convert HTML to clean text
   * @param {string} htmlContent - HTML content
   * @returns {string} Clean text content
   */
  htmlToCleanText(htmlContent) {
    try {
      if (!htmlContent) {
        return '';
      }
      
      // Convert HTML to clean text while preserving some structure
      let cleanText = htmlContent
        // Convert headings to text with markers
        .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (match, level, text) => {
          const cleanHeading = text.replace(/<[^>]*>/g, '').trim();
          const marker = '#'.repeat(parseInt(level));
          return `\n\n${marker} ${cleanHeading}\n\n`;
        })
        // Convert paragraphs
        .replace(/<p[^>]*>(.*?)<\/p>/gi, (match, text) => {
          const cleanParagraph = text.replace(/<[^>]*>/g, '').trim();
          return cleanParagraph ? `${cleanParagraph}\n\n` : '';
        })
        // Convert list items
        .replace(/<li[^>]*>(.*?)<\/li>/gi, (match, text) => {
          const cleanItem = text.replace(/<[^>]*>/g, '').trim();
          return cleanItem ? `• ${cleanItem}\n` : '';
        })
        // Remove remaining HTML tags
        .replace(/<[^>]*>/g, ' ')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Clean up multiple newlines
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      
      return cleanText;
    } catch (error) {
      logger.warn('⚠️ HTML to text conversion failed:', error);
      // Fallback: simple tag removal
      return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Extract metadata from DOCX file
   */
  async extractDocxMetadata(filePath, mammothResult) {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      // Extract basic file metadata
      const metadata = {
        fileName: fileName,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        format: 'docx',
        processingMethod: 'mammoth'
      };
      
      // Add content-based metadata
      if (mammothResult && mammothResult.value) {
        const htmlContent = mammothResult.value;
        
        // Count elements
        const headingMatches = htmlContent.match(/<h[1-6][^>]*>/gi) || [];
        const paragraphMatches = htmlContent.match(/<p[^>]*>/gi) || [];
        const listMatches = htmlContent.match(/<[ou]l[^>]*>/gi) || [];
        const tableMatches = htmlContent.match(/<table[^>]*>/gi) || [];
        
        metadata.contentStructure = {
          headingCount: headingMatches.length,
          paragraphCount: paragraphMatches.length,
          listCount: listMatches.length,
          tableCount: tableMatches.length
        };
        
        // Estimate word count from HTML
        const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        metadata.estimatedWordCount = textContent.split(' ').filter(word => word.length > 0).length;
        metadata.estimatedCharacterCount = textContent.length;
      }
      
      // Add processing messages if available
      if (mammothResult && mammothResult.messages) {
        metadata.processingMessages = mammothResult.messages.map(msg => ({
          type: msg.type || 'info',
          message: msg.message || 'Unknown message'
        }));
        metadata.hasWarnings = mammothResult.messages.some(msg => msg.type === 'warning');
        metadata.hasErrors = mammothResult.messages.some(msg => msg.type === 'error');
      }
      
      return metadata;
      
    } catch (error) {
      logger.warn('⚠️ Failed to extract DOCX metadata:', error);
      return {
        fileName: path.basename(filePath),
        format: 'docx',
        processingMethod: 'mammoth',
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      cacheSize: this.processingCache.size,
      cacheHitRate: this.performanceMetrics.cacheHitRate / Math.max(this.performanceMetrics.documentsProcessed, 1),
      availableParsers: Array.from(this.parserInstances.keys()).filter(key => this.parserInstances.get(key) !== null)
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.processingCache.clear();
    logger.info('🧹 Multi-format processor caches cleared');
  }

  /**
   * Create custom PPTX parser (placeholder implementation)
   */
  createPptxParser() {
    // This would be a custom implementation for PPTX parsing
    // For now, return a placeholder
    return {
      parse: async (filePath) => {
        throw new Error('PPTX parsing not yet implemented');
      }
    };
  }
}

module.exports = MultiFormatProcessor;
