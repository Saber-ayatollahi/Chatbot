/**
 * Document Loader Module
 * Comprehensive PDF and document processing with metadata extraction
 * Phase 1: Foundation & Infrastructure Setup
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const mimeTypes = require('mime-types');
const { getConfig } = require('../../config/environment');
const logger = require('../../utils/logger');

// Document processing dependencies with graceful fallbacks
let pdfParse = null;
let mammoth = null;

try {
  pdfParse = require('pdf-parse');
} catch (error) {
  logger.warn('⚠️ pdf-parse not available - PDF processing will be limited');
}

try {
  mammoth = require('mammoth');
} catch (error) {
  logger.warn('⚠️ mammoth not available - DOCX processing will be limited');
}

class DocumentLoader {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.documentConfig = {
      maxFileSize: this.config?.get?.('documents.maxFileSize') || this.config?.documents?.maxFileSize || 50 * 1024 * 1024, // 50MB
      allowedTypes: this.config?.get?.('documents.allowedTypes') || this.config?.documents?.allowedTypes || ['pdf', 'docx', 'txt', 'md'],
      processingTimeout: this.config?.get?.('documents.processingTimeout') || this.config?.documents?.processingTimeout || 300000, // 5 minutes
      enableOCR: this.config?.get?.('documents.enableOCR') || this.config?.documents?.enableOCR || false,
      ocrLanguage: this.config?.get?.('documents.ocrLanguage') || this.config?.documents?.ocrLanguage || 'eng',
    };
    
    this.supportedTypes = {
      'application/pdf': this.loadPDF.bind(this),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.loadDOCX.bind(this),
      'text/plain': this.loadTXT.bind(this),
      'text/markdown': this.loadMarkdown.bind(this)
    };
  }

  /**
   * Load and process a document from file path
   * @param {string} filePath - Path to the document file
   * @param {string} sourceId - Unique identifier for the source
   * @param {string} version - Version of the document
   * @returns {Object} Processed document with metadata
   */
  async loadDocument(filePath, sourceId, version) {
    try {
      logger.info(`📄 Loading document: ${filePath}`);
      
      // Validate file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats and metadata
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();
      
      // Validate file size
      const maxSize = this.documentConfig.maxFileSize;
      if (fileSize > maxSize) {
        throw new Error(`File size (${fileSize} bytes) exceeds maximum allowed size (${maxSize} bytes)`);
      }

      // Calculate file hash for integrity checking
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Determine MIME type
      const mimeType = mimeTypes.lookup(filePath) || 'application/octet-stream';
      
      logger.info(`📊 File info: ${fileName} (${fileSize} bytes, ${mimeType})`);

      // Check if file type is supported
      if (!this.supportedTypes[mimeType]) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // Load document content using appropriate loader
      const startTime = Date.now();
      const documentContent = await this.supportedTypes[mimeType](fileBuffer, filePath);
      const processingTime = Date.now() - startTime;

      // Extract basic metadata
      const metadata = await this.extractMetadata(documentContent, filePath, stats);

      // Create document object
      const document = {
        sourceId,
        version,
        fileName,
        filePath,
        fileSize,
        fileHash,
        mimeType,
        fileExtension,
        processingTime,
        
        // Content
        content: documentContent.text,
        rawContent: documentContent.raw,
        
        // Structure
        pages: documentContent.pages || [],
        totalPages: documentContent.totalPages || 1,
        headings: documentContent.headings || [],
        sections: documentContent.sections || [],
        
        // Metadata
        title: metadata.title || fileName,
        author: metadata.author,
        creationDate: metadata.creationDate,
        modificationDate: stats.mtime,
        language: metadata.language || 'en',
        
        // Processing stats
        characterCount: documentContent.text.length,
        wordCount: this.countWords(documentContent.text),
        lineCount: documentContent.text.split('\n').length,
        
        // Quality metrics
        qualityScore: this.calculateQualityScore(documentContent),
        
        // Additional metadata
        metadata: {
          ...metadata,
          processingTimestamp: new Date().toISOString(),
          processingVersion: '1.0',
          extractedImages: documentContent.images || [],
          extractedTables: documentContent.tables || [],
          extractedLinks: documentContent.links || []
        }
      };

      logger.info(`✅ Document loaded successfully: ${document.characterCount} chars, ${document.wordCount} words, ${document.totalPages} pages`);
      
      return document;
    } catch (error) {
      logger.error(`❌ Failed to load document ${filePath}:`, error);
      throw new Error(`Document loading failed: ${error.message}`);
    }
  }

  /**
   * Load PDF document
   * @param {Buffer} buffer - File buffer
   * @param {string} filePath - File path for context
   * @returns {Object} Parsed PDF content
   */
  async loadPDF(buffer, filePath) {
    try {
      logger.info('📖 Processing PDF document...');
      
      const options = {
        max: this.documentConfig.processingTimeout / 1000, // Convert to seconds
        version: 'v1.10.100' // Specify PDF.js version for consistency
      };

      const data = await pdfParse(buffer, options);
      
      // Extract page-by-page content
      const pages = await this.extractPDFPages(buffer);
      
      // Extract headings and structure
      const structure = this.extractDocumentStructure(data.text);
      
      // Extract tables if present
      const tables = this.extractTables(data.text);
      
      // Extract links
      const links = this.extractLinks(data.text);

      return {
        text: data.text,
        raw: data.text,
        totalPages: data.numpages,
        pages: pages,
        headings: structure.headings,
        sections: structure.sections,
        tables: tables,
        links: links,
        info: data.info || {},
        metadata: data.metadata || {}
      };
    } catch (error) {
      logger.error('❌ PDF processing failed:', error);
      
      // Fallback: try OCR if enabled
      if (this.documentConfig.enableOCR) {
        logger.info('🔍 Attempting OCR fallback...');
        return await this.performOCR(buffer, filePath);
      }
      
      throw error;
    }
  }

  /**
   * Extract pages from PDF
   * @param {Buffer} buffer - PDF buffer
   * @returns {Array} Array of page objects
   */
  async extractPDFPages(buffer) {
    try {
      // This is a simplified implementation
      // In production, you might want to use a more sophisticated PDF parser
      const data = await pdfParse(buffer);
      const text = data.text;
      
      // Split text into pages (this is approximate)
      const pageBreaks = text.split('\f'); // Form feed character often indicates page breaks
      
      return pageBreaks.map((pageText, index) => ({
        pageNumber: index + 1,
        content: pageText.trim(),
        characterCount: pageText.length,
        wordCount: this.countWords(pageText)
      })).filter(page => page.content.length > 0);
    } catch (error) {
      logger.warn('⚠️ Could not extract individual pages:', error.message);
      return [];
    }
  }

  /**
   * Load DOCX document
   * @param {Buffer} buffer - File buffer
   * @param {string} filePath - File path for context
   * @returns {Object} Parsed DOCX content
   */
  async loadDOCX(buffer, filePath) {
    try {
      logger.info('📄 Processing DOCX document...');
      
      if (!mammoth) {
        logger.warn('⚠️ mammoth not available - using fallback DOCX processing');
        // Fallback: return basic file info
        const filename = path.basename(filePath);
        const fallbackContent = `Document: ${filename}\nFile size: ${buffer.length} bytes\nFormat: Microsoft Word Document (mammoth not available)`;
        
        return {
          text: fallbackContent,
          raw: fallbackContent,
          html: `<p>${fallbackContent}</p>`,
          totalPages: 1,
          pages: [{ pageNumber: 1, content: fallbackContent }],
          headings: [],
          sections: [],
          tables: [],
          links: [],
          warnings: ['mammoth not available - limited processing']
        };
      }
      
      const result = await mammoth.extractRawText({ buffer });
      const htmlResult = await mammoth.convertToHtml({ buffer });
      
      // Extract structure from HTML
      const structure = this.extractHTMLStructure(htmlResult.value);
      
      return {
        text: result.value,
        raw: result.value,
        html: htmlResult.value,
        totalPages: 1, // DOCX doesn't have clear page boundaries
        pages: [{ pageNumber: 1, content: result.value }],
        headings: structure.headings,
        sections: structure.sections,
        tables: structure.tables,
        links: structure.links,
        warnings: result.messages || []
      };
    } catch (error) {
      logger.error('❌ DOCX processing failed:', error);
      throw error;
    }
  }

  /**
   * Load plain text document
   * @param {Buffer} buffer - File buffer
   * @param {string} filePath - File path for context
   * @returns {Object} Parsed text content
   */
  async loadTXT(buffer, filePath) {
    try {
      logger.info('📝 Processing text document...');
      
      const text = buffer.toString('utf8');
      const structure = this.extractDocumentStructure(text);
      
      return {
        text: text,
        raw: text,
        totalPages: 1,
        pages: [{ pageNumber: 1, content: text }],
        headings: structure.headings,
        sections: structure.sections,
        tables: [],
        links: this.extractLinks(text)
      };
    } catch (error) {
      logger.error('❌ Text processing failed:', error);
      throw error;
    }
  }

  /**
   * Load Markdown document
   * @param {Buffer} buffer - File buffer
   * @param {string} filePath - File path for context
   * @returns {Object} Parsed Markdown content
   */
  async loadMarkdown(buffer, filePath) {
    try {
      logger.info('📋 Processing Markdown document...');
      
      const text = buffer.toString('utf8');
      const structure = this.extractMarkdownStructure(text);
      
      return {
        text: text,
        raw: text,
        totalPages: 1,
        pages: [{ pageNumber: 1, content: text }],
        headings: structure.headings,
        sections: structure.sections,
        tables: structure.tables,
        links: structure.links
      };
    } catch (error) {
      logger.error('❌ Markdown processing failed:', error);
      throw error;
    }
  }

  /**
   * Perform OCR on document (fallback method)
   * @param {Buffer} buffer - File buffer
   * @param {string} filePath - File path
   * @returns {Object} OCR results
   */
  async performOCR(buffer, filePath) {
    try {
      const Tesseract = require('tesseract.js');
      const pdf2pic = require('pdf2pic');
      
      logger.info('🔍 Performing OCR...');
      
      // Convert PDF to images
      const convert = pdf2pic.fromBuffer(buffer, {
        density: 100,
        saveFilename: 'page',
        savePath: './temp',
        format: 'png',
        width: 600,
        height: 800
      });
      
      const pages = [];
      let pageNumber = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        try {
          const page = await convert(pageNumber);
          
          // Perform OCR on the image
          const { data: { text } } = await Tesseract.recognize(page.path, this.documentConfig.ocrLanguage || 'eng');
          
          pages.push({
            pageNumber,
            content: text,
            characterCount: text.length,
            wordCount: this.countWords(text)
          });
          
          // Clean up temporary image
          await fs.remove(page.path);
          
          pageNumber++;
        } catch (error) {
          hasMorePages = false;
        }
      }
      
      const fullText = pages.map(p => p.content).join('\n\n');
      const structure = this.extractDocumentStructure(fullText);
      
      return {
        text: fullText,
        raw: fullText,
        totalPages: pages.length,
        pages: pages,
        headings: structure.headings,
        sections: structure.sections,
        tables: [],
        links: this.extractLinks(fullText),
        ocrProcessed: true
      };
    } catch (error) {
      logger.error('❌ OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract document structure (headings, sections)
   * @param {string} text - Document text
   * @returns {Object} Document structure
   */
  extractDocumentStructure(text) {
    const headings = [];
    const sections = [];
    
    
    // Extract headings using various patterns
    const headingPatterns = [
      /^\s*(#{1,6})\s+(.+)$/gm, // Markdown headings (allow leading whitespace)
      /^\s*([A-Z][A-Z\s]{2,}):?\s*$/gm, // ALL CAPS headings (allow leading whitespace)
      /^\s*(\d+\.?\d*\.?\d*)\s+([A-Z][^.!?]*[.!?]?)$/gm, // Numbered headings (allow leading whitespace)
      /^\s*([IVX]+\.)\s+([A-Z][^.!?]*[.!?]?)$/gm // Roman numeral headings (allow leading whitespace)
    ];
    
    headingPatterns.forEach((pattern, patternIndex) => {
      // Reset the regex lastIndex to avoid issues with global flag
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        
        headings.push({
          level: this.determineHeadingLevel(match[1]),
          text: match[2] || match[1],
          position: match.index
        });
      }
    });
    
    // Create sections based on headings
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextHeading = headings[i + 1];
      
      const sectionStart = heading.position;
      const sectionEnd = nextHeading ? nextHeading.position : text.length;
      const sectionContent = text.substring(sectionStart, sectionEnd);
      
      sections.push({
        title: heading.text,
        level: heading.level,
        content: sectionContent,
        startPosition: sectionStart,
        endPosition: sectionEnd,
        wordCount: this.countWords(sectionContent)
      });
    }
    
    return { headings, sections };
  }

  /**
   * Extract HTML structure from converted DOCX
   * @param {string} html - HTML content
   * @returns {Object} Document structure
   */
  extractHTMLStructure(html) {
    const headings = [];
    const sections = [];
    const tables = [];
    const links = [];
    
    // Extract headings
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      headings.push({
        level: parseInt(match[1]),
        text: match[2].replace(/<[^>]*>/g, ''), // Strip HTML tags
        position: match.index
      });
    }
    
    // Extract tables
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
    while ((match = tableRegex.exec(html)) !== null) {
      tables.push({
        html: match[0],
        text: match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        position: match.index
      });
    }
    
    // Extract links
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        url: match[1],
        text: match[2].replace(/<[^>]*>/g, ''),
        position: match.index
      });
    }
    
    return { headings, sections, tables, links };
  }

  /**
   * Extract Markdown structure
   * @param {string} text - Markdown text
   * @returns {Object} Document structure
   */
  extractMarkdownStructure(text) {
    const headings = [];
    const sections = [];
    const tables = [];
    const links = [];
    
    // Extract headings
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(text)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        position: match.index
      });
    }
    
    // Extract tables
    const tableRegex = /^\|.*\|$/gm;
    const tableLines = [];
    while ((match = tableRegex.exec(text)) !== null) {
      tableLines.push({
        content: match[0],
        position: match.index
      });
    }
    
    // Group consecutive table lines
    let currentTable = null;
    tableLines.forEach(line => {
      if (!currentTable || line.position > currentTable.endPosition + 100) {
        currentTable = {
          content: line.content,
          startPosition: line.position,
          endPosition: line.position + line.content.length
        };
        tables.push(currentTable);
      } else {
        currentTable.content += '\n' + line.content;
        currentTable.endPosition = line.position + line.content.length;
      }
    });
    
    // Extract links
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    while ((match = linkRegex.exec(text)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        position: match.index
      });
    }
    
    return { headings, sections, tables, links };
  }

  /**
   * Extract tables from text
   * @param {string} text - Document text
   * @returns {Array} Array of table objects
   */
  extractTables(text) {
    const tables = [];
    
    // Look for table-like structures
    const lines = text.split('\n');
    let currentTable = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line looks like a table row (contains multiple separators)
      const separatorCount = (line.match(/\|/g) || []).length;
      const tabCount = (line.match(/\t/g) || []).length;
      
      if (separatorCount >= 2 || tabCount >= 2) {
        if (!currentTable) {
          currentTable = {
            startLine: i,
            endLine: i,
            content: [line],
            separatorType: separatorCount >= 2 ? '|' : '\t'
          };
        } else {
          currentTable.endLine = i;
          currentTable.content.push(line);
        }
      } else if (currentTable && currentTable.content.length >= 2) {
        // End of table
        tables.push({
          content: currentTable.content.join('\n'),
          startLine: currentTable.startLine,
          endLine: currentTable.endLine,
          rowCount: currentTable.content.length,
          separatorType: currentTable.separatorType
        });
        currentTable = null;
      } else {
        currentTable = null;
      }
    }
    
    // Add final table if exists
    if (currentTable && currentTable.content.length >= 2) {
      tables.push({
        content: currentTable.content.join('\n'),
        startLine: currentTable.startLine,
        endLine: currentTable.endLine,
        rowCount: currentTable.content.length,
        separatorType: currentTable.separatorType
      });
    }
    
    return tables;
  }

  /**
   * Extract links from text
   * @param {string} text - Document text
   * @returns {Array} Array of link objects
   */
  extractLinks(text) {
    const links = [];
    
    // URL regex patterns
    const urlPatterns = [
      /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi,
      /www\.[^\s<>"{}|\\^`[\]]+/gi,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
    ];
    
    urlPatterns.forEach(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let url = match[0];
        
        // Remove trailing punctuation from URLs
        if (match[0].includes('@')) {
          // For emails, don't remove trailing punctuation as it might be part of the email
        } else {
          // For URLs, remove trailing punctuation
          url = url.replace(/[.,;:!?]+$/, '');
        }
        
        links.push({
          url: url,
          type: match[0].includes('@') ? 'email' : 'url',
          position: match.index
        });
      }
    });
    
    return links;
  }

  /**
   * Extract metadata from document
   * @param {Object} documentContent - Parsed document content
   * @param {string} filePath - File path
   * @param {Object} stats - File stats
   * @returns {Object} Extracted metadata
   */
  async extractMetadata(documentContent, filePath, stats) {
    const metadata = {
      fileName: path.basename(filePath),
      fileExtension: path.extname(filePath),
      filePath: filePath,
      fileSize: stats.size,
      creationDate: stats.birthtime,
      modificationDate: stats.mtime,
      accessDate: stats.atime
    };
    
    // Extract title from content
    if (documentContent.headings && documentContent.headings.length > 0) {
      metadata.title = documentContent.headings[0].text;
    } else {
      // Try to find title in first few lines
      const lines = documentContent.text.split('\n').slice(0, 5);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 10 && trimmed.length < 100) {
          metadata.title = trimmed;
          break;
        }
      }
    }
    
    // Extract author from PDF info if available
    if (documentContent.info) {
      metadata.author = documentContent.info.Author;
      metadata.creator = documentContent.info.Creator;
      metadata.producer = documentContent.info.Producer;
      metadata.subject = documentContent.info.Subject;
      metadata.keywords = documentContent.info.Keywords;
    }
    
    // Detect language (simple heuristic)
    metadata.language = this.detectLanguage(documentContent.text);
    
    return metadata;
  }

  /**
   * Determine heading level from heading marker
   * @param {string} marker - Heading marker
   * @returns {number} Heading level
   */
  determineHeadingLevel(marker) {
    if (marker.startsWith('#')) {
      return marker.length; // Markdown style
    } else if (/^\d+\./.test(marker)) {
      return marker.split('.').length; // Numbered style
    } else if (/^[IVX]+\./.test(marker)) {
      return 1; // Roman numerals are typically top level
    } else {
      return 1; // Default to level 1
    }
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} Word count
   */
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate quality score for document content
   * @param {Object} documentContent - Document content
   * @returns {number} Quality score (0-1)
   */
  calculateQualityScore(documentContent) {
    let score = 0.5; // Base score
    
    // Text length factor - penalize very short content
    const textLength = documentContent.text.length;
    if (textLength < 50) {
      score -= 0.2; // Penalize very short content
    } else if (textLength > 1000) {
      score += 0.1;
    }
    if (textLength > 10000) score += 0.1;
    
    // Structure factor
    if (documentContent.headings && documentContent.headings.length > 0) {
      score += 0.1;
    }
    
    // Content diversity factor - but penalize if content is too short
    const wordCount = this.countWords(documentContent.text);
    if (wordCount < 10) {
      score -= 0.1; // Penalize very short content
    } else {
      const uniqueWords = new Set(documentContent.text.toLowerCase().match(/\b\w+\b/g) || []).size;
      const diversity = wordCount > 0 ? uniqueWords / wordCount : 0;
      score += diversity * 0.2;
    }
    
    // Table and structure factor
    if (documentContent.tables && documentContent.tables.length > 0) {
      score += 0.05;
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Simple language detection
   * @param {string} text - Text to analyze
   * @returns {string} Detected language code
   */
  detectLanguage(text) {
    // Very simple heuristic - in production, use a proper language detection library
    const sample = text.substring(0, 1000).toLowerCase();
    
    // Common English words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.reduce((count, word) => {
      return count + (sample.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);
    
    // If we find many English words, assume English
    if (englishCount > 10) {
      return 'en';
    }
    
    // Default to English
    return 'en';
  }

  /**
   * Validate document before processing
   * @param {string} filePath - Path to document
   * @returns {Object} Validation result
   */
  async validateDocument(filePath) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        validation.isValid = false;
        validation.errors.push('File does not exist');
        return validation;
      }
      
      // Check file size
      const stats = await fs.stat(filePath);
      const maxSize = this.documentConfig.maxFileSize;
      
      if (stats.size > maxSize) {
        validation.isValid = false;
        validation.errors.push(`File size (${stats.size} bytes) exceeds maximum (${maxSize} bytes)`);
      }
      
      if (stats.size === 0) {
        validation.isValid = false;
        validation.errors.push('File is empty');
      }
      
      // Check file type
      const mimeType = mimeTypes.lookup(filePath);
      if (!this.supportedTypes[mimeType]) {
        validation.isValid = false;
        validation.errors.push(`Unsupported file type: ${mimeType}`);
      }
      
      // Check file permissions
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (error) {
        validation.isValid = false;
        validation.errors.push('File is not readable');
      }
      
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Validation error: ${error.message}`);
    }
    
    return validation;
  }

  /**
   * Get supported file types
   * @returns {Array} Array of supported MIME types
   */
  getSupportedTypes() {
    return Object.keys(this.supportedTypes);
  }
}

module.exports = DocumentLoader;
